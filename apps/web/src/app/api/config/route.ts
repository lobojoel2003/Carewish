import { accountsEnabled } from '@/server/db';
import { json } from '@/server/http';

export const dynamic = 'force-dynamic';

export function GET(): Response {
  return json({ accounts: accountsEnabled() });
}
