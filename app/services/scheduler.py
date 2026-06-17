import logging
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import EmailAccount
from .settings_service import get_setting
from .gmail import fetch_new_emails, refresh_access_token_if_needed
from .email_agent import process_email_for_user

logger = logging.getLogger(__name__)

DEFAULT_INTERVAL = 15


def _get_interval(db: Session) -> int:
    """Return the configured polling interval in minutes."""
    try:
        return int(get_setting(db, "email_polling_interval_minutes") or DEFAULT_INTERVAL)
    except (ValueError, TypeError):
        return DEFAULT_INTERVAL


def run_email_sync_for_all_users():
    """Sync all active email accounts using the configured polling interval."""
    db: Session = SessionLocal()
    try:
        since_minutes = _get_interval(db)
        accounts = db.query(EmailAccount).filter_by(is_active=True).all()
        logger.info("Running email sync: %d accounts, window=%d min", len(accounts), since_minutes)
        for account in accounts:
            try:
                _sync_account(db, account, since_minutes)
            except Exception as e:
                logger.error("Error syncing account %s: %s", account.email_address, e)
    finally:
        db.close()


def _sync_account(db: Session, account: EmailAccount, since_minutes: int) -> dict:
    """Fetch emails from the last `since_minutes` minutes and process new ones."""
    # Refresh token if close to expiry
    if account.token_expiry and account.token_expiry < datetime.utcnow() + timedelta(minutes=5):
        tokens = refresh_access_token_if_needed(account.refresh_token)
        account.access_token = tokens["access_token"]
        account.token_expiry = tokens["expiry"]
        db.commit()

    emails = fetch_new_emails(
        access_token=account.access_token,
        refresh_token=account.refresh_token,
        since_minutes=since_minutes,
    )

    logger.info("Account %s: %d emails in last %d min", account.email_address, len(emails), since_minutes)
    new_count = 0
    for email in emails:
        result = process_email_for_user(db, account.user_id, account, email)
        if result is not None:
            new_count += 1

    account.last_synced_at = datetime.utcnow()
    db.commit()
    return {"emails_found": len(emails), "emails_new": new_count}


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
