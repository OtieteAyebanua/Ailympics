/**
 * Frontend API client — talks to the Next.js route handlers that replaced the
 * Supabase REST/edge backend. Sends the wallet JWT as a Bearer token.
 *
 * VITE_API_URL: base URL of the API. Empty = same origin (final Next app);
 * during the Vite→Next transition, set it to the Next server, e.g.
 * http://localhost:3000.
 */
import { JWT_KEY, env } from './env';

const BASE = env.apiUrl;

function authHeaders(): Record<string, string> {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem(JWT_KEY) : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parse<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

export function apiGet<T>(path: string): Promise<T> {
  return fetch(`${BASE}${path}`, { headers: authHeaders() }).then((r) => parse<T>(r));
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then((r) => parse<T>(r));
}

export function apiPut<T>(path: string, body?: unknown): Promise<T> {
  return fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then((r) => parse<T>(r));
}
