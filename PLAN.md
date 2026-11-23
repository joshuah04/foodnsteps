# food'n'steps: Build Plan

## 0. Decisions (2026-11-04)

* Project folder: Documents/projects/food'n'steps on Minha's computer.
* Placeholder art: colored geometric shapes with labels until real art arrives.
* Frontend in plain JavaScript, backend in Python (FastAPI).
* The player can press Finish whenever they want; partial meals are recorded.
* Stats for now: most common opening action, most used action, eating style.
* Anonymous players. Ramen only for now. Desktop first, mobile friendly.
* Long term: a Wordle style daily meal (see section 11).

## 1. Concept

The player opens the site and is served a meal (first meal: a bowl of tonkotsu ramen). The bowl is drawn as an interactive graphic where every ingredient is its own clickable piece. The player selects an ingredient, picks an action from a small menu, and watches a short animation while that ingredient's amount visibly shrinks. When the bowl is finished (or the player chooses to stop), the site saves the full sequence of actions and shows how that sequence compares with everyone else who ate the same meal.

## 2. Core gameplay loop

1. Load a meal and show the bowl at full amounts.
2. Player clicks an ingredient (noodles, broth, chashu pork, egg, green onion, bamboo shoots, nori, corn, etc.) or a side item (salt, pepper flakes, chili oil).
3. An action menu appears next to the cursor, listing only the actions valid for that ingredient.
4. Player picks an action. An animation plays, the ingredient's amount drops, and the action is appended to the session log.
5. Repeat until every edible ingredient reaches zero, or the player presses "Finish".
6. Results screen: the player's timeline of steps plus comparisons with other players.

## 3. Ingredients, amounts, and actions (ramen)

Each ingredient has a starting amount measured in "portions". Every eat or sip action removes portions. Amounts are drawn as the visible size of that ingredient in the bowl.

| Ingredient | Start amount | Actions |
| --- | --- | --- |
| Noodles | 10 | Eat noodles, Slurp noodles, Lift and cool |
| Broth | 10 | Sip broth, Drink from bowl (finish) |
| Chashu pork | 3 slices | Eat a slice, Dip in broth then eat |
| Soft boiled egg | 2 halves | Eat a half |
| Green onion | 5 | Eat, Mix into broth |
| Bamboo shoots | 4 | Eat |
| Nori (seaweed) | 2 sheets | Eat, Soak in broth then eat, Wrap noodles then eat |
| Corn / bean sprouts | 4 | Eat |
| Salt, pepper flakes, chili oil (sides) | 3 uses each | Add to bowl |
| Whole bowl | n/a | Stir bowl |

Rules and interactions:
* "Stir bowl" marks the bowl as mixed. After stirring, toppings like green onion and corn are spread through the broth and each sip of broth also removes a little of them.
* Adding a spice changes the bowl's state (for example "spicy level 2") and tints the broth. It is recorded as a step even though nothing is eaten.
* Broth can only be drunk from the bowl once noodles are low, so the order of actions matters.
* All of these numbers live in a data file per meal, so they can be tuned without code changes.

## 4. Data model

Every meal is defined in data, not code, so new meals (sushi, burger, multi course dinners) can be added later.

```
Meal
  id, name, description, image layers
  ingredients: [ { id, name, start_amount, sprite, valid_actions, layer_order } ]
  actions: [ { id, label, target_ingredients, amount_consumed, side_effects, animation } ]

Session (one playthrough)
  id, meal_id, anonymous player id, started_at, finished_at, completed (yes or no)

Step (one row per action)
  session_id, step_number, ingredient_id, action_id, amount_after, timestamp
```

## 5. Comparing with other players

Once a session is finished the results screen shows:

* **Your timeline**: a horizontal strip of icons, one per step, in order.
* **First move**: what you did first, and what share of players did the same ("38% of players sipped the broth first").
* **Eating order**: the order in which you finished each ingredient, compared with the most common order.
* **Style profile**: a few simple labels derived from the steps, such as "Broth first", "Noodle rusher", "Saves the meat for last", "Spice lover", "Stirrer".
* **Most similar players**: how close your sequence is to others, using edit distance (Levenshtein) between step sequences, shown as a percent similarity.
* **Popular paths**: a chart of the most common next action after each action (a transition table), so players can see the typical flow.
* **Stats**: total steps, time taken, spices added, compared with the average.

