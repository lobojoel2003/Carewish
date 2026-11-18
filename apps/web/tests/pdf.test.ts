import { listStates } from '@carewish/form-rules';
import { type PDFCheckBox, PDFDocument, type PDFTextField, StandardFonts } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { englishT, fixedT } from '@/i18n';
import { fillTemplate, templateValues } from '@/lib/pdf/acroform';
import { buildWalletCardPdf } from '@/lib/pdf/card';
import { buildDirectivePdf, directiveFileName } from '@/lib/pdf/directive';
import { cleanText, wrapText } from '@/lib/pdf/writer';
import { NOW, fonts, fullAnswers } from './fixtures';

const t = englishT();

async function load(bytes: Uint8Array) {
  return PDFDocument.load(bytes, { updateMetadata: false });
}

describe('wrapText', () => {
  it('wraps words and splits very long words', async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const lines = wrapText('one two three four five six seven', font, 12, 60);
    expect(lines.length).toBeGreaterThan(2);
    for (const l of lines) expect(font.widthOfTextAtSize(l, 12)).toBeLessThanOrEqual(60);
    const long = wrapText('x'.repeat(200), font, 12, 50);
    expect(long.length).toBeGreaterThan(3);
    expect(wrapText('a\n\nb', font, 12, 100)).toEqual(['a', '', 'b']);
  });

  it('cleans control characters', () => {
    expect(cleanText('a\tb\r\nc\u0007')).toBe('a  b\nc');
  });
});

describe('directive PDF', () => {
  it('builds California with instructions, signatures and metadata', async () => {
    const bytes = await buildDirectivePdf(fullAnswers('CA'), {
      fonts,
      t,
      now: NOW,
      appVersion: '1.0.0',
    });
    const doc = await load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(4);
    expect(doc.getTitle()).toBe('Maria Elena Torres — California Advance Directive');
    expect(doc.getSubject()).toBe('Advance Health Care Directive');
    expect(doc.getCreator()).toBe('Carewish 1.0.0');
    expect(doc.getPage(0).getSize()).toEqual({ width: 612, height: 792 });
  });

  it('includes both Texas documents', async () => {
    const doc = await load(await buildDirectivePdf(fullAnswers('TX'), { fonts, t, now: NOW }));
    expect(doc.getSubject()).toBe(
      'Medical Power of Attorney; Directive to Physicians and Family or Surrogates',
    );
  });

  it('handles people with no agent and no address', async () => {
    const answers = fullAnswers('MA', {
      agent: undefined,
      alternate: undefined,
      address: undefined,
      physician: undefined,
    });
    const doc = await load(await buildDirectivePdf(answers, { fonts, t, now: NOW }));
    expect(doc.getSubject()).toBe('Statement of My Health Care Wishes');
  });

  it('builds for every state and DC', async () => {
    for (const s of listStates()) {
      const bytes = await buildDirectivePdf(fullAnswers(s.code), { fonts, t, now: NOW });
      expect(bytes.length, s.code).toBeGreaterThan(10_000);
    }
  });

  it('requires a state', async () => {
    await expect(buildDirectivePdf({ version: 1 }, { fonts, t })).rejects.toThrow(/state/);
  });

  it('names files predictably', () => {
    expect(directiveFileName(fullAnswers('NY'), 'maria')).toBe(
      'carewish-maria-ny-advance-directive.pdf',
    );
  });

  it('fills an official AcroForm template when a state provides one', async () => {
    const template = await PDFDocument.create();
    template.addPage();
    const form = template.getForm();
    form.createTextField('AgentName').addToPage(template.getPage(0), { x: 50, y: 700 });
    form.createCheckBox('Organs').addToPage(template.getPage(0), { x: 50, y: 650 });
    const templateBytes = await template.save();

    const state = (await import('@carewish/form-rules')).requireState('CA');
    const withTemplate = structuredClone(state);
    withTemplate.documents[0]!.template = {
      file: 'ca.pdf',
      fields: { 'agent.name': 'AgentName', 'organ.any': 'Organs' },
    };
    const { planDocuments } = await import('@/lib/plan');
    const plan = planDocuments(fullAnswers('CA'), withTemplate)!;
    expect(plan.documents[0]!.template?.file).toBe('ca.pdf');

    const report = { filled: [] as string[], missing: [] as string[] };
    const values = templateValues(fullAnswers('CA'), { t, lang: 'en', state });
    const filled = await load(
      await fillTemplate(
        templateBytes,
        { 'agent.name': 'AgentName', 'organ.any': 'Organs', other: 'Missing' },
        values,
        report,
      ),
    );
    expect((filled.getForm().getField('AgentName') as PDFTextField).getText()).toBe(
      'Daniel Torres',
    );
    expect((filled.getForm().getField('Organs') as PDFCheckBox).isChecked()).toBe(true);
    expect(report).toEqual({ filled: ['AgentName', 'Organs'], missing: ['Missing'] });
  });
});

describe('wallet card PDF', () => {
  it('builds a printable sheet in English and Spanish', async () => {
    for (const lang of ['en', 'es'] as const) {
      const bytes = await buildWalletCardPdf(fullAnswers('CA'), {
        fonts,
        url: 'https://carewish.example/card#abc',
        t: fixedT(lang),
        tEn: t,
        lang,
        now: NOW,
      });
      const doc = await load(bytes);
      expect(doc.getPageCount()).toBe(1);
      expect(doc.getTitle()).toContain('wallet card');
    }
  });

  it('works without an agent', async () => {
    const bytes = await buildWalletCardPdf(
      fullAnswers('FL', { agent: undefined, alternate: undefined }),
      {
        fonts,
        url: 'https://carewish.example/v/x#k=y',
        t,
        tEn: t,
        lang: 'en',
        fullDocument: true,
      },
    );
    expect(bytes.length).toBeGreaterThan(5000);
  });
});
