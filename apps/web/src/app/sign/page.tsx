import type { Metadata } from 'next';
import { Sign } from '@/components/sign/Sign';

export const metadata: Metadata = { title: 'Sign' };

export default function SignPage() {
  return <Sign />;
}
