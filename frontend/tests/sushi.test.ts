// Unit tests for the sushi platter and its request more mechanic
import { describe, expect, it } from 'vitest';
import { analyze } from '../src/analysis';
import { actionsFor, actionStatus, buildSession, commit, foodLeft, newState, planAction } from '../src/rules';
import { MAX_REFILLS, SUSHI, sushi } from '../src/meals/sushi';
import type { Action, GameState, Session } from '../src/types';

function action(id: string): Action {
  const found = sushi.actions.find(a => a.id === id);
  if (!found) throw new Error('No action ' + id);
  return found;
}

function play(state: GameState, id: string): void {
  const a = action(id);
  if (!actionStatus(sushi, state, a).ok) throw new Error(id + ' is not allowed: ' + actionStatus(sushi, state, a).reason);
  commit(state, a, planAction(sushi, state, a), state.startedAt + (state.steps.length + 1) * 1000);
}

function sessionOf(ids: string[]): Session {
  const s = newState(sushi, 0);
  ids.forEach(id => play(s, id));
  return buildSession(sushi, s, (ids.length + 1) * 1000);
}

const times = (id: string, n: number): string[] => Array.from({ length: n }, () => id);

describe('sushi platter', () => {
  it('serves every sushi from the reference plus the four sides', () => {
    expect(SUSHI.map(k => k.id)).toEqual(['salmon', 'whitefish', 'shrimp', 'squid', 'tuna', 'eel', 'maki', 'eelroll']);
    const sides = sushi.ingredients.filter(i => !SUSHI.some(k => k.id === i.id)).map(i => i.id);
    expect(sides).toEqual(['miso', 'soy', 'wasabi', 'radish']);
  });

  it('offers eat, dip and request more on each sushi', () => {
    expect(actionsFor(sushi, 'salmon').map(a => a.id)).toEqual(['eat_salmon', 'dip_salmon', 'more_salmon']);
  });

  it('dipping uses soy sauce and stops when it runs out', () => {
    const s = newState(sushi, 0);
    play(s, 'dip_tuna');
    expect(s.amounts.tuna).toBe(2);
    expect(s.amounts.soy).toBe(7);
    s.amounts.soy = 0;
    expect(actionStatus(sushi, s, action('dip_tuna'))).toEqual({ ok: false, reason: 'No soy sauce left' });
  });

  it('wasabi mixes into the soy sauce without using it up', () => {
    const s = newState(sushi, 0);
    play(s, 'mix_wasabi');
    expect(s.amounts.wasabi).toBe(2);
    expect(s.amounts.soy).toBe(8);
    expect(actionsFor(sushi, 'wasabi').map(a => a.id)).toEqual(['mix_wasabi']);
  });
});

describe('request more', () => {
  it('is only available once that sushi is finished', () => {
    const s = newState(sushi, 0);
    play(s, 'eat_salmon');
    expect(actionStatus(sushi, s, action('more_salmon'))).toEqual({ ok: false, reason: 'Finish the salmon first' });
  });

  it('refills only the requested sushi back to a full serving', () => {
    const s = newState(sushi, 0);
    times('eat_salmon', 3).forEach(id => play(s, id));
    play(s, 'eat_tuna');
    play(s, 'more_salmon');
    expect(s.amounts.salmon).toBe(3);
    expect(s.amounts.tuna).toBe(2);
    const last = s.steps[s.steps.length - 1];
    expect(last).toMatchObject({ actionId: 'more_salmon', category: 'order', note: '3 more served', removed: {} });
    expect(last.after.salmon).toBe(3);
  });

  it('works for each sushi type on its own', () => {
    for (const k of SUSHI) {
      const s = newState(sushi, 0);
      times('eat_' + k.id, k.pieces.length).forEach(id => play(s, id));
      play(s, 'more_' + k.id);
      expect(s.amounts[k.id]).toBe(k.pieces.length);
    }
  });

  it('stops after the kitchen limit', () => {
    const s = newState(sushi, 0);
    for (let r = 0; r < MAX_REFILLS; r++) {
      times('eat_shrimp', 3).forEach(id => play(s, id));
      play(s, 'more_shrimp');
    }
    times('eat_shrimp', 3).forEach(id => play(s, id));
    expect(actionStatus(sushi, s, action('more_shrimp'))).toEqual({ ok: false, reason: 'The kitchen is out of shrimp' });
  });

  it('a refilled platter is not complete until the new pieces are eaten too', () => {
    const s = newState(sushi, 0);
    for (const ing of sushi.ingredients) if (ing.kind === 'food') s.amounts[ing.id] = 0;
    expect(foodLeft(sushi, s)).toBe(0);
    play(s, 'more_eel');
    expect(buildSession(sushi, s, 9000).completed).toBe(false);
  });
});

describe('sushi eating styles', () => {
  it('spots a Regular', () => {
    const ids = [...times('eat_salmon', 3), 'more_salmon', ...times('eat_salmon', 3), 'more_salmon'];
    expect(analyze(sessionOf(ids), sushi).style.id).toBe('regular');
  });

  it('spots a Wasabi Warrior', () => {
    expect(analyze(sessionOf(['mix_wasabi', 'mix_wasabi', 'dip_tuna']), sushi).style.id).toBe('wasabi');
  });

  it('spots a Soup Starter', () => {
    expect(analyze(sessionOf(['sip_miso', 'eat_salmon']), sushi).style.id).toBe('soup_first');
  });

  it('spots a Soy Dipper', () => {
    const ids = ['dip_salmon', 'dip_tuna', 'dip_eel', 'dip_maki', 'eat_squid'];
    expect(analyze(sessionOf(ids), sushi).style.id).toBe('soy_dipper');
  });

  it('spots a Sushi Tour', () => {
    const ids = SUSHI.map(k => 'eat_' + k.id);
    expect(analyze(sessionOf(ids), sushi).style.id).toBe('tour');
  });

  it('spots One True Favorite', () => {
    const ids = [...times('eat_tuna', 3), 'eat_salmon', 'eat_eel', 'eat_tuna'].slice(0, 5);
    expect(analyze(sessionOf(ids), sushi).style.id).toBe('favorite');
  });
});
