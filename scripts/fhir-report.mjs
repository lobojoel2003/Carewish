#!/usr/bin/env node
// Summarizes HL7 FHIR validator output (-output file.json) and fails on errors.
//   node scripts/fhir-report.mjs fhir-validation.json
import { readFileSync } from 'node:fs';

const file = process.argv[2] ?? 'fhir-validation.json';
const data = JSON.parse(readFileSync(file, 'utf8'));
const outcomes =
  data.resourceType === 'Bundle' ? (data.entry ?? []).map((e) => e.resource) : [data];

const FILE_EXT = 'http://hl7.org/fhir/StructureDefinition/operationoutcome-file';
let errors = 0;
let warnings = 0;

for (const outcome of outcomes) {
  const name = outcome.extension?.find((x) => x.url === FILE_EXT)?.valueString ?? '(input)';
  const issues = outcome.issue ?? [];
  const bad = issues.filter((i) => i.severity === 'error' || i.severity === 'fatal');
  const warn = issues.filter((i) => i.severity === 'warning');
  // "All OK" outcomes carry a single information issue
  errors += bad.length;
  warnings += warn.length;
  console.log(`\n${name}: ${bad.length} error(s), ${warn.length} warning(s)`);
  for (const i of [...bad, ...warn]) {
    const where = i.expression?.[0] ?? i.location?.[0] ?? '';
    console.log(
      `  ${i.severity.toUpperCase().padEnd(7)} ${where}  ${i.details?.text ?? i.diagnostics ?? ''}`,
    );
  }
}

console.log(
  `\nTotal: ${errors} error(s), ${warnings} warning(s) across ${outcomes.length} file(s).`,
);
if (errors > 0) {
  console.error('FHIR validation failed.');
  process.exit(1);
}
