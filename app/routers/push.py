from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

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
async def subscribe_push(
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    try:
        body = await request.json()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON body: {e}")

    endpoint = body.get("endpoint")
    # Accept both flat {p256dh, auth} and nested {keys: {p256dh, auth}} (sub.toJSON() format)
    keys     = body.get("keys") or {}
    p256dh   = body.get("p256dh") or keys.get("p256dh")
    auth     = body.get("auth")   or keys.get("auth")

    missing = [f for f, v in [("endpoint", endpoint), ("p256dh", p256dh), ("auth", auth)] if not v]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Missing fields: {', '.join(missing)}. Received keys: {list(body.keys())}",
        )

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
async def unsubscribe_push(
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    try:
        body = await request.json()
    except Exception:
        body = {}
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
