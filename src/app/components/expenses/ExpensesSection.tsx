import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import { Figure, FigureStrip, LoadFailure, TableSkeleton } from '../budgets/ui';
import { EmptyWord, Mono, MonoSelect, INPUT } from '../projects/bt';
import { FOCUS_RING, PrimaryButton, SecondaryButton } from '../onboarding/chrome';
import { fmtUSD } from '../projects/helpers';
import { tenantCompanyName } from '../../services/branding';
import { listActiveUsers, type UserDTO } from '../../services/users';
import { listProjects, type ProjectResponse } from '../../services/projects';
import {
  adminBatchApprove, approveExpense, observeExpense, rejectExpense,
  type BatchApproveResponse, type ExpenseResponse,
} from '../../services/expenses';
import { nDaysAgo, businessToday } from '../../helpers/dateTime';
import { ExpenseRow, QUEUE_COLS, HISTORY_COLS } from './ExpenseRow';
import { ReviewWindow, type ReviewTarget } from './ReviewWindows';
import { BatchWindow } from './BatchWindow';
import { ReceiptViewer } from './ReceiptViewer';
import { takeInboxPreset } from './preset';
import {
  defaultFilters, isFiltered, toScope, useExpenseInbox,
  type Filters, type GroupKey, type SortKey, type Tab,
} from './useExpenseInbox';

/**
 * Gastos — la bandeja donde se aprueba el dinero de campo.
 *
 * Una pantalla para los dos roles: el administrador revisa y aprueba, finanzas
 * consulta el historial de lo aprobado. Sustituye a `ExpenseManagement` y a
 * `FinanceExpenses`, que eran ~1.700 líneas dibujando la misma tabla.
 *
 * Tres cosas que aquí no se hacen, y que son la razón del rediseño:
 *   · ninguna cifra se calcula sobre la página cargada — todas vienen del
 *     servidor con el mismo filtro que la lista;
 *   · el botón de lote dice de qué universo habla, y el servidor aprueba ese
 *     y no la empresa entera;
 *   · no hay toasts de éxito: aprobar, devolver y rechazar se acusan en la
 *     fila y en la cabecera, que es donde ocurrieron.
 */
