import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle, Users, TrendingUp, Receipt, Download,
  ChevronDown, ChevronRight, Filter as FilterIcon,
  FileText, FileSpreadsheet, Loader2,
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
import { EXPENSE_TYPES } from './NewExpense';
import {
  getExpenseReport, getFinanceExpenseReport, exportExpenseReport,
  type ExpenseReportResponse, type ProjectExpenseRow, type WorkerExpenseRow,
} from '../services/expenses';
import { listProjects, type ProjectResponse } from '../services/projects';
import { exportExpenseExcel, exportExpensePdf } from '../helpers/exportExpenseReport';
import { businessToday } from '../helpers/dateTime';

// Types (now from API)

interface ProjectRow {
  projectId: number;
  project: string;
  approved: number;
  pending: number;
  observed: number;
  rejected: number;
  breakdown: { type: string; count: number; total: number }[];
}

interface WorkerRow {
  worker: string;
  submitted: number;
  approved: number;
  pending: number;
  observed: number;
  rejected: number;
  totalApproved: number;
}

// Helpers

function fmtAmount(n: number) {
  return `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

function getMonthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function getToday(): string {
  return businessToday();
}

const TYPE_LABEL_KEYS: Record<string, string> = {
  'fuel':            'expenseReport.type.fuel',
  'materials':       'expenseReport.type.materials',
  'tools':           'expenseReport.type.tools',
  'per-diem':        'expenseReport.type.perDiem',
  'minor-purchases': 'expenseReport.type.minorPurchases',
  'transportation':  'expenseReport.type.transportation',
  'other':           'expenseReport.type.other',
};

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

// Component

interface ExpenseReportProps {
  readOnly?: boolean;
}

export function ExpenseReport({ readOnly = false }: ExpenseReportProps) {
  const { t } = useTranslation(['admin', 'common']);
  // Filters
  const [dateFrom,       setDateFrom]       = useState(getMonthStart);
  const [dateTo,         setDateTo]         = useState(getToday);
  const [projectFilter,  setProjectFilter]  = useState('all');
  const [typeFilter,     setTypeFilter]     = useState('all');
  const [generated,      setGenerated]      = useState(false);
  const [appliedProject, setAppliedProject] = useState('all');

  // UI state
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Data from API
  const [loading, setLoading] = useState(false);
  const [projectRows, setProjectRows] = useState<ProjectRow[]>([]);
  const [workerRows, setWorkerRows] = useState<WorkerRow[]>([]);
  const [report, setReport] = useState<ExpenseReportResponse | null>(null);
  const [projects, setProjects] = useState<ProjectResponse[]>([]);

  useEffect(() => {
    listProjects({ size: 200 }).then(r => setProjects(r.content)).catch(err => toast.error(err?.message));
  }, []);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const fn = readOnly ? getFinanceExpenseReport : getExpenseReport;
      const res = await fn({
        dateFrom,
        dateTo,
        projectId: projectFilter !== 'all' ? Number(projectFilter) : undefined,
        type: typeFilter !== 'all' ? typeFilter.toUpperCase().replace(/-/g, '_') : undefined,
      });
      setReport(res);
      setProjectRows(res.byProject.map(p => ({
        projectId: p.projectId,
        project: p.projectName,
        approved: p.approvedCents / 100,
        pending: p.pendingCount,
        observed: p.observedCount,
        rejected: p.rejectedCount,
        breakdown: p.breakdown.map(b => ({ type: b.type.toLowerCase().replace(/_/g, '-'), count: Number(b.count), total: b.totalCents / 100 })),
      })));
      setWorkerRows(res.byWorker.map(w => ({
        worker: w.workerName ?? w.workerUsername,
        submitted: Number(w.submittedCount),
        approved: Number(w.approvedCount),
        pending: Number(w.pendingCount),
        observed: Number(w.observedCount),
        rejected: Number(w.rejectedCount),
        totalApproved: w.totalApprovedCents / 100,
      })));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('admin:expenseReport.fetchError'));
    } finally { setLoading(false); }
  }, [dateFrom, dateTo, projectFilter, typeFilter, readOnly]);

  // Auto-load report on mount
  useEffect(() => {
    setGenerated(true);
    fetchReport();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleGenerate() {
    setAppliedProject(projectFilter);
    setGenerated(true);
    fetchReport();
  }

  function handleReset() {
    setDateFrom(getMonthStart()); setDateTo(getToday());
    setProjectFilter('all'); setTypeFilter('all');
    setAppliedProject('all'); setGenerated(false);
    setExpandedProject(null);
  }

  async function handleExport(format: 'xlsx' | 'pdf') {
    setExporting(true);
    try {
      await exportExpenseReport({
        format,
        dateFrom,
        dateTo,
        projectId: projectFilter !== 'all' ? Number(projectFilter) : undefined,
        type: typeFilter !== 'all' ? typeFilter.toUpperCase().replace(/-/g, '_') : undefined,
        role: readOnly ? 'finance' : 'admin',
      });
      toast.success(t('admin:expenseReport.exportSuccess'));
    } catch (err) {
      console.error('Export error:', err);
      toast.error(err instanceof Error ? err.message : t('admin:expenseReport.exportError'));
    } finally {
      setExporting(false);
    }
  }

  // KPI values
  const fmtCents = (c: number) => fmtAmount(c / 100);
  const totalApproved  = report ? fmtCents(report.kpis.totalApprovedCents) : '—';
  const avgPerWorker   = report?.kpis.avgPerWorkerCents != null ? fmtCents(report.kpis.avgPerWorkerCents) : '—';
  const topCategory    = report?.kpis.topCategory ? (t(`admin:${TYPE_LABEL_KEYS[report.kpis.topCategory.toLowerCase().replace(/_/g, '-')]}`) ?? report.kpis.topCategory) : '—';
  const expenseCount   = report ? `${report.kpis.expenseCount} total` : '—';

  // Render
  return (
    <div className="space-y-6 max-w-6xl">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-[#0A0A0A]">{t('admin:expenseReport.title')}</h2>
          <p className="text-[11px] text-[#71717A] mt-0.5">
            {readOnly ? t('admin:expenseReport.subtitleReadOnly') : t('admin:expenseReport.subtitle')}
          </p>
          {readOnly && (
            <span className="inline-flex items-center px-2 py-0.5 mt-1 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-600 border border-purple-200">
              {t('admin:expenseReport.viewOnly')}
            </span>
          )}
        </div>
        {/* Export button — available to both admin and finance */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" disabled={exporting} className="h-9 px-4 text-xs gap-2 border-[#D4D4D8] text-[#0A0A0A] hover:text-[#F97316]">
              {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}{t('common:buttons.export')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => {
              if (!report) return;
              try { exportExpensePdf({ report, dateFrom, dateTo, projectFilter: appliedProject !== 'all' ? appliedProject : undefined }); toast.success(t('admin:expenseReport.exportSuccess', 'Export started')); }
              catch { toast.error(t('admin:expenseReport.exportError', 'Export failed')); }
            }} className="gap-2 text-sm cursor-pointer">
              <FileText className="w-4 h-4 text-[#71717A]" />{t('admin:expenseReport.exportPdf')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={async () => {
              if (!report) return;
              try { await exportExpenseExcel({ report, dateFrom, dateTo, projectFilter: appliedProject !== 'all' ? appliedProject : undefined }); toast.success(t('admin:expenseReport.exportSuccess', 'Export started')); }
              catch { toast.error(t('admin:expenseReport.exportError', 'Export failed')); }
            }} className="gap-2 text-sm cursor-pointer">
              <FileSpreadsheet className="w-4 h-4 text-[#71717A]" />{t('admin:expenseReport.exportExcel')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] p-5">
        <div className="flex items-center gap-2 mb-4">
          <FilterIcon className="w-4 h-4 text-[#71717A]" />
          <span className="text-sm font-semibold text-[#0A0A0A]">{t('admin:expenseReport.reportParams')}</span>
          {generated && <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-medium rounded-full border border-emerald-200">{t('admin:expenseReport.generated')}</span>}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('common:labels.from')}</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="h-9 rounded-lg border border-[#D4D4D8] px-3 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#F97316]/25 focus:border-[#F97316]" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('common:labels.to')}</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="h-9 rounded-lg border border-[#D4D4D8] px-3 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#F97316]/25 focus:border-[#F97316]" />
          </div>
          <div className="flex flex-col gap-1.5 min-w-[160px]">
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
                {EXPENSE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleReset} className="h-9 px-4 text-xs border-[#D4D4D8] text-[#71717A] hover:text-[#0A0A0A]">{t('common:buttons.reset')}</Button>
            <Button size="sm" onClick={handleGenerate} disabled={loading} className="h-9 px-4 text-xs bg-[#F97316] hover:bg-[#C2410C] text-white gap-2">
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TrendingUp className="w-3.5 h-3.5" />}{t('admin:expenseReport.generateReport')}
            </Button>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={CheckCircle} title={t('admin:expenseReport.kpi.totalApproved')}   value={totalApproved} subtitle={t('admin:expenseReport.kpi.allTime')}            iconBgColor="bg-emerald-50"   iconColor="text-emerald-600"  />
        <StatCard icon={Users}       title={t('admin:expenseReport.kpi.avgPerWorker')}   value={avgPerWorker}  subtitle={t('admin:expenseReport.kpi.activeWorkers', { count: workerRows.length })}    iconBgColor="bg-[#F97316]/10" iconColor="text-[#F97316]"    />
        <StatCard icon={TrendingUp}  title={t('admin:expenseReport.kpi.topCategory')}     value={topCategory}   subtitle={t('admin:expenseReport.kpi.byTotalAmount')}     iconBgColor="bg-amber-50"     iconColor="text-amber-600"    />
        <StatCard icon={Receipt}     title={t('admin:expenseReport.kpi.expenseCount')}    value={expenseCount}  subtitle={t('admin:expenseReport.kpi.thisPeriod')}         iconBgColor="bg-[#F97316]/10" iconColor="text-[#F97316]"    />
      </div>

      {/* Table 1: By Project */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-[#D4D4D8]">
          <TrendingUp className="w-4 h-4 text-[#71717A]" />
          <span className="text-sm font-semibold text-[#0A0A0A]">{t('admin:expenseReport.byProject.title')}</span>
          <span className="ml-1 text-xs text-[#71717A]">· {t('admin:expenseReport.byProject.count', { count: projectRows.length })}</span>
          <span className="text-[11px] text-[#71717A] ml-1">{t('admin:expenseReport.byProject.clickHint')}</span>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#FAFAFA] hover:bg-[#FAFAFA]">
                <TableHead className="w-8" />
                {[t('admin:expenseReport.byProject.table.project'), t('admin:expenseReport.byProject.table.totalApproved'), t('admin:expenseReport.byProject.table.pending'), t('admin:expenseReport.byProject.table.observed'), t('admin:expenseReport.byProject.table.rejected'), t('admin:expenseReport.byProject.table.netTotal')].map(h => (
                  <TableHead key={h} className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider whitespace-nowrap">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {projectRows.flatMap(row => {
                const isExpanded  = expandedProject === row.project;

                const mainRow = (
                  <TableRow key={`${row.project}-row`} onClick={() => setExpandedProject(isExpanded ? null : row.project)}
                    className={`cursor-pointer border-b border-[#D4D4D8]/50 transition-colors ${isExpanded ? 'bg-[#FAFAFA]' : 'hover:bg-[#FAFAFA]/50'}`}>
                    <TableCell className="py-3 pr-0 pl-4 text-[#71717A]">
                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </TableCell>
                    <TableCell className="py-3 font-medium text-sm text-[#0A0A0A] whitespace-nowrap">{row.project}</TableCell>
                    <TableCell className="py-3"><span className="font-mono text-sm text-emerald-700 font-semibold">{fmtAmount(row.approved)}</span></TableCell>
                    <TableCell className="py-3"><span className={`text-sm font-semibold ${row.pending > 0 ? 'text-amber-600' : 'text-[#71717A]'}`}>{row.pending}</span></TableCell>
                    <TableCell className="py-3"><span className={`text-sm font-semibold ${row.observed > 0 ? 'text-[#F97316]' : 'text-[#71717A]'}`}>{row.observed}</span></TableCell>
                    <TableCell className="py-3"><span className={`text-sm font-semibold ${row.rejected > 0 ? 'text-red-600' : 'text-[#71717A]'}`}>{row.rejected}</span></TableCell>
                    <TableCell className="py-3"><span className="font-mono text-sm font-bold text-[#0A0A0A]">{fmtAmount(row.approved)}</span></TableCell>
                  </TableRow>
                );

                if (!isExpanded) return [mainRow];

                const breakdownRow = (
                  <TableRow key={`${row.project}-breakdown`} className="bg-[#FAFAFA]/40 hover:bg-[#FAFAFA]/40">
                    <TableCell colSpan={7} className="px-6 py-4 border-b border-[#D4D4D8]/50">
                      <div className="space-y-2">
                        <p className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('admin:expenseReport.typeBreakdown', { project: row.project })}</p>
                        <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-[#FAFAFA] hover:bg-[#FAFAFA]">
                                {[t('admin:expenseReport.typeTable.type'), t('admin:expenseReport.typeTable.count'), t('admin:expenseReport.typeTable.total')].map(h => (
                                  <TableHead key={h} className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider py-2">{h}</TableHead>
                                ))}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {row.breakdown.map(b => (
                                <TableRow key={b.type} className="border-b border-[#D4D4D8]/50 last:border-0">
                                  <TableCell className="py-2 text-sm text-[#0A0A0A]">{t(`admin:${TYPE_LABEL_KEYS[b.type]}`) ?? b.type}</TableCell>
                                  <TableCell className="py-2 text-sm text-[#71717A]">{b.count}</TableCell>
                                  <TableCell className="py-2 font-mono text-sm font-semibold text-[#0A0A0A]">{fmtAmount(b.total)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                );

                return [mainRow, breakdownRow];
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Table 2: By Worker */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-[#D4D4D8]">
          <Users className="w-4 h-4 text-[#71717A]" />
          <span className="text-sm font-semibold text-[#0A0A0A]">{t('admin:expenseReport.byWorker.title')}</span>
          <span className="ml-1 text-xs text-[#71717A]">· {t('admin:expenseReport.byWorker.count', { count: workerRows.length })}</span>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#FAFAFA] hover:bg-[#FAFAFA]">
                {[t('admin:expenseReport.byWorker.table.worker'), t('admin:expenseReport.byWorker.table.submitted'), t('admin:expenseReport.byWorker.table.approved'), t('admin:expenseReport.byWorker.table.pending'), t('admin:expenseReport.byWorker.table.observed'), t('admin:expenseReport.byWorker.table.rejected'), t('admin:expenseReport.byWorker.table.totalApproved')].map(h => (
                  <TableHead key={h} className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider whitespace-nowrap">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {workerRows.map(row => (
                <TableRow key={row.worker} className="border-b border-[#D4D4D8]/50 last:border-0 hover:bg-[#FAFAFA]/50 transition-colors">
                  <TableCell className="py-3"><WorkerAvatar name={row.worker} /></TableCell>
                  <TableCell className="py-3 text-sm text-[#0A0A0A] font-medium">{row.submitted}</TableCell>
                  <TableCell className="py-3 text-sm text-emerald-700 font-semibold">{row.approved}</TableCell>
                  <TableCell className="py-3">
                    <span className={`text-sm font-semibold ${row.pending > 0 ? 'text-amber-600' : 'text-[#71717A]'}`}>{row.pending}</span>
                  </TableCell>
                  <TableCell className="py-3">
                    <span className={`text-sm font-semibold ${row.observed > 0 ? 'text-[#F97316]' : 'text-[#71717A]'}`}>{row.observed}</span>
                  </TableCell>
                  <TableCell className="py-3">
                    <span className={`text-sm font-semibold ${row.rejected > 0 ? 'text-red-600' : 'text-[#71717A]'}`}>{row.rejected}</span>
                  </TableCell>
                  <TableCell className="py-3">
                    <span className="font-mono font-bold text-sm text-[#0A0A0A]">{fmtAmount(row.totalApproved)}</span>
                  </TableCell>
                </TableRow>
              ))}
              {/* Totals row */}
              <TableRow className="bg-[#FAFAFA] hover:bg-[#FAFAFA]">
                <TableCell className="py-3 text-xs font-bold text-[#0A0A0A] uppercase tracking-wide">{t('admin:expenseReport.totals')}</TableCell>
                <TableCell className="py-3 text-sm font-bold text-[#0A0A0A]">{workerRows.reduce((s, r) => s + r.submitted, 0)}</TableCell>
                <TableCell className="py-3 text-sm font-bold text-emerald-700">{workerRows.reduce((s, r) => s + r.approved, 0)}</TableCell>
                <TableCell className="py-3 text-sm font-bold text-amber-600">{workerRows.reduce((s, r) => s + r.pending, 0)}</TableCell>
                <TableCell className="py-3 text-sm font-bold text-[#F97316]">{workerRows.reduce((s, r) => s + r.observed, 0)}</TableCell>
                <TableCell className="py-3 text-sm font-bold text-red-600">{workerRows.reduce((s, r) => s + r.rejected, 0)}</TableCell>
                <TableCell className="py-3 font-mono font-bold text-sm text-[#0A0A0A]">{fmtAmount(workerRows.reduce((s, r) => s + r.totalApproved, 0))}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
