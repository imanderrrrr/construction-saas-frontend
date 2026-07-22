import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import {
  CheckCircle, AlertTriangle, XCircle, Clock,
  Filter as FilterIcon, ChevronDown, ChevronRight,
  Image as ImageIcon, Droplets, Package, Wrench,
  Utensils, ShoppingBag, Car, MoreHorizontal, AlertCircle, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { StatCard } from './StatCard';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from './ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from './ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from './ui/alert-dialog';
import { Textarea } from './ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from './ui/select';
import { EXPENSE_TYPES } from './NewExpense';
import {
  getSupervisorExpenses, getSupervisorSummary, supervisorBatchApprove,
  approveExpense, observeExpense, rejectExpense,
  receiptUrl, type ExpenseResponse, type ExpenseSummaryResponse,
} from '../services/expenses';
import { listActiveUsers, type UserDTO } from '../services/users';
import { businessToday, nDaysAgo } from '../helpers/dateTime';
import { ApiError } from '../lib/api';

// Types

type ExpenseStatus = 'Pending' | 'Approved' | 'Observed' | 'Rejected';

interface ExpenseRecord {
  id: string;
  workerName: string;
  date: string;
  type: string;
  project: string;
  amount: number;
  status: ExpenseStatus;
  workerComment?: string;
  reviewerName?: string;
  reviewerComment?: string;
  receiptUrl?: string | null;
}

// Constants

const ITEMS_PER_PAGE = 10;

const STATUS_MAP: Record<string, ExpenseStatus> = {
  PENDING: 'Pending', APPROVED: 'Approved', OBSERVED: 'Observed', REJECTED: 'Rejected',
};
const TYPE_KEY_MAP: Record<string, string> = {
  FUEL: 'fuel', MATERIALS: 'materials', TOOLS: 'tools',
  PER_DIEM: 'per-diem', MINOR_PURCHASES: 'minor-purchases',
  TRANSPORTATION: 'transportation', OTHER: 'other',
};

const TYPE_ICONS: Record<string, React.ElementType> = {
  'fuel': Droplets, 'materials': Package, 'tools': Wrench,
  'per-diem': Utensils, 'minor-purchases': ShoppingBag,
  'transportation': Car, 'other': MoreHorizontal,
};

function mapExpense(e: ExpenseResponse): ExpenseRecord {
  return {
    id: String(e.id),
    workerName: e.workerName ?? e.workerUsername,
    date: e.expenseDate,
    type: TYPE_KEY_MAP[e.expenseType] ?? e.expenseType.toLowerCase(),
    project: e.projectName,
    amount: e.amountCents / 100,
    status: STATUS_MAP[e.status] ?? 'Pending',
    workerComment: e.description ?? undefined,
    reviewerName: e.reviewerName ?? undefined,
    reviewerComment: e.reviewerComment ?? undefined,
    receiptUrl: e.receiptUrl,
  };
}

// Style configs

const STATUS_CFG: Record<ExpenseStatus, { bg: string; text: string; border: string; dot: string }> = {
  Pending:  { bg: 'bg-amber-50',     text: 'text-amber-700',  border: 'border-amber-200',    dot: 'bg-amber-500'   },
  Approved: { bg: 'bg-emerald-50',   text: 'text-emerald-700',border: 'border-emerald-200',  dot: 'bg-emerald-500' },
  Observed: { bg: 'bg-[#F97316]/10', text: 'text-[#F97316]', border: 'border-[#F97316]/20', dot: 'bg-[#F97316]'  },
  Rejected: { bg: 'bg-red-50',       text: 'text-red-700',    border: 'border-red-200',      dot: 'bg-red-500'    },
};

// Styling for the reviewer's note, per status. Pending is absent: it has no
// reviewer yet. Approved carries the optional note from the approve dialog,
// which is why it reads emerald rather than the amber/red of a problem.
const REVIEW_NOTE_CFG: Partial<Record<ExpenseStatus, { box: string; title: string; body: string; labelKey: string }>> = {
  Approved: { box: 'bg-emerald-50 border-emerald-200', title: 'text-emerald-800', body: 'text-emerald-700', labelKey: 'review.detail.approvalNote'    },
  Observed: { box: 'bg-amber-50 border-amber-200',     title: 'text-amber-800',   body: 'text-amber-700',   labelKey: 'review.detail.observation'     },
  Rejected: { box: 'bg-red-50 border-red-200',         title: 'text-red-800',     body: 'text-red-700',     labelKey: 'review.detail.rejectionReason' },
};

// Helpers

function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function fmtAmount(n: number): string {
  return `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

function getThirtyDaysAgo(): string {
  return nDaysAgo(30);
}

function getToday(): string {
  return businessToday();
}

// Sub-components

function StatusBadge({ status }: { status: ExpenseStatus }) {
  const { t } = useTranslation('expenses');
  const c = STATUS_CFG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${c.bg} ${c.text} ${c.border} whitespace-nowrap`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
      {t(`status.${status.toLowerCase()}`)}
    </span>
  );
}

function WorkerAvatar({ name }: { name: string }) {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const colors = ['bg-[#F97316]', 'bg-emerald-600', 'bg-purple-600', 'bg-amber-600'];
  const colorIdx = name.charCodeAt(0) % colors.length;
  return (
    <div className="flex items-center gap-2.5">
      <div className={`w-7 h-7 ${colors[colorIdx]} rounded-full flex items-center justify-center flex-shrink-0`}>
        <span className="text-[10px] font-bold text-white">{initials}</span>
      </div>
      <span className="text-sm font-medium text-[#0A0A0A] whitespace-nowrap">{name}</span>
    </div>
  );
}

