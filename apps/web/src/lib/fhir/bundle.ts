/**
 * Builds a FHIR R4 document Bundle for a person's advance directive,
 * following the HL7 PACIO Advance Directive Interoperability (ADI)
 * Implementation Guide, STU 1 (hl7.fhir.us.pacio-adi#1.0.0).
 */
import type {
  Bundle,
  BundleEntry,
  CarePlan,
  CodeableConcept,
  Composition,
  CompositionSection,
  Consent,
  ConsentProvision,
  Coding,
  Narrative,
  Observation,
  Organization,
  Patient,
  Reference,
  RelatedPerson,
  Resource,
} from 'fhir/r4';
import type { Translate } from '@/i18n';
import { describeStep, localize, signingChecklist } from '@carewish/form-rules';
import {
  formatAddress,
  hasAgent,
  hasAlternate,
  splitName,
  type AgentRelationship,
  type Answers,
  type Person,
} from '../answers';
import { planDocuments } from '../plan';
import { agentWord, blocksToLines, sectionBlocks, type StatementContext } from '../statements';

export const PACIO = 'http://hl7.org/fhir/us/pacio-adi';
export const PACIO_VERSION = '1.0.0';
const sd = (id: string) => `${PACIO}/StructureDefinition/${id}`;

export const PROFILES = {
  composition: sd('ADI-PACPComposition'),
  participant: sd('ADI-Participant'),
  consent: sd('ADI-ParticipantConsent'),
  carePlan: sd('ADI-PreferenceCarePlan'),
  intervention: sd('ADI-PersonalInterventionPreference'),
  careExperience: sd('ADI-CareExperiencePreference'),
  organDonation: sd('ADI-OrganDonationObservation'),
  patient: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient',
  organization: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-organization',
} as const;

const EXT = {
  version: sd('adi-versionNumber-extension'),
  jurisdiction: sd('adi-jurisdiction-extension'),
};

const LOINC = 'http://loinc.org';
const SNOMED = 'http://snomed.info/sct';
const ROLE_CODE = 'http://terminology.hl7.org/CodeSystem/v3-RoleCode';
const PREFERENCE_CATEGORY = `${PACIO}/CodeSystem/ADIPreferenceCategoryCS`;
const HCA_DECISIONS = `${PACIO}/CodeSystem/ADIHCADecisionsCS`;

const loinc = (code: string, display: string): CodeableConcept => ({
  coding: [{ system: LOINC, code, display }],
});

const RELATIONSHIP_CODES: Record<AgentRelationship, Coding | undefined> = {
  spouse: { system: ROLE_CODE, code: 'SPS', display: 'spouse' },
  partner: { system: ROLE_CODE, code: 'DOMPART', display: 'domestic partner' },
  child: { system: ROLE_CODE, code: 'CHILD', display: 'child' },
  parent: { system: ROLE_CODE, code: 'PRN', display: 'parent' },
  sibling: { system: ROLE_CODE, code: 'SIB', display: 'sibling' },
  'other-relative': { system: ROLE_CODE, code: 'FAMMEMB', display: 'family member' },
  friend: { system: ROLE_CODE, code: 'FRND', display: 'unrelated friend' },
  other: undefined,
};

const ALL_DECISIONS = [
  ['life-support', 'Life support'],
  ['tube-feeding', 'Tube feeding'],
  ['iv-fluid-and-support', 'IV fluid and support'],
  ['intubation', 'Intubation'],
  ['antibiotics', 'Antibiotics'],
  ['cpr', 'Cardiopulmonary Resuscitation (CPR)'],
  ['resuscitation-non-cpr', 'Non-CPR Resuscitation'],
] as const;
const LIFE_SUSTAINING = new Set([
  'life-support',
  'tube-feeding',
  'iv-fluid-and-support',
  'cpr',
  'resuscitation-non-cpr',
]);

