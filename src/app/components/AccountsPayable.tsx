import { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Wallet, DollarSign, Clock, AlertTriangle,
  ChevronDown, ChevronRight, Filter, Plus, Upload, FileText, CircleX,
  RotateCcw, Receipt, Trash2, ArrowRightLeft, Eye,
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
  listPayables, createPayable, recordPayablePayment, listPayableVendors,
  updatePayableAmount, markPayableUnpaid, voidPayablePayment, updatePayablePayment,
  convertPayableToInvoice, updatePayableDates, updatePayableInfo, deletePayable, reassignPayableProject,
  getPayable, type Payable,
} from '../services/finance';
import { listProjects } from '../services/projects';
import { ApiError } from '../lib/api';
import { AuthService } from '../services/auth';
import { fmtDate, businessToday, daysOverdue, currentMonth, currentMonthLabel } from '../helpers/dateTime';
// AP Block 6 — types/badges/helpers shared with the detail modal.
// AP Block 3 — PaymentMethodField (Credit card + typed-in Other) + resolve/split helpers.
import {
  StatusBadge, CategoryBadge, fmtAmount, toVendorBill, CATEGORY_KEY_MAP,
  PaymentMethodField, resolveMethod, splitMethod,
  type VendorBill, type BillCategory, type VendorPayment,
} from './PayableCommon';
import { PayableDetailModal } from './PayableDetailModal';
import { FIELD_LIMITS } from '../../shared/fieldLimits';

const ITEMS_PER_PAGE = 10;

// Component

