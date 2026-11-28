# Fills the database with simulated plays so comparisons are not empty on day one
# Run from the backend folder: python -m app.seed --count 300 --meal burger
import argparse
import random
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from .db import Base, SessionLocal, engine
from .models import Play, StepRow

# a small copy of the ramen actions: id, target, category, what it consumes
RAMEN_ACTIONS = {
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

RAMEN_START = {"broth": 10, "noodles": 10, "chashu": 3, "egg": 2, "onion": 5, "bamboo": 4,
         "nori": 2, "corn": 4, "salt": 3, "pepper": 3, "chili": 3}
RAMEN_FOOD = ["broth", "noodles", "chashu", "egg", "onion", "bamboo", "nori", "corn"]

# each simulated player leans toward some actions, which gives the stats some shape
RAMEN_PERSONAS = [
    {"sip_broth": 6, "eat_noodles": 3},
    {"slurp_noodles": 6, "eat_noodles": 4},
    {"add_chili": 4, "add_pepper": 3, "add_salt": 2},
    {"stir_bowl": 3, "mix_onion": 3, "sip_broth": 2},
    {"eat_egg": 3, "eat_corn": 3, "eat_bamboo": 3},
    {},
]

# the same for the burger, fries and drink meal
BURGER_ACTIONS = {
    "take_bite": ("burger", "eat", {"burger": 1}),
    "add_pickles": ("burger", "prep", {"pickles": 1}),
    "eat_fries": ("fries", "eat", {"fries": 1}),
    "dip_fries": ("fries", "eat", {"fries": 1, "ketchup": 1}),
    "drink_it": ("drink", "sip", {"drink": 1}),
}
BURGER_START = {"burger": 8, "fries": 10, "drink": 6, "ketchup": 5, "pickles": 3}
BURGER_FOOD = ["burger", "fries", "drink"]
BURGER_PERSONAS = [
    {"take_bite": 5},
    {"dip_fries": 6, "eat_fries": 1},
    {"add_pickles": 3, "take_bite": 2},
    {"drink_it": 4},
    {"eat_fries": 4, "take_bite": 1},
    {},
]


# the sushi platter: eat, dip in soy sauce, or order more of each kind once it runs out
SUSHI_KINDS = {"salmon": 3, "whitefish": 3, "shrimp": 3, "squid": 3, "tuna": 3, "eel": 3, "maki": 4, "eelroll": 6}
SUSHI_MAX_REFILLS = 3
SUSHI_ACTIONS = {
    "sip_miso": ("miso", "sip", {"miso": 1}),
    "mix_wasabi": ("soy", "season", {"wasabi": 1}),
    "eat_radish": ("radish", "eat", {"radish": 1}),
}
for _kind in SUSHI_KINDS:
    SUSHI_ACTIONS["eat_" + _kind] = (_kind, "eat", {_kind: 1})
    SUSHI_ACTIONS["dip_" + _kind] = (_kind, "eat", {_kind: 1, "soy": 1})
    SUSHI_ACTIONS["more_" + _kind] = (_kind, "order", {})
SUSHI_START = {**SUSHI_KINDS, "miso": 5, "soy": 8, "wasabi": 3, "radish": 4}
SUSHI_FOOD = [*SUSHI_KINDS, "miso"]
SUSHI_PERSONAS = [
    {"more_salmon": 4, "eat_salmon": 4, "dip_salmon": 3},
    {"dip_tuna": 3, "dip_salmon": 3, "dip_eel": 3, "dip_maki": 3},
    {"mix_wasabi": 3},
    {"sip_miso": 4},
    {"more_tuna": 3, "more_eelroll": 3},
    {},
]


@dataclass
class MealSim:
    actions: dict[str, tuple[str, str, dict[str, int]]]
    start: dict[str, int]
    food: list[str]
    personas: list[dict[str, float]]
    # order actions refill their target to its starting amount, at most this many times each
    max_refills: int = 0


MEALS = {
    "ramen": MealSim(RAMEN_ACTIONS, RAMEN_START, RAMEN_FOOD, RAMEN_PERSONAS),
    "burger": MealSim(BURGER_ACTIONS, BURGER_START, BURGER_FOOD, BURGER_PERSONAS),
    "sushi": MealSim(SUSHI_ACTIONS, SUSHI_START, SUSHI_FOOD, SUSHI_PERSONAS, SUSHI_MAX_REFILLS),
}


def allowed(meal: MealSim, action_id: str, amounts: dict[str, int], used: dict[str, int] | None = None) -> bool:
    target, category, consume = meal.actions[action_id]
    if category == "order":
        return amounts[target] == 0 and (used or {}).get(action_id, 0) < meal.max_refills
    if any(amounts[k] <= 0 for k in consume):
        return False
    if action_id == "mix_wasabi" and amounts["soy"] <= 0:
        return False
    if action_id == "add_pickles" and amounts["burger"] <= 0:
        return False
    if action_id == "drink_bowl" and amounts["noodles"] > 3:
        return False
    if action_id in ("stir_bowl", "mix_onion") and amounts["broth"] <= 0:
        return False
    return True


def default_weight(meal: MealSim, action_id: str) -> float:
    # seasoning and actions that eat nothing are rarer unless the persona likes them
    _, category, consume = meal.actions[action_id]
    if category == "season":
        return 0.08
    if category == "order":
        return 0.3
    if not any(k in meal.food for k in consume):
        return 0.25
    return 1.0


def simulate(meal: MealSim, rng: random.Random) -> tuple[list[tuple[str, dict[str, int]]], dict[str, int]]:
    # plays one meal and returns the steps with amounts after each, plus final amounts
    amounts = dict(meal.start)
    persona = rng.choice(meal.personas)
    total = sum(meal.start[f] for f in meal.food)
    stop_at = rng.choice([0, 0, 0, total // 4, total * 5 // 8])
    steps = []
    used: dict[str, int] = {}
    while sum(amounts[f] for f in meal.food) > stop_at and len(steps) < 80:
        options = [a for a in meal.actions if allowed(meal, a, amounts, used)]
        weights = [persona.get(a, default_weight(meal, a)) for a in options]
        action_id = rng.choices(options, weights=weights)[0]
        used[action_id] = used.get(action_id, 0) + 1
        target, category, consume = meal.actions[action_id]
        if category == "order":
            amounts[target] = meal.start[target]
        for k, n in consume.items():
            amounts[k] -= min(n, amounts[k])
        steps.append((action_id, dict(amounts)))
    return steps, amounts


def style_for(meal_id: str, actions: list[str], final: dict[str, int]) -> str:
    # a simplified version of the frontend style rules
    if meal_id == "burger":
        return burger_style_for(actions)
    if meal_id == "sushi":
        return sushi_style_for(actions)
    seasoned = sum(1 for a in actions if a.startswith("add_"))
    eats = [a for a in actions if RAMEN_ACTIONS[a][1] in ("eat", "sip")]
    noodle = sum(1 for a in actions if "noodles" in RAMEN_ACTIONS[a][2])
    if seasoned >= 3:
        return "spice"
    if actions and RAMEN_ACTIONS[actions[0]][0] == "broth":
        return "broth_first"
    if len(eats) >= 4 and noodle / len(eats) >= 0.5:
        return "noodle"
    if final["broth"] == 0:
        return "drainer"
    return "balanced"


def burger_style_for(actions: list[str]) -> str:
    dips = actions.count("dip_fries")
    if actions.count("add_pickles") >= 2:
        return "pickle_fan"
    if dips >= 3 and dips > actions.count("eat_fries"):
        return "dipper"
    if actions and actions[0] == "drink_it":
        return "thirsty"
    return "balanced"


def sushi_style_for(actions: list[str]) -> str:
    if sum(1 for a in actions if a.startswith("more_")) >= 2:
        return "regular"
    if actions.count("mix_wasabi") >= 2:
        return "wasabi"
    if actions and actions[0] == "sip_miso":
        return "soup_first"
    if all(any(a.endswith("_" + k) for a in actions if not a.startswith("more_")) for k in SUSHI_KINDS):
        return "tour"
    return "balanced"


def seed(count: int, rng_seed: int = 42, meal_id: str = "ramen") -> int:
    Base.metadata.create_all(bind=engine)
    meal = MEALS[meal_id]
    rng = random.Random(rng_seed)
    now = datetime.now(timezone.utc)
    with SessionLocal() as db:
        for _ in range(count):
            steps, final = simulate(meal, rng)
            if not steps:
                continue
            started = now - timedelta(minutes=rng.randint(10, 60 * 24 * 14))
            duration_ms = len(steps) * rng.randint(1500, 4000)
            actions = [a for a, _ in steps]
            play = Play(
                meal_id=meal_id,
                started_at=started,
                finished_at=started + timedelta(milliseconds=duration_ms),
                duration_ms=duration_ms,
                completed=sum(final[f] for f in meal.food) == 0,
                style_id=style_for(meal_id, actions, final),
                final_amounts=final,
                spice={k: meal.start[k] - final[k] for k in ("salt", "pepper", "chili") if k in meal.start},
                stir_count=actions.count("stir_bowl"),
            )
            for i, (action_id, after) in enumerate(steps, start=1):
                target, category, consume = meal.actions[action_id]
                play.steps.append(StepRow(
                    step_number=i, action_id=action_id, label=action_id.replace("_", " "),
                    target=target, category=category, t_ms=i * 2000,
                    removed=consume, note="", after=after,
                ))
            db.add(play)
        db.commit()
    return count


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Insert simulated plays of one meal")
    parser.add_argument("--count", type=int, default=300)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--meal", choices=sorted(MEALS), default="ramen")
    args = parser.parse_args()
    print(f"Inserted {seed(args.count, args.seed, args.meal)} simulated {args.meal} plays")
