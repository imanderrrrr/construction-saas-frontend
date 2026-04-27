import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Wallet, TrendingDown, TrendingUp, AlertCircle,
  AlertTriangle, CheckCircle, ChevronDown, ChevronRight,
  FileText, FileSpreadsheet, Download, Filter as FilterIcon,
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
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { listProjects, listFinanceProjects, type ProjectResponse } from '../services/projects';
import { getExpenseReport, getFinanceExpenseReport, type ProjectExpenseRow } from '../services/expenses';
import { exportBudgetExcel, exportBudgetPdf, type BudgetExportRow, type AlertExportRow } from '../helpers/exportBudgetReport';

// Types

type AlertLevel  = 'ok' | 'warning' | 'critical';
type BudgetStatus = 'Active' | 'Closed';

interface ProjectReportRow {
  id: string;
  project: string;
  totalBudget: number;
  consumed: number;
  status: BudgetStatus;
  deviation: DeviationKey;
  deviationPct: number;
  breakdown: TypeBreakdown[];
  createdAt: string;
}

type DeviationKey = 'on-track' | 'moderate-over' | 'severe-over' | 'under';

interface TypeBreakdown {
  type: string;
  label: string;
  amount: number;
  pct: number;
}

interface AlertRow {
  project: string;
  pct: number;
  level: AlertLevel;
  remaining: number;
  estimatedDays: number | null;   // null = cannot compute
}

// Helpers

function formatExpenseType(type: string): string {
  return type
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

// Deviation config

const DEVIATION_CFG: Record<DeviationKey, { labelKey: string; textColor: string; bg: string; border: string }> = {
  'on-track':      { labelKey: 'budgetReport.deviation.onTrack',      textColor: 'text-emerald-700', bg: 'bg-emerald-50',   border: 'border-emerald-200'  },
  'moderate-over': { labelKey: 'budgetReport.deviation.moderateOver', textColor: 'text-amber-700',   bg: 'bg-amber-50',     border: 'border-amber-200'    },
  'severe-over':   { labelKey: 'budgetReport.deviation.severeOver',   textColor: 'text-red-700',     bg: 'bg-red-50',       border: 'border-red-200'      },
  'under':         { labelKey: 'budgetReport.deviation.under',        textColor: 'text-[#F97316]',   bg: 'bg-[#F97316]/10', border: 'border-[#F97316]/20' },
};

// Helpers

function fmtAmount(n: number): string {
  return `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

function getPct(consumed: number, total: number): number {
  if (total === 0) return 0;
  return (consumed / total) * 100;
}

function getAlertLevel(pct: number): AlertLevel {
  if (pct >= 90) return 'critical';
  if (pct >= 70) return 'warning';
  return 'ok';
}

function getProgressColor(pct: number): string {
  if (pct >= 90) return 'bg-red-500';
  if (pct >= 70) return 'bg-amber-500';
  return 'bg-emerald-500';
}

function getPctColor(pct: number): string {
  if (pct >= 90) return 'text-red-600 font-semibold';
  if (pct >= 70) return 'text-amber-600 font-semibold';
  return 'text-emerald-600 font-semibold';
}

function computeDeviation(pct: number, consumed: number): DeviationKey {
  if (pct > 100) return 'severe-over';
  if (pct >= 85) return 'moderate-over';
  if (pct < 50 && consumed > 0) return 'under';
  return 'on-track';
}

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

function DeviationBadge({ deviationKey, pct }: { deviationKey: DeviationKey; pct: number }) {
  const { t } = useTranslation('admin');
  const cfg = DEVIATION_CFG[deviationKey];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap ${cfg.bg} ${cfg.textColor} ${cfg.border}`}>
      {t(cfg.labelKey, { pct })}
    </span>
  );
}

function AlertLevelBadge({ level, pct }: { level: AlertLevel; pct: number }) {
  const { t } = useTranslation('admin');
  if (level === 'critical') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200 whitespace-nowrap">
        <AlertCircle className="w-3 h-3" />{t('budgetReport.alert.critical')}
      </span>
    );
  }
  if (level === 'warning') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
        <AlertTriangle className="w-3 h-3" />{t('budgetReport.alert.warning')}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600">
      <CheckCircle className="w-3 h-3" />{t('budgetReport.alert.normal')}
    </span>
  );
}

