from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date


# ─── User ────────────────────────────────────────────────────────────────────

class UserBase(BaseModel):
    email: Optional[str] = None
    name: Optional[str] = None
    picture: Optional[str] = None


class UserOut(UserBase):
    id: int
    username: Optional[str] = None
    is_admin: bool = False
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UserAdmin(BaseModel):
    id: int
    username: Optional[str] = None
    email: Optional[str] = None
    name: Optional[str] = None
    is_admin: bool = False
    is_active: bool
    is_approved: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Auth request/response schemas ───────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    password: str
    name: Optional[str] = None
    email: Optional[str] = None


class AuthConfig(BaseModel):
    methods: List[str]
    allow_registration: bool
    google_enabled: bool


# ─── Company ──────────────────────────────────────────────────────────────────

class CompanyBase(BaseModel):
    name: str
    website: Optional[str] = None
    industry: Optional[str] = None
    location: Optional[str] = None
    size: Optional[str] = None
    description: Optional[str] = None


class CompanyCreate(CompanyBase):
    pass


class CompanyUpdate(CompanyBase):
    name: Optional[str] = None


class CompanyOut(CompanyBase):
    id: int
    user_id: int
    created_at: datetime
    application_count: Optional[int] = 0

    class Config:
        from_attributes = True


# ─── Contact ──────────────────────────────────────────────────────────────────

class ContactBase(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    designation: Optional[str] = None
    department: Optional[str] = None
    linkedin: Optional[str] = None
    notes: Optional[str] = None
    company_id: int
    application_id: Optional[int] = None


class ContactCreate(ContactBase):
    pass


class ContactUpdate(ContactBase):
    name: Optional[str] = None
    company_id: Optional[int] = None


class ContactOut(ContactBase):
    id: int
    user_id: int
    created_at: datetime
    company_name: Optional[str] = None

    class Config:
        from_attributes = True


# ─── Interview Round ──────────────────────────────────────────────────────────

class InterviewRoundBase(BaseModel):
    round_number: int
    round_name: Optional[str] = None
    interview_type: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    interviewer_name: Optional[str] = None
    interviewer_designation: Optional[str] = None
    interviewer_linkedin: Optional[str] = None
    status: str = "Scheduled"
    self_rating: Optional[int] = None
    difficulty: Optional[int] = None
    topics_covered: Optional[str] = None
    questions_asked: Optional[str] = None
    feedback: Optional[str] = None
    notes: Optional[str] = None
    result: str = "Pending"


class InterviewRoundCreate(InterviewRoundBase):
    application_id: int


class InterviewRoundUpdate(InterviewRoundBase):
    round_number: Optional[int] = None


class InterviewRoundOut(InterviewRoundBase):
    id: int
    user_id: int
    application_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Job Application ──────────────────────────────────────────────────────────

class JobApplicationBase(BaseModel):
    company_id: int
    job_title: str
    job_description: Optional[str] = None
    payscale_min: Optional[float] = None
    payscale_max: Optional[float] = None
    payscale_currency: str = "INR"
    payscale_type: str = "Annual"
    work_mode: Optional[str] = None
    job_type: Optional[str] = None
    location: Optional[str] = None
    experience_required: Optional[str] = None
    job_url: Optional[str] = None
    source: Optional[str] = None
    referral_name: Optional[str] = None
    application_date: Optional[date] = None
    current_stage: str = "Applied"
    final_result: str = "Pending"
    offer_amount: Optional[float] = None
    offer_currency: str = "INR"
    joining_date: Optional[date] = None
    priority: str = "Medium"
    notes: Optional[str] = None


class JobApplicationCreate(JobApplicationBase):
    pass


class JobApplicationUpdate(JobApplicationBase):
    company_id: Optional[int] = None
    job_title: Optional[str] = None


class JobApplicationOut(JobApplicationBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    company_name: Optional[str] = None
    interview_count: Optional[int] = 0
    latest_interview: Optional[datetime] = None

    class Config:
        from_attributes = True


class JobApplicationDetail(JobApplicationOut):
    interview_rounds: List[InterviewRoundOut] = []
    contacts: List[ContactOut] = []

    class Config:
        from_attributes = True


# ─── Dashboard Stats ──────────────────────────────────────────────────────────

class DashboardStats(BaseModel):
    total_applications: int
    in_progress: int
    selected: int
    rejected: int
    this_month: int
    total_interviews: int
    upcoming_interviews: int
    avg_rating: Optional[float] = None
    by_stage: dict
    by_company: List[dict]
    recent_applications: List[JobApplicationOut]


# ─── Auth ─────────────────────────────────────────────────────────────────────

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserOut
