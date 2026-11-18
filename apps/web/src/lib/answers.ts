import {
  RELATIONSHIPS as RELATIONSHIP_VALUES,
  WITNESS_ATTRIBUTES as WITNESS_ATTRIBUTE_VALUES,
  type Relationship,
  type StateCode,
  type WitnessAttribute,
} from '@carewish/form-rules';

export type TreatmentChoice = 'comfort' | 'prolong' | 'agent-decides';
export type NutritionChoice = 'want' | 'trial' | 'decline' | 'agent-decides';
export type CprChoice = 'want' | 'decline' | 'agent-decides';
export type PainChoice = 'comfort' | 'not-if-shortens' | 'agent-decides';
export type PlaceChoice = 'home' | 'hospice' | 'hospital' | 'no-preference';
export type OrganChoice = 'any' | 'specific' | 'none' | 'agent-decides';
export type AgentAuthority = 'yes' | 'no';

export const VALUE_CODES = [
  'comfort',
  'recognize-family',
  'independence',
  'not-burden',
  'live-longer',
  'at-home',
  'loved-ones-near',
  'faith',
] as const;
export type ValueCode = (typeof VALUE_CODES)[number];

export const AGENT_RELATIONSHIPS = [
  'spouse',
  'partner',
  'child',
  'parent',
  'sibling',
  'other-relative',
  'friend',
  'other',
] as const;
export type AgentRelationship = (typeof AGENT_RELATIONSHIPS)[number];

export interface Person {
  name: string;
  relationship?: AgentRelationship;
  phone?: string;
  email?: string;
  address?: string;
}

export interface Address {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
}

export interface WitnessDraft {
  id: string;
  name: string;
  relationship: Relationship;
  attributes: WitnessAttribute[];
}

/** Everything the person tells Carewish. Stored in IndexedDB on their device. */
export interface Answers {
  version: 1;
  state?: StateCode;
  name?: string;
  birthDate?: string;
  address?: Address;
  phone?: string;
  agent?: Person;
  alternate?: Person;
  agentAuthority?: AgentAuthority;
  terminal?: TreatmentChoice;
  unconscious?: TreatmentChoice;
  advancedIllness?: TreatmentChoice;
  nutrition?: NutritionChoice;
  cpr?: CprChoice;
  pain?: PainChoice;
  values?: ValueCode[];
  valuesNote?: string;
  place?: PlaceChoice;
  spiritual?: string;
  organ?: OrganChoice;
  organDetail?: string;
  physician?: { name?: string; phone?: string };
  other?: string;
  witnesses?: WitnessDraft[];
  /** ISO timestamp when the plan was first created. */
  createdAt?: string;
  /** ISO timestamp of the last change. */
  updatedAt?: string;
}

export function emptyAnswers(now = new Date()): Answers {
  return { version: 1, createdAt: now.toISOString(), updatedAt: now.toISOString() };
}

export function hasAgent(a: Answers): boolean {
  return Boolean(a.agent?.name?.trim());
}

export function hasAlternate(a: Answers): boolean {
  return Boolean(a.alternate?.name?.trim());
}

/** True when the person gave any treatment or values instruction. */
export function hasWishes(a: Answers): boolean {
  return Boolean(
    a.terminal ||
    a.unconscious ||
    a.advancedIllness ||
    a.nutrition ||
    a.cpr ||
    a.pain ||
    a.values?.length ||
    a.valuesNote?.trim() ||
    a.place ||
    a.spiritual?.trim() ||
    a.organ ||
    a.other?.trim(),
  );
}

/** Whole years between a birth date (YYYY-MM-DD) and `on`. */
export function ageOn(birthDate: string, on = new Date()): number | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!m) return undefined;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d)
    return undefined;
  let age = on.getUTCFullYear() - y;
  const beforeBirthday =
    on.getUTCMonth() < mo - 1 || (on.getUTCMonth() === mo - 1 && on.getUTCDate() < d);
  if (beforeBirthday) age -= 1;
  return age;
}

/** One-line address, e.g. "12 Oak St, Fresno, CA 93701". */
export function formatAddress(address?: Address): string {
  if (!address) return '';
  const cityLine = [address.city, [address.state, address.postalCode].filter(Boolean).join(' ')]
    .filter((s) => s && s.trim())
    .join(', ');
  return [address.street, cityLine].filter((s) => s && s.trim()).join(', ');
}

/** Splits a full name into given and family names for FHIR. */
export function splitName(full: string): { given: string[]; family?: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { given: parts };
  return { given: parts.slice(0, -1), family: parts.at(-1) };
}

