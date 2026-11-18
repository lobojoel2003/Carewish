import { agentTerm, getState } from '@carewish/form-rules';
import type { Translate } from '@/i18n';
import { rgb, type PDFPage } from 'pdf-lib';
import { hasAgent, hasAlternate, type Answers } from '../answers';
import { qrMatrix } from '../card';
import { formatDate } from '../statements';
import { COLORS, createDocument, wrapText, type FontBytes, type Fonts } from './writer';

const CARD = { width: 252, height: 144 }; // 3.5 × 2 inches

export interface WalletCardOptions {
  fonts: FontBytes;
  /** URL the QR code opens. */
  url: string;
  /** Translator in the person's language. */
  t: Translate;
  /** English translator, for the line every responder can read. */
  tEn: Translate;
  lang: string;
  /** True when the QR opens the full (encrypted) document rather than a summary. */
  fullDocument?: boolean;
  now?: Date;
}

function fit(text: string, fonts: Fonts, bold: boolean, size: number, width: number): string {
  return wrapText(text, bold ? fonts.bold : fonts.regular, size, width)[0] ?? '';
}

function drawFront(
  page: PDFPage,
  x: number,
  y: number,
  fonts: Fonts,
  a: Answers,
  o: WalletCardOptions,
): void {
  const state = a.state ? getState(a.state) : undefined;
  const agentEn = state ? agentTerm(state, 'en') : 'agent';
  const agentLocal = state ? agentTerm(state, o.lang) : o.t('rules:agentTerm.agent');
  const inner = CARD.width - 24;
  const band = o.lang === 'en' ? 30 : 38;

  page.drawRectangle({
    x,
    y: y + CARD.height - band,
    width: CARD.width,
    height: band,
    color: COLORS.brand,
  });
  page.drawText(o.tEn('card.front').toUpperCase(), {
    x: x + 12,
    y: y + CARD.height - 19,
    size: 9.5,
    font: fonts.bold,
    color: COLORS.white,
  });
  if (o.lang !== 'en') {
    page.drawText(fit(o.t('card.front'), fonts, false, 8, inner), {
      x: x + 12,
      y: y + CARD.height - 31,
      size: 8,
      font: fonts.regular,
      color: rgb(0.85, 0.94, 0.92),
    });
  }

  let cy = y + CARD.height - band - 20;
  page.drawText(fit(a.name ?? '', fonts, true, 13, inner), {
    x: x + 12,
    y: cy,
    size: 13,
    font: fonts.bold,
    color: COLORS.ink,
  });
  cy -= 13;
  const meta = [
    a.birthDate ? o.tEn('card.born', { date: formatDate(a.birthDate, 'en') }) : '',
    state?.name ?? '',
  ]
    .filter(Boolean)
    .join(' · ');
  page.drawText(fit(meta, fonts, false, 8, inner), {
    x: x + 12,
    y: cy,
    size: 8,
    font: fonts.regular,
    color: COLORS.muted,
  });

  if (hasAgent(a)) {
    cy -= 20;
    const label =
      o.tEn('card.agentLabel', { agent: agentEn }) +
      (o.lang !== 'en' ? ` · ${o.t('card.agentLabel', { agent: agentLocal })}` : '');
    page.drawText(fit(label.toUpperCase(), fonts, false, 7, inner), {
      x: x + 12,
      y: cy,
      size: 7,
      font: fonts.regular,
      color: COLORS.brand,
    });
    cy -= 13;
    const agentLine = [a.agent!.name, a.agent!.phone].filter(Boolean).join('  ·  ');
    page.drawText(fit(agentLine, fonts, true, 11, inner), {
      x: x + 12,
      y: cy,
      size: 11,
      font: fonts.bold,
      color: COLORS.ink,
    });
    if (hasAlternate(a)) {
      cy -= 12;
      const alt = `${o.tEn('card.backup')}: ${[a.alternate!.name, a.alternate!.phone].filter(Boolean).join(' · ')}`;
      page.drawText(fit(alt, fonts, false, 8, inner), {
        x: x + 12,
        y: cy,
        size: 8,
        font: fonts.regular,
        color: COLORS.ink,
      });
    }
  }
}

