import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle, AlertTriangle, XCircle, Clock,
  Receipt, DollarSign, Filter as FilterIcon,
  ChevronDown, ChevronRight, Image as ImageIcon,
  Droplets, Package, Wrench, Utensils,
  ShoppingBag, Car, MoreHorizontal, AlertCircle, Loader2,
  ZoomIn, ZoomOut, RotateCcw, ExternalLink,
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
  getAdminExpenses, getAdminSummary, adminBatchApprove,
  approveExpense, observeExpense, rejectExpense,
  receiptUrl, type ExpenseResponse, type ExpenseSummaryResponse,
} from '../services/expenses';
import { listActiveUsers, type UserDTO } from '../services/users';
import { listProjects, type ProjectResponse } from '../services/projects';
import { FIELD_LIMITS } from '../../shared/fieldLimits';

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

const TYPE_CFG: Record<string, { labelKey: string; shortLabelKey: string; icon: React.ElementType }> = {
  'fuel':            { labelKey: 'admin:expenseMgmt.types.fuel',            shortLabelKey: 'admin:expenseMgmt.types.fuelShort',            icon: Droplets       },
  'materials':       { labelKey: 'admin:expenseMgmt.types.materials',       shortLabelKey: 'admin:expenseMgmt.types.materialsShort',       icon: Package        },
  'tools':           { labelKey: 'admin:expenseMgmt.types.tools',           shortLabelKey: 'admin:expenseMgmt.types.toolsShort',           icon: Wrench         },
  'per-diem':        { labelKey: 'admin:expenseMgmt.types.perDiem',         shortLabelKey: 'admin:expenseMgmt.types.perDiemShort',         icon: Utensils       },
  'minor-purchases': { labelKey: 'admin:expenseMgmt.types.minorPurchases',  shortLabelKey: 'admin:expenseMgmt.types.minorPurchasesShort',  icon: ShoppingBag    },
  'transportation':  { labelKey: 'admin:expenseMgmt.types.transportation',  shortLabelKey: 'admin:expenseMgmt.types.transportationShort',  icon: Car            },
  'other':           { labelKey: 'admin:expenseMgmt.types.other',           shortLabelKey: 'admin:expenseMgmt.types.otherShort',           icon: MoreHorizontal },
};

// Helpers

import { fmtDate, businessToday, nDaysAgo } from '../helpers/dateTime';

