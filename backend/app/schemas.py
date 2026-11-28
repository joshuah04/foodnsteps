# Request and response shapes, written in camelCase on the wire to match the TypeScript types
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class StepIn(CamelModel):
    n: int = Field(ge=1)
    action_id: str = Field(min_length=1, max_length=64)
    label: str = Field(max_length=128)
    target: str = Field(max_length=64)
    category: Literal["eat", "sip", "season", "prep", "order"]
    t: int = Field(ge=0)
    removed: dict[str, int] = {}
    note: str = ""
    after: dict[str, int] = {}


class SessionIn(CamelModel):
    meal_id: str = Field(min_length=1, max_length=64)
    started_at: datetime
    finished_at: datetime
    duration_ms: int = Field(ge=0)
    completed: bool
    steps: list[StepIn] = Field(min_length=1, max_length=500)
    final_amounts: dict[str, int]
    spice: dict[str, int] = {}
    stir_count: int = Field(default=0, ge=0)
    style_id: str | None = Field(default=None, max_length=64)


class SessionCreated(CamelModel):
    id: str


class Count(CamelModel):
    value: str | None
    count: int


class Similarity(CamelModel):
    # percent similarity with the single closest other play, and the average over all compared plays
    closest_percent: float | None
    average_percent: float | None
    compared_with: int


class ResultsOut(CamelModel):
    session_id: str
    meal_id: str
    plays: int
    same_opening: int
    top_opening: Count
    top_action: Count
    total_steps: int
    top_style: Count
    same_style: int
    similarity: Similarity
