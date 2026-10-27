from typing import Optional

from pydantic import BaseModel, Field, model_validator


class CourseCreate(BaseModel):
    course_name: str = Field(..., min_length=1, max_length=150)
    course_code: str = Field(..., min_length=1, max_length=30)
    description: Optional[str] = None
    syllabus: Optional[str] = None
    teacher_id: Optional[int] = Field(default=None, gt=0)


class CourseUpdate(BaseModel):
    course_name: Optional[str] = Field(default=None, min_length=1, max_length=150)
    course_code: Optional[str] = Field(default=None, min_length=1, max_length=30)
    description: Optional[str] = None
    syllabus: Optional[str] = None

    @model_validator(mode="after")
    def reject_null_required_fields(self) -> "CourseUpdate":
        for field in ("course_name", "course_code"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self


class MembershipCreate(BaseModel):
    class_code: str = Field(..., min_length=1, max_length=30, pattern=r"^[A-Za-z0-9_-]+$")
