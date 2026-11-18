import type { SectionId, StateRules } from '@carewish/form-rules';
import { agentTerm } from '@carewish/form-rules';
import type { Translate } from '@/i18n';
import { formatAddress, hasAgent, hasAlternate, type Answers, type Person } from './answers';

/** A unit of content in a section of the directive, shared by the PDF, the FHIR narrative and the review screen. */
export type Block =
  | { kind: 'paragraph'; text: string }
  | { kind: 'choice'; intro: string; text: string | null }
  | { kind: 'list'; intro: string; items: string[] }
  | {
      kind: 'person';
      role: 'agent' | 'physician';
      intro: string;
      person: Person | null;
      empty: string;
    }
  | { kind: 'free-text'; intro: string; text: string | null };

export interface StatementContext {
  t: Translate;
  lang: string;
  state?: Pick<StateRules, 'terminology' | 'name'>;
}

/** Formats a YYYY-MM-DD date in long form for a language, e.g. "March 4, 1956". */
export function formatDate(iso: string | undefined, lang: string): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return new Intl.DateTimeFormat(lang === 'es' ? 'es-US' : 'en-US', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(date);
}

export function agentWord(ctx: StatementContext): string {
  return ctx.state ? agentTerm(ctx.state, ctx.lang) : ctx.t('rules:agentTerm.agent');
}

function clean(text?: string): string | null {
  const v = text?.replace(/\r\n?/g, '\n').trim();
  return v ? v : null;
}

/** Content blocks for one section of the state form. */
export function sectionBlocks(section: SectionId, a: Answers, ctx: StatementContext): Block[] {
  const { t } = ctx;
  const agent = agentWord(ctx);
  const p = { agent };
  const choice = (
    introKey: string,
    group: string,
    value?: string,
    extra: Record<string, string> = {},
  ): Block => ({
    kind: 'choice',
    intro: t(`statements.${introKey}`, p),
    text: value ? t(`statements.${group}.${value}`, { ...p, ...extra }) : null,
  });

  switch (section) {
    case 'principal': {
      const address = formatAddress(a.address);
      const params = { name: a.name ?? '', birthDate: formatDate(a.birthDate, ctx.lang), address };
      return [
        {
          kind: 'paragraph',
          text: t(address ? 'statements.principal' : 'statements.principalNoAddress', params),
        },
      ];
    }
    case 'agent':
      return [
        {
          kind: 'person',
          role: 'agent',
          intro: t('statements.agentIntro', p),
          person: hasAgent(a) ? a.agent! : null,
          empty: t('statements.noAgent', p),
        },
      ];
    case 'alternate-agent':
      if (!hasAgent(a)) return [];
      return [
        {
          kind: 'person',
          role: 'agent',
          intro: t('statements.alternateIntro', p),
          person: hasAlternate(a) ? a.alternate! : null,
          empty: t('statements.noAlternate', p),
        },
      ];
    case 'agent-authority': {
      if (!hasAgent(a)) return [];
      const blocks: Block[] = [{ kind: 'paragraph', text: t('statements.authorityGeneral', p) }];
      if (a.agentAuthority === 'yes')
        blocks.push({ kind: 'paragraph', text: t('statements.authorityYes', p) });
      if (a.agentAuthority === 'no')
        blocks.push({ kind: 'paragraph', text: t('statements.authorityNo', p) });
      blocks.push({ kind: 'paragraph', text: t('statements.authorityStart', p) });
      return blocks;
    }
    case 'life-sustaining':
      return [
        choice('terminalIntro', 'treatment', a.terminal),
        choice('unconsciousIntro', 'treatment', a.unconscious),
        choice('advancedIllnessIntro', 'treatment', a.advancedIllness),
      ];
    case 'nutrition':
      return [choice('nutritionIntro', 'nutrition', a.nutrition)];
    case 'cpr':
      return [choice('cprIntro', 'cpr', a.cpr)];
    case 'pain-relief':
      return [choice('painIntro', 'pain', a.pain)];
    case 'values': {
      const blocks: Block[] = [];
      const items = (a.values ?? []).map((v) => t(`statements.values.${v}`));
      const note = clean(a.valuesNote);
      if (note) items.push(note);
      blocks.push(
        items.length
          ? { kind: 'list', intro: t('statements.valuesIntro'), items }
          : { kind: 'free-text', intro: t('statements.valuesIntro'), text: null },
      );
      blocks.push(choice('placeIntro', 'place', a.place));
      blocks.push({
        kind: 'free-text',
        intro: t('statements.spiritualIntro'),
        text: clean(a.spiritual),
      });
      return blocks;
    }
    case 'organ-donation':
      return [choice('organIntro', 'organ', a.organ, { detail: clean(a.organDetail) ?? '' })];
    case 'physician':
      return [
        {
          kind: 'person',
          role: 'physician',
          intro: t('statements.physicianIntro'),
          person: a.physician?.name ? { name: a.physician.name, phone: a.physician.phone } : null,
          empty: t('statements.noPhysician'),
        },
      ];
    case 'additional-wishes':
      return [{ kind: 'free-text', intro: t('statements.otherIntro'), text: clean(a.other) }];
  }
}

/** True when the person gave content for a section (used to decide what goes in the appendix). */
export function sectionHasContent(section: SectionId, a: Answers): boolean {
  switch (section) {
    case 'principal':
      return true;
    case 'agent':
      return hasAgent(a);
    case 'alternate-agent':
      return hasAlternate(a);
    case 'agent-authority':
      return hasAgent(a) && Boolean(a.agentAuthority);
    case 'life-sustaining':
      return Boolean(a.terminal || a.unconscious || a.advancedIllness);
    case 'nutrition':
      return Boolean(a.nutrition);
    case 'cpr':
      return Boolean(a.cpr);
    case 'pain-relief':
      return Boolean(a.pain);
    case 'values':
      return Boolean(a.values?.length || clean(a.valuesNote) || a.place || clean(a.spiritual));
    case 'organ-donation':
      return Boolean(a.organ);
    case 'physician':
      return Boolean(a.physician?.name);
    case 'additional-wishes':
      return Boolean(clean(a.other));
  }
}

/** Flattens blocks to plain lines, for narratives and plain-text exports. */
export function blocksToLines(blocks: Block[], noInstruction: string): string[] {
  return blocks.flatMap((b): string[] => {
    switch (b.kind) {
      case 'paragraph':
        return [b.text];
      case 'choice':
        return [b.intro, b.text ?? noInstruction];
      case 'list':
        return [b.intro, ...b.items.map((i) => `• ${i}`)];
      case 'free-text':
        return [b.intro, b.text ?? noInstruction];
      case 'person':
        return b.person ? [b.intro, personLine(b.person)] : [b.empty];
    }
  });
}

export function personLine(person: Person, relationshipLabel?: string): string {
  return [person.name, relationshipLabel, person.phone, person.email, person.address]
    .filter(Boolean)
    .join(' · ');
}