function fmtAmount(n: number) {
  return `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

// Sub-components

const STATUS_KEY_MAP: Record<ExpenseStatus, string> = {
  Pending: 'common:status.pending',
  Approved: 'common:status.approved',
  Observed: 'common:status.observed',
  Rejected: 'common:status.rejected',
};

function StatusBadge({ status }: { status: ExpenseStatus }) {
  const { t } = useTranslation(['common']);
  const c = STATUS_CFG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap ${c.bg} ${c.text} ${c.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
      {t(STATUS_KEY_MAP[status])}
    </span>
  );
}

function WorkerAvatar({ name }: { name: string }) {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const palette  = ['bg-[#F97316]', 'bg-emerald-600', 'bg-purple-600', 'bg-amber-600', 'bg-rose-600', 'bg-teal-600'];
  const color    = palette[name.charCodeAt(0) % palette.length];
  return (
    <div className="flex items-center gap-2.5">
      <div className={`w-7 h-7 ${color} rounded-full flex items-center justify-center flex-shrink-0`}>
        <span className="text-[10px] font-bold text-white">{initials}</span>
      </div>
      <span className="text-sm font-medium text-[#0A0A0A] whitespace-nowrap">{name}</span>
    </div>
  );
}

function TypeChip({ type, compact = false }: { type: string; compact?: boolean }) {
  const { t } = useTranslation(['admin']);
  const cfg  = TYPE_CFG[type] ?? { labelKey: type, shortLabelKey: type, icon: MoreHorizontal };
  const Icon = cfg.icon;
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="w-3.5 h-3.5 text-[#71717A] flex-shrink-0" />
      <span className="text-sm text-[#0A0A0A]">{compact ? t(cfg.shortLabelKey) : t(cfg.labelKey)}</span>
    </div>
  );
}

function ReceiptThumb({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation(['admin']);
  return (
    <button onClick={e => { e.stopPropagation(); onClick(); }} title={t('admin:expenseMgmt.detail.viewReceipt')}
      className="w-10 h-10 rounded-lg bg-[#FAFAFA] border border-[#D4D4D8] flex items-center justify-center hover:border-[#F97316] hover:bg-[#F97316]/5 transition-colors">
      <ImageIcon className="w-4 h-4 text-[#71717A]" />
    </button>
  );
}

function Pagination({ currentPage, totalPages, onPageChange }: {
  currentPage: number; totalPages: number; onPageChange: (p: number) => void;
}) {
  const { t } = useTranslation(['admin']);
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-1 py-4 border-t border-[#D4D4D8]">
      <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}
        className="h-8 px-3 rounded-lg text-xs font-medium text-[#71717A] hover:text-[#0A0A0A] hover:bg-[#FAFAFA] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">{t('admin:expenseMgmt.pagination.prev')}</button>
      {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
        <button key={p} onClick={() => onPageChange(p)}
          className={`h-8 w-8 rounded-lg text-xs font-semibold transition-colors ${p === currentPage ? 'bg-[#F97316] text-white' : 'text-[#71717A] hover:bg-[#FAFAFA]'}`}>{p}</button>
      ))}
      <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages}
        className="h-8 px-3 rounded-lg text-xs font-medium text-[#71717A] hover:text-[#0A0A0A] hover:bg-[#FAFAFA] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">{t('admin:expenseMgmt.pagination.next')}</button>
    </div>
  );
}

function DetailPanel({ expense, onApprove, onObserve, onReject, onViewReceipt }: {
  expense: ExpenseRecord; onApprove: () => void; onObserve: () => void;
  onReject: () => void;   onViewReceipt: () => void;
}) {
  const { t, i18n } = useTranslation(['admin', 'common']);
  const typeCfg = TYPE_CFG[expense.type] ?? { labelKey: expense.type, shortLabelKey: expense.type, icon: MoreHorizontal };
  return (
    <div className="bg-[#FAFAFA] rounded-xl border border-[#D4D4D8] p-4 space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[[t('admin:expenseMgmt.detail.worker'), expense.workerName], [t('admin:expenseMgmt.detail.type'), t(typeCfg.labelKey)], [t('admin:expenseMgmt.detail.amount'), fmtAmount(expense.amount)],
          [t('admin:expenseMgmt.detail.project'), expense.project], [t('admin:expenseMgmt.detail.date'), fmtDate(expense.date, i18n.language)], [t('admin:expenseMgmt.detail.status'), expense.status]
        ].map(([label, value]) => (
          <div key={label}>
            <p className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wide mb-0.5">{label}</p>
            <p className="text-sm font-medium text-[#0A0A0A]">{value}</p>
          </div>
        ))}
      </div>
      {expense.workerComment && (
        <div>
          <p className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wide mb-0.5">{t('admin:expenseMgmt.detail.workerNotes')}</p>
          <p className="text-sm text-[#0A0A0A]">{expense.workerComment}</p>
        </div>
      )}
      <button onClick={onViewReceipt} className="flex items-center gap-1.5 text-xs font-medium text-[#F97316] hover:text-[#C2410C] transition-colors">
        <ImageIcon className="w-3.5 h-3.5" />{t('admin:expenseMgmt.detail.viewReceipt')}
      </button>
      {(expense.status === 'Observed' || expense.status === 'Rejected') && expense.reviewerComment && (
        <div className={`rounded-xl border p-3 ${expense.status === 'Observed' ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
          <p className={`text-xs font-semibold mb-0.5 ${expense.status === 'Observed' ? 'text-amber-800' : 'text-red-800'}`}>
            {expense.status === 'Observed' ? t('admin:expenseMgmt.detail.observation') : t('admin:expenseMgmt.detail.rejection')} — {expense.reviewerName}
          </p>
          <p className={`text-[11px] ${expense.status === 'Observed' ? 'text-amber-700' : 'text-red-700'}`}>{expense.reviewerComment}</p>
        </div>
      )}
      {expense.status === 'Pending' && (
        <div className="flex items-center gap-2 pt-1 border-t border-[#D4D4D8]">
          <span className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mr-1">{t('admin:expenseMgmt.detail.review')}</span>
          <Button size="sm" onClick={onApprove} className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"><CheckCircle className="w-3.5 h-3.5" />{t('common:buttons.approve')}</Button>
          <Button size="sm" variant="outline" onClick={onObserve} className="h-8 px-3 text-xs border-[#F97316]/30 text-[#F97316] hover:bg-[#F97316]/10 gap-1.5"><AlertTriangle className="w-3.5 h-3.5" />{t('common:buttons.observe')}</Button>
          <Button size="sm" variant="outline" onClick={onReject} className="h-8 px-3 text-xs border-red-200 text-[#d4183d] hover:bg-red-50 gap-1.5"><XCircle className="w-3.5 h-3.5" />{t('common:buttons.reject')}</Button>
        </div>
      )}
    </div>
  );
}

// ── Authenticated Image (small thumbnail) ───────────────────────────
// Fetches a receipt image with JWT auth and renders as a simple <img> via blob URL.
function AuthImage({ expenseId, className }: { expenseId: number; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    fetch(receiptUrl(expenseId), { credentials: 'include' as RequestCredentials })
      .then(r => { if (!r.ok) throw new Error(); return r.blob(); })
      .then(blob => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setSrc(url);
      })
      .catch(err => toast.error(err?.message));
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [expenseId]);
  if (!src) return <Loader2 className="w-4 h-4 text-[#D4D4D8] animate-spin" />;
  return <img src={src} alt="Receipt" className={className} draggable={false} />;
}

// ── Interactive Receipt Viewer ──────────────────────────────────────
// FIX: Previously the admin view showed a static placeholder instead of the
// actual receipt image. The root cause was: (1) the component never called
// receiptUrl() / receiptHeaders(), and (2) bare <img src> can't pass JWT
// Bearer headers. This component fetches the image via fetch() with auth
// headers, creates a blob URL, and provides pan/zoom/keyboard interaction.

const MIN_SCALE = 0.25;
const MAX_SCALE = 5;
const ZOOM_STEP = 0.25;

