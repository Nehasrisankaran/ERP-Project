"""
api.py — Fanam Teams Reminder Agent · FastAPI Backend
Run: uvicorn api:app --reload --port 8000

Sends Teams DMs (not email) at 10:00 AM & 4:00 PM daily for overdue /
due-today tasks, asks employees why completion has lagged, and saves their
Teams replies into the Remarks column on the live SharePoint Excel file.
"""

import os
from dotenv import load_dotenv
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
load_dotenv(env_path, override=True)

import re
import psycopg2
import logging
import threading
import base64
import contextvars
from io import BytesIO
from contextlib import contextmanager
from datetime import datetime, date, timezone
from collections import defaultdict
from typing import Optional

import pandas as pd
import requests
import schedule
import time

from fastapi import FastAPI, BackgroundTasks, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

try:
    import msal
except ImportError:
    msal = None

from teams_reminder.teams_client import send_teams_message, find_employee_reply, TEAMS_SENDER_EMAIL
from teams_reminder.sharepoint_remarks import append_remark
from teams_reminder.auth_teams import get_graph_token as _get_teams_graph_token

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)

# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────
EXCEL_PATH = os.getenv("EXCEL_FILE", "Fanam Project Planning & Allocation.xlsx")

SHAREPOINT_TENANT_ID = os.getenv("SHAREPOINT_TENANT_ID", "")
SHAREPOINT_CLIENT_ID = os.getenv("SHAREPOINT_CLIENT_ID", "")
SHAREPOINT_CLIENT_SECRET = os.getenv("SHAREPOINT_CLIENT_SECRET", "")
SHAREPOINT_SHARE_URL = os.getenv("SHAREPOINT_SHARE_URL", "")
SHAREPOINT_CACHE_PATH = os.getenv("SHAREPOINT_CACHE_PATH", "sharepoint_cache.xlsx")
USE_SHAREPOINT = bool(SHAREPOINT_SHARE_URL and SHAREPOINT_CLIENT_ID and SHAREPOINT_CLIENT_SECRET)

TEST_MODE_TEAMS = os.getenv("TEST_MODE_TEAMS", os.getenv("TEST_MODE", "False")).lower() == "true"
TEST_MODE_PM = os.getenv("TEST_MODE_PM", os.getenv("TEST_MODE", "False")).lower() == "true"
TEST_MODE_DIRECTORS = os.getenv("TEST_MODE_DIRECTORS", os.getenv("TEST_MODE", "False")).lower() == "true"
TEST_TEAMS_EMAIL = os.getenv("TEST_TEAMS_EMAIL", os.getenv("TEST_EMAIL", ""))
MORNING_TIME_UTC = os.getenv("MORNING_REMINDER_TIME_UTC", "04:30")
PM_REPORT_TIME_UTC = os.getenv("PM_REPORT_TIME_UTC", "05:00")
EVENING_TIME_UTC = os.getenv("EVENING_REMINDER_TIME_UTC", "11:30")
DIRECTORS_REPORT_TIME_UTC = os.getenv("DIRECTORS_REPORT_TIME_UTC", "12:00")
REPLY_POLL_MINUTES = int(os.getenv("REPLY_POLL_MINUTES", "5"))
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
DIRECTORS_EMAIL = os.getenv("DIRECTORS_EMAIL", "vinayr@fanamdigital.com,srk@fanamdigital.com")
NEW_TASK_CHECK_MINUTES = int(os.getenv("NEW_TASK_CHECK_MINUTES", "2"))
PM_EMAIL = os.getenv("PM_EMAIL", "bhavyasri@fanamdigital.com")


def utc_to_ist_str(utc_time_str: str) -> str:
    try:
        h, m = map(int, utc_time_str.split(":"))
        total_m = h * 60 + m + 330
        new_h = (total_m // 60) % 24
        new_m = total_m % 60
        return f"{new_h:02d}:{new_m:02d}"
    except Exception:
        return utc_time_str


def update_env_file(key: str, value: str):
    lines = []
    if os.path.exists(".env"):
        with open(".env", "r") as f:
            lines = f.readlines()
    found = False
    new_lines = []
    for line in lines:
        if line.strip().startswith(f"{key}="):
            new_lines.append(f"{key}={value}\n")
            found = True
        else:
            new_lines.append(line)
    if not found:
        new_lines.append(f"{key}={value}\n")
    with open(".env", "w") as f:
        f.writelines(new_lines)


def generate_mitigation_suggestion(task_name: str, task_desc: str, delay_reason: str) -> str:
    """Uses Gemini API to generate a brief mitigation plan/suggestion for a delayed task."""
    if not GEMINI_API_KEY:
        log.warning("GEMINI_API_KEY is not set. Skipping AI mitigation suggestion.")
        return "Please consult with your team lead or manager for next steps."
        
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key={GEMINI_API_KEY}"
    prompt = (
        f"You are a professional technical lead. An employee is blocked or delayed on this task:\n"
        f"Task Name: {task_name}\n"
        f"Description: {task_desc}\n"
        f"Delay Reason: {delay_reason}\n\n"
        f"Provide a brief, practical, actionable technical suggestion or mitigation plan (max 2 sentences, speak directly to the employee) to help them overcome this block. "
        f"Do not instruct the user to email, CC, or forward anything to you, as you operate strictly as an automated Teams bot."
    )
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt}
                ]
            }
        ]
    }
    try:
        resp = requests.post(url, json=payload, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        return text.strip()
    except Exception as e:
        log.warning("Gemini API call failed: %s", e)
        return "Check dependencies, verify code setup, and sync with your team lead for guidance."


def _is_assignee_match(assignee_in_task: str, search_name: str) -> bool:
    if not assignee_in_task or not search_name:
        return False
    ta = " ".join(assignee_in_task.strip().lower().split())
    sn = " ".join(search_name.strip().lower().split())
    return ta in sn or sn in ta


def generate_skills_matrix(employee_name: str) -> dict:
    """Call Gemini API with the employee's full task history and return {strengths, weaknesses}."""
    import json as _json
    tasks = load_tasks()
    emp_tasks = [
        t for t in tasks
        if _is_assignee_match(t["assignee"], employee_name)
    ]
    if not emp_tasks:
        return {"strengths": "", "weaknesses": "No tasks found for this employee."}

    rows = "\n".join(
        f"| {t['project']} | {t['task'] or '—'} | {t['module'] or '—'} "
        f"| {t['status'] or '—'} | {t['eta_str'] or '—'} "
        f"| {(t['remarks'] or '—')[:100]} |"
        for t in emp_tasks
    )
    prompt = (
        f"You are an experienced engineering manager reviewing an employee's task history.\n"
        f"Analyse the tasks below and identify STRENGTHS and WEAKNESSES based on patterns "
        f"in status, delivery timeliness, and any remarks.\n\n"
        f"Employee: {employee_name}\n"
        f"| Project | Task | Module | Status | ETA | Remarks |\n"
        f"|---|---|---|---|---|---|\n"
        f"{rows}\n\n"
        f"Return ONLY a valid JSON object (no markdown fences, no extra text) with exactly two keys:\n"
        f'- "strengths": a bullet-point list (each bullet starts with \"• \") of technical/soft strengths inferred\n'
        f'- "weaknesses": a bullet-point list (each bullet starts with \"• \") of skill gaps or areas for improvement\n\n'
        f'Example: {{"strengths": "• Strong delivery on X\\n• Excellent in Y", '
        f'"weaknesses": "• Delays in Z\\n• Needs mentoring in W"}}'
    )
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"gemini-3.5-flash:generateContent?key={GEMINI_API_KEY}"
    )
    payload = {"contents": [{"parts": [{"text": prompt}]}]}
    try:
        resp = requests.post(url, json=payload, timeout=30)
        resp.raise_for_status()
        raw_text = resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
        # Strip markdown code fences if Gemini wraps the JSON in them
        if raw_text.startswith("```"):
            raw_text = re.sub(r"^```[a-z]*\n?", "", raw_text)
            raw_text = re.sub(r"\n?```$", "", raw_text.strip())
        return _json.loads(raw_text)
    except Exception as e:
        log.warning("Gemini skills matrix call failed: %s", e)
        return {"error": f"Gemini API call failed: {e}"}


SKIP_SHEETS = {"Projects"}
SWAP_AMBIGUOUS_NATIVE_DATES = os.getenv("SWAP_AMBIGUOUS_NATIVE_DATES", "true").lower() == "true"

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg2://postgres:postgres@localhost:5431/dbnamehere")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5431")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")
DB_NAME = os.getenv("DB_NAME", "")

def _get_db_conn():
    url = DATABASE_URL
    if url:
        if "postgresql+psycopg2://" in url:
            url = url.replace("postgresql+psycopg2://", "postgresql://")
        return psycopg2.connect(url)
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME or "dbnamehere"
    )

COLUMN_ALIASES = {
    "assignee(s)": "Assignee", "assignees": "Assignee", "assignee": "Assignee",
    "task name": "Task", "task": "Task",
    "module": "Module", "description": "Description",
    "current status": "Status", "status": "Status",
    "eta": "ETA", "start date": "Start Date",
    "remarks": "Remarks",
    "email": "Email", "email address": "Email",
    "mail id": "Email", "official email": "Email",
}

_run_log: list[dict] = []
_scheduler_running = False
_scheduler_thread: threading.Thread | None = None
_prefer_uploaded_excel = False
_raw_row_counts = {"total": 0, "per_sheet": {}}
_graph_token_cache = {"token": None, "expires_at": 0}


# ─────────────────────────────────────────────
# DATABASE
# ─────────────────────────────────────────────
def _init_db():
    # Attempt to create database if not exists
    db_name = DB_NAME
    url = DATABASE_URL
    if url:
        if "postgresql+psycopg2://" in url:
            url = url.replace("postgresql+psycopg2://", "postgresql://")
        import urllib.parse as urlparse
        try:
            parsed = urlparse.urlparse(url)
            db_name = parsed.path.lstrip('/')
        except Exception:
            pass
    if not db_name:
        db_name = "fanam_teams_reminder"
        
    temp_conn = None
    try:
        if url:
            import urllib.parse as urlparse
            parsed = urlparse.urlparse(url)
            temp_url = urlparse.urlunparse((
                parsed.scheme,
                parsed.netloc,
                "/postgres",
                parsed.params,
                parsed.query,
                parsed.fragment
            ))
            temp_conn = psycopg2.connect(temp_url)
        else:
            temp_conn = psycopg2.connect(
                host=DB_HOST,
                port=DB_PORT,
                user=DB_USER,
                password=DB_PASSWORD,
                database="postgres"
            )
        temp_conn.autocommit = True
        cur = temp_conn.cursor()
        cur.execute(f"SELECT 1 FROM pg_database WHERE datname = '{db_name}'")
        exists = cur.fetchone()
        if not exists:
            cur.execute(f"CREATE DATABASE {db_name}")
        cur.close()
    except Exception as e:
        log.warning("Database create warning: %s", e)
    finally:
        if temp_conn:
            temp_conn.close()

    # Connect to the target database and create tables
    con = _get_db_conn()
    con.autocommit = True
    cur = con.cursor()
    
    cur.execute("""
        CREATE TABLE IF NOT EXISTS activity_log (
            id SERIAL PRIMARY KEY,
            timestamp VARCHAR(100) NOT NULL,
            event VARCHAR(255) NOT NULL,
            detail TEXT DEFAULT ''
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS reminder_history (
            id SERIAL PRIMARY KEY,
            sent_at VARCHAR(100) NOT NULL,
            assignee VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL,
            task_count INTEGER NOT NULL,
            status VARCHAR(50) NOT NULL,
            subject TEXT DEFAULT '',
            error_detail TEXT DEFAULT '',
            chat_id VARCHAR(255) DEFAULT '',
            message_id VARCHAR(255) DEFAULT ''
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS pending_teams_replies (
            id SERIAL PRIMARY KEY,
            sent_at VARCHAR(100) NOT NULL,
            assignee VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL,
            chat_id VARCHAR(255) NOT NULL,
            message_id VARCHAR(255) NOT NULL,
            recipient_user_id VARCHAR(255) NOT NULL,
            sender_user_id VARCHAR(255) NOT NULL,
            task_json TEXT NOT NULL,
            status VARCHAR(50) NOT NULL DEFAULT 'pending',
            reply_text TEXT DEFAULT '',
            replied_at VARCHAR(100) DEFAULT '',
            sharepoint_written INTEGER DEFAULT 0,
            reminder_type VARCHAR(50) DEFAULT 'morning'
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS notified_new_tasks (
            id SERIAL PRIMARY KEY,
            project VARCHAR(255) NOT NULL,
            task_name VARCHAR(255) NOT NULL,
            assignee VARCHAR(255) NOT NULL,
            email VARCHAR(255),
            notified_at VARCHAR(100) NOT NULL,
            description TEXT DEFAULT ''
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS completed_tasks_history (
            id SERIAL PRIMARY KEY,
            project VARCHAR(255) NOT NULL,
            task_name VARCHAR(255) NOT NULL,
            assignee VARCHAR(255) NOT NULL,
            description TEXT DEFAULT '',
            completed_at VARCHAR(100) NOT NULL
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS weekly_targets (
            id SERIAL PRIMARY KEY,
            project VARCHAR(255) NOT NULL,
            week_start_date DATE NOT NULL,
            target_milestone TEXT NOT NULL,
            deadline DATE,
            dependencies TEXT DEFAULT '',
            achieved BOOLEAN DEFAULT FALSE,
            achievement_notes TEXT DEFAULT '',
            risks_faced TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS employee_skills (
            id SERIAL PRIMARY KEY,
            employee_name VARCHAR(255) UNIQUE NOT NULL,
            strengths TEXT DEFAULT '',
            weaknesses TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cur.close()
    con.close()
    log.info("PostgreSQL Database tables ready.")


def _db_log(event: str, detail: str = ""):
    try:
        con = _get_db_conn()
        cur = con.cursor()
        cur.execute(
            "INSERT INTO activity_log (timestamp, event, detail) VALUES (%s, %s, %s)",
            (datetime.now().isoformat(timespec="seconds"), event, detail),
        )
        con.commit()
        cur.close()
        con.close()
    except Exception as e:
        log.warning("DB log write failed: %s", e)


_is_manual_trigger = contextvars.ContextVar("is_manual_trigger", default=False)

def run_with_manual_trigger_context(func, *args, **kwargs):
    token = _is_manual_trigger.set(True)
    try:
        return func(*args, **kwargs)
    finally:
        _is_manual_trigger.reset(token)

def _append_log(event: str, detail: str = ""):
    is_manual = _is_manual_trigger.get()
    prefix = "[MANUAL_TEST_TRIGGER] " if is_manual else ""
    event_str = f"{prefix}{event}"
    
    # Log to python standard logger so it goes to app.log/console
    log.info(f"{event_str} | {detail}" if detail else event_str)
    
    _run_log.append({
        "timestamp": datetime.now().isoformat(timespec="seconds"),
        "event": event_str,
        "detail": detail,
    })
    if len(_run_log) > 500:
        _run_log.pop(0)
    _db_log(event_str, detail)


def _db_reminder(assignee, email, task_count, status, subject="", error_detail="",
                 chat_id="", message_id=""):
    try:
        con = _get_db_conn()
        cur = con.cursor()
        cur.execute(
            """INSERT INTO reminder_history
               (sent_at, assignee, email, task_count, status, subject, error_detail, chat_id, message_id)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            (datetime.now().isoformat(timespec="seconds"), assignee, email, task_count,
             status, subject, error_detail, chat_id, message_id),
        )
        con.commit()
        cur.close()
        con.close()
    except Exception as e:
        log.warning("DB reminder write failed: %s", e)


def _save_pending_reply(record: dict):
    import json
    con = _get_db_conn()
    cur = con.cursor()
    cur.execute(
        """INSERT INTO pending_teams_replies
           (sent_at, assignee, email, chat_id, message_id, recipient_user_id,
            sender_user_id, task_json, status, reminder_type)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'pending', %s)""",
        (
            record["sent_at"], record["assignee"], record["email"],
            record["chat_id"], record["message_id"], record["recipient_user_id"],
            record["sender_user_id"], json.dumps(record["tasks"]),
            record.get("reminder_type", "morning")
        ),
    )
    con.commit()
    cur.close()
    con.close()


def _populate_initial_tasks_if_empty():
    con = _get_db_conn()
    cur = con.cursor()
    cur.execute("SELECT count(*) FROM notified_new_tasks")
    count = cur.fetchone()[0]
    cur.close()
    con.close()
    if count == 0:
        tasks = load_tasks()
        if tasks:
            con = _get_db_conn()
            cur = con.cursor()
            now_str = datetime.now().isoformat(timespec="seconds")
            for t in tasks:
                if not is_completed_status(t["status"]):
                    cur.execute(
                        "INSERT INTO notified_new_tasks (project, task_name, assignee, email, notified_at, description) VALUES (%s, %s, %s, %s, %s, %s)",
                        (t["project"], t["task"], t["assignee"], t.get("email_from_excel"), now_str, t.get("description", ""))
                    )
            con.commit()
            cur.close()
            con.close()
            log.info("Initialized notified_new_tasks table with existing tasks.")
            _append_log("DB INIT", f"Pre-populated notified_new_tasks table")


def _get_pending_replies() -> list[dict]:
    import json
    con = _get_db_conn()
    cur = con.cursor()
    cur.execute(
        """SELECT id, sent_at, assignee, email, chat_id, message_id,
                  recipient_user_id, sender_user_id, task_json, reminder_type
           FROM pending_teams_replies WHERE status = 'pending'"""
    )
    rows = cur.fetchall()
    cur.close()
    con.close()
    return [
        {
            "id": r[0], "sent_at": r[1], "assignee": r[2], "email": r[3],
            "chat_id": r[4], "message_id": r[5], "recipient_user_id": r[6],
            "sender_user_id": r[7], "tasks": json.loads(r[8]),
            "reminder_type": r[9]
        }
        for r in rows
    ]


