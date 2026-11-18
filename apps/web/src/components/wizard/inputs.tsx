'use client';

import { listStates, type StateCode } from '@carewish/form-rules';
import { useId, useMemo, useState } from 'react';
import {
  AGENT_RELATIONSHIPS,
  VALUE_CODES,
  type Answers,
  type Person,
  type ValueCode,
} from '@/lib/answers';
import { CheckboxGroup, ChoiceGroup, Select, TextArea, TextField } from '@/components/ui/Fields';
import { useCopy } from '@/state/copy';

export function StateInput({
  value,
  onChange,
  labelledBy,
}: {
  value?: StateCode;
  onChange: (s: StateCode) => void;
  labelledBy: string;
}) {
  const { t } = useCopy();
  const [query, setQuery] = useState('');
  const states = useMemo(() => listStates(), []);
  const q = query.trim().toLowerCase();
  const shown = q
    ? states.filter((s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase() === q)
    : states;
  return (
    <div>
      <TextField
        label={t('wizard.chooseState')}
        value={query}
        onChange={setQuery}
        autoComplete="address-level1"
        placeholder="California, Texas, New York…"
        data-testid="state-filter"
      />
      <div
        role="radiogroup"
        aria-labelledby={labelledBy}
        className="mt-4 grid max-h-[26rem] gap-2 overflow-y-auto rounded-2xl border border-line bg-surface-muted p-2 sm:grid-cols-2"
      >
        {shown.map((s) => (
          <label key={s.code} className="option py-3">
            <input
              type="radio"
              name="state"
              value={s.code}
              checked={value === s.code}
              onChange={() => onChange(s.code)}
              className="mt-1 h-5 w-5 shrink-0 accent-[var(--brand)]"
            />
            <span className="font-bold">{s.name}</span>
          </label>
        ))}
        {shown.length === 0 && <p className="p-4 text-muted">—</p>}
      </div>
    </div>
  );
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export function DateInput({
  value,
  onChange,
  labelledBy,
  error,
}: {
  value?: string;
  onChange: (v: string | undefined) => void;
  labelledBy: string;
  error?: string;
}) {
  const { t, lang } = useCopy();
  const id = useId();
  const [y = '', m = '', d = ''] = (value ?? '--').split('-');
  const [parts, setParts] = useState({
    y,
    m: m ? String(Number(m)) : '',
    d: d ? String(Number(d)) : '',
  });
  const monthName = (n: number) =>
    new Intl.DateTimeFormat(lang === 'es' ? 'es-US' : 'en-US', {
      month: 'long',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(2000, n - 1, 1)));
  const set = (patch: Partial<typeof parts>) => {
    const next = { ...parts, ...patch };
    setParts(next);
    if (next.y.length === 4 && next.m && next.d) {
      onChange(`${next.y}-${next.m.padStart(2, '0')}-${next.d.padStart(2, '0')}`);
    } else {
      onChange(undefined);
    }
  };
  const labels =
    lang === 'es' ? { m: 'Mes', d: 'Día', y: 'Año' } : { m: 'Month', d: 'Day', y: 'Year' };
  return (
    <div
      role="group"
      aria-labelledby={labelledBy}
      aria-describedby={error ? `${id}-err` : undefined}
    >
      <div className="flex flex-wrap gap-3">
        <Select
          className="min-w-44 flex-1"
          label={labels.m}
          value={parts.m}
          onChange={(v) => set({ m: v })}
          placeholder={t('fields.choose')}
          options={MONTHS.map((n) => ({ value: String(n), label: monthName(n) }))}
        />
        <TextField
          className="w-24"
          label={labels.d}
          value={parts.d}
          onChange={(v) => set({ d: v.replace(/\D/g, '').slice(0, 2) })}
          inputMode="numeric"
          autoComplete="bday-day"
        />
        <TextField
          className="w-32"
          label={labels.y}
          value={parts.y}
          onChange={(v) => set({ y: v.replace(/\D/g, '').slice(0, 4) })}
          inputMode="numeric"
          autoComplete="bday-year"
        />
      </div>
      {error && (
        <p id={`${id}-err`} role="alert" className="mt-2 font-bold text-bad">
          {error}
        </p>
      )}
    </div>
  );
}

export function AddressInput({
  answers,
  update,
}: {
  answers: Answers;
  update: (p: Partial<Answers>) => void;
}) {
  const { t } = useCopy();
  const a = answers.address ?? {};
  const set = (patch: Partial<NonNullable<Answers['address']>>) =>
    update({ address: { ...a, ...patch } });
  const optional = t('common.optional');
  return (
    <div className="grid gap-4 sm:grid-cols-6">
      <TextField
        className="sm:col-span-6"
        label={t('fields.street')}
        value={a.street ?? ''}
        onChange={(v) => set({ street: v })}
        autoComplete="street-address"
        optionalLabel={optional}
      />
      <TextField
        className="sm:col-span-3"
        label={t('fields.city')}
        value={a.city ?? ''}
        onChange={(v) => set({ city: v })}
        autoComplete="address-level2"
      />
      <TextField
        className="sm:col-span-1"
        label={t('fields.state')}
        value={a.state ?? answers.state ?? ''}
        onChange={(v) => set({ state: v.toUpperCase().slice(0, 2) })}
        autoComplete="address-level1"
      />
      <TextField
        className="sm:col-span-2"
        label={t('fields.postalCode')}
        value={a.postalCode ?? ''}
        onChange={(v) => set({ postalCode: v.slice(0, 10) })}
        autoComplete="postal-code"
        inputMode="numeric"
      />
      <TextField
        className="sm:col-span-3"
        label={t('fields.yourPhone')}
        value={answers.phone ?? ''}
        onChange={(v) => update({ phone: v })}
        type="tel"
        autoComplete="tel"
        optionalLabel={optional}
      />
    </div>
  );
}

export function PersonInput({
  person,
  onChange,
  errors,
}: {
  person?: Person;
  onChange: (p: Person) => void;
  errors: { name?: string; phone?: string };
}) {
  const { t } = useCopy();
  const p = person ?? { name: '' };
  const set = (patch: Partial<Person>) => onChange({ ...p, ...patch });
  const optional = t('common.optional');
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField
        className="sm:col-span-2"
        label={t('fields.name')}
        value={p.name}
        onChange={(v) => set({ name: v })}
        autoComplete="off"
        error={errors.name}
        data-testid="person-name"
      />
      <Select
        label={t('fields.relationship')}
        value={p.relationship ?? ''}
        onChange={(v) => set({ relationship: (v || undefined) as Person['relationship'] })}
        placeholder={t('fields.choose')}
        options={AGENT_RELATIONSHIPS.map((r) => ({ value: r, label: t(`relationship.${r}`) }))}
      />
      <TextField
        label={t('fields.phone')}
        value={p.phone ?? ''}
        onChange={(v) => set({ phone: v })}
        type="tel"
        autoComplete="off"
        error={errors.phone}
        data-testid="person-phone"
      />
      <TextField
        label={t('fields.email')}
        value={p.email ?? ''}
        onChange={(v) => set({ email: v })}
        type="email"
        autoComplete="off"
        optionalLabel={optional}
      />
      <TextField
        label={t('fields.address')}
        value={p.address ?? ''}
        onChange={(v) => set({ address: v })}
        autoComplete="off"
        optionalLabel={optional}
      />
    </div>
  );
}

export function ChoiceInput({
  stepId,
  options,
  value,
  onChange,
  labelledBy,
}: {
  stepId: string;
  options: string[];
  value?: string;
  onChange: (v: string) => void;
  labelledBy: string;
}) {
  const { t } = useCopy();
  return (
    <ChoiceGroup
      name={stepId}
      labelledBy={labelledBy}
      value={value}
      onChange={onChange}
      options={options.map((o) => ({ value: o, label: t(`steps.${stepId}.options.${o}`) }))}
    />
  );
}

export function ValuesInput({
  answers,
  update,
  labelledBy,
}: {
  answers: Answers;
  update: (p: Partial<Answers>) => void;
  labelledBy: string;
}) {
  const { t } = useCopy();
  return (
    <div className="grid gap-5">
      <p className="text-muted">{t('steps.values.hint')}</p>
      <CheckboxGroup
        labelledBy={labelledBy}
        values={answers.values ?? []}
        onChange={(v) => update({ values: v as ValueCode[] })}
        options={VALUE_CODES.map((v) => ({ value: v, label: t(`steps.values.options.${v}`) }))}
      />
      <TextArea
        label={t('fields.valuesNote')}
        value={answers.valuesNote ?? ''}
        onChange={(v) => update({ valuesNote: v })}
        rows={3}
      />
    </div>
  );
}

export function OrganInput({
  options,
  answers,
  update,
  labelledBy,
}: {
  options: string[];
  answers: Answers;
  update: (p: Partial<Answers>) => void;
  labelledBy: string;
}) {
  const { t } = useCopy();
  return (
    <div className="grid gap-5">
      <ChoiceInput
        stepId="organ"
        options={options}
        value={answers.organ}
        onChange={(v) => update({ organ: v as Answers['organ'] })}
        labelledBy={labelledBy}
      />
      {answers.organ === 'specific' && (
        <TextArea
          label={t('fields.organDetail')}
          value={answers.organDetail ?? ''}
          onChange={(v) => update({ organDetail: v })}
          rows={2}
        />
      )}
    </div>
  );
}

export function PhysicianInput({
  answers,
  update,
}: {
  answers: Answers;
  update: (p: Partial<Answers>) => void;
}) {
  const { t } = useCopy();
  const p = answers.physician ?? {};
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField
        label={t('fields.doctorName')}
        value={p.name ?? ''}
        onChange={(v) => update({ physician: { ...p, name: v } })}
        autoComplete="off"
      />
      <TextField
        label={t('fields.doctorPhone')}
        value={p.phone ?? ''}
        onChange={(v) => update({ physician: { ...p, phone: v } })}
        type="tel"
        autoComplete="off"
      />
    </div>
  );
}
