import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronLeft, ChevronRight, Download, FileText, MoreVertical, Plus, RefreshCw,
} from 'lucide-react';

import { cn } from './ui/utils';
import { ApiError } from '../lib/api';
import { businessToday } from '../helpers/dateTime';
import { FOCUS_RING, SecondaryButton } from './onboarding/chrome';
import { Bone, CreateButton, EmptyWord, Mono, MonoSelect, PaperNote, stampDay } from './projects/bt';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  listReceivables, type PageResponse, type Receivable,
} from '../services/finance';
import { listProjects } from '../services/projects';
import { loadInvoiceIssuer } from '../services/invoiceBranding';
import { downloadInvoicePdf, type InvoicePdfData } from '../helpers/exportInvoicePdf';
import { loadSignatureForPdf } from '../services/signatures';
import { CellEmpty, DocTypeChip, InvoiceStatusChip, fmtMoney } from './invoices/bits';
import { InvoiceWindow } from './invoices/InvoiceWindow';

/**
 * Facturas — the list, and the window that issues a document.
 *
 * The section was called "Facturas" and showed none: it was the create form,
 * and saving replaced the whole screen with a success card that pointed at
 * another section. `GET /finance/receivables` has always paged and filtered,
 * so the list it never had is the list the server was already serving.
 *
 * Two things the server does that this screen has to be honest about, both
 * checked against `origin/main` of the API:
 *
 *  1. **Unapproved change orders are hidden unless you ask for them.** The
 *     repository's query ends with `(:status IS NOT NULL OR r.status <>
 *     PENDING_APPROVAL)`, so an unfiltered list — and a list filtered only by
 *     jobsite or type — silently omits every change order still waiting for
 *     the client's sign-off. The note under the filters says so, and one of
 *     the three figures counts them and jumps straight to them.
 *  2. **"Overdue" is not a stored state.** ReceivableServiceImpl derives it
 *     on read from the due date, so it arrives correctly on each row but
 *     `?status=OVERDUE` matches nothing in the database. It is therefore a
 *     chip, never a filter — offering it would have been a filter that always
 *     came back empty.
 *
 * The three figures are counts the server computed (`totalElements` of a
 * filtered query), never a sum over the loaded page: this panel has already
 * shipped page-local totals that read as tenant-wide and were wrong. The
 * amounts the design asks for — issued this month, receivable, overdue — need
 * the billing-summary endpoint that does not exist yet.
 */

const PAGE_SIZES = [20, 50, 100] as const;
const ROW_GRID = 'grid grid-cols-[1.1fr_1.05fr_2fr_1.15fr_.9fr_.9fr_1.2fr_40px] gap-3.5 items-center';
const FLASH_MS = 2200;

/** Statuses the server can actually filter on — see the note above about OVERDUE. */
const STATUSES = ['PENDING', 'PARTIAL', 'PAID', 'PENDING_APPROVAL', 'REJECTED'] as const;

type RangeKey = 'month' | 'quarter' | 'year' | 'all';

function rangeOf(key: RangeKey): { issuedFrom?: string; issuedTo?: string } {
  const today = businessToday();
  const [y, m] = today.split('-').map(Number);
  switch (key) {
    case 'month': return { issuedFrom: `${y}-${String(m).padStart(2, '0')}-01`, issuedTo: today };
    case 'quarter': {
      const from = new Date(`${today}T00:00:00`);
      from.setDate(from.getDate() - 90);
      return { issuedFrom: from.toISOString().slice(0, 10), issuedTo: today };
    }
    case 'year': return { issuedFrom: `${y}-01-01`, issuedTo: today };
    default: return {};
  }
}

function toPdfData(r: Receivable): InvoicePdfData {
  return {
    documentType: r.documentType,
    invoiceNumber: r.invoiceNumber,
    client: r.client,
    project: r.project,
    description: r.description,
    issuedDate: r.issuedDate,
    dueDate: r.dueDate,
    lineItems: r.lineItems.map(li => ({
      description: li.description, quantity: li.quantity,
      unitPrice: li.unitPrice, subtotal: li.subtotal,
    })),
    subtotal: r.subtotal,
    discount: r.discount,
    taxRate: r.taxRate,
    tax: r.tax,
    amount: r.amount,
    notes: r.notes,
  };
}

