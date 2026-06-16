from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from ..dependencies import get_db, get_current_user
from .. import models, schemas

router = APIRouter(prefix="/api/interviews", tags=["interviews"])


@router.get("", response_model=List[schemas.InterviewRoundOut])
def list_interviews(
    application_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    app = (
        db.query(models.JobApplication)
        .filter(models.JobApplication.id == application_id, models.JobApplication.user_id == current_user.id)
        .first()
    )
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    return (
        db.query(models.InterviewRound)
        .filter(
            models.InterviewRound.application_id == application_id,
            models.InterviewRound.user_id == current_user.id,
        )
        .order_by(models.InterviewRound.round_number)
        .all()
    )


@router.post("", response_model=schemas.InterviewRoundOut, status_code=status.HTTP_201_CREATED)
def create_interview(
    payload: schemas.InterviewRoundCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    app = (
        db.query(models.JobApplication)
        .filter(models.JobApplication.id == payload.application_id, models.JobApplication.user_id == current_user.id)
        .first()
    )
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    round_ = models.InterviewRound(**payload.model_dump(), user_id=current_user.id)
    db.add(round_)

    # Auto-update application stage based on interview round
    stage_map = {
        "Phone Screen": "Phone Screen",
        "Technical Round": "Technical Round",
        "HR Round": "HR Round",
        "Final Round": "Final Round",
        "Offer": "Offer",
    }
    if payload.round_name and payload.round_name in stage_map:
        app.current_stage = stage_map[payload.round_name]
    elif app.current_stage == "Applied":
        app.current_stage = "Shortlisted"
    app.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(round_)
    return round_


@router.get("/{round_id}", response_model=schemas.InterviewRoundOut)
def get_interview(
    round_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    round_ = (
        db.query(models.InterviewRound)
        .filter(models.InterviewRound.id == round_id, models.InterviewRound.user_id == current_user.id)
        .first()
    )
    if not round_:
        raise HTTPException(status_code=404, detail="Interview round not found")
    return round_


@router.put("/{round_id}", response_model=schemas.InterviewRoundOut)
def update_interview(
    round_id: int,
    payload: schemas.InterviewRoundUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    round_ = (
        db.query(models.InterviewRound)
        .filter(models.InterviewRound.id == round_id, models.InterviewRound.user_id == current_user.id)
        .first()
    )
    if not round_:
        raise HTTPException(status_code=404, detail="Interview round not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(round_, field, value)
    round_.updated_at = datetime.utcnow()

    # If result is Selected/Rejected, update application final result
    app = db.query(models.JobApplication).filter(models.JobApplication.id == round_.application_id).first()
    if app and payload.result:
        if payload.result == "Selected":
            app.final_result = "Selected"
            app.current_stage = "Offer"
        elif payload.result == "Rejected":
            app.final_result = "Rejected"
            app.current_stage = "Rejected"
        app.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(round_)
    return round_


@router.delete("/{round_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_interview(
    round_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    round_ = (
        db.query(models.InterviewRound)
        .filter(models.InterviewRound.id == round_id, models.InterviewRound.user_id == current_user.id)
        .first()
    )
    if not round_:
        raise HTTPException(status_code=404, detail="Interview round not found")
    db.delete(round_)
    db.commit()
