from __future__ import annotations

import json
from datetime import date
from decimal import Decimal

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class GradebookRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_marks_distribution(self, course_id: int) -> list[dict]:
        result = await self.session.execute(
            text(
                "SELECT marks_distribution FROM public.courses "
                "WHERE course_id = :course_id"
            ),
            {"course_id": course_id},
        )
        distribution = result.scalar_one_or_none()
        if distribution is None:
            raise LookupError("Course not found")
        return json.loads(distribution) if isinstance(distribution, str) else distribution

    async def save_marks_distribution(
        self,
        course_id: int,
        items: list[dict],
    ) -> list[dict]:
        distribution = [
            {"name": item["name"].strip(), "total_marks": item["total_marks"]}
            for item in items
        ]
        result = await self.session.execute(
            text(
                "UPDATE public.courses SET marks_distribution = CAST(:distribution AS jsonb) "
                "WHERE course_id = :course_id RETURNING marks_distribution"
            ),
            {
                "course_id": course_id,
                "distribution": json.dumps(
                    [
                        {**item, "total_marks": float(item["total_marks"])}
                        for item in distribution
                    ]
                ),
            },
        )
        saved_distribution = result.scalar_one_or_none()
        if saved_distribution is None:
            raise LookupError("Course not found")
        return (
            json.loads(saved_distribution)
            if isinstance(saved_distribution, str)
            else saved_distribution
        )

    async def get_gradebook(self, course_id: int, user: dict) -> dict:
        is_learner = user["role"] in ("student", "cr")
        student_filter = " AND e.student_id = :student_id" if is_learner else ""
        mark_filter = " AND m.student_id = :student_id" if is_learner else ""
        learner_params = {"student_id": user["user_id"]} if is_learner else {}

        sessions_result = await self.session.execute(
            text(
                "SELECT session_id, session_date FROM public.attendance_sessions "
                "WHERE course_id = :course_id ORDER BY session_date DESC, session_id DESC"
            ),
            {"course_id": course_id},
        )
        session_rows = sessions_result.mappings().all()
        classes_held = len(session_rows)

        students_result = await self.session.execute(
            text(
                "SELECT e.student_id, s.full_name, s.username, "
                "COUNT(DISTINCT ar.session_id) AS attended "
                "FROM public.enrollments e "
                "JOIN public.students s ON s.student_id = e.student_id "
                "LEFT JOIN public.attendance_sessions ats ON ats.course_id = e.course_id "
                "LEFT JOIN public.attendance_records ar "
                "ON ar.session_id = ats.session_id AND ar.student_id = e.student_id "
                "AND ar.status = 'PRESENT' "
                "WHERE e.course_id = :course_id "
                f"{student_filter} "
                "GROUP BY e.student_id, s.full_name, s.username "
                "ORDER BY s.full_name, e.student_id"
            ),
            {"course_id": course_id, **learner_params},
        )
        students = []
        for row in students_result.mappings().all():
            attended = int(row["attended"])
            students.append(
                {
                    "student_id": row["student_id"],
                    "full_name": row["full_name"],
                    "username": row["username"],
                    "attended": attended,
                    "attendance_percent": (
                        round(attended * 100 / classes_held, 1)
                        if classes_held
                        else None
                    ),
                    "marks": [],
                }
            )

        marks_result = await self.session.execute(
            text(
                "SELECT m.mark_id, m.student_id, m.assessment_name, "
                "m.marks_obtained, m.total_marks, m.recorded_at "
                "FROM public.marks m WHERE m.course_id = :course_id "
                f"{mark_filter} "
                "ORDER BY m.assessment_name, m.student_id, m.mark_id"
            ),
            {"course_id": course_id, **learner_params},
        )
        students_by_id = {student["student_id"]: student for student in students}
        for mark in marks_result.mappings().all():
            student = students_by_id.get(mark["student_id"])
            if student is not None:
                student["marks"].append(dict(mark))

        records_by_session: dict[int, list[dict]] = {
            item["session_id"]: [] for item in session_rows
        }
        if session_rows:
            records_result = await self.session.execute(
                text(
                    "SELECT ar.session_id, ar.student_id, ar.status "
                    "FROM public.attendance_records ar "
                    "JOIN public.attendance_sessions ats ON ats.session_id = ar.session_id "
                    "WHERE ats.course_id = :course_id"
                    + (" AND ar.student_id = :student_id" if is_learner else "")
                    + " ORDER BY ar.session_id, ar.student_id"
                ),
                {"course_id": course_id, **learner_params},
            )
            for row in records_result.mappings().all():
                bucket = records_by_session.get(row["session_id"])
                if bucket is not None:
                    bucket.append(
                        {
                            "student_id": row["student_id"],
                            "status": row["status"],
                        }
                    )

        sessions = [
            {
                "session_id": item["session_id"],
                "session_date": item["session_date"],
                "records": records_by_session.get(item["session_id"], []),
            }
            for item in session_rows
        ]

        attended_total = sum(student["attended"] for student in students)
        total_possible = len(students) * classes_held
        below_minimum = [
            {
                "student_id": student["student_id"],
                "full_name": student["full_name"],
                "attendance_percent": student["attendance_percent"],
            }
            for student in students
            if student["attendance_percent"] is not None
            and student["attendance_percent"] < 75
        ]
        return {
            "course_id": course_id,
            "classes_held": classes_held,
            "average_attendance": (
                round(attended_total * 100 / total_possible, 1)
                if total_possible
                else None
            ),
            "below_minimum": below_minimum,
            "students": students,
            "sessions": sessions,
        }

    async def enrolled_student_ids(self, course_id: int) -> set[int]:
        result = await self.session.execute(
            text("SELECT student_id FROM public.enrollments WHERE course_id = :course_id"),
            {"course_id": course_id},
        )
        return set(result.scalars().all())

    async def save_attendance(
        self,
        course_id: int,
        session_date: date,
        records: list[dict],
    ) -> dict:
        await self.session.execute(
            text("SELECT pg_advisory_xact_lock(hashtext(:lock_key))"),
            {"lock_key": f"attendance:{course_id}:{session_date.isoformat()}"},
        )
        session_result = await self.session.execute(
            text(
                "SELECT session_id, session_date FROM public.attendance_sessions "
                "WHERE course_id = :course_id AND session_date = :session_date "
                "ORDER BY session_id FOR UPDATE"
            ),
            {"course_id": course_id, "session_date": session_date},
        )
        existing_sessions = session_result.mappings().all()
        if len(existing_sessions) > 1:
            raise ValueError("Multiple attendance sessions already exist for this date")

        if existing_sessions:
            session_row = dict(existing_sessions[0])
            session_id = session_row["session_id"]
        else:
            result = await self.session.execute(
                text(
                    "INSERT INTO public.attendance_sessions (course_id, session_date) "
                    "VALUES (:course_id, :session_date) RETURNING session_id"
                ),
                {"course_id": course_id, "session_date": session_date},
            )
            session_id = result.scalar_one()

        for record in records:
            await self.session.execute(
                text(
                    "INSERT INTO public.attendance_records (session_id, student_id, status) "
                    "VALUES (:session_id, :student_id, :status) "
                    "ON CONFLICT (session_id, student_id) DO UPDATE SET status = EXCLUDED.status"
                ),
                {
                    "session_id": session_id,
                    "student_id": record["student_id"],
                    "status": record["status"],
                },
            )

        return {"session_id": session_id}

    async def save_mark(
        self,
        *,
        course_id: int,
        student_id: int,
        assessment_name: str,
        marks_obtained: Decimal,
        total_marks: Decimal,
        mark_id: int | None = None,
    ) -> dict:
        if mark_id is None:
            lock_key = f"mark:{course_id}:{student_id}:{assessment_name.casefold()}"
            await self.session.execute(
                text("SELECT pg_advisory_xact_lock(hashtext(:lock_key))"),
                {"lock_key": lock_key},
            )
            duplicate = await self.session.execute(
                text(
                    "SELECT mark_id FROM public.marks "
                    "WHERE course_id = :course_id AND student_id = :student_id "
                    "AND lower(assessment_name) = lower(:assessment_name) "
                    "LIMIT 1 FOR UPDATE"
                ),
                {
                    "course_id": course_id,
                    "student_id": student_id,
                    "assessment_name": assessment_name,
                },
            )
            if duplicate.scalar_one_or_none() is not None:
                raise ValueError("An assessment mark with this name already exists for the student")
            result = await self.session.execute(
                text(
                    "INSERT INTO public.marks "
                    "(course_id, student_id, assessment_name, marks_obtained, total_marks) "
                    "VALUES (:course_id, :student_id, :assessment_name, :marks_obtained, :total_marks) "
                    "RETURNING mark_id"
                ),
                {
                    "course_id": course_id,
                    "student_id": student_id,
                    "assessment_name": assessment_name.strip(),
                    "marks_obtained": marks_obtained,
                    "total_marks": total_marks,
                },
            )
            mark_id = result.scalar_one()
        else:
            before_state = await self._mark_state(mark_id, for_update=True)
            if before_state is None or before_state["course_id"] != course_id:
                raise LookupError("Mark not found")
            await self.session.execute(
                text(
                    "UPDATE public.marks SET marks_obtained = :marks_obtained, "
                    "total_marks = :total_marks WHERE mark_id = :mark_id"
                ),
                {
                    "marks_obtained": marks_obtained,
                    "total_marks": total_marks,
                    "mark_id": mark_id,
                },
            )

        after_state = await self._mark_state(mark_id)
        return {"mark": after_state}

    async def delete_mark(self, course_id: int, mark_id: int) -> None:
        mark = await self._mark_state(mark_id, for_update=True)
        if mark is None or mark["course_id"] != course_id:
            raise LookupError("Mark not found")
        await self.session.execute(
            text("DELETE FROM public.marks WHERE mark_id = :mark_id"),
            {"mark_id": mark_id},
        )

    async def _mark_state(self, mark_id: int, for_update: bool = False) -> dict | None:
        lock_clause = " FOR UPDATE" if for_update else ""
        result = await self.session.execute(
            text(
                "SELECT mark_id, course_id, student_id, assessment_name, "
                "marks_obtained, total_marks, recorded_at "
                f"FROM public.marks WHERE mark_id = :mark_id{lock_clause}"
            ),
            {"mark_id": mark_id},
        )
        row = result.mappings().one_or_none()
        if row is None:
            return None
        return {
            "mark_id": row["mark_id"],
            "course_id": row["course_id"],
            "student_id": row["student_id"],
            "assessment_name": row["assessment_name"],
            "marks_obtained": str(row["marks_obtained"]),
            "total_marks": str(row["total_marks"]),
            "recorded_at": row["recorded_at"].isoformat(),
        }
