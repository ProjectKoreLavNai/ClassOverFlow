from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.security import decode_access_token, ensure_token_not_revoked
from app.db.connection import get_db

security_scheme = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    session: AsyncSession | None = Depends(get_db),
) -> dict:
    token = credentials.credentials
    payload = decode_access_token(token)
    await ensure_token_not_revoked(payload, session)
    email = payload.get("sub")
    role = payload.get("role")
    user_id = payload.get("uid")

    if not email or not role:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
    if settings.storage_backend == "database" and (not isinstance(user_id, int) or user_id < 1):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token is missing its user identity")

    return {"email": email, "role": str(role).lower(), "user_id": user_id}


def require_roles(*allowed_roles: str):
    async def dependency(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in allowed_roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        return user

    return dependency
