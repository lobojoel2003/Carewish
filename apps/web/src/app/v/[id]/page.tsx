'use client';

import { isStateCode } from '@carewish/form-rules';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SectionView } from '@/components/review/Blocks';
import { Loading } from '@/components/ui/Fields';
import { api, ApiError } from '@/lib/api';
import { fileSlug, sanitizeAnswers, type Answers } from '@/lib/answers';
import { importShareKey, openBytes, type Sealed } from '@/lib/crypto';
import type { SharePayload } from '@/lib/documents';
import { fromBase64 } from '@/lib/encoding';
import { downloadBlob } from '@/lib/files';
import { planDocuments } from '@/lib/plan';
import { SHARE_AAD } from '@/state/account';

type View =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; payload: SharePayload; answers: Answers };

function SharedDocument({ answers, payload }: { answers: Answers; payload: SharePayload }) {
  const { t } = useTranslation();
  const plan = planDocuments(answers);
  const slug = fileSlug(answers.name);
  return (
    <div className="mx-auto max-w-3xl px-5 py-10" data-testid="shared-document">
      <p className="text-sm font-bold uppercase tracking-wide text-brand">{t('share.title')}</p>
      <h1 className="mt-2 text-3xl font-bold">{answers.name}</h1>
      <p className="mt-2 text-muted">{plan?.documents.map((d) => d.title).join(' · ')}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          className="btn-primary"
          onClick={() =>
            downloadBlob(
              fromBase64(payload.pdf) as BlobPart,
              `carewish-${slug}-advance-directive.pdf`,
              'application/pdf',
            )
          }
        >
          {t('share.download')}
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() =>
            downloadBlob(
              payload.fhir,
              `carewish-${slug}-advance-directive.fhir.json`,
              'application/fhir+json',
            )
          }
        >
          {t('share.downloadFhir')}
        </button>
      </div>
      <p className="mt-3 text-sm text-muted">{t('share.privacy')}</p>
      {plan?.documents.map((doc) => (
        <article key={doc.id} className="card mt-6">
          <h2 className="text-2xl font-bold">{doc.title}</h2>
          {doc.parts.map((part) => (
            <section key={part.title} className="mt-5">
              <h3 className="mb-3 text-lg font-bold text-brand-strong">{part.title}</h3>
              {part.sections.map((s) => (
                <SectionView key={s} section={s} answers={answers} editable={false} />
              ))}
            </section>
          ))}
        </article>
      ))}
    </div>
  );
}

export default function SharePage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [view, setView] = useState<View>({ status: 'loading' });

  useEffect(() => {
    const key = new URLSearchParams(window.location.hash.slice(1)).get('k');
    if (!key) {
      setView({ status: 'error', message: t('share.missingKey') });
      return;
    }
    (async () => {
      try {
        const sealed = await api<Sealed>(`/api/shares/${encodeURIComponent(id)}`);
        const bytes = await openBytes(await importShareKey(key), sealed, SHARE_AAD);
        const payload = JSON.parse(new TextDecoder().decode(bytes)) as SharePayload;
        const answers = sanitizeAnswers(payload.answers, isStateCode);
        if (payload.v !== 1 || !answers) throw new Error('bad payload');
        setView({ status: 'ready', payload, answers });
      } catch (error) {
        setView({
          status: 'error',
          message:
            error instanceof ApiError && error.status === 404
              ? t('share.notFound')
              : t('share.error'),
        });
      }
    })();
  }, [id, t]);

  if (view.status === 'loading') return <Loading label={t('share.loading')} />;
  if (view.status === 'error') {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16">
        <h1 className="text-2xl font-bold">{t('share.title')}</h1>
        <p className="mt-3" role="alert">
          {view.message}
        </p>
      </div>
    );
  }
  return <SharedDocument answers={view.answers} payload={view.payload} />;
}
