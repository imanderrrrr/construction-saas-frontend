import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '../ui/utils';
import { FOCUS_RING, SecondaryButton } from '../onboarding/chrome';
import { Bone, EmptyWord, Mono, MonoSelect, stampDay } from '../projects/bt';
import { Amount, LoadFailure } from '../budgets/ui';
import { fmtMoney } from '../invoices/bits';
import { CATEGORY_KEY_MAP, toVendorBill, type VendorBill, type VendorPayment } from '../PayableCommon';
import { AuthImage } from '../sitelog/AuthImage';
import { AuthService } from '../../services/auth';
import { listProjects } from '../../services/projects';
import { businessToday, currentMonth, fmtDate } from '../../helpers/dateTime';
import {
  getPayableSummary, listAllPayables, listAllReceivables, listPayableVendors, payableAttachmentUrl,
  type Payable, type PayableSummary,
} from '../../services/finance';
import {
  addDays, agingByParty, agingTotals, balanceOf, cashBridge, daysLate, isBillable, isSettled,
  lanesOf, matches, payableFigures, payableFiguresFromSummary, payablePayments, payableToOwed,
  receivableToOwed, sumBalances,
  type AgingRow, type LaneKey, type Owed,
} from './accounting';
import {
  AGING_GRID, AgingPartyRow, AgingTotalsRow, ContextLine, DirectionHeader, DueCell, Figure, FigureChip, FiguresStrip,
  FilterBar, PhotoCell, SearchField, Tag, ViewToggle,
} from './ui';
import { PayableDetailPanel } from './PayableDetailPanel';
import { RegisterInQuickBooksNote } from './PaymentOrigin';
import {
  BatchPayDialog, ConvertDialog, CreateBillDialog, DeleteBillDialog, EditAmountDatesDialog,
  EditBillInfoDialog, EditPaymentDialog, PayDialog, ReassignDialog, UnpayDialog, voidOnePayment,
  type ProjectBudget,
} from './PayableDialogs';

/**
 * Pagar — the screen of money going out.
 *
 * Its question is *what do I have to pay this week, and to whom*, so it is
 * ordered by due date in lanes rather than grouped by who is owed: the week is
 * the unit of work here. The lanes are also what makes a Friday payment run
 * possible — tick a lane, pay it in one window.
 */

type ViewKey = 'lanes' | 'vendors';
type RangeKey = 'all' | 'month' | 'quarter' | 'year';

const ROW_GRID = 'grid grid-cols-[22px_1.5fr_.95fr_.8fr_1fr_1fr_46px_.95fr_.9fr] gap-2.5 items-center';

const LANE_TONE: Record<LaneKey, string> = {
  overdue: 'bg-[#B3402A] text-white',
  week: 'bg-[#0A0A0A] text-[#F5F1E8]',
  next30: 'bg-[#F3EEE4] text-[#0A0A0A] border-t border-b border-[#E7E1D5]',
  later: 'bg-[#FBF8F2] text-[#8A8175] border-t border-[#EDE7DB]',
  paid: 'bg-[#FBF8F2] text-[#5A5346] border-t border-[#EDE7DB]',
};

