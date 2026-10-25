from fastapi import APIRouter, Depends

from app.core.deps import require_roles
from app.schemas.announcement import AnnouncementCreate
from app.services.announcement_service import AnnouncementService

router = APIRouter(prefix="/api/v1/courses", tags=["Announcements"])


@router.get("/{course_id}/announcements")
def list_announcements(course_id: int):
    return {"data": AnnouncementService.list_announcements(course_id)}


@router.post("/{course_id}/announcements", status_code=201)
def create_announcement(
    course_id: int,
    payload: AnnouncementCreate,
    user: dict = Depends(require_roles("teacher", "admin")),
):
    announcement = AnnouncementService.create_announcement(course_id, payload, user["email"])
    return {"data": announcement}
