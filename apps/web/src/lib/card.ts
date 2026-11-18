import { isStateCode, type StateCode } from '@carewish/form-rules';
import QRCode from 'qrcode';
import {
  AGENT_RELATIONSHIPS,
  hasAgent,
  hasAlternate,
  type AgentRelationship,
  type Answers,
  type CprChoice,
  type NutritionChoice,
  type OrganChoice,
  type PainChoice,
  type TreatmentChoice,
} from './answers';
import { fromBase64Url, toBase64Url } from './encoding';

/**
 * The compact summary a wallet card's QR code carries when the person has
 * no account. It lives in the URL fragment, which browsers never send to a
 * server.
 */
export interface CardSummary {
  v: 1;
  /** Name */
  n: string;
  /** Birth date (YYYY-MM-DD) */
  b?: string;
  /** State */
  s?: StateCode;
  /** Agent, then alternate */
  a?: { n: string; p?: string; r?: AgentRelationship }[];
  /** Wishes: terminal, unconscious, advanced illness, feeding, CPR, pain, organs */
  w?: {
    t?: TreatmentChoice;
    u?: TreatmentChoice;
    i?: TreatmentChoice;
    f?: NutritionChoice;
    c?: CprChoice;
    p?: PainChoice;
    o?: OrganChoice;
  };
  /** Date prepared (YYYY-MM-DD) */
  d: string;
  /** Language of the person */
  l?: string;
}

export function summarize(a: Answers, lang: string, now = new Date()): CardSummary {
  const people = [hasAgent(a) ? a.agent : undefined, hasAlternate(a) ? a.alternate : undefined]
    .filter((p) => p !== undefined)
    .map((p) => ({
      n: p.name.trim(),
      ...(p.phone ? { p: p.phone } : {}),
      ...(p.relationship ? { r: p.relationship } : {}),
    }));
  const w = Object.fromEntries(
    Object.entries({
      t: a.terminal,
      u: a.unconscious,
      i: a.advancedIllness,
      f: a.nutrition,
      c: a.cpr,
      p: a.pain,
      o: a.organ,
    }).filter(([, v]) => v !== undefined),
  ) as CardSummary['w'];
  return {
    v: 1,
    n: a.name?.trim() ?? '',
    ...(a.birthDate ? { b: a.birthDate } : {}),
    ...(a.state ? { s: a.state } : {}),
    ...(people.length ? { a: people } : {}),
    ...(w && Object.keys(w).length ? { w } : {}),
    d: now.toISOString().slice(0, 10),
    l: lang,
  };
}

async function pipe(
  bytes: Uint8Array,
  stream: CompressionStream | DecompressionStream,
): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

export async function encodeCard(summary: CardSummary): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(summary));
  return toBase64Url(await pipe(json, new CompressionStream('deflate-raw')));
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Decodes and validates a card fragment. Returns null for anything malformed. */
export async function decodeCard(encoded: string): Promise<CardSummary | null> {
  try {
    const bytes = await pipe(fromBase64Url(encoded), new DecompressionStream('deflate-raw'));
    if (bytes.length > 20_000) return null;
    const data = JSON.parse(new TextDecoder().decode(bytes)) as Partial<CardSummary>;
    if (
      data.v !== 1 ||
      typeof data.n !== 'string' ||
      typeof data.d !== 'string' ||
      !DATE.test(data.d)
    )
      return null;
    if (data.b !== undefined && (typeof data.b !== 'string' || !DATE.test(data.b))) return null;
    if (data.s !== undefined && !isStateCode(data.s)) return null;
    if (data.a !== undefined) {
      if (!Array.isArray(data.a) || data.a.length > 2) return null;
      for (const p of data.a) {
        if (typeof p?.n !== 'string') return null;
        if (p.p !== undefined && typeof p.p !== 'string') return null;
        if (p.r !== undefined && !(AGENT_RELATIONSHIPS as readonly string[]).includes(p.r))
          return null;
      }
    }
    if (data.w !== undefined && (typeof data.w !== 'object' || data.w === null)) return null;
    return data as CardSummary;
  } catch {
    return null;
  }
}

export function cardUrl(origin: string, encoded: string): string {
  return `${origin.replace(/\/$/, '')}/card#${encoded}`;
}

export function shareUrl(origin: string, id: string, key: string): string {
  return `${origin.replace(/\/$/, '')}/v/${id}#k=${key}`;
}

export interface QrMatrix {
  size: number;
  isDark(row: number, col: number): boolean;
}

/**
 * QR matrix for a URL. Long summary links use low error correction so the
 * modules stay large enough to scan from a printed wallet card.
 */
export function qrMatrix(text: string): QrMatrix {
  const qr = QRCode.create(text, { errorCorrectionLevel: text.length > 120 ? 'L' : 'M' });
  return { size: qr.modules.size, isDark: (r, c) => Boolean(qr.modules.get(r, c)) };
}

/** SVG path data for the dark modules, one unit per module. */
export function qrPath(matrix: QrMatrix): string {
  let d = '';
  for (let r = 0; r < matrix.size; r++) {
    for (let c = 0; c < matrix.size; c++) {
      if (matrix.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    }
  }
  return d;
}