def _mark_reply_done(pending_id: int, reply_text: str, sharepoint_ok: bool):
    con = _get_db_conn()
    cur = con.cursor()
    cur.execute(
        """UPDATE pending_teams_replies
           SET status = 'replied', reply_text = %s, replied_at = %s,
               sharepoint_written = %s
           WHERE id = %s""",
        (reply_text, datetime.now().isoformat(timespec="seconds"),
         1 if sharepoint_ok else 0, pending_id),
    )
    con.commit()
    cur.close()
    con.close()


# ─────────────────────────────────────────────
# HELPERS (same logic as mail version)
# ─────────────────────────────────────────────
def normalise_columns(df: pd.DataFrame) -> pd.DataFrame:
    df.columns = [COLUMN_ALIASES.get(c.strip().lower(), c.strip()) for c in df.columns]
    return df


def _maybe_swap_ambiguous_native_date(d: date) -> date:
    if not SWAP_AMBIGUOUS_NATIVE_DATES:
        return d
    if d.day <= 12 and d.month <= 12 and d.day != d.month:
        return date(d.year, d.day, d.month)
    return d


def parse_date(val):
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    try:
        if pd.isna(val):
            return None
    except Exception:
        pass
    if isinstance(val, (datetime, pd.Timestamp)):
        return _maybe_swap_ambiguous_native_date(val.date())
    if isinstance(val, date):
        return _maybe_swap_ambiguous_native_date(val)
    s = str(val).strip()
    if not s or s.lower() == "nan":
        return None
    for fmt in ("%m/%d/%Y", "%m/%d/%y", "%m-%d-%Y", "%m-%d-%y", "%d-%m-%Y", "%d/%m/%Y", "%d-%m-%y", "%d/%m/%y", "%d.%m.%Y", "%d.%m.%y", "%Y-%m-%d"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            pass
    try:
        from dateutil import parser as _dateutil_parser
        return _dateutil_parser.parse(s, dayfirst=False).date()
    except Exception:
        return None


def format_date(val) -> str:
    d = parse_date(val)
    return "—" if d is None else d.strftime("%m/%d/%Y")


def _clean(val) -> str:
    if val is None:
        return "-"
    try:
        if isinstance(val, float) and pd.isna(val):
            return "-"
        if pd.isna(val):
            return "-"
    except (TypeError, ValueError):
        pass
    s = str(val).strip()
    return "-" if not s or s.lower() == "nan" else s


def _date_to_str(val) -> str | None:
    d = parse_date(val)
    return d.isoformat() if d else None


def _encode_share_url(share_url: str) -> str:
    b64 = base64.urlsafe_b64encode(share_url.encode("utf-8")).decode("utf-8").rstrip("=")
    return "u!" + b64


def _get_graph_token() -> str:
    if msal is None:
        raise RuntimeError("msal not installed")
    now = time.time()
    if _graph_token_cache["token"] and now < _graph_token_cache["expires_at"] - 60:
        return _graph_token_cache["token"]
    authority = f"https://login.microsoftonline.com/{SHAREPOINT_TENANT_ID}"
    app_msal = msal.ConfidentialClientApplication(
        client_id=SHAREPOINT_CLIENT_ID,
        client_credential=SHAREPOINT_CLIENT_SECRET,
        authority=authority,
    )
    result = app_msal.acquire_token_for_client(scopes=["https://graph.microsoft.com/.default"])
    if "access_token" not in result:
        raise RuntimeError(f"Graph auth failed: {result.get('error_description')}")
    _graph_token_cache["token"] = result["access_token"]
    _graph_token_cache["expires_at"] = now + result.get("expires_in", 3600)
    return result["access_token"]


def fetch_excel_from_sharepoint() -> bytes:
    token = _get_graph_token()
    share_id = _encode_share_url(SHAREPOINT_SHARE_URL)
    url = f"https://graph.microsoft.com/v1.0/shares/{share_id}/driveItem/content"
    resp = requests.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=30)
    resp.raise_for_status()
    return resp.content


def get_excel_bytes() -> bytes | None:
    if not USE_SHAREPOINT:
        return None
    try:
        content = fetch_excel_from_sharepoint()
        with open(SHAREPOINT_CACHE_PATH, "wb") as f:
            f.write(content)
        _db_log("SHAREPOINT SYNC OK", f"{len(content):,} bytes")
        return content
    except Exception as e:
        log.warning("SharePoint fetch failed: %s", e)
        _db_log("SHAREPOINT SYNC FAILED", str(e))
        if os.path.exists(SHAREPOINT_CACHE_PATH):
            with open(SHAREPOINT_CACHE_PATH, "rb") as f:
                return f.read()
        return None


def _dedupe_preserve_order(items: list[str]) -> list[str]:
    seen, result = set(), []
    for item in items:
        key = item.strip().lower()
        if key and key not in seen:
            seen.add(key)
            result.append(item)
    return result


def load_tasks() -> list[dict]:
    excel_source: str | BytesIO
    use_sharepoint_now = USE_SHAREPOINT and not _prefer_uploaded_excel

    if use_sharepoint_now:
        content = get_excel_bytes()
        if content is None:
            return []
        excel_source = BytesIO(content)
    else:
        path_to_try = EXCEL_PATH
        if not os.path.exists(path_to_try):
            # Try parent directory (backend/)
            parent_try = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), os.path.basename(EXCEL_PATH))
            if os.path.exists(parent_try):
                path_to_try = parent_try
            else:
                # Try sibling directory (backend/teams_reminder/)
                sibling_try = os.path.join(os.path.dirname(os.path.abspath(__file__)), os.path.basename(EXCEL_PATH))
                if os.path.exists(sibling_try):
                    path_to_try = sibling_try
                else:
                    return []
        excel_source = path_to_try

    xl = pd.read_excel(excel_source, sheet_name=None, header=None)
    all_tasks = []
    raw_total, raw_per_sheet = 0, {}

    for sheet_name, raw in xl.items():
        if sheet_name in SKIP_SHEETS:
            continue
        header_row = None
        for idx, row in raw.iterrows():
            vals = [str(v).strip().lower() for v in row if pd.notna(v)]
            if any(k in vals for k in ("assignee(s)", "eta", "current status")):
                header_row = idx
                break
        if header_row is None:
            continue

        if isinstance(excel_source, BytesIO):
            excel_source.seek(0)
        df = pd.read_excel(excel_source, sheet_name=sheet_name, header=header_row)
        df = normalise_columns(df)
        df = df.dropna(how="all")
        
        # Forward-fill structural columns that represent merged cells in SharePoint
        # This preserves the parent-child relationship of tasks across multiple rows
        ffill_cols = [c for c in df.columns if str(c).strip().lower() in ("phases", "task", "module", "description", "team involved")]
        if ffill_cols:
            df[ffill_cols] = df[ffill_cols].ffill()

        raw_per_sheet[sheet_name] = len(df)
        raw_total += len(df)

        required = {"Assignee", "ETA", "Status"}
        if not required.issubset(set(df.columns)):
            continue

        header_excel_row = header_row + 1  # 1-based Excel row of headers

        for row_idx, row in df.iterrows():
            assignees_raw = str(row.get("Assignee", "")).strip()
            if not assignees_raw or assignees_raw.lower() in ("nan", "assignee(s)", "assignees"):
                continue

            row_id = f"{sheet_name}::{row_idx}"
            excel_row = header_row + 2 + int(row_idx)

            email_from_excel = None
            if "Email" in df.columns:
                raw_email = str(row.get("Email", "")).strip()
                if raw_email and raw_email.lower() not in ("nan", ""):
                    email_from_excel = raw_email

            # Capture all raw unmapped SharePoint fields to preserve structural integrity
            raw_fields = {}
            for col in df.columns:
                val = row.get(col)
                if pd.isna(val):
                    val = None
                elif isinstance(val, (datetime, pd.Timestamp, date)):
                    val = val.isoformat()
                else:
                    val = str(val).strip()
                    if val.lower() == "nan": val = None
                raw_fields[str(col)] = val

            for assignee in _dedupe_preserve_order(
                [a.strip() for a in assignees_raw.split(",") if a.strip()]
            ):
                eta_raw = row.get("ETA")
                start_date_raw = row.get("Start Date")
                all_tasks.append({
                    "project": sheet_name,
                    "row_id": row_id,
                    "excel_row": excel_row,
                    "header_excel_row": header_excel_row,
                    "task": _clean(row.get("Task", "")),
                    "module": _clean(row.get("Module", "")),
                    "description": _clean(row.get("Description", "")),
                    "assignee": assignee,
                    "status": _clean(row.get("Status", "")),
                    "start_date": _date_to_str(start_date_raw),
                    "start_date_str": format_date(start_date_raw),
                    "eta": _date_to_str(eta_raw),
                    "eta_str": format_date(eta_raw),
                    "remarks": _clean(row.get("Remarks", "")),
                    "email_from_excel": email_from_excel,
                    "raw_fields": raw_fields,
                    "original_assignees": assignees_raw
                })

    _raw_row_counts["total"] = raw_total
    _raw_row_counts["per_sheet"] = raw_per_sheet
    return _dedupe_tasks(all_tasks)


def _dedupe_tasks(tasks: list[dict]) -> list[dict]:
    seen, result = set(), []
    for t in tasks:
        key = (t.get("row_id"), t["assignee"].strip().lower())
        if key in seen:
            continue
        seen.add(key)
        result.append(t)
    return result


def is_completed_status(status: str) -> bool:
    s = re.sub(r"[^a-z\s]", "", (status or "").strip().lower()).strip()
    return s.startswith("complete") or s.startswith("done") or s == "closed"


def categorise_all(task: dict, today: date) -> list[str]:
    status = task["status"].lower()
    if is_completed_status(status):
        return []
    eta = parse_date(task.get("eta")) if task.get("eta") else None
    if eta is not None:
        if eta < today:
            return ["overdue"]
        if eta == today:
            return ["due_today"]
    if "yet to start" in status:
        return ["yet_to_start"]
    if "in progress" in status:
        return ["in_progress"]
    return ["in_progress"]


def categorise(task: dict, today: date) -> str | None:
    cats = categorise_all(task, today)
    return cats[0] if cats else None


def build_task_html(task: dict, category: str) -> str:
    labels = {
        "overdue": ("🔴 OVERDUE", "#c0392b"),
        "due_today": ("🟡 DUE TODAY", "#e67e22"),
        "yet_to_start": ("🔵 YET TO START", "#2980b9"),
        "in_progress": ("🟢 IN PROGRESS", "#27ae60"),
    }
    label_text, colour = labels.get(category, ("📌 TASK", "#555"))
    lag_note = (
        "<p style='margin:8px 0 0;color:#c0392b;font-size:13px;'>"
        "⚠️ This task is past its ETA — please explain the delay in your reply.</p>"
        if category == "overdue" else ""
    )
    return f"""
    <div style="border-left:4px solid {colour};padding:10px 16px;margin:12px 0;background:#fafafa;border-radius:4px;">
      <span style="color:{colour};font-weight:bold;">{label_text}</span>
      <table style="margin-top:8px;font-size:14px;border-collapse:collapse;">
        <tr><td style='padding:4px 8px;color:#555;'>Project</td><td style='padding:4px 8px;font-weight:bold;'>{task['project']}</td></tr>
        <tr><td style='padding:4px 8px;color:#555;'>Task</td><td style='padding:4px 8px;'>{task['task'] or '—'}</td></tr>
        <tr><td style='padding:4px 8px;color:#555;'>Module</td><td style='padding:4px 8px;'>{task['module'] or '—'}</td></tr>
        <tr><td style='padding:4px 8px;color:#555;'>Status</td><td style='padding:4px 8px;'>{task['status']}</td></tr>
        <tr><td style='padding:4px 8px;color:#555;'>ETA</td><td style='padding:4px 8px;'>{task['eta_str']}</td></tr>
      </table>
      {lag_note}
    </div>"""


def build_teams_body(
    assignee: str,
    tasks: list,
    is_evening: bool = False,
    is_monday: bool = False,
    project_stats: dict = None,
    overall_stats: dict = None,
    has_due_today: bool = False
) -> str:
    today = date.today()
    today_str = f"{today.strftime('%A')}, {today.day} {today.strftime('%B %Y')}"
    overdue_count = sum(1 for _, cat in tasks if cat == "overdue")
    task_blocks = "".join(build_task_html(t, cat) for t, cat in tasks)
    
    # 1. Monday kickoff card
    kickoff_card = ""
    is_all_clear = (overall_stats and overall_stats.get("pending", 0) == 0)
    
    if not is_evening and is_monday and overall_stats:
        tot = overall_stats["total"]
        comp = overall_stats["completed"]
        pend = overall_stats["pending"]
        over = overall_stats["overdue"]
        rate = overall_stats["rate"]
        
        if is_all_clear:
            kickoff_card = f"""
            <div style="background:#eafaf1;border:1px solid #c3e6cb;border-left:4px solid #2ecc71;border-radius:6px;padding:16px 18px;margin:16px 0;color:#155724;font-family:'Segoe UI',sans-serif;box-shadow:0 2px 4px rgba(0,0,0,0.05);">
              <h3 style="margin:0 0 10px;font-size:16px;font-weight:bold;color:#2ecc71;">🚀 Monday Weekly Kickoff — All Clear!</h3>
              <p style="margin:0 0 12px;font-size:13px;color:#155724;line-height:1.4;font-weight:bold;">
                🎉 Excellent job! You have completed all assigned tasks across your active projects. Please check in with your Project Manager if you are ready for new task allocations.
              </p>
              <table style="width:100%;border-collapse:collapse;font-size:13px;color:#155724;line-height:1.6;">
                <tr style="border-bottom:1px solid #c3e6cb;">
                  <td style="padding:6px 0;font-weight:bold;">📂 Total Tasks</td>
                  <td style="padding:6px 0;text-align:right;font-weight:bold;">{tot}</td>
                </tr>
                <tr style="border-bottom:1px solid #c3e6cb;">
                  <td style="padding:6px 0;font-weight:bold;">✅ Completed Tasks</td>
                  <td style="padding:6px 0;text-align:right;font-weight:bold;">{comp}</td>
                </tr>
                <tr style="border-bottom:1px solid #c3e6cb;">
                  <td style="padding:6px 0;font-weight:bold;">🕒 Pending Tasks</td>
                  <td style="padding:6px 0;text-align:right;font-weight:bold;">0</td>
                </tr>
                <tr style="border-bottom:1px solid #c3e6cb;">
                  <td style="padding:6px 0;font-weight:bold;">🔴 Overdue Tasks</td>
                  <td style="padding:6px 0;text-align:right;font-weight:bold;">0</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-weight:bold;">📈 Completion Rate</td>
                  <td style="padding:6px 0;text-align:right;font-weight:bold;">100%</td>
                </tr>
              </table>
            </div>
            """
        else:
            kickoff_card = f"""
            <div style="background:#f0f4f8;border:1px solid #c8d6e5;border-left:4px solid #1f4e79;border-radius:6px;padding:16px 18px;margin:16px 0;color:#102a43;font-family:'Segoe UI',sans-serif;box-shadow:0 2px 4px rgba(0,0,0,0.05);">
              <h3 style="margin:0 0 10px;font-size:16px;font-weight:bold;color:#1f4e79;">🚀 Monday Weekly Kickoff</h3>
              <p style="margin:0 0 12px;font-size:13px;color:#334e68;line-height:1.4;">
                Let's kick off the week strong! Here is your overall progress and schedule outlook across all projects:
              </p>
              <table style="width:100%;border-collapse:collapse;font-size:13px;color:#102a43;line-height:1.6;">
                <tr style="border-bottom:1px solid #d9e2ec;">
                  <td style="padding:6px 0;color:#486581;font-weight:bold;">📂 Total Tasks</td>
                  <td style="padding:6px 0;text-align:right;font-weight:bold;color:#102a43;">{tot}</td>
                </tr>
                <tr style="border-bottom:1px solid #d9e2ec;">
                  <td style="padding:6px 0;color:#27ae60;font-weight:bold;">✅ Completed Tasks</td>
                  <td style="padding:6px 0;text-align:right;font-weight:bold;color:#27ae60;">{comp}</td>
                </tr>
                <tr style="border-bottom:1px solid #d9e2ec;">
                  <td style="padding:6px 0;color:#2980b9;font-weight:bold;">🕒 Pending Tasks</td>
                  <td style="padding:6px 0;text-align:right;font-weight:bold;color:#2980b9;">{pend}</td>
                </tr>
                <tr style="border-bottom:1px solid #d9e2ec;">
                  <td style="padding:6px 0;color:#c0392b;font-weight:bold;">🔴 Overdue Tasks</td>
                  <td style="padding:6px 0;text-align:right;font-weight:bold;color:#c0392b;">{over}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#102a43;font-weight:bold;">📈 Completion Rate</td>
                  <td style="padding:6px 0;text-align:right;font-weight:bold;color:#27ae60;">{rate}%</td>
                </tr>
              </table>
            </div>
            """

    # 2. Due-Today Warning Ping
    due_today_warning = ""
    if not is_evening and has_due_today and not is_all_clear:
        due_today_warning = """
        <div style="background:#fff3e6;border:1px solid #ffd8b3;border-left:4px solid #e67e22;border-radius:6px;padding:12px 16px;margin:16px 0;font-family:'Segoe UI',sans-serif;">
          <span style="color:#d35400;font-weight:bold;font-size:14px;">🔔 Friendly Reminder</span>
          <p style="margin:4px 0 0;color:#7f4000;font-size:13px;line-height:1.4;font-weight:bold;">
            🔔 Hey! It's a friendly reminder that today is the last day to complete this task!
          </p>
        </div>
        """

    # 3. Developer Accomplishment Card
    stats_card = ""
    if not is_evening and project_stats and not is_all_clear:
        rows = []
        for proj, counts in project_stats.items():
            comp = counts["completed"]
            rem = counts["remaining"]
            rows.append(f"""
            <div style="margin-bottom:8px;border-bottom:1px solid #d9e2ec;padding-bottom:8px;font-size:13px;">
              <span style="font-weight:bold;color:#1f4e79;font-size:13px;">📁 Project: {proj}</span><br>
              <span style="color:#334e68;font-size:13px;">You have successfully completed <b>{comp}</b> tasks in this project and have <b>{rem}</b> tasks remaining.</span>
            </div>
            """)
        stats_rows = "".join(rows)
        stats_card = f"""
        <div style="background:#f0f4f8;border-left:4px solid #1f4e79;border:1px solid #c8d6e5;border-left:4px solid #1f4e79;border-radius:6px;padding:14px 18px;margin:16px 0;font-family:'Segoe UI',sans-serif;box-shadow:0 2px 4px rgba(0,0,0,0.05);">
          <h4 style="margin:0 0 10px;color:#102a43;font-size:14px;font-weight:bold;">📊 Developer Accomplishment Stats</h4>
          {stats_rows}
        </div>
        """

    if is_evening:
        lag_intro = (
            "<p style='color:#333;font-size:14px;'><b>Please let us know if your task was completed today.</b><br>"
            "If completed, reply with: <b>completed</b><br>"
            "If not completed, reply with the **reason/blocker** so we can suggest a mitigation plan.</p>"
        )
    else:
        lag_intro = (
            f"<p style='color:#333;font-size:14px;'><b>{overdue_count} task(s) are overdue.</b> "
            "Please reply in this chat with <b>why completion has lagged</b> "
            "and your updated plan.</p>"
            if overdue_count else
            "<p style='color:#333;font-size:14px;'>Please reply in this chat if anything is blocking you or causing delays.</p>"
        )

    main_content = ""
    if not is_all_clear:
        main_content = f"""
        <p style='color:#102a43;font-size:14px;'>Here is your task status update. {lag_intro}</p>
        {task_blocks}
        """

    return f"""
    <html><body style="font-family:Segoe UI,Arial,sans-serif;max-width:700px;color:#102a43;">
      <h2 style="color:#6264A7;margin-top:0;font-size:20px;">📋 Fanam Task Reminder — {today_str}</h2>
      <p style='color:#102a43;font-size:14px;'>Hi <b>{assignee}</b>,</p>
      {kickoff_card}
      {due_today_warning}
      {stats_card}
      {main_content}
      <hr style="margin:24px 0;border:none;border-top:1px solid #ddd;">
      <p style="font-size:12px;color:#6264A7;font-weight:bold;">
        Reply directly in this Teams chat — your answer will be saved to the
        Remarks column in the live SharePoint tracker.
      </p>
    </body></html>"""


