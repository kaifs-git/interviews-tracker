import logging
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import EmailAccount
from .settings_service import get_setting
from .gmail import fetch_new_emails, refresh_access_token_if_needed
from .email_agent import process_email_for_user

logger = logging.getLogger(__name__)


def run_email_sync_for_all_users():
    """Sync all active email accounts."""
    db: Session = SessionLocal()
    try:
        accounts = db.query(EmailAccount).filter_by(is_active=True).all()
        for account in accounts:
            try:
                _sync_account(db, account)
            except Exception as e:
                logger.error(f"Error syncing account {account.id}: {e}")
    finally:
        db.close()


def _sync_account(db: Session, account: EmailAccount) -> dict:
    # Refresh token if needed
    if account.token_expiry and account.token_expiry < datetime.utcnow() + timedelta(minutes=5):
        tokens = refresh_access_token_if_needed(account.refresh_token)
        account.access_token = tokens["access_token"]
        account.token_expiry = tokens["expiry"]
        db.commit()

    result = fetch_new_emails(
        access_token=account.access_token,
        refresh_token=account.refresh_token,
        last_history_id=account.history_id,
        max_results=20,
    )

    emails = result["emails"]
    logger.info("Syncing account %s: found %d emails", account.email_address, len(emails))
    for email in emails:
        process_email_for_user(db, account.user_id, account, email)

    account.last_synced_at = datetime.utcnow()
    if result.get("new_history_id"):
        account.history_id = result["new_history_id"]
    db.commit()
    return {"emails_found": len(emails)}


_scheduler = None


def start_scheduler(interval_minutes: int = 15):
    global _scheduler
    try:
        from apscheduler.schedulers.background import BackgroundScheduler

        _scheduler = BackgroundScheduler()
        _scheduler.add_job(
            run_email_sync_for_all_users,
            "interval",
            minutes=interval_minutes,
            id="email_sync",
        )
        _scheduler.start()
        logger.info(f"Email sync scheduler started, interval={interval_minutes}min")
    except Exception as e:
        logger.warning(f"Scheduler not started: {e}")


def update_scheduler_interval(minutes: int):
    global _scheduler
    if _scheduler:
        try:
            _scheduler.reschedule_job("email_sync", trigger="interval", minutes=minutes)
        except Exception:
            pass
