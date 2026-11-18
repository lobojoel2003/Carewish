'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { resumeStep } from '@/lib/steps';
import { usePlan } from '@/state/plan';

const FEATURES = ['plain', 'state', 'rules', 'fhir', 'card', 'private'] as const;

const ICONS: Record<(typeof FEATURES)[number], string> = {
  plain: 'M4 6h16M4 12h10M4 18h7',
  state:
    'M12 21s-7-5.5-7-11a7 7 0 1 1 14 0c0 5.5-7 11-7 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  rules: 'M9 12l2 2 4-4M7 3h10l3 3v15H4V3h3Z',
  fhir: 'M4 7h16v10H4zM8 11h8M8 14h5',
  card: 'M3 6h18v12H3zM14 10h4v4h-4zM6 10h5M6 13h3',
  private: 'M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z',
};

export function Landing() {
  const { t } = useTranslation();
  const { answers, ready } = usePlan();
  const started = ready && Boolean(answers.state || answers.name);
  const href = started ? `/plan/${resumeStep(answers).id}` : '/plan/state';

  return (
    <div className="mx-auto max-w-5xl px-5">
      <section className="grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-[1.25fr_1fr]">
        <div>
          <p className="mb-4 inline-flex rounded-full bg-brand-soft px-3 py-1 text-sm font-bold text-brand-strong">
            {t('landing.eyebrow')}
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{t('landing.title')}</h1>
          <p className="mt-5 max-w-2xl text-lg text-muted">{t('landing.subtitle')}</p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href={href} className="btn-primary text-lg" data-testid="start">
              {started ? t('landing.resume') : t('landing.start')}
              <span aria-hidden="true">→</span>
            </Link>
          </div>
          <p className="mt-4 text-sm text-muted">{t('landing.time')}</p>
        </div>
        <aside className="card bg-brand-soft/60" aria-labelledby="what-title">
          <h2 id="what-title" className="text-xl font-bold">
            {t('landing.whatTitle')}
          </h2>
          <p className="mt-3 text-muted">{t('landing.whatBody')}</p>
          <div className="mt-6 border-t border-line pt-5">
            <p className="text-sm font-bold uppercase tracking-wide text-brand">
              {t('landing.statTitle')}
            </p>
            <p className="mt-2 text-lg font-bold">{t('landing.stat')}</p>
            <p className="mt-1 text-sm text-muted">{t('landing.statSource')}</p>
          </div>
        </aside>
      </section>

      <section aria-labelledby="features-title" className="pb-6">
        <h2 id="features-title" className="text-2xl font-bold">
          {t('landing.featuresTitle')}
        </h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <li key={f} className="card">
              <svg
                viewBox="0 0 24 24"
                className="h-8 w-8 text-brand"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d={ICONS[f]} />
              </svg>
              <h3 className="mt-3 text-lg font-bold">{t(`landing.features.${f}.title`)}</h3>
              <p className="mt-1.5 text-muted">{t(`landing.features.${f}.body`)}</p>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-sm text-muted">{t('landing.disclaimer')}</p>
      </section>
    </div>
  );
}