export function PayablesScreen({ onNavigate }: { onNavigate?: (section: string) => void } = {}) {
  const { t, i18n } = useTranslation(['finance', 'common']);
  const lang = i18n.language;
  const dateLocale = lang.startsWith('es') ? 'es' : 'en-US';
  const today = businessToday();
  const month = currentMonth();
  const canManage = ['ADMIN', 'FINANCE'].includes(AuthService.getCanonicalRole() ?? '');
  const bodyId = useId();

  const [bills, setBills] = useState<VendorBill[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [vendors, setVendors] = useState<string[]>([]);
  const [projects, setProjects] = useState<ProjectBudget[]>([]);
  const [inflow, setInflow] = useState<Owed[] | null>(null);
  const [summary, setSummary] = useState<PayableSummary | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [busy, setBusy] = useState(false);

  const [view, setView] = useState<ViewKey>('lanes');
  const [vendor, setVendor] = useState('');
  const [projectId, setProjectId] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [range, setRange] = useState<RangeKey>('all');
  const [search, setSearch] = useState('');
  const [openVendor, setOpenVendor] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const [detailId, setDetailId] = useState<number | null>(null);
  const [payBill, setPayBill] = useState<VendorBill | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editBill, setEditBill] = useState<VendorBill | null>(null);
  const [infoBill, setInfoBill] = useState<VendorBill | null>(null);
  const [convertBill, setConvertBill] = useState<VendorBill | null>(null);
  const [reassignBill, setReassignBill] = useState<VendorBill | null>(null);
  const [unpayBill, setUnpayBill] = useState<VendorBill | null>(null);
  const [deleteBill, setDeleteBill] = useState<VendorBill | null>(null);
  const [editPayment, setEditPayment] = useState<{ bill: VendorBill; payment: VendorPayment } | null>(null);

  /* ── Data ───────────────────────────────────────────────────────────── */

  const load = useCallback(() => {
    listAllPayables()
      .then(rows => { setBills(rows.map(toVendorBill)); setLoadError(null); })
      .catch((err: unknown) => setLoadError(err instanceof Error ? err.message : String(err)));
  }, []);

  useEffect(() => { load(); }, [load, reloadNonce]);

  useEffect(() => {
    listPayableVendors().then(setVendors).catch(() => { /* the select falls back to the bills' own vendors */ });
    listProjects({ page: 0, size: 200 })
      .then(r => setProjects(r.content.map(p => ({
        id: p.id, name: p.name, remainingBudgetCents: p.remainingBudgetCents ?? p.contractAmountCents,
      }))))
      .catch(() => toast.error(t('finance:accounts.catalogFailed')));
  }, [t]);

  // Only for the week's cash bridge; a failure here hides the strip, nothing else.
  useEffect(() => {
    listAllReceivables()
      .then(rs => setInflow(rs.filter(isBillable).map(receivableToOwed)))
      .catch(() => setInflow(null));
  }, [reloadNonce]);

  // The server's figures, measured in the tenant's timezone over the whole
  // tenant. A server without phase 2 answers 404 and the figures below stay on
  // the rows we already loaded, which is what this screen shipped with.
  useEffect(() => {
    getPayableSummary().then(setSummary).catch(() => setSummary(null));
  }, [reloadNonce]);

  /* ── Figures ────────────────────────────────────────────────────────── */

  const owed = useMemo(() => (bills ?? []).map(b => payableToOwed(b as unknown as Payable)), [bills]);
  const fromRows = useMemo(
    () => payableFigures(owed, payablePayments((bills ?? []) as unknown as Payable[]), today, month),
    [owed, bills, today, month],
  );
  const figures = useMemo(
    () => (summary ? payableFiguresFromSummary(summary, fromRows) : fromRows),
    [summary, fromRows],
  );
  const bridge = useMemo(() => (inflow ? cashBridge(inflow, owed, today) : null), [inflow, owed, today]);

  /* ── Filters ────────────────────────────────────────────────────────── */

  const rangeFrom = useMemo(() => {
    if (range === 'all') return null;
    const [y, m] = today.split('-').map(Number);
    if (range === 'month') return `${y}-${String(m).padStart(2, '0')}-01`;
    if (range === 'year') return `${y}-01-01`;
    return addDays(today, -90);
  }, [range, today]);

  const filtered = useMemo(() => (bills ?? []).filter(b => {
    if (vendor && b.vendor !== vendor) return false;
    if (projectId && String(b.projectId) !== projectId) return false;
    if (category && b.category !== category) return false;
    if (status && b.status !== status) return false;
    if (rangeFrom && b.receivedDate < rangeFrom) return false;
    if (!matches([b.billNumber, b.invoiceNumber, b.vendor, b.project, b.description], search)) return false;
    return true;
  }), [bills, vendor, projectId, category, status, rangeFrom, search]);

  const filteredOwed = useMemo(() => filtered.map(b => payableToOwed(b as unknown as Payable)), [filtered]);
  const lanes = useMemo(() => lanesOf(filteredOwed, today), [filteredOwed, today]);
  const aging = useMemo(() => agingByParty(filteredOwed, today), [filteredOwed, today]);
  const totals = useMemo(() => agingTotals(aging), [aging]);
  const byId = useMemo(() => new Map(filtered.map(b => [b.id, b])), [filtered]);

  const vendorOptions = useMemo(
    () => [...new Set([...vendors, ...(bills ?? []).map(b => b.vendor)])].sort(),
    [vendors, bills],
  );
  const hasFilters = !!(vendor || projectId || category || status || search || range !== 'all');
  const projectSubtotal = useMemo(
    () => (projectId ? sumBalances(filteredOwed.filter(d => !isSettled(d))) : null),
    [projectId, filteredOwed],
  );
  const openCount = filtered.filter(b => !isSettled(payableToOwed(b as unknown as Payable))).length;

  function clearFilters() {
    setVendor(''); setProjectId(''); setCategory(''); setStatus(''); setRange('all'); setSearch('');
  }

  /* ── Selection ──────────────────────────────────────────────────────── */

  const selectedBills = useMemo(
    () => [...selected].map(id => byId.get(id)).filter((b): b is VendorBill => !!b && payableHere(b)),
    [selected, byId],
  );
  const selectedTotal = useMemo(() => sumBalances(selectedBills.map(b => payableToOwed(b as unknown as Payable))), [selectedBills]);

  function toggleOne(id: number) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleLane(lane: { docs: Owed[] }) {
    const ids = lane.docs.map(d => byId.get(d.id)).filter((b): b is VendorBill => !!b && payableHere(b)).map(b => b.id);
    const allOn = ids.every(id => selected.has(id));
    setSelected(prev => {
      const next = new Set(prev);
      for (const id of ids) { if (allOn) next.delete(id); else next.add(id); }
      return next;
    });
  }

  /* ── Mutations ──────────────────────────────────────────────────────── */

  const patch = useCallback((updated: Payable) => {
    setBills(prev => (prev ? prev.map(b => (b.id === updated.id ? toVendorBill(updated) : b)) : prev));
  }, []);

  const patchMany = useCallback((updated: Payable[], stillSelected: number[]) => {
    setBills(prev => {
      if (!prev) return prev;
      const map = new Map(updated.map(u => [u.id, toVendorBill(u)]));
      return prev.map(b => map.get(b.id) ?? b);
    });
    setSelected(new Set(stillSelected));
  }, []);

  async function voidPayment(bill: VendorBill, paymentId: number) {
    setBusy(true);
    try {
      patch(await voidOnePayment(bill.id, paymentId));
      toast.success(t('finance:payable.void.done'));
    } catch (err: unknown) {
      toast.error(t('finance:payable.void.failed'), { description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  const detail = detailId != null ? byId.get(detailId) ?? (bills ?? []).find(b => b.id === detailId) ?? null : null;
  const nextBillNumber = useMemo(() => {
    const max = (bills ?? []).reduce((m, b) => {
      const n = parseInt(b.billNumber.split('-').pop() ?? '0', 10);
      return Number.isFinite(n) && n > m ? n : m;
    }, 0);
    return `BILL-${today.slice(0, 4)}-${String(max + 1).padStart(3, '0')}`;
  }, [bills, today]);

  /* ── Render ─────────────────────────────────────────────────────────── */

  const loading = bills === null && !loadError;
  const figure = (v: string) => (loading || loadError ? '—' : v);

  return (
    <div className="space-y-3.5">
      <DirectionHeader
        direction="out"
        eyebrow={t('finance:payable.eyebrow')}
        title={t('finance:payable.h1')}
        purpose={t('finance:payable.purpose')}
        tourAnchor="sec.accounts-payable.header"
        aside={
          <>
            <Mono className="text-[11px] tracking-[0.1em] text-[#0A0A0A]">
              {t('finance:accounts.todayStamp', { date: stampDay(today, lang) })}
            </Mono>
            <button
              type="button"
              data-tour="sec.accounts-payable.new-bill"
              onClick={() => setCreateOpen(true)}
              className={cn('inline-flex items-center gap-2 bg-[#0A0A0A] text-[#F5F1E8] border-0 cursor-pointer px-4 py-3 font-bt-mono text-[11.5px] font-semibold uppercase tracking-[0.09em] transition-colors hover:bg-[#F97316] hover:text-[#0A0A0A]', FOCUS_RING)}
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={2.4} />{t('finance:payable.create.action')}
            </button>
            <Mono className="text-[10px] tracking-[0.09em] text-[#A69C8D]">{t('finance:payable.create.hint')}</Mono>
          </>
        }
      />

      <div>
        <FiguresStrip direction="out">
          <Figure
            tourAnchor="sec.accounts-payable.week"
            label={t('finance:payable.fig.week')}
            value={figure(fmtMoney(figures.dueThisWeek.amount))}
            tone="ink"
            sheet="ink"
            chip={!loading && !loadError && figures.dueThisWeek.count > 0
              ? <FigureChip tone="onInk">{t('finance:payable.billCount', { count: figures.dueThisWeek.count })}</FigureChip>
              : undefined}
            meta={figures.firstDue ? t('finance:payable.fig.firstDue', { date: fmtDate(figures.firstDue, dateLocale) }) : undefined}
          />
          <Figure
            label={t('finance:payable.fig.overdue')}
            value={figure(fmtMoney(figures.overdue.amount))}
            tone="red"
            chip={!loading && !loadError && figures.overdue.count > 0
              ? <FigureChip tone="red">{figures.overdue.count}</FigureChip>
              : undefined}
            meta={figures.oldestOverdueDays > 0 ? t('finance:payable.fig.oldest', { count: figures.oldestOverdueDays }) : undefined}
          />
          <Figure
            label={t('finance:payable.fig.outstanding')}
            value={figure(fmtMoney(figures.outstanding.amount))}
            meta={t('finance:payable.fig.outstandingMeta', { count: figures.outstanding.count })}
          />
        </FiguresStrip>
        <ContextLine aside={t('finance:payable.context.contained')}>
          {projectSubtotal != null
            ? <>{projects.find(p => String(p.id) === projectId)?.name} <b className="text-[#0A0A0A]">{fmtMoney(projectSubtotal)}</b> · {t('finance:receivable.context.ofTotal', { total: fmtMoney(figures.outstanding.amount) })}</>
            : <>{t('finance:payable.context.paidThisMonth')} <b className="text-[#0A0A0A]">{figure(fmtMoney(figures.paid.amount))}</b> · {t('finance:payable.context.payments', { count: figures.paid.count })}</>}
        </ContextLine>
        {bridge && !loadError && (
          <div className="flex items-center gap-2 flex-wrap bg-white border border-[#E7E1D5] border-t-0 px-5 py-1.5">
            <Mono className="text-[10.5px] tracking-[0.08em] text-[#8A8175]">{t('finance:accounts.bridge.week')}</Mono>
            <Mono className="text-[10.5px] tracking-[0.08em] text-[#5A5346]">
              {t('finance:accounts.bridge.out')} <b className="text-[#0A0A0A] normal-case">{fmtMoney(bridge.outbound.amount)}</b> · {t('finance:payable.billCount', { count: bridge.outbound.count })}
            </Mono>
            <span className="text-[#CDBFA6]">·</span>
            <Mono className="text-[10.5px] tracking-[0.08em] text-[#5A5346]">
              {t('finance:accounts.bridge.in')} <b className="text-[#0A0A0A] normal-case">{fmtMoney(bridge.inbound.amount)}</b> · {t('finance:receivable.docCount', { count: bridge.inbound.count })}
            </Mono>
            <span className="text-[#CDBFA6]">·</span>
            <Mono className={cn('text-[10.5px] tracking-[0.08em] font-semibold', bridge.net < 0 ? 'text-[#B3402A]' : 'text-[#2E7D4F]')}>
              {t('finance:accounts.bridge.net')} <span className="normal-case">{bridge.net < 0 ? '−' : '+'}{fmtMoney(Math.abs(bridge.net))}</span>
            </Mono>
            {onNavigate && (
              <button type="button" onClick={() => onNavigate('accounts-receivable')}
                className={cn('ml-auto font-bt-mono text-[10px] uppercase tracking-[0.1em] text-[#C2410C] hover:text-[#F97316] cursor-pointer', FOCUS_RING)}>
                {t('finance:accounts.bridge.seeReceivables')} →
              </button>
            )}
          </div>
        )}
      </div>

      <FilterBar>
        <ViewToggle
          value={view}
          onChange={v => { setView(v); setOpenVendor(null); }}
          bodyId={bodyId}
          label={t('finance:payable.view.label')}
          options={[
            { key: 'lanes', label: t('finance:payable.view.byDue') },
            { key: 'vendors', label: t('finance:payable.view.byVendor') },
          ]}
        />
        <MonoSelect value={vendor} onChange={e => setVendor(e.target.value)} aria-label={t('finance:payable.filters.vendor')} className="text-[10px] py-2">
          <option value="">{t('finance:payable.filters.allVendors')}</option>
          {vendorOptions.map(v => <option key={v} value={v}>{v}</option>)}
        </MonoSelect>
        <MonoSelect value={projectId} onChange={e => setProjectId(e.target.value)} aria-label={t('common:labels.project')} className="text-[10px] py-2">
          <option value="">{t('common:labels.allProjects')}</option>
          {projects.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
        </MonoSelect>
        <MonoSelect value={category} onChange={e => setCategory(e.target.value)} aria-label={t('common:labels.category')} className="text-[10px] py-2">
          <option value="">{t('common:labels.allCategories')}</option>
          {Object.entries(CATEGORY_KEY_MAP).map(([k, key]) => <option key={k} value={k}>{t(`finance:${key}`)}</option>)}
        </MonoSelect>
        <MonoSelect value={status} onChange={e => setStatus(e.target.value)} aria-label={t('common:labels.status')} className="text-[10px] py-2">
          <option value="">{t('common:labels.allStatuses')}</option>
          <option value="pending">{t('common:status.pending')}</option>
          <option value="partial">{t('common:status.partial')}</option>
          <option value="paid">{t('common:status.paid')}</option>
        </MonoSelect>
        <MonoSelect value={range} onChange={e => setRange(e.target.value as RangeKey)} aria-label={t('finance:accounts.range.label')} className="text-[10px] py-2">
          <option value="all">{t('finance:accounts.range.all')}</option>
          <option value="month">{t('finance:accounts.range.month')}</option>
          <option value="quarter">{t('finance:accounts.range.quarter')}</option>
          <option value="year">{t('finance:accounts.range.year')}</option>
        </MonoSelect>
        <SearchField value={search} onChange={setSearch} label={t('finance:accounts.search')} placeholder={t('finance:accounts.search')} />
        {hasFilters && (
          <button type="button" onClick={clearFilters}
            className={cn('font-bt-mono text-[10px] uppercase tracking-[0.1em] font-semibold text-[#C2410C] hover:text-[#F97316] px-1 cursor-pointer', FOCUS_RING)}>
            {t('common:buttons.clearFilters')}
          </button>
        )}
        <Mono className="ml-auto text-[10px] tracking-[0.09em] text-[#A69C8D]">
          {t('finance:payable.countLine', { open: openCount, paid: filtered.length - openCount })}
        </Mono>
      </FilterBar>

      <div id={bodyId} data-tour="sec.accounts-payable.lanes" className="bg-white border border-[#E7E1D5] relative">
        {loadError && (
          <div data-testid="accounts-payable-load-error" className="p-3.5">
            <LoadFailure
              title={t('finance:payable.loadError.title')}
              body={t('finance:payable.loadError.body')}
              code={loadError}
              onRetry={() => { setLoadError(null); setReloadNonce(n => n + 1); }}
            />
          </div>
        )}

        {loading && (
          <div aria-hidden="true">
            <div className="flex items-center gap-3 px-5 py-2.5 bg-[#F3EEE4]"><Bone className="w-28 h-2.5" /><Bone className="ml-auto w-20 h-3" /></div>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={cn(ROW_GRID, 'px-5 py-3.5 border-b border-[#F0EBE1]')}>
                <Bone className="h-3.5 w-3.5" />
                <Bone className="w-[70%] h-3.5" />
                {Array.from({ length: 7 }).map((__, j) => <Bone key={j} className="h-3" />)}
              </div>
            ))}
          </div>
        )}

        {!loading && !loadError && filtered.length === 0 && (
          hasFilters
            ? <EmptyWord
                className="border-0"
                word={t('finance:accounts.noMatchBig')}
                title={t('finance:accounts.noMatchTitle')}
                hint={t('finance:accounts.noMatchHint')}
                action={<SecondaryButton onClick={clearFilters} className="bg-[#FAF7F0]">{t('common:buttons.clearFilters')}</SecondaryButton>}
              />
            : <EmptyWord
                className="border-0"
                word={t('finance:payable.empty.word')}
                title={t('finance:payable.empty.title')}
                hint={t('finance:payable.empty.hint')}
                action={<SecondaryButton onClick={() => setCreateOpen(true)} className="bg-[#FAF7F0]">{t('finance:payable.create.action')}</SecondaryButton>}
              />
        )}

        {!loading && !loadError && filtered.length > 0 && view === 'lanes' && lanes.map(lane => {
          const rows = lane.docs.map(d => byId.get(d.id)).filter((b): b is VendorBill => !!b);
          if (lane.key === 'paid') {
            return rows.length === 0 ? null : (
              <div key={lane.key} className={cn('flex items-center gap-2.5 flex-wrap px-5 py-2', LANE_TONE.paid)}>
                <Tag tone="green">{t('finance:payable.lane.paid')}</Tag>
                <span className="text-[12px] text-[#5A5346] min-w-0 truncate">
                  {t('finance:payable.lane.paidSummary', { count: rows.length })} · {rows.slice(0, 2).map(b => `${b.vendor} ${fmtMoney(b.amount)}`).join(' · ')}
                  {rows.some(b => b.payments.some(p => p.voided)) && ` · ${t('finance:payable.lane.hasVoided')}`}
                </span>
                <button type="button" onClick={() => { setStatus('paid'); setView('vendors'); }}
                  className={cn('ml-auto font-bt-mono text-[10px] uppercase tracking-[0.1em] text-[#C2410C] hover:text-[#F97316] cursor-pointer', FOCUS_RING)}>
                  {t('finance:payable.lane.see')} →
                </button>
              </div>
            );
          }
          const selectable = rows.filter(payableHere);
          const allOn = selectable.length > 0 && selectable.every(b => selected.has(b.id));
          return (
            <div key={lane.key}>
              <div className={cn('flex items-center gap-3 px-5 py-2', LANE_TONE[lane.key])}>
                {selectable.length > 0 && canManage ? (
                  <LaneCheckbox checked={allOn} onChange={() => toggleLane(lane)} label={t('finance:payable.batch.selectLane')} dark={lane.key === 'overdue' || lane.key === 'week'} />
                ) : <span className="w-[15px]" />}
                <Mono className="text-[10.5px] font-semibold tracking-[0.13em]">{t(`finance:payable.lane.${lane.key}`)}</Mono>
                <Mono className={cn('text-[10px] tracking-[0.09em]', lane.key === 'overdue' ? 'text-white/85' : lane.key === 'week' ? 'text-[#A69C8D]' : 'text-[#8A8175]')}>
                  {laneMeta(lane.key, rows.length, today, dateLocale, t)}
                </Mono>
                <Mono className="ml-auto text-[12.5px] font-semibold normal-case tabular-nums">{fmtMoney(lane.total)}</Mono>
              </div>
              {rows.length > 0 && (
                <div className={cn(ROW_GRID, 'hidden sm:grid px-5 py-1.5 border-b border-[#EDE7DB] bg-[#FBF8F2] font-bt-mono text-[10px] uppercase tracking-[0.11em] text-[#8A8175]')}>
                  <span />
                  <span>{t('finance:payable.table.vendor')}</span>
                  <span>{t('finance:payable.table.category')}</span>
                  <span>{t('finance:payable.table.project')}</span>
                  <span>{t('finance:payable.table.dueDate')}</span>
                  <span className="text-right">{t('finance:accounts.balance')}</span>
                  <span>{t('finance:payable.table.photo')}</span>
                  <span>{t('finance:payable.table.type')}</span>
                  <span className="text-right">{t('common:labels.actions')}</span>
                </div>
              )}
              {rows.map(bill => (
                <BillRow
                  key={bill.id}
                  bill={bill}
                  today={today}
                  dateLocale={dateLocale}
                  selected={selected.has(bill.id)}
                  onSelect={canManage ? () => toggleOne(bill.id) : undefined}
                  onOpen={() => setDetailId(bill.id)}
                  onPay={() => setPayBill(bill)}
                />
              ))}
            </div>
          );
        })}

        {!loading && !loadError && filtered.length > 0 && view === 'vendors' && (
          <>
            <div className={cn(AGING_GRID, 'hidden sm:grid px-5 py-2.5 border-b border-[#0A0A0A] bg-[#FBF8F2] font-bt-mono text-[10px] uppercase tracking-[0.12em] text-[#8A8175]')}>
              <span>{t('finance:payable.table.vendor')}</span>
              <span className="text-right">{t('finance:receivable.aging.current')}</span>
              <span className="text-right text-[#C2410C]">{t('finance:receivable.aging.d1_30')}</span>
              <span className="text-right">{t('finance:receivable.aging.d31_60')}</span>
              <span className="text-right">{t('finance:receivable.aging.d60plus')}</span>
              <span className="text-right text-[#0A0A0A]">{t('finance:payable.aging.total')}</span>
              <span />
            </div>
            {aging.map(row => (
              <VendorRow
                key={row.party}
                row={row}
                open={openVendor === row.party}
                onToggle={() => setOpenVendor(v => (v === row.party ? null : row.party))}
                byId={byId}
                today={today}
                dateLocale={dateLocale}
                selected={selected}
                onSelect={canManage ? toggleOne : undefined}
                onOpenBill={id => setDetailId(id)}
                onPay={setPayBill}
              />
            ))}
            <AgingTotalsRow
              label={t('finance:payable.aging.totalRow', { count: aging.length })}
              totals={totals}
              labels={{ current: t('finance:receivable.aging.current'), overdue: t('finance:receivable.fig.overdue') }}
            />
          </>
        )}

        {/* The run: only while something is ticked, so the list keeps its shape. */}
        {selectedBills.length > 0 && (
          <div className="sticky bottom-0 z-10 flex items-center gap-3.5 flex-wrap bg-[#0A0A0A] text-[#F5F1E8] border-t-2 border-t-[#F97316] px-5 py-3">
            <Mono className="text-[11px] font-semibold tracking-[0.12em]">
              {t('finance:payable.batch.selected', { count: selectedBills.length })}
            </Mono>
            <span className="font-bt-display font-extrabold text-[26px] leading-none tabular-nums">{fmtMoney(selectedTotal)}</span>
            <button type="button" onClick={() => setSelected(new Set())}
              className={cn('ml-auto font-bt-mono text-[10px] uppercase tracking-[0.1em] text-[#A69C8D] hover:text-[#F5F1E8] cursor-pointer', FOCUS_RING)}>
              {t('finance:payable.batch.clear')}
            </button>
            <button type="button" onClick={() => setBatchOpen(true)}
              className={cn('bg-[#F97316] text-[#0A0A0A] border-0 cursor-pointer px-4 py-2.5 font-bt-mono text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors hover:bg-[#C2410C] hover:text-[#F5F1E8]', FOCUS_RING)}>
              {t('finance:payable.batch.pay', { count: selectedBills.length })}
            </button>
          </div>
        )}
      </div>

      <PayableDetailPanel
        bill={detail}
        project={projects.find(p => p.id === detail?.projectId)}
        canManage={canManage}
        today={today}
        dateLocale={dateLocale}
        busy={busy}
        onClose={() => setDetailId(null)}
        onPay={b => { setDetailId(null); setPayBill(b); }}
        onEditAmounts={b => { setDetailId(null); setEditBill(b); }}
        onEditInfo={b => { setDetailId(null); setInfoBill(b); }}
        onConvert={b => { setDetailId(null); setConvertBill(b); }}
        onReassign={b => { setDetailId(null); setReassignBill(b); }}
        onUnpay={b => { setDetailId(null); setUnpayBill(b); }}
        onDelete={b => { setDetailId(null); setDeleteBill(b); }}
        onVoidPayment={(b, id) => void voidPayment(b, id)}
        onEditPayment={(b, p) => { setDetailId(null); setEditPayment({ bill: b, payment: p }); }}
      />

      <PayDialog bill={payBill} project={projects.find(p => p.id === payBill?.projectId)} onClose={() => setPayBill(null)} onPaid={patch} />
      {batchOpen && (
        <BatchPayDialog
          bills={selectedBills}
          projects={projects}
          onClose={() => setBatchOpen(false)}
          onFinished={patchMany}
        />
      )}
      <CreateBillDialog
        open={createOpen}
        vendors={vendorOptions}
        projects={projects}
        suggestedNumber={nextBillNumber}
        onClose={() => setCreateOpen(false)}
        onCreated={created => setBills(prev => (prev ? [toVendorBill(created), ...prev] : prev))}
      />
      <EditAmountDatesDialog bill={editBill} onClose={() => setEditBill(null)} onSaved={patch} />
      <EditBillInfoDialog bill={infoBill} vendors={vendorOptions} onClose={() => setInfoBill(null)} onSaved={patch} />
      <ConvertDialog bill={convertBill} onClose={() => setConvertBill(null)} onConverted={patch} />
      <ReassignDialog bill={reassignBill} projects={projects} onClose={() => setReassignBill(null)} onReassigned={patch} />
      <UnpayDialog bill={unpayBill} onClose={() => setUnpayBill(null)} onUnpaid={patch} />
      <DeleteBillDialog
        bill={deleteBill}
        onClose={() => setDeleteBill(null)}
        onDeleted={id => setBills(prev => (prev ? prev.filter(b => b.id !== id) : prev))}
      />
      <EditPaymentDialog subject={editPayment} onClose={() => setEditPayment(null)} onSaved={patch} />
    </div>
  );
}

/* ── Lane furniture ────────────────────────────────────────────────────── */

/**
 * Whether a bill can be paid from here: open, and not one whose payments come
 * from the tenant's QuickBooks (those are registered there; the server would
 * refuse each one of a batch run with 409).
 */
function payableHere(b: VendorBill): boolean {
  return !b.paymentsInQuickBooks && !isSettled(payableToOwed(b as unknown as Payable));
}

function laneMeta(key: LaneKey, count: number, today: string, locale: string, t: (k: string, o?: Record<string, unknown>) => string): string {
  if (count === 0) return t(`finance:payable.lane.empty.${key}`);
  if (key === 'week') return `${fmtDate(today, locale)} – ${fmtDate(addDays(today, 7), locale)} · ${t('finance:payable.billCount', { count })}`;
  if (key === 'next30') return `${fmtDate(addDays(today, 8), locale)} – ${fmtDate(addDays(today, 30), locale)} · ${t('finance:payable.billCount', { count })}`;
  if (key === 'overdue') return `${t('finance:payable.billCount', { count })} · ${t('finance:payable.lane.payFirst')}`;
  return t('finance:payable.billCount', { count });
}

function LaneCheckbox({ checked, onChange, label, dark }: { checked: boolean; onChange: () => void; label: string; dark?: boolean }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      aria-label={label}
      title={label}
      className={cn(
        'w-[15px] h-[15px] appearance-none border-[1.5px] cursor-pointer flex-shrink-0 bg-white',
        'checked:bg-[#F97316] checked:border-[#F97316]',
        dark ? 'border-white/70' : 'border-[#8A8175]',
        FOCUS_RING,
      )}
    />
  );
}

/* ── One bill ──────────────────────────────────────────────────────────── */

function BillRow({ bill, today, dateLocale, selected, onSelect, onOpen, onPay }: {
  bill: VendorBill;
  today: string;
  dateLocale: string;
  selected: boolean;
  onSelect?: () => void;
  onOpen: () => void;
  onPay: () => void;
}) {
  const { t } = useTranslation(['finance', 'common']);
  const owedRow = payableToOwed(bill as unknown as Payable);
  const balance = balanceOf(bill);
  const settled = isSettled(owedRow);
  const late = daysLate(bill.dueDate, today);
  // A bill with only PDFs has a count but nothing to paint, so the cell falls
  // back to the icon and the count says how many documents are in there.
  const photos = bill.attachmentCount;
  const thumb = bill.firstAttachmentId == null ? null : (
    <AuthImage
      src={payableAttachmentUrl(bill.id, bill.firstAttachmentId)}
      alt={t('finance:payable.table.photoOf', { bill: bill.billNumber })}
      className="w-full h-full object-cover"
    />
  );

  const edge = !settled && late > 0 ? 'border-l-[#B3402A]' : !settled && late >= -1 ? 'border-l-[#F97316]' : 'border-l-transparent';
  const stop = { onClick: (e: React.MouseEvent) => e.stopPropagation(), onKeyDown: (e: React.KeyboardEvent) => e.stopPropagation() };
  // Phase 4: its payments are registered in QuickBooks and read back, so it
  // is neither paid nor batched from here — the button stays, off, and says why.
  const inQuickBooks = bill.paymentsInQuickBooks;
  const tick = onSelect && !settled && !inQuickBooks
    ? <LaneCheckbox checked={selected} onChange={onSelect} label={t('finance:payable.batch.selectOne', { vendor: bill.vendor })} />
    : <span className="block w-[15px]" />;
  const whyOff = inQuickBooks ? t('finance:paymentOrigin.registerInQuickBooks') : undefined;
  const payButton = !settled && (
    // A disabled button fires no hover, so the reason sits on its wrapper.
    <span title={whyOff} className="inline-flex">
      <button
        type="button"
        onClick={onPay}
        disabled={inQuickBooks}
        className={cn('bg-[#0A0A0A] text-[#F5F1E8] border-0 cursor-pointer px-3 py-2 font-bt-mono text-[10px] font-semibold uppercase tracking-[0.09em] transition-colors hover:bg-[#F97316] hover:text-[#0A0A0A] whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#0A0A0A] disabled:hover:text-[#F5F1E8]', FOCUS_RING)}
      >
        {t('finance:payable.action.pay')}
      </button>
    </span>
  );
  const dueBlock = settled
    ? <Mono className="text-[10px] tracking-[0.06em] text-[#A69C8D]">{t('common:status.paid')}</Mono>
    : <DueCell date={fmtDate(bill.dueDate, dateLocale)} days={late} />;
  const open = { role: 'button' as const, tabIndex: 0, onClick: onOpen,
    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } } };

  return (
    <>
      {/* Desktop: one row of the lane */}
      <div
        {...open}
        className={cn(
          ROW_GRID, 'hidden sm:grid px-5 py-2 border-b border-[#F0EBE1] last:border-b-0 border-l-2 cursor-pointer transition-colors hover:bg-[#FBF8F2]',
          edge, selected && 'bg-[#FBF8F2]', FOCUS_RING,
        )}
      >
        <span {...stop}>{tick}</span>
        <div className="min-w-0">
          <div className="text-[13.5px] font-semibold text-[#0A0A0A] truncate">{bill.vendor}</div>
          <Mono className="block text-[10px] text-[#A69C8D] mt-0.5 normal-case truncate">
            {bill.billNumber}{bill.status === 'partial' ? ` · ${t('common:status.partial')}` : ''}
          </Mono>
        </div>
        <Tag>{t(`finance:${CATEGORY_KEY_MAP[bill.category]}`)}</Tag>
        <Mono className="text-[10.5px] text-[#5A5346] truncate normal-case">{bill.project}</Mono>
        {dueBlock}
        <div className="text-right">
          <Amount className="block text-[13px] font-semibold" tone={settled ? 'quiet' : late > 0 ? 'red' : 'ink'}>{fmtMoney(balance)}</Amount>
          {bill.paidAmount > 0 && !settled && (
            <Mono className="block text-[9.5px] text-[#A69C8D] mt-[2px] normal-case">{t('finance:accounts.ofAmount', { amount: fmtMoney(bill.amount) })}</Mono>
          )}
        </div>
        <PhotoCell empty={photos === 0} count={photos} label={t('finance:payable.table.photoHint')}>{thumb}</PhotoCell>
        <div className="min-w-0">
          <Mono className={cn('block text-[10px] tracking-[0.07em]', bill.documentType === 'INVOICE' ? 'text-[#0A0A0A] font-semibold' : 'text-[#5A5346]')}>
            {bill.documentType === 'INVOICE' ? t('finance:payable.detail.docType.invoice') : t('finance:payable.detail.docType.bill')}
          </Mono>
          {bill.invoiceNumber && <Mono className="block text-[9.5px] text-[#A69C8D] mt-0.5 normal-case truncate">{bill.invoiceNumber}</Mono>}
        </div>
        <div className="justify-self-end" {...stop}>{payButton}</div>
      </div>

      {/* Phone: the same bill as a card — nothing scrolls sideways */}
      <div
        {...open}
        className={cn('sm:hidden px-3.5 py-3 border-b border-[#F0EBE1] last:border-b-0 border-l-2 cursor-pointer', edge, selected && 'bg-[#FBF8F2]', FOCUS_RING)}
      >
        <div className="flex items-start gap-2.5">
          <span {...stop} className="pt-1">{tick}</span>
          <PhotoCell empty={photos === 0} count={photos} label={t('finance:payable.table.photoHint')}>{thumb}</PhotoCell>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold text-[#0A0A0A] truncate">{bill.vendor}</div>
            <Mono className="block text-[9.5px] text-[#A69C8D] mt-0.5 normal-case truncate">
              {bill.billNumber} · {bill.project}
              {bill.invoiceNumber ? ` · ${bill.invoiceNumber}` : ''}
            </Mono>
          </div>
          <Tag className="flex-shrink-0">{t(`finance:${CATEGORY_KEY_MAP[bill.category]}`)}</Tag>
        </div>
        <div className="flex items-end justify-between gap-3 mt-2.5 pt-2.5 border-t border-[#F0EBE1]">
          <div className="min-w-0">
            <span className={cn('font-bt-display font-extrabold text-[26px] leading-[0.9] tabular-nums block', late > 0 && !settled && 'text-[#B3402A]')}>
              {fmtMoney(balance)}
            </span>
            {bill.paidAmount > 0 && !settled && (
              <Mono className="block text-[9.5px] text-[#A69C8D] mt-[3px] normal-case">{t('finance:accounts.ofAmount', { amount: fmtMoney(bill.amount) })}</Mono>
            )}
          </div>
          <div className="text-right flex-shrink-0">{dueBlock}</div>
        </div>
        {payButton && (
          <div className="mt-2.5" {...stop}>
            <button
              type="button"
              onClick={onPay}
              disabled={inQuickBooks}
              className={cn('w-full bg-[#0A0A0A] text-[#F5F1E8] border-0 cursor-pointer py-3.5 font-bt-mono text-[10.5px] font-semibold uppercase tracking-[0.09em] min-h-11 disabled:opacity-40 disabled:cursor-not-allowed', FOCUS_RING)}
            >
              {t('finance:payable.action.pay')}
            </button>
            {/* No hover on a phone: the reason is written under the button. */}
            {inQuickBooks && <RegisterInQuickBooksNote className="mt-1.5" />}
          </div>
        )}
      </div>
    </>
  );
}

