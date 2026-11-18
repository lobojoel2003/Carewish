'use client';

import { getState } from '@carewish/form-rules';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ageOn, type Answers, type Person } from '@/lib/answers';
import { GROUPS, neighbors, optionsFor, type StepDef } from '@/lib/steps';
import { Loading, TextArea, TextField, WhyNote } from '@/components/ui/Fields';
import { useCopy } from '@/state/copy';
import { usePlan } from '@/state/plan';
import {
  AddressInput,
  ChoiceInput,
  DateInput,
  OrganInput,
  PersonInput,
  PhysicianInput,
  StateInput,
  ValuesInput,
} from './inputs';

type Errors = Record<string, string | undefined>;

function validate(
  step: StepDef,
  a: Answers,
  t: (k: string, p?: Record<string, unknown>) => string,
): Errors {
  const errors: Errors = {};
  const person = (p: Person | undefined, prefix: string) => {
    if (p?.name?.trim() && !p.phone?.trim()) errors[`${prefix}.phone`] = t('wizard.required');
  };
  switch (step.id) {
    case 'state':
      if (!a.state) errors.main = t('wizard.required');
      break;
    case 'name':
      if (!a.name?.trim()) errors.main = t('wizard.required');
      break;
    case 'birthdate': {
      if (!a.birthDate) {
        errors.main = t('wizard.invalidDate');
        break;
      }
      const age = ageOn(a.birthDate);
      const state = a.state ? getState(a.state) : undefined;
      if (age === undefined) errors.main = t('wizard.invalidDate');
      else if (age < 0) errors.main = t('wizard.futureDate');
      else if (age > 125) errors.main = t('wizard.invalidDate');
      else if (state && age < state.adultAge)
        errors.main = t('wizard.tooYoung', { age: state.adultAge });
      break;
    }
    case 'agent':
      person(a.agent, 'agent');
      break;
    case 'alternate':
      person(a.alternate, 'alternate');
      break;
  }
  return errors;
}

