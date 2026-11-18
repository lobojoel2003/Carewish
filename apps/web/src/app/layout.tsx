import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { cookies, headers } from 'next/headers';
import type { ReactNode } from 'react';
import { Providers } from '@/components/Providers';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { LANG_COOKIE, createI18n, pickLanguage } from '@/i18n';
import { accountsEnabled } from '@/server/db';
import './globals.css';

const atkinson = localFont({
  src: [
    { path: './fonts/AtkinsonHyperlegible-Regular.ttf', weight: '400', style: 'normal' },
    { path: './fonts/AtkinsonHyperlegible-Bold.ttf', weight: '700', style: 'normal' },
  ],
  variable: '--font-atkinson',
  display: 'swap',
});

async function language() {
  const [jar, hdrs] = await Promise.all([cookies(), headers()]);
  return pickLanguage(jar.get(LANG_COOKIE)?.value, hdrs.get('accept-language'));
}

export async function generateMetadata(): Promise<Metadata> {
  const { t } = createI18n(await language());
  return {
    title: { default: t('meta.title'), template: '%s · Carewish' },
    description: t('meta.description'),
    applicationName: 'Carewish',
    icons: { icon: '/icon.svg' },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbfaf7' },
    { media: '(prefers-color-scheme: dark)', color: '#121718' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const lng = await language();
  return (
    <html lang={lng} className={atkinson.variable}>
      <body className="flex min-h-dvh flex-col font-sans">
        <Providers lng={lng} accounts={accountsEnabled()}>
          <SiteHeader />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