export function ExpensesSection({ readOnly = false }: { readOnly?: boolean }) {
  const { t, i18n } = useTranslation(['admin', 'common']);
  // El recorte con el que llega quien pulsó una cifra del Reporte de gastos.
  // Se lee UNA vez —`takeInboxPreset` lo borra al leerlo— porque volver aquí
  // por el menú tres días después no debe reabrir un filtro que nadie pidió.
  const [preset] = useState(takeInboxPreset);
  const [tab, setTab] = useState<Tab>(
    readOnly || (preset?.status && preset.status !== 'PENDING' && preset.status !== 'OBSERVED')
      ? 'history'
      : 'review',
  );
  const [filters, setFilters] = useState<Filters>(() => ({
    ...defaultFilters(),
    ...(preset?.dateFrom ? { dateFrom: preset.dateFrom } : {}),
    ...(preset?.dateTo ? { dateTo: preset.dateTo } : {}),
    ...(preset?.projectId ? { projectId: String(preset.projectId) } : {}),
    ...(preset?.workerId ? { workerId: String(preset.workerId) } : {}),
    // El estado solo es un filtro en Historial: en la cola lo fija la pestaña.
    ...(preset?.status === 'APPROVED' || preset?.status === 'REJECTED'
      ? { status: preset.status }
      : {}),
  }));
  const [sort, setSort] = useState<SortKey>('amount');
  const [group, setGroup] = useState<GroupKey>(readOnly ? 'project' : 'status');

  const { rows, loading, listError, summary, summaryError, previous, reload, reloadSummary } =
    useExpenseInbox(tab, filters, readOnly);

  const [tenant, setTenant] = useState<string | null>(null);
  const [workers, setWorkers] = useState<UserDTO[]>([]);
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  useEffect(() => {
    // Degrada en silencio: sin el nombre, el antetítulo simplemente no lo dice.
    tenantCompanyName().then(setTenant).catch(() => { /* sin nombre */ });
    listActiveUsers().then(setWorkers).catch(() => { /* el filtro se queda en «todos» */ });
    listProjects({ size: 200 }).then(r => setProjects(r.content)).catch(() => { /* idem */ });
  }, []);

  // Revisión
  const [target, setTarget] = useState<ReviewTarget | null>(null);
  const [busy, setBusy] = useState(false);
  const [windowError, setWindowError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<number, { message: string; code?: string }>>({});
  const [justReviewed, setJustReviewed] = useState<Record<number, true>>({});
  const flashTimers = useRef<number[]>([]);
  useEffect(() => () => flashTimers.current.forEach(window.clearTimeout), []);

  // Lote
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchResult, setBatchResult] = useState<BatchApproveResponse | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);

  const [receipt, setReceipt] = useState<ExpenseResponse | null>(null);

  const pending = useMemo(() => rows.filter(r => r.status === 'PENDING'), [rows]);
  const sentBack = useMemo(() => rows.filter(r => r.status === 'OBSERVED'), [rows]);
  const pendingCents = summary?.pendingCents ?? 0;

  const sorted = useCallback((list: ExpenseResponse[]) => [...list].sort((a, b) => {
    if (sort === 'amount') return b.amountCents - a.amountCents;
    if (sort === 'date') return b.expenseDate.localeCompare(a.expenseDate);
    return new Date(a.resubmittedAt ?? a.createdAt).getTime() - new Date(b.resubmittedAt ?? b.createdAt).getTime();
  }), [sort]);

  const flash = (id: number) => {
    setJustReviewed(m => ({ ...m, [id]: true }));
    flashTimers.current.push(window.setTimeout(() => {
      setJustReviewed(m => { const next = { ...m }; delete next[id]; return next; });
      reload();
    }, 2000));
  };

  const runReview = async (comment: string) => {
    if (!target) return;
    const { kind, expense } = target;
    setBusy(true); setWindowError(null);
    try {
      if (kind === 'approve') await approveExpense(expense.id, 'admin', comment || undefined);
      else if (kind === 'observe') await observeExpense(expense.id, comment, 'admin');
      else await rejectExpense(expense.id, comment, 'admin');
      setTarget(null);
      setRowErrors(e => { const next = { ...e }; delete next[expense.id]; return next; });
      // Sin toast: el acuse es la propia fila, que se queda donde estaba con
      // fondo papel y canto naranja, y las cifras, que se recalculan.
      flash(expense.id);
      reloadSummary();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('expenses.actionFailed');
      setWindowError(message);
      setRowErrors(e => ({ ...e, [expense.id]: { message } }));
    } finally {
      setBusy(false);
    }
  };

  const runBatch = async () => {
    setBusy(true); setBatchError(null);
    try {
      const res = await adminBatchApprove(toScope(filters));
      setBatchResult(res);
      reload();
    } catch (err: unknown) {
      setBatchError(err instanceof Error ? err.message : t('expenses.actionFailed'));
    } finally {
      setBusy(false);
    }
  };

  const filterChips = useMemo(() => {
    const chips: string[] = [`${filters.dateFrom} – ${filters.dateTo}`];
    if (filters.workerId !== 'all') chips.push(workers.find(w => String(w.id) === filters.workerId)?.fullName ?? '');
    if (filters.projectId !== 'all') chips.push(projects.find(p => String(p.id) === filters.projectId)?.name ?? '');
    if (filters.type !== 'all') chips.push(t(`expenses.type.${filters.type}`, { defaultValue: filters.type }));
    return chips.filter(Boolean);
  }, [filters, workers, projects, t]);

  const rangeLabel = `${filters.dateFrom} – ${filters.dateTo}`;
  const cols = tab === 'review' ? QUEUE_COLS : HISTORY_COLS;

  const figure = (value: number | null | undefined, count: number | undefined, label: string, tone?: 'ink' | 'orange' | 'green', note?: string) => (
    <Figure
      value={summaryError ? '—' : fmtUSD(value ?? 0)}
      tone={tone}
      label={
        <>
          {label}
          <span className="block text-[9px] text-[#A69C8D] mt-0.5">
            {summaryError ? '' : t('expenses.summary.scope', { count: count ?? 0 })}{note ? ` · ${note}` : ''}
          </span>
        </>
      }
      aside={previous && !summaryError ? t('expenses.summary.previous', { amount: fmtUSD(previousFor(previous, label, t)) }) : undefined}
    />
  );

  return (
    <div className="space-y-3">
      {/* Titular: el objeto, una sola vez. Nada de «Gestión de». */}
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div className="min-w-0">
          {tenant && (
            <Mono className="block text-[10px] tracking-[0.14em] text-[#8A8175]">
              {t('expenses.kicker', { tenant })}
            </Mono>
          )}
          <h2 className="font-bt-display font-extrabold uppercase text-[40px] md:text-[46px] leading-[0.92] text-[#0A0A0A] mt-1">
            {t('expenses.title')}
          </h2>
          <Mono className="block text-[10px] tracking-[0.1em] text-[#5A5346] mt-2">
            {readOnly
              ? t('expenses.lede.historyMotto')
              : [
                  t('expenses.lede.review', { count: summary?.pendingCount ?? 0 }),
                  t('expenses.lede.onTable', { amount: fmtUSD(pendingCents) }),
                  (summary?.observedCount ?? 0) > 0 ? t('expenses.lede.sentBack', { count: summary?.observedCount ?? 0 }) : '',
                ].filter(Boolean).join(' · ')}
          </Mono>
        </div>

        {/* Barra de acciones — ancla 4 del recorrido, en la barra, no en el botón */}
        <div className="flex items-center gap-2.5" data-tour="sec.expenses.acciones">
          {!readOnly && pending.length > 0 && (
            <PrimaryButton onClick={() => { setBatchResult(null); setBatchError(null); setBatchOpen(true); }}>
              {t('expenses.batch.cta', { count: pending.length, amount: fmtUSD(pending.reduce((s, e) => s + e.amountCents, 0)) })}
            </PrimaryButton>
          )}
        </div>
      </div>

      {/* Dos vistas, un mismo filtro */}
      <div className="flex items-center gap-3 flex-wrap" data-tour="sec.expenses.vistas">
        <div role="tablist" aria-label={t('expenses.title')} className="flex border border-[#0A0A0A]">
          {(['review', 'history'] as Tab[]).filter(k => !readOnly || k === 'history').map((key, i) => {
            const active = tab === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                id={`bt-expenses-tab-${key}`}
                aria-selected={active}
                onClick={() => setTab(key)}
                className={cn(
                  'flex items-center gap-[7px] font-bt-mono text-[10.5px] font-semibold uppercase tracking-[0.1em] px-4 py-[11px] transition-colors',
                  i > 0 && 'border-l border-[#0A0A0A]',
                  active ? 'bg-[#0A0A0A] text-[#F5F1E8]' : 'bg-[#FAF7F0] text-[#5A5346] hover:bg-[#FBEDE0] hover:text-[#C2410C]',
                  FOCUS_RING,
                )}
              >
                {active && <span className="w-1.5 h-1.5 bg-[#F97316] block" aria-hidden="true" />}
                {t(key === 'review' ? 'expenses.tab.review' : 'expenses.tab.history')}
                <span className="opacity-60">
                  {key === 'review' ? pending.length + sentBack.length : (summary?.approvedCount ?? 0) + (summary?.rejectedCount ?? 0)}
                </span>
              </button>
            );
          })}
        </div>
        {readOnly && (
          <Mono className="text-[9.5px] tracking-[0.1em] text-[#A69C8D] border border-[#DBD0BB] px-2 py-1">
            {t('expenses.summary.approved')}
          </Mono>
        )}
      </div>

      {/* Las cuatro cifras del rango — ancla 1 */}
      <div data-tour="sec.expenses.cifras" className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <Mono className="text-[10px] tracking-[0.12em] text-[#8A8175]">
            {t('expenses.summary.title')} · {rangeLabel} · {t('expenses.summary.scope', { count: summary?.totalSubmitted ?? 0 })}
          </Mono>
          <Mono className="text-[9px] tracking-[0.08em] text-[#A69C8D]">{t('expenses.summary.fromServer')}</Mono>
        </div>
        <FigureStrip filtered={isFiltered(filters)}>
          {figure(summary?.pendingCents, summary?.pendingCount, t('expenses.summary.pending'), 'orange')}
          {figure(summary?.totalApprovedCents, summary?.approvedCount, t('expenses.summary.approved'), 'ink', t('expenses.summary.approvedNote'))}
          {figure(summary?.observedCents, summary?.observedCount, t('expenses.summary.observed'))}
          {figure(summary?.rejectedCents, summary?.rejectedCount, t('expenses.summary.rejected'), 'ink', t('expenses.summary.rejectedNote'))}
        </FigureStrip>
        {summaryError && (
          <div className="flex items-center gap-3 bg-white border border-[#E7E1D5] border-l-[3px] border-l-[#B3402A] px-3.5 py-2">
            <span className="text-[12.5px] text-[#B3402A]">{t('expenses.summaryError')}</span>
            <SecondaryButton onClick={reloadSummary}>{t('expenses.retry')}</SecondaryButton>
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-white border border-[#E7E1D5] px-[18px] py-3 flex flex-wrap items-end gap-3">
        <Field label={t('expenses.filters.from')}>
          <input type="date" value={filters.dateFrom} onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))} className={INPUT} />
        </Field>
        <Field label={t('expenses.filters.to')}>
          <input type="date" value={filters.dateTo} onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))} className={INPUT} />
        </Field>
        <Field label={t('expenses.filters.worker')}>
          <MonoSelect value={filters.workerId} onChange={e => setFilters(f => ({ ...f, workerId: e.target.value }))}>
            <option value="all">{t('expenses.filters.allWorkers')}</option>
            {workers.map(w => <option key={w.id} value={String(w.id)}>{w.fullName ?? w.username}</option>)}
          </MonoSelect>
        </Field>
        <Field label={t('expenses.filters.project')}>
          <MonoSelect value={filters.projectId} onChange={e => setFilters(f => ({ ...f, projectId: e.target.value }))}>
            <option value="all">{t('expenses.filters.allProjects')}</option>
            {projects.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
          </MonoSelect>
        </Field>
        <Field label={t('expenses.filters.type')}>
          <MonoSelect value={filters.type} onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}>
            <option value="all">{t('expenses.filters.allTypes')}</option>
            {['FUEL', 'MATERIALS', 'TOOLS', 'PER_DIEM', 'MINOR_PURCHASES', 'TRANSPORTATION', 'OTHER'].map(k => (
              <option key={k} value={k}>{t(`expenses.type.${k}`)}</option>
            ))}
          </MonoSelect>
        </Field>
        <Field label={t('expenses.filters.status')}>
          {tab === 'review' ? (
            /* En la bandeja el estado NO es un filtro: la pestaña ES el filtro,
               así que el control lo dice en vez de fingir que se puede elegir. */
            <span className="h-10 flex items-center border border-[#E7E1D5] bg-[#F3EEE4] px-3 font-bt-mono text-[10px] uppercase tracking-[0.08em] text-[#A69C8D]">
              {t('expenses.filters.statusLocked')}
            </span>
          ) : (
            <MonoSelect value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))} disabled={readOnly}>
              <option value="all">{t('expenses.filters.statusReviewed')}</option>
              <option value="APPROVED">{t('expenses.status.approved')}</option>
              <option value="OBSERVED">{t('expenses.status.observed')}</option>
              <option value="REJECTED">{t('expenses.status.rejected')}</option>
            </MonoSelect>
          )}
        </Field>
        <div className="ml-auto flex items-end gap-2.5">
          <SecondaryButton onClick={() => setFilters(defaultFilters())}>{t('expenses.filters.reset')}</SecondaryButton>
        </div>
      </div>

      {/* La cola — ancla 3, en el contenedor: se pinta también vacía */}
      <div data-tour="sec.expenses.cola" className="bg-white border border-[#E7E1D5]">
        <div className="flex items-center justify-between gap-4 flex-wrap px-[18px] py-2.5 border-b border-[#E7E1D5]">
          <Mono className="text-[10px] tracking-[0.1em] text-[#5A5346]">
            {tab === 'review'
              ? t('expenses.count', { count: pending.length + sentBack.length })
              : t('expenses.countHistory', { shown: rows.length, total: summary?.totalSubmitted ?? rows.length })}
          </Mono>
          <div className="flex items-center gap-2.5">
            <Mono className="text-[9px] tracking-[0.1em] text-[#8A8175]">{t('expenses.sort.label')}</Mono>
            <MonoSelect value={sort} onChange={e => setSort(e.target.value as SortKey)} className="h-8">
              <option value="amount">{t('expenses.sort.amount')}</option>
              <option value="date">{t('expenses.sort.date')}</option>
              {tab === 'review' && <option value="age">{t('expenses.sort.age')}</option>}
            </MonoSelect>
            {tab === 'history' && (
              <>
                <Mono className="text-[9px] tracking-[0.1em] text-[#8A8175]">{t('expenses.groupBy.label')}</Mono>
                <MonoSelect value={group} onChange={e => setGroup(e.target.value as GroupKey)} className="h-8">
                  <option value="none">{t('expenses.groupBy.none')}</option>
                  <option value="project">{t('expenses.groupBy.project')}</option>
                  <option value="worker">{t('expenses.groupBy.worker')}</option>
                </MonoSelect>
              </>
            )}
          </div>
        </div>

        {loading ? (
          <TableSkeleton rows={4} cols={cols} />
        ) : listError ? (
          <div className="p-[18px]">
            <LoadFailure
              title={t('expenses.loadErrorTitle')}
              body={t('expenses.loadErrorBody')}
              code={listError}
              onRetry={reload}
            />
          </div>
        ) : rows.length === 0 ? (
          <Empty tab={tab} filters={filters} total={summary?.totalSubmitted ?? 0} onReset={() => setFilters(defaultFilters())} onHistory={() => setTab('history')} />
        ) : tab === 'review' ? (
          <>
            <Group title={t('expenses.group.toReview')} count={pending.length} amount={pending.reduce((s, e) => s + e.amountCents, 0)} />
            {sorted(pending).map(e => renderRow(e))}
            {sentBack.length > 0 && (
              <>
                <Group title={t('expenses.group.sentBack')} count={sentBack.length} amount={sentBack.reduce((s, e) => s + e.amountCents, 0)} note={t('expenses.group.sentBackNote')} />
                {sorted(sentBack).map(e => renderRow(e))}
              </>
            )}
          </>
        ) : (
          groupRows(rows, group, sorted).map(([label, list]) => (
            <div key={label}>
              {label && <Group title={label} count={list.length} amount={list.reduce((s, e) => s + e.amountCents, 0)} />}
              {list.map(e => renderRow(e))}
            </div>
          ))
        )}
      </div>

      {target && (
        <ReviewWindow
          target={target}
          busy={busy}
          error={windowError}
          onClose={() => { setTarget(null); setWindowError(null); }}
          onConfirm={runReview}
        />
      )}
      {batchOpen && (
        <BatchWindow
          pending={pending}
          filters={filters}
          filterChips={filterChips}
          busy={busy}
          error={batchError}
          result={batchResult}
          onClose={() => { setBatchOpen(false); setBatchResult(null); }}
          onConfirm={runBatch}
        />
      )}
      {receipt && <ReceiptViewer expense={receipt} onClose={() => setReceipt(null)} />}
    </div>
  );

  function renderRow(e: ExpenseResponse) {
    return (
      <ExpenseRow
        key={e.id}
        expense={e}
        mode={tab === 'review' ? 'queue' : 'history'}
        justReviewed={Boolean(justReviewed[e.id])}
        error={rowErrors[e.id] ?? null}
        canReview={!readOnly}
        actions={{
          onApprove: () => { setWindowError(null); setTarget({ kind: 'approve', expense: e }); },
          onObserve: () => {
            setWindowError(null);
            setTarget({
              kind: 'observe',
              expense: e,
              presetComment: e.receiptUrl ? '' : t('expenses.receipt.askComment'),
            });
          },
          onReject: () => { setWindowError(null); setTarget({ kind: 'reject', expense: e }); },
          onReceipt: () => setReceipt(e),
          onRetry: () => { setRowErrors(m => { const next = { ...m }; delete next[e.id]; return next; }); reload(); },
        }}
      />
    );
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <Mono className="text-[9.5px] font-semibold tracking-[0.12em] text-[#5A5346]">{label}</Mono>
      {children}
    </label>
  );
}

