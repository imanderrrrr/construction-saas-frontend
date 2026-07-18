import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Wallet, DollarSign, TrendingDown, Percent, Plus,
  Pencil, Clock, Lock, MoreHorizontal,
  AlertTriangle, AlertCircle, XCircle,
  Loader2, ArrowLeft, Receipt, Users,
  CreditCard, PieChart,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { StatCard } from './StatCard';
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
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  listProjects, updateProject, getContractHistory,
  type ProjectResponse, type ContractHistoryEntry,
} from '../services/projects';
import { getExpenseReport } from '../services/expenses';
import { listPayables } from '../services/finance';
import { FIELD_LIMITS } from '../../shared/fieldLimits';

// Types

type BudgetStatus = 'Active' | 'Closed';
type HistoryType  = 'Created' | 'Modified' | 'Closed' | 'Deduction';

interface HistoryEntry {
  id: string;
  date: string;
  actor: string;
  type: HistoryType;
  previousBudget?: number;
  newBudget?: number;
  reason: string;
}

interface Budget {
  id: string;
  projectId: number;
  project: string;
  totalBudget: number;
  consumed: number;
  remaining: number;
  pct: number;
  startDate?: string;
  endDate?: string;
  notes?: string;
  status: BudgetStatus;
  alertLevel: AlertLevel;
  createdAt: string;
  history: HistoryEntry[];
}

type AlertLevel = 'ok' | 'warning' | 'critical' | 'exceeded';

// Helpers

function centsToUsd(cents: number | null | undefined): number {
  return (cents ?? 0) / 100;
}

function usdToCents(usd: number): number {
  return Math.round(usd * 100);
}

