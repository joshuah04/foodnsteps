// Every playable meal, in the order the meal picker shows them
import type { Meal } from '../types';
import { burger } from './burger';
import { ramen } from './ramen';
import { sushi } from './sushi';

export const MEALS: Meal[] = [ramen, burger, sushi];

// unknown ids fall back to the first meal so an old or mistyped link still loads a game
export function mealById(id: string | null | undefined): Meal {
  return MEALS.find(m => m.id === id) ?? MEALS[0];
}
