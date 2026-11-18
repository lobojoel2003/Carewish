import {
  agentTerm,
  describeStep,
  localize,
  signingChecklist,
  signingSummary,
  translate,
  type DocumentRules,
  type StateRules,
  type WitnessAttribute,
} from '@carewish/form-rules';
import type { Translate } from '@/i18n';
import { PDFDocument } from 'pdf-lib';
import { hasAgent, hasAlternate, type Answers, type Person } from '../answers';
import { planDocuments } from '../plan';
import { formatDate, sectionBlocks, type Block, type StatementContext } from '../statements';
import { fillTemplate, templateValues } from './acroform';
import { COLORS, createDocument, type FontBytes, type PdfWriter } from './writer';

/** How each witness attribute reads in a witness's sworn statement. */
const WITNESS_PHRASES: Record<WitnessAttribute, string> = {
  agent: "named in this document as the principal's {agent} or alternate {agent}",
  spouse: "the principal's spouse or registered domestic partner",
  'immediate-family': "the principal's spouse, parent, child, grandchild, brother, or sister",
  'relative-within-third-degree':
    "related within the third degree to the principal or to the principal's spouse",
  'blood-relative': 'related to the principal by blood or adoption',
  'relative-by-marriage': 'related to the principal by marriage',
  relative: 'related to the principal by blood, marriage, or adoption',
  heir: "entitled to any part of the principal's estate under a will or by operation of law",
  beneficiary:
    "a beneficiary of the principal's life insurance, or otherwise entitled to gain financially from the principal's death",
  creditor: "a person with a claim against any part of the principal's estate",
  'financially-responsible': "directly financially responsible for the principal's health care",
  physician: 'a physician',
  'attending-physician': "the principal's attending physician",
  'healthcare-provider': 'a health care provider now treating the principal',
  'provider-employee': "an employee of the principal's attending physician or health care provider",
  'facility-operator':
    'an owner or operator of a health care facility, nursing home, or residential care facility where the principal is a patient or resident',
  'facility-employee':
    'an employee of a health care facility, nursing home, or residential care facility where the principal is a patient or resident',
  'insurer-employee': "an employee of the principal's life or health insurance provider",
  'signed-for-principal': "the person who signed this document on the principal's behalf",
};

export interface DirectivePdfOptions {
  fonts: FontBytes;
  /** English translator. */
  t: Translate;
  now?: Date;
  appVersion?: string;
  /** Official fillable PDFs keyed by the file name in a document's `template`. */
  templates?: Record<string, Uint8Array>;
}

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

function renderBlocks(
  w: PdfWriter,
  blocks: Block[],
  t: Translate,
  relationshipLabel: (p: Person) => string,
): void {
  const none = t('statements.none');
  for (const b of blocks) {
    switch (b.kind) {
      case 'paragraph':
        w.text(b.text);
        break;
      case 'choice':
        w.text(b.intro, { bold: true, gapAfter: 2 });
        w.text(b.text ?? none, { indent: 14, color: b.text ? COLORS.ink : COLORS.muted });
        break;
      case 'list':
        w.text(b.intro, { bold: true, gapAfter: 2 });
        w.bullets(b.items, { indent: 4 });
        break;
      case 'free-text':
        w.text(b.intro, { bold: true, gapAfter: 2 });
        w.text(b.text ?? none, { indent: 14, color: b.text ? COLORS.ink : COLORS.muted });
        break;
      case 'person':
        if (!b.person) {
          w.text(b.empty, { color: COLORS.muted });
          break;
        }
        w.text(b.intro, { gapAfter: 2 });
        if (b.role === 'physician') {
          w.fieldRow(['Name', b.person.name], ['Phone', b.person.phone ?? '']);
        } else {
          w.fieldRow(['Name', b.person.name], ['Relationship', relationshipLabel(b.person)]);
          w.fieldRow(['Phone', b.person.phone ?? ''], ['Email', b.person.email ?? ''], 0.45);
          w.field('Address', b.person.address ?? '');
        }
        w.space(4);
        break;
    }
  }
}

