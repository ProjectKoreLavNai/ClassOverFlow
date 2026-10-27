from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_roles
from app.db.database import get_db_with_user_context
from app.schemas.course import CourseCreate, CourseUpdate, MembershipCreate
from app.services.course_service import CourseService

router = APIRouter(prefix="/api/v1", tags=["Courses"])


@router.get("/courses")
async def list_courses(
    user: dict = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_db_with_user_context),
):
    return {"data": await CourseService.list_courses(user, session)}


@router.post("/courses", status_code=201)
async def create_course(
    payload: CourseCreate,
    user: dict = Depends(require_roles("teacher", "admin")),
    session: AsyncSession | None = Depends(get_db_with_user_context),
):
    course = await CourseService.create_course(payload, user, session)
    return {"data": course}


@router.get("/courses/{course_id}")
async def get_course(
    course_id: int,
    user: dict = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_db_with_user_context),
):
    return {"data": await CourseService.get_course(course_id, user, session)}


@router.patch("/courses/{course_id}")
async def update_course(
    course_id: int,
    payload: CourseUpdate,
    user: dict = Depends(require_roles("teacher", "admin")),
    session: AsyncSession | None = Depends(get_db_with_user_context),
):
    return {"data": await CourseService.update_course(course_id, payload, user, session)}


@router.delete("/courses/{course_id}", status_code=204)
async def delete_course(
    course_id: int,
    user: dict = Depends(require_roles("admin")),
    session: AsyncSession | None = Depends(get_db_with_user_context),
):
    await CourseService.delete_course(course_id, user, session)
    return None


@router.post("/courses/join", status_code=201)
async def join_course(
    payload: MembershipCreate,
    user: dict = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_db_with_user_context),
):
    return {"data": await CourseService.join_by_code(payload.class_code, user, session)}


@router.get("/courses/{course_id}/members")
async def list_course_members(
    course_id: int,
    user: dict = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_db_with_user_context),
):
    return {"data": await CourseService.list_members(course_id, user, session)}
