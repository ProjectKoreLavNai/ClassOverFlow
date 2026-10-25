from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.announcement import Announcement


class AnnouncementRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, *, course_id: int, author_id: int, title: str, content: str, target_platform: str | None) -> Announcement:
        announcement = Announcement(
            course_id=course_id,
            author_id=author_id,
            title=title,
            content=content,
            target_platform=target_platform,
        )
        self.session.add(announcement)
        await self.session.commit()
        await self.session.refresh(announcement)
        return announcement

    async def list_for_course(self, course_id: int) -> list[Announcement]:
        result = await self.session.execute(select(Announcement).where(Announcement.course_id == course_id))
        return list(result.scalars().all())
