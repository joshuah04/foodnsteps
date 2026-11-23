// Unit tests for the game rules in src/rules.ts
import { describe, expect, it } from 'vitest';
import { actionStatus, buildSession, commit, foodLeft, newState, planAction } from '../src/rules';
import { ramen } from '../src/meals/ramen';
import type { Action, GameState } from '../src/types';

function action(id: string): Action {
  const found = ramen.actions.find(a => a.id === id);
  if (!found) throw new Error('No action ' + id);
  return found;
}

// plays an action the same way the game does, minus the animation
function play(state: GameState, id: string, now = state.startedAt + 1000): void {
  const a = action(id);
  commit(state, a, planAction(ramen, state, a), now);
}

describe('newState', () => {
  it('starts every ingredient at its starting amount', () => {
    const s = newState(ramen, 0);
    for (const ing of ramen.ingredients) expect(s.amounts[ing.id]).toBe(ing.start);
    expect(s.steps).toEqual([]);
    expect(s.stirred).toBe(false);
  });
});

describe('actionStatus', () => {
  it('blocks drinking from the bowl while lots of noodles remain', () => {
    const s = newState(ramen, 0);
    const st = actionStatus(ramen, s, action('drink_bowl'));
    expect(st.ok).toBe(false);
    expect(st.reason).toBe('Eat most of the noodles first');
  });

  it('allows drinking from the bowl once noodles are low', () => {
    const s = newState(ramen, 0);
    s.amounts.noodles = 3;
    expect(actionStatus(ramen, s, action('drink_bowl')).ok).toBe(true);
  });

  it('blocks an action when its ingredient is gone', () => {
    const s = newState(ramen, 0);
    s.amounts.egg = 0;
    expect(actionStatus(ramen, s, action('eat_egg'))).toEqual({ ok: false, reason: 'No egg left' });
  });

  it('blocks dipping chashu when there is no broth', () => {
    const s = newState(ramen, 0);
    s.amounts.broth = 0;
    expect(actionStatus(ramen, s, action('dip_chashu')).ok).toBe(false);
  });
});

describe('planAction and commit', () => {
  it('slurping removes two portions of noodles and logs a step', () => {
    const s = newState(ramen, 0);
    play(s, 'slurp_noodles', 1500);
    expect(s.amounts.noodles).toBe(8);
    expect(s.steps).toHaveLength(1);
    expect(s.steps[0]).toMatchObject({ n: 1, actionId: 'slurp_noodles', t: 1500, removed: { noodles: 2 } });
    expect(s.steps[0].after.noodles).toBe(8);
  });

  it('never removes more than what is left', () => {
    const s = newState(ramen, 0);
    s.amounts.noodles = 1;
    expect(planAction(ramen, s, action('slurp_noodles')).removed).toEqual({ noodles: 1 });
  });

  it('wrapping nori also eats noodles', () => {
    const s = newState(ramen, 0);
    play(s, 'wrap_nori');
    expect(s.amounts.nori).toBe(1);
    expect(s.amounts.noodles).toBe(9);
  });

  it('after stirring, sipping broth picks up the most plentiful topping', () => {
    const s = newState(ramen, 0);
    play(s, 'stir_bowl');
    expect(s.stirred).toBe(true);
    expect(s.stirCount).toBe(1);
    const plan = planAction(ramen, s, action('sip_broth'));
    expect(plan.removed).toEqual({ broth: 1, onion: 1 });
    expect(plan.note).toBe('picked up some green onion');
  });

  it('seasoning raises the spice level without eating food', () => {
    const s = newState(ramen, 0);
    const before = foodLeft(ramen, s);
    play(s, 'add_chili');
    play(s, 'add_chili');
    expect(s.spice.chili).toBe(2);
    expect(s.amounts.chili).toBe(1);
    expect(foodLeft(ramen, s)).toBe(before);
  });
});

describe('buildSession', () => {
  it('marks the meal complete only when all food is gone', () => {
    const s = newState(ramen, 0);
    play(s, 'eat_egg');
    expect(buildSession(ramen, s, 60000).completed).toBe(false);
    for (const ing of ramen.ingredients) if (ing.kind === 'food') s.amounts[ing.id] = 0;
    const session = buildSession(ramen, s, 60000);
    expect(session.completed).toBe(true);
    expect(session.durationMs).toBe(60000);
    expect(session.mealId).toBe('ramen');
  });
});
