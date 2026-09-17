import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '../ui/utils';
import { FOCUS_RING, SecondaryButton } from '../onboarding/chrome';
import { Bone, EmptyWord, Mono, MonoSelect, stampDay } from '../projects/bt';
import { Amount, LoadFailure } from '../budgets/ui';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { fmtMoney } from '../invoices/bits';
import { paymentMethodLabel } from '../PayableCommon';
import { SignatureRequestPanel } from '../signatures/SignatureRequestPanel';
import { AuthService } from '../../services/auth';
import { listProjects } from '../../services/projects';
import { businessToday, currentMonth, currentMonthLabel, fmtDate } from '../../helpers/dateTime';
import {
  approveChangeOrder, downloadReceivableDocument, listAllPayables, listAllReceivables,
  voidReceivablePayment, type Receivable,
} from '../../services/finance';
import {
  agingByParty, agingTotals, balanceOf, cashBridge, daysLate, isBillable, isSettled, matches,
  payableToOwed, receivableFigures, receivablePayments, receivableToOwed, sumBalances,
  type AgingRow, type Owed,
} from './accounting';
import {
  AGING_GRID, AgingPartyRow, AgingTotalsRow, ContextLine, DirectionHeader, Figure, FigureChip, FiguresStrip, FilterBar,
  MENU_CONTENT, MENU_ITEM, MENU_ITEM_DANGER, MENU_LABEL, RowMenuButton, SearchField, Tag, ViewToggle,
} from './ui';
import { CollectDialog, DeleteReceivableDialog, EditInfoDialog, RejectChangeOrderDialog } from './ReceivableDialogs';

/**
 * Cobrar — the screen of money coming in.
 *
 * It answers one question, and its shape follows from it: *who owes me, how
 * much, and since when*. So it groups by client with an aging table, opens on
 * what is overdue, and the only verb on it is "cobrar". Its sibling Pagar
 * answers a different question and is built differently on purpose — the two
 * were indistinguishable before precisely because they shared a layout.
 *
 * What this screen deliberately does NOT do: issue invoices. That lives in
 * Facturas, with the tax, discount and document-type fields this screen never
 * had; the header links there instead of duplicating a worse copy of it.
 */

type ViewKey = 'clients' | 'docs';
type RangeKey = 'all' | 'month' | 'quarter' | 'year';

const DOC_GRID = 'grid grid-cols-[1.05fr_1.5fr_1.05fr_.95fr_1fr_1.5fr] gap-3 items-center';

