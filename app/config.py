from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    APP_NAME: str = "InterviewsTracker"
    SECRET_KEY: str = "change-this-to-a-long-random-secret-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_DAYS: int = 7

    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    BASE_URL: str = "http://localhost:8000"

    DATABASE_URL: str = "sqlite:///./data/interviews.db"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
