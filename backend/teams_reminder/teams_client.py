"""
Microsoft Teams messaging via Graph API (app-only auth).

Requires Azure AD app permissions:
  - User.Read.All
  - Chat.Create
  - Chat.ReadWrite.All
  - ChatMessage.Send

Set TEAMS_SENDER_EMAIL to a licensed M365 user — that account is the
"automation sender" on the other side of each 1:1 chat with employees.
"""

from __future__ import annotations

import logging
import os
import re
import time
from datetime import datetime, timezone
from typing import Optional

import requests

log = logging.getLogger(__name__)

TEAMS_SENDER_EMAIL = os.getenv("TEAMS_SENDER_EMAIL", "")
TEST_MODE = os.getenv("TEST_MODE_TEAMS", os.getenv("TEST_MODE", "False")).lower() == "true"
TEST_TEAMS_EMAIL = os.getenv("TEST_TEAMS_EMAIL", os.getenv("TEST_EMAIL", ""))

_user_cache: dict[str, str] = {}
_chat_cache: dict[str, str] = {}  # recipient_user_id -> chat_id


def _graph_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _get_app_token() -> Optional[str]:
    tenant_id = os.getenv("SHAREPOINT_TENANT_ID")
    client_id = os.getenv("SHAREPOINT_CLIENT_ID")
    client_secret = os.getenv("SHAREPOINT_CLIENT_SECRET")
    if not tenant_id or not client_id or not client_secret:
        return None
    url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
    data = {
        "grant_type": "client_credentials",
        "client_id": client_id,
        "client_secret": client_secret,
        "scope": "https://graph.microsoft.com/.default",
    }
    try:
        resp = requests.post(url, data=data, timeout=30)
        if resp.status_code == 200:
            return resp.json().get("access_token")
    except Exception as e:
        log.warning("Failed to fetch client credentials app token: %s", e)
    return None


def _resolve_user_id(token: str, email: str) -> Optional[str]:
    key = email.strip().lower()
    if key in _user_cache:
        return _user_cache[key]
        
    # Use Application Token for user lookup if available (since User.Read.All is granted as an Application permission)
    lookup_token = _get_app_token() or token
    url = f"https://graph.microsoft.com/v1.0/users/{email}"
    resp = requests.get(url, headers=_graph_headers(lookup_token), timeout=30)
    if resp.status_code != 200:
        log.warning("User lookup failed for %s: %s", email, resp.text)
        return None
    user_id = resp.json()["id"]
    _user_cache[key] = user_id
    return user_id


def _find_existing_chat(token: str, sender_id: str, recipient_id: str) -> Optional[str]:
    """Return chat id for an existing 1:1 between sender and recipient, if any."""
    # Try /me/chats first (standard for delegated token context)
    url = "https://graph.microsoft.com/v1.0/me/chats"
    params = {"$expand": "members", "$top": 50}
    resp = requests.get(url, headers=_graph_headers(token), params=params, timeout=30)
    if resp.status_code != 200:
        # Fallback to users/{sender_id}/chats (application/fallback context)
        url = f"https://graph.microsoft.com/v1.0/users/{sender_id}/chats"
        resp = requests.get(url, headers=_graph_headers(token), params=params, timeout=30)
        if resp.status_code != 200:
            return None
            
    for chat in resp.json().get("value", []):
        if chat.get("chatType") != "oneOnOne":
            continue
        member_ids = {
            m.get("userId")
            for m in chat.get("members", [])
            if m.get("userId")
        }
        if {sender_id, recipient_id} <= member_ids:
            return chat["id"]
    return None


def _create_chat(token: str, sender_id: str, recipient_id: str) -> Optional[str]:

    url = "https://graph.microsoft.com/v1.0/chats"
    body = {
        "chatType": "oneOnOne",
        "members": [
            {
                "@odata.type": "#microsoft.graph.aadUserConversationMember",
                "roles": ["owner"],
                "user@odata.bind": f"https://graph.microsoft.com/v1.0/users('{sender_id}')",
            },
            {
                "@odata.type": "#microsoft.graph.aadUserConversationMember",
                "roles": ["owner"],
                "user@odata.bind": f"https://graph.microsoft.com/v1.0/users('{recipient_id}')",
            },
        ],
    }
    resp = requests.post(url, headers=_graph_headers(token), json=body, timeout=30)
    if resp.status_code not in (200, 201):
        log.error("Chat create failed: %s", resp.text)
        return None
    return resp.json()["id"]


