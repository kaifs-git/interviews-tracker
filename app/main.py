from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text, inspect
import os

from .database import engine, Base, SessionLocal
from . import models
from .routers import auth, companies, applications, interviews, contacts
from .config import settings
from .auth import hash_password


def run_db_migrations():
    """Add new columns to existing tables without dropping data."""
    is_sqlite = settings.DATABASE_URL.startswith("sqlite")
    inspector = inspect(engine)

    # Only migrate if the users table already exists
    if "users" not in inspector.get_table_names():
        return

    existing_cols = {c["name"] for c in inspector.get_columns("users")}
    needed = {
        "username": "VARCHAR",
        "password_hash": "VARCHAR",
        "is_admin": "BOOLEAN DEFAULT 0" if is_sqlite else "BOOLEAN DEFAULT FALSE",
    }

    with engine.connect() as conn:
        for col, col_type in needed.items():
            if col not in existing_cols:
                try:
                    conn.execute(text(f"ALTER TABLE users ADD COLUMN {col} {col_type}"))
                    conn.commit()
                    print(f"  ✓ Added column users.{col}")
                except Exception as e:
                    print(f"  ! Could not add users.{col}: {e}")

        # Make email nullable if it isn't already (SQLite doesn't support this,
        # but it was defined NOT NULL before — existing rows are fine as-is)


def ensure_admin():
    """Create or update the admin user from env settings."""
    db = SessionLocal()
    try:
        admin = db.query(models.User).filter(
            models.User.username == settings.ADMIN_USERNAME
        ).first()

        if admin:
            # Sync password in case it changed in env
            admin.password_hash = hash_password(settings.ADMIN_PASSWORD)
            admin.is_admin = True
            admin.is_active = True
            db.commit()
            print(f"✓ Admin user '{settings.ADMIN_USERNAME}' ready")
        else:
            admin = models.User(
                username=settings.ADMIN_USERNAME,
                email=settings.ADMIN_EMAIL,
                name="Admin",
                password_hash=hash_password(settings.ADMIN_PASSWORD),
                is_admin=True,
                is_active=True,
            )
            db.add(admin)
            db.commit()
            print(f"✓ Admin user '{settings.ADMIN_USERNAME}' created (password from ADMIN_PASSWORD env var)")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Run migrations then create admin
    run_db_migrations()
    Base.metadata.create_all(bind=engine)
    ensure_admin()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    description="Interview Tracker — track your job applications, interviews and offers",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(companies.router)
app.include_router(applications.router)
app.include_router(interviews.router)
app.include_router(contacts.router)

# Serve static frontend — use absolute path so it works both locally and on Vercel
static_dir = str(Path(__file__).resolve().parent.parent / "static")
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

    @app.get("/")
    async def serve_index():
        return FileResponse(os.path.join(static_dir, "index.html"))

    @app.get("/{path:path}")
    async def serve_spa(path: str):
        file_path = os.path.join(static_dir, path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(static_dir, "index.html"))
