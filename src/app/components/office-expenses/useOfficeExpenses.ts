import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getOfficeExpenseSummary, listOfficeCategories, listOfficeExpenses,
  type OfficeCategory, type OfficeExpense, type OfficeExpenseFilters, type OfficeExpenseSummary,
} from '../../services/officeExpenses';
import { businessToday, currentMonth } from '../../helpers/dateTime';

/**
 * Los datos de Gastos de oficina.
 *
 * **El mes es la unidad.** La renta, la luz, el agua, el internet y la limpieza
 * se pagan todos los meses, así que la pantalla abre en el mes en curso y se
 * mueve mes a mes; el rango libre es la opción avanzada, para cruzar meses o
 * buscar algo suelto. Antes eran dos campos de fecha vacíos sin etiqueta que
 * mostraban `mm/dd/yyyy` en un panel en español.
 *
 * La lista y el resumen se piden con **el mismo recorte** y fallan por
 * separado, porque se reintentan por separado: que no responda el resumen no
 * es motivo para esconder la tabla.
 */

export type Mode = 'month' | 'range';
export type Grouping = 'none' | 'category' | 'month';

export interface OfficeFilters {
  mode: Mode;
  /** `2026-09`. Manda en modo mes. */
  month: string;
  /** Mandan en modo rango. */
  dateFrom: string;
  dateTo: string;
  categoryId: string;
  purchasedByUserId: string;
  search: string;
  grouping: Grouping;
}

export function defaultOfficeFilters(): OfficeFilters {
  return {
    mode: 'month',
    month: currentMonth(),
    dateFrom: `${currentMonth()}-01`,
    dateTo: businessToday(),
    categoryId: 'all',
    purchasedByUserId: 'all',
    search: '',
    grouping: 'none',
  };
}

/** El último día del mes, sin cruzar zonas horarias: `Date` en UTC y de vuelta. */
export function lastDayOf(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${month}-${String(last).padStart(2, '0')}`;
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** La ventana que de verdad viaja al servidor, sea un mes o un rango. */
export function windowOf(f: OfficeFilters): { from: string; to: string } {
  if (f.mode === 'month') return { from: `${f.month}-01`, to: lastDayOf(f.month) };
  return { from: f.dateFrom, to: f.dateTo };
}

export function toParams(f: OfficeFilters): OfficeExpenseFilters {
  const { from, to } = windowOf(f);
  return {
    from: from || undefined,
    to: to || undefined,
    categoryId: f.categoryId !== 'all' ? Number(f.categoryId) : undefined,
    purchasedByUserId: f.purchasedByUserId !== 'all' ? Number(f.purchasedByUserId) : undefined,
    search: f.search.trim() || undefined,
  };
}

export function isFiltered(f: OfficeFilters): boolean {
  return f.categoryId !== 'all' || f.purchasedByUserId !== 'all' || f.search.trim() !== '';
}

/**
 * Medio segundo antes de pedir.
 *
 * El buscador anterior disparaba **una petición por tecla**: `search` estaba en
 * las dependencias del `useCallback` que traía los datos, sin ningún retardo.
 * Escribir «silla» eran cinco informes pedidos y cuatro tirados.
 */
const DEBOUNCE_MS = 500;

const PAGE_SIZE = 20;

export interface OfficeState {
  rows: OfficeExpense[];
  total: number;
  page: number;
  totalPages: number;
  setPage: (p: number) => void;
  summary: OfficeExpenseSummary | null;
  categories: OfficeCategory[];
  loading: boolean;
  listError: string | null;
  summaryError: string | null;
  reload: () => void;
  reloadCategories: () => void;
}

export function useOfficeExpenses(filters: OfficeFilters): OfficeState {
  const [rows, setRows] = useState<OfficeExpense[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(0);
  const [summary, setSummary] = useState<OfficeExpenseSummary | null>(null);
  const [categories, setCategories] = useState<OfficeCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [categoryNonce, setCategoryNonce] = useState(0);

  const key = useMemo(() => JSON.stringify(toParams(filters)), [filters]);
  const latest = useRef(0);

  // Cambiar el recorte vuelve a la primera página: quedarse en la cuatro de un
  // mes que tiene dos enseña un vacío que parece un fallo.
  useEffect(() => { setPage(0); }, [key]);

  useEffect(() => {
    const ticket = ++latest.current;
    let cancelled = false;
    setLoading(true);

    const timer = window.setTimeout(() => {
      const params = toParams(filters);
      Promise.allSettled([
        listOfficeExpenses({ ...params, page, size: PAGE_SIZE }),
        getOfficeExpenseSummary(params),
      ]).then(([list, sum]) => {
        if (cancelled || ticket !== latest.current) return;
        if (list.status === 'fulfilled') {
          setRows(list.value.content);
          setTotal(list.value.totalElements);
          setTotalPages(Math.max(1, list.value.totalPages));
          setListError(null);
        } else {
          setListError(message(list.reason));
        }
        if (sum.status === 'fulfilled') {
          setSummary(sum.value);
          setSummaryError(null);
        } else {
          setSummaryError(message(sum.reason));
        }
        setLoading(false);
      });
    }, DEBOUNCE_MS);

    return () => { cancelled = true; window.clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, page, nonce]);

  useEffect(() => {
    let cancelled = false;
    listOfficeCategories()
      .then(list => { if (!cancelled) setCategories(list); })
      // Sin categorías el selector se queda vacío, pero la lista se pinta: son
      // dos lecturas distintas y una no tiene por qué tumbar la otra.
      .catch(() => { /* el selector se queda vacío */ });
    return () => { cancelled = true; };
  }, [categoryNonce]);

  const reload = useCallback(() => setNonce(n => n + 1), []);
  const reloadCategories = useCallback(() => setCategoryNonce(n => n + 1), []);

  return {
    rows, total, page, totalPages, setPage,
    summary, categories, loading, listError, summaryError,
    reload, reloadCategories,
  };
}

function message(reason: unknown): string {
  return reason instanceof Error ? reason.message : 'OFFICE_EXPENSES_FAILED';
}