function drawBack(page: PDFPage, x: number, y: number, fonts: Fonts, o: WalletCardOptions): void {
  const matrix = qrMatrix(o.url);
  const box = 124;
  const quiet = 1;
  const unit = box / (matrix.size + quiet * 2);
  const qx = x + 10;
  const qy = y + (CARD.height - box) / 2;
  page.drawRectangle({ x: qx, y: qy, width: box, height: box, color: COLORS.white });
  for (let r = 0; r < matrix.size; r++) {
    for (let c = 0; c < matrix.size; c++) {
      if (!matrix.isDark(r, c)) continue;
      page.drawRectangle({
        x: qx + (c + quiet) * unit,
        y: qy + box - (r + quiet + 1) * unit,
        width: unit + 0.05,
        height: unit + 0.05,
        color: COLORS.ink,
      });
    }
  }

  const tx = qx + box + 10;
  const width = x + CARD.width - tx - 10;
  let ty = y + CARD.height - 34;
  for (const line of wrapText(o.tEn('card.scan'), fonts.bold, 10, width)) {
    page.drawText(line, { x: tx, y: ty, size: 10, font: fonts.bold, color: COLORS.ink });
    ty -= 12;
  }
  if (o.lang !== 'en') {
    for (const line of wrapText(o.t('card.scan'), fonts.regular, 8, width)) {
      page.drawText(line, { x: tx, y: ty, size: 8, font: fonts.regular, color: COLORS.muted });
      ty -= 10;
    }
  }
  ty -= 8;
  const prepared = formatDate((o.now ?? new Date()).toISOString().slice(0, 10), 'en');
  for (const line of wrapText(`Prepared ${prepared}`, fonts.regular, 7.5, width)) {
    page.drawText(line, { x: tx, y: ty, size: 7.5, font: fonts.regular, color: COLORS.muted });
    ty -= 9;
  }
  page.drawText(o.tEn('card.madeWith'), {
    x: tx,
    y: y + 14,
    size: 7,
    font: fonts.regular,
    color: COLORS.brand,
  });
}

/** A printable sheet with two fold-over wallet cards (one for you, one for your agent). */
export async function buildWalletCardPdf(a: Answers, o: WalletCardOptions): Promise<Uint8Array> {
  const { doc, writer } = await createDocument(o.fonts);
  const fonts = writer.fonts;
  const page = doc.addPage([612, 792]);
  const left = (612 - CARD.width * 2) / 2;
  const dash = { dashArray: [3, 3], thickness: 0.6, color: COLORS.line };

  page.drawText('Carewish wallet card', {
    x: left,
    y: 740,
    size: 16,
    font: fonts.bold,
    color: COLORS.brand,
  });
  page.drawText(
    'Cut along the solid outline. Fold along the dashed line so the front and back face out. Tape or laminate it.',
    {
      x: left,
      y: 722,
      size: 9,
      font: fonts.regular,
      color: COLORS.muted,
    },
  );

  [560, 360].forEach((top) => {
    const y = top - CARD.height;
    page.drawRectangle({
      x: left,
      y,
      width: CARD.width * 2,
      height: CARD.height,
      borderColor: COLORS.ink,
      borderWidth: 0.7,
    });
    page.drawLine({
      start: { x: left + CARD.width, y },
      end: { x: left + CARD.width, y: y + CARD.height },
      ...dash,
    });
    drawFront(page, left, y, fonts, a, o);
    drawBack(page, left + CARD.width, y, fonts, o);
  });

  const notice = o.tEn(o.fullDocument ? 'export.cardShareLink' : 'export.cardLocal');
  const privacy = o.tEn('export.cardNotice');
  let y = 170;
  for (const line of wrapText(`${notice} ${privacy}`, fonts.regular, 9, CARD.width * 2)) {
    page.drawText(line, { x: left, y, size: 9, font: fonts.regular, color: COLORS.muted });
    y -= 12;
  }

  doc.setTitle(`${a.name ?? ''} — Carewish wallet card`);
  doc.setCreator('Carewish');
  doc.setProducer('Carewish (pdf-lib)');
  return doc.save();
}
