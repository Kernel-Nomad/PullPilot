from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from server.database import get_db
from server.models.db import ScheduledTask
from server.models.schemas import ScheduleInput, ScheduledTaskOut
from server.services.scheduler import build_trigger, refresh_scheduler_jobs


router = APIRouter(prefix="/api", tags=["schedules"])


def _normalize_date_expression(raw: str) -> str:
    s = raw.strip().replace("T", " ", 1)
    if s.count(":") == 1:
        s = f"{s}:00"
    return s


@router.get("/schedules", response_model=list[ScheduledTaskOut])
def get_schedules(db: Session = Depends(get_db)):
    return db.query(ScheduledTask).all()


@router.post("/schedules", response_model=ScheduledTaskOut)
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
        expression = _normalize_date_expression(data.date_iso or "")

    try:
        build_trigger(data.task_type, expression)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    new_task = ScheduledTask(
        target=data.target,
        task_type=data.task_type,
        expression=expression,
        active=True,
    )
    db.add(new_task)
    try:
        db.commit()
        db.refresh(new_task)
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error al guardar la programacion") from None

    refresh_scheduler_jobs()
    return new_task


@router.delete("/schedules/{schedule_id}")
def delete_schedule(schedule_id: int, db: Session = Depends(get_db)):
    task = db.query(ScheduledTask).filter(ScheduledTask.id == schedule_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Programacion no encontrada")
    db.delete(task)
    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error al eliminar la programacion") from None
    refresh_scheduler_jobs()
    return {"status": "ok"}
