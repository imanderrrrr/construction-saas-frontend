import React, { useState, useEffect } from 'react';
import { MessageSquare, Loader2, AlertCircle, PenLine, XCircle, Clock } from 'lucide-react';
import { Button } from '../ui/button';
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '../ui/dialog';
import type { TimeEventType } from '../../types';

// Types

type ActionType = 'correct' | 'reject';

interface ModalCorrectProps {
  open: boolean;
  action: ActionType;
  workerName: string;
  projectName: string;
  date: string;
  /** Required when action === 'correct' to enable optional time editing */
  eventType?: TimeEventType;
  /** ISO 8601 — pre-fills the time picker with the event's current time */
  currentTime?: string;
  /** YYYY-MM-DD — the new time must belong to this date */
  workDate?: string;
  onClose: () => void;
  /** newTime is ISO 8601 and only passed if the supervisor changed the time */
  onSubmit: (comment: string, newTime?: string) => Promise<void>;
}

// Config

const ACTION_CONFIG: Record<ActionType, {
  icon: React.ElementType; iconBg: string; iconColor: string;
  title: string; submitLabel: string; submitClass: string;
  placeholder: string;
}> = {
  correct: {
    icon: PenLine,
    iconBg: 'bg-[#F97316]/10', iconColor: 'text-[#F97316]',
    title: 'Add correction note',
    submitLabel: 'Submit correction',
    submitClass: 'bg-[#F97316] hover:bg-[#C2410C] text-white',
    placeholder: 'Describe the issue or correction needed. Minimum 10 characters.',
  },
  reject: {
    icon: XCircle,
    iconBg: 'bg-red-50', iconColor: 'text-red-600',
    title: 'Reject time record',
    submitLabel: 'Reject record',
    submitClass: 'bg-red-600 hover:bg-red-700 text-white',
    placeholder: 'State the reason for rejection. Required, minimum 10 characters.',
  },
};

const EVENT_LABELS: Record<TimeEventType, string> = {
  CHECK_IN:    'Check In',
  LUNCH_START: 'Lunch Start',
  LUNCH_END:   'Lunch End',
  CHECK_OUT:   'Check Out',
};

const MIN_COMMENT_LENGTH = 10;

// Helpers (same logic as ModalEditTime)

function toTimeInputValue(isoString: string): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  } catch {
    return '';
  }
}

function buildIso(workDate: string, timeValue: string): string {
  const [year, month, day] = workDate.split('-').map(Number);
  const [hh, mm] = timeValue.split(':').map(Number);
  const d = new Date(year, month - 1, day, hh, mm, 0, 0);
  return d.toISOString();
}

// Component

export function ModalCorrect({ open, action, workerName, projectName, date, eventType, currentTime, workDate, onClose, onSubmit }: ModalCorrectProps) {
  const [comment, setComment]     = useState('');
  const [timeValue, setTimeValue] = useState('');
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);

  const cfg = ACTION_CONFIG[action];
  const IconComp = cfg.icon;
  const remaining = Math.max(0, MIN_COMMENT_LENGTH - comment.trim().length);
  const originalTime = currentTime ? toTimeInputValue(currentTime) : '';
  const showTimeField = action === 'correct' && !!currentTime && !!workDate;
  const timeWasChanged = showTimeField && timeValue !== '' && timeValue !== originalTime;

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setComment('');
      setTimeValue(currentTime ? toTimeInputValue(currentTime) : '');
      setError('');
      setLoading(false);
    }
  }, [open, currentTime]);

  const handleClose = () => {
    if (loading) return;
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = comment.trim();
    if (trimmed.length < MIN_COMMENT_LENGTH) {
      setError(`Comment must be at least ${MIN_COMMENT_LENGTH} characters.`);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const newTime = timeWasChanged && workDate ? buildIso(workDate, timeValue) : undefined;
      await onSubmit(trimmed, newTime);
      handleClose();
    } catch {
      setError('Failed to submit. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-md bg-white">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className={`w-10 h-10 ${cfg.iconBg} rounded-xl flex items-center justify-center flex-shrink-0`}>
              <IconComp className={`w-5 h-5 ${cfg.iconColor}`} />
            </div>
            <div>
              <DialogTitle className="text-[#0A0A0A]">{cfg.title}</DialogTitle>
              <DialogDescription className="text-[11px]">
                {workerName} · {projectName} · {date}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Optional time field — only for 'correct' action */}
          {showTimeField && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#0A0A0A] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                Corrected time
                <span className="text-[10px] font-normal text-[#71717A] ml-1">(optional)</span>
                {eventType && (
                  <span className="text-[10px] font-normal text-[#71717A]">— {EVENT_LABELS[eventType]}</span>
                )}
              </label>
              <input
                type="time"
                value={timeValue}
                onChange={e => { setTimeValue(e.target.value); setError(''); }}
                disabled={loading}
                className={`w-full px-3.5 py-2.5 border rounded-xl text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 transition-all ${
                  timeWasChanged
                    ? 'border-amber-400 focus:ring-amber-200 focus:border-amber-500'
                    : 'border-[#D4D4D8] focus:ring-[#F97316]/20 focus:border-[#F97316]'
                } ${loading ? 'opacity-50 bg-[#FAFAFA]' : 'bg-white'}`}
              />
              <p className="text-[10px] text-[#71717A]">
                {timeWasChanged
                  ? `Original time: ${originalTime} — will be updated.`
                  : 'Leave unchanged to keep the original time.'}
              </p>
            </div>
          )}

          {/* Required comment field */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[#0A0A0A]">
              Comment <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <textarea
                value={comment}
                onChange={e => { setComment(e.target.value); setError(''); }}
                placeholder={cfg.placeholder}
                rows={4}
                disabled={loading}
                className={`w-full px-3.5 py-3 border rounded-xl text-sm text-[#0A0A0A] placeholder:text-[#71717A] resize-none focus:outline-none focus:ring-2 transition-all ${
                  error ? 'border-red-400 focus:ring-red-200' : 'border-[#D4D4D8] focus:ring-[#F97316]/20 focus:border-[#F97316]'
                } ${loading ? 'opacity-50 bg-[#FAFAFA]' : 'bg-white'}`}
              />
            </div>
            <div className="flex items-start justify-between gap-2">
              {error ? (
                <p className="flex items-center gap-1 text-xs text-red-600">
                  <AlertCircle className="w-3 h-3 flex-shrink-0" />{error}
                </p>
              ) : (
                <p className="text-[10px] text-[#71717A]">
                  <MessageSquare className="w-3 h-3 inline mr-1" />
                  Supervisor comment — visible to worker and admin.
                </p>
              )}
              {remaining > 0 && (
                <span className="text-[10px] text-[#71717A] shrink-0">{remaining} more</span>
              )}
            </div>
          </div>

          <DialogFooter className="pt-1">
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}
              className="border-[#D4D4D8] text-[#0A0A0A]">
              Cancel
            </Button>
            <Button type="submit" disabled={loading || comment.trim().length < MIN_COMMENT_LENGTH}
              className={`gap-2 ${cfg.submitClass}`}>
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" />Submitting…</>
                : <><IconComp className="w-4 h-4" />{cfg.submitLabel}</>}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
