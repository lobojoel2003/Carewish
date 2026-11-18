#!/usr/bin/env node
// Summarizes HL7 FHIR validator output (-output file.json) and fails on errors.
//   node scripts/fhir-report.mjs fhir-validation.json
import { readFileSync } from 'node:fs';

/**
 * Errors caused by defects in the published implementation guide itself,
 * not by Carewish's output. Each needs a reason a reviewer can verify.
 */
const KNOWN_IG_ISSUES = [
  {
    match: /Constraint failed: HCA-section-entries/,
    reason:
      'PACIO ADI 1.0.0 writes this invariant as `$this.resolve() is relatedPerson` (lowercase), which can never ' +
      'match a RelatedPerson, so it fails for any healthcare agent section with entries. The current IG source ' +
      'corrects it to `is RelatedPerson`. Carewish includes the Consent and RelatedPerson entries the invariant ' +
      'intends (asserted in apps/web/tests/fhir.test.ts).',
  },
];

const file = process.argv[2] ?? 'fhir-validation.json';
const data = JSON.parse(readFileSync(file, 'utf8'));
const outcomes =
  data.resourceType === 'Bundle' ? (data.entry ?? []).map((e) => e.resource) : [data];

const FILE_EXT = 'http://hl7.org/fhir/StructureDefinition/operationoutcome-file';
const text = (i) => i.details?.text ?? i.diagnostics ?? '';
let errors = 0;
let warnings = 0;
const known = new Map();

for (const outcome of outcomes) {
  const name = outcome.extension?.find((x) => x.url === FILE_EXT)?.valueString ?? '(input)';
  const issues = outcome.issue ?? [];
  const bad = [];
  for (const i of issues.filter((x) => x.severity === 'error' || x.severity === 'fatal')) {
    const k = KNOWN_IG_ISSUES.find((q) => q.match.test(text(i)));
    if (k) known.set(k, (known.get(k) ?? 0) + 1);
    else bad.push(i);
  }
  const warn = issues.filter((i) => i.severity === 'warning');
  errors += bad.length;
  warnings += warn.length;
  console.log(`\n${name}: ${bad.length} error(s), ${warn.length} warning(s)`);
  for (const i of [...bad, ...warn]) {
    const where = i.expression?.[0] ?? i.location?.[0] ?? '';
    console.log(`  ${i.severity.toUpperCase().padEnd(7)} ${where}  ${text(i)}`);
  }
}

for (const [issue, count] of known) {
  console.log(`\nKnown IG issue (${count} occurrence(s), not counted as errors): ${issue.reason}`);
}
console.log(
  `\nTotal: ${errors} error(s), ${warnings} warning(s) across ${outcomes.length} file(s).`,
);
if (errors > 0) {
  console.error('FHIR validation failed.');
  process.exit(1);
}
