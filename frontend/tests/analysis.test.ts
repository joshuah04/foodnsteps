// Unit tests for eating style rules in src/analysis.ts
import { describe, expect, it } from 'vitest';
import { analyze, mode, styleById } from '../src/analysis';
import { buildSession, commit, newState, planAction } from '../src/rules';
import { ramen } from '../src/meals/ramen';
import type { Session } from '../src/types';

// plays a list of action ids and returns the finished session
function sessionOf(ids: string[]): Session {
  const s = newState(ramen, 0);
  ids.forEach((id, i) => {
    const a = ramen.actions.find(x => x.id === id);
    if (!a) throw new Error('No action ' + id);
    commit(s, a, planAction(ramen, s, a), (i + 1) * 1000);
  });
  return buildSession(ramen, s, (ids.length + 1) * 1000);
}

describe('analyze', () => {
  it('calls a player who sips broth first a Broth Taster', () => {
    const a = analyze(sessionOf(['sip_broth', 'eat_noodles']), ramen);
    expect(a.style.id).toBe('broth_first');
  });

  it('spice beats every other style when seasoned three times', () => {
    const a = analyze(sessionOf(['sip_broth', 'add_salt', 'add_pepper', 'add_chili']), ramen);
    expect(a.style.id).toBe('spice');
    expect(a.tags).toContain('Broth Taster');
  });

  it('spots a Noodle Rusher', () => {
    const a = analyze(sessionOf(['eat_noodles', 'slurp_noodles', 'eat_noodles', 'eat_egg']), ramen);
    expect(a.style.id).toBe('noodle');
  });

  it('records the order foods were finished', () => {
    const a = analyze(sessionOf(['eat_egg', 'eat_egg', 'eat_nori', 'eat_nori']), ramen);
    expect(a.finishOrder).toEqual(['egg', 'nori']);
  });

  it('finds the most used action', () => {
    const a = analyze(sessionOf(['eat_corn', 'sip_broth', 'eat_corn']), ramen);
    expect(a.mostUsed).toEqual({ value: 'eat_corn', count: 2 });
  });
});

describe('helpers', () => {
  it('mode returns null for an empty list', () => {
    expect(mode([])).toEqual({ value: null, count: 0 });
  });

  it('styleById falls back to Balanced Eater', () => {
    expect(styleById('nope').id).toBe('balanced');
    expect(styleById('spice').name).toBe('Spice Lover');
  });
});
