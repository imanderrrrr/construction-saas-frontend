import { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Receipt, DollarSign, Clock, AlertTriangle,
  ChevronDown, ChevronRight, Filter, Plus, Upload, FileText, CircleX, Trash2,
  Download,
} from 'lucide-react';
import { Button } from './ui/button';
import { StatCard } from './StatCard';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from './ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from './ui/select';
import { EmptyState } from './EmptyState';
import { toast } from 'sonner';
import {
  listReceivables, createReceivable, recordReceivablePayment, approveChangeOrder,
  type Receivable, type ReceivablePayment as ApiReceivablePayment, type ReceivableLineItem,
  type DocumentType,
} from '../services/finance';
import { listProjects } from '../services/projects';
import { listClients, type ClientResponse } from '../services/clients';
import { generateInvoicePdf, downloadInvoicePdf, type InvoicePdfData } from '../helpers/exportInvoicePdf';

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

interface DraftLineItem {
  description: string;
  quantity: string;
  unitPrice: string;
}

// Helpers

import { fmtDate, businessToday, daysOverdue, currentMonth } from '../helpers/dateTime';

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

const EMPTY_LINE_ITEM: DraftLineItem = { description: '', quantity: '1', unitPrice: '' };

interface GeneratedPdf {
  id: number;
  invoiceNumber: string;
  client: string;
  project: string;
  date: string;
  filename: string;
  blob: Blob;
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
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${map[status] ?? map.pending}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'paid' ? 'bg-emerald-500' : status === 'partial' ? 'bg-blue-500' : status === 'pending' ? 'bg-amber-500' : 'bg-red-500'}`} />
      {labelMap[status]}
    </span>
  );
}

// Component

export function AccountsReceivable() {
  const { t, i18n } = useTranslation(['finance', 'common']);
  const dateLocale = i18n.language === 'es' ? 'es' : 'en-US';

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [clients, setClients] = useState<ClientResponse[]>([]);
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
  const [generatedPdfs, setGeneratedPdfs] = useState<GeneratedPdf[]>([]);

  const [pendingApprovals, setPendingApprovals] = useState<Invoice[]>([]);
  const [approving, setApproving] = useState<number | null>(null);

  const fetchPendingApprovals = useCallback(() => {
    listReceivables({ size: 200, status: 'pending_approval' })
      .then(res => setPendingApprovals(res.content.map(toInvoice)))
      .catch(err => toast.error(err?.message));
  }, []);

  const fetchInvoices = useCallback(() => {
    setLoading(true);
    listReceivables({ size: 200 })
      .then(res => setInvoices(res.content.map(toInvoice)))
      .catch(err => toast.error(t('finance:receivable.toast.loadFailed'), { description: err?.message }))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    fetchInvoices();
    fetchPendingApprovals();
    listClients(undefined, 'ACTIVE', 0, 200).then(r => setClients(r.content)).catch(err => toast.error(err?.message));
    listProjects({ page: 0, size: 200 }).then(r => setProjects(r.content.map((p: { id: number; name: string }) => ({ id: p.id, name: p.name })))).catch(err => toast.error(err?.message));
  }, [fetchInvoices, fetchPendingApprovals]);

  async function handleApproveChangeOrder(inv: Invoice) {
    setApproving(inv.id);
    try {
      await approveChangeOrder(inv.id);
      toast.success(
        t('finance:receivable.toast.coApproved', 'Change order approved'),
        { description: `${inv.invoiceNumber} — ${inv.client}` },
      );
      // CO moves out of pending_approval and into the regular AR list
      fetchPendingApprovals();
      fetchInvoices();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : undefined;
      toast.error(
        t('finance:receivable.toast.coApproveFailed', 'Failed to approve change order'),
        { description: message },
      );
    } finally {
      setApproving(null);
    }
  }

  // Filters
  const [filterProject, setFilterProject] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  // Payment dialog
  const [payInvoice, setPayInvoice] = useState<Invoice | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(businessToday());
  const [payMethod, setPayMethod] = useState('Bank transfer');
  const [payRef, setPayRef] = useState('');

  // Create invoice dialog
  const [showCreate, setShowCreate] = useState(false);
  const [newInvNumber, setNewInvNumber] = useState('');
  const [newClient, setNewClient] = useState('');
  const [newClientOther, setNewClientOther] = useState('');
  const [newProject, setNewProject] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newLineItems, setNewLineItems] = useState<DraftLineItem[]>([{ ...EMPTY_LINE_ITEM }]);
  const [newIssueDate, setNewIssueDate] = useState(businessToday());
  const [newDueDate, setNewDueDate] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newFiles, setNewFiles] = useState<File[]>([]);

  // Line items helpers
  const lineItemsTotal = useMemo(() =>
    newLineItems.reduce((s, li) => {
      const q = parseFloat(li.quantity) || 0;
      const p = parseFloat(li.unitPrice) || 0;
      return s + q * p;
    }, 0),
  [newLineItems]);

  function updateLineItem(idx: number, field: keyof DraftLineItem, value: string) {
    setNewLineItems(prev => prev.map((li, i) => i === idx ? { ...li, [field]: value } : li));
  }
  function addLineItem() {
    setNewLineItems(prev => [...prev, { ...EMPTY_LINE_ITEM }]);
  }
  function removeLineItem(idx: number) {
    setNewLineItems(prev => prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx));
  }

  const hasFilters = filterProject !== 'all' || filterStatus !== 'all' || filterFrom || filterTo;

  // Computed KPIs
  const kpis = useMemo(() => {
    const nonPaid = invoices.filter(i => i.status !== 'paid');
    const totalReceivable = nonPaid.reduce((s, i) => s + i.amount, 0);
    const cm = currentMonth();
    const collectedThisMonth = invoices.reduce((s, i) => {
      return s + i.payments.filter(p => p.date.startsWith(cm)).reduce((ps, p) => ps + p.amount, 0);
    }, 0);
    const pending = invoices.filter(i => i.status === 'pending');
    const pendingTotal = pending.reduce((s, i) => s + (i.amount - i.paidAmount), 0);
    const overdue = invoices.filter(i => i.status === 'overdue');
    const overdueTotal = overdue.reduce((s, i) => s + (i.amount - i.paidAmount), 0);
    return { totalReceivable, collectedThisMonth, pendingTotal, pendingCount: pending.length, overdueTotal, overdueCount: overdue.length };
  }, [invoices]);

  const filtered = useMemo(() => {
    return invoices.filter(inv => {
      if (filterProject !== 'all' && inv.project !== filterProject) return false;
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
      toast.success(`Payment of ${fmtAmount(amt)} registered for ${payInvoice.invoiceNumber}`);
      setPayInvoice(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : undefined;
      toast.error(t('finance:receivable.toast.paymentFailed'), { description: message });
    }
  }

  // Create invoice
  function openCreateDialog() {
    const maxNum = invoices.reduce((m, i) => {
      const n = parseInt(i.invoiceNumber.split('-').pop() ?? '0');
      return n > m ? n : m;
    }, 0);
    setNewInvNumber(`INV-2026-${String(maxNum + 1).padStart(3, '0')}`);
    setNewClient('');
    setNewClientOther('');
    setNewProject('');
    setNewDesc('');
    setNewLineItems([{ ...EMPTY_LINE_ITEM }]);
    setNewIssueDate(businessToday());
    setNewDueDate('');
    setNewNotes('');
    setNewFiles([]);
    setShowCreate(true);
  }

  async function submitCreate() {
    const client = newClient === 'Other' ? newClientOther.trim() : newClient;
    const selectedProject = projects.find(p => p.name === newProject);

    // Validate line items
    const validItems = newLineItems.filter(li => li.description.trim() && parseFloat(li.unitPrice) > 0);
    if (!client || !selectedProject || !newIssueDate || !newDueDate || validItems.length === 0) {
      toast.error(t('finance:receivable.validation.requiredFields'));
      return;
    }
    if (newDueDate < newIssueDate) {
      toast.error(t('finance:receivable.validation.dueDateAfter'));
      return;
    }
    try {
      const created = await createReceivable({
        invoiceNumber: newInvNumber || undefined,
        client,
        projectId: selectedProject.id,
        description: newDesc.trim() || undefined,
        issuedDate: newIssueDate,
        dueDate: newDueDate,
        lineItems: validItems.map(li => ({
          description: li.description.trim(),
          quantity: parseFloat(li.quantity) || 1,
          unitPrice: parseFloat(li.unitPrice),
        })),
        notes: newNotes.trim() || undefined,
      });
      setInvoices(prev => [toInvoice(created), ...prev]);
      toast.success(`Invoice ${created.invoiceNumber} created successfully`);

      // Generate PDF for the new invoice
      try {
        const inv = toInvoice(created);
        const pdfData = invoiceToPdfData(inv);
        const { blob, filename } = generateInvoicePdf(pdfData);
        setGeneratedPdfs(prev => [{
          id: created.id,
          invoiceNumber: created.invoiceNumber,
          client: created.client,
          project: created.project,
          date: created.issuedDate,
          filename,
          blob,
        }, ...prev]);
      } catch {
        // PDF generation is non-critical; invoice was already created
      }

      setShowCreate(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : undefined;
      toast.error(t('finance:receivable.toast.createFailed'), { description: message });
    }
  }

  // PDF download helper
  function handleDownloadPdf(pdf: GeneratedPdf) {
    const url = URL.createObjectURL(pdf.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = pdf.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex gap-6 items-start">
    <div className="space-y-6 max-w-6xl flex-1 min-w-0">

      {/* Top bar with New Invoice button */}
      <div className="flex items-center justify-end">
        <Button onClick={openCreateDialog} className="bg-purple-600 hover:bg-purple-700 text-white gap-1.5">
          <Plus className="w-4 h-4" /> {t('finance:receivable.newInvoice')}
        </Button>
      </div>

      {/* Change orders pending approval — only render when there's at least one */}
      {pendingApprovals.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-amber-200 bg-amber-100/50">
            <AlertTriangle className="w-4 h-4 text-amber-700" />
            <span className="text-sm font-semibold text-amber-900">
              {t('finance:receivable.pendingApproval.title', 'Change orders pending approval')}
            </span>
            <span className="ml-auto text-xs font-medium text-amber-800">
              {pendingApprovals.length} {pendingApprovals.length === 1 ? 'request' : 'requests'}
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
                    {inv.project} · {fmtAmount(inv.amount)} · {t('common:labels.issued', 'Issued')} {fmtDate(inv.issuedDate, dateLocale)}
                  </div>
                </div>
                <Button
                  onClick={() => handleApproveChangeOrder(inv)}
                  disabled={approving === inv.id}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 px-3"
                >
                  {approving === inv.id
                    ? t('common:buttons.approving', 'Approving…')
                    : t('finance:receivable.pendingApproval.approve', 'Approve')}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI cards — computed from state */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Receipt}        title={t('finance:receivable.kpi.totalReceivable')}     value={fmtAmount(kpis.totalReceivable)}   subtitle={t('finance:receivable.kpi.allInvoices')}                                           iconBgColor="bg-purple-50"  iconColor="text-purple-600" />
        <StatCard icon={DollarSign}     title={t('finance:receivable.kpi.collectedThisMonth')} value={fmtAmount(kpis.collectedThisMonth)} subtitle="Feb 2026"                                                     iconBgColor="bg-emerald-50" iconColor="text-emerald-600" />
        <StatCard icon={Clock}          title={t('finance:receivable.kpi.pending')}              value={fmtAmount(kpis.pendingTotal)}       subtitle={`${kpis.pendingCount} invoice${kpis.pendingCount !== 1 ? 's' : ''}`} iconBgColor="bg-amber-50"   iconColor="text-amber-600" />
        <StatCard icon={AlertTriangle}  title={t('finance:receivable.kpi.overdue')}              value={fmtAmount(kpis.overdueTotal)}       subtitle={`${kpis.overdueCount} invoice${kpis.overdueCount !== 1 ? 's' : ''} · ${t('finance:receivable.kpi.actionRequired')}`} iconBgColor="bg-red-50" iconColor="text-red-600" />
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-[#71717A]" />
          <span className="text-sm font-semibold text-[#0A0A0A]">{t('common:buttons.filters')}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1 block">{t('common:labels.project')}</label>
            <Select value={filterProject} onValueChange={v => { setFilterProject(v); setCurrentPage(1); }}>
              <SelectTrigger className="h-9 text-sm border-[#D4D4D8]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common:labels.allProjects')}</SelectItem>
                {projects.map(p => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1 block">{t('common:labels.status')}</label>
            <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); setCurrentPage(1); }}>
              <SelectTrigger className="h-9 text-sm border-[#D4D4D8]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common:labels.allStatuses')}</SelectItem>
                <SelectItem value="paid">{t('common:status.paid')}</SelectItem>
                <SelectItem value="pending">{t('common:status.pending')}</SelectItem>
                <SelectItem value="partial">{t('common:status.partial', 'Partial')}</SelectItem>
                <SelectItem value="overdue">{t('common:status.overdue')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1 block">{t('common:labels.from')}</label>
            <input type="date" value={filterFrom} onChange={e => { setFilterFrom(e.target.value); setCurrentPage(1); }}
              className="h-9 w-full rounded-md border border-[#D4D4D8] px-3 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-purple-400" />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1 block">{t('common:labels.to')}</label>
            <input type="date" value={filterTo} onChange={e => { setFilterTo(e.target.value); setCurrentPage(1); }}
              className="h-9 w-full rounded-md border border-[#D4D4D8] px-3 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-purple-400" />
          </div>
        </div>
        {hasFilters && (
          <div className="mt-3 pt-3 border-t border-[#FAFAFA]">
            <button onClick={clearFilters} className="text-xs font-medium text-purple-600 hover:text-purple-800 transition-colors">
              {t('common:buttons.clearFilters')}
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-[#D4D4D8]">
          <Receipt className="w-4 h-4 text-[#71717A]" />
          <span className="text-sm font-semibold text-[#0A0A0A]">{t('finance:receivable.title')}</span>
          <span className="ml-auto text-xs text-[#71717A]">{filtered.length} invoice{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        {filtered.length === 0 ? (
          <div className="py-8">
            <EmptyState icon={Receipt} title={t('finance:receivable.noInvoices')} description={t('finance:receivable.noInvoicesHint')} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px]">
              <thead>
                <tr className="bg-[#FAFAFA]">
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
                    <th key={h} className="text-left text-[11px] font-semibold text-[#71717A] uppercase tracking-wider px-3 py-2.5">{h}</th>
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
                      className={`border-b border-[#D4D4D8]/50 transition-colors ${isExpanded ? 'bg-[#FAFAFA]' : 'hover:bg-[#FAFAFA]/60'}`}>
                      <td className="py-3 pl-3 pr-0">
                        <button onClick={() => setExpandedId(isExpanded ? null : inv.id)} className="text-[#71717A] hover:text-[#0A0A0A] transition-colors">
                          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </button>
                      </td>
                      <td className="py-3 px-3 font-mono text-sm text-[#0A0A0A]">{inv.invoiceNumber}</td>
                      <td className="py-3 px-3 text-sm text-[#0A0A0A]">{inv.client}</td>
                      <td className="py-3 px-3 text-sm text-[#71717A]">{inv.project}</td>
                      <td className="py-3 px-3 text-sm text-[#0A0A0A] whitespace-nowrap">{fmtDate(inv.issuedDate, dateLocale)}</td>
                      <td className={`py-3 px-3 text-sm whitespace-nowrap ${isOverdue ? 'text-red-600 font-medium' : 'text-[#0A0A0A]'}`}>{fmtDate(inv.dueDate, dateLocale)}</td>
                      <td className="py-3 px-3 font-mono font-semibold text-sm text-[#0A0A0A]">{fmtAmount(inv.amount)}</td>
                      <td className={`py-3 px-3 font-mono text-sm ${inv.paidAmount >= inv.amount ? 'text-emerald-600 font-semibold' : 'text-[#0A0A0A]'}`}>{fmtAmount(inv.paidAmount)}</td>
                      <td className={`py-3 px-3 font-mono text-sm font-semibold ${balance === 0 ? 'text-[#D4D4D8]' : isOverdue ? 'text-red-600' : 'text-amber-600'}`}>{fmtAmount(balance)}</td>
                      <td className="py-3 px-3"><StatusBadge status={inv.status} /></td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <Button variant="outline" size="sm" disabled={inv.status === 'paid'}
                            onClick={() => openPayDialog(inv)}
                            className="h-7 text-[11px] border-purple-300 text-purple-600 hover:bg-purple-50 hover:text-purple-700 disabled:opacity-40">
                            {t('finance:receivable.registerPayment')}
                          </Button>
                          <button
                            onClick={() => downloadInvoicePdf(invoiceToPdfData(inv))}
                            className="h-7 w-7 flex items-center justify-center rounded-md border border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                            title="Download PDF"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>,
                    ...(isExpanded ? [
                      <tr key={`${inv.id}-detail`} className="bg-[#FAFAFA]/80">
                        <td colSpan={11} className="px-6 py-4 border-b border-[#D4D4D8]/50">
                          <div className="space-y-4">
                            {/* Line Items */}
                            {inv.lineItems.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-[#71717A] uppercase tracking-wide mb-2">{t('finance:receivable.lineItemsTitle')}</p>
                                <table className="w-full max-w-2xl">
                                  <thead>
                                    <tr>
                                      <th className="text-left text-[10px] font-semibold text-[#71717A] uppercase tracking-wider px-3 py-1.5">{t('finance:receivable.dialog.itemDesc')}</th>
                                      <th className="text-center text-[10px] font-semibold text-[#71717A] uppercase tracking-wider px-3 py-1.5">{t('finance:receivable.dialog.itemQty')}</th>
                                      <th className="text-right text-[10px] font-semibold text-[#71717A] uppercase tracking-wider px-3 py-1.5">{t('finance:receivable.dialog.itemPrice')}</th>
                                      <th className="text-right text-[10px] font-semibold text-[#71717A] uppercase tracking-wider px-3 py-1.5">{t('finance:receivable.dialog.itemSubtotal')}</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {inv.lineItems.map(li => (
                                      <tr key={li.id} className="border-t border-[#D4D4D8]/30">
                                        <td className="px-3 py-2 text-sm text-[#0A0A0A]">{li.description}</td>
                                        <td className="px-3 py-2 text-sm text-[#71717A] text-center">{li.quantity}</td>
                                        <td className="px-3 py-2 font-mono text-sm text-[#71717A] text-right">{fmtAmount(li.unitPrice)}</td>
                                        <td className="px-3 py-2 font-mono text-sm font-semibold text-[#0A0A0A] text-right">{fmtAmount(li.subtotal)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                            {/* Payment History */}
                            <p className="text-xs font-semibold text-[#71717A] uppercase tracking-wide">{t('finance:receivable.paymentHistory')}</p>
                            {inv.payments.length === 0 ? (
                              <p className="text-sm text-[#71717A]">{t('finance:receivable.noPayments')}</p>
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
                                      <th key={h} className="text-left text-[10px] font-semibold text-[#71717A] uppercase tracking-wider px-3 py-1.5">{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {inv.payments.map(p => (
                                    <tr key={p.id} className="border-t border-[#D4D4D8]/30">
                                      <td className="px-3 py-2 text-sm text-[#0A0A0A]">{fmtDate(p.date, dateLocale)}</td>
                                      <td className="px-3 py-2 font-mono text-sm font-semibold text-emerald-600">{fmtAmount(p.amount)}</td>
                                      <td className="px-3 py-2 text-sm text-[#71717A]">{p.method}</td>
                                      <td className="px-3 py-2 font-mono text-sm text-[#71717A]">{p.reference ?? '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
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
          <div className="px-6 py-3 border-t border-[#D4D4D8]/50 bg-[#FAFAFA]/50 flex items-center justify-between flex-wrap gap-2">
            <p className="text-[11px] text-[#71717A]">{t('finance:receivable.showingOf', { shown: paginated.length, total: filtered.length })}</p>
            <p className="text-[11px] font-medium text-[#0A0A0A]">
              {t('finance:receivable.totalOutstanding')} <span className="font-mono font-semibold">{fmtAmount(totalOutstanding)}</span>
            </p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 px-6 py-3 border-t border-[#D4D4D8]/50">
            <Button variant="outline" size="sm" disabled={currentPage <= 1}
              onClick={() => setCurrentPage(p => p - 1)} className="h-8 text-xs border-[#D4D4D8]">{t('common:buttons.previous')}</Button>
            <span className="text-xs text-[#71717A]">{t('finance:receivable.pageOf', { current: currentPage, total: totalPages })}</span>
            <Button variant="outline" size="sm" disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(p => p + 1)} className="h-8 text-xs border-[#D4D4D8]">{t('common:buttons.nextSimple')}</Button>
          </div>
        )}
      </div>

      {/* Overdue alerts */}
      {overdueInvoices.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <span className="text-sm font-semibold text-red-700">
              {t('finance:receivable.alert.overdue', { count: overdueInvoices.length, amount: fmtAmount(overdueTotal) })}
            </span>
          </div>
          <div className="space-y-2">
            {overdueInvoices.map(inv => (
              <div key={inv.id} className="flex items-center justify-between text-sm bg-white/60 rounded-lg px-4 py-2">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[#0A0A0A]">{inv.invoiceNumber}</span>
                  <span className="text-[#71717A]">{inv.client}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-red-600 font-medium">{t('common:labels.daysOverdue', { count: daysOverdue(inv.dueDate) })}</span>
                  <span className="font-mono font-semibold text-red-700">{fmtAmount(inv.amount - inv.paidAmount)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Register Payment Dialog */}
      <Dialog open={!!payInvoice} onOpenChange={open => { if (!open) setPayInvoice(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('finance:receivable.dialog.registerPayment')} — {payInvoice?.invoiceNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1 block">
                {t('finance:receivable.dialog.amount', { max: payInvoice ? fmtAmount(payInvoice.amount - payInvoice.paidAmount) : '$0.00' })}
              </label>
              <input type="number" step="0.01" min="0.01"
                max={payInvoice ? payInvoice.amount - payInvoice.paidAmount : 0}
                value={payAmount} onChange={e => setPayAmount(e.target.value)}
                className="h-9 w-full rounded-md border border-[#D4D4D8] px-3 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-purple-400" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1 block">{t('finance:receivable.dialog.paymentDate')}</label>
              <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)}
                className="h-9 w-full rounded-md border border-[#D4D4D8] px-3 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-purple-400" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1 block">{t('finance:receivable.dialog.method')}</label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger className="h-9 text-sm border-[#D4D4D8]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bank transfer">{t('finance:paymentMethod.bankTransfer')}</SelectItem>
                  <SelectItem value="Check">{t('finance:paymentMethod.check')}</SelectItem>
                  <SelectItem value="Cash">{t('finance:paymentMethod.cash')}</SelectItem>
                  <SelectItem value="Other">{t('finance:paymentMethod.other')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1 block">{t('finance:receivable.dialog.reference')}</label>
              <input type="text" value={payRef} onChange={e => setPayRef(e.target.value)} placeholder={t('finance:receivable.dialog.referencePlaceholder')}
                className="h-9 w-full rounded-md border border-[#D4D4D8] px-3 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-purple-400" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPayInvoice(null)}>{t('common:buttons.cancel')}</Button>
            <Button onClick={submitPayment} className="bg-purple-600 hover:bg-purple-700 text-white">{t('finance:receivable.registerPayment')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Invoice Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('finance:receivable.dialog.createInvoice')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
            <div>
              <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1 block">{t('finance:receivable.dialog.invoiceNo')}</label>
              <input type="text" value={newInvNumber} onChange={e => setNewInvNumber(e.target.value)}
                className="h-9 w-full rounded-md border border-[#D4D4D8] px-3 text-sm text-[#0A0A0A] font-mono focus:outline-none focus:ring-2 focus:ring-purple-400" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1 block">{t('finance:receivable.dialog.client')}</label>
              <Select value={newClient} onValueChange={setNewClient}>
                <SelectTrigger className="h-9 text-sm border-[#D4D4D8]"><SelectValue placeholder={t('finance:receivable.dialog.selectClient')} /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                  <SelectItem value="Other">{t('finance:receivable.dialog.clientOther')}</SelectItem>
                </SelectContent>
              </Select>
              {newClient === 'Other' && (
                <input type="text" value={newClientOther} onChange={e => setNewClientOther(e.target.value)}
                  placeholder={t('finance:receivable.dialog.clientPlaceholder')} className="mt-2 h-9 w-full rounded-md border border-[#D4D4D8] px-3 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-purple-400" />
              )}
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1 block">{t('finance:receivable.dialog.project')}</label>
              <Select value={newProject} onValueChange={setNewProject}>
                <SelectTrigger className="h-9 text-sm border-[#D4D4D8]"><SelectValue placeholder={t('finance:receivable.dialog.projectPlaceholder')} /></SelectTrigger>
                <SelectContent>
                  {projects.map(p => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1 block">{t('finance:receivable.dialog.description')}</label>
              <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={2} placeholder={t('finance:receivable.dialog.descriptionPlaceholder')}
                className="w-full rounded-md border border-[#D4D4D8] px-3 py-2 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none" />
            </div>
            {/* Line Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('finance:receivable.dialog.lineItems')}</label>
                <button type="button" onClick={addLineItem}
                  className="flex items-center gap-1 text-[11px] font-medium text-purple-600 hover:text-purple-800 transition-colors">
                  <Plus className="w-3 h-3" /> {t('finance:receivable.dialog.addItem')}
                </button>
              </div>
              <div className="border border-[#D4D4D8] rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#FAFAFA]">
                      <th className="text-left text-[10px] font-semibold text-[#71717A] uppercase px-3 py-2 w-[45%]">{t('finance:receivable.dialog.itemDesc')}</th>
                      <th className="text-left text-[10px] font-semibold text-[#71717A] uppercase px-2 py-2 w-[15%]">{t('finance:receivable.dialog.itemQty')}</th>
                      <th className="text-left text-[10px] font-semibold text-[#71717A] uppercase px-2 py-2 w-[20%]">{t('finance:receivable.dialog.itemPrice')}</th>
                      <th className="text-right text-[10px] font-semibold text-[#71717A] uppercase px-3 py-2 w-[15%]">{t('finance:receivable.dialog.itemSubtotal')}</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {newLineItems.map((li, idx) => {
                      const q = parseFloat(li.quantity) || 0;
                      const p = parseFloat(li.unitPrice) || 0;
                      const sub = q * p;
                      return (
                        <tr key={idx} className="border-t border-[#D4D4D8]/50">
                          <td className="px-2 py-1.5">
                            <input type="text" value={li.description} onChange={e => updateLineItem(idx, 'description', e.target.value)}
                              placeholder={t('finance:receivable.dialog.itemDescPlaceholder')}
                              className="h-8 w-full rounded border border-[#D4D4D8] px-2 text-sm text-[#0A0A0A] focus:outline-none focus:ring-1 focus:ring-purple-400" />
                          </td>
                          <td className="px-1 py-1.5">
                            <input type="number" step="0.01" min="0.01" value={li.quantity} onChange={e => updateLineItem(idx, 'quantity', e.target.value)}
                              className="h-8 w-full rounded border border-[#D4D4D8] px-2 text-sm text-[#0A0A0A] text-center focus:outline-none focus:ring-1 focus:ring-purple-400" />
                          </td>
                          <td className="px-1 py-1.5">
                            <input type="number" step="0.01" min="0.01" value={li.unitPrice} onChange={e => updateLineItem(idx, 'unitPrice', e.target.value)}
                              placeholder="0.00"
                              className="h-8 w-full rounded border border-[#D4D4D8] px-2 text-sm text-[#0A0A0A] focus:outline-none focus:ring-1 focus:ring-purple-400" />
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono text-sm text-[#0A0A0A]">
                            {sub > 0 ? fmtAmount(sub) : '—'}
                          </td>
                          <td className="px-1 py-1.5">
                            {newLineItems.length > 1 && (
                              <button type="button" onClick={() => removeLineItem(idx)}
                                className="text-[#D4D4D8] hover:text-red-500 transition-colors p-1">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="flex items-center justify-end gap-2 px-3 py-2 bg-[#FAFAFA] border-t border-[#D4D4D8]">
                  <span className="text-xs font-semibold text-[#71717A] uppercase">{t('finance:receivable.dialog.total')}</span>
                  <span className="font-mono font-bold text-sm text-[#0A0A0A]">{fmtAmount(lineItemsTotal)}</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1 block">{t('finance:receivable.dialog.issueDate')}</label>
                <input type={newIssueDate ? 'date' : 'text'} value={newIssueDate} placeholder={t('finance:receivable.dialog.selectDate')}
                  onFocus={e => { e.target.type = 'date'; }} onBlur={e => { if (!newIssueDate) e.target.type = 'text'; }}
                  onChange={e => setNewIssueDate(e.target.value)}
                  className="h-9 w-full rounded-md border border-[#D4D4D8] px-3 text-sm text-[#0A0A0A] placeholder:text-[#71717A] focus:outline-none focus:ring-2 focus:ring-purple-400" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1 block">{t('finance:receivable.dialog.dueDate')}</label>
                <input type={newDueDate ? 'date' : 'text'} value={newDueDate} placeholder={t('finance:receivable.dialog.selectDate')}
                  onFocus={e => { e.target.type = 'date'; }} onBlur={e => { if (!newDueDate) e.target.type = 'text'; }}
                  onChange={e => setNewDueDate(e.target.value)}
                  className="h-9 w-full rounded-md border border-[#D4D4D8] px-3 text-sm text-[#0A0A0A] placeholder:text-[#71717A] focus:outline-none focus:ring-2 focus:ring-purple-400" />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1 block">{t('finance:receivable.dialog.notes')}</label>
              <textarea value={newNotes} onChange={e => setNewNotes(e.target.value)} rows={2} placeholder={t('finance:receivable.dialog.notesPlaceholder')}
                className="w-full rounded-md border border-[#D4D4D8] px-3 py-2 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none" />
            </div>
            {/* Document upload (optional) */}
            <div>
              <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1 block">{t('finance:receivable.dialog.documents')}</label>
              <label
                className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[#D4D4D8] bg-[#FAFAFA]/50 py-5 cursor-pointer hover:border-purple-400 hover:bg-purple-50/30 transition-colors"
                onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={e => {
                  e.preventDefault(); e.stopPropagation();
                  const dropped = Array.from(e.dataTransfer.files);
                  if (dropped.length) setNewFiles(prev => [...prev, ...dropped]);
                }}
              >
                <Upload className="w-5 h-5 text-[#71717A]" />
                <span className="text-xs text-[#71717A]">{t('finance:receivable.dialog.dropFiles')}</span>
                <span className="text-[10px] text-[#D4D4D8]">{t('finance:receivable.dialog.fileFormats')}</span>
                <input type="file" multiple className="hidden" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
                  onChange={e => {
                    const files = Array.from(e.target.files ?? []);
                    if (files.length) setNewFiles(prev => [...prev, ...files]);
                    e.target.value = '';
                  }} />
              </label>
              {newFiles.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {newFiles.map((f, i) => (
                    <div key={`${f.name}-${i}`} className="flex items-center gap-2 bg-white rounded-lg border border-[#D4D4D8] px-3 py-2">
                      <FileText className="w-4 h-4 text-purple-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[#0A0A0A] truncate">{f.name}</p>
                        <p className="text-[10px] text-[#71717A]">{(f.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <button onClick={() => setNewFiles(prev => prev.filter((_, idx) => idx !== i))}
                        className="text-[#71717A] hover:text-red-500 transition-colors flex-shrink-0">
                        <CircleX className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>{t('common:buttons.cancel')}</Button>
            <Button onClick={submitCreate} className="bg-purple-600 hover:bg-purple-700 text-white">{t('finance:receivable.dialog.submit')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>

    {/* Generated PDFs panel (right side) */}
    {generatedPdfs.length > 0 && (
      <div className="w-72 flex-shrink-0 sticky top-4">
        <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[#D4D4D8] bg-[#FAFAFA]">
            <FileText className="w-4 h-4 text-purple-600" />
            <span className="text-xs font-semibold text-[#0A0A0A]">Generated Invoices</span>
            <span className="ml-auto text-[10px] text-[#71717A]">{generatedPdfs.length}</span>
          </div>
          <div className="divide-y divide-[#D4D4D8]/50 max-h-[70vh] overflow-y-auto">
            {generatedPdfs.map(pdf => (
              <div key={pdf.id} className="px-4 py-3 hover:bg-[#FAFAFA]/60 transition-colors">
                <div className="flex items-start gap-2">
                  <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <FileText className="w-4 h-4 text-red-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[#0A0A0A] truncate">{pdf.invoiceNumber}</p>
                    <p className="text-[10px] text-[#71717A] truncate">{pdf.client}</p>
                    <p className="text-[10px] text-[#71717A] truncate">{pdf.project}</p>
                    <p className="text-[10px] text-[#71717A]">{fmtDate(pdf.date, dateLocale)}</p>
                  </div>
                  <button
                    onClick={() => handleDownloadPdf(pdf)}
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-purple-600 hover:bg-purple-50 transition-colors flex-shrink-0"
                    title={`Download ${pdf.filename}`}
                  >
                    <Download className="w-3 h-3" />
                    PDF
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )}

    </div>
  );
}
