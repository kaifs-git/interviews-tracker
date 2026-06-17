"""
Abstract AI provider layer.
Supports Gemini (free), Anthropic Claude, and OpenAI.
Provider + API key are read from SystemSettings.

Returns a list of {"name": tool_name, "args": dict} for each tool call.
"""
import json
from sqlalchemy.orm import Session
from .settings_service import get_setting

# ─── Canonical tool definitions (OpenAPI / Gemini format) ────────────────────
# These are converted per-provider below.

TOOL_DEFINITIONS = [
    {
        "name": "create_application",
        "description": "Create a new job application when an email confirms a new application or a recruiter reached out about a specific role.",
        "parameters": {
            "type": "object",
            "properties": {
                "company_name":     {"type": "string", "description": "Company name"},
                "job_title":        {"type": "string", "description": "Job/role title"},
                "job_url":          {"type": "string", "description": "Job posting URL if mentioned"},
                "source":           {"type": "string", "description": "Source: LinkedIn, Naukri, Referral, etc."},
                "notes":            {"type": "string", "description": "Notes from the email"},
                "application_date": {"type": "string", "description": "Date YYYY-MM-DD, default today"},
            },
            "required": ["company_name", "job_title"],
        },
    },
    {
        "name": "update_application_status",
        "description": "Update stage or final result of an existing application — rejection, offer, shortlisting, or stage change.",
        "parameters": {
            "type": "object",
            "properties": {
                "company_name": {"type": "string"},
                "job_title":    {"type": "string", "description": "Hint to find the right application"},
                "new_stage":    {"type": "string", "enum": ["Applied","Shortlisted","Phone Screen","Technical Round","HR Round","Final Round","Offer","Accepted","Rejected","Withdrawn"]},
                "final_result": {"type": "string", "enum": ["Pending","Selected","Rejected","Withdrawn","Offer Declined"]},
                "notes":        {"type": "string"},
            },
            "required": ["company_name", "new_stage"],
        },
    },
    {
        "name": "create_interview_round",
        "description": "Schedule an interview round when an email confirms or invites to an interview. Extract date/time/link carefully.",
        "parameters": {
            "type": "object",
            "properties": {
                "company_name":     {"type": "string"},
                "job_title":        {"type": "string"},
                "round_name":       {"type": "string", "description": "e.g. Technical Round 1, HR Interview"},
                "scheduled_at":     {"type": "string", "description": "ISO datetime if mentioned"},
                "interview_type":   {"type": "string", "enum": ["Video Call","Phone","Onsite","Technical","HR","Assignment"]},
                "meeting_link":     {"type": "string", "description": "Zoom/Meet/Teams link"},
                "interviewer_name": {"type": "string"},
                "notes":            {"type": "string"},
            },
            "required": ["company_name", "round_name"],
        },
    },
    {
        "name": "create_contact",
        "description": "Save a recruiter or HR contact when a real named person emails (not no-reply).",
        "parameters": {
            "type": "object",
            "properties": {
                "name":         {"type": "string"},
                "email":        {"type": "string"},
                "company_name": {"type": "string"},
                "designation":  {"type": "string", "description": "Their role: HR Manager, Technical Recruiter"},
                "phone":        {"type": "string"},
                "linkedin":     {"type": "string"},
            },
            "required": ["name", "company_name"],
        },
    },
    {
        "name": "skip_email",
        "description": "Skip — not job-related (newsletters, OTPs, promotions, system alerts).",
        "parameters": {
            "type": "object",
            "properties": {"reason": {"type": "string"}},
            "required": ["reason"],
        },
    },
    {
        "name": "flag_for_review",
        "description": "Flag for manual review when the email is ambiguous or action is unclear.",
        "parameters": {
            "type": "object",
            "properties": {
                "reason":           {"type": "string"},
                "suggested_action": {"type": "string"},
            },
            "required": ["reason"],
        },
    },
]

