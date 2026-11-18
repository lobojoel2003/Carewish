import type { Metadata } from 'next';
import { Privacy } from '@/components/StaticPages';

export const metadata: Metadata = { title: 'Privacy' };

export default function PrivacyPage() {
  return <Privacy />;
}
