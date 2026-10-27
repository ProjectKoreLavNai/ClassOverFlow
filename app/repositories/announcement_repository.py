from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


_ANNOUNCEMENT_FIELDS = """
    a.announcement_id, a.course_id, a.posted_by, a.title, a.content,
    a.created_at, t.email AS author_email
"""
_ANNOUNCEMENT_FROM = """
    FROM public.announcements a
    JOIN public.teachers t ON t.teacher_id = a.posted_by
"""


class AnnouncementRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    @staticmethod
    def _serialize(row) -> dict:
        return dict(row)

    async def create(self, *, course_id: int, author_id: int, title: str, content: str) -> dict:
        result = await self.session.execute(
            text(
                "INSERT INTO public.announcements (course_id, posted_by, title, content) "
                "VALUES (:course_id, :author_id, :title, :content) "
                "RETURNING announcement_id"
            ),
            {
                "course_id": course_id,
                "author_id": author_id,
                "title": title,
                "content": content,
            },
        )
        announcement = await self.get_by_id(result.scalar_one())
        if announcement is None:
            raise RuntimeError("Inserted announcement is not visible under the active RLS context")
        return announcement

    async def get_by_id(self, announcement_id: int) -> dict | None:
        result = await self.session.execute(
            text(
                f"SELECT {_ANNOUNCEMENT_FIELDS} {_ANNOUNCEMENT_FROM} "
                "WHERE a.announcement_id = :announcement_id"
            ),
            {"announcement_id": announcement_id},
        )
        row = result.mappings().one_or_none()
        return self._serialize(row) if row is not None else None

    async def list_for_course(self, course_id: int) -> list[dict]:
        result = await self.session.execute(
            text(
                f"SELECT {_ANNOUNCEMENT_FIELDS} {_ANNOUNCEMENT_FROM} "
                "WHERE a.course_id = :course_id ORDER BY a.created_at DESC"
            ),
            {"course_id": course_id},
        )
        return [self._serialize(row) for row in result.mappings().all()]

    async def update(self, announcement_id: int, values: dict) -> dict | None:
        assignments = ", ".join(f"{column} = :{column}" for column in values)
        if assignments:
            await self.session.execute(
                text(
                    f"UPDATE public.announcements SET {assignments} "
                    "WHERE announcement_id = :announcement_id"
                ),
                {**values, "announcement_id": announcement_id},
            )
        return await self.get_by_id(announcement_id)

    async def delete(self, announcement_id: int) -> None:
        await self.session.execute(
            text("DELETE FROM public.announcements WHERE announcement_id = :announcement_id"),
            {"announcement_id": announcement_id},
        )