export function ReceivablesScreen({ onNavigate }: { onNavigate?: (section: string) => void } = {}) {
  const { t, i18n } = useTranslation(['finance', 'common']);
  const lang = i18n.language;
  const dateLocale = lang.startsWith('es') ? 'es' : 'en-US';
  const today = businessToday();
  const month = currentMonth();
  const isAdmin = AuthService.getCanonicalRole() === 'ADMIN';
  const bodyId = useId();

  const [rows, setRows] = useState<Receivable[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingCos, setPendingCos] = useState<Receivable[]>([]);
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
  const [outflow, setOutflow] = useState<Owed[] | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [approving, setApproving] = useState<number | null>(null);
  const [downloading, setDownloading] = useState<number | null>(null);
  const [voiding, setVoiding] = useState<number | null>(null);

  const [view, setView] = useState<ViewKey>('clients');
  const [client, setClient] = useState('');
  const [projectId, setProjectId] = useState('');
  const [status, setStatus] = useState('');
  const [range, setRange] = useState<RangeKey>('all');
  const [search, setSearch] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [openParty, setOpenParty] = useState<string | null>(null);
  const [openDoc, setOpenDoc] = useState<number | null>(null);

  const [collectDoc, setCollectDoc] = useState<Receivable | null>(null);
  const [editDoc, setEditDoc] = useState<Receivable | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<Receivable | null>(null);
  const [rejectDoc, setRejectDoc] = useState<Receivable | null>(null);

  /* ── Data ───────────────────────────────────────────────────────────── */

  const load = useCallback(() => {
    // The list hides PENDING_APPROVAL unless it is asked for by name, so the
    // change orders awaiting the client come in a second, explicit query.
    Promise.all([listAllReceivables(), listAllReceivables({ status: 'pending_approval' })])
      .then(([all, pending]) => { setRows(all); setPendingCos(pending); setLoadError(null); })
      .catch((err: unknown) => setLoadError(err instanceof Error ? err.message : String(err)));
  }, []);

  useEffect(() => { load(); }, [load, reloadNonce]);

  useEffect(() => {
    listProjects({ page: 0, size: 200 })
      .then(r => setProjects(r.content.map(p => ({ id: p.id, name: p.name }))))
      .catch(() => toast.error(t('finance:accounts.catalogFailed')));
  }, [t]);

  // Only for the week's cash bridge: if it fails the strip simply does not
  // appear. A second screen's data may never take this one down with it.
  useEffect(() => {
    listAllPayables().then(ps => setOutflow(ps.map(payableToOwed))).catch(() => setOutflow(null));
  }, [reloadNonce]);

  /* ── Figures ────────────────────────────────────────────────────────── */

  const billable = useMemo(() => (rows ?? []).filter(isBillable), [rows]);
  const owed = useMemo(() => billable.map(receivableToOwed), [billable]);
  const figures = useMemo(
    () => receivableFigures(owed, receivablePayments(billable), today, month),
    [owed, billable, today, month],
  );
  const bridge = useMemo(
    () => (outflow ? cashBridge(owed, outflow, today) : null),
    [owed, outflow, today],
  );

  /* ── Filters ────────────────────────────────────────────────────────── */

  const rangeFrom = useMemo(() => {
    if (range === 'all') return null;
    const [y, m] = today.split('-').map(Number);
    if (range === 'month') return `${y}-${String(m).padStart(2, '0')}-01`;
    if (range === 'year') return `${y}-01-01`;
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 90);
    return d.toISOString().slice(0, 10);
  }, [range, today]);

  const filtered = useMemo(() => billable.filter(r => {
    if (client && r.client !== client) return false;
    if (projectId && String(r.projectId) !== projectId) return false;
    if (status && r.status.toLowerCase() !== status) return false;
    if (rangeFrom && r.issuedDate < rangeFrom) return false;
    if (overdueOnly && !(daysLate(r.dueDate, today) > 0 && !isSettled(receivableToOwed(r)))) return false;
    if (!matches([r.invoiceNumber, r.client, r.project, r.description], search)) return false;
    return true;
  }), [billable, client, projectId, status, rangeFrom, overdueOnly, search, today]);

  const filteredOwed = useMemo(() => filtered.map(receivableToOwed), [filtered]);
  const aging = useMemo(() => agingByParty(filteredOwed, today), [filteredOwed, today]);
  const totals = useMemo(() => agingTotals(aging), [aging]);
  const byId = useMemo(() => new Map(filtered.map(r => [r.id, r])), [filtered]);

  const docsFlat = useMemo(
    () => [...filtered].sort((a, b) => {
      const settled = Number(isSettled(receivableToOwed(a))) - Number(isSettled(receivableToOwed(b)));
      if (settled !== 0) return settled;
      return daysLate(b.dueDate, today) - daysLate(a.dueDate, today);
    }),
    [filtered, today],
  );

  const clients = useMemo(() => [...new Set(billable.map(r => r.client))].sort(), [billable]);
  const hasFilters = !!(client || projectId || status || search || overdueOnly || range !== 'all');
  const projectSubtotal = useMemo(
    () => (projectId ? sumBalances(filteredOwed.filter(d => !isSettled(d))) : null),
    [projectId, filteredOwed],
  );

  function clearFilters() {
    setClient(''); setProjectId(''); setStatus(''); setRange('all'); setSearch(''); setOverdueOnly(false);
  }

  /* ── Actions ────────────────────────────────────────────────────────── */

  const patchRow = useCallback((updated: Receivable) => {
    setRows(prev => (prev ? prev.map(r => (r.id === updated.id ? updated : r)) : prev));
  }, []);

  async function download(doc: Receivable) {
    setDownloading(doc.id);
    try {
      await downloadReceivableDocument(doc.id, { lang, filename: doc.invoiceNumber });
    } catch (err: unknown) {
      toast.error(t('finance:accounts.pdfFailed'), { description: err instanceof Error ? err.message : undefined });
    } finally {
      setDownloading(null);
    }
  }

  async function approve(doc: Receivable) {
    setApproving(doc.id);
    try {
      await approveChangeOrder(doc.id);
      toast.success(t('finance:receivable.co.approved'), { description: `${doc.invoiceNumber} — ${doc.client}` });
      setReloadNonce(n => n + 1);
    } catch (err: unknown) {
      toast.error(t('finance:receivable.co.approveFailed'), { description: err instanceof Error ? err.message : undefined });
    } finally {
      setApproving(null);
    }
  }

  /**
   * Void a collection. The server answers with the document already recalculated
   * — balance, status and the payment now struck through — so the row is patched
   * from that answer instead of reloading the whole screen.
   */
  async function voidCollection(doc: Receivable, paymentId: number) {
    setVoiding(paymentId);
    try {
      const updated = await voidReceivablePayment(doc.id, paymentId);
      setRows(prev => (prev ? prev.map(r => (r.id === updated.id ? updated : r)) : prev));
      toast.success(t('finance:receivable.void.done'));
    } catch (err: unknown) {
      toast.error(t('finance:receivable.void.failed'), { description: err instanceof Error ? err.message : undefined });
    } finally {
      setVoiding(null);
    }
  }

  /* ── Render ─────────────────────────────────────────────────────────── */

  const loading = rows === null && !loadError;
  const figure = (v: string) => (loading || loadError ? '—' : v);

  return (
    <div className="space-y-3.5">
      <DirectionHeader
        direction="in"
        eyebrow={t('finance:receivable.eyebrow')}
        title={t('finance:receivable.h1')}
        purpose={t('finance:receivable.purpose')}
        tourAnchor="sec.accounts-receivable.header"
        aside={
          <>
            <Mono className="text-[11px] tracking-[0.1em] text-[#0A0A0A]">
              {t('finance:accounts.todayStamp', { date: stampDay(today, lang) })}
            </Mono>
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('invoices')}
                className={cn('inline-flex items-center gap-2 border border-[#DBD0BB] bg-white px-3 py-2.5 font-bt-mono text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[#0A0A0A] transition-colors hover:border-[#F97316] hover:text-[#C2410C]', FOCUS_RING)}
              >
                {t('finance:receivable.issue')} <span className="text-[#C2410C]">→ {t('finance:receivable.issueTarget')}</span>
              </button>
            )}
            <Mono className="text-[10px] tracking-[0.09em] text-[#A69C8D]">{t('finance:receivable.issueHint')}</Mono>
          </>
        }
      />

      {/* The three figures, and the line that reconciles them out loud. */}
      <div>
        <FiguresStrip direction="in">
          <Figure
            tourAnchor="sec.accounts-receivable.overdue"
            label={t('finance:receivable.fig.overdue')}
            value={figure(fmtMoney(figures.overdue.amount))}
            tone="orange"
            sheet="sand"
            chip={!loading && !loadError && figures.overdue.count > 0
              ? <FigureChip>{t('finance:receivable.fig.overdueCount', { count: figures.overdue.count })}</FigureChip>
              : undefined}
            meta={figures.oldestOverdueDays > 0 ? t('finance:receivable.fig.oldest', { count: figures.oldestOverdueDays }) : undefined}
            onClick={rows ? () => { setOverdueOnly(v => !v); setOpenParty(null); } : undefined}
            pressed={overdueOnly}
          />
          <Figure
            label={t('finance:receivable.fig.notYetDue')}
            value={figure(fmtMoney(figures.notYetDue.amount))}
            meta={t('finance:receivable.fig.notYetDueMeta', { count: figures.notYetDue.count })}
          />
          <Figure
            label={t('finance:receivable.fig.collected')}
            value={figure(fmtMoney(figures.collected.amount))}
            tone="green"
            meta={t('finance:receivable.fig.collectedMeta', { count: figures.collected.count, month: currentMonthLabel(dateLocale) })}
          />
        </FiguresStrip>
        <ContextLine aside={pendingCos.length > 0 ? t('finance:receivable.context.coNotCounted') : undefined}>
          {projectSubtotal != null
            ? <>{projects.find(p => String(p.id) === projectId)?.name} <b className="text-[#0A0A0A]">{fmtMoney(projectSubtotal)}</b> · {t('finance:receivable.context.ofTotal', { total: fmtMoney(figures.total) })}</>
            : <>{t('finance:receivable.context.total')} <b className="text-[#0A0A0A]">{figure(fmtMoney(figures.total))}</b></>}
        </ContextLine>
        {bridge && !loadError && (
          <div className="flex items-center gap-2 flex-wrap bg-white border border-[#E7E1D5] border-t-0 px-5 py-1.5">
            <Mono className="text-[10.5px] tracking-[0.08em] text-[#8A8175]">{t('finance:accounts.bridge.week')}</Mono>
            <Mono className="text-[10.5px] tracking-[0.08em] text-[#5A5346]">
              {t('finance:accounts.bridge.in')} <b className="text-[#0A0A0A] normal-case">{fmtMoney(bridge.inbound.amount)}</b> · {t('finance:receivable.docCount', { count: bridge.inbound.count })}
            </Mono>
            <span className="text-[#CDBFA6]">·</span>
            <Mono className="text-[10.5px] tracking-[0.08em] text-[#5A5346]">
              {t('finance:accounts.bridge.out')} <b className="text-[#0A0A0A] normal-case">{fmtMoney(bridge.outbound.amount)}</b> · {t('finance:payable.billCount', { count: bridge.outbound.count })}
            </Mono>
            <span className="text-[#CDBFA6]">·</span>
            <Mono className={cn('text-[10.5px] tracking-[0.08em] font-semibold', bridge.net < 0 ? 'text-[#B3402A]' : 'text-[#2E7D4F]')}>
              {t('finance:accounts.bridge.net')} <span className="normal-case">{bridge.net < 0 ? '−' : '+'}{fmtMoney(Math.abs(bridge.net))}</span>
            </Mono>
            {onNavigate && (
              <button type="button" onClick={() => onNavigate('accounts-payable')}
                className={cn('ml-auto font-bt-mono text-[10px] uppercase tracking-[0.1em] text-[#C2410C] hover:text-[#F97316] cursor-pointer', FOCUS_RING)}>
                {t('finance:accounts.bridge.seePayables')} →
              </button>
            )}
          </div>
        )}
      </div>

      {/* Change orders the client has not approved: not receivable, and said so. */}
      {pendingCos.length > 0 && !loadError && (
        <div className="bg-white border border-[#E7E1D5] border-l-[3px] border-l-[#F97316]">
          {pendingCos.length > 1 && (
            <div className="flex items-center gap-2.5 px-4 py-2 border-b border-[#EDE7DB] bg-[#FBF8F2]">
              <Mono className="text-[10px] font-semibold tracking-[0.12em] text-[#C2410C]">{t('finance:receivable.co.pending')}</Mono>
              <Mono className="ml-auto text-[10.5px] tracking-[0.08em] text-[#5A5346] normal-case">
                {t('finance:receivable.co.count', { count: pendingCos.length })} · {fmtMoney(pendingCos.reduce((s, c) => s + c.amount, 0))}
              </Mono>
            </div>
          )}
          {pendingCos.map(co => (
            <div key={co.id} className="flex items-center gap-4 flex-wrap px-4 py-2 border-b border-[#F0EBE1] last:border-b-0">
              <div className="flex-shrink-0">
                {pendingCos.length === 1 && (
                  <Mono className="block text-[10px] font-semibold tracking-[0.11em] text-[#C2410C]">{t('finance:receivable.co.pending')}</Mono>
                )}
                <Mono className="block text-[12.5px] font-semibold normal-case text-[#0A0A0A] mt-1">{co.invoiceNumber}</Mono>
              </div>
              <div className="min-w-0">
                <div className="text-[13.5px] font-semibold text-[#0A0A0A] truncate">{co.client}</div>
                <Mono className="block text-[10px] tracking-[0.05em] text-[#A69C8D] mt-0.5 truncate">
                  {co.project} · {t('finance:receivable.co.issued', { date: fmtDate(co.issuedDate, dateLocale) })}
                </Mono>
              </div>
              <span className="font-bt-display font-extrabold text-[26px] leading-none tabular-nums">{fmtMoney(co.amount)}</span>
              <p className="text-[12.5px] leading-[1.45] text-[#5A5346] max-w-[260px] hidden lg:block">{t('finance:receivable.co.explain')}</p>
              <div className="flex items-center gap-2 ml-auto flex-shrink-0 flex-wrap">
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => void approve(co)}
                    disabled={approving === co.id}
                    className={cn('bg-[#F97316] text-[#0A0A0A] border-0 cursor-pointer px-3.5 py-2.5 font-bt-mono text-[10.5px] font-semibold uppercase tracking-[0.1em] transition-colors hover:bg-[#C2410C] hover:text-[#F5F1E8] disabled:opacity-50', FOCUS_RING)}
                  >
                    {approving === co.id ? t('common:buttons.approving') : t('finance:receivable.co.approve')}
                  </button>
                )}
                <SecondaryButton onClick={() => void download(co)} className="bg-white">
                  {downloading === co.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : t('finance:accounts.pdf')}
                </SecondaryButton>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setRejectDoc(co)}
                    className={cn('border border-[#DBD0BB] bg-white cursor-pointer px-3 py-2.5 font-bt-mono text-[10.5px] uppercase tracking-[0.09em] text-[#B3402A] transition-colors hover:border-[#B3402A]', FOCUS_RING)}
                  >
                    {t('finance:receivable.reject.action')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters: one line, and the search where the dead "overdue" chip was. */}
      <FilterBar>
        <ViewToggle
          value={view}
          onChange={v => { setView(v); setOpenParty(null); }}
          bodyId={bodyId}
          label={t('finance:receivable.view.label')}
          tourAnchor="sec.accounts-receivable.views"
          options={[
            { key: 'clients', label: t('finance:receivable.view.byClient') },
            { key: 'docs', label: t('finance:receivable.view.byDocument') },
          ]}
        />
        <MonoSelect value={client} onChange={e => setClient(e.target.value)} aria-label={t('finance:receivable.filter.client')} className="text-[10px] py-2">
          <option value="">{t('finance:receivable.filter.allClients')}</option>
          {clients.map(c => <option key={c} value={c}>{c}</option>)}
        </MonoSelect>
        <MonoSelect value={projectId} onChange={e => setProjectId(e.target.value)} aria-label={t('common:labels.project')} className="text-[10px] py-2">
          <option value="">{t('common:labels.allProjects')}</option>
          {projects.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
        </MonoSelect>
        <MonoSelect
          value={status}
          onChange={e => { setStatus(e.target.value); if (e.target.value === 'paid') setView('docs'); }}
          aria-label={t('common:labels.status')}
          className="text-[10px] py-2"
        >
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
          {view === 'clients'
            ? t('finance:receivable.countLine', { clients: aging.length, docs: filtered.length })
            : t('finance:receivable.docCount', { count: docsFlat.length })}
        </Mono>
      </FilterBar>

      {/* The list */}
      <div id={bodyId} data-tour="sec.accounts-receivable.rows" className="bg-white border border-[#E7E1D5]">
        {loadError && (
          <div data-testid="accounts-receivable-load-error" className="p-3.5">
            <LoadFailure
              title={t('finance:receivable.loadError.title')}
              body={t('finance:receivable.loadError.body')}
              code={loadError}
              onRetry={() => { setLoadError(null); setReloadNonce(n => n + 1); }}
            />
          </div>
        )}

        {loading && (
          <div aria-hidden="true">
            <div className={cn(AGING_GRID, 'px-5 py-2.5 border-b border-[#EDE7DB] bg-[#FBF8F2]')}>
              {Array.from({ length: 7 }).map((_, i) => <Bone key={i} className="h-2.5" />)}
            </div>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={cn(AGING_GRID, 'px-5 py-4 border-b border-[#F0EBE1]')}>
                <Bone className="w-[70%] h-3.5" />
                {Array.from({ length: 6 }).map((__, j) => <Bone key={j} className="h-3" />)}
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
                word={t('finance:receivable.empty.word')}
                title={t('finance:receivable.empty.title')}
                hint={t('finance:receivable.empty.hint')}
                action={onNavigate
                  ? <SecondaryButton onClick={() => onNavigate('invoices')} className="bg-[#FAF7F0]">{t('finance:receivable.issue')} →</SecondaryButton>
                  : undefined}
              />
        )}

        {!loading && !loadError && filtered.length > 0 && view === 'clients' && (
          <>
            <div className={cn(AGING_GRID, 'hidden sm:grid px-5 py-2.5 border-b border-[#0A0A0A] bg-[#FBF8F2] font-bt-mono text-[10px] uppercase tracking-[0.12em] text-[#8A8175]')}>
              <span>{t('finance:receivable.aging.client')}</span>
              <span className="text-right">{t('finance:receivable.aging.current')}</span>
              <span className="text-right text-[#C2410C]">{t('finance:receivable.aging.d1_30')}</span>
              <span className="text-right">{t('finance:receivable.aging.d31_60')}</span>
              <span className="text-right">{t('finance:receivable.aging.d60plus')}</span>
              <span className="text-right text-[#0A0A0A]">{t('finance:receivable.aging.total')}</span>
              <span />
            </div>
            {aging.map(row => (
              <ClientRow
                key={row.party}
                row={row}
                open={openParty === row.party}
                onToggle={() => setOpenParty(p => (p === row.party ? null : row.party))}
                byId={byId}
                openDoc={openDoc}
                onToggleDoc={id => setOpenDoc(d => (d === id ? null : id))}
                onCollect={setCollectDoc}
                onEdit={setEditDoc}
                onDelete={setDeleteDoc}
                onDownload={download}
                onVoid={(d, paymentId) => void voidCollection(d, paymentId)}
                downloading={downloading}
                voiding={voiding}
                today={today}
                dateLocale={dateLocale}
              />
            ))}
            <AgingTotalsRow
              label={t('finance:receivable.aging.totalRow', { count: aging.length })}
              totals={totals}
              labels={{ current: t('finance:receivable.aging.current'), overdue: t('finance:receivable.fig.overdue') }}
            />
          </>
        )}

        {!loading && !loadError && filtered.length > 0 && view === 'docs' && (
          <>
            <div className={cn(DOC_GRID, 'hidden sm:grid px-5 py-2.5 border-b border-[#0A0A0A] bg-[#FBF8F2] font-bt-mono text-[10px] uppercase tracking-[0.12em] text-[#8A8175]')}>
              <span>{t('finance:receivable.doc.number')}</span>
              <span>{t('finance:receivable.doc.client')}</span>
              <span>{t('finance:receivable.doc.due')}</span>
              <span className="text-right">{t('finance:accounts.balance')}</span>
              <span>{t('finance:receivable.doc.signature')}</span>
              <span className="text-right">{t('common:labels.actions')}</span>
            </div>
            {docsFlat.map(doc => (
              <DocumentRow
                key={doc.id}
                doc={doc}
                showClient
                open={openDoc === doc.id}
                onToggle={() => setOpenDoc(d => (d === doc.id ? null : doc.id))}
                onCollect={setCollectDoc}
                onEdit={setEditDoc}
                onDelete={setDeleteDoc}
                onDownload={download}
                onVoid={(d, paymentId) => void voidCollection(d, paymentId)}
                downloading={downloading}
                voiding={voiding}
                today={today}
                dateLocale={dateLocale}
              />
            ))}
          </>
        )}
      </div>

      <CollectDialog
        doc={collectDoc}
        onClose={() => setCollectDoc(null)}
        onCollected={patchRow}
        clientOverdue={collectDoc ? (aging.find(a => a.party === collectDoc.client)?.overdue ?? 0) : 0}
      />
      <EditInfoDialog doc={editDoc} onClose={() => setEditDoc(null)} onSaved={patchRow} />
      <DeleteReceivableDialog doc={deleteDoc} onClose={() => setDeleteDoc(null)} onDeleted={() => setReloadNonce(n => n + 1)} />
      <RejectChangeOrderDialog doc={rejectDoc} onClose={() => setRejectDoc(null)} onRejected={() => setReloadNonce(n => n + 1)} />
    </div>
  );
}

