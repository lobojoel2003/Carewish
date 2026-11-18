'use client';

import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';

export function WhyNote({ label, children }: { label: string; children: ReactNode }) {
  return (
    <aside
      className="mt-4 rounded-2xl border-l-4 border-brand bg-brand-soft/70 px-5 py-4"
      data-testid="why"
    >
      <p className="text-sm font-bold uppercase tracking-wide text-brand-strong">{label}</p>
      <p className="mt-1 text-[1.02rem]">{children}</p>
    </aside>
  );
}

export function FieldError({ id, children }: { id: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="mt-2 font-bold text-bad">
      {children}
    </p>
  );
}

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  optionalLabel?: string;
  error?: string;
};

export function TextField({
  label,
  value,
  onChange,
  hint,
  optionalLabel,
  error,
  className,
  ...rest
}: TextFieldProps) {
  const id = useId();
  const describedBy =
    [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="field-label">
        {label}
        {optionalLabel && <span className="ml-2 font-normal text-muted">({optionalLabel})</span>}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="mb-2 text-sm text-muted">
          {hint}
        </p>
      )}
      <input
        id={id}
        className={`input ${error ? 'border-bad' : ''}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...rest}
      />
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </div>
  );
}

type TextAreaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> & {
  label: string;
  value: string;
  onChange: (value: string) => void;
  srOnlyLabel?: boolean;
};

export function TextArea({ label, value, onChange, srOnlyLabel, ...rest }: TextAreaProps) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={srOnlyLabel ? 'sr-only' : 'field-label'}>
        {label}
      </label>
      <textarea
        id={id}
        rows={5}
        className="input min-h-36 resize-y"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...rest}
      />
    </div>
  );
}

export interface Option {
  value: string;
  label: string;
  description?: string;
}

export function ChoiceGroup({
  name,
  labelledBy,
  options,
  value,
  onChange,
}: {
  name: string;
  labelledBy: string;
  options: Option[];
  value?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="grid gap-3">
      {options.map((o) => (
        <label key={o.value} className="option">
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
            className="mt-1 h-5 w-5 shrink-0 accent-[var(--brand)]"
          />
          <span>
            <span className="block font-bold">{o.label}</span>
            {o.description && <span className="mt-0.5 block text-muted">{o.description}</span>}
          </span>
        </label>
      ))}
    </div>
  );
}

export function CheckboxGroup({
  labelledBy,
  options,
  values,
  onChange,
}: {
  labelledBy: string;
  options: Option[];
  values: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <div role="group" aria-labelledby={labelledBy} className="grid gap-3 sm:grid-cols-2">
      {options.map((o) => (
        <label key={o.value} className="option">
          <input
            type="checkbox"
            value={o.value}
            checked={values.includes(o.value)}
            onChange={(e) =>
              onChange(
                e.target.checked ? [...values, o.value] : values.filter((v) => v !== o.value),
              )
            }
            className="mt-1 h-5 w-5 shrink-0 accent-[var(--brand)]"
          />
          <span className="font-bold">{o.label}</span>
        </label>
      ))}
    </div>
  );
}

export function Select({
  label,
  value,
  onChange,
  options,
  placeholder,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <select
        id={id}
        className="input appearance-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Loading({ label }: { label: string }) {
  return (
    <div
      className="mx-auto max-w-2xl px-5 py-20 text-center text-muted"
      role="status"
      aria-live="polite"
    >
      {label}
    </div>
  );
}
