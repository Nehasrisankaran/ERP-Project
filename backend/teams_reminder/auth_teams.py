import os
import sys
import stat
import logging
import atexit
from pathlib import Path
import msal

logger = logging.getLogger("teams_auth")

# ---- Configuration -------------------------------------------------

TENANT_ID = os.environ.get("TEAMS_TENANT_ID", os.environ.get("SHAREPOINT_TENANT_ID", ""))
CLIENT_ID = os.environ.get("TEAMS_CLIENT_ID", os.environ.get("SHAREPOINT_CLIENT_ID", ""))

if not TENANT_ID or not CLIENT_ID:
    try:
        from dotenv import load_dotenv
        load_dotenv(override=True)
        TENANT_ID = os.environ.get("TEAMS_TENANT_ID", os.environ.get("SHAREPOINT_TENANT_ID", ""))
        CLIENT_ID = os.environ.get("TEAMS_CLIENT_ID", os.environ.get("SHAREPOINT_CLIENT_ID", ""))
    except ImportError:
        pass

AUTHORITY = f"https://login.microsoftonline.com/{TENANT_ID}"

# Least-privilege scopes for what the agent actually does:
# sending DMs, creating 1:1 chats, reading replies, resolving user IDs.
SCOPES = [
    "https://graph.microsoft.com/Chat.ReadWrite",
    "https://graph.microsoft.com/ChatMessage.Send",
    "https://graph.microsoft.com/Chat.Create",
    "https://graph.microsoft.com/User.Read",
]

CACHE_PATH = Path(os.environ.get("TEAMS_TOKEN_CACHE_PATH", Path(__file__).parent / "token_cache.bin"))


# ---- Persistent cache handling --------------------------------------

def _load_cache() -> msal.SerializableTokenCache:
    cache = msal.SerializableTokenCache()
    if CACHE_PATH.exists():
        try:
            cache.deserialize(CACHE_PATH.read_text(encoding="utf-8"))
        except Exception as e:
            logger.error("Failed to load token cache: %s", e)
    return cache


def _save_cache(cache: msal.SerializableTokenCache) -> None:
    if not cache.has_state_changed:
        return
    try:
        CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
        CACHE_PATH.write_text(cache.serialize(), encoding="utf-8")
        try:
            os.chmod(CACHE_PATH, stat.S_IRUSR | stat.S_IWUSR)
        except Exception:
            pass  # Windows might not support owner-only chmod easily
    except Exception as e:
        logger.error("Failed to save token cache: %s", e)


_cache = _load_cache()
_app = None

if (TENANT_ID and CLIENT_ID and 
    "your-azure" not in TENANT_ID.lower() and 
    "your-azure" not in CLIENT_ID.lower()):
    try:
        _app = msal.PublicClientApplication(
            client_id=CLIENT_ID,
            authority=AUTHORITY,
            token_cache=_cache,
        )
    except Exception as e:
        logger.error("Failed to initialize MSAL PublicClientApplication: %s", e)
atexit.register(lambda: _save_cache(_cache) if _cache else None)


# ---- Alerting hook ----------------------------------------------------

def _alert_reauth_needed(reason: str) -> None:
    logger.error("TEAMS AUTH NEEDS RE-LOGIN: %s", reason)
    try:
        import psycopg2
        from datetime import datetime
        db_url = os.environ.get("DATABASE_URL", "postgresql+psycopg2://postgres:postgres@localhost:5431/dbnamehere")
        if db_url and "postgresql+psycopg2://" in db_url:
            db_url = db_url.replace("postgresql+psycopg2://", "postgresql://")
        
        con = None
        if db_url:
            con = psycopg2.connect(db_url)
        else:
            con = psycopg2.connect(
                host=os.environ.get("DB_HOST", "localhost"),
                port=os.environ.get("DB_PORT", "5431"),
                user=os.environ.get("DB_USER", "postgres"),
                password=os.environ.get("DB_PASSWORD", "postgres"),
                database=os.environ.get("DB_NAME", "dbnamehere")
            )
            
        cur = con.cursor()
        now = datetime.now().isoformat(timespec="seconds")
        cur.execute(
            "INSERT INTO activity_log (timestamp, event, detail) VALUES (%s, %s, %s)",
            (now, "AUTH RE-LOGIN REQUIRED", reason)
        )
        con.commit()
        cur.close()
        con.close()
    except Exception as e:
        logger.warning("Failed logging auth alert: %s", e)
        pass


# ---- Public API ---------------------------------------------------------

def get_graph_token() -> str:
    """
    Returns a valid access token for Graph calls, silently refreshing
    from the cached refresh token. Raises RuntimeError if interactive
    re-login is required.
    """
    if not _app:
        raise RuntimeError(
            "MSAL PublicClientApplication is not initialized. "
            "Please check that SHAREPOINT_TENANT_ID and SHAREPOINT_CLIENT_ID are correctly configured in your .env file."
        )
    accounts = _app.get_accounts()
    if accounts:
        result = _app.acquire_token_silent(SCOPES, account=accounts[0])
        if result and "access_token" in result:
            _save_cache(_cache)
            return result["access_token"]

    _alert_reauth_needed(
        "No valid cached session for pmagent@fanamdigital.com. "
        "Run `python auth_teams.py` interactively to re-authenticate."
    )
    raise RuntimeError(
        "Teams auth requires interactive re-login (device code flow). "
        "Please run `python auth_teams.py` in your terminal to login."
    )


def interactive_login() -> None:
    """
    Run this once, by hand, to bootstrap (or repair) the token cache.
    """
    print("Initiating Microsoft Teams device code flow...")
    print(f"Tenant ID: {TENANT_ID}")
    print(f"Client ID: {CLIENT_ID}")
    
    if not _app:
        raise RuntimeError(
            "MSAL PublicClientApplication is not initialized. "
            "Please check that SHAREPOINT_TENANT_ID and SHAREPOINT_CLIENT_ID are correctly configured in your .env file."
        )
    flow = _app.initiate_device_flow(scopes=SCOPES)
    if "user_code" not in flow:
        raise RuntimeError(f"Failed to create device flow: {flow}")

    print("\n" + "="*80)
    print(flow["message"])
    print("="*80 + "\n")
    sys.stdout.flush()

    result = _app.acquire_token_by_device_flow(flow)
    if "access_token" not in result:
        raise RuntimeError(f"Device flow login failed: {result.get('error_description')}")

    _save_cache(_cache)
    print(f"\nLogin succeeded for {result.get('id_token_claims', {}).get('preferred_username', 'pmagent')}.")
    print(f"Token cache saved to {CACHE_PATH.resolve()}")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    interactive_login()