/* ── One client, and the documents under it ────────────────────────────── */

function ClientRow({ row, open, onToggle, byId, openDoc, onToggleDoc, onCollect, onEdit, onDelete, onDownload, onVoid, downloading, voiding, today, dateLocale }: {
  row: AgingRow;
  open: boolean;
  onToggle: () => void;
  byId: Map<number, Receivable>;
  openDoc: number | null;
  onToggleDoc: (id: number) => void;
  onCollect: (d: Receivable) => void;
  onEdit: (d: Receivable) => void;
  onDelete: (d: Receivable) => void;
  onDownload: (d: Receivable) => void;
  onVoid: (d: Receivable, paymentId: number) => void;
  downloading: number | null;
  voiding: number | null;
  today: string;
  dateLocale: string;
}) {
  const { t } = useTranslation(['finance', 'common']);
  const docs = row.docs.map(d => byId.get(d.id)).filter((d): d is Receivable => !!d);

  return (
    <AgingPartyRow
      row={row}
      open={open}
      onToggle={onToggle}
      subtitle={[row.projects.join(' · '), t('finance:receivable.docCount', { count: row.docs.length })].filter(Boolean).join(' · ')}
      labels={{
        current: t('finance:receivable.aging.current'),
        d1_30: t('finance:receivable.aging.d1_30'),
        d31_60: t('finance:receivable.aging.d31_60'),
        d60plus: t('finance:receivable.aging.d60plus'),
      }}
    >
      {open && (
        <div className="bg-[#FBF8F2] border-l-2 border-l-[#F97316] border-b border-[#EDE7DB] px-3.5 sm:px-5 pb-3">
          <div className={cn(DOC_GRID, 'hidden sm:grid py-2 border-b border-[#E7E1D5] font-bt-mono text-[10px] uppercase tracking-[0.11em] text-[#A69C8D]')}>
            <span>{t('finance:receivable.doc.number')}</span>
            <span>{t('finance:receivable.doc.projectAndType')}</span>
            <span>{t('finance:receivable.doc.due')}</span>
            <span className="text-right">{t('finance:accounts.balance')}</span>
            <span>{t('finance:receivable.doc.signature')}</span>
            <span className="text-right">{t('common:labels.actions')}</span>
          </div>
          {docs.map(doc => (
            <DocumentRow
              key={doc.id}
              doc={doc}
              open={openDoc === doc.id}
              onToggle={() => onToggleDoc(doc.id)}
              onCollect={onCollect}
              onEdit={onEdit}
              onDelete={onDelete}
              onDownload={onDownload}
              onVoid={onVoid}
              downloading={downloading}
              voiding={voiding}
              today={today}
              dateLocale={dateLocale}
              inset
            />
          ))}
        </div>
      )}
    </AgingPartyRow>
  );
}

