import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Search } from 'lucide-react';
import { cn } from '../ui/utils';
import { ApiError } from '../../lib/api';
import { FIELD_LIMITS } from '../../../shared/fieldLimits';
import {
  INVOICE_STATUS_FLOW, isPayable, isReviewable, listInvoices,
  type InvoiceStatus, type SubcontractorInvoiceDTO, type SubcontractorsSummary,
} from '../../services/subcontractors';
import { FOCUS_RING, PrimaryButton, SecondaryButton } from '../onboarding/chrome';
import { Bone, EmptyWord, Mono, MonoSelect, stampDate } from '../projects/bt';
import { apiErrorMsg } from '../projects/helpers';
import { CellEmpty, FigureStrip, fmtMoney, fmtMoneyShort, InvoiceStatusChip, Pagination } from './bits';
import type { RefData } from './refData';

/**
 * 03 — what they invoice you.
 *
 * The table mixes two queues: what you have to review and what you have to
 * pay. The action cell says which of the two a row is, and the two rows that
 * ask nothing of you are dimmed — the observed one waits on the subcontractor,
 * the paid one is closed.
 *
 * Only one row carries the orange button: the one that has been in review
 * longest. Six equally loud buttons would read as six equal emergencies.
 */

const GRID = 'grid grid-cols-[1fr_1.75fr_1.1fr_1.1fr_.85fr_1fr_.8fr_120px] gap-3 items-center';

