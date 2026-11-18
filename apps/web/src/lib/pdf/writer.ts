import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';

export interface FontBytes {
  regular: Uint8Array | ArrayBuffer;
  bold: Uint8Array | ArrayBuffer;
}

export interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
}

export const COLORS = {
  ink: rgb(0.12, 0.16, 0.2),
  muted: rgb(0.36, 0.4, 0.45),
  brand: rgb(0.12, 0.37, 0.36),
  brandSoft: rgb(0.91, 0.95, 0.94),
  line: rgb(0.62, 0.66, 0.7),
  white: rgb(1, 1, 1),
};

/** US Letter, in points. */
export const PAGE = { width: 612, height: 792, margin: 60 };

export async function embedFonts(doc: PDFDocument, bytes: FontBytes): Promise<Fonts> {
  doc.registerFontkit(fontkit);
  const [regular, bold] = await Promise.all([
    doc.embedFont(bytes.regular, { subset: true }),
    doc.embedFont(bytes.bold, { subset: true }),
  ]);
  return { regular, bold };
}

/** Normalizes user text so it measures and draws predictably. */
export function cleanText(text: string): string {
  return (
    text
      .replace(/\r\n?/g, '\n')
      .replace(/\t/g, '  ')
      // eslint-disable-next-line no-control-regex -- strip control characters the font can't draw
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
  );
}

