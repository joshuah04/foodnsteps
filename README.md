# food'n'steps

A web game where you are served a meal, eat it one action at a time, and then see how your eating steps compare with other players.

## Current milestone: ramen prototype in TypeScript

Everything runs in the browser for now. There is no server yet.

* Click an ingredient, the bowl rim, or a seasoning (or a row in the "What's left" list) to open its action menu.
* Each action plays a short placeholder animation and the amount drops.
* Press "Finish meal" at any time to see your results.
* Finished plays are saved in this browser's local storage, and the results screen compares against them.

## Run it

Needs Node.js 20 or newer.

```
cd frontend
npm install
npm run dev
```

Then visit http://localhost:5173

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
* `frontend/src/storage.ts` saving plays in the browser
* `frontend/src/style.css` layout and colors
* `PLAN.md` the full plan and the list of future meals

## Next milestone

A Python (FastAPI) server that stores every play so results compare against all players.

## License

MIT, see `LICENSE`.
