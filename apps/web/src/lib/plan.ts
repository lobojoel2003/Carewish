import {
  SECTION_IDS,
  documentsFor,
  getState,
  type DocumentRules,
  type SectionId,
  type StateRules,
} from '@carewish/form-rules';
import { hasAgent, hasWishes, type Answers } from './answers';
import { sectionHasContent } from './statements';

export interface DocumentPlan {
  state: StateRules;
  /** The state documents this person needs, in the state's order. */
  documents: DocumentRules[];
  /** Answered sections the chosen documents have no place for. */
  appendix: SectionId[];
  /** The document the appendix is attached to (and signed with). */
  appendixDocumentId?: string;
}

export const STANDALONE_WISHES_ID = 'statement-of-wishes';

/**
 * Works out which of the state's documents to produce for these answers and
 * where answers without a place on the statutory form should go.
 */
export function planDocuments(
  answers: Answers,
  stateOverride?: StateRules,
): DocumentPlan | undefined {
  const state = stateOverride ?? (answers.state ? getState(answers.state) : undefined);
  if (!state) return undefined;

  const agent = hasAgent(answers);
  const wishes = hasWishes(answers);
  let documents = documentsFor(state, { hasAgent: agent, hasWishes: wishes });

  if (documents.length === 0 && wishes) {
    // e.g. Massachusetts has only a health care proxy; without an agent the
    // wishes still deserve a signed home, using the state's signing rules.
    const base = state.documents[0]!;
    documents = [
      {
        id: STANDALONE_WISHES_ID,
        title: 'Statement of My Health Care Wishes',
        kind: 'living-will',
        citation: base.citation,
        parts: [],
        execution: base.execution,
      },
    ];
  }
  if (documents.length === 0) documents = state.documents.slice(0, 1);

  const covered = new Set(documents.flatMap((d) => d.parts.flatMap((p) => p.sections)));
  const appendix = SECTION_IDS.filter(
    (s) => s !== 'principal' && !covered.has(s) && sectionHasContent(s, answers),
  );
  const target =
    [...documents].reverse().find((d) => d.kind !== 'power-of-attorney') ?? documents.at(-1);

  return {
    state,
    documents,
    appendix,
    ...(appendix.length && target ? { appendixDocumentId: target.id } : {}),
  };
}
