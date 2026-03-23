from typing import Optional

from pydantic import BaseModel


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
