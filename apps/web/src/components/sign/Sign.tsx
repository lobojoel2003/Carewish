'use client';

import {
  RELATIONSHIPS,
  RELATIONSHIP_DERIVED,
  describeAttribute,
  describeStep,
  evaluateWitnesses,
  localize,
  signingChecklist,
  signingSummary,
  translate,
  witnessQuestions,
  type DocumentRules,
  type Relationship,
  type StateRules,
  type WitnessAttribute,
  type WitnessEvaluation,
} from '@carewish/form-rules';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { Answers, WitnessDraft } from '@/lib/answers';
import { planDocuments } from '@/lib/plan';
import { Loading, Select, TextField } from '@/components/ui/Fields';
import { useCopy } from '@/state/copy';
import { usePlan } from '@/state/plan';

const LIKELY_HEIRS = new Set<Relationship>(['spouse', 'child', 'parent', 'sibling', 'grandchild']);

function newWitness(): WitnessDraft {
  return {
    id: Math.random().toString(36).slice(2, 10),
    name: '',
    relationship: 'none',
    attributes: [],
  };
}

/** Attributes implied by what the person already told us (e.g. the witness *is* their agent). */
function withKnownFacts(w: WitnessDraft, a: Answers): WitnessDraft {
  const name = w.name.trim().toLowerCase();
  const agents = [a.agent?.name, a.alternate?.name]
    .map((n) => n?.trim().toLowerCase())
    .filter(Boolean);
  if (name && agents.includes(name) && !w.attributes.includes('agent')) {
    return { ...w, attributes: [...w.attributes, 'agent'] };
  }
  return w;
}

function MethodBadge({ doc }: { doc: DocumentRules }) {
  const { lang } = useCopy();
  const s = signingSummary(doc);
  return (
    <span className="badge bg-brand-soft text-brand-strong" data-testid="method-badge">
      {translate(lang, `methodShort.${doc.execution.method}`, { count: s.witnesses })}
    </span>
  );
}

