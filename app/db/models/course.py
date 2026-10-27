from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.models.user import Teacher


class Course(Base):
    __tablename__ = "courses"

    course_id: Mapped[int] = mapped_column(primary_key=True)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("teachers.teacher_id", ondelete="RESTRICT"), nullable=False)
    course_name: Mapped[str] = mapped_column(String(150), nullable=False)
    course_code: Mapped[str] = mapped_column(String(30), nullable=False)
    class_code_hash: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(Text)
    syllabus: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    teacher: Mapped[Teacher] = relationship()
