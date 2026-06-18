import json
import logging
from datetime import datetime, date
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from ..models import JobApplication, Company, Contact, InterviewRound, AgentActivityLog, EmailAccount, EmailBlacklist
from .settings_service import get_setting
from .push_notify import send_push
from .ai_provider import call_agent

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
    # Blacklist check — skip before dedup so blacklisted senders are always logged as skipped
    from_email = email.get("from_email", "").lower().strip()
    blacklist = db.query(EmailBlacklist).filter_by(user_id=user_id).all()
    for entry in blacklist:
        p = entry.pattern.lower().strip()
        if p == from_email or (p.startswith('@') and from_email.endswith(p)):
            skip_log = AgentActivityLog(
                user_id=user_id, email_account_id=email_account.id,
                email_message_id=email["message_id"],
                email_subject=email.get("subject", ""),
                email_from=email.get("from_email", ""),
                email_date=email.get("date"),
                action_type="skipped",
                summary=f"Blacklisted: {entry.pattern}",
                status="done",
            )
            db.add(skip_log)
            db.commit()
            return skip_log

    # Dedup — skip if already successfully processed
    # Allow retrying errors but cap at 3 attempts to avoid infinite loops
    existing = db.query(AgentActivityLog).filter(
        AgentActivityLog.user_id == user_id,
        AgentActivityLog.email_message_id == email["message_id"],
    ).all()
    if existing:
        if any(e.status != "error" for e in existing):
            return None  # already processed successfully
        if len(existing) >= 3:
            return None  # too many failed attempts, give up

    # Check that some provider key is configured
    provider = get_setting(db, "ai_provider") or "gemini"
    key_map  = {"gemini": "gemini_api_key", "anthropic": "anthropic_api_key", "openai": "openai_api_key", "groq": "groq_api_key"}
    if not get_setting(db, key_map.get(provider, "gemini_api_key")):
        logger.warning("Email agent: no API key configured for provider '%s', skipping email %s", provider, email.get("message_id"))
        error_log = AgentActivityLog(
            user_id=user_id,
            email_account_id=email_account.id,
            email_message_id=email["message_id"],
            email_subject=email.get("subject", ""),
            email_from=email.get("from_email", ""),
            email_date=email.get("date"),
            action_type="error",
            summary=f"No API key for provider '{provider}'. Go to Admin → Settings to add your key.",
            status="error",
        )
        db.add(error_log)
        db.commit()
        return error_log

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

    # Call the configured AI provider
    try:
        tool_calls = call_agent(db, system, user_message)
    except Exception as exc:
        logger.error("Email agent: AI call failed for email %s: %s", email.get("message_id"), exc)
        error_log = AgentActivityLog(
            user_id=user_id,
            email_account_id=email_account.id,
            email_message_id=email["message_id"],
            email_subject=email.get("subject", ""),
            email_from=email.get("from_email", ""),
            email_date=email.get("date"),
            action_type="error",
            summary=f"AI error: {exc}",
            status="error",
        )
        db.add(error_log)
        db.commit()
        return error_log

    logs = []
    for call in tool_calls:
        tool_name = call["name"]
        args      = call["args"]

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
