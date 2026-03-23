from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from server.database import get_db
from server.models.db import ScheduledTask
from server.models.schemas import ScheduleInput
from server.services.scheduler import refresh_scheduler_jobs


router = APIRouter(prefix="/api", tags=["schedules"])


@router.get("/schedules")
def get_schedules(db: Session = Depends(get_db)):
    return db.query(ScheduledTask).all()


@router.post("/schedules")
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
        expression = data.date_iso or ""

    new_task = ScheduledTask(
        target=data.target,
        task_type=data.task_type,
        expression=expression,
        active=True,
    )
    db.add(new_task)
    db.commit()
    db.refresh(new_task)

    refresh_scheduler_jobs()
    return new_task


@router.delete("/schedules/{schedule_id}")
def delete_schedule(schedule_id: int, db: Session = Depends(get_db)):
    task = db.query(ScheduledTask).filter(ScheduledTask.id == schedule_id).first()
    if task:
        db.delete(task)
        db.commit()
        refresh_scheduler_jobs()
    return {"status": "ok"}