function TypeChip({ type, compact = false }: { type: string; compact?: boolean }) {
  const { t } = useTranslation('expenses');
  const Icon = TYPE_ICONS[type] ?? MoreHorizontal;
  const label = compact
    ? t(`review.types.${type}.short`, { defaultValue: type })
    : t(`review.types.${type}`, { defaultValue: type });
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="w-3.5 h-3.5 text-[#71717A] flex-shrink-0" />
      <span className="text-sm text-[#0A0A0A]">{label}</span>
    </div>
  );
}

function ReceiptThumb({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation('expenses');
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick(); }}
      title={t('review.viewReceipt')}
      className="w-10 h-10 rounded-lg bg-[#FAFAFA] border border-[#D4D4D8] flex items-center justify-center hover:border-[#F97316] hover:bg-[#F97316]/5 transition-colors"
    >
      <ImageIcon className="w-4 h-4 text-[#71717A]" />
    </button>
  );
}

function Pagination({ currentPage, totalPages, onPageChange }: {
  currentPage: number; totalPages: number; onPageChange: (p: number) => void;
}) {
  const { t } = useTranslation('expenses');
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-1 py-4 border-t border-[#D4D4D8]">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="h-8 px-3 rounded-lg text-xs font-medium text-[#71717A] hover:text-[#0A0A0A] hover:bg-[#FAFAFA] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        {t('review.prev')}
      </button>
      {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
        <button
          key={p}
          onClick={() => onPageChange(p)}
          className={`h-8 w-8 rounded-lg text-xs font-semibold transition-colors ${
            p === currentPage ? 'bg-[#F97316] text-white' : 'text-[#71717A] hover:text-[#0A0A0A] hover:bg-[#FAFAFA]'
          }`}
        >
          {p}
        </button>
      ))}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="h-8 px-3 rounded-lg text-xs font-medium text-[#71717A] hover:text-[#0A0A0A] hover:bg-[#FAFAFA] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        {t('review.next')}
      </button>
    </div>
  );
}

// Detail panel (expanded row content)

function ExpenseDetailPanel({
  expense, onApprove, onObserve, onReject, onViewReceipt,
}: {
  expense: ExpenseRecord;
  onApprove: () => void;
  onObserve: () => void;
  onReject: () => void;
  onViewReceipt: () => void;
}) {
  const { t } = useTranslation('expenses');
  const noteCfg = REVIEW_NOTE_CFG[expense.status];
  return (
    <div className="bg-[#FAFAFA] rounded-xl border border-[#D4D4D8] p-4 space-y-4">
      {/* Detail grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { label: t('review.detail.worker'),  value: expense.workerName          },
          { label: t('review.detail.type'),    value: t(`review.types.${expense.type}`, { defaultValue: expense.type }) },
          { label: t('review.detail.amount'),  value: fmtAmount(expense.amount)   },
          { label: t('review.detail.project'), value: expense.project             },
          { label: t('review.detail.date'),    value: fmtDate(expense.date)       },
          { label: t('review.detail.status'),  value: t(`status.${expense.status.toLowerCase()}`) },
        ].map(({ label, value }) => (
          <div key={label}>
            <p className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wide mb-0.5">{label}</p>
            <p className="text-sm font-medium text-[#0A0A0A]">{value}</p>
          </div>
        ))}
      </div>

      {/* Worker comment */}
      {expense.workerComment && (
        <div>
          <p className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wide mb-0.5">{t('review.detail.workerNotes')}</p>
          <p className="text-sm text-[#0A0A0A]">{expense.workerComment}</p>
        </div>
      )}

      {/* Receipt link */}
      <button
        onClick={onViewReceipt}
        className="flex items-center gap-1.5 text-xs font-medium text-[#F97316] hover:text-[#C2410C] transition-colors"
      >
        <ImageIcon className="w-3.5 h-3.5" />
        {t('review.detail.viewReceipt')}
      </button>

      {/* Reviewer's note (observation, rejection reason, or approval note) */}
      {noteCfg && expense.reviewerComment && (
        <div className={`rounded-xl border p-3 ${noteCfg.box}`}>
          <p className={`text-xs font-semibold mb-0.5 ${noteCfg.title}`}>
            {t(noteCfg.labelKey)} — {expense.reviewerName}
          </p>
          <p className={`text-[11px] ${noteCfg.body}`}>
            {expense.reviewerComment}
          </p>
        </div>
      )}

      {/* Action buttons (only when Pending) */}
      {expense.status === 'Pending' && (
        <div className="flex items-center gap-2 pt-1 border-t border-[#D4D4D8]">
          <span className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mr-1">{t('review.detail.review')}</span>
          <Button
            size="sm" onClick={onApprove}
            className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
          >
            <CheckCircle className="w-3.5 h-3.5" />{t('review.btn.approve')}
          </Button>
          <Button
            size="sm" variant="outline" onClick={onObserve}
            className="h-8 px-3 text-xs border-[#F97316]/30 text-[#F97316] hover:bg-[#F97316]/10 gap-1.5"
          >
            <AlertTriangle className="w-3.5 h-3.5" />{t('review.btn.observe')}
          </Button>
          <Button
            size="sm" variant="outline" onClick={onReject}
            className="h-8 px-3 text-xs border-red-200 text-[#d4183d] hover:bg-red-50 gap-1.5"
          >
            <XCircle className="w-3.5 h-3.5" />{t('review.btn.reject')}
          </Button>
        </div>
      )}
    </div>
  );
}