/* ── One vendor, in the aging view ─────────────────────────────────────── */

function VendorRow({ row, open, onToggle, byId, today, dateLocale, selected, onSelect, onOpenBill, onPay }: {
  row: AgingRow;
  open: boolean;
  onToggle: () => void;
  byId: Map<number, VendorBill>;
  today: string;
  dateLocale: string;
  selected: Set<number>;
  onSelect?: (id: number) => void;
  onOpenBill: (id: number) => void;
  onPay: (b: VendorBill) => void;
}) {
  const { t } = useTranslation(['finance', 'common']);
  const bills = row.docs.map(d => byId.get(d.id)).filter((b): b is VendorBill => !!b);
  return (
    <AgingPartyRow
      row={row}
      open={open}
      onToggle={onToggle}
      subtitle={[row.projects.join(' · '), t('finance:payable.billCount', { count: row.docs.length })].filter(Boolean).join(' · ')}
      labels={{
        current: t('finance:receivable.aging.current'),
        d1_30: t('finance:receivable.aging.d1_30'),
        d31_60: t('finance:receivable.aging.d31_60'),
        d60plus: t('finance:receivable.aging.d60plus'),
      }}
    >
      {open && (
        <div className="bg-[#FBF8F2] border-l-2 border-l-[#F97316] border-b border-[#EDE7DB]">
          {bills.map(bill => (
            <BillRow
              key={bill.id}
              bill={bill}
              today={today}
              dateLocale={dateLocale}
              selected={selected.has(bill.id)}
              onSelect={onSelect ? () => onSelect(bill.id) : undefined}
              onOpen={() => onOpenBill(bill.id)}
              onPay={() => onPay(bill)}
            />
          ))}
        </div>
      )}
    </AgingPartyRow>
  );
}
