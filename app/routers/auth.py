import secrets
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from ..dependencies import get_db, get_current_user
from ..auth import (
    get_google_auth_url, exchange_google_code,
    create_access_token, hash_password, verify_password,
)
from .. import models, schemas
from ..config import settings

router = APIRouter(prefix="/auth", tags=["auth"])


# ─── Auth config (tells the frontend which methods are enabled) ───────────────

@router.get("/config", response_model=schemas.AuthConfig)
async def get_auth_config():
    return schemas.AuthConfig(
        methods=settings.auth_methods_list,
        allow_registration=settings.ALLOW_REGISTRATION and settings.password_auth_enabled,
        google_enabled=settings.google_auth_enabled,
    )


# ─── Password login ───────────────────────────────────────────────────────────

@router.post("/login")
async def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    if not settings.password_auth_enabled:
        raise HTTPException(status_code=403, detail="Password login is disabled")

    user = db.query(models.User).filter(models.User.username == payload.username).first()
    if not user or not user.password_hash:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    if not verify_password(user.password_hash, payload.password):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    if not user.is_approved:
        raise HTTPException(status_code=403, detail="Your account is pending admin approval. Please wait for an admin to approve your registration.")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled. Contact admin.")

    token = create_access_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer", "user": schemas.UserOut.model_validate(user)}


# ─── Registration ─────────────────────────────────────────────────────────────

@router.post("/register", status_code=201)
async def register(payload: schemas.RegisterRequest, db: Session = Depends(get_db)):
    if not settings.password_auth_enabled:
        raise HTTPException(status_code=403, detail="Password auth is disabled")
    if not settings.ALLOW_REGISTRATION:
        raise HTTPException(status_code=403, detail="Registration is disabled by admin")

    if len(payload.username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    if db.query(models.User).filter(models.User.username == payload.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")

    if payload.email:
        if db.query(models.User).filter(models.User.email == payload.email).first():
            raise HTTPException(status_code=400, detail="Email already in use")

    user = models.User(
        username=payload.username,
        password_hash=hash_password(payload.password),
        name=payload.name or payload.username,
        email=payload.email or None,
        is_admin=False,
        is_approved=False,  # requires admin approval
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Do NOT log them in yet — they need admin approval
    return {
        "message": "Registration successful. Your account is pending admin approval.",
        "pending": True,
        "username": user.username,
    }


# ─── Google OAuth ─────────────────────────────────────────────────────────────

@router.get("/google")
async def google_login():
    if not settings.google_auth_enabled:
        raise HTTPException(
            status_code=503,
            detail="Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env and add 'google' to AUTH_METHODS."
        )
    state = secrets.token_urlsafe(32)
    return RedirectResponse(url=get_google_auth_url(state))


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

    # Find existing user by google_id first, then by email
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
        # Auto-generate username from email prefix, ensure uniqueness
        base_username = email.split("@")[0].lower().replace(".", "_")
        username = base_username
        counter = 1
        while db.query(models.User).filter(models.User.username == username).first():
            username = f"{base_username}_{counter}"
            counter += 1

        user = models.User(
            google_id=google_id,
            email=email,
            username=username,
            name=name,
            picture=picture,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    if not user.is_active:
        return RedirectResponse(url=f"{settings.BASE_URL}/?error=account_disabled")

    token = create_access_token({"sub": str(user.id)})
    return RedirectResponse(url=f"{settings.BASE_URL}/?token={token}")


# ─── Current user ─────────────────────────────────────────────────────────────

@router.get("/me", response_model=schemas.UserOut)
async def get_me(current_user: models.User = Depends(get_current_user)):
    return current_user


@router.get("/logout")
async def logout():
    return {"message": "Logged out"}
