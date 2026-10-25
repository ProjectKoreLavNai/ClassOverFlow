from __future__ import annotations

from fastapi import HTTPException, status

from app.repositories.in_memory_store import InMemoryStore
from app.schemas.course import CourseCreate, CourseUpdate


class CourseService:
    @staticmethod
    def list_courses() -> list[dict]:
        return list(InMemoryStore.courses.values())

    @staticmethod
    def create_course(payload: CourseCreate, teacher_email: str) -> dict:
        course_id = (max(InMemoryStore.courses.keys(), default=0) + 1)
        course = {
            "course_id": course_id,
            "course_name": payload.course_name,
            "course_code": payload.course_code,
            "description": payload.description,
            "syllabus": payload.syllabus,
            "class_code": f"CLS-{course_id:04d}",
            "teacher_email": teacher_email,
        }
        InMemoryStore.courses[course_id] = course
        return course

    @staticmethod
    def get_course(course_id: int) -> dict:
        course = InMemoryStore.courses.get(course_id)
        if not course:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
        return course

    @staticmethod
    def update_course(course_id: int, payload: CourseUpdate) -> dict:
        course = InMemoryStore.courses.get(course_id)
        if not course:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")

        updated = payload.model_dump(exclude_none=True)
        course.update(updated)
        return course

    @staticmethod
    def delete_course(course_id: int) -> None:
        if course_id not in InMemoryStore.courses:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
        del InMemoryStore.courses[course_id]