function fmtAmount(n: number): string {
  if (n < 0) return `-$${Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  return `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

function fmtAmountCompact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

import { fmtDate } from '../helpers/dateTime';

function getPct(consumed: number, total: number): number {
  if (total === 0) return 0;
  return (consumed / total) * 100;
}

function getAlertLevel(pct: number): AlertLevel {
  if (pct > 100) return 'exceeded';
  if (pct >= 90)  return 'critical';
  if (pct >= 70)  return 'warning';
  return 'ok';
}

function getProgressColor(pct: number): string {
  if (pct > 100) return 'bg-red-600';
  if (pct >= 90)  return 'bg-red-500';
  if (pct >= 70)  return 'bg-amber-500';
  return 'bg-emerald-500';
}

function getAlertConfig(level: AlertLevel): { bg: string; border: string; text: string; dot: string } {
  switch (level) {
    case 'exceeded': return { bg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-700',     dot: 'bg-red-500'     };
    case 'critical': return { bg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-600',     dot: 'bg-red-500'     };
    case 'warning':  return { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   dot: 'bg-amber-500'   };
    default:         return { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500' };
  }
}

function mapHistoryEntry(entry: ContractHistoryEntry): HistoryEntry {
  let type: HistoryType = 'Modified';
  if (entry.changeType === 'INITIAL_ASSIGNMENT') type = 'Created';
  else if (entry.changeType === 'EXPENSE_DEDUCTION') type = 'Deduction';
  else if (entry.changeType === 'PROJECT_CLOSED') type = 'Closed';

  return {
    id:            String(entry.id),
    date:          entry.createdAt.split('T')[0],
    actor:         'admin',
    type,
    newBudget:     centsToUsd(entry.balanceAfterCents),
    previousBudget: centsToUsd(entry.balanceAfterCents + entry.amountCents),
    reason:        entry.description || entry.changeType,
  };
}

function mapProjectToBudget(p: ProjectResponse): Budget {
  const totalBudget = centsToUsd(p.revisedContractCents ?? p.originalContractCents ?? 0);
  const consumed    = centsToUsd(p.totalConsumedCents ?? 0);
  const remaining   = totalBudget - consumed;
  const pct         = getPct(consumed, totalBudget);
  return {
    id:          String(p.id),
    projectId:   p.id,
    project:     p.name,
    totalBudget,
    consumed,
    remaining,
    pct,
    startDate:   p.createdAt.split('T')[0],
    status:      p.status === 'CLOSED' ? 'Closed' : 'Active',
    alertLevel:  getAlertLevel(pct),
    createdAt:   p.createdAt,
    history:     [],
  };
}

function formatExpenseType(type: string): string {
  return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

// ── Cost distribution (labor / expenses / payables) ────────────────────────
//
// A project's consumed budget is drawn down from exactly three sources
// (verified against the backend budget ledger):
//   • approved expenses      → deducted on approval, by the expense amount
//   • payable payments       → deducted on payment, by the amount PAID
//   • labor payroll payments → deducted per LaborPayment
// so `consumed === approvedExpenses + Σ payable.paidAmount + payroll`.
//
// The payables slice must therefore use what has actually been PAID
// (`paidAmount`), NOT the outstanding balance (`amount − paidAmount`). The old
// balance formula returned 0 for a fully-paid bill, which collapsed AP to 0%
// and — because labor is the residual — made labor swallow ~100% on projects
// whose spend was mostly paid material bills.
//
// Labor is the residual, which equals the payroll draw-down. Vendor bills —
// including bills from the "General Labor" vendor — are payables and belong to
// the payables slice, so they are never double-counted into the labor residual.
export interface CostDistribution {
  laborCost: number;
  expenseTotal: number;
  payableTotal: number;
}

export function computeCostDistribution(
  consumed: number,
  expenseTotal: number,
  payables: ReadonlyArray<{ paidAmount: number }>,
): CostDistribution {
  const payableTotal = payables.reduce((sum, p) => sum + p.paidAmount, 0);
  // Residual = payroll. Floored at 0 to stay robust against a transient
  // out-of-sync read (e.g. an approval landing between the two fetches).
  const laborCost = Math.max(consumed - expenseTotal - payableTotal, 0);
  return { laborCost, expenseTotal, payableTotal };
}

// Sub-components

function HistoryTypeBadge({ type }: { type: HistoryType }) {
  const { t } = useTranslation('admin');
  const cfg: Record<HistoryType, { bg: string; text: string; border: string }> = {
    Created:   { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    Modified:  { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200'   },
    Closed:    { bg: 'bg-slate-50',   text: 'text-slate-600',   border: 'border-slate-200'   },
    Deduction: { bg: 'bg-red-50',     text: 'text-red-600',     border: 'border-red-200'     },
  };
  const c = cfg[type];
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${c.bg} ${c.text} ${c.border}`}>
      {t(`budgetMgmt.historyType.${type}`, type)}
    </span>
  );
}

// ── Mini donut chart (SVG) ─────────────────────────────

interface DonutSegment { pct: number; color: string; label: string }

function MiniDonut({ segments, size = 80 }: { segments: DonutSegment[]; size?: number }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <svg width={size} height={size} viewBox="0 0 80 80" className="flex-shrink-0">
      <circle cx="40" cy="40" r={r} fill="none" stroke="#F0F2F5" strokeWidth="10" />
      {segments.filter(s => s.pct > 0).map((seg, i) => {
        const dash = (seg.pct / 100) * c;
        const gap  = c - dash;
        const el = (
          <circle
            key={i}
            cx="40" cy="40" r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth="10"
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={-offset}
            strokeLinecap="round"
            className="transition-all duration-500"
            style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
          />
        );
        offset += dash;
        return el;
      })}
    </svg>
  );
}

// ── Project Bento Card ─────────────────────────────────

function BudgetCard({ budget, onSelect, onEdit, onHistory, onClose }: {
  budget: Budget;
  onSelect: () => void;
  onEdit: () => void;
  onHistory: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation(['admin', 'common']);
  const alertCfg = getAlertConfig(budget.alertLevel);
  const cappedPct = Math.min(budget.pct, 100);

  // Estimated days remaining
  let estDays: number | null = null;
  if (budget.remaining > 0 && budget.consumed > 0) {
    const msPerDay   = 86_400_000;
    const daysActive = Math.max((Date.now() - new Date(budget.createdAt).getTime()) / msPerDay, 1);
    const dailyBurn  = budget.consumed / daysActive;
    estDays          = Math.round(budget.remaining / dailyBurn);
  }

  return (
    <div
      onClick={onSelect}
      className="group bg-white rounded-2xl border border-[#D4D4D8] hover:border-[#F97316]/40 hover:shadow-lg hover:shadow-[#F97316]/5 transition-all duration-200 cursor-pointer overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${alertCfg.dot}`} />
            <h3 className="text-sm font-bold text-[#0A0A0A] truncate group-hover:text-[#F97316] transition-colors">
              {budget.project}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {budget.status === 'Active' ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1 h-1 rounded-full bg-emerald-500" />{t('admin:budgetMgmt.status.active')}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-50 text-slate-600 border border-slate-200">
                <span className="w-1 h-1 rounded-full bg-slate-400" />{t('admin:budgetMgmt.status.closed')}
              </span>
            )}
            {budget.alertLevel !== 'ok' && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${alertCfg.bg} ${alertCfg.text} ${alertCfg.border}`}>
                {budget.alertLevel === 'exceeded' && <XCircle className="w-3 h-3" />}
                {budget.alertLevel === 'critical' && <AlertCircle className="w-3 h-3" />}
                {budget.alertLevel === 'warning' && <AlertTriangle className="w-3 h-3" />}
                {t(`admin:budgetMgmt.alert.${budget.alertLevel}`)}
              </span>
            )}
          </div>
        </div>
        {/* Actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm"
              onClick={e => e.stopPropagation()}
              className="h-7 w-7 p-0 text-[#71717A] hover:text-[#0A0A0A] hover:bg-[#FAFAFA] opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreHorizontal className="w-3.5 h-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44" onClick={e => e.stopPropagation()}>
            <DropdownMenuItem onClick={onEdit} className="gap-2 text-sm cursor-pointer">
              <Pencil className="w-4 h-4 text-[#71717A]" />{t('admin:budgetMgmt.menu.edit')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onHistory} className="gap-2 text-sm cursor-pointer">
              <Clock className="w-4 h-4 text-[#71717A]" />{t('admin:budgetMgmt.menu.history')}
            </DropdownMenuItem>
            {budget.status === 'Active' && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onClose}
                  className="gap-2 text-sm cursor-pointer text-[#d4183d] focus:text-[#d4183d]">
                  <Lock className="w-4 h-4" />{t('admin:budgetMgmt.menu.close')}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Budget amounts */}
      <div className="px-5 pb-3">
        <div className="flex items-end justify-between mb-2">
          <div>
            <p className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wide">{t('admin:budgetMgmt.card.totalBudget')}</p>
            <p className="text-lg font-bold font-mono text-[#0A0A0A]">{fmtAmountCompact(budget.totalBudget)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wide">{t('admin:budgetMgmt.card.remaining')}</p>
            <p className={`text-lg font-bold font-mono ${budget.remaining < 0 ? 'text-red-600' : 'text-[#F97316]'}`}>
              {fmtAmountCompact(budget.remaining)}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="relative h-2 bg-[#F0F2F5] rounded-full overflow-hidden mb-2">
          <div
            className={`h-full rounded-full transition-all duration-500 ${getProgressColor(budget.pct)} ${budget.pct > 100 ? 'animate-pulse' : ''}`}
            style={{ width: `${cappedPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono text-[#71717A]">
            {fmtAmountCompact(budget.consumed)} {t('admin:budgetMgmt.card.consumed')}
          </span>
          <span className={`text-xs font-bold tabular-nums ${
            budget.pct >= 90 ? 'text-red-600' : budget.pct >= 70 ? 'text-amber-600' : 'text-emerald-600'
          }`}>
            {budget.pct.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Footer: estimated days */}
      <div className="px-5 py-3 bg-[#F8F9FB] border-t border-[#D4D4D8]/50">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[#71717A]">{t('admin:budgetMgmt.card.estimatedDays')}</span>
          {estDays != null ? (
            <span className={`text-xs font-bold tabular-nums ${
              estDays <= 7 ? 'text-red-600' : estDays <= 30 ? 'text-amber-600' : 'text-[#0A0A0A]'
            }`}>
              {estDays} {t('admin:budgetReport.days')}
            </span>
          ) : (
            <span className="text-xs text-[#71717A]">—</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Project Detail Panel (Bento Grid) ──────────────────

interface DetailData {
  expenseBreakdown: { type: string; label: string; amount: number; pct: number; color: string }[];
  payables: { vendor: string; amount: number; paidAmount: number; status: string }[];
  laborCost: number;
  expenseTotal: number;
  payableTotal: number;
}

const EXPENSE_COLORS: Record<string, string> = {
  FUEL: '#ef4444',
  MATERIALS: '#9333ea',
  TOOLS: '#d97706',
  PER_DIEM: '#0ea5e9',
  MINOR_PURCHASES: '#10b981',
  TRANSPORTATION: '#6366f1',
  OTHER: '#71717A',
};

function ProjectDetail({ budget, onBack }: { budget: Budget; onBack: () => void }) {
  const { t, i18n } = useTranslation(['admin', 'common']);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail]   = useState<DetailData | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [expReport, payablesPage] = await Promise.all([
          getExpenseReport(),
          listPayables({ size: 200 }),
        ]);

        const projectExpRow = expReport.byProject.find(r => r.projectId === budget.projectId);
        const expenseTotal  = projectExpRow ? projectExpRow.approvedCents / 100 : 0;

        // Expense breakdown
        const breakdown = (projectExpRow?.breakdown ?? []).map(b => {
          const amount = b.totalCents / 100;
          const pctVal = expenseTotal > 0 ? (amount / expenseTotal) * 100 : 0;
          return {
            type:  b.type,
            label: formatExpenseType(b.type),
            amount,
            pct:   Math.round(pctVal * 10) / 10,
            color: EXPENSE_COLORS[b.type] || EXPENSE_COLORS.OTHER,
          };
        }).sort((a, b) => b.amount - a.amount);

        // Payables for this project
        const projectPayables = payablesPage.content
          .filter(p => p.projectId === budget.projectId)
          .map(p => ({ vendor: p.vendor, amount: p.amount, paidAmount: p.paidAmount, status: p.status }));

        // AP consumes the budget by what has been PAID, not the outstanding
        // balance; labor is the residual (= payroll). See computeCostDistribution.
        const { laborCost, payableTotal } = computeCostDistribution(
          budget.consumed, expenseTotal, projectPayables,
        );

        if (!cancelled) {
          setDetail({ expenseBreakdown: breakdown, payables: projectPayables, laborCost, expenseTotal, payableTotal });
        }
      } catch {
        toast.error(t('admin:budgetMgmt.detail.loadError', 'Error loading details'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [budget.projectId, budget.consumed, t]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-[#F97316]" />
      </div>
    );
  }

  if (!detail) return null;

  const alertCfg   = getAlertConfig(budget.alertLevel);
  const cappedPct  = Math.min(budget.pct, 100);

  // Source distribution for donut
  const total = budget.consumed || 1;
  const donutSegments: DonutSegment[] = [
    { pct: (detail.laborCost / total) * 100,   color: '#F97316', label: t('admin:budgetMgmt.detail.labor') },
    { pct: (detail.expenseTotal / total) * 100, color: '#9333ea', label: t('admin:budgetMgmt.detail.expenses') },
    { pct: (detail.payableTotal / total) * 100, color: '#d97706', label: t('admin:budgetMgmt.detail.payables') },
  ];

  return (
    <div className="space-y-5">
      {/* Back button + title */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}
          className="h-8 w-8 p-0 text-[#71717A] hover:text-[#F97316] hover:bg-[#F97316]/5">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-[#0A0A0A] truncate">{budget.project}</h2>
          <p className="text-[11px] text-[#71717A]">{t('admin:budgetMgmt.detail.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {budget.status === 'Active' ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1 h-1 rounded-full bg-emerald-500" />{t('admin:budgetMgmt.status.active')}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-50 text-slate-600 border border-slate-200">
              <span className="w-1 h-1 rounded-full bg-slate-400" />{t('admin:budgetMgmt.status.closed')}
            </span>
          )}
          {budget.alertLevel !== 'ok' && (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${alertCfg.bg} ${alertCfg.text} ${alertCfg.border}`}>
              {t(`admin:budgetMgmt.alert.${budget.alertLevel}`)}
            </span>
          )}
        </div>
      </div>

      {/* ═══ BENTO GRID ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

        {/* ── Card 1: Budget Overview (spans 2 cols on lg) ── */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#D4D4D8] p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-[#F97316]/10 rounded-lg flex items-center justify-center">
              <Wallet className="w-4 h-4 text-[#F97316]" />
            </div>
            <h3 className="text-sm font-bold text-[#0A0A0A]">{t('admin:budgetMgmt.detail.budgetOverview')}</h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <div>
              <p className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wide mb-0.5">{t('admin:budgetMgmt.detail.totalBudget')}</p>
              <p className="text-xl font-bold font-mono text-[#0A0A0A]">{fmtAmount(budget.totalBudget)}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wide mb-0.5">{t('admin:budgetMgmt.detail.totalConsumed')}</p>
              <p className={`text-xl font-bold font-mono ${budget.pct >= 90 ? 'text-red-600' : 'text-[#0A0A0A]'}`}>{fmtAmount(budget.consumed)}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wide mb-0.5">{t('admin:budgetMgmt.detail.remainingBudget')}</p>
              <p className={`text-xl font-bold font-mono ${budget.remaining < 0 ? 'text-red-600' : 'text-[#F97316]'}`}>{fmtAmount(budget.remaining)}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wide mb-0.5">{t('admin:budgetMgmt.detail.execution')}</p>
              <p className={`text-xl font-bold tabular-nums ${budget.pct >= 90 ? 'text-red-600' : budget.pct >= 70 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {budget.pct.toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Large progress bar */}
          <div className="relative h-3 bg-[#F0F2F5] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${getProgressColor(budget.pct)} ${budget.pct > 100 ? 'animate-pulse' : ''}`}
              style={{ width: `${cappedPct}%` }}
            />
          </div>
        </div>

        {/* ── Card 2: Cost Distribution (Donut) ── */}
        <div className="bg-white rounded-2xl border border-[#D4D4D8] p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
              <PieChart className="w-4 h-4 text-purple-600" />
            </div>
            <h3 className="text-sm font-bold text-[#0A0A0A]">{t('admin:budgetMgmt.detail.costDistribution')}</h3>
          </div>

          <div className="flex items-center gap-4">
            <MiniDonut segments={donutSegments} size={100} />
            <div className="flex-1 space-y-2">
              {donutSegments.map(seg => (
                <div key={seg.label} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: seg.color }} />
                  <span className="text-[11px] text-[#71717A] flex-1">{seg.label}</span>
                  <span className="text-[11px] font-bold tabular-nums text-[#0A0A0A]">{seg.pct.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Card 3: Labor Costs ── */}
        <div className="bg-white rounded-2xl border border-[#D4D4D8] p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-[#F97316]/10 rounded-lg flex items-center justify-center">
              <Users className="w-4 h-4 text-[#F97316]" />
            </div>
            <h3 className="text-sm font-bold text-[#0A0A0A]">{t('admin:budgetMgmt.detail.labor')}</h3>
          </div>
          <p className="text-2xl font-bold font-mono text-[#F97316] mb-1">{fmtAmount(detail.laborCost)}</p>
          <p className="text-[11px] text-[#71717A]">
            {budget.consumed > 0 ? `${((detail.laborCost / budget.consumed) * 100).toFixed(1)}% ${t('admin:budgetMgmt.detail.ofTotal')}` : '—'}
          </p>
          <div className="mt-3 h-1.5 bg-[#F0F2F5] rounded-full overflow-hidden">
            <div className="h-full bg-[#F97316] rounded-full transition-all" style={{ width: `${budget.consumed > 0 ? (detail.laborCost / budget.consumed) * 100 : 0}%` }} />
          </div>
        </div>

        {/* ── Card 4: Expense Breakdown ── */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#D4D4D8] p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
              <Receipt className="w-4 h-4 text-purple-600" />
            </div>
            <h3 className="text-sm font-bold text-[#0A0A0A]">{t('admin:budgetMgmt.detail.expenseBreakdown')}</h3>
            <span className="ml-auto text-sm font-bold font-mono text-purple-600">{fmtAmount(detail.expenseTotal)}</span>
          </div>

          {detail.expenseBreakdown.length === 0 ? (
            <div className="text-center py-6">
              <Receipt className="w-8 h-8 text-[#D4D4D8] mx-auto mb-2" />
              <p className="text-sm text-[#71717A]">{t('admin:budgetMgmt.detail.noExpenses')}</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {detail.expenseBreakdown.map(b => (
                <div key={b.type} className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: b.color }} />
                  <span className="text-xs text-[#0A0A0A] font-medium flex-1 min-w-0">{b.label}</span>
                  <div className="w-24 h-1.5 bg-[#F0F2F5] rounded-full overflow-hidden flex-shrink-0">
                    <div className="h-full rounded-full transition-all" style={{ width: `${b.pct}%`, backgroundColor: b.color }} />
                  </div>
                  <span className="text-xs font-mono font-semibold text-[#0A0A0A] w-20 text-right">{fmtAmount(b.amount)}</span>
                  <span className="text-[10px] text-[#71717A] w-10 text-right">{b.pct.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Card 5: Accounts Payable ── */}
        <div className="bg-white rounded-2xl border border-[#D4D4D8] p-5 max-h-[320px] flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
              <CreditCard className="w-4 h-4 text-amber-600" />
            </div>
            <h3 className="text-sm font-bold text-[#0A0A0A]">{t('admin:budgetMgmt.detail.payables')}</h3>
          </div>
          <p className="text-lg font-bold font-mono text-amber-600 mb-3">{fmtAmount(detail.payableTotal)}</p>

          {detail.payables.length === 0 ? (
            <div className="text-center py-4 flex-1 flex flex-col items-center justify-center">
              <CreditCard className="w-6 h-6 text-[#D4D4D8] mb-1.5" />
              <p className="text-[11px] text-[#71717A]">{t('admin:budgetMgmt.detail.noPayables')}</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {detail.payables.map((p, i) => (
                <div key={i} className="flex items-center justify-between gap-2 py-1.5 px-2 bg-[#F8F9FB] rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[#0A0A0A] truncate">{p.vendor}</p>
                    <span className={`text-[10px] font-semibold ${
                      p.status === 'paid' ? 'text-emerald-600' : p.status === 'overdue' ? 'text-red-600' : p.status === 'partial' ? 'text-blue-600' : 'text-amber-600'
                    }`}>{p.status}</span>
                  </div>
                  <div className="text-right">
                    {/* Original billed amount, so the reader sees the size of each invoice */}
                    <span className="text-xs font-mono font-semibold text-[#0A0A0A]">{fmtAmount(p.amount)}</span>
                    {p.paidAmount > 0 && (
                      <p className="text-[10px] text-emerald-600 font-mono">{fmtAmount(p.paidAmount)} paid</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════
// ══ Main Component ════════════════════════════════════
// ═══════════════════════════════════════════════════════

export function BudgetManagement() {
  const { t, i18n } = useTranslation(['admin', 'common']);

  // Data state
  const [budgets, setBudgets]           = useState<Budget[]>([]);
  const [allProjects, setAllProjects]   = useState<ProjectResponse[]>([]);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);

  // Selected project for detail
  const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);

  // Fetch projects from API
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const page = await listProjects({ size: 500 });
      setAllProjects(page.content);

      const mapped = page.content
        .filter((p: ProjectResponse) => p.originalContractCents != null)
        .map(mapProjectToBudget);

      setBudgets(mapped);
    } catch {
      toast.error(t('admin:budgetMgmt.loadError', 'Error loading budgets'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Derived KPIs
  const totalAssigned = useMemo(() => budgets.reduce((s, b) => s + b.totalBudget, 0), [budgets]);
  const totalConsumed = useMemo(() => budgets.reduce((s, b) => s + b.consumed,    0), [budgets]);
  const avgExecution  = useMemo(() =>
    totalAssigned > 0 ? (totalConsumed / totalAssigned) * 100 : 0,
    [totalConsumed, totalAssigned]
  );

  // Available projects for Create = projects without a contract amount
  const availableForCreate = useMemo(() =>
    allProjects
      .filter(p => p.originalContractCents == null && p.status !== 'CLOSED')
      .map(p => ({ id: p.id, name: p.name })),
    [allProjects]
  );

  // ── Modal: History ──
  const [historyTarget, setHistoryTarget]     = useState<Budget | null>(null);
  const [historyEntries, setHistoryEntries]   = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading]   = useState(false);

  async function openHistory(budget: Budget) {
    setHistoryTarget(budget);
    setHistoryLoading(true);
    try {
      const entries = await getContractHistory(budget.projectId);
      setHistoryEntries(entries.map(mapHistoryEntry));
    } catch {
      toast.error(t('admin:budgetMgmt.history.loadError', 'Error loading history'));
      setHistoryEntries([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  // ── Modal: Create ──
  const [showCreate,     setShowCreate]     = useState(false);
  const [createProject,  setCreateProject]  = useState('');
  const [createAmount,   setCreateAmount]   = useState('');
  const [createStart,    setCreateStart]    = useState('');
  const [createEnd,      setCreateEnd]      = useState('');
  const [createNotes,    setCreateNotes]    = useState('');
  const [createTouched,  setCreateTouched]  = useState(false);

  const createAmountNum   = parseFloat(createAmount);
  const createAmountValid = !isNaN(createAmountNum) && createAmountNum > 0;

  function openCreate() {
    setShowCreate(true);
    setCreateProject(''); setCreateAmount('');
    setCreateStart(''); setCreateEnd(''); setCreateNotes('');
    setCreateTouched(false);
  }

  async function handleCreate() {
    setCreateTouched(true);
    if (!createProject || !createAmountValid) return;

    const projectId = parseInt(createProject, 10);
    const amountCents = usdToCents(createAmountNum);

    setSaving(true);
    try {
      await updateProject(projectId, { contractAmountCents: amountCents });
      setShowCreate(false);
      toast.success(t('admin:budgetMgmt.toast.created', {
        project: allProjects.find(p => p.id === projectId)?.name ?? '',
        amount: fmtAmount(createAmountNum),
      }));
      await fetchData();
    } catch {
      toast.error(t('admin:budgetMgmt.toast.createError', 'Error creating budget'));
    } finally {
      setSaving(false);
    }
  }

  // ── Modal: Edit ──
  const [editTarget,        setEditTarget]        = useState<Budget | null>(null);
  const [editAmount,        setEditAmount]        = useState('');
  const [editStart,         setEditStart]         = useState('');
  const [editEnd,           setEditEnd]           = useState('');
  const [editNotes,         setEditNotes]         = useState('');
  const [editReason,        setEditReason]        = useState('');
  const [editReasonTouched, setEditReasonTouched] = useState(false);

  const editReasonValid = editReason.trim().length >= 10;
  const editAmountNum   = parseFloat(editAmount);
  const editAmountValid = !isNaN(editAmountNum) && editAmountNum > 0;

  function openEdit(budget: Budget) {
    setEditTarget(budget);
    setEditAmount(budget.totalBudget.toString());
    setEditStart(budget.startDate ?? '');
    setEditEnd(budget.endDate ?? '');
    setEditNotes(budget.notes ?? '');
    setEditReason('');
    setEditReasonTouched(false);
  }

  async function handleEditSave() {
    setEditReasonTouched(true);
    if (!editTarget || !editReasonValid || !editAmountValid) return;

    const newTotalCents     = usdToCents(editAmountNum);
    const consumedCents     = usdToCents(editTarget.consumed);
    const newRemainingCents = newTotalCents - consumedCents;

    if (newRemainingCents < 0) {
      toast.error(t('admin:budgetMgmt.toast.belowConsumed', 'New budget cannot be less than already consumed amount'));
      return;
    }

    setSaving(true);
    try {
      await updateProject(editTarget.projectId, { contractAmountCents: newRemainingCents });
      setEditTarget(null);
      toast.success(t('admin:budgetMgmt.toast.updated', { project: editTarget.project }));
      await fetchData();
    } catch {
      toast.error(t('admin:budgetMgmt.toast.updateError', 'Error updating budget'));
    } finally {
      setSaving(false);
    }
  }

  // ── Modal: Close ──
  const [closeTarget,        setCloseTarget]        = useState<Budget | null>(null);
  const [closeReason,        setCloseReason]        = useState('');
  const [closeReasonTouched, setCloseReasonTouched] = useState(false);

  const closeReasonValid = closeReason.trim().length >= 10;

  function openClose(budget: Budget) {
    setCloseTarget(budget);
    setCloseReason('');
    setCloseReasonTouched(false);
  }

  async function handleCloseConfirm() {
    setCloseReasonTouched(true);
    if (!closeTarget || !closeReasonValid) return;

    setSaving(true);
    try {
      await updateProject(closeTarget.projectId, { status: 'CLOSED' });
      setCloseTarget(null);
      toast.info(t('admin:budgetMgmt.toast.closed', { project: closeTarget.project }));
      await fetchData();
    } catch {
      toast.error(t('admin:budgetMgmt.toast.closeError', 'Error closing budget'));
    } finally {
      setSaving(false);
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-[#F97316]" />
      </div>
    );
  }

  // ═══ DETAIL VIEW ═══
  if (selectedBudget) {
    return (
      <div className="space-y-6 max-w-6xl">
        <ProjectDetail budget={selectedBudget} onBack={() => setSelectedBudget(null)} />

        {/* Modals still available from detail view */}
        {renderModals()}
      </div>
    );
  }

  // ═══ GRID VIEW (main) ═══
  function renderModals() {
    return (
      <>
        {/* MODAL 1 — Create Budget */}
        <Dialog open={showCreate} onOpenChange={open => { if (!open) setShowCreate(false); }}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-[#0A0A0A]">{t('admin:budgetMgmt.create.title')}</DialogTitle>
              <DialogDescription>{t('admin:budgetMgmt.create.description')}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-1">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[#0A0A0A]">{t('admin:budgetMgmt.create.project')} <span className="text-red-500">*</span></label>
                <Select value={createProject} onValueChange={setCreateProject}>
                  <SelectTrigger className={`border-[#D4D4D8] ${createTouched && !createProject ? 'border-red-400' : ''}`}>
                    <SelectValue placeholder={t('admin:budgetMgmt.create.selectProject')} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableForCreate.length === 0 && (
                      <SelectItem value="_none" disabled>{t('admin:budgetMgmt.create.noProjects')}</SelectItem>
                    )}
                    {availableForCreate.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {createTouched && !createProject && (
                  <p className="text-xs text-red-600">{t('admin:budgetMgmt.create.projectRequired')}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[#0A0A0A]">{t('admin:budgetMgmt.create.totalBudget')} <span className="text-red-500">*</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#71717A] font-medium pointer-events-none">$</span>
                  <Input type="number" min="0" step="100" value={createAmount} onChange={e => setCreateAmount(e.target.value)}
                    placeholder="0.00" className={`pl-7 border-[#D4D4D8] ${createTouched && !createAmountValid ? 'border-red-400' : ''}`} />
                </div>
                {createTouched && !createAmountValid && (
                  <p className="text-xs text-red-600">{t('admin:budgetMgmt.create.invalidAmount')}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-[#0A0A0A]">{t('admin:budgetMgmt.create.startDate')} <span className="text-[#71717A] font-normal">({t('admin:budgetMgmt.create.optional')})</span></label>
                  <input type="date" value={createStart} onChange={e => setCreateStart(e.target.value)}
                    className="w-full h-9 rounded-lg border border-[#D4D4D8] px-3 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#F97316]/25 focus:border-[#F97316]" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-[#0A0A0A]">{t('admin:budgetMgmt.create.endDate')} <span className="text-[#71717A] font-normal">({t('admin:budgetMgmt.create.optional')})</span></label>
                  <input type="date" value={createEnd} onChange={e => setCreateEnd(e.target.value)}
                    className="w-full h-9 rounded-lg border border-[#D4D4D8] px-3 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#F97316]/25 focus:border-[#F97316]" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[#0A0A0A]">{t('admin:budgetMgmt.create.notes')} <span className="text-[#71717A] font-normal">({t('admin:budgetMgmt.create.optional')})</span></label>
                <Textarea value={createNotes} onChange={e => setCreateNotes(e.target.value)}
                  maxLength={FIELD_LIMITS.LONG_TEXT}
                  placeholder={t('admin:budgetMgmt.create.notesPlaceholder')}
                  className="resize-none text-sm border-[#D4D4D8] min-h-[72px]" rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreate(false)} className="border-[#D4D4D8]">{t('common:buttons.cancel')}</Button>
              <Button onClick={handleCreate} disabled={saving} className="bg-[#F97316] hover:bg-[#C2410C] text-white gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {t('admin:budgetMgmt.create.submit')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* MODAL 2 — Edit Budget */}
        <Dialog open={editTarget !== null} onOpenChange={open => { if (!open) setEditTarget(null); }}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-[#0A0A0A]">{t('admin:budgetMgmt.edit.title', { project: editTarget?.project })}</DialogTitle>
              <DialogDescription>{t('admin:budgetMgmt.edit.description')}</DialogDescription>
            </DialogHeader>
            {editTarget && (
              <div className="space-y-4 py-1">
                <div className="bg-[#FAFAFA] rounded-xl border border-[#D4D4D8] p-4">
                  <p className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wide mb-3">{t('admin:budgetMgmt.edit.snapshot')}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      [t('admin:budgetMgmt.edit.snapshotTotal'),     fmtAmount(editTarget.totalBudget)],
                      [t('admin:budgetMgmt.edit.snapshotConsumed'),  fmtAmount(editTarget.consumed)],
                      [t('admin:budgetMgmt.edit.snapshotAvailable'), fmtAmount(editTarget.remaining)],
                      [t('admin:budgetMgmt.edit.snapshotExecution'), `${editTarget.pct.toFixed(1)}%`],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <p className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wide mb-0.5">{label}</p>
                        <p className="text-sm font-mono font-semibold text-[#0A0A0A]">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-[#0A0A0A]">{t('admin:budgetMgmt.edit.newBudget')} <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#71717A] font-medium pointer-events-none">$</span>
                    <Input type="number" min="0" step="100" value={editAmount} onChange={e => setEditAmount(e.target.value)}
                      className="pl-7 border-[#D4D4D8]" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-[#0A0A0A]">{t('admin:budgetMgmt.edit.startDate')}</label>
                    <input type="date" value={editStart} onChange={e => setEditStart(e.target.value)}
                      className="w-full h-9 rounded-lg border border-[#D4D4D8] px-3 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#F97316]/25 focus:border-[#F97316]" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-[#0A0A0A]">{t('admin:budgetMgmt.edit.endDate')}</label>
                    <input type="date" value={editEnd} onChange={e => setEditEnd(e.target.value)}
                      className="w-full h-9 rounded-lg border border-[#D4D4D8] px-3 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#F97316]/25 focus:border-[#F97316]" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-[#0A0A0A]">{t('admin:budgetMgmt.edit.notes')}</label>
                  <Textarea value={editNotes} onChange={e => setEditNotes(e.target.value)}
                    maxLength={FIELD_LIMITS.LONG_TEXT}
                    placeholder={t('admin:budgetMgmt.edit.notesPlaceholder')}
                    className="resize-none text-sm border-[#D4D4D8] min-h-[56px]" rows={2} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-[#0A0A0A]">
                    {t('admin:budgetMgmt.edit.reasonLabel')} <span className="text-red-500">*</span>
                  </label>
                  <Textarea value={editReason} onChange={e => setEditReason(e.target.value)}
                    onBlur={() => setEditReasonTouched(true)}
                    maxLength={FIELD_LIMITS.LONG_TEXT}
                    placeholder={t('admin:budgetMgmt.edit.reasonPlaceholder')}
                    className={`resize-none text-sm min-h-[80px] transition-colors ${editReasonTouched && !editReasonValid ? 'border-red-400' : 'border-[#D4D4D8]'}`}
                    rows={3} />
                  {editReasonTouched && !editReasonValid && (
                    <p className="flex items-center gap-1 text-xs text-red-600">
                      <AlertCircle className="w-3 h-3 flex-shrink-0" />
                      {t('admin:budgetMgmt.edit.reasonError', { count: editReason.trim().length })}
                    </p>
                  )}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditTarget(null)} className="border-[#D4D4D8]">{t('common:buttons.cancel')}</Button>
              <Button onClick={handleEditSave} disabled={(editReasonTouched && !editReasonValid) || saving}
                className="bg-[#F97316] hover:bg-[#C2410C] text-white gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
                {t('admin:budgetMgmt.edit.save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* MODAL 3 — Budget History */}
        <Dialog open={historyTarget !== null} onOpenChange={open => { if (!open) setHistoryTarget(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-[#0A0A0A]">{t('admin:budgetMgmt.history.title', { project: historyTarget?.project })}</DialogTitle>
              <DialogDescription>{t('admin:budgetMgmt.history.description')}</DialogDescription>
            </DialogHeader>
            {historyTarget && (
              historyLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-5 h-5 animate-spin text-[#F97316]" />
                </div>
              ) : historyEntries.length === 0 ? (
                <div className="py-8 text-center text-sm text-[#71717A]">
                  {t('admin:budgetMgmt.history.noEntries', 'No history entries found')}
                </div>
              ) : (
                <div className="max-h-[440px] overflow-y-auto space-y-3 pr-1">
                  {historyEntries.map(entry => (
                    <div key={entry.id} className="flex items-start gap-3 p-3 bg-[#FAFAFA] rounded-xl border border-[#D4D4D8]">
                      <div className="w-8 h-8 bg-[#C2410C] rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                        {entry.actor.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center flex-wrap gap-1.5 mb-1.5">
                          <span className="text-xs font-semibold text-[#0A0A0A]">{entry.actor}</span>
                          <HistoryTypeBadge type={entry.type} />
                          <span className="text-[11px] text-[#71717A] ml-auto flex-shrink-0">{fmtDate(entry.date, i18n.language)}</span>
                        </div>
                        {entry.type === 'Modified' && entry.previousBudget !== undefined && entry.newBudget !== undefined && (
                          <p className="text-xs text-[#71717A] mb-1">
                            {t('admin:budgetMgmt.history.previous')} <span className="font-mono font-semibold text-[#0A0A0A]">{fmtAmount(entry.previousBudget)}</span>
                            {' '}→ {t('admin:budgetMgmt.history.new')} <span className="font-mono font-semibold text-[#0A0A0A]">{fmtAmount(entry.newBudget)}</span>
                          </p>
                        )}
                        {entry.type === 'Created' && entry.newBudget !== undefined && (
                          <p className="text-xs text-[#71717A] mb-1">
                            {t('admin:budgetMgmt.history.initial')} <span className="font-mono font-semibold text-[#0A0A0A]">{fmtAmount(entry.newBudget)}</span>
                          </p>
                        )}
                        {entry.type === 'Deduction' && entry.newBudget !== undefined && (
                          <p className="text-xs text-[#71717A] mb-1">
                            {t('admin:budgetMgmt.history.balanceAfter', 'Balance after')}: <span className="font-mono font-semibold text-[#0A0A0A]">{fmtAmount(entry.newBudget)}</span>
                          </p>
                        )}
                        <p className="text-[11px] text-[#71717A] italic">&quot;{entry.reason}&quot;</p>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setHistoryTarget(null)} className="border-[#D4D4D8]">{t('common:buttons.close')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* MODAL 4 — Close Budget */}
        <AlertDialog open={closeTarget !== null} onOpenChange={open => { if (!open) setCloseTarget(null); }}>
          <AlertDialogContent className="sm:max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-[#0A0A0A]">
                {t('admin:budgetMgmt.close.title', { project: closeTarget?.project })}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t('admin:budgetMgmt.close.description')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {closeTarget && (
              <div className="space-y-4 py-1">
                <div className="bg-[#FAFAFA] rounded-xl border border-[#D4D4D8] p-4">
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    {[
                      [t('admin:budgetMgmt.close.summaryTotal'),     fmtAmount(closeTarget.totalBudget)],
                      [t('admin:budgetMgmt.close.summaryConsumed'),  fmtAmount(closeTarget.consumed)],
                      [t('admin:budgetMgmt.close.summaryAvailable'), fmtAmount(closeTarget.remaining)],
                      [t('admin:budgetMgmt.close.summaryExecution'), `${closeTarget.pct.toFixed(1)}%`],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <p className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wide mb-0.5">{label}</p>
                        <p className="text-sm font-mono font-semibold text-[#0A0A0A]">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-[#0A0A0A]">
                    {t('admin:budgetMgmt.close.reasonLabel')} <span className="text-red-500">*</span>
                  </label>
                  <Textarea value={closeReason} onChange={e => setCloseReason(e.target.value)}
                    onBlur={() => setCloseReasonTouched(true)}
                    maxLength={FIELD_LIMITS.LONG_TEXT}
                    placeholder={t('admin:budgetMgmt.close.reasonPlaceholder')}
                    className={`resize-none text-sm min-h-[80px] transition-colors ${closeReasonTouched && !closeReasonValid ? 'border-red-400' : 'border-[#D4D4D8]'}`}
                    rows={3} />
                  {closeReasonTouched && !closeReasonValid && (
                    <p className="flex items-center gap-1 text-xs text-red-600">
                      <AlertCircle className="w-3 h-3 flex-shrink-0" />
                      {t('admin:budgetMgmt.close.reasonError', { count: closeReason.trim().length })}
                    </p>
                  )}
                </div>
              </div>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel className="border-[#D4D4D8]">{t('common:buttons.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={e => { e.preventDefault(); handleCloseConfirm(); }}
                className={`text-white gap-2 ${
                  (closeReasonTouched && !closeReasonValid) || saving
                    ? 'bg-red-300 pointer-events-none'
                    : 'bg-[#d4183d] hover:bg-red-700'
                }`}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                {t('admin:budgetMgmt.menu.close')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-[#0A0A0A]">{t('admin:budgetMgmt.title')}</h2>
          <p className="text-[11px] text-[#71717A] mt-0.5">{t('admin:budgetMgmt.subtitle')}</p>
        </div>
{/* Create budget button removed */}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Wallet}      title={t('admin:budgetMgmt.kpi.totalBudgets')}   value={budgets.length.toString()}        subtitle={t('admin:budgetMgmt.kpi.allProjects')}        iconBgColor="bg-[#F97316]/10"  iconColor="text-[#F97316]"   />
        <StatCard icon={DollarSign}  title={t('admin:budgetMgmt.kpi.totalAssigned')}  value={fmtAmount(totalAssigned)}         subtitle={t('admin:budgetMgmt.kpi.budgetAllocated')}    iconBgColor="bg-emerald-50"    iconColor="text-emerald-600" />
        <StatCard icon={TrendingDown}title={t('admin:budgetMgmt.kpi.totalConsumed')}  value={fmtAmount(totalConsumed)}         subtitle={t('admin:budgetMgmt.kpi.approvedExpenses')}   iconBgColor="bg-amber-50"      iconColor="text-amber-600"   />
        <StatCard icon={Percent}     title={t('admin:budgetMgmt.kpi.avgExecution')}   value={`${avgExecution.toFixed(1)}%`}    subtitle={t('admin:budgetMgmt.kpi.acrossBudgets')}  iconBgColor="bg-[#C2410C]/10"  iconColor="text-[#C2410C]"   />
      </div>

      {/* Bento Grid of project cards */}
      {budgets.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#D4D4D8] flex flex-col items-center justify-center py-16 text-center px-4">
          <div className="w-14 h-14 bg-[#FAFAFA] rounded-full flex items-center justify-center mb-3">
            <Wallet className="w-7 h-7 text-[#D4D4D8]" />
          </div>
          <p className="text-sm font-semibold text-[#0A0A0A] mb-1">{t('admin:budgetMgmt.noBudgets', 'No budgets assigned yet')}</p>
          <p className="text-xs text-[#71717A]">{t('admin:budgetMgmt.noBudgetsHint', 'Assign a budget to a project to get started')}</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="w-4 h-4 text-[#71717A]" />
            <span className="text-sm font-semibold text-[#0A0A0A]">{t('admin:budgetMgmt.overview')}</span>
            <span className="ml-1 text-xs text-[#71717A]">· {t('admin:budgetMgmt.projectCount', { count: budgets.length })}</span>
            <span className="ml-2 text-[11px] text-[#71717A]">{t('admin:budgetMgmt.card.clickHint')}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {budgets.map(budget => (
              <BudgetCard
                key={budget.id}
                budget={budget}
                onSelect={() => setSelectedBudget(budget)}
                onEdit={() => openEdit(budget)}
                onHistory={() => openHistory(budget)}
                onClose={() => openClose(budget)}
              />
            ))}
          </div>
        </>
      )}

      {renderModals()}
    </div>
  );
}
