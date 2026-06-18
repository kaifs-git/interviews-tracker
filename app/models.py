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
    # Password auth fields
    username = Column(String, unique=True, nullable=True, index=True)
    password_hash = Column(String, nullable=True)
    is_admin = Column(Boolean, default=False, nullable=False)
    # Google OAuth field
    google_id = Column(String, unique=True, nullable=True)
    # Common fields
    email = Column(String, unique=True, nullable=True, index=True)
    name = Column(String)
    picture = Column(String)
    is_active = Column(Boolean, default=True)
    is_approved = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    companies = relationship("Company", back_populates="user", cascade="all, delete-orphan")
    applications = relationship("JobApplication", back_populates="user", cascade="all, delete-orphan")
    contacts = relationship("Contact", back_populates="user", cascade="all, delete-orphan")
    interview_rounds = relationship("InterviewRound", back_populates="user", cascade="all, delete-orphan")
    email_accounts = relationship("EmailAccount", back_populates="user", cascade="all, delete-orphan")


class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    website = Column(String)
    industry = Column(String)
    location = Column(String)
    size = Column(String)
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
    payscale_type = Column(String, default="Annual")

    work_mode = Column(String)
    job_type = Column(String)
    location = Column(String)
    experience_required = Column(String)

    job_url = Column(String)
    source = Column(String)
    referral_name = Column(String)

    application_date = Column(Date, default=date.today)

    current_stage = Column(String, default="Applied")
    final_result = Column(String, default="Pending")

    offer_amount = Column(Float)
    offer_currency = Column(String, default="INR")
    joining_date = Column(Date)

    priority = Column(String, default="Medium")
    notes = Column(Text)

    source_email_message_id = Column(String, nullable=True)

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
    round_name = Column(String)
    interview_type = Column(String)

    scheduled_at = Column(DateTime)
    completed_at = Column(DateTime)
    duration_minutes = Column(Integer)

    interviewer_name = Column(String)
    interviewer_designation = Column(String)
    interviewer_linkedin = Column(String)

    status = Column(String, default="Scheduled")

    self_rating = Column(Integer)
    difficulty = Column(Integer)

    topics_covered = Column(Text)
    questions_asked = Column(Text)
    feedback = Column(Text)
    notes = Column(Text)

    result = Column(String, default="Pending")

    source_email_message_id = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="interview_rounds")
    application = relationship("JobApplication", back_populates="interview_rounds")


class SystemSettings(Base):
    __tablename__ = "system_settings"
    id = Column(Integer, primary_key=True)
    key = Column(String, unique=True, nullable=False)
    value = Column(Text)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class EmailAccount(Base):
    __tablename__ = "email_accounts"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    provider = Column(String, nullable=False)  # "gmail"
    email_address = Column(String, nullable=False)
    access_token = Column(Text)
    refresh_token = Column(Text)
    token_expiry = Column(DateTime)
    last_synced_at = Column(DateTime)
    history_id = Column(String)  # Gmail history ID for incremental sync
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="email_accounts")


class AgentActivityLog(Base):
    __tablename__ = "agent_activity_logs"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    email_account_id = Column(Integer, ForeignKey("email_accounts.id"), nullable=True)
    email_message_id = Column(String)  # Gmail message ID for deduplication
    email_subject = Column(String)
    email_from = Column(String)
    email_date = Column(DateTime)
    action_type = Column(String)  # "create_application", "update_status", "create_interview", "create_contact", "skipped", "flagged"
    entity_type = Column(String)  # "application", "interview", "contact"
    entity_id = Column(Integer)
    confidence = Column(String)  # "high", "medium", "low"
    summary = Column(Text)  # human-readable description of what was done
    raw_agent_response = Column(Text)
    status = Column(String, default="done")  # "done", "undone", "flagged"
    created_at = Column(DateTime, default=datetime.utcnow)


class PushSubscription(Base):
    __tablename__ = "push_subscriptions"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    endpoint = Column(Text, nullable=False, unique=True)
    p256dh = Column(Text, nullable=False)
    auth = Column(Text, nullable=False)
    user_agent = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)


class EmailBlacklist(Base):
    __tablename__ = "email_blacklists"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    pattern = Column(String, nullable=False)  # email address or @domain.com
    created_at = Column(DateTime, default=datetime.utcnow)