def get_or_create_chat(token: str, sender_id: str, recipient_id: str) -> Optional[str]:
    cache_key = recipient_id
    if cache_key in _chat_cache:
        return _chat_cache[cache_key]
    chat_id = _create_chat(token, sender_id, recipient_id)
    if chat_id:
        _chat_cache[cache_key] = chat_id
    return chat_id


def send_teams_message(
    token: str,
    recipient_email: str,
    html_body: str,
    *,
    sender_email: Optional[str] = None,
) -> dict:
    """Send a Teams DM. Returns {ok, chat_id, message_id, error, recipient_email}."""
    actual_recipient = TEST_TEAMS_EMAIL if TEST_MODE else recipient_email
    sender = sender_email or TEAMS_SENDER_EMAIL
    if not sender:
        return {"ok": False, "error": "TEAMS_SENDER_EMAIL not configured"}

    sender_id = _resolve_user_id(token, sender)
    recipient_id = _resolve_user_id(token, actual_recipient)
    if not sender_id or not recipient_id:
        return {"ok": False, "error": f"Could not resolve user IDs for {sender} / {actual_recipient}"}

    chat_id = get_or_create_chat(token, sender_id, recipient_id)
    if not chat_id:
        return {"ok": False, "error": "Could not create or find Teams chat"}

    url = f"https://graph.microsoft.com/v1.0/chats/{chat_id}/messages"
    body = {"body": {"contentType": "html", "content": html_body}}
    resp = requests.post(url, headers=_graph_headers(token), json=body, timeout=30)
    if resp.status_code not in (200, 201):
        return {"ok": False, "error": resp.text, "chat_id": chat_id}

    msg = resp.json()
    return {
        "ok": True,
        "chat_id": chat_id,
        "message_id": msg.get("id"),
        "recipient_email": actual_recipient,
        "recipient_id": recipient_id,
        "sender_id": sender_id,
    }


def _parse_iso(val: str) -> datetime:
    """Safely parse UTC ISO string with/without Z to an offset-aware UTC datetime."""
    cleaned = val.replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(cleaned)
    except ValueError:
        # Fallback parsing for truncated or complex formats
        try:
            dt = datetime.strptime(cleaned[:19], "%Y-%m-%dT%H:%M:%S")
            dt = dt.replace(tzinfo=timezone.utc)
        except Exception:
            dt = datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    return dt


def fetch_messages_since(
    token: str,
    chat_id: str,
    since_iso: str,
    *,
    top: int = 50,
) -> list[dict]:
    """Return messages in chat created after since_iso (UTC ISO string)."""
    url = f"https://graph.microsoft.com/v1.0/chats/{chat_id}/messages"
    params = {"$top": top, "$orderby": "createdDateTime desc"}
    resp = requests.get(url, headers=_graph_headers(token), params=params, timeout=30)
    if resp.status_code != 200:
        log.warning("Failed to fetch chat messages: %s", resp.text)
        return []

    from datetime import timezone
    since_dt = _parse_iso(since_iso)
    results = []
    for msg in resp.json().get("value", []):
        created = msg.get("createdDateTime")
        if not created:
            continue
        created_dt = _parse_iso(created)
        if created_dt <= since_dt:
            continue
        from_user = (msg.get("from") or {}).get("user") or {}
        body_content = (msg.get("body") or {}).get("content", "")
        plain = re.sub(r"<[^>]+>", "", body_content).strip()
        results.append({
            "id": msg.get("id"),
            "created_at": created,
            "sender_id": from_user.get("id"),
            "sender_name": from_user.get("displayName", ""),
            "content_html": body_content,
            "content_plain": plain,
        })
    return results


def find_employee_reply(
    token: str,
    chat_id: str,
    employee_user_id: str,
    after_iso: str,
    *,
    exclude_sender_ids: Optional[set[str]] = None,
) -> Optional[dict]:
    """Return the first reply from the employee after our reminder message."""
    exclude = exclude_sender_ids or set()
    messages = fetch_messages_since(token, chat_id, after_iso)
    for msg in reversed(messages):  # oldest first
        sid = msg.get("sender_id")
        if not sid or sid in exclude:
            continue
        if sid == employee_user_id and msg.get("content_plain"):
            return msg
    return None
