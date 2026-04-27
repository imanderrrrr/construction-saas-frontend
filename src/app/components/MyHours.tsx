import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Clock, AlertTriangle, CalendarCheck, Filter as FilterIcon,
  ChevronDown, ChevronRight, ClipboardList, CalendarDays,
  UserCheck, RefreshCw, AlertCircle, MapPin,
} from 'lucide-react';
import { Button } from './ui/button';
import { StatCard } from './StatCard';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from './ui/table';
import { EmptyState } from './EmptyState';
import { Skeleton } from './ui/skeleton';
import { getMyRecords, getMyWorkerSummary } from '../services/time';
import type { TimeRecordResponse, WorkerSummaryResponse } from '../services/time';
import { businessToday } from '../helpers/dateTime';

// Types

type EntryStatus = 'approved' | 'pending' | 'late' | 'corrected' | 'rejected' | 'partial';

interface EventDetail {
  type: string;
  time: string | null;
  eventStatus: 'PENDING' | 'APPROVED' | 'OBSERVED' | 'REJECTED';
  comment: string | null;
  reviewerUsername: string | null;
  locationStatus: string | null;
}

interface TimeEntry {
  id: string;
  date: string;           // ISO: "2026-02-24"
  clockIn: string | null;
  lunchStart: string | null;
  lunchEnd: string | null;
  clockOut: string | null;
  totalHours: string | null;
  status: EntryStatus;
  events: EventDetail[];
  projectName?: string;
}

// Constants

const ITEMS_PER_PAGE = 10;

// Date helpers

function getToday(): string {
  return businessToday();
}

