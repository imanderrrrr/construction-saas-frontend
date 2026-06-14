import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Clock, DollarSign, AlertTriangle, Filter, Eye,
  CheckCircle, Loader2, Users, Info, FileSpreadsheet, FileText,
  TrendingUp, Calendar, ArrowRight, Banknote,
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
import { Skeleton } from './ui/skeleton';
import {
  getAdminHoursReport,
  type AdminHoursReportResponse,
  type WorkerHoursSummary,
  type DailyEntryDetail,
} from '../services/time';
import { listProjects, type ProjectResponse } from '../services/projects';
import { listActiveUsers, type UserDTO } from '../services/users';
import { exportPayrollExcel } from '../helpers/exportPayrollExcel';
import { exportPayrollPdf } from '../helpers/exportPayrollPdf';
import { toast } from 'sonner';
import { businessToday } from '../helpers/dateTime';
import { workerRowPay, unpaidApprovedHours } from '../helpers/payroll';

// Helpers

function fmtDate(iso: string, locale = 'en-US') {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtAmount(n: number) {
  return `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}
/** "15:48:08.981412" → "3:48 PM" */
function fmtTime(timeStr: string): string {
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, '0')} ${ampm}`;
}

function fmtDateTime(iso: string, locale = 'en-US') {
  const d = new Date(iso);
  return d.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
}

// Status badge

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation('admin');
  const key = status.toLowerCase();
  const map: Record<string, string> = {
    approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    pending:  'bg-amber-50 text-amber-700 border-amber-200',
    rejected: 'bg-red-50 text-red-700 border-red-200',
    observed: 'bg-blue-50 text-blue-700 border-blue-200',
  };
  const dotMap: Record<string, string> = {
    approved: 'bg-emerald-500', pending: 'bg-amber-500', rejected: 'bg-red-500', observed: 'bg-blue-500',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${map[key] ?? map.pending}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotMap[key] ?? dotMap.pending}`} />
      {t(`laborCost.status.${key}`, key)}
    </span>
  );
}

// Computed worker type for display
interface ComputedWorker extends WorkerHoursSummary {
  cost: number | null;
  pendingHours: number;
  displayEntries: DailyEntryDetail[];
}

// Component

interface LaborCostReportProps {
  project?: string;
}

export function LaborCostReport({ project }: LaborCostReportProps) {
  const { t, i18n } = useTranslation(['admin', 'common']);

  // Filter state
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState(() => {
    const today = businessToday();
    return today.slice(0, 8) + '01';
  });
  const [dateTo, setDateTo] = useState(() => businessToday());
  const [filterWorker, setFilterWorker] = useState('all');
  const [filterStatus, setFilterStatus] = useState('approved');
  const [detailWorker, setDetailWorker] = useState<ComputedWorker | null>(null);

  // Data state
  const [report, setReport] = useState<AdminHoursReportResponse | null>(null);
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [users, setUsers] = useState<UserDTO[]>([]);
  const [uiState, setUiState] = useState<'loading' | 'data' | 'error'>('loading');

  // Load filter options on mount
  useEffect(() => {
    Promise.all([
      listProjects({ status: 'ACTIVE', size: 100 }).then(p => setProjects(p.content)),
      listActiveUsers().then(u => setUsers(u)),
    ]).catch(() => {/* filter options failed, not critical */});
  }, []);

  // Set project from prop
  useEffect(() => {
    if (project) setSelectedProject(project);
  }, [project]);

  // Fetch report data
  const fetchReport = useCallback(async () => {
    setUiState('loading');
    try {
      const data = await getAdminHoursReport({
        dateFrom,
        dateTo,
        projectId: selectedProject !== 'all' ? Number(selectedProject) : undefined,
        workerId: filterWorker !== 'all' ? Number(filterWorker) : undefined,
      });
      setReport(data);
      setUiState('data');
    } catch {
      setUiState('error');
    }
  }, [dateFrom, dateTo, selectedProject, filterWorker]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const hasFilters = filterWorker !== 'all' || filterStatus !== 'approved' || selectedProject !== 'all';

  // Compute display data from API response
  const computed = useMemo<ComputedWorker[]>(() => {
    if (!report) return [];
    return report.workers.map(w => {
      const pendingEntries = w.dailyEntries.filter(e => e.approvalStatus === 'PENDING');
      const pendingHours = pendingEntries.reduce((s, e) => s + (e.totalHours ?? 0), 0);
      // Cost the row from UNPAID approved hours (shared with the PDF/Excel
      // exports), never from totalApprovedHours — that would re-bill hours
      // already settled in a prior payroll run. See helpers/payroll.ts (H4).
      const cost = workerRowPay(w);

      // Filter entries by status for display
      const displayEntries = filterStatus === 'all'
        ? w.dailyEntries
        : w.dailyEntries.filter(e => e.approvalStatus.toLowerCase() === filterStatus);

      return { ...w, cost, pendingHours, displayEntries };
    }).filter(w => w.displayEntries.length > 0 || w.totalApprovedHours > 0 || w.pendingHours > 0);
  }, [report, filterStatus]);

  const totalApprovedHours = report?.kpis.totalApprovedHours ?? 0;
  const totalCost = report?.kpis.totalLaborCost ?? 0;
  const totalPendingHours = report?.kpis.totalPendingHours ?? 0;
  const workersWithoutRate = computed.filter(w => w.hourlyRate == null && unpaidApprovedHours(w) > 0);

  function clearFilters() {
    setSelectedProject('all');
    setFilterWorker('all');
    setFilterStatus('approved');
  }

  async function handleExportExcel() {
    if (!report || computed.length === 0) return;
    try {
      toast.success(t('admin:payroll.exportStarted', 'Export started'), { description: t('admin:payroll.generatingExcel', 'Generating Excel…') });
      await exportPayrollExcel({
        workers: computed,
        kpis: report.kpis,
        dateFrom,
        dateTo,
        reportTitle: 'Labor Cost',
      });
    } catch {
      toast.error('Export failed');
    }
  }

  function handleExportPdf() {
    if (!report || computed.length === 0) return;
    try {
      toast.success(t('admin:payroll.exportStarted', 'Export started'), { description: t('admin:payroll.generatingPdf', 'Generating PDF…') });
      exportPayrollPdf({
        workers: computed,
        kpis: report.kpis,
        dateFrom,
        dateTo,
        reportTitle: 'Labor Cost',
      });
    } catch {
      toast.error('Export failed');
    }
  }

  // Loading / error states
  if (uiState === 'loading') {
    return (
      <div className="space-y-6 max-w-6xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-12 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (uiState === 'error') {
    return (
      <div className="max-w-6xl">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-red-900">{t('admin:laborCost.errorTitle')}</p>
              <p className="text-xs text-red-600 mt-0.5">{t('admin:laborCost.errorDesc')}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchReport}
            className="border-red-200 text-red-700 hover:bg-red-50 gap-2">
            <Loader2 className="w-3.5 h-3.5" />{t('common:buttons.retry')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">

      {/* Info banner – projected cost explanation */}
      <div className="flex items-center gap-2 bg-[#F97316]/5 border border-[#F97316]/20 rounded-xl px-4 py-3">
        <Info className="w-4 h-4 text-[#F97316] flex-shrink-0" />
        <p className="text-xs text-[#F97316]">{t('admin:laborCost.infoBannerProjected')}</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={CheckCircle} title={t('admin:laborCost.approvedHours')} value={`${totalApprovedHours.toFixed(2)} hrs`}
          subtitle={`${fmtDate(dateFrom, i18n.language)} — ${fmtDate(dateTo, i18n.language)}`} iconBgColor="bg-emerald-50" iconColor="text-emerald-600" />
        <StatCard icon={DollarSign} title={t('admin:laborCost.projectedCost')} value={fmtAmount(totalCost)}
          subtitle={t('admin:laborCost.notYetDeducted')} iconBgColor="bg-[#F97316]/10" iconColor="text-[#F97316]" />
        <StatCard icon={Clock} title={t('admin:laborCost.pendingHours')} value={`${totalPendingHours.toFixed(2)} hrs`}
          subtitle={t('admin:laborCost.notIncludedInCost')} iconBgColor="bg-amber-50" iconColor="text-amber-600" />
        <StatCard icon={Users} title={t('admin:laborCost.activeWorkers')} value={String(computed.length)}
          subtitle={t('admin:laborCost.workersWithRate', { count: computed.filter(w => w.cost != null).length })} iconBgColor="bg-purple-50" iconColor="text-purple-600" />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-[#71717A]" />
          <span className="text-sm font-semibold text-[#0A0A0A]">{t('common:buttons.filter')}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1 block">{t('common:labels.project')}</label>
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger className="h-9 text-sm border-[#D4D4D8]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common:labels.all')}</SelectItem>
                {projects.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1 block">{t('common:labels.from')}</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="h-9 w-full rounded-md border border-[#D4D4D8] px-3 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#F97316]/40" />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1 block">{t('common:labels.to')}</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="h-9 w-full rounded-md border border-[#D4D4D8] px-3 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#F97316]/40" />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1 block">{t('admin:laborCost.table.worker')}</label>
            <Select value={filterWorker} onValueChange={setFilterWorker}>
              <SelectTrigger className="h-9 text-sm border-[#D4D4D8]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common:labels.all')}</SelectItem>
                {users.filter(u => u.role === 'WORKER' || u.role === 'SUPERVISOR').map(u => (
                  <SelectItem key={u.id} value={String(u.id)}>{u.fullName ?? u.username}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1 block">{t('common:labels.status')}</label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-9 text-sm border-[#D4D4D8]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="approved">{t('admin:laborCost.status.approved')}</SelectItem>
                <SelectItem value="pending">{t('admin:laborCost.status.pending')}</SelectItem>
                <SelectItem value="rejected">{t('admin:laborCost.status.rejected')}</SelectItem>
                <SelectItem value="all">{t('common:labels.all')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {filterStatus !== 'approved' && (
          <div className="mt-3 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
            <p className="text-xs text-amber-700">{filterStatus === 'all' ? t('admin:laborCost.viewingAllStatuses') : t('admin:laborCost.viewingStatus', { status: t(`admin:laborCost.status.${filterStatus}`) })}</p>
          </div>
        )}
        {hasFilters && (
          <div className="mt-3 pt-3 border-t border-[#FAFAFA]">
            <button onClick={clearFilters} className="text-xs font-medium text-[#F97316] hover:text-[#C2410C] transition-colors">
              {t('admin:laborCost.clearFilters')}
            </button>
          </div>
        )}
      </div>

      {/* Workers without rate warning */}
      {workersWithoutRate.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-semibold text-amber-800">
              {t('admin:laborCost.workersWithoutRate', { count: workersWithoutRate.length })}
            </span>
          </div>
          <div className="space-y-1.5">
            {workersWithoutRate.map(w => (
              <div key={w.workerId} className="flex items-center justify-between bg-white/60 rounded-lg px-3 py-2">
                <span className="text-sm text-[#0A0A0A]">{w.workerName ?? w.workerUsername}</span>
                <span className="text-xs text-amber-600 font-medium">{t('admin:laborCost.rateNotDefined')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-6 py-4 border-b border-[#D4D4D8] flex-wrap">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#71717A]" />
            <span className="text-sm font-semibold text-[#0A0A0A]">{t('admin:laborCost.tableTitle')}</span>
            <span className="text-xs text-[#71717A]">{t('admin:laborCost.workerCount', { count: computed.length })}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportExcel}
              className="h-8 text-xs gap-1.5 border-[#D4D4D8] text-[#0A0A0A] hover:border-emerald-400 hover:text-emerald-700">
              <FileSpreadsheet className="w-3.5 h-3.5" />{t('admin:payroll.exportExcel', 'Excel')}
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPdf}
              className="h-8 text-xs gap-1.5 border-[#D4D4D8] text-[#0A0A0A] hover:border-red-400 hover:text-red-700">
              <FileText className="w-3.5 h-3.5" />{t('admin:payroll.exportPdf', 'PDF')}
            </Button>
          </div>
        </div>

        {computed.length === 0 ? (
          <div className="py-8">
            <EmptyState icon={Clock} title={t('admin:laborCost.noApprovedHours')} description={t('admin:laborCost.noApprovedHoursHint')} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="bg-[#FAFAFA]">
                  {[
                    t('admin:laborCost.table.worker'),
                    t('admin:laborCost.table.role'),
                    t('admin:laborCost.table.hourlyRate'),
                    t('admin:laborCost.table.approvedHours'),
                    t('admin:laborCost.table.transitHours'),
                    t('admin:laborCost.table.projectedCost'),
                    t('admin:laborCost.table.lastPayment'),
                    t('admin:laborCost.table.actions'),
                  ].map(h => (
                    <th key={h} className="text-left text-[11px] font-semibold text-[#71717A] uppercase tracking-wider px-4 py-2.5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {computed.map(w => {
                  const transitHrs = w.totalTransitHours ?? w.dailyEntries.reduce((s, e) => s + (e.transitMinutes ?? 0), 0) / 60;
                  return (
                    <tr key={w.workerId} className="border-b border-[#D4D4D8]/50 hover:bg-[#FAFAFA]/60 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-[#0A0A0A]">{w.workerName ?? w.workerUsername}</p>
                        <p className="text-[11px] text-[#71717A]">{[...new Set(w.dailyEntries.map(e => e.projectName))].join(', ')}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          w.workerRole === 'SUPERVISOR'
                            ? 'bg-[#F97316]/10 text-[#F97316] border-[#F97316]/20'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>{w.workerRole}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-sm text-[#0A0A0A]">
                        {w.hourlyRate != null ? `$${w.hourlyRate.toFixed(2)}` : (
                          <span className="text-amber-600 flex items-center gap-1 text-xs">
                            <AlertTriangle className="w-3 h-3" />{t('admin:laborCost.notDefined')}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-sm text-[#0A0A0A]">{unpaidApprovedHours(w).toFixed(2)} hrs</td>
                      <td className="px-4 py-3 font-mono text-sm text-blue-600">
                        {transitHrs > 0 ? `${transitHrs.toFixed(1)} hrs` : <span className="text-[#D4D4D8]">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {w.cost != null ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-sm font-semibold text-[#0A0A0A]">{fmtAmount(w.cost)}</span>
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-amber-100 text-amber-700 border border-amber-200">
                              {t('admin:laborCost.projected')}
                            </span>
                          </div>
                        ) : <span className="text-[#D4D4D8]">—</span>}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {w.lastPaymentDate ? (
                          <div>
                            <p className="text-xs text-[#0A0A0A]">{fmtDateTime(w.lastPaymentDate, i18n.language)}</p>
                            <p className="text-[11px] text-[#71717A] font-mono">{fmtAmount((w.lastPaymentAmountCents ?? 0) / 100)}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-[#71717A] italic">{t('admin:laborCost.neverPaid')}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Button variant="outline" size="sm" onClick={() => setDetailWorker(w)}
                          className="h-7 text-[11px] border-[#F97316]/30 text-[#F97316] hover:bg-[#F97316]/5 hover:text-[#C2410C] gap-1">
                          <Eye className="w-3 h-3" />{t('admin:laborCost.viewDetail')}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-[#FAFAFA] border-t border-[#D4D4D8]">
                  <td colSpan={3} className="px-4 py-3 text-xs font-semibold text-[#71717A] uppercase">{t('admin:laborCost.total')}</td>
                  <td className="px-4 py-3 font-mono text-sm font-semibold text-[#0A0A0A]">{totalApprovedHours.toFixed(2)} hrs</td>
                  <td />
                  <td className="px-4 py-3 font-mono text-sm font-semibold text-[#F97316]">{fmtAmount(totalCost)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Detail modal – enhanced */}
      <Dialog open={!!detailWorker} onOpenChange={open => { if (!open) setDetailWorker(null); }}>
        <DialogContent className="sm:max-w-5xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 flex-wrap">
              <span>{t('admin:laborCost.dialogTitle', { name: detailWorker?.workerName ?? detailWorker?.workerUsername })}</span>
              {detailWorker?.hourlyRate != null && (
                <span className="text-sm font-normal text-[#71717A]">{t('admin:laborCost.dialogRate', { rate: detailWorker.hourlyRate.toFixed(2) })}</span>
              )}
            </DialogTitle>
          </DialogHeader>

          {detailWorker && (
            <div className="space-y-4 overflow-y-auto max-h-[70vh]">
              {/* Summary KPI cards – richer */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="bg-[#FAFAFA] rounded-lg px-3 py-2.5">
                  <p className="text-[10px] font-semibold text-[#71717A] uppercase">{t('admin:laborCost.detailKpi.daysWorked')}</p>
                  <p className="text-lg font-bold text-[#0A0A0A]">{detailWorker.daysWorked} <span className="text-xs font-normal text-[#71717A]">/ {detailWorker.totalDays}</span></p>
                </div>
                <div className="bg-[#FAFAFA] rounded-lg px-3 py-2.5">
                  <p className="text-[10px] font-semibold text-[#71717A] uppercase">{t('admin:laborCost.detailKpi.approvedHours')}</p>
                  <p className="text-lg font-bold text-[#0A0A0A]">{detailWorker.totalApprovedHours.toFixed(2)} <span className="text-xs font-normal text-[#71717A]">hrs</span></p>
                </div>
                <div className="bg-[#FAFAFA] rounded-lg px-3 py-2.5">
                  <p className="text-[10px] font-semibold text-[#71717A] uppercase">{t('admin:laborCost.detailKpi.avgPerDay')}</p>
                  <p className="text-lg font-bold text-[#0A0A0A]">{detailWorker.avgHoursPerDay.toFixed(2)} <span className="text-xs font-normal text-[#71717A]">hrs</span></p>
                </div>
                <div className="bg-[#FAFAFA] rounded-lg px-3 py-2.5">
                  <p className="text-[10px] font-semibold text-[#71717A] uppercase">{t('admin:laborCost.detailKpi.lateDays')}</p>
                  <p className={`text-lg font-bold ${detailWorker.lateDays > 0 ? 'text-amber-600' : 'text-[#0A0A0A]'}`}>{detailWorker.lateDays}</p>
                </div>
                <div className="bg-[#FAFAFA] rounded-lg px-3 py-2.5">
                  <p className="text-[10px] font-semibold text-[#71717A] uppercase">{t('admin:laborCost.detailKpi.absences')}</p>
                  <p className={`text-lg font-bold ${detailWorker.absences > 0 ? 'text-red-600' : 'text-[#0A0A0A]'}`}>{detailWorker.absences}</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                  <p className="text-[10px] font-semibold text-amber-700 uppercase">{t('admin:laborCost.detailKpi.projectedCost')}</p>
                  <p className="text-lg font-bold text-amber-800">{detailWorker.cost != null ? fmtAmount(detailWorker.cost) : '—'}</p>
                </div>
              </div>

              {/* Last payment info card */}
              {detailWorker.lastPaymentDate && (
                <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
                  <Banknote className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-emerald-800">{t('admin:laborCost.lastPaymentInfo')}</p>
                    <p className="text-xs text-emerald-700">
                      {fmtDateTime(detailWorker.lastPaymentDate, i18n.language)} — <span className="font-mono font-semibold">{fmtAmount((detailWorker.lastPaymentAmountCents ?? 0) / 100)}</span>
                    </p>
                  </div>
                </div>
              )}

              {/* Daily entries table */}
              <div className="overflow-x-auto border border-[#D4D4D8] rounded-lg">
                {detailWorker.displayEntries.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-sm text-[#71717A]">{t('admin:laborCost.noEntriesMatch')}</p>
                  </div>
                ) : (
                  <table className="w-full min-w-[900px]">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-[#FAFAFA]">
                        {[
                          t('admin:laborCost.detailTable.date'),
                          t('admin:laborCost.detailTable.project'),
                          t('admin:laborCost.detailTable.in'),
                          t('admin:laborCost.detailTable.out'),
                          t('admin:laborCost.detailTable.break'),
                          t('admin:laborCost.detailTable.transit'),
                          t('admin:laborCost.detailTable.total'),
                          t('admin:laborCost.detailTable.cost'),
                          t('admin:laborCost.detailTable.status'),
                          t('admin:laborCost.detailTable.approvedBy'),
                        ].map(h => (
                          <th key={h} className="text-left text-[10px] font-semibold text-[#71717A] uppercase tracking-wider px-3 py-2 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {detailWorker.displayEntries.map((e, idx) => (
                        <tr key={`${e.date}-${idx}`} className="border-b border-[#D4D4D8]/40 hover:bg-[#FAFAFA]/60">
                          <td className="px-3 py-2.5 text-sm text-[#0A0A0A] whitespace-nowrap">{fmtDate(e.date, i18n.language)}</td>
                          <td className="px-3 py-2.5 text-xs text-[#0A0A0A] max-w-[120px] truncate" title={e.projectName}>{e.projectName}</td>
                          <td className="px-3 py-2.5 font-mono text-sm text-[#0A0A0A] whitespace-nowrap">{e.clockIn ? fmtTime(e.clockIn) : '—'}</td>
                          <td className="px-3 py-2.5 font-mono text-sm text-[#0A0A0A] whitespace-nowrap">{e.clockOut ? fmtTime(e.clockOut) : '—'}</td>
                          <td className="px-3 py-2.5 text-sm text-[#71717A]">{e.lunchMinutes != null ? `${e.lunchMinutes} min` : '—'}</td>
                          <td className="px-3 py-2.5 text-sm">
                            {e.transitMinutes != null ? (
                              <span className="inline-flex items-center gap-1 text-blue-700">
                                <span className="font-mono font-medium">{e.transitMinutes} min</span>
                                {e.transitFromProject && (
                                  <span className="text-[10px] text-blue-500 truncate max-w-[80px]" title={e.transitFromProject}>
                                    <ArrowRight className="w-2.5 h-2.5 inline" /> {e.transitFromProject}
                                  </span>
                                )}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-sm font-semibold text-[#0A0A0A]">{e.totalHours != null ? `${e.totalHours.toFixed(2)} hrs` : '—'}</td>
                          <td className="px-3 py-2.5 font-mono text-xs text-[#0A0A0A]">
                            {e.entryCost != null ? fmtAmount(e.entryCost) : '—'}
                          </td>
                          <td className="px-3 py-2.5"><StatusBadge status={e.approvalStatus} /></td>
                          <td className="px-3 py-2.5 text-sm text-[#71717A]">{e.reviewerName ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-[#FAFAFA] border-t border-[#D4D4D8]">
                        <td colSpan={5} className="px-3 py-2.5 text-xs font-semibold text-[#71717A] uppercase">{t('admin:laborCost.total')}</td>
                        <td className="px-3 py-2.5 font-mono text-xs font-semibold text-blue-700">
                          {detailWorker.displayEntries.reduce((s, e) => s + (e.transitMinutes ?? 0), 0)} min
                        </td>
                        <td className="px-3 py-2.5 font-mono text-sm font-semibold text-[#0A0A0A]">
                          {detailWorker.displayEntries.reduce((s, e) => s + (e.totalHours ?? 0), 0).toFixed(2)} hrs
                        </td>
                        <td className="px-3 py-2.5 font-mono text-sm font-semibold text-[#F97316]">
                          {detailWorker.cost != null ? fmtAmount(detailWorker.cost) : '—'}
                        </td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>

              {/* Per-project breakdown */}
              {(() => {
                const projectMap = new Map<string, { hours: number; cost: number; days: number }>();
                for (const e of detailWorker.displayEntries) {
                  const existing = projectMap.get(e.projectName) ?? { hours: 0, cost: 0, days: 0 };
                  existing.hours += e.totalHours ?? 0;
                  existing.cost += e.entryCost ?? 0;
                  existing.days += 1;
                  projectMap.set(e.projectName, existing);
                }
                if (projectMap.size <= 1) return null;
                return (
                  <div className="bg-white border border-[#D4D4D8] rounded-lg overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-3 border-b border-[#D4D4D8] bg-[#FAFAFA]">
                      <TrendingUp className="w-3.5 h-3.5 text-[#71717A]" />
                      <span className="text-xs font-semibold text-[#0A0A0A]">{t('admin:laborCost.projectBreakdown')}</span>
                    </div>
                    <div className="divide-y divide-[#D4D4D8]/50">
                      {[...projectMap.entries()].map(([name, data]) => (
                        <div key={name} className="flex items-center justify-between px-4 py-2.5">
                          <div>
                            <p className="text-sm font-medium text-[#0A0A0A]">{name}</p>
                            <p className="text-[11px] text-[#71717A]">{data.days} {t('admin:laborCost.days')}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-mono font-semibold text-[#0A0A0A]">{data.hours.toFixed(2)} hrs</p>
                            <p className="text-xs font-mono text-[#71717A]">{fmtAmount(data.cost)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDetailWorker(null)}>{t('common:buttons.close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
