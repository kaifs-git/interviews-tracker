from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from ..dependencies import get_db, get_current_user
from .. import models, schemas
from ..models import AgentActivityLog, EmailAccount
from ..services.settings_service import get_all_settings, get_setting, set_setting
from ..services.scheduler import update_scheduler_interval

router = APIRouter(prefix="/api/admin", tags=["admin"])

SENSITIVE_KEYS = {"gemini_api_key", "anthropic_api_key", "openai_api_key", "google_client_secret", "vapid_private_key"}
ALLOWED_SETTING_KEYS = {
    "ai_provider",
    "ai_model",
    "gemini_api_key",
    "anthropic_api_key",
    "openai_api_key",
    "google_client_id",
    "google_client_secret",
    "google_redirect_uri",
    "email_polling_interval_minutes",
    "vapid_subscriber_email",
}


def require_admin(
    current_user: models.User = Depends(get_current_user),
) -> models.User:
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


@router.get("/users", response_model=List[schemas.UserAdmin])
def list_users(
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    return db.query(models.User).order_by(models.User.created_at.desc()).all()


@router.get("/users/pending/count")
def pending_count(
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    count = db.query(models.User).filter(
        models.User.is_approved == False,
        models.User.is_active == True,
    ).count()
    return {"count": count}


@router.post("/users/{user_id}/approve")
def approve_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot modify yourself here")
    user.is_approved = True
    user.is_active = True
    db.commit()
    return {"message": f"User '{user.username}' approved"}


@router.post("/users/{user_id}/reject")
def reject_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot modify yourself")
    user.is_approved = False
    user.is_active = False
    db.commit()
    return {"message": f"User '{user.username}' rejected"}


@router.post("/users/{user_id}/toggle-active")
def toggle_active(
    user_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")
    user.is_active = not user.is_active
    db.commit()
    return {"message": "Updated", "is_active": user.is_active}


@router.delete("/users/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    db.delete(user)
    db.commit()


# ── System Settings ────────────────────────────────────────────────────────────

@router.get("/settings")
def get_settings(
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
) -> Dict[str, Any]:
    """Return all system settings. Sensitive values are masked."""
    all_settings = get_all_settings(db)
    masked = {}
    for key, value in all_settings.items():
        if key in SENSITIVE_KEYS and value:
            masked[key] = "***" + value[-4:] if len(value) > 4 else "****"
        else:
            masked[key] = value
    return masked


@router.put("/settings")
def update_settings(
    body: Dict[str, Any],
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    """Update system settings. Only allowed keys are accepted."""
    updated = []
    for key, value in body.items():
        if key not in ALLOWED_SETTING_KEYS:
            raise HTTPException(
                status_code=400,
                detail=f"Setting key '{key}' is not allowed",
            )
        set_setting(db, key, str(value) if value is not None else None)
        updated.append(key)

    # If polling interval changed, reschedule
    if "email_polling_interval_minutes" in body:
        try:
            minutes = int(body["email_polling_interval_minutes"])
            update_scheduler_interval(minutes)
        except (ValueError, TypeError):
            pass

    return {"updated": updated}


# ── Agent Stats ────────────────────────────────────────────────────────────────

@router.get("/agent-stats")
def get_agent_stats(
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    """Return aggregate counts of agent activity across all users."""
    base = db.query(AgentActivityLog)
    total = base.count()
    created_applications = base.filter(AgentActivityLog.action_type == "create_application").count()
    created_interviews = base.filter(AgentActivityLog.action_type == "create_interview_round").count()
    created_contacts = base.filter(AgentActivityLog.action_type == "create_contact").count()
    flagged = base.filter(AgentActivityLog.action_type == "flagged").count()
    errors = base.filter(AgentActivityLog.status == "error").count()
    skipped = base.filter(AgentActivityLog.action_type == "skipped").count()

    return {
        "total_processed": total,
        "created_applications": created_applications,
        "created_interviews": created_interviews,
        "created_contacts": created_contacts,
        "flagged": flagged,
        "errors": errors,
        "skipped": skipped,
    }


# ── Diagnostics ────────────────────────────────────────────────────────────────

@router.get("/diagnostics")
def get_diagnostics(
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    """Return diagnostic info: AI config, email accounts, recent activity log."""
    provider = get_setting(db, "ai_provider") or "gemini"
    key_map = {"gemini": "gemini_api_key", "anthropic": "anthropic_api_key", "openai": "openai_api_key"}
    api_key = get_setting(db, key_map.get(provider, "gemini_api_key")) or ""

    accounts = db.query(EmailAccount).all()
    accounts_out = []
    for a in accounts:
        user = db.query(models.User).filter_by(id=a.user_id).first()
        accounts_out.append({
            "id": a.id,
            "user_id": a.user_id,
            "username": user.username if user else "?",
            "email_address": a.email_address,
            "provider": a.provider,
            "is_active": a.is_active,
            "last_synced_at": a.last_synced_at.isoformat() if a.last_synced_at else None,
        })

    recent_logs = (
        db.query(AgentActivityLog)
        .order_by(AgentActivityLog.created_at.desc())
        .limit(30)
        .all()
    )
    logs_out = []
    for log in recent_logs:
        user = db.query(models.User).filter_by(id=log.user_id).first()
        logs_out.append({
            "id": log.id,
            "username": user.username if user else "?",
            "action_type": log.action_type,
            "status": log.status,
            "summary": log.summary,
            "email_subject": log.email_subject,
            "email_from": log.email_from,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        })

    return {
        "ai": {
            "provider": provider,
            "model": get_setting(db, "ai_model") or f"default ({provider})",
            "key_configured": bool(api_key),
            "key_preview": ("***" + api_key[-4:]) if len(api_key) > 4 else ("set" if api_key else "NOT SET"),
        },
        "polling_interval_minutes": int(get_setting(db, "email_polling_interval_minutes") or 15),
        "google_client_configured": bool(get_setting(db, "google_client_id")),
        "email_accounts": accounts_out,
        "recent_activity": logs_out,
    }


@router.post("/debug-sync")
def debug_sync(
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    """Run email sync for ALL users and return detailed per-account results."""
    from ..models import EmailAccount
    from ..services.scheduler import _sync_account, _get_interval

    since_minutes = _get_interval(db)
    accounts = db.query(EmailAccount).filter_by(is_active=True).all()

    results = []
    for account in accounts:
        user = db.query(models.User).filter_by(id=account.user_id).first()
        entry = {
            "account": account.email_address,
            "user": user.username if user else "?",
            "since_minutes": since_minutes,
        }
        try:
            r = _sync_account(db, account, since_minutes)
            entry.update({"ok": True, **r})
        except Exception as e:
            entry.update({"ok": False, "error": str(e)})
        results.append(entry)

    return {"since_minutes": since_minutes, "accounts": results}
