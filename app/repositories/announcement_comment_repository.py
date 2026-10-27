from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


_COMMENT_FIELDS = "comment_id, announcement_id, user_id, comment_text, created_at"


class AnnouncementCommentRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, *, announcement_id: int, user_id: int, comment_text: str) -> dict:
        result = await self.session.execute(
            text(
                "INSERT INTO public.announcement_comments (announcement_id, user_id, comment_text) "
                "VALUES (:announcement_id, :user_id, :comment_text) "
                f"RETURNING {_COMMENT_FIELDS}"
            ),
            {
                "announcement_id": announcement_id,
                "user_id": user_id,
                "comment_text": comment_text,
            },
        )
        return dict(result.mappings().one())

    async def list_for_announcement(self, announcement_id: int) -> list[dict]:
        result = await self.session.execute(
            text(
                f"SELECT {_COMMENT_FIELDS} FROM public.announcement_comments "
                "WHERE announcement_id = :announcement_id ORDER BY created_at, comment_id"
            ),
            {"announcement_id": announcement_id},
        )
        return [dict(row) for row in result.mappings().all()]

    async def get_by_id(self, comment_id: int) -> dict | None:
        result = await self.session.execute(
            text(
                f"SELECT {_COMMENT_FIELDS} FROM public.announcement_comments "
                "WHERE comment_id = :comment_id"
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

    async def delete(self, comment_id: int) -> bool:
        result = await self.session.execute(
            text(
                "DELETE FROM public.announcement_comments WHERE comment_id = :comment_id"
            ),
            {"comment_id": comment_id},
        )
        return result.rowcount > 0
