import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Search, Filter, ChevronLeft, AlertCircle, RefreshCw,
  Calendar, Clock, CalendarDays, ChevronRight, AlertTriangle, Loader2,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Skeleton } from './ui/skeleton';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from './ui/select';

import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from './ui/table';
import { ApprovalStatusBadge } from './phase2/ApprovalStatusBadge';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip';
import { TimelineItem, TimelineItemMissing } from './phase2/TimelineItem';
import { ModalCorrect } from './phase2/ModalCorrect';
import { TimeRecord, TimeEvent, ApprovalStatus, TIME_EVENT_SEQUENCE, LocationStatus, TimeEventType } from '../types';
import {
  getTimeRecords, getSupervisorTimeRecords, getTimeRecord,
  approveEvent, correctEvent, rejectEvent, editEventTime,
  resolveTransitDispute,
  type TimeRecordResponse,
} from '../services/time';
import { toast } from 'sonner';
import { businessToday, nDaysAgo } from '../helpers/dateTime';

// â”€â”€â”€ Date helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function getToday(): string {
  return businessToday();
}
function getMondayOfWeek(): string {
  const today = businessToday();
  const d = new Date(`${today}T12:00:00`);
  const diff = d.getDay() === 0 ? -6 : 1 - d.getDay();
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

// â”€â”€â”€ Mapper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function toTimeRecord(r: TimeRecordResponse): TimeRecord {
  const lastReview = r.reviews.length > 0 ? r.reviews[r.reviews.length - 1] : null;
  return {
    id: r.id,
    worker: {
      id: r.workerId,
      username: r.workerUsername,
      fullName: r.workerName,
      role: 'WORKER',
      status: 'ACTIVE',
    },
    project: {
      id: r.projectId,
      name: r.projectName,
      status: 'ACTIVE',
    },
    date: r.workDate,
    events: (() => {
      const seen = new Map<string, typeof r.events[0]>();
      for (const e of r.events) {
        const prev = seen.get(e.type);
        if (!prev || e.capturedAtClient > prev.capturedAtClient) seen.set(e.type, e);
      }
      return Array.from(seen.values()).map(e => ({
        id: e.id,
        type: e.type,
        capturedAt: e.capturedAtClient,
        locationStatus: (e.locationStatus ?? 'OK') as LocationStatus,
        approvalStatus: (e.eventApprovalStatus ?? 'PENDING') as ApprovalStatus,
        reviewComment: e.eventReviewComment ?? null,
        reviewerUsername: e.eventReviewerUsername ?? null,
        reviewedAt: e.eventReviewedAt ?? null,
        sourceProjectId: e.sourceProjectId ?? null,
        sourceProjectName: e.sourceProjectName ?? null,
        disputeStatus: e.disputeStatus ?? null,
        disputeReason: e.disputeReason ?? null,
        awardedTransitMinutes: e.awardedTransitMinutes ?? null,
        disputeResolvedBy: e.disputeResolvedBy ?? null,
        disputeResolvedAt: e.disputeResolvedAt ?? null,
      }));
    })(),
    approvalStatus: r.approvalStatus,
    pendingEventCount: r.pendingEventCount,
    review: lastReview ? {
      reviewerName: lastReview.reviewerName ?? 'Unknown',
      reviewedAt: lastReview.createdAt,
      comment: lastReview.comment,
    } : null,
  };
}

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type View = 'list' | 'detail';

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function fmtDate(iso: string, locale = 'en-US') {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(locale, {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
}
function fmtShortDate(iso: string, locale = 'en-US') {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(locale, {
    month: 'short', day: 'numeric',
  });
}

function initials(name: string | null, fallback: string) {
  return name
    ? name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
    : fallback.slice(0, 2).toUpperCase();
}

function hasLocationIssue(r: TimeRecord) {
  return r.events.some(e => e.locationStatus !== 'OK');
}

/**
 * Derives the effective status purely from event-level review statuses.
 * Never trusts the record-level approvalStatus from the backend to decide
 * partial-review state — event-level data is always authoritative.
 */
function effectiveStatus(r: TimeRecord): ApprovalStatus {
  if (r.events.length === 0) return 'PENDING';
  const statuses = r.events.map(e => e.approvalStatus);
  if (statuses.every(s => s === 'PENDING')) return 'PENDING';
  if (statuses.some(s => s === 'PENDING')) return 'PARTIAL'; // some reviewed, some still pending
  // All events individually reviewed → derive final aggregate
  if (statuses.some(s => s === 'REJECTED')) return 'REJECTED';
  if (statuses.some(s => s === 'OBSERVED')) return 'OBSERVED';
  return 'APPROVED';
}

/**
 * Badge for the record list that communicates how many events still need review.
 * Shows a counting badge ("N pending review") while any event is unreviewed;
 * only shows a closed final state once every recorded event has been reviewed.
 */
function RecordSummaryBadge({ record }: { record: TimeRecord }) {
  const { t } = useTranslation('admin');
  const pendingCount = record.events.filter(e => e.approvalStatus === 'PENDING').length;
  if (pendingCount > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border font-mono bg-amber-50 text-amber-700 border-amber-200">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
        {t('approvals.pendingReview', { count: pendingCount })}
      </span>
    );
  }
  // All recorded events reviewed (or no events recorded yet) — show definitive state
  return <ApprovalStatusBadge status={effectiveStatus(record)} size="sm" />;
}

// â”€â”€â”€ Worker avatar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function WorkerAvatar({ record, size = 'sm' }: { record: TimeRecord; size?: 'sm' | 'md' }) {
  const ini = initials(record.worker.fullName, record.worker.username);
  const sz = size === 'sm' ? 'w-8 h-8 text-[11px]' : 'w-10 h-10 text-xs';
  return (
    <div className={`${sz} bg-emerald-600 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0`}>
      {ini}
    </div>
  );
}

