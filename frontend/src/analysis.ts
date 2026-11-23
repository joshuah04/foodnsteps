// Eating style rules and stats with no DOM access, so they can be unit tested
import type { Meal, Session, Step, Amounts } from './types';

export interface AnalysisInput {
  first: Step | null;
  eatCount: number;
  noodleCount: number;
  seasonCount: number;
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
export const STYLES: Style[] = [
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

export function styleById(id: string | null | undefined): Style {
  return STYLES.find(s => s.id === id) ?? STYLES[STYLES.length - 1];
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

  const a: AnalysisInput = {
    first: steps[0] ?? null,
    eatCount: steps.filter(s => s.category === 'eat' || s.category === 'sip').length,
    noodleCount: steps.filter(s => s.removed && s.removed.noodles).length,
    seasonCount: steps.filter(s => s.category === 'season').length,
    prepCount: steps.filter(s => s.category === 'prep' && s.actionId !== 'cool_noodles').length,
    finishOrder,
    finalAmounts: session.finalAmounts,
    leftShare: startTotal ? leftTotal / startTotal : 0
  };

  const matches = STYLES.filter(s => s.test(a));
  const style = matches[0];
  const tags = matches.filter(s => s.id !== 'balanced').map(s => s.name);
  const mostUsed = mode(steps.map(s => s.actionId));
  return { style, tags, mostUsed, finishOrder, leftShare: a.leftShare };
}
