from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_access_token,
    ensure_token_not_revoked,
    hash_password,
    revoke_token,
    verify_password,
)
from app.repositories.in_memory_store import InMemoryStore
from app.repositories.user_repository import UserRepository
from app.schemas.auth import (
    ResetPasswordRequest,
    UserLogin,
    UserRegister,
    VerifyResetEmailRequest,
)


class AuthService:
    @staticmethod
    async def register(payload: UserRegister, session: AsyncSession | None = None) -> dict:
        email = str(payload.email).casefold()
        username = payload.username.casefold()
        if session is not None:
            try:
                user = await UserRepository(session).create(
                    full_name=payload.full_name,
                    username=payload.username,
                    email=email,
                    password_hash=hash_password(payload.password),
                    role=payload.role.upper(),
                    phone=payload.phone,
                )
                await session.commit()
            except IntegrityError as exc:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Email or username already exists",
                ) from exc
            return {
                "email": user["email"],
                "role": user["role"].lower(),
                "full_name": user["full_name"],
                "username": user["username"],
                "phone": user["phone"],
            }

        if email in InMemoryStore.users or any(
            user["username"].casefold() == username for user in InMemoryStore.users.values()
        ):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email or username already exists")

        user_id = max(
            (user.get("user_id", 0) for user in InMemoryStore.users.values()),
            default=0,
        ) + 1
        InMemoryStore.users[email] = {
            "user_id": user_id,
            "full_name": payload.full_name,
            "username": payload.username,
            "email": email,
            "password": hash_password(payload.password),
            "role": payload.role,
            "phone": payload.phone,
        }

        return {
            "email": email,
            "role": payload.role,
            "full_name": payload.full_name,
            "username": payload.username,
            "phone": payload.phone,
        }

    @staticmethod
    async def login(payload: UserLogin, session: AsyncSession | None = None) -> dict:
        email = str(payload.email).casefold()
        if session is not None:
            user = await UserRepository(session).authenticate(email)
            password_hash = user["password_hash"] if user else ""
            if not user or not verify_password(payload.password, password_hash):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid email or password",
                )
            role = user["role"].lower()
            return {
                "access_token": create_access_token(email, role, user["user_id"]),
                "refresh_token": create_refresh_token(email, role, user["user_id"]),
                "token_type": "bearer",
                "expires_in": settings.access_token_expire_minutes * 60,
                "user": {
                    "email": email,
                    "role": role,
                    "username": user["username"],
                },
            }

        user = InMemoryStore.users.get(email)
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

        if not verify_password(payload.password, user["password"]):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

        token = create_access_token(user["email"], user["role"], user["user_id"])
        refresh_token = create_refresh_token(user["email"], user["role"], user["user_id"])
        return {
            "access_token": token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": settings.access_token_expire_minutes * 60,
            "user": {
                "email": user["email"],
                "role": user["role"],
                "username": user["username"],
            },
        }

    @staticmethod
    async def refresh(refresh_token: str, session: AsyncSession | None = None) -> dict:
        payload = decode_access_token(refresh_token, expected_type="refresh")
        await ensure_token_not_revoked(payload, session)
        email = payload.get("sub")
        role = payload.get("role")
        user_id = payload.get("uid")
        if settings.storage_backend == "database":
            if not email or not role or not isinstance(user_id, int):
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
        else:
            user = InMemoryStore.users.get(email)
            if not user:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
            role = user["role"]
            user_id = user["user_id"]

        await revoke_token(payload, session)
        return {
            "access_token": create_access_token(email, role, user_id),
            "refresh_token": create_refresh_token(email, role, user_id),
            "token_type": "bearer",
            "expires_in": settings.access_token_expire_minutes * 60,
        }

    @staticmethod
    async def logout(
        access_token: str,
        refresh_token: str,
        session: AsyncSession | None = None,
    ) -> None:
        access_payload = decode_access_token(access_token)
        await ensure_token_not_revoked(access_payload, session)
        refresh_payload = decode_access_token(refresh_token, expected_type="refresh")
        await ensure_token_not_revoked(refresh_payload, session)
        if (
            refresh_payload.get("sub") != access_payload.get("sub")
            or refresh_payload.get("uid") != access_payload.get("uid")
            or refresh_payload.get("role") != access_payload.get("role")
        ):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Tokens do not belong to the same user")

        await revoke_token(access_payload, session)
        await revoke_token(refresh_payload, session)

    @staticmethod
    def get_user(email: str) -> dict | None:
        return InMemoryStore.users.get(email.casefold())

    @staticmethod
    async def get_profile(user: dict, session: AsyncSession | None = None) -> dict:
        if session is not None:
            profile = await UserRepository(session).get_profile(user["user_id"])
            if profile is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found")
            profile["role"] = profile["role"].lower()
            return profile

        profile = next(
            (entry for entry in InMemoryStore.users.values() if entry["user_id"] == user["user_id"]),
            None,
        )
        if profile is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found")
        return {
            "user_id": profile["user_id"],
            "role": profile["role"],
            "full_name": profile["full_name"],
            "username": profile["username"],
            "email": profile["email"],
            "phone": profile.get("phone"),
        }

    @staticmethod
    async def update_profile(
        user: dict,
        values: dict,
        session: AsyncSession | None = None,
    ) -> dict:
        if session is not None:
            if user["role"] == "admin" and "phone" in values:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="The admins table does not have a phone column",
                )
            try:
                profile = await UserRepository(session).update_profile(user["user_id"], user["role"], values)
                await session.commit()
            except IntegrityError as exc:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Email or username already exists",
                ) from exc
            if profile is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found")
            profile["role"] = profile["role"].lower()
            return profile

        current = next(
            (entry for entry in InMemoryStore.users.values() if entry["user_id"] == user["user_id"]),
            None,
        )
        if current is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found")
        email = current["email"]
        username = values.get("username", current["username"])
        if any(
            stored_email != current["email"]
            and (
                profile["username"].casefold() == username.casefold()
            )
            for stored_email, profile in InMemoryStore.users.items()
        ):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already exists")
        updated = {**current, **values, "email": email, "username": username}
        InMemoryStore.users[email] = updated
        return {
            "user_id": updated["user_id"],
            "role": updated["role"],
            "full_name": updated["full_name"],
            "username": updated["username"],
            "email": updated["email"],
            "phone": updated.get("phone"),
        }

    @staticmethod
    async def list_users(
        user: dict,
        *,
        role: str | None = None,
        search: str | None = None,
        limit: int = 20,
        offset: int = 0,
        session: AsyncSession | None = None,
    ) -> list[dict]:
        if user["role"] != "admin":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
        if session is not None:
            return await UserRepository(session).list_users(
                role=role,
                search=search,
                limit=limit,
                offset=offset,
            )

        profiles = [
            {
                "user_id": entry["user_id"],
                "role": entry["role"],
                "full_name": entry["full_name"],
                "username": entry["username"],
                "email": entry["email"],
                "phone": entry.get("phone"),
                "is_verified": entry.get("is_verified", False),
            }
            for entry in InMemoryStore.users.values()
        ]
        if role:
            profiles = [entry for entry in profiles if entry["role"] == role]
        if search:
            term = search.casefold()
            profiles = [
                entry for entry in profiles
                if any(term in str(entry[field]).casefold() for field in ("full_name", "username", "email"))
            ]
        return sorted(profiles, key=lambda entry: entry["user_id"])[offset : offset + limit]

    @staticmethod
    async def update_admin_user(
        actor: dict,
        user_id: int,
        values: dict,
        session: AsyncSession | None,
    ) -> dict:
        AuthService._require_admin_database(actor, session)
        if user_id == actor["user_id"] and values.get("role") not in (None, "admin"):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Administrators cannot change their own role",
            )
        try:
            profile = await UserRepository(session).update_admin_user(
                user_id,
                role=values.get("role"),
                is_verified=values.get("is_verified"),
            )
            if profile is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
            await session.commit()
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
        return profile

    @staticmethod
    async def delete_admin_user(actor: dict, user_id: int, session: AsyncSession | None) -> None:
        AuthService._require_admin_database(actor, session)
        if user_id == actor["user_id"]:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The active administrator account cannot be deleted",
            )
        try:
            deleted = await UserRepository(session).delete_admin_user(user_id)
            if not deleted:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
            await session.commit()
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    @staticmethod
    def _require_admin_database(actor: dict, session: AsyncSession | None) -> None:
        if actor["role"] != "admin":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
        if session is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Persistent administrator storage is unavailable",
            )

    @staticmethod
    async def verify_reset_email(email: str, session: AsyncSession | None = None) -> dict:
        clean_email = str(email).strip().casefold()
        if session is not None:
            user = await UserRepository(session).authenticate(clean_email)
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="No account found with this email address.",
                )
            return {
                "email": clean_email,
                "full_name": user.get("full_name") or user.get("username", ""),
                "role": user.get("role", "").lower(),
                "exists": True,
            }

        user = InMemoryStore.users.get(clean_email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No account found with this email address.",
            )
        return {
            "email": clean_email,
            "full_name": user.get("full_name") or user.get("username", ""),
            "role": user.get("role", "").lower(),
            "exists": True,
        }

    @staticmethod
    async def reset_password(
        payload: ResetPasswordRequest, session: AsyncSession | None = None
    ) -> dict:
        clean_email = str(payload.email).strip().casefold()
        hashed = hash_password(payload.new_password)

        if session is not None:
            user = await UserRepository(session).authenticate(clean_email)
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="No account found with this email address.",
                )
            await UserRepository(session).reset_password(clean_email, hashed)
            if clean_email in InMemoryStore.users:
                InMemoryStore.users[clean_email]["password"] = hashed
            return {
                "email": clean_email,
                "message": "Password reset successfully. You can now log in.",
            }

        if clean_email not in InMemoryStore.users:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No account found with this email address.",
            )
        InMemoryStore.users[clean_email]["password"] = hashed
        return {
            "email": clean_email,
            "message": "Password reset successfully. You can now log in.",
        }

