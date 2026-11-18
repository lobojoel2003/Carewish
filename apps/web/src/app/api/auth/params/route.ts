import { KDF_ITERATIONS, decoySalt, findUser } from '@/server/auth';
import { normalizeEmail, isValidEmail } from '@/lib/crypto';
import {
  HttpError,
  assertSameOrigin,
  clientKey,
  handler,
  json,
  readJson,
  requireDb,
} from '@/server/http';
import { authLimiter } from '@/server/rate-limit';

export const dynamic = 'force-dynamic';

/** Returns the KDF parameters for an email. Unknown emails get stable decoy values. */
export const POST = handler(async (request) => {
  assertSameOrigin(request);
  if (!authLimiter.allow(`params:${clientKey(request)}`)) throw new HttpError('rate-limited', 429);
  const db = await requireDb();
  const body = await readJson<{ email?: unknown }>(request);
  if (typeof body.email !== 'string' || !isValidEmail(body.email))
    throw new HttpError('invalid', 400);
  const email = normalizeEmail(body.email);
  const user = await findUser(db, email);
  return json(
    user
      ? { salt: user.kdf_salt, iterations: user.kdf_iterations }
      : { salt: decoySalt(email), iterations: KDF_ITERATIONS },
  );
});
