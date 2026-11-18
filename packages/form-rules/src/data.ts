import raw from './generated/states.json';
import { STATE_CODES, type DocumentRules, type StateCode, type StateRules } from './types';

const STATES = raw as unknown as Record<StateCode, StateRules>;

/** True when `value` is one of the 51 supported jurisdiction codes. */
export function isStateCode(value: unknown): value is StateCode {
  return typeof value === 'string' && (STATE_CODES as readonly string[]).includes(value);
}

/** Rules for one state, or `undefined` for an unknown code. Codes are case-insensitive. */
export function getState(code: string): StateRules | undefined {
  const upper = code.toUpperCase();
  return isStateCode(upper) ? STATES[upper] : undefined;
}

/** Rules for one state. Throws for an unknown code. */
export function requireState(code: string): StateRules {
  const state = getState(code);
  if (!state) throw new RangeError(`Unknown state code: ${code}`);
  return state;
}

/** Every jurisdiction, sorted by name. */
export function listStates(): StateRules[] {
  return Object.values(STATES).sort((a, b) => a.name.localeCompare(b.name, 'en'));
}

/** Looks up one document of a state by id. */
export function getDocument(code: string, documentId: string): DocumentRules | undefined {
  return getState(code)?.documents.find((d) => d.id === documentId);
}
