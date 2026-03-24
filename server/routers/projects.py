import json
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from server.database import get_db
from server.models.db import ProjectSettings, UpdateLog
from server.models.schemas import Project
from server.services.projects import scan_projects_logic, update_single_project_logic


router = APIRouter(prefix="/api", tags=["projects"])


@router.get("/projects", response_model=List[Project])
def get_projects(db: Session = Depends(get_db)):
    return scan_projects_logic(db)


@router.post("/projects/{name}/update")
def update_project(name: str, db: Session = Depends(get_db)):
    success, logs = update_single_project_logic(name, db)

    summary = f"{name}: {'OK' if success else 'ERROR'}"
    new_log = UpdateLog(
        status="SUCCESS" if success else "ERROR",
        summary=summary,
        details=json.dumps({name: logs}),
    )
    db.add(new_log)
    db.commit()

    if not success:
        raise HTTPException(status_code=500, detail="\n".join(logs))

    return {"success": success, "logs": logs}


@router.post("/projects/{name}/toggle_exclude")
def toggle_exclude(name: str, db: Session = Depends(get_db)):
    project = db.query(ProjectSettings).filter(ProjectSettings.name == name).first()
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    project.excluded = not project.excluded
    db.commit()
    return {"status": "ok"}


@router.post("/projects/{name}/toggle_fullstop")
def toggle_fullstop(name: str, db: Session = Depends(get_db)):
    project = db.query(ProjectSettings).filter(ProjectSettings.name == name).first()
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    project.full_stop = not project.full_stop
    db.commit()
    return {"status": "ok"}
