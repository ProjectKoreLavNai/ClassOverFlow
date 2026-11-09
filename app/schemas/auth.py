from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator


class UserRegister(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=100)
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr = Field(..., max_length=150)
    password: str = Field(..., min_length=8, max_length=72)
    role: Literal["student", "teacher"] = "student"
    phone: str | None = Field(default=None, max_length=20)

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, password: str) -> str:
        if len(password.encode("utf-8")) > 72:
            raise ValueError("Password cannot exceed 72 UTF-8 bytes")
        if not (
            any(character.islower() for character in password)
            and any(character.isupper() for character in password)
            and any(character.isdigit() for character in password)
        ):
            raise ValueError("Password must include lowercase, uppercase, and numeric characters")
        return password


class UserLogin(BaseModel):
    email: EmailStr = Field(..., max_length=150)
    password: str = Field(..., min_length=1, max_length=72)

    @field_validator("password")
    @classmethod
    def validate_bcrypt_password_length(cls, password: str) -> str:
        if len(password.encode("utf-8")) > 72:
            raise ValueError("Password cannot exceed 72 UTF-8 bytes")
        return password


class RefreshRequest(BaseModel):
    refresh_token: str = Field(..., min_length=1)


class UserUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    full_name: str | None = Field(default=None, min_length=1, max_length=100)
    username: str | None = Field(default=None, min_length=3, max_length=50)
    phone: str | None = Field(default=None, max_length=20)

    @model_validator(mode="after")
    def reject_null_required_fields(self) -> "UserUpdate":
        for field in ("full_name", "username"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self


class AdminUserUpdate(BaseModel):
    role: Literal["student", "cr", "teacher", "admin"] | None = None
    is_verified: bool | None = None

    @model_validator(mode="after")
    def require_an_update(self) -> "AdminUserUpdate":
        if self.role is None and self.is_verified is None:
            raise ValueError("At least one field must be provided")
        return self


class VerifyResetEmailRequest(BaseModel):
    email: EmailStr = Field(..., max_length=150)


class ResetPasswordRequest(BaseModel):
    email: EmailStr = Field(..., max_length=150)
    new_password: str = Field(..., min_length=8, max_length=72)
    confirm_password: str = Field(..., min_length=8, max_length=72)

    @field_validator("new_password")
    @classmethod
    def validate_password_strength(cls, password: str) -> str:
        if len(password.encode("utf-8")) > 72:
            raise ValueError("Password cannot exceed 72 UTF-8 bytes")
        if not (
            any(character.islower() for character in password)
            and any(character.isupper() for character in password)
            and any(character.isdigit() for character in password)
        ):
            raise ValueError("Password must include lowercase, uppercase, and numeric characters")
        return password

    @model_validator(mode="after")
    def passwords_match(self) -> "ResetPasswordRequest":
        if self.new_password != self.confirm_password:
            raise ValueError("Passwords do not match")
        return self

