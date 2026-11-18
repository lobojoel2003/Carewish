'use client';

import { useState, type FormEvent } from 'react';
import { ApiError } from '@/lib/api';
import { MIN_PASSWORD_LENGTH, isValidEmail } from '@/lib/crypto';
import { Loading, TextField } from '@/components/ui/Fields';
import { useAccount } from '@/state/account';
import { useCopy } from '@/state/copy';

function errorKey(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'account.errors.invalid';
    if (error.status === 409) return 'account.errors.exists';
    if (error.status === 429) return 'account.errors.rate';
  }
  return 'account.errors.generic';
}

function AuthForm() {
  const account = useAccount();
  const { t, lang } = useCopy();
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-up');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string>();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(undefined);
    if (!isValidEmail(email)) return setError(t('account.errors.email'));
    if (password.length < MIN_PASSWORD_LENGTH) return setError(t('account.errors.weak'));
    if (mode === 'sign-up' && !confirm) return setError(t('account.errors.confirm'));
    setBusy(true);
    try {
      if (mode === 'sign-up') {
        await account.signUp(email, password);
        setNotice(t('account.synced'));
      } else {
        const result = await account.signIn(email, password);
        setNotice(result === 'restored' ? t('account.restored') : t('account.synced'));
      }
      setPassword('');
    } catch (err) {
      setError(t(errorKey(err)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="card grid gap-5" lang={lang}>
      <h2 className="text-2xl font-bold">
        {mode === 'sign-up' ? t('account.signUp') : t('account.signIn')}
      </h2>
      <TextField
        label={t('account.email')}
        type="email"
        value={email}
        onChange={setEmail}
        autoComplete="email"
        data-testid="account-email"
      />
      <TextField
        label={t('account.password')}
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
        hint={mode === 'sign-up' ? t('account.passwordHint') : undefined}
        data-testid="account-password"
      />
      {mode === 'sign-up' && (
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 h-5 w-5 accent-[var(--brand)]"
            checked={confirm}
            onChange={(e) => setConfirm(e.target.checked)}
            data-testid="account-confirm"
          />
          <span>{t('account.confirm')}</span>
        </label>
      )}
      {error && (
        <p role="alert" className="font-bold text-bad">
          {error}
        </p>
      )}
      {notice && <p className="font-bold text-ok">{notice}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="submit" className="btn-primary" disabled={busy} data-testid="account-submit">
          {busy
            ? t('account.working')
            : mode === 'sign-up'
              ? t('account.signUp')
              : t('account.signIn')}
        </button>
        <button
          type="button"
          className="btn-quiet"
          onClick={() => setMode(mode === 'sign-up' ? 'sign-in' : 'sign-up')}
        >
          {mode === 'sign-up' ? t('account.haveAccount') : t('account.needAccount')}
        </button>
      </div>
    </form>
  );
}

function SignedIn() {
  const account = useAccount();
  const { t, lang } = useCopy();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    setMessage(undefined);
    try {
      const result = await fn();
      setMessage({ ok: result !== false, text: result === false ? t('account.noVault') : ok });
    } catch (err) {
      setMessage({ ok: false, text: t(errorKey(err)) });
    } finally {
      setBusy(false);
    }
  };
  const time = account.lastSync
    ? new Intl.DateTimeFormat(lang === 'es' ? 'es-US' : 'en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(account.lastSync))
    : undefined;

  return (
    <div className="grid gap-6">
      <section className="card">
        <p className="font-bold" data-testid="signed-in-as">
          {t('account.signedInAs', { email: account.email })}
        </p>
        <p className="mt-1 text-muted">
          {time ? t('account.lastSync', { time }) : t('account.neverSynced')}
        </p>
        {account.share && <p className="mt-1 text-muted">{t('account.shareActive')}</p>}
        {message && (
          <p role="status" className={`mt-3 font-bold ${message.ok ? 'text-ok' : 'text-bad'}`}>
            {message.text}
          </p>
        )}
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            className="btn-primary"
            disabled={busy}
            onClick={() => act(account.sync, t('account.synced'))}
            data-testid="sync-now"
          >
            {t('account.syncNow')}
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={busy}
            onClick={() => act(account.restore, t('account.restored'))}
          >
            {t('account.restore')}
          </button>
          <button
            type="button"
            className="btn-quiet"
            disabled={busy}
            onClick={() => act(account.signOut, '')}
          >
            {t('account.signOut')}
          </button>
        </div>
      </section>
      <section className="rounded-3xl border-2 border-dashed border-line p-6">
        <h2 className="text-xl font-bold">{t('account.deleteTitle')}</h2>
        <p className="mt-2 text-muted">{t('account.deleteBody')}</p>
        <button
          type="button"
          className="btn-danger mt-4"
          disabled={busy}
          onClick={() =>
            window.confirm(t('account.deleteConfirm')) && act(account.deleteAccount, '')
          }
        >
          {t('account.deleteButton')}
        </button>
      </section>
    </div>
  );
}

export function Account() {
  const account = useAccount();
  const { t } = useCopy();
  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-14">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('account.title')}</h1>
      {account.status === 'disabled' ? (
        <p className="mt-4 text-lg text-muted">{t('account.disabled')}</p>
      ) : (
        <>
          <p className="mt-3 text-lg text-muted">{t('account.intro')}</p>
          <p className="mt-4 rounded-2xl border-l-4 border-accent bg-surface-muted p-4">
            {t('account.e2ee')}
          </p>
          <div className="mt-6">
            {account.status === 'loading' ? (
              <Loading label={t('common.loading')} />
            ) : account.status === 'signed-in' ? (
              <SignedIn />
            ) : (
              <AuthForm />
            )}
          </div>
        </>
      )}
    </div>
  );
}
