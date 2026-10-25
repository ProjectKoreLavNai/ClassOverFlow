from fastapi import APIRouter

from app.api.v1.routes.announcements import router as announcements_router
from app.api.v1.routes.auth import router as auth_router
from app.api.v1.routes.courses import router as courses_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(courses_router)
api_router.include_router(announcements_router)
