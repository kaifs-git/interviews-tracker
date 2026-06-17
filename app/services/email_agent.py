import json
from datetime import datetime, date
from sqlalchemy.orm import Session
import google.generativeai as genai

from ..models import JobApplication, Company, Contact, InterviewRound, AgentActivityLog, EmailAccount
from .settings_service import get_setting
from .push_notify import send_push

# Gemini tool declarations (OpenAPI-compatible schema)
TOOL_DECLARATIONS = [
    {
        "name": "create_application",
        "description": "Create a new job application record when an email shows a new application was submitted or a recruiter reached out about a specific role.",
        "parameters": {
            "type": "object",
            "properties": {
                "company_name": {"type": "string", "description": "Company name"},
                "job_title":    {"type": "string", "description": "Job/role title"},
                "job_url":      {"type": "string", "description": "Job posting URL if mentioned"},
                "source":       {"type": "string", "description": "How found: LinkedIn, Naukri, Referral, etc."},
                "notes":        {"type": "string", "description": "Relevant notes from the email"},
                "application_date": {"type": "string", "description": "Date in YYYY-MM-DD format, default today"},
            },
            "required": ["company_name", "job_title"],
        },
    },
    {
        "name": "update_application_status",
        "description": "Update the stage or final result of an existing application. Use when the email is a rejection, offer, shortlisting, or stage update.",
        "parameters": {
            "type": "object",
            "properties": {
                "company_name":  {"type": "string", "description": "Company name to find the application"},
                "job_title":     {"type": "string", "description": "Job title hint to identify the correct application"},
                "new_stage":     {"type": "string", "enum": ["Applied", "Shortlisted", "Phone Screen", "Technical Round", "HR Round", "Final Round", "Offer", "Accepted", "Rejected", "Withdrawn"]},
                "final_result":  {"type": "string", "enum": ["Pending", "Selected", "Rejected", "Withdrawn", "Offer Declined"]},
                "notes":         {"type": "string"},
            },
            "required": ["company_name", "new_stage"],
        },
    },
    {
        "name": "create_interview_round",
        "description": "Create an interview round when an email schedules or confirms an interview. Extract date/time/link carefully.",
        "parameters": {
            "type": "object",
            "properties": {
                "company_name":     {"type": "string"},
                "job_title":        {"type": "string"},
                "round_name":       {"type": "string", "description": "e.g. Technical Round 1, HR Interview, Phone Screen"},
                "scheduled_at":     {"type": "string", "description": "ISO datetime string if mentioned"},
                "interview_type":   {"type": "string", "enum": ["Video Call", "Phone", "Onsite", "Technical", "HR", "Assignment"]},
                "meeting_link":     {"type": "string", "description": "Zoom/Meet/Teams link if present"},
                "interviewer_name": {"type": "string"},
                "notes":            {"type": "string"},
            },
            "required": ["company_name", "round_name"],
        },
    },
    {
        "name": "create_contact",
        "description": "Save a recruiter or HR contact. Use when you can extract a real person's name and role from the email.",
        "parameters": {
            "type": "object",
            "properties": {
                "name":         {"type": "string"},
                "email":        {"type": "string"},
                "company_name": {"type": "string"},
                "designation":  {"type": "string", "description": "Their job title e.g. HR Manager, Technical Recruiter"},
                "phone":        {"type": "string"},
                "linkedin":     {"type": "string"},
            },
            "required": ["name", "company_name"],
        },
    },
    {
        "name": "skip_email",
        "description": "Skip this email — not related to job search at all (newsletters, OTPs, promotions, system alerts).",
        "parameters": {
            "type": "object",
            "properties": {
                "reason": {"type": "string"},
            },
            "required": ["reason"],
        },
    },
    {
        "name": "flag_for_review",
        "description": "Flag for manual review when the email is ambiguous or you are unsure what action to take.",
        "parameters": {
            "type": "object",
            "properties": {
                "reason":            {"type": "string"},
                "suggested_action":  {"type": "string"},
            },
            "required": ["reason"],
        },
    },
]

SYSTEM_PROMPT = """You are an AI assistant that helps track job applications by reading emails.

Given an email, identify if it is related to a job search and call the appropriate tool(s).

Rules:
- One email can trigger multiple tool calls (e.g., create_contact AND update_application_status)
- Rejection emails → update_application_status with new_stage="Rejected" and final_result="Rejected"
- Offer emails → update_application_status with new_stage="Offer" and final_result="Selected"
- Interview scheduling → create_interview_round AND optionally create_contact for the recruiter
- New application confirmation or recruiter outreach → create_application
- If no matching application exists for a status update, create one first
- Always extract contact info when a real named person emails (not a no-reply address)
- Skip newsletters, OTPs, promotions, and system notifications
- When genuinely unsure, call flag_for_review instead of guessing

Today's date: {today}
User's existing companies: {companies}
User's existing applications: {applications}
"""


