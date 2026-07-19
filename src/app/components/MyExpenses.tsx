import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Receipt, CheckCircle, Clock, AlertTriangle, Eye,
  Filter as FilterIcon, Pencil, Image as ImageIcon, FileText,
  ChevronDown, ChevronRight, Droplets, Package, Wrench,
  Utensils, ShoppingBag, Car, MoreHorizontal, Loader2,
  ZoomIn, ZoomOut, RotateCcw, ExternalLink, AlertCircle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { StatCard } from './StatCard';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from './ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from './ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from './ui/dialog';
import { EXPENSE_TYPE_KEYS } from './NewExpense';
import { businessToday, nDaysAgo } from '../helpers/dateTime';
import {
  getMyExpenses, getMySummary, receiptUrl,
  type ExpenseResponse, type ExpenseSummaryResponse,
} from '../services/expenses';

// Types

type ExpenseStatus = 'Pending' | 'Approved' | 'Observed' | 'Rejected';

interface ExpenseRecord {
  id: string;
  date: string;
  type: string;
  project: string;
  amount: number;
  status: ExpenseStatus;
  comment?: string;
  reviewerName?: string;
  reviewerComment?: string;
  receiptUrl?: string | null;
}

// Constants

const ITEMS_PER_PAGE = 10;

const STATUS_OPTIONS: ExpenseStatus[] = ['Pending', 'Approved', 'Observed', 'Rejected'];

const STATUS_MAP: Record<string, ExpenseStatus> = {
  PENDING: 'Pending', APPROVED: 'Approved', OBSERVED: 'Observed', REJECTED: 'Rejected',
};

const TYPE_KEY_MAP: Record<string, string> = {
  FUEL: 'fuel', MATERIALS: 'materials', TOOLS: 'tools',
  PER_DIEM: 'per-diem', MINOR_PURCHASES: 'minor-purchases',
  TRANSPORTATION: 'transportation', OTHER: 'other',
};

function mapExpense(e: ExpenseResponse): ExpenseRecord {
  return {
    id: String(e.id),
    date: e.expenseDate,
    type: TYPE_KEY_MAP[e.expenseType] ?? e.expenseType.toLowerCase(),
    project: e.projectName,
    amount: e.amountCents / 100,
    status: STATUS_MAP[e.status] ?? 'Pending',
    comment: e.description ?? undefined,
    reviewerName: e.reviewerName ?? undefined,
    reviewerComment: e.reviewerComment ?? undefined,
    receiptUrl: e.receiptUrl,
  };
}

// Status config

const STATUS_CFG: Record<ExpenseStatus, { bg: string; text: string; border: string; dot: string }> = {
  Pending:  { bg: 'bg-amber-50',      text: 'text-amber-700',  border: 'border-amber-200',      dot: 'bg-amber-500'   },
  Approved: { bg: 'bg-emerald-50',    text: 'text-emerald-700',border: 'border-emerald-200',    dot: 'bg-emerald-500' },
  Observed: { bg: 'bg-[#F97316]/10',  text: 'text-[#F97316]', border: 'border-[#F97316]/20',   dot: 'bg-[#F97316]'  },
  Rejected: { bg: 'bg-red-50',        text: 'text-red-700',    border: 'border-red-200',        dot: 'bg-red-500'    },
};

// Type config

const TYPE_ICONS: Record<string, React.ElementType> = {
  'fuel': Droplets, 'materials': Package, 'tools': Wrench,
  'per-diem': Utensils, 'minor-purchases': ShoppingBag,
  'transportation': Car, 'other': MoreHorizontal,
};

const STATUS_LABEL_KEYS: Record<ExpenseStatus, string> = {
  Pending: 'status.pending', Approved: 'status.approved',
  Observed: 'status.observed', Rejected: 'status.rejected',
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
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${c.bg} ${c.text} ${c.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
      {t(STATUS_LABEL_KEYS[status])}
    </span>
  );
}

