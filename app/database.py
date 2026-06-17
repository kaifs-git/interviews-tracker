from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from .config import settings
import os

# Absolute path to the project root (works both locally and on Vercel)
BASE_DIR = Path(__file__).resolve().parent.parent

if settings.DATABASE_URL.startswith("sqlite"):
    # On Vercel the filesystem is read-only except /tmp — warn if SQLite is used there
    if os.environ.get("VERCEL"):
        import warnings
        warnings.warn(
            "SQLite is not persistent on Vercel. "
            "Set DATABASE_URL to a PostgreSQL URL (e.g., Neon free tier at neon.tech)."
        )
    data_dir = BASE_DIR / "data"
    os.makedirs(data_dir, exist_ok=True)

# SQLite needs check_same_thread=False; PostgreSQL does not
connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(settings.DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
