# Fills the database with simulated plays so comparisons are not empty on day one
# Run from the backend folder: python -m app.seed --count 300
import argparse
import random
from datetime import datetime, timedelta, timezone

from .db import Base, SessionLocal, engine
from .models import Play, StepRow

# a small copy of the ramen actions: id, target, category, what it consumes
ACTIONS = {
    "eat_noodles": ("noodles", "eat", {"noodles": 1}),
    "slurp_noodles": ("noodles", "eat", {"noodles": 2}),
    "cool_noodles": ("noodles", "prep", {}),
    "sip_broth": ("broth", "sip", {"broth": 1}),
    "drink_bowl": ("broth", "sip", {"broth": 3}),
    "eat_chashu": ("chashu", "eat", {"chashu": 1}),
    "dip_chashu": ("chashu", "eat", {"chashu": 1}),
    "eat_egg": ("egg", "eat", {"egg": 1}),
    "eat_onion": ("onion", "eat", {"onion": 1}),
    "mix_onion": ("onion", "prep", {}),
    "eat_bamboo": ("bamboo", "eat", {"bamboo": 1}),
    "eat_nori": ("nori", "eat", {"nori": 1}),
    "soak_nori": ("nori", "eat", {"nori": 1}),
    "wrap_nori": ("nori", "eat", {"nori": 1, "noodles": 1}),
    "eat_corn": ("corn", "eat", {"corn": 1}),
    "add_salt": ("salt", "season", {"salt": 1}),
    "add_pepper": ("pepper", "season", {"pepper": 1}),
    "add_chili": ("chili", "season", {"chili": 1}),
    "stir_bowl": ("bowl", "prep", {}),
}

START = {"broth": 10, "noodles": 10, "chashu": 3, "egg": 2, "onion": 5, "bamboo": 4,
         "nori": 2, "corn": 4, "salt": 3, "pepper": 3, "chili": 3}
FOOD = ["broth", "noodles", "chashu", "egg", "onion", "bamboo", "nori", "corn"]

# each simulated player leans toward some actions, which gives the stats some shape
PERSONAS = [
    {"sip_broth": 6, "eat_noodles": 3},
    {"slurp_noodles": 6, "eat_noodles": 4},
    {"add_chili": 4, "add_pepper": 3, "add_salt": 2},
    {"stir_bowl": 3, "mix_onion": 3, "sip_broth": 2},
    {"eat_egg": 3, "eat_corn": 3, "eat_bamboo": 3},
    {},
]


def allowed(action_id: str, amounts: dict[str, int]) -> bool:
    _, _, consume = ACTIONS[action_id]
    if any(amounts[k] <= 0 for k in consume):
        return False
    if action_id == "drink_bowl" and amounts["noodles"] > 3:
        return False
    if action_id in ("stir_bowl", "mix_onion") and amounts["broth"] <= 0:
        return False
    return True


def default_weight(action_id: str) -> float:
    # seasoning and actions that eat nothing are rarer unless the persona likes them
    _, category, consume = ACTIONS[action_id]
    if category == "season":
        return 0.08
    return 1.0 if consume else 0.25


def simulate(rng: random.Random) -> tuple[list[tuple[str, dict[str, int]]], dict[str, int]]:
    # plays one bowl and returns the steps with amounts after each, plus final amounts
    amounts = dict(START)
    persona = rng.choice(PERSONAS)
    stop_at = rng.choice([0, 0, 0, 10, 25])
    steps = []
    while sum(amounts[f] for f in FOOD) > stop_at and len(steps) < 80:
        options = [a for a in ACTIONS if allowed(a, amounts)]
        weights = [persona.get(a, default_weight(a)) for a in options]
        action_id = rng.choices(options, weights=weights)[0]
        for k, n in ACTIONS[action_id][2].items():
            amounts[k] -= min(n, amounts[k])
        steps.append((action_id, dict(amounts)))
    return steps, amounts


def style_for(actions: list[str], final: dict[str, int]) -> str:
    # a simplified version of the frontend style rules
    seasoned = sum(1 for a in actions if a.startswith("add_"))
    eats = [a for a in actions if ACTIONS[a][1] in ("eat", "sip")]
    noodle = sum(1 for a in actions if "noodles" in ACTIONS[a][2])
    if seasoned >= 3:
        return "spice"
    if actions and ACTIONS[actions[0]][0] == "broth":
        return "broth_first"
    if len(eats) >= 4 and noodle / len(eats) >= 0.5:
        return "noodle"
    if final["broth"] == 0:
        return "drainer"
    return "balanced"


def seed(count: int, rng_seed: int = 42) -> int:
    Base.metadata.create_all(bind=engine)
    rng = random.Random(rng_seed)
    now = datetime.now(timezone.utc)
    with SessionLocal() as db:
        for _ in range(count):
            steps, final = simulate(rng)
            if not steps:
                continue
            started = now - timedelta(minutes=rng.randint(10, 60 * 24 * 14))
            duration_ms = len(steps) * rng.randint(1500, 4000)
            actions = [a for a, _ in steps]
            play = Play(
                meal_id="ramen",
                started_at=started,
                finished_at=started + timedelta(milliseconds=duration_ms),
                duration_ms=duration_ms,
                completed=sum(final[f] for f in FOOD) == 0,
                style_id=style_for(actions, final),
                final_amounts=final,
                spice={k: START[k] - final[k] for k in ("salt", "pepper", "chili")},
                stir_count=actions.count("stir_bowl"),
            )
            for i, (action_id, after) in enumerate(steps, start=1):
                target, category, consume = ACTIONS[action_id]
                play.steps.append(StepRow(
                    step_number=i, action_id=action_id, label=action_id.replace("_", " "),
                    target=target, category=category, t_ms=i * 2000,
                    removed=consume, note="", after=after,
                ))
            db.add(play)
        db.commit()
    return count


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Insert simulated ramen plays")
    parser.add_argument("--count", type=int, default=300)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    print(f"Inserted {seed(args.count, args.seed)} simulated plays")
