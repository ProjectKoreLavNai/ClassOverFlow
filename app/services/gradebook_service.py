from __future__ import annotations

from datetime import date
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.gradebook_repository import GradebookRepository
from app.schemas.gradebook import GradebookSave
from app.services.course_service import CourseService


def _reject_future_date(value: date) -> None:
    if value > date.today():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Attendance date cannot be in the future",
        )


class SaveAttendanceCommand:
    def __init__(
        self,
        repository: GradebookRepository,
        course_id: int,
        session_date: date,
        records: list[dict],
    ):
        self.repository = repository
        self.course_id = course_id
        self.session_date = session_date
        self.records = records

    async def execute(self) -> dict:
        return await self.repository.save_attendance(
            self.course_id,
            self.session_date,
            self.records,
        )


class UpdateMarkCommand:
    def __init__(self, repository: GradebookRepository, **values):
        self.repository = repository
        self.values = values

    async def execute(self) -> dict:
        return await self.repository.save_mark(**self.values)


class DeleteMarkCommand:
    def __init__(
        self,
        repository: GradebookRepository,
        course_id: int,
        mark_id: int,
    ):
        self.repository = repository
        self.course_id = course_id
        self.mark_id = mark_id

    async def execute(self) -> None:
        return await self.repository.delete_mark(
            self.course_id,
            self.mark_id,
        )


class GradebookService:
    @staticmethod
    async def get(course_id: int, user: dict, session: AsyncSession | None) -> dict:
        GradebookService._require_database(session)
        if user["role"] not in ("teacher", "student", "cr"):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Gradebook access required")
        await CourseService.require_course_access(course_id, user, session)
        return await GradebookRepository(session).get_gradebook(course_id, user)

    @staticmethod
    async def get_marks_distribution(
        course_id: int,
        user: dict,
        session: AsyncSession | None,
    ) -> list[dict]:
        GradebookService._require_database(session)
        if user["role"] not in ("teacher", "student", "cr"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Marks distribution access required",
            )
        await CourseService.require_course_access(course_id, user, session)
        try:
            return await GradebookRepository(session).get_marks_distribution(course_id)
        except LookupError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    @staticmethod
    async def save_marks_distribution(
        course_id: int,
        items: list[dict],
        user: dict,
        session: AsyncSession | None,
    ) -> list[dict]:
        repository = await GradebookService._get_owned_repository(course_id, user, session)
        result = await repository.save_marks_distribution(course_id, items)
        await session.commit()
        return result

    @staticmethod
    async def save_attendance(
        course_id: int,
        payload,
        user: dict,
        session: AsyncSession | None,
    ) -> dict:
        GradebookService._require_teacher(user)
        _reject_future_date(payload.session_date)
        repository = await GradebookService._get_owned_repository(course_id, user, session)
        expected_students = await repository.enrolled_student_ids(course_id)
        received_ids = [record.student_id for record in payload.records]
        if len(received_ids) != len(set(received_ids)):
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Duplicate student attendance records")
        if set(received_ids) != expected_students:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Attendance must include exactly one status for every enrolled student",
            )
        command = SaveAttendanceCommand(
            repository,
            course_id,
            payload.session_date,
            [record.model_dump() for record in payload.records],
        )
        try:
            result = await command.execute()
            await session.commit()
        except ValueError as exc:
            await session.rollback()
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
        return result

    @staticmethod
    async def save_gradebook(
        course_id: int,
        payload: GradebookSave,
        user: dict,
        session: AsyncSession | None,
    ) -> dict:
        GradebookService._require_teacher(user)
        _reject_future_date(payload.session_date)
        repository = await GradebookService._get_owned_repository(course_id, user, session)
        expected_students = await repository.enrolled_student_ids(course_id)
        attendance_ids = [record.student_id for record in payload.attendance]
        if len(attendance_ids) != len(set(attendance_ids)) or set(attendance_ids) != expected_students:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Attendance must include exactly one status for every enrolled student",
            )
        if any(mark.student_id not in expected_students for mark in payload.marks):
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Student is not enrolled in this course")
        try:
            attendance_result = await SaveAttendanceCommand(
                repository,
                course_id,
                payload.session_date,
                [record.model_dump() for record in payload.attendance],
            ).execute()
            for mark in payload.marks:
                await UpdateMarkCommand(
                    repository,
                    course_id=course_id,
                    student_id=mark.student_id,
                    assessment_name=mark.assessment_name,
                    marks_obtained=mark.marks_obtained,
                    total_marks=mark.total_marks,
                    mark_id=mark.mark_id,
                ).execute()
            for mark_id in payload.delete_mark_ids:
                await DeleteMarkCommand(
                    repository,
                    course_id,
                    mark_id,
                ).execute()
            await session.commit()
        except ValueError as exc:
            await session.rollback()
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
        except LookupError as exc:
            await session.rollback()
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        return {
            "attendance": attendance_result,
            "marks_saved": len(payload.marks),
            "marks_deleted": len(payload.delete_mark_ids),
        }

    @staticmethod
    async def create_mark(
        course_id: int,
        payload,
        user: dict,
        session: AsyncSession | None,
    ) -> dict:
        GradebookService._require_teacher(user)
        repository = await GradebookService._get_owned_repository(course_id, user, session)
        if payload.student_id not in await repository.enrolled_student_ids(course_id):
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Student is not enrolled in this course")
        command = UpdateMarkCommand(
            repository,
            course_id=course_id,
            student_id=payload.student_id,
            assessment_name=payload.assessment_name,
            marks_obtained=payload.marks_obtained,
            total_marks=payload.total_marks,
        )
        try:
            result = await command.execute()
            await session.commit()
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
        return result

    @staticmethod
    async def update_mark(
        course_id: int,
        mark_id: int,
        marks_obtained: Decimal,
        total_marks: Decimal,
        user: dict,
        session: AsyncSession | None,
    ) -> dict:
        GradebookService._require_teacher(user)
        repository = await GradebookService._get_owned_repository(course_id, user, session)
        command = UpdateMarkCommand(
            repository,
            course_id=course_id,
            student_id=0,
            assessment_name="",
            marks_obtained=marks_obtained,
            total_marks=total_marks,
            mark_id=mark_id,
        )
        try:
            result = await command.execute()
            await session.commit()
        except LookupError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        return result

    @staticmethod
    async def delete_mark(
        course_id: int,
        mark_id: int,
        user: dict,
        session: AsyncSession | None,
    ) -> dict:
        GradebookService._require_teacher(user)
        repository = await GradebookService._get_owned_repository(course_id, user, session)
        try:
            await DeleteMarkCommand(
                repository,
                course_id,
                mark_id,
            ).execute()
            await session.commit()
        except LookupError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        return {"deleted": True}

    @staticmethod
    async def _get_owned_repository(
        course_id: int,
        user: dict,
        session: AsyncSession | None,
    ) -> GradebookRepository:
        GradebookService._require_database(session)
        await CourseService.require_course_owner(course_id, user, session)
        return GradebookRepository(session)

    @staticmethod
    def _require_database(session: AsyncSession | None) -> None:
        if session is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Persistent gradebook storage is unavailable",
            )

    @staticmethod
    def _require_teacher(user: dict) -> None:
        if user["role"] != "teacher":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Teacher access required")
