'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { BUILD_NUMBER, COMMIT_SHA, REPO_URL, VERSION } from '@/lib/version';

export function SiteFooter() {
  const { t } = useTranslation();
  return (
    <footer className="mt-16 border-t border-line">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-5 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>
          <strong className="text-ink">{t('footer.disclaimer')}</strong> {t('footer.license')}
        </p>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <li>
              <Link className="hover:text-ink" href="/about">
                {t('nav.about')}
              </Link>
            </li>
            <li>
              <Link className="hover:text-ink" href="/privacy">
                {t('nav.privacy')}
              </Link>
            </li>
            <li>
              <a className="hover:text-ink" href={REPO_URL} rel="noreferrer">
                GitHub
              </a>
            </li>
            <li>
              <span title={COMMIT_SHA} data-testid="build-info">
                {t('footer.version', { version: VERSION, build: BUILD_NUMBER })}
              </span>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
