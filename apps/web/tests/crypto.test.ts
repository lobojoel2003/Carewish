import { describe, expect, it } from 'vitest';
import {
  deriveKeys,
  importShareKey,
  isValidEmail,
  newSalt,
  newShareKey,
  normalizeEmail,
  openBytes,
  openJson,
  sealBytes,
  sealJson,
} from '@/lib/crypto';

const FAST = 1000; // iterations for tests; production uses 600,000

describe('client-side encryption', () => {
  it('derives the same auth key for the same password and salt', async () => {
    const salt = newSalt();
    const a = await deriveKeys('correct horse battery staple', salt, FAST);
    const b = await deriveKeys('correct horse battery staple', salt, FAST);
    const c = await deriveKeys('correct horse battery stapler', salt, FAST);
    const d = await deriveKeys('correct horse battery staple', newSalt(), FAST);
    expect(a.authKey).toHaveLength(43);
    expect(a.authKey).toBe(b.authKey);
    expect(a.authKey).not.toBe(c.authKey);
    expect(a.authKey).not.toBe(d.authKey);
    expect(a.vaultKey.extractable).toBe(false);
  });

  it('normalizes Unicode in passwords', async () => {
    const salt = newSalt();
    const composed = await deriveKeys('café café café', salt, FAST);
    const decomposed = await deriveKeys('café café café', salt, FAST);
    expect(composed.authKey).toBe(decomposed.authKey);
  });

  it('seals and opens JSON with the vault key and rejects the wrong key or context', async () => {
    const salt = newSalt();
    const { vaultKey } = await deriveKeys('pw pw pw pw pw', salt, FAST);
    const sealed = await sealJson(vaultKey, { hello: 'mundo' }, 'ctx');
    expect(await openJson(vaultKey, sealed, 'ctx')).toEqual({ hello: 'mundo' });
    await expect(openJson(vaultKey, sealed, 'other')).rejects.toThrow();
    const other = await deriveKeys('different password', salt, FAST);
    await expect(openJson(other.vaultKey, sealed, 'ctx')).rejects.toThrow();
    const again = await sealJson(vaultKey, { hello: 'mundo' }, 'ctx');
    expect(again.iv).not.toBe(sealed.iv);
  });

  it('round-trips share keys through the URL fragment', async () => {
    const { key, raw } = await newShareKey();
    expect(raw).toHaveLength(43);
    const sealed = await sealBytes(key, new Uint8Array([1, 2, 3]));
    expect(await openBytes(await importShareKey(raw), sealed)).toEqual(new Uint8Array([1, 2, 3]));
    await expect(importShareKey('short')).rejects.toThrow();
  });

  it('validates and normalizes emails', () => {
    expect(normalizeEmail('  Maria@Example.COM ')).toBe('maria@example.com');
    expect(isValidEmail('a@b.co')).toBe(true);
    expect(isValidEmail('a@b')).toBe(false);
    expect(isValidEmail('no spaces@x.com')).toBe(false);
  });
});
