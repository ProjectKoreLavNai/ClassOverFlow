from fastapi import APIRouter, Depends

from app.core.deps import get_current_user, require_roles
from app.schemas.course import CourseCreate, CourseUpdate
from app.services.course_service import CourseService

router = APIRouter(prefix="/api/v1", tags=["Courses"])


@router.get("/courses")
def list_courses():
    return {"data": CourseService.list_courses()}


@router.post("/courses", status_code=201)
def create_course(payload: CourseCreate, user: dict = Depends(require_roles("teacher", "admin"))):
    course = CourseService.create_course(payload, user["email"])
    return {"data": course}


@router.get("/courses/{course_id}")
def get_course(course_id: int):
    return {"data": CourseService.get_course(course_id)}


@router.patch("/courses/{course_id}")
def update_course(course_id: int, payload: CourseUpdate, user: dict = Depends(require_roles("teacher", "admin"))):
    return {"data": CourseService.update_course(course_id, payload)}


@router.delete("/courses/{course_id}", status_code=204)
def delete_course(course_id: int, user: dict = Depends(require_roles("teacher", "admin"))):
    CourseService.delete_course(course_id)
    return None


@router.post("/courses/{course_id}/join")
def join_course(course_id: int, user: dict = Depends(get_current_user)):
    course = CourseService.get_course(course_id)
    return {"data": {"course_id": course_id, "joined_by": user["email"], "course": course}}