function Checklist({ doc, state }: { doc: DocumentRules; state: StateRules }) {
  const { lang } = useCopy();
  return (
    <ol className="grid gap-4">
      {signingChecklist(doc).map((step, i) => {
        const lines = describeStep(step, state, lang);
        return (
          <li key={i} className="flex gap-4">
            <span
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-brand-ink"
              aria-hidden="true"
            >
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              {lines.map((line, j) =>
                line.startsWith('• ') ? (
                  <p key={j} className="ml-1 flex gap-2 text-[0.98rem]">
                    <span aria-hidden="true" className="text-brand">
                      •
                    </span>
                    {line.slice(2)}
                  </p>
                ) : (
                  <p key={j} className={j === 0 ? 'font-bold' : 'mt-2 text-muted'}>
                    {line}
                  </p>
                ),
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function EvaluationView({
  evaluation,
  doc,
  state,
  witnesses,
}: {
  evaluation: WitnessEvaluation;
  doc: DocumentRules;
  state: StateRules;
  witnesses: WitnessDraft[];
}) {
  const { t, lang } = useCopy();
  if (!evaluation.required) return <p className="text-muted">{t('sign.noWitnessNeeded')}</p>;
  const attr = (a: WitnessAttribute) => describeAttribute(a, state, lang);
  return (
    <div className="grid gap-3" aria-live="polite" data-testid={`evaluation-${doc.id}`}>
      <p className="font-bold">{doc.title}</p>
      <ul className="grid gap-2">
        {evaluation.witnesses.map((w) => (
          <li
            key={w.index}
            className={`rounded-xl px-4 py-3 ${w.ok ? 'bg-ok-soft' : 'bg-bad-soft'}`}
          >
            <p className={`font-bold ${w.ok ? 'text-ok' : 'text-bad'}`}>
              {w.ok ? '✓' : '✕'}{' '}
              {witnesses[w.index]?.name || t('sign.witnessN', { n: w.index + 1 })}:{' '}
              {w.ok ? t('sign.status.ok') : t('sign.status.problem')}
            </p>
            {w.problems.map((p, i) =>
              p.kind === 'too-young' ? (
                <p key={i}>{translate(lang, 'evaluation.tooYoung', { minAge: p.minAge })}</p>
              ) : (
                <div key={i}>
                  <p>{translate(lang, 'evaluation.cannotBe')}</p>
                  <ul className="list-disc pl-6">
                    {p.attributes.map((a) => (
                      <li key={a}>{attr(a)}</li>
                    ))}
                  </ul>
                </div>
              ),
            )}
          </li>
        ))}
      </ul>
      {evaluation.groupProblems.map((g, i) => (
        <div key={i} className="rounded-xl bg-bad-soft px-4 py-3">
          <p className="font-bold text-bad">
            {translate(
              lang,
              g.kind === 'too-many' ? 'evaluation.onlyOne' : 'evaluation.needOneWho',
            )}
          </p>
          <ul className="list-disc pl-6">
            {g.attributes.map((a) => (
              <li key={a}>{attr(a)}</li>
            ))}
          </ul>
        </div>
      ))}
      {evaluation.hints.map((h, i) => (
        <div key={i} className="rounded-xl bg-warn-soft px-4 py-3">
          <p className="font-bold">{translate(lang, 'evaluation.hintOther')}</p>
          <ul className="list-disc pl-6">
            {h.attributes.map((a) => (
              <li key={a}>{attr(a)}</li>
            ))}
          </ul>
        </div>
      ))}
      {evaluation.missing > 0 ? (
        <p className="font-bold text-warn">
          {translate(lang, 'evaluation.missing', { count: evaluation.missing })}
        </p>
      ) : (
        evaluation.ok && (
          <p className="font-bold text-ok">
            ✓ {translate(lang, 'evaluation.ok', { state: state.name })}
          </p>
        )
      )}
    </div>
  );
}

function WitnessChecker({ docs, state }: { docs: DocumentRules[]; state: StateRules }) {
  const { answers, update } = usePlan();
  const { t, lang, agent } = useCopy();
  const witnessDocs = docs.filter((d) => evaluateWitnesses(d.execution, []).required);
  const questions = useMemo(() => {
    const qs = witnessDocs.map((d) => witnessQuestions(d.execution));
    return {
      askRelationship: qs.some((q) => q.askRelationship),
      attributes: [...new Set(qs.flatMap((q) => q.attributes))],
    };
  }, [witnessDocs]);
  const maxCount = Math.max(0, ...witnessDocs.map((d) => d.execution.witnesses?.count ?? 0));
  const [placeholders] = useState(() => Array.from({ length: 3 }, newWitness));
  const witnesses = (
    answers.witnesses?.length ? answers.witnesses : placeholders.slice(0, maxCount)
  ).slice(0, 3);

  if (witnessDocs.length === 0) return null;

  const save = (list: WitnessDraft[]) => update({ witnesses: list });
  const change = (i: number, patch: Partial<WitnessDraft>) => {
    const list = witnesses.map((w, j) => {
      if (j !== i) return w;
      const next = { ...w, ...patch };
      return patch.name !== undefined ? withKnownFacts(next, answers) : next;
    });
    save(list);
  };
  const setRelationship = (i: number, relationship: Relationship) => {
    const w = witnesses[i]!;
    let attributes = w.attributes;
    if (
      LIKELY_HEIRS.has(relationship) &&
      questions.attributes.includes('heir') &&
      !attributes.includes('heir')
    ) {
      attributes = [...attributes, 'heir'];
    }
    change(i, { relationship, attributes });
  };

  const candidates = witnesses
    .filter((w) => w.name.trim())
    .map((w) => ({ name: w.name, relationship: w.relationship, attributes: w.attributes }));

  return (
    <section className="card" aria-labelledby="checker-title" data-testid="witness-checker">
      <h2 id="checker-title" className="text-2xl font-bold">
        {t('sign.checkerTitle')}
      </h2>
      <p className="mt-2 text-muted">{t('sign.checkerIntro')}</p>
      <p className="mt-1 text-sm text-muted">{t('sign.checkerPrivacy')}</p>

      <div className="mt-6 grid gap-6">
        {witnesses.map((w, i) => (
          <fieldset key={w.id} className="rounded-2xl border-2 border-line p-5">
            <legend className="px-2 text-lg font-bold">{t('sign.witnessN', { n: i + 1 })}</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label={t('sign.witnessName')}
                value={w.name}
                onChange={(v) => change(i, { name: v })}
                autoComplete="off"
                data-testid={`witness-name-${i}`}
              />
              {questions.askRelationship && (
                <Select
                  label={t('sign.relationship')}
                  value={w.relationship}
                  onChange={(v) => setRelationship(i, v as Relationship)}
                  options={RELATIONSHIPS.map((r) => ({
                    value: r,
                    label: t(`rules:relationship.${r}`),
                  }))}
                />
              )}
            </div>
            {questions.attributes.length > 0 && (
              <div className="mt-4">
                <p className="font-bold">{t('sign.checkAll')}</p>
                <div className="mt-2 grid gap-2">
                  {questions.attributes
                    .filter((a) => !RELATIONSHIP_DERIVED.has(a))
                    .map((a) => (
                      <label
                        key={a}
                        className="flex cursor-pointer items-start gap-3 rounded-xl px-2 py-1.5 hover:bg-surface-muted"
                      >
                        <input
                          type="checkbox"
                          className="mt-1 h-5 w-5 shrink-0 accent-[var(--brand)]"
                          checked={w.attributes.includes(a)}
                          onChange={(e) =>
                            change(i, {
                              attributes: e.target.checked
                                ? [...w.attributes, a]
                                : w.attributes.filter((x) => x !== a),
                            })
                          }
                        />
                        <span>{translate(lang, `attributeQuestion.${a}`, { agent })}</span>
                      </label>
                    ))}
                </div>
              </div>
            )}
            {witnesses.length > 1 && (
              <button
                type="button"
                className="btn-quiet mt-3 px-0 text-sm"
                onClick={() => save(witnesses.filter((_, j) => j !== i))}
              >
                {t('common.remove')}
              </button>
            )}
          </fieldset>
        ))}
      </div>
      {witnesses.length < 3 && (
        <button
          type="button"
          className="btn-secondary mt-4"
          onClick={() => save([...witnesses, newWitness()])}
        >
          + {t('sign.addWitness')}
        </button>
      )}

      <div className="mt-6 grid gap-6 border-t border-line pt-6">
        {witnessDocs.map((doc) => (
          <EvaluationView
            key={doc.id}
            doc={doc}
            state={state}
            evaluation={evaluateWitnesses(doc.execution, candidates)}
            witnesses={witnesses.filter((w) => w.name.trim())}
          />
        ))}
      </div>
    </section>
  );
}

export function Sign() {
  const { answers, ready } = usePlan();
  const { t, lang } = useCopy();
  if (!ready) return <Loading label={t('common.loading')} />;
  const plan = planDocuments(answers);
  if (!plan) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16">
        <p className="text-muted">{t('review.noState')}</p>
        <Link href="/plan/state" className="btn-primary mt-6">
          {t('review.start')}
        </Link>
      </div>
    );
  }
  const { state, documents } = plan;
  const sameMethod =
    documents.length > 1 &&
    documents.every((d) => JSON.stringify(d.execution) === JSON.stringify(documents[0]!.execution));

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('sign.title')}</h1>
      <p className="mt-3 text-lg text-muted">{t('sign.intro')}</p>
      {sameMethod && <p className="mt-3 font-bold">{t('sign.same')}</p>}

      <div className="mt-8 grid gap-6">
        {documents.map((doc, i) => (
          <article key={doc.id} className="card" data-testid="sign-document">
            {documents.length > 1 && (
              <p className="text-sm font-bold uppercase tracking-wide text-brand">
                {t('sign.document', { n: i + 1, total: documents.length })}
              </p>
            )}
            <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
              <h2 className="text-2xl font-bold">{doc.title}</h2>
              <MethodBadge doc={doc} />
            </div>
            <p className="mt-1 text-sm text-muted">{doc.citation}</p>
            <div className="mt-6">
              <Checklist doc={doc} state={state} />
            </div>
          </article>
        ))}

        <WitnessChecker docs={documents} state={state} />

        {state.notes && state.notes.length > 0 && (
          <section className="card">
            <h2 className="text-xl font-bold">{t('sign.notesTitle')}</h2>
            <ul className="mt-3 grid list-disc gap-2 pl-6">
              {state.notes.map((n, i) => (
                <li key={i}>{localize(n, lang)}</li>
              ))}
            </ul>
          </section>
        )}

        <section className="card">
          <h2 className="text-xl font-bold">{t('sign.afterTitle')}</h2>
          <ul className="mt-3 grid list-disc gap-2 pl-6">
            {(['copies', 'original', 'record', 'card', 'review'] as const).map((k) => (
              <li key={k}>{t(`sign.after.${k}`)}</li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl bg-surface-muted p-5 text-sm text-muted">
          <h2 className="font-bold text-ink">{t('sign.lawTitle')}</h2>
          <p className="mt-1">{t('sign.rulesDraft')}</p>
          <p className="mt-2">
            {t('sign.rulesChecked', {
              date: new Intl.DateTimeFormat(lang === 'es' ? 'es-US' : 'en-US', {
                dateStyle: 'long',
                timeZone: 'UTC',
              }).format(new Date(state.review.lastChecked)),
              sources: state.sources.map((s) => s.citation).join('; '),
            })}
          </p>
        </section>
      </div>

      <div className="mt-10 flex justify-end">
        <Link href="/export" className="btn-primary" data-testid="to-export">
          {t('sign.toExport')} <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
}
