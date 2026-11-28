// Checks that every meal definition is consistent, so a typo in a meal file fails CI
import { describe, expect, it } from 'vitest';
import { STYLES_BY_MEAL } from '../src/analysis';
import { MEALS, mealById } from '../src/meals';

describe.each(MEALS.map(m => [m.id, m] as const))('meal %s', (_id, meal) => {
  const ids = new Set(meal.ingredients.map(i => i.id));

  it('has unique ingredient and action ids', () => {
    expect(ids.size).toBe(meal.ingredients.length);
    expect(new Set(meal.actions.map(a => a.id)).size).toBe(meal.actions.length);
  });

  it('only refers to ingredients that exist', () => {
    for (const a of meal.actions) {
      if (a.target !== 'bowl') expect(ids, a.id + ' target').toContain(a.target);
      const keys = [...Object.keys(a.consume), ...Object.keys(a.requires?.min ?? {}), ...Object.keys(a.requires?.max ?? {})];
      for (const k of keys) expect(ids, a.id + ' uses ' + k).toContain(k);
    }
    for (const t of meal.mixedToppings) expect(ids).toContain(t);
  });

  it('has at least one food and eating styles ending in a catch all', () => {
    expect(meal.ingredients.some(i => i.kind === 'food')).toBe(true);
    const styles = STYLES_BY_MEAL[meal.id];
    expect(styles).toBeDefined();
    expect(styles[styles.length - 1].id).toBe('balanced');
  });
});

describe('mealById', () => {
  it('finds a meal or falls back to the first one', () => {
    expect(mealById('burger').id).toBe('burger');
    expect(mealById('nope').id).toBe(MEALS[0].id);
    expect(mealById(null).id).toBe('ramen');
  });
});