# Default models per provider (cheapest / free)
DEFAULT_MODELS = {
    "gemini":    "gemini-1.5-flash",
    "anthropic": "claude-haiku-4-5",
    "openai":    "gpt-4o-mini",
}


def call_agent(db: Session, system: str, user_message: str) -> list[dict]:
    """
    Call the configured AI provider and return tool calls as
    [{"name": str, "args": dict}, ...].
    """
    provider = (get_setting(db, "ai_provider") or "gemini").lower()
    model    = get_setting(db, "ai_model") or DEFAULT_MODELS.get(provider, "gemini-1.5-flash")

    if provider == "gemini":
        return _call_gemini(db, system, user_message, model)
    elif provider == "anthropic":
        return _call_anthropic(db, system, user_message, model)
    elif provider == "openai":
        return _call_openai(db, system, user_message, model)
    else:
        raise ValueError(f"Unknown AI provider: {provider}")


# ─── Gemini ───────────────────────────────────────────────────────────────────

def _call_gemini(db: Session, system: str, user_message: str, model: str) -> list[dict]:
    import google.generativeai as genai

    api_key = get_setting(db, "gemini_api_key")
    if not api_key:
        raise ValueError("Gemini API key not configured")

    genai.configure(api_key=api_key)
    m = genai.GenerativeModel(
        model_name=model,
        system_instruction=system,
        tools=TOOL_DEFINITIONS,        # SDK accepts OpenAPI dicts directly
    )
    response = m.generate_content(user_message)

    results = []
    try:
        for part in response.candidates[0].content.parts:
            try:
                fc = part.function_call
                if fc and fc.name:
                    results.append({"name": fc.name, "args": dict(fc.args)})
            except AttributeError:
                pass
    except (IndexError, AttributeError):
        pass
    return results


# ─── Anthropic ────────────────────────────────────────────────────────────────

def _to_anthropic_tools(tools: list) -> list:
    """Convert OpenAPI-style params to Anthropic's input_schema format."""
    out = []
    for t in tools:
        out.append({
            "name": t["name"],
            "description": t["description"],
            "input_schema": t["parameters"],
        })
    return out


def _call_anthropic(db: Session, system: str, user_message: str, model: str) -> list[dict]:
    import anthropic

    api_key = get_setting(db, "anthropic_api_key")
    if not api_key:
        raise ValueError("Anthropic API key not configured")

    client = anthropic.Anthropic(api_key=api_key)
    response = client.messages.create(
        model=model,
        max_tokens=1024,
        system=system,
        tools=_to_anthropic_tools(TOOL_DEFINITIONS),
        messages=[{"role": "user", "content": user_message}],
    )

    results = []
    for block in response.content:
        if block.type == "tool_use":
            results.append({"name": block.name, "args": block.input})
    return results


# ─── OpenAI ───────────────────────────────────────────────────────────────────

def _to_openai_tools(tools: list) -> list:
    """Convert to OpenAI's {"type": "function", "function": {...}} format."""
    return [{"type": "function", "function": t} for t in tools]


def _call_openai(db: Session, system: str, user_message: str, model: str) -> list[dict]:
    from openai import OpenAI

    api_key = get_setting(db, "openai_api_key")
    if not api_key:
        raise ValueError("OpenAI API key not configured")

    client = OpenAI(api_key=api_key)
    response = client.chat.completions.create(
        model=model,
        tools=_to_openai_tools(TOOL_DEFINITIONS),
        tool_choice="auto",
        messages=[
            {"role": "system", "content": system},
            {"role": "user",   "content": user_message},
        ],
    )

    results = []
    for choice in response.choices:
        msg = choice.message
        if msg.tool_calls:
            for tc in msg.tool_calls:
                try:
                    args = json.loads(tc.function.arguments)
                except Exception:
                    args = {}
                results.append({"name": tc.function.name, "args": args})
    return results