/** Greedy word wrap. Breaks words longer than the line. */
export function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of cleanText(text).split('\n')) {
    const words = paragraph.split(/ +/).filter((w) => w.length > 0);
    if (words.length === 0) {
      lines.push('');
      continue;
    }
    let line = '';
    for (let word of words) {
      while (font.widthOfTextAtSize(word, size) > maxWidth) {
        // split very long words (URLs, IDs) across lines
        let cut = word.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(word.slice(0, cut), size) > maxWidth) cut--;
        if (line) {
          lines.push(line);
          line = '';
        }
        lines.push(word.slice(0, cut));
        word = word.slice(cut);
      }
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

interface TextOptions {
  size?: number;
  bold?: boolean;
  color?: RGB;
  indent?: number;
  gapAfter?: number;
  lineHeight?: number;
}

/**
 * A small flowing-layout helper on top of pdf-lib: it tracks the cursor,
 * wraps text, and starts new pages as needed.
 */
export class PdfWriter {
  readonly doc: PDFDocument;
  readonly fonts: Fonts;
  page!: PDFPage;
  y = 0;
  /** Text drawn at the top of each page started after this is set. */
  header = '';
  private readonly pages: { page: PDFPage; footer: string }[] = [];
  footer = '';

  constructor(doc: PDFDocument, fonts: Fonts) {
    this.doc = doc;
    this.fonts = fonts;
  }

  get contentWidth(): number {
    return PAGE.width - PAGE.margin * 2;
  }

  newPage(): this {
    this.page = this.doc.addPage([PAGE.width, PAGE.height]);
    this.pages.push({ page: this.page, footer: this.footer });
    this.y = PAGE.height - PAGE.margin;
    if (this.header) {
      this.page.drawText(this.header, {
        x: PAGE.margin,
        y: PAGE.height - 36,
        size: 8.5,
        font: this.fonts.regular,
        color: COLORS.muted,
      });
    }
    return this;
  }

  /** Starts a new page when fewer than `height` points remain. */
  ensure(height: number): this {
    if (!this.page || this.y - height < PAGE.margin + 18) this.newPage();
    return this;
  }

  space(points: number): this {
    this.y -= points;
    return this;
  }

  text(text: string, opts: TextOptions = {}): this {
    const size = opts.size ?? 11;
    const font = opts.bold ? this.fonts.bold : this.fonts.regular;
    const indent = opts.indent ?? 0;
    const lineHeight = opts.lineHeight ?? size * 1.38;
    const lines = wrapText(text, font, size, this.contentWidth - indent);
    for (const line of lines) {
      this.ensure(lineHeight);
      this.y -= lineHeight;
      if (line) {
        this.page.drawText(line, {
          x: PAGE.margin + indent,
          y: this.y + (lineHeight - size) / 2,
          size,
          font,
          color: opts.color ?? COLORS.ink,
        });
      }
    }
    this.y -= opts.gapAfter ?? 6;
    return this;
  }

  heading(text: string, level: 1 | 2 | 3 = 2): this {
    const size = level === 1 ? 20 : level === 2 ? 14.5 : 12;
    this.ensure(size * 3);
    if (level !== 1) this.space(level === 2 ? 10 : 4);
    return this.text(text, {
      size,
      bold: true,
      color: level === 3 ? COLORS.ink : COLORS.brand,
      gapAfter: level === 1 ? 4 : 6,
    });
  }

  bullets(items: string[], opts: TextOptions = {}): this {
    const size = opts.size ?? 11;
    for (const item of items) {
      const lines = wrapText(
        item,
        this.fonts.regular,
        size,
        this.contentWidth - 18 - (opts.indent ?? 0),
      );
      const lineHeight = size * (size < 10.5 ? 1.32 : 1.38);
      lines.forEach((line, i) => {
        this.ensure(lineHeight);
        this.y -= lineHeight;
        if (i === 0) {
          this.page.drawText('•', {
            x: PAGE.margin + (opts.indent ?? 0) + 4,
            y: this.y + (lineHeight - size) / 2,
            size,
            font: this.fonts.bold,
            color: COLORS.brand,
          });
        }
        this.page.drawText(line, {
          x: PAGE.margin + (opts.indent ?? 0) + 18,
          y: this.y + (lineHeight - size) / 2,
          size,
          font: this.fonts.regular,
          color: COLORS.ink,
        });
      });
      this.y -= size < 10.5 ? 1 : 2;
    }
    this.y -= 4;
    return this;
  }

  /** A line with an empty checkbox in front, for checklists people tick on paper. */
  check(text: string, opts: TextOptions = {}): this {
    const size = opts.size ?? 11;
    const lineHeight = size * 1.38;
    const lines = wrapText(text, this.fonts.regular, size, this.contentWidth - 22);
    lines.forEach((line, i) => {
      this.ensure(lineHeight);
      this.y -= lineHeight;
      const baseline = this.y + (lineHeight - size) / 2;
      if (i === 0) {
        this.page.drawRectangle({
          x: PAGE.margin + 1,
          y: baseline - 1,
          width: 10,
          height: 10,
          borderColor: COLORS.brand,
          borderWidth: 1,
        });
      }
      this.page.drawText(line, {
        x: PAGE.margin + 22,
        y: baseline,
        size,
        font: this.fonts.regular,
        color: COLORS.ink,
      });
    });
    this.y -= opts.gapAfter ?? 4;
    return this;
  }

  /** A shaded box with text, used for notes and instructions. */
  callout(lines: string[], opts: { size?: number } = {}): this {
    const size = opts.size ?? 10;
    const pad = 10;
    const wrapped = lines.flatMap((l) =>
      wrapText(l, this.fonts.regular, size, this.contentWidth - pad * 2),
    );
    const lineHeight = size * 1.4;
    const height = wrapped.length * lineHeight + pad * 2;
    this.ensure(Math.min(height, 300));
    if (height > this.y - PAGE.margin - 18) {
      // too tall for a box: fall back to plain text
      for (const l of lines) this.text(l, { size, color: COLORS.muted });
      return this;
    }
    this.page.drawRectangle({
      x: PAGE.margin,
      y: this.y - height,
      width: this.contentWidth,
      height,
      color: COLORS.brandSoft,
    });
    this.page.drawRectangle({
      x: PAGE.margin,
      y: this.y - height,
      width: 3,
      height,
      color: COLORS.brand,
    });
    let y = this.y - pad;
    for (const line of wrapped) {
      y -= lineHeight;
      this.page.drawText(line, {
        x: PAGE.margin + pad + 4,
        y: y + (lineHeight - size) / 2,
        size,
        font: this.fonts.regular,
        color: COLORS.ink,
      });
    }
    this.y -= height + 10;
    return this;
  }

  /** A labeled line to sign or write on, optionally prefilled. */
  field(
    label: string,
    value = '',
    opts: { width?: number; x?: number; keepY?: boolean } = {},
  ): this {
    const width = opts.width ?? this.contentWidth;
    const x = PAGE.margin + (opts.x ?? 0);
    const rowHeight = 34;
    if (!opts.keepY) this.ensure(rowHeight);
    const baseline = this.y - 20;
    if (value) {
      this.page.drawText(wrapText(value, this.fonts.regular, 11, width)[0] ?? '', {
        x: x + 2,
        y: baseline + 4,
        size: 11,
        font: this.fonts.regular,
        color: COLORS.ink,
      });
    }
    this.page.drawLine({
      start: { x, y: baseline },
      end: { x: x + width, y: baseline },
      thickness: 0.7,
      color: COLORS.line,
    });
    this.page.drawText(label, {
      x,
      y: baseline - 11,
      size: 8.5,
      font: this.fonts.regular,
      color: COLORS.muted,
    });
    if (!opts.keepY) this.y -= rowHeight;
    return this;
  }

  /** Two fields side by side. */
  fieldRow(left: [string, string?], right: [string, string?], split = 0.62): this {
    this.ensure(34);
    const gap = 16;
    const leftWidth = (this.contentWidth - gap) * split;
    this.field(left[0], left[1], { width: leftWidth, keepY: true });
    this.field(right[0], right[1], {
      width: this.contentWidth - gap - leftWidth,
      x: leftWidth + gap,
      keepY: true,
    });
    this.y -= 34;
    return this;
  }

  rule(): this {
    this.ensure(12);
    this.y -= 6;
    this.page.drawLine({
      start: { x: PAGE.margin, y: this.y },
      end: { x: PAGE.width - PAGE.margin, y: this.y },
      thickness: 0.5,
      color: COLORS.line,
    });
    this.y -= 8;
    return this;
  }

  /** Writes "Page X of Y" and each page's footer text. Call once, at the end. */
  finish(): void {
    const total = this.pages.length;
    this.pages.forEach(({ page, footer }, i) => {
      const label = `Page ${i + 1} of ${total}`;
      const size = 8.5;
      const width = this.fonts.regular.widthOfTextAtSize(label, size);
      page.drawText(label, {
        x: PAGE.width - PAGE.margin - width,
        y: 30,
        size,
        font: this.fonts.regular,
        color: COLORS.muted,
      });
      if (footer) {
        const text =
          wrapText(footer, this.fonts.regular, size, this.contentWidth - width - 20)[0] ?? '';
        page.drawText(text, {
          x: PAGE.margin,
          y: 30,
          size,
          font: this.fonts.regular,
          color: COLORS.muted,
        });
      }
    });
  }
}

export async function createDocument(
  fontBytes: FontBytes,
): Promise<{ doc: PDFDocument; writer: PdfWriter }> {
  const doc = await PDFDocument.create();
  const fonts = await embedFonts(doc, fontBytes);
  return { doc, writer: new PdfWriter(doc, fonts) };
}
