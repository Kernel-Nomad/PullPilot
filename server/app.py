import datetime
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware

from server.config import (
    AUTH_PASS,
    AUTH_USER,
    SESSION_HTTPS_ONLY,
    SESSION_SECRET,
    STATIC_DIR,
)
from server.database import Base, engine
from server.models import db as _db_models  # noqa: F401
from server.routers.auth import router as auth_router
from server.routers.projects import router as projects_router
from server.routers.schedules import router as schedules_router
from server.routers.status import router as status_router
from server.services.scheduler import start_scheduler, stop_scheduler


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(title="PullPilot API", lifespan=lifespan)


@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    if not AUTH_USER or not AUTH_PASS:
        return await call_next(request)

    path = request.url.path
    public_paths = {"/login", "/logout"}
    public_extensions = (
        ".png",
        ".ico",
        ".js",
        ".css",
        ".svg",
        ".json",
        ".webmanifest",
    )

    if (
        path in public_paths
        or path.endswith(public_extensions)
        or path.startswith("/assets/")
    ):
        return await call_next(request)

    user = request.session.get("user")
    if not user:
        if path.startswith("/api"):
            return JSONResponse(status_code=401, content={"detail": "Sesion expirada"})
        return RedirectResponse(url="/login")

    request.session["user"] = user
    request.session["last_seen"] = int(datetime.datetime.utcnow().timestamp())
    return await call_next(request)


app.add_middleware(
    SessionMiddleware,
    secret_key=SESSION_SECRET,
    max_age=2592000,
    session_cookie="pullpilot_session",
    https_only=SESSION_HTTPS_ONLY,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(projects_router)
app.include_router(schedules_router)
app.include_router(status_router)

if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")

    @app.exception_handler(404)
    async def not_found_handler(_: Request, __):
        return FileResponse(str(STATIC_DIR / "index.html"))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
