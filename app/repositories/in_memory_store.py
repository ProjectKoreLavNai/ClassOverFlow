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
