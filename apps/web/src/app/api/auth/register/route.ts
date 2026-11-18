import { KDF_ITERATIONS, createSession, createUser } from '@/server/auth';
import { isValidEmail, normalizeEmail } from '@/lib/crypto';
import {
  HttpError,
  assertSameOrigin,
  clientKey,
  handler,
  isB64u,
  json,
  readJson,
  requireDb,
  sessionCookie,
} from '@/server/http';
import { authLimiter } from '@/server/rate-limit';

export const dynamic = 'force-dynamic';

export const POST = handler(async (request) => {
  assertSameOrigin(request);
  if (!authLimiter.allow(`register:${clientKey(request)}`))
    throw new HttpError('rate-limited', 429);
  const db = await requireDb();
  const body = await readJson<{
    email?: unknown;
    salt?: unknown;
    iterations?: unknown;
    authKey?: unknown;
  }>(request);
  if (typeof body.email !== 'string' || !isValidEmail(body.email))
    throw new HttpError('invalid', 400);
  if (!isB64u(body.salt, 22, 64) || !isB64u(body.authKey, 43, 43))
    throw new HttpError('invalid', 400);
  if (
    typeof body.iterations !== 'number' ||
    !Number.isInteger(body.iterations) ||
    body.iterations < KDF_ITERATIONS ||
    body.iterations > 10_000_000
  ) {
    throw new HttpError('invalid', 400);
  }
  const email = normalizeEmail(body.email);
  const userId = await createUser(db, {
    email,
    salt: body.salt,
    iterations: body.iterations,
    authKey: body.authKey,
  });
  if (!userId) throw new HttpError('exists', 409);
  const token = await createSession(db, userId);
  return json({ email }, 201, { 'Set-Cookie': sessionCookie(request, token) });
});
