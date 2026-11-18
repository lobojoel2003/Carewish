import { isStateCode } from '@carewish/form-rules';
import { describe, expect, it } from 'vitest';
import {
  ageOn,
  emptyAnswers,
  fileSlug,
  formatAddress,
  hasAgent,
  hasWishes,
  sanitizeAnswers,
  splitName,
} from '@/lib/answers';
import { fullAnswers } from './fixtures';

describe('answers helpers', () => {
  it('computes age on a date', () => {
    const on = new Date('2026-03-03T00:00:00Z');
    expect(ageOn('1956-03-04', on)).toBe(69);
    expect(ageOn('1956-03-03', on)).toBe(70);
    expect(ageOn('2026-02-30', on)).toBeUndefined();
    expect(ageOn('nope', on)).toBeUndefined();
  });

  it('formats addresses', () => {
    expect(
      formatAddress({ street: '12 Oak St', city: 'Fresno', state: 'CA', postalCode: '93701' }),
    ).toBe('12 Oak St, Fresno, CA 93701');
    expect(formatAddress({ city: 'Fresno' })).toBe('Fresno');
    expect(formatAddress(undefined)).toBe('');
  });

  it('splits names and builds file slugs', () => {
    expect(splitName('Maria Elena Torres')).toEqual({
      given: ['Maria', 'Elena'],
      family: 'Torres',
    });
    expect(splitName('Cher')).toEqual({ given: ['Cher'] });
    expect(fileSlug('José Núñez-Ávila')).toBe('jose-nunez-avila');
    expect(fileSlug('   ')).toBe('my');
  });

  it('knows when there is an agent or wishes', () => {
    expect(hasAgent(emptyAnswers())).toBe(false);
    expect(hasWishes(emptyAnswers())).toBe(false);
    expect(hasAgent(fullAnswers())).toBe(true);
    expect(hasWishes({ version: 1, organ: 'none' })).toBe(true);
  });
});

describe('sanitizeAnswers', () => {
  it('keeps valid data', () => {
    const a = fullAnswers();
    expect(sanitizeAnswers(JSON.parse(JSON.stringify(a)), isStateCode)).toEqual(a);
  });

  it('rejects non-Carewish data', () => {
    expect(sanitizeAnswers(null, isStateCode)).toBeNull();
    expect(sanitizeAnswers({ version: 2 }, isStateCode)).toBeNull();
    expect(sanitizeAnswers('x', isStateCode)).toBeNull();
  });

  it('drops invalid fields and truncates long text', () => {
    const out = sanitizeAnswers(
      {
        version: 1,
        state: 'XX',
        terminal: 'maybe',
        birthDate: '4 March',
        values: ['comfort', 'hack', 'comfort'],
        other: 'x'.repeat(10_000),
        agent: { name: 'A', relationship: 'boss', phone: 5 },
        witnesses: [{ name: 'W', relationship: 'alien', attributes: ['agent', 'bogus'] }, 'junk'],
        updatedAt: 'not a date',
        evil: '<script>',
      },
      isStateCode,
    )!;
    expect(out.state).toBeUndefined();
    expect(out.terminal).toBeUndefined();
    expect(out.birthDate).toBeUndefined();
    expect(out.values).toEqual(['comfort']);
    expect(out.other).toHaveLength(4000);
    expect(out.agent).toEqual({ name: 'A' });
    expect(out.witnesses).toHaveLength(1);
    expect(out.witnesses![0]).toMatchObject({
      name: 'W',
      relationship: 'none',
      attributes: ['agent'],
    });
    expect(out.updatedAt).toBeUndefined();
    expect(out).not.toHaveProperty('evil');
  });
});
