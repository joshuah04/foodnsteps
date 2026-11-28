// Eating style rules and stats with no DOM access, so they can be unit tested
import type { Meal, Session, Step, Amounts } from './types';
import { SUSHI } from './meals/sushi';

export interface AnalysisInput {
  first: Step | null;
  eatCount: number;
  noodleCount: number;
  seasonCount: number;
  // how many steps took something from each ingredient, keyed by ingredient id
  touched: Record<string, number>;
  // how many actions used each action id
  actionCount: Record<string, number>;
  // times the player moved from one food to a different one between eating steps
  switches: number;
  prepCount: number;
  finishOrder: string[];
  finalAmounts: Amounts;
  leftShare: number;
}

export interface Style {
  id: string;
  name: string;
  desc: string;
  test: (a: AnalysisInput) => boolean;
}

export interface ModeResult<T> {
  value: T | null;
  count: number;
}

export interface Analysis {
  style: Style;
  tags: string[];
  mostUsed: ModeResult<string>;
  finishOrder: string[];
  leftShare: number;
}

// checked in order, the first match becomes the main eating style
export const RAMEN_STYLES: Style[] = [
  { id: 'spice', name: 'Spice Lover', desc: 'You seasoned the bowl three or more times.',
    test: a => a.seasonCount >= 3 },
  { id: 'broth_first', name: 'Broth Taster', desc: 'You tasted the broth before anything else.',
    test: a => a.first !== null && a.first.target === 'broth' },
  { id: 'noodle', name: 'Noodle Rusher', desc: 'At least half of your bites went to the noodles.',
    test: a => a.eatCount >= 4 && a.noodleCount / a.eatCount >= 0.5 },
  { id: 'best_last', name: 'Saves the Best for Last', desc: 'The chashu pork was the last thing you finished.',
    test: a => a.finishOrder.length >= 3 && a.finishOrder[a.finishOrder.length - 1] === 'chashu' },
  { id: 'mixer', name: 'Master Mixer', desc: 'You stirred and mixed the bowl more than once.',
    test: a => a.prepCount >= 2 },
  { id: 'drainer', name: 'Bowl Drainer', desc: 'You drank every drop of broth.',
    test: a => a.finalAmounts.broth === 0 },
  { id: 'light', name: 'Light Eater', desc: 'You finished with half the bowl or more still left.',
    test: a => a.leftShare >= 0.5 },
  { id: 'balanced', name: 'Balanced Eater', desc: 'You worked your way around the whole bowl evenly.',
    test: () => true }
];

export const BURGER_STYLES: Style[] = [
  { id: 'pickle_fan', name: 'Pickle Fan', desc: 'You added pickles to your burger two or more times.',
    test: a => (a.actionCount.add_pickles ?? 0) >= 2 },
  { id: 'dipper', name: 'Dip Master', desc: 'Most of your fries went into the ketchup first.',
    test: a => (a.actionCount.dip_fries ?? 0) >= 3 && (a.actionCount.dip_fries ?? 0) > (a.actionCount.eat_fries ?? 0) },
  { id: 'thirsty', name: 'Thirsty Starter', desc: 'You reached for the drink before anything else.',
    test: a => a.first !== null && a.first.target === 'drink' },
  { id: 'burger_first', name: 'Burger First', desc: 'You finished the whole burger before anything else.',
    test: a => a.finishOrder[0] === 'burger' && (a.touched.fries ?? 0) + (a.touched.drink ?? 0) > 0 },
  { id: 'switcher', name: 'Switcher', desc: 'You kept switching between the burger, the fries and the drink.',
    test: a => a.eatCount >= 6 && a.switches / (a.eatCount - 1) >= 0.6 },
  { id: 'fries_last', name: 'Fries for Dessert', desc: 'The fries were the last thing you finished.',
    test: a => a.finishOrder.length >= 3 && a.finishOrder[a.finishOrder.length - 1] === 'fries' },
  { id: 'light', name: 'Light Eater', desc: 'You finished with half the tray or more still left.',
    test: a => a.leftShare >= 0.5 },
  { id: 'balanced', name: 'Balanced Eater', desc: 'You worked your way around the whole tray evenly.',
    test: () => true }
];

const SUSHI_IDS = SUSHI.map(k => k.id);

function countPrefix(a: AnalysisInput, prefix: string): number {
  return Object.entries(a.actionCount).reduce((sum, [id, n]) => sum + (id.startsWith(prefix) ? n : 0), 0);
}

// the sushi type eaten most, with how many pieces of it and of all sushi were eaten
function favoriteSushi(a: AnalysisInput): { id: string | null; n: number; total: number } {
  let id: string | null = null;
  let n = 0;
  let total = 0;
  SUSHI_IDS.forEach(k => {
    const c = a.touched[k] ?? 0;
    total += c;
    if (c > n) { id = k; n = c; }
  });
  return { id, n, total };
}

