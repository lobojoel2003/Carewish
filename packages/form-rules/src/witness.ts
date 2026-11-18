import type {
  Execution,
  NotaryRequirements,
  Relationship,
  WitnessAttribute,
  WitnessCandidate,
  WitnessRule,
} from './types';

/** Attributes that follow from how a person is related to you. */
export const RELATIONSHIP_ATTRIBUTES: Readonly<Record<Relationship, readonly WitnessAttribute[]>> =
  {
    none: [],
    spouse: [
      'spouse',
      'immediate-family',
      'relative-by-marriage',
      'relative',
      'relative-within-third-degree',
    ],
    parent: ['immediate-family', 'blood-relative', 'relative', 'relative-within-third-degree'],
    child: ['immediate-family', 'blood-relative', 'relative', 'relative-within-third-degree'],
    sibling: ['immediate-family', 'blood-relative', 'relative', 'relative-within-third-degree'],
    grandchild: ['immediate-family', 'blood-relative', 'relative', 'relative-within-third-degree'],
    grandparent: ['blood-relative', 'relative', 'relative-within-third-degree'],
    'aunt-uncle-niece-nephew': ['blood-relative', 'relative', 'relative-within-third-degree'],
    'cousin-or-distant': ['blood-relative', 'relative'],
    'in-law-or-step': ['relative-by-marriage', 'relative', 'relative-within-third-degree'],
  };

/** Attributes that are answered through the relationship question. */
export const RELATIONSHIP_DERIVED: ReadonlySet<WitnessAttribute> = new Set([
  'spouse',
  'immediate-family',
  'relative-within-third-degree',
  'blood-relative',
  'relative-by-marriage',
  'relative',
]);

/** Attributes that imply other attributes. */
const IMPLIED: Partial<Record<WitnessAttribute, WitnessAttribute[]>> = {
  'attending-physician': ['physician', 'healthcare-provider'],
  spouse: ['immediate-family', 'relative-by-marriage', 'relative', 'relative-within-third-degree'],
  'immediate-family': ['relative', 'relative-within-third-degree'],
  'blood-relative': ['relative'],
  'relative-by-marriage': ['relative'],
};

/** Every attribute that applies to a candidate, including derived and implied ones. */
export function expandAttributes(candidate: WitnessCandidate): Set<WitnessAttribute> {
  const out = new Set<WitnessAttribute>(candidate.attributes ?? []);
  for (const a of RELATIONSHIP_ATTRIBUTES[candidate.relationship ?? 'none']) out.add(a);
  let grew = true;
  while (grew) {
    grew = false;
    for (const a of [...out]) {
      for (const implied of IMPLIED[a] ?? []) {
        if (!out.has(implied)) {
          out.add(implied);
          grew = true;
        }
      }
    }
  }
  return out;
}

/** Attributes mentioned anywhere in an execution's witness or notary rules. */
export function relevantAttributes(execution: Execution): WitnessAttribute[] {
  const set = new Set<WitnessAttribute>();
  for (const rule of execution.witnesses?.rules ?? []) rule.attributes.forEach((a) => set.add(a));
  execution.notary?.disqualified?.forEach((a) => set.add(a));
  return [...set];
}

/**
 * Which questions to ask about a witness for this execution: whether to ask
 * how they are related to you, and which yes/no facts matter.
 */
export function witnessQuestions(execution: Execution): {
  askRelationship: boolean;
  attributes: WitnessAttribute[];
} {
  const relevant = relevantAttributes(execution);
  return {
    askRelationship: relevant.some((a) => RELATIONSHIP_DERIVED.has(a)),
    attributes: relevant.filter((a) => !RELATIONSHIP_DERIVED.has(a)),
  };
}

export type WitnessProblem =
  | { kind: 'too-young'; minAge: number }
  | { kind: 'disqualified'; ruleIndex: number; attributes: WitnessAttribute[] };

export type GroupProblem =
  | { kind: 'need-one-who-is-not'; ruleIndex: number; attributes: WitnessAttribute[] }
  | { kind: 'too-many'; ruleIndex: number; attributes: WitnessAttribute[]; witnesses: number[] };

export interface WitnessResult {
  index: number;
  name?: string;
  ok: boolean;
  problems: WitnessProblem[];
}