# ─────────────────────────────────────────────
# TEAMS REMINDER + REPLY POLLING
# ─────────────────────────────────────────────
def run_reminder(is_evening: bool = False) -> dict:
    from datetime import timedelta
    # Use IST timezone for dates & Monday checks
    ist_now = datetime.now(timezone.utc).astimezone(timezone(timedelta(hours=5, minutes=30)))
    ist_today = ist_now.date()
    
    is_monday = (ist_now.weekday() == 0 or os.getenv("FORCE_MONDAY_KICKOFF", "false").lower() == "true")
    
    _append_log("TEAMS REMINDER STARTED", f"{ist_today.isoformat()} (Evening={is_evening})")
    tasks = load_tasks()

    if not tasks:
        return {"sent": 0, "skipped": 0, "failed": 0, "detail": "No tasks loaded"}

    if not TEAMS_SENDER_EMAIL:
        _append_log("ABORT", "TEAMS_SENDER_EMAIL not set")
        return {"sent": 0, "skipped": 0, "failed": 0, "detail": "TEAMS_SENDER_EMAIL missing"}

    token = None
    token_err = None
    try:
        token = _get_teams_graph_token()
    except Exception as e:
        token_err = str(e)
        _append_log("TEAMS AUTH FAIL", f"Teams token acquisition failed: {e}. Falling back to Email for all reminders.")

    by_assignee: dict[str, list] = defaultdict(list)
    email_map: dict[str, str] = {}
    display_name: dict[str, str] = {}

    def _norm(name: str) -> str:
        return name.strip().lower()

    for task in tasks:
        key = _norm(task["assignee"])
        display_name.setdefault(key, task["assignee"])
        if key not in email_map and task.get("email_from_excel"):
            email_map[key] = task["email_from_excel"]

    for task in tasks:
        cat = categorise(task, ist_today)
        if cat:
            by_assignee[_norm(task["assignee"])].append((task, cat))

    # On Mondays (for the morning kickoff run), ensure all employees found in display_name are added to by_assignee
    if not is_evening and is_monday:
        for key in display_name.keys():
            by_assignee.setdefault(key, [])

    if not by_assignee:
        _append_log("INFO", "No pending reminders for today")
        return {"sent": 0, "skipped": 0, "failed": 0, "detail": "No pending reminders"}

    sent = skipped = failed = 0
    for key, task_list in by_assignee.items():
        assignee = display_name.get(key, key)
        email = email_map.get(key)
        if not email:
            _append_log("SKIPPED", f"{assignee}: no email found for Teams lookup")
            _db_reminder(assignee, "", len(task_list), "skipped", error_detail="no email")
            skipped += 1
            continue

        # Compute accomplishment and kickoff stats for this user
        dev_tasks = [t for t in tasks if _norm(t["assignee"]) == key]
        project_stats = defaultdict(lambda: {"completed": 0, "remaining": 0})
        overall_completed = 0
        overall_remaining = 0
        overall_overdue = 0
        
        for t in dev_tasks:
            cat = categorise(t, ist_today)
            is_completed = is_completed_status(t["status"])
            proj = t["project"]
            if is_completed:
                project_stats[proj]["completed"] += 1
                overall_completed += 1
            else:
                project_stats[proj]["remaining"] += 1
                overall_remaining += 1
                if cat == "overdue":
                    overall_overdue += 1
                    
        overall_total = len(dev_tasks)
        if overall_total > 0:
            completion_rate = round((overall_completed / overall_total * 100))
        else:
            completion_rate = 100
            
        overall_stats = {
            "total": overall_total,
            "completed": overall_completed,
            "pending": overall_remaining,
            "overdue": overall_overdue,
            "rate": completion_rate
        }
        
        has_due_today = any(cat == "due_today" for _, cat in task_list)

        today_short = f"{ist_today.day} {ist_today.strftime('%b')}"
        if not is_evening and is_monday:
            subject = f"[Fanam Tracker] Monday Kickoff & Weekly Summary — {ist_today.strftime('%d-%b-%Y')}"
        else:
            subject_type = "Evening Check-in" if is_evening else "Morning Reminder"
            subject = f"[Fanam Tracker] {subject_type} — {len(task_list)} task(s) — {today_short}"

        body = build_teams_body(
            assignee,
            task_list,
            is_evening=is_evening,
            is_monday=is_monday,
            project_stats=project_stats,
            overall_stats=overall_stats,
            has_due_today=has_due_today
        )

        teams_ok = False
        result = {}
        if token:
            try:
                result = send_teams_message(token, email, body)
                if result.get("ok"):
                    teams_ok = True
            except Exception as e:
                result = {"ok": False, "error": str(e)}
        else:
            result = {"ok": False, "error": f"No Teams token available. Ref: {token_err or 'unknown'}"}

        if teams_ok:
            sent_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
            _db_reminder(assignee, email, len(task_list), "sent", subject=subject,
                         chat_id=result["chat_id"], message_id=result["message_id"])
            if task_list:
                _save_pending_reply({
                    "sent_at": sent_at,
                    "assignee": assignee,
                    "email": email,
                    "chat_id": result["chat_id"],
                    "message_id": result["message_id"],
                    "recipient_user_id": result["recipient_id"],
                    "sender_user_id": result["sender_id"],
                    "tasks": [{"task": t, "category": c} for t, c in task_list],
                    "reminder_type": "evening" if is_evening else "morning"
                })
            _append_log("TEAMS SENT", f"→ {email} | chat={result['chat_id']}")
            sent += 1
        else:
            if not task_list:
                _append_log("FALLBACK SKIPPED", f"→ {email} | Teams DM failed, but employee is All-Clear. No email sent.")
                failed += 1
                continue

            _append_log("TEAMS DM FAIL", f"Teams DM failed for {email} ({result.get('error')}). Attempting email fallback...")
            fallback_res = send_reminder_via_email(email, assignee, task_list, is_evening)
            if fallback_res.get("sent"):
                _db_reminder(assignee, email, len(task_list), "email_fallback", subject=subject,
                             error_detail=f"Teams failed: {result.get('error')}. Sent email fallback.")
                _append_log("EMAIL FALLBACK SENT", f"→ {email} | method={fallback_res.get('method')}")
                sent += 1
            else:
                _db_reminder(assignee, email, len(task_list), "failed", subject=subject,
                             error_detail=f"Teams failed: {result.get('error')}. Email failed: {fallback_res.get('detail')}")
                _append_log("FALLBACK FAILED", f"→ {email} | Teams and Email both failed.")
                failed += 1

    result = {"sent": sent, "skipped": skipped, "failed": failed, "detail": "OK"}
    _append_log("TEAMS REMINDER DONE", f"Sent={sent} Skipped={skipped} Failed={failed}")
    return result


def _get_estimated_hours(task: dict) -> float:
    import re
    text_to_search = f"{task.get('task', '')} {task.get('description', '')} {task.get('remarks', '')}"
    # Look for patterns like [8h], (10 hrs), 12 hours, etc.
    match = re.search(r'\[\s*(\d+(?:\.\d+)?)\s*(?:hrs|hr|h|hours|hour)\s*\]', text_to_search, re.IGNORECASE)
    if match:
        return float(match.group(1))
    match = re.search(r'\(\s*(\d+(?:\.\d+)?)\s*(?:hrs|hr|h|hours|hour)\s*\)', text_to_search, re.IGNORECASE)
    if match:
        return float(match.group(1))
    match = re.search(r'\b(\d+(?:\.\d+)?)\s*(?:hrs|hr|h|hours|hour)\b', text_to_search, re.IGNORECASE)
    if match:
        return float(match.group(1))
    
    status = task.get("status", "").lower()
    if is_completed_status(status):
        return 0.0
    return 10.0


def calculate_utilization_metrics(tasks: list[dict]) -> tuple[dict, list[dict]]:
    by_assignee = defaultdict(list)
    display_name = {}
    email_map = {}
    
    def _norm(name: str) -> str:
        return name.strip().lower()

    for t in tasks:
        key = _norm(t["assignee"])
        display_name.setdefault(key, t["assignee"])
        if key not in email_map and t.get("email_from_excel"):
            email_map[key] = t["email_from_excel"]
        by_assignee[key].append(t)

    # Resolve email from database and fetch weekly login hours
    db_name_to_email = {}
    weekly_login_hours = {}
    try:
        conn = _get_db_conn()
        cur = conn.cursor()
        
        # Build name -> email map
        cur.execute("SELECT LOWER(TRIM(full_name)), LOWER(TRIM(email)) FROM employees")
        for row in cur.fetchall():
            if row[0] and row[1]:
                db_name_to_email[row[0]] = row[1]
                
        # Fetch weekly login hours from attendance table
        cur.execute("""
            SELECT LOWER(TRIM(email)), 
                   SUM(clock_out - clock_in) as total_duration
            FROM attendance
            WHERE date >= CURRENT_DATE - INTERVAL '7 days'
              AND clock_in IS NOT NULL
              AND clock_out IS NOT NULL
            GROUP BY LOWER(TRIM(email))
        """)
        for row in cur.fetchall():
            email_val = row[0]
            duration = row[1]
            if email_val and duration:
                hours = duration.total_seconds() / 3600.0
                weekly_login_hours[email_val] = round(hours, 1)
                
        cur.close()
        conn.close()
    except Exception as e:
        log.warning("Failed to fetch database employee email or attendance: %s", e)
        
    dev_utilization = []
    total_assigned_hours = 0.0
    total_utilization_sum = 0.0
    total_free_capacity = 0.0
    
    for key, user_tasks in by_assignee.items():
        assignee = display_name.get(key, key)
        # Find email: try excel_map, then db name match
        email = email_map.get(key, "")
        if not email and key in db_name_to_email:
            email = db_name_to_email[key]
            email_map[key] = email
            
        emp_email_lower = email.strip().lower()
        login_hours = weekly_login_hours.get(emp_email_lower, 0.0)
        
        allocated_hours = sum(_get_estimated_hours(t) for t in user_tasks if not is_completed_status(t["status"]))
        utilization_pct = (allocated_hours / 40.0) * 100.0
        
        if utilization_pct > 100.0:
            status = "Overloaded"
            badge = "🔴 Red"
            color = "#c0392b"
            bg_color = "#fce4d6"
            pm_note = "Reduce workload; re-allocate tasks to available members."
        elif utilization_pct >= 80.0:
            status = "Optimal"
            badge = "🟢 Green"
            color = "#27ae60"
            bg_color = "#e2f0d9"
            pm_note = "Optimal loading. No changes needed."
        else:
            status = "Under-Allocated"
            badge = "🟡 Yellow"
            color = "#7f6000"
            bg_color = "#fff2cc"
            pm_note = "Can take on more tasks; check free capacity."
            
        free_capacity = max(0.0, 40.0 - allocated_hours)
        
        total_assigned_hours += allocated_hours
        total_utilization_sum += utilization_pct
        total_free_capacity += free_capacity
        
        dev_utilization.append({
            "assignee": assignee,
            "email": email,
            "allocated_hours": round(allocated_hours, 1),
            "utilization_pct": round(utilization_pct, 1),
            "weekly_login_hours": login_hours,
            "status": status,
            "badge": badge,
            "color": color,
            "bg_color": bg_color,
            "pm_note": pm_note,
            "free_capacity": round(free_capacity, 1),
            "task_count": len([t for t in user_tasks if not is_completed_status(t["status"])])
        })
        
    num_devs = len(dev_utilization)
    avg_efficiency = (total_utilization_sum / num_devs) if num_devs > 0 else 0.0
    
    summary = {
        "total_team_hours": round(total_assigned_hours, 1),
        "avg_efficiency": round(avg_efficiency, 1),
        "free_capacity": round(total_free_capacity, 1),
    }
    
    return summary, dev_utilization


def send_pm_utilization_report() -> dict:
    _append_log("PM UTILIZATION REPORT STARTED", "")
    pm_email = PM_EMAIL or DIRECTORS_EMAIL
    if not pm_email:
        _append_log("PM UTILIZATION REPORT ABORT", "PM_EMAIL or DIRECTORS_EMAIL not set")
        return {"sent": False, "detail": "PM_EMAIL not set"}

    tasks = load_tasks()
    if not tasks:
        _append_log("PM UTILIZATION REPORT ABORT", "No tasks loaded")
        return {"sent": False, "detail": "No tasks loaded"}

    summary, dev_utilization = calculate_utilization_metrics(tasks)
    
    rows_html = ""
    for dev in sorted(dev_utilization, key=lambda x: (-x["utilization_pct"], x["assignee"].lower())):
        badge_style = f"background-color: {dev['bg_color']}; color: {dev['color']}; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 12px; display: inline-block;"
        rows_html += f"""
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #ddd; font-weight: bold;">{dev['assignee']}</td>
          <td style="padding: 10px; border-bottom: 1px solid #ddd;">{dev['email'] or '—'}</td>
          <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: center;">{dev['task_count']}</td>
          <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: center; font-weight: bold;">{dev['allocated_hours']} hrs</td>
          <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: center; font-weight: bold;">{dev['utilization_pct']}%</td>
          <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: center;"><span style="{badge_style}">{dev['status']}</span></td>
          <td style="padding: 10px; border-bottom: 1px solid #ddd; font-size: 12px; color: #555;">{dev['pm_note']}</td>
        </tr>
        """

    report_time = datetime.now().strftime("%d-%b-%Y %H:%M")
    html_body = f"""
    <html><body style="font-family: Segoe UI, Arial, sans-serif; color: #333; margin: 0; padding: 20px;">
      <h2 style="color: #1f4e79; border-bottom: 2px solid #1f4e79; padding-bottom: 10px; margin-top: 0;">📋 Fanam Resource Utilization & PM Analytics</h2>
      <p style="color: #666;">Generated on <b>{report_time} IST</b></p>
      
      <div style="display: flex; gap: 15px; margin: 20px 0;">
        <div style="flex: 1; background: #f0f4f8; border: 1px solid #c8d6e5; border-radius: 6px; padding: 15px; text-align: center;">
          <span style="font-size: 12px; color: #486581; font-weight: bold; text-transform: uppercase;">Total Team Hours</span>
          <div style="font-size: 24px; font-weight: bold; color: #102a43; margin-top: 5px;">{summary['total_team_hours']} hrs</div>
        </div>
        <div style="flex: 1; background: #eafaf1; border: 1px solid #c3e6cb; border-radius: 6px; padding: 15px; text-align: center;">
          <span style="font-size: 12px; color: #2e7d32; font-weight: bold; text-transform: uppercase;">Avg Team Efficiency</span>
          <div style="font-size: 24px; font-weight: bold; color: #1b5e20; margin-top: 5px;">{summary['avg_efficiency']}%</div>
        </div>
        <div style="flex: 1; background: #fffde7; border: 1px solid #fff59d; border-radius: 6px; padding: 15px; text-align: center;">
          <span style="font-size: 12px; color: #f57f17; font-weight: bold; text-transform: uppercase;">Available Bench Capacity</span>
          <div style="font-size: 24px; font-weight: bold; color: #e65100; margin-top: 5px;">{summary['free_capacity']} hrs</div>
        </div>
      </div>
      
      <h3 style="color: #1f4e79; margin-top: 30px;">Developer Workload Breakdown</h3>
      <table style="width: 100%; border-collapse: collapse; margin-top: 10px; text-align: left; font-size: 13px;">
        <thead>
          <tr style="background-color: #f0f4f8; color: #102a43; border-bottom: 2px solid #c8d6e5;">
            <th style="padding: 10px;">Developer</th>
            <th style="padding: 10px;">Email</th>
            <th style="padding: 10px; text-align: center;">Active Tasks</th>
            <th style="padding: 10px; text-align: center;">Allocated Hours</th>
            <th style="padding: 10px; text-align: center;">Utilization Rate</th>
            <th style="padding: 10px; text-align: center;">Status</th>
            <th style="padding: 10px;">PM Recommendations & Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows_html}
        </tbody>
      </table>
      
      <hr style="margin-top: 30px; border: none; border-top: 1px solid #eee;">
      <p style="font-size: 12px; color: #999; text-align: center;">This is an automated report generated by Fanam Teams Reminder Agent. Please consult the live SharePoint planner for re-allocation actions.</p>
    </body></html>
    """
    
    subject = f"[Fanam Tracker] Weekly Resource Utilization & PM Analytics — {datetime.now().strftime('%d-%b-%Y')}"
    recipients = [TEST_TEAMS_EMAIL] if TEST_MODE_PM else [e.strip() for e in pm_email.split(",") if e.strip()]
    
    res = send_email_helper(subject, html_body, recipients, None, None)
    if res.get("sent"):
        _append_log("PM UTILIZATION REPORT SENT", f"Notified PM ({pm_email}) via {res.get('method')}")
        return {"sent": True, "method": res.get("method"), "detail": "OK"}
    else:
        _append_log("PM UTILIZATION REPORT FAILED", res.get("detail", "unknown error"))
        return {"sent": False, "detail": res.get("detail", "unknown error")}


