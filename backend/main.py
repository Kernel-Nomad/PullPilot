import os
import subprocess
import json
import logging
import sqlite3
import datetime
import secrets
from typing import List, Optional
from fastapi import FastAPI, BackgroundTasks, HTTPException, Depends, Request, Form, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse, JSONResponse
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, Boolean, Text, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.date import DateTrigger
from starlette.middleware.sessions import SessionMiddleware

DATA_DIR = os.getenv("DATA_DIR", "/app/data")
PROJECTS_ROOT = os.getenv("PROJECTS_ROOT", "/app/projects")
DB_PATH = os.path.join(DATA_DIR, "pullpilot.db")
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")

AUTH_USER = os.getenv("AUTH_USER")
AUTH_PASS = os.getenv("AUTH_PASS")
SESSION_SECRET = os.getenv("SESSION_SECRET", secrets.token_hex(32))

os.environ.setdefault("TZ", "UTC")
os.makedirs(DATA_DIR, exist_ok=True)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("pullpilot")

Base = declarative_base()
engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class ProjectSettings(Base):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    path = Column(String)
    excluded = Column(Boolean, default=False)
    full_stop = Column(Boolean, default=False)

class ScheduledTask(Base):
    __tablename__ = "schedules"
    id = Column(Integer, primary_key=True, index=True)
    target = Column(String)
    task_type = Column(String)
    expression = Column(String)
    active = Column(Boolean, default=True)

class UpdateLog(Base):
    __tablename__ = "logs"
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.datetime.now)
    status = Column(String)
    summary = Column(Text)
    details = Column(Text)

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

global_update_status = {
    "is_running": False,
    "total": 0,
    "current": 0,
    "current_project": "",
    "processed": []
}

app = FastAPI(title="PullPilot API")

