'use client';

import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '@/i18n';
import { useLang } from '@/i18n/provider';

export function LanguageSwitcher() {
  const { t } = useTranslation();
  const { lang, setLang } = useLang();
  return (
    <div
      role="group"
      aria-label={t('lang.label')}
      className="flex rounded-full border-2 border-line bg-surface p-0.5 text-sm"
    >
      {LANGUAGES.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={lang === l}
          onClick={() => setLang(l)}
          className={`rounded-full px-3 py-1.5 font-bold transition-colors ${lang === l ? 'bg-brand text-brand-ink' : 'text-muted hover:text-ink'}`}
        >
          {t(`lang.${l}`)}
        </button>
      ))}
    </div>
  );
}
