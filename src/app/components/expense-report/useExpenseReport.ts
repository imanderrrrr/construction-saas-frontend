import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getExpenseReport, getFinanceExpenseReport, type ExpenseReportResponse,
} from '../../services/expenses';
import { businessToday, currentMonth } from '../../helpers/dateTime';

/**
 * El informe, y nada más que el informe.
 *
 * Se rehace **al cambiar un filtro**: no hay botón «Generar reporte» ni
 * pastilla verde. La pastilla se encendía al montar —sin que nadie generara
 * nada— y seguía verde con los datos del filtro anterior, así que decía lo
 * contrario de lo que prometía el recorrido guiado. En su sitio va el sello de
 * corte, que es un hecho: la hora a la que el servidor armó lo que se ve.
 *
 * Mientras llega el informe nuevo **se conserva el anterior**, para que el
 * titular, los filtros y el sello se queden en su sitio y el esqueleto sea
 * solo de las cifras y las tablas. Nunca se enseña un cero mientras se carga.
 */

export interface ReportFilters {
  dateFrom: string;
  dateTo: string;
  projectId: string;
  type: string;
}

export function defaultReportFilters(): ReportFilters {
  return {
    dateFrom: `${currentMonth()}-01`,
    dateTo: businessToday(),
    projectId: 'all',
    type: 'all',
  };
}

export function isFiltered(f: ReportFilters): boolean {
  return f.projectId !== 'all' || f.type !== 'all';
}

export interface ReportParams {
  dateFrom?: string;
  dateTo?: string;
  projectId?: number;
  type?: string;
}

export function toParams(f: ReportFilters): ReportParams {
  return {
    dateFrom: f.dateFrom || undefined,
    dateTo: f.dateTo || undefined,
    projectId: f.projectId !== 'all' ? Number(f.projectId) : undefined,
    type: f.type !== 'all' ? f.type : undefined,
  };
}

/**
 * Un cambio de filtro no es un teclazo.
 *
 * Los campos de fecha emiten `change` mientras se escribe el año, así que sin
 * esto un «2026» son cuatro informes pedidos y tres tirados — y el que llega
 * último no tiene por qué ser el último que se pidió.
 */
const DEBOUNCE_MS = 250;

export interface ReportState {
  report: ExpenseReportResponse | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useExpenseReport(filters: ReportFilters, readOnly: boolean): ReportState {
  const [report, setReport] = useState<ExpenseReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  // La respuesta de una petición que ya no es la última se descarta: con
  // filtros que se aplican solos, dos informes en vuelo son lo normal.
  const latest = useRef(0);
  const key = JSON.stringify(toParams(filters));

  useEffect(() => {
    const ticket = ++latest.current;
    const fetchReport = readOnly ? getFinanceExpenseReport : getExpenseReport;
    let cancelled = false;

    setLoading(true);
    const timer = window.setTimeout(() => {
      fetchReport(toParams(filters))
        .then(data => {
          if (cancelled || ticket !== latest.current) return;
          setReport(data);
          setError(null);
        })
        .catch((err: unknown) => {
          if (cancelled || ticket !== latest.current) return;
          setError(err instanceof Error ? err.message : 'REPORT_FAILED');
        })
        .finally(() => {
          if (cancelled || ticket !== latest.current) return;
          setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => { cancelled = true; window.clearTimeout(timer); };
    // `key` resume los filtros que de verdad viajan: reordenar el objeto no
    // vuelve a pedir el informe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, readOnly, nonce]);

  const reload = useCallback(() => setNonce(n => n + 1), []);

  return { report, loading, error, reload };
}
