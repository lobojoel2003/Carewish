/**
 * Types for the Carewish state form rules.
 *
 * Each U.S. state (plus the District of Columbia) is described by one YAML
 * file in `states/`. The YAML is validated against `schema/state.schema.json`
 * and compiled into a typed data module at build time.
 */

/** USPS two-letter codes for the 50 states and the District of Columbia. */
export const STATE_CODES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL',
  'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME',
  'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH',
  'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI',
  'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI',
  'WY',
] as const; // prettier-ignore

export type StateCode = (typeof STATE_CODES)[number];

/** Languages the rules library ships text for. English is always present. */
export type Language = 'en' | 'es';

/**
 * Text that may be translated. A plain string is English. An object maps
 * language codes to text and must contain `en`.
 */
export type LocalizedText = string | ({ en: string } & Partial<Record<string, string>>);

/** How a document must be signed to be valid. */
export const EXECUTION_METHODS = [
  /** Witnesses are required; a notary is not needed. */
  'witnesses',
  /** A notary public must acknowledge the signature; witnesses are not needed. */
  'notary',
  /** Either the required witnesses or a notary public. */
  'witnesses-or-notary',
  /** Both the required witnesses and a notary public. */
  'witnesses-and-notary',
  /** Only the person's own signature is required. */
  'signature-only',
] as const;

export type ExecutionMethod = (typeof EXECUTION_METHODS)[number];

/**
 * Facts about a would-be witness (or notary) that state laws use to
 * disqualify them. Relationship facts are usually derived from a
 * {@link Relationship}; the rest are answered directly.
 */
export const WITNESS_ATTRIBUTES = [
  'agent',
  'spouse',
  'immediate-family',
  'relative-within-third-degree',
  'blood-relative',
  'relative-by-marriage',
  'relative',
  'heir',
  'beneficiary',
  'creditor',
  'financially-responsible',
  'physician',
  'attending-physician',
  'healthcare-provider',
  'provider-employee',
  'facility-operator',
  'facility-employee',
  'insurer-employee',
  'signed-for-principal',
] as const;

export type WitnessAttribute = (typeof WITNESS_ATTRIBUTES)[number];

/** How a witness is related to the person making the directive. */
export const RELATIONSHIPS = [
  'none',
  'spouse',
  'parent',
  'child',
  'sibling',
  'grandparent',
  'grandchild',
  'aunt-uncle-niece-nephew',
  'cousin-or-distant',
  'in-law-or-step',
] as const;

export type Relationship = (typeof RELATIONSHIPS)[number];

export const WITNESS_RULE_TYPES = [
  /** No witness may have any of the listed attributes. */
  'none-may-be',
  /** At least one witness must have none of the listed attributes. */
  'at-least-one-not',
  /** At most one witness may have any of the listed attributes. */
  'at-most-one',
] as const;

export type WitnessRuleType = (typeof WITNESS_RULE_TYPES)[number];

export interface WitnessRule {
  type: WitnessRuleType;
  attributes: WitnessAttribute[];
  /** Extra detail, for example an exception the attribute list cannot express. */
  note?: LocalizedText;
}

export interface WitnessRequirements {
  /** Minimum number of witnesses. */
  count: number;
  /** Minimum age of each witness. */
  minAge: number;
  rules: WitnessRule[];
}

export interface NotaryRequirements {
  /** Attributes that disqualify someone from acting as the notary. */
  disqualified?: WitnessAttribute[];
  /**
   * True when a notary is not legally required but is recommended
   * (for example because the statutory form includes a notary block).
   */
  recommended?: boolean;
  note?: LocalizedText;
}

export interface SpecialRequirement {
  /** Stable identifier, e.g. `skilled-nursing-facility`. */
  id: string;
  text: LocalizedText;
}

export interface Execution {
  method: ExecutionMethod;
  witnesses?: WitnessRequirements;
  notary?: NotaryRequirements;
  /** Requirements that apply only in some settings, such as nursing homes. */
  special?: SpecialRequirement[];
  /** True when the agent must sign an acceptance before acting. */
  agentAcceptance?: boolean;
}

/**
 * Content blocks the wizard collects. A state's document lists which
 * sections each of its parts contains, in the order the form presents them.
 */
export const SECTION_IDS = [
  'principal',
  'agent',
  'alternate-agent',
  'agent-authority',
  'life-sustaining',
  'nutrition',
  'cpr',
  'pain-relief',
  'values',
  'organ-donation',
  'physician',
  'additional-wishes',
] as const;

export type SectionId = (typeof SECTION_IDS)[number];

export interface FormPart {
  /** Heading as it appears on the state's form. */
  title: string;
  sections: SectionId[];
}

export const DOCUMENT_KINDS = ['power-of-attorney', 'living-will', 'combined'] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

/** Optional mapping onto an official fillable (AcroForm) PDF. */
export interface PdfTemplate {
  /** File name of the template, resolved by the consuming app. */
  file: string;
  /** Map of Carewish field keys (e.g. `agent.name`) to AcroForm field names. */
  fields: Record<string, string>;
}

export interface DocumentRules {
  /** Stable identifier within the state, e.g. `medical-power-of-attorney`. */
  id: string;
  /** Official name of the document. */
  title: string;
  kind: DocumentKind;
  /** Statute that defines the document or its form. */
  citation: string;
  parts: FormPart[];
  execution: Execution;
  template?: PdfTemplate;
}

/** Vocabulary for what a state calls the person who decides for you. */
export const AGENT_TERMS = [
  'agent',
  'health-care-agent',
  'health-care-proxy',
  'health-care-surrogate',
  'health-care-representative',
  'patient-advocate',
  'representative',
] as const;

export type AgentTerm = (typeof AGENT_TERMS)[number];

export interface Source {
  citation: string;
  url?: string;
}

export const REVIEW_STATUSES = ['needs-review', 'reviewed'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export interface Review {
  status: ReviewStatus;
  /** ISO date (YYYY-MM-DD) the rules were last checked against the sources. */
  lastChecked: string;
  /** Who reviewed the rules, when `status` is `reviewed`. */
  reviewer?: string;
  /** Open questions for maintainers. English only. */
  openQuestions?: string[];
}

export interface StateRules {
  code: StateCode;
  name: string;
  /** Age at which an adult may make an advance directive. */
  adultAge: number;
  terminology: {
    agent: AgentTerm;
  };
  documents: DocumentRules[];
  /** Plain-language notes shown with the signing checklist. */
  notes?: LocalizedText[];
  sources: Source[];
  review: Review;
}

/** A person who might act as a witness, as described by the user. */
export interface WitnessCandidate {
  /** Optional display name, echoed back in results. */
  name?: string;
  relationship?: Relationship;
  /** Attributes answered directly (not derived from the relationship). */
  attributes?: WitnessAttribute[];
  age?: number;
}
