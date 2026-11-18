import i18next, { type i18n as I18n } from 'i18next';
import { locales as rulesLocales } from '@carewish/form-rules';
import en from './locales/en.json';
import es from './locales/es.json';

export const LANGUAGES = ['en', 'es'] as const;
export type Lang = (typeof LANGUAGES)[number];
export const DEFAULT_LANG: Lang = 'en';
export const LANG_COOKIE = 'cw_lang';

export const resources = {
  en: { translation: en, rules: rulesLocales.en },
  es: { translation: es, rules: rulesLocales.es },
} as const;

export function isLang(value: unknown): value is Lang {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

/**
 * Picks a supported language from a saved cookie value, then from an
 * Accept-Language header, falling back to English.
 */
export function pickLanguage(cookie?: string | null, acceptLanguage?: string | null): Lang {
  if (isLang(cookie)) return cookie;
  const ranked = (acceptLanguage ?? '')
    .split(',')
    .map((part) => {
      const [tag = '', ...params] = part.trim().split(';');
      const q = params.find((p) => p.trim().startsWith('q='));
      return { base: tag.toLowerCase().split('-')[0] ?? '', q: q ? Number(q.split('=')[1]) : 1 };
    })
    .filter((x) => x.base && !Number.isNaN(x.q))
    .sort((a, b) => b.q - a.q);
  return ranked.map((r) => r.base).find(isLang) ?? DEFAULT_LANG;
}

/** Creates an initialized, synchronous i18next instance. */
export function createI18n(lng: Lang, plugins: Parameters<I18n['use']>[0][] = []): I18n {
  const instance = i18next.createInstance();
  for (const plugin of plugins) instance.use(plugin);
  void instance.init({
    lng,
    fallbackLng: DEFAULT_LANG,
    supportedLngs: [...LANGUAGES],
    resources,
    ns: ['translation', 'rules'],
    defaultNS: 'translation',
    interpolation: { escapeValue: false },
    initAsync: false,
    returnNull: false,
  });
  return instance;
}

/** A plain translation function: key plus interpolation values. */
export type Translate = (key: string, params?: Record<string, unknown>) => string;

/** Wraps an i18next instance's `t` as a {@link Translate}. */
export function translator(instance: I18n): Translate {
  return (key, params) => String(instance.t(key, params as never));
}

const fixed = new Map<Lang, Translate>();

/** A translator fixed to one language; English is used for documents that must be in English (PDF, FHIR). */
export function fixedT(lang: Lang): Translate {
  let t = fixed.get(lang);
  if (!t) {
    t = translator(createI18n(lang));
    fixed.set(lang, t);
  }
  return t;
}

export function englishT(): Translate {
  return fixedT('en');
}
