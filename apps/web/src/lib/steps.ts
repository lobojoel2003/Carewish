import type { SectionId } from '@carewish/form-rules';
import { hasAgent, type Answers } from './answers';

export type StepKind =
  | 'state'
  | 'text'
  | 'date'
  | 'address'
  | 'person'
  | 'choice'
  | 'values'
  | 'textarea'
  | 'organ'
  | 'physician';

export type StepGroup = 'about' | 'agent' | 'treatment' | 'values' | 'after';

export interface StepDef {
  id: string;
  kind: StepKind;
  group: StepGroup;
  /** The section of the state form this answer fills. */
  section: SectionId;
  /** Answer field the step writes (for single-field steps). */
  field?: keyof Answers;
  options?: readonly string[];
  /** Options that only make sense when an agent was named. */
  agentOnlyOptions?: readonly string[];
  /** The person may skip the step. */
  optional?: boolean;
  /** Only shown when an agent was named. */
  needsAgent?: boolean;
}

const TREATMENT = ['comfort', 'prolong', 'agent-decides'] as const;

export const STEPS: readonly StepDef[] = [
  { id: 'state', kind: 'state', group: 'about', section: 'principal', field: 'state' },
  { id: 'name', kind: 'text', group: 'about', section: 'principal', field: 'name' },
  { id: 'birthdate', kind: 'date', group: 'about', section: 'principal', field: 'birthDate' },
  { id: 'address', kind: 'address', group: 'about', section: 'principal', optional: true },
  { id: 'agent', kind: 'person', group: 'agent', section: 'agent', field: 'agent', optional: true },
  {
    id: 'alternate',
    kind: 'person',
    group: 'agent',
    section: 'alternate-agent',
    field: 'alternate',
    optional: true,
    needsAgent: true,
  },
  {
    id: 'authority',
    kind: 'choice',
    group: 'agent',
    section: 'agent-authority',
    field: 'agentAuthority',
    options: ['yes', 'no'],
    optional: true,
    needsAgent: true,
  },
  {
    id: 'terminal',
    kind: 'choice',
    group: 'treatment',
    section: 'life-sustaining',
    field: 'terminal',
    options: TREATMENT,
    agentOnlyOptions: ['agent-decides'],
    optional: true,
  },
  {
    id: 'unconscious',
    kind: 'choice',
    group: 'treatment',
    section: 'life-sustaining',
    field: 'unconscious',
    options: TREATMENT,
    agentOnlyOptions: ['agent-decides'],
    optional: true,
  },
  {
    id: 'advanced-illness',
    kind: 'choice',
    group: 'treatment',
    section: 'life-sustaining',
    field: 'advancedIllness',
    options: TREATMENT,
    agentOnlyOptions: ['agent-decides'],
    optional: true,
  },
  {
    id: 'nutrition',
    kind: 'choice',
    group: 'treatment',
    section: 'nutrition',
    field: 'nutrition',
    options: ['want', 'trial', 'decline', 'agent-decides'],
    agentOnlyOptions: ['agent-decides'],
    optional: true,
  },
  {
    id: 'cpr',
    kind: 'choice',
    group: 'treatment',
    section: 'cpr',
    field: 'cpr',
    options: ['want', 'decline', 'agent-decides'],
    agentOnlyOptions: ['agent-decides'],
    optional: true,
  },
  {
    id: 'pain',
    kind: 'choice',
    group: 'treatment',
    section: 'pain-relief',
    field: 'pain',
    options: ['comfort', 'not-if-shortens', 'agent-decides'],
    agentOnlyOptions: ['agent-decides'],
    optional: true,
  },
  {
    id: 'values',
    kind: 'values',
    group: 'values',
    section: 'values',
    field: 'values',
    optional: true,
  },
  {
    id: 'place',
    kind: 'choice',
    group: 'values',
    section: 'values',
    field: 'place',
    options: ['home', 'hospice', 'hospital', 'no-preference'],
    optional: true,
  },
  {
    id: 'spiritual',
    kind: 'textarea',
    group: 'values',
    section: 'values',
    field: 'spiritual',
    optional: true,
  },
  {
    id: 'organ',
    kind: 'organ',
    group: 'after',
    section: 'organ-donation',
    field: 'organ',
    options: ['any', 'specific', 'none', 'agent-decides'],
    agentOnlyOptions: ['agent-decides'],
    optional: true,
  },
  { id: 'physician', kind: 'physician', group: 'after', section: 'physician', optional: true },
  {
    id: 'other',
    kind: 'textarea',
    group: 'after',
    section: 'additional-wishes',
    field: 'other',
    optional: true,
  },
];

export const GROUPS: readonly StepGroup[] = ['about', 'agent', 'treatment', 'values', 'after'];

/** Steps that apply to these answers, in order. */
export function visibleSteps(answers: Answers): StepDef[] {
  const agent = hasAgent(answers);
  return STEPS.filter((s) => !s.needsAgent || agent);
}

/** Options to offer for a choice step, hiding agent-only ones when no agent was named. */
export function optionsFor(step: StepDef, answers: Answers): string[] {
  const agent = hasAgent(answers);
  return (step.options ?? []).filter((o) => agent || !step.agentOnlyOptions?.includes(o));
}

export function findStep(id: string): StepDef | undefined {
  return STEPS.find((s) => s.id === id);
}

/** True when a step has been answered. */
export function isAnswered(step: StepDef, a: Answers): boolean {
  switch (step.kind) {
    case 'address':
      return Boolean(a.address?.street || a.address?.city || a.phone);
    case 'physician':
      return Boolean(a.physician?.name);
    case 'person': {
      const p = step.field === 'agent' ? a.agent : a.alternate;
      return Boolean(p?.name);
    }
    case 'values':
      return Boolean(a.values?.length || a.valuesNote?.trim());
    default: {
      const v = step.field ? a[step.field] : undefined;
      return typeof v === 'string' ? v.trim().length > 0 : v !== undefined;
    }
  }
}

/** Required steps that still need an answer. */
export function missingRequired(a: Answers): StepDef[] {
  return visibleSteps(a).filter((s) => !s.optional && !isAnswered(s, a));
}

/** The step to resume at: the first unanswered required step, else the first unanswered step. */
export function resumeStep(a: Answers): StepDef {
  const steps = visibleSteps(a);
  return missingRequired(a)[0] ?? steps.find((s) => !isAnswered(s, a)) ?? steps[0]!;
}

/** Previous and next visible steps around `id`. */
export function neighbors(
  id: string,
  a: Answers,
): { prev?: StepDef; next?: StepDef; index: number; total: number } {
  const steps = visibleSteps(a);
  const index = steps.findIndex((s) => s.id === id);
  return { prev: steps[index - 1], next: steps[index + 1], index, total: steps.length };
}
