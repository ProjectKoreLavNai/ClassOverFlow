from pydantic import BaseModel, ConfigDict, Field, field_validator


class AnnouncementCommentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    comment_text: str = Field(..., min_length=1)

    @field_validator("comment_text")
    @classmethod
    def reject_blank_comment(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Comment cannot be blank")
        return value
