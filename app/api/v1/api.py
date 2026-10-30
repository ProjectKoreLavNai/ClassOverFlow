from fastapi import APIRouter

from app.api.v1.routes.announcements import (
    comments_router as announcement_comments_router,
    items_router as announcement_items_router,
    router as announcements_router,
)
from app.api.v1.routes.auth import router as auth_router
from app.api.v1.routes.auth import users_router
from app.api.v1.routes.courses import router as courses_router
from app.api.v1.routes.gradebook import router as gradebook_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(courses_router)
api_router.include_router(gradebook_router)
api_router.include_router(announcements_router)
api_router.include_router(announcement_items_router)
api_router.include_router(announcement_comments_router)
