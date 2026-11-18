'use client';

import { getState, type SectionId } from '@carewish/form-rules';
import Link from 'next/link';
import type { Answers, Person } from '@/lib/answers';
import { sectionBlocks, type Block } from '@/lib/statements';
import { useCopy } from '@/state/copy';

export const SECTION_STEP: Record<SectionId, string> = {
  principal: 'name',
  agent: 'agent',
  'alternate-agent': 'alternate',
  'agent-authority': 'authority',
  'life-sustaining': 'terminal',
  nutrition: 'nutrition',
  cpr: 'cpr',
  'pain-relief': 'pain',
  values: 'values',
  'organ-donation': 'organ',
  physician: 'physician',
  'additional-wishes': 'other',
};

function PersonCard({ person }: { person: Person }) {
  const { t } = useCopy();
  return (
    <dl className="mt-2 grid gap-x-6 gap-y-1 rounded-2xl bg-surface-muted p-4 sm:grid-cols-[auto_1fr]">
      <dt className="font-bold">{t('fields.name')}</dt>
      <dd>{person.name}</dd>
      {person.relationship && (
        <>
          <dt className="font-bold">{t('fields.relationship')}</dt>
          <dd>{t(`relationship.${person.relationship}`)}</dd>
        </>
      )}
      {person.phone && (
        <>
          <dt className="font-bold">{t('fields.phone')}</dt>
          <dd>{person.phone}</dd>
        </>
      )}
      {person.email && (
        <>
          <dt className="font-bold">{t('fields.email')}</dt>
          <dd>{person.email}</dd>
        </>
      )}
      {person.address && (
        <>
          <dt className="font-bold">{t('fields.address')}</dt>
          <dd>{person.address}</dd>
        </>
      )}
    </dl>
  );
}

export function BlockView({ block }: { block: Block }) {
  const { t } = useCopy();
  const none = <span className="text-muted">{t('statements.none')}</span>;
  switch (block.kind) {
    case 'paragraph':
      return <p>{block.text}</p>;
    case 'choice':
    case 'free-text':
      return (
        <div>
          <p className="font-bold">{block.intro}</p>
          <p className="mt-1 whitespace-pre-line pl-4">{block.text ?? none}</p>
        </div>
      );
    case 'list':
      return (
        <div>
          <p className="font-bold">{block.intro}</p>
          <ul className="mt-1 list-disc pl-9">
            {block.items.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </div>
      );
    case 'person':
      return block.person ? (
        <div>
          <p>{block.intro}</p>
          <PersonCard person={block.person} />
        </div>
      ) : (
        <p className="text-muted">{block.empty}</p>
      );
  }
}

export function SectionView({
  section,
  answers,
  editable = true,
}: {
  section: SectionId;
  answers: Answers;
  editable?: boolean;
}) {
  const { t, lang } = useCopy();
  const state = answers.state ? getState(answers.state) : undefined;
  const blocks = sectionBlocks(section, answers, { t, lang, state });
  if (blocks.length === 0) return null;
  return (
    <div className="group relative grid gap-3 border-t border-line py-5 first:border-t-0 first:pt-0">
      {blocks.map((b, i) => (
        <BlockView key={i} block={b} />
      ))}
      {editable && (
        <Link
          href={`/plan/${SECTION_STEP[section]}`}
          className="link self-start text-sm"
          aria-label={`${t('common.edit')}: ${t(`steps.${SECTION_STEP[section]}.title`)}`}
        >
          {t('common.edit')}
        </Link>
      )}
    </div>
  );
}