def send_weekly_status_report() -> dict:
    _append_log("WEEKLY STATUS REPORT STARTED", "")
    pm_email = PM_EMAIL or DIRECTORS_EMAIL
    if not pm_email:
        _append_log("WEEKLY STATUS REPORT ABORT", "PM_EMAIL or DIRECTORS_EMAIL not set")
        return {"sent": False, "detail": "PM_EMAIL not set"}
        
    tasks = load_tasks()
    if not tasks:
        _append_log("WEEKLY STATUS REPORT ABORT", "No tasks loaded")
        return {"sent": False, "detail": "No tasks loaded"}
        
    # 1. Project stats calculation
    project_summary = defaultdict(lambda: {"total": 0, "completed": 0, "remaining": 0})
    for t in tasks:
        proj = t.get("project") or "General"
        project_summary[proj]["total"] += 1
        status_lower = (t.get("status") or "").lower().strip()
        is_done = any(kw in status_lower for kw in ('complete', 'done', 'closed', 'resolved', '100%', '90%'))
        if is_done:
            project_summary[proj]["completed"] += 1
        else:
            project_summary[proj]["remaining"] += 1
            
    # 2. Fetch weekly targets & risks from DB
    weekly_targets_data = []
    try:
        conn = _get_db_conn()
        cur = conn.cursor()
        cur.execute("""
            SELECT project, target_milestone, deadline, achieved, dependencies, risks_faced, achievement_notes
            FROM weekly_targets
            WHERE week_start_date >= CURRENT_DATE - INTERVAL '7 days'
            ORDER BY week_start_date DESC
        """)
        rows = cur.fetchall()
        for r in rows:
            weekly_targets_data.append({
                "project": r[0],
                "target": r[1],
                "deadline": str(r[2]) if r[2] else "—",
                "achieved": bool(r[3]),
                "dependencies": r[4] or "None",
                "risks": r[5] or "None",
                "mitigations": r[6] or "None"
            })
        cur.close()
        conn.close()
    except Exception as e:
        log.warning("Failed to fetch weekly targets for status report: %s", e)

    # 3. Build HTML body
    report_time = datetime.now().strftime("%d-%b-%Y %H:%M")
    
    # Project Summary table
    proj_rows_html = ""
    for proj, stats in project_summary.items():
        comp_pct = round((stats["completed"] / stats["total"]) * 100) if stats["total"] > 0 else 100
        proj_rows_html += f"""
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #ddd; font-weight: bold;">{proj}</td>
          <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: center;">{stats['total']}</td>
          <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: center; color: green; font-weight: bold;">{stats['completed']}</td>
          <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: center; color: orange;">{stats['remaining']}</td>
          <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: center; font-weight: bold;">{comp_pct}%</td>
        </tr>
        """
        
    # Targets & Risks section
    targets_html = ""
    if weekly_targets_data:
        for t in weekly_targets_data:
            status_color = "green" if t["achieved"] else "red"
            status_text = "Achieved" if t["achieved"] else "Pending"
            targets_html += f"""
            <div style="background: #fdfdfd; border: 1px solid #e0e0e0; border-radius: 6px; padding: 15px; margin-bottom: 15px;">
              <h4 style="margin-top: 0; color: #1f4e79;">Project: {t['project']} <span style="float: right; color: {status_color}; font-size: 13px;">● {status_text}</span></h4>
              <p><b>Weekly Target:</b> {t['target']}</p>
              <p><b>Deadline:</b> {t['deadline']}</p>
              <p><b>Dependencies / Blockers:</b> {t['dependencies']}</p>
              <p style="color: #c0392b;"><b>Risks Faced (REQ-H02):</b> {t['risks']}</p>
              <p style="color: #27ae60;"><b>Mitigation / Achievement Notes:</b> {t['mitigations']}</p>
            </div>
            """
    else:
        targets_html = "<p style='color: #666; font-style: italic;'>No weekly milestones or targets logged in the system for this week.</p>"

    html_body = f"""
    <html>
    <body style="font-family: Segoe UI, Arial, sans-serif; color: #333; margin: 0; padding: 20px;">
      <h2 style="color: #1f4e79; border-bottom: 2px solid #1f4e79; padding-bottom: 10px; margin-top: 0;">📋 Weekly Project Status & Risk Summary Report</h2>
      <p style="color: #666;">Generated on <b>{report_time} IST</b></p>
      
      <h3 style="color: #1f4e79;">1. Project Completion Statistics (REQ-H01)</h3>
      <table style="width: 100%; border-collapse: collapse; margin-top: 10px; text-align: left; font-size: 13px;">
        <thead>
          <tr style="background-color: #f0f4f8; color: #102a43; border-bottom: 2px solid #c8d6e5;">
            <th style="padding: 10px;">Project Area</th>
            <th style="padding: 10px; text-align: center;">Total Tasks</th>
            <th style="padding: 10px; text-align: center;">Completed</th>
            <th style="padding: 10px; text-align: center;">Pending</th>
            <th style="padding: 10px; text-align: center;">Completion %</th>
          </tr>
        </thead>
        <tbody>
          {proj_rows_html}
        </tbody>
      </table>
      
      <h3 style="color: #1f4e79; margin-top: 30px;">2. Weekly Milestones, Project Risks & Mitigations (REQ-H02)</h3>
      {targets_html}
      
      <p style="font-size: 11px; color: #777; margin-top: 40px; border-top: 1px solid #ddd; padding-top: 10px;">
        This is an automated status update generated by Fanam HRMS & Teams Reminder Engine.
      </p>
    </body>
    </html>
    """
    
    recipients = [TEST_TEAMS_EMAIL] if TEST_MODE_PM else [email.strip() for email in pm_email.split(",") if email.strip()]
    res = send_email_helper(
        subject="[Fanam Tracker] Weekly Project Status & Risk Mitigation Report",
        html_body=html_body,
        recipient_emails=recipients
    )
    
    status_sent = res.get("sent") if res else False
    _append_log("WEEKLY STATUS REPORT SENT", f"Recipient: {pm_email} | Status: {status_sent}")
    return {"sent": status_sent, "detail": "OK" if status_sent else "SMTP Fail"}
def send_pm_unassigned_report() -> dict:
    """Identifies employees with no active tasks assigned and emails a report to the PM."""
    _append_log("PM UNASSIGNED REPORT STARTED", "")
    tasks = load_tasks()
    if not tasks:
        _append_log("PM UNASSIGNED REPORT ABORT", "No tasks loaded")
        return {"sent": False, "detail": "No tasks loaded"}

    today = date.today()
    by_assignee = defaultdict(list)
    for task in tasks:
        cat = categorise(task, today)
        if cat:
            by_assignee[task["assignee"].strip().lower()].append((task, cat))

    all_employees = {}
    for task in tasks:
        name_lower = task["assignee"].strip().lower()
        if name_lower:
            email = task.get("email_from_excel")
            if name_lower not in all_employees or (not all_employees[name_lower][1] and email):
                all_employees[name_lower] = (task["assignee"], email)
    
    unassigned_employees = []
    for name_lower, (display, email) in all_employees.items():
        if name_lower not in by_assignee:
            unassigned_employees.append({"name": display, "email": email or "—"})
    
    if not unassigned_employees:
        _append_log("PM UNASSIGNED REPORT SKIPPED", "No unassigned employees found today")
        return {"sent": False, "detail": "No unassigned employees"}

    pm_email = PM_EMAIL or DIRECTORS_EMAIL
    if not pm_email:
        _append_log("PM UNASSIGNED REPORT ABORT", "PM_EMAIL or DIRECTORS_EMAIL not set")
        return {"sent": False, "detail": "PM_EMAIL or DIRECTORS_EMAIL not set"}

    subject = f"[Fanam Tracker] Unassigned Employees Report — {today.strftime('%d-%b-%Y')}"
    rows_html = "".join([
        f"<tr><td style='padding:8px;border-bottom:1px solid #ddd;'><b>{emp['name']}</b></td>"
        f"<td style='padding:8px;border-bottom:1px solid #ddd;color:#555;'>{emp['email']}</td></tr>"
        for emp in unassigned_employees
    ])
    html_body = f"""
    <html><body style="font-family:Segoe UI,Arial,sans-serif;color:#333;margin:0;padding:20px;">
      <h2 style="color:#c0392b;border-bottom:2px solid #c0392b;padding-bottom:10px;">⚠️ Employees with No Active Tasks Assigned</h2>
      <p>The following employee(s) do not have any active (incomplete) tasks assigned in the SharePoint Tracker today:</p>
      <table style="width:100%;max-width:500px;border-collapse:collapse;margin-top:15px;text-align:left;">
        <thead>
          <tr style="background-color:#f2f2f2;">
            <th style="padding:10px;border-bottom:2px solid #ddd;">Name</th>
            <th style="padding:10px;border-bottom:2px solid #ddd;">Email</th>
          </tr>
        </thead>
        <tbody>
          {rows_html}
        </tbody>
      </table>
      <p style="margin-top:20px;">Please update the SharePoint Excel to allot tasks accordingly.</p>
      <hr style="margin-top:30px;border:none;border-top:1px solid #eee;">
      <p style="font-size:12px;color:#999;">This is an automated notification from Fanam Teams Reminder Agent.</p>
    </body></html>
    """
    recipients = [TEST_TEAMS_EMAIL] if TEST_MODE_PM else [e.strip() for e in pm_email.split(",") if e.strip()]
    res = send_email_helper(subject, html_body, recipients)
    if res.get("sent"):
        _append_log("PM UNASSIGNED REPORT SENT", f"Notified PM ({pm_email}) about {len(unassigned_employees)} unassigned employee(s) via {res.get('method')}")
        return {"sent": True, "method": res.get("method"), "detail": "OK"}
    else:
        _append_log("PM UNASSIGNED REPORT FAILED", f"Failed to notify PM: {res.get('detail')}")
        return {"sent": False, "detail": res.get("detail")}


def send_reminder_via_email(recipient_email: str, assignee: str, task_list: list, is_evening: bool) -> dict:
    """Fallback method to send morning/evening reminders via Email."""
    today = date.today()
    subject_type = "Evening Check-in" if is_evening else "Morning Reminder"
    subject = f"[Fanam Tracker] {subject_type} — {len(task_list)} task(s) — {today.strftime('%d-%b-%Y')}"
    
    rows_html = ""
    for task, cat in task_list:
        status_color = "#2ecc71" if cat == "completed_today" else "#e74c3c" if cat == "overdue" else "#f1c40f"
        rows_html += f"""
        <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 10px; font-weight: bold; color: #2c3e50;">{task['task_name']}</td>
            <td style="padding: 10px; color: #7f8c8d;">{task['project']}</td>
            <td style="padding: 10px; color: #e67e22; font-weight: bold;">{task.get('eta', '—')}</td>
            <td style="padding: 10px; color: {status_color}; font-weight: bold; text-transform: uppercase;">{cat.replace('_', ' ')}</td>
        </tr>
        """
    
    body_header = "Please reply to this email or Teams with your task updates (Completed / In Progress %)." if is_evening else "Here is your task list for today:"
    
    html_body = f"""
    <html>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; color: #333; margin: 0; padding: 20px; background-color: #f9f9f9;">
      <div style="max-width: 600px; margin: 0 auto; background: #fff; padding: 25px; border-radius: 8px; border: 1px solid #e1e1e1; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <h2 style="color: #2980b9; margin-top: 0; border-bottom: 2px solid #2980b9; padding-bottom: 10px;">💬 Fanam Task {subject_type}</h2>
        <p style="font-size: 15px; line-height: 1.5;">Hello <b>{assignee}</b>,</p>
        <p style="font-size: 15px; line-height: 1.5; color: #555;">{body_header}</p>
        
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px; text-align: left; font-size: 14px;">
            <thead>
                <tr style="background-color: #f2f4f4; border-bottom: 2px solid #bdc3c7;">
                    <th style="padding: 10px; color: #34495e;">Task Name</th>
                    <th style="padding: 10px; color: #34495e;">Project</th>
                    <th style="padding: 10px; color: #34495e;">ETA</th>
                    <th style="padding: 10px; color: #34495e;">Status</th>
                </tr>
            </thead>
            <tbody>
                {rows_html}
            </tbody>
        </table>
        
        <p style="margin-top: 25px; font-size: 13px; color: #7f8c8d; border-top: 1px solid #eee; padding-top: 15px;">
            This email is a backup notification because Microsoft Teams delivery was unavailable.
        </p>
      </div>
    </body>
    </html>
    """
    recipients = [TEST_TEAMS_EMAIL] if TEST_MODE_TEAMS else [recipient_email]
    return send_email_helper(subject, html_body, recipients)


def _send_auth_expiry_warning(details: str):
    """Sends a high-priority auth expiration warning to the admin."""
    subject = "⚠️ ACTION REQUIRED: Fanam Teams Reminder Agent — Authentication Expiry Alert"
    html_body = f"""
    <html><body style="font-family:Segoe UI,Arial,sans-serif;color:#333;margin:0;padding:20px;">
      <h2 style="color:#d35400;border-bottom:2px solid #d35400;padding-bottom:10px;">⚠️ Teams Auth Expiry Alert</h2>
      <p>The Fanam Teams Reminder Agent background scheduler detected an authentication issue:</p>
      <div style="background-color:#fef5e7;border-left:4px solid #d35400;padding:12px;margin:15px 0;border-radius:4px;">
        <b>Status Details:</b><br>
        <span style="font-family:monospace;color:#c0392b;">{details}</span>
      </div>
      <p><b>Impact:</b> Teams reminders will fall back to Email delivery until authentication is refreshed.</p>
      <h3 style="color:#2980b9;">How to resolve this:</h3>
      <ol>
        <li>Log into the VM where the reminder agent is running.</li>
        <li>Open a command prompt in the project directory.</li>
        <li>Run: <code style="background:#eee;padding:2px 4px;border-radius:4px;font-family:monospace;">python auth_teams.py</code></li>
        <li>Follow the printed prompts to complete the device code login in your browser.</li>
      </ol>
      <hr style="margin-top:30px;border:none;border-top:1px solid #eee;">
      <p style="font-size:12px;color:#999;">This is an automated operational alert from your Fanam Reminder Agent server.</p>
    </body></html>
    """
    recipients = ["Nehasri@FANAMDIGITAL.COM"]
    res = send_email_helper(subject, html_body, recipients)
    if res.get("sent"):
        _append_log("AUTH WARNING SENT", f"Notified admin at Nehasri@FANAMDIGITAL.COM via {res.get('method')}")
    else:
        _append_log("AUTH WARNING FAILED", f"Failed to notify admin: {res.get('detail')}")


def check_teams_token_expiry() -> dict:
    """Checks the MSAL token cache state. If refresh fails or cache is near expiry, alerts Nehasri@FANAMDIGITAL.COM."""
    _append_log("TOKEN EXPIRY CHECK STARTED", "")
    try:
        # Try to retrieve a silent token
        token = _get_teams_graph_token()
        if not token:
            raise RuntimeError("Token silent refresh returned None")
            
        # Check cache file age
        cache_path = "./token_cache.bin"
        if os.path.exists(cache_path):
            stat_info = os.stat(cache_path)
            # Use timezone-aware comparison
            from datetime import timezone
            last_mod = datetime.fromtimestamp(stat_info.st_mtime, tz=timezone.utc)
            now = datetime.now(timezone.utc)
            days_since_refresh = (now - last_mod).days
            # If the cache file has not been modified for 80+ days, trigger a preemptive warning alert!
            if days_since_refresh > 80:
                _send_auth_expiry_warning(f"The Teams token cache has not been interactively updated for {days_since_refresh} days (near the typical 90-day limit).")
                return {"status": "warning", "days": days_since_refresh}
                
        return {"status": "ok", "detail": "Token is active and cache age is healthy"}
    except Exception as e:
        # Silent refresh failed! Interactive re-login is required!
        msg = f"Teams authentication has EXPIRED or failed: {e}."
        _send_auth_expiry_warning(msg)
        return {"status": "expired", "error": str(e)}


