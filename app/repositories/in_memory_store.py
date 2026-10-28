from __future__ import annotations

from typing import Any


class InMemoryStore:
    """Temporary storage used until PostgreSQL is ready.

    Later, this can be replaced by SQLAlchemy repositories while the service layer stays identical.
    """

    users: dict[str, dict[str, Any]] = {}
    courses: dict[int, dict[str, Any]] = {}
    announcements: dict[int, dict[str, Any]] = {}
    announcement_comments: dict[int, dict[str, Any]] = {}
    memberships: set[tuple[int, str]] = set()
    revoked_tokens: set[str] = set()

    @classmethod
    def reset(cls) -> None:
        cls.users.clear()
        cls.courses.clear()
        cls.announcements.clear()
        cls.announcement_comments.clear()
        cls.memberships.clear()
        cls.revoked_tokens.clear()

    @classmethod
    def seed_defaults(cls) -> None:
        if cls.users:
            return
        from app.core.security import hash_password

        default_password = hash_password("Password@123")

        # Academic persona accounts matching frontend
        cls.users = {
            "gojo.teacher@university.edu": {
                "user_id": 1,
                "full_name": "Gojo Satoru",
                "username": "gojosatoru",
                "email": "gojo.teacher@university.edu",
                "password": default_password,
                "role": "teacher",
                "phone": "+8801711223344",
            },
            "daemon.cr@university.edu": {
                "user_id": 2,
                "full_name": "Daemon Targaryen",
                "username": "daemoncr",
                "email": "daemon.cr@university.edu",
                "password": default_password,
                "role": "cr",
                "phone": "+8801811556677",
            },
            "ayanokoji.student@university.edu": {
                "user_id": 3,
                "full_name": "Kiyotaka Ayanokoji",
                "username": "ayanokoji",
                "email": "ayanokoji.student@university.edu",
                "password": default_password,
                "role": "student",
                "phone": "+8801911889900",
            },
            "aizen.admin@university.edu": {
                "user_id": 4,
                "full_name": "Sosuke Aizen",
                "username": "aizenadmin",
                "email": "aizen.admin@university.edu",
                "password": default_password,
                "role": "admin",
                "phone": "+8801611001122",
            },
        }

        # Academic courses matching frontend blueprints
        cls.courses = {
            1: {
                "course_id": 1,
                "course_name": "CSE-3102: Software Engineering Lab",
                "course_code": "CSE-3102",
                "description": "Design Patterns, Architecture, CI/CD and Team Engineering",
                "syllabus": "Unit 1: Requirements & UML, Unit 2: Design Patterns, Unit 3: Behavioral Patterns",
                "class_code": "se26-cse3102",
                "teacher_email": "gojo.teacher@university.edu",
            },
            2: {
                "course_id": 2,
                "course_name": "CSE-3101: Database Management Systems",
                "course_code": "CSE-3101",
                "description": "Relational Models, SQL, Transactions, and Query Optimization",
                "syllabus": "Unit 1: Relational Model & Normalization",
                "class_code": "db42-cse3101",
                "teacher_email": "gojo.teacher@university.edu",
            },
            3: {
                "course_id": 3,
                "course_name": "CSE-3104: Operating Systems & Systems Programming",
                "course_code": "CSE-3104",
                "description": "Kernel Architecture, Process Synchronization, File Systems",
                "syllabus": "Unit 1: Process Management & Concurrency",
                "class_code": "os50-cse3104",
                "teacher_email": "gojo.teacher@university.edu",
            },
            4: {
                "course_id": 4,
                "course_name": "CSE-3106: Machine Learning",
                "course_code": "CSE-3106",
                "description": "Supervised Learning, Neural Networks, Deep Learning Architectures",
                "syllabus": "Unit 1: Supervised Learning & Optimization",
                "class_code": "ml78-cse3106",
                "teacher_email": "gojo.teacher@university.edu",
            },
        }

        # Enrolled student memberships
        cls.memberships = {
            (1, "daemon.cr@university.edu"),
            (1, "ayanokoji.student@university.edu"),
            (2, "daemon.cr@university.edu"),
            (2, "ayanokoji.student@university.edu"),
            (3, "daemon.cr@university.edu"),
            (4, "daemon.cr@university.edu"),
        }

        # Announcements
        cls.announcements = {
            1: {
                "announcement_id": 1,
                "course_id": 1,
                "title": "Milestone 2.1 & 2.2 Architectural Guidelines Published",
                "content": "Please study the 4 design patterns implemented in Milestone 2.1 alongside Milestone 2.2 Prototype, Facade, and Observer patterns. Viva review will take place this Thursday.",
                "author_email": "gojo.teacher@university.edu",
            },
            2: {
                "announcement_id": 2,
                "course_id": 1,
                "title": "Class Schedule Update: Lab Room Shift to Room 402",
                "content": "Due to network maintenance in Lab 2, our Software Engineering Lab session will temporarily shift to Room 402 with full projector support.",
                "author_email": "daemon.cr@university.edu",
            },
        }
