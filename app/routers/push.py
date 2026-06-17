from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Any, Dict

from ..dependencies import get_db, get_current_user
from .. import models
from ..models import PushSubscription
from ..services.settings_service import get_setting

router = APIRouter(prefix="/api/push", tags=["push"])


@router.get("/vapid-public-key")
def get_vapid_public_key(db: Session = Depends(get_db)):
    key = get_setting(db, "vapid_public_key")
    if not key:
        raise HTTPException(status_code=503, detail="VAPID keys not configured")
    return {"public_key": key}


@router.post("/subscribe", status_code=201)
def subscribe_push(
    body: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    endpoint = body.get("endpoint")
    p256dh = body.get("p256dh")
    auth = body.get("auth")
    if not endpoint or not p256dh or not auth:
        raise HTTPException(status_code=400, detail="endpoint, p256dh, and auth are required")

    existing = db.query(PushSubscription).filter_by(endpoint=endpoint).first()
    if existing:
        existing.p256dh = p256dh
        existing.auth = auth
        existing.user_id = current_user.id
        db.commit()
        return {"status": "updated"}

    sub = PushSubscription(
        user_id=current_user.id,
        endpoint=endpoint,
        p256dh=p256dh,
        auth=auth,
    )
    db.add(sub)
    db.commit()
    return {"status": "subscribed"}


@router.delete("/unsubscribe")
def unsubscribe_push(
    body: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    endpoint = body.get("endpoint")
    if not endpoint:
        raise HTTPException(status_code=400, detail="endpoint is required")

    deleted = (
        db.query(PushSubscription)
        .filter_by(user_id=current_user.id, endpoint=endpoint)
        .delete()
    )
    db.commit()
    return {"deleted": deleted}
