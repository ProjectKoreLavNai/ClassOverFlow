from __future__ import annotations

from fastapi import HTTPException, status

from app.repositories.in_memory_store import InMemoryStore
from app.schemas.announcement import AnnouncementCreate


class AnnouncementService:
    @staticmethod
    def create_announcement(course_id: int, payload: AnnouncementCreate, author_email: str) -> dict:
        if course_id not in InMemoryStore.courses:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")

        announcement_id = max(InMemoryStore.announcements.keys(), default=0) + 1
        announcement = {
            "announcement_id": announcement_id,
            "course_id": course_id,
            "title": payload.title,
            "content": payload.content,
            "target_platform": payload.target_platform,
            "author_email": author_email,
        }
        InMemoryStore.announcements[announcement_id] = announcement
        return announcement

    @staticmethod
    def list_announcements(course_id: int) -> list[dict]:
        return [entry for entry in InMemoryStore.announcements.values() if entry["course_id"] == course_id]
