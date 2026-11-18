/**
 * @carewish/form-rules — advance directive forms, witness rules and notary
 * rules for the 50 U.S. states and the District of Columbia.
 *
 * This package provides legal information, not legal advice.
 *
 * @packageDocumentation
 */
export * from './types';
export { getState, requireState, listStates, getDocument, isStateCode } from './data';
export {
  RELATIONSHIP_ATTRIBUTES,
  RELATIONSHIP_DERIVED,
  expandAttributes,
  relevantAttributes,
  witnessQuestions,
  evaluateWitnesses,
  evaluateNotary,
  notaryNeed,
  type NotaryNeed,
  type NotaryEvaluation,
  type WitnessEvaluation,
  type WitnessResult,
  type WitnessProblem,
  type GroupProblem,
} from './witness';
export {
  signingChecklist,
  signingSummary,
  documentsFor,
  type ChecklistStep,
  type SigningSummary,
} from './checklist';
export {
  locales,
  LANGUAGES,
  localize,
  translate,
  agentTerm,
  describeAttribute,
  describeStep,
} from './i18n';

/** Version of the rules data format. Bumped on breaking schema changes. */
export const SCHEMA_VERSION = 1;
