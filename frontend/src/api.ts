// Talks to the FastAPI server; replaces the old browser only storage.ts
import type { ComparisonResults, Session } from './types';

// empty means same origin; set VITE_API_URL when the API lives elsewhere, for example on Fly.io
// it is read at build time, so changing it needs a new build; a trailing slash is ignored
const BASE: string = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) }
  });
  if (!res.ok) throw new Error('Request to ' + path + ' failed with ' + res.status);
  return (await res.json()) as T;
}

// saves a finished play and returns the id the server gave it
export async function saveSession(session: Session): Promise<string> {
  const { id: _localId, ...body } = session;
  const out = await request<{ id: string }>('/api/sessions', { method: 'POST', body: JSON.stringify(body) });
  return out.id;
}

export function getResults(sessionId: string): Promise<ComparisonResults> {
  return request<ComparisonResults>('/api/sessions/' + encodeURIComponent(sessionId) + '/results');
}
