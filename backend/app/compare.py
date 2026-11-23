# Comparison math over stored plays, kept free of database code so it is easy to test
from collections import Counter
from collections.abc import Hashable, Sequence
from dataclasses import dataclass


def levenshtein(a: Sequence[Hashable], b: Sequence[Hashable]) -> int:
    # edit distance between two step sequences, using two rolling rows
    if len(a) < len(b):
        a, b = b, a
    prev = list(range(len(b) + 1))
    for i, x in enumerate(a, start=1):
        cur = [i] + [0] * len(b)
        for j, y in enumerate(b, start=1):
            cost = 0 if x == y else 1
            cur[j] = min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
        prev = cur
    return prev[-1]


def similarity_percent(a: Sequence[Hashable], b: Sequence[Hashable]) -> float:
    # 100 means identical sequences, 0 means nothing in common
    longest = max(len(a), len(b))
    if longest == 0:
        return 100.0
    return round(100.0 * (1 - levenshtein(a, b) / longest), 1)


def top(values: Sequence[str | None]) -> tuple[str | None, int]:
    # most common non empty value; ties go to the value seen first
    counts = Counter(v for v in values if v)
    if not counts:
        return None, 0
    value, count = counts.most_common(1)[0]
    return value, count


@dataclass
class PlaySummary:
    id: str
    actions: list[str]
    style_id: str | None


@dataclass
class Comparison:
    plays: int
    same_opening: int
    top_opening: tuple[str | None, int]
    top_action: tuple[str | None, int]
    total_steps: int
    top_style: tuple[str | None, int]
    same_style: int
    closest_percent: float | None
    average_percent: float | None
    compared_with: int


def compare(me: PlaySummary, everyone: list[PlaySummary]) -> Comparison:
    # everyone includes me, so percentages match what the player expects ("you and 3 others")
    openings = [p.actions[0] for p in everyone if p.actions]
    my_opening = me.actions[0] if me.actions else None
    all_actions = [a for p in everyone for a in p.actions]

    others = [p for p in everyone if p.id != me.id]
    scores = [similarity_percent(me.actions, p.actions) for p in others]

    return Comparison(
        plays=len(everyone),
        same_opening=sum(1 for o in openings if o == my_opening),
        top_opening=top(openings),
        top_action=top(all_actions),
        total_steps=len(all_actions),
        top_style=top([p.style_id for p in everyone]),
        same_style=sum(1 for p in everyone if me.style_id and p.style_id == me.style_id),
        closest_percent=max(scores) if scores else None,
        average_percent=round(sum(scores) / len(scores), 1) if scores else None,
        compared_with=len(scores),
    )
