import { useScreenState, useProjectFilter, useWorkspace } from '../workspace/WorkspaceState';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Receipt, AlertTriangle,
  ChevronDown, ChevronRight, Filter, Plus, Trash2, Pencil,
  Download,
} from 'lucide-react';
import { Button } from './ui/button';
import { AccountingFigure, AccountingHeader } from './finance/AccountingChrome';
import { EmptyWord } from './projects/bt';
import { TableSkeleton } from './budgets/ui';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from './ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from './ui/select';
import { toast } from 'sonner';
import {
  listAllReceivables, getReceivableSummary, recordReceivablePayment, approveChangeOrder,
  updateReceivableInfo, deleteReceivable,
  type Receivable, type ReceivablePayment as ApiReceivablePayment, type ReceivableLineItem,
  type DocumentType, type ReceivableSummary,
} from '../services/finance';
import { ApiError } from '../lib/api';
import { AuthService } from '../services/auth';
import { downloadInvoicePdf, type InvoicePdfData } from '../helpers/exportInvoicePdf';
import { SignatureRequestPanel } from './signatures/SignatureRequestPanel';
import { loadSignatureForPdf } from '../services/signatures';
import { loadInvoiceIssuer } from '../services/invoiceBranding';
import { InvoiceWindow } from './invoices/InvoiceWindow';
import { FIELD_LIMITS } from '../../shared/fieldLimits';

// Types — aligned with API

type PaymentRecord = ApiReceivablePayment;

interface Invoice {
  id: number;
  documentType: DocumentType;
  invoiceNumber: string;
  client: string;
  project: string;
  projectId: number;
  description: string | null;
  issuedDate: string;
  dueDate: string;
  amount: number;
  paidAmount: number;
  status: 'paid' | 'pending' | 'partial' | 'overdue' | 'pending_approval';
  approvedBy: string | null;
  approvedAt: string | null;
  lineItems: ReceivableLineItem[];
  payments: PaymentRecord[];
  subtotal: number;
  discount: number;
  taxRate: number;
  tax: number;
  notes: string | null;
}

// Helpers

import { fmtDate, businessToday, daysOverdue, currentMonthLabel } from '../helpers/dateTime';
import { paymentMethodLabel } from './PayableCommon';

function fmtAmount(n: number) {
  return `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

function toInvoice(r: Receivable): Invoice {
  return {
    id: r.id,
    documentType: r.documentType,
    invoiceNumber: r.invoiceNumber,
    client: r.client,
    project: r.project,
    projectId: r.projectId,
    description: r.description,
    issuedDate: r.issuedDate,
    dueDate: r.dueDate,
    amount: r.amount,
    paidAmount: r.paidAmount,
    status: r.status as Invoice['status'],
    approvedBy: r.approvedBy ?? null,
    approvedAt: r.approvedAt ?? null,
    lineItems: r.lineItems ?? [],
    payments: r.payments,
    subtotal: r.subtotal,
    discount: r.discount,
    taxRate: r.taxRate,
    tax: r.tax,
    notes: r.notes,
  };
}

function invoiceToPdfData(inv: Invoice): InvoicePdfData {
  return {
    documentType: inv.documentType,
    invoiceNumber: inv.invoiceNumber,
    client: inv.client,
    project: inv.project,
    description: inv.description,
    issuedDate: inv.issuedDate,
    dueDate: inv.dueDate,
    lineItems: inv.lineItems.map(li => ({
      description: li.description,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      subtotal: li.subtotal,
    })),
    subtotal: inv.subtotal,
    discount: inv.discount,
    taxRate: inv.taxRate,
    tax: inv.tax,
    amount: inv.amount,
    notes: inv.notes,
  };
}

const ITEMS_PER_PAGE = 10;

// Status badge

function StatusBadge({ status }: { status: Invoice['status'] }) {
  const { t } = useTranslation(['common']);
  const map: Record<string, string> = {
    paid:    'bg-emerald-50 text-emerald-700 border-emerald-200',
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    partial: 'bg-blue-50 text-blue-700 border-blue-200',
    overdue: 'bg-red-50 text-red-700 border-red-200',
  };
  const labelMap: Record<string, string> = {
    paid: t('common:status.paid'),
    pending: t('common:status.pending'),
    partial: t('common:status.partial', 'Partial'),
    overdue: t('common:status.overdue'),
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-none text-[10px] font-semibold border ${map[status] ?? map.pending}`}>
      <span className={`w-1.5 h-1.5 rounded-none ${status === 'paid' ? 'bg-emerald-500' : status === 'partial' ? 'bg-blue-500' : status === 'pending' ? 'bg-amber-500' : 'bg-red-500'}`} />
      {labelMap[status]}
    </span>
  );
}

// Component

