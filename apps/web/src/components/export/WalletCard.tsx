'use client';

import { hasAgent, hasAlternate, type Answers } from '@/lib/answers';
import { formatDate } from '@/lib/statements';
import { LogoMark } from '@/components/Logo';
import { useCopy } from '@/state/copy';
import { QrCode } from './QrCode';

export function WalletCard({ answers, url }: { answers: Answers; url: string }) {
  const { t, lang, state } = useCopy();
  return (
    <div className="grid gap-4 sm:grid-cols-2" data-testid="wallet-card">
      <div className="aspect-[3.5/2] overflow-hidden rounded-2xl border border-line bg-white text-[#1d2730] shadow-sm">
        <div className="flex items-center gap-2 bg-[#1f5f5b] px-4 py-2.5 text-white">
          <LogoMark className="h-6 w-6" />
          <span className="text-sm font-bold uppercase tracking-wide">{t('card.front')}</span>
        </div>
        <div className="px-4 py-3">
          <p className="text-lg font-bold leading-tight">{answers.name}</p>
          <p className="text-sm text-[#55616d]">
            {[
              answers.birthDate
                ? t('card.born', { date: formatDate(answers.birthDate, lang) })
                : '',
              state?.name,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {hasAgent(answers) && (
            <div className="mt-2">
              <p className="text-xs font-bold uppercase tracking-wide text-[#1f5f5b]">
                {t('card.agentLabel')}
              </p>
              <p className="font-bold">
                {answers.agent!.name}{' '}
                {answers.agent!.phone && (
                  <span className="font-normal">· {answers.agent!.phone}</span>
                )}
              </p>
              {hasAlternate(answers) && (
                <p className="text-sm">
                  {t('card.backup')}: {answers.alternate!.name}{' '}
                  {answers.alternate!.phone && `· ${answers.alternate!.phone}`}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="flex aspect-[3.5/2] items-center gap-4 rounded-2xl border border-line bg-white p-4 text-[#1d2730] shadow-sm">
        <QrCode value={url} label={t('card.scan')} className="h-full max-h-36 w-auto" />
        <div>
          <p className="font-bold leading-tight">{t('card.scan')}</p>
          <p className="mt-2 text-xs text-[#1f5f5b]">{t('card.madeWith')}</p>
        </div>
      </div>
    </div>
  );
}
