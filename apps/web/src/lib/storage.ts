/**
 * Local persistence in the browser's IndexedDB. Answers never leave the
 * device unless the person creates an account.
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Answers } from './answers';

interface CarewishDB extends DBSchema {
  plan: { key: string; value: Answers };
  keys: { key: string; value: CryptoKey };
  meta: { key: string; value: unknown };
}

const DB_NAME = 'carewish';
const DB_VERSION = 1;
const PLAN_KEY = 'current';

let dbPromise: Promise<IDBPDatabase<CarewishDB>> | undefined;
const memory = new Map<string, unknown>();

function available(): boolean {
  return typeof indexedDB !== 'undefined';
}

function db(): Promise<IDBPDatabase<CarewishDB>> {
  dbPromise ??= openDB<CarewishDB>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      database.createObjectStore('plan');
      database.createObjectStore('keys');
      database.createObjectStore('meta');
    },
  });
  return dbPromise;
}

export async function loadAnswers(): Promise<Answers | undefined> {
  if (!available()) return memory.get('plan') as Answers | undefined;
  return (await db()).get('plan', PLAN_KEY);
}

export async function saveAnswers(answers: Answers): Promise<void> {
  if (!available()) {
    memory.set('plan', answers);
    return;
  }
  await (await db()).put('plan', answers, PLAN_KEY);
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  if (!available()) return memory.get(`meta:${key}`) as T | undefined;
  return (await (await db()).get('meta', key)) as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  if (!available()) {
    memory.set(`meta:${key}`, value);
    return;
  }
  await (await db()).put('meta', value, key);
}

export async function deleteMeta(key: string): Promise<void> {
  if (!available()) {
    memory.delete(`meta:${key}`);
    return;
  }
  await (await db()).delete('meta', key);
}

/** Stores a non-extractable CryptoKey so the vault stays unlocked across reloads. */
export async function saveKey(name: string, key: CryptoKey): Promise<void> {
  if (!available()) {
    memory.set(`key:${name}`, key);
    return;
  }
  await (await db()).put('keys', key, name);
}

export async function loadKey(name: string): Promise<CryptoKey | undefined> {
  if (!available()) return memory.get(`key:${name}`) as CryptoKey | undefined;
  return (await db()).get('keys', name);
}

export async function deleteKey(name: string): Promise<void> {
  if (!available()) {
    memory.delete(`key:${name}`);
    return;
  }
  await (await db()).delete('keys', name);
}

/** Removes everything Carewish stored on this device. */
export async function clearAll(): Promise<void> {
  memory.clear();
  if (!available()) return;
  const database = await db();
  await Promise.all([database.clear('plan'), database.clear('keys'), database.clear('meta')]);
}
