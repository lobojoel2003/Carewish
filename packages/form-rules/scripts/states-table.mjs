#!/usr/bin/env node
// Prints a Markdown table summarizing every state's documents and signing rules.
//   node scripts/states-table.mjs          print the table
//   node scripts/states-table.mjs --write  regenerate STATES.md
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const states = Object.values(
  JSON.parse(readFileSync(join(root, 'src/generated/states.json'), 'utf8')),
);
const en = JSON.parse(readFileSync(join(root, 'locales/en.json'), 'utf8'));

const method = (ex) => {
  const count = ex.witnesses?.count ?? 0;
  const key =
    ex.method === 'notary' || ex.method === 'signature-only'
      ? ex.method
      : `${ex.method}_${count === 1 ? 'one' : 'other'}`;
  let text = en.methodShort[key].replace('{{count}}', String(count));
  if (ex.notary?.recommended) text += ' (notary recommended)';
  return text;
};

const rows = states
  .sort((a, b) => a.name.localeCompare(b.name))
  .map((s) => {
    const docs = s.documents.map((d) => `${d.title} — ${method(d.execution)}`).join('<br>');
    const term = en.agentTerm[s.terminology.agent];
    const extras = [
      ...s.documents.flatMap((d) => (d.execution.agentAcceptance ? ['agent must accept'] : [])),
      ...s.documents.flatMap((d) =>
        (d.execution.special ?? []).map((x) => x.id.replace(/-/g, ' ')),
      ),
    ];
    return `| ${s.name} | ${docs} | ${term} | ${[...new Set(extras)].join(', ') || '—'} |`;
  });

const table = `| State | Documents and signing | Decision-maker is called | Special rules |
| --- | --- | --- | --- |
${rows.join('\n')}`;

if (process.argv.includes('--write')) {
  const intro =
    '# State coverage\n\nGenerated from `states/*.yaml` with `pnpm docs:states`. ' +
    "This is legal information, not legal advice; see each file's sources.\n\n";
  writeFileSync(join(root, 'STATES.md'), `${intro}${table}\n`);
} else {
  console.log(table);
}
