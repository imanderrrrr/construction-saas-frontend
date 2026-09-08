import { useCallback, useRef, useState } from 'react';
import { getExpenseReport, getFinanceExpenseReport, type ProjectExpenseRow } from '../../services/expenses';
import { listAllPayables } from '../../services/finance';
import { splitConsumption, type ConsumptionSplit } from './bits';

/**
 * Where each jobsite's spend went, split by source.
 *
 * Asked for LAZILY, and the sheet's board 07-D says why: the split is a
 * separate pair of requests, the jobsites view has no use for it, and whoever
 * never touches the switcher should not pay for it. The first move to Reporte
 * paints the figures and the table instantly — they were already loaded — and
 * only the breakdown block carries a skeleton. Going back and returning asks
 * for nothing.
 *
 * PROVISIONAL, like `splitConsumption` itself: two calls stand in for the
 * `GET /budgets/consumption-breakdown` that does not exist yet, and payroll is
 * what is left over after them.
 */

export type SplitState = 'idle' | 'loading' | 'ready' | 'failed';

export interface Consumption {
  state: SplitState;
  /** Keyed by project id — never by name; two jobsites may share one. */
  splits: Map<number, ConsumptionSplit>;
  /**
   * The expense report's own per-project rows, kept only so the legacy browser
   * document keeps its expense-type breakdown while the server-side one is
   * built. Nothing on screen reads them.
   */
  expenseRows: Map<number, ProjectExpenseRow>;
  /** Loads once. Safe to call on every render of the report view. */
  load: (consumedByProject: Map<number, number>) => void;
  /** Forces a fresh fetch after a failure. */
  retry: (consumedByProject: Map<number, number>) => void;
}

export function useConsumption(readOnly: boolean): Consumption {
  const [state, setState] = useState<SplitState>('idle');
  const [splits, setSplits] = useState<Map<number, ConsumptionSplit>>(new Map());
  const [expenseRows, setExpenseRows] = useState<Map<number, ProjectExpenseRow>>(new Map());
  // A ref, not state: `load` is called from an effect on every render of the
  // report view and must not fire twice while the first pair of requests is
  // still in flight. Written from a callback, never during render.
  const started = useRef(false);

  const run = useCallback(async (consumedByProject: Map<number, number>) => {
    setState('loading');
    try {
      const fetchReport = readOnly ? getFinanceExpenseReport : getExpenseReport;
      const [report, payables] = await Promise.all([fetchReport(), listAllPayables()]);

      const expensesByProject = new Map<number, number>();
      const rowsByProject = new Map<number, ProjectExpenseRow>();
      report.byProject.forEach(p => {
        expensesByProject.set(p.projectId, p.approvedCents / 100);
        rowsByProject.set(p.projectId, p);
      });

      const billsByProject = new Map<number, { paidAmount: number }[]>();
      payables.forEach(bill => {
        const list = billsByProject.get(bill.projectId);
        if (list) list.push({ paidAmount: bill.paidAmount });
        else billsByProject.set(bill.projectId, [{ paidAmount: bill.paidAmount }]);
      });

      const next = new Map<number, ConsumptionSplit>();
      consumedByProject.forEach((consumed, projectId) => {
        next.set(projectId, splitConsumption(
          consumed,
          expensesByProject.get(projectId) ?? 0,
          billsByProject.get(projectId) ?? [],
        ));
      });
      setSplits(next);
      setExpenseRows(rowsByProject);
      setState('ready');
    } catch {
      // The block says it could not be drawn; the figures and the table above
      // it are unaffected, so nothing else on the screen is blanked.
      setState('failed');
    }
  }, [readOnly]);

  const load = useCallback((consumedByProject: Map<number, number>) => {
    if (started.current) return;
    started.current = true;
    void run(consumedByProject);
  }, [run]);

  const retry = useCallback((consumedByProject: Map<number, number>) => {
    started.current = true;
    void run(consumedByProject);
  }, [run]);

  return { state, splits, expenseRows, load, retry };
}
