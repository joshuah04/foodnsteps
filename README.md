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

The live setup splits the app across three services, each doing one job:

| Part | Service | Config in this repo |
| --- | --- | --- |
| Game (static TypeScript build) | Vercel | `frontend/vercel.json` |
| API (FastAPI in Docker) | Fly.io | `fly.toml`, `Dockerfile` |
| Database (PostgreSQL) | Neon | none, just the `DATABASE_URL` secret |

How the pieces find each other:

* The game calls the API at `VITE_API_URL`, which Vercel bakes into the build.
* The API only answers browsers from the sites listed in `CORS_ORIGINS` (comma separated). `CORS_ORIGIN_REGEX` can also allow a pattern, for example every Vercel preview url.
* The API connects to Neon through the `DATABASE_URL` secret on Fly.

### 1. Database on Neon

1. Sign up at neon.tech and create a project in AWS US East (N. Virginia).
2. Copy the connection string from the dashboard. It looks like `postgresql://user:password@ep-something.us-east-1.aws.neon.tech/neondb?sslmode=require`.

### 2. API on Fly.io

Install `flyctl` (`brew install flyctl` on a Mac), then from the repo root:

```
fly auth login
fly apps create foodnsteps-api        # pick another name if taken, then update app in fly.toml
fly secrets set DATABASE_URL='postgresql://...from Neon...'
fly deploy
```

Check https://foodnsteps-api.fly.dev/api/health returns `{"status":"ok"}`. Then seed sample plays once:

```
fly ssh console -C "python -m app.seed --count 300"
```

To redeploy on every push to `main` after CI passes, create a token with `fly tokens create deploy` and save it as the `FLY_API_TOKEN` repository secret on GitHub. The `deploy-api` job in `ci.yml` skips itself until that secret exists.

### 3. Game on Vercel

1. Sign in at vercel.com with GitHub, choose Add New, then Project, and import this repository.
2. Set Root Directory to `frontend`. Vercel reads `frontend/vercel.json` for the build.
3. Add the environment variable `VITE_API_URL` = `https://foodnsteps-api.fly.dev` and deploy.
4. If the Vercel url is not `https://foodnsteps.vercel.app`, tell the API about it: `fly secrets set CORS_ORIGINS=https://your-url.vercel.app,http://localhost:5173`.

Vercel redeploys the game on every push to `main` and builds a preview for each pull request. Previews get their own urls, so allow them with `fly secrets set CORS_ORIGIN_REGEX='https://foodnsteps-.*\.vercel\.app'` if you want them to save plays.

### Single server alternative (Render)

The `Dockerfile` also serves the built game from the API server, so everything can live at one url with no CORS setup. `render.yaml` does this on Render: choose New, then Blueprint, pick this repository, and run `python -m app.seed --count 300` in the service Shell afterwards.

To try that single server setup locally without Docker:

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
* `frontend/src/api.ts` calls to the backend (base url from `VITE_API_URL`)
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
