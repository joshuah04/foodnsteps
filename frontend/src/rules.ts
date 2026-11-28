// Game rules with no DOM access, so they can be unit tested on their own
import type { Action, ActionStatus, GameState, Ingredient, Meal, Plan, Session, SpiceLevels } from './types';

export function ingById(meal: Meal, id: string): Ingredient | undefined {
  return meal.ingredients.find(i => i.id === id);
}

export function foodIngredients(meal: Meal): Ingredient[] {
  return meal.ingredients.filter(i => i.kind === 'food');
}

export function newState(meal: Meal, now: number = Date.now()): GameState {
  const amounts: Record<string, number> = {};
  meal.ingredients.forEach(i => { amounts[i.id] = i.start; });
  return {
    amounts,
    steps: [],
    startedAt: now,
    stirred: false,
    stirCount: 0,
    onionMixed: false,
    spice: { salt: 0, pepper: 0, chili: 0 }
  };
}

export function actionStatus(meal: Meal, state: GameState, action: Action): ActionStatus {
  const a = state.amounts;
  for (const key of Object.keys(action.consume)) {
    if (a[key] <= 0) {
      const name = ingById(meal, key)?.name ?? key;
      return { ok: false, reason: 'No ' + name.toLowerCase() + ' left' };
    }
  }
  const req = action.requires ?? {};
  for (const [key, v] of Object.entries(req.min ?? {})) {
    if (a[key] < v) return { ok: false, reason: action.requiresText ?? 'Not available' };
  }
  for (const [key, v] of Object.entries(req.max ?? {})) {
    if (a[key] > v) return { ok: false, reason: action.requiresText ?? 'Not available' };
  }
  return { ok: true, reason: '' };
}

export function planAction(meal: Meal, state: GameState, action: Action): Plan {
  const removed: Record<string, number> = {};
  let note = '';
  for (const [key, need] of Object.entries(action.consume)) {
    const take = Math.min(need, state.amounts[key]);
    if (take > 0) removed[key] = take;
  }
  // a stirred bowl means broth carries some toppings with it
  if (state.stirred && action.target === 'broth') {
    let best: string | null = null;
    meal.mixedToppings.forEach(id => {
      if (state.amounts[id] > 0 && (best === null || state.amounts[id] > state.amounts[best])) best = id;
    });
    if (best !== null) {
      const picked: string = best;
      removed[picked] = (removed[picked] ?? 0) + 1;
      note = 'picked up some ' + (ingById(meal, picked)?.name ?? picked).toLowerCase();
    }
  }
  return { removed, note };
}

export function commit(state: GameState, action: Action, plan: Plan, now: number = Date.now()): void {
  for (const [key, n] of Object.entries(plan.removed)) state.amounts[key] -= n;
  if (action.effect === 'stir') { state.stirred = true; state.stirCount += 1; }
  if (action.effect === 'spice') state.spice[action.target as keyof SpiceLevels] += 1;
  if (action.effect === 'mixOnion') state.onionMixed = true;

  state.steps.push({
    n: state.steps.length + 1,
    actionId: action.id,
    label: action.label,
    target: action.target,
    category: action.category,
    t: now - state.startedAt,
    removed: plan.removed,
    note: plan.note,
    after: { ...state.amounts }
  });
}

export function foodLeft(meal: Meal, state: GameState): number {
  return foodIngredients(meal).reduce((sum, i) => sum + state.amounts[i.id], 0);
}

export function buildSession(meal: Meal, state: GameState, finishedAt: number = Date.now()): Session {
  return {
    id: 's' + finishedAt.toString(36) + Math.random().toString(36).slice(2, 7),
    mealId: meal.id,
    startedAt: new Date(state.startedAt).toISOString(),
    finishedAt: new Date(finishedAt).toISOString(),
    durationMs: finishedAt - state.startedAt,
    completed: foodLeft(meal, state) === 0,
    steps: state.steps,
    finalAmounts: { ...state.amounts },
    spice: { ...state.spice },
    stirCount: state.stirCount
  };
}

// actions offered when the player clicks an ingredient
// a side such as ketchup or pickles also offers every action that uses it up
export function actionsFor(meal: Meal, ingId: string): Action[] {
  const ing = ingById(meal, ingId);
  return meal.actions.filter(a =>
    a.target === ingId || (ing?.kind === 'side' && a.consume[ingId] !== undefined)
  );
}

// perceived brightness of a #rrggbb color from 0 (black) to 255 (white)
// used to pick readable text and outlines on top of ingredient colors
export function brightness(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return 255;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}
