from sqlalchemy import (
    Column, Integer, String, Text, Float, Boolean,
    DateTime, Date, ForeignKey
)
from sqlalchemy.orm import relationship
from datetime import datetime, date
from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    google_id = Column(String, unique=True, nullable=True)
    email = Column(String, unique=True, nullable=False, index=True)
    name = Column(String)
    picture = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    companies = relationship("Company", back_populates="user", cascade="all, delete-orphan")
    applications = relationship("JobApplication", back_populates="user", cascade="all, delete-orphan")
    contacts = relationship("Contact", back_populates="user", cascade="all, delete-orphan")
    interview_rounds = relationship("InterviewRound", back_populates="user", cascade="all, delete-orphan")


class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    website = Column(String)
    industry = Column(String)
    location = Column(String)
    size = Column(String)  # Startup, Small, Medium, Large, Enterprise
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="companies")
    applications = relationship("JobApplication", back_populates="company")
    contacts = relationship("Contact", back_populates="company")


class JobApplication(Base):
    __tablename__ = "job_applications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)

    job_title = Column(String, nullable=False)
    job_description = Column(Text)

    payscale_min = Column(Float)
    payscale_max = Column(Float)
    payscale_currency = Column(String, default="INR")
    payscale_type = Column(String, default="Annual")  # Annual, Monthly

    work_mode = Column(String)         # Remote, Hybrid, Onsite
    job_type = Column(String)          # Full-time, Part-time, Contract, Internship
    location = Column(String)
    experience_required = Column(String)

    job_url = Column(String)
    source = Column(String)            # LinkedIn, Naukri, Referral, Company Website, etc.
    referral_name = Column(String)

    application_date = Column(Date, default=date.today)

    current_stage = Column(String, default="Applied")
    # Applied, Shortlisted, Phone Screen, Technical Round, HR Round, Final Round, Offer, Accepted, Rejected, Withdrawn

    final_result = Column(String, default="Pending")
    # Pending, Selected, Rejected, Withdrawn, Offer Declined

    offer_amount = Column(Float)
    offer_currency = Column(String, default="INR")
    joining_date = Column(Date)

    priority = Column(String, default="Medium")  # Low, Medium, High

    notes = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="applications")
    company = relationship("Company", back_populates="applications")
    contacts = relationship("Contact", back_populates="application")
    interview_rounds = relationship(
        "InterviewRound", back_populates="application",
        order_by="InterviewRound.round_number", cascade="all, delete-orphan"
    )


class Contact(Base):
    __tablename__ = "contacts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    application_id = Column(Integer, ForeignKey("job_applications.id"), nullable=True)

    name = Column(String, nullable=False)
    email = Column(String)
    phone = Column(String)
    designation = Column(String)
    department = Column(String)
    linkedin = Column(String)
    notes = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="contacts")
    company = relationship("Company", back_populates="contacts")
    application = relationship("JobApplication", back_populates="contacts")


class InterviewRound(Base):
    __tablename__ = "interview_rounds"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    application_id = Column(Integer, ForeignKey("job_applications.id"), nullable=False)

    round_number = Column(Integer, nullable=False)
    round_name = Column(String)     # HR Screen, Technical Round 1, System Design, etc.
    interview_type = Column(String) # Phone, Video, In-person, Take-home, Group

    scheduled_at = Column(DateTime)
    completed_at = Column(DateTime)
    duration_minutes = Column(Integer)

    interviewer_name = Column(String)
    interviewer_designation = Column(String)
    interviewer_linkedin = Column(String)

    status = Column(String, default="Scheduled")
    # Scheduled, Completed, Cancelled, No-Show, Rescheduled

    self_rating = Column(Integer)     # 1-5 self assessment
    difficulty = Column(Integer)      # 1-5

    topics_covered = Column(Text)
    questions_asked = Column(Text)
    feedback = Column(Text)
    notes = Column(Text)

    result = Column(String, default="Pending")
    # Pending, Next Round, Selected, Rejected, Hold

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="interview_rounds")
    application = relationship("JobApplication", back_populates="interview_rounds")
