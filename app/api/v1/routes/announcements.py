from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_roles
from app.db.database import get_db_with_user_context
from app.schemas.announcement import AnnouncementCreate, AnnouncementUpdate
from app.schemas.announcement_comment import AnnouncementCommentCreate
from app.services.announcement_comment_service import AnnouncementCommentService
from app.services.announcement_service import AnnouncementService

router = APIRouter(prefix="/api/v1/courses", tags=["Announcements"])
items_router = APIRouter(prefix="/api/v1/announcements", tags=["Announcements"])
comments_router = APIRouter(prefix="/api/v1/announcements", tags=["Announcement comments"])


@comments_router.get("/{announcement_id}/comments")
async def list_announcement_comments(
    announcement_id: int,
    user: dict = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_db_with_user_context),
):
    return {"data": await AnnouncementCommentService.list_comments(announcement_id, user, session)}


@comments_router.post("/{announcement_id}/comments", status_code=201)
async def create_announcement_comment(
    announcement_id: int,
    payload: AnnouncementCommentCreate,
    user: dict = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_db_with_user_context),
):
    return {
        "data": await AnnouncementCommentService.create_comment(
            announcement_id,
            payload,
            user,
            session,
        )
    }


@comments_router.delete("/{announcement_id}/comments/{comment_id}", status_code=204)
async def delete_announcement_comment(
    announcement_id: int,
    comment_id: int,
    user: dict = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_db_with_user_context),
):
    await AnnouncementCommentService.delete_comment(comment_id, announcement_id, user, session)
    return None


@router.get("/{course_id}/announcements")
async def list_announcements(
    course_id: int,
    user: dict = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_db_with_user_context),
):
    return {"data": await AnnouncementService.list_announcements(course_id, user, session)}


@router.post("/{course_id}/announcements", status_code=201)
async def create_announcement(
    course_id: int,
    payload: AnnouncementCreate,
    user: dict = Depends(require_roles("teacher", "cr")),
    session: AsyncSession | None = Depends(get_db_with_user_context),
):
    announcement = await AnnouncementService.create_announcement(course_id, payload, user, session)
    return {"data": announcement}


@items_router.get("/{announcement_id}")
async def get_announcement(
    announcement_id: int,
    user: dict = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_db_with_user_context),
):
    return {"data": await AnnouncementService.get_announcement(announcement_id, user, session)}


@items_router.patch("/{announcement_id}")
async def update_announcement(
    announcement_id: int,
    payload: AnnouncementUpdate,
    user: dict = Depends(require_roles("teacher")),
    session: AsyncSession | None = Depends(get_db_with_user_context),
):
    return {"data": await AnnouncementService.update_announcement(announcement_id, payload, user, session)}


@items_router.delete("/{announcement_id}", status_code=204)
async def delete_announcement(
    announcement_id: int,
    user: dict = Depends(require_roles("teacher")),
    session: AsyncSession | None = Depends(get_db_with_user_context),
):
    await AnnouncementService.delete_announcement(announcement_id, user, session)
    return None
