from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from ..dependencies import get_db, get_current_user
from ..models import EmailBlacklist, User

router = APIRouter(prefix="/api/email/blacklist", tags=["blacklist"])


class BlacklistCreate(BaseModel):
    pattern: str


@router.get("")
def list_blacklist(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entries = db.query(EmailBlacklist).filter_by(user_id=current_user.id).all()
    return [
        {"id": e.id, "pattern": e.pattern, "created_at": e.created_at.isoformat() if e.created_at else None}
        for e in entries
    ]


@router.post("", status_code=201)
def add_blacklist(
    body: BlacklistCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pattern = body.pattern.strip().lower()
    if not pattern:
        raise HTTPException(status_code=400, detail="Pattern cannot be empty")

    # Check for duplicate
    existing = db.query(EmailBlacklist).filter_by(user_id=current_user.id, pattern=pattern).first()
    if existing:
        raise HTTPException(status_code=409, detail="Pattern already blacklisted")

    entry = EmailBlacklist(user_id=current_user.id, pattern=pattern)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return {"id": entry.id, "pattern": entry.pattern, "created_at": entry.created_at.isoformat() if entry.created_at else None}


@router.delete("/{entry_id}", status_code=204)
def delete_blacklist(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = db.query(EmailBlacklist).filter_by(id=entry_id, user_id=current_user.id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    db.delete(entry)
    db.commit()
    return None