/* ── One document ──────────────────────────────────────────────────────── */

function DocumentRow({ doc, open, onToggle, onCollect, onEdit, onDelete, onDownload, onVoid, downloading, voiding, today, dateLocale, showClient, inset }: {
  doc: Receivable;
  open: boolean;
  onToggle: () => void;
  onCollect: (d: Receivable) => void;
  onEdit: (d: Receivable) => void;
  onDelete: (d: Receivable) => void;
  onDownload: (d: Receivable) => void;
  onVoid: (d: Receivable, paymentId: number) => void;
  downloading: number | null;
  voiding: number | null;
  today: string;
  dateLocale: string;
  showClient?: boolean;
  inset?: boolean;
}) {
  const { t } = useTranslation(['finance', 'common']);
  const owedDoc = receivableToOwed(doc);
  const balance = balanceOf(owedDoc);
  const settled = isSettled(owedDoc);
  const late = daysLate(doc.dueDate, today);
  const isCo = doc.documentType === 'CHANGE_ORDER_REQUEST';
  // Only collections still standing block the delete: the server stopped
  // counting the voided ones, so blocking on them would be stricter than it.
  const hasPayments = doc.payments.some(p => !p.voided);

  const chevron = open
    ? <ChevronDown className="w-3 h-3 text-[#C2410C] flex-shrink-0" strokeWidth={2.4} />
    : <ChevronRight className="w-3 h-3 text-[#8A8175] flex-shrink-0" strokeWidth={2.4} />;
  const kind = [isCo ? t('finance:receivable.doc.changeOrder') : t('finance:receivable.doc.invoice'),
    doc.status === 'partial' ? t('common:status.partial') : null].filter(Boolean).join(' · ');

  const due = settled
    ? <Mono className="text-[10px] tracking-[0.06em] text-[#A69C8D]">{t('finance:receivable.doc.settledOn', { date: fmtDate(doc.dueDate, dateLocale) })}</Mono>
    : (
      <div className="min-w-0">
        <Mono className={cn('block text-[11px] font-semibold normal-case', late > 0 ? 'text-[#B3402A]' : 'text-[#0A0A0A]')}>
          {late > 0 ? t('finance:accounts.due.expiredOn', { date: fmtDate(doc.dueDate, dateLocale) }) : fmtDate(doc.dueDate, dateLocale)}
        </Mono>
        <Mono className={cn('block text-[10px] tracking-[0.06em] mt-[2px]', late > 0 ? 'text-[#B3402A]' : 'text-[#A69C8D]')}>
          {late > 0 ? t('finance:accounts.due.daysLate', { count: late })
            : late === 0 ? t('finance:accounts.due.today')
            : t('finance:accounts.due.inDays', { count: -late })}
        </Mono>
      </div>
    );

  const collect = !settled && (
    <button
      type="button"
      onClick={() => onCollect(doc)}
      className={cn('bg-[#F97316] text-[#0A0A0A] border-0 cursor-pointer px-3 py-2 font-bt-mono text-[10px] font-semibold uppercase tracking-[0.09em] transition-colors hover:bg-[#C2410C] hover:text-[#F5F1E8] whitespace-nowrap', FOCUS_RING)}
    >
      {t('finance:receivable.action.collect')}
    </button>
  );
  const pdf = (
    <button
      type="button"
      onClick={() => onDownload(doc)}
      title={t('finance:accounts.pdf')}
      className={cn('border border-[#DBD0BB] bg-white cursor-pointer px-2.5 py-2 font-bt-mono text-[10px] uppercase tracking-[0.08em] text-[#0A0A0A] transition-colors hover:border-[#F97316] hover:text-[#C2410C]', FOCUS_RING)}
    >
      {downloading === doc.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : t('finance:accounts.pdf')}
    </button>
  );
  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <RowMenuButton label={t('common:labels.actions')} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={MENU_CONTENT}>
        <DropdownMenuLabel className={MENU_LABEL}>{doc.invoiceNumber} · {fmtMoney(doc.amount)}</DropdownMenuLabel>
        <DropdownMenuItem className={MENU_ITEM} onClick={() => onEdit(doc)}>
          <Pencil className="w-3 h-3 mr-2" />{t('finance:receivable.action.editInfo')}
        </DropdownMenuItem>
        <DropdownMenuItem
          className={cn(MENU_ITEM_DANGER, 'border-t border-t-[#EDE7DB]')}
          disabled={hasPayments}
          onClick={() => { if (!hasPayments) onDelete(doc); }}
        >
          <Trash2 className="w-3 h-3 mr-2" />
          {hasPayments ? t('finance:receivable.action.deleteBlocked') : t('finance:receivable.action.delete')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <>
      {/* Desktop */}
      <div
        className={cn(
          DOC_GRID, 'hidden sm:grid py-1.5 border-b border-[#F0EBE1] last:border-b-0 transition-colors',
          inset ? 'bg-transparent' : 'px-5 border-l-2',
          !inset && (late > 0 && !settled ? 'border-l-[#B3402A]' : 'border-l-transparent hover:border-l-[#F97316]'),
          !inset && 'hover:bg-[#FBF8F2]',
          inset && late > 0 && !settled && 'bg-white border-l-2 border-l-[#B3402A] pl-3 -ml-3',
        )}
      >
        <button type="button" onClick={onToggle} aria-expanded={open}
          className={cn('flex items-center gap-1.5 text-left min-w-0 cursor-pointer', FOCUS_RING)}>
          {chevron}
          <Mono className="text-[12.5px] font-semibold normal-case text-[#0A0A0A] truncate">{doc.invoiceNumber}</Mono>
        </button>
        <div className="min-w-0">
          <div className="text-[13px] text-[#0A0A0A] truncate">{showClient ? doc.client : doc.project}</div>
          <Mono className="block text-[10px] tracking-[0.08em] text-[#A69C8D] mt-0.5 truncate">
            {[showClient ? doc.project : null, kind].filter(Boolean).join(' · ')}
          </Mono>
        </div>
        {due}
        <div className="text-right">
          <Amount className="block text-[13px] font-semibold" tone={settled ? 'quiet' : late > 0 ? 'red' : 'ink'}>{fmtMoney(balance)}</Amount>
          {doc.paidAmount > 0 && !settled && (
            <Mono className="block text-[9.5px] text-[#A69C8D] mt-[2px] normal-case">{t('finance:accounts.ofAmount', { amount: fmtMoney(doc.amount) })}</Mono>
          )}
        </div>
        <SignatureCell doc={doc} />
        <div className="flex items-center gap-1.5 justify-self-end">{collect}{pdf}{menu}</div>
      </div>

      {/* Phone */}
      <div className={cn('sm:hidden py-2.5 border-b border-[#F0EBE1] last:border-b-0',
        !inset && 'px-3.5',
        inset && late > 0 && !settled && 'bg-white border-l-2 border-l-[#B3402A] pl-2.5 -ml-2.5')}>
        <button type="button" onClick={onToggle} aria-expanded={open}
          className={cn('w-full flex items-start gap-2 text-left cursor-pointer', FOCUS_RING)}>
          {chevron}
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2.5">
              <Mono className="text-[12px] font-semibold normal-case text-[#0A0A0A] truncate">{doc.invoiceNumber}</Mono>
              <Amount className="text-[13px] font-semibold flex-shrink-0" tone={settled ? 'quiet' : late > 0 ? 'red' : 'ink'}>
                {fmtMoney(balance)}
              </Amount>
            </div>
            <Mono className="block text-[9.5px] tracking-[0.06em] text-[#A69C8D] mt-[3px] truncate">
              {[showClient ? doc.client : doc.project, kind].filter(Boolean).join(' · ')}
            </Mono>
            <div className="mt-1.5">{due}</div>
          </div>
        </button>
        <div className="flex items-center gap-1.5 mt-2.5">
          {collect && <div className="flex-1 [&>button]:w-full [&>button]:py-3 [&>button]:min-h-11">{collect}</div>}
          <div className="[&>button]:min-h-11 [&>button]:px-3.5">{pdf}</div>
          <div className="[&>button]:w-11 [&>button]:h-11">{menu}</div>
        </div>
      </div>

      {open && <DocumentDetail doc={doc} dateLocale={dateLocale} onVoid={onVoid} voiding={voiding} />}
    </>
  );
}

