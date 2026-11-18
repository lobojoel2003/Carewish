'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { emptyAnswers, type Answers } from '@/lib/answers';
import { clearAll, loadAnswers, saveAnswers } from '@/lib/storage';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface PlanContextValue {
  answers: Answers;
  ready: boolean;
  saveState: SaveState;
  update: (patch: Partial<Answers>) => void;
  replace: (answers: Answers) => void;
  reset: () => Promise<void>;
}

const PlanContext = createContext<PlanContextValue | null>(null);

export function PlanProvider({ children }: { children: ReactNode }) {
  const [answers, setAnswers] = useState<Answers>(() => ({ version: 1 }));
  const [ready, setReady] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const latest = useRef(answers);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const pending = useRef(false);

  useEffect(() => {
    let cancelled = false;
    loadAnswers()
      .then((stored) => {
        if (cancelled) return;
        const value = stored ?? emptyAnswers();
        latest.current = value;
        setAnswers(value);
      })
      .catch(() => setAnswers(emptyAnswers()))
      .finally(() => !cancelled && setReady(true));
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Writes through to IndexedDB right away. Writes are serialized; changes
   * made while a write is in flight are coalesced into one follow-up write of
   * the latest answers, so nothing is lost if the page closes.
   */
  const persist = useCallback((value: Answers) => {
    latest.current = value;
    setSaveState('saving');
    if (pending.current) return;
    pending.current = true;
    queue.current = queue.current
      .then(async () => {
        pending.current = false;
        await saveAnswers(latest.current);
        if (!pending.current) setSaveState('saved');
      })
      .catch(() => {
        pending.current = false;
        setSaveState('error');
      });
  }, []);

  const update = useCallback(
    (patch: Partial<Answers>) => {
      setAnswers((prev) => {
        const next: Answers = {
          ...prev,
          ...patch,
          version: 1,
          updatedAt: new Date().toISOString(),
        };
        next.createdAt ??= next.updatedAt;
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const replace = useCallback(
    (value: Answers) => {
      setAnswers(value);
      persist(value);
    },
    [persist],
  );

  const reset = useCallback(async () => {
    await queue.current;
    await clearAll();
    const fresh = emptyAnswers();
    latest.current = fresh;
    setAnswers(fresh);
    setSaveState('idle');
  }, []);

  const value = useMemo(
    () => ({ answers, ready, saveState, update, replace, reset }),
    [answers, ready, saveState, update, replace, reset],
  );
  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan(): PlanContextValue {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error('usePlan must be used inside PlanProvider');
  return ctx;
}