function instructionsPage(
  w: PdfWriter,
  answers: Answers,
  state: StateRules,
  docs: DocumentRules[],
  t: Translate,
): void {
  w.header = 'Signing instructions — not part of your advance directive';
  w.footer = 'Carewish · legal information, not legal advice';
  w.newPage();
  w.heading(`How to sign your ${state.name} advance directive`, 1);
  w.callout([
    'Read this page first. It is not part of your advance directive, and you may remove it after you sign.',
    'Your directive only counts if it is signed the way your state requires. Do not sign it until you are with the people listed below.',
  ]);

  for (const doc of docs) {
    w.heading(doc.title, 2);
    w.text(
      `${doc.citation} · ${translate('en', `methodShort.${doc.execution.method}`, { count: signingSummary(doc).witnesses })}`,
      {
        size: 9.5,
        color: COLORS.muted,
      },
    );
    for (const step of signingChecklist(doc)) {
      const lines = describeStep(step, state, 'en');
      let bullets: string[] = [];
      const flush = () => {
        if (bullets.length) w.bullets(bullets, { indent: 22, size: 9.5 });
        bullets = [];
      };
      lines.forEach((line, i) => {
        if (line.startsWith('• ')) return void bullets.push(line.slice(2));
        flush();
        if (i === 0) w.check(line, { size: 10.5, gapAfter: 2 });
        else w.text(line, { indent: 22, gapAfter: 1, size: 10, bold: true });
      });
      flush();
    }
  }

  const witnesses = (answers.witnesses ?? []).map((x) => x.name).filter(Boolean);
  if (witnesses.length)
    w.text(`Witnesses you plan to ask: ${witnesses.join(', ')}.`, { color: COLORS.muted });
  if (state.notes?.length) {
    w.heading('Good to know', 3);
    w.bullets(
      state.notes.map((n) => localize(n, 'en')),
      { size: 9.5 },
    );
  }

  const agent = agentTerm(state, 'en');
  w.heading('After you sign', 3);
  w.bullets(
    ['copies', 'original', 'record', 'card', 'review'].map((k) => t(`sign.after.${k}`, { agent })),
    { size: 9.5 },
  );
  w.text(
    `Rules last checked ${state.review.lastChecked}. Sources: ${state.sources.map((s) => s.citation).join('; ')}. ` +
      'These rules were compiled from state law and are still being reviewed. If a lawyer, your hospital, or your state’s official instructions say something different, follow them.',
    { size: 8, color: COLORS.muted, lineHeight: 10 },
  );
}

function signatureSection(
  w: PdfWriter,
  doc: DocumentRules,
  state: StateRules,
  answers: Answers,
): void {
  const ex = doc.execution;
  const agent = agentTerm(state, 'en');
  const name = answers.name?.trim() ?? '';
  const cityState = [answers.address?.city, state.code].filter(Boolean).join(', ');

  w.ensure(160);
  w.heading('Signature', 2);
  w.text(
    'I sign this document on the date written below. I understand what it means, and I sign it voluntarily.',
  );
  w.fieldRow(['Signature'], ['Date']);
  w.fieldRow(['Printed name', name], ['City and state', cityState]);

  const withWitnesses =
    ex.method === 'witnesses' ||
    ex.method === 'witnesses-or-notary' ||
    ex.method === 'witnesses-and-notary';
  const withNotary =
    ex.method !== 'witnesses' && ex.method !== 'signature-only'
      ? true
      : Boolean(ex.notary?.recommended);
  const phrase = (a: WitnessAttribute) => WITNESS_PHRASES[a].replaceAll('{agent}', agent);

  if (withWitnesses && ex.witnesses) {
    const req = ex.witnesses;
    w.ensure(200);
    w.heading(
      ex.method === 'witnesses-or-notary'
        ? 'Statement of Witnesses (or use the notary acknowledgment)'
        : 'Statement of Witnesses',
      2,
    );
    w.text(
      `By signing below, each witness declares: The principal, ${name}, signed or acknowledged this document in my presence. ` +
        'The principal is personally known to me or showed me proof of identity, and appears to be of sound mind and under no duress, fraud, or undue influence. ' +
        `I am at least ${req.minAge} years old.`,
    );
    const each = req.rules.filter((r) => r.type === 'none-may-be').flatMap((r) => r.attributes);
    if (each.length) {
      w.text('Each witness also declares: I am not', { gapAfter: 2 });
      w.bullets(each.map(phrase), { size: 10 });
    }
    req.rules.forEach((rule) => {
      if (rule.type === 'at-least-one-not') {
        w.text('Witness 1 also declares: I am not', { gapAfter: 2 });
        w.bullets(rule.attributes.map(phrase), { size: 10 });
      } else if (rule.type === 'at-most-one') {
        w.text(
          `Only one witness may be ${rule.attributes.map(phrase).join(', or ')}. Witness 2 declares: I am not`,
          { gapAfter: 2 },
        );
        w.bullets(rule.attributes.map(phrase), { size: 10 });
      }
      if (rule.note) w.text(localize(rule.note, 'en'), { size: 9.5, color: COLORS.muted });
    });
    for (let i = 0; i < req.count; i++) {
      w.ensure(120);
      w.heading(`Witness ${i + 1}`, 3);
      w.fieldRow(['Signature'], ['Date']);
      w.fieldRow(['Printed name', answers.witnesses?.[i]?.name ?? ''], ['Phone']);
      w.field('Address');
    }
  }

  if (withNotary) {
    const label =
      ex.method === 'witnesses-or-notary'
        ? 'Notary Acknowledgment (use instead of witnesses)'
        : ex.method === 'witnesses' || ex.method === 'signature-only'
          ? 'Notary Acknowledgment (optional)'
          : 'Notary Acknowledgment';
    w.ensure(230);
    w.heading(label, 2);
    w.fieldRow([`State of`], ['County of'], 0.5);
    w.text(
      `On the date below, before me, the undersigned notary public, personally appeared ${name}, who proved to me on the basis of satisfactory evidence ` +
        'to be the person whose name is signed on this document, and who acknowledged that they signed it voluntarily.',
    );
    w.fieldRow(['Signature of notary public'], ['Date']);
    w.fieldRow(['Printed name of notary'], ['My commission expires']);
    w.text('(Seal)', { color: COLORS.muted });
    if (ex.notary?.disqualified?.length) {
      w.text('The notary must not be:', { size: 9.5, gapAfter: 2 });
      w.bullets(ex.notary.disqualified.map(phrase), { size: 9.5 });
    }
    w.text(
      [
        ex.notary?.note ? localize(ex.notary.note, 'en') : '',
        'A notary may attach their own certificate of acknowledgment instead of using this one.',
      ]
        .filter(Boolean)
        .join(' '),
      { size: 9, color: COLORS.muted },
    );
  }

  if (ex.agentAcceptance && hasAgent(answers)) {
    const people = [answers.agent!, ...(hasAlternate(answers) ? [answers.alternate!] : [])];
    w.ensure(200);
    w.heading(`Acceptance by ${titleCase(agent)}`, 2);
    w.text(
      `I accept this appointment as ${agent}. I will act in good faith and according to the principal's wishes as stated in this document or otherwise known to me, ` +
        "and in the principal's best interest. I understand that I may act only when the principal is unable to participate in their own medical decisions, " +
        'and that the principal may revoke this appointment at any time.',
    );
    w.text(`State law requires your ${agent} to sign this acceptance before acting for you.`, {
      size: 9.5,
      color: COLORS.muted,
    });
    for (const person of people) {
      w.ensure(80);
      w.fieldRow(['Signature', ''], ['Date']);
      w.field('Printed name', person.name);
    }
  }

  if (ex.special?.length) {
    w.callout(ex.special.map((s) => localize(s.text, 'en')));
  }
}