app.add_middleware(
    SessionMiddleware,
    secret_key=SESSION_SECRET,
    max_age=86400,
    session_cookie="pullpilot_session",
    https_only=False
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def auth_middleware(request: Request, call_next):

    if not AUTH_USER or not AUTH_PASS:
        return await call_next(request)

    path = request.url.path

    public_paths = ["/login", "/logout"]
    public_extensions = (".png", ".ico", ".js", ".css", ".svg", ".json")

    if path in public_paths or path.endswith(public_extensions) or path.startswith("/assets/"):
        return await call_next(request)

    user = request.session.get("user")
    if not user:

        if path.startswith("/api"):
            return JSONResponse(status_code=401, content={"detail": "Sesión expirada"})

        return RedirectResponse(url="/login")

    return await call_next(request)

class Project(BaseModel):
    name: str
    path: str
    status: str
    containers: int
    excluded: bool
    full_stop: bool

class ScheduleInput(BaseModel):
    target: str
    task_type: str = "cron"
    frequency: str
    week_day: str = "*"
    day_of_month: str = "1"
    hour: int = 0
    minute: int = 0
    date_iso: Optional[str] = None

def get_docker_compose_cmd():
    try:
        subprocess.run(["docker", "compose", "version"],
                       stdout=subprocess.DEVNULL,
                       stderr=subprocess.DEVNULL,
                       check=True)
        return "docker compose"
    except (subprocess.CalledProcessError, FileNotFoundError):
        return "docker-compose"

COMPOSE_CMD = get_docker_compose_cmd()

def run_command(cmd, cwd=None):
    try:
        logger.info(f"Ejecutando: {cmd} en {cwd}")
        result = subprocess.run(
            cmd,
            cwd=cwd,
            shell=True,
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        error_msg = f"Error command: {cmd}\nStderr: {e.stderr}"
        logger.error(error_msg)
        raise Exception(error_msg)

def scan_projects_logic(db: Session):
    found = []
    if not os.path.exists(PROJECTS_ROOT):
        logger.warning(f"Directorio PROJECTS_ROOT no existe: {PROJECTS_ROOT}")
        return []

    for entry in os.listdir(PROJECTS_ROOT):
        if entry.lower() in ["pullpilot", "pullpilot-ui", "docker-updater", "data"]:
            continue

        path = os.path.join(PROJECTS_ROOT, entry)

        if os.path.isdir(path):
            has_compose = os.path.exists(os.path.join(path, "docker-compose.yml")) or\
                          os.path.exists(os.path.join(path, "docker-compose.yaml"))

            if has_compose:
                proj = db.query(ProjectSettings).filter(ProjectSettings.name == entry).first()
                if not proj:
                    proj = ProjectSettings(name=entry, path=path)
                    db.add(proj)
                    db.commit()
                    db.refresh(proj)

                try:
                    output = run_command(f"{COMPOSE_CMD} ps -q", cwd=path)
                    running_count = len(output.splitlines()) if output else 0
                    status = "running" if running_count > 0 else "stopped"
                except Exception:
                    status = "error"
                    running_count = 0

                found.append({
                    "name": entry,
                    "path": path,
                    "status": status,
                    "containers": running_count,
                    "excluded": proj.excluded,
                    "full_stop": proj.full_stop
                })
    return found

def update_single_project_logic(name: str, db: Session):
    project = db.query(ProjectSettings).filter(ProjectSettings.name == name).first()
    if not project:
        return False, ["Proyecto no encontrado en base de datos."]

    logs = []
    logs.append(f"=== Iniciando actualización de {name} ===")

    try:
        if os.path.isdir(os.path.join(project.path, ".git")):
            logs.append(f"> git pull en {project.path}")
            try:
                git_out = run_command("git pull", cwd=project.path)
                logs.append(git_out if git_out else "Git: Already up to date.")
            except Exception as e:
                logs.append(f"Error en Git Pull (se continuará): {str(e)}")
        else:
             logs.append(f"> Omitiendo git pull (no es un repo git): {project.path}")

        logs.append(f"> {COMPOSE_CMD} pull")
        pull_out = run_command(f"{COMPOSE_CMD} pull", cwd=project.path)
        logs.append(pull_out)

        if project.full_stop:
            logs.append(f"> {COMPOSE_CMD} down (Modo Full Stop activado)")
            down_out = run_command(f"{COMPOSE_CMD} down", cwd=project.path)
            logs.append(down_out)

        logs.append(f"> {COMPOSE_CMD} up -d --build --remove-orphans")
        up_out = run_command(f"{COMPOSE_CMD} up -d --build --remove-orphans", cwd=project.path)
        logs.append(up_out)

        logs.append("=== Actualización completada con éxito ===")
        return True, logs

    except Exception as e:
        logs.append(f"!!! ERROR CRITICO !!!: {str(e)}")
        return False, logs

def global_update_job():
    global global_update_status

    if global_update_status["is_running"]:
        logger.warning("Actualización global ya en curso. Omitiendo tarea.")
        return

    global_update_status["is_running"] = True
    global_update_status["processed"] = []

    db = SessionLocal()
    logger.info("Iniciando tarea programada: Actualización Global")

    projects = db.query(ProjectSettings).filter(ProjectSettings.excluded == False).all()

    global_update_status["total"] = len(projects)
    global_update_status["current"] = 0

    global_logs = {}
    success_count = 0
    error_count = 0

    for i, proj in enumerate(projects):
        global_update_status["current"] = i + 1
        global_update_status["current_project"] = proj.name

        success, logs = update_single_project_logic(proj.name, db)
        global_logs[proj.name] = logs

        global_update_status["processed"].append({
            "name": proj.name,
            "status": "OK" if success else "ERROR"
        })

        if success: success_count += 1
        else: error_count += 1

    global_update_status["current_project"] = "Limpiando sistema (Prune)..."
    try:
        run_command("docker system prune -f")
        global_logs["system_prune"] = "Limpieza ejecutada"
    except:
        global_logs["system_prune"] = "Error en limpieza"

    summary = f"Global Update: {success_count} OK, {error_count} Errores"
    status = "SUCCESS" if error_count == 0 else "ERROR"

    new_log = UpdateLog(
        status=status,
        summary=summary,
        details=json.dumps(global_logs)
    )
    db.add(new_log)
    db.commit()
    db.close()

    global_update_status["is_running"] = False
    global_update_status["current_project"] = ""

def job_wrapper(target: str):
    if target == "GLOBAL":
        logger.info("Ejecutando Tarea Programada: GLOBAL")
        global_update_job()
    else:
        db = SessionLocal()
        try:
            logger.info(f"Ejecutando Tarea Programada: {target}")
            success, logs = update_single_project_logic(target, db)

            summary = f"[Scheduled] {target}: {'OK' if success else 'ERROR'}"
            new_log = UpdateLog(
                status="SUCCESS" if success else "ERROR",
                summary=summary,
                details=json.dumps({target: logs})
            )
            db.add(new_log)
            db.commit()
        except Exception as e:
            logger.error(f"Error en tarea programada {target}: {e}")
        finally:
            db.close()

scheduler = BackgroundScheduler()

def refresh_scheduler_jobs():
    scheduler.remove_all_jobs()

    db = SessionLocal()
    tasks = db.query(ScheduledTask).filter(ScheduledTask.active == True).all()

    count = 0
    for task in tasks:
        try:
            trigger = None
            job_id = f"job_{task.id}"

            if task.task_type == "cron":
                parts = task.expression.split()
                if len(parts) >= 5:
                    trigger = CronTrigger(
                        minute=parts[0],
                        hour=parts[1],
                        day=parts[2],
                        month=parts[3],
                        day_of_week=parts[4]
                    )
            elif task.task_type == "date":
                trigger = DateTrigger(run_date=task.expression)

            if trigger:
                scheduler.add_job(job_wrapper, trigger, args=[task.target], id=job_id, replace_existing=True)
                count += 1
        except Exception as e:
            logger.error(f"Error cargando tarea {task.id}: {e}")

    db.close()
    logger.info(f"Scheduler refrescado: {count} tareas activas.")

scheduler.start()
refresh_scheduler_jobs()

@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    if request.session.get("user"):
        return RedirectResponse(url="/")

    try:
        with open("login.html", "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        return HTMLResponse("<h1>Error: login.html not found</h1>", status_code=500)

@app.post("/login")
async def login(request: Request, username: str = Form(...), password: str = Form(...)):
    if username == AUTH_USER and password == AUTH_PASS:
        request.session["user"] = username
        return RedirectResponse(url="/", status_code=status.HTTP_303_SEE_OTHER)
    return RedirectResponse(url="/login?error=1", status_code=status.HTTP_303_SEE_OTHER)

@app.post("/logout")
async def logout(request: Request):
    request.session.clear()
    return RedirectResponse(url="/login", status_code=status.HTTP_303_SEE_OTHER)

@app.get("/api/projects", response_model=List[Project])
def get_projects(db: Session = Depends(get_db)):
    return scan_projects_logic(db)

@app.post("/api/projects/{name}/update")
def update_project(name: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    success, logs = update_single_project_logic(name, db)

    summary = f"{name}: {'OK' if success else 'ERROR'}"
    new_log = UpdateLog(
        status="SUCCESS" if success else "ERROR",
        summary=summary,
        details=json.dumps({name: logs})
    )
    db.add(new_log)
    db.commit()

    if not success:
        raise HTTPException(status_code=500, detail="\n".join(logs))

    return {"success": success, "logs": logs}

@app.post("/api/update-all")
def trigger_update_all(background_tasks: BackgroundTasks):
    background_tasks.add_task(global_update_job)
    return {"message": "Actualización global iniciada en segundo plano"}

@app.post("/api/projects/{name}/toggle_exclude")
def toggle_exclude(name: str, db: Session = Depends(get_db)):
    proj = db.query(ProjectSettings).filter(ProjectSettings.name == name).first()
    if proj:
        proj.excluded = not proj.excluded
        db.commit()
    return {"status": "ok"}

@app.post("/api/projects/{name}/toggle_fullstop")
def toggle_fullstop(name: str, db: Session = Depends(get_db)):
    proj = db.query(ProjectSettings).filter(ProjectSettings.name == name).first()
    if proj:
        proj.full_stop = not proj.full_stop
        db.commit()
    return {"status": "ok"}

@app.get("/api/history")
def get_history(db: Session = Depends(get_db)):
    logs = db.query(UpdateLog).order_by(UpdateLog.timestamp.desc()).limit(20).all()
    return logs

@app.get("/api/update-status")
def get_update_status():
    return global_update_status

@app.get("/api/schedules")
def get_schedules(db: Session = Depends(get_db)):
    return db.query(ScheduledTask).all()

@app.post("/api/schedules")
def create_schedule(data: ScheduleInput, db: Session = Depends(get_db)):
    expression = ""
    if data.task_type == "cron":
        if data.frequency == "daily":
            expression = f"{data.minute} {data.hour} * * *"
        elif data.frequency == "weekly":
            expression = f"{data.minute} {data.hour} * * {data.week_day}"
        elif data.frequency == "monthly":
            expression = f"{data.minute} {data.hour} {data.day_of_month} * *"
    elif data.task_type == "date":
        expression = data.date_iso

    new_task = ScheduledTask(
        target=data.target,
        task_type="cron",
        expression=expression,
        active=True
    )
    db.add(new_task)
    db.commit()
    db.refresh(new_task)

    refresh_scheduler_jobs()
    return new_task

@app.delete("/api/schedules/{id}")
def delete_schedule(id: int, db: Session = Depends(get_db)):
    task = db.query(ScheduledTask).filter(ScheduledTask.id == id).first()
    if task:
        db.delete(task)
        db.commit()
        refresh_scheduler_jobs()
    return {"status": "ok"}

if os.path.exists(STATIC_DIR):
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")

    @app.exception_handler(404)
    async def not_found_handler(request, exc):
        return FileResponse(os.path.join(STATIC_DIR, "index.html"))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
