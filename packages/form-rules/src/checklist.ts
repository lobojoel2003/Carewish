import type {
  DocumentRules,
  ExecutionMethod,
  SpecialRequirement,
  WitnessAttribute,
  WitnessRule,
} from './types';
import { notaryNeed, type NotaryNeed } from './witness';

/** One step of a signing checklist. Text is produced by the consumer (see `describeStep`). */
export type ChecklistStep =
  | { id: 'print'; title: string }
  | { id: 'sign'; method: ExecutionMethod; count: number; minAge: number }
  | { id: 'witness-rules'; rules: WitnessRule[] }
  | { id: 'witnesses-sign' }
  | { id: 'notary-disqualified'; attributes: WitnessAttribute[] }
  | { id: 'notary-recommended' }
  | { id: 'bring-id' }
  | { id: 'agent-acceptance' }
  | { id: 'special'; requirement: SpecialRequirement };

export interface SigningSummary {
  method: ExecutionMethod;
  /** Witnesses required (0 when witnesses are not needed). */
  witnesses: number;
  minAge: number;
  notary: NotaryNeed;
  agentAcceptance: boolean;
}

/** A compact description of how a document must be signed. */
export function signingSummary(doc: DocumentRules): SigningSummary {
  const ex = doc.execution;
  const needsWitnesses = ex.method !== 'notary' && ex.method !== 'signature-only';
  return {
    method: ex.method,
    witnesses: needsWitnesses ? (ex.witnesses?.count ?? 0) : 0,
    minAge: ex.witnesses?.minAge ?? 18,
    notary: notaryNeed(ex),
    agentAcceptance: Boolean(ex.agentAcceptance),
  };
}

/** The ordered steps a person follows to sign one document validly. */
export function signingChecklist(doc: DocumentRules): ChecklistStep[] {
  const ex = doc.execution;
  const summary = signingSummary(doc);
  const steps: ChecklistStep[] = [{ id: 'print', title: doc.title }];

  steps.push({ id: 'sign', method: ex.method, count: summary.witnesses, minAge: summary.minAge });

  if (summary.witnesses > 0) {
    if (ex.witnesses && ex.witnesses.rules.length > 0) {
      steps.push({ id: 'witness-rules', rules: ex.witnesses.rules });
    }
    steps.push({ id: 'witnesses-sign' });
  }
  if (summary.notary === 'required' || summary.notary === 'alternative') {
    if (ex.notary?.disqualified?.length) {
      steps.push({ id: 'notary-disqualified', attributes: ex.notary.disqualified });
    }
    steps.push({ id: 'bring-id' });
  }
  if (summary.notary === 'recommended') steps.push({ id: 'notary-recommended' });
  if (ex.agentAcceptance) steps.push({ id: 'agent-acceptance' });
  for (const requirement of ex.special ?? []) steps.push({ id: 'special', requirement });
  return steps;
}

/** The documents of a state that a person needs, given the sections they filled in. */
export function documentsFor<T extends { documents: DocumentRules[] }>(
  state: T,
  options: { hasAgent: boolean; hasWishes: boolean },
): DocumentRules[] {
  return state.documents.filter((doc) => {
    if (doc.kind === 'power-of-attorney') return options.hasAgent;
    if (doc.kind === 'living-will') return options.hasWishes;
    return options.hasAgent || options.hasWishes;
  });
}
