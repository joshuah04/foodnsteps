# API tests that go through FastAPI and the real database
from tests.conftest import make_session


def test_health(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_create_session_returns_id(client):
    res = client.post("/api/sessions", json=make_session(["sip_broth", "eat_noodles"]))
    assert res.status_code == 201
    assert len(res.json()["id"]) == 36


def test_results_for_single_play(client):
    sid = client.post("/api/sessions", json=make_session(["sip_broth", "eat_noodles"], "broth_first")).json()["id"]
    res = client.get(f"/api/sessions/{sid}/results")
    assert res.status_code == 200
    body = res.json()
    assert body["sessionId"] == sid
    assert body["plays"] == 1
    assert body["sameOpening"] == 1
    assert body["topOpening"] == {"value": "sip_broth", "count": 1}
    assert body["totalSteps"] == 2
    assert body["similarity"] == {"closestPercent": None, "averagePercent": None, "comparedWith": 0}


def test_results_compare_across_players(client):
    client.post("/api/sessions", json=make_session(["sip_broth", "eat_egg"], "broth_first"))
    client.post("/api/sessions", json=make_session(["eat_noodles", "eat_noodles"], "noodle"))
    sid = client.post("/api/sessions", json=make_session(["sip_broth", "eat_noodles"], "broth_first")).json()["id"]

    body = client.get(f"/api/sessions/{sid}/results").json()
    assert body["plays"] == 3
    assert body["sameOpening"] == 2
    assert body["topOpening"]["value"] == "sip_broth"
    assert body["sameStyle"] == 2
    assert body["topStyle"] == {"value": "broth_first", "count": 2}
    assert body["similarity"]["comparedWith"] == 2
    assert body["similarity"]["closestPercent"] == 50.0


def test_results_only_compare_the_same_meal(client):
    client.post("/api/sessions", json=make_session(["eat_rice"], meal_id="bibimbap"))
    sid = client.post("/api/sessions", json=make_session(["sip_broth"])).json()["id"]
    assert client.get(f"/api/sessions/{sid}/results").json()["plays"] == 1


def test_steps_are_kept_in_order(client):
    actions = ["sip_broth", "eat_egg", "eat_noodles", "sip_broth"]
    sid = client.post("/api/sessions", json=make_session(actions)).json()["id"]
    other = client.post("/api/sessions", json=make_session(actions)).json()["id"]
    body = client.get(f"/api/sessions/{other}/results").json()
    assert sid != other
    assert body["similarity"]["closestPercent"] == 100.0


def test_unknown_session_is_404(client):
    assert client.get("/api/sessions/does-not-exist/results").status_code == 404


def test_rejects_session_without_steps(client):
    body = make_session(["sip_broth"])
    body["steps"] = []
    assert client.post("/api/sessions", json=body).status_code == 422


def test_rejects_unknown_category(client):
    body = make_session(["sip_broth"])
    body["steps"][0]["category"] = "juggle"
    assert client.post("/api/sessions", json=body).status_code == 422
