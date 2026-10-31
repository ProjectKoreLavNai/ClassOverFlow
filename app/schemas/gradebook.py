from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, model_validator


class AttendanceRecordInput(BaseModel):
    student_id: int = Field(gt=0)
    status: Literal["PRESENT", "ABSENT"]


class AttendanceSave(BaseModel):
    session_date: date
    records: list[AttendanceRecordInput]


class GradebookMarkInput(BaseModel):
    mark_id: int | None = Field(default=None, gt=0)
    student_id: int = Field(gt=0)
    assessment_name: str = Field(min_length=1, max_length=150)
    marks_obtained: Decimal = Field(ge=0, max_digits=7, decimal_places=2)
    total_marks: Decimal = Field(gt=0, max_digits=7, decimal_places=2)

    @model_validator(mode="after")
    def marks_within_total(self) -> "GradebookMarkInput":
        if self.marks_obtained > self.total_marks:
            raise ValueError("marks_obtained cannot exceed total_marks")
        return self


class GradebookSave(BaseModel):
    session_date: date
    attendance: list[AttendanceRecordInput]
    marks: list[GradebookMarkInput]
    delete_mark_ids: list[int] = Field(default_factory=list)


class MarksDistributionItem(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    total_marks: Decimal = Field(gt=0, le=100, max_digits=7, decimal_places=2)


class MarksDistributionSave(BaseModel):
    items: list[MarksDistributionItem] = Field(min_length=1, max_length=50)

    @model_validator(mode="after")
    def unique_category_names(self) -> "MarksDistributionSave":
        names = [item.name.strip().casefold() for item in self.items]
        if any(not name for name in names):
            raise ValueError("Assessment category name cannot be empty")
        if len(names) != len(set(names)):
            raise ValueError("Assessment category names must be unique")
        return self


class MarkCreate(BaseModel):
    student_id: int = Field(gt=0)
    assessment_name: str = Field(min_length=1, max_length=150)
    marks_obtained: Decimal = Field(ge=0, max_digits=7, decimal_places=2)
    total_marks: Decimal = Field(gt=0, max_digits=7, decimal_places=2)

    @model_validator(mode="after")
    def marks_within_total(self) -> "MarkCreate":
        if self.marks_obtained > self.total_marks:
            raise ValueError("marks_obtained cannot exceed total_marks")
        return self


class MarkUpdate(BaseModel):
    marks_obtained: Decimal = Field(ge=0, max_digits=7, decimal_places=2)
    total_marks: Decimal = Field(gt=0, max_digits=7, decimal_places=2)

    @model_validator(mode="after")
    def marks_within_total(self) -> "MarkUpdate":
        if self.marks_obtained > self.total_marks:
            raise ValueError("marks_obtained cannot exceed total_marks")
        return self
