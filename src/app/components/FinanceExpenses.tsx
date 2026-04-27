import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
// NOTE: [CLOSED PROJECT RULE] FinanceExpenses is a read-only review screen.
// No creation/edit actions exist here, so no CLOSED blocking is needed.
// If approve/reject functionality is added for closed projects, revisit.
import {
  CheckCircle, Filter as FilterIcon, ChevronDown, ChevronRight,
  Image as ImageIcon, Droplets, Package, Wrench,
  Utensils, ShoppingBag, Car, MoreHorizontal, Loader2,
  ZoomIn, ZoomOut, RotateCcw, ExternalLink, AlertCircle,
} from 'lucide-react';
import { Button } from './ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from './ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from './ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from './ui/dialog';
import { EXPENSE_TYPES } from './NewExpense';
import {
  getFinanceExpenses, receiptUrl,
  type ExpenseResponse,
} from '../services/expenses';
import { listProjects, type ProjectResponse } from '../services/projects';
import { listActiveUsers, type UserDTO } from '../services/users';
import { businessToday, nDaysAgo } from '../helpers/dateTime';

// Types

interface ApprovedExpense {
  id: string;
  date: string;
  workerName: string;
  type: string;
  project: string;
  amount: number;
  workerComment?: string;
  reviewerName?: string;
  receiptUrl?: string;
}

// Constants

const ITEMS_PER_PAGE = 10;

const STATUS_TYPE_MAP: Record<string, string> = {
  FUEL: 'fuel', MATERIALS: 'materials', TOOLS: 'tools',
  PER_DIEM: 'per-diem', MINOR_PURCHASES: 'minor-purchases',
  TRANSPORTATION: 'transportation', OTHER: 'other',
};

function mapExpense(e: ExpenseResponse): ApprovedExpense {
  return {
    id: String(e.id),
    date: e.expenseDate,
    workerName: e.workerName ?? e.workerUsername,
    type: STATUS_TYPE_MAP[e.expenseType] ?? e.expenseType.toLowerCase(),
    project: e.projectName,
    amount: e.amountCents / 100,
    workerComment: e.description ?? undefined,
    reviewerName: e.reviewerName ?? undefined,
    receiptUrl: e.receiptUrl ? receiptUrl(e.id) : undefined,
  };
}

// Style configs

const TYPE_CFG: Record<string, { icon: React.ElementType }> = {
  'fuel':            { icon: Droplets       },
  'materials':       { icon: Package        },
  'tools':           { icon: Wrench         },
  'per-diem':        { icon: Utensils       },
  'minor-purchases': { icon: ShoppingBag    },
  'transportation':  { icon: Car            },
  'other':           { icon: MoreHorizontal },
};

const TYPE_KEY_MAP: Record<string, string> = {
  'fuel': 'FUEL', 'materials': 'MATERIALS', 'tools': 'TOOLS',
  'per-diem': 'PER_DIEM', 'minor-purchases': 'MINOR_PURCHASES',
  'transportation': 'TRANSPORTATION', 'other': 'OTHER',
};

// Helpers

