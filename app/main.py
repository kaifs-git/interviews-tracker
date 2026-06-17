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
from .routers import auth, companies, applications, interviews, contacts, admin
from .routers.email_agent import router as email_router
from .routers.push import router as push_router
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
        "is_approved": "BOOLEAN DEFAULT 1" if is_sqlite else "BOOLEAN DEFAULT TRUE",
        # Default TRUE so existing users aren't locked out on upgrade
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

        # Migrate source_email_message_id into job_applications
        if "job_applications" in inspector.get_table_names():
            app_cols = {c["name"] for c in inspector.get_columns("job_applications")}
            if "source_email_message_id" not in app_cols:
                try:
                    conn.execute(text("ALTER TABLE job_applications ADD COLUMN source_email_message_id VARCHAR"))
                    conn.commit()
                    print("  ✓ Added column job_applications.source_email_message_id")
                except Exception as e:
                    print(f"  ! Could not add job_applications.source_email_message_id: {e}")

        # Migrate source_email_message_id into interview_rounds
        if "interview_rounds" in inspector.get_table_names():
            ir_cols = {c["name"] for c in inspector.get_columns("interview_rounds")}
            if "source_email_message_id" not in ir_cols:
                try:
                    conn.execute(text("ALTER TABLE interview_rounds ADD COLUMN source_email_message_id VARCHAR"))
                    conn.commit()
                    print("  ✓ Added column interview_rounds.source_email_message_id")
                except Exception as e:
                    print(f"  ! Could not add interview_rounds.source_email_message_id: {e}")


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
            admin.is_approved = True
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
                is_approved=True,
            )
            db.add(admin)
            db.commit()
            print(f"✓ Admin user '{settings.ADMIN_USERNAME}' created (password from ADMIN_PASSWORD env var)")
    finally:
        db.close()


def _ensure_vapid_keys():
    """Generate VAPID keys if not already present in SystemSettings."""
    from .services.settings_service import get_setting, set_setting
    db = SessionLocal()
    try:
        existing_pub = get_setting(db, "vapid_public_key")
        existing_priv = get_setting(db, "vapid_private_key")
        if existing_pub and existing_priv:
            return
        try:
            from py_vapid import Vapid
            v = Vapid()
            v.generate_keys()
            # py_vapid stores keys as PEM; export as base64url for webpush
            import base64
            pub_raw = v.public_key.public_bytes(
                __import__("cryptography.hazmat.primitives.serialization", fromlist=["Encoding", "PublicFormat"]).Encoding.X962,
                __import__("cryptography.hazmat.primitives.serialization", fromlist=["Encoding", "PublicFormat"]).PublicFormat.UncompressedPoint,
            )
            priv_raw = v.private_key.private_bytes(
                __import__("cryptography.hazmat.primitives.serialization", fromlist=["Encoding", "PrivateFormat", "NoEncryption"]).Encoding.PEM,
                __import__("cryptography.hazmat.primitives.serialization", fromlist=["Encoding", "PrivateFormat", "NoEncryption"]).PrivateFormat.TraditionalOpenSSL,
                __import__("cryptography.hazmat.primitives.serialization", fromlist=["Encoding", "PrivateFormat", "NoEncryption"]).NoEncryption(),
            )
            pub_b64 = base64.urlsafe_b64encode(pub_raw).rstrip(b"=").decode()
            priv_pem = priv_raw.decode()
            set_setting(db, "vapid_public_key", pub_b64)
            set_setting(db, "vapid_private_key", priv_pem)
            print("  ✓ VAPID keys generated")
        except Exception as e:
            print(f"  ! Could not generate VAPID keys: {e}")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Run migrations then create tables and admin
    run_db_migrations()
    Base.metadata.create_all(bind=engine)
    ensure_admin()
    _ensure_vapid_keys()

    # Start background scheduler only when not running on Vercel (serverless)
    if os.environ.get("VERCEL") != "1":
        from .services.settings_service import get_setting
        from .services.scheduler import start_scheduler
        db = SessionLocal()
        try:
            interval_str = get_setting(db, "email_polling_interval_minutes", "15")
            try:
                interval_minutes = int(interval_str)
            except (ValueError, TypeError):
                interval_minutes = 15
        finally:
            db.close()
        start_scheduler(interval_minutes)

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
app.include_router(admin.router)
app.include_router(email_router)
app.include_router(push_router)

import struct
import zlib
import math
from fastapi import Response as FastAPIResponse


def _generate_icon_png(size: int) -> bytes:
    """Generate a simple indigo-circle PNG icon with a white briefcase."""
    half = size / 2
    circ_r = size * 0.46
    bg = (99, 102, 241)   # indigo
    fg = (255, 255, 255)  # white
    out = (248, 250, 252) # slate-50

    rows = []
    for y in range(size):
        row = bytearray([0])  # PNG filter: None
        for x in range(size):
            dx, dy = x - half, y - half
            if math.sqrt(dx*dx + dy*dy) > circ_r:
                row.extend(out)
            else:
                bx1, bx2 = size*0.22, size*0.78
                by1, by2 = size*0.44, size*0.78
                hx1, hx2 = size*0.36, size*0.64
                hy1, hy2 = size*0.27, size*0.44
                hxi1, hxi2 = size*0.43, size*0.57
                hyi2 = size*0.44

                in_body = bx1 <= x <= bx2 and by1 <= y <= by2
                in_handle_o = hx1 <= x <= hx2 and hy1 <= y <= hy2
                in_handle_i = hxi1 <= x <= hxi2 and hy1+size*0.04 <= y <= hyi2
                in_handle = in_handle_o and not in_handle_i

                row.extend(fg if (in_body or in_handle) else bg)
        rows.append(bytes(row))

    raw = b''.join(rows)
    compressed = zlib.compress(raw, 6)

    def png_chunk(name, data):
        crc = zlib.crc32(name + data) & 0xffffffff
        return struct.pack('>I', len(data)) + name + data + struct.pack('>I', crc)

    return (
        b'\x89PNG\r\n\x1a\n' +
        png_chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)) +
        png_chunk(b'IDAT', compressed) +
        png_chunk(b'IEND', b'')
    )


@app.get("/icon/{size}")
async def app_icon(size: int):
    if size not in (72, 96, 128, 144, 152, 192, 384, 512):
        size = 192
    png = _generate_icon_png(size)
    return FastAPIResponse(content=png, media_type="image/png",
                     headers={"Cache-Control": "public, max-age=86400"})


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
