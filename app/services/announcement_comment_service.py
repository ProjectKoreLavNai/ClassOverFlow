from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.announcement_comment_repository import AnnouncementCommentRepository
from app.repositories.announcement_repository import AnnouncementRepository
from app.repositories.in_memory_store import InMemoryStore
from app.schemas.announcement_comment import AnnouncementCommentCreate, AnnouncementCommentUpdate
from app.services.course_service import CourseService


class AnnouncementCommentService:
    @staticmethod
    async def list_comments(
        announcement_id: int,
        user: dict,
        session: AsyncSession | None = None,
    ) -> list[dict]:
        AnnouncementCommentService._require_non_admin_access(user)
        if session is not None:
            announcement = await AnnouncementRepository(session).get_by_id(announcement_id)
            if announcement is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Announcement not found")
            await CourseService.require_course_access(announcement["course_id"], user, session)
            return await AnnouncementCommentRepository(session).list_for_announcement(announcement_id)

        announcement = AnnouncementCommentService._get_announcement(announcement_id)
        await CourseService.require_course_access(announcement["course_id"], user)
        return [
            {
                **comment,
                "author_name": InMemoryStore.users.get(comment["user_email"], {}).get(
                    "full_name",
                    comment["user_email"].split("@")[0],
                ),
                "author_email": comment["user_email"],
                "author_role": InMemoryStore.users.get(comment["user_email"], {}).get(
                    "role",
                    "student",
                ),
            }
            for comment in InMemoryStore.announcement_comments.values()
            if comment["announcement_id"] == announcement_id
        ]

    @staticmethod
    async def create_comment(
        announcement_id: int,
        payload: AnnouncementCommentCreate,
        user: dict,
        session: AsyncSession | None = None,
    ) -> dict:
        AnnouncementCommentService._require_non_admin_access(user)
        if session is not None:
            announcement = await AnnouncementRepository(session).get_by_id(announcement_id)
            if announcement is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Announcement not found")
            course = await CourseService.require_course_access(announcement["course_id"], user, session)
            comments = AnnouncementCommentRepository(session)
            is_enrolled = user["role"] in ("student", "cr") or await comments.is_enrolled(
                announcement["course_id"],
                user["user_id"],
            )
            if not AnnouncementCommentService._can_comment(user, course, is_enrolled):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Course membership required to comment")
            comment = await comments.create(
                announcement_id=announcement_id,
                user_id=user["user_id"],
                comment_text=payload.comment_text,
            )
            await session.commit()
            return comment

        announcement = AnnouncementCommentService._get_announcement(announcement_id)
        course = await CourseService.require_course_access(announcement["course_id"], user)
        is_enrolled = (announcement["course_id"], user["email"]) in InMemoryStore.memberships
        if not AnnouncementCommentService._can_comment(user, course, is_enrolled):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Course membership required to comment")
        comment_id = max(InMemoryStore.announcement_comments.keys(), default=0) + 1
        comment = {
            "comment_id": comment_id,
            "announcement_id": announcement_id,
            "user_id": user["user_id"],
            "user_email": user["email"],
            "comment_text": payload.comment_text,
            "created_at": None,
        }
        InMemoryStore.announcement_comments[comment_id] = comment
        return {
            **comment,
            "author_name": user["full_name"],
            "author_email": user["email"],
            "author_role": user["role"],
        }

    @staticmethod
    async def delete_comment(
        comment_id: int,
        announcement_id: int,
        user: dict,
        session: AsyncSession | None = None,
    ) -> None:
        AnnouncementCommentService._require_non_admin_access(user)
        if session is not None:
            repository = AnnouncementCommentRepository(session)
            comment = await repository.get_by_id(comment_id)
            if comment is None or comment["announcement_id"] != announcement_id:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
            announcement = await AnnouncementRepository(session).get_by_id(announcement_id)
            if announcement is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Announcement not found")
            course = await CourseService.require_course_access(announcement["course_id"], user, session)
            is_course_teacher = user["role"] == "teacher" and course["teacher_id"] == user["user_id"]
            if user["user_id"] != comment["user_id"] and not is_course_teacher:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Comment owner or course teacher required")
            if not await repository.delete(comment_id):
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
            await session.commit()
            return

        comment = InMemoryStore.announcement_comments.get(comment_id)
        if comment is None or comment["announcement_id"] != announcement_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
        announcement = AnnouncementCommentService._get_announcement(announcement_id)
        course = await CourseService.require_course_access(announcement["course_id"], user)
        is_course_teacher = user["role"] == "teacher" and course["teacher_email"] == user["email"]
        if user["user_id"] != comment["user_id"] and not is_course_teacher:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Comment owner or course teacher required")
        del InMemoryStore.announcement_comments[comment_id]

    @staticmethod
    async def update_comment(
        comment_id: int,
        announcement_id: int,
        payload: AnnouncementCommentUpdate,
        user: dict,
        session: AsyncSession | None = None,
    ) -> dict:
        AnnouncementCommentService._require_non_admin_access(user)
        if session is not None:
            repository = AnnouncementCommentRepository(session)
            comment = await repository.get_by_id(comment_id)
            if comment is None or comment["announcement_id"] != announcement_id:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
            announcement = await AnnouncementRepository(session).get_by_id(announcement_id)
            if announcement is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Announcement not found")
            await CourseService.require_course_access(announcement["course_id"], user, session)
            if user["user_id"] != comment["user_id"]:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the comment author can edit it")
            updated = await repository.update(comment_id, payload.comment_text)
            if updated is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
            await session.commit()
            return updated

        comment = InMemoryStore.announcement_comments.get(comment_id)
        if comment is None or comment["announcement_id"] != announcement_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
        announcement = AnnouncementCommentService._get_announcement(announcement_id)
        await CourseService.require_course_access(announcement["course_id"], user)
        if user["user_id"] != comment["user_id"]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the comment author can edit it")
        comment["comment_text"] = payload.comment_text
        author = InMemoryStore.users.get(comment["user_email"], {})
        return {
            **comment,
            "author_name": author.get("full_name", comment["user_email"].split("@")[0]),
            "author_email": comment["user_email"],
            "author_role": author.get("role", "student"),
        }

    @staticmethod
    def _can_comment(user: dict, course: dict, is_enrolled: bool) -> bool:
        return (
            (
                user["role"] == "teacher"
                and (
                    course.get("teacher_id") == user["user_id"]
                    or course.get("teacher_email") == user["email"]
                )
            )
            or (user["role"] in ("student", "cr") and is_enrolled)
        )

    @staticmethod
    def _require_non_admin_access(user: dict) -> None:
        if user["role"] == "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admins cannot access announcement comments",
            )

    @staticmethod
    def _get_announcement(announcement_id: int) -> dict:
        announcement = InMemoryStore.announcements.get(announcement_id)
        if announcement is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Announcement not found")
        return announcement
