import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Wallet, DollarSign, TrendingDown, AlertTriangle,
  AlertCircle, XCircle, CheckCircle,
  ChevronDown, ChevronRight, Filter as FilterIcon,
  Loader2,
} from 'lucide-react';
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
  listFinanceProjects, getFinanceContractHistory,
  type ProjectResponse, type ContractHistoryEntry,
} from '../services/projects';
import { getFinanceExpenseReport, type ProjectExpenseRow } from '../services/expenses';

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

interface TypeBreakdown {
  label: string;
  amount: number;
  pct: number;
}

interface FinanceBudgetRow {
  id: string;
  projectId: number;
  project: string;
  totalBudget: number;
  consumed: number;
  status: BudgetStatus;
  startDate?: string;
  endDate?: string;
  notes?: string;
  history: HistoryEntry[];
  breakdown: TypeBreakdown[];
}

// Helpers

function centsToUsd(cents: number | null | undefined): number {
  return (cents ?? 0) / 100;
}

function formatExpenseType(type: string): string {
  return type
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function fmtAmount(n: number): string {
  if (n < 0) return `-$${Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  return `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

function fmtDate(iso: string, locale: string = 'en-US'): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(locale, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function getPct(consumed: number, total: number): number {
  if (total === 0) return 0;
  return (consumed / total) * 100;
}

function getProgressColor(pct: number): string {
  if (pct > 100) return 'bg-red-600';
  if (pct >= 90)  return 'bg-red-500';
  if (pct >= 70)  return 'bg-amber-500';
  return 'bg-emerald-500';
}

function getPctColor(pct: number): string {
  if (pct > 100) return 'text-red-700 font-bold';
  if (pct >= 90)  return 'text-red-600 font-semibold';
  if (pct >= 70)  return 'text-amber-600 font-semibold';
  return 'text-emerald-600 font-semibold';
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

const ITEMS_PER_PAGE = 5;

// Sub-components

function ProgressCell({ consumed, total }: { consumed: number; total: number }) {
  const pct    = getPct(consumed, total);
  const capped = Math.min(pct, 100);
  return (
    <div className="flex items-center gap-2 min-w-[110px]">
      <div className="flex-1 h-1.5 bg-[#FAFAFA] rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${getProgressColor(pct)}`}
          style={{ width: `${capped}%` }} />
      </div>
      <span className={`text-xs tabular-nums flex-shrink-0 ${getPctColor(pct)}`}>
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}

function AlertCell({ pct }: { pct: number }) {
  const { t } = useTranslation(['common']);
  if (pct > 100) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 animate-pulse">
        <XCircle className="w-3 h-3" />{t('common:alerts.exceeded')}
      </span>
    );
  }
  if (pct >= 90) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200">
        <AlertCircle className="w-3 h-3" />{t('common:alerts.critical')}
      </span>
    );
  }
  if (pct >= 70) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
        <AlertTriangle className="w-3 h-3" />{t('common:alerts.warning')}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600">
      <CheckCircle className="w-3 h-3" />{t('common:alerts.ok')}
    </span>
  );
}

function StatusBadge({ status }: { status: BudgetStatus }) {
  const { t } = useTranslation(['common']);
  if (status === 'Active') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200 whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />{t('common:status.active')}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border bg-slate-50 text-slate-600 border-slate-200 whitespace-nowrap">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 flex-shrink-0" />{t('common:status.closed')}
    </span>
  );
}

