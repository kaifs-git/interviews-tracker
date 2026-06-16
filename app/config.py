from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    APP_NAME: str = "InterviewsTracker"
    SECRET_KEY: str = "change-this-to-a-long-random-secret-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_DAYS: int = 7

    # ─── Auth methods ───────────────────────────────────────────────────────────
    # Comma-separated list of enabled auth methods: password, google
    # Examples:
    #   AUTH_METHODS=password             → only username/password
    #   AUTH_METHODS=google               → only Google OAuth
    #   AUTH_METHODS=password,google      → both
    AUTH_METHODS: str = "password"

    # Allow new users to self-register (password auth only)
    ALLOW_REGISTRATION: bool = True

    # ─── Admin credentials (read from env, never hardcoded) ─────────────────────
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = "admin@123"
    ADMIN_EMAIL: str = "admin@interviews-tracker.local"

    # ─── Google OAuth (only needed if AUTH_METHODS includes "google") ────────────
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    BASE_URL: str = "http://localhost:8000"

    # ─── Database ─────────────────────────────────────────────────────────────────
    DATABASE_URL: str = "sqlite:///./data/interviews.db"

    class Config:
        env_file = ".env"
        extra = "ignore"

    @property
    def auth_methods_list(self) -> list[str]:
        return [m.strip().lower() for m in self.AUTH_METHODS.split(",") if m.strip()]

    @property
    def password_auth_enabled(self) -> bool:
        return "password" in self.auth_methods_list

    @property
    def google_auth_enabled(self) -> bool:
        return "google" in self.auth_methods_list and bool(self.GOOGLE_CLIENT_ID)


settings = Settings()
