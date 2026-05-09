"""App settings, loaded from environment / .env via pydantic-settings.

Add new config:
    1. Add a typed field to `Settings`.
    2. Document it in `.env.example` (root of the repo).
    3. Read via `from app.config import settings`.
"""

from functools import lru_cache

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    anthropic_api_key: SecretStr

    openrouter_api_key: SecretStr
    embed_model: str = "openai/text-embedding-3-small"
    embed_base_url: str = "https://openrouter.ai/api/v1"

    agent_model: str = "claude-haiku-4-5"

    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
    ]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
