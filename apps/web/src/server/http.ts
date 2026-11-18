import { NextResponse } from 'next/server';
import { accountsEnabled, getDb, type Db } from './db';
import { SESSION_COOKIE, SESSION_DAYS, getSessionUser, type SessionUser } from './auth';

export type ApiError =
  | 'disabled'
  | 'bad-request'
  | 'unauthorized'
  | 'forbidden'
  | 'not-found'
  | 'conflict'
  | 'exists'
  | 'invalid'
  | 'too-large'
  | 'rate-limited'
  | 'server-error';

export function json(
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
): NextResponse {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

export function fail(error: ApiError, status: number): NextResponse {
  return json({ error }, status);
}

export class HttpError extends Error {
  constructor(
    readonly code: ApiError,
    readonly status: number,
  ) {
    super(code);
  }
}

/** Reads a JSON body, enforcing content type and size. */
export async function readJson<T = Record<string, unknown>>(
  request: Request,
  maxBytes = 16 * 1024,
): Promise<T> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    throw new HttpError('bad-request', 415);
  }
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > maxBytes) throw new HttpError('too-large', 413);
  const text = await request.text();
  if (text.length > maxBytes) throw new HttpError('too-large', 413);
  try {
    const value = JSON.parse(text) as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error('not an object');
    return value as T;
  } catch {
    throw new HttpError('bad-request', 400);
  }
}

/** Blocks cross-site writes: the Origin header, when present, must match the Host. */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get('origin');
  if (!origin) return;
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  try {
    if (new URL(origin).host !== host) throw new HttpError('forbidden', 403);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError('forbidden', 403);
  }
}

export function clientKey(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'local'
  );
}

function cookieValue(request: Request, name: string): string | undefined {
  const header = request.headers.get('cookie') ?? '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

export function sessionToken(request: Request): string | undefined {
  return cookieValue(request, SESSION_COOKIE);
}

function secureCookies(request: Request): boolean {
  if (process.env.CAREWISH_INSECURE_COOKIES === 'true') return false;
  const proto =
    request.headers.get('x-forwarded-proto') ?? new URL(request.url).protocol.replace(':', '');
  return proto === 'https' || process.env.NODE_ENV === 'production';
}

export function sessionCookie(request: Request, token: string): string {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${SESSION_DAYS * 86400}`,
  ];
  if (secureCookies(request)) parts.push('Secure');
  return parts.join('; ');
}

export function clearSessionCookie(request: Request): string {
  const parts = [`${SESSION_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Strict', 'Max-Age=0'];
  if (secureCookies(request)) parts.push('Secure');
  return parts.join('; ');
}

export async function requireDb(): Promise<Db> {
  if (!accountsEnabled()) throw new HttpError('disabled', 404);
  return getDb();
}

export async function requireUser(request: Request): Promise<{ db: Db; user: SessionUser }> {
  const db = await requireDb();
  const user = await getSessionUser(db, sessionToken(request));
  if (!user) throw new HttpError('unauthorized', 401);
  return { db, user };
}

/** Wraps a route handler with uniform error handling. */
export function handler<A extends unknown[]>(
  fn: (request: Request, ...args: A) => Promise<Response>,
) {
  return async (request: Request, ...args: A): Promise<Response> => {
    try {
      return await fn(request, ...args);
    } catch (error) {
      if (error instanceof HttpError) return fail(error.code, error.status);
      console.error('[carewish] request failed', error);
      return fail('server-error', 500);
    }
  };
}

const B64U = /^[A-Za-z0-9_-]+$/;

export function isB64u(value: unknown, min: number, max: number): value is string {
  return (
    typeof value === 'string' && value.length >= min && value.length <= max && B64U.test(value)
  );
}
