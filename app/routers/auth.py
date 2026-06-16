import secrets
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse, JSONResponse
from sqlalchemy.orm import Session
from ..database import SessionLocal
from ..dependencies import get_db, get_current_user
from ..auth import get_google_auth_url, exchange_google_code, create_access_token
from .. import models, schemas
from ..config import settings

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/google")
async def google_login():
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=503,
            detail="Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env"
        )
    state = secrets.token_urlsafe(32)
    url = get_google_auth_url(state)
    return RedirectResponse(url=url)


@router.get("/google/callback")
async def google_callback(
    code: str = Query(...),
    state: str = Query(None),
    error: str = Query(None),
    db: Session = Depends(get_db),
):
    if error:
        return RedirectResponse(url=f"{settings.BASE_URL}/?error={error}")

    user_info = await exchange_google_code(code)
    if not user_info:
        return RedirectResponse(url=f"{settings.BASE_URL}/?error=google_auth_failed")

    google_id = user_info.get("sub")
    email = user_info.get("email")
    name = user_info.get("name")
    picture = user_info.get("picture")

    if not email:
        return RedirectResponse(url=f"{settings.BASE_URL}/?error=no_email")

    user = db.query(models.User).filter(models.User.google_id == google_id).first()
    if not user:
        user = db.query(models.User).filter(models.User.email == email).first()

    if user:
        user.google_id = google_id
        user.name = name
        user.picture = picture
        db.commit()
        db.refresh(user)
    else:
        user = models.User(
            google_id=google_id,
            email=email,
            name=name,
            picture=picture,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    token = create_access_token({"sub": str(user.id)})
    return RedirectResponse(url=f"{settings.BASE_URL}/?token={token}")


@router.get("/me", response_model=schemas.UserOut)
async def get_me(current_user: models.User = Depends(get_current_user)):
    return current_user


@router.get("/logout")
async def logout():
    return {"message": "Logged out successfully"}