/** Generates the printable directive: signing instructions followed by each state document. */
export async function buildDirectivePdf(
  answers: Answers,
  opts: DirectivePdfOptions,
): Promise<Uint8Array> {
  const plan = planDocuments(answers);
  if (!plan) throw new Error('A state is required to build the PDF.');
  const { state, documents, appendix, appendixDocumentId } = plan;
  const now = opts.now ?? new Date();
  const t = opts.t;
  const ctx: StatementContext = { t, lang: 'en', state };
  const agent = agentTerm(state, 'en');
  const name = answers.name?.trim() ?? '';
  const relLabel = (p: Person) => (p.relationship ? t(`relationship.${p.relationship}`) : '');

  const { doc, writer: w } = await createDocument(opts.fonts);
  instructionsPage(w, answers, state, documents, t);

  for (const rules of documents) {
    const template = rules.template && opts.templates?.[rules.template.file];
    if (template && rules.template) {
      const filled = await fillTemplate(
        template,
        rules.template.fields,
        templateValues(answers, ctx),
      );
      const source = await PDFDocument.load(filled);
      const pages = await doc.copyPages(source, source.getPageIndices());
      pages.forEach((p) => doc.addPage(p));
      continue;
    }

    w.header = `${state.name} · ${rules.title}`;
    w.footer = `${name} · Initials: ________`;
    w.newPage();
    w.heading(rules.title, 1);
    w.text(`State of ${state.name} · Prepared under ${rules.citation}`, {
      size: 9.5,
      color: COLORS.muted,
    });
    w.callout([
      'This is an important legal document. Before you sign it, make sure it says what you want. ' +
        'You can change or cancel it at any time while you are able to make your own decisions.',
    ]);

    const sections = rules.parts.flatMap((p) => p.sections);
    if (!sections.includes('principal'))
      renderBlocks(w, sectionBlocks('principal', answers, ctx), t, relLabel);

    for (const part of rules.parts) {
      w.heading(part.title, 2);
      for (const section of part.sections)
        renderBlocks(w, sectionBlocks(section, answers, ctx), t, relLabel);
    }

    if (appendixDocumentId === rules.id && appendix.length) {
      w.heading(t('statements.appendixTitle'), 2);
      w.callout([t('statements.appendixIntro', { agent })]);
      for (const section of appendix)
        renderBlocks(w, sectionBlocks(section, answers, ctx), t, relLabel);
    }

    signatureSection(w, rules, state, answers);
  }

  w.finish();
  doc.setTitle(`${name} — ${state.name} Advance Directive`);
  doc.setAuthor(name);
  doc.setSubject(documents.map((d) => d.title).join('; '));
  doc.setKeywords(['advance directive', state.code, ...documents.map((d) => d.id)]);
  doc.setCreator(`Carewish ${opts.appVersion ?? ''}`.trim());
  doc.setProducer('Carewish (pdf-lib)');
  doc.setCreationDate(now);
  doc.setModificationDate(now);
  doc.setLanguage('en-US');
  return doc.save();
}

/** File-name friendly description for downloads. */
export function directiveFileName(answers: Answers, slug: string): string {
  return `carewish-${slug}-${(answers.state ?? 'us').toLowerCase()}-advance-directive.pdf`;
}

export { formatDate };