function ReceiptViewer({ expenseId, onClose }: { expenseId: number; onClose?: () => void }) {
  const { t } = useTranslation(['admin']);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Transform state for pan & zoom
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const translateStart = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch the receipt image with Authorization header (JWT can't be sent via bare <img src>)
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

  // Zoom helpers
  const zoomIn = useCallback(() => setScale(s => Math.min(s + ZOOM_STEP, MAX_SCALE)), []);
  const zoomOut = useCallback(() => setScale(s => Math.max(s - ZOOM_STEP, MIN_SCALE)), []);
  const resetView = useCallback(() => { setScale(1); setTranslate({ x: 0, y: 0 }); }, []);

  // Open full-resolution image in new tab (re-fetches with auth since blob URLs are scoped)
  const openInNewTab = useCallback(() => {
    fetch(receiptUrl(expenseId), { credentials: 'include' as RequestCredentials })
      .then(res => res.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        // Revoke after a delay so the new tab can load it
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      })
      .catch(() => toast.error(t('admin:expenseMgmt.receipt.failedOpen')));
  }, [expenseId]);

  // Mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale(s => {
      const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
      return Math.min(Math.max(s + delta, MIN_SCALE), MAX_SCALE);
    });
  }, []);

  // Pan via mouse drag
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

  // Keyboard shortcuts: +/- zoom, 0 reset, Escape close
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      // Don't capture if focused on an input/textarea
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

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-80 bg-[#FAFAFA] rounded-xl border border-[#D4D4D8] gap-3">
        <Loader2 className="w-8 h-8 text-[#F97316] animate-spin" />
        <p className="text-sm text-[#71717A]">{t('admin:expenseMgmt.receipt.loading')}</p>
      </div>
    );
  }

  // Error state
  if (error || !blobUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-80 bg-[#FAFAFA] rounded-xl border border-red-200 gap-3">
        <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center">
          <AlertCircle className="w-7 h-7 text-red-400" />
        </div>
        <p className="text-sm font-medium text-red-600">{t('admin:expenseMgmt.receipt.failed')}</p>
        <p className="text-[11px] text-[#71717A]">{error ?? 'Unknown error'}</p>
      </div>
    );
  }

  // Interactive image viewer
  const zoomPercent = Math.round(scale * 100);

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-[#FAFAFA] rounded-lg border border-[#D4D4D8] px-2 py-1">
        <div className="flex items-center gap-1">
          <button onClick={zoomOut} title={t('admin:expenseMgmt.receipt.zoomOut')} className="w-7 h-7 rounded flex items-center justify-center text-[#71717A] hover:bg-white hover:text-[#0A0A0A] transition-colors">
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] font-mono font-medium text-[#71717A] w-10 text-center select-none">{zoomPercent}%</span>
          <button onClick={zoomIn} title={t('admin:expenseMgmt.receipt.zoomIn')} className="w-7 h-7 rounded flex items-center justify-center text-[#71717A] hover:bg-white hover:text-[#0A0A0A] transition-colors">
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-4 bg-[#D4D4D8] mx-1" />
          <button onClick={resetView} title={t('admin:expenseMgmt.receipt.resetView')} className="w-7 h-7 rounded flex items-center justify-center text-[#71717A] hover:bg-white hover:text-[#0A0A0A] transition-colors">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
        <button onClick={openInNewTab} title={t('admin:expenseMgmt.receipt.openNewTab')} className="w-7 h-7 rounded flex items-center justify-center text-[#71717A] hover:bg-white hover:text-[#F97316] transition-colors">
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Image container with pan & zoom */}
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
          alt="Expense receipt"
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
        {t('admin:expenseMgmt.receipt.shortcutsHint')} · <kbd className="px-1 py-0.5 bg-[#FAFAFA] border border-[#D4D4D8] rounded text-[9px]">+</kbd>/<kbd className="px-1 py-0.5 bg-[#FAFAFA] border border-[#D4D4D8] rounded text-[9px]">−</kbd> zoom · <kbd className="px-1 py-0.5 bg-[#FAFAFA] border border-[#D4D4D8] rounded text-[9px]">0</kbd> reset · <kbd className="px-1 py-0.5 bg-[#FAFAFA] border border-[#D4D4D8] rounded text-[9px]">Esc</kbd> close
      </p>
    </div>
  );
}

// Main component