All comparison math runs on the server in Python over the stored steps.

## 6. Tech stack

* **Backend**: Python with FastAPI. Serves meal definitions, records sessions and steps, and computes comparison stats.
* **Database**: SQLite for local development, PostgreSQL when deployed. SQLAlchemy for models.
* **Frontend**: the interactive bowl has to run in the browser, so this part is JavaScript. Recommended: plain HTML plus a small canvas library (PixiJS) or layered SVG with CSS and GSAP animations. Layered SVG is simpler to start with and makes each ingredient easy to click and resize.
* **Art**: each ingredient as its own image layer (SVG or PNG) stacked over an empty bowl, so amounts can shrink and pieces can disappear independently.
* **Hosting**: one small server (Render, Fly.io, or Railway) running FastAPI, which also serves the frontend files.

## 7. Project structure

```
ramen-game/
  backend/
    main.py            # FastAPI app and routes
    models.py          # SQLAlchemy tables
    compare.py         # similarity and stats
    meals/ramen.json   # ingredient and action data
  frontend/
    index.html
    game.js            # bowl rendering, menus, animations, step logging
    results.js         # results screen and charts
    assets/ramen/      # ingredient layers
  tests/
```

## 8. API sketch

* `GET /api/meals` list meals
* `GET /api/meals/{id}` full meal definition
* `POST /api/sessions` start a session, returns session id
* `POST /api/sessions/{id}/steps` record a step (or send all steps at the end)
* `POST /api/sessions/{id}/finish` mark complete
* `GET /api/sessions/{id}/results` comparison data for the results screen

## 9. Milestones

1. **Prototype**: static ramen bowl with clickable ingredients, action menu, amounts that decrease, step log kept in the browser. No animations, no server.
2. **Persistence**: FastAPI backend, SQLite, sessions and steps saved, basic results screen (timeline and first move stats).
3. **Animations and art**: per action animations (chopsticks lifting noodles, spoon sipping broth, spice shaking, stir swirl), final ingredient art.
4. **Comparisons**: similarity scores, style labels, popular paths chart.
5. **Polish and deploy**: mobile layout, seeding with sample players so comparisons are not empty on day one, deployment.
6. **More meals** (later): reuse the same engine with new meal data files, including multi course meals.

## 10. Risks and open points

* **Art is the biggest effort.** Hand drawn layered ingredients and animations take the most time. A clean flat or cartoon style keeps this manageable.
* **Empty comparisons at launch.** Seeding simulated sessions avoids a lonely results screen.
* **Cheating or spam** is low risk for a game like this; an anonymous id per browser is likely enough.

## 11. Candidate meals for a daily rotation

Each needs a data file (ingredients, amounts, actions). A daily meal can be picked by date from this list, so the same meal shows for everyone on a given day.

1. Tonkotsu ramen (first)
2. Sushi platter (nigiri, maki, soy sauce, wasabi, ginger)
3. Cheeseburger with fries and a soda
4. Pho (noodles, broth, beef, herbs, lime, sriracha, hoisin)
5. Spaghetti and meatballs with garlic bread
6. Tacos (shell, meat, salsa, cheese, lime)
7. Korean bibimbap (rice, vegetables, egg, gochujang, stir)
8. Full English breakfast (eggs, bacon, beans, toast, sausage)
9. Pizza slices with crusts and dips
10. Hot pot (raw items to cook, dipping sauces)
11. Fish and chips with mushy peas
12. Bento box (rice, sides, pickles)
13. Pancake stack with syrup, butter, berries
14. Dim sum basket (dumplings, buns, tea)
15. Ice cream sundae (scoops, toppings, cherry)
16. Three course dinner (soup, steak plate, dessert)
