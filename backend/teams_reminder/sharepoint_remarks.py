"""
Write employee replies back to the Remarks column in the live SharePoint Excel file.

Uses Microsoft Graph workbook session API on the same SHAREPOINT_SHARE_URL
file that api.py reads from.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional

import requests

log = logging.getLogger(__name__)

_drive_item_cache: dict = {}


def _encode_share_url(share_url: str) -> str:
    import base64
    b64 = base64.urlsafe_b64encode(share_url.encode("utf-8")).decode("utf-8").rstrip("=")
    return "u!" + b64


def _col_letter(col_idx: int) -> str:
    """0-based column index -> Excel letter (0=A)."""
    result = ""
    n = col_idx + 1
    while n:
        n, rem = divmod(n - 1, 26)
        result = chr(65 + rem) + result
    return result


def get_drive_item(token: str, share_url: str) -> dict:
    if _drive_item_cache.get("share_url") == share_url and _drive_item_cache.get("item"):
        return _drive_item_cache["item"]

    share_id = _encode_share_url(share_url)
    url = f"https://graph.microsoft.com/v1.0/shares/{share_id}/driveItem"
    resp = requests.get(
        url,
        headers={"Authorization": f"Bearer {token}"},
        timeout=30,
    )
    resp.raise_for_status()
    item = resp.json()
    _drive_item_cache["share_url"] = share_url
    _drive_item_cache["item"] = item
    return item


def _workbook_url(drive_id: str, item_id: str, path: str) -> str:
    return f"https://graph.microsoft.com/v1.0/drives/{drive_id}/items/{item_id}/workbook/{path}"


def _create_session(token: str, drive_id: str, item_id: str) -> str:
    url = _workbook_url(drive_id, item_id, "createSession")
    resp = requests.post(
        url,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json={"persistChanges": True},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()["id"]


def _close_session(token: str, drive_id: str, item_id: str, session_id: str) -> None:
    url = _workbook_url(drive_id, item_id, "closeSession")
    requests.post(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "workbook-session-id": session_id,
        },
        json={},
        timeout=30,
    )


def _get_header_row_values(
    token: str,
    drive_id: str,
    item_id: str,
    session_id: str,
    sheet_name: str,
    header_excel_row: int,
) -> list:
    """Read one header row to locate the Remarks column."""
    address = f"{header_excel_row}:{header_excel_row}"
    url = _workbook_url(drive_id, item_id, f"worksheets('{_escape_sheet(sheet_name)}')/range(address='{address}')")
    resp = requests.get(
        url,
        headers={"Authorization": f"Bearer {token}", "workbook-session-id": session_id},
        timeout=30,
    )
    resp.raise_for_status()
    values = resp.json().get("values", [[]])
    return values[0] if values else []


def _escape_sheet(name: str) -> str:
    return name.replace("'", "''")


def _find_remarks_col(headers: list) -> Optional[int]:
    aliases = {"remarks", "remark", "comments", "comment"}
    for idx, val in enumerate(headers):
        if val is None:
            continue
        if str(val).strip().lower() in aliases:
            return idx
    return None


def append_remark(
    token: str,
    share_url: str,
    *,
    sheet_name: str,
    excel_row: int,
    header_excel_row: int,
    new_text: str,
    existing_remark: str = "",
    assignee: str = "",
) -> dict:
    """Append a timestamped remark to the Remarks cell for one Excel row."""
    if not new_text.strip():
        return {"ok": False, "error": "empty remark text"}

    item = get_drive_item(token, share_url)
    drive_id = item["parentReference"]["driveId"]
    item_id = item["id"]

    session_id = _create_session(token, drive_id, item_id)
    try:
        headers = _get_header_row_values(
            token, drive_id, item_id, session_id, sheet_name, header_excel_row
        )
        remarks_col = _find_remarks_col(headers)
        if remarks_col is None:
            return {"ok": False, "error": f"Remarks column not found on sheet '{sheet_name}'"}

        col_letter = _col_letter(remarks_col)
        address = f"{col_letter}{excel_row}"

        # Read current cell value
        read_url = _workbook_url(
            drive_id, item_id,
            f"worksheets('{_escape_sheet(sheet_name)}')/range(address='{address}')",
        )
        read_resp = requests.get(
            read_url,
            headers={"Authorization": f"Bearer {token}", "workbook-session-id": session_id},
            timeout=30,
        )
        read_resp.raise_for_status()
        current_vals = read_resp.json().get("values", [[""]])
        current = str(current_vals[0][0]).strip() if current_vals and current_vals[0] else ""
        if current.lower() in ("", "nan", "none"):
            current = existing_remark.strip() if existing_remark and existing_remark != "-" else ""

        entry = new_text.strip()
        merged = f"{current}\n{entry}".strip() if current else entry

        patch_resp = requests.patch(
            read_url,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                "workbook-session-id": session_id,
            },
            json={"values": [[merged]]},
            timeout=30,
        )
        patch_resp.raise_for_status()
        return {"ok": True, "address": f"{sheet_name}!{address}", "written": merged}
    finally:
        _close_session(token, drive_id, item_id, session_id)
