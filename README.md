# InterviewsTracker

A full-featured web application to track your job search — applications, interview rounds, contacts, pay scales, and outcomes.

## Features

- **Dashboard** — live stats: total apps, in-progress, selected, rejected, interviews
- **Applications** — full CRUD with company, role, JD, pay range, work mode, source, priority
- **Interview Rounds** — track every round with type, interviewer, rating (1–5), difficulty, topics, feedback, result
- **Companies** — manage companies with industry, size, website, location
- **Contacts** — recruiters & hiring managers with email, phone, LinkedIn
- **Google OAuth** — secure login with your Google account
- **Per-user isolation** — all data is private to the logged-in user

## Quick Start

### 1. Clone & Install

```bash
git clone <repo>
cd interviews-tracker
pip install -r requirements.txt
```

### 2. Configure Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project → **APIs & Services** → **Credentials** → **Create OAuth 2.0 Client ID**
3. Application type: **Web application**
4. Authorized redirect URI: `http://localhost:8000/auth/google/callback`
5. Copy the Client ID and Client Secret

```bash
cp .env.example .env
# Edit .env with your Google credentials and a strong SECRET_KEY
```

### 3. Run

```bash
python run.py
```

Open http://localhost:8000 in your browser.

## Environment Variables

| Variable | Description |
|---|---|
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret |
| `SECRET_KEY` | JWT signing secret (generate with `python -c "import secrets; print(secrets.token_hex(32))"`) |
| `BASE_URL` | App base URL (default: `http://localhost:8000`) |
| `DATABASE_URL` | SQLite path (default: `sqlite:///./data/interviews.db`) |
| `ACCESS_TOKEN_EXPIRE_DAYS` | JWT expiry in days (default: 7) |

## Production Deployment

For production (e.g. Railway, Render, VPS):

1. Set `BASE_URL` to your domain with HTTPS
2. Update the Google OAuth redirect URI to `https://yourdomain.com/auth/google/callback`
3. Use a strong random `SECRET_KEY`
4. Set `PORT` env variable if needed

## Tech Stack

- **Backend**: FastAPI (Python) + SQLAlchemy + SQLite
- **Auth**: Google OAuth 2.0 + JWT
- **Frontend**: Vanilla JS SPA + Tailwind CSS + Chart.js + Font Awesome
