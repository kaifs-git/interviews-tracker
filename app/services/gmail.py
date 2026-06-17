import logging
import base64
import re
import urllib.parse
import requests as _requests
from datetime import datetime, timedelta, timezone
from typing import Optional

logger = logging.getLogger(__name__)

GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]
DEFAULT_REDIRECT_URI = "http://localhost:8000/api/email/callback/gmail"
_GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
_GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"


def get_gmail_auth_url(db, state: str) -> str:
    """Build the Google OAuth2 authorization URL without PKCE (stateless-safe)."""
    from .settings_service import get_setting

    client_id = get_setting(db, "google_client_id")
    client_secret = get_setting(db, "google_client_secret")
    redirect_uri = get_setting(db, "google_redirect_uri", DEFAULT_REDIRECT_URI)

    if not client_id or not client_secret:
        raise ValueError("Google OAuth credentials not configured in system settings")

    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": " ".join(GMAIL_SCOPES),
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
        "include_granted_scopes": "true",
    }
    return _GOOGLE_AUTH_URL + "?" + urllib.parse.urlencode(params)


def exchange_code(db, code: str, state: str) -> dict:
    """
    Exchange an authorization code for tokens via a direct POST (no PKCE).
    Returns access_token, refresh_token, expiry, email.
    """
    from .settings_service import get_setting

    client_id = get_setting(db, "google_client_id")
    client_secret = get_setting(db, "google_client_secret")
    redirect_uri = get_setting(db, "google_redirect_uri", DEFAULT_REDIRECT_URI)

    resp = _requests.post(
        _GOOGLE_TOKEN_URL,
        data={
            "code": code,
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        },
    )
    resp.raise_for_status()
    token_data = resp.json()

    access_token = token_data["access_token"]
    refresh_token = token_data.get("refresh_token")

    expiry = None
    expires_in = token_data.get("expires_in")
    if expires_in:
        expiry = datetime.utcnow() + timedelta(seconds=int(expires_in))

    from google.oauth2.credentials import Credentials
    creds = Credentials(
        token=access_token,
        refresh_token=refresh_token,
        token_uri=_GOOGLE_TOKEN_URL,
        client_id=client_id,
        client_secret=client_secret,
        scopes=GMAIL_SCOPES,
    )
    email = _get_email_from_credentials(creds)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "expiry": expiry,
        "email": email,
    }


def _get_email_from_credentials(credentials) -> str:
    """Fetch the authenticated user's email address via the userinfo endpoint."""
    try:
        import google.auth.transport.requests
        import googleapiclient.discovery

        service = googleapiclient.discovery.build(
            "oauth2", "v2",
            credentials=credentials,
            cache_discovery=False,
        )
        info = service.userinfo().get().execute()
        return info.get("email", "")
    except Exception as e:
        logger.warning(f"Could not fetch email from credentials: {e}")
        return ""


def refresh_access_token(refresh_token: str) -> dict:
    """Refresh an access token using a refresh token."""
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request

    creds = Credentials(
        token=None,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
    )
    creds.refresh(Request())

    expiry = creds.expiry
    if expiry and expiry.tzinfo is not None:
        expiry = expiry.replace(tzinfo=None)

    return {
        "access_token": creds.token,
        "expiry": expiry,
    }


def refresh_access_token_if_needed(refresh_token: str) -> dict:
    """Alias used by the scheduler."""
    return refresh_access_token(refresh_token)


def _strip_html(html: str) -> str:
    """Remove HTML tags and decode basic entities."""
    text = re.sub(r"<[^>]+>", " ", html)
    text = text.replace("&nbsp;", " ").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _decode_body(data: str) -> str:
    """Base64url-decode a Gmail message body part."""
    padded = data + "=" * (4 - len(data) % 4)
    try:
        return base64.urlsafe_b64decode(padded).decode("utf-8", errors="replace")
    except Exception:
        return ""


def _extract_body(payload: dict) -> str:
    """Recursively extract the best text body from a Gmail message payload."""
    mime_type = payload.get("mimeType", "")
    body_data = payload.get("body", {}).get("data", "")

    if mime_type == "text/plain" and body_data:
        return _decode_body(body_data)

    if mime_type == "text/html" and body_data:
        return _strip_html(_decode_body(body_data))

    parts = payload.get("parts", [])
    # Prefer text/plain part
    for part in parts:
        if part.get("mimeType") == "text/plain":
            data = part.get("body", {}).get("data", "")
            if data:
                return _decode_body(data)
    # Fall back to text/html
    for part in parts:
        if part.get("mimeType") == "text/html":
            data = part.get("body", {}).get("data", "")
            if data:
                return _strip_html(_decode_body(data))
    # Recurse into multipart parts
    for part in parts:
        result = _extract_body(part)
        if result:
            return result
    return ""


