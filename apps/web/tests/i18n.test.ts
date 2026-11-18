import { describe, expect, it } from 'vitest';
import { createI18n, englishT, fixedT, isLang, pickLanguage } from '@/i18n';
import en from '@/i18n/locales/en.json';
import es from '@/i18n/locales/es.json';
import { STEPS } from '@/lib/steps';
import { AGENT_RELATIONSHIPS, VALUE_CODES } from '@/lib/answers';

function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe('translations', () => {
  it('has the same keys in English and Spanish', () => {
    expect(keys(es).sort()).toEqual(keys(en).sort());
  });

  it('has no empty strings', () => {
    for (const [lang, table] of Object.entries({ en, es })) {
      for (const k of keys(table)) {
        const value = k
          .split('.')
          .reduce<unknown>((o, p) => (o as Record<string, unknown>)[p], table);
        expect(String(value).trim(), `${lang}:${k}`).not.toBe('');
      }
    }
  });

  it('covers every wizard step, option, relationship and value', () => {
    for (const lang of ['en', 'es'] as const) {
      const t = fixedT(lang);
      for (const step of STEPS) {
        for (const suffix of ['title', 'why']) {
          const key = `steps.${step.id}.${suffix}`;
          expect(t(key), `${lang}:${key}`).not.toBe(key);
        }
        for (const o of step.options ?? []) {
          const key = `steps.${step.id}.options.${o}`;
          expect(t(key), `${lang}:${key}`).not.toBe(key);
        }
      }
      for (const r of AGENT_RELATIONSHIPS)
        expect(t(`relationship.${r}`)).not.toBe(`relationship.${r}`);
      for (const v of VALUE_CODES)
        expect(t(`statements.values.${v}`)).not.toBe(`statements.values.${v}`);
    }
  });

  it('loads the rules namespace from the library', () => {
    expect(englishT()('rules:agentTerm.patient-advocate')).toBe('patient advocate');
    expect(fixedT('es')('rules:agentTerm.patient-advocate')).toBe('defensor del paciente');
    expect(createI18n('es').t('steps.state.title')).toBe('¿En qué estado vive?');
  });
});

describe('language selection', () => {
  it('prefers the saved cookie, then Accept-Language', () => {
    expect(pickLanguage('es', 'en-US')).toBe('es');
    expect(pickLanguage(undefined, 'fr-FR,es-MX;q=0.8,en;q=0.5')).toBe('es');
    expect(pickLanguage('xx', 'en-GB,es;q=0.9')).toBe('en');
    expect(pickLanguage(null, null)).toBe('en');
    expect(pickLanguage(undefined, 'de, fr;q=0.9')).toBe('en');
    expect(isLang('es')).toBe(true);
    expect(isLang('fr')).toBe(false);
  });
});
