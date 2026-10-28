from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.v1.api import api_router
from app.config import settings
from app.db.database import check_database_connection, engine
from app.repositories.in_memory_store import InMemoryStore

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    if settings.storage_backend == "database":
        try:
            await check_database_connection()
        except (OSError, SQLAlchemyError, RuntimeError) as exc:
            logger.warning(
                "Database startup check failed; API is starting in not-ready state: %s",
                exc,
            )
            InMemoryStore.seed_defaults()
    else:
        InMemoryStore.seed_defaults()
    yield
    if settings.storage_backend == "database":
        await engine.dispose()


app = FastAPI(
    title="ClassOverFlow API",
    description="FastAPI backend for authentication, course management, and announcements.",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/health/live", tags=["Health"], summary="Check API process")
def health_live():
    return {"status": "alive"}


@app.get("/health/ready", tags=["Health"], summary="Check database readiness")
async def health_ready():
    if settings.storage_backend != "database":
        return JSONResponse(
            status_code=503,
            content={
                "status": "not_ready",
                "storage_backend": settings.storage_backend,
                "database_connected": False,
                "detail": "Set STORAGE_BACKEND=database to enable persistent API storage.",
            },
        )

    try:
        await check_database_connection()
    except (OSError, SQLAlchemyError, RuntimeError) as exc:
        logger.warning("Database readiness check failed: %s", exc)
        return JSONResponse(
            status_code=503,
            content={
                "status": "not_ready",
                "storage_backend": settings.storage_backend,
                "database_connected": False,
                "detail": "Database is unavailable or required schema objects are missing; check server logs.",
            },
        )

    return {
        "status": "ready",
        "storage_backend": settings.storage_backend,
        "database_connected": True,
    }


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(status_code=exc.status_code, content={"error": exc.detail}, headers=exc.headers)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = [
        {"type": error["type"], "loc": error["loc"], "msg": error["msg"]}
        for error in exc.errors()
    ]
    return JSONResponse(status_code=422, content={"error": errors})


@app.get("/")
def root():
    return {
        "app": "ClassOverFlow",
        "status": "ready",
        "message": (
            "PostgreSQL storage is active."
            if settings.storage_backend == "database"
            else "Running with temporary in-memory storage."
        ),
    }