function HistoryMiniEntry({ entry }: { entry: HistoryEntry }) {
  const typeCfg: Record<HistoryType, { bg: string; text: string; border: string }> = {
    Created:   { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    Modified:  { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200'   },
    Closed:    { bg: 'bg-slate-50',   text: 'text-slate-600',   border: 'border-slate-200'   },
    Deduction: { bg: 'bg-red-50',     text: 'text-red-600',     border: 'border-red-200'     },
  };
  const cfg = typeCfg[entry.type];
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-[#D4D4D8]/40 last:border-0">
      <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
        {entry.type}
      </span>
      <span className="text-[11px] text-[#71717A] flex-shrink-0">{fmtDate(entry.date)}</span>
      <span className="text-[11px] text-[#71717A] flex-shrink-0">· {entry.actor}</span>
      {entry.type === 'Modified' && entry.previousBudget !== undefined && entry.newBudget !== undefined && (
        <span className="text-[11px] font-mono text-[#0A0A0A] flex-shrink-0">
          {fmtAmount(entry.previousBudget)} → {fmtAmount(entry.newBudget)}
        </span>
      )}
      {entry.type === 'Created' && entry.newBudget !== undefined && (
        <span className="text-[11px] font-mono text-[#0A0A0A] flex-shrink-0">{fmtAmount(entry.newBudget)}</span>
      )}
      <span className="text-[11px] text-[#71717A] italic min-w-0 truncate">"{entry.reason}"</span>
    </div>
  );
}

function Pagination({ current, total, onPage }: { current: number; total: number; onPage: (p: number) => void }) {
  const { t } = useTranslation(['common']);
  if (total <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-1 py-4 border-t border-[#D4D4D8]">
      <button onClick={() => onPage(current - 1)} disabled={current === 1}
        className="h-8 px-3 rounded-lg text-xs font-medium text-[#71717A] hover:text-purple-600 hover:bg-purple-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
        {t('common:buttons.prev')}
      </button>
      {Array.from({ length: total }, (_, i) => i + 1).map(p => (
        <button key={p} onClick={() => onPage(p)}
          className={`h-8 w-8 rounded-lg text-xs font-semibold transition-colors ${
            p === current ? 'bg-purple-600 text-white' : 'text-[#71717A] hover:bg-purple-50 hover:text-purple-600'
          }`}>
          {p}
        </button>
      ))}
      <button onClick={() => onPage(current + 1)} disabled={current === total}
        className="h-8 px-3 rounded-lg text-xs font-medium text-[#71717A] hover:text-purple-600 hover:bg-purple-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
        {t('common:buttons.next')}
      </button>
    </div>
  );
}

// Main component

export function FinanceBudgets() {
  const { t, i18n } = useTranslation(['finance', 'common']);
  const dateLoc = i18n.language === 'es' ? 'es' : 'en-US';

  // Data state
  const [budgetRows, setBudgetRows]   = useState<FinanceBudgetRow[]>([]);
  const [loading, setLoading]         = useState(true);

  // Filter state
  const [projectFilter,  setProjectFilter]  = useState('all');
  const [statusFilter,   setStatusFilter]   = useState('all');
  const [alertFilter,    setAlertFilter]    = useState('all');
  const [appliedProject, setAppliedProject] = useState('all');
  const [appliedStatus,  setAppliedStatus]  = useState('all');
  const [appliedAlert,   setAppliedAlert]   = useState('all');

  // UI state
  const [expandedId,   setExpandedId]   = useState<string | null>(null);
  const [currentPage,  setCurrentPage]  = useState(1);

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [projectsPage, expenseReport] = await Promise.all([
        listFinanceProjects({ size: 500 }),
        getFinanceExpenseReport(),
      ]);

      // Build expense-by-project lookup
      const expenseByProject = new Map<number, ProjectExpenseRow>();
      expenseReport.byProject.forEach(row => expenseByProject.set(row.projectId, row));

      // Map projects with budgets
      const rows: FinanceBudgetRow[] = projectsPage.content
        .filter((p: ProjectResponse) => p.originalContractCents != null)
        .map((p: ProjectResponse) => {
          const totalBudget = centsToUsd(p.revisedContractCents ?? p.originalContractCents ?? 0);
          const consumed    = centsToUsd(p.totalConsumedCents ?? 0);

          // Get breakdown from expense report
          const expRow = expenseByProject.get(p.id);
          const breakdown: TypeBreakdown[] = (expRow?.breakdown ?? []).map(b => {
            const amount = b.totalCents / 100;
            const bPct   = consumed > 0 ? (amount / consumed) * 100 : 0;
            return {
              label:  formatExpenseType(b.type),
              amount,
              pct:    Math.round(bPct * 10) / 10,
            };
          });

          return {
            id:          String(p.id),
            projectId:   p.id,
            project:     p.name,
            totalBudget,
            consumed,
            status:      (p.status === 'CLOSED' ? 'Closed' : 'Active') as BudgetStatus,
            startDate:   p.createdAt.split('T')[0],
            history:     [],
            breakdown,
          };
        });

      setBudgetRows(rows);
    } catch {
      toast.error(t('finance:budget.errorLoading'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Load history when expanding a row
  async function handleExpand(row: FinanceBudgetRow) {
    if (expandedId === row.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(row.id);

    // Fetch contract history if not already loaded
    if (row.history.length === 0) {
      try {
        const entries = await getFinanceContractHistory(row.projectId);
        const mapped = entries.map(mapHistoryEntry);
        setBudgetRows(prev => prev.map(r =>
          r.id === row.id ? { ...r, history: mapped } : r
        ));
      } catch {
        // Silently ignore — history section will show empty
      }
    }
  }

  const allProjectNames = useMemo(() => budgetRows.map(r => r.project), [budgetRows]);

  // Filtered + paginated data
  const filteredRows = useMemo(() => {
    return budgetRows.filter(row => {
      if (appliedProject !== 'all' && row.project !== appliedProject) return false;
      if (appliedStatus  !== 'all' && row.status  !== appliedStatus)  return false;
      if (appliedAlert   !== 'all') {
        const pct = getPct(row.consumed, row.totalBudget);
        if (appliedAlert === 'normal'   && pct >= 70) return false;
        if (appliedAlert === 'warning'  && (pct < 70 || pct >= 90)) return false;
        if (appliedAlert === 'critical' && pct < 90) return false;
      }
      return true;
    });
  }, [appliedProject, appliedStatus, appliedAlert, budgetRows]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / ITEMS_PER_PAGE));
  const pageRows   = filteredRows.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  function handleApply() {
    setAppliedProject(projectFilter);
    setAppliedStatus(statusFilter);
    setAppliedAlert(alertFilter);
    setCurrentPage(1);
    setExpandedId(null);
  }

  function handleReset() {
    setProjectFilter('all'); setStatusFilter('all'); setAlertFilter('all');
    setAppliedProject('all'); setAppliedStatus('all'); setAppliedAlert('all');
    setCurrentPage(1); setExpandedId(null);
  }

  // KPI totals
  const totalAssigned  = useMemo(() => budgetRows.reduce((s, r) => s + r.totalBudget, 0), [budgetRows]);
  const totalConsumed  = useMemo(() => budgetRows.reduce((s, r) => s + r.consumed, 0), [budgetRows]);
  const projectsAtRisk = budgetRows.filter(r => getPct(r.consumed, r.totalBudget) >= 70).length;

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
      </div>
    );
  }

  // Render
  return (
    <div className="space-y-6 max-w-6xl">

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-sm font-semibold text-[#0A0A0A]">{t('finance:budget.title')}</h2>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-600 border border-purple-200">
            {t('finance:budget.viewOnly')}
          </span>
        </div>
        <p className="text-[11px] text-[#71717A] mt-0.5">{t('finance:budget.viewDescription')}</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Wallet}       title={t('finance:budget.kpi.totalBudgets')}   value={budgetRows.length.toString()} subtitle={t('finance:budget.kpi.allProjects')}      iconBgColor="bg-purple-50"  iconColor="text-purple-600"  />
        <StatCard icon={DollarSign}   title={t('finance:budget.kpi.totalAssigned')}  value={fmtAmount(totalAssigned)}     subtitle={t('finance:budget.kpi.budgetAllocated')}  iconBgColor="bg-emerald-50" iconColor="text-emerald-600" />
        <StatCard icon={TrendingDown} title={t('finance:budget.kpi.totalConsumed')}  value={fmtAmount(totalConsumed)}     subtitle={t('finance:budget.kpi.approvedExpenses')} iconBgColor="bg-amber-50"   iconColor="text-amber-600"   />
        <StatCard icon={AlertTriangle}title={t('finance:budget.kpi.projectsAtRisk')} value={projectsAtRisk.toString()}    subtitle={t('finance:budget.kpi.gte70Consumed')}    iconBgColor="bg-red-50"     iconColor="text-red-600"     />
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] p-5">
        <div className="flex items-center gap-2 mb-4">
          <FilterIcon className="w-4 h-4 text-[#71717A]" />
          <span className="text-sm font-semibold text-[#0A0A0A]">{t('common:buttons.filters')}</span>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5 min-w-[160px]">
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('common:labels.project')}</label>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="h-9 border-[#D4D4D8] text-sm"><SelectValue placeholder={t('common:labels.allProjects')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common:labels.allProjects')}</SelectItem>
                {allProjectNames.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5 min-w-[130px]">
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('common:labels.status')}</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 border-[#D4D4D8] text-sm"><SelectValue placeholder={t('common:labels.all')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common:labels.all')}</SelectItem>
                <SelectItem value="Active">{t('common:status.active')}</SelectItem>
                <SelectItem value="Closed">{t('common:status.closed')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5 min-w-[165px]">
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('finance:budget.filterAlertLevel')}</label>
            <Select value={alertFilter} onValueChange={setAlertFilter}>
              <SelectTrigger className="h-9 border-[#D4D4D8] text-sm"><SelectValue placeholder={t('common:labels.all')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common:labels.all')}</SelectItem>
                <SelectItem value="normal">{t('finance:budget.filterNormal')}</SelectItem>
                <SelectItem value="warning">{t('finance:budget.filterWarning')}</SelectItem>
                <SelectItem value="critical">{t('finance:budget.filterCritical')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleReset}
              className="h-9 px-4 text-xs border-[#D4D4D8] text-[#71717A] hover:text-[#0A0A0A]">
              {t('common:buttons.reset')}
            </Button>
            <Button size="sm" onClick={handleApply}
              className="h-9 px-4 text-xs bg-purple-600 hover:bg-purple-800 text-white">
              {t('common:buttons.apply')}
            </Button>
          </div>
        </div>
      </div>

      {/* Table card */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-[#D4D4D8]">
          <Wallet className="w-4 h-4 text-[#71717A]" />
          <span className="text-sm font-semibold text-[#0A0A0A]">{t('finance:budget.budgetOverview')}</span>
          <span className="ml-1 text-xs text-[#71717A]">· {filteredRows.length} of {budgetRows.length} project{budgetRows.length !== 1 ? 's' : ''}</span>
          <span className="hidden sm:inline text-[11px] text-[#71717A] ml-1">— {t('finance:budget.clickToExpand')}</span>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#FAFAFA] hover:bg-[#FAFAFA]">
                <TableHead className="w-8" />
                {[
                  t('finance:budget.table.project'),
                  t('finance:budget.table.totalBudget'),
                  t('finance:budget.table.consumed'),
                  t('finance:budget.table.available'),
                  t('finance:budget.table.execution'),
                  t('finance:budget.table.status'),
                  t('finance:budget.table.alert'),
                ].map(h => (
                  <TableHead key={h} className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider whitespace-nowrap">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.flatMap(row => {
                const pct        = getPct(row.consumed, row.totalBudget);
                const available  = row.totalBudget - row.consumed;
                const isExpanded = expandedId === row.id;

                const mainRow = (
                  <TableRow key={`${row.id}-main`}
                    onClick={() => handleExpand(row)}
                    className={`cursor-pointer border-b border-[#D4D4D8]/50 transition-colors ${isExpanded ? 'bg-purple-50/30' : 'hover:bg-[#FAFAFA]/50'}`}>
                    <TableCell className="py-3 pr-0 pl-4 text-[#71717A]">
                      {isExpanded
                        ? <ChevronDown className="w-3.5 h-3.5 text-purple-500" />
                        : <ChevronRight className="w-3.5 h-3.5" />}
                    </TableCell>
                    <TableCell className="py-3">
                      <div>
                        <p className="text-sm font-semibold text-[#0A0A0A]">{row.project}</p>
                        {row.startDate && (
                          <p className="text-[11px] text-[#71717A] mt-0.5">
                            {fmtDate(row.startDate, dateLoc)}{row.endDate ? ` → ${fmtDate(row.endDate, dateLoc)}` : ''}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <span className="font-mono font-semibold text-sm text-[#0A0A0A]">{fmtAmount(row.totalBudget)}</span>
                    </TableCell>
                    <TableCell className="py-3">
                      <span className={`font-mono text-sm font-semibold ${pct >= 90 ? 'text-red-600' : pct >= 70 ? 'text-amber-600' : 'text-[#0A0A0A]'}`}>
                        {fmtAmount(row.consumed)}
                      </span>
                    </TableCell>
                    <TableCell className="py-3">
                      <span className={`font-mono text-sm font-semibold ${available < 0 ? 'text-red-700' : 'text-[#0A0A0A]'}`}>
                        {fmtAmount(available)}
                      </span>
                    </TableCell>
                    <TableCell className="py-3 min-w-[130px]">
                      <ProgressCell consumed={row.consumed} total={row.totalBudget} />
                    </TableCell>
                    <TableCell className="py-3"><StatusBadge status={row.status} /></TableCell>
                    <TableCell className="py-3"><AlertCell pct={pct} /></TableCell>
                  </TableRow>
                );

                if (!isExpanded) return [mainRow];

                const expandedRow = (
                  <TableRow key={`${row.id}-exp`} className="bg-[#FAFAFA]/40 hover:bg-[#FAFAFA]/40">
                    <TableCell colSpan={8} className="px-6 py-5 border-b border-[#D4D4D8]/50">
                      <div className="space-y-5">

                        {/* Project details */}
                        <div>
                          <p className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-2">{t('finance:budget.projectDetails')}</p>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {[
                              [t('finance:budget.dialog.startDate'),  row.startDate ? fmtDate(row.startDate, dateLoc) : '—'],
                              [t('finance:budget.dialog.endDate'),    row.endDate   ? fmtDate(row.endDate, dateLoc)   : '—'],
                              [t('common:labels.status'),             row.status],
                              [t('common:labels.notes'),              row.notes || '—'],
                            ].map(([label, value]) => (
                              <div key={label}>
                                <p className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wide mb-0.5">{label}</p>
                                <p className="text-xs text-[#0A0A0A] leading-relaxed">{value}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Budget History (last 3) */}
                        <div>
                          <p className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-2">
                            {t('finance:budget.budgetHistory')} <span className="font-normal lowercase">
                              {row.history.length > 0 ? `(${t('finance:budget.lastEntries', { count: Math.min(row.history.length, 3) })})` : `(${t('finance:budget.loadingHistory')})`}
                            </span>
                          </p>
                          {row.history.length > 0 ? (
                            <div className="bg-white rounded-xl border border-[#D4D4D8] px-4 py-2">
                              {row.history.slice(0, 3).map(entry => (
                                <HistoryMiniEntry key={entry.id} entry={entry} />
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-[#71717A]">{t('finance:budget.noHistory')}</p>
                          )}
                        </div>

                        {/* Expense breakdown */}
                        {row.breakdown.length > 0 && (
                          <div>
                            <p className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-2">{t('finance:budget.expenseBreakdown')}</p>
                            <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
                              <Table>
                                <TableHeader>
                                  <TableRow className="bg-[#FAFAFA] hover:bg-[#FAFAFA]">
                                    {[
                                      t('finance:budget.breakdownTable.type'),
                                      t('finance:budget.breakdownTable.amount'),
                                      t('finance:budget.breakdownTable.share'),
                                      t('finance:budget.breakdownTable.progress'),
                                    ].map(h => (
                                      <TableHead key={h} className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider py-2">{h}</TableHead>
                                    ))}
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {row.breakdown.map(b => (
                                    <TableRow key={b.label} className="border-b border-[#D4D4D8]/50 last:border-0 hover:bg-[#FAFAFA]/50">
                                      <TableCell className="py-2 text-sm text-[#0A0A0A] font-medium">{b.label}</TableCell>
                                      <TableCell className="py-2 font-mono text-sm font-semibold text-[#0A0A0A]">{fmtAmount(b.amount)}</TableCell>
                                      <TableCell className="py-2 text-sm text-[#71717A]">{b.pct.toFixed(1)}%</TableCell>
                                      <TableCell className="py-2 min-w-[100px]">
                                        <div className="h-1.5 bg-[#FAFAFA] rounded-full overflow-hidden">
                                          <div className="h-full bg-purple-400 rounded-full" style={{ width: `${b.pct}%` }} />
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        )}
                        {row.breakdown.length === 0 && (
                          <div>
                            <p className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-2">{t('finance:budget.expenseBreakdown')}</p>
                            <p className="text-sm text-[#71717A]">{t('finance:budget.noExpensesForProject')}</p>
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );

                return [mainRow, expandedRow];
              })}
            </TableBody>
          </Table>
          {filteredRows.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 bg-[#FAFAFA] rounded-full flex items-center justify-center mb-3">
                <Wallet className="w-7 h-7 text-[#D4D4D8]" />
              </div>
              <p className="text-sm font-semibold text-[#0A0A0A] mb-1">{t('finance:budget.noBudgets')}</p>
              <p className="text-xs text-[#71717A]">{t('finance:budget.noBudgetsHint')}</p>
            </div>
          )}
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-[#D4D4D8]">
          {pageRows.map(row => {
            const pct        = getPct(row.consumed, row.totalBudget);
            const available  = row.totalBudget - row.consumed;
            const isExpanded = expandedId === row.id;
            return (
              <div key={row.id} className="p-4 space-y-3">
                <button
                  onClick={() => handleExpand(row)}
                  className="w-full flex items-start justify-between gap-2 text-left"
                >
                  <div>
                    <p className="text-sm font-semibold text-[#0A0A0A]">{row.project}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <StatusBadge status={row.status} />
                      <AlertCell pct={pct} />
                    </div>
                  </div>
                  {isExpanded
                    ? <ChevronDown className="w-4 h-4 text-purple-500 flex-shrink-0 mt-0.5" />
                    : <ChevronRight className="w-4 h-4 text-[#71717A] flex-shrink-0 mt-0.5" />}
                </button>
                <ProgressCell consumed={row.consumed} total={row.totalBudget} />
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    [t('finance:budget.mobileTotal'),     `$${(row.totalBudget / 1000).toFixed(0)}k`],
                    [t('finance:budget.mobileConsumed'),  `$${(row.consumed / 1000).toFixed(0)}k`],
                    [t('finance:budget.mobileAvailable'), `$${(Math.max(available, 0) / 1000).toFixed(0)}k`],
                  ].map(([label, val]) => (
                    <div key={label} className="bg-[#FAFAFA] rounded-lg p-2">
                      <p className="text-[10px] text-[#71717A] uppercase tracking-wide">{label}</p>
                      <p className="text-xs font-mono font-semibold text-[#0A0A0A]">{val}</p>
                    </div>
                  ))}
                </div>
                {/* Mobile expanded content */}
                {isExpanded && row.breakdown.length > 0 && (
                  <div className="pt-2 space-y-2">
                    <p className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('finance:budget.breakdown')}</p>
                    {row.breakdown.map(b => (
                      <div key={b.label} className="flex items-center gap-2">
                        <span className="text-xs text-[#0A0A0A] w-24 flex-shrink-0">{b.label}</span>
                        <div className="flex-1 h-1.5 bg-[#FAFAFA] rounded-full overflow-hidden">
                          <div className="h-full bg-purple-400 rounded-full" style={{ width: `${b.pct}%` }} />
                        </div>
                        <span className="text-[11px] text-[#71717A] flex-shrink-0">{b.pct.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <Pagination current={currentPage} total={totalPages} onPage={p => { setCurrentPage(p); setExpandedId(null); }} />
      </div>
    </div>
  );
}
