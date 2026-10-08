import { useCallback, useRef, useState } from 'react';
import { getBudgetConsumption } from '../../services/budgets';
import { ledgerConsumption, type ConsumptionSplit } from './bits';

export type SplitState = 'idle' | 'loading' | 'ready' | 'failed';
export interface Consumption {
  state: SplitState;
  splits: Map<number, ConsumptionSplit>;
  load: (consumedByProject: Map<number, number>) => void;
  retry: (consumedByProject: Map<number, number>) => void;
}
/** Lazy ledger read, refreshed when the loaded jobs or their consumption change. */
export function useConsumption(readOnly: boolean): Consumption {
  const [state, setState] = useState<SplitState>('idle');
  const [splits, setSplits] = useState<Map<number, ConsumptionSplit>>(new Map());
  const signature = useRef<string | null>(null);
  const generation = useRef(0);
  const run = useCallback(async () => {
    const current = ++generation.current;
    setState('loading');
    try {
      const report = await getBudgetConsumption(readOnly);
      if (current !== generation.current) return;
      setSplits(new Map(report.projects.map(row => [row.projectId, ledgerConsumption(row)])));
      setState('ready');
    } catch {
      if (current !== generation.current) return;
      setState('failed');
    }
  }, [readOnly]);
  const load = useCallback((consumedByProject: Map<number, number>) => {
    const next = JSON.stringify([readOnly, [...consumedByProject]]);
    if (signature.current === next) return;
    signature.current = next;
    void run();
  }, [readOnly, run]);
  const retry = useCallback(() => { void run(); }, [run]);
  return { state, splits, load, retry };
}
