'use client';

import type { ReactNode } from 'react';
import type { Lang } from '@/i18n';
import { I18nProvider } from '@/i18n/provider';
import { AccountProvider } from '@/state/account';
import { PlanProvider } from '@/state/plan';

export function Providers({
  lng,
  accounts,
  children,
}: {
  lng: Lang;
  accounts: boolean;
  children: ReactNode;
}) {
  return (
    <I18nProvider lng={lng}>
      <PlanProvider>
        <AccountProvider enabled={accounts}>{children}</AccountProvider>
      </PlanProvider>
    </I18nProvider>
  );
}
