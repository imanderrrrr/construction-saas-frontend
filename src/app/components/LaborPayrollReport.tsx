import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Clock, DollarSign, AlertTriangle, Filter, Download,
  FileSpreadsheet, FileText, Users, Info, CheckCircle,
  Banknote, History, Loader2,
} from 'lucide-react';
import { Button } from './ui/button';
import { StatCard } from './StatCard';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from './ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  DialogDescription,
} from './ui/dialog';
import { EmptyState } from './EmptyState';
import { Skeleton } from './ui/skeleton';
import { toast } from 'sonner';
import {
  getAdminHoursReport,
  confirmPayment,
  getPaymentHistory,
  type AdminHoursReportResponse,
  type WorkerHoursSummary,
  type LaborPaymentResponse,
} from '../services/time';
import { listProjects, type ProjectResponse } from '../services/projects';
import { listActiveUsers, type UserDTO } from '../services/users';
import { exportPayrollExcel } from '../helpers/exportPayrollExcel';
import { exportPayrollPdf } from '../helpers/exportPayrollPdf';
import { businessToday, nDaysAgo } from '../helpers/dateTime';

// Helpers

function fmtAmount(n: number) {
  return `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}
function fmtDate(iso: string, locale = 'en-US') {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtDateTime(iso: string, locale = 'en-US') {
  const d = new Date(iso);
  return d.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

type PeriodPreset = 'custom' | 'weekly' | 'biweekly' | 'monthly';

// Component

export function LaborPayrollReport() {
  const { t, i18n } = useTranslation(['admin', 'common']);

  // Date helpers for presets
  const todayStr = businessToday();
  const monthStart = todayStr.slice(0, 8) + '01';

  // Filter state
  const [dateFrom, setDateFrom] = useState(monthStart);
  const [dateTo, setDateTo] = useState(todayStr);
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('monthly');
  const [filterProject, setFilterProject] = useState('all');
  const [filterWorker, setFilterWorker] = useState('all');

  // Data state
  const [report, setReport] = useState<AdminHoursReportResponse | null>(null);
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [users, setUsers] = useState<UserDTO[]>([]);
  const [uiState, setUiState] = useState<'loading' | 'data' | 'error'>('loading');

  // Payment confirmation state
  const [confirmWorker, setConfirmWorker] = useState<WorkerHoursSummary | null>(null);
  const [confirmNotes, setConfirmNotes] = useState('');
  const [confirming, setConfirming] = useState(false);

  // Payment history state
  const [showHistory, setShowHistory] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<LaborPaymentResponse[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const hasFilters = filterProject !== 'all' || filterWorker !== 'all';

  // Load filter options on mount
  useEffect(() => {
    Promise.all([
      listProjects({ status: 'ACTIVE', size: 100 }).then(p => setProjects(p.content)),
      listActiveUsers().then(u => setUsers(u)),
    ]).catch(err => toast.error(err?.message));
  }, []);

  function applyPreset(preset: PeriodPreset) {
    setPeriodPreset(preset);
    const today = businessToday();
    if (preset === 'weekly') {
      setDateFrom(nDaysAgo(6));
      setDateTo(today);
    } else if (preset === 'biweekly') {
      setDateFrom(nDaysAgo(13));
      setDateTo(today);
    } else if (preset === 'monthly') {
      setDateFrom(today.slice(0, 8) + '01');
      setDateTo(today);
    }
  }

  // Fetch report data
  const fetchReport = useCallback(async () => {
    setUiState('loading');
    try {
      const data = await getAdminHoursReport({
        dateFrom,
        dateTo,
        projectId: filterProject !== 'all' ? Number(filterProject) : undefined,
        workerId: filterWorker !== 'all' ? Number(filterWorker) : undefined,
      });
      setReport(data);
      setUiState('data');
    } catch {
      setUiState('error');
    }
  }, [dateFrom, dateTo, filterProject, filterWorker]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  // Compute payroll data from API response
  const filtered = useMemo(() => {
    if (!report) return [];
    return report.workers;
  }, [report]);

  const totalHours = report?.kpis.totalApprovedHours ?? 0;
  const totalPay = report?.kpis.totalLaborCost ?? 0;
  const workersWithRate = filtered.filter(w => w.hourlyRate != null).length;
  const workersWithoutRate = filtered.filter(w => w.hourlyRate == null && (w.unpaidApprovedHours ?? w.totalApprovedHours) > 0);

  function clearFilters() {
    setFilterProject('all');
    setFilterWorker('all');
  }

  // Confirm payment handler
  async function handleConfirmPayment() {
    if (!confirmWorker) return;
    setConfirming(true);
    try {
      const result = await confirmPayment({
        workerId: confirmWorker.workerId,
        periodFrom: dateFrom,
        periodTo: dateTo,
        notes: confirmNotes || null,
      });
      toast.success(
        t('admin:payroll.paymentConfirmed'),
        { description: t('admin:payroll.paymentConfirmedDesc', { name: confirmWorker.workerName ?? confirmWorker.workerUsername }) }
      );
      if (result.budgetWarnings?.length) {
        for (const w of result.budgetWarnings) {
          const names = w.pendingWorkers.map(p => `${p.workerName ?? `ID ${p.workerId}`} (${p.unpaidHours.toFixed(1)}h)`).join(', ');
          toast.warning(t('common:budgetWarning.title', 'Pending labour payments'), {
            description: `${t('common:budgetWarning.desc', 'Remaining budget')} ($${(w.remainingBudgetCents / 100).toFixed(2)}) ${t('common:budgetWarning.insufficient', 'cannot cover projected payroll')} ($${(w.projectedLaborCostCents / 100).toFixed(2)}): ${names}`,
            duration: 10000,
          });
        }
      }
      setConfirmWorker(null);
      setConfirmNotes('');
      fetchReport(); // Refresh to show updated data
    } catch (err: any) {
      const msg = err?.message || 'Payment failed';
      toast.error(msg);
    } finally {
      setConfirming(false);
    }
  }

  // Load payment history
  async function handleShowHistory() {
    setShowHistory(true);
    setHistoryLoading(true);
    try {
      const history = await getPaymentHistory({
        workerId: filterWorker !== 'all' ? Number(filterWorker) : undefined,
        projectId: filterProject !== 'all' ? Number(filterProject) : undefined,
      });
      setPaymentHistory(history);
    } catch {
      toast.error(t('admin:payroll.historyLoadError'));
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleExportExcel() {
    if (!report || filtered.length === 0) return;
    try {
      toast.success(t('admin:payroll.exportStarted'), { description: t('admin:payroll.generatingExcel') });
      await exportPayrollExcel({
        workers: filtered,
        kpis: report.kpis,
        dateFrom,
        dateTo,
        reportTitle: 'Labor Payroll',
      });
    } catch {
      toast.error(t('admin:payroll.exportFailed', 'Export failed'));
    }
  }

  function handleExportPdf() {
    if (!report || filtered.length === 0) return;
    try {
      toast.success(t('admin:payroll.exportStarted'), { description: t('admin:payroll.generatingPdf') });
      exportPayrollPdf({
        workers: filtered,
        kpis: report.kpis,
        dateFrom,
        dateTo,
        reportTitle: 'Labor Payroll',
      });
    } catch {
      toast.error(t('admin:payroll.exportFailed', 'Export failed'));
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
              <p className="text-sm font-semibold text-red-900">{t('admin:payroll.errorTitle')}</p>
              <p className="text-xs text-red-600 mt-0.5">{t('admin:payroll.errorDesc')}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchReport}
            className="border-red-200 text-red-700 hover:bg-red-50 gap-2">
            {t('common:buttons.retry')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">

      {/* Info banner */}
      <div className="flex items-center gap-2 bg-[#F97316]/5 border border-[#F97316]/20 rounded-xl px-4 py-3">
        <Info className="w-4 h-4 text-[#F97316] flex-shrink-0" />
        <p className="text-xs text-[#F97316]">{t('admin:payroll.infoBannerPayment')}</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} title={t('admin:payroll.kpi.totalWorkers')} value={String(filtered.length)}
          subtitle={t('admin:payroll.withRateDefined', { count: workersWithRate })} iconBgColor="bg-[#C2410C]/10" iconColor="text-[#C2410C]" />
        <StatCard icon={CheckCircle} title={t('admin:payroll.totalApprovedHours')} value={`${totalHours.toFixed(2)} hrs`}
          subtitle={`${fmtDate(dateFrom, i18n.language)} — ${fmtDate(dateTo, i18n.language)}`} iconBgColor="bg-emerald-50" iconColor="text-emerald-600" />
        <StatCard icon={DollarSign} title={t('admin:payroll.kpi.totalPayroll')} value={fmtAmount(totalPay)}
          subtitle={t('admin:payroll.projectedNotDeducted')} iconBgColor="bg-[#F97316]/10" iconColor="text-[#F97316]" />
        <StatCard icon={Banknote} title={t('admin:payroll.pendingPayments')} value={String(filtered.filter(w => w.hourlyRate != null && (w.unpaidApprovedHours ?? w.totalApprovedHours) > 0).length)}
          subtitle={t('admin:payroll.workersAwaitingPayment')} iconBgColor="bg-amber-50" iconColor="text-amber-600" />
      </div>

      {/* Period selector + Filters */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-[#71717A]" />
          <span className="text-sm font-semibold text-[#0A0A0A]">{t('admin:payroll.periodFilters')}</span>
        </div>

        {/* Period presets */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('admin:payroll.periodLabel')}</span>
          {([
            { key: 'weekly' as PeriodPreset, label: t('admin:payroll.weekly') },
            { key: 'biweekly' as PeriodPreset, label: t('admin:payroll.biweekly') },
            { key: 'monthly' as PeriodPreset, label: t('admin:payroll.monthly') },
            { key: 'custom' as PeriodPreset, label: t('admin:payroll.custom') },
          ]).map(p => (
            <button key={p.key} onClick={() => applyPreset(p.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                periodPreset === p.key
                  ? 'bg-[#F97316] text-white border-[#F97316]'
                  : 'bg-white text-[#71717A] border-[#D4D4D8] hover:border-[#F97316] hover:text-[#F97316]'
              }`}>
              {p.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1 block">{t('admin:payroll.from')}</label>
            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPeriodPreset('custom'); }}
              className="h-9 w-full rounded-md border border-[#D4D4D8] px-3 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#F97316]/40" />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1 block">{t('admin:payroll.to')}</label>
            <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPeriodPreset('custom'); }}
              className="h-9 w-full rounded-md border border-[#D4D4D8] px-3 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#F97316]/40" />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1 block">{t('admin:payroll.project')}</label>
            <Select value={filterProject} onValueChange={setFilterProject}>
              <SelectTrigger className="h-9 text-sm border-[#D4D4D8]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common:labels.all')}</SelectItem>
                {projects.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1 block">{t('admin:payroll.workerLabel')}</label>
            <Select value={filterWorker} onValueChange={setFilterWorker}>
              <SelectTrigger className="h-9 text-sm border-[#D4D4D8]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('admin:payroll.allWorkers')}</SelectItem>
                {users.filter(u => u.role === 'WORKER' || u.role === 'SUPERVISOR').map(u => (
                  <SelectItem key={u.id} value={String(u.id)}>{u.fullName ?? u.username}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {hasFilters && (
          <div className="mt-3 pt-3 border-t border-[#FAFAFA]">
            <button onClick={clearFilters} className="text-xs font-medium text-[#F97316] hover:text-[#C2410C] transition-colors">
              {t('admin:payroll.clearFilters')}
            </button>
          </div>
        )}
      </div>

      {/* Workers without rate warning */}
      {workersWithoutRate.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-semibold text-amber-800">
              {t('admin:payroll.workersWithoutRate', { count: workersWithoutRate.length })}
            </span>
          </div>
        </div>
      )}

      {/* Table + Export + History */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-6 py-4 border-b border-[#D4D4D8] flex-wrap">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#71717A]" />
            <span className="text-sm font-semibold text-[#0A0A0A]">{t('admin:payroll.payrollSummary')}</span>
            <span className="text-xs text-[#71717A]">{t('admin:payroll.workerCount', { count: filtered.length })}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleShowHistory}
              className="h-8 text-xs gap-1.5 border-[#D4D4D8] text-[#0A0A0A] hover:border-purple-400 hover:text-purple-700">
              <History className="w-3.5 h-3.5" />{t('admin:payroll.viewHistory')}
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportExcel}
              className="h-8 text-xs gap-1.5 border-[#D4D4D8] text-[#0A0A0A] hover:border-emerald-400 hover:text-emerald-700">
              <FileSpreadsheet className="w-3.5 h-3.5" />{t('admin:payroll.exportExcel')}
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPdf}
              className="h-8 text-xs gap-1.5 border-[#D4D4D8] text-[#0A0A0A] hover:border-red-400 hover:text-red-700">
              <FileText className="w-3.5 h-3.5" />{t('admin:payroll.exportPdf')}
            </Button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="py-8">
            <EmptyState icon={Clock} title={t('admin:payroll.noApprovedHours')} description={t('admin:payroll.noApprovedHoursHint')} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px]">
              <thead>
                <tr className="bg-[#FAFAFA]">
                  {[
                    t('admin:payroll.table.worker'),
                    t('admin:payroll.table.hourlyRate'),
                    t('admin:payroll.table.approvedHours'),
                    t('admin:payroll.table.transitHours'),
                    t('admin:payroll.table.totalToPay'),
                    t('admin:payroll.table.lastPayment'),
                    t('admin:payroll.table.actions'),
                  ].map(h => (
                    <th key={h} className="text-left text-[11px] font-semibold text-[#71717A] uppercase tracking-wider px-4 py-2.5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(w => {
                  const projectNames = [...new Set(w.dailyEntries.map(e => e.projectName))].join(', ');
                  const transitMins = w.dailyEntries.filter(e => !e.paid).reduce((sum, e) => sum + (e.transitMinutes ?? 0), 0);
                  const transitHrsNum = transitMins / 60;
                  const transitHrs = transitMins > 0 ? transitHrsNum.toFixed(1) : null;
                  const unpaidHrs = w.unpaidApprovedHours ?? w.totalApprovedHours;
                  const total = w.projectedCost ?? (w.hourlyRate != null ? unpaidHrs * w.hourlyRate : null);
                  const canPay = w.hourlyRate != null && unpaidHrs > 0;
                  return (
                    <tr key={w.workerId} className="border-b border-[#D4D4D8]/50 hover:bg-[#FAFAFA]/60 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-[#0A0A0A]">{w.workerName ?? w.workerUsername}</p>
                          <p className="text-[11px] text-[#71717A]">{projectNames}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-sm text-[#0A0A0A]">
                        {w.hourlyRate != null ? `$${w.hourlyRate.toFixed(2)}` : (
                          <span className="text-amber-600 flex items-center gap-1 text-xs">
                            <AlertTriangle className="w-3 h-3" />{t('admin:payroll.notDefined')}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-sm text-[#0A0A0A]">{(w.unpaidApprovedHours ?? w.totalApprovedHours).toFixed(2)} hrs</td>
                      <td className="px-4 py-3 font-mono text-sm text-blue-600">
                        {transitHrs != null ? `${transitHrs} hrs` : <span className="text-[#D4D4D8]">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {total != null ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-sm font-semibold text-[#0A0A0A]">{fmtAmount(total)}</span>
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-amber-100 text-amber-700 border border-amber-200">
                              {t('admin:payroll.pending')}
                            </span>
                          </div>
                        ) : <span className="text-[#D4D4D8]">—</span>}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {w.lastPaymentDate ? (
                          <div>
                            <p className="text-xs text-[#0A0A0A]">{fmtDate(w.lastPaymentDate.slice(0, 10), i18n.language)}</p>
                            <p className="text-[11px] text-[#71717A] font-mono">{fmtAmount((w.lastPaymentAmountCents ?? 0) / 100)}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-[#71717A] italic">{t('admin:payroll.neverPaid')}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {canPay ? (
                          <Button size="sm" onClick={() => { setConfirmWorker(w); setConfirmNotes(''); }}
                            className="h-7 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white gap-1">
                            <Banknote className="w-3 h-3" />{t('admin:payroll.confirmPay')}
                          </Button>
                        ) : (
                          <span className="text-xs text-[#D4D4D8]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-[#FAFAFA] border-t border-[#D4D4D8]">
                  <td className="px-4 py-3 text-xs font-semibold text-[#71717A] uppercase">{t('admin:payroll.total')}</td>
                  <td />
                  <td className="px-4 py-3 font-mono text-sm font-semibold text-[#0A0A0A]">{totalHours.toFixed(2)} hrs</td>
                  <td />
                  <td className="px-4 py-3 font-mono text-sm font-semibold text-[#F97316]">{fmtAmount(totalPay)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Footer */}
        {filtered.length > 0 && (
          <div className="px-6 py-3 border-t border-[#D4D4D8]/50 bg-[#FAFAFA]/50 flex items-center justify-between flex-wrap gap-2">
            <p className="text-[11px] text-[#71717A]">{t('admin:payroll.periodRange', { from: dateFrom, to: dateTo })}</p>
            <p className="text-[11px] font-medium text-[#0A0A0A]">
              {t('admin:payroll.grandTotal')} <span className="font-mono font-semibold">{fmtAmount(totalPay)}</span>
            </p>
          </div>
        )}
      </div>

      {/* Confirm Payment Dialog */}
      <Dialog open={!!confirmWorker} onOpenChange={open => { if (!open) setConfirmWorker(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="w-5 h-5 text-emerald-600" />
              {t('admin:payroll.confirmPaymentTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('admin:payroll.confirmPaymentDesc')}
            </DialogDescription>
          </DialogHeader>

          {confirmWorker && (() => {
            const transitMins = confirmWorker.dailyEntries.filter(e => !e.paid).reduce((s, e) => s + (e.transitMinutes ?? 0), 0);
            const transitHrsNum = transitMins / 60;
            const unpaidHrs = confirmWorker.unpaidApprovedHours ?? confirmWorker.totalApprovedHours;
            const total = confirmWorker.projectedCost ?? (confirmWorker.hourlyRate != null ? unpaidHrs * confirmWorker.hourlyRate : 0);
            return (
              <div className="space-y-4">
                {/* Payment summary */}
                <div className="bg-[#FAFAFA] rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#71717A]">{t('admin:payroll.table.worker')}</span>
                    <span className="text-sm font-semibold text-[#0A0A0A]">{confirmWorker.workerName ?? confirmWorker.workerUsername}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#71717A]">{t('admin:payroll.period')}</span>
                    <span className="text-sm text-[#0A0A0A]">{fmtDate(dateFrom, i18n.language)} — {fmtDate(dateTo, i18n.language)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#71717A]">{t('admin:payroll.table.approvedHours')}</span>
                    <span className="text-sm font-mono text-[#0A0A0A]">{(confirmWorker.unpaidApprovedHours ?? confirmWorker.totalApprovedHours).toFixed(2)} hrs</span>
                  </div>
                  {transitMins > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#71717A]">{t('admin:payroll.table.transitHours')}</span>
                      <span className="text-sm font-mono text-blue-600">{transitHrsNum.toFixed(1)} hrs</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#71717A]">{t('admin:payroll.table.hourlyRate')}</span>
                    <span className="text-sm font-mono text-[#0A0A0A]">${confirmWorker.hourlyRate?.toFixed(2)}/hr</span>
                  </div>
                  <div className="border-t border-[#D4D4D8] pt-3 flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#0A0A0A]">{t('admin:payroll.table.totalToPay')}</span>
                    <span className="text-lg font-mono font-bold text-emerald-700">{fmtAmount(total ?? 0)}</span>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1 block">
                    {t('admin:payroll.notesOptional')}
                  </label>
                  <textarea
                    value={confirmNotes}
                    onChange={e => setConfirmNotes(e.target.value)}
                    placeholder={t('admin:payroll.notesPlaceholder')}
                    rows={2}
                    className="w-full rounded-md border border-[#D4D4D8] px-3 py-2 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#F97316]/40 resize-none"
                  />
                </div>

                {/* Warning */}
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                  <p className="text-xs text-amber-700">{t('admin:payroll.confirmWarning')}</p>
                </div>
              </div>
            );
          })()}

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setConfirmWorker(null)} disabled={confirming}>
              {t('common:buttons.cancel')}
            </Button>
            <Button onClick={handleConfirmPayment} disabled={confirming}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
              {confirming && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {t('admin:payroll.confirmAndPay')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment History Dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-purple-600" />
              {t('admin:payroll.paymentHistory')}
            </DialogTitle>
          </DialogHeader>

          <div className="overflow-y-auto max-h-[60vh]">
            {historyLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
              </div>
            ) : paymentHistory.length === 0 ? (
              <div className="py-8">
                <EmptyState icon={History} title={t('admin:payroll.noPaymentHistory')} description={t('admin:payroll.noPaymentHistoryDesc')} />
              </div>
            ) : (
              <table className="w-full min-w-[700px]">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-[#FAFAFA]">
                    {[
                      t('admin:payroll.history.date'),
                      t('admin:payroll.history.worker'),
                      t('admin:payroll.history.period'),
                      t('admin:payroll.history.hours'),
                      t('admin:payroll.history.amount'),
                      t('admin:payroll.history.confirmedBy'),
                      t('admin:payroll.history.notes'),
                    ].map(h => (
                      <th key={h} className="text-left text-[10px] font-semibold text-[#71717A] uppercase tracking-wider px-3 py-2 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paymentHistory.map(p => (
                    <tr key={p.id} className="border-b border-[#D4D4D8]/40 hover:bg-[#FAFAFA]/60">
                      <td className="px-3 py-2.5 text-xs text-[#0A0A0A] whitespace-nowrap">{fmtDateTime(p.createdAt, i18n.language)}</td>
                      <td className="px-3 py-2.5">
                        <p className="text-sm font-medium text-[#0A0A0A]">{p.workerName ?? p.workerUsername}</p>
                        {p.projectName && <p className="text-[10px] text-[#71717A]">{p.projectName}</p>}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-[#0A0A0A]">
                        {fmtDate(p.periodFrom, i18n.language)} — {fmtDate(p.periodTo, i18n.language)}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs text-[#0A0A0A]">
                        {p.approvedHours.toFixed(2)} hrs
                        {p.transitHours > 0 && <span className="text-blue-600 ml-1">(+{p.transitHours.toFixed(1)} transit)</span>}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-sm font-semibold text-emerald-700">{fmtAmount(p.amountCents / 100)}</td>
                      <td className="px-3 py-2.5 text-xs text-[#71717A]">{p.confirmedBy}</td>
                      <td className="px-3 py-2.5 text-xs text-[#71717A] max-w-[150px] truncate" title={p.notes ?? ''}>{p.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowHistory(false)}>{t('common:buttons.close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
