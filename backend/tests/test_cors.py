# CORS settings that let a frontend on another domain (Vercel) call the API (Fly.io)
from app.main import parse_origins


def test_parse_origins_trims_spaces_and_slashes():
    raw = " https://foodnsteps.vercel.app/ , http://localhost:5173,,"
    assert parse_origins(raw) == ["https://foodnsteps.vercel.app", "http://localhost:5173"]


def test_parse_origins_empty():
    assert parse_origins("") == []


def test_allowed_origin_gets_cors_headers(client):
    # the default CORS_ORIGINS allows the Vite dev server
    res = client.options(
        "/api/sessions",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST"},
    )
    assert res.status_code == 200
    assert res.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_unknown_origin_is_refused(client):
    res = client.options(
        "/api/sessions",
        headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"},
    )
    assert "access-control-allow-origin" not in res.headers