function StatusBadge({ status }: { status: BudgetStatus }) {
  const { t } = useTranslation('admin');
  if (status === 'Active') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200 whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />{t('budgetReport.status.active')}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border bg-slate-50 text-slate-600 border-slate-200 whitespace-nowrap">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 flex-shrink-0" />{t('budgetReport.status.closed')}
    </span>
  );
}

// Component

interface BudgetReportProps {
  readOnly?: boolean;
}

export function BudgetReport({ readOnly = false }: BudgetReportProps) {
  const { t } = useTranslation(['admin', 'common']);

  // Data state
  const [reportData, setReportData] = useState<ProjectReportRow[]>([]);
  const [loading, setLoading]       = useState(true);

  // Filters
  const [projectFilter,  setProjectFilter]  = useState('all');
  const [statusFilter,   setStatusFilter]   = useState('all');
  const [alertFilter,    setAlertFilter]    = useState('all');
  const [appliedProject, setAppliedProject] = useState('all');
  const [appliedStatus,  setAppliedStatus]  = useState('all');
  const [appliedAlert,   setAppliedAlert]   = useState('all');
  const [generated,      setGenerated]      = useState(false);

  // UI state
  const [expandedProject, setExpandedProject] = useState<string | null>(null);

  // Fetch real data (use finance endpoints when readOnly / finance role)
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const fetchProjects = readOnly ? listFinanceProjects : listProjects;
      const fetchReport   = readOnly ? getFinanceExpenseReport : getExpenseReport;
      const [projectsPage, expenseReport] = await Promise.all([
        fetchProjects({ size: 500 }),
        fetchReport(),
      ]);

      // Build expense-by-project lookup
      const expenseByProject = new Map<number, ProjectExpenseRow>();
      expenseReport.byProject.forEach(row => expenseByProject.set(row.projectId, row));

      // Map projects with budgets to report rows
      const rows: ProjectReportRow[] = projectsPage.content
        .filter((p: ProjectResponse) => p.originalContractCents != null)
        .map((p: ProjectResponse) => {
          const totalBudget = (p.revisedContractCents ?? p.originalContractCents ?? 0) / 100;
          const consumed    = (p.totalConsumedCents ?? 0) / 100;
          const pct         = totalBudget > 0 ? (consumed / totalBudget) * 100 : 0;

          // Get breakdown from expense report
          const expRow = expenseByProject.get(p.id);
          const breakdown: TypeBreakdown[] = (expRow?.breakdown ?? []).map(b => {
            const amount = b.totalCents / 100;
            const bPct   = consumed > 0 ? (amount / consumed) * 100 : 0;
            return {
              type:   b.type.toLowerCase().replace(/_/g, '-'),
              label:  formatExpenseType(b.type),
              amount,
              pct:    Math.round(bPct * 10) / 10,
            };
          });

          return {
            id:         String(p.id),
            project:    p.name,
            totalBudget,
            consumed,
            status:     (p.status === 'CLOSED' ? 'Closed' : 'Active') as BudgetStatus,
            deviation:  computeDeviation(pct, consumed),
            deviationPct: Math.round(Math.abs(pct - 100) * 10) / 10,
            breakdown,
            createdAt: p.createdAt,
          };
        });

      setReportData(rows);
    } catch {
      toast.error(t('admin:budgetReport.loadError', 'Error loading budget report'));
    } finally {
      setLoading(false);
    }
  }, [t, readOnly]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Project names for filter dropdown
  const projectNames = useMemo(() => reportData.map(r => r.project), [reportData]);

  // Alert rows (projects >= 70% consumption)
  const alertRows = useMemo<AlertRow[]>(() =>
    reportData
      .filter(r => getPct(r.consumed, r.totalBudget) >= 70)
      .map(r => {
        const pct       = getPct(r.consumed, r.totalBudget);
        const remaining = r.totalBudget - r.consumed;

        // Estimate remaining days based on average daily burn rate
        let estimatedDays: number | null = null;
        if (remaining > 0 && r.consumed > 0) {
          const createdDate  = new Date(r.createdAt);
          const now          = new Date();
          const msPerDay     = 86_400_000;
          const daysActive   = Math.max((now.getTime() - createdDate.getTime()) / msPerDay, 1);
          const dailyBurn    = r.consumed / daysActive;
          estimatedDays      = Math.round(remaining / dailyBurn);
        }

        return {
          project: r.project,
          pct,
          level:   getAlertLevel(pct),
          remaining,
          estimatedDays,
        };
      })
      .sort((a, b) => b.pct - a.pct),
    [reportData],
  );

  // Handlers
  function handleGenerate() {
    setAppliedProject(projectFilter);
    setAppliedStatus(statusFilter);
    setAppliedAlert(alertFilter);
    setGenerated(true);
    toast.success(t('admin:budgetReport.reportGenerated'), {
      description: `${projectFilter === 'all' ? t('admin:budgetReport.allProjects') : projectFilter}`,
    });
  }

  function handleReset() {
    setProjectFilter('all'); setStatusFilter('all'); setAlertFilter('all');
    setAppliedProject('all'); setAppliedStatus('all'); setAppliedAlert('all');
    setGenerated(false); setExpandedProject(null);
  }

  // Filtered data
  const filteredRows = useMemo(() => {
    return reportData.filter(row => {
      if (appliedProject !== 'all' && row.project !== appliedProject) return false;
      if (appliedStatus  !== 'all' && row.status !== appliedStatus)   return false;
      if (appliedAlert   !== 'all') {
        const pct   = getPct(row.consumed, row.totalBudget);
        const level = getAlertLevel(pct);
        if (appliedAlert === 'normal'   && level !== 'ok')       return false;
        if (appliedAlert === 'warning'  && level !== 'warning')  return false;
        if (appliedAlert === 'critical' && level !== 'critical') return false;
      }
      return true;
    });
  }, [appliedProject, appliedStatus, appliedAlert, reportData]);

  // KPI totals (reactive)
  const totalBudgetAssigned = useMemo(() => reportData.reduce((s, r) => s + r.totalBudget, 0), [reportData]);
  const totalConsumed       = useMemo(() => reportData.reduce((s, r) => s + r.consumed, 0), [reportData]);
  const totalAvailable      = totalBudgetAssigned - totalConsumed;
  const projectsOver90      = reportData.filter(r => getPct(r.consumed, r.totalBudget) >= 90).length;

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-[#F97316]" />
      </div>
    );
  }

  // Render
  return (
    <div className="space-y-6 max-w-6xl">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-[#0A0A0A]">{t('admin:budgetReport.title')}</h2>
          <p className="text-[11px] text-[#71717A] mt-0.5">
            {readOnly ? t('admin:budgetReport.subtitleReadOnly') : t('admin:budgetReport.subtitle')}
          </p>
          {readOnly && (
            <span className="inline-flex items-center px-2 py-0.5 mt-1 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-600 border border-purple-200">
              {t('admin:budgetReport.viewOnly')}
            </span>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="h-9 px-4 text-xs gap-2 border-[#D4D4D8] text-[#0A0A0A] hover:text-[#F97316]">
              <Download className="w-3.5 h-3.5" />{t('common:buttons.export')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => {
              if (filteredRows.length === 0) return;
              try {
                const rows: BudgetExportRow[] = filteredRows.map(r => ({ project: r.project, totalBudget: r.totalBudget, consumed: r.consumed, available: r.totalBudget - r.consumed, executionPct: getPct(r.consumed, r.totalBudget), deviation: t(`admin:${DEVIATION_CFG[r.deviation].labelKey}`), status: r.status, breakdown: r.breakdown }));
                const alerts: AlertExportRow[] = alertRows.map(a => ({ project: a.project, pct: a.pct, level: a.level, remaining: a.remaining, estimatedDays: a.estimatedDays }));
                exportBudgetPdf({ rows, alerts, kpis: { totalBudget: totalBudgetAssigned, totalConsumed, totalAvailable, projectsOver90 } });
                toast.success(t('admin:budgetReport.exportSuccess', 'Export started'));
              } catch { toast.error(t('admin:budgetReport.exportError', 'Export failed')); }
            }} className="gap-2 text-sm cursor-pointer">
              <FileText className="w-4 h-4 text-[#71717A]" />{t('admin:budgetReport.exportPdf')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={async () => {
              if (filteredRows.length === 0) return;
              try {
                const rows: BudgetExportRow[] = filteredRows.map(r => ({ project: r.project, totalBudget: r.totalBudget, consumed: r.consumed, available: r.totalBudget - r.consumed, executionPct: getPct(r.consumed, r.totalBudget), deviation: t(`admin:${DEVIATION_CFG[r.deviation].labelKey}`), status: r.status, breakdown: r.breakdown }));
                const alerts: AlertExportRow[] = alertRows.map(a => ({ project: a.project, pct: a.pct, level: a.level, remaining: a.remaining, estimatedDays: a.estimatedDays }));
                await exportBudgetExcel({ rows, alerts, kpis: { totalBudget: totalBudgetAssigned, totalConsumed, totalAvailable, projectsOver90 } });
                toast.success(t('admin:budgetReport.exportSuccess', 'Export started'));
              } catch { toast.error(t('admin:budgetReport.exportError', 'Export failed')); }
            }} className="gap-2 text-sm cursor-pointer">
              <FileSpreadsheet className="w-4 h-4 text-[#71717A]" />{t('admin:budgetReport.exportExcel')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] p-5">
        <div className="flex items-center gap-2 mb-4">
          <FilterIcon className="w-4 h-4 text-[#71717A]" />
          <span className="text-sm font-semibold text-[#0A0A0A]">{t('admin:budgetReport.reportParams')}</span>
          {generated && <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-medium rounded-full border border-emerald-200">{t('admin:budgetReport.generated')}</span>}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {/* Project */}
          <div className="flex flex-col gap-1.5 min-w-[165px]">
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('common:labels.project')}</label>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="h-9 border-[#D4D4D8] text-sm"><SelectValue placeholder={t('common:labels.allProjects')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common:labels.allProjects')}</SelectItem>
                {projectNames.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
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
                <SelectItem value="Active">{t('common:status.active')}</SelectItem>
                <SelectItem value="Closed">{t('common:status.closed')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* Alert Level */}
          <div className="flex flex-col gap-1.5 min-w-[170px]">
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('admin:budgetReport.alertLevel')}</label>
            <Select value={alertFilter} onValueChange={setAlertFilter}>
              <SelectTrigger className="h-9 border-[#D4D4D8] text-sm"><SelectValue placeholder={t('common:labels.all')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common:labels.all')}</SelectItem>
                <SelectItem value="normal">{t('admin:budgetReport.alertNormal')}</SelectItem>
                <SelectItem value="warning">{t('admin:budgetReport.alertWarning')}</SelectItem>
                <SelectItem value="critical">{t('admin:budgetReport.alertCritical')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleReset} className="h-9 px-4 text-xs border-[#D4D4D8] text-[#71717A] hover:text-[#0A0A0A]">{t('common:buttons.reset')}</Button>
            <Button size="sm" onClick={handleGenerate} className="h-9 px-4 text-xs bg-[#F97316] hover:bg-[#C2410C] text-white gap-2">
              <TrendingUp className="w-3.5 h-3.5" />{t('admin:budgetReport.generateReport')}
            </Button>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Wallet}       title={t('admin:budgetReport.kpi.totalBudget')} value={fmtAmount(totalBudgetAssigned)} subtitle={t('admin:budgetReport.kpi.allProjects')}        iconBgColor="bg-emerald-50"   iconColor="text-emerald-600" />
        <StatCard icon={TrendingDown} title={t('admin:budgetReport.kpi.totalConsumed')}        value={fmtAmount(totalConsumed)}       subtitle={t('admin:budgetReport.kpi.approvedExpenses')}   iconBgColor="bg-amber-50"     iconColor="text-amber-600"   />
        <StatCard icon={TrendingUp}   title={t('admin:budgetReport.kpi.totalAvailable')}       value={fmtAmount(totalAvailable)}      subtitle={t('admin:budgetReport.kpi.remainingBudget')}    iconBgColor="bg-[#F97316]/10" iconColor="text-[#F97316]"   />
        <StatCard icon={AlertCircle}  title={t('admin:budgetReport.kpi.projectsOver90')}    value={projectsOver90.toString()}       subtitle={t('admin:budgetReport.kpi.needAttention')}      iconBgColor="bg-red-50"       iconColor="text-red-600"     />
      </div>

      {/* Table 1: Budget vs Actual */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-[#D4D4D8]">
          <Wallet className="w-4 h-4 text-[#71717A]" />
          <span className="text-sm font-semibold text-[#0A0A0A]">{t('admin:budgetReport.budgetVsActual')}</span>
          <span className="ml-1 text-xs text-[#71717A]">· {t('admin:budgetReport.projectCount', { count: filteredRows.length })}</span>
          <span className="text-[11px] text-[#71717A] ml-1 hidden sm:inline">{t('admin:budgetReport.clickHint')}</span>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#FAFAFA] hover:bg-[#FAFAFA]">
                <TableHead className="w-8" />
                {[t('admin:budgetReport.table.project'), t('admin:budgetReport.table.budget'), t('admin:budgetReport.table.consumed'), t('admin:budgetReport.table.available'), t('admin:budgetReport.table.execution'), t('admin:budgetReport.table.deviation'), t('common:labels.status')].map(h => (
                  <TableHead key={h} className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider whitespace-nowrap">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.flatMap(row => {
                const pct        = getPct(row.consumed, row.totalBudget);
                const available  = row.totalBudget - row.consumed;
                const isExpanded = expandedProject === row.project;

                const mainRow = (
                  <TableRow key={`${row.id}-row`}
                    onClick={() => setExpandedProject(isExpanded ? null : row.project)}
                    className={`cursor-pointer border-b border-[#D4D4D8]/50 transition-colors ${isExpanded ? 'bg-[#FAFAFA]' : 'hover:bg-[#FAFAFA]/50'}`}>
                    <TableCell className="py-3 pr-0 pl-4 text-[#71717A]">
                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </TableCell>
                    <TableCell className="py-3 font-semibold text-sm text-[#0A0A0A] whitespace-nowrap">{row.project}</TableCell>
                    <TableCell className="py-3"><span className="font-mono font-semibold text-sm text-[#0A0A0A]">{fmtAmount(row.totalBudget)}</span></TableCell>
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
                    <TableCell className="py-3"><DeviationBadge deviationKey={row.deviation} pct={row.deviationPct} /></TableCell>
                    <TableCell className="py-3"><StatusBadge status={row.status} /></TableCell>
                  </TableRow>
                );

                if (!isExpanded) return [mainRow];

                const breakdownRow = (
                  <TableRow key={`${row.id}-breakdown`} className="bg-[#FAFAFA]/40 hover:bg-[#FAFAFA]/40">
                    <TableCell colSpan={8} className="px-6 py-4 border-b border-[#D4D4D8]/50">
                      <div className="space-y-2">
                        <p className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">
                          {t('admin:budgetReport.expenseBreakdown', { project: row.project })}
                        </p>
                        {row.breakdown.length === 0 ? (
                          <p className="text-sm text-[#71717A] py-3">{t('admin:budgetReport.noExpensesYet')}</p>
                        ) : (
                          <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-[#FAFAFA] hover:bg-[#FAFAFA]">
                                  {[t('admin:budgetReport.breakdownTable.type'), t('admin:budgetReport.breakdownTable.amount'), t('admin:budgetReport.breakdownTable.share'), t('admin:budgetReport.breakdownTable.progress')].map(h => (
                                    <TableHead key={h} className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider py-2">{h}</TableHead>
                                  ))}
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {row.breakdown.map(b => (
                                  <TableRow key={b.type} className="border-b border-[#D4D4D8]/50 last:border-0 hover:bg-[#FAFAFA]/50">
                                    <TableCell className="py-2 text-sm text-[#0A0A0A] font-medium">{b.label}</TableCell>
                                    <TableCell className="py-2 font-mono text-sm font-semibold text-[#0A0A0A]">{fmtAmount(b.amount)}</TableCell>
                                    <TableCell className="py-2 text-sm text-[#71717A]">{b.pct.toFixed(1)}%</TableCell>
                                    <TableCell className="py-2 min-w-[120px]">
                                      <div className="h-1.5 bg-[#FAFAFA] rounded-full overflow-hidden">
                                        <div className="h-full bg-[#F97316] rounded-full" style={{ width: `${b.pct}%` }} />
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );

                return [mainRow, breakdownRow];
              })}
            </TableBody>
          </Table>
        </div>
        {filteredRows.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <div className="w-14 h-14 bg-[#FAFAFA] rounded-full flex items-center justify-center mb-3">
              <Wallet className="w-7 h-7 text-[#D4D4D8]" />
            </div>
            <p className="text-sm font-semibold text-[#0A0A0A] mb-1">{t('admin:budgetReport.noMatch')}</p>
            <p className="text-xs text-[#71717A]">{t('admin:budgetReport.noMatchHint')}</p>
          </div>
        )}
      </div>

      {/* Table 2: Alerts Summary */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-[#D4D4D8]">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-semibold text-[#0A0A0A]">{t('admin:budgetReport.alertsSummary')}</span>
          <span className="ml-1 text-xs text-[#71717A]">· {t('admin:budgetReport.projectsRequiringAttention')}</span>
          <span className="ml-auto px-2.5 py-0.5 bg-red-50 text-red-700 text-[10px] font-semibold rounded-full border border-red-200">
            {t('admin:budgetReport.alertCount', { count: alertRows.length })}
          </span>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#FAFAFA] hover:bg-[#FAFAFA]">
                {[t('admin:budgetReport.alertTable.project'), t('admin:budgetReport.alertTable.executionPct'), t('admin:budgetReport.alertTable.alertLevel'), t('admin:budgetReport.alertTable.remaining'), t('admin:budgetReport.alertTable.estimatedDays')].map(h => (
                  <TableHead key={h} className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider whitespace-nowrap">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {alertRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-[#71717A]">
                    {t('admin:budgetReport.noAlerts', 'No projects require attention at this time')}
                  </TableCell>
                </TableRow>
              ) : alertRows.map(alertRow => {
                const matchedRow = reportData.find(r => r.project === alertRow.project);
                return (
                  <TableRow key={alertRow.project}
                    className="border-b border-[#D4D4D8]/50 last:border-0 hover:bg-[#FAFAFA]/50 transition-colors">
                    {/* Project */}
                    <TableCell className="py-3 font-semibold text-sm text-[#0A0A0A]">{alertRow.project}</TableCell>
                    {/* Execution */}
                    <TableCell className="py-3 min-w-[140px]">
                      {matchedRow && <ProgressCell consumed={matchedRow.consumed} total={matchedRow.totalBudget} />}
                    </TableCell>
                    {/* Alert Level */}
                    <TableCell className="py-3">
                      <AlertLevelBadge level={alertRow.level} pct={alertRow.pct} />
                    </TableCell>
                    {/* Remaining */}
                    <TableCell className="py-3">
                      <span className={`font-mono font-semibold text-sm ${alertRow.level === 'critical' ? 'text-red-600' : 'text-amber-600'}`}>
                        {fmtAmount(alertRow.remaining)}
                      </span>
                    </TableCell>
                    {/* Estimated days */}
                    <TableCell className="py-3">
                      {alertRow.estimatedDays != null ? (
                        <>
                          <span className={`text-sm font-semibold ${alertRow.estimatedDays <= 7 ? 'text-red-600' : alertRow.estimatedDays <= 30 ? 'text-amber-600' : 'text-[#0A0A0A]'}`}>
                            {alertRow.estimatedDays} {t('admin:budgetReport.days')}
                          </span>
                          <span className="ml-1 text-[10px] text-[#D4D4D8]">{t('admin:budgetReport.atCurrentRate')}</span>
                        </>
                      ) : (
                        <span className="text-sm text-[#71717A]">— {t('admin:budgetReport.atCurrentRate')}</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
