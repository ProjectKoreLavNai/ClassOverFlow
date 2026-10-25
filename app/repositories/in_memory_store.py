from __future__ import annotations

from typing import Any


class InMemoryStore:
    """Temporary storage used until PostgreSQL is ready.

    Later, this can be replaced by SQLAlchemy repositories while the service layer stays identical.
    """

    users: dict[str, dict[str, Any]] = {}
    courses: dict[int, dict[str, Any]] = {}
    announcements: dict[int, dict[str, Any]] = {}

    @classmethod
    def reset(cls) -> None:
        cls.users.clear()
        cls.courses.clear()
        cls.announcements.clear()
