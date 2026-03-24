from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy.orm import Session

from server.database import get_db
from server.models.db import UpdateLog
from server.services.scheduler import global_update_job, global_update_status


router = APIRouter(prefix="/api", tags=["status"])


@router.post("/update-all")
def trigger_update_all(background_tasks: BackgroundTasks):
    background_tasks.add_task(global_update_job)
    return {"message": "Actualizacion global iniciada en segundo plano"}


@router.get("/update-status")
def get_update_status():
    return global_update_status


@router.get("/history")
def get_history(db: Session = Depends(get_db)):
    logs = db.query(UpdateLog).order_by(UpdateLog.timestamp.desc()).limit(20).all()
    return logs