export function InvoicesTab({ summary, summaryState, refData, onReview, onPay, flashInvoiceId }: {
  summary: SubcontractorsSummary | null;
  summaryState: 'loading' | 'ready' | 'failed';
  refData: RefData;
  onReview: (invoice: SubcontractorInvoiceDTO) => void;
  onPay: (invoice: SubcontractorInvoiceDTO) => void;
  flashInvoiceId: number | null;
}) {
  const { t, i18n } = useTranslation(['subcontractors', 'common']);
  const lang = i18n.language;

  const [invoices, setInvoices] = useState<SubcontractorInvoiceDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [subFilter, setSubFilter] = useState<number | ''>('');
  const [statusFilter, setStatusFilter] = useState<'' | InvoiceStatus>('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const searchTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (search === debouncedSearch) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setDebouncedSearch(search); setPage(0); }, 350);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search, debouncedSearch]);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listInvoices({
        subcontractorId: subFilter || undefined,
        status: statusFilter || undefined,
        search: debouncedSearch || undefined,
        page,
        size: pageSize,
      });
      setInvoices(res.content);
      setTotalElements(res.totalElements);
      setTotalPages(res.totalPages);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 403 ? t('subcontractors:noPermission.title') : apiErrorMsg(err));
    } finally {
      setLoading(false);
    }
  }, [subFilter, statusFilter, debouncedSearch, page, pageSize, reloadNonce, t]); // eslint-disable-line react-hooks/exhaustive-deps -- reloadNonce forces a refetch with unchanged filters

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  useEffect(() => {
    if (flashInvoiceId == null) return;
    setReloadNonce(n => n + 1);
  }, [flashInvoiceId]);

  const hasFilters = !!(search || subFilter || statusFilter);
  const clearFilters = () => { setSearch(''); setDebouncedSearch(''); setSubFilter(''); setStatusFilter(''); setPage(0); };
  const state = loading ? 'loading' : error ? 'error' : invoices.length === 0 ? (hasFilters ? 'noMatch' : 'empty') : 'data';

  // The oldest one still in review is the only primary button on the screen.
  const leadId = invoices.filter(i => isReviewable(i.status)).slice(-1)[0]?.id ?? null;

  const monthLabel = new Date().toLocaleDateString(lang.startsWith('es') ? 'es-GT' : 'en-US', { month: 'long' });

  return (
    <div className="space-y-4">
      <FigureStrip
        testId="invoices-figures"
        state={summaryState}
        figures={[
          {
            key: 'toReview',
            value: summary?.invoicesToReview,
            label: t('subcontractors:inv.kpi.toReview'),
            tone: 'orange',
            pressed: statusFilter === 'SUBMITTED',
            onClick: () => { setStatusFilter(p => (p === 'SUBMITTED' ? '' : 'SUBMITTED')); setPage(0); },
          },
          {
            key: 'toPay',
            value: summary ? `${summary.invoicesToPayCount}` : undefined,
            label: (
              <>
                {t('subcontractors:inv.kpi.toPay')}
                {summary && summary.invoicesToPayCents > 0 && (
                  <span className="block text-[#0A0A0A] mt-[3px]">{fmtMoney(summary.invoicesToPayCents)}</span>
                )}
              </>
            ),
            pressed: statusFilter === 'APPROVED',
            onClick: () => { setStatusFilter(p => (p === 'APPROVED' ? '' : 'APPROVED')); setPage(0); },
          },
          {
            key: 'paidMonth',
            value: fmtMoneyShort(summary?.paidThisMonthCents),
            label: t('subcontractors:inv.kpi.paidMonth', { month: monthLabel }),
          },
        ]}
      />

      <div className="bg-white border border-[#E7E1D5] p-3.5 md:px-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[200px] md:max-w-[300px]">
            <Search className="w-3.5 h-3.5 text-[#A69C8D] absolute left-[11px] top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('subcontractors:inv.search')}
              maxLength={FIELD_LIMITS.SEARCH}
              aria-label={t('subcontractors:inv.search')}
              className={cn('w-full border border-[#DBD0BB] bg-[#FAF7F0] py-[9px] pl-8 pr-3 text-[13px] text-[#0A0A0A] outline-none focus:border-[#F97316]', FOCUS_RING)}
            />
          </div>
          <MonoSelect
            value={subFilter}
            onChange={e => { setSubFilter(e.target.value ? Number(e.target.value) : ''); setPage(0); }}
            className="hidden md:block max-w-[190px]"
            aria-label={t('subcontractors:inv.filter.subcontractor')}
          >
            <option value="">{t('subcontractors:inv.filter.subcontractor')}</option>
            {refData.subcontractors.map(s => <option key={s.id} value={s.id}>{s.fullName ?? s.username}</option>)}
          </MonoSelect>
          {/* Five states, not six: nothing writes PENDING_PAYMENT, so it is not
              offered as a filter that could only ever come back empty. */}
          <MonoSelect
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value as '' | InvoiceStatus); setPage(0); }}
            className="hidden md:block"
            aria-label={t('subcontractors:inv.filter.status')}
          >
            <option value="">{t('subcontractors:inv.filter.status')}</option>
            {INVOICE_STATUS_FLOW.map(s => <option key={s} value={s}>{t(`subcontractors:invoiceStatus.${s}`)}</option>)}
          </MonoSelect>
          <div className="ml-auto flex items-center gap-2">
            {hasFilters && (
              <button type="button" onClick={clearFilters} className={cn('font-bt-mono text-[10.5px] uppercase tracking-[0.1em] font-semibold text-[#C2410C] hover:text-[#F97316] px-1', FOCUS_RING)}>
                {t('subcontractors:jobs.filter.clear')} ✕
              </button>
            )}
            <SecondaryButton onClick={() => setReloadNonce(n => n + 1)} disabled={loading} className="text-[10.5px] px-3 py-[9px] bg-[#FAF7F0] gap-1.5">
              <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />{t('common:buttons.refresh')}
            </SecondaryButton>
          </div>
        </div>
        <Mono className="block text-[9.5px] tracking-[0.1em] text-[#A69C8D] mt-2.5">{t('subcontractors:inv.note')}</Mono>
      </div>

      <div className="bg-white border border-[#E7E1D5]" data-testid="invoices-list">
        {state === 'error' && (
          <EmptyWord
            tone="red"
            word={t('subcontractors:inv.error.big')}
            title={error ?? t('subcontractors:inv.error.title')}
            hint={t('subcontractors:inv.error.hint')}
            className="border-0"
            action={<SecondaryButton onClick={() => setReloadNonce(n => n + 1)} className="bg-[#FAF7F0]">{t('common:buttons.retry')}</SecondaryButton>}
          />
        )}
        {state === 'empty' && (
          <EmptyWord word={t('subcontractors:inv.empty.big')} title={t('subcontractors:inv.empty.title')} hint={t('subcontractors:inv.empty.hint')} className="border-0 py-[76px]" />
        )}
        {state === 'noMatch' && (
          <EmptyWord
            word={t('subcontractors:inv.noMatch.big')}
            title={t('subcontractors:inv.noMatch.title')}
            hint={t('subcontractors:inv.noMatch.hint')}
            className="border-0"
            action={<SecondaryButton onClick={clearFilters} className="bg-[#FAF7F0]">{t('subcontractors:jobs.noMatch.clear')}</SecondaryButton>}
          />
        )}

        {(state === 'data' || state === 'loading') && (
          <>
            <div className="hidden lg:block">
              <div className={cn(GRID, 'px-5 py-[11px] border-b border-[#EDE7DB] bg-[#FBF8F2] font-bt-mono text-[10px] uppercase tracking-[0.13em] text-[#8A8175]')}>
                <span>{t('subcontractors:inv.table.number')}</span>
                <span>{t('subcontractors:inv.table.job')}</span>
                <span>{t('subcontractors:inv.table.project')}</span>
                <span>{t('subcontractors:inv.table.subcontractor')}</span>
                <span className="text-right">{t('subcontractors:inv.table.amount')}</span>
                <span>{t('subcontractors:inv.table.status')}</span>
                <span>{t('subcontractors:inv.table.submitted')}</span>
                <span />
              </div>
              {state === 'loading' && Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className={cn(GRID, 'px-5 py-[15px] border-b border-[#F0EBE1]')}>
                  <Bone className="w-[80%] h-3" /><Bone className="w-[85%] h-3" /><Bone className="w-[70%] h-3" /><Bone className="w-[70%] h-3" />
                  <Bone className="w-16 h-3 justify-self-end" /><Bone className="w-16 h-5" /><Bone className="w-12 h-3" /><Bone className="w-full h-7" />
                </div>
              ))}
              {state === 'data' && invoices.map(inv => (
                <InvoiceRow
                  key={inv.id}
                  invoice={inv}
                  lang={lang}
                  lead={inv.id === leadId}
                  flash={inv.id === flashInvoiceId}
                  onReview={() => onReview(inv)}
                  onPay={() => onPay(inv)}
                />
              ))}
            </div>

            {/* Tablet and phone: cards */}
            <div className="lg:hidden p-3.5 space-y-3">
              {state === 'loading' && Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="border border-[#E7E1D5] p-3.5 space-y-2"><Bone className="w-2/3 h-[13px]" /><Bone className="w-1/2 h-[9px]" /><Bone className="w-1/3 h-8 mt-3" /></div>
              ))}
              {state === 'data' && invoices.map(inv => (
                <div
                  key={inv.id}
                  className={cn(
                    'border border-[#E7E1D5] border-l-2 border-l-transparent p-3.5',
                    inv.id === flashInvoiceId && 'bt-row-flash',
                    inv.status === 'PAID' && 'opacity-[0.62]',
                    inv.status === 'OBSERVED' && 'opacity-[0.75]',
                  )}
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <Mono className="text-[12px] font-semibold tracking-[0.06em] text-[#0A0A0A]">{inv.invoiceNumber ?? t('subcontractors:inv.row.noNumber')}</Mono>
                    <InvoiceStatusChip status={inv.status} className="flex-shrink-0" />
                  </div>
                  <div className="text-[13.5px] text-[#0A0A0A] mt-1.5 leading-[1.35]">{inv.jobTitle}</div>
                  <Mono className="block text-[10px] tracking-[0.04em] text-[#5A5346] mt-1 truncate">
                    {(inv.subcontractorName ?? '').toUpperCase()}{inv.projectName ? ` · ${inv.projectName.toUpperCase()}` : ''}
                  </Mono>
                  <div className="flex items-center justify-between gap-3 mt-3">
                    <span className="font-bt-display font-extrabold text-[22px] leading-none tabular-nums text-[#0A0A0A]">{fmtMoney(inv.amountCents)}</span>
                    <InvoiceAction invoice={inv} lead={inv.id === leadId} onReview={() => onReview(inv)} onPay={() => onPay(inv)} lang={lang} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {state === 'data' && (
        <Pagination
          page={page} pageSize={pageSize} totalElements={totalElements} totalPages={totalPages}
          onPage={setPage} onPageSize={n => { setPageSize(n); setPage(0); }}
        />
      )}
    </div>
  );
}

/**
 * What this row asks of you: review it, pay it, or nothing.
 *
 * "Registrar pago" hangs off Aprobada. It used to hang off PENDING_PAYMENT — a
 * state nothing in the system writes — so an approved invoice could not be paid
 * from the panel at all, and the "Revisar" it offered instead came back 409.
 */
function InvoiceAction({ invoice, lead, onReview, onPay, lang }: {
  invoice: SubcontractorInvoiceDTO;
  lead: boolean;
  onReview: () => void;
  onPay: () => void;
  lang: string;
}) {
  const { t } = useTranslation(['subcontractors']);
  if (isReviewable(invoice.status)) {
    return lead
      ? <PrimaryButton onClick={onReview} className="w-full px-3 py-[9px] text-[10px]">{t('subcontractors:inv.action.review')}</PrimaryButton>
      : <SecondaryButton onClick={onReview} className="w-full px-3 py-[9px] text-[10px] bg-[#FAF7F0]">{t('subcontractors:inv.action.review')}</SecondaryButton>;
  }
  if (isPayable(invoice.status)) {
    return <SecondaryButton onClick={onPay} className="w-full px-3 py-[9px] text-[10px] bg-[#FAF7F0]">{t('subcontractors:inv.action.pay')}</SecondaryButton>;
  }
  if (invoice.status === 'OBSERVED') {
    return <CellEmpty className="block text-right lg:text-left">{t('subcontractors:inv.row.theirMove')}</CellEmpty>;
  }
  // Paid: the reference and the date, which is all that is left to say.
  return (
    <div className="text-right lg:text-left leading-[1.35]">
      <Mono className="block text-[10px] tracking-[0.06em] text-[#5A5346] truncate">{invoice.paymentReference ?? t('subcontractors:inv.row.noReference')}</Mono>
      {invoice.paidAt && <Mono className="block text-[9.5px] tracking-[0.06em] text-[#A69C8D]">{stampDate(invoice.paidAt, lang)}</Mono>}
    </div>
  );
}

function InvoiceRow({ invoice, lang, lead, flash, onReview, onPay }: {
  invoice: SubcontractorInvoiceDTO;
  lang: string;
  lead: boolean;
  flash: boolean;
  onReview: () => void;
  onPay: () => void;
}) {
  const { t } = useTranslation(['subcontractors']);
  return (
    <div
      data-testid={`invoice-row-${invoice.id}`}
      className={cn(
        GRID, 'px-5 py-[13px] border-b border-[#F0EBE1] border-l-2 border-l-transparent transition-colors hover:bg-[#FBF8F2]',
        flash && 'bt-row-flash',
        invoice.status === 'PAID' && 'opacity-[0.62]',
        invoice.status === 'OBSERVED' && 'opacity-[0.80]',
      )}
    >
      <Mono className="text-[11.5px] font-semibold tracking-[0.04em] text-[#0A0A0A] truncate">
        {invoice.invoiceNumber ?? t('subcontractors:inv.row.noNumber')}
      </Mono>
      <div className="min-w-0">
        <div className="text-[13px] text-[#0A0A0A] truncate">{invoice.jobTitle}</div>
        {invoice.status === 'OBSERVED' && (
          <Mono className="block text-[9.5px] tracking-[0.06em] text-[#C2410C] mt-[3px] truncate">{t('subcontractors:inv.row.waitingSub')}</Mono>
        )}
        {invoice.status === 'APPROVED' && (
          <Mono className="block text-[9.5px] tracking-[0.06em] text-[#5A5346] mt-[3px] truncate">{t('subcontractors:inv.row.readyToPay')}</Mono>
        )}
      </div>
      {invoice.projectName
        ? <span className="text-[12.5px] text-[#5A5346] truncate">{invoice.projectName}</span>
        : <CellEmpty>{t('subcontractors:inv.row.noProject')}</CellEmpty>}
      <span className="text-[12.5px] text-[#0A0A0A] truncate">{invoice.subcontractorName ?? ''}</span>
      <Mono className="text-[13px] tabular-nums font-semibold text-[#0A0A0A] text-right">{fmtMoney(invoice.amountCents)}</Mono>
      <div><InvoiceStatusChip status={invoice.status} /></div>
      <Mono className="text-[11px] tracking-[0.04em] text-[#5A5346]">{stampDate(invoice.createdAt, lang)}</Mono>
      <InvoiceAction invoice={invoice} lead={lead} onReview={onReview} onPay={onPay} lang={lang} />
    </div>
  );
}
