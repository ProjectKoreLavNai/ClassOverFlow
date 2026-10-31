from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


_COMMENT_FIELDS = (
    "ac.comment_id, ac.announcement_id, ac.user_id, ac.comment_text, ac.created_at, "
    "COALESCE(s.full_name, t.full_name) AS author_name, "
    "COALESCE(s.email, t.email) AS author_email, u.role AS author_role"
)
_COMMENT_FROM = (
    "FROM public.announcement_comments ac "
    "JOIN public.users u ON u.user_id = ac.user_id "
    "LEFT JOIN public.students s ON s.student_id = ac.user_id "
    "LEFT JOIN public.teachers t ON t.teacher_id = ac.user_id"
)


class AnnouncementCommentRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, *, announcement_id: int, user_id: int, comment_text: str) -> dict:
        result = await self.session.execute(
            text(
                "INSERT INTO public.announcement_comments (announcement_id, user_id, comment_text) "
                "VALUES (:announcement_id, :user_id, :comment_text) "
                "RETURNING comment_id"
            ),
            {
                "announcement_id": announcement_id,
                "user_id": user_id,
                "comment_text": comment_text,
            },
        )
        comment_id = result.scalar_one()
        comment = await self.get_by_id(comment_id)
        if comment is None:
            raise RuntimeError("Inserted announcement comment could not be reloaded")
        return comment

    async def list_for_announcement(self, announcement_id: int) -> list[dict]:
        result = await self.session.execute(
            text(
                f"SELECT {_COMMENT_FIELDS} {_COMMENT_FROM} "
                "WHERE ac.announcement_id = :announcement_id ORDER BY ac.created_at, ac.comment_id"
            ),
            {"announcement_id": announcement_id},
        )
        return [dict(row) for row in result.mappings().all()]

    async def get_by_id(self, comment_id: int) -> dict | None:
        result = await self.session.execute(
            text(
                f"SELECT {_COMMENT_FIELDS} {_COMMENT_FROM} "
                "WHERE ac.comment_id = :comment_id"
            ),
            {"comment_id": comment_id},
        )
        row = result.mappings().one_or_none()
        return dict(row) if row is not None else None

    async def is_enrolled(self, course_id: int, student_id: int) -> bool:
        result = await self.session.execute(
            text(
                "SELECT EXISTS (SELECT 1 FROM public.enrollments "
                "WHERE course_id = :course_id AND student_id = :student_id)"
            ),
            {"course_id": course_id, "student_id": student_id},
        )
        return bool(result.scalar_one())

    async def update(self, comment_id: int, comment_text: str) -> dict | None:
        result = await self.session.execute(
            text(
                "UPDATE public.announcement_comments SET comment_text = :comment_text "
                "WHERE comment_id = :comment_id RETURNING comment_id"
            ),
            {"comment_id": comment_id, "comment_text": comment_text},
        )
        if result.scalar_one_or_none() is None:
            return None
        return await self.get_by_id(comment_id)

    async def delete(self, comment_id: int) -> bool:
        result = await self.session.execute(
            text(
                "DELETE FROM public.announcement_comments WHERE comment_id = :comment_id"
            ),
            {"comment_id": comment_id},
        )
        return result.rowcount > 0
