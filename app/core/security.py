import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
import jwt
from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.repositories.in_memory_store import InMemoryStore


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed_password.encode("utf-8"))


def create_access_token(subject: str, role: str, user_id: int | None = None) -> str:
    return _create_token(
        subject,
        role,
        user_id=user_id,
        token_type="access",
        expires_in=timedelta(minutes=settings.access_token_expire_minutes),
    )


def create_refresh_token(subject: str, role: str, user_id: int | None = None) -> str:
    return _create_token(subject, role, user_id=user_id, token_type="refresh", expires_in=timedelta(days=7))


def _create_token(
    subject: str,
    role: str,
    *,
    user_id: int | None,
    token_type: str,
    expires_in: timedelta,
) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,
        "role": role,
        "type": token_type,
        "jti": secrets.token_urlsafe(16),
        "exp": now + expires_in,
        "iat": now,
    }
    if user_id is not None:
        payload["uid"] = user_id
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str, *, expected_type: str = "access") -> dict[str, Any]:
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        if payload.get("type") != expected_type or payload.get("jti") in InMemoryStore.revoked_tokens:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or revoked token")
        return payload
    except HTTPException:
        raise
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc


async def ensure_token_not_revoked(payload: dict[str, Any], session: AsyncSession | None = None) -> None:
    token_id = payload.get("jti")
    if not isinstance(token_id, str):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    if session is None:
        if token_id in InMemoryStore.revoked_tokens:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or revoked token")
        return

    result = await session.execute(
        text("SELECT EXISTS (SELECT 1 FROM public.token_revocations WHERE jti = :jti)"),
        {"jti": token_id},
    )
    if result.scalar_one():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or revoked token")


async def revoke_token(payload: dict[str, Any], session: AsyncSession | None = None) -> None:
    token_id = payload.get("jti")
    expires_at = payload.get("exp")
    if not isinstance(token_id, str) or not isinstance(expires_at, (int, float)):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    if session is None:
        InMemoryStore.revoked_tokens.add(token_id)
        return

    await session.execute(
        text("DELETE FROM public.token_revocations WHERE expires_at <= now()")
    )
    result = await session.execute(
        text(
            "INSERT INTO public.token_revocations (jti, expires_at) "
            "VALUES (:jti, :expires_at) ON CONFLICT (jti) DO NOTHING RETURNING jti"
        ),
        {
            "jti": token_id,
            "expires_at": datetime.fromtimestamp(expires_at, tz=timezone.utc),
        },
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or revoked token")
