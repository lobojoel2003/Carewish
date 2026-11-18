'use client';

import { agentTerm, getState } from '@carewish/form-rules';
import type { CardSummary } from '@/lib/card';
import { formatDate } from '@/lib/statements';
import { useCopy } from '@/state/copy';

/** Read-only emergency summary, shown when someone scans a wallet card. */
export function Summary({ summary }: { summary: CardSummary }) {
  const { t, lang } = useCopy();
  const state = summary.s ? getState(summary.s) : undefined;
  const agent = state ? agentTerm(state, lang) : t('rules:agentTerm.agent');
  const w = summary.w ?? {};
  const rows: [string, string | undefined][] = [
    [t('statements.terminalIntro'), w.t && t(`statements.treatment.${w.t}`, { agent })],
    [t('statements.unconsciousIntro'), w.u && t(`statements.treatment.${w.u}`, { agent })],
    [t('statements.advancedIllnessIntro'), w.i && t(`statements.treatment.${w.i}`, { agent })],
    [t('statements.nutritionIntro'), w.f && t(`statements.nutrition.${w.f}`, { agent })],
    [t('statements.cprIntro'), w.c && t(`statements.cpr.${w.c}`, { agent })],
    [t('statements.painIntro'), w.p && t(`statements.pain.${w.p}`, { agent })],
    [t('statements.organIntro'), w.o && t(`statements.organ.${w.o}`, { agent, detail: '' })],
  ];
  return (
    <div className="mx-auto max-w-2xl px-5 py-10" data-testid="card-summary">
      <p className="text-sm font-bold uppercase tracking-wide text-brand">{t('card.title')}</p>
      <h1 className="mt-2 text-3xl font-bold">{t('card.subtitle', { name: summary.n })}</h1>
      <p className="mt-2 text-muted">
        {[
          summary.b ? t('card.born', { date: formatDate(summary.b, lang) }) : '',
          state
            ? t('card.stateLine', { state: state.name, date: formatDate(summary.d, lang) })
            : '',
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>

      {summary.a && summary.a.length > 0 && (
        <section className="card mt-6">
          <h2 className="text-lg font-bold">{t('card.agentLabel', { agent })}</h2>
          <ul className="mt-3 grid gap-3">
            {summary.a.map((p, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-3">
                <span>
                  <span className="block text-xl font-bold">{p.n}</span>
                  {i > 0 && <span className="text-sm text-muted">{t('card.backup')}</span>}
                  {p.r && <span className="text-sm text-muted"> · {t(`relationship.${p.r}`)}</span>}
                </span>
                {p.p && (
                  <a href={`tel:${p.p.replace(/[^\d+]/g, '')}`} className="btn-primary">
                    {t('card.call', { name: p.n.split(' ')[0] })} · {p.p}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card mt-6">
        <h2 className="text-lg font-bold">{t('card.wishes')}</h2>
        <dl className="mt-3 grid gap-4">
          {rows
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k}>
                <dt className="font-bold">{k}</dt>
                <dd className="mt-0.5 pl-4">{v}</dd>
              </div>
            ))}
        </dl>
      </section>
      <p className="mt-6 rounded-2xl bg-warn-soft p-4">{t('card.notOriginal', { agent })}</p>
    </div>
  );
}
