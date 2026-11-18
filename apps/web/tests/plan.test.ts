import { describe, expect, it } from 'vitest';
import { STANDALONE_WISHES_ID, planDocuments } from '@/lib/plan';
import { englishT } from '@/i18n';
import { blocksToLines, formatDate, sectionBlocks, sectionHasContent } from '@/lib/statements';
import { requireState, SECTION_IDS } from '@carewish/form-rules';
import { fullAnswers } from './fixtures';

describe('planDocuments', () => {
  it('needs a state', () => {
    expect(planDocuments({ version: 1 })).toBeUndefined();
  });

  it('uses the single combined California form with no appendix', () => {
    const plan = planDocuments(fullAnswers('CA'))!;
    expect(plan.documents.map((d) => d.id)).toEqual(['advance-health-care-directive']);
    expect(plan.appendix).toEqual([]);
  });

  it('uses both Texas documents and appends what they lack', () => {
    const plan = planDocuments(fullAnswers('TX'))!;
    expect(plan.documents.map((d) => d.id)).toEqual([
      'medical-power-of-attorney',
      'directive-to-physicians',
    ]);
    expect(plan.appendix).toEqual(['organ-donation', 'physician']);
    expect(plan.appendixDocumentId).toBe('directive-to-physicians');
  });

  it('skips the Florida surrogate designation without an agent', () => {
    const plan = planDocuments(fullAnswers('FL', { agent: undefined, alternate: undefined }))!;
    expect(plan.documents.map((d) => d.id)).toEqual(['living-will']);
  });

  it('creates a signed statement of wishes in Massachusetts without an agent', () => {
    const plan = planDocuments(fullAnswers('MA', { agent: undefined, alternate: undefined }))!;
    expect(plan.documents[0]!.id).toBe(STANDALONE_WISHES_ID);
    expect(plan.documents[0]!.execution).toEqual(requireState('MA').documents[0]!.execution);
    expect(plan.appendix).toContain('life-sustaining');
  });

  it('falls back to the first document when nothing is filled in', () => {
    expect(planDocuments({ version: 1, state: 'NY' })!.documents.map((d) => d.id)).toEqual([
      'health-care-proxy',
    ]);
  });
});

describe('statements', () => {
  const t = englishT();
  const ctx = { t, lang: 'en', state: requireState('MI') };

  it('uses the state term for the agent', () => {
    const lines = blocksToLines(sectionBlocks('agent', fullAnswers('MI'), ctx), '');
    expect(lines[0]).toBe(
      'I choose the following person as my patient advocate to make health care decisions for me:',
    );
    expect(lines[1]).toContain('Daniel Torres');
  });

  it('writes the principal statement with and without an address', () => {
    expect(sectionBlocks('principal', fullAnswers(), ctx)[0]).toEqual({
      kind: 'paragraph',
      text: 'I, Maria Elena Torres, born March 4, 1956, of 12 Oak St, Fresno, CA 93701, make this document of my own free will.',
    });
    const noAddress = sectionBlocks('principal', fullAnswers('MI', { address: undefined }), ctx)[0];
    expect(noAddress).toMatchObject({
      text: 'I, Maria Elena Torres, born March 4, 1956, make this document of my own free will.',
    });
  });

  it('states limited authority', () => {
    const lines = blocksToLines(
      sectionBlocks('agent-authority', fullAnswers('MI', { agentAuthority: 'no' }), ctx),
      '',
    );
    expect(lines.join(' ')).toContain('may NOT decide');
  });

  it('marks unanswered choices', () => {
    const lines = blocksToLines(sectionBlocks('cpr', { version: 1 }, ctx), 'NONE');
    expect(lines).toEqual(['Cardiopulmonary resuscitation (CPR):', 'NONE']);
  });

  it('includes specific organ donations', () => {
    const blocks = sectionBlocks(
      'organ-donation',
      fullAnswers('MI', { organ: 'specific', organDetail: 'kidneys, corneas' }),
      ctx,
    );
    expect(blocks[0]).toMatchObject({
      text: 'I give only the following organs, tissues, or parts: kidneys, corneas',
    });
  });

  it('skips agent sections without an agent', () => {
    const none = { version: 1 as const };
    expect(sectionBlocks('alternate-agent', none, ctx)).toEqual([]);
    expect(sectionBlocks('agent-authority', none, ctx)).toEqual([]);
    expect(blocksToLines(sectionBlocks('agent', none, ctx), '')).toEqual([
      'I have not named a patient advocate in this document.',
    ]);
  });

  it('knows which sections have content', () => {
    for (const s of SECTION_IDS) expect(sectionHasContent(s, fullAnswers()), s).toBe(true);
    for (const s of SECTION_IDS.filter((x) => x !== 'principal'))
      expect(sectionHasContent(s, { version: 1 }), s).toBe(false);
  });

  it('formats dates per language', () => {
    expect(formatDate('1956-03-04', 'en')).toBe('March 4, 1956');
    expect(formatDate('1956-03-04', 'es')).toBe('4 de marzo de 1956');
    expect(formatDate(undefined, 'en')).toBe('');
    expect(formatDate('garbage', 'en')).toBe('garbage');
  });
});
