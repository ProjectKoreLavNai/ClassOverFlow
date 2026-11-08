from collections.abc import AsyncIterator

from fastapi import Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.connection import engine, get_db

async def get_db_with_user_context(
    user: dict = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_db),
) -> AsyncIterator[AsyncSession | None]:
    if session is not None:
        user_id = user.get("user_id")
        role = user.get("role")
        if not isinstance(user_id, int) or not role:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Database access requires a valid user identity",
            )
        target_ctx = (user_id, role.upper())
        if getattr(session, "info", {}).get("rls_context_set") != target_ctx:
            await session.execute(
                text(
                    "SELECT set_config('app.current_user_id', :uid, true), "
                    "set_config('app.current_user_role', :role, true)"
                ),
                {"uid": str(user_id), "role": role.upper()},
            )
            if hasattr(session, "info"):
                session.info["rls_context_set"] = target_ctx
    yield session


async def check_database_connection() -> None:
    async with engine.connect() as connection:
        result = await connection.execute(
            text(
                "SELECT "
                "to_regprocedure('public.app_authenticate_user(text)') IS NOT NULL "
                "AND to_regprocedure('public.app_register_user(text,text,text,text,text,text)') IS NOT NULL "
                "AND to_regprocedure('public.app_get_user_profile(integer)') IS NOT NULL "
                "AND to_regprocedure('public.app_update_user_profile(integer,text,text,text,text,text)') IS NOT NULL "
                "AND to_regprocedure('public.app_find_course_by_code(text)') IS NOT NULL "
                "AND to_regprocedure('public.app_hash_course_code(text)') IS NOT NULL "
                "AND to_regprocedure('public.app_course_code_exists(text,integer)') IS NOT NULL "
                "AND to_regprocedure('public.app_current_user_teaches_course(integer)') IS NOT NULL "
                "AND to_regprocedure('public.app_current_user_enrolled_in_course(integer)') IS NOT NULL "
                "AND to_regprocedure('public.current_app_user_id()') IS NOT NULL "
                "AND to_regprocedure('public.current_app_user_role()') IS NOT NULL "
                "AND to_regclass('public.token_revocations') IS NOT NULL "
                "AND EXISTS (SELECT 1 FROM information_schema.columns "
                "WHERE table_schema = 'public' AND table_name = 'courses' "
                "AND column_name = 'marks_distribution')"
            )
        )
        if not result.scalar_one():
            raise RuntimeError(
                "Required database functions, tables, or columns are missing; apply the supplied "
                "security SQL and all application database migrations"
            )