def _parse_email_address(raw: str) -> tuple[str, str]:
    """Parse 'Name <email>' into (name, email)."""
    match = re.match(r"^(.*?)\s*<([^>]+)>\s*$", raw.strip())
    if match:
        return match.group(1).strip().strip('"'), match.group(2).strip()
    # No angle brackets — treat the whole thing as email
    return "", raw.strip()


def _parse_date(date_str: str) -> Optional[datetime]:
    """Parse an RFC 2822 or similar date string into a datetime."""
    if not date_str:
        return None
    from email.utils import parsedate_to_datetime
    try:
        dt = parsedate_to_datetime(date_str)
        if dt.tzinfo is not None:
            dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
        return dt
    except Exception:
        return None


def _build_gmail_service(access_token: str, refresh_token: str):
    """Build an authenticated Gmail API service."""
    from google.oauth2.credentials import Credentials
    import googleapiclient.discovery

    creds = Credentials(
        token=access_token,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        scopes=GMAIL_SCOPES,
    )
    service = googleapiclient.discovery.build(
        "gmail", "v1",
        credentials=creds,
        cache_discovery=False,
    )
    return service


def fetch_new_emails(
    access_token: str,
    refresh_token: str,
    last_history_id: str = None,
    max_results: int = 20,
) -> dict:
    """
    Fetch new emails via Gmail API.

    Returns:
        {
            "emails": [list of email dicts],
            "new_history_id": "string or None"
        }
    Each email dict has: message_id, subject, from_email, from_name, date, body
    """
    service = _build_gmail_service(access_token, refresh_token)
    message_ids = []
    new_history_id = last_history_id

    if last_history_id:
        # Incremental sync via history list
        try:
            history_response = (
                service.users()
                .history()
                .list(
                    userId="me",
                    startHistoryId=last_history_id,
                    historyTypes=["messageAdded"],
                    maxResults=max_results,
                )
                .execute()
            )
            new_history_id = history_response.get("historyId", last_history_id)
            for history_item in history_response.get("history", []):
                for msg_added in history_item.get("messagesAdded", []):
                    msg_id = msg_added.get("message", {}).get("id")
                    if msg_id and msg_id not in message_ids:
                        message_ids.append(msg_id)
        except Exception as e:
            logger.warning(f"History sync failed (falling back to initial sync): {e}")
            last_history_id = None

    if not last_history_id:
        # Initial sync — fetch recent unread emails
        list_response = (
            service.users()
            .messages()
            .list(
                userId="me",
                q="is:unread newer_than:1d",
                maxResults=max_results,
            )
            .execute()
        )
        new_history_id = list_response.get("historyId", new_history_id)
        for msg in list_response.get("messages", []):
            msg_id = msg.get("id")
            if msg_id and msg_id not in message_ids:
                message_ids.append(msg_id)

    emails = []
    for msg_id in message_ids:
        try:
            full_msg = (
                service.users()
                .messages()
                .get(userId="me", id=msg_id, format="full")
                .execute()
            )
            email_dict = _parse_message(full_msg)
            emails.append(email_dict)
        except Exception as e:
            logger.warning(f"Could not fetch message {msg_id}: {e}")

    return {
        "emails": emails,
        "new_history_id": new_history_id,
    }


def _parse_message(message: dict) -> dict:
    """Parse a raw Gmail message into a clean dict."""
    payload = message.get("payload", {})
    headers = {h["name"].lower(): h["value"] for h in payload.get("headers", [])}

    subject = headers.get("subject", "(no subject)")
    raw_from = headers.get("from", "")
    date_str = headers.get("date", "")

    from_name, from_email = _parse_email_address(raw_from)
    parsed_date = _parse_date(date_str)

    body = _extract_body(payload)

    return {
        "message_id": message.get("id", ""),
        "subject": subject,
        "from_email": from_email,
        "from_name": from_name,
        "date": parsed_date,
        "body": body[:3000],
    }