function getMondayOfWeek(): string {
  const today = businessToday();
  const d = new Date(`${today}T12:00:00`);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function getFirstOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

/** "2026-02-24" → "Tue, Feb 24" */
function formatDateLabel(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

/** ISO instant → "8:02 AM" in local time */
function formatInstantToTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

// Record mapper

function toTimeEntry(r: TimeRecordResponse): TimeEntry {
  const findEvent = (type: string) => r.events.find(e => e.type === type);

  const checkIn    = findEvent('CHECK_IN');
  const lunchStart = findEvent('LUNCH_START');
  const lunchEnd   = findEvent('LUNCH_END');
  const checkOut   = findEvent('CHECK_OUT');

  let totalHours: string | null = null;
  if (checkIn && checkOut) {
    const rawMs = new Date(checkOut.capturedAtClient).getTime() - new Date(checkIn.capturedAtClient).getTime();
    let lunchMs = 0;
    if (lunchStart && lunchEnd) {
      lunchMs = new Date(lunchEnd.capturedAtClient).getTime() - new Date(lunchStart.capturedAtClient).getTime();
    }
    const hrs = Math.max(0, (rawMs - lunchMs) / (1000 * 3600));
    totalHours = `${Math.round(hrs * 100) / 100}h`;
  }

  // Derive record-level status.
  // When the backend record is still PENDING, inspect event-level review statuses
  // to reflect partial progress (some events reviewed while others await review).
  let status: EntryStatus;
  if (r.approvalStatus === 'OBSERVED') {
    status = 'corrected';
  } else if (r.approvalStatus === 'REJECTED') {
    status = 'rejected';
  } else if (r.approvalStatus === 'APPROVED') {
    status = 'approved';
  } else {
    // Record is backend-PENDING — check individual event review statuses
    const evStatuses = r.events
      .map(e => e.eventApprovalStatus)
      .filter((s): s is NonNullable<typeof s> => !!s);
    const anyReviewed = evStatuses.some(s => s !== 'PENDING');
    if (anyReviewed) {
      if (evStatuses.some(s => s === 'REJECTED'))       status = 'rejected';
      else if (evStatuses.some(s => s === 'OBSERVED'))  status = 'corrected';
      else if (evStatuses.every(s => s === 'APPROVED')) status = 'approved';
      else                                               status = 'partial'; // mix of approved + pending
    } else if (r.isLate) {
      status = 'late';
    } else {
      status = 'pending';
    }
  }

  const STANDARD_SLOTS = ['CHECK_IN', 'LUNCH_START', 'LUNCH_END', 'CHECK_OUT'] as const;
  const hasTransitEvent = r.events.some(e => e.type === 'IN_TRANSIT');
  const eventSlots: string[] = hasTransitEvent
    ? ['IN_TRANSIT', ...STANDARD_SLOTS]
    : [...STANDARD_SLOTS];
  const events: EventDetail[] = eventSlots.map(type => {
    const ev = r.events.find(e => e.type === type);
    if (!ev) {
      return { type, time: null, eventStatus: 'PENDING', comment: null, reviewerUsername: null, locationStatus: null };
    }
    return {
      type,
      time:             formatInstantToTime(ev.capturedAtClient),
      eventStatus:      ev.eventApprovalStatus,
      comment:          ev.eventReviewComment,
      reviewerUsername: ev.eventReviewerUsername,
      locationStatus:   ev.locationStatus,
    };
  });

  return {
    id:         String(r.id),
    date:       r.workDate,
    clockIn:    checkIn    ? formatInstantToTime(checkIn.capturedAtClient)    : null,
    lunchStart: lunchStart ? formatInstantToTime(lunchStart.capturedAtClient) : null,
    lunchEnd:   lunchEnd   ? formatInstantToTime(lunchEnd.capturedAtClient)   : null,
    clockOut:   checkOut   ? formatInstantToTime(checkOut.capturedAtClient)   : null,
    totalHours,
    status,
    projectName: r.projectName,
    events,
  };
}

// Status badge

const STATUS_CONFIG: Record<EntryStatus, {
  labelKey: string; bg: string; text: string; border: string; dot: string;
}> = {
  approved:  { labelKey: 'myHours.status.approved',   bg: 'bg-emerald-50',    text: 'text-emerald-700', border: 'border-emerald-200',     dot: 'bg-emerald-500'              },
  pending:   { labelKey: 'myHours.status.pending',    bg: 'bg-[#FAFAFA]',     text: 'text-[#71717A]',  border: 'border-[#D4D4D8]',       dot: 'bg-[#D4D4D8]'               },
  late:      { labelKey: 'myHours.status.late',       bg: 'bg-amber-50',      text: 'text-amber-700',  border: 'border-amber-200',       dot: 'bg-amber-500'               },
  corrected: { labelKey: 'myHours.status.corrected',  bg: 'bg-[#F97316]/10',  text: 'text-[#F97316]', border: 'border-[#F97316]/20',    dot: 'bg-[#F97316]'               },
  rejected:  { labelKey: 'myHours.status.rejected',   bg: 'bg-red-50',        text: 'text-red-700',   border: 'border-red-200',         dot: 'bg-red-500'                 },
  partial:   { labelKey: 'myHours.status.inReview',   bg: 'bg-sky-50',        text: 'text-sky-700',   border: 'border-sky-200',         dot: 'bg-sky-400 animate-pulse'   },
};

function StatusBadge({ status }: { status: EntryStatus }) {
  const { t } = useTranslation('time');
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {t(cfg.labelKey)}
    </span>
  );
}

// Time cell

function TimeCell({ value }: { value: string | null }) {
  if (!value) {
    return <span className="font-mono text-sm text-[#D4D4D8]">—</span>;
  }
  return <span className="font-mono text-sm text-[#0A0A0A]">{value}</span>;
}

// Event detail panel

const EVENT_LABEL_KEYS: Record<string, string> = {
  IN_TRANSIT:  'myHours.table.transit',
  CHECK_IN:    'myHours.table.clockIn',
  LUNCH_START: 'myHours.table.lunchStart',
  LUNCH_END:   'myHours.table.lunchEnd',
  CHECK_OUT:   'myHours.table.clockOut',
};

const EVENT_STATUS_CONFIG: Record<string, { labelKey: string; bg: string; text: string; border: string; dot: string }> = {
  APPROVED: { labelKey: 'myHours.event.approved',  bg: 'bg-emerald-50',   text: 'text-emerald-700', border: 'border-emerald-200',   dot: 'bg-emerald-500' },
  PENDING:  { labelKey: 'myHours.event.pending',   bg: 'bg-[#FAFAFA]',    text: 'text-[#71717A]',  border: 'border-[#D4D4D8]',    dot: 'bg-[#D4D4D8]'  },
  OBSERVED: { labelKey: 'myHours.event.observed', bg: 'bg-[#F97316]/10', text: 'text-[#F97316]', border: 'border-[#F97316]/20', dot: 'bg-[#F97316]'  },
  REJECTED: { labelKey: 'myHours.event.rejected',  bg: 'bg-red-50',       text: 'text-red-700',   border: 'border-red-200',       dot: 'bg-red-500'    },
};

function EventDetailPanel({ events }: { events: EventDetail[] }) {
  const { t } = useTranslation('time');
  const hasAnyReview = events.some(e => e.eventStatus !== 'PENDING');

  if (!hasAnyReview) {
    return <p className="text-sm text-[#71717A]">{t('myHours.status.pending')}</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-2">{t('myHours.table.status')}</p>
      {events.map(ev => {
        const cfg = EVENT_STATUS_CONFIG[ev.eventStatus] ?? EVENT_STATUS_CONFIG.PENDING;
        return (
          <div key={ev.type} className="rounded-lg border border-[#D4D4D8]/60 overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-3 py-2 bg-white">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-sm font-medium text-[#0A0A0A] w-24 flex-shrink-0">
                  {t(EVENT_LABEL_KEYS[ev.type] ?? ev.type)}
                </span>
                {ev.time
                  ? <span className="font-mono text-xs text-[#71717A]">{ev.time}</span>
                  : <span className="font-mono text-xs text-[#D4D4D8]">—</span>}
                {ev.locationStatus === 'OUT_OF_RANGE' && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 flex-shrink-0">
                    <MapPin className="w-2.5 h-2.5" />{t('myHours.status.late')}
                  </span>
                )}
              </div>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border flex-shrink-0 ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                {t(cfg.labelKey)}
              </span>
            </div>
            {ev.comment && (
              <div className={`px-3 py-2 border-t border-[#D4D4D8]/30 ${cfg.bg}`}>
                <p className="text-xs text-[#71717A]">
                  <span className="font-medium text-[#0A0A0A]">{t('myHours.status.corrected')}</span>
                  {ev.reviewerUsername && (
                    <span className="text-[#71717A]"> · {ev.reviewerUsername}</span>
                  )}
                  {': '}{ev.comment}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Pagination

function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}) {
  const { t } = useTranslation('time');
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div className="flex items-center justify-center gap-1 py-4 border-t border-[#D4D4D8]">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="h-8 px-3 rounded-lg text-xs font-medium text-[#71717A] hover:text-[#0A0A0A] hover:bg-[#FAFAFA] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        {t('myHours.prev')}
      </button>

      {pages.map(p => (
        <button
          key={p}
          onClick={() => onPageChange(p)}
          className={`h-8 w-8 rounded-lg text-xs font-semibold transition-colors ${
            p === currentPage
              ? 'bg-[#F97316] text-white'
              : 'text-[#71717A] hover:text-[#0A0A0A] hover:bg-[#FAFAFA]'
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
        {t('myHours.next')}
      </button>
    </div>
  );
}

// Main component

type ViewMode = 'week' | 'month';

export function MyHours() {
  const { t } = useTranslation('time');
  // Filter state
  const [viewMode, setViewMode]       = useState<ViewMode>('week');
  const [dateFrom, setDateFrom]       = useState(getMondayOfWeek);
  const [dateTo, setDateTo]           = useState(getToday);
  const [appliedFrom, setAppliedFrom] = useState(getMondayOfWeek);
  const [appliedTo, setAppliedTo]     = useState(getToday);

  // UI state
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [currentPage, setCurrentPage]     = useState(1);

  // Data state
  const [records, setRecords]               = useState<TimeEntry[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [recordsError, setRecordsError]     = useState<string | null>(null);
  const [summary, setSummary]               = useState<WorkerSummaryResponse | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  // Fetch summary (once on mount)
  useEffect(() => {
    let cancelled = false;
    setSummaryLoading(true);
    getMyWorkerSummary()
      .then(s => { if (!cancelled) setSummary(s); })
      .catch(() => { /* KPI cards will show — on error */ })
      .finally(() => { if (!cancelled) setSummaryLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Fetch records
  const fetchRecords = useCallback(async () => {
    setRecordsLoading(true);
    setRecordsError(null);
    try {
      const data = await getMyRecords({ dateFrom: appliedFrom, dateTo: appliedTo });
      setRecords(data.map(toTimeEntry).sort((a, b) => b.date.localeCompare(a.date)));
    } catch (err) {
      setRecordsError(err instanceof Error ? err.message : 'Failed to load records');
    } finally {
      setRecordsLoading(false);
    }
  }, [appliedFrom, appliedTo]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  // Apply / Reset
  function handleApply() {
    setAppliedFrom(dateFrom);
    setAppliedTo(dateTo);
    setCurrentPage(1);
    setExpandedRowId(null);
  }

  function handleReset() {
    const mon = getMondayOfWeek();
    const tod = getToday();
    setViewMode('week');
    setDateFrom(mon); setDateTo(tod);
    setAppliedFrom(mon); setAppliedTo(tod);
    setCurrentPage(1);
    setExpandedRowId(null);
  }

  function handleViewMode(mode: ViewMode) {
    setViewMode(mode);
    if (mode === 'week') {
      setDateFrom(getMondayOfWeek());
      setDateTo(getToday());
    } else {
      setDateFrom(getFirstOfMonth());
      setDateTo(getToday());
    }
  }

  function toggleRow(id: string) {
    setExpandedRowId(prev => (prev === id ? null : id));
  }

  const totalPages       = Math.max(1, Math.ceil(records.length / ITEMS_PER_PAGE));
  const paginatedEntries = records.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  // Render
  return (
    <div className="space-y-6 max-w-5xl">

      {/* Page header */}
      <div>
        <h2 className="text-sm font-semibold text-[#0A0A0A]">{t('myHours.kpi.thisWeek')}</h2>
        <p className="text-[11px] text-[#71717A] mt-0.5">{t('myHours.filters.timeRange')}</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={Clock}
          title={t('myHours.kpi.thisWeek')}
          value={summary ? `${summary.hoursThisWeek}h` : '—'}
          subtitle={t('myHours.monToday')}
          iconBgColor="bg-[#F97316]/10"
          iconColor="text-[#F97316]"
          isLoading={summaryLoading}
        />
        <StatCard
          icon={AlertTriangle}
          title={t('myHours.status.late')}
          value={summary ? String(summary.lateArrivalsThisWeek) : '—'}
          subtitle={t('myHours.thisWeekSubtitle')}
          iconBgColor="bg-amber-50"
          iconColor="text-amber-600"
          isLoading={summaryLoading}
        />
        <StatCard
          icon={CalendarCheck}
          title={t('myHours.kpi.thisMonth')}
          value={summary ? String(summary.daysWorkedThisWeek) : '—'}
          subtitle={t('myHours.thisWeekSubtitle')}
          iconBgColor="bg-emerald-50"
          iconColor="text-emerald-600"
          isLoading={summaryLoading}
        />
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] p-5">
        <div className="flex items-center gap-2 mb-4">
          <FilterIcon className="w-4 h-4 text-[#71717A]" />
          <span className="text-sm font-semibold text-[#0A0A0A]">{t('buttons.filters', { ns: 'common' })}</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-[#71717A] uppercase tracking-wide">{t('labels.from', { ns: 'common' })}</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="h-9 rounded-lg border border-[#D4D4D8] bg-white px-3 text-sm text-[#0A0A0A]
                         focus:outline-none focus:ring-2 focus:ring-[#F97316]/25 focus:border-[#F97316] transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-[#71717A] uppercase tracking-wide">{t('labels.to', { ns: 'common' })}</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="h-9 rounded-lg border border-[#D4D4D8] bg-white px-3 text-sm text-[#0A0A0A]
                         focus:outline-none focus:ring-2 focus:ring-[#F97316]/25 focus:border-[#F97316] transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-[#71717A] uppercase tracking-wide">{t('myHours.filters.timeRange')}</label>
            <div className="flex h-9 rounded-lg border border-[#D4D4D8] overflow-hidden bg-white">
              {(['week', 'month'] as ViewMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => handleViewMode(mode)}
                  className={`px-4 text-sm font-medium transition-colors capitalize ${
                    viewMode === mode
                      ? 'bg-[#F97316] text-white'
                      : 'bg-white text-[#0A0A0A] hover:bg-[#FAFAFA]'
                  }`}
                >
                  {mode === 'week' ? t('myHours.filters.thisWeek') : t('myHours.filters.thisMonth')}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button
              variant="outline" size="sm" onClick={handleReset}
              className="h-9 px-4 text-xs border-[#D4D4D8] text-[#71717A] hover:text-[#0A0A0A]"
            >{t('buttons.reset', { ns: 'common' })}</Button>
            <Button
              size="sm" onClick={handleApply}
              className="h-9 px-4 text-xs bg-[#F97316] hover:bg-[#C2410C] text-white"
            >{t('buttons.apply', { ns: 'common' })}</Button>
          </div>
        </div>

        <p className="text-[11px] text-[#71717A] mt-3 pt-3 border-t border-[#FAFAFA]">
          {t('myHours.showingEntries')}{' '}
          <span className="font-medium text-[#0A0A0A]">{formatDateLabel(appliedFrom)}</span>
          {' '}{t('myHours.to')}{' '}
          <span className="font-medium text-[#0A0A0A]">{formatDateLabel(appliedTo)}</span>
          {!recordsLoading && !recordsError && (
            <> · {t('myHours.recordsFound', { count: records.length })}</>
          )}
        </p>
      </div>

      {/* Table + cards */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">

        {/* Card header */}
        <div className="flex items-center gap-2 px-6 py-4 border-b border-[#D4D4D8]">
          <ClipboardList className="w-4 h-4 text-[#71717A]" />
          <span className="text-sm font-semibold text-[#0A0A0A]">{t('myHours.table.date')}</span>
          {!recordsLoading && !recordsError && (
            <span className="text-xs text-[#71717A] ml-2">
              {t('myHours.recordsFound', { count: records.length })}
            </span>
          )}
          <Button
            variant="ghost" size="sm" onClick={fetchRecords} disabled={recordsLoading}
            className="gap-1.5 text-xs text-[#71717A] hover:text-[#0A0A0A] ml-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${recordsLoading ? 'animate-spin' : ''}`} />{t('buttons.refresh', { ns: 'common' })}
          </Button>
        </div>

        {/* Error */}
        {recordsError && (
          <div className="p-6">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-red-900">{t('error.loadingFailed', { ns: 'common' })}</p>
                  <p className="text-xs text-red-600 mt-0.5">{recordsError}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={fetchRecords}
                className="gap-2 border-red-200 text-red-700 hover:bg-red-50 shrink-0">
                <RefreshCw className="w-3.5 h-3.5" />{t('buttons.retry', { ns: 'common' })}
              </Button>
            </div>
          </div>
        )}

        {/* Skeleton */}
        {recordsLoading && (
          <div className="divide-y divide-[#D4D4D8]/50">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-6 py-4">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-5 w-20 rounded-full ml-auto" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!recordsLoading && !recordsError && records.length === 0 && (
          <div className="py-8">
            <EmptyState
              icon={CalendarDays}
              title={t('myHours.empty')}
              description={t('myHours.emptyHint')}
            />
          </div>
        )}

        {/* Desktop table */}
        {!recordsLoading && !recordsError && paginatedEntries.length > 0 && (
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#FAFAFA] hover:bg-[#FAFAFA]">
                  <TableHead className="w-9" />
                  <TableHead className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider">{t('myHours.table.date')}</TableHead>
                  <TableHead className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider">{t('labels.project', { ns: 'common' })}</TableHead>
                  <TableHead className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider">{t('myHours.table.clockIn')}</TableHead>
                  <TableHead className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider">{t('myHours.table.lunchStart')}</TableHead>
                  <TableHead className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider">{t('myHours.table.lunchEnd')}</TableHead>
                  <TableHead className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider">{t('myHours.table.clockOut')}</TableHead>
                  <TableHead className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider">{t('myHours.table.totalHours')}</TableHead>
                  <TableHead className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider">{t('myHours.table.status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedEntries.flatMap(entry => {
                  const isExpanded = expandedRowId === entry.id;
                  return [
                    <TableRow
                      key={entry.id}
                      onClick={() => toggleRow(entry.id)}
                      className={`cursor-pointer transition-colors border-b border-[#D4D4D8]/50 ${
                        isExpanded ? 'bg-[#FAFAFA]' : 'hover:bg-[#FAFAFA]/60'
                      }`}
                    >
                      <TableCell className="py-3 pr-0 pl-4">
                        <span className="text-[#71717A]">
                          {isExpanded
                            ? <ChevronDown className="w-3.5 h-3.5" />
                            : <ChevronRight className="w-3.5 h-3.5" />}
                        </span>
                      </TableCell>
                      <TableCell className="py-3">
                        <span className="text-sm font-medium text-[#0A0A0A]">{formatDateLabel(entry.date)}</span>
                      </TableCell>
                      <TableCell className="py-3">
                        <span className="text-xs text-[#71717A] max-w-[140px] truncate block">{entry.projectName}</span>
                      </TableCell>
                      <TableCell className="py-3"><TimeCell value={entry.clockIn} /></TableCell>
                      <TableCell className="py-3"><TimeCell value={entry.lunchStart} /></TableCell>
                      <TableCell className="py-3"><TimeCell value={entry.lunchEnd} /></TableCell>
                      <TableCell className="py-3"><TimeCell value={entry.clockOut} /></TableCell>
                      <TableCell className="py-3">
                        {entry.totalHours
                          ? <span className="text-sm font-semibold text-[#0A0A0A]">{entry.totalHours}</span>
                          : <span className="font-mono text-sm text-[#D4D4D8]">—</span>}
                      </TableCell>
                      <TableCell className="py-3">
                        <StatusBadge status={entry.status} />
                      </TableCell>
                    </TableRow>,

                    ...(isExpanded ? [
                      <TableRow key={`${entry.id}-detail`} className="bg-[#FAFAFA]/80 hover:bg-[#FAFAFA]/80">
                        <TableCell colSpan={9} className="py-4 px-6 border-b border-[#D4D4D8]/50">
                          <EventDetailPanel events={entry.events} />
                        </TableCell>
                      </TableRow>,
                    ] : []),
                  ];
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Mobile cards */}
        {!recordsLoading && !recordsError && paginatedEntries.length > 0 && (
          <div className="md:hidden divide-y divide-[#D4D4D8]">
            {paginatedEntries.map(entry => (
              <div key={entry.id} className="px-4 py-4">
                <button
                  onClick={() => toggleRow(entry.id)}
                  className="w-full flex items-center justify-between mb-3"
                >
                  <div className="flex items-center gap-2">
                    {expandedRowId === entry.id
                      ? <ChevronDown className="w-3.5 h-3.5 text-[#71717A]" />
                      : <ChevronRight className="w-3.5 h-3.5 text-[#71717A]" />}
                    <div className="text-left">
                      <span className="text-sm font-semibold text-[#0A0A0A]">{formatDateLabel(entry.date)}</span>
                      <p className="text-[10px] text-[#71717A]">{entry.projectName}</p>
                    </div>
                  </div>
                  <StatusBadge status={entry.status} />
                </button>

                <div className="grid grid-cols-2 gap-x-4 gap-y-2 pl-5 text-sm">
                  {[
                    { label: t('myHours.table.clockIn'),    value: entry.clockIn },
                    { label: t('myHours.table.lunchStart'), value: entry.lunchStart },
                    { label: t('myHours.table.lunchEnd'),   value: entry.lunchEnd },
                    { label: t('myHours.table.clockOut'),   value: entry.clockOut },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wide">{label}</span>
                      <TimeCell value={value} />
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2 mt-3 pl-5">
                  <span className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('myHours.table.totalHours')}:</span>
                  {entry.totalHours
                    ? <span className="text-sm font-bold text-[#0A0A0A]">{entry.totalHours}</span>
                    : <span className="text-sm text-[#D4D4D8] font-mono">—</span>}
                </div>

                {expandedRowId === entry.id && (
                  <div className="mt-3 pl-5">
                    <EventDetailPanel events={entry.events} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!recordsLoading && !recordsError && records.length > ITEMS_PER_PAGE && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={p => { setCurrentPage(p); setExpandedRowId(null); }}
          />
        )}
      </div>

    </div>
  );
}