def process_email_for_user(
    db: Session,
    user_id: int,
    email_account: EmailAccount,
    email: dict,
) -> "AgentActivityLog | None":
    """Run the Gemini agent on a single email and persist results."""
    # Dedup — skip if already processed
    if db.query(AgentActivityLog).filter_by(
        user_id=user_id, email_message_id=email["message_id"]
    ).first():
        return None

    api_key = get_setting(db, "gemini_api_key")
    if not api_key:
        return None

    # Build context for the model
    companies    = db.query(Company).filter_by(user_id=user_id).all()
    applications = (
        db.query(JobApplication)
        .filter_by(user_id=user_id)
        .order_by(JobApplication.created_at.desc())
        .limit(30)
        .all()
    )
    companies_ctx = [{"id": c.id, "name": c.name} for c in companies]
    apps_ctx = [
        {"id": a.id, "company": a.company.name if a.company else "", "title": a.job_title, "stage": a.current_stage}
        for a in applications
    ]

    system = SYSTEM_PROMPT.format(
        today=date.today().isoformat(),
        companies=json.dumps(companies_ctx),
        applications=json.dumps(apps_ctx),
    )

    user_message = (
        f"From: {email.get('from_name', '')} <{email.get('from_email', '')}>\n"
        f"Date: {email.get('date', '')}\n"
        f"Subject: {email.get('subject', '')}\n\n"
        f"{email.get('body', '')[:3000]}"
    )

    # Call Gemini
    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(
            model_name="gemini-1.5-flash",
            system_instruction=system,
            tools=TOOL_DECLARATIONS,
        )
        response = model.generate_content(user_message)
    except Exception:
        return None

    # Extract function calls from response parts
    logs = []
    try:
        parts = response.candidates[0].content.parts
    except (IndexError, AttributeError):
        return None

    for part in parts:
        try:
            fc = part.function_call
        except AttributeError:
            continue
        if not fc or not fc.name:
            continue

        tool_name = fc.name
        args = {k: v for k, v in fc.args.items()}

        log = AgentActivityLog(
            user_id=user_id,
            email_account_id=email_account.id,
            email_message_id=email["message_id"],
            email_subject=email.get("subject", ""),
            email_from=email.get("from_email", ""),
            email_date=email.get("date"),
            action_type=tool_name,
            raw_agent_response=json.dumps(args),
            confidence="high",
            status="done",
        )

        try:
            if tool_name == "create_application":
                log.entity_type = "application"
                log.entity_id, log.summary = _create_application(db, user_id, args, email)

            elif tool_name == "update_application_status":
                log.entity_type = "application"
                log.entity_id, log.summary = _update_application(db, user_id, args)

            elif tool_name == "create_interview_round":
                log.entity_type = "interview"
                log.entity_id, log.summary = _create_interview(db, user_id, args, email)

            elif tool_name == "create_contact":
                log.entity_type = "contact"
                log.entity_id, log.summary = _create_contact(db, user_id, args)

            elif tool_name == "skip_email":
                log.action_type = "skipped"
                log.summary = args.get("reason", "Not job-related")

            elif tool_name == "flag_for_review":
                log.action_type = "flagged"
                log.status = "flagged"
                log.confidence = "low"
                log.summary = args.get("reason", "Needs review")

        except Exception as exc:
            log.summary = f"Error: {exc}"
            log.status = "error"

        db.add(log)
        logs.append(log)

    db.commit()

    # Push notification for meaningful actions
    actionable = [l for l in logs if l.action_type != "skipped"]
    if actionable:
        first = actionable[0]
        titles = {
            "create_application":       "📋 New Application Added",
            "update_application_status":"🔄 Application Updated",
            "create_interview_round":   "📅 Interview Scheduled",
            "create_contact":           "👤 Contact Saved",
            "flagged":                  "⚠️ Email Needs Review",
        }
        send_push(db, user_id, titles.get(first.action_type, "Agent Activity"),
                  first.summary or email.get("subject", ""))

    return logs[0] if logs else None


# ─── Tool implementations ──────────────────────────────────────────────────────

