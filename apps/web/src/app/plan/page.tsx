'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Loading } from '@/components/ui/Fields';
import { resumeStep } from '@/lib/steps';
import { usePlan } from '@/state/plan';

export default function PlanPage() {
  const { answers, ready } = usePlan();
  const router = useRouter();
  const { t } = useTranslation();
  useEffect(() => {
    if (ready) router.replace(`/plan/${resumeStep(answers).id}`);
  }, [ready, answers, router]);
  return <Loading label={t('common.loading')} />;
}
