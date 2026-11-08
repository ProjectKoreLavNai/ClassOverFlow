from __future__ import annotations

import base64
import hashlib
import hmac
import secrets

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import verify_password
from app.repositories.course_repository import CourseRepository
from app.repositories.in_memory_store import InMemoryStore
from app.schemas.course import CourseCreate, CourseUpdate

SEEDED_CLASS_CODES: dict[str, str] = {
    "cse-3101": "d3b1-cse3101",
    "cse-3102": "c7x9-cse3102",
    "cse-3104": "os50-cse3104",
    "cse-3106": "ml78-cse3106",
}
_synced_course_codes: set[int] = set()


class CourseService:
    @staticmethod
    def get_course_class_code(course: dict) -> str:
        normalized = (course.get("course_code") or "").strip().lower()
        if normalized in SEEDED_CLASS_CODES:
            return SEEDED_CLASS_CODES[normalized]
        created_at = course.get("created_at")
        created_iso = created_at.isoformat() if hasattr(created_at, "isoformat") else str(created_at or "")
        seed = f"{course.get('course_id')}:{normalized}:{created_iso}"
        digest = hmac.new(
            b"classoverflow-course-class-code-v1",
            seed.encode("utf-8"),
            hashlib.sha256,
        ).digest()
        return base64.urlsafe_b64encode(digest[:9]).decode("ascii")

    @staticmethod
    async def list_courses(user: dict, session: AsyncSession | None = None) -> list[dict]:
        if session is not None:
            repository = CourseRepository(session)
            courses = await repository.list_for_user(user)
            if user["role"] in ("teacher", "admin"):
                dirty = False
                for course in courses:
                    fixed_code = CourseService.get_course_class_code(course)
                    course["class_code"] = fixed_code
                    cid = course["course_id"]
                    if cid not in _synced_course_codes:
                        matched = await repository.find_by_class_code(fixed_code)
                        if matched != cid:
                            code_hash = await repository.hash_class_code(fixed_code)
                            await repository.update_class_code_hash(cid, code_hash)
                            dirty = True
                        _synced_course_codes.add(cid)
                if dirty:
                    await session.commit()
            return courses
        return [
            CourseService._serialize(course, user)
            for course in InMemoryStore.courses.values()
            if CourseService._can_access(course, user)
        ]

    @staticmethod
    async def create_course(
        payload: CourseCreate,
        user: dict,
        session: AsyncSession | None = None,
    ) -> dict:
        if session is not None:
            teacher_id = user.get("user_id")
            if user["role"] == "admin":
                teacher_id = payload.teacher_id
                if teacher_id is None:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail="teacher_id is required when an admin creates a course",
                    )
            elif payload.teacher_id is not None and payload.teacher_id != teacher_id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Teachers can only create their own courses")

            repository = CourseRepository(session)
            if not await repository.teacher_exists(teacher_id):
                raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Course teacher does not exist")
            if await repository.course_code_exists(payload.course_code):
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Course code already exists")

            temp_code = secrets.token_urlsafe(9)
            placeholder_hash = await repository.hash_class_code(temp_code)
            try:
                course = await repository.create(
                    course_name=payload.course_name,
                    course_code=payload.course_code,
                    description=payload.description,
                    syllabus=payload.syllabus,
                    class_code_hash=placeholder_hash,
                    teacher_id=teacher_id,
                )
                class_code = CourseService.get_course_class_code(course)
                class_code_hash = await repository.hash_class_code(class_code)
                await repository.update_class_code_hash(course["course_id"], class_code_hash)
                await session.commit()
            except IntegrityError as exc:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Course code already exists or course data violates a database constraint",
                ) from exc
            _synced_course_codes.add(course["course_id"])
            course["class_code"] = class_code
            return course

        teacher_email = user["email"]
        if user["role"] == "admin":
            if payload.teacher_id is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="teacher_id is required when an admin creates a course",
                )
            teacher = next(
                (
                    profile for profile in InMemoryStore.users.values()
                    if profile["user_id"] == payload.teacher_id and profile["role"] == "teacher"
                ),
                None,
            )
            if teacher is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Course teacher does not exist",
                )
            teacher_email = teacher["email"]
        elif payload.teacher_id is not None and payload.teacher_id != user.get("user_id"):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Teachers can only create their own courses")

        if any(
            course["course_code"].casefold() == payload.course_code.casefold()
            for course in InMemoryStore.courses.values()
        ):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Course code already exists")

        course_id = max(InMemoryStore.courses.keys(), default=0) + 1
        class_code = secrets.token_urlsafe(9)
        while any(course["class_code"] == class_code for course in InMemoryStore.courses.values()):
            class_code = secrets.token_urlsafe(9)

        course = {
            "course_id": course_id,
            "course_name": payload.course_name,
            "course_code": payload.course_code,
            "description": payload.description,
            "syllabus": payload.syllabus,
            "class_code": class_code,
            "teacher_email": teacher_email,
        }
        InMemoryStore.courses[course_id] = course
        return course

    @staticmethod
    async def generate_class_code(
        course_id: int,
        user: dict,
        session: AsyncSession | None = None,
    ) -> dict:
        if session is not None:
            repository = CourseRepository(session)
            course = await repository.get_by_id(course_id)
            if course is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
            if user["role"] != "teacher" or course["teacher_id"] != user["user_id"]:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Course owner access required")

            class_code = CourseService.get_course_class_code(course)
            if course_id not in _synced_course_codes:
                class_code_hash = await repository.hash_class_code(class_code)
                await repository.update_class_code_hash(course_id, class_code_hash)
                await session.commit()
                _synced_course_codes.add(course_id)
            return {"class_code": class_code}

        course = CourseService._get_course(course_id)
        CourseService._require_owner(course, user)
        return {"class_code": course["class_code"]}

    @staticmethod
    async def get_course(course_id: int, user: dict, session: AsyncSession | None = None) -> dict:
        if session is not None:
            course = await CourseService.require_course_access(course_id, user, session)
            if user["role"] in ("teacher", "admin"):
                course["class_code"] = CourseService.get_course_class_code(course)
            return course
        course = CourseService._get_course(course_id)
        CourseService._require_access(course, user)
        return CourseService._serialize(course, user)

    @staticmethod
    async def update_course(
        course_id: int,
        payload: CourseUpdate,
        user: dict,
        session: AsyncSession | None = None,
    ) -> dict:
        updated = payload.model_dump(exclude_unset=True)
        if session is not None:
            repository = CourseRepository(session)
            course = await repository.get_by_id(course_id)
            if course is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
            if user["role"] != "admin" and (
                user["role"] != "teacher" or course["teacher_id"] != user["user_id"]
            ):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Course owner access required")
            new_code = updated.get("course_code")
            if new_code and await repository.course_code_exists(new_code, course_id):
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Course code already exists")
            try:
                result = await repository.update(course_id, updated)
                await session.commit()
            except IntegrityError as exc:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Course data violates a database constraint",
                ) from exc
            if result is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
            return result

        course = CourseService._get_course(course_id)
        CourseService._require_owner(course, user)
        new_code = updated.get("course_code")
        if new_code and any(
            other_id != course_id and other["course_code"].casefold() == new_code.casefold()
            for other_id, other in InMemoryStore.courses.items()
        ):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Course code already exists")

        course.update(updated)
        return course

    @staticmethod
    async def delete_course(course_id: int, user: dict, session: AsyncSession | None = None) -> None:
        if user["role"] != "admin":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
        if session is not None:
            repository = CourseRepository(session)
            if await repository.get_by_id(course_id) is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
            await repository.delete(course_id)
            await session.commit()
            return

        course = CourseService._get_course(course_id)
        CourseService._require_owner(course, user)
        del InMemoryStore.courses[course_id]
        InMemoryStore.announcements = {
            announcement_id: announcement
            for announcement_id, announcement in InMemoryStore.announcements.items()
            if announcement["course_id"] != course_id
        }
        InMemoryStore.memberships = {
            membership for membership in InMemoryStore.memberships if membership[0] != course_id
        }

    @staticmethod
    async def join_course(
        course_id: int,
        class_code: str,
        user: dict,
        session: AsyncSession | None = None,
    ) -> dict:
        if user["role"] not in ("student", "cr"):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only students and class representatives can join courses")
        if session is not None:
            repository = CourseRepository(session)
            matched_id = await repository.find_by_class_code(class_code)
            if matched_id != course_id:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid class code")
            await repository.enroll(course_id, user["user_id"])
            await session.commit()
            return {"course_id": course_id, "role": user["role"]}

        course = CourseService._get_course(course_id)
        if not secrets.compare_digest(course["class_code"], class_code):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid class code")
        InMemoryStore.memberships.add((course_id, user["email"]))
        return {"course_id": course_id, "role": user["role"]}

    @staticmethod
    async def join_by_code(
        class_code: str,
        user: dict,
        session: AsyncSession | None = None,
    ) -> dict:
        if user["role"] not in ("student", "cr"):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only students and class representatives can join courses")

        if session is not None:
            course_id = await CourseRepository(session).find_by_class_code(class_code)
            if course_id is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
            await CourseRepository(session).enroll(course_id, user["user_id"])
            await session.commit()
            return {"course_id": course_id, "role": user["role"]}

        course = next(
            (
                item for item in InMemoryStore.courses.values()
                if secrets.compare_digest(item["class_code"], class_code)
            ),
            None,
        )
        if course is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
        InMemoryStore.memberships.add((course["course_id"], user["email"]))
        return {"course_id": course["course_id"], "role": user["role"]}

    @staticmethod
    async def list_members(
        course_id: int,
        user: dict,
        session: AsyncSession | None = None,
    ) -> list[dict]:
        await CourseService.require_course_access(course_id, user, session)
        if session is not None:
            return await CourseRepository(session).list_members(course_id)
        members = []
        for joined_course_id, email in sorted(InMemoryStore.memberships):
            if joined_course_id != course_id:
                continue
            if user["role"] in ("student", "cr") and email != user["email"]:
                continue
            student = InMemoryStore.users.get(email)
            if student is not None:
                members.append(
                    {
                        "student_id": student["user_id"],
                        "full_name": student["full_name"],
                        "username": student["username"],
                        "email": student["email"],
                        "enrolled_at": None,
                    }
                )
        return members

    @staticmethod
    async def list_upcoming(
        course_id: int,
        user: dict,
        session: AsyncSession | None = None,
    ) -> list[dict]:
        await CourseService.require_course_access(course_id, user, session)
        if session is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Persistent upcoming coursework storage is unavailable",
            )

        return await CourseRepository(session).list_upcoming(course_id)

    @staticmethod
    async def require_course_access(
        course_id: int,
        user: dict,
        session: AsyncSession | None = None,
    ) -> dict:
        if session is not None:
            repo = CourseRepository(session)
            if user["role"] in ("student", "cr"):
                course, enrolled = await repo.get_by_id_with_enrollment(
                    course_id,
                    user["user_id"],
                )
                if course is not None and enrolled:
                    return course
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Course access required")

            course = await repo.get_by_id(course_id)
            if course is None:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Course access required")
            if user["role"] == "admin":
                return course
            if user["role"] == "teacher" and course["teacher_id"] == user["user_id"]:
                return course
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Course access required")
        course = CourseService._get_course(course_id)
        CourseService._require_access(course, user)
        return course

    @staticmethod
    async def require_course_owner(
        course_id: int,
        user: dict,
        session: AsyncSession | None = None,
    ) -> dict:
        if session is not None:
            course = await CourseRepository(session).get_by_id(course_id)
            if course is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
            if user["role"] != "teacher" or course["teacher_id"] != user["user_id"]:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Course owner access required")
            return course
        course = CourseService._get_course(course_id)
        if user["role"] != "teacher" or course["teacher_email"] != user["email"]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Course owner access required")
        return course

    @staticmethod
    async def require_course_announcement_author(
        course_id: int,
        user: dict,
        session: AsyncSession | None = None,
    ) -> dict:
        if session is not None:
            course = await CourseRepository(session).get_by_id(course_id)
            if course is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
            if user["role"] == "teacher":
                if course["teacher_id"] == user["user_id"] or await CourseRepository(session).is_enrolled(course_id, user["user_id"]):
                    return course
            elif user["role"] == "cr":
                if await CourseRepository(session).is_enrolled(course_id, user["user_id"]):
                    return course
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only course teachers and Class Representatives (CR) can post announcements",
            )

        course = CourseService._get_course(course_id)
        if user["role"] == "teacher":
            if course["teacher_email"] == user["email"] or (course_id, user["email"]) in InMemoryStore.memberships:
                return course
        elif user["role"] == "cr":
            if (course_id, user["email"]) in InMemoryStore.memberships:
                return course
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only course teachers and Class Representatives (CR) can post announcements",
        )

    @staticmethod
    def _get_course(course_id: int) -> dict:
        course = InMemoryStore.courses.get(course_id)
        if course is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
        return course

    @staticmethod
    def _can_access(course: dict, user: dict) -> bool:
        return (
            user["role"] == "admin"
            or course["teacher_email"] == user["email"]
            or (course["course_id"], user["email"]) in InMemoryStore.memberships
        )

    @staticmethod
    def _require_access(course: dict, user: dict) -> None:
        if not CourseService._can_access(course, user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Course access required")

    @staticmethod
    def _require_owner(course: dict, user: dict) -> None:
        if user["role"] != "admin" and course["teacher_email"] != user["email"]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Course owner access required")

    @staticmethod
    def _serialize(course: dict, user: dict) -> dict:
        serialized = dict(course)
        if course["teacher_email"] != user["email"] and user["role"] != "admin":
            serialized.pop("class_code", None)
        return serialized
