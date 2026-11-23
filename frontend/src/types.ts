// Shared shapes for meals, game state and saved sessions
// The backend models mirror these, so keep both sides in sync

export interface Point {
  x: number;
  y: number;
}

export type IngredientKind = 'food' | 'side';

export type Shape = 'broth' | 'noodle' | 'slice' | 'egg' | 'ring' | 'stick' | 'sheet' | 'cube' | 'shaker';

export interface Ingredient {
  id: string;
  name: string;
  kind: IngredientKind;
  start: number;
  color: string;
  shape: Shape;
  label: Point;
  pieces: Point[];
}

export type ActionCategory = 'eat' | 'sip' | 'season' | 'prep';

export type AnimKind = 'eat' | 'lift' | 'sip' | 'drink' | 'dip' | 'mix' | 'season' | 'stir';

export type Effect = 'stir' | 'spice' | 'mixOnion';

// amount of each ingredient, keyed by ingredient id
export type Amounts = Record<string, number>;

export interface Requirements {
  min?: Amounts;
  max?: Amounts;
}

export interface Action {
  id: string;
  label: string;
  // an ingredient id, or "bowl" for the whole bowl
  target: string;
  category: ActionCategory;
  consume: Amounts;
  anim: AnimKind;
  effect?: Effect;
  requires?: Requirements;
  requiresText?: string;
}

export interface Meal {
  id: string;
  name: string;
  description: string;
  ingredients: Ingredient[];
  actions: Action[];
  mixedToppings: string[];
}

export interface SpiceLevels {
  salt: number;
  pepper: number;
  chili: number;
}

export interface Step {
  n: number;
  actionId: string;
  label: string;
  target: string;
  category: ActionCategory;
  // milliseconds since the meal started
  t: number;
  removed: Amounts;
  note: string;
  after: Amounts;
}

export interface GameState {
  amounts: Amounts;
  steps: Step[];
  startedAt: number;
  stirred: boolean;
  stirCount: number;
  onionMixed: boolean;
  spice: SpiceLevels;
}

export interface Plan {
  removed: Amounts;
  note: string;
}

export interface ActionStatus {
  ok: boolean;
  reason: string;
}

export interface Session {
  id: string;
  mealId: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  completed: boolean;
  steps: Step[];
  finalAmounts: Amounts;
  spice: SpiceLevels;
  stirCount: number;
  styleId?: string;
}