function TypeChip({ type }: { type: string }) {
  const { t } = useTranslation('expenses');
  const Icon = TYPE_ICONS[type] ?? MoreHorizontal;
  const label = t(`types.${type}`, { defaultValue: type });
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="w-3.5 h-3.5 text-[#71717A] flex-shrink-0" />
      <span className="text-sm text-[#0A0A0A]">{label}</span>
    </div>
  );
}

/** Receipt thumbnail — shows placeholder since we have no real images in mock data */
function ReceiptThumb({ onPreview }: { onPreview: () => void }) {
  const { t } = useTranslation('expenses');
  return (
    <button
      onClick={e => { e.stopPropagation(); onPreview(); }}
      className="w-10 h-10 rounded-lg bg-[#FAFAFA] border border-[#D4D4D8] flex items-center justify-center hover:border-[#F97316] hover:bg-[#F97316]/5 transition-colors"
      title={t('my.viewReceipt')}
    >
      <ImageIcon className="w-4 h-4 text-[#71717A]" />
    </button>
  );
}

function Pagination({
  currentPage, totalPages, onPageChange,
}: { currentPage: number; totalPages: number; onPageChange: (p: number) => void }) {
  const { t } = useTranslation('expenses');
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-1 py-4 border-t border-[#D4D4D8]">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="h-8 px-3 rounded-lg text-xs font-medium text-[#71717A] hover:text-[#0A0A0A] hover:bg-[#FAFAFA] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        {t('my.prev')}
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
        {t('my.next')}
      </button>
    </div>
  );
}

// Expanded detail panel

