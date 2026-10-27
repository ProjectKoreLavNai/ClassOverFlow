from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


_COURSE_FIELDS = """
    c.course_id, c.teacher_id, c.course_name, c.course_code,
    c.description, c.syllabus, t.email AS teacher_email
"""
_COURSE_FROM = """
    FROM public.courses c
    JOIN public.teachers t ON t.teacher_id = c.teacher_id
"""


class CourseRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(
        self,
        *,
        course_name: str,
        course_code: str,
        description: str | None,
        syllabus: str | None,
        class_code_hash: str,
        teacher_id: int,
    ) -> dict:
        result = await self.session.execute(
            text(
                "INSERT INTO public.courses "
                "(course_name, course_code, description, syllabus, class_code_hash, teacher_id) "
                "VALUES (:course_name, :course_code, :description, :syllabus, :class_code_hash, :teacher_id) "
                "RETURNING course_id"
            ),
            {
                "course_name": course_name,
                "course_code": course_code,
                "description": description,
                "syllabus": syllabus,
                "class_code_hash": class_code_hash,
                "teacher_id": teacher_id,
            },
        )
        course = await self.get_by_id(result.scalar_one())
        if course is None:
            raise RuntimeError("Inserted course is not visible under the active RLS context")
        return course

    async def get_by_id(self, course_id: int) -> dict | None:
        result = await self.session.execute(
            text(f"SELECT {_COURSE_FIELDS} {_COURSE_FROM} WHERE c.course_id = :course_id"),
            {"course_id": course_id},
        )
        row = result.mappings().one_or_none()
        return dict(row) if row is not None else None

    async def list_for_user(self, user: dict) -> list[dict]:
        if user["role"] == "admin":
            access_filter = ""
            params = {}
        elif user["role"] == "teacher":
            access_filter = "WHERE c.teacher_id = :user_id"
            params = {"user_id": user["user_id"]}
        elif user["role"] == "student":
            access_filter = (
                "WHERE EXISTS (SELECT 1 FROM public.enrollments e "
                "WHERE e.course_id = c.course_id AND e.student_id = :user_id)"
            )
            params = {"user_id": user["user_id"]}
        else:
            return []

        result = await self.session.execute(
            text(f"SELECT {_COURSE_FIELDS} {_COURSE_FROM} {access_filter} ORDER BY c.course_id"),
            params,
        )
        return [dict(row) for row in result.mappings().all()]

    async def course_code_exists(self, course_code: str, exclude_id: int | None = None) -> bool:
        result = await self.session.execute(
            text("SELECT public.app_course_code_exists(:course_code, :exclude_id)"),
            {"course_code": course_code, "exclude_id": exclude_id},
        )
        return bool(result.scalar_one())

    async def hash_class_code(self, class_code: str) -> str:
        result = await self.session.execute(
            text("SELECT public.app_hash_course_code(:class_code)"),
            {"class_code": class_code},
        )
        return result.scalar_one()

    async def teacher_exists(self, teacher_id: int) -> bool:
        result = await self.session.execute(
            text("SELECT EXISTS (SELECT 1 FROM public.teachers WHERE teacher_id = :teacher_id)"),
            {"teacher_id": teacher_id},
        )
        return bool(result.scalar_one())

    async def is_enrolled(self, course_id: int, student_id: int) -> bool:
        result = await self.session.execute(
            text(
                "SELECT EXISTS (SELECT 1 FROM public.enrollments "
                "WHERE course_id = :course_id AND student_id = :student_id)"
            ),
            {"course_id": course_id, "student_id": student_id},
        )
        return bool(result.scalar_one())

    async def update(self, course_id: int, values: dict) -> dict | None:
        assignments = ", ".join(f"{column} = :{column}" for column in values)
        if assignments:
            await self.session.execute(
                text(f"UPDATE public.courses SET {assignments} WHERE course_id = :course_id"),
                {**values, "course_id": course_id},
            )
        return await self.get_by_id(course_id)

    async def delete(self, course_id: int) -> None:
        await self.session.execute(
            text("DELETE FROM public.courses WHERE course_id = :course_id"),
            {"course_id": course_id},
        )

    async def find_by_class_code(self, class_code: str) -> int | None:
        result = await self.session.execute(
            text("SELECT public.app_find_course_by_code(:class_code)"),
            {"class_code": class_code},
        )
        return result.scalar_one_or_none()

    async def enroll(self, course_id: int, student_id: int) -> None:
        await self.session.execute(
            text(
                "INSERT INTO public.enrollments (course_id, student_id) "
                "VALUES (:course_id, :student_id) ON CONFLICT (course_id, student_id) DO NOTHING"
            ),
            {"course_id": course_id, "student_id": student_id},
        )

    async def list_members(self, course_id: int) -> list[dict]:
        result = await self.session.execute(
            text(
                "SELECT e.student_id, s.full_name, s.username, s.email, e.enrolled_at "
                "FROM public.enrollments e "
                "JOIN public.students s ON s.student_id = e.student_id "
                "WHERE e.course_id = :course_id ORDER BY e.enrolled_at"
            ),
            {"course_id": course_id},
        )
        return [dict(row) for row in result.mappings().all()]
