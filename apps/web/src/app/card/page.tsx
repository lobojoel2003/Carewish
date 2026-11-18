'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Summary } from '@/components/card/Summary';
import { Loading } from '@/components/ui/Fields';
import { decodeCard, type CardSummary } from '@/lib/card';

export default function CardPage() {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<CardSummary | null | undefined>(undefined);
  useEffect(() => {
    const read = () => void decodeCard(window.location.hash.slice(1)).then(setSummary);
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);
  if (summary === undefined) return <Loading label={t('common.loading')} />;
  if (summary === null) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16">
        <h1 className="text-2xl font-bold">{t('card.title')}</h1>
        <p className="mt-3" role="alert">
          {t('card.invalid')}
        </p>
      </div>
    );
  }
  return <Summary summary={summary} />;
}
