export interface User {
  id: string;
  email: string;
  name: string | null;
}

export interface ScoreSummary {
  id: string;
  title: string;
  created_at: string;
}

export interface ScoreFull extends ScoreSummary {
  musicxml: string;
}

const headers = { 'Content-Type': 'application/json' };
const opts: RequestInit = { credentials: 'include' };

export async function register(email: string, password: string, name?: string) {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, password, name }),
    ...opts,
  });
  return res.json() as Promise<{ user?: User; message?: string; error?: string }>;
}

export async function login(email: string, password: string) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, password }),
    ...opts,
  });
  return res.json() as Promise<{ user?: User; error?: string }>;
}

export async function logout() {
  await fetch('/api/auth/logout', { method: 'POST', ...opts });
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const res = await fetch('/api/auth/me', opts);
    if (!res.ok) return null;
    const data = (await res.json()) as { user: User | null };
    return data.user;
  } catch {
    return null;
  }
}

export function getGoogleAuthUrl(): string {
  return '/api/auth/google';
}

export async function getScores(): Promise<ScoreSummary[]> {
  const res = await fetch('/api/scores', opts);
  const data = (await res.json()) as { scores: ScoreSummary[] };
  return data.scores;
}

export async function saveScore(title: string, musicxml: string): Promise<{ id: string }> {
  const res = await fetch('/api/scores', {
    method: 'POST',
    headers,
    body: JSON.stringify({ title, musicxml }),
    ...opts,
  });
  return res.json() as Promise<{ id: string }>;
}

export async function getScore(id: string): Promise<ScoreFull | null> {
  const res = await fetch(`/api/scores/${id}`, opts);
  if (!res.ok) return null;
  const data = (await res.json()) as { score: ScoreFull };
  return data.score;
}

export async function deleteScore(id: string): Promise<boolean> {
  const res = await fetch(`/api/scores/${id}`, { method: 'DELETE', ...opts });
  return res.ok;
}
