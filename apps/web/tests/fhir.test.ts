import type {
  Bundle,
  CarePlan,
  Composition,
  Consent,
  Observation,
  Patient,
  Reference,
  Resource,
} from 'fhir/r4';
import { listStates } from '@carewish/form-rules';
import { describe, expect, it } from 'vitest';
import { englishT } from '@/i18n';
import { PROFILES, buildAdiBundle, narrative } from '@/lib/fhir/bundle';
import { NOW, counterUuid, fullAnswers } from './fixtures';

const t = englishT();
const build = (a = fullAnswers()) =>
  buildAdiBundle(a, { t, lang: 'es', now: NOW, uuid: counterUuid(), appVersion: '1.0.0' });

function resources(bundle: Bundle): Resource[] {
  return (bundle.entry ?? []).map((e) => e.resource!);
}

function references(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) value.forEach((v) => references(v, out));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (k === 'reference' && typeof v === 'string') out.push(v);
      else references(v, out);
    }
  }
  return out;
}

describe('PACIO ADI document bundle', () => {
  const bundle = build();
  const composition = bundle.entry![0]!.resource as Composition;

  it('is a FHIR document with the composition first', () => {
    expect(bundle.resourceType).toBe('Bundle');
    expect(bundle.type).toBe('document');
    expect(bundle.timestamp).toBe(NOW.toISOString());
    expect(bundle.identifier?.system).toBe('urn:ietf:rfc:3986');
    expect(composition.resourceType).toBe('Composition');
    expect(composition.meta?.profile).toEqual([PROFILES.composition]);
  });

  it('resolves every reference inside the bundle', () => {
    const fullUrls = new Set(bundle.entry!.map((e) => e.fullUrl));
    const refs = references(bundle.entry!.map((e) => e.resource));
    expect(refs.length).toBeGreaterThan(10);
    for (const r of refs) expect(fullUrls.has(r), r).toBe(true);
    for (const e of bundle.entry!) expect(e.fullUrl).toBe(`urn:uuid:${e.resource!.id}`);
  });

  it('describes the composition per the PACIO header', () => {
    expect(composition.type.coding?.[0]).toMatchObject({
      system: 'http://loinc.org',
      code: '81334-5',
    });
    expect(composition.category?.[0]?.coding?.[0]?.code).toBe('42348-3');
    expect(composition.language).toBe('en-US');
    expect(composition.status).toBe('final');
    expect(composition.custodian?.reference).toMatch(/^urn:uuid:/);
    expect(composition.extension).toContainEqual({
      url: 'http://hl7.org/fhir/us/pacio-adi/StructureDefinition/adi-jurisdiction-extension',
      valueCodeableConcept: { coding: [{ system: 'urn:iso:std:iso:3166:-2', code: 'US-CA' }] },
    });
    expect(composition.text?.div).toContain('lang="en-US" xml:lang="en-US"');
    const codes = composition.section!.map((s) => s.code?.coding?.[0]?.code);
    expect(codes).toEqual(['81335-2', '81338-6', '81336-0', '81337-8', '81339-4']);
    for (const s of composition.section!)
      expect(s.text?.div).toMatch(
        /^<div xmlns="http:\/\/www.w3.org\/1999\/xhtml" lang="en-US" xml:lang="en-US">/,
      );
  });

  it('grants the healthcare agent powers through a PACIO consent', () => {
    const consent = resources(bundle).find((r): r is Consent => r.resourceType === 'Consent')!;
    expect(consent.meta?.profile).toEqual([PROFILES.consent]);
    expect(consent.scope.coding?.[0]?.code).toBe('75786-4');
    expect(consent.provision?.type).toBe('permit');
    expect(consent.category[0]?.coding?.[0]?.code).toBe('acd');
    expect(consent.provision?.purpose?.[0]?.code).toBe('PWATRNY');
    expect(consent.provision?.actor?.map((a) => a.role.coding?.[0]?.code)).toEqual([
      '75783-1',
      '75784-9',
    ]);
    expect(consent.policyRule?.text).toContain('4701');
    const hca = composition.section![0]!;
    const types = hca.entry!.map(
      (r: Reference) =>
        resources(bundle).find((x) => `urn:uuid:${x.id}` === r.reference)!.resourceType,
    );
    expect(types).toEqual(['Consent', 'RelatedPerson', 'RelatedPerson']);
  });

  it('denies life-sustaining decisions when the person limits the agent', () => {
    const consent = resources(build(fullAnswers('CA', { agentAuthority: 'no' }))).find(
      (r): r is Consent => r.resourceType === 'Consent',
    )!;
    expect(consent.provision?.provision?.[0]?.type).toBe('deny');
    expect(consent.provision?.provision?.[0]?.action?.map((a) => a.coding?.[0]?.code)).toContain(
      'life-support',
    );
    expect(consent.provision?.action?.map((a) => a.coding?.[0]?.code)).not.toContain(
      'life-support',
    );
  });

  it('records an empty healthcare agent section without an agent', () => {
    const b = build(fullAnswers('CA', { agent: undefined, alternate: undefined }));
    const section = (b.entry![0]!.resource as Composition).section![0]!;
    expect(section.entry).toBeUndefined();
    expect(section.emptyReason?.coding?.[0]?.code).toBe('asked-declined');
    expect(resources(b).some((r) => r.resourceType === 'Consent')).toBe(false);
  });

  it('expresses preferences as PACIO observations and care plans', () => {
    const obs = resources(bundle).filter((r): r is Observation => r.resourceType === 'Observation');
    const byProfile = (p: string) => obs.filter((o) => o.meta?.profile?.includes(p));
    expect(
      byProfile(PROFILES.intervention).map((o) => o.code.coding?.[0]?.code ?? o.code.text),
    ).toEqual([
      '75777-3',
      '75778-1',
      '75778-1',
      '75788-0',
      '75779-9',
      'Preference about pain relief that may hasten death',
      '75780-7',
    ]);
    expect(byProfile(PROFILES.careExperience)).toHaveLength(3);
    expect(byProfile(PROFILES.organDonation)[0]!.code.coding?.[0]?.code).toBe('75781-5');
    for (const o of obs) {
      expect(o.status).toBe('final');
      expect(o.valueString).toBeTruthy();
      expect(o.text?.status).toBe('generated');
    }
    const plans = resources(bundle).filter((r): r is CarePlan => r.resourceType === 'CarePlan');
    expect(plans).toHaveLength(4);
    for (const p of plans) {
      expect(p.category?.[0]?.coding?.[0]?.code).toBe('736366004');
      expect(p.addresses?.length).toBeGreaterThan(0);
      expect(p.intent).toBe('proposal');
    }
  });

  it('records the patient with preferred language and physician', () => {
    const patient = resources(bundle).find((r) => r.resourceType === 'Patient') as Patient;
    expect(patient.name?.[0]).toMatchObject({ family: 'Torres', given: ['Maria', 'Elena'] });
    expect(patient.birthDate).toBe('1956-03-04');
    expect(patient.gender).toBe('unknown');
    expect(patient.communication?.[0]?.language.coding?.[0]?.code).toBe('es');
    expect(patient.generalPractitioner?.[0]?.display).toContain('Dr. Priya Shah');
  });

  it('escapes user text in narratives', () => {
    expect(narrative(['a <b> & "c"', '• item']).div).toBe(
      '<div xmlns="http://www.w3.org/1999/xhtml"><p>a &lt;b&gt; &amp; &quot;c&quot;</p><ul><li>item</li></ul></div>',
    );
    const divs = JSON.stringify(bundle).match(/"div":"(?:[^"\\]|\\.)*"/g) ?? [];
    expect(divs.length).toBeGreaterThan(10);
    for (const d of divs) expect(d).not.toContain('<3 &');
    expect(divs.some((d) => d.includes('Music &lt;3 &amp;'))).toBe(true);
    expect(narrative([]).div).toContain('No information.');
  });

  it('requires a state and a name', () => {
    expect(() => build({ version: 1 })).toThrow(/state/);
    expect(() => build({ version: 1, state: 'CA' })).toThrow(/name/);
  });

  it('builds for every state', () => {
    for (const s of listStates()) {
      const b = build(fullAnswers(s.code));
      expect(b.entry!.length, s.code).toBeGreaterThan(10);
    }
  });
});