function fmtDate(iso: string, lang: string = 'en') {
  const locale = lang === 'es' ? 'es' : 'en-US';
  return new Date(`${iso}T00:00:00`).toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtAmount(n: number) {
  return `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}
function getThirtyDaysAgo() { return nDaysAgo(30); }
function getToday()         { return businessToday(); }

// ── Interactive Receipt Viewer (same as admin) ─────────────────────

const MIN_SCALE = 0.25;
const MAX_SCALE = 5;
const ZOOM_STEP = 0.25;

function ReceiptViewer({ expenseId, onClose }: { expenseId: number; onClose?: () => void }) {
  const { t } = useTranslation(['finance']);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const translateStart = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let revoke: string | null = null;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setBlobUrl(null);
    setScale(1);
    setTranslate({ x: 0, y: 0 });

    fetch(receiptUrl(expenseId), { credentials: 'include' as RequestCredentials })
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.blob(); })
      .then(blob => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        revoke = url;
        setBlobUrl(url);
      })
      .catch(err => { if (!cancelled) setError(err?.message ?? 'Failed to load receipt'); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; if (revoke) URL.revokeObjectURL(revoke); };
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
      .catch(err => toast.error(err?.message));
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
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
        <p className="text-sm text-[#71717A]">{t('finance:expenses.loadingReceipt', 'Loading receipt...')}</p>
      </div>
    );
  }

  if (error || !blobUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-80 bg-[#FAFAFA] rounded-xl border border-red-200 gap-3">
        <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center">
          <AlertCircle className="w-7 h-7 text-red-400" />
        </div>
        <p className="text-sm font-medium text-red-600">{t('finance:expenses.receiptFailed', 'Failed to load receipt')}</p>
        <p className="text-[11px] text-[#71717A]">{error ?? 'Unknown error'}</p>
      </div>
    );
  }

  const zoomPercent = Math.round(scale * 100);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between bg-[#FAFAFA] rounded-lg border border-[#D4D4D8] px-2 py-1">
        <div className="flex items-center gap-1">
          <button onClick={zoomOut} className="w-7 h-7 rounded flex items-center justify-center text-[#71717A] hover:bg-white hover:text-[#0A0A0A] transition-colors">
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] font-mono font-medium text-[#71717A] w-10 text-center select-none">{zoomPercent}%</span>
          <button onClick={zoomIn} className="w-7 h-7 rounded flex items-center justify-center text-[#71717A] hover:bg-white hover:text-[#0A0A0A] transition-colors">
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-4 bg-[#D4D4D8] mx-1" />
          <button onClick={resetView} className="w-7 h-7 rounded flex items-center justify-center text-[#71717A] hover:bg-white hover:text-[#0A0A0A] transition-colors">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
        <button onClick={openInNewTab} className="w-7 h-7 rounded flex items-center justify-center text-[#71717A] hover:bg-white hover:text-purple-600 transition-colors">
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>

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

      <p className="text-[10px] text-[#D4D4D8] text-center select-none">
        <kbd className="px-1 py-0.5 bg-[#FAFAFA] border border-[#D4D4D8] rounded text-[9px]">+</kbd>/<kbd className="px-1 py-0.5 bg-[#FAFAFA] border border-[#D4D4D8] rounded text-[9px]">−</kbd> zoom · <kbd className="px-1 py-0.5 bg-[#FAFAFA] border border-[#D4D4D8] rounded text-[9px]">0</kbd> reset · <kbd className="px-1 py-0.5 bg-[#FAFAFA] border border-[#D4D4D8] rounded text-[9px]">Esc</kbd> close
      </p>
    </div>
  );
}

// Sub-components

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
  const { t } = useTranslation(['finance']);
  const cfg  = TYPE_CFG[type] ?? { icon: MoreHorizontal };
  const Icon = cfg.icon;
  const typeKey = TYPE_KEY_MAP[type] ?? type.toUpperCase().replace(/-/g, '_');
  const label = compact ? t(`finance:type.${typeKey}`) : t(`finance:type.long.${typeKey}`);
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="w-3.5 h-3.5 text-[#71717A] flex-shrink-0" />
      <span className="text-sm text-[#0A0A0A]">{label}</span>
    </div>
  );
}

function Pagination({ currentPage, totalPages, onPageChange }: {
  currentPage: number; totalPages: number; onPageChange: (p: number) => void;
}) {
  const { t } = useTranslation(['common']);
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-1 py-4 border-t border-[#D4D4D8]">
      <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}
        className="h-8 px-3 rounded-lg text-xs font-medium text-[#71717A] hover:text-[#0A0A0A] hover:bg-[#FAFAFA] disabled:opacity-30 disabled:cursor-not-allowed">{t('common:buttons.prev')}</button>
      {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
        <button key={p} onClick={() => onPageChange(p)}
          className={`h-8 w-8 rounded-lg text-xs font-semibold transition-colors ${p === currentPage ? 'bg-purple-600 text-white' : 'text-[#71717A] hover:bg-[#FAFAFA]'}`}>{p}</button>
      ))}
      <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages}
        className="h-8 px-3 rounded-lg text-xs font-medium text-[#71717A] hover:text-[#0A0A0A] hover:bg-[#FAFAFA] disabled:opacity-30 disabled:cursor-not-allowed">{t('common:buttons.next')}</button>
    </div>
  );
}

// Component

export function FinanceExpenses() {
  const { t, i18n } = useTranslation(['finance', 'common']);

  // Filters
  const [dateFrom,      setDateFrom]      = useState(getThirtyDaysAgo);
  const [dateTo,        setDateTo]        = useState(getToday);
  const [workerFilter,  setWorkerFilter]  = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [typeFilter,    setTypeFilter]    = useState('all');

  // UI
  const [expandedId,    setExpandedId]    = useState<string | null>(null);
  const [currentPage,   setCurrentPage]   = useState(1);
  const [receiptTarget, setReceiptTarget] = useState<ApprovedExpense | null>(null);
  const [loading,       setLoading]       = useState(false);

  // Data from API
  const [expenses,      setExpenses]      = useState<ApprovedExpense[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalValue,    setTotalValue]    = useState(0);
  const [workers,       setWorkers]       = useState<UserDTO[]>([]);
  const [projects,      setProjects]      = useState<ProjectResponse[]>([]);

  useEffect(() => {
    listActiveUsers().then(setWorkers).catch(err => toast.error(err?.message));
    listProjects({ size: 200 }).then(r => setProjects(r.content)).catch(err => toast.error(err?.message));
  }, []);

  const fetchExpenses = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await getFinanceExpenses({
        dateFrom,
        dateTo,
        workerId: workerFilter !== 'all' ? Number(workerFilter) : undefined,
        projectId: projectFilter !== 'all' ? Number(projectFilter) : undefined,
        type: typeFilter !== 'all' ? typeFilter.toUpperCase().replace(/-/g, '_') : undefined,
        page: page - 1,
        size: ITEMS_PER_PAGE,
      });
      setExpenses(res.content.map(mapExpense));
      setTotalElements(res.totalElements);
      setTotalValue(res.content.reduce((s, e) => s + e.amountCents, 0) / 100);
    } catch { /* silent */ } finally { setLoading(false); }
  }, [dateFrom, dateTo, workerFilter, projectFilter, typeFilter]);

  useEffect(() => { fetchExpenses(currentPage); }, [fetchExpenses, currentPage]);

  function handleApply() {
    setCurrentPage(1); setExpandedId(null);
    fetchExpenses(1);
  }
  function handleReset() {
    const f = getThirtyDaysAgo(), td = getToday();
    setDateFrom(f); setDateTo(td);
    setWorkerFilter('all'); setProjectFilter('all'); setTypeFilter('all');
    setCurrentPage(1); setExpandedId(null);
  }

  const totalPages = Math.max(1, Math.ceil(totalElements / ITEMS_PER_PAGE));
  const paginated  = expenses;

  return (
    <div className="space-y-6 max-w-5xl">

      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center flex-shrink-0">
          <CheckCircle className="w-4 h-4 text-purple-600" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-[#0A0A0A]">{t('finance:expenses.title')}</h2>
          <p className="text-[11px] text-[#71717A]">{t('finance:expenses.subtitle')}</p>
        </div>
        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-600 border border-purple-200">
          {t('finance:expenses.viewOnly')}
        </span>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] p-5">
        <div className="flex items-center gap-2 mb-4">
          <FilterIcon className="w-4 h-4 text-[#71717A]" />
          <span className="text-sm font-semibold text-[#0A0A0A]">{t('common:buttons.filters')}</span>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('common:labels.from')}</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="h-9 rounded-lg border border-[#D4D4D8] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('common:labels.to')}</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="h-9 rounded-lg border border-[#D4D4D8] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400" />
          </div>
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
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleReset} className="h-9 px-4 text-xs border-[#D4D4D8] text-[#71717A] hover:text-[#0A0A0A]">{t('common:buttons.reset')}</Button>
            <Button size="sm" onClick={handleApply} className="h-9 px-4 text-xs bg-purple-600 hover:bg-purple-700 text-white">{t('common:buttons.apply')}</Button>
          </div>
        </div>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#FAFAFA]">
          <p className="text-[11px] text-[#71717A]">
            {loading && <Loader2 className="w-3 h-3 animate-spin inline mr-1" />}
            <span className="font-medium text-[#0A0A0A]">{totalElements}</span> {t('finance:expenses.expenseCount', { count: totalElements })}
          </p>
          <p className="text-[11px] text-[#71717A]">
            {t('finance:expenses.total')} <span className="font-mono font-semibold text-[#0A0A0A]">{fmtAmount(totalValue)}</span>
          </p>
        </div>
      </div>

      {/* Table card */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-[#D4D4D8]">
          <CheckCircle className="w-4 h-4 text-[#71717A]" />
          <span className="text-sm font-semibold text-[#0A0A0A]">{t('finance:expenses.tableTitle')}</span>
          <span className="ml-1 text-xs text-[#71717A]">· {totalElements} {t('finance:expenses.recordCount', { count: totalElements })}</span>
        </div>

        {!loading && expenses.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <div className="w-14 h-14 bg-[#FAFAFA] rounded-full flex items-center justify-center mb-3">
              <CheckCircle className="w-7 h-7 text-[#D4D4D8]" />
            </div>
            <p className="text-sm font-semibold text-[#0A0A0A] mb-1">{t('finance:expenses.noExpenses')}</p>
            <p className="text-xs text-[#71717A]">{t('finance:expenses.noExpensesHint')}</p>
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
                    t('common:labels.date'), t('common:labels.worker'), t('common:labels.type'),
                    t('common:labels.project'), t('common:labels.amount'), t('finance:expenses.receipt'),
                  ].map(h => (
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
                      <TableCell className="py-3"><span className="text-sm text-[#0A0A0A] whitespace-nowrap">{fmtDate(expense.date, i18n.language)}</span></TableCell>
                      <TableCell className="py-3"><WorkerAvatar name={expense.workerName} /></TableCell>
                      <TableCell className="py-3"><TypeChip type={expense.type} compact /></TableCell>
                      <TableCell className="py-3"><span className="text-sm text-[#71717A]">{expense.project}</span></TableCell>
                      <TableCell className="py-3"><span className="font-mono font-semibold text-sm text-[#0A0A0A]">{fmtAmount(expense.amount)}</span></TableCell>
                      <TableCell className="py-3">
                        <button onClick={e => { e.stopPropagation(); setReceiptTarget(expense); }} title={t('finance:expenses.viewReceipt')}
                          className="w-10 h-10 rounded-lg bg-[#FAFAFA] border border-[#D4D4D8] flex items-center justify-center hover:border-purple-400 hover:bg-purple-50 transition-colors">
                          <ImageIcon className="w-4 h-4 text-[#71717A]" />
                        </button>
                      </TableCell>
                    </TableRow>
                  );

                  if (!isExpanded) return [mainRow];

                  const detailRow = (
                    <TableRow key={`${expense.id}-detail`} className="bg-[#FAFAFA]/40 hover:bg-[#FAFAFA]/40">
                      <TableCell colSpan={7} className="px-4 py-4 border-b border-[#D4D4D8]/50">
                        <div className="bg-[#FAFAFA] rounded-xl border border-[#D4D4D8] p-4 space-y-3">
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            {[[t('common:labels.worker'), expense.workerName],
                              [t('common:labels.type'), (() => { const tk = TYPE_KEY_MAP[expense.type] ?? expense.type.toUpperCase().replace(/-/g, '_'); return t(`finance:type.long.${tk}`); })()],
                              [t('common:labels.amount'), fmtAmount(expense.amount)], [t('common:labels.project'), expense.project],
                              [t('common:labels.date'), fmtDate(expense.date, i18n.language)], [t('finance:expenses.approvedBy'), expense.reviewerName ?? '—']
                            ].map(([label, value]) => (
                              <div key={label}>
                                <p className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wide mb-0.5">{label}</p>
                                <p className="text-sm font-medium text-[#0A0A0A]">{value}</p>
                              </div>
                            ))}
                          </div>
                          {expense.workerComment && (
                            <div>
                              <p className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wide mb-0.5">{t('finance:expenses.workerNotes')}</p>
                              <p className="text-sm text-[#0A0A0A]">{expense.workerComment}</p>
                            </div>
                          )}
                          <div className="flex items-center gap-2 pt-2 border-t border-[#D4D4D8]">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{t('common:status.approved')}
                            </span>
                            <button onClick={() => setReceiptTarget(expense)}
                              className="flex items-center gap-1.5 text-xs font-medium text-purple-600 hover:text-purple-800 transition-colors ml-2">
                              <ImageIcon className="w-3.5 h-3.5" />{t('finance:expenses.viewReceipt')}
                            </button>
                          </div>
                        </div>
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
                  {/* Row: tap area + receipt button side-by-side (no nested buttons) */}
                  <div className="flex items-start gap-3">
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setExpandedId(isExpanded ? null : expense.id)}
                      onKeyDown={e => e.key === 'Enter' && setExpandedId(isExpanded ? null : expense.id)}
                      className="flex-1 min-w-0 cursor-pointer text-left"
                    >
                      <div className="mb-1"><WorkerAvatar name={expense.workerName} /></div>
                      <div className="flex items-center gap-1.5 ml-9 mb-0.5">
                        <TypeIcon className="w-3.5 h-3.5 text-[#71717A]" />
                        <span className="text-xs text-[#71717A]">{(() => { const tk = TYPE_KEY_MAP[expense.type] ?? expense.type.toUpperCase().replace(/-/g, '_'); return t(`finance:type.${tk}`); })()}</span>
                        <span className="text-[#D4D4D8]">·</span>
                        <span className="text-xs font-mono font-semibold text-[#0A0A0A]">{fmtAmount(expense.amount)}</span>
                      </div>
                      <p className="text-[11px] text-[#71717A] ml-9">{expense.project} · {fmtDate(expense.date, i18n.language)}</p>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); setReceiptTarget(expense); }}
                      className="w-10 h-10 rounded-lg bg-[#FAFAFA] border border-[#D4D4D8] flex items-center justify-center flex-shrink-0"
                    >
                      <ImageIcon className="w-4 h-4 text-[#71717A]" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{t('common:status.approved')}
                    </span>
                    {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-[#71717A] ml-auto" /> : <ChevronRight className="w-3.5 h-3.5 text-[#71717A] ml-auto" />}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {expenses.length > 0 && (
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={p => { setCurrentPage(p); setExpandedId(null); }} />
        )}
      </div>

      {/* Receipt preview dialog */}
      <Dialog open={receiptTarget !== null} onOpenChange={open => { if (!open) setReceiptTarget(null); }}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-[#0A0A0A]">
              Receipt — {receiptTarget?.workerName} {receiptTarget ? `· ${fmtDate(receiptTarget.date, i18n.language)}` : ''}
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
              <p className="text-sm font-medium text-[#71717A]">{t('finance:expenses.noReceipt')}</p>
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