/**
 * The signature cell.
 *
 * The list endpoint does not carry the signature state today — it is one call
 * per document — so the chip appears only when the server starts sending
 * `signatureStatus` on the row. Until then the cell says where the answer is
 * instead of firing N requests to fill a column.
 */
function SignatureCell({ doc }: { doc: Receivable }) {
  const { t } = useTranslation('finance');

  // Two different silences, and they must not look the same: a server that does
  // not report the state at all leaves the field out, and the cell says so with
  // a dash that points at the document. A server that reports it sends null when
  // the signature was never asked for, and that is a state with a name.
  if (!('signatureStatus' in doc)) {
    return (
      <span title={t('receivable.signature.inDetail')}>
        <Mono className="text-[10px] tracking-[0.06em] text-[#A69C8D]">{t('receivable.signature.dash')}</Mono>
      </span>
    );
  }
  const map: Record<string, { tone: 'outline' | 'orangeDashed' | 'green' | 'red'; key: string }> = {
    PENDING: { tone: 'orangeDashed', key: 'requested' },
    SIGNED: { tone: 'green', key: 'signed' },
    DECLINED: { tone: 'red', key: 'declined' },
    REVOKED: { tone: 'outline', key: 'revoked' },
  };
  const look = doc.signatureStatus ? map[doc.signatureStatus] : { tone: 'outline' as const, key: 'none' };
  return <Tag tone={look.tone}>{t(`receivable.signature.${look.key}`)}</Tag>;
}

