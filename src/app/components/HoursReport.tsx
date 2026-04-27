import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Clock, TrendingUp, AlertTriangle, UserX,
  Download, ChevronDown, ChevronRight,
  Filter as FilterIcon, FileText, FileSpreadsheet, Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { StatCard } from './StatCard';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from './ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from './ui/select';
import { EmptyState } from './EmptyState';
import {
  getAdminHoursReport,
} from '../services/time';
import type {
  AdminHoursReportResponse,
  WorkerHoursSummary,
  DailyEntryDetail,
  HoursReportKpis,
} from '../services/time';
import { listActiveUsers } from '../services/users';
import type { UserDTO } from '../services/users';
import { listProjects } from '../services/projects';
import type { ProjectResponse } from '../services/projects';
import { businessToday, nDaysAgo } from '../helpers/dateTime';

// Constants

const ITEMS_PER_PAGE = 10;

// Status configs

type SummaryStatus = 'on-track' | 'needs-attention' | 'critical';

const SUMMARY_STATUS_CFG: Record<SummaryStatus, {
  label: string; bg: string; text: string; border: string; dot: string;
}> = {
  'on-track':        { label: 'On Track',        bg: 'bg-emerald-50',  text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  'needs-attention': { label: 'Needs Attention', bg: 'bg-amber-50',    text: 'text-amber-700',   border: 'border-amber-200',  dot: 'bg-amber-500'   },
  'critical':        { label: 'Critical',        bg: 'bg-red-50',      text: 'text-red-700',     border: 'border-red-200',    dot: 'bg-red-500'     },
};

type EntryStatus = 'APPROVED' | 'PENDING' | 'OBSERVED' | 'REJECTED';

const ENTRY_STATUS_CFG: Record<EntryStatus, {
  label: string; bg: string; text: string; border: string; dot: string;
}> = {
  APPROVED: { label: 'Approved',  bg: 'bg-emerald-50',    text: 'text-emerald-700', border: 'border-emerald-200',   dot: 'bg-emerald-500' },
  PENDING:  { label: 'Pending',   bg: 'bg-[#FAFAFA]',     text: 'text-[#71717A]',  border: 'border-[#D4D4D8]',     dot: 'bg-[#D4D4D8]'  },
  OBSERVED: { label: 'Corrected', bg: 'bg-[#F97316]/10',  text: 'text-[#F97316]',  border: 'border-[#F97316]/20',  dot: 'bg-[#F97316]'  },
  REJECTED: { label: 'Rejected',  bg: 'bg-red-50',        text: 'text-red-700',     border: 'border-red-200',       dot: 'bg-red-500'     },
};

// Date helpers

function getToday(): string {
  return businessToday();
}
function getSevenDaysAgo(): string {
  return nDaysAgo(7);
}
/** "2026-02-17" → "Mon, Feb 17" */
function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

/** "08:15" or "08:15:30" → "8:15 AM" */
function fmtTime(timeStr: string): string {
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, '0')} ${ampm}`;
}

function deriveStatus(w: WorkerHoursSummary): SummaryStatus {
  if (w.absences >= 2 || w.lateDays >= 3) return 'critical';
  if (w.absences >= 1 || w.lateDays >= 2) return 'needs-attention';
  return 'on-track';
}

// Sub-components

function SummaryBadge({ status }: { status: SummaryStatus }) {
  const c = SUMMARY_STATUS_CFG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${c.bg} ${c.text} ${c.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
      {c.label}
    </span>
  );
}

function EntryBadge({ status }: { status: string }) {
  const c = ENTRY_STATUS_CFG[status as EntryStatus] ?? ENTRY_STATUS_CFG.PENDING;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${c.bg} ${c.text} ${c.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
      {c.label}
    </span>
  );
}

function WorkerAvatar({ name }: { name: string }) {
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-full bg-[#F97316]/10 flex items-center justify-center flex-shrink-0">
        <span className="text-[11px] font-bold text-[#F97316]">{initials}</span>
      </div>
      <span className="text-sm font-medium text-[#0A0A0A] whitespace-nowrap">{name}</span>
    </div>
  );
}

function NullCell() {
  return <span className="font-mono text-sm text-[#D4D4D8]">—</span>;
}

function Pagination({
  currentPage, totalPages, onPageChange,
}: { currentPage: number; totalPages: number; onPageChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-1 py-4 border-t border-[#D4D4D8]">
      <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}
        className="h-8 px-3 rounded-lg text-xs font-medium text-[#71717A] hover:text-[#0A0A0A] hover:bg-[#FAFAFA] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
        ← Prev
      </button>
      {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
        <button key={p} onClick={() => onPageChange(p)}
          className={`h-8 w-8 rounded-lg text-xs font-semibold transition-colors ${
            p === currentPage ? 'bg-[#F97316] text-white' : 'text-[#71717A] hover:text-[#0A0A0A] hover:bg-[#FAFAFA]'
          }`}>{p}</button>
      ))}
      <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages}
        className="h-8 px-3 rounded-lg text-xs font-medium text-[#71717A] hover:text-[#0A0A0A] hover:bg-[#FAFAFA] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
        Next →
      </button>
    </div>
  );
}

// Daily breakdown mini-table

function DailyBreakdown({ entries, dateFrom, dateTo }: { entries: DailyEntryDetail[]; dateFrom: string; dateTo: string }) {
  if (entries.length === 0) {
    return (
      <div className="bg-[#FAFAFA] rounded-xl border border-[#D4D4D8] p-4 text-center">
        <p className="text-xs text-[#71717A]">No daily entries for this period.</p>
      </div>
    );
  }
  return (
    <div className="bg-[#FAFAFA] rounded-xl border border-[#D4D4D8] overflow-hidden">
      <div className="px-4 py-2.5 border-b border-[#D4D4D8] bg-white">
        <p className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider">
          Daily breakdown · {fmtDate(dateFrom)} – {fmtDate(dateTo)}
        </p>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="bg-white hover:bg-white border-b border-[#D4D4D8]">
            {['Date', 'Project', 'Clock In', 'Lunch', 'Clock Out', 'Total', 'Status'].map(h => (
              <TableHead key={h} className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider py-2">
                {h}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((e, i) => (
            <TableRow key={i} className="border-b border-[#D4D4D8]/40 last:border-0 hover:bg-white/60 transition-colors">
              <TableCell className="py-2 text-xs font-medium text-[#0A0A0A] whitespace-nowrap">
                {fmtDate(e.date)}
              </TableCell>
              <TableCell className="py-2 text-xs text-[#0A0A0A] max-w-[120px] truncate">
                {e.projectName}
              </TableCell>
              <TableCell className="py-2">
                {e.clockIn ? <span className="font-mono text-xs text-[#0A0A0A]">{fmtTime(e.clockIn)}</span> : <NullCell />}
              </TableCell>
              <TableCell className="py-2">
                {e.lunchMinutes != null ? <span className="text-xs text-[#0A0A0A]">{e.lunchMinutes} min</span> : <NullCell />}
              </TableCell>
              <TableCell className="py-2">
                {e.clockOut ? <span className="font-mono text-xs text-[#0A0A0A]">{fmtTime(e.clockOut)}</span> : <NullCell />}
              </TableCell>
              <TableCell className="py-2">
                {e.totalHours != null ? <span className="text-xs font-semibold text-[#0A0A0A]">{e.totalHours}h</span> : <NullCell />}
              </TableCell>
              <TableCell className="py-2">
                <EntryBadge status={e.approvalStatus} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// Main component

export function HoursReport() {
  const { t } = useTranslation('time');
  // Filter state
  const [dateFrom,   setDateFrom]   = useState(getSevenDaysAgo);
  const [dateTo,     setDateTo]     = useState(getToday);
  const [workerSel,  setWorkerSel]  = useState('all');
  const [projectSel, setProjectSel] = useState('all');

  // Applied state (committed on Apply)
  const [appliedFrom,    setAppliedFrom]    = useState(getSevenDaysAgo);
  const [appliedTo,      setAppliedTo]      = useState(getToday);
  const [appliedWorker,  setAppliedWorker]  = useState('all');
  const [appliedProject, setAppliedProject] = useState('all');

  // Data
  const [report, setReport]     = useState<AdminHoursReportResponse | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(false);
  const [workers, setWorkers]   = useState<UserDTO[]>([]);
  const [projects, setProjects] = useState<ProjectResponse[]>([]);

  // UI state
  const [expandedId,  setExpandedId]  = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Load filter options once
  useEffect(() => {
    listActiveUsers().then(u => setWorkers(u.filter(w => w.role === 'WORKER'))).catch(err => toast.error(err?.message));
    listProjects({ page: 0, size: 200 }).then(p => setProjects(p.content)).catch(err => toast.error(err?.message));
  }, []);

  // Fetch report data
  const fetchReport = useCallback(() => {
    setLoading(true);
    setError(false);
    getAdminHoursReport({
      dateFrom: appliedFrom,
      dateTo: appliedTo,
      projectId: appliedProject !== 'all' ? Number(appliedProject) : undefined,
      workerId: appliedWorker !== 'all' ? Number(appliedWorker) : undefined,
    })
      .then(setReport)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [appliedFrom, appliedTo, appliedWorker, appliedProject]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  // Derived data
  const workersList = report?.workers ?? [];
  const kpis: HoursReportKpis = report?.kpis ?? { totalApprovedHours: 0, avgHoursPerDay: 0, lateArrivals: 0, absentDays: 0 };
  const totalPages = Math.max(1, Math.ceil(workersList.length / ITEMS_PER_PAGE));
  const paginated = workersList.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  // Handlers: filters
  function handleApply() {
    setAppliedFrom(dateFrom);
    setAppliedTo(dateTo);
    setAppliedWorker(workerSel);
    setAppliedProject(projectSel);
    setCurrentPage(1);
    setExpandedId(null);
  }
  function handleReset() {
    const ago = getSevenDaysAgo(), tod = getToday();
    setDateFrom(ago);     setDateTo(tod);
    setWorkerSel('all');  setProjectSel('all');
    setAppliedFrom(ago);  setAppliedTo(tod);
    setAppliedWorker('all'); setAppliedProject('all');
    setCurrentPage(1);    setExpandedId(null);
  }

  // Export handler
  async function handleExport(format: 'pdf' | 'excel') {
    if (!report || workersList.length === 0) return;
    try {
      const params = {
        workers: workersList,
        kpis,
        dateFrom: appliedFrom,
        dateTo: appliedTo,
        reportTitle: t('report.title'),
      };
      if (format === 'excel') {
        const { exportPayrollExcel } = await import('../helpers/exportPayrollExcel');
        await exportPayrollExcel(params);
      } else {
        const { exportPayrollPdf } = await import('../helpers/exportPayrollPdf');
        exportPayrollPdf(params);
      }
      toast.success(t('report.exportSuccess', 'Export started'));
    } catch {
      toast.error(t('report.exportError', 'Export failed'));
    }
  }

  const hasActiveFilters = appliedWorker !== 'all' || appliedProject !== 'all';

  // Render
  return (
    <div className="space-y-6">

      {/* Page header */}
      <div>
        <h2 className="text-sm font-semibold text-[#0A0A0A]">{t('report.kpi.totalHours')}</h2>
        <p className="text-[11px] text-[#71717A] mt-0.5">{t('report.kpi.onTimeEntries')}</p>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] p-5">
        <div className="flex items-center gap-2 mb-4">
          <FilterIcon className="w-4 h-4 text-[#71717A]" />
          <span className="text-sm font-semibold text-[#0A0A0A]">{t('buttons.filters', { ns: 'common' })}</span>
          {hasActiveFilters && (
            <span className="px-1.5 py-0.5 bg-[#F97316]/10 text-[#F97316] text-[10px] font-medium rounded-full">
              Active
            </span>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-end gap-3">
          {/* From */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('labels.from', { ns: 'common' })}</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="h-9 rounded-lg border border-[#D4D4D8] bg-white px-3 text-sm text-[#0A0A0A]
                         focus:outline-none focus:ring-2 focus:ring-[#F97316]/25 focus:border-[#F97316] transition-colors" />
          </div>

          {/* To */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('labels.to', { ns: 'common' })}</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="h-9 rounded-lg border border-[#D4D4D8] bg-white px-3 text-sm text-[#0A0A0A]
                         focus:outline-none focus:ring-2 focus:ring-[#F97316]/25 focus:border-[#F97316] transition-colors" />
          </div>

          {/* Worker */}
          <div className="flex flex-col gap-1.5 min-w-[160px]">
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('report.filters.worker')}</label>
            <Select value={workerSel} onValueChange={setWorkerSel}>
              <SelectTrigger className="h-9 border-[#D4D4D8] text-sm">
                <SelectValue placeholder="All Workers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('report.filters.allWorkers')}</SelectItem>
                {workers.map(w => (
                  <SelectItem key={w.id} value={String(w.id)}>
                    {w.fullName ?? w.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Project */}
          <div className="flex flex-col gap-1.5 min-w-[160px]">
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('labels.project', { ns: 'common' })}</label>
            <Select value={projectSel} onValueChange={setProjectSel}>
              <SelectTrigger className="h-9 border-[#D4D4D8] text-sm">
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('labels.allProjects', { ns: 'common' })}</SelectItem>
                {projects.map(p => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1" />

          {/* Apply / Reset */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button variant="outline" size="sm" onClick={handleReset}
              className="h-9 px-4 text-xs border-[#D4D4D8] text-[#71717A] hover:text-[#0A0A0A]">
              {t('buttons.reset', { ns: 'common' })}
            </Button>
            <Button size="sm" onClick={handleApply}
              className="h-9 px-4 text-xs bg-[#F97316] hover:bg-[#C2410C] text-white">
              {t('buttons.apply', { ns: 'common' })}
            </Button>
          </div>
        </div>

        <p className="text-[11px] text-[#71717A] mt-3 pt-3 border-t border-[#FAFAFA]">
          Showing <span className="font-medium text-[#0A0A0A]">{workersList.length}</span> worker{workersList.length !== 1 ? 's' : ''} ·{' '}
          <span className="font-medium text-[#0A0A0A]">{fmtDate(appliedFrom)}</span>
          {' '}to{' '}
          <span className="font-medium text-[#0A0A0A]">{fmtDate(appliedTo)}</span>
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Clock}         title={t('report.kpi.totalHours')}    value={`${kpis.totalApprovedHours}h`} subtitle={t('report.table.status')}        iconBgColor="bg-[#F97316]/10" iconColor="text-[#F97316]"   isLoading={loading} isError={error} />
        <StatCard icon={TrendingUp}    title={t('report.kpi.onTimeEntries')}  value={`${kpis.avgHoursPerDay}h`}     subtitle={t('report.table.worker')}    iconBgColor="bg-emerald-50"   iconColor="text-emerald-600" isLoading={loading} isError={error} />
        <StatCard icon={AlertTriangle} title={t('report.kpi.lateEntries')}  value={String(kpis.lateArrivals)}     subtitle={t('report.table.lateDays')}         iconBgColor="bg-amber-50"     iconColor="text-amber-600"   isLoading={loading} isError={error} />
        <StatCard icon={UserX}         title={t('report.kpi.absentWorkers')}    value={String(kpis.absentDays)}       subtitle={t('report.table.absences')}         iconBgColor="bg-red-50"       iconColor="text-red-600"     isLoading={loading} isError={error} />
      </div>

      {/* Table card */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
        {/* Table card header */}
        <div className="flex items-center gap-2 px-6 py-4 border-b border-[#D4D4D8]">
          <Users className="w-4 h-4 text-[#71717A]" />
          <span className="text-sm font-semibold text-[#0A0A0A]">{t('report.table.worker')}</span>
          <span className="ml-1 text-xs text-[#71717A]">· {workersList.length} worker{workersList.length !== 1 ? 's' : ''}</span>
          <div className="ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm"
                  className="h-8 px-3 text-xs border-[#D4D4D8] text-[#71717A] hover:text-[#0A0A0A] gap-1.5">
                  <Download className="w-3.5 h-3.5" />
                  {t('buttons.export', { ns: 'common' })}
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => handleExport('pdf')} className="text-xs gap-2 cursor-pointer">
                  <FileText className="w-3.5 h-3.5" />
                  {t('buttons.exportPdf', { ns: 'common' })}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('excel')} className="text-xs gap-2 cursor-pointer">
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  {t('buttons.exportCsv', { ns: 'common' })}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="py-12 flex items-center justify-center">
            <div className="animate-pulse flex flex-col items-center gap-2">
              <div className="h-8 w-8 rounded-full border-2 border-[#F97316] border-t-transparent animate-spin" />
              <p className="text-xs text-[#71717A]">Loading hours data…</p>
            </div>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="py-8">
            <EmptyState
              icon={AlertTriangle}
              title={t('error.loadingFailed', { ns: 'common' })}
              description={t('error.generic', { ns: 'common' })}
            />
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && workersList.length === 0 && (
          <div className="py-8">
            <EmptyState
              icon={Users}
              title={t('report.filters.allWorkers')}
              description={t('myHours.emptyHint')}
            />
          </div>
        )}

        {/* Desktop table */}
        {!loading && !error && paginated.length > 0 && (
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#FAFAFA] hover:bg-[#FAFAFA]">
                  <TableHead className="w-8" />
                  {[t('report.table.worker'), t('report.table.onTime'), t('report.table.totalHours'), t('report.kpi.onTimeEntries'), t('report.table.lateDays'), t('report.table.absences'), t('report.table.status')].map(h => (
                    <TableHead key={h} className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.flatMap(w => {
                  const isExpanded = expandedId === w.workerId;
                  const status = deriveStatus(w);
                  const summaryRow = (
                    <TableRow
                      key={`${w.workerId}-row`}
                      onClick={() => setExpandedId(isExpanded ? null : w.workerId)}
                      className={`cursor-pointer border-b border-[#D4D4D8]/50 transition-colors ${
                        isExpanded ? 'bg-[#FAFAFA]' : 'hover:bg-[#FAFAFA]/60'
                      }`}
                    >
                      {/* Chevron */}
                      <TableCell className="py-3 pr-0 pl-4 text-[#71717A]">
                        {isExpanded
                          ? <ChevronDown className="w-3.5 h-3.5" />
                          : <ChevronRight className="w-3.5 h-3.5" />
                        }
                      </TableCell>
                      <TableCell className="py-3"><WorkerAvatar name={w.workerName ?? w.workerUsername} /></TableCell>
                      <TableCell className="py-3">
                        <span className="text-sm font-semibold text-[#0A0A0A]">{w.daysWorked}/{w.totalDays}</span>
                      </TableCell>
                      <TableCell className="py-3">
                        <span className="font-mono text-sm font-semibold text-[#0A0A0A]">{w.totalApprovedHours}h</span>
                      </TableCell>
                      <TableCell className="py-3">
                        <span className="text-sm text-[#0A0A0A]">{w.avgHoursPerDay}h</span>
                      </TableCell>
                      <TableCell className="py-3">
                        <span className={`text-sm font-semibold ${
                          w.lateDays > 0 ? 'text-amber-600' : 'text-emerald-600'
                        }`}>
                          {w.lateDays}
                        </span>
                      </TableCell>
                      <TableCell className="py-3">
                        <span className={`text-sm font-semibold ${
                          w.absences > 0 ? 'text-red-600' : 'text-emerald-600'
                        }`}>
                          {w.absences}
                        </span>
                      </TableCell>
                      <TableCell className="py-3">
                        <SummaryBadge status={status} />
                      </TableCell>
                    </TableRow>
                  );

                  if (!isExpanded) return [summaryRow];

                  const detailRow = (
                    <TableRow key={`${w.workerId}-detail`} className="bg-[#FAFAFA]/50 hover:bg-[#FAFAFA]/50">
                      <TableCell colSpan={8} className="p-4 border-b border-[#D4D4D8]/50">
                        <DailyBreakdown entries={w.dailyEntries} dateFrom={appliedFrom} dateTo={appliedTo} />
                      </TableCell>
                    </TableRow>
                  );

                  return [summaryRow, detailRow];
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Mobile card list */}
        {!loading && !error && paginated.length > 0 && (
          <div className="md:hidden divide-y divide-[#D4D4D8]">
            {paginated.map(w => {
              const isExpanded = expandedId === w.workerId;
              const status = deriveStatus(w);
              return (
                <div key={w.workerId} className="p-4">
                  {/* Card header */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : w.workerId)}
                    className="w-full flex items-center justify-between gap-2"
                  >
                    <WorkerAvatar name={w.workerName ?? w.workerUsername} />
                    <div className="flex items-center gap-2">
                      <SummaryBadge status={status} />
                      {isExpanded
                        ? <ChevronDown className="w-3.5 h-3.5 text-[#71717A]" />
                        : <ChevronRight className="w-3.5 h-3.5 text-[#71717A]" />
                      }
                    </div>
                  </button>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-3 mt-3 pl-[42px]">
                    {[
                      { label: 'Days',    val: `${w.daysWorked}/${w.totalDays}`, mono: false },
                      { label: 'Total',   val: `${w.totalApprovedHours}h`,       mono: true  },
                      { label: 'Avg/Day', val: `${w.avgHoursPerDay}h`,           mono: false },
                    ].map(({ label, val, mono }) => (
                      <div key={label}>
                        <p className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wide mb-0.5">{label}</p>
                        <p className={`text-sm font-semibold text-[#0A0A0A] ${mono ? 'font-mono' : ''}`}>{val}</p>
                      </div>
                    ))}
                  </div>

                  {/* Late + Absences */}
                  <div className="flex items-center gap-4 mt-2 pl-[42px]">
                    <span className="text-xs text-[#71717A]">
                      Late: <span className={`font-semibold ${w.lateDays > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{w.lateDays}</span>
                    </span>
                    <span className="text-xs text-[#71717A]">
                      Absent: <span className={`font-semibold ${w.absences > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{w.absences}</span>
                    </span>
                  </div>

                  {/* Expanded daily breakdown */}
                  {isExpanded && (
                    <div className="mt-3">
                      <DailyBreakdown entries={w.dailyEntries} dateFrom={appliedFrom} dateTo={appliedTo} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {!loading && !error && workersList.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={p => { setCurrentPage(p); setExpandedId(null); }}
          />
        )}
      </div>
    </div>
  );
}