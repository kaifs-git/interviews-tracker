import json
import logging
from sqlalchemy.orm import Session

from ..models import PushSubscription
from .settings_service import get_setting

logger = logging.getLogger(__name__)


def send_push(db: Session, user_id: int, title: str, body: str, url: str = "/"):
    """Send a Web Push notification to all subscriptions for the given user."""
    subscriptions = db.query(PushSubscription).filter_by(user_id=user_id).all()
    if not subscriptions:
        return

    private_key = get_setting(db, "vapid_private_key")
    subscriber_email = get_setting(db, "vapid_subscriber_email", "admin@example.com")

    if not private_key:
        logger.warning("VAPID private key not configured; skipping push notifications")
        return

    try:
        from pywebpush import webpush, WebPushException
    except ImportError:
        logger.warning("pywebpush not installed; skipping push notifications")
        return

    payload = json.dumps({"title": title, "body": body, "url": url})
    to_delete = []

    for sub in subscriptions:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub.endpoint,
                    "keys": {
                        "p256dh": sub.p256dh,
                        "auth": sub.auth,
                    },
                },
                data=payload,
                vapid_private_key=private_key,
                vapid_claims={"sub": "mailto:" + subscriber_email},
            )
        except Exception as exc:
            # Check if it's a WebPushException with 404/410 (subscription expired/invalid)
            status_code = getattr(exc, "response", None)
            if status_code is not None:
                try:
                    code = exc.response.status_code
                    if code in (404, 410):
                        to_delete.append(sub)
                        continue
                except Exception:
                    pass
            # Also handle by checking exception class name to avoid hard import issues
            if "WebPushException" in type(exc).__name__:
                try:
                    if hasattr(exc, "response") and exc.response is not None:
                        if exc.response.status_code in (404, 410):
                            to_delete.append(sub)
                            continue
                except Exception:
                    pass
            logger.debug(f"Push notification failed for subscription {sub.id}: {exc}")

    for sub in to_delete:
        db.delete(sub)
    if to_delete:
        db.commit()
