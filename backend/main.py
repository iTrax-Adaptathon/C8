"""FastAPI entrypoint for the Hospital Capacity & Patient Flow API.

Run with:  uvicorn backend.main:app --port 8000
Swagger UI: http://127.0.0.1:8000/docs
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.api.routers import allocations, events, health, matches, patients, resources
from backend.database import init_db
from backend.errors import AppError


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="Hospital Capacity & Patient Flow API",
    description="Visibility, matching, safe allocation and traceability for hospital capacity.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(AppError)
async def app_error_handler(_request: Request, exc: AppError):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.get("/", include_in_schema=False)
def root():
    return {
        "service": "Hospital Capacity & Patient Flow API",
        "docs": "/docs",
        "health": "/health",
    }


for router in (
    health.router,
    resources.router,
    patients.router,
    matches.router,
    allocations.router,
    events.router,
):
    app.include_router(router)