// â”€â”€â”€ Detail view â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ApprovalDetail({
  record, onBack,
  onEventApprove, onEventCorrect, onEventReject, eventActionLoading,
  onResolveDispute, disputeResolving,
}: {
  record: TimeRecord; onBack: () => void;
  /** Per-event callbacks */
  onEventApprove: (eventId: number) => void;
  onEventCorrect: (eventId: number) => void;
  onEventReject: (eventId: number) => void;
  /** ID of the event currently being processed */
  eventActionLoading: number | null;
  /** Resolve a transit dispute */
  onResolveDispute: (eventId: number, awardedMinutes: number, comment?: string) => void;
  disputeResolving: boolean;
}) {
  const { t, i18n } = useTranslation(['admin', 'common', 'time']);
  const hasIssues = hasLocationIssue(record);
  const [disputeAwardedHours, setDisputeAwardedHours] = useState(0);
  const [disputeAwardedMinutes, setDisputeAwardedMinutes] = useState(0);
  const [disputeComment, setDisputeComment] = useState('');

  return (
    <div className="space-y-6 max-w-2xl">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[#71717A]">
        <button onClick={onBack} className="hover:text-[#0A0A0A] transition-colors font-medium flex items-center gap-1">
          <ChevronLeft className="w-3.5 h-3.5" />{t('admin:approvals.breadcrumbBack')}
        </button>
        <span>/</span>
        <span className="text-[#0A0A0A] truncate">{t('admin:approvals.recordId', { id: record.id })}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <WorkerAvatar record={record} size="md" />
          <div>
            <h2 className="text-xl font-bold text-[#0A0A0A]">{record.worker.fullName ?? record.worker.username}</h2>
            <p className="text-xs font-mono text-[#71717A] mt-0.5">@{record.worker.username}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <ApprovalStatusBadge status={effectiveStatus(record)} />
              {hasIssues && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                  <AlertCircle className="w-3 h-3" />{t('admin:approvals.locationIssues')}
                </span>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Info card */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#D4D4D8] bg-[#FAFAFA]/50">
          <h3 className="text-sm font-semibold text-[#0A0A0A]">{t('admin:approvals.recordSummary')}</h3>
        </div>
        <div className="divide-y divide-[#FAFAFA]">
          {[
            { label: t('admin:approvals.table.date'),    value: fmtDate(record.date, i18n.language) },
            { label: t('admin:approvals.table.project'), value: record.project.name },
            { label: t('admin:approvals.table.events'),  value: t('admin:approvals.punchesRecorded', { count: record.events.length }) },
            { label: t('admin:approvals.table.record'),  value: `#${record.id}` },
          ].map(row => (
            <div key={row.label} className="flex items-center justify-between px-5 py-3">
              <span className="text-xs font-medium text-[#71717A] uppercase tracking-wide w-20">{row.label}</span>
              <span className="text-sm text-[#0A0A0A] text-right">{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#D4D4D8] bg-[#FAFAFA]/50">
          <h3 className="text-sm font-semibold text-[#0A0A0A]">{t('admin:approvals.eventTimeline')}</h3>
          <p className="text-xs text-[#71717A] mt-0.5">{t('admin:approvals.eventTimelineDesc')}</p>
        </div>
        <div className="p-5">
          {/* IN_TRANSIT event (if present) shown before the standard sequence */}
          {record.events.filter(e => e.type === 'IN_TRANSIT').map(e => (
            <TimelineItem
              key={`transit-${e.id}`}
              event={e}
              onApprove={onEventApprove}
              onCorrect={onEventCorrect}
              onReject={onEventReject}
              actionEventId={eventActionLoading}
            />
          ))}
          {TIME_EVENT_SEQUENCE.map(type => {
            const event = record.events.find(e => e.type === type);
            return event
              ? <TimelineItem
                  key={type}
                  event={event}
                  isLast={type === 'CHECK_OUT'}
                  onApprove={onEventApprove}
                  onCorrect={onEventCorrect}
                  onReject={onEventReject}
                  actionEventId={eventActionLoading}
                />
              : <TimelineItemMissing key={type} type={type} />;
          })}
        </div>
      </div>

      {/* Transit dispute resolution card */}
      {record.events.filter(e => e.type === 'IN_TRANSIT' && e.disputeStatus).map(transitEvt => {
        const isPending = transitEvt.disputeStatus === 'PENDING';
        // Calculate tracked minutes:
        // 1. If CHECK_IN exists → duration from IN_TRANSIT to CHECK_IN
        // 2. If dispute exists → use awarded_transit_minutes (frozen at dispute creation)
        // 3. Otherwise → still running, use Date.now()
        const checkInEvt = record.events.find(e => e.type === 'CHECK_IN');
        let trackedMins: number;
        if (checkInEvt) {
          const transitStart = new Date(transitEvt.capturedAt).getTime();
          const transitEnd = new Date(checkInEvt.capturedAt).getTime();
          trackedMins = Math.round((transitEnd - transitStart) / 60000);
        } else if (transitEvt.disputeStatus && transitEvt.awardedTransitMinutes != null) {
          trackedMins = transitEvt.awardedTransitMinutes;
        } else {
          const transitStart = new Date(transitEvt.capturedAt).getTime();
          trackedMins = Math.round((Date.now() - transitStart) / 60000);
        }

        return (
          <div key={`dispute-${transitEvt.id}`} className={`rounded-xl border overflow-hidden ${
            isPending ? 'border-amber-200 bg-amber-50/50' : 'border-emerald-200 bg-emerald-50/50'
          }`}>
            <div className={`px-5 py-4 border-b ${
              isPending ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'
            }`}>
              <div className="flex items-center gap-2">
                <AlertTriangle className={`w-4 h-4 ${isPending ? 'text-amber-600' : 'text-emerald-600'}`} />
                <h3 className={`text-sm font-semibold ${isPending ? 'text-amber-900' : 'text-emerald-900'}`}>
                  {t('time:dispute.title')}
                </h3>
                {!isPending && (
                  <span className="ml-auto text-[10px] font-semibold text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-full">
                    {t('time:dispute.resolved')}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#71717A] mt-1">
                {t('time:dispute.workerDisputed', { worker: record.worker.fullName ?? record.worker.username })}
              </p>
            </div>
            <div className="p-5 space-y-4">
              {/* Reason */}
              <div>
                <p className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wide mb-1">{t('time:dispute.reason')}</p>
                <p className="text-sm text-[#0A0A0A]">{transitEvt.disputeReason || t('time:dispute.noReason')}</p>
              </div>
              {/* Tracked minutes */}
              <div className="flex items-center justify-between bg-white rounded-lg border border-[#D4D4D8] px-4 py-2.5">
                <span className="text-xs text-[#71717A]">{t('time:dispute.trackedMinutes')}</span>
                <span className="text-sm font-mono font-semibold text-[#0A0A0A]">{trackedMins} min</span>
              </div>

              {isPending ? (
                <>
                  {/* Awarded time input (hours + minutes) */}
                  <div>
                    <label className="text-xs font-medium text-[#0A0A0A] block mb-1.5">{t('time:dispute.awardedTimeLabel')}</label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                          <Input
                            type="number"
                            min={0}
                            value={disputeAwardedHours}
                            onChange={e => setDisputeAwardedHours(Math.max(0, parseInt(e.target.value) || 0))}
                            className="h-10 font-mono"
                          />
                          <span className="text-xs text-[#71717A] shrink-0">{t('time:dispute.hours')}</span>
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                          <Input
                            type="number"
                            min={0}
                            max={59}
                            value={disputeAwardedMinutes}
                            onChange={e => setDisputeAwardedMinutes(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
                            className="h-10 font-mono"
                          />
                          <span className="text-xs text-[#71717A] shrink-0">{t('time:dispute.minutes')}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Comment */}
                  <div>
                    <label className="text-xs font-medium text-[#0A0A0A] block mb-1.5">{t('time:dispute.commentLabel')}</label>
                    <textarea
                      value={disputeComment}
                      onChange={e => setDisputeComment(e.target.value)}
                      placeholder={t('time:dispute.commentPlaceholder')}
                      className="w-full text-sm border border-[#D4D4D8] rounded-lg p-2.5 resize-none h-20 focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#F97316]"
                    />
                  </div>
                  {/* Total preview */}
                  <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5">
                    <span className="text-xs text-blue-700 font-medium">{t('time:dispute.totalToPay')}</span>
                    <span className="text-sm font-mono font-bold text-blue-900">
                      {disputeAwardedHours > 0 && `${disputeAwardedHours}h `}{disputeAwardedMinutes}min
                      {' '}({disputeAwardedHours * 60 + disputeAwardedMinutes} min)
                    </span>
                  </div>
                  {/* Resolve button */}
                  <Button
                    type="button"
                    onClick={() => onResolveDispute(transitEvt.id, disputeAwardedHours * 60 + disputeAwardedMinutes, disputeComment || undefined)}
                    disabled={disputeResolving || (disputeAwardedHours === 0 && disputeAwardedMinutes === 0)}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white gap-2"
                  >
                    {disputeResolving
                      ? <><Loader2 className="w-4 h-4 animate-spin" />{t('time:dispute.resolving')}</>
                      : t('time:dispute.resolve')}
                  </Button>
                </>
              ) : (
                <div className="space-y-2">
                  {transitEvt.awardedTransitMinutes != null && transitEvt.awardedTransitMinutes > 0 && (
                    <div className="flex items-center justify-between bg-white rounded-lg border border-emerald-200 px-4 py-2.5">
                      <span className="text-xs text-emerald-700">{t('time:dispute.awardedTime')}</span>
                      <span className="text-sm font-mono font-bold text-emerald-900">
                        {Math.floor(transitEvt.awardedTransitMinutes / 60) > 0 && `${Math.floor(transitEvt.awardedTransitMinutes / 60)}h `}
                        {transitEvt.awardedTransitMinutes % 60}min
                      </span>
                    </div>
                  )}
                  {transitEvt.disputeResolvedBy && (
                    <p className="text-xs text-[#71717A]">{t('time:dispute.resolvedBy', { reviewer: transitEvt.disputeResolvedBy })}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Review note */}
      {record.review?.comment && (
        <div className={`p-4 rounded-xl border flex items-start gap-3 ${
          record.approvalStatus === 'REJECTED' || record.approvalStatus === 'AUTO_REJECTED'
            ? 'bg-red-50 border-red-200'
            : 'bg-[#F97316]/5 border-[#F97316]/20'
        }`}>
          <AlertCircle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
            record.approvalStatus === 'REJECTED' || record.approvalStatus === 'AUTO_REJECTED' ? 'text-red-600' : 'text-[#F97316]'
          }`} />
          <div>
            <p className={`text-xs font-semibold ${
              record.approvalStatus === 'REJECTED' || record.approvalStatus === 'AUTO_REJECTED' ? 'text-red-900' : 'text-[#C2410C]'
            }`}>
              {t('admin:approvals.supervisorNote', { name: record.review.reviewerName })}
            </p>
            <p className="text-sm text-[#0A0A0A] mt-1 leading-relaxed">{record.review.comment}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// â”€â”€â”€ Main component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function SupervisorApprovals({ mode = 'admin' }: { mode?: 'admin' | 'supervisor' } = {}) {

  const { t, i18n } = useTranslation(['admin', 'common', 'time']);

  // â”€â”€ Data state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [records, setRecords]   = useState<TimeRecord[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  // â”€â”€ UI state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [view, setView]           = useState<View>('list');
  const [selected, setSelected]   = useState<TimeRecord | null>(null);
  const [eventActionLoading, setEventActionLoading] = useState<number | null>(null);
  const [eventModalAction, setEventModalAction] = useState<{ eventId: number; action: 'correct' | 'reject'; eventType: TimeEventType; currentTime: string } | null>(null);
  const [disputeResolving, setDisputeResolving] = useState(false);

  // â”€â”€ Server-side filter state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [statusFilter, setStatusFilter]   = useState('all');
  const [dateFrom, setDateFrom]           = useState(getMondayOfWeek);
  const [dateTo, setDateTo]               = useState(getToday);
  const [appliedStatus, setAppliedStatus] = useState('all');
  const [appliedFrom, setAppliedFrom]     = useState(getMondayOfWeek);
  const [appliedTo, setAppliedTo]         = useState(getToday);

  // â”€â”€ Client-side filter state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [search, setSearch]           = useState('');
  const [projectFilter, setProjectFilter] = useState('all');

  // â”€â”€ Fetch â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = mode === 'supervisor'
        ? await getSupervisorTimeRecords({
            // When the user selects "PENDING", skip the server-side status filter and rely on
            // pendingEventCount for client-side filtering — this catches records that were
            // approved at record-level via the legacy endpoint but still have pending events.
            status:   appliedStatus !== 'all' && appliedStatus !== 'PENDING' ? appliedStatus : undefined,
            dateFrom: appliedFrom || undefined,
            dateTo:   appliedTo   || undefined,
            size: 100,
          })
        : await getTimeRecords({
            // Same logic: bypass server status filter for PENDING — use pendingEventCount client-side.
            status:   appliedStatus !== 'all' && appliedStatus !== 'PENDING' ? appliedStatus : undefined,
            dateFrom: appliedFrom || undefined,
            dateTo:   appliedTo   || undefined,
            size: 100,
          });
      setRecords(page.content.map(toTimeRecord));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin:approvals.failedLoadFallback'));
    } finally {
      setLoading(false);
    }
  }, [mode, appliedStatus, appliedFrom, appliedTo]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  // â”€â”€ Client-side filtering â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const projectNames = useMemo(
    () => [...new Set(records.map(r => r.project.name))].sort(),
    [records],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return records.filter(r => {
      const matchSearch = !q
        || (r.worker.fullName?.toLowerCase().includes(q) ?? false)
        || r.worker.username.toLowerCase().includes(q)
        || r.project.name.toLowerCase().includes(q);
      const matchProject = projectFilter === 'all' || r.project.name === projectFilter;
      // When the PENDING filter is active, show only records that still have at least one
      // pending event (authoritative count from server — not derived from record.approvalStatus).
      const matchStatus = appliedStatus !== 'PENDING' || r.pendingEventCount > 0;
      return matchSearch && matchProject && matchStatus;
    });
  }, [records, search, projectFilter, appliedStatus]);

  const pending = records.filter(r => r.pendingEventCount > 0).length;

  // Overdue pending approvals (from previous days, fetched independently)
  const [overdueRecords, setOverdueRecords] = useState<TimeRecord[]>([]);
  const [overdueDismissed, setOverdueDismissed] = useState(false);

  const fetchOverdue = useCallback(async () => {
    try {
      const yesterdayStr = nDaysAgo(1);
      const fromStr = nDaysAgo(30);

      const page = mode === 'supervisor'
        ? await getSupervisorTimeRecords({ dateFrom: fromStr, dateTo: yesterdayStr, size: 100 })
        : await getTimeRecords({ dateFrom: fromStr, dateTo: yesterdayStr, size: 100 });
      const mapped = page.content.map(toTimeRecord);
      setOverdueRecords(mapped.filter(r => r.pendingEventCount > 0));
    } catch { /* silent — alert degrades gracefully */ }
  }, [mode]);

  useEffect(() => { fetchOverdue(); }, [fetchOverdue]);

  function handleShowOverdue(dateStr: string) {
    setStatusFilter('PENDING');
    setDateFrom(dateStr);
    setDateTo(dateStr);
    setAppliedStatus('PENDING');
    setAppliedFrom(dateStr);
    setAppliedTo(dateStr);
    setSearch('');
    setProjectFilter('all');
    setOverdueDismissed(true);
  }

  function handleShowAllOverdue() {
    if (overdueRecords.length === 0) return;
    const dates = overdueRecords.map(r => r.date).sort();
    const earliest = dates[0];
    const latestStr = nDaysAgo(1);
    setStatusFilter('PENDING');
    setDateFrom(earliest);
    setDateTo(latestStr);
    setAppliedStatus('PENDING');
    setAppliedFrom(earliest);
    setAppliedTo(latestStr);
    setSearch('');
    setProjectFilter('all');
    setOverdueDismissed(true);
  }


  // â”€â”€ Apply / Reset â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function handleApply() {
    setAppliedStatus(statusFilter);
    setAppliedFrom(dateFrom);
    setAppliedTo(dateTo);
    setSearch('');
    setProjectFilter('all');
  }

  function handleReset() {
    const mon = getMondayOfWeek(), tod = getToday();
    setStatusFilter('all');
    setDateFrom(mon); setDateTo(tod);
    setAppliedStatus('all');
    setAppliedFrom(mon); setAppliedTo(tod);
    setSearch('');
    setProjectFilter('all');
  }

  // â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function updateRecord(updated: TimeRecord) {
    setRecords(prev => prev.map(r => r.id === updated.id ? updated : r));
    setSelected(updated);
  }

  /** Applies an optimistic event-status patch so the UI reflects the new state
   * immediately, before the authoritative re-fetch resolves. */
  function patchEventStatus(
    eventId: number,
    status: ApprovalStatus,
    extra?: Pick<TimeEvent, 'reviewComment' | 'reviewerUsername' | 'reviewedAt'>,
  ) {
    if (!selected) return;
    const patched: TimeRecord = {
      ...selected,
      events: selected.events.map(e =>
        e.id === eventId
          ? { ...e, approvalStatus: status, ...extra }
          : e,
      ),
    };
    updateRecord(patched);
  }

  async function doEventApprove(eventId: number) {
    if (!selected) return;
    setEventActionLoading(eventId);
    // Optimistic update — show Approved immediately in the timeline
    patchEventStatus(eventId, 'APPROVED');
    try {
      await approveEvent(selected.id, eventId);
      // Authoritative sync — also updates the list row's effective status
      updateRecord(toTimeRecord(await getTimeRecord(selected.id)));
      toast.success(t('admin:approvals.punchApproved'));
    } catch (err) {
      // Roll back optimistic update on failure
      updateRecord(selected);
      toast.error(err instanceof Error ? err.message : t('admin:approvals.failedApprove'));
    } finally {
      setEventActionLoading(null);
    }
  }

  async function doEventCorrect(comment: string, newTime?: string) {
    if (!selected || !eventModalAction) return;
    const { eventId } = eventModalAction;
    setEventActionLoading(eventId);
    // Optimistic update — show Observed immediately in the timeline
    patchEventStatus(eventId, 'OBSERVED', { reviewComment: comment, reviewerUsername: null, reviewedAt: new Date().toISOString() });
    try {
      if (newTime) {
        await editEventTime(selected.id, eventId, newTime, comment);
      }
      await correctEvent(selected.id, eventId, comment);
      updateRecord(toTimeRecord(await getTimeRecord(selected.id)));
      toast.success(t('admin:approvals.punchCorrected'));
      setEventModalAction(null);
    } catch (err) {
      updateRecord(selected);
      toast.error(err instanceof Error ? err.message : t('admin:approvals.failedCorrect'));
    } finally {
      setEventActionLoading(null);
    }
  }

  async function doEventReject(comment: string) {
    if (!selected || !eventModalAction) return;
    const { eventId } = eventModalAction;
    setEventActionLoading(eventId);
    // Optimistic update — show Rejected immediately in the timeline
    patchEventStatus(eventId, 'REJECTED', { reviewComment: comment, reviewerUsername: null, reviewedAt: new Date().toISOString() });
    try {
      await rejectEvent(selected.id, eventId, comment);
      updateRecord(toTimeRecord(await getTimeRecord(selected.id)));
      toast.success(t('admin:approvals.punchRejected'));
      setEventModalAction(null);
    } catch (err) {
      updateRecord(selected);
      toast.error(err instanceof Error ? err.message : t('admin:approvals.failedReject'));
    } finally {
      setEventActionLoading(null);
    }
  }


  async function doResolveDispute(eventId: number, awardedMinutes: number, comment?: string) {
    if (!selected) return;
    setDisputeResolving(true);
    try {
      await resolveTransitDispute(selected.id, eventId, awardedMinutes, comment);
      updateRecord(toTimeRecord(await getTimeRecord(selected.id)));
      toast.success(t('time:dispute.resolved'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error resolving dispute');
    } finally {
      setDisputeResolving(false);
    }
  }

  // â”€â”€ Detail view â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (view === 'detail' && selected) {
    return (
      <>
        <ApprovalDetail
          record={selected}
          onBack={() => { setView('list'); setSelected(null); }}
          onEventApprove={doEventApprove}
          onEventCorrect={(eventId) => {
            const ev = selected.events.find(e => e.id === eventId);
            if (!ev) return;
            setEventModalAction({ eventId, action: 'correct', eventType: ev.type, currentTime: ev.capturedAt });
          }}
          onEventReject={(eventId) => {
            const ev = selected.events.find(e => e.id === eventId);
            if (!ev) return;
            setEventModalAction({ eventId, action: 'reject', eventType: ev.type, currentTime: ev.capturedAt });
          }}
          eventActionLoading={eventActionLoading}
          onResolveDispute={doResolveDispute}
          disputeResolving={disputeResolving}
        />
        {eventModalAction && (
          <ModalCorrect
            open={!!eventModalAction}
            action={eventModalAction.action}
            workerName={selected.worker.fullName ?? selected.worker.username}
            projectName={selected.project.name}
            date={fmtDate(selected.date, i18n.language)}
            eventType={eventModalAction.eventType}
            currentTime={eventModalAction.currentTime}
            workDate={selected.date}
            onClose={() => setEventModalAction(null)}
            onSubmit={eventModalAction.action === 'correct' ? doEventCorrect : doEventReject}
          />
        )}
      </>
    );
  }

  // â”€â”€ List view â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <div className="space-y-6">

      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#0A0A0A]">{t('admin:approvals.pageTitle')}</h2>
          <p className="text-sm text-[#71717A] mt-1">
            {t('admin:approvals.pageSubtitle')}
            {pending > 0 && (
              <span className="ml-2 text-amber-700 font-semibold">{t('admin:approvals.pendingCount', { count: pending })}</span>
            )}
          </p>
        </div>
        <Button
          variant="outline" size="sm"
          onClick={fetchRecords} disabled={loading}
          className="gap-2 text-xs h-9 border-[#D4D4D8] text-[#71717A] hover:text-[#0A0A0A]"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> {t('common:buttons.refresh')}
        </Button>
      </div>

      {/* â”€â”€ Filter bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-[#71717A]" />
          <span className="text-sm font-semibold text-[#0A0A0A]">{t('admin:approvals.filtersTitle')}</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-end gap-3">

          {/* Date from */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-[#71717A] uppercase tracking-wide">{t('admin:approvals.filtersFrom')}</label>
            <input
              type="date" value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="h-9 rounded-lg border border-[#D4D4D8] bg-white px-3 text-sm text-[#0A0A0A]
                         focus:outline-none focus:ring-2 focus:ring-[#F97316]/25 focus:border-[#F97316] transition-colors"
            />
          </div>

          {/* Date to */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-[#71717A] uppercase tracking-wide">{t('admin:approvals.filtersTo')}</label>
            <input
              type="date" value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="h-9 rounded-lg border border-[#D4D4D8] bg-white px-3 text-sm text-[#0A0A0A]
                         focus:outline-none focus:ring-2 focus:ring-[#F97316]/25 focus:border-[#F97316] transition-colors"
            />
          </div>

          {/* Status */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-[#71717A] uppercase tracking-wide">{t('common:labels.status')}</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 border-[#D4D4D8] w-36">
                <SelectValue placeholder={t('common:labels.status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common:labels.allStatuses')}</SelectItem>
                <SelectItem value="PENDING">{t('common:status.pending')}</SelectItem>
                <SelectItem value="APPROVED">{t('common:status.approved')}</SelectItem>
                <SelectItem value="OBSERVED">{t('common:status.observed')}</SelectItem>
                <SelectItem value="REJECTED">{t('common:status.rejected')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button
              variant="outline" size="sm" onClick={handleReset}
              className="h-9 px-4 text-xs border-[#D4D4D8] text-[#71717A] hover:text-[#0A0A0A]"
            >{t('common:buttons.reset')}</Button>
            <Button
              size="sm" onClick={handleApply}
              className="h-9 px-4 text-xs bg-[#F97316] hover:bg-[#C2410C] text-white"
            >{t('common:buttons.apply')}</Button>
          </div>
        </div>

        {/* Client-side filters below the divider */}
        <div className="flex flex-col sm:flex-row gap-3 mt-4 pt-4 border-t border-[#FAFAFA]">
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#71717A]" />
            <Input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder={t('admin:approvals.searchPlaceholder')}
              className="pl-9 h-9 text-sm border-[#D4D4D8]"
              disabled={loading}
            />
          </div>
          <Select value={projectFilter} onValueChange={setProjectFilter} disabled={loading}>
            <SelectTrigger className="h-9 border-[#D4D4D8] w-full sm:w-56">
              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-[#71717A]" />
                <SelectValue placeholder={t('common:labels.allProjects')} />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('common:labels.allProjects')}</SelectItem>
              {projectNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>


      {/* Overdue pending approvals alert */}
      {!overdueDismissed && overdueRecords.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-semibold text-amber-700">
                {t('admin:approvals.overdueTitle', { count: overdueRecords.length })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {overdueRecords.length > 1 && (
                <button
                  onClick={handleShowAllOverdue}
                  className="text-xs font-medium text-amber-700 hover:text-amber-900 underline underline-offset-2 transition-colors"
                >
                  {t('admin:approvals.overdueShowAll')}
                </button>
              )}
              <button
                onClick={() => setOverdueDismissed(true)}
                className="text-xs text-amber-500 hover:text-amber-700 transition-colors"
                title="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {(() => {
              // Group by date
              const byDate = new Map<string, typeof overdueRecords>();
              for (const r of overdueRecords) {
                const arr = byDate.get(r.date) ?? [];
                arr.push(r);
                byDate.set(r.date, arr);
              }
              return Array.from(byDate.entries())
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([date, recs]) => (
                  <button
                    key={date}
                    onClick={() => handleShowOverdue(date)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white border border-amber-200/60 hover:border-amber-400 hover:shadow-sm transition-all text-left group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Clock className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                      <span className="text-xs font-medium text-amber-800">
                        {fmtShortDate(date, i18n.language)}
                      </span>
                      <span className="text-[11px] text-amber-600">
                        — {recs.map(r => r.worker.fullName ?? r.worker.username).join(', ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                        {recs.length}
                      </span>
                      <ChevronRight className="w-3 h-3 text-amber-400 group-hover:text-amber-600 transition-colors" />
                    </div>
                  </button>
                ));
            })()}
          </div>
        </div>
      )}

      {/* â”€â”€ Records container â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">

        {/* Card header */}
        <div className="px-6 py-4 border-b border-[#D4D4D8] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[#0A0A0A]">{t('admin:approvals.recordsTitle')}</h3>
            {!loading && !error && (
              <p className="text-xs text-[#71717A] mt-0.5">
                {t('admin:approvals.recordCount', { count: filtered.length })}
                {filtered.length !== records.length && ` ${t('admin:approvals.recordCountOf', { total: records.length })}`}
              </p>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="p-6">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-red-900">{t('admin:approvals.failedLoadRecords')}</p>
                  <p className="text-xs text-red-600 mt-0.5">{error}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={fetchRecords}
                className="gap-2 border-red-200 text-red-700 hover:bg-red-50 shrink-0">
                <RefreshCw className="w-3.5 h-3.5" />{t('common:buttons.retry')}
              </Button>
            </div>
          </div>
        )}

        {/* Desktop table */}
        {!error && (
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#FAFAFA] border-b border-[#D4D4D8] hover:bg-[#FAFAFA]">
                  <TableHead className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider pl-6">{t('admin:approvals.table.worker')}</TableHead>
                  <TableHead className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider">{t('admin:approvals.table.project')}</TableHead>
                  <TableHead className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider">{t('admin:approvals.table.date')}</TableHead>
                  <TableHead className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider">{t('admin:approvals.table.events')}</TableHead>
                  <TableHead className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider">{t('admin:approvals.table.status')}</TableHead>
                  <TableHead className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider pr-6 text-right">{t('admin:approvals.table.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Skeleton loading */}
                {loading && Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-b border-[#D4D4D8]/40">
                    <TableCell className="pl-6 py-4">
                      <div className="flex items-center gap-2">
                        <Skeleton className="w-8 h-8 rounded-full" />
                        <Skeleton className="h-4 w-28" />
                      </div>
                    </TableCell>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell className="pr-6"><Skeleton className="h-8 w-16 rounded-lg ml-auto" /></TableCell>
                  </TableRow>
                ))}

                {/* Empty state */}
                {!loading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-20 text-center">
                      <div className="flex flex-col items-center">
                        <div className="w-12 h-12 bg-[#FAFAFA] rounded-full flex items-center justify-center mb-3">
                          <Clock className="w-6 h-6 text-[#D4D4D8]" />
                        </div>
                        <p className="text-sm font-semibold text-[#0A0A0A] mb-1">
                          {records.length === 0 ? t('admin:approvals.emptyNoRecords') : t('admin:approvals.emptyNoMatch')}
                        </p>
                        <p className="text-xs text-[#71717A]">
                          {records.length === 0 ? t('admin:approvals.emptyNoRecordsHint') : t('admin:approvals.emptyNoMatchHint')}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}

                {/* Data rows */}
                {!loading && filtered.map(record => (
                  <TableRow key={record.id} className="border-b border-[#D4D4D8]/40 hover:bg-[#FAFAFA] transition-colors">
                    <TableCell className="pl-6 py-4">
                      <div className="flex items-center gap-2.5">
                        <WorkerAvatar record={record} />
                        <div>
                          <p className="text-sm font-semibold text-[#0A0A0A]">
                            {record.worker.fullName ?? record.worker.username}
                          </p>
                          <p className="text-xs font-mono text-[#71717A]">@{record.worker.username}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <p className="text-sm text-[#0A0A0A] max-w-[180px] truncate">{record.project.name}</p>
                    </TableCell>
                    <TableCell className="py-4">
                      <span className="text-xs text-[#71717A] whitespace-nowrap">{fmtShortDate(record.date, i18n.language)}</span>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm text-[#0A0A0A]">{record.events.length}/{record.events.some(e => e.type === 'IN_TRANSIT') ? 5 : 4}</span>
                        {hasLocationIssue(record) && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <AlertCircle className="w-3.5 h-3.5 text-amber-500 cursor-default" />
                            </TooltipTrigger>
                            <TooltipContent side="top">{t('admin:approvals.locationIssues')}</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <RecordSummaryBadge record={record} />
                    </TableCell>
                    <TableCell className="py-4 pr-6">
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          onClick={() => { setSelected(record); setView('detail'); }}
                          className="h-8 px-3 text-xs gap-1.5 bg-[#F97316] hover:bg-[#C2410C] text-white"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                          {t('admin:approvals.viewDetails')}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Mobile cards */}
        {!error && (
          <div className="md:hidden">
            {loading && (
              <div className="p-4 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="p-4 rounded-xl border border-[#D4D4D8] bg-[#FAFAFA] space-y-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="w-9 h-9 rounded-full" />
                      <div className="flex-1 space-y-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                    <Skeleton className="h-3 w-40" />
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </div>
                ))}
              </div>
            )}

            {!loading && filtered.length === 0 && !error && (
              <div className="flex flex-col items-center py-14 text-center px-4">
                <div className="w-12 h-12 bg-[#FAFAFA] rounded-full flex items-center justify-center mb-3">
                  <CalendarDays className="w-6 h-6 text-[#D4D4D8]" />
                </div>
                <p className="text-sm font-semibold text-[#0A0A0A] mb-1">
                  {records.length === 0 ? t('admin:approvals.emptyNoRecords') : t('admin:approvals.emptyNoMatch')}
                </p>
              </div>
            )}

            {!loading && (
              <div className="p-4 space-y-3">
                {filtered.map(record => (
                  <button
                    key={record.id} type="button"
                    onClick={() => { setSelected(record); setView('detail'); }}
                    className="w-full bg-white rounded-xl border border-[#D4D4D8] p-4 text-left hover:border-[#F97316]/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <WorkerAvatar record={record} />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#0A0A0A] truncate">
                            {record.worker.fullName ?? record.worker.username}
                          </p>
                          <p className="text-[10px] font-mono text-[#71717A]">@{record.worker.username}</p>
                        </div>
                      </div>
                      <RecordSummaryBadge record={record} />
                    </div>
                    <p className="text-xs text-[#71717A] mb-1 truncate">{record.project.name}</p>
                    <div className="flex items-center gap-3 text-[10px] text-[#71717A]">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />{fmtShortDate(record.date, i18n.language)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />{t('admin:approvals.eventsCount', { count: record.events.length })}
                      </span>
                      {hasLocationIssue(record) && (
                        <span className="flex items-center gap-1 text-amber-600">
                          <AlertCircle className="w-3 h-3" />{t('admin:approvals.issues')}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

    </div>
  );
}