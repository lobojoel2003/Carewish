/**
 * Generates the person's files in the browser. PDF and FHIR code is loaded on
 * demand so the wizard stays light.
 */
import { englishT, fixedT, type Lang } from '@/i18n';
import type { Answers } from './answers';
import { cardUrl, encodeCard, shareUrl, summarize } from './card';
import { loadFonts, siteOrigin } from './files';
import { VERSION } from './version';

export async function directivePdf(answers: Answers): Promise<Uint8Array> {
  const [{ buildDirectivePdf }, fonts] = await Promise.all([
    import('./pdf/directive'),
    loadFonts(),
  ]);
  return buildDirectivePdf(answers, { fonts, t: englishT(), appVersion: VERSION });
}

export async function fhirBundleJson(answers: Answers, lang: Lang): Promise<string> {
  const { buildAdiBundle } = await import('./fhir/bundle');
  return JSON.stringify(
    buildAdiBundle(answers, { t: englishT(), lang, appVersion: VERSION }),
    null,
    2,
  );
}

export async function cardLink(
  answers: Answers,
  lang: Lang,
  share?: { id: string; key: string },
): Promise<string> {
  if (share) return shareUrl(siteOrigin(), share.id, share.key);
  return cardUrl(siteOrigin(), await encodeCard(summarize(answers, lang)));
}

export async function walletCardPdf(
  answers: Answers,
  lang: Lang,
  url: string,
  fullDocument: boolean,
): Promise<Uint8Array> {
  const [{ buildWalletCardPdf }, fonts] = await Promise.all([import('./pdf/card'), loadFonts()]);
  return buildWalletCardPdf(answers, {
    fonts,
    url,
    t: fixedT(lang),
    tEn: englishT(),
    lang,
    fullDocument,
  });
}

export interface SharePayload {
  v: 1;
  answers: Answers;
  lang: Lang;
  /** Base64 PDF */
  pdf: string;
  fhir: string;
}

export async function sharePayload(answers: Answers, lang: Lang): Promise<Uint8Array> {
  const [{ toBase64 }, pdf, fhir] = await Promise.all([
    import('./encoding'),
    directivePdf(answers),
    fhirBundleJson(answers, lang),
  ]);
  const payload: SharePayload = { v: 1, answers, lang, pdf: toBase64(pdf), fhir };
  return new TextEncoder().encode(JSON.stringify(payload));
}
