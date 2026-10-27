from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class UserRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(
        self,
        *,
        full_name: str,
        username: str,
        email: str,
        password_hash: str,
        role: str,
        phone: str | None,
    ) -> dict:
        result = await self.session.execute(
            text(
                "SELECT * FROM public.app_register_user("
                ":role, :full_name, :username, :email, :password_hash, :phone)"
            ),
            {
                "role": role,
                "full_name": full_name,
                "username": username,
                "email": email,
                "password_hash": password_hash,
                "phone": phone,
            },
        )
        return dict(result.mappings().one())

    async def authenticate(self, email: str) -> dict | None:
        result = await self.session.execute(
            text("SELECT * FROM public.app_authenticate_user(:email)"),
            {"email": email},
        )
        row = result.mappings().one_or_none()
        return dict(row) if row is not None else None

    async def get_profile(self, user_id: int) -> dict | None:
        result = await self.session.execute(
            text("SELECT * FROM public.app_get_user_profile(:user_id)"),
            {"user_id": user_id},
        )
        row = result.mappings().one_or_none()
        return dict(row) if row is not None else None

    async def update_profile(self, user_id: int, role: str, values: dict) -> dict | None:
        current = await self.get_profile(user_id)
        if current is None:
            return None
        updated = {**current, **values}
        result = await self.session.execute(
            text(
                "SELECT * FROM public.app_update_user_profile("
                ":user_id, :role, :full_name, :username, :email, :phone)"
            ),
            {
                "user_id": user_id,
                "role": role.upper(),
                "full_name": updated["full_name"],
                "username": updated["username"],
                "email": str(updated["email"]).casefold(),
                "phone": updated.get("phone"),
            },
        )
        row = result.mappings().one_or_none()
        return dict(row) if row is not None else None

    async def list_users(
        self,
        *,
        role: str | None = None,
        search: str | None = None,
        limit: int = 20,
    ) -> list[dict]:
        result = await self.session.execute(
            text(
                "SELECT * FROM ("
                "SELECT u.user_id, u.role, s.full_name, s.username, s.email, s.phone "
                "FROM public.users u JOIN public.students s ON s.student_id = u.user_id "
                "WHERE u.role = 'STUDENT' "
                "UNION ALL "
                "SELECT u.user_id, u.role, t.full_name, t.username, t.email, t.phone "
                "FROM public.users u JOIN public.teachers t ON t.teacher_id = u.user_id "
                "WHERE u.role = 'TEACHER' "
                "UNION ALL "
                "SELECT u.user_id, u.role, a.full_name, a.username, a.email, NULL::varchar AS phone "
                "FROM public.users u JOIN public.admins a ON a.admin_id = u.user_id "
                "WHERE u.role = 'ADMIN'"
                ") profiles "
                "WHERE (CAST(:role AS text) IS NULL OR role = upper(CAST(:role AS text))) "
                "AND (CAST(:search AS text) IS NULL "
                "OR full_name ILIKE '%' || CAST(:search AS text) || '%' "
                "OR username ILIKE '%' || CAST(:search AS text) || '%' "
                "OR email ILIKE '%' || CAST(:search AS text) || '%') "
                "ORDER BY user_id LIMIT :limit"
            ),
            {"role": role, "search": search, "limit": limit},
        )
        return [dict(row) for row in result.mappings().all()]