function escapeHtml(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

/** XHTML narrative from plain lines; lines starting with "• " become a list. */
export function narrative(lines: string[], status: Narrative['status'] = 'generated'): Narrative {
  let html = '';
  let inList = false;
  for (const line of lines.filter((l) => l.trim())) {
    if (line.startsWith('• ')) {
      if (!inList) html += '<ul>';
      inList = true;
      html += `<li>${escapeHtml(line.slice(2))}</li>`;
    } else {
      if (inList) html += '</ul>';
      inList = false;
      html += `<p>${escapeHtml(line)}</p>`;
    }
  }
  if (inList) html += '</ul>';
  return {
    status,
    div: `<div xmlns="http://www.w3.org/1999/xhtml">${html || '<p>No information.</p>'}</div>`,
  };
}

export interface BuildOptions {
  /** English translator (documents are produced in English). */
  t: Translate;
  /** Language the person used, recorded as their preferred language. */
  lang?: string;
  now?: Date;
  /** UUID generator; injectable for deterministic tests. */
  uuid?: () => string;
  appVersion?: string;
}

/** Builds the PACIO ADI document Bundle. Throws when the state or name is missing. */
export function buildAdiBundle(answers: Answers, opts: BuildOptions): Bundle {
  const plan = planDocuments(answers);
  if (!plan) throw new Error('A state is required to build the FHIR bundle.');
  if (!answers.name?.trim()) throw new Error('A name is required to build the FHIR bundle.');

  const now = opts.now ?? new Date();
  const timestamp = now.toISOString();
  const uuid = opts.uuid ?? (() => crypto.randomUUID());
  const t = opts.t;
  const ctx: StatementContext = { t, lang: 'en', state: plan.state };
  const agent = agentWord(ctx);
  const noInstruction = t('statements.none');

  const entries: BundleEntry[] = [];
  const add = <T extends Resource>(resource: T): Reference => {
    const id = resource.id!;
    entries.push({ fullUrl: `urn:uuid:${id}`, resource });
    return { reference: `urn:uuid:${id}` };
  };
  const ref = (r: Reference, display?: string): Reference => (display ? { ...r, display } : r);

  // --- Patient -------------------------------------------------------------
  const patientId = uuid();
  const name = splitName(answers.name);
  const address = answers.address;
  const patient: Patient = {
    resourceType: 'Patient',
    id: patientId,
    meta: { profile: [PROFILES.patient] },
    text: narrative([
      answers.name,
      answers.birthDate ? `Born ${answers.birthDate}` : '',
      formatAddress(address),
    ]),
    identifier: [{ system: 'urn:ietf:rfc:3986', value: `urn:uuid:${patientId}` }],
    active: true,
    name: [
      {
        use: 'official',
        text: answers.name.trim(),
        ...(name.family ? { family: name.family } : {}),
        given: name.given,
      },
    ],
    gender: 'unknown',
    ...(answers.birthDate ? { birthDate: answers.birthDate } : {}),
    ...(answers.phone ? { telecom: [{ system: 'phone', value: answers.phone, use: 'home' }] } : {}),
    ...(address && formatAddress(address)
      ? {
          address: [
            {
              use: 'home',
              type: 'physical',
              text: formatAddress(address),
              ...(address.street ? { line: [address.street] } : {}),
              ...(address.city ? { city: address.city } : {}),
              ...(address.state ? { state: address.state } : {}),
              ...(address.postalCode ? { postalCode: address.postalCode } : {}),
              country: 'US',
            },
          ],
        }
      : {}),
    communication: [
      {
        language: {
          coding: [
            {
              system: 'urn:ietf:bcp:47',
              code: opts.lang === 'es' ? 'es' : 'en',
              display: opts.lang === 'es' ? 'Spanish' : 'English',
            },
          ],
        },
        preferred: true,
      },
    ],
    ...(answers.physician?.name
      ? {
          generalPractitioner: [
            {
              display: [answers.physician.name, answers.physician.phone].filter(Boolean).join(', '),
            },
          ],
        }
      : {}),
  };
  const patientRef = ref(add(patient), answers.name.trim());

  // --- Custodian -----------------------------------------------------------
  const organization: Organization = {
    resourceType: 'Organization',
    id: uuid(),
    meta: { profile: [PROFILES.organization] },
    text: narrative(['Carewish — document held by the patient']),
    active: true,
    name: 'Carewish (patient-held document)',
  };
  const custodianRef = ref(add(organization), organization.name);

  // --- Healthcare agents ---------------------------------------------------
  const agentEntries: Reference[] = [];
  const participant = (person: Person, roleText: string): Reference => {
    const coding = person.relationship ? RELATIONSHIP_CODES[person.relationship] : undefined;
    const telecom: RelatedPerson['telecom'] = [];
    if (person.phone) telecom.push({ system: 'phone', value: person.phone });
    if (person.email) telecom.push({ system: 'email', value: person.email });
    const rp: RelatedPerson = {
      resourceType: 'RelatedPerson',
      id: uuid(),
      meta: { profile: [PROFILES.participant] },
      text: narrative([
        roleText,
        person.name,
        person.phone ?? '',
        person.email ?? '',
        person.address ?? '',
      ]),
      active: true,
      patient: patientRef,
      ...(coding ? { relationship: [{ coding: [coding] }] } : {}),
      name: [{ text: person.name.trim(), ...nameParts(person.name) }],
      telecom,
      ...(person.address ? { address: [{ text: person.address }] } : {}),
    };
    return ref(add(rp), person.name.trim());
  };

  const healthcareAgentSection: CompositionSection = {
    title: 'Healthcare Agent',
    code: loinc('81335-2', 'Patient Healthcare agent'),
    text: narrative(
      blocksToLines(
        [
          ...sectionBlocks('agent', answers, ctx),
          ...sectionBlocks('alternate-agent', answers, ctx),
          ...sectionBlocks('agent-authority', answers, ctx),
        ],
        noInstruction,
      ),
    ),
  };

  if (hasAgent(answers)) {
    const primary = participant(answers.agent!, `Primary ${agent}`);
    const actors: ConsentProvision['actor'] = [
      { role: loinc('75783-1', 'Primary healthcare agent [Reported]'), reference: primary },
    ];
    agentEntries.push(primary);
    if (hasAlternate(answers)) {
      const alt = participant(answers.alternate!, `Alternate ${agent}`);
      actors.push({
        role: loinc('75784-9', 'First alternate healthcare agent [Reported]'),
        reference: alt,
      });
      agentEntries.push(alt);
    }

    const coding = (code: string, display: string): CodeableConcept => ({
      coding: [{ system: HCA_DECISIONS, code, display }],
    });
    const limited = answers.agentAuthority === 'no';
    const provision: ConsentProvision = {
      type: 'permit',
      actor: actors,
      action: ALL_DECISIONS.filter(([code]) => !limited || !LIFE_SUSTAINING.has(code)).map(
        ([c, d]) => coding(c, d),
      ),
      purpose: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/v3-ActReason',
          code: 'PWATRNY',
          display: 'power of attorney',
        },
      ],
      ...(limited
        ? {
            provision: [
              {
                type: 'deny',
                action: ALL_DECISIONS.filter(([code]) => LIFE_SUSTAINING.has(code)).map(([c, d]) =>
                  coding(c, d),
                ),
              },
            ],
          }
        : {}),
    };
    const consent: Consent = {
      resourceType: 'Consent',
      id: uuid(),
      meta: { profile: [PROFILES.consent] },
      text: narrative(blocksToLines(sectionBlocks('agent-authority', answers, ctx), noInstruction)),
      status: 'active',
      scope: loinc('75786-4', 'Powers granted to healthcare agent [Reported]'),
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/consentcategorycodes',
              code: 'acd',
              display: 'Advance Directive',
            },
          ],
        },
      ],
      patient: patientRef,
      dateTime: timestamp,
      policyRule: { text: plan.documents.map((d) => d.citation).join('; ') },
      provision,
    };
    healthcareAgentSection.entry = [add(consent), ...agentEntries];
  } else {
    healthcareAgentSection.emptyReason = {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/data-absent-reason',
          code: 'asked-declined',
          display: 'Asked But Declined',
        },
      ],
    };
  }

  // --- Preferences ---------------------------------------------------------
  const observation = (
    profile: string,
    category: 'intervention-preference' | 'care-experience-preference' | null,
    code: CodeableConcept,
    intro: string,
    value: string,
  ): Reference => {
    const obs: Observation = {
      resourceType: 'Observation',
      id: uuid(),
      meta: { profile: [profile] },
      text: narrative([intro, value]),
      status: 'final',
      ...(category
        ? {
            category: [
              {
                coding: [
                  {
                    system: PREFERENCE_CATEGORY,
                    code: category,
                    display:
                      category === 'intervention-preference'
                        ? 'Intervention preference'
                        : 'Care experience preference',
                  },
                ],
              },
            ],
          }
        : {}),
      code,
      subject: patientRef,
      effectiveDateTime: timestamp,
      performer: [patientRef],
      valueString: `${intro} ${value}`,
    };
    return add(obs);
  };
  const intervention = (code: CodeableConcept, intro: string, value: string) =>
    observation(PROFILES.intervention, 'intervention-preference', code, intro, value);

  const carePlan = (
    title: string,
    addresses: string[],
    supportingInfo: Reference[],
    lines: string[],
  ): Reference => {
    const plan: CarePlan = {
      resourceType: 'CarePlan',
      id: uuid(),
      meta: { profile: [PROFILES.carePlan] },
      text: narrative(lines),
      status: 'active',
      intent: 'proposal',
      category: [{ coding: [{ system: SNOMED, code: '736366004', display: 'Advance care plan' }] }],
      title,
      subject: patientRef,
      addresses: addresses.map((display) => ({ display })),
      supportingInfo,
    };
    return add(plan);
  };

  const conditionPlans: Reference[] = [];
  const scenarios = [
    {
      value: answers.terminal,
      intro: t('statements.terminalIntro'),
      code: loinc(
        '75777-3',
        'Information to tell doctors if my health deteriorates due to a terminal illness and I am unable to interact meaningfully with family, friends, or surroundings [Reported]',
      ),
      title: 'Preferences if I have a terminal condition',
      addresses: ['Terminal condition'],
    },
    {
      value: answers.unconscious,
      intro: t('statements.unconsciousIntro'),
      code: loinc(
        '75778-1',
        "Information to tell doctors if I have a severe, irreversible brain injury or illness and can't dress, feed, or bathe myself, or communicate my medical wishes, but can be kept alive [Reported]",
      ),
      title: 'Preferences if I am permanently unconscious',
      addresses: ['Permanent unconsciousness (persistent vegetative state or irreversible coma)'],
    },
    {
      value: answers.advancedIllness,
      intro: t('statements.advancedIllnessIntro'),
      code: loinc(
        '75778-1',
        "Information to tell doctors if I have a severe, irreversible brain injury or illness and can't dress, feed, or bathe myself, or communicate my medical wishes, but can be kept alive [Reported]",
      ),
      title: 'Preferences if I have an end-stage or irreversible condition',
      addresses: ['End-stage or irreversible condition, such as advanced dementia'],
    },
  ];
  for (const s of scenarios) {
    if (!s.value) continue;
    const text = t(`statements.treatment.${s.value}`, { agent });
    const obsRef = intervention(s.code, s.intro, text);
    conditionPlans.push(carePlan(s.title, s.addresses, [obsRef], [s.intro, text]));
  }

  const general: Reference[] = [];
  const generalLines: string[] = [];
  const generalPref = (
    value: string | undefined,
    introKey: string,
    group: string,
    code: CodeableConcept,
  ) => {
    if (!value) return;
    const intro = t(`statements.${introKey}`);
    const text = t(`statements.${group}.${value}`, { agent });
    general.push(intervention(code, intro, text));
    generalLines.push(intro, text);
  };
  generalPref(
    answers.nutrition,
    'nutritionIntro',
    'nutrition',
    loinc('75788-0', 'Advance directive - request for tube feeding'),
  );
  generalPref(
    answers.cpr,
    'cprIntro',
    'cpr',
    loinc('75779-9', 'Thoughts on cardiopulmonary resuscitation (CPR) [Reported]'),
  );
  generalPref(answers.pain, 'painIntro', 'pain', {
    text: 'Preference about pain relief that may hasten death',
  });
  generalPref(
    answers.place,
    'placeIntro',
    'place',
    loinc('75780-7', 'Preferred location to spend final days if possible to choose [Reported]'),
  );
  if (general.length) {
    conditionPlans.push(
      carePlan(
        'Treatment preferences for serious illness',
        ['Any condition in which I cannot make my own health care decisions'],
        general,
        generalLines,
      ),
    );
  }

  const careExperience: Reference[] = [];
  const careLines: string[] = [];
  const valueItems = sectionBlocks('values', answers, ctx).find((b) => b.kind === 'list');
  if (valueItems && valueItems.kind === 'list') {
    careExperience.push(
      observation(
        PROFILES.careExperience,
        'care-experience-preference',
        loinc('81380-8', 'Goals, preferences, and priorities for care experience [Reported]'),
        valueItems.intro,
        valueItems.items.join('; '),
      ),
    );
    careLines.push(valueItems.intro, ...valueItems.items.map((i) => `• ${i}`));
  }
  if (answers.spiritual?.trim()) {
    const intro = t('statements.spiritualIntro');
    careExperience.push(
      observation(
        PROFILES.careExperience,
        'care-experience-preference',
        loinc('81364-2', 'Religious or cultural beliefs [Reported]'),
        intro,
        answers.spiritual.trim(),
      ),
    );
    careLines.push(intro, answers.spiritual.trim());
  }
  if (answers.other?.trim()) {
    const intro = t('statements.otherIntro');
    careExperience.push(
      observation(
        PROFILES.careExperience,
        'care-experience-preference',
        loinc('81380-8', 'Goals, preferences, and priorities for care experience [Reported]'),
        intro,
        answers.other.trim(),
      ),
    );
    careLines.push(intro, answers.other.trim());
  }

  const uponDeath: Reference[] = [];
  const deathLines: string[] = [];
  if (answers.organ) {
    const intro = t('statements.organIntro');
    const text = t(`statements.organ.${answers.organ}`, {
      agent,
      detail: answers.organDetail?.trim() ?? '',
    });
    uponDeath.push(
      observation(
        PROFILES.organDonation,
        null,
        loinc('75781-5', 'Thoughts on organ and tissue donations [Reported]'),
        intro,
        text,
      ),
    );
    deathLines.push(intro, text);
  }

  // --- Signing requirements (witness and notary section) -------------------
  const signingLines = plan.documents.flatMap((doc) => [
    `${doc.title} (${doc.citation})`,
    ...signingChecklist(doc).flatMap((step) => describeStep(step, plan.state, 'en')),
  ]);
  for (const note of plan.state.notes ?? []) signingLines.push(localize(note, 'en'));

  // --- Composition ---------------------------------------------------------
  const sections: CompositionSection[] = [healthcareAgentSection];
  if (careExperience.length) {
    sections.push({
      title: 'Personal Care Experience',
      code: loinc('81338-6', 'Patient Goals, Preferences, and Priorities for Care Experience'),
      text: narrative(careLines),
      entry: careExperience,
    });
  }
  if (conditionPlans.length) {
    sections.push({
      title: 'Preferences Under Certain Health Conditions',
      code: loinc(
        '81336-0',
        'Patient Goals, preferences, and priorities under certain health conditions',
      ),
      text: narrative(
        blocksToLines(
          [
            ...sectionBlocks('life-sustaining', answers, ctx),
            ...sectionBlocks('nutrition', answers, ctx),
            ...sectionBlocks('cpr', answers, ctx),
            ...sectionBlocks('pain-relief', answers, ctx),
          ],
          noInstruction,
        ),
      ),
      entry: conditionPlans,
    });
  }
  if (uponDeath.length) {
    sections.push({
      title: 'Upon Death',
      code: loinc('81337-8', 'Patient Goals, Preferences, and Priorities Upon Death'),
      text: narrative(deathLines),
      entry: uponDeath,
    });
  }
  sections.push({
    title: 'Witnesses and Notary',
    code: loinc('81339-4', 'Witness and Notary Document'),
    text: narrative(signingLines),
  });

  const compositionId = uuid();
  const composition: Composition = {
    resourceType: 'Composition',
    id: compositionId,
    meta: { profile: [PROFILES.composition] },
    language: 'en-US',
    text: narrative([
      `${plan.state.name} advance directive for ${answers.name.trim()}`,
      ...plan.documents.map((d) => `${d.title} — ${d.citation}`),
    ]),
    extension: [
      { url: EXT.version, valueInteger: 1 },
      {
        url: EXT.jurisdiction,
        valueCodeableConcept: {
          coding: [{ system: 'urn:iso:std:iso:3166:-2', code: `US-${plan.state.code}` }],
        },
      },
    ],
    identifier: { system: 'urn:ietf:rfc:3986', value: `urn:uuid:${compositionId}` },
    status: 'final',
    type: loinc('81334-5', 'Patient Personal advance care plan'),
    category: [loinc('42348-3', 'Advance directives')],
    subject: patientRef,
    date: timestamp,
    author: [patientRef],
    title: `${plan.state.name} Advance Directive — ${plan.documents.map((d) => d.title).join('; ')}`,
    custodian: custodianRef,
    section: sections,
  };

  const bundleId = uuid();
  return {
    resourceType: 'Bundle',
    id: bundleId,
    meta: {
      lastUpdated: timestamp,
      ...(opts.appVersion
        ? { tag: [{ system: 'urn:carewish:version', code: opts.appVersion }] }
        : {}),
    },
    identifier: { system: 'urn:ietf:rfc:3986', value: `urn:uuid:${bundleId}` },
    type: 'document',
    timestamp,
    entry: [{ fullUrl: `urn:uuid:${compositionId}`, resource: composition }, ...entries],
  };
}

function nameParts(full: string): { family?: string; given?: string[] } {
  const { given, family } = splitName(full);
  return { ...(family ? { family } : {}), ...(given.length ? { given } : {}) };
}
