from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..dependencies import get_db, get_current_user
from .. import models
from ..models import PushSubscription
from ..services.settings_service import get_setting

router = APIRouter(prefix="/api/push", tags=["push"])


class PushSubscribeBody(BaseModel):
    endpoint: str
    p256dh: str
    auth: str


class PushUnsubscribeBody(BaseModel):
    endpoint: str


@router.get("/vapid-public-key")
def get_vapid_public_key(db: Session = Depends(get_db)):
    key = get_setting(db, "vapid_public_key")
    if not key:
        raise HTTPException(status_code=503, detail="VAPID keys not configured")
    return {"public_key": key}


@router.post("/subscribe", status_code=201)
def subscribe_push(
    body: PushSubscribeBody,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    existing = db.query(PushSubscription).filter_by(endpoint=body.endpoint).first()
    if existing:
        existing.p256dh = body.p256dh
        existing.auth = body.auth
        existing.user_id = current_user.id
        db.commit()
        return {"status": "updated"}

    sub = PushSubscription(
        user_id=current_user.id,
        endpoint=body.endpoint,
        p256dh=body.p256dh,
        auth=body.auth,
    )
    db.add(sub)
    db.commit()
    return {"status": "subscribed"}


@router.delete("/unsubscribe")
def unsubscribe_push(
    body: PushUnsubscribeBody,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    deleted = (
        db.query(PushSubscription)
        .filter_by(user_id=current_user.id, endpoint=body.endpoint)
        .delete()
    )
    db.commit()
    return {"deleted": deleted}
