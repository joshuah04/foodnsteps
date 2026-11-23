# Shared test setup: a clean database for every test
# Uses DATABASE_URL when set (CI points it at PostgreSQL), otherwise a temporary SQLite file
import os
import tempfile

import pytest

if "DATABASE_URL" not in os.environ:
    os.environ["DATABASE_URL"] = "sqlite:///" + os.path.join(tempfile.mkdtemp(), "test.db")

from fastapi.testclient import TestClient  # noqa: E402

from app.db import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture()
def client():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as c:
        yield c
    Base.metadata.drop_all(bind=engine)


def make_session(actions: list[str], style_id: str | None = "balanced", meal_id: str = "ramen") -> dict:
    # builds a request body shaped like what the frontend sends
    steps = []
    for i, action_id in enumerate(actions, start=1):
        steps.append({
            "n": i,
            "actionId": action_id,
            "label": action_id.replace("_", " "),
            "target": action_id.split("_")[-1],
            "category": "eat",
            "t": i * 1000,
            "removed": {},
            "note": "",
            "after": {},
        })
    return {
        "mealId": meal_id,
        "startedAt": "2026-11-23T20:00:00Z",
        "finishedAt": "2026-11-23T20:05:00Z",
        "durationMs": 300000,
        "completed": False,
        "steps": steps,
        "finalAmounts": {"broth": 5, "noodles": 5},
        "spice": {"salt": 0, "pepper": 0, "chili": 0},
        "stirCount": 0,
        "styleId": style_id,
    }
