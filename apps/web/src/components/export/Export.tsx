'use client';

import { isStateCode } from '@carewish/form-rules';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { fileSlug, sanitizeAnswers } from '@/lib/answers';
import {
  cardLink,
  directivePdf,
  fhirBundleJson,
  sharePayload,
  walletCardPdf,
} from '@/lib/documents';
import { downloadBlob } from '@/lib/files';
import { missingRequired } from '@/lib/steps';
import { Loading } from '@/components/ui/Fields';
import { useAccount } from '@/state/account';
import { useCopy } from '@/state/copy';
import { usePlan } from '@/state/plan';
import { WalletCard } from './WalletCard';

type Busy = 'pdf' | 'preview' | 'fhir' | 'card' | 'share' | null;

export function Export() {
  const { answers, ready, replace, reset } = usePlan();
  const account = useAccount();
  const { t, lang } = useCopy();
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [preview, setPreview] = useState<string>();
  const [url, setUrl] = useState<string>();
  const fileInput = useRef<HTMLInputElement>(null);

  const share = account.status === 'signed-in' ? account.share : undefined;

  useEffect(() => {
    if (!ready || !answers.name) return;
    let cancelled = false;
    void cardLink(answers, lang, share).then((u) => !cancelled && setUrl(u));
    return () => {
      cancelled = true;
    };
  }, [answers, lang, ready, share]);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  if (!ready) return <Loading label={t('common.loading')} />;

  const missing = missingRequired(answers);
  if (missing.length) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16">
        <h1 className="text-3xl font-bold">{t('export.title')}</h1>
        <p className="mt-4">{t('export.incomplete')}</p>
        <Link className="btn-primary mt-6" href={`/plan/${missing[0]!.id}`}>
          {t('common.continue')}
        </Link>
      </div>
    );
  }

  const slug = fileSlug(answers.name);
  const state = (answers.state ?? 'us').toLowerCase();

  async function run(kind: Exclude<Busy, null>, fn: () => Promise<void>) {
    setBusy(kind);
    setError(undefined);
    setNotice(undefined);
    try {
      await fn();
    } catch (e) {
      console.error(e);
      setError(t('export.error'));
    } finally {
      setBusy(null);
    }
  }

  const pdf = () =>
    run('pdf', async () => {
      downloadBlob(
        (await directivePdf(answers)) as BlobPart,
        `carewish-${slug}-${state}-advance-directive.pdf`,
        'application/pdf',
      );
    });
  const showPreview = () =>
    run('preview', async () => {
      const bytes = await directivePdf(answers);
      setPreview(URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' })));
    });
  const fhir = () =>
    run('fhir', async () => {
      downloadBlob(
        await fhirBundleJson(answers, lang),
        `carewish-${slug}-${state}-advance-directive.fhir.json`,
        'application/fhir+json',
      );
    });
  const card = () =>
    run('card', async () => {
      const link = url ?? (await cardLink(answers, lang, share));
      downloadBlob(
        (await walletCardPdf(answers, lang, link, Boolean(share))) as BlobPart,
        `carewish-${slug}-wallet-card.pdf`,
        'application/pdf',
      );
    });
  const saveShare = () =>
    run('share', async () => {
      await account.saveShare(await sharePayload(answers, lang));
    });

  const backup = () =>
    downloadBlob(
      JSON.stringify({ ...answers, exportedBy: 'carewish' }, null, 2),
      `carewish-${slug}-backup.json`,
      'application/json',
    );

  const importBackup = async (file: File) => {
    setError(undefined);
    try {
      const data = sanitizeAnswers(JSON.parse(await file.text()), isStateCode);
      if (!data) throw new Error('not carewish');
      replace({ ...data, updatedAt: new Date().toISOString() });
      setNotice(t('export.importDone'));
    } catch {
      setError(t('export.importError'));
    }
  };

  const deleteLocal = async () => {
    if (!window.confirm(t('export.deleteConfirm'))) return;
    await reset();
    setNotice(t('export.deleted'));
  };

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('export.title')}</h1>
      <p className="mt-3 text-lg text-muted">{t('export.intro')}</p>

      <div aria-live="polite" className="mt-4">
        {error && (
          <p role="alert" className="rounded-xl bg-bad-soft px-4 py-3 font-bold text-bad">
            {error}
          </p>
        )}
        {notice && <p className="rounded-xl bg-ok-soft px-4 py-3 font-bold text-ok">{notice}</p>}
      </div>

      <div className="mt-6 grid gap-6">
        <section className="card">
          <h2 className="text-2xl font-bold">{t('export.pdfTitle')}</h2>
          <p className="mt-2 text-muted">{t('export.pdfBody')}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              className="btn-primary"
              onClick={pdf}
              disabled={busy !== null}
              data-testid="download-pdf"
            >
              {busy === 'pdf' ? t('export.generating') : t('export.pdfButton')}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={showPreview}
              disabled={busy !== null}
              data-testid="preview-pdf"
            >
              {busy === 'preview' ? t('export.generating') : t('export.preview')}
            </button>
          </div>
          {preview && (
            <iframe
              title={t('export.preview')}
              src={preview}
              className="mt-5 h-[36rem] w-full rounded-2xl border border-line bg-white"
            />
          )}
        </section>

        <section className="card">
          <h2 className="text-2xl font-bold">{t('export.fhirTitle')}</h2>
          <p className="mt-2 text-muted">{t('export.fhirBody')}</p>
          <button
            type="button"
            className="btn-primary mt-5"
            onClick={fhir}
            disabled={busy !== null}
            data-testid="download-fhir"
          >
            {busy === 'fhir' ? t('export.generating') : t('export.fhirButton')}
          </button>
        </section>

        <section className="card" aria-labelledby="card-title">
          <h2 id="card-title" className="text-2xl font-bold">
            {t('export.cardTitle')}
          </h2>
          <p className="mt-2 text-muted">{t('export.cardBody')}</p>
          {url && (
            <div className="mt-5">
              <WalletCard answers={answers} url={url} />
            </div>
          )}
          <p className="mt-4 text-sm text-muted">
            {share ? t('export.cardShareLink') : t('export.cardLocal')}
          </p>
          <p className="mt-1 text-sm text-muted">{t('export.cardNotice')}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              className="btn-primary"
              onClick={card}
              disabled={busy !== null || !url}
              data-testid="download-card"
            >
              {busy === 'card' ? t('export.generating') : t('export.cardButton')}
            </button>
            {account.status === 'signed-in' && (
              <button
                type="button"
                className="btn-secondary"
                onClick={saveShare}
                disabled={busy !== null}
                data-testid="share-link"
              >
                {busy === 'share'
                  ? t('export.generating')
                  : share
                    ? t('account.shareUpdate')
                    : t('account.shareCreate')}
              </button>
            )}
            {account.status === 'signed-in' && share && (
              <button
                type="button"
                className="btn-quiet"
                onClick={() => run('share', account.deleteShare)}
                disabled={busy !== null}
              >
                {t('account.shareDelete')}
              </button>
            )}
          </div>
        </section>

        <section className="card">
          <h2 className="text-xl font-bold">{t('export.jsonTitle')}</h2>
          <p className="mt-2 text-muted">{t('export.jsonBody')}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              className="btn-secondary"
              onClick={backup}
              data-testid="download-backup"
            >
              {t('export.jsonButton')}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => fileInput.current?.click()}
            >
              {t('export.importButton')}
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              aria-label={t('export.importButton')}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void importBackup(file);
                e.target.value = '';
              }}
            />
          </div>
        </section>

        <section className="rounded-3xl border-2 border-dashed border-line p-6">
          <h2 className="text-xl font-bold">{t('export.deleteTitle')}</h2>
          <p className="mt-2 text-muted">{t('export.deleteBody')}</p>
          <button type="button" className="btn-danger mt-4" onClick={deleteLocal}>
            {t('export.deleteButton')}
          </button>
        </section>
      </div>
    </div>
  );
}