function ExpenseDetail({ expense, onPreviewReceipt }: { expense: ExpenseRecord; onPreviewReceipt: () => void }) {
  const { t } = useTranslation('expenses');
  const typeLabel = t(`types.${expense.type}`, { defaultValue: expense.type });
  return (
    <div className="bg-[#FAFAFA] rounded-xl border border-[#D4D4D8] p-4 space-y-4">
      {/* Detail grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { label: t('my.detail.type'),    value: typeLabel                     },
          { label: t('my.detail.amount'),  value: fmtAmount(expense.amount)     },
          { label: t('my.detail.project'), value: expense.project               },
          { label: t('my.detail.date'),    value: fmtDate(expense.date)         },
          { label: t('my.detail.status'),  value: t(STATUS_LABEL_KEYS[expense.status]) },
        ].map(({ label, value }) => (
          <div key={label}>
            <p className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wide mb-0.5">{label}</p>
            <p className="text-sm font-medium text-[#0A0A0A]">{value}</p>
          </div>
        ))}
      </div>

      {/* Comment */}
      {expense.comment && (
        <div>
          <p className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wide mb-0.5">{t('my.detail.notes')}</p>
          <p className="text-sm text-[#0A0A0A]">{expense.comment}</p>
        </div>
      )}

      {/* Receipt preview trigger */}
      <div className="flex items-center gap-2">
        <button
          onClick={onPreviewReceipt}
          className="flex items-center gap-1.5 text-xs font-medium text-[#F97316] hover:text-[#C2410C] transition-colors"
        >
          <ImageIcon className="w-3.5 h-3.5" />
          {t('my.detail.viewReceipt')}
        </button>
      </div>

      {/* Reviewer feedback — Observed */}
      {expense.status === 'Observed' && expense.reviewerComment && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-amber-800 mb-1">{t('my.detail.reviewerFeedback')}</p>
              <p className="text-[11px] text-amber-700">
                <span className="font-semibold">{expense.reviewerName}</span> ·{' '}
                {expense.reviewerComment}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                toast.info(t('my.detail.editResubmitSoon'), {
                  description: t('my.detail.editResubmitDesc'),
                });
              }}
              className="border-amber-300 text-amber-800 hover:bg-amber-100 text-xs gap-1.5 h-8 flex-shrink-0"
            >
              <Pencil className="w-3 h-3" />
              {t('my.detail.editResubmit')}
            </Button>
          </div>
        </div>
      )}

      {/* Reviewer feedback — Rejected */}
      {expense.status === 'Rejected' && expense.reviewerComment && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-red-800 mb-1">{t('my.detail.rejectionReason')}</p>
          <p className="text-[11px] text-red-700">
            <span className="font-semibold">{expense.reviewerName}</span> ·{' '}
            {expense.reviewerComment}
          </p>
        </div>
      )}

      {/* Reviewer feedback — Approved (the note is optional, so often absent) */}
      {expense.status === 'Approved' && expense.reviewerComment && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-emerald-800 mb-1">{t('my.detail.approvalNote')}</p>
          <p className="text-[11px] text-emerald-700">
            <span className="font-semibold">{expense.reviewerName}</span> ·{' '}
            {expense.reviewerComment}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Interactive Receipt Viewer ──────────────────────────────────────
// FIX: The worker view used a bare <img src> which cannot send JWT Authorization
// headers → 401. Now fetches via fetch() + receiptHeaders() and renders a blob URL.
// Supports pan, zoom (wheel + buttons), reset, open-in-new-tab and keyboard shortcuts.

const MIN_SCALE = 0.25;
const MAX_SCALE = 5;
const ZOOM_STEP = 0.25;

function ReceiptViewer({ expenseId, onClose }: { expenseId: number; onClose?: () => void }) {
  const { t } = useTranslation('expenses');
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const translateStart = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch receipt with JWT auth header (bare <img src> can't do this)
  useEffect(() => {
    let revoke: string | null = null;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setBlobUrl(null);
    setScale(1);
    setTranslate({ x: 0, y: 0 });

    fetch(receiptUrl(expenseId), { credentials: 'include' as RequestCredentials })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then(blob => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        revoke = url;
        setBlobUrl(url);
      })
      .catch(err => {
        if (!cancelled) setError(err?.message ?? 'Failed to load receipt');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [expenseId]);

  const zoomIn = useCallback(() => setScale(s => Math.min(s + ZOOM_STEP, MAX_SCALE)), []);
  const zoomOut = useCallback(() => setScale(s => Math.max(s - ZOOM_STEP, MIN_SCALE)), []);
  const resetView = useCallback(() => { setScale(1); setTranslate({ x: 0, y: 0 }); }, []);

  const openInNewTab = useCallback(() => {
    fetch(receiptUrl(expenseId), { credentials: 'include' as RequestCredentials })
      .then(res => res.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      })
      .catch(() => toast.error(t('expenses:toast.openReceiptFailed', 'Failed to open receipt')));
  }, [expenseId]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale(s => {
      const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
      return Math.min(Math.max(s + delta, MIN_SCALE), MAX_SCALE);
    });
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    translateStart.current = { ...translate };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [translate]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    setTranslate({
      x: translateStart.current.x + (e.clientX - dragStart.current.x),
      y: translateStart.current.y + (e.clientY - dragStart.current.y),
    });
  }, [dragging]);

  const handlePointerUp = useCallback(() => setDragging(false), []);

  // Keyboard: +/- zoom, 0 reset, Escape close
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomIn(); }
      else if (e.key === '-') { e.preventDefault(); zoomOut(); }
      else if (e.key === '0') { e.preventDefault(); resetView(); }
      else if (e.key === 'Escape' && onClose) { e.preventDefault(); onClose(); }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [zoomIn, zoomOut, resetView, onClose]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-80 bg-[#FAFAFA] rounded-xl border border-[#D4D4D8] gap-3">
        <Loader2 className="w-8 h-8 text-[#F97316] animate-spin" />
        <p className="text-sm text-[#71717A]">{t('my.receipt.loading')}</p>
      </div>
    );
  }

  if (error || !blobUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-80 bg-[#FAFAFA] rounded-xl border border-red-200 gap-3">
        <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center">
          <AlertCircle className="w-7 h-7 text-red-400" />
        </div>
        <p className="text-sm font-medium text-red-600">{t('my.receipt.failed')}</p>
        <p className="text-[11px] text-[#71717A]">{error ?? 'Unknown error'}</p>
      </div>
    );
  }

  const zoomPercent = Math.round(scale * 100);

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-[#FAFAFA] rounded-lg border border-[#D4D4D8] px-2 py-1">
        <div className="flex items-center gap-1">
          <button onClick={zoomOut} title={t('my.receipt.zoomOut')} className="w-7 h-7 rounded flex items-center justify-center text-[#71717A] hover:bg-white hover:text-[#0A0A0A] transition-colors">
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] font-mono font-medium text-[#71717A] w-10 text-center select-none">{zoomPercent}%</span>
          <button onClick={zoomIn} title={t('my.receipt.zoomIn')} className="w-7 h-7 rounded flex items-center justify-center text-[#71717A] hover:bg-white hover:text-[#0A0A0A] transition-colors">
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-4 bg-[#D4D4D8] mx-1" />
          <button onClick={resetView} title={t('my.receipt.resetView')} className="w-7 h-7 rounded flex items-center justify-center text-[#71717A] hover:bg-white hover:text-[#0A0A0A] transition-colors">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
        <button onClick={openInNewTab} title={t('my.receipt.openNewTab')} className="w-7 h-7 rounded flex items-center justify-center text-[#71717A] hover:bg-white hover:text-[#F97316] transition-colors">
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Image with pan & zoom */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="relative overflow-hidden rounded-xl border border-[#D4D4D8] bg-[#FAFAFA] h-80"
        style={{ cursor: dragging ? 'grabbing' : 'grab', touchAction: 'none' }}
      >
        <img
          src={blobUrl}
          alt={t('my.receipt.alt')}
          draggable={false}
          className="absolute inset-0 w-full h-full object-contain select-none"
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
            transformOrigin: 'center center',
            transition: dragging ? 'none' : 'transform 0.15s ease-out',
          }}
        />
      </div>

      {/* Keyboard shortcuts hint */}
      <p className="text-[10px] text-[#D4D4D8] text-center select-none">
        {t('my.receipt.controls')}
      </p>
    </div>
  );
}