def poll_teams_replies() -> dict:
    """Check pending chats for employee replies and write to SharePoint Remarks."""
    if not USE_SHAREPOINT:
        return {"polled": 0, "saved": 0, "detail": "SharePoint not configured"}

    pending = _get_pending_replies()
    if not pending:
        return {"polled": 0, "saved": 0, "detail": "Nothing pending"}

    try:
        teams_token = _get_teams_graph_token()
        sharepoint_token = _get_graph_token()
    except Exception as e:
        _append_log("REPLY POLL ABORT", str(e))
        return {"polled": 0, "saved": 0, "detail": "Graph auth failed"}

    saved = 0
    used_reply_msg_ids = set()
    for item in pending:
        expected_replier_id = item["recipient_user_id"]
        if TEST_MODE_TEAMS and TEST_TEAMS_EMAIL:
            try:
                from teams_client import _resolve_user_id
                test_user_id = _resolve_user_id(teams_token, TEST_TEAMS_EMAIL)
                if test_user_id:
                    expected_replier_id = test_user_id
            except Exception as e:
                _append_log("TEST REPLIER ID FAIL", str(e))

        reply = find_employee_reply(
            teams_token,
            item["chat_id"],
            expected_replier_id,
            item["sent_at"],
            exclude_sender_ids={item["sender_user_id"]},
        )
        if not reply:
            continue

        reply_id = reply.get("id")
        if reply_id and reply_id in used_reply_msg_ids:
            continue

        if reply_id:
            used_reply_msg_ids.add(reply_id)

        reply_text = reply["content_plain"].strip()
        sharepoint_ok = True
        is_evening = item.get("reminder_type") == "evening"
        
        norm_reply = re.sub(r"[^a-z]", "", reply_text.lower())
        is_marking_completed = norm_reply in ("completed", "done", "complete", "yes", "y")

        for entry in item["tasks"]:
            task = entry["task"]
            
            if is_marking_completed:
                formatted_remark = "Completed"
            else:
                formatted_remark = reply_text
                # Delay reason was given. Let's call Gemini to get mitigation and send it to Teams chat!
                try:
                    mitigation = generate_mitigation_suggestion(
                        task_name=task["task"],
                        task_desc=task.get("description", ""),
                        delay_reason=reply_text
                    )
                    
                    # Proactively send the mitigation suggestion back to the user on Teams!
                    mitigation_body = f"""
                    <html><body style="font-family:Segoe UI,Arial,sans-serif;max-width:700px;color:#333;">
                      <p>Thank you for the update on <b>{task['task']}</b>.</p>
                      <p><b>Mitigation Suggestion:</b></p>
                      <blockquote style="border-left:4px solid #6264A7;padding-left:12px;color:#555;font-style:italic;margin:8px 0;">
                        {mitigation}
                      </blockquote>
                      <p style="font-size:12px;color:#888;">This suggestion was generated by the Fanam Helper bot based on your blocker description.</p>
                    </body></html>
                    """
                    send_teams_message(teams_token, item["email"], mitigation_body)
                except Exception as e:
                    _append_log("MITIGATION SEND ERROR", str(e))

            try:
                result = append_remark(
                    sharepoint_token,
                    SHAREPOINT_SHARE_URL,
                    sheet_name=task["project"],
                    excel_row=task["excel_row"],
                    header_excel_row=task["header_excel_row"],
                    new_text=formatted_remark,
                    existing_remark=task.get("remarks", ""),
                    assignee=item["assignee"],
                )
                if not result.get("ok"):
                    sharepoint_ok = False
                    _append_log("REMARKS WRITE FAILED", result.get("error", ""))
            except Exception as e:
                sharepoint_ok = False
                _append_log("REMARKS WRITE ERROR", str(e))

        _mark_reply_done(item["id"], reply_text, sharepoint_ok)
        if sharepoint_ok:
            saved += 1
            _append_log("REPLY SAVED", f"{item['assignee']}: {reply_text[:120]}")

    return {"polled": len(pending), "saved": saved, "detail": "OK"}


def check_and_notify_new_tasks() -> dict:
    """Checks SharePoint Excel for new active tasks and notifies employees via Teams."""
    today = date.today()
    _append_log("CHECK NEW TASKS STARTED", today.isoformat())
    
    tasks = load_tasks()
    if not tasks:
        return {"notified": 0, "failed": 0, "detail": "No tasks loaded"}
        
    if not TEAMS_SENDER_EMAIL:
        return {"notified": 0, "failed": 0, "detail": "TEAMS_SENDER_EMAIL missing"}
        
    token = None
    token_err = None
    try:
        token = _get_teams_graph_token()
    except Exception as e:
        token_err = str(e)
        _append_log("NEW TASKS AUTH FAILED", f"{e}. Falling back to Email for notifications.")

    con = _get_db_conn()
    known = set()
    cur = con.cursor()
    try:
        cur.execute("SELECT project, task_name, assignee, COALESCE(description, '') FROM notified_new_tasks")
        rows = cur.fetchall()
    except psycopg2.OperationalError:
        cur.execute("SELECT project, task_name, assignee FROM notified_new_tasks")
        rows = cur.fetchall()
        rows = [(p, t, a, "") for p, t, a in rows]
    cur.close()
    con.close()

    existing_projects = {p.strip().lower() for p, t, a, d in rows if p}
    for p, t, a, d in rows:
        known.add((p.strip().lower(), t.strip().lower(), a.strip().lower(), d.strip().lower()))
    
    notified_count = 0
    failed_count = 0
    now_str = datetime.now().isoformat(timespec="seconds")

    for task in tasks:
        if is_completed_status(task["status"]):
            continue
            
        assignee = task["assignee"]
        email = task.get("email_from_excel")
        
        # Trigger project onboarding reminders if this is a new project area (REQ-H08)
        project_lower = task["project"].strip().lower()
        if email and project_lower not in existing_projects:
            onboarding_body = f"""
            <html><body style="font-family:Segoe UI,Arial,sans-serif;max-width:700px;color:#333;">
              <h3 style="color:#FF5500;">🚀 Project Onboarding Checklist Required</h3>
              <p>Hi <b>{assignee}</b>,</p>
              <p>The new project <b>{task['project']}</b> has officially started in the tracker!</p>
              <p>Please initiate the project onboarding steps immediately:</p>
              <div style="border-left:4px solid #FF5500;padding:10px 16px;margin:12px 0;background:#fff5e6;border-radius:4px;">
                <h4 style="margin-top: 0; color: #cc4400;">Onboarding Action Items:</h4>
                <ul>
                  <li><b>Start the Test Strategy</b>: Define test scope and resources.</li>
                  <li><b>Plan Test Cases</b>: Outline key user scenarios.</li>
                  <li><b>Start 'Barricade'</b>: Setup environment security boundaries.</li>
                </ul>
              </div>
              <p style="font-size:12px;color:#888;">This notification was automatically triggered by the Fanam Project Onboarding Workflow Engine.</p>
            </body></html>
            """
            onboarding_subject = f"[Fanam Tracker] 🚀 Project Onboarding Checklist: {task['project']}"
            
            # Send Onboarding alert via Teams if possible, and fallback/cc via Email
            teams_onb_ok = False
            if token:
                try:
                    res_onb = send_teams_message(token, email, onboarding_body)
                    if res_onb.get("ok"):
                        teams_onb_ok = True
                except Exception as e:
                    log.warning("Onboarding Teams DM failed: %s", e)
            
            recipients = [TEST_TEAMS_EMAIL] if TEST_MODE_TEAMS else [email]
            send_email_helper(onboarding_subject, onboarding_body, recipients)
            _append_log("PROJECT ONBOARDING ALERT", f"Sent onboarding workflow triggers for project '{task['project']}' to {email}")
            existing_projects.add(project_lower)
            
        task_desc = task.get("description", "") or ""
        key = (task["project"].strip().lower(), task["task"].strip().lower(), task["assignee"].strip().lower(), task_desc.strip().lower())
        if key in known:
            continue
            
        assignee = task["assignee"]
        email = task.get("email_from_excel")
        if not email:
            _append_log("NEW TASK SKIPPED", f"No email for {assignee} to send new task: {task['task']}")
            con = _get_db_conn()
            cur = con.cursor()
            cur.execute(
                "INSERT INTO notified_new_tasks (project, task_name, assignee, email, notified_at, description) VALUES (%s, %s, %s, %s, %s, %s)",
                (task["project"], task["task"], task["assignee"], None, now_str, task_desc)
            )
            con.commit()
            cur.close()
            con.close()
            known.add(key)
            continue

        body = f"""
        <html><body style="font-family:Segoe UI,Arial,sans-serif;max-width:700px;color:#333;">
          <h3 style="color:#6264A7;">🔔 New Task Assigned</h3>
          <p>Hi <b>{assignee}</b>,</p>
          <p>A new task has been assigned to you in the SharePoint Tracker:</p>
          <div style="border-left:4px solid #6264A7;padding:10px 16px;margin:12px 0;background:#fafafa;border-radius:4px;">
            <table style="font-size:14px;border-collapse:collapse;">
              <tr><td style='padding:4px 8px;color:#555;'>Project</td><td style='padding:4px 8px;font-weight:bold;'>{task['project']}</td></tr>
              <tr><td style='padding:4px 8px;color:#555;'>Task</td><td style='padding:4px 8px;'>{task['task'] or '—'}</td></tr>
              <tr><td style='padding:4px 8px;color:#555;'>Description</td><td style='padding:4px 8px;'>{task_desc or '—'}</td></tr>
              <tr><td style='padding:4px 8px;color:#555;'>Status</td><td style='padding:4px 8px;'>{task['status']}</td></tr>
              <tr><td style='padding:4px 8px;color:#555;'>ETA</td><td style='padding:4px 8px;'>{task['eta_str']}</td></tr>
            </table>
          </div>
          <hr style="margin:24px 0;border:none;border-top:1px solid #ddd;">
          <p style="font-size:12px;color:#888;">This is an automated notification. Please check your SharePoint tracker for details.</p>
        </body></html>
        """
        
        teams_ok = False
        result = {}
        if token:
            try:
                result = send_teams_message(token, email, body)
                if result.get("ok"):
                    teams_ok = True
            except Exception as e:
                result = {"ok": False, "error": str(e)}
        else:
            result = {"ok": False, "error": f"No Teams token available. Ref: {token_err or 'unknown'}"}

        if teams_ok:
            con = _get_db_conn()
            cur = con.cursor()
            cur.execute(
                "INSERT INTO notified_new_tasks (project, task_name, assignee, email, notified_at, description) VALUES (%s, %s, %s, %s, %s, %s)",
                (task["project"], task["task"], task["assignee"], email, now_str, task_desc)
            )
            con.commit()
            cur.close()
            con.close()
            _append_log("NEW TASK NOTIFIED", f"→ {email} | {task['task']}")
            notified_count += 1
            known.add(key)
        else:
            _append_log("NEW TASK FAIL FALLBACK", f"Teams new task alert failed for {email}: {result.get('error')}. Attempting email fallback...")
            subject = f"[Fanam Tracker] 🔔 New Task Assigned: {task['task']}"
            recipients = [TEST_TEAMS_EMAIL] if TEST_MODE_TEAMS else [email]
            fallback_res = send_email_helper(subject, body, recipients)
            if fallback_res.get("sent"):
                con = _get_db_conn()
                cur = con.cursor()
                cur.execute(
                    "INSERT INTO notified_new_tasks (project, task_name, assignee, email, notified_at, description) VALUES (%s, %s, %s, %s, %s, %s)",
                    (task["project"], task["task"], task["assignee"], email, now_str, task_desc)
                )
                con.commit()
                cur.close()
                con.close()
                _append_log("NEW TASK EMAIL SENT", f"→ {email} | method={fallback_res.get('method')} | {task['task']}")
                notified_count += 1
                known.add(key)
            else:
                failed_count += 1
                _append_log("NEW TASK FALLBACK FAILED", f"→ {email} | Teams and Email both failed for {task['task']}")

    return {"notified": notified_count, "failed": failed_count, "detail": "OK"}


def send_email_helper(
    subject: str,
    html_body: str,
    recipient_emails: list[str],
    attachment_path: Optional[str] = None,
    attachment_name: Optional[str] = None,
) -> dict:
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_pass = os.getenv("SMTP_PASSWORD", "")

    if smtp_user and smtp_pass:
        try:
            import smtplib
            from email.mime.multipart import MIMEMultipart
            from email.mime.text import MIMEText
            from email.mime.base import MIMEBase
            from email import encoders

            msg = MIMEMultipart()
            msg["Subject"] = subject
            msg["From"] = smtp_user
            msg["To"] = ", ".join(recipient_emails)
            msg.attach(MIMEText(html_body, "html"))

            if attachment_path and os.path.exists(attachment_path):
                name = attachment_name or os.path.basename(attachment_path)
                with open(attachment_path, "rb") as f:
                    part = MIMEBase("application", "octet-stream")
                    part.set_payload(f.read())
                encoders.encode_base64(part)
                part.add_header("Content-Disposition", f"attachment; filename={name}")
                msg.attach(part)

            with smtplib.SMTP(smtp_host, smtp_port) as server:
                server.starttls()
                server.login(smtp_user, smtp_pass)
                server.sendmail(smtp_user, recipient_emails, msg.as_string())
            return {"sent": True, "method": "SMTP", "detail": "OK"}
        except Exception as e:
            log.warning("SMTP email send fail: %s", e)
            _db_log("SMTP EMAIL FAILED", str(e))

    # Fallback to MS Graph sendMail
    try:
        token = _get_graph_token()
        if not TEAMS_SENDER_EMAIL:
            raise RuntimeError("TEAMS_SENDER_EMAIL not set for Graph email fallback.")

        url = f"https://graph.microsoft.com/v1.0/users/{TEAMS_SENDER_EMAIL}/sendMail"
        recipients_list = [{"emailAddress": {"address": email.strip()}} for email in recipient_emails if email.strip()]
        payload = {
            "message": {
                "subject": subject,
                "body": {
                    "contentType": "HTML",
                    "content": html_body
                },
                "toRecipients": recipients_list
            },
            "saveToSentItems": "false"
        }

        if attachment_path and os.path.exists(attachment_path):
            name = attachment_name or os.path.basename(attachment_path)
            with open(attachment_path, "rb") as f:
                content_bytes = f.read()
            import base64
            encoded = base64.b64encode(content_bytes).decode("utf-8")
            payload["message"]["attachments"] = [
                {
                    "@odata.type": "#microsoft.graph.fileAttachment",
                    "name": name,
                    "contentType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    "contentBytes": encoded
                }
            ]

        resp = requests.post(
            url,
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json=payload,
            timeout=30
        )
        if resp.status_code in (200, 202, 204):
            return {"sent": True, "method": "Graph", "detail": "OK"}
        else:
            raise RuntimeError(f"Graph email API returned status {resp.status_code}: {resp.text}")
    except Exception as e:
        log.error("Graph email send fail: %s", e)
        _db_log("GRAPH EMAIL FAILED", str(e))
        return {"sent": False, "detail": str(e)}