def _get_or_create_company(db: Session, user_id: int, company_name: str) -> Company:
    company = db.query(Company).filter(
        Company.user_id == user_id,
        Company.name.ilike(company_name),
    ).first()
    if not company:
        company = Company(user_id=user_id, name=company_name)
        db.add(company)
        db.flush()
    return company


def _create_application(db: Session, user_id: int, args: dict, email: dict):
    company = _get_or_create_company(db, user_id, args["company_name"])
    app_date = date.today()
    if args.get("application_date"):
        try:
            app_date = date.fromisoformat(args["application_date"])
        except Exception:
            pass

    app = JobApplication(
        user_id=user_id,
        company_id=company.id,
        job_title=args["job_title"],
        job_url=args.get("job_url"),
        source=args.get("source", "Email"),
        notes=args.get("notes"),
        application_date=app_date,
        current_stage="Applied",
        final_result="Pending",
        source_email_message_id=email.get("message_id"),
    )
    db.add(app)
    db.flush()
    return app.id, f"Created application: {args['job_title']} at {args['company_name']}"


def _update_application(db: Session, user_id: int, args: dict):
    company_name = args.get("company_name", "")
    job_title_hint = args.get("job_title", "")

    apps = (
        db.query(JobApplication)
        .join(Company)
        .filter(
            JobApplication.user_id == user_id,
            Company.name.ilike(f"%{company_name}%"),
        )
        .order_by(JobApplication.created_at.desc())
        .all()
    )

    app = None
    if job_title_hint:
        app = next((a for a in apps if job_title_hint.lower() in (a.job_title or "").lower()), None)
    if not app and apps:
        app = apps[0]

    if not app:
        company = _get_or_create_company(db, user_id, company_name)
        app = JobApplication(
            user_id=user_id, company_id=company.id,
            job_title=job_title_hint or "Unknown Role",
            current_stage=args.get("new_stage", "Applied"),
            final_result=args.get("final_result", "Pending"),
            application_date=date.today(),
        )
        db.add(app)
        db.flush()
        return app.id, f"Created & updated: {company_name} → {args.get('new_stage', '')}"

    if args.get("new_stage"):
        app.current_stage = args["new_stage"]
    if args.get("final_result"):
        app.final_result = args["final_result"]
    if args.get("notes"):
        app.notes = (app.notes or "") + "\n" + args["notes"]

    return app.id, f"Updated {app.job_title} at {company_name} → {args.get('new_stage', '')}"


def _create_interview(db: Session, user_id: int, args: dict, email: dict):
    company = _get_or_create_company(db, user_id, args["company_name"])

    app = (
        db.query(JobApplication)
        .filter_by(user_id=user_id, company_id=company.id)
        .order_by(JobApplication.created_at.desc())
        .first()
    )
    if not app:
        app = JobApplication(
            user_id=user_id, company_id=company.id,
            job_title=args.get("job_title", "Unknown Role"),
            current_stage="Shortlisted", final_result="Pending",
            application_date=date.today(),
        )
        db.add(app)
        db.flush()

    last = (
        db.query(InterviewRound)
        .filter_by(application_id=app.id)
        .order_by(InterviewRound.round_number.desc())
        .first()
    )
    round_num = (last.round_number + 1) if last else 1

    scheduled = None
    if args.get("scheduled_at"):
        try:
            scheduled = datetime.fromisoformat(args["scheduled_at"])
        except Exception:
            pass

    interview = InterviewRound(
        user_id=user_id, application_id=app.id,
        round_number=round_num,
        round_name=args["round_name"],
        interview_type=args.get("interview_type", "Video Call"),
        scheduled_at=scheduled,
        interviewer_name=args.get("interviewer_name"),
        notes=args.get("notes"),
        status="Scheduled", result="Pending",
        source_email_message_id=email.get("message_id"),
    )
    db.add(interview)
    app.current_stage = "Shortlisted"
    db.flush()
    return interview.id, f"Interview scheduled: {args['round_name']} at {args['company_name']}"


def _create_contact(db: Session, user_id: int, args: dict):
    company = _get_or_create_company(db, user_id, args["company_name"])

    if args.get("email"):
        existing = db.query(Contact).filter_by(user_id=user_id, email=args["email"]).first()
        if existing:
            return existing.id, f"Contact already exists: {args['name']}"

    contact = Contact(
        user_id=user_id, company_id=company.id,
        name=args["name"],
        email=args.get("email"),
        designation=args.get("designation"),
        phone=args.get("phone"),
        linkedin=args.get("linkedin"),
    )
    db.add(contact)
    db.flush()
    return contact.id, f"Saved contact: {args['name']} ({args.get('designation', '')} at {args['company_name']})"
