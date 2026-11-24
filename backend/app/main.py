# FastAPI app: records finished plays and compares them with everyone else's
import os
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import models
from .compare import PlaySummary, compare
from .db import Base, engine, get_db
from .schemas import Count, ResultsOut, SessionCreated, SessionIn, Similarity

# how many recent plays of a meal the results screen compares against
COMPARE_LIMIT = int(os.environ.get("COMPARE_LIMIT", "1000"))


@asynccontextmanager
async def lifespan(_: FastAPI):
    # creates missing tables on startup; a migration tool can replace this later
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="food'n'steps API", version="0.1.0", lifespan=lifespan)

# the Vite dev server runs on another port, so allow it during development
_origins = [o for o in os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",") if o]
app.add_middleware(CORSMiddleware, allow_origins=_origins, allow_methods=["*"], allow_headers=["*"])


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/sessions", response_model=SessionCreated, status_code=201)
def create_session(body: SessionIn, db: Session = Depends(get_db)) -> SessionCreated:
    play = models.Play(
        meal_id=body.meal_id,
        started_at=body.started_at,
        finished_at=body.finished_at,
        duration_ms=body.duration_ms,
        completed=body.completed,
        style_id=body.style_id,
        final_amounts=body.final_amounts,
        spice=body.spice,
        stir_count=body.stir_count,
    )
    for st in body.steps:
        play.steps.append(models.StepRow(
            step_number=st.n,
            action_id=st.action_id,
            label=st.label,
            target=st.target,
            category=st.category,
            t_ms=st.t,
            removed=st.removed,
            note=st.note,
            after=st.after,
        ))
    db.add(play)
    db.commit()
    return SessionCreated(id=play.id)


def _summaries(db: Session, play_ids: list[str]) -> dict[str, list[str]]:
    # action ids of each play, in step order, fetched in one query
    rows = db.execute(
        select(models.StepRow.play_id, models.StepRow.action_id)
        .where(models.StepRow.play_id.in_(play_ids))
        .order_by(models.StepRow.play_id, models.StepRow.step_number)
    ).all()
    out: dict[str, list[str]] = {pid: [] for pid in play_ids}
    for pid, action_id in rows:
        out[pid].append(action_id)
    return out


@app.get("/api/sessions/{session_id}/results", response_model=ResultsOut)
def session_results(session_id: str, db: Session = Depends(get_db)) -> ResultsOut:
    me = db.get(models.Play, session_id)
    if me is None:
        raise HTTPException(status_code=404, detail="Session not found")

    recent = db.execute(
        select(models.Play.id, models.Play.style_id)
        .where(models.Play.meal_id == me.meal_id)
        .order_by(models.Play.created_at.desc())
        .limit(COMPARE_LIMIT)
    ).all()
    styles = {pid: style for pid, style in recent}
    styles[me.id] = me.style_id

    actions = _summaries(db, list(styles))
    everyone = [PlaySummary(id=pid, actions=actions[pid], style_id=styles[pid]) for pid in styles]
    mine = next(p for p in everyone if p.id == me.id)
    c = compare(mine, everyone)

    return ResultsOut(
        session_id=me.id,
        meal_id=me.meal_id,
        plays=c.plays,
        same_opening=c.same_opening,
        top_opening=Count(value=c.top_opening[0], count=c.top_opening[1]),
        top_action=Count(value=c.top_action[0], count=c.top_action[1]),
        total_steps=c.total_steps,
        top_style=Count(value=c.top_style[0], count=c.top_style[1]),
        same_style=c.same_style,
        similarity=Similarity(
            closest_percent=c.closest_percent,
            average_percent=c.average_percent,
            compared_with=c.compared_with,
        ),
    )


# in production the built frontend is served from the same server, so one URL hosts everything
# mounted last so the /api routes above take priority
STATIC_DIR = os.environ.get("STATIC_DIR", "")
if STATIC_DIR and os.path.isdir(STATIC_DIR):
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="frontend")
