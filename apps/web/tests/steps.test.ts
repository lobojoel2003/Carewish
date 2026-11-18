import { describe, expect, it } from 'vitest';
import {
  STEPS,
  findStep,
  isAnswered,
  missingRequired,
  neighbors,
  optionsFor,
  resumeStep,
  visibleSteps,
} from '@/lib/steps';
import { fullAnswers } from './fixtures';

describe('wizard steps', () => {
  it('hides agent-only steps without an agent', () => {
    const ids = visibleSteps({ version: 1 }).map((s) => s.id);
    expect(ids).not.toContain('alternate');
    expect(ids).not.toContain('authority');
    expect(visibleSteps(fullAnswers()).map((s) => s.id)).toEqual(STEPS.map((s) => s.id));
  });

  it('hides "let my agent decide" without an agent', () => {
    const terminal = findStep('terminal')!;
    expect(optionsFor(terminal, { version: 1 })).toEqual(['comfort', 'prolong']);
    expect(optionsFor(terminal, fullAnswers())).toContain('agent-decides');
  });

  it('requires state, name and birth date only', () => {
    expect(missingRequired({ version: 1 }).map((s) => s.id)).toEqual([
      'state',
      'name',
      'birthdate',
    ]);
    expect(missingRequired(fullAnswers())).toEqual([]);
  });

  it('resumes at the first missing answer', () => {
    expect(resumeStep({ version: 1 }).id).toBe('state');
    expect(resumeStep({ version: 1, state: 'CA', name: 'A', birthDate: '1950-01-01' }).id).toBe(
      'address',
    );
    expect(resumeStep(fullAnswers()).id).toBe('state');
  });

  it('detects answered steps of every kind', () => {
    const a = fullAnswers();
    for (const step of STEPS) expect(isAnswered(step, a), step.id).toBe(true);
    for (const step of STEPS) expect(isAnswered(step, { version: 1 }), step.id).toBe(false);
  });

  it('finds neighbors', () => {
    const n = neighbors('name', fullAnswers());
    expect(n.prev?.id).toBe('state');
    expect(n.next?.id).toBe('birthdate');
    expect(n.index).toBe(1);
    expect(neighbors('other', fullAnswers()).next).toBeUndefined();
    expect(findStep('nope')).toBeUndefined();
  });
});
