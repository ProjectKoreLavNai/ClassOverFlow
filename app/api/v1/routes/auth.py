from fastapi import APIRouter

from app.core.deps import get_current_user
from app.schemas.auth import UserLogin, UserRegister
from app.services.auth_service import AuthService

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])


@router.post("/register", status_code=201)
def register(payload: UserRegister):
    user = AuthService.register(payload)
    return {"data": user}


@router.post("/login")
def login(payload: UserLogin):
    token_data = AuthService.login(payload)
    return {"data": token_data}


@router.get("/me")
def me(user: dict = get_current_user):
    return {"data": {"email": user["email"], "role": user["role"]}}