function Group({ title, count, amount, note }: { title: string; count: number; amount: number; note?: string }) {
  const { t } = useTranslation('admin');
  return (
    <div className="flex items-baseline justify-between gap-3 px-[18px] py-2 bg-[#FBF8F2] border-b border-[#E7E1D5]">
      <Mono className="text-[9.5px] font-semibold tracking-[0.12em] text-[#5A5346]">
        {title} <span className="text-[#A69C8D]">{count}</span>
        {note && <span className="text-[#A69C8D] normal-case"> · {note}</span>}
      </Mono>
      <Mono className="text-[11px] tabular-nums text-[#5A5346] normal-case">
        {t('expenses.group.subtotal', { count, amount: fmtUSD(amount) })}
      </Mono>
    </div>
  );
}

function Empty({ tab, filters, total, onReset, onHistory }: {
  tab: Tab; filters: Filters; total: number; onReset: () => void; onHistory: () => void;
}) {
  const { t } = useTranslation('admin');
  if (tab === 'history') {
    return <EmptyWord word={t('expenses.empty.historyTitle')} title={t('expenses.empty.historyTitle')} hint={t('expenses.empty.historyBody')} />;
  }
  // «Al día» es el buen vacío: la bandeja limpia es la meta de la pantalla, y
  // el único sitio de la sección donde el verde se usa en grande.
  if (total > 0) {
    return (
      <div className="bg-white text-center px-6 py-[52px]">
        <div className="font-bt-display font-bold uppercase text-[36px] md:text-[44px] leading-[0.9] text-[#2E7D4F]">
          {t('expenses.empty.clearTitle')}
        </div>
        <p className="text-[13px] text-[#5A5346] mt-3 max-w-[52ch] mx-auto">{t('expenses.empty.clearBody', { count: total })}</p>
        <div className="mt-[18px] flex justify-center">
          <SecondaryButton onClick={onHistory}>{t('expenses.empty.seeHistory')}</SecondaryButton>
        </div>
      </div>
    );
  }
  return (
    <EmptyWord
      word={t('expenses.empty.rangeTitle')}
      title={t('expenses.empty.rangeTitle')}
      hint={t('expenses.empty.rangeBody', { from: filters.dateFrom, to: filters.dateTo })}
      action={<SecondaryButton onClick={onReset}>{t('expenses.empty.last30')}</SecondaryButton>}
    />
  );
}

