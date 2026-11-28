# The seed script fills each meal with simulated plays that only use that meal's actions
import random

from sqlalchemy import select

from app.db import SessionLocal
from app.models import Play, StepRow
from app.seed import MEALS, seed, simulate
from tests.conftest import make_session


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


def test_simulated_sushi_only_orders_more_of_a_finished_kind():
    for n in range(20):
        steps, _ = simulate(MEALS["sushi"], random.Random(n))
        before = dict(MEALS["sushi"].start)
        counts: dict[str, int] = {}
        for action_id, after in steps:
            if action_id.startswith("more_"):
                kind = action_id[len("more_"):]
                assert before[kind] == 0
                assert after[kind] == MEALS["sushi"].start[kind]
                counts[action_id] = counts.get(action_id, 0) + 1
            before = after
        assert all(c <= MEALS["sushi"].max_refills for c in counts.values())


def test_order_category_is_accepted(client):
    body = make_session(["eat_salmon", "more_salmon"], meal_id="sushi")
    body["steps"][1]["category"] = "order"
    assert client.post("/api/sessions", json=body).status_code == 201
