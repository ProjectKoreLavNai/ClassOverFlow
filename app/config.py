import re
from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url
from dotenv import dotenv_values


_PROJECT_ENV_FILE = Path(__file__).resolve().parents[1] / ".env"
_PLACEHOLDER_JWT_KEYS = {
    "replace-with-a-random-secret-of-at-least-32-bytes",
    "dev-secret-key-change-before-production-32-bytes",
}


class Settings(BaseSettings):
    app_name: str = "ClassOverFlow"
    environment: str = "development"
    storage_backend: Literal["memory", "database"] = "database"
    jwt_secret_key: str = Field(min_length=32)
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    database_url: str = "postgresql://user:password@localhost:5432/classoverflow"
    db_echo: bool = False
    db_pool_min_size: int = 5
    db_pool_max_size: int = 20

    @field_validator("jwt_secret_key")
    @classmethod
    def reject_placeholder_jwt_key(cls, value: str) -> str:
        normalized = value.strip().casefold()
        if normalized in _PLACEHOLDER_JWT_KEYS:
            file_key = dotenv_values(_PROJECT_ENV_FILE).get("JWT_SECRET_KEY")
            if isinstance(file_key, str) and file_key.strip().casefold() not in _PLACEHOLDER_JWT_KEYS:
                value = file_key
                normalized = value.strip().casefold()
        if (
            len(value) < 32
            or re.search(r"(replace|change.?me|dummy|example|placeholder)", normalized)
            or normalized in _PLACEHOLDER_JWT_KEYS
        ):
            raise ValueError(
                "JWT_SECRET_KEY must be a unique random secret of at least 32 characters; "
                "replace the placeholder in the project .env or process environment"
            )
        return value

    @field_validator("database_url")
    @classmethod
    def use_async_postgres_driver(cls, value: str) -> str:
        url = make_url(value)
        if url.drivername in {"postgres", "postgresql"}:
            url = url.set(drivername="postgresql+asyncpg")
        elif url.drivername != "postgresql+asyncpg":
            raise ValueError("DATABASE_URL must use PostgreSQL")
        query = dict(url.query)
        if "sslmode" in query:
            if "ssl" in query:
                raise ValueError("DATABASE_URL cannot specify both ssl and sslmode")
            query["ssl"] = query.pop("sslmode")
            url = url.set(query=query)
        return url.render_as_string(hide_password=False)

    @model_validator(mode="after")
    def validate_database_pool(self) -> "Settings":
        if self.db_pool_min_size < 1:
            raise ValueError("DB_POOL_MIN_SIZE must be at least 1")
        if self.db_pool_max_size < self.db_pool_min_size:
            raise ValueError("DB_POOL_MAX_SIZE must be greater than or equal to DB_POOL_MIN_SIZE")
        return self

    model_config = SettingsConfigDict(
        env_file=_PROJECT_ENV_FILE,
        env_file_encoding="utf-8",
        case_sensitive=False,
    )


settings = Settings()
