# Database tables: one row per play in plays, one row per action in steps
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Play(Base):
    __tablename__ = "plays"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    meal_id: Mapped[str] = mapped_column(String(64), index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    duration_ms: Mapped[int] = mapped_column(Integer)
    completed: Mapped[bool] = mapped_column(Boolean)
    style_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    final_amounts: Mapped[dict[str, Any]] = mapped_column(JSON)
    spice: Mapped[dict[str, Any]] = mapped_column(JSON)
    stir_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)

    steps: Mapped[list["StepRow"]] = relationship(
        back_populates="play", cascade="all, delete-orphan", order_by="StepRow.step_number"
    )


class StepRow(Base):
    __tablename__ = "steps"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    play_id: Mapped[str] = mapped_column(ForeignKey("plays.id", ondelete="CASCADE"), index=True)
    step_number: Mapped[int] = mapped_column(Integer)
    action_id: Mapped[str] = mapped_column(String(64), index=True)
    label: Mapped[str] = mapped_column(String(128))
    target: Mapped[str] = mapped_column(String(64))
    category: Mapped[str] = mapped_column(String(16))
    t_ms: Mapped[int] = mapped_column(Integer)
    removed: Mapped[dict[str, Any]] = mapped_column(JSON)
    note: Mapped[str] = mapped_column(Text, default="")
    after: Mapped[dict[str, Any]] = mapped_column(JSON)

    play: Mapped[Play] = relationship(back_populates="steps")
