'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useAccount } from '@/state/account';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Logo } from './Logo';

const LINKS = [
  { href: '/plan', key: 'nav.plan', match: '/plan' },
  { href: '/review', key: 'nav.review', match: '/review' },
  { href: '/sign', key: 'nav.sign', match: '/sign' },
  { href: '/export', key: 'nav.export', match: '/export' },
] as const;

export function SiteHeader() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const account = useAccount();
  const links = account.enabled
    ? [...LINKS, { href: '/account', key: 'nav.account', match: '/account' } as const]
    : LINKS;

  return (
    <header className="border-b border-line bg-paper/90 backdrop-blur supports-[backdrop-filter]:bg-paper/75">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2"
      >
        {t('nav.skip')}
      </a>
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4">
        <Link href="/" aria-label={t('nav.home')} className="rounded-xl">
          <Logo />
        </Link>
        <nav aria-label="Main" className="order-3 w-full sm:order-2 sm:w-auto">
          <ul className="flex flex-wrap gap-1 text-[0.95rem]">
            {links.map((l) => {
              const active = pathname?.startsWith(l.match);
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={active ? 'page' : undefined}
                    className={`block rounded-full px-3.5 py-2 font-bold transition-colors ${active ? 'bg-brand-soft text-brand-strong' : 'text-muted hover:text-ink'}`}
                  >
                    {t(l.key)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="order-2 sm:order-3">
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
