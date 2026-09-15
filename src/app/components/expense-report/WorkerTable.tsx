import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../ui/utils';
import { Mono, MonoSelect, EmptyWord } from '../projects/bt';
import { Amount } from '../budgets/ui';
import { FOCUS_RING } from '../onboarding/chrome';
import type { WorkerExpenseRow, WorkerTotals } from '../../services/expenses';
import { bigMoney, Dash, Head } from './bits';

export const WORKER_COLS = '1.8fr .62fr .62fr .62fr .62fr .62fr .9fr';

const PAGE_SIZE = 10;

type Sort = 'approved' | 'name' | 'submitted';

/**
 * Quién gastó.
 *
 * Con paginación, un «TOTALES» a secas es una mentira en cuanto se pasa de
 * página, así que aquí son dos líneas distintas: el subtotal de **esta
 * página**, y el total del **informe**, que lo calculó el servidor sobre todos
 * los trabajadores. Antes se sumaba en el navegador sobre las filas cargadas y
 * cuadraba solo porque el servidor las mandaba todas.
 *
 * Y sin promedio por trabajador: la tarjeta decía «$4.100,00 · 0 trabajadores
 * activos» porque dividía entre las filas que ya habían llegado.
 */
export function WorkerTable({ rows, totals, onOpenWorker }: {
  rows: WorkerExpenseRow[];
  totals: WorkerTotals;
  onOpenWorker: (workerId: number) => void;
}) {
  const { t } = useTranslation('admin');
  const [sort, setSort] = useState<Sort>('approved');
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => [...rows].sort((a, b) => {
    if (sort === 'name') {
      return (a.workerName ?? a.workerUsername).localeCompare(b.workerName ?? b.workerUsername);
    }
    if (sort === 'submitted') return b.submittedCount - a.submittedCount;
    return b.totalApprovedCents - a.totalApprovedCents;
  }), [rows, sort]);

  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pages - 1);
  const slice = sorted.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  if (rows.length === 0) {
    // Sin encabezados y sin fila de totales en ceros: eso parecía un informe
    // con datos, y es un informe sin datos.
    return (
      <EmptyWord
        className="border-0"
        word={t('expenseReport.byWorker.emptyWord')}
        title={t('expenseReport.byWorker.emptyTitle')}
        hint={t('expenseReport.byWorker.empty')}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap px-[18px] py-2.5 border-b border-[#E7E1D5]">
        <Mono className="text-[10px] tracking-[0.1em] text-[#5A5346]">
          {t('expenseReport.byWorker.count', { count: totals.workerCount })}
        </Mono>
        <div className="flex items-center gap-2.5">
          <Mono className="text-[9px] tracking-[0.1em] text-[#8A8175]">{t('expenseReport.byWorker.sort')}</Mono>
          <MonoSelect
            value={sort}
            onChange={e => { setSort(e.target.value as Sort); setPage(0); }}
            className="h-8"
            aria-label={t('expenseReport.byWorker.sort')}
          >
            <option value="approved">{t('expenseReport.byWorker.sortApproved')}</option>
            <option value="submitted">{t('expenseReport.byWorker.sortSubmitted')}</option>
            <option value="name">{t('expenseReport.byWorker.sortName')}</option>
          </MonoSelect>
        </div>
      </div>

      <div
        className="hidden md:grid gap-3 px-[18px] py-2 border-b border-[#E7E1D5] bg-[#FBF8F2]"
        style={{ gridTemplateColumns: WORKER_COLS }}
      >
        <Head>{t('expenseReport.byWorker.worker')}</Head>
        <Head right>{t('expenseReport.byWorker.submitted')}</Head>
        <Head right>{t('expenseReport.byWorker.approvedCount')}</Head>
        <Head right>{t('expenseReport.state.pending')}</Head>
        <Head right>{t('expenseReport.state.observed')}</Head>
        <Head right>{t('expenseReport.state.rejected')}</Head>
        <Head right>{t('expenseReport.byWorker.approvedAmount')}</Head>
      </div>

      {slice.map(w => (
        <div key={w.workerId} className="border-b border-[#F0EBE1]">
          <div
            className="hidden md:grid gap-3 px-[18px] py-[10px] items-center hover:bg-[#FBF8F2]"
            style={{ gridTemplateColumns: WORKER_COLS }}
          >
            <button
              type="button"
              onClick={() => onOpenWorker(w.workerId)}
              className={cn('text-left text-[13px] text-[#0A0A0A] truncate hover:text-[#C2410C] hover:underline decoration-[#F97316] underline-offset-2', FOCUS_RING)}
              title={t('expenseReport.byWorker.open')}
            >
              {w.workerName ?? w.workerUsername}
            </button>
            <Count n={w.submittedCount} />
            <Count n={w.approvedCount} />
            <Count n={w.pendingCount} />
            <Count n={w.observedCount} />
            <Count n={w.rejectedCount} />
            <Amount className="font-semibold">{bigMoney(w.totalApprovedCents)}</Amount>
          </div>

          <button
            type="button"
            onClick={() => onOpenWorker(w.workerId)}
            className={cn('md:hidden w-full px-[14px] py-2.5 flex items-baseline justify-between gap-3 text-left', FOCUS_RING)}
          >
            <span className="text-[13px] text-[#0A0A0A] truncate">{w.workerName ?? w.workerUsername}</span>
            <Amount className="font-semibold flex-shrink-0">{bigMoney(w.totalApprovedCents)}</Amount>
          </button>
        </div>
      ))}

      {/* Subtotal de ESTA página, dicho con todas las letras */}
      <div
        className="hidden md:grid gap-3 px-[18px] py-[10px] items-center border-t border-[#0A0A0A] bg-[#FBF8F2]"
        style={{ gridTemplateColumns: WORKER_COLS }}
      >
        <Mono className="text-[10px] tracking-[0.1em] text-[#0A0A0A]">
          {t('expenseReport.byWorker.pageTotal', { shown: slice.length, total: totals.workerCount })}
        </Mono>
        <Count n={slice.reduce((s, w) => s + w.submittedCount, 0)} />
        <Count n={slice.reduce((s, w) => s + w.approvedCount, 0)} />
        <Count n={slice.reduce((s, w) => s + w.pendingCount, 0)} />
        <Count n={slice.reduce((s, w) => s + w.observedCount, 0)} />
        <Count n={slice.reduce((s, w) => s + w.rejectedCount, 0)} />
        <Amount className="font-semibold">{bigMoney(slice.reduce((s, w) => s + w.totalApprovedCents, 0))}</Amount>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap px-[18px] py-2.5 border-t border-[#E7E1D5]">
        <Mono className="text-[9.5px] tracking-[0.08em] text-[#5A5346]">
          {t('expenseReport.byWorker.reportTotal', {
            amount: bigMoney(totals.totalApprovedCents),
            count: totals.workerCount,
          })}
        </Mono>
        {pages > 1 && (
          <div className="flex items-center gap-2">
            <PageButton disabled={safePage === 0} onClick={() => setPage(p => Math.max(0, p - 1))} label={t('expenseReport.byWorker.prev')}>
              <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2.2} aria-hidden="true" />
            </PageButton>
            <Mono className="text-[9.5px] tracking-[0.08em] text-[#5A5346] tabular-nums">
              {t('expenseReport.byWorker.page', { page: safePage + 1, pages })}
            </Mono>
            <PageButton disabled={safePage >= pages - 1} onClick={() => setPage(p => Math.min(pages - 1, p + 1))} label={t('expenseReport.byWorker.next')}>
              <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.2} aria-hidden="true" />
            </PageButton>
          </div>
        )}
      </div>
    </div>
  );
}

/** Las cuentas van sin signo de moneda: el ojo no confunde un 12 con un monto. */
function Count({ n }: { n: number }) {
  if (n === 0) return <div className="text-right"><Dash /></div>;
  return <Mono className="text-[11.5px] text-[#5A5346] tabular-nums block text-right">{n}</Mono>;
}

function PageButton({ children, disabled, onClick, label }: {
  children: React.ReactNode;
  disabled: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'w-7 h-7 flex items-center justify-center border border-[#DBD0BB] text-[#5A5346]',
        disabled ? 'opacity-40 cursor-not-allowed' : 'hover:border-[#F97316] hover:text-[#C2410C]',
        FOCUS_RING,
      )}
    >
      {children}
    </button>
  );
}
