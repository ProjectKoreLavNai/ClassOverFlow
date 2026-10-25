from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.course import Course


class CourseRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, *, course_name: str, course_code: str, description: str | None, syllabus: str | None, class_code: str, teacher_id: int) -> Course:
        course = Course(
            course_name=course_name,
            course_code=course_code,
            description=description,
            syllabus=syllabus,
            class_code=class_code,
            teacher_id=teacher_id,
        )
        self.session.add(course)
        await self.session.commit()
        await self.session.refresh(course)
        return course

    async def get_by_id(self, course_id: int) -> Course | None:
        result = await self.session.execute(select(Course).where(Course.id == course_id))
        return result.scalar_one_or_none()

    async def list(self) -> list[Course]:
        result = await self.session.execute(select(Course))
        return list(result.scalars().all())
