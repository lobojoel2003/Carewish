#!/usr/bin/env node
// Validates every states/*.yaml file against schema/state.schema.json, runs
// semantic checks the schema cannot express, and compiles the result into
// src/generated/states.json for the TypeScript build.
//
//   node scripts/build-data.mjs          validate and write
//   node scripts/build-data.mjs --check  validate only
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import YAML from 'yaml';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const statesDir = join(root, 'states');
const schema = JSON.parse(readFileSync(join(root, 'schema/state.schema.json'), 'utf8'));
const checkOnly = process.argv.includes('--check');

const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
addFormats(ajv);
const validate = ajv.compile(schema);

/** Checks the JSON Schema cannot express. Returns a list of problems. */
export function semanticProblems(state, fileName) {
  const problems = [];
  const expected = basename(fileName, '.yaml');
  if (state.code !== expected)
    problems.push(`code "${state.code}" does not match file name "${expected}.yaml"`);

  const ids = new Set();
  for (const doc of state.documents) {
    if (ids.has(doc.id)) problems.push(`duplicate document id "${doc.id}"`);
    ids.add(doc.id);

    const sections = doc.parts.flatMap((p) => p.sections);
    const dupes = sections.filter((s, i) => sections.indexOf(s) !== i);
    if (dupes.length)
      problems.push(`${doc.id}: sections listed twice: ${[...new Set(dupes)].join(', ')}`);
    if (!sections.includes('principal'))
      problems.push(`${doc.id}: every document must include the "principal" section`);
    if (doc.kind !== 'living-will' && !sections.includes('agent')) {
      problems.push(`${doc.id}: a ${doc.kind} document must include the "agent" section`);
    }
    if (doc.kind === 'power-of-attorney' && sections.includes('life-sustaining')) {
      problems.push(
        `${doc.id}: use kind "combined" when a power of attorney also holds treatment instructions`,
      );
    }

    const w = doc.execution.witnesses;
    if (w) {
      if (w.minAge < state.adultAge)
        problems.push(`${doc.id}: witness minAge ${w.minAge} is below adultAge ${state.adultAge}`);
      for (const rule of w.rules) {
        if ((rule.type === 'at-least-one-not' || rule.type === 'at-most-one') && w.count < 2) {
          problems.push(`${doc.id}: rule "${rule.type}" needs at least 2 witnesses`);
        }
      }
    }
    if (doc.execution.agentAcceptance && !sections.includes('agent')) {
      problems.push(`${doc.id}: agentAcceptance requires an "agent" section`);
    }
  }
  return problems;
}

function main() {
  const files = readdirSync(statesDir)
    .filter((f) => f.endsWith('.yaml'))
    .sort();
  const states = {};
  let failed = false;

  for (const file of files) {
    const text = readFileSync(join(statesDir, file), 'utf8');
    let data;
    try {
      data = YAML.parse(text, { prettyErrors: true, uniqueKeys: true });
    } catch (error) {
      console.error(`✖ ${file}: ${error.message}`);
      failed = true;
      continue;
    }
    if (!validate(data)) {
      failed = true;
      for (const err of validate.errors ?? []) {
        console.error(`✖ ${file}: ${err.instancePath || '/'} ${err.message}`);
      }
      continue;
    }
    const problems = semanticProblems(data, file);
    if (problems.length) {
      failed = true;
      for (const p of problems) console.error(`✖ ${file}: ${p}`);
      continue;
    }
    delete data.$schema;
    states[data.code] = data;
  }

  const count = Object.keys(states).length;
  if (failed) {
    console.error(`\nState rules are invalid. Fix the errors above.`);
    process.exit(1);
  }
  if (count !== 51) {
    console.error(`✖ expected 51 jurisdictions (50 states and DC), found ${count}`);
    process.exit(1);
  }

  if (checkOnly) {
    console.log(`✔ ${count} state rule files are valid`);
    return;
  }
  const outDir = join(root, 'src/generated');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'states.json'), `${JSON.stringify(states, null, 2)}\n`);
  console.log(`✔ compiled ${count} state rule files → src/generated/states.json`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
