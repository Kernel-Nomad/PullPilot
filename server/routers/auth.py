from fastapi import APIRouter, Form, Request, status
from fastapi.responses import HTMLResponse, RedirectResponse

from server.config import AUTH_PASS, AUTH_USER, TEMPLATES_DIR


router = APIRouter()


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
    if username == AUTH_USER and password == AUTH_PASS:
        request.session["user"] = username
        return RedirectResponse(url="/", status_code=status.HTTP_303_SEE_OTHER)
    return RedirectResponse(url="/login?error=1", status_code=status.HTTP_303_SEE_OTHER)


@router.post("/logout")
async def logout(request: Request):
    request.session.clear()
    return RedirectResponse(url="/login", status_code=status.HTTP_303_SEE_OTHER)
