import { describe, expect, it } from 'vitest';
import {
  evaluateNotary,
  evaluateWitnesses,
  expandAttributes,
  notaryNeed,
  relevantAttributes,
  requireState,
  witnessQuestions,
  type Execution,
} from '../src';

const ex = (code: string, i = 0): Execution => requireState(code).documents[i]!.execution;

describe('expandAttributes', () => {
  it('derives relationship attributes', () => {
    const a = expandAttributes({ relationship: 'child' });
    expect([...a]).toEqual(
      expect.arrayContaining([
        'immediate-family',
        'blood-relative',
        'relative',
        'relative-within-third-degree',
      ]),
    );
    expect(a.has('spouse')).toBe(false);
  });

  it('treats a cousin as a relative but not close family', () => {
    const a = expandAttributes({ relationship: 'cousin-or-distant' });
    expect(a.has('relative')).toBe(true);
    expect(a.has('relative-within-third-degree')).toBe(false);
    expect(a.has('immediate-family')).toBe(false);
  });

  it('applies implications transitively', () => {
    const a = expandAttributes({ attributes: ['attending-physician'] });
    expect(a.has('physician')).toBe(true);
    expect(a.has('healthcare-provider')).toBe(true);
    expect(expandAttributes({ attributes: ['spouse'] }).has('relative')).toBe(true);
  });

  it('returns nothing for a stranger', () => {
    expect(expandAttributes({}).size).toBe(0);
    expect(expandAttributes({ relationship: 'none' }).size).toBe(0);
  });
});

describe('evaluateWitnesses — California', () => {
  const ca = ex('CA');

  it('accepts two unrelated friends', () => {
    const r = evaluateWitnesses(ca, [{ name: 'Ana' }, { name: 'Ben' }]);
    expect(r.ok).toBe(true);
    expect(r.missing).toBe(0);
    expect(r.witnesses.map((w) => w.name)).toEqual(['Ana', 'Ben']);
  });

  it('rejects the agent as a witness', () => {
    const r = evaluateWitnesses(ca, [{ attributes: ['agent'] }, {}]);
    expect(r.ok).toBe(false);
    expect(r.witnesses[0]!.problems).toEqual([
      { kind: 'disqualified', ruleIndex: 0, attributes: ['agent'] },
    ]);
  });

  it('allows one relative but not two', () => {
    expect(evaluateWitnesses(ca, [{ relationship: 'sibling' }, {}]).ok).toBe(true);
    const r = evaluateWitnesses(ca, [{ relationship: 'sibling' }, { attributes: ['heir'] }]);
    expect(r.ok).toBe(false);
    expect(r.groupProblems).toEqual([
      { kind: 'need-one-who-is-not', ruleIndex: 1, attributes: ['relative', 'heir'] },
    ]);
  });

  it('hints about the second witness when the first is a relative', () => {
    const r = evaluateWitnesses(ca, [{ relationship: 'parent' }]);
    expect(r.ok).toBe(false);
    expect(r.missing).toBe(1);
    expect(r.hints).toEqual([{ ruleIndex: 1, attributes: ['relative', 'heir'] }]);
  });

  it('reports missing witnesses without hints when none are given', () => {
    const r = evaluateWitnesses(ca, []);
    expect(r).toMatchObject({ ok: false, missing: 2, hints: [], groupProblems: [] });
  });

  it('flags witnesses under the minimum age', () => {
    const r = evaluateWitnesses(ca, [{ age: 17 }, { age: 30 }]);
    expect(r.witnesses[0]!.problems).toEqual([{ kind: 'too-young', minAge: 18 }]);
    expect(r.ok).toBe(false);
  });
});

describe('evaluateWitnesses — other states', () => {
  it('Georgia allows only one facility employee', () => {
    const ga = ex('GA');
    expect(evaluateWitnesses(ga, [{ attributes: ['facility-employee'] }, {}]).ok).toBe(true);
    const r = evaluateWitnesses(ga, [
      { attributes: ['facility-employee'] },
      { attributes: ['facility-employee'] },
    ]);
    expect(r.groupProblems).toEqual([
      { kind: 'too-many', ruleIndex: 1, attributes: ['facility-employee'], witnesses: [0, 1] },
    ]);
    const hint = evaluateWitnesses(ga, [{ attributes: ['facility-employee'] }]);
    expect(hint.hints).toEqual([{ ruleIndex: 1, attributes: ['facility-employee'] }]);
  });

  it('Florida needs one witness who is not a spouse or blood relative', () => {
    const fl = ex('FL', 1);
    expect(evaluateWitnesses(fl, [{ relationship: 'spouse' }, { relationship: 'child' }]).ok).toBe(
      false,
    );
    expect(
      evaluateWitnesses(fl, [{ relationship: 'spouse' }, { relationship: 'in-law-or-step' }]).ok,
    ).toBe(true);
  });

  it('Virginia lets relatives witness', () => {
    expect(
      evaluateWitnesses(ex('VA'), [{ relationship: 'spouse' }, { relationship: 'child' }]).ok,
    ).toBe(true);
  });

  it('North Carolina rejects a niece but accepts a cousin', () => {
    const nc = ex('NC', 1);
    expect(evaluateWitnesses(nc, [{ relationship: 'aunt-uncle-niece-nephew' }, {}]).ok).toBe(false);
    expect(evaluateWitnesses(nc, [{ relationship: 'cousin-or-distant' }, {}]).ok).toBe(true);
  });

  it('Michigan rejects a grandchild but accepts a grandparent who will not inherit', () => {
    const mi = ex('MI');
    expect(evaluateWitnesses(mi, [{ relationship: 'grandchild' }, {}]).ok).toBe(false);
    expect(evaluateWitnesses(mi, [{ relationship: 'grandparent' }, {}]).ok).toBe(true);
  });

  it('does not require witnesses for notary-only or signature-only documents', () => {
    expect(evaluateWitnesses(ex('MO'), [])).toMatchObject({ required: false, ok: true, count: 0 });
    expect(evaluateWitnesses(ex('ID'), []).required).toBe(false);
  });
});

describe('notary rules', () => {
  it('classifies the need for a notary', () => {
    expect(notaryNeed(ex('MO'))).toBe('required');
    expect(notaryNeed(ex('NC'))).toBe('required');
    expect(notaryNeed(ex('CA'))).toBe('alternative');
    expect(notaryNeed(ex('ID'))).toBe('recommended');
    expect(notaryNeed(ex('FL'))).toBe('not-needed');
  });

  it('disqualifies a related notary in Kentucky', () => {
    const r = evaluateNotary(ex('KY'), { relationship: 'sibling' });
    expect(r).toEqual({ need: 'alternative', ok: false, disqualifiedBy: ['blood-relative'] });
    expect(evaluateNotary(ex('KY'), { attributes: ['facility-employee'] }).ok).toBe(true);
    expect(evaluateNotary(ex('FL'), {}).ok).toBe(true);
  });
});

describe('witness questions', () => {
  it('asks about relationships only when the rules mention them', () => {
    expect(witnessQuestions(ex('CA')).askRelationship).toBe(true);
    expect(witnessQuestions(ex('MA'))).toEqual({ askRelationship: false, attributes: ['agent'] });
    expect(witnessQuestions(ex('VA'))).toEqual({ askRelationship: false, attributes: [] });
  });

  it('includes notary disqualifications in relevant attributes', () => {
    expect(relevantAttributes(ex('MN'))).toContain('agent');
    expect(relevantAttributes(ex('KY'))).toContain('attending-physician');
  });
});