def send_directors_report() -> dict:
    """Compiles task statuses into an HTML report and emails it to the directors with attachment."""
    _append_log("DIRECTORS REPORT STARTED", "")
    if not DIRECTORS_EMAIL:
        _append_log("DIRECTORS REPORT ABORT", "DIRECTORS_EMAIL not set")
        return {"sent": False, "detail": "DIRECTORS_EMAIL not set"}

    tasks = load_tasks()
    if not tasks:
        _append_log("DIRECTORS REPORT ABORT", "No tasks loaded")
        return {"sent": False, "detail": "No tasks loaded"}

    today = date.today()
    
    # 1. Fetch all historically completed tasks from database
    completed_tasks = set()
    con = _get_db_conn()
    cur = con.cursor()
    try:
        cur.execute("SELECT project, task_name, assignee, COALESCE(description, '') FROM completed_tasks_history")
        rows = cur.fetchall()
        for p, t, a, d in rows:
            completed_tasks.add((p.strip().lower(), t.strip().lower(), a.strip().lower(), d.strip().lower()))
    except psycopg2.OperationalError:
        pass
    cur.close()
    con.close()

    # Group tasks by assignee
    tasks_by_assignee = defaultdict(list)
    for t in tasks:
        tasks_by_assignee[t["assignee"]].append(t)

    def get_row_weight(item):
        task, cat = item
        if cat == "overdue":
            return 1
        if cat == "due_today":
            return 2
        if task.get("remarks") and not is_completed_status(task["status"]):
            return 3
        return 4  # completed_today

    assignee_data = {}
    completed_tasks_to_insert = []

    for assignee, user_tasks in tasks_by_assignee.items():
        total_count = len(user_tasks)
        completed_count = sum(1 for t in user_tasks if is_completed_status(t["status"]))
        in_progress_count = sum(1 for t in user_tasks if "in progress" in t["status"].lower())
        yet_to_start_count = sum(1 for t in user_tasks if "yet to start" in t["status"].lower())
        
        overdue_count = 0
        due_today_count = 0
        today_activity_tasks = []
        
        for t in user_tasks:
            cat = categorise(t, today)
            is_overdue = cat == "overdue"
            is_due_today = cat == "due_today"
            has_remarks = bool(t.get("remarks"))
            is_completed = is_completed_status(t["status"])
            
            if is_completed:
                # Check completed history to see if it was completed today (or since last check)
                key = (t["project"].strip().lower(), t["task"].strip().lower(), t["assignee"].strip().lower(), (t.get("description") or "").strip().lower())
                if key not in completed_tasks:
                    completed_tasks_to_insert.append((t["project"], t["task"], t["assignee"], t.get("description") or "", today.isoformat()))
                    today_activity_tasks.append((t, "completed_today"))
            else:
                if is_overdue:
                    overdue_count += 1
                    today_activity_tasks.append((t, "overdue"))
                elif is_due_today:
                    due_today_count += 1
                    today_activity_tasks.append((t, "due_today"))
                elif has_remarks:
                    today_activity_tasks.append((t, "active_with_remarks"))
                    
        has_overdue_or_blocked = any(cat == "overdue" or (t.get("remarks") and not is_completed_status(t["status"])) for t, cat in today_activity_tasks)
        
        if has_overdue_or_blocked:
            weight = 1
        elif len(today_activity_tasks) > 0:
            weight = 2
        else:
            weight = 3
            
        today_activity_tasks.sort(key=get_row_weight)
        
        assignee_data[assignee] = {
            "weight": weight,
            "total_count": total_count,
            "completed_count": completed_count,
            "in_progress_count": in_progress_count,
            "yet_to_start_count": yet_to_start_count,
            "overdue_count": overdue_count,
            "today_activity_tasks": today_activity_tasks,
            "has_overdue_or_blocked": has_overdue_or_blocked
        }

    # Sort assignee names by weight (overdue/blocked first) and then alphabetically
    sorted_assignees = sorted(assignee_data.keys(), key=lambda name: (assignee_data[name]["weight"], name.lower()))

    rows_html = ""
    for assignee in sorted_assignees:
        d = assignee_data[assignee]
        summary_text = (
            f"<span style='background:#e2f0d9;color:#385723;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:bold;margin-right:6px;display:inline-block;white-space:nowrap;'>✔️ {d['completed_count']} Completed</span> "
            f"<span style='background:#fce4d6;color:#c65911;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:bold;margin-right:6px;display:inline-block;white-space:nowrap;'>🕒 {d['in_progress_count']} In Progress</span> "
            f"<span style='background:#fff2cc;color:#7f6000;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:bold;margin-right:6px;display:inline-block;white-space:nowrap;'>⏳ {d['yet_to_start_count']} Yet to Start</span> "
        )
        if d['overdue_count'] > 0:
            summary_text += f"<span style='background:#fce4d6;color:#c00000;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:bold;display:inline-block;white-space:nowrap;'>⚠️ {d['overdue_count']} Overdue</span>"
            
        rows_html += f"""
        <tr style="background-color: #f9f9fb;">
          <td colspan="7" style="padding: 12px 10px; border-bottom: 1px solid #eee;">
            <table style="width:100%; border-collapse:collapse;">
              <tr>
                <td style="font-size: 14px; font-weight: bold; color: #464775; text-align: left; padding: 0;">
                  👤 {assignee} <span style="font-weight:normal; color:#777; font-size:12px;">({d['total_count']} overall tasks)</span>
                </td>
                <td style="text-align: right; padding: 0;">
                  {summary_text}
                </td>
              </tr>
            </table>
          </td>
        </tr>
        """
        
        if d["today_activity_tasks"]:
            # Only render non-completed tasks as rows — completed tasks are summarised in the badge above
            visible_tasks = [(t, cat) for t, cat in d["today_activity_tasks"] if cat != "completed_today"]
            if visible_tasks:
                for t, cat in visible_tasks:
                    status_color = "#333"
                    eta_style = ""
                    if is_completed_status(t["status"]):
                        status_color = "#27ae60"
                    elif "yet to start" in t["status"].lower():
                        status_color = "#2980b9"
                    elif "in progress" in t["status"].lower():
                        status_color = "#e67e22"
                        
                    if cat == "overdue":
                        eta_style = "color:#c0392b; font-weight:bold;"
                        
                    remark_html = t['remarks'] or '—'
                    if cat == "overdue" and not is_completed_status(t["status"]):
                        if remark_html != '—':
                            remark_html = f"<span style='color:#c0392b;'>⚠️ <b>Overdue Delay:</b> {remark_html}</span>"
                        else:
                            remark_html = "<span style='color:#c0392b;'>⚠️ No delay explanation provided yet.</span>"
                            
                    rows_html += f"""
                    <tr>
                      <td style="padding:10px 10px 10px 20px;border-bottom:1px solid #eee;font-size:13px;color:#555;">{t['project']}</td>
                      <td style="padding:10px 10px;border-bottom:1px solid #eee;font-size:13px;"><b>{t['task']}</b></td>
                      <td style="padding:10px 10px;border-bottom:1px solid #eee;font-size:12px;color:#666;">{t['description'] or '—'}</td>
                      <td style="padding:10px 10px;border-bottom:1px solid #eee;color:{status_color};font-weight:bold;font-size:13px;">{t['status']}</td>
                      <td style="padding:10px 10px;border-bottom:1px solid #eee;font-size:13px;">{t.get('start_date_str') or '—'}</td>
                      <td style="padding:10px 10px;border-bottom:1px solid #eee;font-size:13px;{eta_style}">{t['eta_str']}</td>
                      <td style="padding:10px 10px;border-bottom:1px solid #eee;font-size:12px;line-height:1.4;">{remark_html}</td>
                    </tr>
                    """
            else:
                # All tasks are completed — no active alerts
                rows_html += f"""
                <tr>
                  <td colspan="7" style="padding: 10px 10px 10px 20px; border-bottom: 1px solid #eee; font-style: italic; color: #999; font-size: 13px;">
                    No active alerts — all tasks completed.
                  </td>
                </tr>
                """
        else:
            rows_html += f"""
            <tr>
              <td colspan="7" style="padding: 10px 10px 10px 20px; border-bottom: 1px solid #eee; font-style: italic; color: #999; font-size: 13px;">
                No active alerts or status updates today.
              </td>
            </tr>
            """

    report_time = datetime.now().strftime("%d-%b-%Y %H:%M")
    html_body = f"""
    <html><body style="font-family:Segoe UI,Arial,sans-serif;color:#333;margin:0;padding:20px;">
      <h2 style="color:#6264A7;border-bottom:2px solid #6264A7;padding-bottom:10px;">📋 Fanam Project Tracker — Daily Consolidated Report</h2>
      <p style="color:#666;">Generated on <b>{report_time} IST</b></p>
      
      <table style="width:100%;border-collapse:collapse;margin-top:20px;text-align:left;">
        <thead>
          <tr style="background-color:#eaeaea;font-size:13px;color:#333;">
            <th style="padding:10px;border-bottom:2px solid #ddd;padding-left:20px;width:15%;">Project</th>
            <th style="padding:10px;border-bottom:2px solid #ddd;width:20%;">Task</th>
            <th style="padding:10px;border-bottom:2px solid #ddd;width:20%;">Description</th>
            <th style="padding:10px;border-bottom:2px solid #ddd;width:10%;">Status</th>
            <th style="padding:10px;border-bottom:2px solid #ddd;width:10%;">Start Date</th>
            <th style="padding:10px;border-bottom:2px solid #ddd;width:10%;">ETA</th>
            <th style="padding:10px;border-bottom:2px solid #ddd;width:15%;">Remarks / Delay Mitigations</th>
          </tr>
        </thead>
        <tbody>
          {rows_html}
        </tbody>
      </table>
      
      <hr style="margin-top:30px;border:none;border-top:1px solid #eee;">
      <p style="font-size:12px;color:#999;text-align:center;">This is an automated report generated by Fanam Teams Reminder Agent. The live spreadsheet is attached.</p>
    </body></html>
    """

    subject = f"[Fanam Tracker] Daily Project Status Report — {datetime.now().strftime('%d-%b-%Y')}"
    recipients = [TEST_TEAMS_EMAIL] if TEST_MODE_DIRECTORS else [email.strip() for email in DIRECTORS_EMAIL.split(",") if email.strip()]

    # Use cached Excel if exists, otherwise fallback to local source path
    attachment_path = SHAREPOINT_CACHE_PATH if os.path.exists(SHAREPOINT_CACHE_PATH) else (EXCEL_PATH if os.path.exists(EXCEL_PATH) else None)
    attachment_name = "Fanam_Project_Planning_Allocation.xlsx"

    # Save new completed tasks to database history so they are not shown on subsequent days
    if completed_tasks_to_insert:
        con = _get_db_conn()
        cur = con.cursor()
        try:
            cur.executemany(
                "INSERT INTO completed_tasks_history (project, task_name, assignee, description, completed_at) VALUES (%s, %s, %s, %s, %s)",
                completed_tasks_to_insert
            )
            con.commit()
        except psycopg2.OperationalError as e:
            _append_log("COMPLETED DB WRITE FAIL", str(e))
        cur.close()
        con.close()

    res = send_email_helper(subject, html_body, recipients, attachment_path, attachment_name)
    if res.get("sent"):
        _append_log("DIRECTORS REPORT SENT", f"Via {res.get('method')}")
        return {"sent": True, "method": res.get("method"), "detail": "OK"}
    else:
        _append_log("DIRECTORS REPORT FAILED", res.get("detail", "unknown error"))
        return {"sent": False, "detail": res.get("detail", "unknown error")}


def check_employee_milestones(test_mode=False, mock_email=None, mock_employee=None, mock_years=None) -> dict:
    """Checks active employee milestones (1-year, 3-year, 5-year) and dispatches recognition/appreciation emails."""
    _append_log("EMPLOYEE MILESTONES CHECK STARTED", f"test_mode={test_mode}")
    _here = os.path.dirname(os.path.abspath(__file__))
    master_path = os.path.join(_here, "Employee Master Sheet .xlsx")
    if not os.path.exists(master_path):
        _append_log("EMPLOYEE MILESTONES ERROR", f"{master_path} not found")
        return {"status": "error", "message": f"{master_path} not found"}

    try:
        df = pd.read_excel(master_path, sheet_name="Emp_Info")
    except Exception as e:
        _append_log("EMPLOYEE MILESTONES ERROR", f"Could not read sheet: {e}")
        return {"status": "error", "message": str(e)}

    today = date.today()
    milestones_processed = 0
    details = []

    for idx, row in df.iterrows():
        emp_name = str(row.get("Employee Name", "")).strip()
        active = str(row.get("Active?", "Yes")).strip().lower()
        if active == "no" or not emp_name:
            continue

        doj_raw = row.get("Date of Joining")
        doj = parse_date(doj_raw)
        if not doj:
            continue

        emp_email = str(row.get("Official Email", "")).strip()
        manager_email = PM_EMAIL or "pm@fanamdigital.com"

        # Determine anniversary years
        years = today.year - doj.year
        is_anniversary = (today.month == doj.month and today.day == doj.day)

        if test_mode:
            # Overrides for manual testing
            if mock_employee:
                if mock_employee.strip().lower() != emp_name.lower():
                    continue
            else:
                # If no specific employee requested, pick the first active one
                if idx > 0:
                    continue
            # Override dates & years
            years = mock_years or 3
            is_anniversary = True
            if mock_email:
                emp_email = mock_email
                manager_email = mock_email

        if not is_anniversary:
            continue

        # Process milestone triggers
        if years == 1:
            # 1-Year Alert: Notify HR/Manager
            subject = f"🎁 [Action Required] 1-Year Milestone recognition: {emp_name}"
            html_body = f"""
            <html><body style="font-family:Segoe UI,Arial,sans-serif;max-width:650px;color:#333;line-height:1.6;">
              <div style="background: linear-gradient(135deg, #FF9900, #FF5500); padding: 24px; text-align: center; border-radius: 8px 8px 0 0; color: white;">
                <h2 style="margin: 0; font-size: 24px;">🎁 1-Year Milestone Alert</h2>
              </div>
              <div style="padding: 24px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 8px 8px; background: #fff;">
                <p>Dear HR / Reporting Manager,</p>
                <p>This is an automated notification that <b>{emp_name}</b> has completed exactly <b>1 year of service</b> at Fanam Digital!</p>
                <p><b>Date of Joining:</b> {doj.strftime('%d-%b-%Y')}</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <h4 style="color: #FF5500; margin-top: 0;">Required Actions:</h4>
                <ul>
                  <li>Organize a milestone recognition certificate.</li>
                  <li>Prepare the company-provided gratitude token/gift.</li>
                  <li>Present this recognition at the next team catch-up.</li>
                </ul>
                <p style="font-size: 12px; color: #888; margin-top: 30px;">This is a system alert triggered by the HR Master database tracker.</p>
              </div>
            </body></html>
            """
            recipients = [TEST_TEAMS_EMAIL] if TEST_MODE_DIRECTORS else [manager_email]
            res = send_email_helper(subject, html_body, recipients)
            _db_log("1-YEAR MILESTONE ALERT", f"HR Alert sent for {emp_name}. SMTP Status: {res.get('sent')}")
            details.append({"employee": emp_name, "years": 1, "type": "HR_Alert", "sent": res.get("sent")})
            milestones_processed += 1

        elif years == 3:
            # 3-Year: Celebration email to Employee
            subject = f"🎉 Celebrating Your 3-Year Milestone at Fanam, {emp_name}!"
            html_body = f"""
            <html><body style="font-family:Segoe UI,Arial,sans-serif;max-width:650px;color:#333;line-height:1.6;">
              <div style="background: linear-gradient(135deg, #6264A7, #464775); padding: 30px; text-align: center; border-radius: 8px 8px 0 0; color: white;">
                <span style="font-size: 40px;">🚀</span>
                <h2 style="margin: 10px 0 0 0; font-size: 26px;">3 Years of Excellence!</h2>
                <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">Thank you for being part of our journey</p>
              </div>
              <div style="padding: 30px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 8px 8px; background: #fff; text-align: center;">
                <p style="font-size: 18px; color: #464775; font-weight: bold; margin-top: 0;">Happy 3rd Work Anniversary, {emp_name}!</p>
                <p style="text-align: left;">Dear {emp_name},</p>
                <p style="text-align: left;">Today, we celebrate a significant milestone: your 3-year anniversary with Fanam Digital. Over the past three years, your hard work, dedication, and expertise have contributed immensely to our projects and team culture.</p>
                <p style="text-align: left;">To appreciate your remarkable journey, the company has prepared a special recognition gift package for you. Please coordinate with the HR desk to collect it!</p>
                <p style="text-align: left; font-style: italic; color: #555; background: #f9f9f9; padding: 15px; border-left: 4px solid #6264A7; border-radius: 4px;">
                  "Success isn't just about what you accomplish in your life, it's about what you inspire others to do." Thank you for inspiring us all.
                </p>
                <p style="text-align: left; margin-top: 25px;">Warmest congratulations,</p>
                <p style="text-align: left; font-weight: bold; color: #464775;">The Fanam Digital Team</p>
              </div>
            </body></html>
            """
            recipients = [TEST_TEAMS_EMAIL] if TEST_MODE_TEAMS else [emp_email]
            res = send_email_helper(subject, html_body, recipients)
            _db_log("3-YEAR MILESTONE CELEBRATION", f"Appreciation email sent to {emp_name}. SMTP Status: {res.get('sent')}")
            details.append({"employee": emp_name, "years": 3, "type": "Employee_Appreciation", "sent": res.get("sent")})
            milestones_processed += 1

        elif years >= 5:
            # 5-Year: Celebration email to Employee + Alert email to Directors
            # 1. Employee Celebration Email
            subject_emp = f"🎓 Honoring Your {years}-Year Milestone at Fanam, {emp_name}!"
            html_body_emp = f"""
            <html><body style="font-family:Segoe UI,Arial,sans-serif;max-width:650px;color:#333;line-height:1.6;">
              <div style="background: linear-gradient(135deg, #107c41, #0b5930); padding: 30px; text-align: center; border-radius: 8px 8px 0 0; color: white;">
                <span style="font-size: 40px;">🏆</span>
                <h2 style="margin: 10px 0 0 0; font-size: 26px;">A Half-Decade of Dedication!</h2>
                <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">Honoring your outstanding contribution</p>
              </div>
              <div style="padding: 30px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 8px 8px; background: #fff; text-align: center;">
                <p style="font-size: 18px; color: #0b5930; font-weight: bold; margin-top: 0;">Happy Work Anniversary, {emp_name}!</p>
                <p style="text-align: left;">Dear {emp_name},</p>
                <p style="text-align: left;">We are incredibly proud to celebrate your <b>{years}-year milestone</b> at Fanam Digital. Reaching a half-decade of service is a magnificent testament to your loyalty, skill, and outstanding leadership within the team.</p>
                <p style="text-align: left;">Your contribution has been foundational to our growth, and we are deeply grateful for your continuous commitment to our shared vision.</p>
                <p style="text-align: left; margin-top: 25px;">With greatest respect and gratitude,</p>
                <p style="text-align: left; font-weight: bold; color: #0b5930;">The Directors & Management Team</p>
              </div>
            </body></html>
            """
            rec_emp = [TEST_TEAMS_EMAIL] if TEST_MODE_TEAMS else [emp_email]
            res_emp = send_email_helper(subject_emp, html_body_emp, rec_emp)

            # 2. Directors Recommendation Alert Email
            subject_dir = f"🔔 [Action Required] 5-Year Milestone Reward Recommendation: {emp_name}"
            html_body_dir = f"""
            <html><body style="font-family:Segoe UI,Arial,sans-serif;max-width:650px;color:#333;line-height:1.6;">
              <div style="background: linear-gradient(135deg, #d83b01, #b83201); padding: 24px; text-align: center; border-radius: 8px 8px 0 0; color: white;">
                <h2 style="margin: 0; font-size: 24px;">🔔 5-Year Anniversary Alert</h2>
              </div>
              <div style="padding: 24px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 8px 8px; background: #fff;">
                <p>Dear Directors,</p>
                <p>This is an automated HRMS trigger notification that <b>{emp_name}</b> has completed <b>{years} years of service</b> with Fanam Digital.</p>
                <p><b>Date of Joining:</b> {doj.strftime('%d-%b-%Y')}</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <h4 style="color: #b83201; margin-top: 0;">Recommended Appreciation Plan:</h4>
                <ul>
                  <li>Provide a milestone appreciation reward/bonus.</li>
                  <li>Schedule a performance evaluation for a merit-based increment.</li>
                  <li>Draft a formal commendation letter.</li>
                </ul>
                <p style="font-size: 12px; color: #888; margin-top: 30px;">This is a high-priority system action trigger generated by the HR Database Engine.</p>
              </div>
            </body></html>
            """
            rec_dir = [TEST_TEAMS_EMAIL] if TEST_MODE_DIRECTORS else [email.strip() for email in DIRECTORS_EMAIL.split(",") if email.strip()]
            res_dir = send_email_helper(subject_dir, html_body_dir, rec_dir)

            _db_log("5-YEAR MILESTONE RECOMMENDATION", f"Emails sent for {emp_name}. Emp Status: {res_emp.get('sent')}, Dir Status: {res_dir.get('sent')}")
            details.append({"employee": emp_name, "years": years, "type": "Directors_Alert", "sent": res_emp.get("sent") and res_dir.get("sent")})
            milestones_processed += 1

    return {"status": "ok", "processed": milestones_processed, "details": details}


