'use client';

import { isStateCode } from '@carewish/form-rules';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { sanitizeAnswers, type Answers } from '@/lib/answers';
import { api, ApiError } from '@/lib/api';
import {
  KDF_ITERATIONS,
  deriveKeys,
  importShareKey,
  newSalt,
  newShareKey,
  normalizeEmail,
  openJson,
  sealBytes,
  sealJson,
  type Sealed,
} from '@/lib/crypto';
import { deleteKey, deleteMeta, getMeta, loadKey, saveKey, setMeta } from '@/lib/storage';
import { usePlan } from './plan';

const VAULT_AAD = 'carewish/vault/v1';
export const SHARE_AAD = 'carewish/share/v1';

export interface ShareLink {
  id: string;
  key: string;
  updatedAt?: string;
}

type Status = 'disabled' | 'loading' | 'signed-out' | 'signed-in';

interface AccountContextValue {
  enabled: boolean;
  status: Status;
  email?: string;
  lastSync?: string;
  share?: ShareLink;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<'restored' | 'pushed' | 'empty'>;
  signOut: () => Promise<void>;
  sync: () => Promise<void>;
  restore: () => Promise<boolean>;
  saveShare: (payload: Uint8Array) => Promise<ShareLink>;
  deleteShare: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AccountContext = createContext<AccountContextValue | null>(null);

interface VaultPayload {
  answers: Answers;
  share?: ShareLink;
}

export function AccountProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const { answers, ready, replace } = usePlan();
  const [status, setStatus] = useState<Status>(enabled ? 'loading' : 'disabled');
  const [email, setEmail] = useState<string>();
  const [lastSync, setLastSync] = useState<string>();
  const [share, setShare] = useState<ShareLink>();
  const key = useRef<CryptoKey | undefined>(undefined);
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const shareRef = useRef(share);
  shareRef.current = share;

