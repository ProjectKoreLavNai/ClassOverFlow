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
        offset: int = 0,
    ) -> list[dict]:
        result = await self.session.execute(
            text(
                "SELECT * FROM ("
                "SELECT u.user_id, CASE WHEN s.cr_status THEN 'cr' ELSE 'student' END AS role, "
                "s.full_name, s.username, s.email, s.phone, s.is_verified "
                "FROM public.users u JOIN public.students s ON s.student_id = u.user_id "
                "WHERE u.role = 'STUDENT' "
                "UNION ALL "
                "SELECT u.user_id, 'teacher' AS role, t.full_name, t.username, t.email, t.phone, t.is_verified "
                "FROM public.users u JOIN public.teachers t ON t.teacher_id = u.user_id "
                "WHERE u.role = 'TEACHER' "
                "UNION ALL "
                "SELECT u.user_id, 'admin' AS role, a.full_name, a.username, a.email, "
                "NULL::varchar AS phone, a.is_verified "
                "FROM public.users u JOIN public.admins a ON a.admin_id = u.user_id "
                "WHERE u.role = 'ADMIN'"
                ") profiles "
                "WHERE (CAST(:role AS text) IS NULL OR role = lower(CAST(:role AS text))) "
                "AND (CAST(:search AS text) IS NULL "
                "OR full_name ILIKE '%' || CAST(:search AS text) || '%' "
                "OR username ILIKE '%' || CAST(:search AS text) || '%' "
                "OR email ILIKE '%' || CAST(:search AS text) || '%') "
                "ORDER BY user_id LIMIT :limit OFFSET :offset"
            ),
            {"role": role, "search": search, "limit": limit, "offset": offset},
        )
        return [dict(row) for row in result.mappings().all()]

    async def get_admin_user(self, user_id: int) -> dict | None:
        result = await self.session.execute(
            text(
                "SELECT u.user_id, u.role, "
                "COALESCE(s.full_name, t.full_name, a.full_name) AS full_name, "
                "COALESCE(s.username, t.username, a.username) AS username, "
                "COALESCE(s.email, t.email, a.email) AS email, "
                "COALESCE(s.password_hash, t.password_hash, a.password_hash) AS password_hash, "
                "COALESCE(s.phone, t.phone) AS phone, "
                "COALESCE(s.is_verified, t.is_verified, a.is_verified) AS is_verified, "
                "COALESCE(s.cr_status, FALSE) AS cr_status "
                "FROM public.users u "
                "LEFT JOIN public.students s ON s.student_id = u.user_id "
                "LEFT JOIN public.teachers t ON t.teacher_id = u.user_id "
                "LEFT JOIN public.admins a ON a.admin_id = u.user_id "
                "WHERE u.user_id = :user_id"
            ),
            {"user_id": user_id},
        )
        row = result.mappings().one_or_none()
        return dict(row) if row is not None else None

    async def update_admin_user(
        self,
        user_id: int,
        *,
        role: str | None,
        is_verified: bool | None,
    ) -> dict | None:
        await self.session.execute(
            text("SELECT user_id FROM public.users WHERE user_id = :user_id FOR UPDATE"),
            {"user_id": user_id},
        )
        current = await self.get_admin_user(user_id)
        if current is None:
            return None

        target_role = role or ("cr" if current["cr_status"] else current["role"].lower())
        verified = current["is_verified"] if is_verified is None else is_verified
        source_table, source_id = {
            "STUDENT": ("students", "student_id"),
            "TEACHER": ("teachers", "teacher_id"),
            "ADMIN": ("admins", "admin_id"),
        }[current["role"]]
        if target_role in ("student", "cr"):
            normalized_target = "STUDENT"
            target_table, target_id = "students", "student_id"
        elif target_role == "teacher":
            normalized_target = "TEACHER"
            target_table, target_id = "teachers", "teacher_id"
        else:
            normalized_target = "ADMIN"
            target_table, target_id = "admins", "admin_id"

        if current["role"] != normalized_target:
            if current["role"] == "TEACHER":
                result = await self.session.execute(
                    text("SELECT EXISTS (SELECT 1 FROM public.courses WHERE teacher_id = :user_id)"),
                    {"user_id": user_id},
                )
                if result.scalar_one():
                    raise ValueError("Move this teacher's courses before changing their role")
            if current["role"] == "STUDENT":
                result = await self.session.execute(
                    text(
                        "SELECT EXISTS (SELECT 1 FROM public.enrollments WHERE student_id = :user_id) "
                        "OR EXISTS (SELECT 1 FROM public.marks WHERE student_id = :user_id) "
                        "OR EXISTS (SELECT 1 FROM public.attendance_records WHERE student_id = :user_id) "
                        "OR EXISTS (SELECT 1 FROM public.submissions WHERE student_id = :user_id) "
                        "OR EXISTS (SELECT 1 FROM public.quiz_attempts WHERE student_id = :user_id) "
                        "OR EXISTS (SELECT 1 FROM public.lecture_notes WHERE created_by = :user_id) "
                        "OR EXISTS (SELECT 1 FROM public.deadline_notices WHERE posted_by = :user_id) "
                        "OR EXISTS (SELECT 1 FROM public.user_platforms WHERE student_id = :user_id)"
                    ),
                    {"user_id": user_id},
                )
                if result.scalar_one():
                    raise ValueError("This student's course history must be retained before changing their role")
            if current["role"] == "ADMIN":
                result = await self.session.execute(
                    text("SELECT COUNT(*) FROM public.users WHERE role = 'ADMIN'")
                )
                if result.scalar_one() <= 1:
                    raise ValueError("The last administrator account cannot be demoted")

            await self.session.execute(
                text(f"DELETE FROM public.{source_table} WHERE {source_id} = :user_id"),
                {"user_id": user_id},
            )
            if normalized_target == "STUDENT":
                await self.session.execute(
                    text(
                        "INSERT INTO public.students "
                        "(student_id, full_name, username, email, password_hash, phone, is_verified, cr_status) "
                        "VALUES (:user_id, :full_name, :username, :email, :password_hash, :phone, "
                        ":is_verified, :cr_status)"
                    ),
                    {
                        "user_id": user_id,
                        **current,
                        "is_verified": verified,
                        "cr_status": target_role == "cr",
                    },
                )
            elif normalized_target == "TEACHER":
                await self.session.execute(
                    text(
                        "INSERT INTO public.teachers "
                        "(teacher_id, full_name, username, email, password_hash, phone, is_verified) "
                        "VALUES (:user_id, :full_name, :username, :email, :password_hash, :phone, :is_verified)"
                    ),
                    {"user_id": user_id, **current, "is_verified": verified},
                )
            else:
                await self.session.execute(
                    text(
                        "INSERT INTO public.admins "
                        "(admin_id, full_name, username, email, password_hash, is_verified) "
                        "VALUES (:user_id, :full_name, :username, :email, :password_hash, :is_verified)"
                    ),
                    {"user_id": user_id, **current, "is_verified": verified},
                )

            await self.session.execute(
                text("UPDATE public.users SET role = :role WHERE user_id = :user_id"),
                {"role": normalized_target, "user_id": user_id},
            )
        else:
            await self.session.execute(
                text(
                    f"UPDATE public.{target_table} SET is_verified = :is_verified "
                    f"WHERE {target_id} = :user_id"
                ),
                {"is_verified": verified, "user_id": user_id},
            )
            if normalized_target == "STUDENT":
                await self.session.execute(
                    text("UPDATE public.students SET cr_status = :cr_status WHERE student_id = :user_id"),
                    {"cr_status": target_role == "cr", "user_id": user_id},
                )

        result = await self.session.execute(
            text(
                "SELECT profiles.user_id, profiles.role, profiles.full_name, profiles.username, "
                "profiles.email, profiles.phone, profiles.is_verified FROM ("
                "SELECT u.user_id, CASE WHEN s.cr_status THEN 'cr' ELSE 'student' END AS role, "
                "s.full_name, s.username, s.email, s.phone, s.is_verified "
                "FROM public.users u JOIN public.students s ON s.student_id = u.user_id WHERE u.role = 'STUDENT' "
                "UNION ALL SELECT u.user_id, 'teacher', t.full_name, t.username, t.email, t.phone, t.is_verified "
                "FROM public.users u JOIN public.teachers t ON t.teacher_id = u.user_id WHERE u.role = 'TEACHER' "
                "UNION ALL SELECT u.user_id, 'admin', a.full_name, a.username, a.email, NULL::varchar, a.is_verified "
                "FROM public.users u JOIN public.admins a ON a.admin_id = u.user_id WHERE u.role = 'ADMIN'"
                ") profiles WHERE profiles.user_id = :user_id"
            ),
            {"user_id": user_id},
        )
        row = result.mappings().one_or_none()
        return dict(row) if row is not None else None

    async def delete_admin_user(self, user_id: int) -> bool:
        result = await self.session.execute(
            text("SELECT role FROM public.users WHERE user_id = :user_id FOR UPDATE"),
            {"user_id": user_id},
        )
        role = result.scalar_one_or_none()
        if role is None:
            return False
        if role == "ADMIN":
            count = await self.session.execute(
                text("SELECT COUNT(*) FROM public.users WHERE role = 'ADMIN'")
            )
            if count.scalar_one() <= 1:
                raise ValueError("The last administrator account cannot be deleted")
        if role == "TEACHER":
            await self.session.execute(
                text("DELETE FROM public.courses WHERE teacher_id = :user_id"),
                {"user_id": user_id},
            )
        await self.session.execute(
            text("DELETE FROM public.users WHERE user_id = :user_id"),
            {"user_id": user_id},
        )
        return True

    async def reset_password(self, email: str, new_password_hash: str) -> bool:
        clean_email = email.strip().lower()
        auth_user = await self.authenticate(clean_email)
        if not auth_user:
            return False
        user_id = auth_user["user_id"]
        role = auth_user["role"].upper()

        if role in ("STUDENT", "CR"):
            await self.session.execute(
                text("UPDATE public.students SET password_hash = :hash WHERE student_id = :user_id"),
                {"hash": new_password_hash, "user_id": user_id},
            )
        elif role == "TEACHER":
            await self.session.execute(
                text("UPDATE public.teachers SET password_hash = :hash WHERE teacher_id = :user_id"),
                {"hash": new_password_hash, "user_id": user_id},
            )
        elif role == "ADMIN":
            await self.session.execute(
                text("UPDATE public.admins SET password_hash = :hash WHERE admin_id = :user_id"),
                {"hash": new_password_hash, "user_id": user_id},
            )
        else:
            await self.session.execute(
                text("UPDATE public.students SET password_hash = :hash WHERE student_id = :user_id"),
                {"hash": new_password_hash, "user_id": user_id},
            )
            await self.session.execute(
                text("UPDATE public.teachers SET password_hash = :hash WHERE teacher_id = :user_id"),
                {"hash": new_password_hash, "user_id": user_id},
            )
            await self.session.execute(
                text("UPDATE public.admins SET password_hash = :hash WHERE admin_id = :user_id"),
                {"hash": new_password_hash, "user_id": user_id},
            )
        await self.session.commit()
        return True

