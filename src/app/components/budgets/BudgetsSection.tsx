import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ChevronDown, Search } from 'lucide-react';
import { cn } from '../ui/utils';
import { ApiError } from '../../lib/api';
import { drainPages } from '../../lib/paging';
import { pushTourScope } from '../../lib/tourScope';
import { getBranding } from '../../services/branding';
import {
  listFinanceProjects, listProjects, type ProjectResponse,
} from '../../services/projects';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { FOCUS_RING, SecondaryButton } from '../onboarding/chrome';
import { Mono, MonoSelect, stampDay } from '../projects/bt';
import {
  activeFilterCount, applyFilters, EMPTY_FILTERS, isBudgeted, moneyRound,
  pct as fmtPct, reportTotals, sortReport, sortWorks, toRow, worksTotals,
  type BudgetRow, type Filters, type ReportSort, type RiskFilter, type StatusFilter, type WorksSort,
} from './bits';
import { AdjustWindow } from './AdjustWindow';
import { CloseWindow } from './CloseWindow';
import { DetailDrawer } from './DetailDrawer';
import { HistoryView } from './HistoryView';
import { ReportView } from './ReportView';
import { useConsumption } from './useConsumption';
import { Figure, FigureStrip, LoadFailure, ReadOnlyNote, TourAnchor, ViewSwitcher, type View } from './ui';
import { WorksView } from './WorksView';
import { exportLegacyBudgetDocument } from './legacyExport';

/**
 * Presupuestos — one screen, two views, one set of permissions.
 *
 * It replaces four components that walked the same projects with different
 * arithmetic: `BudgetManagement` and `BudgetReport` divided spend by the cost
 * budget, `FinanceBudgets` and `ProjectFinancials` by the contract, and the
 * owner saw Residencial Sur at 33 % while his accountant saw it at 15 % in the
 * same second. One base — `budgetBaseCents` — and one component with a
 * read-only mode, so the two panels cannot disagree again.
 *
 * The switcher stands where the "Reporte de presupuestos →" button was. The
 * four filters and the search survive a change of view; the SORT does not, and
 * deliberately — two of each view's four options do not exist on the other
 * side, so each keeps its own and opens on its own default.
 *
 * Every figure is totalled over the FILTERED rows. Filtering to one jobsite
 * and leaving a header that still added up four was the defect this screen was
 * built to remove.
 */

const BODY_ID = 'bt-budgets-body';

/** `sec.budgets.header`, written literally so the registry guardian sees it. */
function MaybeAnchor({ anchored, children }: { anchored: boolean; children: ReactNode }) {
  if (anchored) return <div data-tour="sec.budgets.header">{children}</div>;
  return <div>{children}</div>;
}

/** `sec.budgets.kpis` in the jobsites view; the report's own key in the other. */
function FiguresAnchor({ works, readOnly, children }: { works: boolean; readOnly: boolean; children: ReactNode }) {
  if (works) return <div data-tour="sec.budgets.kpis">{children}</div>;
  return <TourAnchor step="cobro" readOnly={readOnly}>{children}</TourAnchor>;
}

interface FigureDef {
  key: string;
  value: string;
  label: string;
  aside?: string;
  tone?: 'ink' | 'orange' | 'green';
  sheet?: boolean;
}

type Screen = { kind: 'list' } | { kind: 'history'; row: BudgetRow };

