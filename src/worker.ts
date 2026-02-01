import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';

interface Env {
  DB: D1Database;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  RESEND_API_KEY: string;
  APP_URL: string;
}

interface User {
  id: string;
  email: string;
  name: string | null;
}

const app = new Hono<{ Bindings: Env }>();

app.use('/api/*', cors());

// ===== UTILITY FUNCTIONS =====

function generateId(): string {
  return crypto.randomUUID();
}

function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function sendVerificationEmail(
  email: string,
  token: string,
  appUrl: string,
  resendApiKey: string,
): Promise<boolean> {
  const verifyUrl = `${appUrl}/api/auth/verify?token=${token}`;
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Riff Music <noreply@resend.dev>',
        to: [email],
        subject: 'Verify your email address',
        html: `
          <h2>Welcome to Riff Music!</h2>
          <p>Please verify your email address by clicking the link below:</p>
          <p><a href="${verifyUrl}">Verify Email Address</a></p>
          <p>This link will expire in 24 hours.</p>
        `,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function getSessionUser(c: any): Promise<{ user_id: string } | null> {
  const sessionToken = getCookie(c, 'session');
  if (!sessionToken) return null;

  const session = (await c.env.DB.prepare(
    'SELECT user_id, expires_at FROM sessions WHERE token = ?',
  )
    .bind(sessionToken)
    .first()) as { user_id: string; expires_at: string } | null;

  if (!session || new Date(session.expires_at) < new Date()) {
    return null;
  }

  return { user_id: session.user_id };
}

// ===== AUTH ROUTES =====

app.post('/api/auth/register', async (c) => {
  const body = await c.req.json<{ email: string; password: string; name?: string }>();

  if (!body.email || !body.password) {
    return c.json({ error: 'Email and password are required' }, 400);
  }
  if (body.password.length < 8) {
    return c.json({ error: 'Password must be at least 8 characters' }, 400);
  }

  const existingUser = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(body.email.toLowerCase())
    .first();

  if (existingUser) {
    return c.json({ error: 'Email already registered' }, 400);
  }

  const userId = generateId();
  const passwordHash = await hashPassword(body.password);
  const verificationToken = generateToken();
  const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const result = await c.env.DB.prepare(
    'INSERT INTO users (id, email, password_hash, name, verification_token, verification_expires) VALUES (?, ?, ?, ?, ?, ?) RETURNING id, email, name, email_verified',
  )
    .bind(userId, body.email.toLowerCase(), passwordHash, body.name || null, verificationToken, verificationExpires)
    .first();

  const appUrl = c.env.APP_URL || 'http://localhost:8787';
  if (c.env.RESEND_API_KEY) {
    await sendVerificationEmail(body.email, verificationToken, appUrl, c.env.RESEND_API_KEY);
  }

  return c.json({ user: result, message: 'Please check your email to verify your account' }, 201);
});

app.get('/api/auth/verify', async (c) => {
  const token = c.req.query('token');
  if (!token) return c.json({ error: 'Verification token required' }, 400);

  const user = (await c.env.DB.prepare('SELECT id, verification_expires FROM users WHERE verification_token = ?')
    .bind(token)
    .first()) as { id: string; verification_expires: string } | null;

  if (!user) return c.json({ error: 'Invalid verification token' }, 400);
  if (new Date(user.verification_expires) < new Date()) {
    return c.json({ error: 'Verification token expired' }, 400);
  }

  await c.env.DB.prepare(
    'UPDATE users SET email_verified = 1, verification_token = NULL, verification_expires = NULL WHERE id = ?',
  )
    .bind(user.id)
    .run();

  const appUrl = c.env.APP_URL || 'http://localhost:8787';
  return c.redirect(`${appUrl}/#/login?verified=true`);
});

app.post('/api/auth/login', async (c) => {
  const body = await c.req.json<{ email: string; password: string }>();
  const appUrl = c.env.APP_URL || 'http://localhost:8787';
  const isProduction = !appUrl.includes('localhost');

  if (!body.email || !body.password) {
    return c.json({ error: 'Email and password are required' }, 400);
  }

  const passwordHash = await hashPassword(body.password);
  const user = (await c.env.DB.prepare(
    'SELECT id, email, name, email_verified FROM users WHERE email = ? AND password_hash = ?',
  )
    .bind(body.email.toLowerCase(), passwordHash)
    .first()) as (User & { email_verified: number }) | null;

  if (!user) return c.json({ error: 'Invalid email or password' }, 401);
  if (!user.email_verified) {
    return c.json({ error: 'Please verify your email before logging in' }, 401);
  }

  const sessionId = generateId();
  const sessionToken = generateToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await c.env.DB.prepare('INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)')
    .bind(sessionId, user.id, sessionToken, expiresAt)
    .run();

  setCookie(c, 'session', sessionToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'Lax',
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
  });

  return c.json({ user: { id: user.id, email: user.email, name: user.name } });
});

