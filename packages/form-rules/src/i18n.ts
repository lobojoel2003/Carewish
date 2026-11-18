import en from '../locales/en.json';
import es from '../locales/es.json';
import type { ChecklistStep } from './checklist';
import type { Language, LocalizedText, StateRules, WitnessAttribute } from './types';

/** Translations shipped with the library, in i18next-compatible JSON. */
export const locales = { en, es } as const;

export const LANGUAGES: readonly Language[] = ['en', 'es'];

type Params = Record<string, string | number>;

/** Picks the text for `lang` from a localized value, falling back to English. */
export function localize(text: LocalizedText, lang: string = 'en'): string {
  if (typeof text === 'string') return text;
  const base = lang.split('-')[0] ?? 'en';
  return text[lang] ?? text[base] ?? text.en;
}

function lookup(lang: string, key: string): unknown {
  const base = (lang.split('-')[0] ?? 'en') as Language;
  const table: unknown = (locales as Record<string, unknown>)[base] ?? locales.en;
  return key.split('.').reduce<unknown>((node, part) => {
    if (node && typeof node === 'object') return (node as Record<string, unknown>)[part];
    return undefined;
  }, table);
}

/**
 * Translates a key from the bundled locales. Supports `{{name}}`
 * interpolation and i18next-style `_one` / `_other` plural keys when a
 * numeric `count` parameter is passed. Falls back to English, then to the key.
 */
export function translate(lang: string, key: string, params: Params = {}): string {
  const candidates: string[] = [];
  if (typeof params.count === 'number') {
    const category = new Intl.PluralRules(lang).select(params.count);
    candidates.push(`${key}_${category}`, `${key}_other`);
  }
  candidates.push(key);

  let template: string | undefined;
  for (const l of [lang, 'en']) {
    for (const k of candidates) {
      const value = lookup(l, k);
      if (typeof value === 'string') {
        template = value;
        break;
      }
    }
    if (template) break;
  }
  if (!template) return key;
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name: string) =>
    params[name] === undefined ? `{{${name}}}` : String(params[name]),
  );
}

/** What the state calls the person who decides for you, e.g. "patient advocate". */
export function agentTerm(state: Pick<StateRules, 'terminology'>, lang: string = 'en'): string {
  return translate(lang, `agentTerm.${state.terminology.agent}`);
}

/** A witness attribute as a phrase, e.g. "Related to you by blood, marriage, or adoption". */
export function describeAttribute(
  attribute: WitnessAttribute,
  state: Pick<StateRules, 'terminology'>,
  lang: string = 'en',
): string {
  return translate(lang, `attribute.${attribute}`, { agent: agentTerm(state, lang) });
}

/**
 * Turns a checklist step into plain sentences: the first line is the step,
 * any further lines are list items under it.
 */
export function describeStep(
  step: ChecklistStep,
  state: StateRules,
  lang: string = 'en',
): string[] {
  const agent = agentTerm(state, lang);
  switch (step.id) {
    case 'print':
      return [translate(lang, 'step.print', { title: step.title })];
    case 'sign':
      return [translate(lang, `method.${step.method}`, { count: step.count, minAge: step.minAge })];
    case 'witness-rules':
      return [
        translate(lang, 'step.witness-rules', { state: state.name }),
        ...step.rules.flatMap((rule) => [
          translate(lang, `rule.${rule.type}`),
          ...rule.attributes.map((a) => `• ${describeAttribute(a, state, lang)}`),
          ...(rule.note ? [localize(rule.note, lang)] : []),
        ]),
      ];
    case 'notary-disqualified':
      return [
        translate(lang, 'step.notary-disqualified'),
        ...step.attributes.map((a) => `• ${describeAttribute(a, state, lang)}`),
      ];
    case 'special':
      return [localize(step.requirement.text, lang)];
    case 'agent-acceptance':
      return [translate(lang, 'step.agent-acceptance', { agent })];
    default:
      return [translate(lang, `step.${step.id}`)];
  }
}