export function ExpenseManagement() {
  const { t, i18n } = useTranslation(['admin', 'common']);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<ExpenseSummaryResponse | null>(null);
  const [workers, setWorkers] = useState<UserDTO[]>([]);
  const [projects, setProjects] = useState<ProjectResponse[]>([]);

  useEffect(() => {
    listActiveUsers().then(setWorkers).catch(err => toast.error(err?.message));
    listProjects({ size: 200 }).then(r => setProjects(r.content)).catch(err => toast.error(err?.message));
  }, []);

  // Filters
  const [dateFrom,      setDateFrom]      = useState(() => nDaysAgo(30));
  const [dateTo,        setDateTo]        = useState(businessToday);
  const [workerFilter,  setWorkerFilter]  = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [typeFilter,    setTypeFilter]    = useState('all');
  const [statusFilter,  setStatusFilter]  = useState('all');
  const [appliedFrom,   setAppliedFrom]   = useState(() => nDaysAgo(30));
  const [appliedTo,     setAppliedTo]     = useState(businessToday);
  const [appliedWorker, setAppliedWorker] = useState('all');
  const [appliedProject,setAppliedProject]= useState('all');
  const [appliedType,   setAppliedType]   = useState('all');
  const [appliedStatus, setAppliedStatus] = useState('all');

  // UI state
  const [expandedId,    setExpandedId]    = useState<string | null>(null);
  const [currentPage,   setCurrentPage]   = useState(1);
  const [receiptTarget, setReceiptTarget] = useState<ExpenseRecord | null>(null);

  // Modals
  const [approveTarget, setApproveTarget] = useState<ExpenseRecord | null>(null);
  const [approveNote,   setApproveNote]   = useState('');
  const [observeTarget, setObserveTarget] = useState<ExpenseRecord | null>(null);
  const [observeComment,setObserveComment]= useState('');
  const [observeTouched,setObserveTouched]= useState(false);
  const observeValid = observeComment.trim().length >= 10;
  const [rejectTarget,  setRejectTarget]  = useState<ExpenseRecord | null>(null);
  const [rejectComment, setRejectComment] = useState('');
  const [rejectTouched, setRejectTouched] = useState(false);
  const rejectValid = rejectComment.trim().length >= 10;
  const [showBatch,     setShowBatch]     = useState(false);

  // Fetch data from API
  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const backendStatus = appliedStatus !== 'all' ? appliedStatus.toUpperCase() : undefined;
      const backendType = appliedType !== 'all' ? appliedType.toUpperCase().replace(/-/g, '_') : undefined;
      const res = await getAdminExpenses({
        status: backendStatus,
        type: backendType,
        projectId: appliedProject !== 'all' ? Number(appliedProject) : undefined,
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
  }, [appliedFrom, appliedTo, appliedWorker, appliedProject, appliedType, appliedStatus, currentPage]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);
  useEffect(() => { getAdminSummary().then(setSummary).catch(err => toast.error(err?.message)); }, []);

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

  function handleApply() {
    setAppliedFrom(dateFrom); setAppliedTo(dateTo);
    setAppliedWorker(workerFilter); setAppliedProject(projectFilter);
    setAppliedType(typeFilter); setAppliedStatus(statusFilter);
    setCurrentPage(1); setExpandedId(null);
  }
  function handleReset() {
    const f = nDaysAgo(30), t = businessToday();
    setDateFrom(f); setDateTo(t);
    setWorkerFilter('all'); setProjectFilter('all'); setTypeFilter('all'); setStatusFilter('all');
    setAppliedFrom(f); setAppliedTo(t);
    setAppliedWorker('all'); setAppliedProject('all'); setAppliedType('all'); setAppliedStatus('all');
    setCurrentPage(1); setExpandedId(null);
  }

  const filtered = expenses;

  const paginated = expenses;

  function openApprove(expense: ExpenseRecord) { setApproveTarget(expense); setApproveNote(''); }
  async function handleApproveConfirm() {
    if (!approveTarget) return;
    try {
      const result = await approveExpense(Number(approveTarget.id), 'admin');
      toast.success(t('admin:expenseMgmt.approve.toastSuccess', { amount: fmtAmount(approveTarget.amount), worker: approveTarget.workerName }));
      if (result.budgetWarning) {
        const w = result.budgetWarning;
        const names = w.pendingWorkers.map(p => `${p.workerName ?? `ID ${p.workerId}`} (${p.unpaidHours.toFixed(1)}h)`).join(', ');
        toast.warning(t('common:budgetWarning.title', 'Pending labour payments'), {
          description: `${t('common:budgetWarning.desc', 'Remaining budget')} ($${(w.remainingBudgetCents / 100).toFixed(2)}) ${t('common:budgetWarning.insufficient', 'cannot cover projected payroll')} ($${(w.projectedLaborCostCents / 100).toFixed(2)}): ${names}`,
          duration: 10000,
        });
      }
      setApproveTarget(null);
      fetchExpenses();
      getAdminSummary().then(setSummary).catch(err => toast.error(err?.message));
    } catch (err: any) { toast.error(t('admin:expenseMgmt.approve.toastFailed'), { description: err?.message }); }
  }

  function openObserve(expense: ExpenseRecord) { setObserveTarget(expense); setObserveComment(''); setObserveTouched(false); }
  async function handleObserveConfirm() {
    setObserveTouched(true);
    if (!observeValid || !observeTarget) return;
    try {
      await observeExpense(Number(observeTarget.id), observeComment.trim(), 'admin');
      toast.info(t('admin:expenseMgmt.observe.toastSuccess', { worker: observeTarget.workerName }));
      setObserveTarget(null);
      fetchExpenses();
      getAdminSummary().then(setSummary).catch(err => toast.error(err?.message));
    } catch (err: any) { toast.error(t('admin:expenseMgmt.observe.toastFailed'), { description: err?.message }); }
  }

  function openReject(expense: ExpenseRecord) { setRejectTarget(expense); setRejectComment(''); setRejectTouched(false); }
  async function handleRejectConfirm() {
    setRejectTouched(true);
    if (!rejectValid || !rejectTarget) return;
    try {
      await rejectExpense(Number(rejectTarget.id), rejectComment.trim(), 'admin');
      toast.error(t('admin:expenseMgmt.reject.toastSuccess', { amount: fmtAmount(rejectTarget.amount) }));
      setRejectTarget(null);
      fetchExpenses();
      getAdminSummary().then(setSummary).catch(err => toast.error(err?.message));
    } catch (err: any) { toast.error(t('admin:expenseMgmt.reject.toastFailed'), { description: err?.message }); }
  }

  async function handleBatchApprove() {
    try {
      const res = await adminBatchApprove();
      setExpandedId(null); setShowBatch(false);
      toast.success(t('admin:expenseMgmt.batch.toastSuccess', { count: res.approvedCount }));
      fetchExpenses();
      getAdminSummary().then(setSummary).catch(err => toast.error(err?.message));
    } catch (err: any) { toast.error(t('admin:expenseMgmt.batch.toastFailed'), { description: err?.message }); }
  }

  // KPIs
  const fmtCents = (c: number) => `$${(c / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  const kpiTotal    = summary ? String(summary.totalSubmitted) : '…';
  const kpiAmount   = summary ? fmtCents(summary.totalApprovedCents) : '…';
  const kpiPending  = summary ? String(summary.pendingCount) : '…';
  const kpiObserved = summary ? String(summary.observedCount) : '…';
  const kpiRejected = summary ? String(summary.rejectedCount) : '…';

  // Render
  return (
    <div className="space-y-6 max-w-6xl">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-[#0A0A0A]">{t('admin:expenseMgmt.title')}</h2>
          <p className="text-[11px] text-[#71717A] mt-0.5">{t('admin:expenseMgmt.subtitle')}</p>
        </div>
        <Button onClick={() => setShowBatch(true)} disabled={pendingExpenses.length === 0}
          className="bg-emerald-600 hover:bg-emerald-700 text-white h-9 px-4 text-xs gap-2 flex-shrink-0 disabled:opacity-50">
          <CheckCircle className="w-3.5 h-3.5" />{t('admin:expenseMgmt.approveAllPending')}
          {pendingExpenses.length > 0 && (
            <span className="bg-white/20 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-0.5">{pendingExpenses.length}</span>
          )}
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard icon={Receipt}       title={t('admin:expenseMgmt.kpi.totalTitle')}    value={kpiTotal}    subtitle={t('admin:expenseMgmt.kpi.totalSub')}         iconBgColor="bg-[#F97316]/10" iconColor="text-[#F97316]"    />
        <StatCard icon={DollarSign}    title={t('admin:expenseMgmt.kpi.amountTitle')}      value={kpiAmount}   subtitle={t('admin:expenseMgmt.kpi.amountSub')}      iconBgColor="bg-emerald-50"   iconColor="text-emerald-600"  />
        <StatCard icon={Clock}         title={t('admin:expenseMgmt.kpi.pendingTitle')}           value={kpiPending}  subtitle={t('admin:expenseMgmt.kpi.pendingSub')}   iconBgColor="bg-amber-50"     iconColor="text-amber-600"    />
        <StatCard icon={AlertTriangle} title={t('admin:expenseMgmt.kpi.observedTitle')}          value={kpiObserved} subtitle={t('admin:expenseMgmt.kpi.observedSub')}       iconBgColor="bg-[#F97316]/10" iconColor="text-[#F97316]"    />
        <StatCard icon={XCircle}       title={t('admin:expenseMgmt.kpi.rejectedTitle')}          value={kpiRejected} subtitle={t('admin:expenseMgmt.kpi.rejectedSub')}    iconBgColor="bg-red-50"       iconColor="text-red-600"      />
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] p-5">
        <div className="flex items-center gap-2 mb-4">
          <FilterIcon className="w-4 h-4 text-[#71717A]" />
          <span className="text-sm font-semibold text-[#0A0A0A]">{t('admin:expenseMgmt.filters.title')}</span>
          {(appliedWorker !== 'all' || appliedProject !== 'all' || appliedType !== 'all' || appliedStatus !== 'all') && (
            <span className="px-1.5 py-0.5 bg-[#F97316]/10 text-[#F97316] text-[10px] font-medium rounded-full">{t('admin:expenseMgmt.filters.active')}</span>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {/* From */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('common:labels.from')}</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="h-9 rounded-lg border border-[#D4D4D8] px-3 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#F97316]/25 focus:border-[#F97316]" />
          </div>
          {/* To */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('common:labels.to')}</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="h-9 rounded-lg border border-[#D4D4D8] px-3 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#F97316]/25 focus:border-[#F97316]" />
          </div>
          {/* Worker */}
          <div className="flex flex-col gap-1.5 min-w-[155px]">
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('common:labels.worker')}</label>
            <Select value={workerFilter} onValueChange={setWorkerFilter}>
              <SelectTrigger className="h-9 border-[#D4D4D8] text-sm"><SelectValue placeholder={t('common:labels.allWorkers')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common:labels.allWorkers')}</SelectItem>
                {workers.map(w => <SelectItem key={w.id} value={String(w.id)}>{w.fullName ?? w.username}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {/* Project */}
          <div className="flex flex-col gap-1.5 min-w-[155px]">
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('common:labels.project')}</label>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="h-9 border-[#D4D4D8] text-sm"><SelectValue placeholder={t('common:labels.allProjects')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common:labels.allProjects')}</SelectItem>
                {projects.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {/* Type */}
          <div className="flex flex-col gap-1.5 min-w-[150px]">
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('common:labels.type')}</label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-9 border-[#D4D4D8] text-sm"><SelectValue placeholder={t('common:labels.allTypes')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common:labels.allTypes')}</SelectItem>
                {EXPENSE_TYPES.map(et => <SelectItem key={et.value} value={et.value}>{et.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {/* Status */}
          <div className="flex flex-col gap-1.5 min-w-[130px]">
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('common:labels.status')}</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 border-[#D4D4D8] text-sm"><SelectValue placeholder={t('common:labels.all')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common:labels.all')}</SelectItem>
                {(['Pending','Approved','Observed','Rejected'] as ExpenseStatus[]).map(s => <SelectItem key={s} value={s}>{t(STATUS_KEY_MAP[s])}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleReset} className="h-9 px-4 text-xs border-[#D4D4D8] text-[#71717A] hover:text-[#0A0A0A]">{t('common:buttons.reset')}</Button>
            <Button size="sm" onClick={handleApply} className="h-9 px-4 text-xs bg-[#F97316] hover:bg-[#C2410C] text-white">{t('common:buttons.apply')}</Button>
          </div>
        </div>
        <p className="text-[11px] text-[#71717A] mt-3 pt-3 border-t border-[#FAFAFA]">
          {t('admin:expenseMgmt.filters.showing')} <span className="font-medium text-[#0A0A0A]">{totalElements}</span> {t('admin:expenseMgmt.filters.expenses', { count: totalElements })}
          {pendingExpenses.length > 0 && <span className="ml-2 text-amber-600 font-medium">· {t('admin:expenseMgmt.filters.pendingCount', { count: pendingExpenses.length })}</span>}
        </p>
      </div>

      {/* Table card */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-[#D4D4D8]">
          <Receipt className="w-4 h-4 text-[#71717A]" />
          <span className="text-sm font-semibold text-[#0A0A0A]">{t('admin:expenseMgmt.table.title')}</span>
          <span className="ml-1 text-xs text-[#71717A]">· {t('admin:expenseMgmt.table.records', { count: totalElements })}</span>
        </div>

        {totalElements === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <div className="w-14 h-14 bg-[#FAFAFA] rounded-full flex items-center justify-center mb-3">
              <Receipt className="w-7 h-7 text-[#D4D4D8]" />
            </div>
            <p className="text-sm font-semibold text-[#0A0A0A] mb-1">{t('admin:expenseMgmt.table.emptyTitle')}</p>
            <p className="text-xs text-[#71717A]">{t('admin:expenseMgmt.table.emptyHint')}</p>
          </div>
        )}

        {/* Desktop table */}
        {paginated.length > 0 && (
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#FAFAFA] hover:bg-[#FAFAFA]">
                  <TableHead className="w-8" />
                  {[t('admin:expenseMgmt.table.worker'),t('admin:expenseMgmt.table.date'),t('admin:expenseMgmt.table.type'),t('admin:expenseMgmt.table.amount'),t('admin:expenseMgmt.table.project'),t('admin:expenseMgmt.table.receipt'),t('admin:expenseMgmt.table.status'),t('admin:expenseMgmt.table.actions')].map(h => (
                    <TableHead key={h} className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider whitespace-nowrap">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.flatMap(expense => {
                  const isExpanded = expandedId === expense.id;
                  const mainRow = (
                    <TableRow key={`${expense.id}-row`} onClick={() => setExpandedId(isExpanded ? null : expense.id)}
                      className={`cursor-pointer border-b border-[#D4D4D8]/50 transition-colors ${isExpanded ? 'bg-[#FAFAFA]' : 'hover:bg-[#FAFAFA]/50'}`}>
                      <TableCell className="py-3 pr-0 pl-4 text-[#71717A]">
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </TableCell>
                      <TableCell className="py-3"><WorkerAvatar name={expense.workerName} /></TableCell>
                      <TableCell className="py-3"><span className="text-sm text-[#0A0A0A] whitespace-nowrap">{fmtDate(expense.date, i18n.language)}</span></TableCell>
                      <TableCell className="py-3"><TypeChip type={expense.type} compact /></TableCell>
                      <TableCell className="py-3"><span className="font-mono font-semibold text-sm text-[#0A0A0A]">{fmtAmount(expense.amount)}</span></TableCell>
                      <TableCell className="py-3"><span className="text-sm text-[#71717A]">{expense.project}</span></TableCell>
                      <TableCell className="py-3"><ReceiptThumb onClick={() => setReceiptTarget(expense)} /></TableCell>
                      <TableCell className="py-3"><StatusBadge status={expense.status} /></TableCell>
                      <TableCell className="py-3">
                        {expense.status === 'Pending' && (
                          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            <button onClick={() => openApprove(expense)} title="Approve"
                              className="w-8 h-8 rounded-full flex items-center justify-center text-emerald-600 hover:bg-emerald-50 transition-colors">
                              <CheckCircle className="w-4 h-4" /></button>
                            <button onClick={() => openObserve(expense)} title="Flag"
                              className="w-8 h-8 rounded-full flex items-center justify-center text-[#F97316] hover:bg-[#F97316]/10 transition-colors">
                              <AlertTriangle className="w-4 h-4" /></button>
                            <button onClick={() => openReject(expense)} title="Reject"
                              className="w-8 h-8 rounded-full flex items-center justify-center text-[#d4183d] hover:bg-red-50 transition-colors">
                              <XCircle className="w-4 h-4" /></button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                  if (!isExpanded) return [mainRow];
                  const detailRow = (
                    <TableRow key={`${expense.id}-detail`} className="bg-[#FAFAFA]/40 hover:bg-[#FAFAFA]/40">
                      <TableCell colSpan={9} className="px-4 py-4 border-b border-[#D4D4D8]/50">
                        <DetailPanel expense={expense}
                          onApprove={() => openApprove(expense)} onObserve={() => openObserve(expense)}
                          onReject={() => openReject(expense)}   onViewReceipt={() => setReceiptTarget(expense)} />
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
              const TypeIcon   = TYPE_CFG[expense.type]?.icon ?? MoreHorizontal;
              return (
                <div key={expense.id} className="p-4">
                  <button onClick={() => setExpandedId(isExpanded ? null : expense.id)} className="w-full flex items-start gap-3 text-left">
                    <div className="flex-1 min-w-0">
                      <div className="mb-1"><WorkerAvatar name={expense.workerName} /></div>
                      <div className="flex items-center gap-1.5 ml-9 mb-0.5">
                        <TypeIcon className="w-3.5 h-3.5 text-[#71717A]" />
                        <span className="text-xs text-[#71717A]">{t(TYPE_CFG[expense.type]?.shortLabelKey ?? expense.type)}</span>
                        <span className="text-[#D4D4D8]">·</span>
                        <span className="text-xs font-mono font-semibold text-[#0A0A0A]">{fmtAmount(expense.amount)}</span>
                      </div>
                      <p className="text-[11px] text-[#71717A] ml-9">{expense.project} · {fmtDate(expense.date, i18n.language)}</p>
                    </div>
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-[#71717A] mt-0.5 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-[#71717A] mt-0.5 flex-shrink-0" />}
                  </button>
                  <div className="flex items-center gap-2 mt-2">
                    <StatusBadge status={expense.status} />
                    {expense.status === 'Pending' && (
                      <div className="flex items-center gap-1 ml-auto">
                        <button onClick={() => openApprove(expense)} className="w-8 h-8 rounded-full flex items-center justify-center text-emerald-600 hover:bg-emerald-50 transition-colors"><CheckCircle className="w-4 h-4" /></button>
                        <button onClick={() => openObserve(expense)} className="w-8 h-8 rounded-full flex items-center justify-center text-[#F97316] hover:bg-[#F97316]/10 transition-colors"><AlertTriangle className="w-4 h-4" /></button>
                        <button onClick={() => openReject(expense)}  className="w-8 h-8 rounded-full flex items-center justify-center text-[#d4183d] hover:bg-red-50 transition-colors"><XCircle className="w-4 h-4" /></button>
                      </div>
                    )}
                  </div>
                  {isExpanded && (
                    <div className="mt-3">
                      <DetailPanel expense={expense}
                        onApprove={() => openApprove(expense)} onObserve={() => openObserve(expense)}
                        onReject={() => openReject(expense)}   onViewReceipt={() => setReceiptTarget(expense)} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {totalElements > 0 && (
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={p => { setCurrentPage(p); setExpandedId(null); }} />
        )}
      </div>

      {/* Modal: Approve */}
      <Dialog open={approveTarget !== null} onOpenChange={open => { if (!open) setApproveTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#0A0A0A]">{t('admin:expenseMgmt.approve.title')}</DialogTitle>
            <DialogDescription>{t('admin:expenseMgmt.approve.description')}</DialogDescription>
          </DialogHeader>
          {approveTarget && (
            <div className="space-y-4 py-1">
              <div className="bg-[#FAFAFA] rounded-xl border border-[#D4D4D8] p-4 space-y-3">
                <WorkerAvatar name={approveTarget.workerName} />
                <div className="flex items-center gap-2">
                  {(() => { const Icon = TYPE_CFG[approveTarget.type]?.icon ?? MoreHorizontal; return <Icon className="w-4 h-4 text-[#71717A]" />; })()}
                  <span className="text-sm text-[#0A0A0A]">{t(TYPE_CFG[approveTarget.type]?.labelKey ?? approveTarget.type)}</span>
                </div>
                <p className="text-2xl font-bold font-mono text-[#0A0A0A]">{fmtAmount(approveTarget.amount)}</p>
                <div className="flex gap-4 text-xs text-[#71717A]">
                  <span>{approveTarget.project}</span><span>·</span><span>{fmtDate(approveTarget.date, i18n.language)}</span>
                </div>
                {/* FIX: replaced static placeholder with authenticated receipt thumbnail */}
                {approveTarget.receiptUrl ? (
                  <div className="h-20 bg-white border border-[#D4D4D8] rounded-lg overflow-hidden flex items-center justify-center">
                    <AuthImage expenseId={Number(approveTarget.id)} className="max-h-full max-w-full object-contain" />
                  </div>
                ) : (
                  <div className="h-20 bg-white border border-[#D4D4D8] rounded-lg flex items-center justify-center gap-2">
                    <ImageIcon className="w-5 h-5 text-[#D4D4D8]" /><span className="text-xs text-[#D4D4D8]">{t('admin:expenseMgmt.receipt.noReceipt')}</span>
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[#0A0A0A]">{t('admin:expenseMgmt.approve.noteLabel')}</label>
                <Textarea value={approveNote} onChange={e => setApproveNote(e.target.value)}
                  maxLength={FIELD_LIMITS.NOTE}
                  placeholder={t('admin:expenseMgmt.approve.notePlaceholder')} className="resize-none text-sm border-[#D4D4D8] min-h-[72px]" rows={3} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveTarget(null)} className="border-[#D4D4D8]">{t('common:buttons.cancel')}</Button>
            <Button onClick={handleApproveConfirm} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
              <CheckCircle className="w-4 h-4" />{t('admin:expenseMgmt.approve.submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Observe */}
      <Dialog open={observeTarget !== null} onOpenChange={open => { if (!open) setObserveTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#0A0A0A]">{t('admin:expenseMgmt.observe.title')}</DialogTitle>
            {observeTarget && <DialogDescription>{observeTarget.workerName} · {t(TYPE_CFG[observeTarget.type]?.labelKey ?? observeTarget.type)} · {fmtAmount(observeTarget.amount)}</DialogDescription>}
          </DialogHeader>
          {observeTarget && (
            <div className="space-y-4 py-1">
              <div className="flex gap-2 px-3 py-2 bg-[#FAFAFA] border border-[#D4D4D8] rounded-lg text-xs text-[#71717A]">
                <span className="font-medium text-[#0A0A0A]">{observeTarget.project}</span><span>·</span>
                <span>{fmtDate(observeTarget.date, i18n.language)}</span><span>·</span>
                <span className="font-mono font-semibold text-[#0A0A0A]">{fmtAmount(observeTarget.amount)}</span>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[#0A0A0A]">{t('admin:expenseMgmt.observe.reasonLabel')} <span className="text-red-500">*</span></label>
                <Textarea value={observeComment} onChange={e => setObserveComment(e.target.value)} onBlur={() => setObserveTouched(true)}
                  maxLength={FIELD_LIMITS.NOTE}
                  placeholder={t('admin:expenseMgmt.observe.reasonPlaceholder')}
                  className={`resize-none text-sm min-h-[88px] ${observeTouched && !observeValid ? 'border-red-400' : 'border-[#D4D4D8]'}`} rows={3} />
                {observeTouched && !observeValid && (
                  <p className="flex items-center gap-1 text-xs text-red-600"><AlertCircle className="w-3 h-3" />{t('admin:expenseMgmt.observe.reasonError', { count: observeComment.trim().length })}</p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setObserveTarget(null)} className="border-[#D4D4D8]">{t('common:buttons.cancel')}</Button>
            <Button onClick={handleObserveConfirm} disabled={observeTouched && !observeValid}
              className="bg-[#F97316] hover:bg-[#C2410C] text-white gap-2"><AlertTriangle className="w-4 h-4" />{t('admin:expenseMgmt.observe.submit')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Reject */}
      <AlertDialog open={rejectTarget !== null} onOpenChange={open => { if (!open) setRejectTarget(null); }}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#0A0A0A]">{t('admin:expenseMgmt.reject.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('admin:expenseMgmt.reject.description')}</AlertDialogDescription>
          </AlertDialogHeader>
          {rejectTarget && (
            <div className="space-y-4 py-1">
              <div className="flex flex-wrap gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs">
                <span className="font-medium text-[#0A0A0A]">{rejectTarget.workerName}</span><span className="text-[#D4D4D8]">·</span>
                <span className="text-[#71717A]">{t(TYPE_CFG[rejectTarget.type]?.labelKey ?? rejectTarget.type)}</span><span className="text-[#D4D4D8]">·</span>
                <span className="font-mono font-semibold text-[#d4183d]">{fmtAmount(rejectTarget.amount)}</span><span className="text-[#D4D4D8]">·</span>
                <span className="text-[#71717A]">{rejectTarget.project}</span>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[#0A0A0A]">{t('admin:expenseMgmt.reject.reasonLabel')} <span className="text-red-500">*</span></label>
                <Textarea value={rejectComment} onChange={e => setRejectComment(e.target.value)} onBlur={() => setRejectTouched(true)}
                  maxLength={FIELD_LIMITS.NOTE}
                  placeholder={t('admin:expenseMgmt.reject.reasonPlaceholder')}
                  className={`resize-none text-sm min-h-[88px] ${rejectTouched && !rejectValid ? 'border-red-400' : 'border-[#D4D4D8]'}`} rows={3} />
                {rejectTouched && !rejectValid && (
                  <p className="flex items-center gap-1 text-xs text-red-600"><AlertCircle className="w-3 h-3" />{t('admin:expenseMgmt.reject.reasonError', { count: rejectComment.trim().length })}</p>
                )}
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#D4D4D8]">{t('common:buttons.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={e => { e.preventDefault(); handleRejectConfirm(); }}
              className={`text-white ${rejectTouched && !rejectValid ? 'bg-red-300 pointer-events-none' : 'bg-[#d4183d] hover:bg-red-700'}`}>
              <XCircle className="w-4 h-4 mr-1.5" />{t('admin:expenseMgmt.reject.submit')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal: Batch approve */}
      <AlertDialog open={showBatch} onOpenChange={setShowBatch}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#0A0A0A]">{t('admin:expenseMgmt.batch.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin:expenseMgmt.batch.description', { count: pendingExpenses.length })}{' '}
              <strong className="text-emerald-700">{fmtAmount(pendingTotal)}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {Object.keys(pendingByWorker).length > 0 && (
            <div className="space-y-2 py-1">
              <p className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('admin:expenseMgmt.batch.breakdownTitle')}</p>
              <div className="bg-[#FAFAFA] rounded-xl border border-[#D4D4D8] divide-y divide-[#D4D4D8] overflow-hidden">
                {Object.entries(pendingByWorker).map(([worker, data]) => (
                  <div key={worker} className="flex items-center justify-between px-4 py-2.5">
                    <WorkerAvatar name={worker} />
                    <div className="flex items-center gap-3 text-xs text-[#71717A]">
                      <span>{t('admin:expenseMgmt.batch.expenses', { count: data.count })}</span>
                      <span className="font-mono font-semibold text-[#0A0A0A]">{fmtAmount(data.total)}</span>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between px-4 py-2.5 bg-emerald-50">
                  <span className="text-xs font-semibold text-emerald-800">{t('admin:expenseMgmt.batch.total')}</span>
                  <span className="font-mono font-semibold text-sm text-emerald-700">{fmtAmount(pendingTotal)}</span>
                </div>
              </div>
            </div>
          )}
          {/* TODO: POST /api/v1/admin/expenses/approve-batch */}
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#D4D4D8]">{t('common:buttons.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleBatchApprove} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
              <CheckCircle className="w-4 h-4" />{t('admin:expenseMgmt.batch.submit')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Receipt preview — FIX: replaced static placeholder with interactive viewer
         that fetches the image using JWT auth headers and supports pan/zoom/keyboard */}
      <Dialog open={receiptTarget !== null} onOpenChange={open => { if (!open) setReceiptTarget(null); }}>
        <DialogContent className="sm:max-w-lg" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-[#0A0A0A]">
              {receiptTarget ? t('admin:expenseMgmt.receipt.title', { worker: receiptTarget.workerName, date: fmtDate(receiptTarget.date, i18n.language) }) : ''}
            </DialogTitle>
          </DialogHeader>
          {receiptTarget?.receiptUrl ? (
            <ReceiptViewer
              expenseId={Number(receiptTarget.id)}
              onClose={() => setReceiptTarget(null)}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-56 bg-[#FAFAFA] rounded-xl border border-[#D4D4D8] gap-3">
              <div className="w-14 h-14 bg-white rounded-full border border-[#D4D4D8] flex items-center justify-center">
                <ImageIcon className="w-7 h-7 text-[#D4D4D8]" />
              </div>
              <p className="text-sm font-medium text-[#71717A]">{t('admin:expenseMgmt.receipt.noReceiptUploaded')}</p>
            </div>
          )}
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
