'use client';

import { notFound, useParams } from 'next/navigation';
import { WizardStep } from '@/components/wizard/WizardStep';
import { findStep } from '@/lib/steps';

export default function StepPage() {
  const { step: id } = useParams<{ step: string }>();
  const step = findStep(id);
  if (!step) notFound();
  return <WizardStep step={step} />;
}
