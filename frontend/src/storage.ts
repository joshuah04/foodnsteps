// Saves finished sessions in this browser until the Python server exists
// Every read and write is guarded because storage can be blocked or empty
import type { Session } from './types';

const KEY = 'foodnsteps.sessions.v1';

export function loadAll(): Session[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? (list as Session[]) : [];
  } catch {
    return [];
  }
}

export function save(session: Session): Session[] {
  const list = loadAll();
  list.push(session);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // storage unavailable, the results screen still works for this play
  }
  return list;
}

export function forMeal(mealId: string): Session[] {
  return loadAll().filter(s => s.mealId === mealId);
}
