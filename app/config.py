"""Application configuration from environment variables.

Never hardcode secrets. SERPAPI_KEY is optional in Slice 1 (no live
calls yet) but the plumbing is established now so later slices need
no config refactor.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    SERPAPI_KEY: str = ""
    DATABASE_URL: str = "sqlite:///./jobsetu.db"
    ENABLE_NEWS: bool = False
    ENABLE_MAPS: bool = False
    ENABLE_TRENDS: bool = False
    ENABLE_PDF: bool = False
    EVIDENCE_MAX_JOBS: int = 5
    EVIDENCE_TTL_HOURS: int = 168  # 7 days
    NEWS_MAX_JOBS: int = 3
    NEWS_TTL_HOURS: int = 168  # 7 days


@lru_cache
def get_settings() -> Settings:
    return Settings()
