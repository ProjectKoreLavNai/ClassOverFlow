from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.announcement_repository import AnnouncementRepository
from app.repositories.in_memory_store import InMemoryStore
from app.schemas.announcement import AnnouncementCreate, AnnouncementUpdate
from app.services.course_service import CourseService


class AnnouncementService:
    @staticmethod
    async def create_announcement(
        course_id: int,
        payload: AnnouncementCreate,
        author: dict,
        session: AsyncSession | None = None,
    ) -> dict:
        await CourseService.require_course_announcement_author(course_id, author, session)
        if session is not None:
            announcement = await AnnouncementRepository(session).create(
                course_id=course_id,
                author_id=author["user_id"],
                title=payload.title,
                content=payload.content,
            )
            await session.commit()
            return announcement

        announcement_id = max(InMemoryStore.announcements.keys(), default=0) + 1
        announcement = {
            "announcement_id": announcement_id,
            "course_id": course_id,
            "title": payload.title,
            "content": payload.content,
            "author_email": author["email"],
        }
        InMemoryStore.announcements[announcement_id] = announcement
        return announcement

    @staticmethod
    async def list_announcements(
        course_id: int,
        user: dict,
        session: AsyncSession | None = None,
    ) -> list[dict]:
        AnnouncementService._require_non_admin_access(user)
        await CourseService.require_course_access(course_id, user, session)
        if session is not None:
            return await AnnouncementRepository(session).list_for_course(course_id)
        return [
            entry
            for entry in InMemoryStore.announcements.values()
            if entry["course_id"] == course_id
        ]

    @staticmethod
    async def get_announcement(
        announcement_id: int,
        user: dict,
        session: AsyncSession | None = None,
    ) -> dict:
        AnnouncementService._require_non_admin_access(user)
        if session is not None:
            announcement = await AnnouncementRepository(session).get_by_id(announcement_id)
            if announcement is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Announcement not found")
            await CourseService.require_course_access(announcement["course_id"], user, session)
            return announcement
        announcement = AnnouncementService._get_announcement(announcement_id)
        await CourseService.require_course_access(announcement["course_id"], user)
        return announcement

    @staticmethod
    def _require_non_admin_access(user: dict) -> None:
        if user["role"] == "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admins cannot access announcements",
            )

    @staticmethod
    async def update_announcement(
        announcement_id: int,
        payload: AnnouncementUpdate,
        user: dict,
        session: AsyncSession | None = None,
    ) -> dict:
        updated = payload.model_dump(exclude_unset=True)
        if session is not None:
            announcement = await AnnouncementRepository(session).get_by_id(announcement_id)
            if announcement is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Announcement not found")
            await CourseService.require_course_owner(announcement["course_id"], user, session)
            result = await AnnouncementRepository(session).update(announcement_id, updated)
            if result is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Announcement not found")
            await session.commit()
            return result

        announcement = AnnouncementService._get_announcement(announcement_id)
        await CourseService.require_course_owner(announcement["course_id"], user)
        announcement.update(updated)
        return announcement

    @staticmethod
    async def delete_announcement(
        announcement_id: int,
        user: dict,
        session: AsyncSession | None = None,
    ) -> None:
        if session is not None:
            announcement = await AnnouncementRepository(session).get_by_id(announcement_id)
            if announcement is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Announcement not found")
            await CourseService.require_course_owner(announcement["course_id"], user, session)
            await AnnouncementRepository(session).delete(announcement_id)
            await session.commit()
            return
        announcement = AnnouncementService._get_announcement(announcement_id)
        await CourseService.require_course_owner(announcement["course_id"], user)
        del InMemoryStore.announcements[announcement_id]

    @staticmethod
    def _get_announcement(announcement_id: int) -> dict:
        announcement = InMemoryStore.announcements.get(announcement_id)
        if announcement is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Announcement not found")
        return announcement
