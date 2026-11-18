'use client';

import { agentTerm, getState, type StateRules } from '@carewish/form-rules';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLang } from '@/i18n/provider';
import { usePlan } from './plan';

/**
 * Translation helper that fills in the state's name and what the state
 * calls the person who decides for you ({{agent}}).
 */
export function useCopy() {
  const { t } = useTranslation();
  const { lang } = useLang();
  const { answers } = usePlan();
  const state: StateRules | undefined = answers.state ? getState(answers.state) : undefined;
  const agent = state ? agentTerm(state, lang) : t('rules:agentTerm.agent');
  const tt = useCallback(
    (key: string, params: Record<string, unknown> = {}) =>
      t(key, { agent, state: state?.name ?? '', ...params }) as string,
    [t, agent, state],
  );
  return useMemo(() => ({ t: tt, lang, state, agent }), [tt, lang, state, agent]);
}