/** A filesystem-safe slug of the person's name for download file names. */
export function fileSlug(name?: string): string {
  const slug = (name ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'my';
}

// ---- validation of untrusted input (backups, vault) -------------------------

const ENUMS = {
  agentAuthority: ['yes', 'no'],
  terminal: ['comfort', 'prolong', 'agent-decides'],
  unconscious: ['comfort', 'prolong', 'agent-decides'],
  advancedIllness: ['comfort', 'prolong', 'agent-decides'],
  nutrition: ['want', 'trial', 'decline', 'agent-decides'],
  cpr: ['want', 'decline', 'agent-decides'],
  pain: ['comfort', 'not-if-shortens', 'agent-decides'],
  place: ['home', 'hospice', 'hospital', 'no-preference'],
  organ: ['any', 'specific', 'none', 'agent-decides'],
} as const;

const MAX_TEXT = 4000;

function str(v: unknown, max = 300): string | undefined {
  return typeof v === 'string' ? v.slice(0, max) : undefined;
}

function person(v: unknown): Person | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const p = v as Record<string, unknown>;
  const name = str(p.name, 200);
  if (name === undefined) return undefined;
  const relationship = (AGENT_RELATIONSHIPS as readonly unknown[]).includes(p.relationship)
    ? (p.relationship as AgentRelationship)
    : undefined;
  return {
    name,
    ...(relationship ? { relationship } : {}),
    ...(str(p.phone, 40) !== undefined ? { phone: str(p.phone, 40) } : {}),
    ...(str(p.email, 254) !== undefined ? { email: str(p.email, 254) } : {}),
    ...(str(p.address) !== undefined ? { address: str(p.address) } : {}),
  };
}

/**
 * Validates and copies untrusted data (an imported backup or a decrypted
 * vault) into a clean Answers object. Returns null when it isn't Carewish data.
 */
export function sanitizeAnswers(input: unknown, isState: (s: string) => boolean): Answers | null {
  if (!input || typeof input !== 'object') return null;
  const src = input as Record<string, unknown>;
  if (src.version !== 1) return null;
  const out: Answers = { version: 1 };

  if (typeof src.state === 'string' && isState(src.state))
    out.state = src.state as Answers['state'];
  const name = str(src.name, 200);
  if (name !== undefined) out.name = name;
  if (typeof src.birthDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(src.birthDate))
    out.birthDate = src.birthDate;
  if (src.address && typeof src.address === 'object') {
    const a = src.address as Record<string, unknown>;
    out.address = {
      ...(str(a.street) !== undefined ? { street: str(a.street) } : {}),
      ...(str(a.city, 100) !== undefined ? { city: str(a.city, 100) } : {}),
      ...(str(a.state, 40) !== undefined ? { state: str(a.state, 40) } : {}),
      ...(str(a.postalCode, 20) !== undefined ? { postalCode: str(a.postalCode, 20) } : {}),
    };
  }
  const phone = str(src.phone, 40);
  if (phone !== undefined) out.phone = phone;
  const agent = person(src.agent);
  if (agent) out.agent = agent;
  const alternate = person(src.alternate);
  if (alternate) out.alternate = alternate;

  for (const [key, allowed] of Object.entries(ENUMS)) {
    const value = src[key];
    if ((allowed as readonly unknown[]).includes(value))
      (out as unknown as Record<string, unknown>)[key] = value;
  }
  if (Array.isArray(src.values)) {
    out.values = [
      ...new Set(
        src.values.filter((v): v is ValueCode => (VALUE_CODES as readonly unknown[]).includes(v)),
      ),
    ];
  }
  for (const key of ['valuesNote', 'spiritual', 'organDetail', 'other'] as const) {
    const v = str(src[key], MAX_TEXT);
    if (v !== undefined) out[key] = v;
  }
  if (src.physician && typeof src.physician === 'object') {
    const p = src.physician as Record<string, unknown>;
    out.physician = {
      ...(str(p.name, 200) !== undefined ? { name: str(p.name, 200) } : {}),
      ...(str(p.phone, 40) !== undefined ? { phone: str(p.phone, 40) } : {}),
    };
  }
  if (Array.isArray(src.witnesses)) {
    out.witnesses = src.witnesses.slice(0, 3).flatMap((w): WitnessDraft[] => {
      if (!w || typeof w !== 'object') return [];
      const x = w as Record<string, unknown>;
      return [
        {
          id: str(x.id, 64) ?? Math.random().toString(36).slice(2),
          name: str(x.name, 200) ?? '',
          relationship: (RELATIONSHIP_VALUES as readonly unknown[]).includes(x.relationship)
            ? (x.relationship as WitnessDraft['relationship'])
            : 'none',
          attributes: Array.isArray(x.attributes)
            ? (x.attributes.filter((a) =>
                (WITNESS_ATTRIBUTE_VALUES as readonly unknown[]).includes(a),
              ) as WitnessDraft['attributes'])
            : [],
        },
      ];
    });
  }
  for (const key of ['createdAt', 'updatedAt'] as const) {
    const v = str(src[key], 40);
    if (v && !Number.isNaN(Date.parse(v))) out[key] = v;
  }
  return out;
}