export function WizardStep({ step }: { step: StepDef }) {
  const { answers, ready, update, saveState } = usePlan();
  const { t, state } = useCopy();
  const router = useRouter();
  const heading = useRef<HTMLHeadingElement>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [tried, setTried] = useState(false);

  useEffect(() => {
    heading.current?.focus();
    setErrors({});
    setTried(false);
  }, [step.id]);

  useEffect(() => {
    if (tried) setErrors(validate(step, answers, t));
  }, [answers, step, t, tried]);

  if (!ready) return <Loading label={t('common.loading')} />;

  const { prev, next, index, total } = neighbors(step.id, answers);
  const titleId = `q-${step.id}`;
  const groupIndex = GROUPS.indexOf(step.group);

  const go = (target?: StepDef) => router.push(target ? `/plan/${target.id}` : '/review');

  const onNext = () => {
    const found = validate(step, answers, t);
    setTried(true);
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;
    go(next);
  };

  const skip = () => {
    if (step.id === 'agent')
      update({ agent: undefined, alternate: undefined, agentAuthority: undefined });
    go(next);
  };

  const body = (() => {
    switch (step.kind) {
      case 'state':
        return (
          <StateInput
            value={answers.state}
            onChange={(s) => update({ state: s })}
            labelledBy={titleId}
          />
        );
      case 'text':
        return (
          <TextField
            label={t('fields.name')}
            value={answers.name ?? ''}
            onChange={(v) => update({ name: v })}
            autoComplete="name"
            placeholder={t('steps.name.placeholder')}
            error={errors.main}
            data-testid="name"
          />
        );
      case 'date':
        return (
          <DateInput
            value={answers.birthDate}
            onChange={(v) => update({ birthDate: v })}
            labelledBy={titleId}
            error={errors.main}
          />
        );
      case 'address':
        return <AddressInput answers={answers} update={update} />;
      case 'person': {
        const key = step.field === 'alternate' ? 'alternate' : 'agent';
        return (
          <div className="grid gap-5">
            {state && key === 'agent' && <p className="text-muted">{t('wizard.stateTerm')}</p>}
            <PersonInput
              person={answers[key]}
              onChange={(p) => update({ [key]: p })}
              errors={{ phone: errors[`${key}.phone`] }}
            />
          </div>
        );
      }
      case 'choice':
        return (
          <ChoiceInput
            stepId={step.id}
            options={optionsFor(step, answers)}
            value={step.field ? (answers[step.field] as string | undefined) : undefined}
            onChange={(v) => step.field && update({ [step.field]: v } as Partial<Answers>)}
            labelledBy={titleId}
          />
        );
      case 'values':
        return <ValuesInput answers={answers} update={update} labelledBy={titleId} />;
      case 'textarea':
        return (
          <TextArea
            label={t(`steps.${step.id}.title`)}
            srOnlyLabel
            value={(step.field ? (answers[step.field] as string | undefined) : '') ?? ''}
            onChange={(v) => step.field && update({ [step.field]: v } as Partial<Answers>)}
            placeholder={t(`steps.${step.id}.placeholder`)}
          />
        );
      case 'organ':
        return (
          <OrganInput
            options={optionsFor(step, answers)}
            answers={answers}
            update={update}
            labelledBy={titleId}
          />
        );
      case 'physician':
        return <PhysicianInput answers={answers} update={update} />;
    }
  })();

  const hasValue = step.field
    ? answers[step.field] !== undefined && answers[step.field] !== ''
    : false;

  return (
    <div className="mx-auto max-w-2xl px-5 py-8 sm:py-12">
      <div className="mb-6">
        <div className="flex items-center justify-between gap-4 text-sm font-bold">
          <span className="text-brand-strong">{t(`wizard.groups.${step.group}`)}</span>
          <span className="text-muted" aria-live="polite">
            {t('wizard.progress', { current: index + 1, total })}
          </span>
        </div>
        <div className="mt-2 flex gap-1.5" aria-hidden="true">
          {GROUPS.map((g, i) => (
            <span
              key={g}
              className={`h-1.5 flex-1 rounded-full ${i < groupIndex ? 'bg-brand' : i === groupIndex ? 'bg-brand/60' : 'bg-line'}`}
            />
          ))}
        </div>
      </div>

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          onNext();
        }}
      >
        <h1
          id={titleId}
          ref={heading}
          tabIndex={-1}
          className="text-3xl font-bold tracking-tight outline-none sm:text-[2.1rem]"
        >
          {t(`steps.${step.id}.title`)}
        </h1>
        <WhyNote label={t('wizard.why')}>{t(`steps.${step.id}.why`)}</WhyNote>

        <div className="mt-8">{body}</div>
        {errors.main && step.kind !== 'text' && step.kind !== 'date' && (
          <p role="alert" className="mt-3 font-bold text-bad">
            {errors.main}
          </p>
        )}

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
          {prev ? (
            <Link href={`/plan/${prev.id}`} className="btn-secondary">
              <span aria-hidden="true">←</span> {t('common.back')}
            </Link>
          ) : (
            <Link href="/" className="btn-secondary">
              <span aria-hidden="true">←</span> {t('common.back')}
            </Link>
          )}
          <div className="flex flex-wrap items-center gap-3">
            {step.optional && (
              <button type="button" className="btn-quiet" onClick={skip} data-testid="skip">
                {step.id === 'agent' ? t('wizard.skipAgent') : t('common.skip')}
              </button>
            )}
            <button type="submit" className="btn-primary" data-testid="next">
              {next ? t('common.continue') : t('wizard.reviewAnswers')}{' '}
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between text-sm text-muted">
          <span aria-live="polite">
            {saveState === 'saving'
              ? t('common.saving')
              : saveState === 'saved'
                ? t('common.saved')
                : ''}
          </span>
          {hasValue && step.optional && step.field && (
            <button
              type="button"
              className="underline underline-offset-4 hover:text-ink"
              onClick={() => update({ [step.field!]: undefined } as Partial<Answers>)}
            >
              {t('wizard.clear')}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