export function BudgetsSection({ readOnly = false, onNavigate }: {
  /** Finance: the same numbers, filtering and export; no writing. */
  readOnly?: boolean;
  /** Cross-section jump, when the host panel offers one. */
  onNavigate?: (section: string) => void;
} = {}) {
  const { t, i18n } = useTranslation(['admin', 'common']);
  const lang = i18n.language;

  const [rows, setRows] = useState<BudgetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<{ code: string; loaded: number; total: number } | null>(null);
  const [progress, setProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [tenant, setTenant] = useState<string | null>(null);

  const [view, setView] = useState<View>('works');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  // One sort per view. Switching does not carry it across; coming back finds
  // the one that was left behind.
  const [worksSort, setWorksSort] = useState<WorksSort>('execution');
  const [reportSort, setReportSort] = useState<ReportSort>('outstanding');

  const [screen, setScreen] = useState<Screen>({ kind: 'list' });
  const [detail, setDetail] = useState<BudgetRow | null>(null);
  const [adjust, setAdjust] = useState<BudgetRow | null>(null);
  const [closing, setClosing] = useState<BudgetRow | null>(null);
  const [exporting, setExporting] = useState(false);

  const consumedByProject = useMemo(() => {
    const map = new Map<number, number>();
    rows.forEach(row => map.set(row.id, row.consumed));
    return map;
  }, [rows]);
  const consumption = useConsumption(readOnly);

  const load = useCallback(async () => {
    setLoading(true);
    setFailure(null);
    setProgress(null);
    let loaded = 0;
    let total = 0;
    try {
      const fetchProjects = readOnly ? listFinanceProjects : listProjects;
      // Sweep every page. The server caps a page at 100 however many are asked
      // for, so the old `size: 500` stopped at the first hundred and totalled
      // what it happened to receive — and the oldest jobsites, the ones most
      // likely to be over budget, are exactly the ones that fell off.
      const all = await drainPages<ProjectResponse>(async (page, size) => {
        const res = await fetchProjects({ page, size });
        loaded += res.content.length;
        total = res.totalElements;
        setProgress({ loaded, total });
        return res;
      });
      setRows(all.filter(isBudgeted).map(toRow));
    } catch (err) {
      // A banner that stays, never a toast: a toast fades and leaves an empty
      // table that reads as "you have no jobsites". The figures fall to an em
      // dash rather than to $0 — a half total is worse than no total.
      setRows([]);
      setFailure({
        code: err instanceof ApiError ? `${err.status} ${err.code ?? ''}`.trim() : String(err),
        loaded,
        total,
      });
    } finally {
      setLoading(false);
    }
  }, [readOnly]);

  useEffect(() => { load(); }, [load]);

  // Degrades quietly: without it the kicker simply drops the tenant's name.
  useEffect(() => {
    getBranding().then(b => setTenant(b.organizationName)).catch(() => { /* no kicker name */ });
  }, []);

  /**
   * The clients that actually have a jobsite here, from the rows themselves.
   * Both panels get the same list from one request they were already making —
   * and the filter can never offer a client with nothing to show.
   */
  const clients = useMemo(() => {
    const seen = new Map<number, string>();
    rows.forEach(row => {
      if (row.clientId != null && !seen.has(row.clientId)) seen.set(row.clientId, row.clientName ?? String(row.clientId));
    });
    return [...seen].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  // The report view claims the guided tour while it is on screen, under its
  // own key. Two keys, one per role: SECTION_TOUR_STEPS is keyed copy — one
  // wording per key — so registering the admin key for finance would hand the
  // accountant a tour written for the person who does the adjusting.
  const tourKey = readOnly ? 'budgets-reporte-finanzas' : 'budgets-reporte';
  useEffect(() => {
    if (view !== 'report' || screen.kind !== 'list') return;
    return pushTourScope({ key: tourKey, label: t('admin:budgets.title') });
  }, [view, screen.kind, tourKey, t]);

  // The breakdown is a separate pair of requests and only the report needs it.
  const loadSplit = consumption.load;
  useEffect(() => {
    if (view === 'report' && !loading && failure == null) loadSplit(consumedByProject);
  }, [view, loading, failure, loadSplit, consumedByProject]);

  const filtered = useMemo(() => applyFilters(rows, filters), [rows, filters]);
  const worksRows = useMemo(() => sortWorks(filtered, worksSort), [filtered, worksSort]);
  const reportRows = useMemo(() => sortReport(filtered, reportSort), [filtered, reportSort]);
  const works = useMemo(() => worksTotals(filtered), [filtered]);
  const report = useMemo(() => reportTotals(filtered), [filtered]);
  const filterCount = activeFilterCount(filters);
  const hasFilters = filterCount > 0;

  const resetFilters = () => setFilters(EMPTY_FILTERS);
  const openDetail = (row: BudgetRow) => setDetail(row);
  const refresh = () => { void load(); };

  if (screen.kind === 'history') {
    return <HistoryView row={screen.row} readOnly={readOnly} onBack={() => setScreen({ kind: 'list' })} />;
  }

  const dash = '—';
  const figures: FigureDef[] = view === 'works'
    ? [
        { key: 'contract', value: failure ? dash : moneyRound(works.contract), label: t('admin:budgets.metric.contract') },
        {
          key: 'costBudget',
          value: failure ? dash : moneyRound(works.costBudget),
          label: t('admin:budgets.metric.costBudget.of', { count: works.withCostBudget, total: works.count }),
        },
        { key: 'spent', value: failure ? dash : moneyRound(works.consumed), label: t('admin:budgets.metric.spent') },
        {
          key: 'margin',
          value: failure ? dash : moneyRound(works.margin),
          label: t('admin:budgets.metric.margin'),
          aside: failure ? undefined : `${fmtPct(works.marginPct, lang)} %`,
          tone: works.margin < 0 ? 'orange' : 'green',
          sheet: true,
        },
      ]
    : [
        { key: 'invoiced', value: failure ? dash : moneyRound(report.invoiced), label: t('admin:budgets.metric.invoiced') },
        {
          key: 'collected',
          value: failure ? dash : moneyRound(report.collected),
          label: t('admin:budgets.metric.collected'),
          aside: failure ? undefined : `${fmtPct(report.collectedPct, lang)} %`,
        },
        {
          key: 'outstanding',
          value: failure ? dash : moneyRound(report.outstanding),
          label: t('admin:budgets.metric.outstanding.of', { count: report.owing, total: report.count }),
          tone: 'orange',
          sheet: true,
        },
        { key: 'spent', value: failure ? dash : moneyRound(report.consumed), label: t('admin:budgets.metric.spent') },
      ];

  async function runExport(format: 'pdf' | 'excel') {
    setExporting(true);
    try {
      await exportLegacyBudgetDocument({
        format,
        rows: reportRows,
        expenseRows: consumption.expenseRows,
        companyName: tenant,
        t,
      });
    } catch {
      toast.error(t('admin:budgets.export.error'));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* ── The bar: kicker, title, universe, and the switcher ─────────────
          Wrapped twice over rather than with one computed attribute: the
          registry guardian greps the source for a literal one. */}
      <MaybeAnchor anchored={view === 'works'}>
        <div className="flex items-end justify-between gap-5 flex-wrap">
          <div className="min-w-0">
            <Mono className="block text-[10px] tracking-[0.15em] text-[#8A8175]">
              {tenant
                ? t(view === 'works' ? 'admin:budgets.kicker.works' : 'admin:budgets.kicker.report', { tenant })
                : t(view === 'works' ? 'admin:budgets.kicker.works.plain' : 'admin:budgets.kicker.report.plain')}
            </Mono>
            <h2 className="font-bt-display font-extrabold uppercase text-[32px] md:text-[44px] leading-[0.92] text-[#0B0A09] mt-1">
              {t('admin:budgets.title')}
            </h2>
            <span data-testid="budgets-universe">
              <Mono className="block text-[10.5px] tracking-[0.06em] text-[#5A5346] mt-2">{universeLine()}</Mono>
            </span>
          </div>

          <div className="flex items-center gap-3.5 flex-wrap">
            <div className="text-right hidden sm:block">
              <Mono className="block text-[11px] tracking-[0.08em] text-[#0B0A09] normal-case">
                {t(view === 'works' ? 'admin:budgets.stamp.today' : 'admin:budgets.stamp.asOf', {
                  date: stampDay(new Date().toISOString(), lang),
                })}
              </Mono>
              <Mono className="block text-[9.5px] tracking-[0.1em] text-[#A69C8D] mt-[3px]">
                {t(view === 'works' ? 'admin:budgets.motto.works' : 'admin:budgets.motto.report')}
              </Mono>
            </div>

            {/* Only in the report: what is exported is the report, not the
                watch-list. Primary for finance, where it is the screen's job. */}
            {view === 'report' && (
              <TourAnchor step="documento" readOnly={readOnly}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      disabled={exporting || loading || failure != null || consumption.state !== 'ready'}
                      className={cn(
                        'inline-flex items-center gap-2 font-bt-mono text-[10.5px] font-semibold uppercase tracking-[0.1em] px-[15px] py-[11px] border transition-colors',
                        readOnly
                          ? 'bg-[#F97316] border-[#F97316] text-white hover:bg-[#C2410C]'
                          : 'bg-[#FAF7F0] border-[#DBD0BB] text-[#0B0A09] hover:border-[#F97316] hover:text-[#C2410C]',
                        'disabled:bg-[#EAE4D8] disabled:border-[#EAE4D8] disabled:text-[#A69C8D] disabled:cursor-not-allowed',
                        FOCUS_RING,
                      )}
                    >
                      {exporting ? t('admin:budgets.export.running') : t('admin:budgets.export.label')}
                      <ChevronDown className="w-3 h-3" strokeWidth={2.4} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[196px] rounded-none border-[#CDBFA6] p-0 shadow-[0_16px_48px_rgba(23,19,15,0.3)]">
                    {(['pdf', 'excel'] as const).map(format => (
                      <DropdownMenuItem
                        key={format}
                        onClick={() => void runExport(format)}
                        className="rounded-none cursor-pointer px-3.5 py-[11px] font-bt-mono text-[10.5px] uppercase tracking-[0.08em] text-[#0A0A0A] border-l-2 border-l-transparent focus:bg-[#F3EEE4] focus:border-l-[#F97316] data-[highlighted]:bg-[#F3EEE4]"
                      >
                        {t(format === 'pdf' ? 'admin:budgets.export.pdf' : 'admin:budgets.export.excel')}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TourAnchor>
            )}

            {view === 'report' ? (
              <TourAnchor step="vista" readOnly={readOnly}>
                <ViewSwitcher view={view} onChange={setView} bodyId={BODY_ID} />
              </TourAnchor>
            ) : (
              <ViewSwitcher view={view} onChange={setView} bodyId={BODY_ID} />
            )}
          </div>
        </div>

        {/* Once, at the top, and never per row. */}
        {readOnly && <div className="mt-3"><ReadOnlyNote /></div>}
      </MaybeAnchor>

      <div id={BODY_ID} role="tabpanel" aria-labelledby={`bt-budgets-tab-${view}`} className="space-y-3">
        {/* ── The figures, over the filtered rows ────────────────────────── */}
        <FiguresAnchor works={view === 'works'} readOnly={readOnly}>
          <FigureStrip filtered={hasFilters && !failure}>
            {figures.map((figure, i) => (
              <Figure
                key={figure.key}
                value={figure.value}
                label={figure.label}
                aside={figure.aside}
                tone={failure ? 'ink' : figure.tone ?? 'ink'}
                sheet={figure.sheet ?? false}
                last={i === figures.length - 1}
              />
            ))}
          </FigureStrip>
        </FiguresAnchor>

        {/* ── The filters: four controls, shared, plus each view's sort ──── */}
        <div className="bg-white border border-[#E7E1D5] px-4 py-[11px]">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 min-w-[220px] max-w-[300px]">
              <Search className="w-3.5 h-3.5 text-[#A69C8D] absolute left-[11px] top-1/2 -translate-y-1/2" />
              <input
                value={filters.search}
                onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
                placeholder={t('admin:budgets.filter.search')}
                aria-label={t('admin:budgets.filter.search')}
                className={cn(
                  'w-full border border-[#DBD0BB] bg-[#FAF7F0] pl-8 pr-3 py-2 text-[13px] text-[#0B0A09] outline-none placeholder:text-[#A69C8D] focus:border-[#F97316]',
                  FOCUS_RING,
                )}
              />
            </div>

            <MonoSelect
              value={filters.clientId === 'all' ? 'all' : String(filters.clientId)}
              onChange={e => setFilters(f => ({ ...f, clientId: e.target.value === 'all' ? 'all' : Number(e.target.value) }))}
              aria-label={t('admin:budgets.filter.client')}
              className={cn('py-2', filters.clientId !== 'all' && 'border-[#F97316] bg-[#FBEDE0] text-[#C2410C]')}
            >
              <option value="all">{t('admin:budgets.filter.client.all')}</option>
              {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
            </MonoSelect>

            <MonoSelect
              value={filters.status}
              onChange={e => setFilters(f => ({ ...f, status: e.target.value as StatusFilter }))}
              aria-label={t('admin:budgets.filter.status')}
              className={cn('py-2', filters.status !== 'active' && 'border-[#F97316] bg-[#FBEDE0] text-[#C2410C]')}
            >
              <option value="active">{t('admin:budgets.filter.status.active')}</option>
              <option value="all">{t('admin:budgets.filter.status.all')}</option>
              <option value="closed">{t('admin:budgets.filter.status.closed')}</option>
            </MonoSelect>

            <MonoSelect
              value={filters.risk}
              onChange={e => setFilters(f => ({ ...f, risk: e.target.value as RiskFilter }))}
              aria-label={t('admin:budgets.filter.risk')}
              className={cn('py-2', filters.risk !== 'all' && 'border-[#F97316] bg-[#FBEDE0] text-[#C2410C]')}
            >
              <option value="all">{t('admin:budgets.filter.risk.all')}</option>
              <option value="over">{t('admin:budgets.filter.risk.over')}</option>
              <option value="over90">{t('admin:budgets.filter.risk.over90')}</option>
              <option value="no-cost-budget">{t('admin:budgets.filter.risk.noCostBudget')}</option>
            </MonoSelect>

            {view === 'works' ? (
              <MonoSelect
                value={worksSort}
                onChange={e => setWorksSort(e.target.value as WorksSort)}
                aria-label={t('admin:budgets.sort.label')}
                className="py-2"
              >
                <option value="execution">{t('admin:budgets.sort.execution')}</option>
                <option value="margin">{t('admin:budgets.sort.margin')}</option>
                <option value="contract">{t('admin:budgets.sort.contract')}</option>
                <option value="name">{t('admin:budgets.sort.name')}</option>
              </MonoSelect>
            ) : (
              <MonoSelect
                value={reportSort}
                onChange={e => setReportSort(e.target.value as ReportSort)}
                aria-label={t('admin:budgets.sort.label')}
                className="py-2"
              >
                <option value="outstanding">{t('admin:budgets.sort.outstanding')}</option>
                <option value="consumed">{t('admin:budgets.sort.consumed')}</option>
                <option value="contract">{t('admin:budgets.sort.contract')}</option>
                <option value="name">{t('admin:budgets.sort.name')}</option>
              </MonoSelect>
            )}

            {hasFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className={cn('font-bt-mono text-[9.5px] font-semibold uppercase tracking-[0.1em] text-[#C2410C] hover:text-[#F97316]', FOCUS_RING)}
              >
                {t('admin:budgets.filter.reset')}
              </button>
            )}

            <Mono className="ml-auto text-[10px] tracking-[0.08em] text-[#8A8175]">
              {loading && progress
                ? t('admin:budgets.loadingCount', { loaded: progress.loaded, total: progress.total })
                : t('admin:budgets.filter.universe', { count: filtered.length, total: rows.length })}
            </Mono>
          </div>
        </div>

        {failure ? (
          <LoadFailure
            title={t('admin:budgets.loadError')}
            body={
              failure.loaded > 0
                ? t('admin:budgets.loadErrorPartial', { loaded: failure.loaded, total: failure.total })
                : t('admin:budgets.loadErrorBody')
            }
            code={`${failure.code} · ${readOnly ? '/api/v1/finance/projects' : '/api/v1/admin/projects'}`}
            onRetry={refresh}
            secondary={
              onNavigate
                ? <SecondaryButton onClick={() => onNavigate('projects')} className="bg-white">{t('admin:budgets.goProjects')}</SecondaryButton>
                : undefined
            }
          />
        ) : view === 'works' ? (
          <WorksView
            rows={worksRows}
            total={rows.length}
            loading={loading}
            readOnly={readOnly}
            filtered={hasFilters}
            onResetFilters={resetFilters}
            actions={{
              onDetail: openDetail,
              onAdjust: setAdjust,
              onHistory: row => setScreen({ kind: 'history', row }),
              onClose: setClosing,
              onShowRisk: () => setFilters(f => ({ ...f, risk: 'over90' })),
            }}
          />
        ) : (
          <ReportView
            rows={reportRows}
            total={rows.length}
            loading={loading}
            filtered={hasFilters}
            readOnly={readOnly}
            risk={filters.risk}
            onResetFilters={resetFilters}
            onSeeGauge={() => setView('works')}
            consumption={consumption}
            onRetrySplit={() => consumption.retry(consumedByProject)}
            onOpenWorks={row => { setView('works'); openDetail(row); }}
            onOpenInvoices={onNavigate ? () => onNavigate('invoices') : undefined}
          />
        )}
      </div>

      <DetailDrawer
        row={detail}
        open={detail != null}
        onOpenChange={open => { if (!open) setDetail(null); }}
        split={detail ? consumption.splits.get(detail.id) ?? null : null}
        splitLoading={consumption.state === 'loading' || consumption.state === 'idle'}
        readOnly={readOnly}
        onAdjust={() => { if (detail) { setAdjust(detail); setDetail(null); } }}
        onHistory={() => { if (detail) { setScreen({ kind: 'history', row: detail }); setDetail(null); } }}
        onClose={() => { if (detail) { setClosing(detail); setDetail(null); } }}
      />
      <AdjustWindow
        row={adjust}
        open={adjust != null}
        onOpenChange={open => { if (!open) setAdjust(null); }}
        onSaved={refresh}
      />
      <CloseWindow
        row={closing}
        open={closing != null}
        onOpenChange={open => { if (!open) setClosing(null); }}
        onClosed={refresh}
      />
    </div>
  );

  /** The universe, written the way the document's own footer writes it. */
  function universeLine(): string {
    if (failure) return t('admin:budgets.universe.unknown');
    if (hasFilters) {
      return t('admin:budgets.universe.filtered', {
        count: filtered.length,
        total: rows.length,
        conditions: describeFilters(),
      });
    }
    return view === 'works'
      ? t('admin:budgets.universe.works', {
          count: rows.length,
          withCost: works.withCostBudget,
          without: works.count - works.withCostBudget,
        })
      : t('admin:budgets.universe.report', { count: rows.length, total: rows.length });
  }

  /**
   * The conditions in words, not in select labels: the header reads
   * "3 de 4 obras · cliente Grupo Marisol · activas", never
   * "… · ESTADO · ACTIVAS".
   */
  function describeFilters(): string {
    const risk: Record<Exclude<RiskFilter, 'all'>, string> = {
      over: t('admin:budgets.risk.over.short'),
      over90: t('admin:budgets.risk.over90.short'),
      'no-cost-budget': t('admin:budgets.risk.noCostBudget.short'),
    };
    const status: Record<StatusFilter, string> = {
      active: t('admin:budgets.status.active.short'),
      all: t('admin:budgets.status.all.short'),
      closed: t('admin:budgets.status.closed.short'),
    };
    const client = filters.clientId !== 'all'
      ? clients.find(c => c.id === filters.clientId)?.name ?? null
      : null;
    return [
      client ? t('admin:budgets.universe.client', { name: client }) : null,
      status[filters.status],
      filters.risk !== 'all' ? risk[filters.risk] : null,
      filters.search.trim() ? `“${filters.search.trim()}”` : null,
    ].filter(Boolean).join(' · ');
  }
}

export default BudgetsSection;
