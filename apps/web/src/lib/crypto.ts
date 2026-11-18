/**
 * End-to-end encryption for optional accounts and card links. Everything
 * here runs in the browser with WebCrypto; the server only ever sees
 * ciphertext and a derived authentication key.
 *
 *   password ──PBKDF2-SHA-256 (600k)──▶ master key
 *   master ──HKDF "carewish/auth/v1"──▶ auth key   (sent to the server, which hashes it again)
 *   master ──HKDF "carewish/vault/v1"─▶ vault key  (AES-256-GCM, never leaves the device)
 */
import { fromBase64Url, toBase64Url } from './encoding';

export const KDF_ITERATIONS = 600_000;
export const MIN_PASSWORD_LENGTH = 12;

const enc = new TextEncoder();
const dec = new TextDecoder();
const subtle = () => globalThis.crypto.subtle;

export function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  globalThis.crypto.getRandomValues(out);
  return out;
}

export function newSalt(): string {
  return toBase64Url(randomBytes(16));
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && email.length <= 254;
}

export interface DerivedKeys {
  /** Base64url, sent to the server as the login secret. */
  authKey: string;
  /** Non-extractable AES-GCM key for the vault. */
  vaultKey: CryptoKey;
}

export async function deriveKeys(
  password: string,
  salt: string,
  iterations = KDF_ITERATIONS,
): Promise<DerivedKeys> {
  const base = await subtle().importKey(
    'raw',
    enc.encode(password.normalize('NFKC')),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const master = await subtle().deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromBase64Url(salt) as BufferSource, iterations },
    base,
    256,
  );
  const hkdf = await subtle().importKey('raw', master, 'HKDF', false, ['deriveBits', 'deriveKey']);
  const info = (label: string) => ({
    name: 'HKDF',
    hash: 'SHA-256',
    salt: new Uint8Array(32),
    info: enc.encode(label),
  });
  const authBits = await subtle().deriveBits(info('carewish/auth/v1'), hkdf, 256);
  const vaultKey = await subtle().deriveKey(
    info('carewish/vault/v1'),
    hkdf,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
  return { authKey: toBase64Url(new Uint8Array(authBits)), vaultKey };
}

export interface Sealed {
  /** Base64url 96-bit nonce. */
  iv: string;
  /** Base64url AES-GCM ciphertext with tag. */
  ciphertext: string;
}

export async function sealBytes(
  key: CryptoKey,
  data: Uint8Array,
  aad = 'carewish',
): Promise<Sealed> {
  const iv = randomBytes(12);
  const ct = await subtle().encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource, additionalData: enc.encode(aad) },
    key,
    data as BufferSource,
  );
  return { iv: toBase64Url(iv), ciphertext: toBase64Url(new Uint8Array(ct)) };
}

export async function openBytes(
  key: CryptoKey,
  sealed: Sealed,
  aad = 'carewish',
): Promise<Uint8Array> {
  const pt = await subtle().decrypt(
    {
      name: 'AES-GCM',
      iv: fromBase64Url(sealed.iv) as BufferSource,
      additionalData: enc.encode(aad),
    },
    key,
    fromBase64Url(sealed.ciphertext) as BufferSource,
  );
  return new Uint8Array(pt);
}

export async function sealJson(key: CryptoKey, value: unknown, aad?: string): Promise<Sealed> {
  return sealBytes(key, enc.encode(JSON.stringify(value)), aad);
}

export async function openJson<T = unknown>(
  key: CryptoKey,
  sealed: Sealed,
  aad?: string,
): Promise<T> {
  return JSON.parse(dec.decode(await openBytes(key, sealed, aad))) as T;
}

/** A random key for one card link. The raw key goes in the URL fragment. */
export async function newShareKey(): Promise<{ key: CryptoKey; raw: string }> {
  const raw = randomBytes(32);
  const key = await subtle().importKey('raw', raw as BufferSource, 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ]);
  return { key, raw: toBase64Url(raw) };
}

export async function importShareKey(raw: string): Promise<CryptoKey> {
  const bytes = fromBase64Url(raw);
  if (bytes.length !== 32) throw new Error('Invalid key');
  return subtle().importKey('raw', bytes as BufferSource, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
