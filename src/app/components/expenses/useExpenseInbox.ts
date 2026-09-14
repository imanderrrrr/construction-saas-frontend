import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getAdminExpenses, getAdminSummary, getFinanceExpenses, getFinanceSummary,
  type ExpenseResponse, type ExpenseScope, type ExpenseSummaryResponse,
} from '../../services/expenses';
import { businessToday, nDaysAgo } from '../../helpers/dateTime';

/**
 * Los datos de la bandeja: la lista y el resumen, cada uno con su propio fallo.
 *
 * Los dos se piden con **el mismo filtro**, y el resumen viene del servidor
 * precisamente para que la cabecera no se calcule sobre la página cargada: la
 * pantalla anterior sumaba los diez gastos visibles y llamaba a eso
 * «pendiente». Fallan por separado porque se reintentan por separado: que no
 * responda el resumen no es motivo para esconder la cola.
 */

export type Tab = 'review' | 'history';
export type SortKey = 'amount' | 'date' | 'age';
export type GroupKey = 'none' | 'status' | 'project' | 'worker';

export interface Filters {
  dateFrom: string;
  dateTo: string;
  workerId: string;
  projectId: string;
  type: string;
  /** Solo en Historial: los tres estados revisados, o uno. */
  status: string;
}

export function defaultFilters(): Filters {
  return {
    dateFrom: nDaysAgo(30),
    dateTo: businessToday(),
    workerId: 'all',
    projectId: 'all',
    type: 'all',
    status: 'all',
  };
}

export function isFiltered(f: Filters): boolean {
  return f.workerId !== 'all' || f.projectId !== 'all' || f.type !== 'all' || f.status !== 'all';
}

/** Lo que viaja al servidor. El estado NO va aquí: lo fija la pestaña. */
export function toScope(f: Filters): ExpenseScope {
  return {
    dateFrom: f.dateFrom || undefined,
    dateTo: f.dateTo || undefined,
    workerId: f.workerId !== 'all' ? Number(f.workerId) : undefined,
    projectId: f.projectId !== 'all' ? Number(f.projectId) : undefined,
    type: f.type !== 'all' ? f.type : undefined,
  };
}

const PAGE_SIZE = 50;

export interface InboxState {
  rows: ExpenseResponse[];
  total: number;
  loading: boolean;
  /** El código para soporte, tal cual, cuando la lista no llega. */
  listError: string | null;
  summary: ExpenseSummaryResponse | null;
  summaryError: boolean;
  /** Las cifras de hace un instante, para escribir «era $1.830,00» 4 s. */
  previous: ExpenseSummaryResponse | null;
  reload: () => void;
  reloadSummary: () => void;
}

export function useExpenseInbox(tab: Tab, filters: Filters, readOnly: boolean): InboxState {
  const [rows, setRows] = useState<ExpenseResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ExpenseSummaryResponse | null>(null);
  const [summaryError, setSummaryError] = useState(false);
  const [previous, setPrevious] = useState<ExpenseSummaryResponse | null>(null);
  const [nonce, setNonce] = useState(0);
  const [summaryNonce, setSummaryNonce] = useState(0);
  const previousTimer = useRef<number | null>(null);

  const scope = useMemo(() => toScope(filters), [filters]);
  const scopeKey = JSON.stringify(scope);

  // La lista. En «Por revisar» son los dos estados que esperan a alguien, así
  // que se piden los dos y se juntan; en Historial, lo ya revisado.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    // Finanzas solo ve aprobados y su endpoint ya los fuerza, así que es una
    // llamada. El administrador pide los estados que la pestaña abarca.
    const statuses = readOnly
      ? ['APPROVED']
      : tab === 'review'
        ? ['PENDING', 'OBSERVED']
        : filters.status !== 'all' ? [filters.status] : ['APPROVED', 'OBSERVED', 'REJECTED'];
    const fetcher = readOnly
      ? () => getFinanceExpenses({ ...scope, page: 0, size: PAGE_SIZE })
      : (status: string) => getAdminExpenses({ ...scope, status, page: 0, size: PAGE_SIZE });

    Promise.all(statuses.map(fetcher))
      .then(pages => {
        if (cancelled) return;
        // Dos consultas por estado no son atómicas: si alguien aprueba entre
        // una y otra, el mismo gasto puede volver en las dos. Se deduplica por
        // id — una fila repetida en una pantalla de aprobación es peor que un
        // recuento con un segundo de retraso.
        const seen = new Set<number>();
        setRows(pages.flatMap(p => p.content).filter(e => !seen.has(e.id) && seen.add(e.id)));
        setTotal(pages.reduce((s, p) => s + p.totalElements, 0));
        setListError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // Un fallo de carga NO puede colapsar en «no hay gastos»: de esta lista
        // se aprueba dinero. Se guarda el código para que soporte lo lea.
        setListError(err instanceof Error ? err.message : 'ERROR');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tab, scopeKey, filters.status, readOnly, nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  // El resumen: los cuatro estados del rango, siempre del servidor.
  useEffect(() => {
    let cancelled = false;
    (readOnly ? getFinanceSummary(scope) : getAdminSummary(scope))
      .then(s => {
        if (cancelled) return;
        setSummary(before => {
          if (before) {
            setPrevious(before);
            if (previousTimer.current) window.clearTimeout(previousTimer.current);
            previousTimer.current = window.setTimeout(() => setPrevious(null), 4000);
          }
          return s;
        });
        setSummaryError(false);
      })
      .catch(() => { if (!cancelled) setSummaryError(true); });
    return () => { cancelled = true; };
  }, [scopeKey, summaryNonce, readOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { if (previousTimer.current) window.clearTimeout(previousTimer.current); }, []);

  const reload = useCallback(() => { setNonce(n => n + 1); setSummaryNonce(n => n + 1); }, []);
  const reloadSummary = useCallback(() => setSummaryNonce(n => n + 1), []);

  return { rows, total, loading, listError, summary, summaryError, previous, reload, reloadSummary };
}
