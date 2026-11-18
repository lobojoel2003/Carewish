import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import YAML from 'yaml';
import { describe, expect, it } from 'vitest';
import {
  STATE_CODES,
  WITNESS_ATTRIBUTES,
  getDocument,
  getState,
  isStateCode,
  listStates,
  requireState,
} from '../src';
// @ts-expect-error -- plain ESM script without type declarations
import { semanticProblems } from '../scripts/build-data.mjs';

const root = join(import.meta.dirname, '..');
const files = readdirSync(join(root, 'states')).filter((f) => f.endsWith('.yaml'));
const schema = JSON.parse(readFileSync(join(root, 'schema/state.schema.json'), 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
addFormats(ajv);
const validate = ajv.compile(schema);

describe('state rule files', () => {
  it('covers all 50 states and DC, one file each', () => {
    expect(files).toHaveLength(51);
    expect(files.map((f) => f.replace('.yaml', '')).sort()).toEqual([...STATE_CODES].sort());
  });

  it.each(files)('%s matches the JSON schema and semantic checks', (file) => {
    const data = YAML.parse(readFileSync(join(root, 'states', file), 'utf8'));
    const valid = validate(data);
    expect(validate.errors ?? []).toEqual([]);
    expect(valid).toBe(true);
    expect(semanticProblems(data, file)).toEqual([]);
  });

  it('starts every file with the license header', () => {
    for (const file of files) {
      const text = readFileSync(join(root, 'states', file), 'utf8');
      expect(text.split('\n')[1]).toContain('Licensed MIT');
    }
  });
});

describe('semantic checks', () => {
  const base = () => structuredClone(requireState('CA')) as unknown as Record<string, any>;

  it('flags a code that does not match the file name', () => {
    expect(semanticProblems(base(), 'TX.yaml')[0]).toMatch(/does not match/);
  });

  it('flags group rules with a single witness', () => {
    const s = base();
    s.documents[0].execution.witnesses.count = 1;
    expect(semanticProblems(s, 'CA.yaml').join()).toMatch(/needs at least 2 witnesses/);
  });

  it('flags missing principal and agent sections, duplicate ids and sections', () => {
    const s = base();
    s.documents.push(structuredClone(s.documents[0]));
    s.documents[0].parts[0].sections = ['agent', 'agent'];
    s.documents[1].parts = [{ title: 'x', sections: ['life-sustaining'] }];
    const problems = semanticProblems(s, 'CA.yaml').join('\n');
    expect(problems).toMatch(/duplicate document id/);
    expect(problems).toMatch(/sections listed twice/);
    expect(problems).toMatch(/"principal"/);
    expect(problems).toMatch(/"agent" section/);
  });

  it('flags witness ages below the adult age and misfiled kinds', () => {
    const s = base();
    s.adultAge = 19;
    s.documents[0].kind = 'power-of-attorney';
    s.documents[0].execution.agentAcceptance = true;
    const problems = semanticProblems(s, 'CA.yaml').join('\n');
    expect(problems).toMatch(/below adultAge/);
    expect(problems).toMatch(/kind "combined"/);
  });
});

describe('data access', () => {
  it('looks up states case-insensitively', () => {
    expect(getState('ca')?.name).toBe('California');
    expect(getState('XX')).toBeUndefined();
    expect(() => requireState('XX')).toThrow(RangeError);
  });

  it('lists states sorted by name', () => {
    const names = listStates().map((s) => s.name);
    expect(names).toHaveLength(51);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en')));
    expect(names[0]).toBe('Alabama');
  });

  it('validates state codes', () => {
    expect(isStateCode('NY')).toBe(true);
    expect(isStateCode('ny')).toBe(false);
    expect(isStateCode(42)).toBe(false);
  });

  it('finds documents by id', () => {
    expect(getDocument('TX', 'medical-power-of-attorney')?.citation).toMatch(/166/);
    expect(getDocument('TX', 'nope')).toBeUndefined();
  });

  it('only uses known witness attributes', () => {
    for (const state of listStates()) {
      for (const doc of state.documents) {
        for (const rule of doc.execution.witnesses?.rules ?? []) {
          for (const a of rule.attributes) expect(WITNESS_ATTRIBUTES).toContain(a);
        }
      }
    }
  });
});

describe('well-known rules', () => {
  const doc = (code: string, i = 0) => requireState(code).documents[i]!;

  it('North Carolina needs witnesses and a notary', () => {
    for (const d of requireState('NC').documents)
      expect(d.execution.method).toBe('witnesses-and-notary');
  });

  it('West Virginia needs witnesses and a notary', () => {
    expect(doc('WV').execution.method).toBe('witnesses-and-notary');
  });

  it('California accepts two witnesses or a notary and has a nursing home rule', () => {
    const ex = doc('CA').execution;
    expect(ex.method).toBe('witnesses-or-notary');
    expect(ex.witnesses?.count).toBe(2);
    expect(ex.special?.map((s) => s.id)).toContain('skilled-nursing-facility');
  });

  it('Arizona and Utah need only one witness', () => {
    expect(doc('AZ').execution.witnesses?.count).toBe(1);
    expect(doc('UT').execution.witnesses?.count).toBe(1);
  });

  it('Michigan requires the patient advocate to accept', () => {
    expect(doc('MI').execution.agentAcceptance).toBe(true);
    expect(requireState('MI').terminology.agent).toBe('patient-advocate');
  });

  it('Florida calls the agent a health care surrogate and has two documents', () => {
    expect(requireState('FL').terminology.agent).toBe('health-care-surrogate');
    expect(requireState('FL').documents.map((d) => d.kind)).toEqual([
      'power-of-attorney',
      'living-will',
    ]);
  });

  it('Alabama and Nebraska use 19 as the age of majority', () => {
    expect(requireState('AL').adultAge).toBe(19);
    expect(requireState('NE').adultAge).toBe(19);
  });

  it('Missouri health care power of attorney must be notarized', () => {
    expect(doc('MO').execution.method).toBe('notary');
  });
});

describe('generated docs', () => {
  it('keeps STATES.md in sync with the YAML files (run `pnpm docs:states`)', async () => {
    const { execFileSync } = await import('node:child_process');
    const table = execFileSync(process.execPath, [join(root, 'scripts/states-table.mjs')], {
      encoding: 'utf8',
    });
    expect(readFileSync(join(root, 'STATES.md'), 'utf8')).toContain(table.trim());
  });
});
