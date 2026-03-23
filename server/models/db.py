import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from server.database import Base


class ProjectSettings(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String, unique=True, index=True)
    path: Mapped[str] = mapped_column(String)
    excluded: Mapped[bool] = mapped_column(Boolean, default=False)
    full_stop: Mapped[bool] = mapped_column(Boolean, default=False)


class ScheduledTask(Base):
    __tablename__ = "schedules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    target: Mapped[str] = mapped_column(String)
    task_type: Mapped[str] = mapped_column(String)
    expression: Mapped[str] = mapped_column(String)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class UpdateLog(Base):
    __tablename__ = "logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    timestamp: Mapped[datetime.datetime] = mapped_column(
        DateTime,
        default=datetime.datetime.now,
    )
    status: Mapped[str] = mapped_column(String)
    summary: Mapped[str] = mapped_column(Text)
    details: Mapped[str] = mapped_column(Text)
