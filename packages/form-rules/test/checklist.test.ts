import { describe, expect, it } from 'vitest';
import {
  agentTerm,
  describeAttribute,
  describeStep,
  documentsFor,
  listStates,
  locales,
  localize,
  requireState,
  signingChecklist,
  signingSummary,
  translate,
} from '../src';

describe('signingSummary', () => {
  it('summarizes California', () => {
    expect(signingSummary(requireState('CA').documents[0]!)).toEqual({
      method: 'witnesses-or-notary',
      witnesses: 2,
      minAge: 18,
      notary: 'alternative',
      agentAcceptance: false,
    });
  });

  it('reports zero witnesses for notary-only documents', () => {
    expect(signingSummary(requireState('MO').documents[0]!)).toMatchObject({
      witnesses: 0,
      notary: 'required',
    });
  });
});

describe('signingChecklist', () => {
  const ids = (code: string, i = 0) =>
    signingChecklist(requireState(code).documents[i]!).map((s) => s.id);

  it('builds California steps', () => {
    expect(ids('CA')).toEqual([
      'print',
      'sign',
      'witness-rules',
      'witnesses-sign',
      'bring-id',
      'special',
    ]);
  });

  it('builds Michigan steps with agent acceptance', () => {
    expect(ids('MI')).toContain('agent-acceptance');
  });

  it('adds notary disqualification for Kentucky', () => {
    expect(ids('KY')).toContain('notary-disqualified');
  });

  it('recommends a notary for Idaho and skips witnesses', () => {
    expect(ids('ID')).toEqual(['print', 'sign', 'notary-recommended']);
  });

  it('skips witness rules when a state lists none', () => {
    expect(ids('VA')).toEqual(['print', 'sign', 'witnesses-sign']);
  });

  it('produces a checklist for every document of every state', () => {
    for (const state of listStates()) {
      for (const doc of state.documents) {
        const steps = signingChecklist(doc);
        expect(steps[0]).toEqual({ id: 'print', title: doc.title });
        for (const step of steps) {
          for (const lang of ['en', 'es']) {
            const lines = describeStep(step, state, lang);
            expect(lines.length).toBeGreaterThan(0);
            for (const line of lines) expect(line).not.toMatch(/\{\{|step\.|method\./);
          }
        }
      }
    }
  });
});

describe('documentsFor', () => {
  const fl = requireState('FL');
  it('picks documents by what the person filled in', () => {
    expect(documentsFor(fl, { hasAgent: true, hasWishes: false }).map((d) => d.id)).toEqual([
      'designation-of-health-care-surrogate',
    ]);
    expect(documentsFor(fl, { hasAgent: false, hasWishes: true }).map((d) => d.id)).toEqual([
      'living-will',
    ]);
    expect(documentsFor(requireState('CA'), { hasAgent: false, hasWishes: false })).toEqual([]);
  });
});

describe('translations', () => {
  function keys(obj: object, prefix = ''): string[] {
    return Object.entries(obj).flatMap(([k, v]) =>
      v && typeof v === 'object' ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
    );
  }

  it('ships the same keys in every language', () => {
    expect(keys(locales.es).sort()).toEqual(keys(locales.en).sort());
  });

  it('interpolates and pluralizes', () => {
    expect(translate('en', 'method.witnesses', { count: 1, minAge: 19 })).toBe(
      'Sign in front of 1 adult witness (age 19 or older). A notary is not needed.',
    );
    expect(translate('es', 'evaluation.missing', { count: 2 })).toBe('Necesita 2 testigos más.');
    expect(translate('en', 'step.print')).toContain('{{title}}');
  });

  it('falls back to English, then to the key', () => {
    expect(translate('fr', 'rule.none-may-be')).toBe('None of your witnesses can be:');
    expect(translate('en', 'does.not.exist')).toBe('does.not.exist');
  });

  it('localizes text with a language fallback', () => {
    expect(localize('Hello', 'es')).toBe('Hello');
    expect(localize({ en: 'Hello', es: 'Hola' }, 'es-MX')).toBe('Hola');
    expect(localize({ en: 'Hello' }, 'es')).toBe('Hello');
  });

  it('uses the state term for the agent', () => {
    const mi = requireState('MI');
    expect(agentTerm(mi)).toBe('patient advocate');
    expect(agentTerm(mi, 'es')).toBe('defensor del paciente');
    expect(describeAttribute('agent', mi)).toBe(
      'Your patient advocate or alternate patient advocate',
    );
  });

  it('provides localized special requirements and notes in Spanish', () => {
    for (const state of listStates()) {
      for (const note of state.notes ?? [])
        expect(typeof note === 'object' && note.es).toBeTruthy();
      for (const doc of state.documents) {
        for (const s of doc.execution.special ?? [])
          expect(typeof s.text === 'object' && s.text.es).toBeTruthy();
      }
    }
  });
});
