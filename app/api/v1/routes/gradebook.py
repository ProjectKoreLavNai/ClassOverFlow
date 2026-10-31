from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_roles
from app.db.database import get_db_with_user_context
from app.schemas.gradebook import (
    AttendanceSave,
    GradebookSave,
    MarkCreate,
    MarksDistributionSave,
    MarkUpdate,
)
from app.services.gradebook_service import GradebookService

router = APIRouter(prefix="/api/v1/courses", tags=["Gradebook"])


@router.get("/{course_id}/gradebook")
async def get_gradebook(
    course_id: int,
    user: dict = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_db_with_user_context),
):
    return {"data": await GradebookService.get(course_id, user, session)}


@router.get("/{course_id}/marks-distribution")
async def get_marks_distribution(
    course_id: int,
    user: dict = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_db_with_user_context),
):
    return {
        "data": await GradebookService.get_marks_distribution(course_id, user, session)
    }


@router.put("/{course_id}/marks-distribution")
async def save_marks_distribution(
    course_id: int,
    payload: MarksDistributionSave,
    user: dict = Depends(require_roles("teacher")),
    session: AsyncSession | None = Depends(get_db_with_user_context),
):
    return {
        "data": await GradebookService.save_marks_distribution(
            course_id,
            [item.model_dump() for item in payload.items],
            user,
            session,
        )
    }


@router.put("/{course_id}/attendance")
async def save_attendance(
    course_id: int,
    payload: AttendanceSave,
    user: dict = Depends(require_roles("teacher")),
    session: AsyncSession | None = Depends(get_db_with_user_context),
):
    return {
        "data": await GradebookService.save_attendance(
            course_id,
            payload,
            user,
            session,
        )
    }


@router.put("/{course_id}/gradebook")
async def save_gradebook(
    course_id: int,
    payload: GradebookSave,
    user: dict = Depends(require_roles("teacher")),
    session: AsyncSession | None = Depends(get_db_with_user_context),
):
    return {
        "data": await GradebookService.save_gradebook(
            course_id,
            payload,
            user,
            session,
        )
    }


@router.post("/{course_id}/marks", status_code=status.HTTP_201_CREATED)
async def create_mark(
    course_id: int,
    payload: MarkCreate,
    user: dict = Depends(require_roles("teacher")),
    session: AsyncSession | None = Depends(get_db_with_user_context),
):
    return {"data": await GradebookService.create_mark(course_id, payload, user, session)}


@router.patch("/{course_id}/marks/{mark_id}")
async def update_mark(
    course_id: int,
    mark_id: int,
    payload: MarkUpdate,
    user: dict = Depends(require_roles("teacher")),
    session: AsyncSession | None = Depends(get_db_with_user_context),
):
    return {
        "data": await GradebookService.update_mark(
            course_id,
            mark_id,
            payload.marks_obtained,
            payload.total_marks,
            user,
            session,
        )
    }


@router.delete("/{course_id}/marks/{mark_id}")
async def delete_mark(
    course_id: int,
    mark_id: int,
    user: dict = Depends(require_roles("teacher")),
    session: AsyncSession | None = Depends(get_db_with_user_context),
):
    return {"data": await GradebookService.delete_mark(course_id, mark_id, user, session)}