app.get('/api/auth/google', async (c) => {
  const clientId = c.env.GOOGLE_CLIENT_ID;
  const appUrl = c.env.APP_URL || 'http://localhost:8787';
  const redirectUri = `${appUrl}/api/auth/google/callback`;

  if (!clientId) return c.json({ error: 'Google OAuth not configured' }, 500);

  const state = generateToken();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await c.env.DB.prepare('INSERT INTO oauth_states (state, expires_at) VALUES (?, ?)')
    .bind(state, expiresAt)
    .run();

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'email profile');
  authUrl.searchParams.set('state', state);

  return c.redirect(authUrl.toString());
});

app.get('/api/auth/google/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const appUrl = c.env.APP_URL || 'http://localhost:8787';
  const isProduction = !appUrl.includes('localhost');

  if (!code || !state) return c.redirect(`${appUrl}/#/login?error=invalid_state`);

  const savedState = await c.env.DB.prepare(
    'SELECT state FROM oauth_states WHERE state = ? AND expires_at > ?',
  )
    .bind(state, new Date().toISOString())
    .first();

  await c.env.DB.prepare('DELETE FROM oauth_states WHERE state = ?').bind(state).run();

  if (!savedState) return c.redirect(`${appUrl}/#/login?error=invalid_state`);

  const clientId = c.env.GOOGLE_CLIENT_ID;
  const clientSecret = c.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${appUrl}/api/auth/google/callback`;

  if (!clientId || !clientSecret) {
    return c.redirect(`${appUrl}/#/login?error=oauth_not_configured`);
  }

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  const tokenData = (await tokenResponse.json()) as { access_token?: string };
  if (!tokenData.access_token) {
    return c.redirect(`${appUrl}/#/login?error=token_exchange_failed`);
  }

  const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const googleUser = (await userInfoResponse.json()) as { id: string; email: string; name: string };

  let user = (await c.env.DB.prepare('SELECT id, email, name FROM users WHERE google_id = ?')
    .bind(googleUser.id)
    .first()) as User | null;

  if (!user) {
    user = (await c.env.DB.prepare('SELECT id, email, name FROM users WHERE email = ?')
      .bind(googleUser.email.toLowerCase())
      .first()) as User | null;

    if (user) {
      await c.env.DB.prepare('UPDATE users SET google_id = ?, email_verified = 1 WHERE id = ?')
        .bind(googleUser.id, user.id)
        .run();
    } else {
      user = (await c.env.DB.prepare(
        'INSERT INTO users (id, email, name, google_id, email_verified) VALUES (?, ?, ?, ?, 1) RETURNING id, email, name',
      )
        .bind(generateId(), googleUser.email.toLowerCase(), googleUser.name, googleUser.id)
        .first()) as User;
    }
  }

  const sessionId = generateId();
  const sessionToken = generateToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await c.env.DB.prepare('INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)')
    .bind(sessionId, user!.id, sessionToken, expiresAt)
    .run();

  setCookie(c, 'session', sessionToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'Lax',
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
  });

  return c.redirect(`${appUrl}/#/library`);
});