export const SUSHI_STYLES: Style[] = [
  { id: 'regular', name: 'Regular', desc: 'You asked the kitchen for more sushi two or more times.',
    test: a => countPrefix(a, 'more_') >= 2 },
  { id: 'wasabi', name: 'Wasabi Warrior', desc: 'You mixed wasabi into your soy sauce two or more times.',
    test: a => (a.actionCount.mix_wasabi ?? 0) >= 2 },
  { id: 'soup_first', name: 'Soup Starter', desc: 'You started with a sip of miso soup.',
    test: a => a.first !== null && a.first.target === 'miso' },
  { id: 'soy_dipper', name: 'Soy Dipper', desc: 'Most of your sushi went into the soy sauce first.',
    test: a => countPrefix(a, 'dip_') >= 4 && countPrefix(a, 'dip_') > countPrefix(a, 'eat_') - (a.actionCount.eat_radish ?? 0) },
  { id: 'tour', name: 'Sushi Tour', desc: 'You tried every kind of sushi on the platter.',
    test: a => SUSHI_IDS.every(k => (a.touched[k] ?? 0) > 0) },
  { id: 'favorite', name: 'One True Favorite', desc: 'Half or more of your sushi was the same kind.',
    test: a => { const f = favoriteSushi(a); return f.total >= 5 && f.n / f.total >= 0.5; } },
  { id: 'light', name: 'Light Eater', desc: 'You finished with half the platter or more still left.',
    test: a => a.leftShare >= 0.5 },
  { id: 'balanced', name: 'Balanced Eater', desc: 'You worked your way around the whole platter evenly.',
    test: () => true }
];

// eating styles for each meal id; every list ends with a style that always matches
export const STYLES_BY_MEAL: Record<string, Style[]> = {
  ramen: RAMEN_STYLES,
  burger: BURGER_STYLES,
  sushi: SUSHI_STYLES
};

export function stylesFor(mealId: string): Style[] {
  return STYLES_BY_MEAL[mealId] ?? RAMEN_STYLES;
}

export function styleById(mealId: string, id: string | null | undefined): Style {
  const styles = stylesFor(mealId);
  return styles.find(s => s.id === id) ?? styles[styles.length - 1];
}

export function mode<T>(values: T[]): ModeResult<T> {
  const counts = new Map<T, number>();
  values.forEach(v => counts.set(v, (counts.get(v) ?? 0) + 1));
  let best: T | null = null;
  let bestN = 0;
  counts.forEach((n, v) => { if (n > bestN) { best = v; bestN = n; } });
  return { value: best, count: bestN };
}

export function analyze(session: Session, meal: Meal): Analysis {
  const steps = session.steps;
  const food = meal.ingredients.filter(i => i.kind === 'food');
  const startTotal = food.reduce((s, i) => s + i.start, 0);
  const leftTotal = food.reduce((s, i) => s + session.finalAmounts[i.id], 0);

  // order in which each food first reached zero
  const finishOrder: string[] = [];
  steps.forEach(st => {
    food.forEach(i => {
      if (st.after[i.id] === 0 && !finishOrder.includes(i.id)) finishOrder.push(i.id);
    });
  });

  const touched: Record<string, number> = {};
  const actionCount: Record<string, number> = {};
  steps.forEach(st => {
    actionCount[st.actionId] = (actionCount[st.actionId] ?? 0) + 1;
    Object.keys(st.removed ?? {}).forEach(id => { touched[id] = (touched[id] ?? 0) + 1; });
  });

  const eating = steps.filter(s => s.category === 'eat' || s.category === 'sip');
  let switches = 0;
  for (let i = 1; i < eating.length; i++) if (eating[i].target !== eating[i - 1].target) switches += 1;

  const a: AnalysisInput = {
    first: steps[0] ?? null,
    eatCount: eating.length,
    noodleCount: touched.noodles ?? 0,
    seasonCount: steps.filter(s => s.category === 'season').length,
    touched,
    actionCount,
    switches,
    prepCount: steps.filter(s => s.category === 'prep' && s.actionId !== 'cool_noodles').length,
    finishOrder,
    finalAmounts: session.finalAmounts,
    leftShare: startTotal ? leftTotal / startTotal : 0
  };

  const matches = stylesFor(meal.id).filter(s => s.test(a));
  const style = matches[0];
  const tags = matches.filter(s => s.id !== 'balanced').map(s => s.name);
  const mostUsed = mode(steps.map(s => s.actionId));
  return { style, tags, mostUsed, finishOrder, leftShare: a.leftShare };
}
