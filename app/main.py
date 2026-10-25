from fastapi import FastAPI

from app.api.v1.api import api_router

app = FastAPI(
    title="ClassOverFlow API",
    description="Modular backend skeleton for authentication, course management, and announcements.",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

app.include_router(api_router)


@app.get("/")
def root():
    return {
        "app": "ClassOverFlow",
        "status": "ready",
        "message": "Core backend skeleton is running. Attach your database when ready.",
    }
