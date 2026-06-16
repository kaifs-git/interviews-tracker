from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, desc
from typing import List, Optional
from datetime import datetime, date, timedelta
from ..dependencies import get_db, get_current_user
from .. import models, schemas

router = APIRouter(prefix="/api/applications", tags=["applications"])


def _enrich(app: models.JobApplication, db: Session) -> schemas.JobApplicationOut:
    out = schemas.JobApplicationOut.model_validate(app)
    out.company_name = app.company.name if app.company else None
    out.interview_count = len(app.interview_rounds)
    if app.interview_rounds:
        completed = [r for r in app.interview_rounds if r.completed_at]
        if completed:
            out.latest_interview = max(r.completed_at for r in completed)
    return out


@router.get("", response_model=List[schemas.JobApplicationOut])
def list_applications(
    company_id: Optional[int] = None,
    stage: Optional[str] = None,
    result: Optional[str] = None,
    priority: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    q = (
        db.query(models.JobApplication)
        .options(joinedload(models.JobApplication.company), joinedload(models.JobApplication.interview_rounds))
        .filter(models.JobApplication.user_id == current_user.id)
    )
    if company_id:
        q = q.filter(models.JobApplication.company_id == company_id)
    if stage:
        q = q.filter(models.JobApplication.current_stage == stage)
    if result:
        q = q.filter(models.JobApplication.final_result == result)
    if priority:
        q = q.filter(models.JobApplication.priority == priority)
    if search:
        like = f"%{search}%"
        q = q.join(models.Company).filter(
            (models.JobApplication.job_title.ilike(like)) | (models.Company.name.ilike(like))
        )

    apps = q.order_by(desc(models.JobApplication.updated_at)).all()
    return [_enrich(a, db) for a in apps]


@router.post("", response_model=schemas.JobApplicationOut, status_code=status.HTTP_201_CREATED)
def create_application(
    payload: schemas.JobApplicationCreate,
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

    app = models.JobApplication(**payload.model_dump(), user_id=current_user.id)
    if not app.application_date:
        app.application_date = date.today()
    db.add(app)
    db.commit()
    db.refresh(app)

    # Reload with relationships
    app = (
        db.query(models.JobApplication)
        .options(joinedload(models.JobApplication.company), joinedload(models.JobApplication.interview_rounds))
        .filter(models.JobApplication.id == app.id)
        .first()
    )
    return _enrich(app, db)


@router.get("/{app_id}", response_model=schemas.JobApplicationDetail)
def get_application(
    app_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    app = (
        db.query(models.JobApplication)
        .options(
            joinedload(models.JobApplication.company),
            joinedload(models.JobApplication.interview_rounds),
            joinedload(models.JobApplication.contacts).joinedload(models.Contact.company),
        )
        .filter(models.JobApplication.id == app_id, models.JobApplication.user_id == current_user.id)
        .first()
    )
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    out = schemas.JobApplicationDetail.model_validate(app)
    out.company_name = app.company.name if app.company else None
    out.interview_count = len(app.interview_rounds)
    if app.interview_rounds:
        completed = [r for r in app.interview_rounds if r.completed_at]
        if completed:
            out.latest_interview = max(r.completed_at for r in completed)

    contacts_out = []
    for c in app.contacts:
        co = schemas.ContactOut.model_validate(c)
        co.company_name = c.company.name if c.company else None
        contacts_out.append(co)
    out.contacts = contacts_out
    return out


@router.put("/{app_id}", response_model=schemas.JobApplicationOut)
def update_application(
    app_id: int,
    payload: schemas.JobApplicationUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    app = (
        db.query(models.JobApplication)
        .filter(models.JobApplication.id == app_id, models.JobApplication.user_id == current_user.id)
        .first()
    )
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    if payload.company_id:
        company = (
            db.query(models.Company)
            .filter(models.Company.id == payload.company_id, models.Company.user_id == current_user.id)
            .first()
        )
        if not company:
            raise HTTPException(status_code=404, detail="Company not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(app, field, value)
    app.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(app)

    app = (
        db.query(models.JobApplication)
        .options(joinedload(models.JobApplication.company), joinedload(models.JobApplication.interview_rounds))
        .filter(models.JobApplication.id == app_id)
        .first()
    )
    return _enrich(app, db)


@router.delete("/{app_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_application(
    app_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    app = (
        db.query(models.JobApplication)
        .filter(models.JobApplication.id == app_id, models.JobApplication.user_id == current_user.id)
        .first()
    )
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    db.delete(app)
    db.commit()


@router.get("/stats/dashboard")
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    uid = current_user.id
    now = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    total = db.query(models.JobApplication).filter(models.JobApplication.user_id == uid).count()
    in_progress = (
        db.query(models.JobApplication)
        .filter(
            models.JobApplication.user_id == uid,
            models.JobApplication.final_result == "Pending",
            models.JobApplication.current_stage.notin_(["Rejected", "Withdrawn"]),
        )
        .count()
    )
    selected = (
        db.query(models.JobApplication)
        .filter(models.JobApplication.user_id == uid, models.JobApplication.final_result == "Selected")
        .count()
    )
    rejected = (
        db.query(models.JobApplication)
        .filter(models.JobApplication.user_id == uid, models.JobApplication.final_result == "Rejected")
        .count()
    )
    this_month = (
        db.query(models.JobApplication)
        .filter(
            models.JobApplication.user_id == uid,
            models.JobApplication.created_at >= month_start,
        )
        .count()
    )

    total_interviews = (
        db.query(models.InterviewRound).filter(models.InterviewRound.user_id == uid).count()
    )
    upcoming = (
        db.query(models.InterviewRound)
        .filter(
            models.InterviewRound.user_id == uid,
            models.InterviewRound.status == "Scheduled",
            models.InterviewRound.scheduled_at >= now,
        )
        .count()
    )

    avg_rating_row = (
        db.query(func.avg(models.InterviewRound.self_rating))
        .filter(
            models.InterviewRound.user_id == uid,
            models.InterviewRound.self_rating.isnot(None),
        )
        .scalar()
    )
    avg_rating = round(float(avg_rating_row), 1) if avg_rating_row else None

    # By stage
    stage_rows = (
        db.query(models.JobApplication.current_stage, func.count(models.JobApplication.id))
        .filter(models.JobApplication.user_id == uid)
        .group_by(models.JobApplication.current_stage)
        .all()
    )
    by_stage = {row[0]: row[1] for row in stage_rows}

    # By company (top 5)
    company_rows = (
        db.query(models.Company.name, func.count(models.JobApplication.id))
        .join(models.JobApplication, models.JobApplication.company_id == models.Company.id)
        .filter(models.JobApplication.user_id == uid)
        .group_by(models.Company.name)
        .order_by(func.count(models.JobApplication.id).desc())
        .limit(5)
        .all()
    )
    by_company = [{"name": row[0], "count": row[1]} for row in company_rows]

    # Recent 5
    recent_apps = (
        db.query(models.JobApplication)
        .options(joinedload(models.JobApplication.company), joinedload(models.JobApplication.interview_rounds))
        .filter(models.JobApplication.user_id == uid)
        .order_by(desc(models.JobApplication.updated_at))
        .limit(5)
        .all()
    )
    recent = [_enrich(a, db) for a in recent_apps]

    return {
        "total_applications": total,
        "in_progress": in_progress,
        "selected": selected,
        "rejected": rejected,
        "this_month": this_month,
        "total_interviews": total_interviews,
        "upcoming_interviews": upcoming,
        "avg_rating": avg_rating,
        "by_stage": by_stage,
        "by_company": by_company,
        "recent_applications": recent,
    }
