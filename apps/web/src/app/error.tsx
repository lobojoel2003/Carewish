'use client';

import { useTranslation } from 'react-i18next';

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-2xl px-5 py-20 text-center">
      <h1 className="text-3xl font-bold">{t('export.error')}</h1>
      <button type="button" className="btn-primary mt-8" onClick={reset}>
        {t('common.continue')}
      </button>
    </div>
  );
}
