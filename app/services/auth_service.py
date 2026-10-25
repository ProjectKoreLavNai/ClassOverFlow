from __future__ import annotations

from fastapi import HTTPException, status

from app.core.security import create_access_token, hash_password, verify_password
from app.repositories.in_memory_store import InMemoryStore
from app.schemas.auth import UserLogin, UserRegister


class AuthService:
    @staticmethod
    def register(payload: UserRegister) -> dict:
        if payload.email in InMemoryStore.users:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User already exists")

        InMemoryStore.users[payload.email] = {
            "full_name": payload.full_name,
            "username": payload.username,
            "email": payload.email,
            "password": hash_password(payload.password),
            "role": payload.role,
        }

        return {
            "email": payload.email,
            "role": payload.role,
            "full_name": payload.full_name,
            "username": payload.username,
        }

    @staticmethod
    def login(payload: UserLogin) -> dict:
        user = InMemoryStore.users.get(payload.email)
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

        if not verify_password(payload.password, user["password"]):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

        token = create_access_token(user["email"], user["role"])
        return {
            "access_token": token,
            "token_type": "bearer",
            "expires_in": 3600,
            "user": {
                "email": user["email"],
                "role": user["role"],
                "username": user["username"],
            },
        }

    @staticmethod
    def get_user(email: str) -> dict | None:
        return InMemoryStore.users.get(email)