/** Line items, collections and the customer's signature — the document itself. */
function DocumentDetail({ doc, dateLocale, onVoid, voiding }: {
  doc: Receivable;
  dateLocale: string;
  onVoid: (d: Receivable, paymentId: number) => void;
  voiding: number | null;
}) {
  const { t } = useTranslation(['finance', 'common']);
  const balance = balanceOf(receivableToOwed(doc));
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_1.1fr] bg-white border border-[#E7E1D5] my-1.5">
      <div className="border-b lg:border-b-0 lg:border-r border-[#EDE7DB] p-4">
        {doc.lineItems.length > 0 && (
          <>
            <Mono className="block text-[9.5px] tracking-[0.13em] text-[#8A8175]">
              {t('finance:receivable.detail.items', { count: doc.lineItems.length })}
            </Mono>
            <div className="mt-2">
              {doc.lineItems.map(li => (
                <div key={li.id} className="grid grid-cols-[1fr_52px_96px] gap-2.5 items-center py-2 border-b border-[#F0EBE1]">
                  <span className="text-[13px] text-[#0A0A0A] truncate">{li.description}</span>
                  <Mono className="text-[11.5px] text-[#5A5346] text-center normal-case">{li.quantity} ×</Mono>
                  <Amount>{fmtMoney(li.subtotal)}</Amount>
                </div>
              ))}
              <div className="grid grid-cols-[1fr_148px] gap-2.5 pt-2.5">
                <Mono className="text-[10px] tracking-[0.11em] font-semibold">{t('finance:receivable.detail.invoiced')}</Mono>
                <Amount className="text-[13.5px] font-semibold">{fmtMoney(doc.amount)}</Amount>
              </div>
            </div>
          </>
        )}
        <div className={cn(doc.lineItems.length > 0 && 'mt-4 pt-3.5 border-t border-[#EDE7DB]')}>
          <Mono className="block text-[9.5px] tracking-[0.13em] text-[#8A8175]">
            {t('finance:receivable.detail.collections', { count: doc.payments.length })}
          </Mono>
          {doc.payments.length === 0 ? (
            <p className="text-[12.5px] text-[#8A8175] mt-2">{t('finance:receivable.detail.noCollections')}</p>
          ) : (
            <div className="mt-2 space-y-2">
              {doc.payments.map(p => (
                <div
                  key={p.id}
                  className={cn('flex items-center gap-3 flex-wrap bg-[#FAF7F0] border-l-2 px-3 py-2.5', p.voided ? 'border-l-[#CDBFA6]' : 'border-l-[#2E7D4F]')}
                >
                  <Mono className={cn('text-[13px] font-semibold normal-case tabular-nums', p.voided && 'text-[#8A8175] line-through')}>
                    {fmtMoney(p.amount)}
                  </Mono>
                  <div className="min-w-0">
                    <Mono className={cn('block text-[10.5px] normal-case', p.voided ? 'text-[#8A8175] line-through' : 'text-[#5A5346]')}>
                      {fmtDate(p.date, dateLocale)} · {paymentMethodLabel(p.method, t)}
                    </Mono>
                    {p.voided
                      ? (
                        <Mono className="block text-[9.5px] text-[#B3402A] mt-0.5 normal-case">
                          {t('finance:receivable.void.voided')}{p.voidReason ? ` · ${p.voidReason}` : ''}
                        </Mono>
                      )
                      : p.reference && <Mono className="block text-[9.5px] text-[#A69C8D] mt-0.5 normal-case">{p.reference}</Mono>}
                  </div>
                  {p.voided
                    ? <Tag tone="red" className="ml-auto">{t('finance:receivable.void.voided')}</Tag>
                    : (
                      <button
                        type="button"
                        disabled={voiding != null}
                        onClick={() => onVoid(doc, p.id)}
                        className={cn('ml-auto font-bt-mono text-[9.5px] uppercase tracking-[0.09em] text-[#C2410C] hover:text-[#B3402A] disabled:opacity-40 disabled:cursor-default', FOCUS_RING)}
                      >
                        {voiding === p.id ? t('finance:receivable.void.voiding') : t('finance:receivable.void.action')}
                      </button>
                    )}
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between gap-2.5 mt-3">
            <Mono className="text-[10.5px] tracking-[0.08em] text-[#5A5346]">{t('finance:receivable.detail.stillOwed')}</Mono>
            <Amount className="text-[13px] font-semibold">{fmtMoney(balance)}</Amount>
          </div>
        </div>
        {doc.notes && (
          <p className="text-[12.5px] leading-[1.5] text-[#5A5346] mt-3.5 pt-3 border-t border-[#EDE7DB]">{doc.notes}</p>
        )}
      </div>
      <div className="p-4">
        <SignatureRequestPanel receivableId={doc.id} />
      </div>
    </div>
  );
}