// Receipt image hook

function useReceiptImage(expense: ExpenseRecord | null) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isPdf,   setIsPdf]   = useState(false);

  useEffect(() => {
    setBlobUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
    setIsPdf(false);

    if (!expense?.receiptUrl) return;

    setLoading(true);
    let cancelled = false;

    fetch(receiptUrl(Number(expense.id)), { credentials: 'include' as RequestCredentials })
      .then(async res => {
        if (cancelled || !res.ok) return;
        const ct = res.headers.get('content-type') ?? '';
        const blob = await res.blob();
        if (!cancelled) {
          setBlobUrl(URL.createObjectURL(blob));
          setIsPdf(ct.includes('pdf'));
        }
      })
      .catch(err => toast.error(err?.message))
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [expense]);

  return { blobUrl, loading, isPdf };
}

// Main component

export function ExpenseReviews() {
  const { t } = useTranslation('expenses');

  // Data from API
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<ExpenseSummaryResponse | null>(null);
  const [workers, setWorkers] = useState<UserDTO[]>([]);

  useEffect(() => {
    listActiveUsers().then(u => setWorkers(u.filter(w => w.role === 'WORKER'))).catch(err => toast.error(err?.message));
  }, []);

  // Filter state
  const [dateFrom,      setDateFrom]      = useState(getThirtyDaysAgo);
  const [dateTo,        setDateTo]        = useState(getToday);
  const [workerFilter,  setWorkerFilter]  = useState('all');
  const [typeFilter,    setTypeFilter]    = useState('all');
  const [statusFilter,  setStatusFilter]  = useState('all');
  const [appliedFrom,   setAppliedFrom]   = useState(getThirtyDaysAgo);
  const [appliedTo,     setAppliedTo]     = useState(getToday);
  const [appliedWorker, setAppliedWorker] = useState('all');
  const [appliedType,   setAppliedType]   = useState('all');
  const [appliedStatus, setAppliedStatus] = useState('all');

  // UI state
  const [expandedId,    setExpandedId]    = useState<string | null>(null);
  const [currentPage,   setCurrentPage]   = useState(1);
  const [receiptTarget, setReceiptTarget] = useState<ExpenseRecord | null>(null);

  // Modal: Approve
  const [approveTarget, setApproveTarget] = useState<ExpenseRecord | null>(null);
  const [approveNote,   setApproveNote]   = useState('');

  // Modal: Observe
  const [observeTarget,   setObserveTarget]   = useState<ExpenseRecord | null>(null);
  const [observeComment,  setObserveComment]  = useState('');
  const [observeTouched,  setObserveTouched]  = useState(false);
  const observeValid = observeComment.trim().length >= 10;

  // Modal: Reject
  const [rejectTarget,    setRejectTarget]    = useState<ExpenseRecord | null>(null);
  const [rejectComment,   setRejectComment]   = useState('');
  const [rejectTouched,   setRejectTouched]   = useState(false);
  const rejectValid = rejectComment.trim().length >= 10;

  // Modal: Batch approve
  const [showBatch,     setShowBatch]     = useState(false);

  // Receipt image loading
  const receiptImage   = useReceiptImage(receiptTarget);
  const approveReceipt = useReceiptImage(approveTarget);

  // Fetch data from API
  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const backendStatus = appliedStatus !== 'all' ? appliedStatus.toUpperCase() : undefined;
      const backendType = appliedType !== 'all' ? appliedType.toUpperCase().replace(/-/g, '_') : undefined;
      const res = await getSupervisorExpenses({
        status: backendStatus,
        type: backendType,
        workerId: appliedWorker !== 'all' ? Number(appliedWorker) : undefined,
        dateFrom: appliedFrom,
        dateTo: appliedTo,
        page: currentPage - 1,
        size: ITEMS_PER_PAGE,
      });
      setExpenses(res.content.map(mapExpense));
      setTotalElements(res.totalElements);
      setTotalPages(res.totalPages || 1);
    } catch { /* silent */ } finally { setLoading(false); }
  }, [appliedFrom, appliedTo, appliedWorker, appliedType, appliedStatus, currentPage]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);
  useEffect(() => { getSupervisorSummary().then(setSummary).catch(err => toast.error(err?.message)); }, []);

  // Derived
  const pendingExpenses = useMemo(() => expenses.filter(e => e.status === 'Pending'), [expenses]);
  const pendingTotal    = useMemo(() => pendingExpenses.reduce((s, e) => s + e.amount, 0), [pendingExpenses]);

  const pendingByWorker = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {};
    pendingExpenses.forEach(e => {
      if (!map[e.workerName]) map[e.workerName] = { count: 0, total: 0 };
      map[e.workerName].count += 1;
      map[e.workerName].total += e.amount;
    });
    return map;
  }, [pendingExpenses]);

  // Filter handlers
  function handleApply() {
    setAppliedFrom(dateFrom); setAppliedTo(dateTo);
    setAppliedWorker(workerFilter); setAppliedType(typeFilter); setAppliedStatus(statusFilter);
    setCurrentPage(1); setExpandedId(null);
  }

  function handleReset() {
    const f = getThirtyDaysAgo(), td = getToday();
    setDateFrom(f); setDateTo(td);
    setWorkerFilter('all'); setTypeFilter('all'); setStatusFilter('all');
    setAppliedFrom(f); setAppliedTo(td);
    setAppliedWorker('all'); setAppliedType('all'); setAppliedStatus('all');
    setCurrentPage(1); setExpandedId(null);
  }

  const paginated = expenses;

  // Approve
  function openApprove(expense: ExpenseRecord) { setApproveTarget(expense); setApproveNote(''); }
  async function handleApproveConfirm() {
    if (!approveTarget) return;
    try {
      const result = await approveExpense(Number(approveTarget.id), 'supervisor', approveNote);
      toast.success(t('review.toast.approved', { amount: fmtAmount(approveTarget.amount), worker: approveTarget.workerName }));
      if (result.budgetWarning) {
        const w = result.budgetWarning;
        const names = w.pendingWorkers.map(p => `${p.workerName ?? `ID ${p.workerId}`} (${p.unpaidHours.toFixed(1)}h)`).join(', ');
        toast.warning(t('common:budgetWarning.title', 'Pending labour payments'), {
          description: `${t('common:budgetWarning.desc', 'Remaining budget')} ($${(w.remainingBudgetCents / 100).toFixed(2)}) ${t('common:budgetWarning.insufficient', 'cannot cover projected payroll')} ($${(w.projectedLaborCostCents / 100).toFixed(2)}): ${names}`,
          duration: 10000,
        });
      }
      setApproveTarget(null); fetchExpenses();
      getSupervisorSummary().then(setSummary).catch(err => toast.error(err?.message));
    } catch (err: unknown) {
      if (err instanceof ApiError && err.code === 'BUDGET_EXCEEDED') {
        toast.error(
          t('review.toast.budgetExceeded.title', 'Project budget exceeded'),
          { description: err.message, duration: 10000 },
        );
      } else {
        const message = err instanceof Error ? err.message : undefined;
        toast.error(t('review.toast.approveFailed'), { description: message });
      }
    }
  }

  // Observe
  function openObserve(expense: ExpenseRecord) { setObserveTarget(expense); setObserveComment(''); setObserveTouched(false); }
  async function handleObserveConfirm() {
    setObserveTouched(true);
    if (!observeValid || !observeTarget) return;
    try {
      await observeExpense(Number(observeTarget.id), observeComment.trim(), 'supervisor');
      toast.info(t('review.toast.observed', { worker: observeTarget.workerName }));
      setObserveTarget(null); fetchExpenses();
      getSupervisorSummary().then(setSummary).catch(err => toast.error(err?.message));
    } catch (err: any) { toast.error(t('review.toast.observeFailed'), { description: err?.message }); }
  }

  // Reject
  function openReject(expense: ExpenseRecord) { setRejectTarget(expense); setRejectComment(''); setRejectTouched(false); }
  async function handleRejectConfirm() {
    setRejectTouched(true);
    if (!rejectValid || !rejectTarget) return;
    try {
      await rejectExpense(Number(rejectTarget.id), rejectComment.trim(), 'supervisor');
      toast.error(t('review.toast.rejected', { amount: fmtAmount(rejectTarget.amount) }));
      setRejectTarget(null); fetchExpenses();
      getSupervisorSummary().then(setSummary).catch(err => toast.error(err?.message));
    } catch (err: any) { toast.error(t('review.toast.rejectFailed'), { description: err?.message }); }
  }

  // Batch approve
  async function handleBatchApprove() {
    try {
      const res = await supervisorBatchApprove();
      setExpandedId(null); setShowBatch(false);
      toast.success(t('review.toast.batchApproved', { count: res.approvedCount }));
      fetchExpenses();
      getSupervisorSummary().then(setSummary).catch(err => toast.error(err?.message));
    } catch (err: any) { toast.error(t('review.toast.batchFailed'), { description: err?.message }); }
  }

  // KPI values
  const fmtCents = (c: number) => `$${(c / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  const kpiPending  = summary ? String(summary.pendingCount) : '·';
  const kpiApproved = summary ? fmtCents(summary.totalApprovedCents) : '·';
  const kpiObserved = summary ? String(summary.observedCount) : '·';
  const kpiRejected = summary ? String(summary.rejectedCount) : '·';

  const tableHeaders = [
    t('review.table.worker'), t('review.table.date'), t('review.table.type'),
    t('review.table.amount'), t('review.table.project'), t('review.table.receipt'),
    t('review.table.status'), t('review.table.actions'),
  ];

  return (
    <div className="space-y-6 max-w-6xl">

      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-sm font-semibold text-[#0A0A0A]">{t('review.title')}</h2>
          <p className="text-[11px] text-[#71717A] mt-0.5">{t('review.subtitle')}</p>
        </div>
        <Button
          onClick={() => setShowBatch(true)}
          disabled={pendingExpenses.length === 0}
          className="bg-emerald-600 hover:bg-emerald-700 text-white h-9 px-4 text-xs gap-2 flex-shrink-0 disabled:opacity-50 w-full sm:w-auto"
        >
          <CheckCircle className="w-3.5 h-3.5" />
          {t('review.approveAllPending')}
          {pendingExpenses.length > 0 && (
            <span className="bg-white/20 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-0.5">
              {pendingExpenses.length}
            </span>
          )}
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Clock}         title={t('review.kpi.pendingReview')}    value={kpiPending}  subtitle={t('review.kpi.awaitingDecision')}    iconBgColor="bg-amber-50"     iconColor="text-amber-600"    />
        <StatCard icon={CheckCircle}   title={t('review.kpi.approvedThisWeek')} value={kpiApproved} subtitle={t('review.kpi.totalValue')}          iconBgColor="bg-emerald-50"   iconColor="text-emerald-600"  />
        <StatCard icon={AlertTriangle} title={t('review.kpi.observed')}         value={kpiObserved} subtitle={t('review.kpi.workerActionNeeded')} iconBgColor="bg-[#F97316]/10" iconColor="text-[#F97316]"    />
        <StatCard icon={XCircle}       title={t('review.kpi.rejected')}         value={kpiRejected} subtitle={t('review.kpi.notReimbursable')}     iconBgColor="bg-red-50"       iconColor="text-red-600"      />
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] p-3 sm:p-5">
        <div className="flex items-center gap-2 mb-4">
          <FilterIcon className="w-4 h-4 text-[#71717A]" />
          <span className="text-sm font-semibold text-[#0A0A0A]">{t('review.filters')}</span>
          {(appliedWorker !== 'all' || appliedType !== 'all' || appliedStatus !== 'all') && (
            <span className="px-1.5 py-0.5 bg-[#F97316]/10 text-[#F97316] text-[10px] font-medium rounded-full">{t('review.filters.active')}</span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('review.filters.from')}</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="h-9 rounded-lg border border-[#D4D4D8] bg-white px-3 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#F97316]/25 focus:border-[#F97316] transition-colors w-full" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('review.filters.to')}</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="h-9 rounded-lg border border-[#D4D4D8] bg-white px-3 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#F97316]/25 focus:border-[#F97316] transition-colors w-full" />
          </div>
          <div className="flex flex-col gap-1.5 col-span-2 sm:min-w-[160px]">
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('review.filters.worker')}</label>
            <Select value={workerFilter} onValueChange={setWorkerFilter}>
              <SelectTrigger className="h-9 border-[#D4D4D8] text-sm">
                <SelectValue placeholder={t('review.filters.allWorkers')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('review.filters.allWorkers')}</SelectItem>
                {workers.map(w => <SelectItem key={w.id} value={String(w.id)}>{w.fullName ?? w.username}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5 sm:min-w-[155px]">
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('review.filters.type')}</label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-9 border-[#D4D4D8] text-sm">
                <SelectValue placeholder={t('review.filters.allTypes')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('review.filters.allTypes')}</SelectItem>
                {EXPENSE_TYPES.map(tp => <SelectItem key={tp.value} value={tp.value}>{tp.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5 sm:min-w-[130px]">
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('review.filters.status')}</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 border-[#D4D4D8] text-sm">
                <SelectValue placeholder={t('review.filters.all')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('review.filters.all')}</SelectItem>
                {(['Pending', 'Approved', 'Observed', 'Rejected'] as ExpenseStatus[]).map(s => (
                  <SelectItem key={s} value={s}>{t(`status.${s.toLowerCase()}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="hidden sm:block flex-1" />
          <div className="flex items-center gap-2 col-span-2 sm:col-span-1">
            <Button variant="outline" size="sm" onClick={handleReset}
              className="h-9 px-4 text-xs border-[#D4D4D8] text-[#71717A] hover:text-[#0A0A0A] flex-1 sm:flex-initial">
              {t('review.filters.reset')}
            </Button>
            <Button size="sm" onClick={handleApply}
              className="h-9 px-4 text-xs bg-[#F97316] hover:bg-[#C2410C] text-white flex-1 sm:flex-initial">
              {t('review.filters.apply')}
            </Button>
          </div>
        </div>

        <p className="text-[11px] text-[#71717A] mt-3 pt-3 border-t border-[#FAFAFA]">
          {t('review.filters.showing')} <span className="font-medium text-[#0A0A0A]">{totalElements}</span> {t('review.filters.expense', { count: totalElements })}
          {pendingExpenses.length > 0 && (
            <span className="ml-2 text-amber-600 font-medium">· {pendingExpenses.length} {t('review.filters.pending')}</span>
          )}
        </p>
      </div>

      {/* Table card */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-[#D4D4D8]">
          <CheckCircle className="w-4 h-4 text-[#71717A]" />
          <span className="text-sm font-semibold text-[#0A0A0A]">{t('review.teamExpenses')}</span>
          <span className="ml-1 text-xs text-[#71717A]">· {t('review.record', { count: totalElements })}</span>
        </div>

        {totalElements === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <div className="w-14 h-14 bg-[#FAFAFA] rounded-full flex items-center justify-center mb-3">
              <CheckCircle className="w-7 h-7 text-[#D4D4D8]" />
            </div>
            <p className="text-sm font-semibold text-[#0A0A0A] mb-1">{t('review.noExpenses')}</p>
            <p className="text-xs text-[#71717A]">{t('review.noExpensesHint')}</p>
          </div>
        )}

        {/* Desktop table */}
        {paginated.length > 0 && (
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#FAFAFA] hover:bg-[#FAFAFA]">
                  <TableHead className="w-8" />
                  {tableHeaders.map(h => (
                    <TableHead key={h} className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.flatMap(expense => {
                  const isExpanded = expandedId === expense.id;

                  const mainRow = (
                    <TableRow
                      key={`${expense.id}-row`}
                      onClick={() => setExpandedId(isExpanded ? null : expense.id)}
                      className={`cursor-pointer border-b border-[#D4D4D8]/50 transition-colors ${
                        isExpanded ? 'bg-[#FAFAFA]' : 'hover:bg-[#FAFAFA]/50'
                      }`}
                    >
                      <TableCell className="py-3 pr-0 pl-4 text-[#71717A]">
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </TableCell>
                      <TableCell className="py-3"><WorkerAvatar name={expense.workerName} /></TableCell>
                      <TableCell className="py-3"><span className="text-sm text-[#0A0A0A] whitespace-nowrap">{fmtDate(expense.date)}</span></TableCell>
                      <TableCell className="py-3"><TypeChip type={expense.type} compact /></TableCell>
                      <TableCell className="py-3"><span className="font-mono font-semibold text-sm text-[#0A0A0A]">{fmtAmount(expense.amount)}</span></TableCell>
                      <TableCell className="py-3"><span className="text-sm text-[#71717A]">{expense.project}</span></TableCell>
                      <TableCell className="py-3"><ReceiptThumb onClick={() => setReceiptTarget(expense)} /></TableCell>
                      <TableCell className="py-3"><StatusBadge status={expense.status} /></TableCell>
                      <TableCell className="py-3">
                        {expense.status === 'Pending' && (
                          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            <button onClick={() => openApprove(expense)} title={t('review.btn.approve')}
                              className="w-8 h-8 rounded-full flex items-center justify-center text-emerald-600 hover:bg-emerald-50 transition-colors">
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button onClick={() => openObserve(expense)} title={t('review.btn.observe')}
                              className="w-8 h-8 rounded-full flex items-center justify-center text-[#F97316] hover:bg-[#F97316]/10 transition-colors">
                              <AlertTriangle className="w-4 h-4" />
                            </button>
                            <button onClick={() => openReject(expense)} title={t('review.btn.reject')}
                              className="w-8 h-8 rounded-full flex items-center justify-center text-[#d4183d] hover:bg-red-50 transition-colors">
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );

                  if (!isExpanded) return [mainRow];

                  const detailRow = (
                    <TableRow key={`${expense.id}-detail`} className="bg-[#FAFAFA]/40 hover:bg-[#FAFAFA]/40">
                      <TableCell colSpan={9} className="px-4 py-4 border-b border-[#D4D4D8]/50">
                        <ExpenseDetailPanel expense={expense}
                          onApprove={() => openApprove(expense)} onObserve={() => openObserve(expense)}
                          onReject={() => openReject(expense)} onViewReceipt={() => setReceiptTarget(expense)} />
                      </TableCell>
                    </TableRow>
                  );
                  return [mainRow, detailRow];
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Mobile cards */}
        {paginated.length > 0 && (
          <div className="md:hidden divide-y divide-[#D4D4D8]">
            {paginated.map(expense => {
              const isExpanded = expandedId === expense.id;
              const TypeIcon = TYPE_ICONS[expense.type] ?? MoreHorizontal;
              return (
                <div key={expense.id} className="p-4">
                  <button onClick={() => setExpandedId(isExpanded ? null : expense.id)} className="w-full flex items-start gap-3 text-left">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1"><WorkerAvatar name={expense.workerName} /></div>
                      <div className="flex items-center gap-1.5 mb-1 ml-9">
                        <TypeIcon className="w-3.5 h-3.5 text-[#71717A]" />
                        <span className="text-xs text-[#71717A]">{t(`review.types.${expense.type}.short`, { defaultValue: expense.type })}</span>
                        <span className="text-[#D4D4D8]">·</span>
                        <span className="text-xs font-mono font-semibold text-[#0A0A0A]">{fmtAmount(expense.amount)}</span>
                      </div>
                      <p className="text-[11px] text-[#71717A] ml-9">{expense.project} · {fmtDate(expense.date)}</p>
                    </div>
                    <div className="flex-shrink-0 mt-0.5">
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-[#71717A]" /> : <ChevronRight className="w-4 h-4 text-[#71717A]" />}
                    </div>
                  </button>
                  <div className="flex items-center gap-2 mt-2">
                    <StatusBadge status={expense.status} />
                    {expense.status === 'Pending' && (
                      <div className="flex items-center gap-1 ml-auto" onClick={e => e.stopPropagation()}>
                        <button onClick={() => openApprove(expense)} title={t('review.btn.approve')}
                          className="w-8 h-8 rounded-full flex items-center justify-center text-emerald-600 hover:bg-emerald-50 transition-colors">
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button onClick={() => openObserve(expense)} title={t('review.btn.observe')}
                          className="w-8 h-8 rounded-full flex items-center justify-center text-[#F97316] hover:bg-[#F97316]/10 transition-colors">
                          <AlertTriangle className="w-4 h-4" />
                        </button>
                        <button onClick={() => openReject(expense)} title={t('review.btn.reject')}
                          className="w-8 h-8 rounded-full flex items-center justify-center text-[#d4183d] hover:bg-red-50 transition-colors">
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  {isExpanded && (
                    <div className="mt-3">
                      <ExpenseDetailPanel expense={expense}
                        onApprove={() => openApprove(expense)} onObserve={() => openObserve(expense)}
                        onReject={() => openReject(expense)} onViewReceipt={() => setReceiptTarget(expense)} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {totalElements > 0 && (
          <Pagination currentPage={currentPage} totalPages={totalPages}
            onPageChange={p => { setCurrentPage(p); setExpandedId(null); }} />
        )}
      </div>

      {/* MODAL 1 — Approve */}
      <Dialog open={approveTarget !== null} onOpenChange={open => { if (!open) setApproveTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#0A0A0A]">{t('review.dialog.approveTitle')}</DialogTitle>
            <DialogDescription>{t('review.dialog.approveDesc')}</DialogDescription>
          </DialogHeader>
          {approveTarget && (
            <div className="space-y-4 py-1">
              <div className="bg-[#FAFAFA] rounded-xl border border-[#D4D4D8] p-4 space-y-3">
                <WorkerAvatar name={approveTarget.workerName} />
                <div className="flex items-center gap-2 mt-1">
                  {(() => { const Icon = TYPE_ICONS[approveTarget.type] ?? MoreHorizontal; return <Icon className="w-4 h-4 text-[#71717A]" />; })()}
                  <span className="text-sm text-[#0A0A0A]">{t(`review.types.${approveTarget.type}`, { defaultValue: approveTarget.type })}</span>
                </div>
                <p className="text-2xl font-bold font-mono text-[#0A0A0A]">{fmtAmount(approveTarget.amount)}</p>
                <div className="flex items-center gap-4 text-xs text-[#71717A]">
                  <span>{approveTarget.project}</span><span>·</span><span>{fmtDate(approveTarget.date)}</span>
                </div>
                <div className="h-20 bg-[#FAFAFA] border border-[#D4D4D8] rounded-lg overflow-hidden flex items-center justify-center">
                  {approveReceipt.loading && <Loader2 className="w-4 h-4 animate-spin text-[#71717A]" />}
                  {!approveReceipt.loading && approveReceipt.blobUrl && !approveReceipt.isPdf && (
                    <img src={approveReceipt.blobUrl} alt="Receipt" className="h-full w-full object-contain" />
                  )}
                  {!approveReceipt.loading && approveReceipt.blobUrl && approveReceipt.isPdf && (
                    <span className="text-xs text-[#71717A]">{t('review.receipt.pdfReceipt')}</span>
                  )}
                  {!approveReceipt.loading && !approveReceipt.blobUrl && (
                    <div className="flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-[#D4D4D8]" />
                      <span className="text-xs text-[#D4D4D8]">{t('review.receipt.noReceipt')}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[#0A0A0A]">{t('review.dialog.addNote')}</label>
                <Textarea value={approveNote} onChange={e => setApproveNote(e.target.value)} maxLength={500}
                  placeholder={t('review.dialog.notePlaceholder')}
                  className="resize-none text-sm border-[#D4D4D8] min-h-[72px]" rows={3} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveTarget(null)} className="border-[#D4D4D8] text-[#0A0A0A]">{t('review.dialog.cancel')}</Button>
            <Button onClick={handleApproveConfirm} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
              <CheckCircle className="w-4 h-4" />{t('review.btn.approve')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2 — Observe */}
      <Dialog open={observeTarget !== null} onOpenChange={open => { if (!open) setObserveTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#0A0A0A]">{t('review.dialog.observeTitle')}</DialogTitle>
            {observeTarget && (
              <DialogDescription>
                {observeTarget.workerName} · {t(`review.types.${observeTarget.type}`, { defaultValue: observeTarget.type })} · {fmtAmount(observeTarget.amount)}
              </DialogDescription>
            )}
          </DialogHeader>
          {observeTarget && (
            <div className="space-y-4 py-1">
              <div className="flex items-center gap-2 px-3 py-2 bg-[#FAFAFA] border border-[#D4D4D8] rounded-lg text-xs text-[#71717A]">
                <span className="font-medium text-[#0A0A0A]">{observeTarget.project}</span>
                <span>·</span><span>{fmtDate(observeTarget.date)}</span>
                <span>·</span><span className="font-mono font-semibold text-[#0A0A0A]">{fmtAmount(observeTarget.amount)}</span>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[#0A0A0A]">
                  {t('review.dialog.observeReason')} <span className="text-red-500">*</span>
                </label>
                <Textarea value={observeComment} onChange={e => setObserveComment(e.target.value)}
                  onBlur={() => setObserveTouched(true)} placeholder={t('review.dialog.observePlaceholder')}
                  className={`resize-none text-sm min-h-[88px] transition-colors ${
                    observeTouched && !observeValid ? 'border-red-400 focus:border-red-500' : 'border-[#D4D4D8]'
                  }`} rows={3} />
                {observeTouched && !observeValid && (
                  <p className="flex items-center gap-1 text-xs text-red-600">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    {t('review.dialog.observeMinChars', { current: observeComment.trim().length })}
                  </p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setObserveTarget(null)} className="border-[#D4D4D8] text-[#0A0A0A]">{t('review.dialog.cancel')}</Button>
            <Button onClick={handleObserveConfirm} disabled={observeTouched && !observeValid}
              className="bg-[#F97316] hover:bg-[#C2410C] text-white gap-2">
              <AlertTriangle className="w-4 h-4" />{t('review.dialog.submitObservation')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 3 — Reject */}
      <AlertDialog open={rejectTarget !== null} onOpenChange={open => { if (!open) setRejectTarget(null); }}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#0A0A0A]">{t('review.dialog.rejectTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {/* Bug-Fix A.2: <Trans> parses ONLY the components we list,
                  never arbitrary HTML. Translation strings keep <strong>
                  for translator readability but cannot inject anything else. */}
              <Trans
                i18nKey="review.dialog.rejectDesc"
                t={t}
                components={{ strong: <strong /> }}
              />
            </AlertDialogDescription>
          </AlertDialogHeader>
          {rejectTarget && (
            <div className="space-y-4 py-1">
              <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs">
                <span className="font-medium text-[#0A0A0A]">{rejectTarget.workerName}</span>
                <span className="text-[#D4D4D8]">·</span>
                <span className="text-[#71717A]">{t(`review.types.${rejectTarget.type}`, { defaultValue: rejectTarget.type })}</span>
                <span className="text-[#D4D4D8]">·</span>
                <span className="font-mono font-semibold text-[#d4183d]">{fmtAmount(rejectTarget.amount)}</span>
                <span className="text-[#D4D4D8]">·</span>
                <span className="text-[#71717A]">{rejectTarget.project}</span>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[#0A0A0A]">
                  {t('review.dialog.rejectReason')} <span className="text-red-500">*</span>
                </label>
                <Textarea value={rejectComment} onChange={e => setRejectComment(e.target.value)}
                  onBlur={() => setRejectTouched(true)} placeholder={t('review.dialog.rejectPlaceholder')}
                  className={`resize-none text-sm min-h-[88px] transition-colors ${
                    rejectTouched && !rejectValid ? 'border-red-400 focus:border-red-500' : 'border-[#D4D4D8]'
                  }`} rows={3} />
                {rejectTouched && !rejectValid && (
                  <p className="flex items-center gap-1 text-xs text-red-600">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    {t('review.dialog.observeMinChars', { current: rejectComment.trim().length })}
                  </p>
                )}
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#D4D4D8] text-[#0A0A0A]">{t('review.dialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={e => { e.preventDefault(); handleRejectConfirm(); }}
              className={`text-white transition-colors ${
                rejectTouched && !rejectValid ? 'bg-red-300 cursor-not-allowed pointer-events-none' : 'bg-[#d4183d] hover:bg-red-700'
              }`}
            >
              <XCircle className="w-4 h-4 mr-1.5" />{t('review.dialog.rejectExpense')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* MODAL 4 — Batch approve */}
      <AlertDialog open={showBatch} onOpenChange={setShowBatch}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#0A0A0A]">{t('review.dialog.batchTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {/* Bug-Fix A.2: same Trans-based pattern as rejectDesc above. */}
              <Trans
                i18nKey="review.dialog.batchDesc"
                t={t}
                values={{ count: pendingExpenses.length, amount: fmtAmount(pendingTotal) }}
                components={{ strong: <strong /> }}
              />
            </AlertDialogDescription>
          </AlertDialogHeader>
          {Object.keys(pendingByWorker).length > 0 && (
            <div className="space-y-2 py-1">
              <p className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('review.dialog.breakdownByWorker')}</p>
              <div className="bg-[#FAFAFA] rounded-xl border border-[#D4D4D8] divide-y divide-[#D4D4D8] overflow-hidden">
                {Object.entries(pendingByWorker).map(([worker, data]) => (
                  <div key={worker} className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-2"><WorkerAvatar name={worker} /></div>
                    <div className="flex items-center gap-3 text-xs text-[#71717A]">
                      <span>{t('review.filters.expense', { count: data.count })}</span>
                      <span className="font-mono font-semibold text-[#0A0A0A]">{fmtAmount(data.total)}</span>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between px-4 py-2.5 bg-emerald-50">
                  <span className="text-xs font-semibold text-emerald-800">{t('review.dialog.total')}</span>
                  <span className="font-mono font-semibold text-sm text-emerald-700">{fmtAmount(pendingTotal)}</span>
                </div>
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#D4D4D8] text-[#0A0A0A]">{t('review.dialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleBatchApprove} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
              <CheckCircle className="w-4 h-4" />{t('review.dialog.approveAll')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Receipt preview dialog */}
      <Dialog open={receiptTarget !== null} onOpenChange={open => { if (!open) setReceiptTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-[#0A0A0A]">
              {receiptTarget ? t('review.receipt.title', { worker: receiptTarget.workerName, date: fmtDate(receiptTarget.date) }) : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="rounded-xl border border-[#D4D4D8] overflow-hidden bg-[#FAFAFA]">
            {receiptImage.loading && (
              <div className="flex items-center justify-center h-56 gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-[#71717A]" />
                <span className="text-sm text-[#71717A]">{t('review.receipt.loading')}</span>
              </div>
            )}
            {!receiptImage.loading && receiptImage.blobUrl && !receiptImage.isPdf && (
              <img src={receiptImage.blobUrl} alt="Receipt" className="w-full max-h-[420px] object-contain" />
            )}
            {!receiptImage.loading && receiptImage.blobUrl && receiptImage.isPdf && (
              <div className="flex flex-col items-center justify-center h-40 gap-3">
                <p className="text-sm text-[#71717A]">{t('review.receipt.pdfReceipt')}</p>
                <a href={receiptImage.blobUrl} download={`receipt-${receiptTarget?.id}.pdf`}
                  className="text-xs font-medium text-[#F97316] underline">{t('review.receipt.downloadPdf')}</a>
              </div>
            )}
            {!receiptImage.loading && !receiptImage.blobUrl && (
              <div className="flex flex-col items-center justify-center h-40 gap-3">
                <div className="w-12 h-12 bg-white rounded-full border border-[#D4D4D8] flex items-center justify-center">
                  <ImageIcon className="w-6 h-6 text-[#D4D4D8]" />
                </div>
                <p className="text-sm text-[#71717A]">{t('review.receipt.noReceipt')}</p>
              </div>
            )}
          </div>
          {receiptTarget && (
            <div className="flex items-center justify-between text-xs text-[#71717A] pt-1">
              <span>{receiptTarget.workerName} · {receiptTarget.project}</span>
              <span className="font-mono font-semibold text-[#0A0A0A]">{fmtAmount(receiptTarget.amount)}</span>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
