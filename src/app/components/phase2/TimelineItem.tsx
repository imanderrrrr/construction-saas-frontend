import { LogIn, LogOut, Utensils, MapPin, AlertTriangle, WifiOff, ShieldAlert, CheckCircle, PenLine, XCircle, Loader2, Car } from 'lucide-react';
import { TimeEvent, TimeEventType, LocationStatus, ApprovalStatus } from '../../types';
import { Button } from '../ui/button';

// â”€â”€â”€ Config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const EVENT_CONFIG: Record<TimeEventType, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  CHECK_IN:    { label: 'Check In',    icon: LogIn,    color: 'text-[#F97316]',  bg: 'bg-[#F97316]/10'  },
  LUNCH_START: { label: 'Lunch Start', icon: Utensils, color: 'text-amber-600',  bg: 'bg-amber-50'      },
  LUNCH_END:   { label: 'Lunch End',   icon: Utensils, color: 'text-amber-600',  bg: 'bg-amber-50'      },
  CHECK_OUT:   { label: 'Check Out',   icon: LogOut,   color: 'text-emerald-600',bg: 'bg-emerald-50'    },
  IN_TRANSIT:  { label: 'In Transit',  icon: Car,      color: 'text-blue-600',   bg: 'bg-blue-50'       },
};

const LOC_CONFIG: Record<LocationStatus, { icon: React.ElementType; color: string; label: string }> = {
  OK:           { icon: MapPin,        color: 'text-emerald-600', label: 'Location OK'         },
  NO_PERMISSION:{ icon: ShieldAlert,   color: 'text-amber-600',   label: 'No permission'       },
  UNAVAILABLE:  { icon: WifiOff,       color: 'text-[#71717A]',   label: 'Unavailable'         },
  OUT_OF_RANGE: { icon: AlertTriangle, color: 'text-red-600',     label: 'Out of range'        },
  NO_GEOFENCE:  { icon: MapPin,        color: 'text-[#71717A]',   label: 'No geofence'         },
};

const EVENT_STATUS_CONFIG: Record<ApprovalStatus, { label: string; className: string; icon: React.ElementType | null }> = {
  PENDING:  { label: 'Pending',   className: 'bg-amber-50 text-amber-700 border-amber-200',      icon: null         },
  APPROVED: { label: 'Approved',  className: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle  },
  OBSERVED: { label: 'Corrected', className: 'bg-[#F97316]/10 text-[#F97316] border-[#F97316]/20', icon: PenLine   },
  REJECTED: { label: 'Rejected',  className: 'bg-red-50 text-red-700 border-red-200',             icon: XCircle     },
};

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  } catch { return iso; }
}

// â”€â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


// --- Transition rules ---

/** Returns the set of statuses that a given event status can transition to. */
function allowedTransitions(current: ApprovalStatus): ApprovalStatus[] {
  switch (current) {
    case 'PENDING':  return ['APPROVED', 'OBSERVED', 'REJECTED'];
    case 'APPROVED': return ['OBSERVED', 'REJECTED'];
    case 'REJECTED': return ['APPROVED', 'OBSERVED'];
    case 'OBSERVED': return ['APPROVED', 'REJECTED'];
    default:         return [];
  }
}

interface TimelineItemProps {
  event: TimeEvent;
  isLast?: boolean;
  /** When provided along with onCorrect/onReject, per-event action buttons are shown. */
  onApprove?: (eventId: number) => void;
  onCorrect?: (eventId: number) => void;
  onReject?: (eventId: number) => void;
  /** ID of the event currently being actioned (disables buttons while loading). */
  actionEventId?: number | null;
}