function groupRows(
  rows: ExpenseResponse[],
  group: GroupKey,
  sorted: (list: ExpenseResponse[]) => ExpenseResponse[],
): [string, ExpenseResponse[]][] {
  if (group === 'none') return [['', sorted(rows)]];
  const key = (e: ExpenseResponse) =>
    group === 'project' ? e.projectName : group === 'worker' ? (e.workerName ?? e.workerUsername) : e.status;
  const map = new Map<string, ExpenseResponse[]>();
  for (const e of rows) map.set(key(e), [...(map.get(key(e)) ?? []), e]);
  return [...map.entries()]
    .sort((a, b) => b[1].reduce((s, e) => s + e.amountCents, 0) - a[1].reduce((s, e) => s + e.amountCents, 0))
    .map(([label, list]) => [label, sorted(list)]);
}

/** El valor anterior de la cifra, para el «era $1.830,00» de cuatro segundos. */
function previousFor(previous: { pendingCents?: number; totalApprovedCents: number; observedCents?: number; rejectedCents?: number }, label: string, t: (k: string) => string): number {
  if (label === t('expenses.summary.pending')) return previous.pendingCents ?? 0;
  if (label === t('expenses.summary.approved')) return previous.totalApprovedCents;
  if (label === t('expenses.summary.observed')) return previous.observedCents ?? 0;
  return previous.rejectedCents ?? 0;
}
