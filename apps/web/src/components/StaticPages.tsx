'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { BUILD_NUMBER, COMMIT_SHA, REPO_URL, VERSION } from '@/lib/version';

export function About() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <h1 className="text-3xl font-bold">{t('about.title')}</h1>
      <div className="mt-5 grid gap-4 text-lg">
        <p>{t('about.body')}</p>
        <p>{t('about.standards')}</p>
        <p>{t('about.fonts')}</p>
        <p className="font-bold">{t('about.notAdvice')}</p>
        <ul className="grid gap-2">
          <li>
            <a className="link" href={REPO_URL} rel="noreferrer">
              {t('about.source')}
            </a>
          </li>
          <li>
            <a className="link" href={`${REPO_URL}/tree/main/packages/form-rules`} rel="noreferrer">
              {t('about.rules')}
            </a>
          </li>
        </ul>
        <p className="text-sm text-muted" data-testid="about-version">
          {t('about.version', { version: VERSION, build: BUILD_NUMBER, commit: COMMIT_SHA })}
        </p>
      </div>
    </div>
  );
}

export function Privacy() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <h1 className="text-3xl font-bold">{t('privacy.title')}</h1>
      <ul className="mt-5 grid gap-4 text-lg">
        {(['local', 'account', 'card', 'share', 'noTracking', 'delete'] as const).map((k) => (
          <li key={k} className="card">
            {t(`privacy.${k}`)}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function NotFoundView() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-2xl px-5 py-20 text-center">
      <h1 className="text-3xl font-bold">{t('notFound.title')}</h1>
      <Link href="/" className="btn-primary mt-8">
        {t('notFound.home')}
      </Link>
    </div>
  );
}
