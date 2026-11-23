# Unit tests for the comparison math, no database involved
from app.compare import PlaySummary, compare, levenshtein, similarity_percent, top


def test_levenshtein_identical_sequences_is_zero():
    assert levenshtein(["sip_broth", "eat_noodles"], ["sip_broth", "eat_noodles"]) == 0


def test_levenshtein_counts_insert_delete_and_substitute():
    assert levenshtein([], ["a", "b"]) == 2
    assert levenshtein(["a", "b", "c"], ["a", "c"]) == 1
    assert levenshtein(["a", "b"], ["a", "x"]) == 1
    assert levenshtein(list("kitten"), list("sitting")) == 3


def test_levenshtein_is_symmetric():
    a = ["sip_broth", "eat_egg", "eat_noodles"]
    b = ["eat_noodles", "sip_broth"]
    assert levenshtein(a, b) == levenshtein(b, a)


def test_similarity_percent_bounds():
    assert similarity_percent(["a", "b"], ["a", "b"]) == 100.0
    assert similarity_percent(["a", "b"], ["c", "d"]) == 0.0
    assert similarity_percent([], []) == 100.0
    assert similarity_percent(["a", "b", "c", "d"], ["a", "b", "c", "x"]) == 75.0


def test_top_ignores_empty_values_and_handles_no_data():
    assert top(["a", None, "b", "a", ""]) == ("a", 2)
    assert top([]) == (None, 0)


def test_compare_counts_openings_styles_and_similarity():
    me = PlaySummary("1", ["sip_broth", "eat_noodles"], "broth_first")
    everyone = [
        me,
        PlaySummary("2", ["sip_broth", "eat_egg"], "broth_first"),
        PlaySummary("3", ["eat_noodles", "eat_noodles", "eat_noodles"], "noodle"),
    ]
    c = compare(me, everyone)
    assert c.plays == 3
    assert c.same_opening == 2
    assert c.top_opening == ("sip_broth", 2)
    assert c.top_action == ("eat_noodles", 4)
    assert c.total_steps == 7
    assert c.top_style == ("broth_first", 2)
    assert c.same_style == 2
    assert c.compared_with == 2
    assert c.closest_percent == 50.0


def test_compare_alone_has_no_similarity():
    me = PlaySummary("1", ["sip_broth"], None)
    c = compare(me, [me])
    assert c.closest_percent is None
    assert c.average_percent is None
    assert c.compared_with == 0
    assert c.same_style == 0