  // restore a session on load
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      try {
        const session = await api<{ email: string }>('/api/auth/session');
        const stored = await loadKey('vault');
        if (!stored) {
          await api('/api/auth/logout', { method: 'POST', body: {} }).catch(() => undefined);
          if (!cancelled) setStatus('signed-out');
          return;
        }
        key.current = stored;
        const [sync, link] = await Promise.all([
          getMeta<string>('lastSync'),
          getMeta<ShareLink>('share'),
        ]);
        if (cancelled) return;
        setEmail(session.email);
        setLastSync(sync);
        setShare(link);
        setStatus('signed-in');
      } catch {
        if (!cancelled) setStatus('signed-out');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const pull = useCallback(async (): Promise<{
    payload: VaultPayload;
    revision: number;
    updatedAt: string;
  } | null> => {
    try {
      const remote = await api<Sealed & { revision: number; updatedAt: string }>('/api/vault');
      const payload = await openJson<VaultPayload>(key.current!, remote, VAULT_AAD);
      const clean = sanitizeAnswers(payload.answers, isStateCode);
      if (!clean) return null;
      return {
        payload: { answers: clean, share: payload.share },
        revision: remote.revision,
        updatedAt: remote.updatedAt,
      };
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  }, []);

  const push = useCallback(
    async (revision: number): Promise<{ revision: number; updatedAt: string }> => {
      const sealed = await sealJson(
        key.current!,
        { answers: answersRef.current, share: shareRef.current } satisfies VaultPayload,
        VAULT_AAD,
      );
      return api('/api/vault', { method: 'PUT', body: { ...sealed, baseRevision: revision } });
    },
    [],
  );

  const recordSync = useCallback(async (revision: number, at: string) => {
    await Promise.all([setMeta('vaultRevision', revision), setMeta('lastSync', at)]);
    setLastSync(at);
  }, []);

  const adopt = useCallback(
    async (payload: VaultPayload) => {
      replace(payload.answers);
      if (payload.share) {
        setShare(payload.share);
        await setMeta('share', payload.share);
      }
    },
    [replace],
  );

  const sync = useCallback(async () => {
    if (!key.current) return;
    const base = (await getMeta<number>('vaultRevision')) ?? 0;
    try {
      const result = await push(base);
      await recordSync(result.revision, result.updatedAt);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 409) throw error;
      // someone else saved first: keep whichever copy is newer
      const remote = await pull();
      if (!remote) throw error;
      const remoteTime = Date.parse(remote.payload.answers.updatedAt ?? '') || 0;
      const localTime = Date.parse(answersRef.current.updatedAt ?? '') || 0;
      if (remoteTime > localTime) {
        await adopt(remote.payload);
        await recordSync(remote.revision, remote.updatedAt);
      } else {
        const result = await push(remote.revision);
        await recordSync(result.revision, result.updatedAt);
      }
    }
  }, [adopt, pull, push, recordSync]);

  // keep the account copy current while signed in
  useEffect(() => {
    if (status !== 'signed-in' || !ready) return;
    const handle = setTimeout(() => void sync().catch(() => undefined), 1500);
    return () => clearTimeout(handle);
  }, [answers.updatedAt, status, ready, sync]);

  const begin = useCallback(async (vaultKey: CryptoKey, mail: string) => {
    key.current = vaultKey;
    await saveKey('vault', vaultKey);
    setEmail(mail);
    setStatus('signed-in');
  }, []);

  const signUp = useCallback(
    async (rawEmail: string, password: string) => {
      const mail = normalizeEmail(rawEmail);
      const salt = newSalt();
      const keys = await deriveKeys(password, salt, KDF_ITERATIONS);
      await api('/api/auth/register', {
        body: { email: mail, salt, iterations: KDF_ITERATIONS, authKey: keys.authKey },
      });
      await setMeta('vaultRevision', 0);
      await begin(keys.vaultKey, mail);
      await sync();
    },
    [begin, sync],
  );

  const signIn = useCallback(
    async (rawEmail: string, password: string) => {
      const mail = normalizeEmail(rawEmail);
      const params = await api<{ salt: string; iterations: number }>('/api/auth/params', {
        body: { email: mail },
      });
      const keys = await deriveKeys(password, params.salt, params.iterations);
      await api('/api/auth/login', { body: { email: mail, authKey: keys.authKey } });
      await begin(keys.vaultKey, mail);
      const remote = await pull();
      if (!remote) {
        await setMeta('vaultRevision', 0);
        await sync();
        return 'empty' as const;
      }
      const remoteTime = Date.parse(remote.payload.answers.updatedAt ?? '') || 0;
      const localTime = Date.parse(answersRef.current.updatedAt ?? '') || 0;
      const localEmpty = !answersRef.current.name && !answersRef.current.state;
      if (localEmpty || remoteTime >= localTime) {
        await adopt(remote.payload);
        await recordSync(remote.revision, remote.updatedAt);
        return 'restored' as const;
      }
      await recordSync(remote.revision, remote.updatedAt);
      await sync();
      return 'pushed' as const;
    },
    [adopt, begin, pull, recordSync, sync],
  );

  const restore = useCallback(async () => {
    const remote = await pull();
    if (!remote) return false;
    await adopt(remote.payload);
    await recordSync(remote.revision, remote.updatedAt);
    return true;
  }, [adopt, pull, recordSync]);

  const forget = useCallback(async () => {
    key.current = undefined;
    await Promise.all([
      deleteKey('vault'),
      deleteMeta('vaultRevision'),
      deleteMeta('lastSync'),
      deleteMeta('share'),
    ]);
    setEmail(undefined);
    setLastSync(undefined);
    setShare(undefined);
    setStatus('signed-out');
  }, []);

  const signOut = useCallback(async () => {
    await api('/api/auth/logout', { method: 'POST', body: {} }).catch(() => undefined);
    await forget();
  }, [forget]);

  const saveShare = useCallback(
    async (payload: Uint8Array) => {
      const existing = shareRef.current;
      const { key: shareKey, raw } = existing
        ? { key: await importShareKey(existing.key), raw: existing.key }
        : await newShareKey();
      const sealed = await sealBytes(shareKey, payload, SHARE_AAD);
      const result = await api<{ id: string; updatedAt: string }>('/api/shares', {
        body: { ...sealed, keepId: Boolean(existing) },
      });
      const link: ShareLink = { id: result.id, key: raw, updatedAt: result.updatedAt };
      setShare(link);
      shareRef.current = link;
      await setMeta('share', link);
      await sync().catch(() => undefined);
      return link;
    },
    [sync],
  );

  const deleteShare = useCallback(async () => {
    await api('/api/shares', { method: 'DELETE' });
    setShare(undefined);
    shareRef.current = undefined;
    await deleteMeta('share');
    await sync().catch(() => undefined);
  }, [sync]);

  const deleteAccount = useCallback(async () => {
    await api('/api/account', { method: 'DELETE' });
    await forget();
  }, [forget]);

  const value = useMemo(
    () => ({
      enabled,
      status,
      email,
      lastSync,
      share,
      signUp,
      signIn,
      signOut,
      sync,
      restore,
      saveShare,
      deleteShare,
      deleteAccount,
    }),
    [
      enabled,
      status,
      email,
      lastSync,
      share,
      signUp,
      signIn,
      signOut,
      sync,
      restore,
      saveShare,
      deleteShare,
      deleteAccount,
    ],
  );
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountContextValue {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error('useAccount must be used inside AccountProvider');
  return ctx;
}
