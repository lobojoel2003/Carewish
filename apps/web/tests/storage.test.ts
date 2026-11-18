import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import {
  clearAll,
  deleteKey,
  deleteMeta,
  getMeta,
  loadAnswers,
  loadKey,
  saveAnswers,
  saveKey,
  setMeta,
} from '@/lib/storage';
import { fullAnswers } from './fixtures';

describe('IndexedDB storage', () => {
  it('saves, loads and clears answers, metadata and keys', async () => {
    expect(await loadAnswers()).toBeUndefined();
    await saveAnswers(fullAnswers());
    expect(await loadAnswers()).toEqual(fullAnswers());

    await setMeta('vaultRevision', 3);
    expect(await getMeta('vaultRevision')).toBe(3);
    await deleteMeta('vaultRevision');
    expect(await getMeta('vaultRevision')).toBeUndefined();

    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
      'encrypt',
      'decrypt',
    ]);
    await saveKey('vault', key);
    expect((await loadKey('vault'))?.algorithm).toMatchObject({ name: 'AES-GCM' });
    await deleteKey('vault');
    expect(await loadKey('vault')).toBeUndefined();

    await saveKey('vault', key);
    await clearAll();
    expect(await loadAnswers()).toBeUndefined();
    expect(await loadKey('vault')).toBeUndefined();
  });
});
