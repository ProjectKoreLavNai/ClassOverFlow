from fastapi import APIRouter, Depends, Query, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_roles
from app.db.database import get_db, get_db_with_user_context
from app.schemas.auth import (
    AdminUserUpdate,
    RefreshRequest,
    ResetPasswordRequest,
    UserLogin,
    UserRegister,
    UserUpdate,
    VerifyResetEmailRequest,
)
from app.services.auth_service import AuthService

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])
users_router = APIRouter(prefix="/api/v1/users", tags=["Users"])
security_scheme = HTTPBearer()


@router.post("/register", status_code=201)
async def register(payload: UserRegister, session: AsyncSession | None = Depends(get_db)):
    user = await AuthService.register(payload, session)
    return {"data": user}


@router.post("/login")
async def login(payload: UserLogin, session: AsyncSession | None = Depends(get_db)):
    token_data = await AuthService.login(payload, session)
    return {"data": token_data}


@router.post("/forgot-password/verify")
async def verify_reset_email(
    payload: VerifyResetEmailRequest, session: AsyncSession | None = Depends(get_db)
):
    return {"data": await AuthService.verify_reset_email(payload.email, session)}


@router.post("/forgot-password/reset")
async def reset_password(
    payload: ResetPasswordRequest, session: AsyncSession | None = Depends(get_db)
):
    return {"data": await AuthService.reset_password(payload, session)}


@router.post("/refresh")
async def refresh(
    payload: RefreshRequest,
    session: AsyncSession | None = Depends(get_db),
):
    return {"data": await AuthService.refresh(payload.refresh_token, session)}


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    payload: RefreshRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    session: AsyncSession | None = Depends(get_db),
):
    await AuthService.logout(
        credentials.credentials,
        payload.refresh_token,
        session,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me")
async def me(
    user: dict = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_db_with_user_context),
):
    return {"data": await AuthService.get_profile(user, session)}


@users_router.get("/me")
async def get_user_profile(
    user: dict = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_db_with_user_context),
):
    return {"data": await AuthService.get_profile(user, session)}


@users_router.get("")
async def list_users(
    role: str | None = Query(default=None, pattern="^(student|teacher|admin|cr)$"),
    search: str | None = Query(default=None, min_length=1, max_length=150),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: dict = Depends(require_roles("admin")),
    session: AsyncSession | None = Depends(get_db_with_user_context),
):
    return {
        "data": await AuthService.list_users(
            user,
            role=role,
            search=search,
            limit=limit,
            offset=offset,
            session=session,
        )
    }


@users_router.patch("/me")
async def update_user_profile(
    payload: UserUpdate,
    user: dict = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_db_with_user_context),
):
    return {
        "data": await AuthService.update_profile(
            user,
            payload.model_dump(exclude_unset=True),
            session,
        )
    }


@users_router.patch("/{user_id}")
async def admin_update_user(
    user_id: int,
    payload: AdminUserUpdate,
    user: dict = Depends(require_roles("admin")),
    session: AsyncSession | None = Depends(get_db_with_user_context),
):
    return {
        "data": await AuthService.update_admin_user(
            user,
            user_id,
            payload.model_dump(exclude_unset=True),
            session,
        )
    }


@users_router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_user(
    user_id: int,
    user: dict = Depends(require_roles("admin")),
    session: AsyncSession | None = Depends(get_db_with_user_context),
):
    await AuthService.delete_admin_user(user, user_id, session)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
