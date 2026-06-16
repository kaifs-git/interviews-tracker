from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from ..dependencies import get_db, get_current_user
from .. import models, schemas

router = APIRouter(prefix="/api/contacts", tags=["contacts"])


@router.get("", response_model=List[schemas.ContactOut])
def list_contacts(
    company_id: Optional[int] = None,
    application_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    q = (
        db.query(models.Contact)
        .options(joinedload(models.Contact.company))
        .filter(models.Contact.user_id == current_user.id)
    )
    if company_id:
        q = q.filter(models.Contact.company_id == company_id)
    if application_id:
        q = q.filter(models.Contact.application_id == application_id)

    contacts = q.order_by(models.Contact.name).all()
    result = []
    for c in contacts:
        out = schemas.ContactOut.model_validate(c)
        out.company_name = c.company.name if c.company else None
        result.append(out)
    return result


@router.post("", response_model=schemas.ContactOut, status_code=status.HTTP_201_CREATED)
def create_contact(
    payload: schemas.ContactCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    company = (
        db.query(models.Company)
        .filter(models.Company.id == payload.company_id, models.Company.user_id == current_user.id)
        .first()
    )
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    if payload.application_id:
        app = (
            db.query(models.JobApplication)
            .filter(
                models.JobApplication.id == payload.application_id,
                models.JobApplication.user_id == current_user.id,
            )
            .first()
        )
        if not app:
            raise HTTPException(status_code=404, detail="Application not found")

    contact = models.Contact(**payload.model_dump(), user_id=current_user.id)
    db.add(contact)
    db.commit()
    db.refresh(contact)

    contact = (
        db.query(models.Contact)
        .options(joinedload(models.Contact.company))
        .filter(models.Contact.id == contact.id)
        .first()
    )
    out = schemas.ContactOut.model_validate(contact)
    out.company_name = contact.company.name if contact.company else None
    return out


@router.get("/{contact_id}", response_model=schemas.ContactOut)
def get_contact(
    contact_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    contact = (
        db.query(models.Contact)
        .options(joinedload(models.Contact.company))
        .filter(models.Contact.id == contact_id, models.Contact.user_id == current_user.id)
        .first()
    )
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    out = schemas.ContactOut.model_validate(contact)
    out.company_name = contact.company.name if contact.company else None
    return out


@router.put("/{contact_id}", response_model=schemas.ContactOut)
def update_contact(
    contact_id: int,
    payload: schemas.ContactUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    contact = (
        db.query(models.Contact)
        .filter(models.Contact.id == contact_id, models.Contact.user_id == current_user.id)
        .first()
    )
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(contact, field, value)

    db.commit()
    db.refresh(contact)

    contact = (
        db.query(models.Contact)
        .options(joinedload(models.Contact.company))
        .filter(models.Contact.id == contact_id)
        .first()
    )
    out = schemas.ContactOut.model_validate(contact)
    out.company_name = contact.company.name if contact.company else None
    return out


@router.delete("/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_contact(
    contact_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    contact = (
        db.query(models.Contact)
        .filter(models.Contact.id == contact_id, models.Contact.user_id == current_user.id)
        .first()
    )
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    db.delete(contact)
    db.commit()
