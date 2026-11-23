# food'n'steps

A web game where you are served a meal, eat it one action at a time, and then see how your eating steps compare with other players.

## Current milestone: ramen prototype

Everything runs in the browser for now. There is no server yet.

* Click an ingredient, the bowl rim, or a seasoning (or a row in the "What's left" list) to open its action menu.
* Each action plays a short placeholder animation and the amount drops.
* Press "Finish meal" at any time to see your results.
* Finished plays are saved in this browser's local storage, and the results screen compares against them.

## Run it

Open `frontend/index.html` in a browser. Or serve the folder:

```
cd frontend
python3 -m http.server 8000
```

Then visit http://localhost:8000

## Files

* `frontend/meals/ramen.js` ingredient amounts, positions, colors and actions (tune the game here)
* `frontend/game.js` drawing, action menu, animations, step log
* `frontend/results.js` eating style rules and stats
* `frontend/storage.js` saving plays in the browser
* `frontend/style.css` layout and colors
* `PLAN.md` the full plan and the list of future meals

## Next milestone

A Python (FastAPI) server that stores every play so results compare against all players.