export function AccountsReceivable({ onNavigate }: { onNavigate?: (section: string) => void } = {}) {
  // Approval is an ADMIN act (anti self-billing — the backend enforces it);
  // FINANCE still sees the queue and can download the PDF or delete (reject).
  const isAdmin = AuthService.getCanonicalRole() === 'ADMIN';
  const { t, i18n } = useTranslation(['finance', 'common']);
  const workspace = useWorkspace();
  const dateLocale = i18n.language === 'es' ? 'es' : 'en-US';
  // Current accounting month for the "Collected this month" KPI, formatted locale-aware (e.g. "Jun 2026" / "jun 2026")
  const collectedMonthLabel = currentMonthLabel(dateLocale);

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [expandedId, setExpandedId] = useScreenState<number | null>('registro', null, 'push');
  const [currentPage, setCurrentPage] = useScreenState('pagina', 1);
  const projects = useMemo(() => Array.from(new Map(invoices.map(i => [i.projectId, { id: i.projectId, name: i.project }])).values()), [invoices]);
  const [summary, setSummary] = useState<ReceivableSummary | null>(null);
  const [summaryError, setSummaryError] = useState(false);
  const fetchSummary = useCallback(async () => {
    try {
      setSummary(await getReceivableSummary());
      setSummaryError(false);
    } catch {
      setSummary(null);
      setSummaryError(true);
    }
  }, []);

  const [pendingApprovals, setPendingApprovals] = useState<Invoice[]>([]);
  const [approving, setApproving] = useState<number | null>(null);

  const fetchPendingApprovals = useCallback(() => {
    listAllReceivables({ status: 'pending_approval' })
      .then(rows => setPendingApprovals(rows.map(toInvoice)))
      .catch(err => toast.error(err?.message));
  }, []);

  const fetchInvoices = useCallback(() => {
    setLoading(true);
    // Same reason as Accounts Payable: this list is filtered and totalled in
    // the browser, so it needs every row, not the first page.
    listAllReceivables()
      .then(rows => { setInvoices(rows.filter(r => r.status !== 'rejected').map(toInvoice)); setLoadError(false); })
      .catch(err => { setLoadError(true); toast.error(t('finance:receivable.toast.loadFailed'), { description: err?.message }); })
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    fetchInvoices();
    fetchPendingApprovals();
    void fetchSummary();
  }, [fetchInvoices, fetchPendingApprovals, fetchSummary]);

  async function handleApproveChangeOrder(inv: Invoice) {
    setApproving(inv.id);
    try {
      await approveChangeOrder(inv.id);
      toast.success(
        t('finance:receivable.toast.coApproved'),
        { description: `${inv.invoiceNumber} — ${inv.client}` },
      );
      // CO moves out of pending_approval and into the regular AR list
      fetchPendingApprovals();
      fetchInvoices();
      void fetchSummary();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : undefined;
      toast.error(
        t('finance:receivable.toast.coApproveFailed'),
        { description: message },
      );
    } finally {
      setApproving(null);
    }
  }

  // Filters
  const [filterProject, setFilterProject] = useProjectFilter<string>('all');
  const [filterStatus, setFilterStatus] = useScreenState('estado', 'all');
  const [filterFrom, setFilterFrom] = useScreenState('desde', '');
  const [filterTo, setFilterTo] = useScreenState('hasta', '');

  // Payment dialog
  const [payInvoice, setPayInvoice] = useState<Invoice | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(businessToday());
  const [payMethod, setPayMethod] = useState('Bank transfer');
  const [payRef, setPayRef] = useState('');

  // V88 — edit info dialog (number / client / description / dates / notes)
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null);
  const [editNumber, setEditNumber] = useState('');
  const [editClient, setEditClient] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editIssuedDate, setEditIssuedDate] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  // V88 — delete confirm dialog
  const [deleteInvoice, setDeleteInvoice] = useState<Invoice | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  function openEditDialog(inv: Invoice) {
    setEditInvoice(inv);
    setEditNumber(inv.invoiceNumber);
    setEditClient(inv.client);
    setEditDescription(inv.description ?? '');
    setEditIssuedDate(inv.issuedDate);
    setEditDueDate(inv.dueDate);
    setEditNotes(inv.notes ?? '');
  }

  async function submitEditInfo() {
    if (!editInvoice) return;
    const number = editNumber.trim();
    const client = editClient.trim();
    if (!number || !client) {
      toast.error(t('finance:receivable.edit.requiredFields', 'Number and client are required'));
      return;
    }
    if (editDueDate < editIssuedDate) {
      toast.error(t('finance:invoice.validation.dueDateAfter'));
      return;
    }
    // Send only what changed (partial PATCH, like the payables info edit).
    const payload: Parameters<typeof updateReceivableInfo>[1] = {};
    if (number !== editInvoice.invoiceNumber) payload.invoiceNumber = number;
    if (client !== editInvoice.client) payload.client = client;
    const desc = editDescription.trim();
    if (desc !== (editInvoice.description ?? '')) payload.description = desc || null;
    const notes = editNotes.trim();
    if (notes !== (editInvoice.notes ?? '')) payload.notes = notes || null;
    if (editIssuedDate !== editInvoice.issuedDate) payload.issuedDate = editIssuedDate;
    if (editDueDate !== editInvoice.dueDate) payload.dueDate = editDueDate;
    if (Object.keys(payload).length === 0) {
      setEditInvoice(null);
      return;
    }
    setEditSubmitting(true);
    try {
      await updateReceivableInfo(editInvoice.id, payload);
      toast.success(t('finance:receivable.edit.updated', 'Document updated'));
      setEditInvoice(null);
      fetchInvoices();
      void fetchSummary();
      fetchPendingApprovals();
    } catch (err: unknown) {
      if (err instanceof ApiError && err.code === 'DUPLICATE_INVOICE_NUMBER') {
        toast.error(t('finance:receivable.edit.duplicate', 'That number is already in use'), { description: err.message });
      } else {
        const message = err instanceof Error ? err.message : undefined;
        toast.error(t('finance:receivable.edit.failed', 'Could not update the document'), { description: message });
      }
    } finally {
      setEditSubmitting(false);
    }
  }

  async function submitDeleteReceivable() {
    if (!deleteInvoice) return;
    setDeleteSubmitting(true);
    try {
      await deleteReceivable(deleteInvoice.id);
      toast.success(t('finance:receivable.delete.done', 'Document deleted'), { description: deleteInvoice.invoiceNumber });
      setDeleteInvoice(null);
      fetchInvoices();
      void fetchSummary();
      fetchPendingApprovals();
    } catch (err: unknown) {
      if (err instanceof ApiError && err.code === 'RECEIVABLE_HAS_PAYMENTS') {
        toast.error(t('finance:receivable.delete.hasPayments', 'A document with recorded payments cannot be deleted'), { description: err.message });
      } else {
        const message = err instanceof Error ? err.message : undefined;
        toast.error(t('finance:receivable.delete.failed', 'Could not delete the document'), { description: message });
      }
      setDeleteInvoice(null);
    } finally {
      setDeleteSubmitting(false);
    }
  }

  const [showCreate, setShowCreate] = useState(false);

  const hasFilters = filterProject !== 'all' || filterStatus !== 'all' || filterFrom || filterTo;

  const kpis = summary ? {
    totalReceivable: summary.outstanding,
    collectedThisMonth: summary.collectedThisMonth,
    pendingTotal: summary.pending,
    pendingCount: summary.pendingCount,
    overdueTotal: summary.overdue,
    overdueCount: summary.overdueCount,
  } : null;

  const filtered = useMemo(() => {
    return invoices.filter(inv => {
      if (filterProject !== 'all' && String(inv.projectId) !== filterProject) return false;
      if (filterStatus !== 'all' && inv.status !== filterStatus) return false;
      if (filterFrom && inv.issuedDate < filterFrom) return false;
      if (filterTo && inv.issuedDate > filterTo) return false;
      return true;
    });
  }, [invoices, filterProject, filterStatus, filterFrom, filterTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const totalOutstanding = filtered.reduce((s, i) => s + (i.amount - i.paidAmount), 0);

  const overdueInvoices = invoices.filter(i => i.status === 'overdue');
  const overdueTotal = overdueInvoices.reduce((s, i) => s + (i.amount - i.paidAmount), 0);

  function clearFilters() {
    setFilterProject('all'); setFilterStatus('all'); setFilterFrom(''); setFilterTo('');
    setCurrentPage(1);
  }

  // Payment dialog
  function openPayDialog(inv: Invoice) {
    const balance = inv.amount - inv.paidAmount;
    setPayInvoice(inv);
    setPayAmount(balance.toFixed(2));
    setPayDate(businessToday());
    setPayMethod('Bank transfer');
    setPayRef('');
  }

  async function submitPayment() {
    if (!payInvoice) return;
    const amt = parseFloat(payAmount);
    const balance = payInvoice.amount - payInvoice.paidAmount;
    if (!amt || amt <= 0 || amt > balance || !payDate) {
      toast.error(t('finance:receivable.validation.checkFields'));
      return;
    }
    try {
      const updated = await recordReceivablePayment(payInvoice.id, {
        amount: amt,
        date: payDate,
        method: payMethod,
        reference: payRef || undefined,
      });
      setInvoices(prev => prev.map(inv => inv.id === payInvoice.id ? toInvoice(updated) : inv));
      void fetchSummary();
      toast.success(t('finance:receivable.toast.paymentRegistered', 'Payment of {{amount}} registered for {{invoice}}', { amount: fmtAmount(amt), invoice: payInvoice.invoiceNumber }));
      setPayInvoice(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : undefined;
      toast.error(t('finance:receivable.toast.paymentFailed'), { description: message });
    }
  }

  function openCreateDialog() { setShowCreate(true); }

  return (
    <div className="flex gap-6 items-start">
    <div className="space-y-4 max-w-[1400px] mx-auto flex-1 min-w-0">

      {/* Top bar with New Invoice button */}
      <AccountingHeader kicker={t('finance:accounting.receivables.kicker')} title={t('finance:nav.accountsReceivable')} description={t('finance:accounting.receivables.description')} action={
        <Button onClick={openCreateDialog} className="rounded-none font-bt-mono uppercase tracking-[0.06em] text-[10px] bg-[#0A0A0A] hover:bg-[#C2410C] text-white gap-1.5">
          <Plus className="w-4 h-4" /> {t('finance:receivable.newInvoice')}
        </Button>
      } />

      {/* Change orders pending approval — only render when there's at least one */}
      {pendingApprovals.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-none overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-amber-200 bg-amber-100/50">
            <AlertTriangle className="w-4 h-4 text-amber-700" />
            <span className="text-sm font-semibold text-amber-900">
              {t('finance:receivable.pendingApproval.title')}
            </span>
            <span className="ml-auto text-xs font-medium text-amber-800">
              {t('finance:receivable.pendingApproval.requestCount', { count: pendingApprovals.length })}
            </span>
          </div>
          <div className="divide-y divide-amber-200">
            {pendingApprovals.map(inv => (
              <div key={inv.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[#0A0A0A]">
                    {inv.invoiceNumber} — {inv.client}
                  </div>
                  <div className="text-xs text-[#5A6473] mt-0.5">
                    {inv.project} · {fmtAmount(inv.amount)} · {t('common:labels.issued')} {fmtDate(inv.issuedDate, dateLocale)}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Download the PDF BEFORE approval: the whole point of a
                      change order is to send this document to the client so
                      THEY decide. The PDF is generated client-side and never
                      touches billing state, so it's independent of the
                      approval gate (which only governs whether the amount is
                      billable). */}
                  <Button
                    variant="outline"
                    onClick={async () => downloadInvoicePdf(invoiceToPdfData(inv), await loadInvoiceIssuer(), await loadSignatureForPdf(inv.id))}
                    className="rounded-none font-bt-mono uppercase tracking-[0.06em] text-[10px] text-xs h-8 px-3 border-amber-300 text-amber-800 hover:bg-amber-100 gap-1.5"
                    title={t('finance:receivable.downloadPdf')}
                  >
                    <Download className="w-3.5 h-3.5" />
                    {t('finance:receivable.downloadPdf')}
                  </Button>
                  {isAdmin && (
                    <Button
                      onClick={() => handleApproveChangeOrder(inv)}
                      disabled={approving === inv.id}
                      className="rounded-none font-bt-mono uppercase tracking-[0.06em] text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 px-3"
                    >
                      {approving === inv.id
                        ? t('common:buttons.approving')
                        : t('finance:receivable.pendingApproval.approve')}
                    </Button>
                  )}
                  {/* V88 — a pending CO created by mistake can be removed (it never counted against the contract headroom). */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteInvoice(inv)}
                    disabled={approving === inv.id}
                    className="rounded-none font-bt-mono uppercase tracking-[0.06em] text-[10px] h-8 text-xs border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {t('finance:receivable.delete.action', 'Delete')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {summaryError && <div role="alert" className="text-sm text-red-700">
        {t('finance:receivable.summaryError')}
        <button type="button" onClick={() => void fetchSummary()} className="ml-2 underline">{t('common:buttons.retry')}</button>
      </div>}
      {/* Totals cover the tenant, independent of list filters and pagination. */}
      <p className="text-sm text-[#8A8175]">{t('common:workspace.companySummary')}</p>
      <div className="grid grid-cols-2 xl:grid-cols-4 bg-white border border-[#E7E1D5]" data-tour="sec.accounts-receivable.kpis">
        <AccountingFigure title={t('finance:receivable.kpi.totalReceivable')} value={kpis ? fmtAmount(kpis.totalReceivable) : '—'} subtitle={t('finance:receivable.kpi.allInvoices')} />
        <AccountingFigure title={t('finance:receivable.kpi.collectedThisMonth')} value={kpis ? fmtAmount(kpis.collectedThisMonth) : '—'} subtitle={collectedMonthLabel} tone="green" />
        <AccountingFigure title={t('finance:receivable.kpi.pending')} value={kpis ? fmtAmount(kpis.pendingTotal) : '—'} subtitle={kpis ? t('finance:receivable.invoiceCount', { count: kpis.pendingCount }) : '—'} tone="orange" />
        <AccountingFigure title={t('finance:receivable.kpi.overdue')} value={kpis ? fmtAmount(kpis.overdueTotal) : '—'} subtitle={kpis ? `${t('finance:receivable.invoiceCount', { count: kpis.overdueCount })} · ${t('finance:receivable.kpi.actionRequired')}` : '—'} tone="red" />
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-none border border-[#E7E1D5] p-5" data-tour="sec.accounts-receivable.filters">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-[#8A8175]" />
          <span className="text-sm font-semibold text-[#0A0A0A]">{t('common:buttons.filters')}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {!workspace && <div>
            <label className="font-bt-mono text-[10px] font-semibold text-[#8A8175] uppercase tracking-wide mb-1 block">{t('common:labels.project')}</label>
            <Select value={filterProject} onValueChange={v => { setFilterProject(v); setCurrentPage(1); }}>
              <SelectTrigger className="rounded-none bg-[#FAF7F0] font-bt-mono text-[11px] h-9 text-sm border-[#E7E1D5]"><SelectValue /></SelectTrigger>
              <SelectContent className="rounded-none border-[#DBD0BB]">
                <SelectItem value="all">{t('common:labels.allProjects')}</SelectItem>
                {projects.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>}
          <div>
            <label className="font-bt-mono text-[10px] font-semibold text-[#8A8175] uppercase tracking-wide mb-1 block">{t('common:labels.status')}</label>
            <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); setCurrentPage(1); }}>
              <SelectTrigger className="rounded-none bg-[#FAF7F0] font-bt-mono text-[11px] h-9 text-sm border-[#E7E1D5]"><SelectValue /></SelectTrigger>
              <SelectContent className="rounded-none border-[#DBD0BB]">
                <SelectItem value="all">{t('common:labels.allStatuses')}</SelectItem>
                <SelectItem value="paid">{t('common:status.paid')}</SelectItem>
                <SelectItem value="pending">{t('common:status.pending')}</SelectItem>
                <SelectItem value="partial">{t('common:status.partial', 'Partial')}</SelectItem>
                <SelectItem value="overdue">{t('common:status.overdue')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="font-bt-mono text-[10px] font-semibold text-[#8A8175] uppercase tracking-wide mb-1 block">{t('common:labels.from')}</label>
            <input type="date" value={filterFrom} onChange={e => { setFilterFrom(e.target.value); setCurrentPage(1); }}
              className="h-9 w-full rounded-none border border-[#E7E1D5] px-3 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#F97316]" />
          </div>
          <div>
            <label className="font-bt-mono text-[10px] font-semibold text-[#8A8175] uppercase tracking-wide mb-1 block">{t('common:labels.to')}</label>
            <input type="date" value={filterTo} onChange={e => { setFilterTo(e.target.value); setCurrentPage(1); }}
              className="h-9 w-full rounded-none border border-[#E7E1D5] px-3 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#F97316]" />
          </div>
        </div>
        {hasFilters && (
          <div className="mt-3 pt-3 border-t border-[#FAF7F0]">
            <button onClick={clearFilters} className="text-xs font-medium text-[#C2410C] hover:text-purple-800 transition-colors">
              {t('common:buttons.clearFilters')}
            </button>
          </div>
        )}
      </div>

      {loading && <div role="status" className="text-sm text-[#8A8175]">{t('common:loading')}</div>}
      {/* Table */}
      <div className="bg-white rounded-none border border-[#E7E1D5] overflow-hidden" data-tour="sec.accounts-receivable.table">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-[#E7E1D5]">
          <Receipt className="w-4 h-4 text-[#8A8175]" />
          <span className="text-sm font-semibold text-[#0A0A0A]">{t('finance:receivable.title')}</span>
          <span className="ml-auto text-xs text-[#8A8175]">{t('finance:receivable.invoiceCount', { count: filtered.length })}</span>
        </div>

        {loading ? <TableSkeleton cols="repeat(6, minmax(0, 1fr))" /> : loadError ? (
          <div role="alert"><EmptyWord word={t('finance:accounting.error')} title={t('finance:receivable.toast.loadFailed')} tone="red" className="border-0" action={<Button variant="outline" onClick={fetchInvoices}>{t('common:buttons.retry')}</Button>} /></div>
        ) : filtered.length === 0 ? (
          <EmptyWord word={t('finance:accounting.empty')} title={t('finance:receivable.noInvoices')} hint={t('finance:receivable.noInvoicesHint')} className="border-0" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px]">
              <thead>
                <tr className="bg-[#FAF7F0]">
                  <th className="w-9 px-2" />
                  {[
                    t('finance:receivable.table.invoiceNo'),
                    t('finance:receivable.table.client'),
                    t('finance:receivable.table.project'),
                    t('finance:receivable.table.issueDate'),
                    t('finance:receivable.table.dueDate'),
                    t('finance:receivable.table.amount'),
                    t('finance:receivable.table.paid'),
                    t('finance:receivable.table.balance'),
                    t('finance:receivable.table.status'),
                    t('finance:receivable.table.actions'),
                  ].map(h => (
                    <th key={h} className="text-left font-bt-mono text-[10px] font-semibold text-[#8A8175] uppercase tracking-wider px-3 py-2.5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.flatMap(inv => {
                  const isExpanded = expandedId === inv.id;
                  const balance = inv.amount - inv.paidAmount;
                  const isOverdue = inv.status === 'overdue';
                  return [
                    <tr key={inv.id}
                      className={`border-b border-[#E7E1D5]/50 transition-colors ${isExpanded ? 'bg-[#FAF7F0]' : 'hover:bg-[#FAF7F0]/60'}`}>
                      <td className="py-3 pl-3 pr-0">
                        <button onClick={() => setExpandedId(isExpanded ? null : inv.id)} className="text-[#8A8175] hover:text-[#0A0A0A] transition-colors">
                          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </button>
                      </td>
                      <td className="py-3 px-3 font-bt-mono text-sm text-[#0A0A0A]">{inv.invoiceNumber}</td>
                      <td className="py-3 px-3 text-sm text-[#0A0A0A]">{inv.client}</td>
                      <td className="py-3 px-3 text-sm text-[#8A8175]">{inv.project}</td>
                      <td className="py-3 px-3 text-sm text-[#0A0A0A] whitespace-nowrap">{fmtDate(inv.issuedDate, dateLocale)}</td>
                      <td className={`py-3 px-3 text-sm whitespace-nowrap ${isOverdue ? 'text-red-600 font-medium' : 'text-[#0A0A0A]'}`}>{fmtDate(inv.dueDate, dateLocale)}</td>
                      <td className="py-3 px-3 font-bt-mono font-semibold text-sm text-[#0A0A0A]">{fmtAmount(inv.amount)}</td>
                      <td className={`py-3 px-3 font-bt-mono text-sm ${inv.paidAmount >= inv.amount ? 'text-emerald-600 font-semibold' : 'text-[#0A0A0A]'}`}>{fmtAmount(inv.paidAmount)}</td>
                      <td className={`py-3 px-3 font-bt-mono text-sm font-semibold ${balance === 0 ? 'text-[#E7E1D5]' : isOverdue ? 'text-red-600' : 'text-amber-600'}`}>{fmtAmount(balance)}</td>
                      <td className="py-3 px-3"><StatusBadge status={inv.status} /></td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <Button  variant="outline" size="sm" disabled={inv.status === 'paid'}
                            onClick={() => openPayDialog(inv)}
                            className="rounded-none font-bt-mono uppercase tracking-[0.06em] text-[10px] h-7 text-[11px] border-[#F97316] text-[#C2410C] hover:bg-[#FBEDE0] hover:text-[#C2410C] disabled:opacity-40">
                            {t('finance:receivable.registerPayment')}
                          </Button>
                          <button
                            onClick={async () => downloadInvoicePdf(invoiceToPdfData(inv), await loadInvoiceIssuer(), await loadSignatureForPdf(inv.id))}
                            className="h-7 w-7 flex items-center justify-center rounded-none border border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                            title={t('finance:receivable.downloadPdf')}
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => openEditDialog(inv)}
                            className="h-7 w-7 flex items-center justify-center rounded-none border border-[#E7E1D5] text-[#8A8175] hover:text-[#0A0A0A] hover:border-[#F97316] transition-colors"
                            title={t('finance:receivable.edit.action', 'Edit info')}
                            aria-label={t('finance:receivable.edit.action', 'Edit info')}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteInvoice(inv)}
                            className="h-7 w-7 flex items-center justify-center rounded-none border border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                            title={t('finance:receivable.delete.action', 'Delete')}
                            aria-label={t('finance:receivable.delete.action', 'Delete')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>,
                    ...(isExpanded ? [
                      <tr key={`${inv.id}-detail`} className="bg-[#FAF7F0]/80">
                        <td colSpan={11} className="px-6 py-4 border-b border-[#E7E1D5]/50">
                          <div className="space-y-4">
                            {/* Line Items */}
                            {inv.lineItems.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-[#8A8175] uppercase tracking-wide mb-2">{t('finance:receivable.lineItemsTitle')}</p>
                                <table className="w-full max-w-2xl">
                                  <thead>
                                    <tr>
                                      <th className="text-left text-[10px] font-semibold text-[#8A8175] uppercase tracking-wider px-3 py-1.5">{t('finance:receivable.dialog.itemDesc')}</th>
                                      <th className="text-center text-[10px] font-semibold text-[#8A8175] uppercase tracking-wider px-3 py-1.5">{t('finance:receivable.dialog.itemQty')}</th>
                                      <th className="text-right text-[10px] font-semibold text-[#8A8175] uppercase tracking-wider px-3 py-1.5">{t('finance:receivable.dialog.itemPrice')}</th>
                                      <th className="text-right text-[10px] font-semibold text-[#8A8175] uppercase tracking-wider px-3 py-1.5">{t('finance:receivable.dialog.itemSubtotal')}</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {inv.lineItems.map(li => (
                                      <tr key={li.id} className="border-t border-[#E7E1D5]/30">
                                        <td className="px-3 py-2 text-sm text-[#0A0A0A]">{li.description}</td>
                                        <td className="px-3 py-2 text-sm text-[#8A8175] text-center">{li.quantity}</td>
                                        <td className="px-3 py-2 font-bt-mono text-sm text-[#8A8175] text-right">{fmtAmount(li.unitPrice)}</td>
                                        <td className="px-3 py-2 font-bt-mono text-sm font-semibold text-[#0A0A0A] text-right">{fmtAmount(li.subtotal)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                            {/* Payment History */}
                            <p className="text-xs font-semibold text-[#8A8175] uppercase tracking-wide">{t('finance:receivable.paymentHistory')}</p>
                            {inv.payments.length === 0 ? (
                              <p className="text-sm text-[#8A8175]">{t('finance:receivable.noPayments')}</p>
                            ) : (
                              <table className="w-full max-w-xl">
                                <thead>
                                  <tr>
                                    {[
                                      t('finance:receivable.paymentHistory.date'),
                                      t('finance:receivable.paymentHistory.amount'),
                                      t('finance:receivable.paymentHistory.method'),
                                      t('finance:receivable.paymentHistory.reference'),
                                    ].map(h => (
                                      <th key={h} className="text-left text-[10px] font-semibold text-[#8A8175] uppercase tracking-wider px-3 py-1.5">{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {inv.payments.map(p => (
                                    <tr key={p.id} className={`border-t border-[#E7E1D5]/30 ${p.voided ? 'line-through opacity-50' : ''}`}>
                                      <td className="px-3 py-2 text-sm text-[#0A0A0A]">{fmtDate(p.date, dateLocale)}</td>
                                      <td className="px-3 py-2 font-bt-mono text-sm font-semibold text-emerald-600">{fmtAmount(p.amount)}</td>
                                      <td className="px-3 py-2 text-sm text-[#8A8175]">{paymentMethodLabel(p.method, t)}</td>
                                      <td className="px-3 py-2 font-bt-mono text-sm text-[#8A8175]">{p.reference ?? '—'}{p.voided && <span className="ml-2">{t('finance:receivable.paymentVoided')}</span>}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                            {/* Customer signature — what used to be a blank
                                ruled line at the foot of the printed invoice. */}
                            <div className="pt-2 border-t border-[#E7E1D5]/40">
                              <SignatureRequestPanel receivableId={inv.id} />
                            </div>
                          </div>
                        </td>
                      </tr>,
                    ] : []),
                  ];
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        {filtered.length > 0 && (
          <div className="px-6 py-3 border-t border-[#E7E1D5]/50 bg-[#FAF7F0]/50 flex items-center justify-between flex-wrap gap-2">
            <p className="text-[11px] text-[#8A8175]">{t('finance:receivable.showingOf', { shown: paginated.length, total: filtered.length })}</p>
            <p className="text-[11px] font-medium text-[#0A0A0A]">
              {t('finance:receivable.totalOutstanding')} <span className="font-bt-mono font-semibold">{fmtAmount(totalOutstanding)}</span>
            </p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 px-6 py-3 border-t border-[#E7E1D5]/50">
            <Button  variant="outline" size="sm" disabled={currentPage <= 1}
              onClick={() => setCurrentPage(p => p - 1)} className="rounded-none font-bt-mono uppercase tracking-[0.06em] text-[10px] h-8 text-xs border-[#E7E1D5]">{t('common:buttons.previous')}</Button>
            <span className="text-xs text-[#8A8175]">{t('finance:receivable.pageOf', { current: currentPage, total: totalPages })}</span>
            <Button  variant="outline" size="sm" disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(p => p + 1)} className="rounded-none font-bt-mono uppercase tracking-[0.06em] text-[10px] h-8 text-xs border-[#E7E1D5]">{t('common:buttons.nextSimple')}</Button>
          </div>
        )}
      </div>

      {/* Overdue alerts */}
      {overdueInvoices.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-none p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <span className="text-sm font-semibold text-red-700">
              {t('finance:receivable.alert.overdue', { count: overdueInvoices.length, amount: fmtAmount(overdueTotal) })}
            </span>
          </div>
          <div className="space-y-2">
            {overdueInvoices.map(inv => (
              <div key={inv.id} className="flex items-center justify-between text-sm bg-white/60 rounded-none px-4 py-2">
                <div className="flex items-center gap-3">
                  <span className="font-bt-mono text-[#0A0A0A]">{inv.invoiceNumber}</span>
                  <span className="text-[#8A8175]">{inv.client}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-red-600 font-medium">{t('common:labels.daysOverdue', { count: daysOverdue(inv.dueDate) })}</span>
                  <span className="font-bt-mono font-semibold text-red-700">{fmtAmount(inv.amount - inv.paidAmount)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* V88 — Edit info dialog */}
      <Dialog open={!!editInvoice} onOpenChange={open => { if (!open) setEditInvoice(null); }}>
        <DialogContent className="rounded-none border-[#DBD0BB] bg-[#FAF7F0] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-bt-display uppercase tracking-wide text-2xl">
              {t('finance:receivable.edit.title', 'Edit document')} — <span className="font-bt-mono">{editInvoice?.invoiceNumber}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bt-mono text-[10px] font-semibold text-[#8A8175] uppercase tracking-wide mb-1 block">{t('finance:receivable.dialog.invoiceNo')}</label>
                <input type="text" value={editNumber} onChange={e => setEditNumber(e.target.value)}
                  className="h-9 w-full rounded-none border border-[#E7E1D5] px-3 font-bt-mono text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#F97316]" />
              </div>
              <div>
                <label className="font-bt-mono text-[10px] font-semibold text-[#8A8175] uppercase tracking-wide mb-1 block">{t('finance:receivable.dialog.client')}</label>
                <input type="text" value={editClient} onChange={e => setEditClient(e.target.value)}
                  className="h-9 w-full rounded-none border border-[#E7E1D5] px-3 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#F97316]" />
              </div>
              <div>
                <label className="font-bt-mono text-[10px] font-semibold text-[#8A8175] uppercase tracking-wide mb-1 block">{t('finance:receivable.dialog.issueDate')}</label>
                <input type="date" value={editIssuedDate} onChange={e => setEditIssuedDate(e.target.value)}
                  className="h-9 w-full rounded-none border border-[#E7E1D5] px-3 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#F97316]" />
              </div>
              <div>
                <label className="font-bt-mono text-[10px] font-semibold text-[#8A8175] uppercase tracking-wide mb-1 block">{t('finance:receivable.dialog.dueDate')}</label>
                <input type="date" value={editDueDate} onChange={e => setEditDueDate(e.target.value)}
                  className="h-9 w-full rounded-none border border-[#E7E1D5] px-3 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#F97316]" />
              </div>
            </div>
            <div>
              <label className="font-bt-mono text-[10px] font-semibold text-[#8A8175] uppercase tracking-wide mb-1 block">{t('finance:receivable.dialog.description')}</label>
              <input type="text" value={editDescription} onChange={e => setEditDescription(e.target.value)}
                className="h-9 w-full rounded-none border border-[#E7E1D5] px-3 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#F97316]" />
            </div>
            <div>
              <label className="font-bt-mono text-[10px] font-semibold text-[#8A8175] uppercase tracking-wide mb-1 block">{t('finance:receivable.dialog.notes')}</label>
              <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={2}
                className="w-full rounded-none border border-[#E7E1D5] px-3 py-2 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#F97316] resize-none" />
            </div>
            <p className="text-[11px] text-[#8A8175]">{t('finance:receivable.edit.amountsHint', 'Amounts are not editable: delete the document and create it again while it has no payments.')}</p>
          </div>
          <DialogFooter>
            <Button className="rounded-none font-bt-mono uppercase tracking-[0.06em] text-[10px]" variant="ghost" onClick={() => setEditInvoice(null)}>{t('common:buttons.cancel')}</Button>
            <Button onClick={submitEditInfo} disabled={editSubmitting}
              className="rounded-none font-bt-mono uppercase tracking-[0.06em] text-[10px] bg-[#0A0A0A] hover:bg-[#C2410C] text-white disabled:opacity-50">
              {t('common:buttons.save', 'Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* V88 — Delete confirm dialog */}
      <Dialog open={!!deleteInvoice} onOpenChange={open => { if (!open) setDeleteInvoice(null); }}>
        <DialogContent className="rounded-none border-[#DBD0BB] bg-[#FAF7F0] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-bt-display uppercase tracking-wide text-2xl text-red-600">
              {t('finance:receivable.delete.title', 'Delete document')} — <span className="font-bt-mono">{deleteInvoice?.invoiceNumber}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-1 text-sm text-[#0A0A0A]">
            <p>{t('finance:receivable.delete.confirmText', 'The document will disappear from accounts receivable. This cannot be undone from the app.')}</p>
            {deleteInvoice?.documentType === 'CHANGE_ORDER_REQUEST' && deleteInvoice.status !== 'pending_approval' && (
              <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded-none px-3 py-2 text-xs">
                {t('finance:receivable.delete.coHeadroomNote', 'This approved change order occupies contract headroom; deleting it frees that headroom.')}
              </p>
            )}
            {deleteInvoice?.documentType === 'CHANGE_ORDER_REQUEST' && deleteInvoice.status === 'pending_approval' && (
              <p className="text-[#8A8175] text-xs">
                {t('finance:receivable.delete.coPendingNote', 'This request has not been approved — deleting it acts as a rejection and never counted against the contract.')}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button className="rounded-none font-bt-mono uppercase tracking-[0.06em] text-[10px]" variant="ghost" onClick={() => setDeleteInvoice(null)}>{t('common:buttons.cancel')}</Button>
            <Button onClick={submitDeleteReceivable} disabled={deleteSubmitting}
              className="rounded-none font-bt-mono uppercase tracking-[0.06em] text-[10px] bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 gap-1.5">
              <Trash2 className="w-3.5 h-3.5" />
              {t('finance:receivable.delete.action', 'Delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Register Payment Dialog */}
      <Dialog open={!!payInvoice} onOpenChange={open => { if (!open) setPayInvoice(null); }}>
        <DialogContent className="rounded-none border-[#DBD0BB] bg-[#FAF7F0] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-bt-display uppercase tracking-wide text-2xl">{t('finance:receivable.dialog.registerPayment')} — {payInvoice?.invoiceNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="font-bt-mono text-[10px] font-semibold text-[#8A8175] uppercase tracking-wide mb-1 block">
                {t('finance:receivable.dialog.amount', { max: payInvoice ? fmtAmount(payInvoice.amount - payInvoice.paidAmount) : '$0.00' })}
              </label>
              <input type="number" step="0.01" min="0.01"
                max={payInvoice ? payInvoice.amount - payInvoice.paidAmount : 0}
                value={payAmount} onChange={e => setPayAmount(e.target.value)}
                className="h-9 w-full rounded-none border border-[#E7E1D5] px-3 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#F97316]" />
            </div>
            <div>
              <label className="font-bt-mono text-[10px] font-semibold text-[#8A8175] uppercase tracking-wide mb-1 block">{t('finance:receivable.dialog.paymentDate')}</label>
              <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)}
                className="h-9 w-full rounded-none border border-[#E7E1D5] px-3 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#F97316]" />
            </div>
            <div>
              <label className="font-bt-mono text-[10px] font-semibold text-[#8A8175] uppercase tracking-wide mb-1 block">{t('finance:receivable.dialog.method')}</label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger className="rounded-none bg-[#FAF7F0] font-bt-mono text-[11px] h-9 text-sm border-[#E7E1D5]"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-none border-[#DBD0BB]">
                  <SelectItem value="Bank transfer">{t('finance:paymentMethod.bankTransfer')}</SelectItem>
                  <SelectItem value="Check">{t('finance:paymentMethod.check')}</SelectItem>
                  <SelectItem value="Cash">{t('finance:paymentMethod.cash')}</SelectItem>
                  <SelectItem value="Other">{t('finance:paymentMethod.other')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="font-bt-mono text-[10px] font-semibold text-[#8A8175] uppercase tracking-wide mb-1 block">{t('finance:receivable.dialog.reference')}</label>
              <input type="text" value={payRef} onChange={e => setPayRef(e.target.value)} placeholder={t('finance:receivable.dialog.referencePlaceholder')} maxLength={FIELD_LIMITS.REFERENCE}
                className="h-9 w-full rounded-none border border-[#E7E1D5] px-3 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#F97316]" />
            </div>
          </div>
          <DialogFooter>
            <Button className="rounded-none font-bt-mono uppercase tracking-[0.06em] text-[10px]" variant="ghost" onClick={() => setPayInvoice(null)}>{t('common:buttons.cancel')}</Button>
            <Button onClick={submitPayment} className="rounded-none font-bt-mono uppercase tracking-[0.06em] text-[10px] bg-[#0A0A0A] hover:bg-[#C2410C] text-white">{t('finance:receivable.registerPayment')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Invoice Dialog */}
      {showCreate && <InvoiceWindow
        onClose={() => setShowCreate(false)}
        onCreated={() => {
          setShowCreate(false);
          fetchInvoices();
          fetchPendingApprovals();
          void fetchSummary();
        }}
        onOpenBranding={isAdmin && onNavigate ? () => { if (workspace) workspace.navigateSection('invoice-branding'); else { setShowCreate(false); onNavigate('invoice-branding'); } } : undefined}
      />}
    </div>

    {/* Generated PDFs panel (right side) */}

    </div>
  );
}
