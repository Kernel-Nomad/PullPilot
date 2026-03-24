from datetime import datetime
from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

CronFrequency = Literal["daily", "weekly", "monthly"]
TaskType = Literal["cron", "date"]


class Project(BaseModel):
    name: str
    path: str
    status: str
    containers: int
    excluded: bool
    full_stop: bool


class ScheduleInput(BaseModel):
    target: str = Field(
        ...,
        max_length=256,
        pattern=r"^(GLOBAL|[^\s/\\]+)$",
    )
    task_type: TaskType = "cron"
    frequency: CronFrequency = "daily"
    week_day: str = Field(default="*", pattern=r"^(\*|mon|tue|wed|thu|fri|sat|sun)$")
    day_of_month: str = Field(default="1", pattern=r"^(?:[1-9]|[12]\d|3[01])$")
    hour: int = Field(default=0, ge=0, le=23)
    minute: int = Field(default=0, ge=0, le=59)
    date_iso: str | None = None

    @model_validator(mode="after")
    def require_date_iso_for_once(self) -> Self:
        if self.task_type == "date":
            if not (self.date_iso and str(self.date_iso).strip()):
                raise ValueError("date_iso es obligatorio para task_type date")
        return self


class ScheduledTaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    target: str
    task_type: str
    expression: str
    active: bool


class UpdateLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    timestamp: datetime
    status: str
    summary: str
    details: str
