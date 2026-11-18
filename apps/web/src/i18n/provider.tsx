'use client';

import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { I18nextProvider, initReactI18next, useTranslation } from 'react-i18next';
import { createI18n, LANG_COOKIE, type Lang } from './index';

const LangContext = createContext<{ lang: Lang; setLang: (lang: Lang) => void }>({
  lang: 'en',
  setLang: () => undefined,
});

export function I18nProvider({ lng, children }: { lng: Lang; children: ReactNode }) {
  const [i18n] = useState(() => createI18n(lng, [initReactI18next]));
  const [lang, setLangState] = useState<Lang>(lng);
  const router = useRouter();

  const setLang = useCallback(
    (next: Lang) => {
      void i18n.changeLanguage(next);
      setLangState(next);
      document.documentElement.lang = next;
      document.cookie = `${LANG_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
      router.refresh();
    },
    [i18n, router],
  );

  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);
  return (
    <I18nextProvider i18n={i18n}>
      <LangContext.Provider value={value}>{children}</LangContext.Provider>
    </I18nextProvider>
  );
}

export function useLang() {
  return useContext(LangContext);
}

export { useTranslation };