export function TimelineItem({ event, isLast = false, onApprove, onCorrect, onReject, actionEventId }: TimelineItemProps) {
  const ec  = EVENT_CONFIG[event.type] ?? { label: event.type, icon: LogIn, color: 'text-[#71717A]', bg: 'bg-[#FAFAFA]' };
  const lc  = LOC_CONFIG[event.locationStatus] ?? { icon: MapPin, color: 'text-[#71717A]', label: event.locationStatus };
  const EventIcon = ec.icon;
  const LocIcon   = lc.icon;
  const hasIssue  = event.locationStatus !== 'OK';
  const isPending = event.approvalStatus === 'PENDING';
  const showActions = !!(onApprove && onCorrect && onReject);
  const isLoading = actionEventId === event.id;
  const sc = EVENT_STATUS_CONFIG[event.approvalStatus];
  const transitions = allowedTransitions(event.approvalStatus);
  const isTransit = event.type === 'IN_TRANSIT';

  return (
    <div className="flex items-start gap-4">
      {/* Dot + vertical line */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${ec.bg}`}>
          <EventIcon className={`w-4 h-4 ${ec.color}`} />
        </div>
        {!isLast && <div className="w-0.5 h-6 bg-[#D4D4D8] mt-1 rounded-full" />}
      </div>

      {/* Content */}
      <div className={`flex-1 ${isLast ? 'pb-0' : 'pb-4'}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#0A0A0A] font-mono">{ec.label}</p>
            <p className="text-xs text-[#71717A] mt-0.5">{fmtTime(event.capturedAt)}</p>
            {isTransit && event.sourceProjectName && (
              <p className="text-xs text-blue-600 mt-0.5">Transit from {event.sourceProjectName}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* Location chip */}
            <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold ${
              hasIssue ? 'bg-red-50 border border-red-100' : 'bg-emerald-50 border border-emerald-100'
            }`}>
              <LocIcon className={`w-3 h-3 ${lc.color}`} />
              <span className={lc.color}>{lc.label}</span>
            </div>
            {/* Per-event approval status badge */}
            <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold border ${sc.className}`}>
              {sc.icon && <sc.icon className="w-3 h-3" />}
              <span>{sc.label}</span>
            </div>
          </div>
        </div>

        {hasIssue && (
          <p className="text-[11px] text-[#71717A] mt-1">
            {event.locationStatus === 'NO_PERMISSION' && 'Worker had location access denied at this time.'}
            {event.locationStatus === 'UNAVAILABLE'   && 'GPS signal unavailable when punch was recorded.'}
            {event.locationStatus === 'OUT_OF_RANGE'  && 'Worker was outside the allowed project radius.'}
          </p>
        )}

        {/* Review note (corrected / rejected) */}
        {!isPending && event.reviewComment && (
          <div className={`mt-2 text-[11px] px-3 py-2 rounded-lg border ${
            event.approvalStatus === 'REJECTED'
              ? 'bg-red-50 border-red-100 text-red-700'
              : 'bg-[#F97316]/5 border-[#F97316]/15 text-[#F97316]'
          }`}>
            <span className="font-semibold">{event.reviewerUsername ?? 'Reviewer'}:</span>{' '}
            {event.reviewComment}
          </div>
        )}

        {/* Per-event action buttons — shown based on allowed status transitions */}
        {showActions && (
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {transitions.includes('APPROVED') && (
              <Button
                size="sm"
                onClick={() => onApprove!(event.id)}
                disabled={!!actionEventId}
                className="h-7 px-2.5 text-[11px] gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                Approve
              </Button>
            )}
            {transitions.includes('OBSERVED') && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onCorrect!(event.id)}
                disabled={!!actionEventId}
                className="h-7 px-2.5 text-[11px] gap-1 border-[#F97316]/30 text-[#F97316] hover:bg-[#F97316]/5"
              >
                <PenLine className="w-3 h-3" />Correct
              </Button>
            )}
            {transitions.includes('REJECTED') && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onReject!(event.id)}
                disabled={!!actionEventId}
                className="h-7 px-2.5 text-[11px] gap-1 border-red-200 text-red-600 hover:bg-red-50"
              >
                <XCircle className="w-3 h-3" />Reject
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


export function TimelineItemMissing({ type }: { type: TimeEventType }) {
  const ec = EVENT_CONFIG[type];
  const EventIcon = ec.icon;
  return (
    <div className="flex items-start gap-4 opacity-40">
      <div className="flex flex-col items-center flex-shrink-0">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#FAFAFA] border-2 border-dashed border-[#D4D4D8]">
          <EventIcon className="w-4 h-4 text-[#D4D4D8]" />
        </div>
      </div>
      <div className="flex-1 pb-4">
        <p className="text-sm font-medium text-[#D4D4D8] font-mono">{ec.label}</p>
        <p className="text-xs text-[#D4D4D8] mt-0.5">Not recorded</p>
      </div>
    </div>
  );
}
