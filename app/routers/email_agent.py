import json
import logging
import os
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..dependencies import get_db, get_current_user
from .. import models
from ..models import (
    EmailAccount,
    AgentActivityLog,
    PushSubscription,
    JobApplication,
    InterviewRound,
    Contact,
)
from ..services.settings_service import get_setting
from ..services.gmail import get_gmail_auth_url, exchange_code
from ..services.scheduler import run_email_sync_for_all_users, _sync_account

logger = logging.getLogger(__name__)

router = APIRouter(tags=["email-agent"])


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class PushSubscribeBody(BaseModel):
    endpoint: str
    keys: dict  # {p256dh: str, auth: str}
    user_agent: Optional[str] = None


class PushUnsubscribeBody(BaseModel):
    endpoint: str


# ── Email settings ─────────────────────────────────────────────────────────────

@router.get("/api/email/settings")
def get_email_settings(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Return non-sensitive flags about configured integrations."""
    client_id = get_setting(db, "google_client_id")
    anthropic_key = get_setting(db, "anthropic_api_key")
    redirect_uri = get_setting(db, "google_redirect_uri", "http://localhost:8000/api/email/callback/gmail")
    return {
        "google_client_id_set": bool(client_id),
        "anthropic_api_key_set": bool(anthropic_key),
        "redirect_uri": redirect_uri,
    }


# ── Email accounts ─────────────────────────────────────────────────────────────

@router.get("/api/email/accounts")
def list_email_accounts(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """List all connected email accounts for the current user."""
    accounts = (
        db.query(EmailAccount)
        .filter_by(user_id=current_user.id)
        .all()
    )
    return [
        {
            "id": a.id,
            "provider": a.provider,
            "email_address": a.email_address,
            "last_synced_at": a.last_synced_at,
            "is_active": a.is_active,
            "created_at": a.created_at,
        }
        for a in accounts
    ]


@router.delete("/api/email/accounts/{account_id}", status_code=204)
def delete_email_account(
    account_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Deactivate/delete a connected email account."""
    account = (
        db.query(EmailAccount)
        .filter_by(id=account_id, user_id=current_user.id)
        .first()
    )
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    db.delete(account)
    db.commit()


# ── OAuth flow ─────────────────────────────────────────────────────────────────

@router.get("/api/email/auth/gmail")
def gmail_auth_redirect(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Return the Google OAuth2 URL that the frontend should redirect to."""
    state = str(current_user.id)
    try:
        url = get_gmail_auth_url(db, state=state)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"auth_url": url}


@router.get("/api/email/callback/gmail")
def gmail_oauth_callback(
    state: str,
    code: str = None,
    error: str = None,
    db: Session = Depends(get_db),
):
    """
    OAuth callback endpoint. Exchanges the auth code for tokens and saves the
    EmailAccount record, then redirects the browser to the settings page.
    Handles cancellation gracefully when Google returns error instead of code.
    """
    if error or not code:
        return RedirectResponse(url="/?page=settings&gmail=cancelled", status_code=302)

    try:
        user_id = int(state)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid state parameter")

    user = db.query(models.User).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        token_data = exchange_code(db, code=code, state=state)
    except Exception as e:
        logger.error(f"Gmail OAuth exchange failed: {e}")
        raise HTTPException(status_code=400, detail=f"OAuth exchange failed: {e}")

    email_address = token_data.get("email", "")

    # Upsert: if account already exists for this email+user, update tokens
    existing = (
        db.query(EmailAccount)
        .filter_by(user_id=user_id, email_address=email_address)
        .first()
    )
    if existing:
        existing.access_token = token_data["access_token"]
        existing.refresh_token = token_data.get("refresh_token") or existing.refresh_token
        existing.token_expiry = token_data.get("expiry")
        existing.is_active = True
    else:
        account = EmailAccount(
            user_id=user_id,
            provider="gmail",
            email_address=email_address,
            access_token=token_data["access_token"],
            refresh_token=token_data.get("refresh_token"),
            token_expiry=token_data.get("expiry"),
            is_active=True,
        )
        db.add(account)

    db.commit()
    return RedirectResponse(url="/?page=settings&gmail=connected", status_code=302)


# ── Manual sync ────────────────────────────────────────────────────────────────

@router.post("/api/email/sync")
def trigger_email_sync(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Manually trigger email sync for all accounts belonging to the current user.
    Also works as a serverless cron target.
    """
    accounts = (
        db.query(EmailAccount)
        .filter_by(user_id=current_user.id, is_active=True)
        .all()
    )
    synced = 0
    errors = []
    for account in accounts:
        try:
            _sync_account(db, account)
            synced += 1
        except Exception as e:
            errors.append({"account_id": account.id, "error": str(e)})

    return {"synced": synced, "errors": errors}


# ── Vercel Cron endpoint ───────────────────────────────────────────────────────

@router.get("/api/cron/email-sync")
def cron_email_sync(request: Request):
    """
    Called by Vercel Cron Jobs on a schedule to sync all users' inboxes.
    Protected by CRON_SECRET env var (Vercel sets Authorization: Bearer <secret>).
    """
    cron_secret = os.environ.get("CRON_SECRET", "")
    if cron_secret:
        auth = request.headers.get("authorization", "")
        if auth != f"Bearer {cron_secret}":
            raise HTTPException(status_code=401, detail="Unauthorized")
    run_email_sync_for_all_users()
    return {"ok": True}


# ── Agent activity log ─────────────────────────────────────────────────────────

@router.get("/api/agent/activity")
def get_agent_activity(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    action_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Paginated agent activity log for the current user."""
    query = db.query(AgentActivityLog).filter_by(user_id=current_user.id)
    if action_type:
        query = query.filter(AgentActivityLog.action_type == action_type)
    total = query.count()
    logs = (
        query.order_by(AgentActivityLog.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "items": [
            {
                "id": l.id,
                "email_subject": l.email_subject,
                "email_from": l.email_from,
                "email_date": l.email_date,
                "action_type": l.action_type,
                "entity_type": l.entity_type,
                "entity_id": l.entity_id,
                "confidence": l.confidence,
                "summary": l.summary,
                "status": l.status,
                "created_at": l.created_at,
            }
            for l in logs
        ],
    }


@router.post("/api/agent/activity/{log_id}/undo")
def undo_agent_action(
    log_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Undo an agent action: delete the created entity and mark the log as 'undone'."""
    log = (
        db.query(AgentActivityLog)
        .filter_by(id=log_id, user_id=current_user.id)
        .first()
    )
    if not log:
        raise HTTPException(status_code=404, detail="Activity log not found")
    if log.status == "undone":
        raise HTTPException(status_code=400, detail="Already undone")

    deleted = False
    if log.entity_type == "application" and log.entity_id:
        entity = db.query(JobApplication).filter_by(
            id=log.entity_id, user_id=current_user.id
        ).first()
        if entity:
            db.delete(entity)
            deleted = True
    elif log.entity_type == "interview" and log.entity_id:
        entity = db.query(InterviewRound).filter_by(
            id=log.entity_id, user_id=current_user.id
        ).first()
        if entity:
            db.delete(entity)
            deleted = True
    elif log.entity_type == "contact" and log.entity_id:
        entity = db.query(Contact).filter_by(
            id=log.entity_id, user_id=current_user.id
        ).first()
        if entity:
            db.delete(entity)
            deleted = True

    log.status = "undone"
    db.commit()
    return {"undone": True, "entity_deleted": deleted}


# ── Web Push ───────────────────────────────────────────────────────────────────

@router.get("/api/push/vapid-public-key")
def get_vapid_public_key(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Return the VAPID public key for frontend subscription setup."""
    public_key = get_setting(db, "vapid_public_key")
    if not public_key:
        raise HTTPException(status_code=503, detail="VAPID keys not configured")
    return {"public_key": public_key}


@router.post("/api/push/subscribe", status_code=201)
def push_subscribe(
    body: PushSubscribeBody,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Save a push subscription for the current user."""
    p256dh = body.keys.get("p256dh", "")
    auth = body.keys.get("auth", "")

    if not p256dh or not auth:
        raise HTTPException(status_code=400, detail="Missing p256dh or auth keys")

    existing = db.query(PushSubscription).filter_by(endpoint=body.endpoint).first()
    if existing:
        # Update in case keys changed
        existing.p256dh = p256dh
        existing.auth = auth
        existing.user_agent = body.user_agent
    else:
        sub = PushSubscription(
            user_id=current_user.id,
            endpoint=body.endpoint,
            p256dh=p256dh,
            auth=auth,
            user_agent=body.user_agent,
        )
        db.add(sub)

    db.commit()
    return {"subscribed": True}


@router.delete("/api/push/unsubscribe", status_code=204)
def push_unsubscribe(
    body: PushUnsubscribeBody,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Remove a push subscription by endpoint."""
    sub = (
        db.query(PushSubscription)
        .filter_by(endpoint=body.endpoint, user_id=current_user.id)
        .first()
    )
    if sub:
        db.delete(sub)
        db.commit()
