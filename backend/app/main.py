"""
Main FastAPI application entry point for PREVENT.
Proactive Risk & Early Warning Intelligence Platform.
"""
from contextlib import asynccontextmanager
from typing import AsyncGenerator
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from backend.app.core.config import settings
from backend.app.db.base import Base
from backend.app.db.session import engine
from backend.app.api.v1.router import api_v1_router


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Lifespan context manager to handle application startup and teardown."""
    # Ensure database schema is initialized on startup
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    description=(
        "PREVENT is an AI-powered safety decision-support platform that connects scattered "
        "warning signals (maintenance records, complaints, inspections, driver logs, near-misses) "
        "across time and independent reporting sources to detect escalating risk patterns "
        "before they develop into major incidents."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan
)

# Configure CORS for local frontend development (e.g. React/Vite on http://localhost:5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get(
    "/health",
    tags=["System"],
    status_code=status.HTTP_200_OK,
    summary="Health Check",
    description="Returns simple operational status to verify the backend is online."
)
def health_check() -> dict:
    """Simple operational health check."""
    return {"status": "ok"}


# Mount API v1 router
app.include_router(api_v1_router, prefix=settings.API_V1_PREFIX)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
