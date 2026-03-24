from typing import List, Literal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from server.database import get_db, session_scope
from server.models.db import ProjectSettings
from server.models.schemas import Project
from server.services.projects import scan_projects_logic, update_single_project_logic
from server.services.update_logs import persist_update_log


router = APIRouter(prefix="/api", tags=["projects"])

_ToggleField = Literal["excluded", "full_stop"]


def _toggle_project_field(name: str, field: _ToggleField, db: Session) -> dict:
    project = db.query(ProjectSettings).filter(ProjectSettings.name == name).first()
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    setattr(project, field, not getattr(project, field))
    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error al guardar el proyecto") from None
    return {"status": "ok"}


@router.get("/projects", response_model=List[Project])
async def get_projects():
    def work():
        with session_scope() as db:
            return scan_projects_logic(db)

    return await run_in_threadpool(work)


@router.post("/projects/{name}/update")
async def update_project(name: str):
    def work():
        with session_scope() as db:
            success, logs = update_single_project_logic(name, db)

            summary = f"{name}: {'OK' if success else 'ERROR'}"
            try:
                persist_update_log(
                    db,
                    status="SUCCESS" if success else "ERROR",
                    summary=summary,
                    details={name: logs},
                )
            except SQLAlchemyError:
                raise HTTPException(
                    status_code=500, detail="Error al guardar el historial"
                ) from None

            if not success:
                raise HTTPException(status_code=500, detail="\n".join(logs))

            return {"success": success, "logs": logs}

    return await run_in_threadpool(work)


@router.post("/projects/{name}/toggle_exclude")
def toggle_exclude(name: str, db: Session = Depends(get_db)):
    return _toggle_project_field(name, "excluded", db)


@router.post("/projects/{name}/toggle_fullstop")
def toggle_fullstop(name: str, db: Session = Depends(get_db)):
    return _toggle_project_field(name, "full_stop", db)
