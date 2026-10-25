from typing import Optional

from pydantic import BaseModel, Field


class CourseCreate(BaseModel):
    course_name: str = Field(..., min_length=1, max_length=150)
    course_code: str = Field(..., min_length=1, max_length=30)
    description: Optional[str] = None
    syllabus: Optional[str] = None


class CourseUpdate(BaseModel):
    course_name: Optional[str] = Field(default=None, min_length=1, max_length=150)
    course_code: Optional[str] = Field(default=None, min_length=1, max_length=30)
    description: Optional[str] = None
    syllabus: Optional[str] = None
