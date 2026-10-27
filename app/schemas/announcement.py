from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


class AnnouncementCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(..., min_length=1, max_length=200)
    content: str = Field(..., min_length=1)


class AnnouncementUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    content: Optional[str] = Field(default=None, min_length=1)

    @model_validator(mode="after")
    def reject_null_required_fields(self) -> "AnnouncementUpdate":
        for field in ("title", "content"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self