# ─────────────────────────────────────────────
# SCHEDULER
# ─────────────────────────────────────────────
def _reschedule_jobs():
    schedule.clear()
    
    morning_local = utc_to_ist_str(MORNING_TIME_UTC)
    pm_report_local = utc_to_ist_str(PM_REPORT_TIME_UTC)
    evening_local = utc_to_ist_str(EVENING_TIME_UTC)
    directors_report_local = utc_to_ist_str(DIRECTORS_REPORT_TIME_UTC)
    
    # 1. Morning Task Reminders (Teams DM)
    schedule.every().day.at(morning_local).do(run_reminder, is_evening=False)
    
    # 2. Unassigned Resources Report (Email to PM)
    schedule.every().day.at(pm_report_local).do(send_pm_unassigned_report)
    
    # 3. Continuous (Every 2 mins) — Real-Time Task Allocation Alerts (Teams DM)
    schedule.every(NEW_TASK_CHECK_MINUTES).minutes.do(check_and_notify_new_tasks)
    
    # 4. Evening Check-in, Gemini AI Guidance & Live Sync (Teams DM)
    schedule.every().day.at(evening_local).do(run_reminder, is_evening=True)
    
    # 5. Executive EOD Directors' Report (Email + Master Excel)
    schedule.every().day.at(directors_report_local).do(send_directors_report)
    
    # 6. Daily Token Expiry Alert Check (11:30 AM IST)
    schedule.every().day.at("11:30").do(check_teams_token_expiry)
    
    # 6b. Daily Employee Milestone Check (12:30 PM IST)
    schedule.every().day.at("12:30").do(check_employee_milestones)
    
    # Background reply polling (every 30 seconds for near-instant AI replies)
    schedule.every(30).seconds.do(poll_teams_replies)
    
    # 7. Saturday 5:30 PM IST — Weekly Resource Utilization Report (Email to PM)
    schedule.every().saturday.at(directors_report_local).do(send_pm_utilization_report)
    
    # 8. Friday 5:30 PM IST — Weekly Project Status & Risk Summary Report (Email to PM/Directors)
    schedule.every().friday.at(directors_report_local).do(send_weekly_status_report)
    
    _append_log("SCHEDULER RESTARTED", f"Jobs scheduled (Local Time): Morning ({morning_local}), PM Report ({pm_report_local}), Evening ({evening_local}), PM EOD ({directors_report_local})")


def _scheduler_loop():
    global _scheduler_running
    _reschedule_jobs()
    # Perform startup token expiry check
    try:
        check_teams_token_expiry()
    except Exception as e:
        log.warning("Startup Teams token check failed: %s", e)
    while _scheduler_running:
        try:
            schedule.run_pending()
        except Exception as e:
            log.error("Scheduler loop encountered an error: %s", e, exc_info=True)
        time.sleep(10)
    _append_log("SCHEDULER STOPPED", "")


# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Header, Depends, UploadFile, File, HTTPException, Request
router = APIRouter()
app = router

HRMS_API_BASE = os.getenv("HRMS_API_BASE", "http://127.0.0.1:8000/api/v1")

def _require_auth(request: Request) -> dict:
    # Use native dependency injection to avoid HTTP deadlocks
    from app.core.security import decode_token
    from app.db.session import SessionLocal
    from app.models.models import User
    
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = auth_header.split(" ")[1]
    try:
        payload = decode_token(token)
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
            
        db = SessionLocal()
        try:
            user = db.query(User).filter(User.id == int(user_id)).first()
            if not user or not user.is_active:
                raise HTTPException(status_code=401, detail="User not found or inactive")
            
            role_val = user.role.value if hasattr(user.role, 'value') else user.role
            return {
                "id": user.id,
                "email": user.email,
                "role": role_val,
                "fullName": user.full_name,
                "full_name": user.full_name,
            }
        finally:
            db.close()
    except Exception as e:
        log.warning("Auth token validation failed: %s", e)
        raise HTTPException(status_code=401, detail="Not authenticated")

def _require_manager(request: Request) -> dict:
    user = _require_auth(request)
    role = user.get("role", "").lower()
    if role not in ("admin", "hr", "manager", "super_admin"):
        raise HTTPException(status_code=403, detail="Manager or Admin access required")
    return user

def _require_admin(request: Request) -> dict:
    user = _require_auth(request)
    role = user.get("role", "").lower()
    if role not in ("admin", "hr", "super_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

@app.get("/employees")
def get_employees(current_user: dict = Depends(_require_auth)):
    """Active employee list from Master Excel Sheet."""
    try:
        _here = os.path.dirname(os.path.abspath(__file__))
        master_path = os.path.join(_here, "Employee Master Sheet .xlsx")
        if not os.path.exists(master_path):
            return {"employees": []}
        df = pd.read_excel(master_path, sheet_name="Emp_Info")
        df = df[df['Active?'].astype(str).str.strip().str.lower() == 'yes']
        records = df[['Employee Name', 'Official Email', 'Department', 'Date of Joining']].dropna(subset=['Employee Name']).to_dict(orient='records')
        return {"employees": records}
    except Exception as e:
        raise HTTPException(500, detail=str(e))

@app.get("/excel/sheets")
def get_excel_sheets(current_user: dict = Depends(_require_manager)):
    """Get all sheets in SharePoint Excel cache."""
    cache_path = SHAREPOINT_CACHE_PATH
    if not os.path.exists(cache_path):
        # Sibling fallback
        sibling = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sharepoint_cache.xlsx")
        if os.path.exists(sibling):
            cache_path = sibling
        else:
            raise HTTPException(404, detail=f"SharePoint cache Excel file not found at: {os.path.abspath(cache_path)}")
    try:
        xl = pd.ExcelFile(cache_path)
        return {"sheets": xl.sheet_names}
    except Exception as e:
        raise HTTPException(500, detail=str(e))

@app.get("/excel/data")
def get_excel_data(sheet: str, current_user: dict = Depends(_require_manager)):
    """Get rows of a specific sheet in SharePoint Excel cache."""
    cache_path = SHAREPOINT_CACHE_PATH
    if not os.path.exists(cache_path):
        # Sibling fallback
        sibling = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sharepoint_cache.xlsx")
        if os.path.exists(sibling):
            cache_path = sibling
        else:
            raise HTTPException(404, detail=f"SharePoint cache Excel file not found at: {os.path.abspath(cache_path)}")
    try:
        import openpyxl
        wb = openpyxl.load_workbook(cache_path, data_only=True)
        if sheet not in wb.sheetnames:
            raise HTTPException(404, detail=f"Sheet '{sheet}' not found in Excel file.")
            
        ws = wb[sheet]
        
        # Unmerge cells and fill with top-left value so that the frontend sees the merged data in all cells
        mcr_list = list(ws.merged_cells.ranges)
        for mcr in mcr_list:
            min_col, min_row, max_col, max_row = mcr.bounds
            top_left_val = ws.cell(row=min_row, column=min_col).value
            ws.unmerge_cells(str(mcr))
            for r in range(min_row, max_row + 1):
                for c in range(min_col, max_col + 1):
                    ws.cell(row=r, column=c).value = top_left_val
                    
        data = list(ws.values)
        if not data:
            return {"columns": [], "rows": []}
            
        df = pd.DataFrame(data[1:], columns=data[0])
        
        # Drop completely empty rows to reduce payload size and speed up iteration
        df = df.dropna(how="all")
        df = df.fillna("")
        
        # Clean columns to ensure they are string values and do not contain float nan
        cleaned_columns = []
        for col in df.columns:
            c_str = str(col).strip()
            if c_str in ("nan", "None", "<NA>", "NaN", "NaT") or not c_str:
                cleaned_columns.append("")
            else:
                cleaned_columns.append(c_str)

        # Convert rows and sanitize float nans/infs recursively
        import math
        raw_rows = df.to_dict(orient="records")
        cleaned_rows = []
        for row in raw_rows:
            # Check if row is practically empty to skip it
            if not any(str(val).strip() for val in row.values() if val is not None):
                continue
                
            cleaned_row = {}
            for k, v in row.items():
                k_str = str(k).strip()
                if k_str in ("nan", "None", "<NA>", "NaN", "NaT") or not k_str:
                    k_str = ""
                
                # Check float nan/inf
                if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                    cleaned_row[k_str] = ""
                elif pd.isna(v) or v is None:
                    cleaned_row[k_str] = ""
                elif isinstance(v, (datetime, date)):
                    cleaned_row[k_str] = v.strftime("%Y-%m-%d")
                else:
                    val_str = str(v).strip()
                    if val_str in ("nan", "None", "<NA>", "NaN", "NaT"):
                        cleaned_row[k_str] = ""
                    else:
                        # Normalize timestamp strings
                        if " 00:00:00" in val_str:
                            val_str = val_str.replace(" 00:00:00", "")
                        elif "T00:00:00" in val_str:
                            val_str = val_str.replace("T00:00:00", "")
                        cleaned_row[k_str] = val_str
            cleaned_rows.append(cleaned_row)

        return {
            "columns": cleaned_columns,
            "rows": cleaned_rows
        }
    except Exception as e:
        raise HTTPException(500, detail=str(e))


def start_teams_reminder():
    _init_db()
    _populate_initial_tasks_if_empty()
    global _scheduler_running, _scheduler_thread
    _scheduler_running = True
    _scheduler_thread = threading.Thread(target=_scheduler_loop, daemon=True)
    _scheduler_thread.start()
    _append_log("STARTUP", f"Teams API started — {MORNING_TIME_UTC} & {EVENING_TIME_UTC} UTC")


def stop_teams_reminder():
    global _scheduler_running
    _scheduler_running = False
    schedule.clear()


class ConfigUpdate(BaseModel):
    test_mode_teams: Optional[bool] = None
    test_mode_pm: Optional[bool] = None
    test_mode_directors: Optional[bool] = None
    test_teams_email: Optional[str] = None
    morning_time_utc: Optional[str] = None
    evening_time_utc: Optional[str] = None
    pm_report_time_utc: Optional[str] = None
    directors_report_time_utc: Optional[str] = None
    reply_poll_minutes: Optional[int] = None
    new_task_check_minutes: Optional[int] = None
    pm_email: Optional[str] = None
    directors_email: Optional[str] = None


class WeeklyTargetCreate(BaseModel):
    project: str
    week_start_date: str  # YYYY-MM-DD
    target_milestone: str
    deadline: Optional[str] = None  # YYYY-MM-DD
    dependencies: Optional[str] = ""
    achieved: Optional[bool] = False
    achievement_notes: Optional[str] = ""
    risks_faced: Optional[str] = ""


class EmployeeSkillsUpdate(BaseModel):
    employee_name: str
    strengths: Optional[str] = ""
    weaknesses: Optional[str] = ""


@app.get("/health")
def health():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}


@app.get("/tasks")
def get_tasks(project: Optional[str] = None, assignee: Optional[str] = None,
              status: Optional[str] = None, current_user: dict = Depends(_require_auth)):
    # Sanitize Javascript "undefined"/"null" string values
    if project in ("undefined", "null", ""):
        project = None
    if assignee in ("undefined", "null", ""):
        assignee = None
    if status in ("undefined", "null", ""):
        status = None

    tasks = load_tasks()
    
    # Enforce Employee self-only data scoping
    if current_user.get("role") == "Employee":
        tasks = [t for t in tasks if _is_assignee_match(t["assignee"], current_user["fullName"])]
    else:
        # Manager can filter
        if assignee:
            tasks = [t for t in tasks if _is_assignee_match(t["assignee"], assignee)]

    if project:
        needle = project.strip().lower()
        tasks = [t for t in tasks if needle in t["project"].lower()]
    if status:
        needle = status.strip().lower()
        tasks = [t for t in tasks if needle in t["status"].lower()]
    return {"count": len(tasks), "tasks": tasks}


@app.get("/summary")
def get_summary(current_user: dict = Depends(_require_auth)):
    today = date.today()
    tasks = load_tasks()
    
    # If Employee, only show their own summary metrics
    if current_user.get("role") == "Employee":
        tasks = [t for t in tasks if _is_assignee_match(t["assignee"], current_user["fullName"])]
        
    projects = defaultdict(lambda: defaultdict(int))
    categories = defaultdict(int)
    for t in tasks:
        cats = categorise_all(t, today) or ["completed_or_other"]
        for cat in cats:
            projects[t["project"]][cat] += 1
            categories[cat] += 1
            
    distinct_task_rows = len({t["row_id"] for t in tasks})
    return {
        "total_tasks": distinct_task_rows if current_user.get("role") == "Employee" else _raw_row_counts["total"],
        "total_distinct_task_rows": distinct_task_rows,
        "total_person_assignments": len(tasks),
        "by_category": dict(categories),
        "by_project": {p: dict(cats) for p, cats in projects.items()},
    }


@app.get("/replied-history")
def get_replied_history(limit: int = 100, current_user: dict = Depends(_require_auth)):
    con = _get_db_conn()
    cur = con.cursor()
    
    # If Employee, filter by their own email or name
    if current_user.get("role") == "Employee":
        cur.execute(
            """SELECT sent_at, assignee, email, reply_text, replied_at, sharepoint_written
               FROM pending_teams_replies WHERE status = 'replied' AND LOWER(email) = LOWER(%s)
               ORDER BY id DESC LIMIT %s""",
            (current_user["email"].strip(), limit),
        )
    else:
        cur.execute(
            """SELECT sent_at, assignee, email, reply_text, replied_at, sharepoint_written
               FROM pending_teams_replies WHERE status = 'replied'
               ORDER BY id DESC LIMIT %s""",
            (limit,),
        )
    rows = cur.fetchall()
    cur.close()
    con.close()
    return {
        "count": len(rows),
        "history": [
            {"sent_at": r[0], "assignee": r[1], "email": r[2], "reply_text": r[3],
             "replied_at": r[4], "sharepoint_written": bool(r[5])}
            for r in rows
        ],
    }


@app.get("/tasks/pending")
def get_pending_tasks(current_user: dict = Depends(_require_auth)):
    today = date.today()
    tasks = load_tasks()
    
    if current_user.get("role") == "Employee":
        tasks = [t for t in tasks if _is_assignee_match(t["assignee"], current_user["fullName"])]
        
    result = []
    for t in tasks:
        cats = categorise_all(t, today)
        if cats:
            result.append({**t, "category": cats[0], "categories": cats})
    return {"count": len(result), "tasks": result}


@app.post("/send-reminders")
def trigger_send(background_tasks: BackgroundTasks, current_user: dict = Depends(_require_manager)):
    background_tasks.add_task(run_with_manual_trigger_context, run_reminder, is_evening=False)
    return {"message": "Teams reminder run triggered in background"}


@app.post("/send-reminders/sync")
def trigger_send_sync(current_user: dict = Depends(_require_manager)):
    return run_reminder()


@app.post("/teams/poll-replies")
def trigger_poll_sync(current_user: dict = Depends(_require_manager)):
    return poll_teams_replies()


@app.post("/teams/poll-replies/background")
def trigger_poll(background_tasks: BackgroundTasks, current_user: dict = Depends(_require_manager)):
    background_tasks.add_task(run_with_manual_trigger_context, poll_teams_replies)
    return {"message": "Reply polling triggered in background"}


@app.post("/teams/check-new-tasks")
def trigger_check_new_tasks(background_tasks: BackgroundTasks, current_user: dict = Depends(_require_manager)):
    background_tasks.add_task(run_with_manual_trigger_context, check_and_notify_new_tasks)
    return {"message": "New tasks check triggered in background"}


@app.post("/reports/unassigned")
def trigger_pm_report(background_tasks: BackgroundTasks, current_user: dict = Depends(_require_manager)):
    background_tasks.add_task(run_with_manual_trigger_context, send_pm_unassigned_report)
    return {"message": "PM Unassigned report run triggered in background"}


@app.post("/poll-allocations")
def trigger_allocation_poll(background_tasks: BackgroundTasks, current_user: dict = Depends(_require_manager)):
    background_tasks.add_task(run_with_manual_trigger_context, check_and_notify_new_tasks)
    return {"message": "Real-time allocation poll triggered in background"}


@app.post("/reports/eod-directors")
def trigger_eod_report(background_tasks: BackgroundTasks, current_user: dict = Depends(_require_manager)):
    background_tasks.add_task(run_with_manual_trigger_context, send_directors_report)
    return {"message": "PM EOD report run triggered in background"}


@app.get("/reports/utilization/data")
def get_utilization_data(current_user: dict = Depends(_require_auth)):
    tasks = load_tasks()
    summary, dev_util = calculate_utilization_metrics(tasks)
    
    # Map keys for React frontend compatibility while keeping original keys for Streamlit/dashboard compatibility
    mapped_dev_util = []
    for d in dev_util:
        mapped_item = {
            **d,
            "Developer": d["assignee"],
            "Email": d["email"],
            "Active Tasks Count": d["task_count"],
            "Total Allocated Hours": d["allocated_hours"],
            "Utilization Percentage": d["utilization_pct"],
            "Utilization Status": d["status"],
            "PM Action Plan / Bench Suggestion": d["pm_note"],
            "Weekly Login Hours": d.get("weekly_login_hours", 0.0)
        }
        mapped_dev_util.append(mapped_item)
        
    mapped_summary = {
        **summary,
        "total_allocated_hours": summary["total_team_hours"],
        "average_efficiency": summary["avg_efficiency"],
        "bench_capacity": summary["free_capacity"]
    }
    
    # Scope to self-only for Employee role
    if current_user.get("role") == "Employee":
        mapped_dev_util = [d for d in mapped_dev_util if d["Developer"].strip().lower() == current_user["fullName"].strip().lower()]
        
    return {"summary": mapped_summary, "dev_utilization": mapped_dev_util}