// Main component

export function MyExpenses() {
  const { t } = useTranslation('expenses');
  // Filter state
  const [dateFrom,       setDateFrom]       = useState(getThirtyDaysAgo);
  const [dateTo,         setDateTo]         = useState(getToday);
  const [typeFilter,     setTypeFilter]     = useState('all');
  const [statusFilter,   setStatusFilter]   = useState('all');
  // Applied filters (committed on "Apply")
  const [appliedFrom,    setAppliedFrom]    = useState(getThirtyDaysAgo);
  const [appliedTo,      setAppliedTo]      = useState(getToday);
  const [appliedType,    setAppliedType]    = useState('all');
  const [appliedStatus,  setAppliedStatus]  = useState('all');

  // UI state
  const [expandedId,     setExpandedId]     = useState<string | null>(null);
  const [currentPage,    setCurrentPage]    = useState(1);
  const [receiptExpense, setReceiptExpense] = useState<ExpenseRecord | null>(null);

  // Data from API
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<ExpenseSummaryResponse | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const backendStatus = appliedStatus !== 'all' ? appliedStatus.toUpperCase() : undefined;
      const backendType = appliedType !== 'all' ? appliedType.toUpperCase().replace(/-/g, '_') : undefined;
      const res = await getMyExpenses({
        status: backendStatus,
        type: backendType,
        dateFrom: appliedFrom,
        dateTo: appliedTo,
        page: currentPage - 1,
        size: ITEMS_PER_PAGE,
      });
      setExpenses(res.content.map(mapExpense));
      setTotalElements(res.totalElements);
      setTotalPages(res.totalPages || 1);
    } catch { /* silent */ } finally { setLoading(false); }
  }, [appliedFrom, appliedTo, appliedType, appliedStatus, currentPage]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    getMySummary().then(setSummary).catch(err => toast.error(err?.message));
  }, []);

  // Filter handlers
  function handleApply() {
    setAppliedFrom(dateFrom);
    setAppliedTo(dateTo);
    setAppliedType(typeFilter);
    setAppliedStatus(statusFilter);
    setCurrentPage(1);
    setExpandedId(null);
  }

  function handleReset() {
    const f = getThirtyDaysAgo(), t = getToday();
    setDateFrom(f); setDateTo(t);
    setTypeFilter('all'); setStatusFilter('all');
    setAppliedFrom(f); setAppliedTo(t);
    setAppliedType('all'); setAppliedStatus('all');
    setCurrentPage(1); setExpandedId(null);
  }

  const paginated = expenses;

  // KPI values
  const totalSubmitted  = summary ? String(summary.totalSubmitted) : '·';
  const totalApproved   = summary ? `$${(summary.totalApprovedCents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}` : '·';
  const totalPending    = summary ? String(summary.pendingCount) : '·';
  const totalObsRej     = summary ? String(summary.observedCount + summary.rejectedCount) : '·';

  // Render
  return (
    <div className="space-y-6 max-w-5xl">

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Receipt}       title={t('my.kpi.totalSubmitted')} value={totalSubmitted} subtitle={t('my.kpi.allTime')}        iconBgColor="bg-[#F97316]/10" iconColor="text-[#F97316]"    />
        <StatCard icon={CheckCircle}   title={t('my.kpi.approved')}       value={totalApproved}  subtitle={t('my.kpi.totalValue')}      iconBgColor="bg-emerald-50"   iconColor="text-emerald-600"  />
        <StatCard icon={Clock}         title={t('my.kpi.pending')}        value={totalPending}   subtitle={t('my.kpi.awaitingReview')}  iconBgColor="bg-amber-50"     iconColor="text-amber-600"    />
        <StatCard icon={AlertTriangle} title={t('my.kpi.observedRejected')} value={totalObsRej}  subtitle={t('my.kpi.needAction')}      iconBgColor="bg-red-50"       iconColor="text-red-600"      />
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] p-5">
        <div className="flex items-center gap-2 mb-4">
          <FilterIcon className="w-4 h-4 text-[#71717A]" />
          <span className="text-sm font-semibold text-[#0A0A0A]">{t('buttons.filters', { ns: 'common' })}</span>
          {(appliedType !== 'all' || appliedStatus !== 'all') && (
            <span className="px-1.5 py-0.5 bg-[#F97316]/10 text-[#F97316] text-[10px] font-medium rounded-full">
              {t('my.filters.active')}
            </span>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-end gap-3">
          {/* From */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('labels.from', { ns: 'common' })}</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="h-9 rounded-lg border border-[#D4D4D8] bg-white px-3 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#F97316]/25 focus:border-[#F97316] transition-colors"
            />
          </div>

          {/* To */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('labels.to', { ns: 'common' })}</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="h-9 rounded-lg border border-[#D4D4D8] bg-white px-3 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#F97316]/25 focus:border-[#F97316] transition-colors"
            />
          </div>

          {/* Type */}
          <div className="flex flex-col gap-1.5 min-w-[160px]">
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('my.filters.type')}</label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-9 border-[#D4D4D8] text-sm">
                <SelectValue placeholder={t('labels.allTypes', { ns: 'common' })} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('labels.allTypes', { ns: 'common' })}</SelectItem>
                {EXPENSE_TYPE_KEYS.map(key => (
                  <SelectItem key={key} value={key}>{t(`types.${key}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="flex flex-col gap-1.5 min-w-[140px]">
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('labels.status', { ns: 'common' })}</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 border-[#D4D4D8] text-sm">
                <SelectValue placeholder={t('labels.allStatuses', { ns: 'common' })} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('labels.allStatuses', { ns: 'common' })}</SelectItem>
                {STATUS_OPTIONS.map(s => (
                  <SelectItem key={s} value={s}>{t(STATUS_LABEL_KEYS[s])}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button
              variant="outline" size="sm" onClick={handleReset}
              className="h-9 px-4 text-xs border-[#D4D4D8] text-[#71717A] hover:text-[#0A0A0A]"
            >
              {t('buttons.reset', { ns: 'common' })}
            </Button>
            <Button
              size="sm" onClick={handleApply}
              className="h-9 px-4 text-xs bg-[#F97316] hover:bg-[#C2410C] text-white"
            >
              {t('buttons.apply', { ns: 'common' })}
            </Button>
          </div>
        </div>

        <p className="text-[11px] text-[#71717A] mt-3 pt-3 border-t border-[#FAFAFA]">
          {t('my.showingCount', { count: totalElements })}
        </p>
      </div>

      {/* Table card */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
        {/* Card header */}
        <div className="flex items-center gap-2 px-6 py-4 border-b border-[#D4D4D8]">
          <Receipt className="w-4 h-4 text-[#71717A]" />
          <span className="text-sm font-semibold text-[#0A0A0A]">{t('my.expenseHistory')}</span>
          <span className="ml-1 text-xs text-[#71717A]">· {t('my.record', { count: totalElements })}</span>
        </div>

        {/* Empty state */}
        {totalElements === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-14 h-14 bg-[#FAFAFA] rounded-full flex items-center justify-center mb-3">
              <Receipt className="w-7 h-7 text-[#D4D4D8]" />
            </div>
            <p className="text-sm font-semibold text-[#0A0A0A] mb-1">{t('my.noExpensesFound')}</p>
            <p className="text-xs text-[#71717A]">{t('my.noExpensesHint')}</p>
          </div>
        )}

        {/* Desktop table */}
        {paginated.length > 0 && (
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#FAFAFA] hover:bg-[#FAFAFA]">
                  <TableHead className="w-8" />
                  {[
                    { key: 'date', label: t('my.table.date') },
                    { key: 'type', label: t('my.table.type') },
                    { key: 'project', label: t('my.table.project') },
                    { key: 'amount', label: t('my.table.amount') },
                    { key: 'receipt', label: t('my.table.receipt') },
                    { key: 'status', label: t('my.table.status') },
                    { key: 'actions', label: t('my.table.actions') },
                  ].map(h => (
                    <TableHead key={h.key} className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider whitespace-nowrap">
                      {h.label}
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
                      {/* Chevron */}
                      <TableCell className="py-3 pr-0 pl-4 text-[#71717A]">
                        {isExpanded
                          ? <ChevronDown className="w-3.5 h-3.5" />
                          : <ChevronRight className="w-3.5 h-3.5" />
                        }
                      </TableCell>

                      {/* Date */}
                      <TableCell className="py-3">
                        <span className="text-sm text-[#0A0A0A] whitespace-nowrap">{fmtDate(expense.date)}</span>
                      </TableCell>

                      {/* Type */}
                      <TableCell className="py-3"><TypeChip type={expense.type} /></TableCell>

                      {/* Project */}
                      <TableCell className="py-3">
                        <span className="text-sm text-[#71717A]">{expense.project}</span>
                      </TableCell>

                      {/* Amount */}
                      <TableCell className="py-3">
                        <span className="font-mono font-semibold text-sm text-[#0A0A0A]">
                          {fmtAmount(expense.amount)}
                        </span>
                      </TableCell>

                      {/* Receipt thumbnail */}
                      <TableCell className="py-3">
                        <ReceiptThumb onPreview={() => setReceiptExpense(expense)} />
                      </TableCell>

                      {/* Status */}
                      <TableCell className="py-3">
                        <StatusBadge status={expense.status} />
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="py-3">
                        <button
                          onClick={e => { e.stopPropagation(); setExpandedId(isExpanded ? null : expense.id); }}
                          title={t('my.viewDetails')}
                          className="w-8 h-8 flex items-center justify-center rounded-full text-[#71717A] hover:text-[#F97316] hover:bg-[#F97316]/10 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </TableCell>
                    </TableRow>
                  );

                  if (!isExpanded) return [mainRow];

                  const detailRow = (
                    <TableRow key={`${expense.id}-detail`} className="bg-[#FAFAFA]/40 hover:bg-[#FAFAFA]/40">
                      <TableCell colSpan={8} className="px-4 py-4 border-b border-[#D4D4D8]/50">
                        <ExpenseDetail
                          expense={expense}
                          onPreviewReceipt={() => setReceiptExpense(expense)}
                        />
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
                  {/* Card header */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : expense.id)}
                    className="w-full flex items-start gap-3"
                  >
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center gap-1.5 mb-1">
                        <TypeIcon className="w-3.5 h-3.5 text-[#71717A] flex-shrink-0" />
                        <span className="text-sm font-semibold text-[#0A0A0A]">
                          {t(`types.${expense.type}`, { defaultValue: expense.type })}
                        </span>
                        <span className="text-sm font-mono font-semibold text-[#0A0A0A] ml-auto">
                          {fmtAmount(expense.amount)}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#71717A]">{expense.project} · {fmtDate(expense.date)}</p>
                    </div>
                    {/* Receipt thumb */}
                    <div className="w-10 h-10 rounded-lg bg-[#FAFAFA] border border-[#D4D4D8] flex items-center justify-center flex-shrink-0">
                      <ImageIcon className="w-4 h-4 text-[#71717A]" />
                    </div>
                  </button>

                  {/* Status + toggle */}
                  <div className="flex items-center gap-2 mt-2">
                    <StatusBadge status={expense.status} />
                    {isExpanded
                      ? <ChevronDown className="w-3.5 h-3.5 text-[#71717A] ml-auto" />
                      : <ChevronRight className="w-3.5 h-3.5 text-[#71717A] ml-auto" />
                    }
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="mt-3">
                      <ExpenseDetail
                        expense={expense}
                        onPreviewReceipt={() => setReceiptExpense(expense)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalElements > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={p => { setCurrentPage(p); setExpandedId(null); }}
          />
        )}
      </div>

      {/* Receipt preview — FIX: replaced bare <img src> (which can't send JWT)
         with ReceiptViewer that fetches via fetch() + receiptHeaders() */}
      <Dialog
        open={receiptExpense !== null}
        onOpenChange={open => { if (!open) setReceiptExpense(null); }}
      >
        <DialogContent className="sm:max-w-lg" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-[#0A0A0A]">
              {t('my.receiptTitle', { type: receiptExpense ? t(`types.${receiptExpense.type}`, { defaultValue: receiptExpense.type }) : '', date: receiptExpense ? fmtDate(receiptExpense.date) : '' })}
            </DialogTitle>
          </DialogHeader>
          {receiptExpense?.receiptUrl ? (
            <ReceiptViewer
              expenseId={Number(receiptExpense.id)}
              onClose={() => setReceiptExpense(null)}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-56 bg-[#FAFAFA] rounded-xl border border-[#D4D4D8] gap-3">
              <div className="w-14 h-14 bg-white rounded-full border border-[#D4D4D8] flex items-center justify-center">
                <ImageIcon className="w-7 h-7 text-[#D4D4D8]" />
              </div>
              <p className="text-sm font-medium text-[#71717A]">{t('my.detail.noReceipt')}</p>
            </div>
          )}
          {receiptExpense && (
            <div className="flex items-center justify-between text-xs text-[#71717A] pt-1">
              <span>{receiptExpense.project}</span>
              <span className="font-mono font-semibold text-[#0A0A0A]">{fmtAmount(receiptExpense.amount)}</span>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