app.get('/api/auth/me', async (c) => {
  const sessionToken = getCookie(c, 'session');
  const appUrl = c.env.APP_URL || 'http://localhost:8787';
  const isProduction = !appUrl.includes('localhost');

  if (!sessionToken) return c.json({ user: null });

  const session = (await c.env.DB.prepare(
    'SELECT user_id, expires_at, created_at FROM sessions WHERE token = ?',
  )
    .bind(sessionToken)
    .first()) as { user_id: string; expires_at: string; created_at: string } | null;

  if (!session || new Date(session.expires_at) < new Date()) {
    deleteCookie(c, 'session');
    return c.json({ user: null });
  }

  const maxLifetime = 60 * 24 * 60 * 60 * 1000;
  const sessionAge = Date.now() - new Date(session.created_at).getTime();
  if (sessionAge > maxLifetime) {
    await c.env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(sessionToken).run();
    deleteCookie(c, 'session');
    return c.json({ user: null });
  }

  const slidingWindow = 7 * 24 * 60 * 60 * 1000;
  const maxExpiry = new Date(session.created_at).getTime() + maxLifetime;
  const newExpiry = Math.min(Date.now() + slidingWindow, maxExpiry);
  const newExpiresAt = new Date(newExpiry).toISOString();
  const cookieMaxAge = Math.floor((newExpiry - Date.now()) / 1000);

  await c.env.DB.prepare('UPDATE sessions SET expires_at = ? WHERE token = ?')
    .bind(newExpiresAt, sessionToken)
    .run();

  setCookie(c, 'session', sessionToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'Lax',
    maxAge: cookieMaxAge,
    path: '/',
  });

  const user = await c.env.DB.prepare('SELECT id, email, name FROM users WHERE id = ?')
    .bind(session.user_id)
    .first();

  return c.json({ user });
});

app.post('/api/auth/logout', async (c) => {
  const sessionToken = getCookie(c, 'session');
  if (sessionToken) {
    await c.env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(sessionToken).run();
    deleteCookie(c, 'session');
  }
  return c.json({ success: true });
});

// ===== SCORES API =====

app.get('/api/scores', async (c) => {
  const session = await getSessionUser(c);
  if (!session) return c.json({ error: 'Not authenticated' }, 401);

  const scores = await c.env.DB.prepare(
    'SELECT id, title, created_at FROM scores WHERE user_id = ? ORDER BY created_at DESC',
  )
    .bind(session.user_id)
    .all();

  return c.json({ scores: scores.results });
});

app.post('/api/scores', async (c) => {
  const session = await getSessionUser(c);
  if (!session) return c.json({ error: 'Not authenticated' }, 401);

  const body = await c.req.json<{ title: string; musicxml: string }>();
  if (!body.title || !body.musicxml) {
    return c.json({ error: 'Title and musicxml are required' }, 400);
  }

  const id = generateId();
  await c.env.DB.prepare('INSERT INTO scores (id, user_id, title, musicxml) VALUES (?, ?, ?, ?)')
    .bind(id, session.user_id, body.title, body.musicxml)
    .run();

  return c.json({ id, title: body.title }, 201);
});

app.get('/api/scores/:id', async (c) => {
  const session = await getSessionUser(c);
  if (!session) return c.json({ error: 'Not authenticated' }, 401);

  const score = (await c.env.DB.prepare('SELECT id, title, musicxml, created_at FROM scores WHERE id = ? AND user_id = ?')
    .bind(c.req.param('id'), session.user_id)
    .first()) as { id: string; title: string; musicxml: string; created_at: string } | null;

  if (!score) return c.json({ error: 'Score not found' }, 404);

  return c.json({ score });
});

app.delete('/api/scores/:id', async (c) => {
  const session = await getSessionUser(c);
  if (!session) return c.json({ error: 'Not authenticated' }, 401);

  const result = await c.env.DB.prepare('DELETE FROM scores WHERE id = ? AND user_id = ?')
    .bind(c.req.param('id'), session.user_id)
    .run();

  if (!result.meta.changes) return c.json({ error: 'Score not found' }, 404);

  return c.json({ success: true });
});

export default app;
