import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { StateCode } from '@carewish/form-rules';
import type { Answers } from '@/lib/answers';

export const fonts = {
  regular: new Uint8Array(
    readFileSync(join(import.meta.dirname, '../public/fonts/AtkinsonHyperlegible-Regular.ttf')),
  ),
  bold: new Uint8Array(
    readFileSync(join(import.meta.dirname, '../public/fonts/AtkinsonHyperlegible-Bold.ttf')),
  ),
};

export const NOW = new Date('2026-11-18T12:00:00Z');

export function fullAnswers(state: StateCode = 'CA', patch: Partial<Answers> = {}): Answers {
  return {
    version: 1,
    state,
    name: 'Maria Elena Torres',
    birthDate: '1956-03-04',
    address: { street: '12 Oak St', city: 'Fresno', state, postalCode: '93701' },
    phone: '(559) 555-0100',
    agent: {
      name: 'Daniel Torres',
      relationship: 'child',
      phone: '(559) 555-0142',
      email: 'daniel@example.com',
    },
    alternate: { name: 'Lucía Torres', relationship: 'sibling', phone: '(559) 555-0199' },
    agentAuthority: 'yes',
    terminal: 'comfort',
    unconscious: 'comfort',
    advancedIllness: 'agent-decides',
    nutrition: 'trial',
    cpr: 'decline',
    pain: 'comfort',
    values: ['recognize-family', 'at-home'],
    valuesNote: 'Music <3 & "quiet" mornings',
    place: 'home',
    spiritual: 'Please call Father José at St. John parish.',
    organ: 'any',
    physician: { name: 'Dr. Priya Shah', phone: '(559) 555-0111' },
    other: 'I would like my dog Pepper to visit.',
    witnesses: [
      { id: 'a', name: 'Ana Ruiz', relationship: 'none', attributes: [] },
      { id: 'b', name: 'Ben Okafor', relationship: 'none', attributes: [] },
    ],
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...patch,
  };
}

/** Deterministic UUIDs for snapshot-stable FHIR output. */
export function counterUuid(): () => string {
  let n = 0;
  return () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
}
