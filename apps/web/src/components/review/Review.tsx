'use client';

import Link from 'next/link';
import { hasAgent } from '@/lib/answers';
import { planDocuments } from '@/lib/plan';
import { missingRequired } from '@/lib/steps';
import { Loading } from '@/components/ui/Fields';
import { useCopy } from '@/state/copy';
import { usePlan } from '@/state/plan';
import { SectionView } from './Blocks';

export function Review() {
  const { answers, ready } = usePlan();
  const { t } = useCopy();
  if (!ready) return <Loading label={t('common.loading')} />;

  const plan = planDocuments(answers);
  if (!plan) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16">
        <h1 className="text-3xl font-bold">{t('review.title')}</h1>
        <p className="mt-4 text-muted">{t('review.noState')}</p>
        <Link href="/plan/state" className="btn-primary mt-6">
          {t('review.start')}
        </Link>
      </div>
    );
  }
  const missing = missingRequired(answers);

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('review.title')}</h1>
      <p className="mt-3 text-lg text-muted">{t('review.intro')}</p>

      {missing.length > 0 && (
        <div className="mt-6 rounded-2xl border-2 border-warn bg-warn-soft p-5" role="alert">
          <h2 className="font-bold">{t('review.missingTitle')}</h2>
          <p className="mt-1">{t('review.missingBody')}</p>
          <ul className="mt-2 list-disc pl-6">
            {missing.map((s) => (
              <li key={s.id}>
                <Link className="link" href={`/plan/${s.id}`}>
                  {t(`steps.${s.id}.title`)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!hasAgent(answers) && (
        <p className="mt-6 rounded-2xl bg-surface-muted p-4 text-muted">
          {t('review.noAgent')}{' '}
          <Link className="link" href="/plan/agent">
            {t('common.edit')}
          </Link>
        </p>
      )}

      <h2 className="mt-10 text-sm font-bold uppercase tracking-wide text-brand">
        {t('review.documents')}
      </h2>
      <div className="mt-3 grid gap-6">
        {plan.documents.map((doc) => (
          <article key={doc.id} className="card" data-testid="review-document">
            <h3 className="text-2xl font-bold">{doc.title}</h3>
            <p className="mt-1 text-sm text-muted">{doc.citation}</p>
            {doc.parts.map((part) => (
              <section key={part.title} className="mt-6">
                <h4 className="mb-3 text-lg font-bold text-brand-strong">{part.title}</h4>
                {part.sections.map((s) => (
                  <SectionView key={s} section={s} answers={answers} />
                ))}
              </section>
            ))}
            {plan.appendixDocumentId === doc.id && plan.appendix.length > 0 && (
              <section className="mt-6">
                <h4 className="text-lg font-bold text-brand-strong">
                  {t('statements.appendixTitle')}
                </h4>
                <p className="mb-3 mt-1 text-sm text-muted">{t('statements.appendixIntro')}</p>
                {plan.appendix.map((s) => (
                  <SectionView key={s} section={s} answers={answers} />
                ))}
              </section>
            )}
          </article>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap justify-end gap-3">
        <Link
          href={missing.length ? `/plan/${missing[0]!.id}` : '/sign'}
          className="btn-primary"
          data-testid="to-sign"
        >
          {t('review.toSign')} <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
}
