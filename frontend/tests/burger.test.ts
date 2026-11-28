// Unit tests for the burger, fries and drink meal
import { describe, expect, it } from 'vitest';
import { analyze } from '../src/analysis';
import { actionsFor, actionStatus, buildSession, commit, foodLeft, newState, planAction } from '../src/rules';
import { burger } from '../src/meals/burger';
import type { Action, GameState, Session } from '../src/types';

function action(id: string): Action {
  const found = burger.actions.find(a => a.id === id);
  if (!found) throw new Error('No action ' + id);
  return found;
}

function play(state: GameState, id: string): void {
  const a = action(id);
  commit(state, a, planAction(burger, state, a), state.startedAt + (state.steps.length + 1) * 1000);
}

function sessionOf(ids: string[]): Session {
  const s = newState(burger, 0);
  ids.forEach(id => play(s, id));
  return buildSession(burger, s, (ids.length + 1) * 1000);
}

describe('burger meal rules', () => {
  it('stacks the burger bun, patty, cheese, tomato, lettuce, sauce, onions, bun', () => {
    const ing = burger.ingredients.find(i => i.id === 'burger');
    expect(ing?.layers?.map(l => l.name)).toEqual(
      ['Bun', 'Patty', 'Cheese', 'Tomato', 'Lettuce', 'Sauce', 'Onions', 'Bun']
    );
  });

  it('offers taking a bite and adding pickles on the burger', () => {
    expect(actionsFor(burger, 'burger').map(a => a.id)).toEqual(['take_bite', 'add_pickles']);
    expect(actionsFor(burger, 'fries').map(a => a.id)).toEqual(['eat_fries', 'dip_fries']);
    expect(actionsFor(burger, 'drink').map(a => a.id)).toEqual(['drink_it']);
  });

  it('clicking a side offers the actions that use it', () => {
    expect(actionsFor(burger, 'ketchup').map(a => a.id)).toEqual(['dip_fries']);
    expect(actionsFor(burger, 'pickles').map(a => a.id)).toEqual(['add_pickles']);
  });

  it('a bite takes one portion of burger', () => {
    const s = newState(burger, 0);
    play(s, 'take_bite');
    expect(s.amounts.burger).toBe(7);
    expect(s.steps[0]).toMatchObject({ actionId: 'take_bite', target: 'burger', removed: { burger: 1 } });
  });

  it('adding pickles uses a pickle and leaves the burger whole', () => {
    const s = newState(burger, 0);
    play(s, 'add_pickles');
    expect(s.amounts.pickles).toBe(2);
    expect(s.amounts.burger).toBe(8);
  });

  it('cannot add pickles once the burger is gone or the pickles run out', () => {
    const s = newState(burger, 0);
    s.amounts.burger = 0;
    expect(actionStatus(burger, s, action('add_pickles'))).toEqual({ ok: false, reason: 'No burger left to add pickles to' });
    s.amounts.burger = 4;
    s.amounts.pickles = 0;
    expect(actionStatus(burger, s, action('add_pickles'))).toEqual({ ok: false, reason: 'No pickles left' });
  });

  it('dipping fries uses ketchup and stops when the ketchup is gone', () => {
    const s = newState(burger, 0);
    play(s, 'dip_fries');
    expect(s.amounts.fries).toBe(9);
    expect(s.amounts.ketchup).toBe(4);
    s.amounts.ketchup = 0;
    expect(actionStatus(burger, s, action('dip_fries'))).toEqual({ ok: false, reason: 'No ketchup left' });
    expect(actionStatus(burger, s, action('eat_fries')).ok).toBe(true);
  });

  it('the meal is complete when the burger, fries and drink are gone, even with sides left', () => {
    const s = newState(burger, 0);
    play(s, 'drink_it');
    expect(buildSession(burger, s, 5000).completed).toBe(false);
    s.amounts.burger = 0;
    s.amounts.fries = 0;
    s.amounts.drink = 0;
    expect(foodLeft(burger, s)).toBe(0);
    const session = buildSession(burger, s, 5000);
    expect(session.completed).toBe(true);
    expect(session.mealId).toBe('burger');
    expect(s.amounts.ketchup).toBe(5);
  });
});

describe('burger eating styles', () => {
  it('spots a Pickle Fan', () => {
    expect(analyze(sessionOf(['add_pickles', 'add_pickles', 'take_bite']), burger).style.id).toBe('pickle_fan');
  });

  it('spots a Dip Master', () => {
    const a = analyze(sessionOf(['dip_fries', 'dip_fries', 'eat_fries', 'dip_fries', 'take_bite']), burger);
    expect(a.style.id).toBe('dipper');
  });

  it('calls a player who drinks first a Thirsty Starter', () => {
    expect(analyze(sessionOf(['drink_it', 'take_bite']), burger).style.id).toBe('thirsty');
  });

  it('spots a player who finishes the burger first', () => {
    const ids = ['take_bite', 'take_bite', 'take_bite', 'take_bite', 'take_bite', 'take_bite', 'take_bite', 'take_bite', 'eat_fries'];
    const a = analyze(sessionOf(ids), burger);
    expect(a.finishOrder).toEqual(['burger']);
    expect(a.style.id).toBe('burger_first');
  });

  it('spots a Switcher', () => {
    const ids = ['take_bite', 'eat_fries', 'drink_it', 'take_bite', 'eat_fries', 'drink_it', 'take_bite'];
    expect(analyze(sessionOf(ids), burger).style.id).toBe('switcher');
  });

  it('falls back to Balanced Eater', () => {
    const ids = [
      'take_bite', 'take_bite', 'take_bite', 'take_bite', 'take_bite', 'take_bite',
      'eat_fries', 'eat_fries', 'eat_fries', 'eat_fries', 'eat_fries', 'drink_it', 'drink_it', 'drink_it'
    ];
    const a = analyze(sessionOf(ids), burger);
    expect(a.style.id).toBe('balanced');
    expect(a.mostUsed).toEqual({ value: 'take_bite', count: 6 });
  });
});
