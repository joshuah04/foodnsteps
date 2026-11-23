# food'n'steps

[![CI](https://github.com/joshuah04/foodnsteps/actions/workflows/ci.yml/badge.svg)](https://github.com/joshuah04/foodnsteps/actions/workflows/ci.yml)

A web game where you are served a meal, eat it one action at a time, and then see how your eating steps compare with other players.

## Current milestone: ramen with a shared backend

The TypeScript frontend draws the bowl and runs the game. A FastAPI server stores every finished play in a database and compares each new play with all the others.

* Click an ingredient, the bowl rim, or a seasoning (or a row in the "What's left" list) to open its action menu.
* Each action plays a short placeholder animation and the amount drops.
* Press "Finish meal" at any time to see your results.
* Finished plays are sent to the server. The results screen shows how your opening, style and step sequence compare with every other play, including a similarity score based on edit distance between step sequences.

## Run it

Needs Python 3.11 or newer and Node.js 20 or newer. Start the API in one terminal:

```
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

It uses a local SQLite file (`backend/foodnsteps.db`) unless `DATABASE_URL` points at PostgreSQL, for example `DATABASE_URL=postgresql://user:pass@localhost:5432/foodnsteps`.

Then start the frontend in a second terminal:

```
cd frontend
npm install
npm run dev
```

Visit http://localhost:5173. The dev server forwards `/api` calls to the API on port 8000.

## Tests

Backend (pytest, uses a temporary SQLite file unless `DATABASE_URL` is set):

```
cd backend
pip install -r requirements-dev.txt
pytest
```

Frontend (Vitest):

```
cd frontend
npm test
```

GitHub Actions runs both on every push and pull request (`.github/workflows/ci.yml`). The backend job runs against a real PostgreSQL database.

## Deploy

The `Dockerfile` builds the frontend and runs one FastAPI server that serves both the API and the game, so the whole app lives at one URL.

To put it online with Render:

1. Sign in at render.com with GitHub and choose New, then Blueprint.
2. Pick this repository. Render reads `render.yaml` and creates the web service and a PostgreSQL database, and connects them through `DATABASE_URL`.
3. Wait for the first deploy, then open the `onrender.com` link it shows.
4. Seed sample plays once so comparisons are not empty. In the web service, open Shell and run `python -m app.seed --count 300`.

Every push to `main` redeploys automatically. Render's free database expires after 30 days, so for a long lived demo either upgrade it or point `DATABASE_URL` at a free Neon or Supabase database.

To try the production setup locally without Docker:

```
cd frontend && npm run build && cd ../backend
STATIC_DIR=../frontend/dist uvicorn app.main:app
```

Then visit http://localhost:8000

## API

* `GET /api/health` health check
* `POST /api/sessions` save a finished play with all its steps, returns its id
* `GET /api/sessions/{id}/results` comparison of that play with every play of the same meal

Interactive docs are at http://localhost:8000/docs while the API is running.

Other commands:

* `npm run typecheck` checks types without building
* `npm run build` type checks and builds static files into `frontend/dist`

## Files

* `frontend/src/types.ts` shapes of meals, steps and sessions
* `frontend/src/meals/ramen.ts` ingredient amounts, positions, colors and actions (tune the game here)
* `frontend/src/rules.ts` game rules with no DOM access (what an action is allowed to do and what it removes)
* `frontend/src/analysis.ts` eating style rules and stats with no DOM access
* `frontend/src/game.ts` drawing, action menu, animations, step log
* `frontend/src/results.ts` results screen
* `frontend/src/api.ts` calls to the backend
* `frontend/src/style.css` layout and colors
* `backend/app/main.py` API routes
* `backend/app/models.py` database tables (plays and steps)
* `backend/app/compare.py` comparison math, including Levenshtein similarity
* `backend/app/db.py` database connection
* `backend/app/seed.py` simulated plays for a fresh database
* `backend/tests/` API and comparison tests
* `frontend/tests/` game rule and eating style tests
* `PLAN.md` the full plan and the list of future meals

## Next milestone

Final ingredient art and animations, then more meals (see `PLAN.md`).

## License

MIT, see `LICENSE`.
