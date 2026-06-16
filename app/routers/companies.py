from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from ..dependencies import get_db, get_current_user
from .. import models, schemas

router = APIRouter(prefix="/api/companies", tags=["companies"])


@router.get("", response_model=List[schemas.CompanyOut])
def list_companies(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    companies = (
        db.query(models.Company)
        .filter(models.Company.user_id == current_user.id)
        .order_by(models.Company.name)
        .all()
    )
    result = []
    for c in companies:
        count = (
            db.query(models.JobApplication)
            .filter(
                models.JobApplication.company_id == c.id,
                models.JobApplication.user_id == current_user.id,
            )
            .count()
        )
        out = schemas.CompanyOut.model_validate(c)
        out.application_count = count
        result.append(out)
    return result


@router.post("", response_model=schemas.CompanyOut, status_code=status.HTTP_201_CREATED)
def create_company(
    payload: schemas.CompanyCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    existing = (
        db.query(models.Company)
        .filter(
            models.Company.user_id == current_user.id,
            models.Company.name == payload.name,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Company with this name already exists")

    company = models.Company(**payload.model_dump(), user_id=current_user.id)
    db.add(company)
    db.commit()
    db.refresh(company)
    out = schemas.CompanyOut.model_validate(company)
    out.application_count = 0
    return out


@router.get("/{company_id}", response_model=schemas.CompanyOut)
def get_company(
    company_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    company = (
        db.query(models.Company)
        .filter(models.Company.id == company_id, models.Company.user_id == current_user.id)
        .first()
    )
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    count = (
        db.query(models.JobApplication)
        .filter(
            models.JobApplication.company_id == company_id,
            models.JobApplication.user_id == current_user.id,
        )
        .count()
    )
    out = schemas.CompanyOut.model_validate(company)
    out.application_count = count
    return out


@router.put("/{company_id}", response_model=schemas.CompanyOut)
def update_company(
    company_id: int,
    payload: schemas.CompanyUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    company = (
        db.query(models.Company)
        .filter(models.Company.id == company_id, models.Company.user_id == current_user.id)
        .first()
    )
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(company, field, value)

    db.commit()
    db.refresh(company)
    count = (
        db.query(models.JobApplication)
        .filter(
            models.JobApplication.company_id == company_id,
            models.JobApplication.user_id == current_user.id,
        )
        .count()
    )
    out = schemas.CompanyOut.model_validate(company)
    out.application_count = count
    return out


@router.delete("/{company_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_company(
    company_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    company = (
        db.query(models.Company)
        .filter(models.Company.id == company_id, models.Company.user_id == current_user.id)
        .first()
    )
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    db.delete(company)
    db.commit()