export function AccountsPayable() {
  const { t, i18n } = useTranslation('finance');
  const dateLoc = i18n.language === 'es' ? 'es' : 'en-US';
  // Current accounting month for the "Paid this month" KPI, locale-aware (e.g. "Jul 2026" / "jul 2026").
  const paidMonthLabel = currentMonthLabel(dateLoc);
  const canManage = ['ADMIN', 'FINANCE'].includes(AuthService.getCanonicalRole() ?? '');
  const [bills, setBills] = useState<VendorBill[]>([]);
  const [loading, setLoading] = useState(true);
  // AP Block 6 — clicking a row opens the full detail modal; the bill shown is
  // derived from [bills] by id so every action keeps the detail fresh.
  const [detailId, setDetailId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showVendorSummary, setShowVendorSummary] = useState(false);
  const [vendors, setVendors] = useState<string[]>([]);
  const [projects, setProjects] = useState<{ id: number; name: string; remainingBudgetCents: number | null }[]>([]);

  const fetchBills = useCallback(() => {
    setLoading(true);
    listPayables({ size: 200 })
      .then(res => setBills(res.content.map(toVendorBill)))
      .catch(err => toast.error(t('payable.toast.loadFailed'), { description: err?.message }))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    fetchBills();
    listPayableVendors().then(setVendors).catch(err => toast.error(err?.message));
    listProjects({ page: 0, size: 200 })
      .then(r => setProjects(r.content.map(p => ({
        id: p.id,
        name: p.name,
        remainingBudgetCents: p.remainingBudgetCents ?? p.contractAmountCents,
      }))))
      .catch(err => toast.error(err?.message));
  }, [fetchBills]);

  // Filters
  const [filterVendor, setFilterVendor] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterProject, setFilterProject] = useState('all'); // AP Block 4 — project id as string

  // Submitting state
  const [submitting, setSubmitting] = useState(false);

  // Payment dialog
  const [payBill, setPayBill] = useState<VendorBill | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(businessToday());
  const [payMethod, setPayMethod] = useState('Bank transfer');
  // AP Block 3 — free text shown when method === 'Other'.
  const [payMethodOther, setPayMethodOther] = useState('');
  const [payRef, setPayRef] = useState('');

  // AP Block 3 — edit an existing payment's method + date.
  const [editPayment, setEditPayment] = useState<{ bill: VendorBill; payment: VendorPayment } | null>(null);
  const [epMethod, setEpMethod] = useState('Bank transfer');
  const [epMethodOther, setEpMethodOther] = useState('');
  const [epDate, setEpDate] = useState('');

  // Create bill dialog
  const [showCreate, setShowCreate] = useState(false);
  const [newBillNumber, setNewBillNumber] = useState('');
  const [newVendor, setNewVendor] = useState('');
  const [newVendorOther, setNewVendorOther] = useState('');
  const [newCategory, setNewCategory] = useState<string>('');
  const [newProject, setNewProject] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newReceivedDate, setNewReceivedDate] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newCreateNotes, setNewCreateNotes] = useState('');
  const [newFiles, setNewFiles] = useState<File[]>([]);

  // Edit dialog — amount + dates (Block 1 amount, Block 2 dates)
  const [editBill, setEditBill] = useState<VendorBill | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editReceivedDate, setEditReceivedDate] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editReason, setEditReason] = useState('');

  // Mark-unpaid confirm dialog
  const [unpayBill, setUnpayBill] = useState<VendorBill | null>(null);
  const [unpayReason, setUnpayReason] = useState('');

  // Convert-to-invoice dialog (Block 2)
  const [convertBill, setConvertBill] = useState<VendorBill | null>(null);
  const [convertNumber, setConvertNumber] = useState('');

  // AP Block 5 — edit general info (vendor/category/description/notes/invoice #)
  const [infoBill, setInfoBill] = useState<VendorBill | null>(null);
  const [infoVendor, setInfoVendor] = useState('');
  const [infoCategory, setInfoCategory] = useState<string>('');
  const [infoDescription, setInfoDescription] = useState('');
  const [infoNotes, setInfoNotes] = useState('');
  const [infoInvoiceNumber, setInfoInvoiceNumber] = useState('');

  // Delete dialog — two-step confirmation (Block 2)
  const [deleteBill, setDeleteBill] = useState<VendorBill | null>(null);
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);

  // Reassign-project dialog (Block 4)
  const [reassignBill, setReassignBill] = useState<VendorBill | null>(null);
  const [reassignTarget, setReassignTarget] = useState('');

  const hasFilters = filterVendor !== 'all' || filterStatus !== 'all' || filterCategory !== 'all' || filterProject !== 'all';
  const uniqueVendors = useMemo(() => {
    const fromBills = bills.map(b => b.vendor);
    return [...new Set([...vendors, ...fromBills])].sort();
  }, [bills, vendors]);

  // Computed KPIs
  const kpis = useMemo(() => {
    const nonPaid = bills.filter(b => b.status !== 'paid');
    const totalPayable = nonPaid.reduce((s, b) => s + (b.amount - b.paidAmount), 0);
    const cm = currentMonth();
    // Voided payments stay listed for audit but no longer count as paid
    // (mirrors the backend's paidCents).
    const paidThisMonth = bills.reduce((s, b) => {
      return s + b.payments.filter(p => !p.voided && p.date.startsWith(cm)).reduce((ps, p) => ps + p.amount, 0);
    }, 0);
    const pending = bills.filter(b => b.status === 'pending');
    const pendingTotal = pending.reduce((s, b) => s + (b.amount - b.paidAmount), 0);
    const overdue = bills.filter(b => b.status === 'overdue');
    const overdueTotal = overdue.reduce((s, b) => s + (b.amount - b.paidAmount), 0);
    return { totalPayable, paidThisMonth, pendingTotal, pendingCount: pending.length, overdueTotal, overdueCount: overdue.length };
  }, [bills]);

  const filtered = useMemo(() => {
    return bills.filter(b => {
      if (filterVendor !== 'all' && b.vendor !== filterVendor) return false;
      if (filterStatus !== 'all' && b.status !== filterStatus) return false;
      if (filterCategory !== 'all' && b.category !== filterCategory) return false;
      if (filterProject !== 'all' && String(b.projectId) !== filterProject) return false;
      return true;
    });
  }, [bills, filterVendor, filterStatus, filterCategory, filterProject]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const totalOutstanding = filtered.reduce((s, b) => s + (b.amount - b.paidAmount), 0);

  const overdueBills = bills.filter(b => b.status === 'overdue');
  const overdueTotal = overdueBills.reduce((s, b) => s + (b.amount - b.paidAmount), 0);

  // Vendor summary
  const vendorSummary = useMemo(() => {
    const map = new Map<string, { total: number; paid: number; count: number }>();
    bills.forEach(b => {
      const entry = map.get(b.vendor) ?? { total: 0, paid: 0, count: 0 };
      entry.total += b.amount;
      entry.paid += b.paidAmount;
      entry.count++;
      map.set(b.vendor, entry);
    });
    return [...map.entries()].map(([vendor, data]) => ({ vendor, ...data })).sort((a, b) => b.total - a.total);
  }, [bills]);

  function clearFilters() {
    setFilterVendor('all'); setFilterStatus('all'); setFilterCategory('all'); setFilterProject('all');
    setCurrentPage(1);
  }

  // AP Block 6 — open the full detail view; refresh the bill from the server
  // (GET /payables/{id}) so concurrent edits by another session show up.
  function openDetail(bill: VendorBill) {
    setDetailId(bill.id);
    getPayable(bill.id)
      .then(fresh => setBills(prev => prev.map(b => b.id === fresh.id ? toVendorBill(fresh) : b)))
      .catch(err => toast.error(t('payable.toast.loadFailed'), { description: err?.message }));
  }

  // Payment dialog
  function openPayDialog(bill: VendorBill) {
    const balance = bill.amount - bill.paidAmount;
    setPayBill(bill);
    setPayAmount(balance.toFixed(2));
    setPayDate(businessToday());
    setPayMethod('Bank transfer');
    setPayMethodOther('');
    setPayRef('');
  }

  async function submitPayment() {
    if (!payBill) return;
    const amt = parseFloat(payAmount);
    const balance = payBill.amount - payBill.paidAmount;
    if (!amt || amt <= 0 || amt > balance || !payDate) {
      toast.error(t('payable.validation.checkFields'));
      return;
    }
    // AP Block 3 — collapse the method picker; a "Other" choice must carry text.
    const method = resolveMethod(payMethod, payMethodOther);
    if (!method) {
      toast.error(t('payable.validation.methodRequired'));
      return;
    }
    try {
      const updated = await recordPayablePayment(payBill.id, {
        amount: amt,
        date: payDate,
        method,
        reference: payRef || undefined,
        approvedBy: 'finance',
      });
      setBills(prev => prev.map(b => b.id === payBill.id ? toVendorBill(updated) : b));
      toast.success(t('payable.toast.paymentRecorded', { amount: fmtAmount(amt), bill: payBill.billNumber }));
      if (updated.budgetWarning) {
        const w = updated.budgetWarning;
        const names = w.pendingWorkers.map(p => `${p.workerName ?? `ID ${p.workerId}`} (${p.unpaidHours.toFixed(1)}h)`).join(', ');
        toast.warning(t('common:budgetWarning.title', 'Pending labour payments'), {
          description: `${t('common:budgetWarning.desc', 'Remaining budget')} ($${(w.remainingBudgetCents / 100).toFixed(2)}) ${t('common:budgetWarning.insufficient', 'cannot cover projected payroll')} ($${(w.projectedLaborCostCents / 100).toFixed(2)}): ${names}`,
          duration: 10000,
        });
      }
      setPayBill(null);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.code === 'BUDGET_EXCEEDED') {
        toast.error(
          t('payable.toast.budgetExceeded.title', 'Project budget exceeded'),
          { description: err.message, duration: 10000 },
        );
      } else {
        const message = err instanceof Error ? err.message : undefined;
        toast.error(t('payable.toast.paymentFailed'), { description: message });
      }
    }
  }

  // Edit amount + dates
  function openEditDialog(bill: VendorBill) {
    setEditBill(bill);
    setEditAmount(bill.amount.toFixed(2));
    setEditReceivedDate(bill.receivedDate);
    setEditDueDate(bill.dueDate);
    setEditReason('');
  }

  async function submitEdit() {
    if (!editBill) return;
    const amt = parseFloat(editAmount);
    if (!amt || amt <= 0) {
      toast.error(t('payable.validation.amountPositive'));
      return;
    }
    if (amt < editBill.paidAmount) {
      toast.error(t('payable.edit.belowPaid', { paid: fmtAmount(editBill.paidAmount) }));
      return;
    }
    if (!editReceivedDate || !editDueDate) {
      toast.error(t('payable.validation.requiredFields'));
      return;
    }
    if (editDueDate < editReceivedDate) {
      toast.error(t('payable.validation.dueDateAfter'));
      return;
    }

    const amountChanged = Math.round(amt * 100) !== Math.round(editBill.amount * 100);
    const datesChanged = editReceivedDate !== editBill.receivedDate || editDueDate !== editBill.dueDate;
    if (!amountChanged && !datesChanged) {
      setEditBill(null);
      return;
    }

    setSubmitting(true);
    try {
      let updated: Payable | undefined;
      // Amount and dates are separate endpoints (Block 1 / Block 2); each
      // returns the full bill, so the last call reflects both changes.
      if (amountChanged) {
        updated = await updatePayableAmount(editBill.id, { amount: amt, reason: editReason.trim() || undefined });
      }
      if (datesChanged) {
        updated = await updatePayableDates(editBill.id, { receivedDate: editReceivedDate, dueDate: editDueDate });
      }
      if (updated) {
        const settled = updated;
        setBills(prev => prev.map(b => b.id === editBill.id ? toVendorBill(settled) : b));
      }
      toast.success(t('payable.edit.updated', { bill: editBill.billNumber }));
      setEditBill(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : undefined;
      toast.error(t('payable.edit.failed'), { description: message });
    } finally {
      setSubmitting(false);
    }
  }

  // Convert a bill (cuenta) into an invoice (factura)
  function openConvertDialog(bill: VendorBill) {
    setConvertBill(bill);
    setConvertNumber(bill.invoiceNumber ?? '');
  }

  async function submitConvert() {
    if (!convertBill) return;
    const number = convertNumber.trim();
    if (!number) {
      toast.error(t('payable.convert.numberRequired'));
      return;
    }
    setSubmitting(true);
    try {
      const updated = await convertPayableToInvoice(convertBill.id, number);
      setBills(prev => prev.map(b => b.id === convertBill.id ? toVendorBill(updated) : b));
      toast.success(t('payable.convert.done', { number }));
      setConvertBill(null);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.code === 'DUPLICATE_INVOICE_NUMBER') {
        toast.error(t('payable.convert.duplicate'), { description: err.message });
      } else {
        const message = err instanceof Error ? err.message : undefined;
        toast.error(t('payable.convert.failed'), { description: message });
      }
    } finally {
      setSubmitting(false);
    }
  }

  // AP Block 5 — edit general info (vendor / category / description / notes /
  // invoice number). Sends only the changed fields.
  function openInfoDialog(bill: VendorBill) {
    setInfoBill(bill);
    setInfoVendor(bill.vendor);
    setInfoCategory(bill.category);
    setInfoDescription(bill.description ?? '');
    setInfoNotes(bill.notes ?? '');
    setInfoInvoiceNumber(bill.invoiceNumber ?? '');
  }

  async function submitInfo() {
    if (!infoBill) return;
    const vendor = infoVendor.trim();
    if (!vendor) {
      toast.error(t('payable.info.vendorRequired'));
      return;
    }
    const payload: { vendor?: string; category?: string; description?: string | null; notes?: string | null; invoiceNumber?: string } = {};
    if (vendor !== infoBill.vendor) payload.vendor = vendor;
    if (infoCategory && infoCategory !== infoBill.category) payload.category = infoCategory;
    const desc = infoDescription.trim();
    if (desc !== (infoBill.description ?? '')) payload.description = desc || null;
    const notes = infoNotes.trim();
    if (notes !== (infoBill.notes ?? '')) payload.notes = notes || null;
    if (infoBill.documentType === 'INVOICE') {
      const inv = infoInvoiceNumber.trim();
      if (inv && inv !== (infoBill.invoiceNumber ?? '')) payload.invoiceNumber = inv;
    }
    if (Object.keys(payload).length === 0) {
      setInfoBill(null);
      return;
    }
    setSubmitting(true);
    try {
      const updated = await updatePayableInfo(infoBill.id, payload);
      setBills(prev => prev.map(b => b.id === infoBill.id ? toVendorBill(updated) : b));
      toast.success(t('payable.info.updated', { bill: infoBill.billNumber }));
      setInfoBill(null);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.code === 'DUPLICATE_INVOICE_NUMBER') {
        toast.error(t('payable.convert.duplicate'), { description: err.message });
      } else if (err instanceof ApiError && err.code === 'NOT_AN_INVOICE') {
        toast.error(t('payable.info.notAnInvoice'), { description: err.message });
      } else {
        const message = err instanceof Error ? err.message : undefined;
        toast.error(t('payable.info.failed'), { description: message });
      }
    } finally {
      setSubmitting(false);
    }
  }

  // Delete (soft) — two-step confirmation
  function openDeleteDialog(bill: VendorBill) {
    setDeleteBill(bill);
    setDeleteStep(1);
  }

  async function submitDelete() {
    if (!deleteBill) return;
    setSubmitting(true);
    try {
      await deletePayable(deleteBill.id);
      setBills(prev => prev.filter(b => b.id !== deleteBill.id));
      if (detailId === deleteBill.id) setDetailId(null);
      toast.success(t('payable.delete.done', { bill: deleteBill.billNumber }));
      setDeleteBill(null);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.code === 'PAYABLE_HAS_ACTIVE_PAYMENTS') {
        toast.error(t('payable.delete.hasPayments'), { description: err.message });
      } else {
        const message = err instanceof Error ? err.message : undefined;
        toast.error(t('payable.delete.failed'), { description: message });
      }
      setDeleteBill(null);
    } finally {
      setSubmitting(false);
    }
  }

  // Reassign to another project (Block 4)
  function openReassignDialog(bill: VendorBill) {
    setReassignBill(bill);
    setReassignTarget('');
  }

  async function submitReassign() {
    if (!reassignBill || !reassignTarget) return;
    setSubmitting(true);
    try {
      const updated = await reassignPayableProject(reassignBill.id, Number(reassignTarget));
      setBills(prev => prev.map(b => b.id === reassignBill.id ? toVendorBill(updated) : b));
      toast.success(t('payable.reassign.done', { bill: reassignBill.billNumber, project: toVendorBill(updated).project }));
      setReassignBill(null);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.code === 'PAYABLE_HAS_ACTIVE_PAYMENTS') {
        toast.error(t('payable.reassign.hasPayments'), { description: err.message });
      } else if (err instanceof ApiError && err.code === 'PROJECT_NOT_ACTIVE') {
        toast.error(t('payable.reassign.notActive'), { description: err.message });
      } else if (err instanceof ApiError && err.code === 'PAYABLE_ALREADY_IN_PROJECT') {
        toast.error(t('payable.reassign.sameProject'), { description: err.message });
      } else {
        const message = err instanceof Error ? err.message : undefined;
        toast.error(t('payable.reassign.failed'), { description: message });
      }
    } finally {
      setSubmitting(false);
    }
  }

  // Mark unpaid (void all active payments)
  function openUnpayDialog(bill: VendorBill) {
    setUnpayBill(bill);
    setUnpayReason('');
  }

  async function submitUnpay() {
    if (!unpayBill) return;
    setSubmitting(true);
    try {
      const updated = await markPayableUnpaid(unpayBill.id, unpayReason.trim() || undefined);
      setBills(prev => prev.map(b => b.id === unpayBill.id ? toVendorBill(updated) : b));
      toast.success(t('payable.unpay.done', { bill: unpayBill.billNumber }));
      setUnpayBill(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : undefined;
      toast.error(t('payable.unpay.failed'), { description: message });
    } finally {
      setSubmitting(false);
    }
  }

  // Void a single payment
  async function handleVoidPayment(bill: VendorBill, paymentId: number) {
    setSubmitting(true);
    try {
      const updated = await voidPayablePayment(bill.id, paymentId);
      setBills(prev => prev.map(b => b.id === bill.id ? toVendorBill(updated) : b));
      toast.success(t('payable.void.done'));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : undefined;
      toast.error(t('payable.void.failed'), { description: message });
    } finally {
      setSubmitting(false);
    }
  }

  // AP Block 3 — edit an existing payment's method + date (metadata only)
  function openEditPaymentDialog(bill: VendorBill, payment: VendorPayment) {
    const { method, otherText } = splitMethod(payment.method);
    setEpMethod(method);
    setEpMethodOther(otherText);
    setEpDate(payment.date);
    setEditPayment({ bill, payment });
  }

  async function submitEditPayment() {
    if (!editPayment) return;
    const { bill, payment } = editPayment;
    const method = resolveMethod(epMethod, epMethodOther);
    if (!method) {
      toast.error(t('payable.validation.methodRequired'));
      return;
    }
    if (!epDate) {
      toast.error(t('payable.validation.checkFields'));
      return;
    }
    setSubmitting(true);
    try {
      const updated = await updatePayablePayment(bill.id, payment.id, { method, date: epDate });
      setBills(prev => prev.map(b => b.id === bill.id ? toVendorBill(updated) : b));
      toast.success(t('payable.editPayment.done'));
      setEditPayment(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : undefined;
      toast.error(t('payable.editPayment.failed'), { description: message });
    } finally {
      setSubmitting(false);
    }
  }

  // Create bill
  function openCreateDialog() {
    const maxNum = bills.reduce((m, b) => {
      const n = parseInt(b.billNumber.split('-').pop() ?? '0');
      return n > m ? n : m;
    }, 0);
    setNewBillNumber(`BILL-2026-${String(maxNum + 1).padStart(3, '0')}`);
    setNewVendor('');
    setNewVendorOther('');
    setNewCategory('');
    setNewProject('');
    setNewDesc('');
    setNewAmount('');
    setNewReceivedDate('');
    setNewDueDate('');
    setNewCreateNotes('');
    setNewFiles([]);
    setShowCreate(true);
  }

  async function submitCreate() {
    const vendor = newVendor === 'Other' ? newVendorOther.trim() : newVendor;
    const amt = parseFloat(newAmount);
    const selectedProject = projects.find(p => p.name === newProject);
    if (!vendor || !newCategory || !selectedProject || !newDesc.trim() || !amt || amt <= 0 || !newReceivedDate || !newDueDate) {
      toast.error(t('payable.validation.requiredFields'));
      return;
    }
    if (newDueDate < newReceivedDate) {
      toast.error(t('payable.validation.dueDateAfter'));
      return;
    }
    try {
      const created = await createPayable({
        billNumber: newBillNumber || undefined,
        vendor,
        category: newCategory,
        projectId: selectedProject.id,
        description: newDesc.trim(),
        receivedDate: newReceivedDate,
        dueDate: newDueDate,
        amount: amt,
        notes: newCreateNotes.trim() || undefined,
      });
      setBills(prev => [toVendorBill(created), ...prev]);
      toast.success(t('payable.toast.billRegistered', { bill: created.billNumber }));
      setShowCreate(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : undefined;
      toast.error(t('payable.toast.createFailed'), { description: message });
    }
  }

  return (
    <div className="space-y-6 max-w-6xl">

      {/* Top bar */}
      <div className="flex items-center justify-end">
        <Button onClick={openCreateDialog} className="bg-purple-600 hover:bg-purple-700 text-white gap-1.5">
          <Plus className="w-4 h-4" /> {t('payable.newBill')}
        </Button>
      </div>

      {/* KPI cards — computed from state */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Wallet}         title={t('payable.kpi.totalPayable')}   value={fmtAmount(kpis.totalPayable)}    subtitle={t('payable.kpi.allInvoices')}                                              iconBgColor="bg-purple-50"  iconColor="text-purple-600" />
        <StatCard icon={DollarSign}     title={t('payable.kpi.paidThisMonth')}  value={fmtAmount(kpis.paidThisMonth)}   subtitle={paidMonthLabel}                                                  iconBgColor="bg-emerald-50" iconColor="text-emerald-600" />
        <StatCard icon={Clock}          title={t('payable.kpi.pendingPayment')} value={fmtAmount(kpis.pendingTotal)}    subtitle={`${kpis.pendingCount} invoice${kpis.pendingCount !== 1 ? 's' : ''}`} iconBgColor="bg-amber-50" iconColor="text-amber-600" />
        <StatCard icon={AlertTriangle}  title={t('payable.kpi.overdue')}        value={fmtAmount(kpis.overdueTotal)}    subtitle={`${kpis.overdueCount} invoice${kpis.overdueCount !== 1 ? 's' : ''}`} iconBgColor="bg-red-50"   iconColor="text-red-600" />
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-[#71717A]" />
          <span className="text-sm font-semibold text-[#0A0A0A]">{t('buttons.filters', { ns: 'common' })}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1 block">{t('payable.filters.vendor')}</label>
            <Select value={filterVendor} onValueChange={v => { setFilterVendor(v); setCurrentPage(1); }}>
              <SelectTrigger className="h-9 text-sm border-[#D4D4D8]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('payable.filters.allVendors')}</SelectItem>
                {uniqueVendors.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1 block">{t('labels.project', { ns: 'common' })}</label>
            <Select value={filterProject} onValueChange={v => { setFilterProject(v); setCurrentPage(1); }}>
              <SelectTrigger className="h-9 text-sm border-[#D4D4D8]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('labels.allProjects', { ns: 'common' })}</SelectItem>
                {projects.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1 block">{t('labels.status', { ns: 'common' })}</label>
            <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); setCurrentPage(1); }}>
              <SelectTrigger className="h-9 text-sm border-[#D4D4D8]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('labels.allStatuses', { ns: 'common' })}</SelectItem>
                <SelectItem value="paid">{t('status.paid', { ns: 'common' })}</SelectItem>
                <SelectItem value="pending">{t('status.pending', { ns: 'common' })}</SelectItem>
                <SelectItem value="partial">{t('status.partial', { ns: 'common' })}</SelectItem>
                <SelectItem value="overdue">{t('status.overdue', { ns: 'common' })}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1 block">{t('labels.category', { ns: 'common' })}</label>
            <Select value={filterCategory} onValueChange={v => { setFilterCategory(v); setCurrentPage(1); }}>
              <SelectTrigger className="h-9 text-sm border-[#D4D4D8]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('labels.allCategories', { ns: 'common' })}</SelectItem>
                {Object.entries(CATEGORY_KEY_MAP).map(([k, key]) => <SelectItem key={k} value={k}>{t(key)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        {hasFilters && (
          <div className="mt-3 pt-3 border-t border-[#FAFAFA]">
            <button onClick={clearFilters} className="text-xs font-medium text-purple-600 hover:text-purple-800 transition-colors">
              {t('buttons.clearFilters', { ns: 'common' })}
            </button>
          </div>
        )}
      </div>

      {/* Vendor summary (collapsible) */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
        <button onClick={() => setShowVendorSummary(!showVendorSummary)}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-[#FAFAFA]/50 transition-colors">
          <div className="flex items-center gap-2">
            {showVendorSummary ? <ChevronDown className="w-4 h-4 text-[#71717A]" /> : <ChevronRight className="w-4 h-4 text-[#71717A]" />}
            <span className="text-sm font-semibold text-[#0A0A0A]">{t('payable.vendorSummary')}</span>
            <span className="text-xs text-[#71717A]">· {t('payable.vendorCount', { count: vendorSummary.length })}</span>
          </div>
        </button>
        {showVendorSummary && (
          <div className="border-t border-[#D4D4D8] p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {vendorSummary.map(vs => {
              const pct = vs.total > 0 ? Math.round((vs.paid / vs.total) * 100) : 0;
              const outstanding = vs.total - vs.paid;
              return (
                <div key={vs.vendor} className="border border-[#D4D4D8] rounded-lg p-4">
                  <p className="text-sm font-semibold text-[#0A0A0A] mb-1">{vs.vendor}</p>
                  <p className="text-xs text-[#71717A] mb-3">{t('payable.billCount', { count: vs.count })}</p>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-[#71717A]">{t('payable.table.paid')}: {fmtAmount(vs.paid)}</span>
                    <span className="text-[#71717A]">{t('payable.outstanding')}: <span className="font-semibold text-[#0A0A0A]">{fmtAmount(outstanding)}</span></span>
                  </div>
                  <div className="w-full h-2 bg-[#FAFAFA] rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-[10px] text-[#71717A] mt-1">{t('payable.pctPaidOf', { pct, total: fmtAmount(vs.total) })}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-[#D4D4D8]">
          <Wallet className="w-4 h-4 text-[#71717A]" />
          <span className="text-sm font-semibold text-[#0A0A0A]">{t('payable.title')}</span>
          <span className="ml-auto text-xs text-[#71717A]">{t('payable.billCount', { count: filtered.length })}</span>
        </div>

        {filtered.length === 0 ? (
          <div className="py-8">
            <EmptyState icon={Wallet} title={t('payable.noBills')} description={t('payable.noBillsHint')} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px]">
              <thead>
                <tr className="bg-[#FAFAFA]">
                  {[t('payable.table.billNo'), t('payable.table.vendor'), t('payable.table.category'), t('payable.table.project'), t('payable.table.received'), t('payable.table.dueDate'), t('payable.table.amount'), t('payable.table.paid'), t('payable.table.balance'), t('payable.table.status'), t('payable.table.actions')].map(h => (
                    <th key={h} className="text-left text-[11px] font-semibold text-[#71717A] uppercase tracking-wider px-3 py-2.5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map(bill => {
                  const balance = bill.amount - bill.paidAmount;
                  const isOverdue = bill.status === 'overdue';
                  return (
                    <tr key={bill.id}
                      onClick={() => openDetail(bill)}
                      className="border-b border-[#D4D4D8]/50 transition-colors cursor-pointer hover:bg-[#FAFAFA]/60">
                      <td className="py-3 px-3 font-mono text-sm text-[#0A0A0A]">
                        <div className="flex flex-col">
                          <span>{bill.billNumber}</span>
                          {bill.documentType === 'INVOICE' && bill.invoiceNumber && (
                            <span className="mt-0.5 inline-flex w-fit items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-1.5 py-0.5 font-sans text-[9px] font-semibold text-purple-700">
                              <Receipt className="h-2.5 w-2.5" /> {bill.invoiceNumber}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-sm text-[#0A0A0A]">{bill.vendor}</td>
                      <td className="py-3 px-3"><CategoryBadge category={bill.category} /></td>
                      <td className="py-3 px-3 text-sm text-[#71717A]">{bill.project}</td>
                      <td className="py-3 px-3 text-sm text-[#0A0A0A] whitespace-nowrap">{fmtDate(bill.receivedDate, dateLoc)}</td>
                      <td className={`py-3 px-3 text-sm whitespace-nowrap ${isOverdue ? 'text-red-600 font-medium' : 'text-[#0A0A0A]'}`}>{fmtDate(bill.dueDate, dateLoc)}</td>
                      <td className="py-3 px-3 font-mono font-semibold text-sm text-[#0A0A0A]">{fmtAmount(bill.amount)}</td>
                      <td className={`py-3 px-3 font-mono text-sm ${bill.paidAmount >= bill.amount ? 'text-emerald-600 font-semibold' : 'text-[#0A0A0A]'}`}>{fmtAmount(bill.paidAmount)}</td>
                      <td className={`py-3 px-3 font-mono text-sm font-semibold ${balance === 0 ? 'text-[#D4D4D8]' : isOverdue ? 'text-red-600' : 'text-amber-600'}`}>{fmtAmount(balance)}</td>
                      <td className="py-3 px-3"><StatusBadge status={bill.status} /></td>
                      <td className="py-3 px-3">
                        {/* Actions live in the detail modal now; the row keeps the
                            everyday quick action + an explicit "view detail" button. */}
                        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                          <Button variant="outline" size="sm" disabled={bill.status === 'paid'}
                            onClick={() => openPayDialog(bill)}
                            className="h-7 text-[11px] border-purple-300 text-purple-600 hover:bg-purple-50 hover:text-purple-700 disabled:opacity-40">
                            {t('payable.recordPayment')}
                          </Button>
                          <button title={t('payable.detail.action')} aria-label={t('payable.detail.action')}
                            onClick={() => openDetail(bill)}
                            className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-[#D4D4D8] text-[#71717A] hover:text-[#0A0A0A] hover:border-purple-300 transition-colors">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        {filtered.length > 0 && (
          <div className="px-6 py-3 border-t border-[#D4D4D8]/50 bg-[#FAFAFA]/50 flex items-center justify-between flex-wrap gap-2">
            <p className="text-[11px] text-[#71717A]">{t('payable.showingOf', { shown: paginated.length, total: filtered.length })}</p>
            <p className="text-[11px] font-medium text-[#0A0A0A]">
              {t('payable.totalOutstanding')}: <span className="font-mono font-semibold">{fmtAmount(totalOutstanding)}</span>
            </p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 px-6 py-3 border-t border-[#D4D4D8]/50">
            <Button variant="outline" size="sm" disabled={currentPage <= 1}
              onClick={() => setCurrentPage(p => p - 1)} className="h-8 text-xs border-[#D4D4D8]">{t('buttons.previous', { ns: 'common' })}</Button>
            <span className="text-xs text-[#71717A]">{t('payable.pageOf', { current: currentPage, total: totalPages })}</span>
            <Button variant="outline" size="sm" disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(p => p + 1)} className="h-8 text-xs border-[#D4D4D8]">{t('buttons.nextSimple', { ns: 'common' })}</Button>
          </div>
        )}
      </div>

      {/* Overdue alerts */}
      {overdueBills.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <span className="text-sm font-semibold text-red-700">
              {t('payable.alert.overdue', { count: overdueBills.length, amount: fmtAmount(overdueTotal) })}
            </span>
          </div>
          <div className="space-y-2">
            {overdueBills.map(b => (
              <div key={b.id} className="flex items-center justify-between text-sm bg-white/60 rounded-lg px-4 py-2">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[#0A0A0A]">{b.billNumber}</span>
                  <span className="text-[#71717A]">{b.vendor}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-red-600 font-medium">{t('labels.daysOverdue', { ns: 'common', count: daysOverdue(b.dueDate) })}</span>
                  <span className="font-mono font-semibold text-red-700">{fmtAmount(b.amount - b.paidAmount)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AP Block 6 — full detail modal (all fields + payments + images + actions).
          The action dialogs below stack on top of it. */}
      <PayableDetailModal
        bill={detailId != null ? bills.find(b => b.id === detailId) ?? null : null}
        onClose={() => setDetailId(null)}
        canManage={canManage}
        submitting={submitting}
        onRecordPayment={openPayDialog}
        onEditAmountDates={openEditDialog}
        onEditInfo={openInfoDialog}
        onConvert={openConvertDialog}
        onReassign={openReassignDialog}
        onMarkUnpaid={openUnpayDialog}
        onDelete={openDeleteDialog}
        onVoidPayment={handleVoidPayment}
        onEditPayment={openEditPaymentDialog}
      />

      {/* Record Payment Dialog */}
      <Dialog open={!!payBill} onOpenChange={open => { if (!open) setPayBill(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('payable.dialog.recordPayment')} — {payBill?.billNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {payBill && (() => {
              const project = projects.find(p => p.id === payBill.projectId);
              const remainingCents = project?.remainingBudgetCents;
              if (remainingCents == null) return null;
              const remaining = remainingCents / 100;
              const requested = parseFloat(payAmount) || 0;
              const wouldExceed = requested > remaining;
              return (
                <div
                  className={`rounded-md p-3 text-sm ${
                    wouldExceed
                      ? 'bg-red-50 border border-red-200 text-red-800'
                      : 'bg-blue-50 border border-blue-200 text-blue-800'
                  }`}
                  data-testid="remaining-budget-panel"
                >
                  <div className="font-semibold">
                    {t('payable.dialog.remainingBudget', 'Remaining project budget')}
                  </div>
                  <div>{fmtAmount(remaining)} — {payBill.project}</div>
                  {wouldExceed && (
                    <div className="mt-1 text-xs">
                      {t('payable.dialog.wouldExceed',
                        'This payment would exceed the remaining budget and will be rejected.')}
                    </div>
                  )}
                </div>
              );
            })()}
            <div>
              <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1 block">
                {t('payable.dialog.amount', { max: payBill ? fmtAmount(payBill.amount - payBill.paidAmount) : '$0.00' })}
              </label>
              <input type="number" step="0.01" min="0.01"
                max={payBill ? payBill.amount - payBill.paidAmount : 0}
                value={payAmount} onChange={e => setPayAmount(e.target.value)}
                className="h-9 w-full rounded-md border border-[#D4D4D8] px-3 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-purple-400" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1 block">{t('payable.dialog.paymentDate')}</label>
              <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)}
                className="h-9 w-full rounded-md border border-[#D4D4D8] px-3 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-purple-400" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1 block">{t('payable.dialog.method')}</label>
              <PaymentMethodField
                method={payMethod}
                otherText={payMethodOther}
                onMethodChange={setPayMethod}
                onOtherTextChange={setPayMethodOther}
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1 block">{t('payable.dialog.reference')}</label>
              <input type="text" value={payRef} onChange={e => setPayRef(e.target.value)} placeholder={t('payable.dialog.referencePlaceholder')} maxLength={FIELD_LIMITS.REFERENCE}
                className="h-9 w-full rounded-md border border-[#D4D4D8] px-3 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-purple-400" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPayBill(null)}>{t('buttons.cancel', { ns: 'common' })}</Button>
            <Button onClick={submitPayment} className="bg-purple-600 hover:bg-purple-700 text-white">{t('payable.recordPayment')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AP Block 3 — Edit Payment (method + date) Dialog */}
      <Dialog open={!!editPayment} onOpenChange={open => { if (!open) setEditPayment(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('payable.editPayment.title')} — {editPayment?.bill.billNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {editPayment && (
              <div className="rounded-md border border-[#D4D4D8] bg-[#FAFAFA]/60 px-3 py-2 text-xs text-[#71717A]">
                {t('payable.table.amount')}: <span className="font-mono font-semibold text-[#0A0A0A]">{fmtAmount(editPayment.payment.amount)}</span>
              </div>
            )}
            <div>
              <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1 block">{t('payable.dialog.paymentDate')}</label>
              <input type="date" value={epDate} onChange={e => setEpDate(e.target.value)}
                className="h-9 w-full rounded-md border border-[#D4D4D8] px-3 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-purple-400" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1 block">{t('payable.dialog.method')}</label>
              <PaymentMethodField
                method={epMethod}
                otherText={epMethodOther}
                onMethodChange={setEpMethod}
                onOtherTextChange={setEpMethodOther}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditPayment(null)}>{t('buttons.cancel', { ns: 'common' })}</Button>
            <Button onClick={submitEditPayment} disabled={submitting} className="bg-purple-600 hover:bg-purple-700 text-white">{t('buttons.save', { ns: 'common' })}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Bill Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('payable.dialog.registerBill')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
            <div>
              <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1 block">{t('payable.dialog.billNo')}</label>
              <input type="text" value={newBillNumber} onChange={e => setNewBillNumber(e.target.value)} maxLength={FIELD_LIMITS.IDENTIFIER}
                className="h-9 w-full rounded-md border border-[#D4D4D8] px-3 text-sm text-[#0A0A0A] font-mono focus:outline-none focus:ring-2 focus:ring-purple-400" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1 block">{t('payable.dialog.vendor')}</label>
              <Select value={newVendor} onValueChange={setNewVendor}>
                <SelectTrigger className="h-9 text-sm border-[#D4D4D8]"><SelectValue placeholder={t('payable.dialog.vendorPlaceholder')} /></SelectTrigger>
                <SelectContent>
                  {uniqueVendors.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                  <SelectItem value="Other">{t('payable.dialog.vendorOther')}</SelectItem>
                </SelectContent>
              </Select>
              {newVendor === 'Other' && (
                <input type="text" value={newVendorOther} onChange={e => setNewVendorOther(e.target.value)} maxLength={FIELD_LIMITS.SHORT_NAME}
                  placeholder={t('payable.dialog.vendorPlaceholder')} className="mt-2 h-9 w-full rounded-md border border-[#D4D4D8] px-3 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-purple-400" />
              )}
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1 block">{t('payable.dialog.category')}</label>
              <Select value={newCategory} onValueChange={setNewCategory}>
                <SelectTrigger className="h-9 text-sm border-[#D4D4D8]"><SelectValue placeholder={t('payable.dialog.categoryPlaceholder')} /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_KEY_MAP).map(([k, key]) => <SelectItem key={k} value={k}>{t(key)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1 block">{t('payable.dialog.project')}</label>
              <Select value={newProject} onValueChange={setNewProject}>
                <SelectTrigger className="h-9 text-sm border-[#D4D4D8]"><SelectValue placeholder={t('payable.dialog.projectPlaceholder')} /></SelectTrigger>
                <SelectContent>
                  {projects.map(p => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1 block">{t('payable.dialog.description')}</label>
              <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={2} maxLength={FIELD_LIMITS.NOTE} placeholder={t('payable.dialog.descriptionPlaceholder')}
                className="w-full rounded-md border border-[#D4D4D8] px-3 py-2 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1 block">{t('payable.dialog.amount2')}</label>
              <input type="number" step="0.01" min="0.01" value={newAmount} onChange={e => setNewAmount(e.target.value)}
                className="h-9 w-full rounded-md border border-[#D4D4D8] px-3 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-purple-400" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1 block">{t('payable.dialog.receivedDate')}</label>
                <input type={newReceivedDate ? 'date' : 'text'} value={newReceivedDate} placeholder={t('payable.dialog.selectDate')}
                  onFocus={e => { e.target.type = 'date'; }} onBlur={e => { if (!newReceivedDate) e.target.type = 'text'; }}
                  onChange={e => setNewReceivedDate(e.target.value)}
                  className="h-9 w-full rounded-md border border-[#D4D4D8] px-3 text-sm text-[#0A0A0A] placeholder:text-[#71717A] focus:outline-none focus:ring-2 focus:ring-purple-400" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1 block">{t('payable.dialog.dueDate')}</label>
                <input type={newDueDate ? 'date' : 'text'} value={newDueDate} placeholder={t('payable.dialog.selectDate')}
                  onFocus={e => { e.target.type = 'date'; }} onBlur={e => { if (!newDueDate) e.target.type = 'text'; }}
                  onChange={e => setNewDueDate(e.target.value)}
                  className="h-9 w-full rounded-md border border-[#D4D4D8] px-3 text-sm text-[#0A0A0A] placeholder:text-[#71717A] focus:outline-none focus:ring-2 focus:ring-purple-400" />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1 block">{t('payable.dialog.notes')}</label>
              <textarea value={newCreateNotes} onChange={e => setNewCreateNotes(e.target.value)} rows={2} maxLength={FIELD_LIMITS.EXTENDED_NOTE} placeholder={t('payable.dialog.notesPlaceholder')}
                className="w-full rounded-md border border-[#D4D4D8] px-3 py-2 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none" />
            </div>
            {/* Document upload (optional) */}
            <div>
              <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1 block">{t('payable.dialog.documents')}</label>
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
                <span className="text-xs text-[#71717A]">{t('payable.dialog.dropFiles')}</span>
                <span className="text-[10px] text-[#D4D4D8]">{t('payable.dialog.fileFormats')}</span>
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
            <Button variant="ghost" onClick={() => setShowCreate(false)}>{t('buttons.cancel', { ns: 'common' })}</Button>
            <Button onClick={submitCreate} className="bg-purple-600 hover:bg-purple-700 text-white">{t('payable.dialog.submit')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Amount Dialog */}
      <Dialog open={!!editBill} onOpenChange={open => { if (!open) setEditBill(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('payable.edit.title')} — {editBill?.billNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {editBill && editBill.paidAmount > 0 && (
              <div className="rounded-md p-3 text-sm bg-amber-50 border border-amber-200 text-amber-800">
                {t('payable.edit.paidHint', { paid: fmtAmount(editBill.paidAmount) })}
              </div>
            )}
            <div>
              <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1 block">{t('payable.edit.newAmount')}</label>
              <input type="number" step="0.01" min="0.01" value={editAmount} onChange={e => setEditAmount(e.target.value)}
                className="h-9 w-full rounded-md border border-[#D4D4D8] px-3 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-purple-400" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1 block">{t('payable.dialog.receivedDate')}</label>
                <input type="date" value={editReceivedDate} onChange={e => setEditReceivedDate(e.target.value)}
                  className="h-9 w-full rounded-md border border-[#D4D4D8] px-3 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-purple-400" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1 block">{t('payable.dialog.dueDate')}</label>
                <input type="date" value={editDueDate} onChange={e => setEditDueDate(e.target.value)}
                  className="h-9 w-full rounded-md border border-[#D4D4D8] px-3 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-purple-400" />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1 block">{t('payable.edit.reason')}</label>
              <textarea value={editReason} onChange={e => setEditReason(e.target.value)} rows={2} maxLength={FIELD_LIMITS.NOTE} placeholder={t('payable.edit.reasonPlaceholder')}
                className="w-full rounded-md border border-[#D4D4D8] px-3 py-2 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditBill(null)}>{t('buttons.cancel', { ns: 'common' })}</Button>
            <Button onClick={submitEdit} disabled={submitting} className="bg-purple-600 hover:bg-purple-700 text-white">{t('buttons.save', { ns: 'common' })}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark Unpaid Dialog */}
      <Dialog open={!!unpayBill} onOpenChange={open => { if (!open) setUnpayBill(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('payable.unpay.title')} — {unpayBill?.billNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-md p-3 text-sm bg-amber-50 border border-amber-200 text-amber-800">
              {t('payable.unpay.warning')}
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1 block">{t('payable.unpay.reason')}</label>
              <textarea value={unpayReason} onChange={e => setUnpayReason(e.target.value)} rows={2} maxLength={FIELD_LIMITS.NOTE} placeholder={t('payable.unpay.reasonPlaceholder')}
                className="w-full rounded-md border border-[#D4D4D8] px-3 py-2 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setUnpayBill(null)}>{t('buttons.cancel', { ns: 'common' })}</Button>
            <Button onClick={submitUnpay} disabled={submitting} className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5">
              <RotateCcw className="w-4 h-4" /> {t('payable.unpay.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert to Invoice Dialog (Block 2) */}
      <Dialog open={!!convertBill} onOpenChange={open => { if (!open) setConvertBill(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('payable.convert.title')} — {convertBill?.billNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-md p-3 text-sm bg-blue-50 border border-blue-200 text-blue-800">
              {t('payable.convert.hint')}
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1 block">{t('payable.convert.number')}</label>
              <input type="text" value={convertNumber} onChange={e => setConvertNumber(e.target.value)} maxLength={FIELD_LIMITS.DOCUMENT_NUMBER}
                placeholder={t('payable.convert.numberPlaceholder')}
                className="h-9 w-full rounded-md border border-[#D4D4D8] px-3 text-sm text-[#0A0A0A] font-mono focus:outline-none focus:ring-2 focus:ring-purple-400" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConvertBill(null)}>{t('buttons.cancel', { ns: 'common' })}</Button>
            <Button onClick={submitConvert} disabled={submitting} className="bg-purple-600 hover:bg-purple-700 text-white gap-1.5">
              <Receipt className="w-4 h-4" /> {t('payable.convert.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit-info Dialog (Block 5) — vendor / category / description / notes / invoice # */}
      <Dialog open={!!infoBill} onOpenChange={open => { if (!open) setInfoBill(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('payable.info.title')} — {infoBill?.billNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1 block">{t('payable.info.vendor')}</label>
              <input type="text" value={infoVendor} onChange={e => setInfoVendor(e.target.value)} maxLength={200}
                className="h-9 w-full rounded-md border border-[#D4D4D8] px-3 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-purple-400" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1 block">{t('payable.info.category')}</label>
              <Select value={infoCategory} onValueChange={setInfoCategory}>
                <SelectTrigger className="h-9 text-sm border-[#D4D4D8]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(CATEGORY_KEY_MAP) as BillCategory[]).map(c => (
                    <SelectItem key={c} value={c}>{t(CATEGORY_KEY_MAP[c])}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1 block">{t('payable.info.description')}</label>
              <input type="text" value={infoDescription} onChange={e => setInfoDescription(e.target.value)} maxLength={500}
                className="h-9 w-full rounded-md border border-[#D4D4D8] px-3 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-purple-400" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1 block">{t('payable.info.notes')}</label>
              <textarea value={infoNotes} onChange={e => setInfoNotes(e.target.value)} maxLength={1000} rows={2}
                className="w-full rounded-md border border-[#D4D4D8] px-3 py-2 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-purple-400" />
            </div>
            {infoBill?.documentType === 'INVOICE' ? (
              <div>
                <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1 block">{t('payable.info.invoiceNumber')}</label>
                <input type="text" value={infoInvoiceNumber} onChange={e => setInfoInvoiceNumber(e.target.value)} maxLength={100}
                  className="h-9 w-full rounded-md border border-[#D4D4D8] px-3 text-sm text-[#0A0A0A] font-mono focus:outline-none focus:ring-2 focus:ring-purple-400" />
              </div>
            ) : (
              <div className="rounded-md p-2.5 text-xs bg-[#FAFAFA] border border-[#D4D4D8] text-[#71717A]">
                {t('payable.info.invoiceNumberBillHint')}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setInfoBill(null)}>{t('buttons.cancel', { ns: 'common' })}</Button>
            <Button onClick={submitInfo} disabled={submitting} className="bg-purple-600 hover:bg-purple-700 text-white gap-1.5">
              <FileText className="w-4 h-4" /> {t('payable.info.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reassign-project Dialog (Block 4) */}
      <Dialog open={!!reassignBill} onOpenChange={open => { if (!open) setReassignBill(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('payable.reassign.title')} — {reassignBill?.billNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-[#71717A]">
              {t('payable.reassign.description', { project: reassignBill?.project })}
            </p>
            {reassignBill && reassignBill.payments.some(p => !p.voided) && (
              <div className="rounded-md p-3 text-sm bg-amber-50 border border-amber-200 text-amber-800">
                {t('payable.reassign.activePaymentsHint')}
              </div>
            )}
            <div>
              <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1 block">{t('payable.reassign.targetLabel')}</label>
              <Select value={reassignTarget} onValueChange={setReassignTarget}>
                <SelectTrigger className="h-9 text-sm border-[#D4D4D8]">
                  <SelectValue placeholder={t('payable.reassign.targetPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {projects.filter(p => p.id !== reassignBill?.projectId).map(p => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReassignBill(null)}>{t('buttons.cancel', { ns: 'common' })}</Button>
            <Button onClick={submitReassign} disabled={submitting || !reassignTarget} className="bg-purple-600 hover:bg-purple-700 text-white gap-1.5">
              <ArrowRightLeft className="w-4 h-4" /> {t('payable.reassign.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog — two-step confirmation (Block 2) */}
      <Dialog open={!!deleteBill} onOpenChange={open => { if (!open) setDeleteBill(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('payable.delete.title')} — {deleteBill?.billNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="rounded-md p-3 text-sm bg-red-50 border border-red-200 text-red-800">
              {t('payable.delete.warning')}
            </div>
            {deleteBill && deleteBill.payments.some(p => !p.voided) && (
              <div className="rounded-md p-3 text-sm bg-amber-50 border border-amber-200 text-amber-800">
                {t('payable.delete.activePaymentsHint')}
              </div>
            )}
            {deleteStep === 2 && (
              <div className="rounded-md p-3 text-sm bg-red-100 border border-red-300 text-red-900 font-medium">
                {t('payable.delete.confirmFinal')}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteBill(null)}>{t('buttons.cancel', { ns: 'common' })}</Button>
            {deleteStep === 1 ? (
              <Button onClick={() => setDeleteStep(2)} className="bg-red-600 hover:bg-red-700 text-white gap-1.5">
                <Trash2 className="w-4 h-4" /> {t('payable.delete.continue')}
              </Button>
            ) : (
              <Button onClick={submitDelete} disabled={submitting} className="bg-red-600 hover:bg-red-700 text-white gap-1.5">
                <Trash2 className="w-4 h-4" /> {t('payable.delete.confirm')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}