export interface WitnessEvaluation {
  /** False when the document does not need witnesses at all. */
  required: boolean;
  /** Witnesses required. */
  count: number;
  /** How many more witnesses are needed. */
  missing: number;
  witnesses: WitnessResult[];
  groupProblems: GroupProblem[];
  /**
   * Advice for witnesses not chosen yet, e.g. "your other witness must not
   * be a relative" when the first witness is one.
   */
  hints: { ruleIndex: number; attributes: WitnessAttribute[] }[];
  /** True when enough witnesses were given and none of the rules are broken. */
  ok: boolean;
}

function matching(attrs: Set<WitnessAttribute>, rule: WitnessRule): WitnessAttribute[] {
  return rule.attributes.filter((a) => attrs.has(a));
}

/**
 * Checks proposed witnesses against a document's witness rules.
 *
 * The result separates problems with individual witnesses from problems with
 * the group (for example "at least one witness must not be a relative").
 */
export function evaluateWitnesses(
  execution: Execution,
  candidates: readonly WitnessCandidate[],
): WitnessEvaluation {
  const req = execution.witnesses;
  const required =
    Boolean(req) && execution.method !== 'notary' && execution.method !== 'signature-only';
  if (!req || !required) {
    return {
      required: false,
      count: 0,
      missing: 0,
      witnesses: [],
      groupProblems: [],
      hints: [],
      ok: true,
    };
  }

  const expanded = candidates.map(expandAttributes);
  const witnesses: WitnessResult[] = candidates.map((c, index) => {
    const problems: WitnessProblem[] = [];
    if (c.age !== undefined && c.age < req.minAge)
      problems.push({ kind: 'too-young', minAge: req.minAge });
    req.rules.forEach((rule, ruleIndex) => {
      if (rule.type !== 'none-may-be') return;
      const hit = matching(expanded[index]!, rule);
      if (hit.length) problems.push({ kind: 'disqualified', ruleIndex, attributes: hit });
    });
    return { index, ...(c.name ? { name: c.name } : {}), ok: problems.length === 0, problems };
  });

  const groupProblems: GroupProblem[] = [];
  const hints: WitnessEvaluation['hints'] = [];
  const missing = Math.max(0, req.count - candidates.length);

  req.rules.forEach((rule, ruleIndex) => {
    if (rule.type === 'at-least-one-not') {
      const anyClear = expanded.some((attrs) => matching(attrs, rule).length === 0);
      if (!anyClear) {
        if (missing > 0) {
          if (candidates.length > 0) hints.push({ ruleIndex, attributes: rule.attributes });
        } else {
          groupProblems.push({
            kind: 'need-one-who-is-not',
            ruleIndex,
            attributes: rule.attributes,
          });
        }
      }
    } else if (rule.type === 'at-most-one') {
      const hits = expanded.flatMap((attrs, i) => (matching(attrs, rule).length ? [i] : []));
      if (hits.length > 1) {
        groupProblems.push({
          kind: 'too-many',
          ruleIndex,
          attributes: rule.attributes,
          witnesses: hits,
        });
      } else if (hits.length === 1 && missing > 0) {
        hints.push({ ruleIndex, attributes: rule.attributes });
      }
    }
  });

  const ok = missing === 0 && groupProblems.length === 0 && witnesses.every((w) => w.ok);
  return { required: true, count: req.count, missing, witnesses, groupProblems, hints, ok };
}

export type NotaryNeed = 'required' | 'alternative' | 'recommended' | 'not-needed';

/** Whether a notary is required, one of two options, recommended, or not needed. */
export function notaryNeed(execution: Execution): NotaryNeed {
  switch (execution.method) {
    case 'notary':
    case 'witnesses-and-notary':
      return 'required';
    case 'witnesses-or-notary':
      return 'alternative';
    default:
      return execution.notary?.recommended ? 'recommended' : 'not-needed';
  }
}

export interface NotaryEvaluation {
  need: NotaryNeed;
  ok: boolean;
  disqualifiedBy: WitnessAttribute[];
}

/** Checks whether a proposed notary is disqualified by the state's rules. */
export function evaluateNotary(
  execution: Execution,
  candidate: WitnessCandidate,
): NotaryEvaluation {
  const rules: NotaryRequirements = execution.notary ?? {};
  const attrs = expandAttributes(candidate);
  const disqualifiedBy = (rules.disqualified ?? []).filter((a) => attrs.has(a));
  return { need: notaryNeed(execution), ok: disqualifiedBy.length === 0, disqualifiedBy };
}