export function InvoiceManager({ onNavigate }: { onNavigate?: (section: string) => void } = {}) {
  const { t, i18n } = useTranslation(['finance', 'common']);
  const lang = i18n.language;

  const [page, setPage] = useState<PageResponse<Receivable> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  const [projectId, setProjectId] = useState('');
  const [docType, setDocType] = useState('');
  const [status, setStatus] = useState('');
  const [range, setRange] = useState<RangeKey>('year');
  const [pageSize, setPageSize] = useState<number>(20);
  const [current, setCurrent] = useState(0);

  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
  const [windowOpen, setWindowOpen] = useState(false);
  const [flashId, setFlashId] = useState<number | null>(null);
  const [downloading, setDownloading] = useState<number | null>(null);

  /* ── The list ───────────────────────────────────────────────────────── */

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listReceivables({
        ...rangeOf(range),
        projectId: projectId ? Number(projectId) : undefined,
        documentType: docType || undefined,
        status: status || undefined,
        page: current,
        size: pageSize,
      });
      setPage(result);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 403
        ? t('finance:invoice.list.noPermission')
        : err instanceof Error ? err.message : t('finance:invoice.list.errorHint'));
    } finally {
      setLoading(false);
    }
  }, [range, projectId, docType, status, current, pageSize, reloadNonce, t]); // eslint-disable-line react-hooks/exhaustive-deps -- reloadNonce forces a refetch with unchanged filters

  useEffect(() => { void fetchList(); }, [fetchList]);

  /* ── The three figures ──────────────────────────────────────────────── */
  // Counts, each one `totalElements` of a filtered query the server answered.
  // Never a sum over the page in the browser: with a page size of 20 that has
  // already produced tenant-wide-looking numbers in this panel that were wrong.
  const [figures, setFigures] = useState<{ month: number; receivable: number; awaiting: number } | null>(null);
  const [figuresFailed, setFiguresFailed] = useState(false);

  const fetchFigures = useCallback(async () => {
    setFiguresFailed(false);
    try {
      const [month, pending, partial, awaiting] = await Promise.all([
        listReceivables({ ...rangeOf('month'), size: 1 }),
        listReceivables({ status: 'PENDING', size: 1 }),
        listReceivables({ status: 'PARTIAL', size: 1 }),
        listReceivables({ status: 'PENDING_APPROVAL', size: 1 }),
      ]);
      setFigures({
        month: month.totalElements,
        receivable: pending.totalElements + partial.totalElements,
        awaiting: awaiting.totalElements,
      });
    } catch {
      setFigures(null);
      setFiguresFailed(true);
    }
  }, []);
  useEffect(() => { void fetchFigures(); }, [fetchFigures, reloadNonce]);

  /* ── Jobsites, for the filter ───────────────────────────────────────── */

  useEffect(() => {
    listProjects({ size: 100 })
      .then(r => setProjects(r.content.map(p => ({ id: p.id, name: p.name }))))
      .catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    if (flashId == null) return;
    const timer = window.setTimeout(() => setFlashId(null), FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [flashId]);

  const download = useCallback(async (row: Receivable) => {
    setDownloading(row.id);
    try {
      const [issuer, signature] = await Promise.all([
        loadInvoiceIssuer(),
        loadSignatureForPdf(row.id).catch(() => undefined),
      ]);
      downloadInvoicePdf(toPdfData(row), issuer, signature, lang);
    } finally {
      setDownloading(null);
    }
  }, [lang]);

  const rows = page?.content ?? [];
  const hasFilters = !!(projectId || docType || status) || range !== 'year';
  const clearFilters = () => { setProjectId(''); setDocType(''); setStatus(''); setRange('year'); setCurrent(0); };
  const totalPages = Math.max(page?.totalPages ?? 1, 1);
  const totalElements = page?.totalElements ?? 0;
  const listState = loading ? 'loading' : error ? 'error' : rows.length === 0 ? (hasFilters ? 'noMatch' : 'empty') : 'data';
  const today = useMemo(() => stampDay(businessToday(), lang), [lang]);
  const stamp = useCallback((iso: string) => {
    try {
      return new Date(`${iso}T00:00:00`).toLocaleDateString(lang.startsWith('es') ? 'es-GT' : 'en-US', {
        day: '2-digit', month: '2-digit', year: 'numeric',
      });
    } catch { return iso; }
  }, [lang]);

  /** The window hands the focus back to the button that opened it. */
  const focusCreate = useCallback(() => {
    window.setTimeout(() => document.querySelector<HTMLElement>('[data-tour="sec.invoices.new"]')?.focus(), 0);
  }, []);

  const handleCreated = (created: Receivable) => {
    setWindowOpen(false);
    // No success card and no toast: the list reloads, the new row lights up
    // for two seconds, and the PDF has already downloaded with its number.
    clearFilters();
    setReloadNonce(n => n + 1);
    setFlashId(created.id);
    focusCreate();
  };

  const figure = (value: number | undefined) =>
    figures ? value : figuresFailed ? <span className="text-[#CDBFA6]">—</span> : <Bone className="w-10 h-8" />;
  const figureCell = (pressed: boolean) => cn(
    'text-left px-[22px] py-4 transition-colors disabled:cursor-default',
    figures && 'hover:bg-[#FBEDE0]',
    pressed && 'bg-[#FBEDE0] shadow-[inset_0_-3px_0_#F97316]',
    FOCUS_RING, 'focus-visible:outline-offset-[-2px]',
  );

  if (windowOpen) {
    return (
      <InvoiceWindow
        onClose={() => { setWindowOpen(false); focusCreate(); }}
        onCreated={handleCreated}
        onOpenBranding={onNavigate ? () => onNavigate('invoice-branding') : undefined}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between gap-5 flex-wrap">
        <div>
          <Mono className="block text-[11px] tracking-[0.15em] text-[#8A8175]">{t('finance:invoice.list.kicker')}</Mono>
          <h2 className="font-bt-display font-extrabold uppercase text-[38px] md:text-[50px] leading-[0.92] tracking-[0.01em] text-[#0A0A0A] mt-1">
            {t('finance:section.invoices.title')}
          </h2>
          <Mono className="block text-[11px] md:text-[12.5px] tracking-[0.06em] text-[#5A5346] mt-2">
            {t('finance:invoice.list.countLine', { count: totalElements })}
          </Mono>
        </div>
        <div className="flex items-center gap-3.5 flex-shrink-0 w-full md:w-auto">
          <div className="text-right hidden md:block">
            <Mono className="block text-[12px] tracking-[0.08em] text-[#0A0A0A]">{today}</Mono>
            <Mono className="block text-[10px] tracking-[0.1em] text-[#A69C8D] mt-[3px]">{t('finance:invoice.list.stamp')}</Mono>
          </div>
          <CreateButton
            data-tour="sec.invoices.new"
            onClick={() => setWindowOpen(true)}
            disabled={listState === 'error'}
            className="w-full md:w-auto py-3.5 md:py-3"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2.4} />{t('finance:invoice.list.create')}
          </CreateButton>
        </div>
      </div>

      {/* ── The three counts ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 bg-white border border-[#E7E1D5]" data-tour="sec.invoices.summary" data-testid="invoice-figures">
        <div className="px-[22px] py-4 border-b sm:border-b-0 sm:border-r border-[#EDE7DB]">
          <div className="font-bt-display font-extrabold text-[40px] leading-[0.85] text-[#0A0A0A] tabular-nums">{figure(figures?.month)}</div>
          <Mono className="block text-[10.5px] tracking-[0.1em] text-[#5A5346] mt-[5px]">{t('finance:invoice.figure.month')}</Mono>
        </div>
        <button
          type="button"
          disabled={!figures}
          onClick={() => { setStatus(prev => (prev === 'PENDING' ? '' : 'PENDING')); setCurrent(0); }}
          aria-pressed={status === 'PENDING'}
          className={cn(figureCell(status === 'PENDING'), 'border-b sm:border-b-0 sm:border-r border-[#EDE7DB]')}
        >
          <div className="font-bt-display font-extrabold text-[40px] leading-[0.85] text-[#0A0A0A] tabular-nums">{figure(figures?.receivable)}</div>
          <Mono className="block text-[10.5px] tracking-[0.1em] text-[#5A5346] mt-[5px]">{t('finance:invoice.figure.receivable')}</Mono>
        </button>
        <button
          type="button"
          disabled={!figures}
          onClick={() => { setStatus(prev => (prev === 'PENDING_APPROVAL' ? '' : 'PENDING_APPROVAL')); setCurrent(0); }}
          aria-pressed={status === 'PENDING_APPROVAL'}
          className={figureCell(status === 'PENDING_APPROVAL')}
        >
          <div className={cn('font-bt-display font-extrabold text-[40px] leading-[0.85] tabular-nums', figures?.awaiting ? 'text-[#C2410C]' : 'text-[#0A0A0A]')}>
            {figure(figures?.awaiting)}
          </div>
          <Mono className="block text-[10.5px] tracking-[0.1em] text-[#5A5346] mt-[5px]">{t('finance:invoice.figure.awaiting')}</Mono>
        </button>
      </div>
      {figuresFailed && (
        <div className="flex items-center justify-between gap-3 flex-wrap -mt-2">
          <Mono className="text-[10px] tracking-[0.08em] text-[#8A8175]">{t('finance:invoice.figure.failed')}</Mono>
          <SecondaryButton onClick={() => void fetchFigures()} className="bg-[#FAF7F0] text-[10px] px-3 py-1.5">{t('common:buttons.retry')}</SecondaryButton>
        </div>
      )}

      {/* ── Filters ──────────────────────────────────────────────────── */}
      <div className="bg-white border border-[#E7E1D5] p-3.5 md:px-4" data-tour="sec.invoices.filters">
        <div className="flex flex-wrap items-center gap-2.5">
          <MonoSelect value={projectId} onChange={e => { setProjectId(e.target.value); setCurrent(0); }} aria-label={t('finance:invoice.filter.project')}>
            <option value="">{t('finance:invoice.filter.allProjects')}</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </MonoSelect>
          <MonoSelect value={docType} onChange={e => { setDocType(e.target.value); setCurrent(0); }} aria-label={t('finance:invoice.filter.type')}>
            <option value="">{t('finance:invoice.filter.allTypes')}</option>
            <option value="INVOICE">{t('finance:invoice.type.invoice')}</option>
            <option value="CHANGE_ORDER_REQUEST">{t('finance:invoice.type.changeOrder')}</option>
          </MonoSelect>
          <MonoSelect value={status} onChange={e => { setStatus(e.target.value); setCurrent(0); }} aria-label={t('finance:invoice.filter.status')}>
            <option value="">{t('finance:invoice.filter.allStatuses')}</option>
            {STATUSES.map(s => <option key={s} value={s}>{t(`finance:invoice.state.${s.toLowerCase()}`)}</option>)}
          </MonoSelect>
          <MonoSelect value={range} onChange={e => { setRange(e.target.value as RangeKey); setCurrent(0); }} aria-label={t('finance:invoice.filter.range')}>
            <option value="month">{t('finance:invoice.range.month')}</option>
            <option value="quarter">{t('finance:invoice.range.quarter')}</option>
            <option value="year">{t('finance:invoice.range.year')}</option>
            <option value="all">{t('finance:invoice.range.all')}</option>
          </MonoSelect>
          <div className="ml-auto flex items-center gap-2">
            {hasFilters && (
              <button type="button" onClick={clearFilters} className={cn('font-bt-mono text-[10.5px] uppercase tracking-[0.1em] font-semibold text-[#C2410C] hover:text-[#F97316] px-1', FOCUS_RING)}>
                {t('finance:invoice.filter.clear')} ✕
              </button>
            )}
            <SecondaryButton onClick={() => { setReloadNonce(n => n + 1); }} disabled={loading} className="text-[10.5px] px-3 py-[9px] bg-[#FAF7F0] gap-1.5">
              <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />{t('common:buttons.refresh')}
            </SecondaryButton>
          </div>
        </div>
        {status !== 'PENDING_APPROVAL' && (
          <Mono className="block text-[10px] tracking-[0.06em] text-[#8A8175] mt-2.5 normal-case leading-[1.5]">
            {t('finance:invoice.list.hiddenCors')}
          </Mono>
        )}
      </div>

      {/* ── Table ────────────────────────────────────────────────────── */}
      <div className="bg-white border border-[#E7E1D5]" data-tour="sec.invoices.list" data-testid="invoice-list">
        {listState === 'error' && (
          <EmptyWord
            tone="red"
            word={t('finance:invoice.list.errorBig')}
            title={t('finance:invoice.list.errorTitle')}
            hint={error ?? t('finance:invoice.list.errorHint')}
            className="border-0"
            action={<SecondaryButton onClick={() => setReloadNonce(n => n + 1)} className="bg-[#FAF7F0] gap-1.5"><RefreshCw className="w-3 h-3" />{t('common:buttons.retry')}</SecondaryButton>}
          />
        )}
        {listState === 'empty' && (
          <EmptyWord
            word={t('finance:invoice.list.emptyBig')}
            title={t('finance:invoice.list.emptyTitle')}
            hint={t('finance:invoice.list.emptyHint')}
            className="border-0 py-[70px]"
            action={<CreateButton onClick={() => setWindowOpen(true)}><Plus className="w-3.5 h-3.5" strokeWidth={2.4} />{t('finance:invoice.list.create')}</CreateButton>}
          />
        )}
        {listState === 'noMatch' && (
          <EmptyWord
            word={t('finance:invoice.list.noMatchBig')}
            title={t('finance:invoice.list.noMatchTitle')}
            hint={t('finance:invoice.list.noMatchHint')}
            className="border-0"
            action={<SecondaryButton onClick={clearFilters} className="bg-[#FAF7F0]">{t('finance:invoice.filter.clear')}</SecondaryButton>}
          />
        )}

        {(listState === 'data' || listState === 'loading') && (
          <>
            {/* Desktop */}
            <div className="hidden md:block">
              <div className={cn(ROW_GRID, 'px-5 py-[11px] border-b border-[#EDE7DB] bg-[#FBF8F2] font-bt-mono text-[10px] uppercase tracking-[0.13em] text-[#8A8175]')}>
                <span>{t('finance:invoice.table.number')}</span>
                <span>{t('finance:invoice.table.type')}</span>
                <span>{t('finance:invoice.list.clientAndProject')}</span>
                <span>{t('finance:invoice.list.issuedDue')}</span>
                <span className="text-right">{t('finance:invoice.table.amount')}</span>
                <span className="text-right">{t('finance:invoice.list.outstanding')}</span>
                <span>{t('finance:invoice.table.status')}</span>
                <span />
              </div>
              {listState === 'loading' && Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={cn(ROW_GRID, 'px-5 py-[15px] border-b border-[#F0EBE1]')}>
                  <Bone className="w-[80%] h-3" /><Bone className="w-16 h-5" />
                  <div className="space-y-2"><Bone className="w-[52%] h-[13px]" /><Bone className="w-[74%] h-[9px]" /></div>
                  <Bone className="w-[70%] h-3" /><Bone className="w-[60%] h-3 justify-self-end" />
                  <Bone className="w-[60%] h-3 justify-self-end" /><Bone className="w-20 h-5" />
                  <Bone className="w-7 h-7 justify-self-end" />
                </div>
              ))}
              {listState === 'data' && rows.map(row => {
                const isCO = row.documentType === 'CHANGE_ORDER_REQUEST';
                const notBillable = row.status === 'pending_approval' || row.status === 'rejected';
                const outstanding = row.amount - row.paidAmount;
                const overdue = row.status === 'overdue';
                return (
                  <div
                    key={row.id}
                    data-testid={`invoice-row-${row.id}`}
                    className={cn(
                      ROW_GRID, 'px-5 py-[13px] border-b border-[#F0EBE1] last:border-b-0 border-l-2 transition-colors hover:bg-[#FBF8F2]',
                      overdue ? 'border-l-[#B3402A]' : 'border-l-transparent hover:border-l-[#F97316]',
                      row.id === flashId && 'bt-row-flash',
                    )}
                  >
                    <Mono className="text-[12.5px] font-semibold tracking-[0.03em] text-[#0A0A0A]">{row.invoiceNumber}</Mono>
                    <div><DocTypeChip type={row.documentType} /></div>
                    <div className="min-w-0">
                      <div className="text-[14px] font-semibold text-[#0A0A0A] truncate">{row.client}</div>
                      <Mono className="block text-[10.5px] tracking-[0.04em] text-[#A69C8D] mt-[3px] truncate">
                        {[row.project, row.description].filter(Boolean).join(' · ')}
                      </Mono>
                    </div>
                    <div className="min-w-0">
                      <Mono className="block text-[11.5px] text-[#0A0A0A]">{stamp(row.issuedDate)}</Mono>
                      {isCO && notBillable
                        ? <CellEmpty className="block mt-[2px]">{t('finance:invoice.list.noDueDate')}</CellEmpty>
                        : <Mono className={cn('block text-[10px] tracking-[0.06em] mt-[2px]', overdue ? 'text-[#B3402A]' : 'text-[#A69C8D]')}>
                            {t(overdue ? 'finance:invoice.list.expiredOn' : 'finance:invoice.list.dueOn', { date: stamp(row.dueDate) })}
                          </Mono>}
                    </div>
                    <Mono className="text-[12.5px] text-[#0A0A0A] text-right tabular-nums">{fmtMoney(row.amount, { decimals: false })}</Mono>
                    {notBillable
                      ? <CellEmpty className="text-right">{t('finance:invoice.list.notBillable')}</CellEmpty>
                      : outstanding <= 0
                        ? <CellEmpty className="text-right">{t('finance:invoice.list.settled')}</CellEmpty>
                        : <Mono className={cn('text-[12.5px] text-right tabular-nums', overdue ? 'text-[#B3402A] font-semibold' : 'text-[#0A0A0A]')}>
                            {fmtMoney(outstanding, { decimals: false })}
                          </Mono>}
                    <div><InvoiceStatusChip status={row.status} /></div>
                    {rowMenu(row)}
                  </div>
                );
              })}
            </div>

            {/* Phone: cards */}
            <div className="md:hidden p-3.5 space-y-3">
              {listState === 'loading' && Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="border border-[#E7E1D5] p-3.5 space-y-2"><Bone className="w-2/3 h-[13px]" /><Bone className="w-1/2 h-[9px]" /><Bone className="w-1/3 h-[9px] mt-3" /></div>
              ))}
              {listState === 'data' && rows.map(row => {
                const outstanding = row.amount - row.paidAmount;
                const notBillable = row.status === 'pending_approval' || row.status === 'rejected';
                return (
                  <div key={row.id} className={cn('border border-[#E7E1D5] border-l-2 border-l-transparent p-3.5', row.id === flashId && 'bt-row-flash')}>
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="min-w-0">
                        <Mono className="block text-[12px] font-semibold text-[#0A0A0A]">{row.invoiceNumber}</Mono>
                        <div className="text-[14px] font-semibold text-[#0A0A0A] mt-[3px] truncate">{row.client}</div>
                        <Mono className="block text-[10px] tracking-[0.04em] text-[#A69C8D] mt-[2px] truncate">{row.project}</Mono>
                      </div>
                      <InvoiceStatusChip status={row.status} className="flex-shrink-0" />
                    </div>
                    <div className="flex items-end justify-between gap-3 mt-3">
                      <div>
                        <div className="font-bt-display font-extrabold text-[26px] leading-none tabular-nums">{fmtMoney(row.amount, { decimals: false })}</div>
                        <Mono className="block text-[9.5px] tracking-[0.08em] text-[#8A8175] mt-1.5">
                          {notBillable
                            ? t('finance:invoice.list.notBillable')
                            : outstanding > 0
                              ? t('finance:invoice.list.outstandingIs', { amount: fmtMoney(outstanding, { decimals: false }) })
                              : t('finance:invoice.list.settled')}
                        </Mono>
                      </div>
                      <SecondaryButton
                        onClick={() => void download(row)}
                        disabled={downloading === row.id}
                        className="bg-[#FAF7F0] min-h-11 gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" />{t('finance:invoice.list.pdf')}
                      </SecondaryButton>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Pagination ───────────────────────────────────────────────── */}
      {listState === 'data' && (
        <div className="flex items-center justify-between gap-4 flex-wrap pb-2">
          <Mono className="text-[10.5px] tracking-[0.06em] text-[#8A8175]">
            {t('finance:invoice.showingOf', { shown: rows.length, total: totalElements })}
          </Mono>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-[7px]">
              <Mono className="text-[10px] tracking-[0.08em] text-[#8A8175]">{t('finance:invoice.list.perPage')}</Mono>
              <MonoSelect value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setCurrent(0); }} className="px-[9px] py-1.5" aria-label={t('finance:invoice.list.perPage')}>
                {PAGE_SIZES.map(n => <option key={n} value={n}>{n}</option>)}
              </MonoSelect>
            </div>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => setCurrent(p => Math.max(0, p - 1))} disabled={current === 0} aria-label={t('common:buttons.prev')}
                className={cn('w-[30px] h-[30px] border border-[#DBD0BB] bg-[#FAF7F0] flex items-center justify-center text-[#0A0A0A] hover:border-[#F97316] hover:text-[#C2410C] disabled:text-[#B4A992] disabled:hover:border-[#DBD0BB]', FOCUS_RING)}>
                <ChevronLeft className="w-3 h-3" strokeWidth={2.4} />
              </button>
              <Mono className="text-[11px] tracking-[0.06em] text-[#0A0A0A] min-w-[96px] text-center">
                {t('finance:invoice.pageOf', { current: current + 1, total: totalPages })}
              </Mono>
              <button type="button" onClick={() => setCurrent(p => Math.min(totalPages - 1, p + 1))} disabled={current >= totalPages - 1} aria-label={t('common:buttons.next')}
                className={cn('w-[30px] h-[30px] border border-[#DBD0BB] bg-[#FAF7F0] flex items-center justify-center text-[#0A0A0A] hover:border-[#F97316] hover:text-[#C2410C] disabled:text-[#B4A992] disabled:hover:border-[#DBD0BB]', FOCUS_RING)}>
                <ChevronRight className="w-3 h-3" strokeWidth={2.4} />
              </button>
            </div>
          </div>
        </div>
      )}

      <PaperNote tone="none" className="text-[12px]">{t('finance:invoice.list.paymentsElsewhere')}</PaperNote>
    </div>
  );

  function rowMenu(row: Receivable) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={t('finance:invoice.table.actions')}
            className={cn('w-7 h-7 flex items-center justify-center border bg-white transition-colors flex-shrink-0 justify-self-end border-[#DBD0BB] text-[#5A5346] hover:border-[#F97316] hover:text-[#C2410C]', FOCUS_RING)}
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[248px] rounded-none border-[#CDBFA6] p-0 shadow-[0_16px_48px_rgba(23,19,15,0.3)]">
          <DropdownMenuLabel className="font-bt-mono text-[9.5px] font-normal uppercase tracking-[0.14em] text-[#8A8175] px-3.5 pt-2.5 pb-2 border-b border-[#EDE7DB] truncate">
            {row.invoiceNumber} · {fmtMoney(row.amount, { decimals: false })}
          </DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => void download(row)}
            className="rounded-none cursor-pointer px-3.5 py-[11px] font-bt-mono text-[10.5px] uppercase tracking-[0.08em] text-[#0A0A0A] border-l-2 border-l-transparent focus:bg-[#F3EEE4] focus:border-l-[#F97316] data-[highlighted]:bg-[#F3EEE4]"
          >
            {downloading === row.id ? <RefreshCw className="w-3 h-3 mr-2 animate-spin" /> : <Download className="w-3 h-3 mr-2" />}
            {t('finance:invoice.list.downloadAgain')}
          </DropdownMenuItem>
          {onNavigate && (
            <DropdownMenuItem
              onClick={() => onNavigate('accounts-receivable')}
              className="rounded-none cursor-pointer px-3.5 py-[11px] font-bt-mono text-[10.5px] uppercase tracking-[0.08em] text-[#0A0A0A] border-l-2 border-l-transparent border-t border-t-[#EDE7DB] focus:bg-[#F3EEE4] focus:border-l-[#F97316] data-[highlighted]:bg-[#F3EEE4]"
            >
              <FileText className="w-3 h-3 mr-2" />
              {t(row.status === 'pending_approval' ? 'finance:invoice.list.approveInAr' : 'finance:invoice.list.openInAr')}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
}