@app.post("/reports/weekly-status")
def trigger_weekly_status_report(background_tasks: BackgroundTasks, current_user: dict = Depends(_require_manager)):
    background_tasks.add_task(run_with_manual_trigger_context, send_weekly_status_report)
    return {"message": "Weekly project status and risk report triggered in background"}


@app.post("/sharepoint/sync-mpp")
def sync_mpp_file(file: UploadFile = File(...), current_user: dict = Depends(_require_manager)):
    """Ingests exported MS Project Plan CSV files and syncs tasks into the tracker."""
    import csv
    from io import StringIO
    
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only MS Project exported CSV files are supported.")
        
    try:
        content = file.file.read().decode("utf-8")
        reader = csv.DictReader(StringIO(content))
        
        imported_tasks = []
        now_str = datetime.now().isoformat(timespec="seconds")
        con = _get_db_conn()
        cur = con.cursor()
        
        for row in reader:
            task_name = row.get("Task Name") or row.get("Name")
            assignee = row.get("Assignee") or row.get("Resource Names")
            project = row.get("Project") or "MS Project Sync"
            description = row.get("Description") or row.get("Notes") or ""
            
            if not task_name or not assignee:
                continue
                
            # Split multiple resources
            resources = [r.strip() for r in assignee.split(",") if r.strip()]
            for res in resources:
                cur.execute(
                    "INSERT INTO notified_new_tasks (project, task_name, assignee, email, notified_at, description) VALUES (%s, %s, %s, %s, %s, %s)",
                    (project, task_name, res, None, now_str, description)
                )
                imported_tasks.append({"project": project, "task": task_name, "assignee": res})
                
        con.commit()
        cur.close()
        con.close()
        
        _append_log("MS PROJECT PLAN SYNCED", f"File: {file.filename} | Imported {len(imported_tasks)} tasks")
        return {"status": "ok", "imported_count": len(imported_tasks), "tasks": imported_tasks}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"MPP/CSV Parsing failed: {str(e)}")


@app.post("/reports/utilization")
def trigger_utilization_report(background_tasks: BackgroundTasks, current_user: dict = Depends(_require_manager)):
    background_tasks.add_task(run_with_manual_trigger_context, send_pm_utilization_report)
    return {"message": "Resource Utilization report run triggered in background"}


@app.post("/teams/check-new-tasks/sync")
def trigger_check_new_tasks_sync(current_user: dict = Depends(_require_manager)):
    return check_and_notify_new_tasks()


@app.post("/teams/test")
def teams_test(recipient_email: Optional[str] = None, current_user: dict = Depends(_require_manager)):
    if not TEAMS_SENDER_EMAIL:
        raise HTTPException(400, "Set TEAMS_SENDER_EMAIL in .env")
    email = recipient_email or TEST_TEAMS_EMAIL
    if not email:
        raise HTTPException(400, "Provide recipient_email or set TEST_TEAMS_EMAIL")
    token = _get_teams_graph_token()
    body = build_teams_body("Test User", [])
    body = body.replace("Here is your task status update.", "This is a test message from the Fanam Teams Reminder Agent.")
    result = send_teams_message(token, email, body)
    if not result.get("ok"):
        raise HTTPException(502, detail=result.get("error"))
    return {"status": "ok", **result}


@app.post("/sharepoint/test")
def sharepoint_test(current_user: dict = Depends(_require_manager)):
    if not USE_SHAREPOINT:
        raise HTTPException(400, "SharePoint not configured")
    try:
        content = fetch_excel_from_sharepoint()
        with open(SHAREPOINT_CACHE_PATH, "wb") as f:
            f.write(content)
        return {"status": "ok", "bytes_downloaded": len(content)}
    except Exception as e:
        raise HTTPException(502, detail=str(e))


@app.post("/sharepoint/test-directors-report")
def test_directors_report(current_user: dict = Depends(_require_manager)):
    return send_directors_report()


@app.post("/sharepoint/test-pm-report")
def test_pm_report(current_user: dict = Depends(_require_manager)):
    return send_pm_unassigned_report()


@app.post("/teams/test-token-check")
def test_token_check(current_user: dict = Depends(_require_manager)):
    return check_teams_token_expiry()


@app.post("/teams/test-ai-mitigation")
def test_ai_mitigation(task_name: str, task_desc: str, delay_reason: str):
    mitigation = generate_mitigation_suggestion(task_name, task_desc, delay_reason)
    return {
        "task_name": task_name,
        "task_desc": task_desc,
        "delay_reason": delay_reason,
        "mitigation_suggestion": mitigation
    }


@app.get("/skills/generate/{employee_name}")
def ai_generate_skills(employee_name: str, current_user: dict = Depends(_require_auth)):
    """AI-powered endpoint: analyses task history via Gemini and returns strengths/weaknesses."""
    if current_user.get("role") == "Employee" and employee_name.strip().lower() != current_user["fullName"].strip().lower():
        raise HTTPException(status_code=403, detail="Employees can only generate their own skills matrix.")
        
    if not GEMINI_API_KEY:
        raise HTTPException(
            status_code=400,
            detail="GEMINI_API_KEY is not configured in .env — please add it to enable AI generation."
        )
    result = generate_skills_matrix(employee_name)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return result  # {"strengths": "• ...", "weaknesses": "• ..."}


@app.get("/skills/{employee_name}")
def get_employee_skills(employee_name: str, current_user: dict = Depends(_require_auth)):
    if current_user.get("role") == "Employee" and employee_name.strip().lower() != current_user["fullName"].strip().lower():
        raise HTTPException(status_code=403, detail="Employees can only view their own skills matrix.")
        
    con = _get_db_conn()
    cur = con.cursor()
    cur.execute("SELECT strengths, weaknesses FROM employee_skills WHERE employee_name = %s", (employee_name.strip(),))
    row = cur.fetchone()
    cur.close()
    con.close()
    if row:
        return {"strengths": row[0], "weaknesses": row[1]}
    return {"strengths": "", "weaknesses": ""}


@app.post("/skills")
def update_employee_skills(payload: EmployeeSkillsUpdate, current_user: dict = Depends(_require_manager)):
    con = _get_db_conn()
    cur = con.cursor()
    cur.execute(
        """INSERT INTO employee_skills (employee_name, strengths, weaknesses)
           VALUES (%s, %s, %s)
           ON CONFLICT (employee_name)
           DO UPDATE SET strengths = EXCLUDED.strengths, weaknesses = EXCLUDED.weaknesses""",
        (payload.employee_name.strip(), payload.strengths.strip(), payload.weaknesses.strip())
    )
    con.commit()
    cur.close()
    con.close()
    _db_log("SKILLS MATRIX UPDATED", f"Employee: {payload.employee_name}")
    return {"status": "ok"}


@app.get("/targets")
def get_weekly_targets(project: Optional[str] = None, current_user: dict = Depends(_require_auth)):
    con = _get_db_conn()
    cur = con.cursor()
    if project:
        cur.execute(
            """SELECT id, project, week_start_date, target_milestone, deadline, dependencies, achieved, achievement_notes, risks_faced
               FROM weekly_targets WHERE project = %s ORDER BY week_start_date DESC""",
            (project.strip(),)
        )
    else:
        cur.execute(
            """SELECT id, project, week_start_date, target_milestone, deadline, dependencies, achieved, achievement_notes, risks_faced
               FROM weekly_targets ORDER BY week_start_date DESC"""
        )
    rows = cur.fetchall()
    cur.close()
    con.close()
    
    return [
        {
            "id": r[0], "project": r[1], "week_start_date": str(r[2]), "target_milestone": r[3],
            "deadline": str(r[4]) if r[4] else "", "dependencies": r[5] or "",
            "achieved": bool(r[6]), "achievement_notes": r[7] or "", "risks_faced": r[8] or ""
        }
        for r in rows
    ]


@app.post("/targets")
def create_or_update_target(payload: WeeklyTargetCreate, current_user: dict = Depends(_require_manager)):
    con = _get_db_conn()
    cur = con.cursor()
    
    # Parse dates safely
    deadline_date = parse_date(payload.deadline) if payload.deadline else None
    week_start = parse_date(payload.week_start_date)
    
    # Check if a target for this project and week already exists to update it, else insert
    cur.execute(
        "SELECT id FROM weekly_targets WHERE project = %s AND week_start_date = %s",
        (payload.project.strip(), week_start)
    )
    row = cur.fetchone()
    
    if row:
        cur.execute(
            """UPDATE weekly_targets
               SET target_milestone = %s, deadline = %s, dependencies = %s, achieved = %s, achievement_notes = %s, risks_faced = %s
               WHERE id = %s""",
            (payload.target_milestone.strip(), deadline_date, payload.dependencies.strip(),
             payload.achieved, payload.achievement_notes.strip(), payload.risks_faced.strip(), row[0])
        )
    else:
        cur.execute(
            """INSERT INTO weekly_targets (project, week_start_date, target_milestone, deadline, dependencies, achieved, achievement_notes, risks_faced)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
            (payload.project.strip(), week_start, payload.target_milestone.strip(), deadline_date,
             payload.dependencies.strip(), payload.achieved, payload.achievement_notes.strip(), payload.risks_faced.strip())
        )
    con.commit()
    cur.close()
    con.close()
    _db_log("WEEKLY TARGET UPDATE", f"Project: {payload.project} | Week Starting: {payload.week_start_date}")
    return {"status": "ok"}


@app.post("/sharepoint/test-milestone")
def trigger_milestone_test(employee_name: str, mock_years: int, mock_email: Optional[str] = None, current_user: dict = Depends(_require_manager)):
    email_to_use = mock_email or TEST_TEAMS_EMAIL
    return check_employee_milestones(test_mode=True, mock_email=email_to_use, mock_employee=employee_name, mock_years=mock_years)


@app.post("/sharepoint/check-milestones")
def trigger_milestone_check(current_user: dict = Depends(_require_manager)):
    return check_employee_milestones(test_mode=False)


@app.get("/scheduler/status")
def scheduler_status(current_user: dict = Depends(_require_manager)):
    next_runs = [str(j.next_run) for j in schedule.jobs if j.next_run] if _scheduler_running else []
    return {
        "running": _scheduler_running,
        "schedule_times_utc": [MORNING_TIME_UTC, EVENING_TIME_UTC],
        "schedule_times_ist": [utc_to_ist_str(MORNING_TIME_UTC), utc_to_ist_str(EVENING_TIME_UTC)],
        "reply_poll_minutes": REPLY_POLL_MINUTES,
        "next_runs": next_runs,
    }


@app.get("/logs")
def get_logs(limit: int = 100, current_user: dict = Depends(_require_manager)):
    try:
        con = _get_db_conn()
        cur = con.cursor()
        cur.execute(
            "SELECT timestamp, event, detail FROM activity_log ORDER BY id DESC LIMIT %s",
            (limit,),
        )
        rows = cur.fetchall()
        cur.close()
        con.close()
        return {"logs": [{"timestamp": r[0], "event": r[1], "detail": r[2]} for r in rows]}
    except Exception:
        return {"logs": list(reversed(_run_log[-limit:]))}


@app.get("/reminder-history")
def get_reminder_history(limit: int = 100, current_user: dict = Depends(_require_auth)):
    con = _get_db_conn()
    cur = con.cursor()
    
    # If Employee, filter by their own email or name
    if current_user.get("role") == "Employee":
        cur.execute(
            """SELECT sent_at, assignee, email, task_count, status, subject,
                      error_detail, chat_id, message_id
               FROM reminder_history WHERE LOWER(email) = LOWER(%s) ORDER BY id DESC LIMIT %s""",
            (current_user["email"].strip(), limit),
        )
    else:
        cur.execute(
            """SELECT sent_at, assignee, email, task_count, status, subject,
                      error_detail, chat_id, message_id
               FROM reminder_history ORDER BY id DESC LIMIT %s""",
            (limit,),
        )
    rows = cur.fetchall()
    cur.close()
    con.close()
    return {
        "count": len(rows),
        "history": [
            {"sent_at": r[0], "assignee": r[1], "email": r[2], "task_count": r[3],
             "status": r[4], "subject": r[5], "error_detail": r[6],
             "chat_id": r[7], "message_id": r[8]}
            for r in rows
        ],
    }


@app.get("/pending-replies")
def get_pending_replies(current_user: dict = Depends(_require_auth)):
    pending = _get_pending_replies()
    if current_user.get("role") == "Employee":
        pending = [p for p in pending if p["email"].strip().lower() == current_user["email"].strip().lower()]
    return {"pending": pending}


@app.get("/config")
def get_config(current_user: dict = Depends(_require_admin)):
    return {
        "excel_file": EXCEL_PATH,
        "excel_source": "sharepoint" if (USE_SHAREPOINT and not _prefer_uploaded_excel) else "local",
        "sharepoint_enabled": USE_SHAREPOINT,
        "sharepoint_share_url": SHAREPOINT_SHARE_URL,
        "teams_sender_email": TEAMS_SENDER_EMAIL,
        "test_mode_teams": TEST_MODE_TEAMS,
        "test_mode_pm": TEST_MODE_PM,
        "test_mode_directors": TEST_MODE_DIRECTORS,
        "test_teams_email": TEST_TEAMS_EMAIL,
        "morning_time_utc": MORNING_TIME_UTC,
        "pm_report_time_utc": PM_REPORT_TIME_UTC,
        "evening_time_utc": EVENING_TIME_UTC,
        "directors_report_time_utc": DIRECTORS_REPORT_TIME_UTC,
        "morning_time_ist": utc_to_ist_str(MORNING_TIME_UTC),
        "pm_report_time_ist": utc_to_ist_str(PM_REPORT_TIME_UTC),
        "evening_time_ist": utc_to_ist_str(EVENING_TIME_UTC),
        "directors_report_time_ist": utc_to_ist_str(DIRECTORS_REPORT_TIME_UTC),
        "reply_poll_minutes": REPLY_POLL_MINUTES,
        "new_task_check_minutes": NEW_TASK_CHECK_MINUTES,
        "pm_email": PM_EMAIL,
        "directors_email": DIRECTORS_EMAIL,
    }


@app.post("/config")
def update_config(payload: ConfigUpdate, current_user: dict = Depends(_require_admin)):
    global TEST_MODE_TEAMS, TEST_MODE_PM, TEST_MODE_DIRECTORS, TEST_TEAMS_EMAIL, MORNING_TIME_UTC, PM_REPORT_TIME_UTC, EVENING_TIME_UTC, DIRECTORS_REPORT_TIME_UTC, REPLY_POLL_MINUTES, NEW_TASK_CHECK_MINUTES, PM_EMAIL, DIRECTORS_EMAIL
    if payload.test_mode_teams is not None:
        TEST_MODE_TEAMS = payload.test_mode_teams
        update_env_file("TEST_MODE_TEAMS", str(TEST_MODE_TEAMS))
    if payload.test_mode_pm is not None:
        TEST_MODE_PM = payload.test_mode_pm
        update_env_file("TEST_MODE_PM", str(TEST_MODE_PM))
    if payload.test_mode_directors is not None:
        TEST_MODE_DIRECTORS = payload.test_mode_directors
        update_env_file("TEST_MODE_DIRECTORS", str(TEST_MODE_DIRECTORS))
    if payload.test_teams_email is not None:
        TEST_TEAMS_EMAIL = payload.test_teams_email
        update_env_file("TEST_TEAMS_EMAIL", TEST_TEAMS_EMAIL)
    if payload.morning_time_utc is not None:
        if not re.match(r"^\d{2}:\d{2}$", payload.morning_time_utc):
            raise HTTPException(400, "Morning time must be in HH:MM format")
        MORNING_TIME_UTC = payload.morning_time_utc
        update_env_file("MORNING_REMINDER_TIME_UTC", MORNING_TIME_UTC)
    if payload.pm_report_time_utc is not None:
        if not re.match(r"^\d{2}:\d{2}$", payload.pm_report_time_utc):
            raise HTTPException(400, "PM report time must be in HH:MM format")
        PM_REPORT_TIME_UTC = payload.pm_report_time_utc
        update_env_file("PM_REPORT_TIME_UTC", PM_REPORT_TIME_UTC)
    if payload.evening_time_utc is not None:
        if not re.match(r"^\d{2}:\d{2}$", payload.evening_time_utc):
            raise HTTPException(400, "Evening time must be in HH:MM format")
        EVENING_TIME_UTC = payload.evening_time_utc
        update_env_file("EVENING_REMINDER_TIME_UTC", EVENING_TIME_UTC)
    if payload.directors_report_time_utc is not None:
        if not re.match(r"^\d{2}:\d{2}$", payload.directors_report_time_utc):
            raise HTTPException(400, "PM EOD report time must be in HH:MM format")
        DIRECTORS_REPORT_TIME_UTC = payload.directors_report_time_utc
        update_env_file("DIRECTORS_REPORT_TIME_UTC", DIRECTORS_REPORT_TIME_UTC)
    if payload.reply_poll_minutes is not None:
        REPLY_POLL_MINUTES = payload.reply_poll_minutes
        update_env_file("REPLY_POLL_MINUTES", str(REPLY_POLL_MINUTES))
    if payload.new_task_check_minutes is not None:
        NEW_TASK_CHECK_MINUTES = payload.new_task_check_minutes
        update_env_file("NEW_TASK_CHECK_MINUTES", str(NEW_TASK_CHECK_MINUTES))
    if payload.pm_email is not None:
        PM_EMAIL = payload.pm_email
        update_env_file("PM_EMAIL", PM_EMAIL)
    if payload.directors_email is not None:
        DIRECTORS_EMAIL = payload.directors_email
        update_env_file("DIRECTORS_EMAIL", DIRECTORS_EMAIL)
    
    _reschedule_jobs()
    
    return {
        "status": "ok",
        "config": get_config()
    }

# Force reload

# Final clean reload