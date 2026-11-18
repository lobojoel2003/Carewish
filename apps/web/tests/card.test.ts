import { describe, expect, it } from 'vitest';
import { cardUrl, decodeCard, encodeCard, qrMatrix, qrPath, shareUrl, summarize } from '@/lib/card';
import { fromBase64, fromBase64Url, toBase64, toBase64Url } from '@/lib/encoding';
import { NOW, fullAnswers } from './fixtures';

describe('card summary', () => {
  it('summarizes the essentials', () => {
    const s = summarize(fullAnswers('CA'), 'en', NOW);
    expect(s).toMatchObject({
      v: 1,
      n: 'Maria Elena Torres',
      b: '1956-03-04',
      s: 'CA',
      d: '2026-11-18',
      a: [
        { n: 'Daniel Torres', p: '(559) 555-0142', r: 'child' },
        { n: 'Lucía Torres', p: '(559) 555-0199', r: 'sibling' },
      ],
      w: {
        t: 'comfort',
        u: 'comfort',
        i: 'agent-decides',
        f: 'trial',
        c: 'decline',
        p: 'comfort',
        o: 'any',
      },
    });
    const empty = summarize({ version: 1, name: 'X' }, 'es', NOW);
    expect(empty).toEqual({ v: 1, n: 'X', d: '2026-11-18', l: 'es' });
  });

  it('round-trips through a compact URL fragment', async () => {
    const s = summarize(fullAnswers('CA'), 'en', NOW);
    const encoded = await encodeCard(s);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(encoded.length).toBeLessThan(300);
    expect(await decodeCard(encoded)).toEqual(s);
  });

  it('rejects damaged or malicious fragments', async () => {
    expect(await decodeCard('')).toBeNull();
    expect(await decodeCard('not base64!')).toBeNull();
    expect(await decodeCard('AAAA')).toBeNull();
    const bad = async (v: unknown) => decodeCard(await encodeCard(v as never));
    expect(await bad({ v: 2, n: 'x', d: '2026-01-01' })).toBeNull();
    expect(await bad({ v: 1, n: 'x', d: 'today' })).toBeNull();
    expect(await bad({ v: 1, n: 'x', d: '2026-01-01', s: 'ZZ' })).toBeNull();
    expect(await bad({ v: 1, n: 'x', d: '2026-01-01', b: 7 })).toBeNull();
    expect(await bad({ v: 1, n: 'x', d: '2026-01-01', a: [{ n: 1 }] })).toBeNull();
    expect(await bad({ v: 1, n: 'x', d: '2026-01-01', a: [{ n: 'a', r: 'boss' }] })).toBeNull();
    expect(await bad({ v: 1, n: 'x', d: '2026-01-01', a: [{ n: 'a', p: 5 }] })).toBeNull();
    expect(await bad({ v: 1, n: 'x', d: '2026-01-01', a: [1, 2, 3] })).toBeNull();
    expect(await bad({ v: 1, n: 'x', d: '2026-01-01', w: 'x' })).toBeNull();
  });

  it('builds links', () => {
    expect(cardUrl('https://a.example/', 'abc')).toBe('https://a.example/card#abc');
    expect(shareUrl('https://a.example', 'id1', 'key1')).toBe('https://a.example/v/id1#k=key1');
  });

  it('draws QR codes', () => {
    const m = qrMatrix('https://a.example/v/abc#k=def');
    expect(m.size).toBeGreaterThanOrEqual(21);
    expect(qrPath(m)).toMatch(/^M\d+ \d+h1v1h-1z/);
  });
});

describe('encoding', () => {
  it('round-trips base64 and base64url', () => {
    const bytes = new Uint8Array(70_000).map((_, i) => (i * 31) % 256);
    expect(fromBase64(toBase64(bytes))).toEqual(bytes);
    expect(fromBase64Url(toBase64Url(bytes))).toEqual(bytes);
    expect(toBase64Url(new Uint8Array([251, 255]))).toBe('-_8');
    expect(() => fromBase64Url('a+b')).toThrow();
  });
});
