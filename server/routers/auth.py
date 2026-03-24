from fastapi import APIRouter, Form, Request, status
from fastapi.responses import HTMLResponse, RedirectResponse

from server.config import AUTH_PASS, AUTH_USER, TEMPLATES_DIR, TRUST_X_FORWARDED_FOR
from server.login_rate_limit import (
    clear_login_failures,
    is_login_rate_limited,
    record_login_failure,
)


router = APIRouter()


def _client_ip(request: Request) -> str:
    if TRUST_X_FORWARDED_FOR:
        xff = request.headers.get("x-forwarded-for")
        if xff:
            return xff.split(",")[0].strip() or "unknown"
    if request.client:
        return request.client.host
    return "unknown"


@router.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    if request.session.get("user"):
        return RedirectResponse(url="/")

    login_path = TEMPLATES_DIR / "login.html"
    if not login_path.exists():
        return HTMLResponse("<h1>Error: login.html not found</h1>", status_code=500)
    return login_path.read_text(encoding="utf-8")


@router.post("/login")
async def login(
    request: Request,
    username: str = Form(...),
    password: str = Form(...),
):
    ip = _client_ip(request)
    if AUTH_USER and AUTH_PASS and is_login_rate_limited(ip):
        return RedirectResponse(url="/login?ratelimit=1", status_code=status.HTTP_303_SEE_OTHER)

    if username == AUTH_USER and password == AUTH_PASS:
        if AUTH_USER and AUTH_PASS:
            clear_login_failures(ip)
        request.session["user"] = username
        return RedirectResponse(url="/", status_code=status.HTTP_303_SEE_OTHER)

    if AUTH_USER and AUTH_PASS:
        record_login_failure(ip)
    return RedirectResponse(url="/login?error=1", status_code=status.HTTP_303_SEE_OTHER)


@router.post("/logout")
async def logout(request: Request):
    request.session.clear()
    return RedirectResponse(url="/login", status_code=status.HTTP_303_SEE_OTHER)
