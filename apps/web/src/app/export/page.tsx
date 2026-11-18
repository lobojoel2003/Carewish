import type { Metadata } from 'next';
import { Export } from '@/components/export/Export';

export const metadata: Metadata = { title: 'Download' };

export default function ExportPage() {
  return <Export />;
}
