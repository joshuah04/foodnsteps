# The seed script fills each meal with simulated plays that only use that meal's actions
import random

from sqlalchemy import select

from app.db import SessionLocal
from app.models import Play, StepRow
from app.seed import MEALS, seed, simulate


def test_simulated_burger_play_only_uses_burger_actions():
    steps, final = simulate(MEALS["burger"], random.Random(1))
    assert steps
    assert {a for a, _ in steps} <= set(MEALS["burger"].actions)
    assert all(v >= 0 for v in final.values())


def test_seed_burger_plays_are_kept_apart_from_ramen(client):
    seed(20, meal_id="ramen")
    seed(15, meal_id="burger")
    with SessionLocal() as db:
        burger_ids = db.scalars(select(Play.id).where(Play.meal_id == "burger")).all()
        assert len(burger_ids) == 15
        actions = set(db.scalars(select(StepRow.action_id).where(StepRow.play_id.in_(burger_ids))).all())
    assert actions <= set(MEALS["burger"].actions)

    body = client.get(f"/api/sessions/{burger_ids[0]}/results").json()
    assert body["mealId"] == "burger"
    assert body["plays"] == 15
    assert body["topOpening"]["value"] in MEALS["burger"].actions
