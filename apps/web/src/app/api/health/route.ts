import { accountsEnabled, getDb } from '@/server/db';
import { json } from '@/server/http';
import { buildInfo } from '@/lib/version';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  let database: 'disabled' | 'ok' | 'error' = 'disabled';
  if (accountsEnabled()) {
    try {
      await (await getDb()).query('SELECT 1');
      database = 'ok';
    } catch {
      database = 'error';
    }
  }
  const status = database === 'error' ? 'degraded' : 'ok';
  return json(
    { status, ...buildInfo, accounts: accountsEnabled(), database },
    status === 'ok' ? 200 : 503,
  );
}
