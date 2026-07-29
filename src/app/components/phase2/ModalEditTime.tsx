import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '../ui/dialog';
import type { TimeEventType } from '../../types';
import { FIELD_LIMITS } from '../../../shared/fieldLimits';

interface ModalEditTimeProps {
  open: boolean;
  eventType: TimeEventType;
  /** ISO 8601 – pre-populates the picker with the event's current time */
  currentTime: string;
  /** YYYY-MM-DD – the new time must belong to this day */
  workDate: string;
  workerName: string;
  projectName: string;
  onClose: () => void;
  /** newTime: ISO 8601, reason: free-text justification */
  onSubmit: (newTime: string, reason: string) => Promise<void>;
}

const MIN_REASON_LENGTH = 10;

/** Converts an ISO 8601 Instant to "HH:mm" in the browser's local time. */
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

/** Combines workDate (YYYY-MM-DD) with timeValue ("HH:mm") into an ISO 8601 UTC string.
 *  Uses the local Date constructor to avoid "YYYY-MM-DD" being interpreted
 *  as UTC midnight, which would shift the date in UTC- zones. */
function buildIso(workDate: string, timeValue: string): string {
  const [year, month, day] = workDate.split('-').map(Number);
  const [hh, mm] = timeValue.split(':').map(Number);
  const d = new Date(year, month - 1, day, hh, mm, 0, 0);
  return d.toISOString();
}

export function ModalEditTime({
  open,
  eventType,
  currentTime,
  workDate,
  workerName,
  projectName,
  onClose,
  onSubmit,
}: ModalEditTimeProps) {
  const { t } = useTranslation('time');
  const [timeValue, setTimeValue] = useState('');
  const [reason, setReason]       = useState('');
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);

  // Pre-populate with the event's current time when the modal opens
  useEffect(() => {
    if (open) {
      setTimeValue(toTimeInputValue(currentTime));
      setReason('');
      setError('');
      setLoading(false);
    }
  }, [open, currentTime]);

  const eventLabel = t(`editModal.eventLabel.${eventType}`);
  const remainingChars = Math.max(0, MIN_REASON_LENGTH - reason.trim().length);
  const canSubmit = timeValue !== '' && reason.trim().length >= MIN_REASON_LENGTH;

  const handleClose = () => {
    if (loading) return;
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) {
      if (!timeValue) setError(t('editModal.errorNoTime'));
      else setError(t('editModal.errorMinReason', { min: MIN_REASON_LENGTH }));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const newIso = buildIso(workDate, timeValue);
      await onSubmit(newIso, reason.trim());
      handleClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('editModal.errorGeneric');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-md bg-white">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <DialogTitle className="text-[#0A0A0A]">
                {t('editModal.title', { event: eventLabel })}
              </DialogTitle>
              <DialogDescription className="text-[11px]">
                {workerName} · {projectName} · {workDate}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Time picker */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[#0A0A0A]">
              {t('editModal.newTimeLabel', { event: eventLabel })} <span className="text-red-500">*</span>
            </label>
            <input
              type="time"
              value={timeValue}
              onChange={e => { setTimeValue(e.target.value); setError(''); }}
              disabled={loading}
              className={`w-full px-3.5 py-2.5 border rounded-xl text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 transition-all ${
                error && !timeValue
                  ? 'border-red-400 focus:ring-red-200'
                  : 'border-[#D4D4D8] focus:ring-amber-300 focus:border-amber-500'
              } ${loading ? 'opacity-50 bg-[#FAFAFA]' : 'bg-white'}`}
            />
          </div>

          {/* Reason field */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[#0A0A0A]">
              {t('editModal.reasonLabel')} <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={e => { setReason(e.target.value); setError(''); }}
              placeholder={t('editModal.reasonPlaceholder')}
              rows={3}
              maxLength={FIELD_LIMITS.LONG_TEXT}
              disabled={loading}
              className={`w-full px-3.5 py-3 border rounded-xl text-sm text-[#0A0A0A] placeholder:text-[#71717A] resize-none focus:outline-none focus:ring-2 transition-all ${
                error && reason.trim().length < MIN_REASON_LENGTH
                  ? 'border-red-400 focus:ring-red-200'
                  : 'border-[#D4D4D8] focus:ring-amber-300 focus:border-amber-500'
              } ${loading ? 'opacity-50 bg-[#FAFAFA]' : 'bg-white'}`}
            />
            <div className="flex items-start justify-between gap-2">
              {error ? (
                <p className="flex items-center gap-1 text-xs text-red-600">
                  <AlertCircle className="w-3 h-3 flex-shrink-0" />{error}
                </p>
              ) : (
                <p className="text-[10px] text-[#71717A]">
                  {t('editModal.auditNote')}
                </p>
              )}
              {remainingChars > 0 && (
                <span className="text-[10px] text-[#71717A] shrink-0">
                  {t('editModal.charsRemaining', { count: remainingChars })}
                </span>
              )}
            </div>
          </div>

          <DialogFooter className="pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
              className="border-[#D4D4D8] text-[#0A0A0A]"
            >
              {t('editModal.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={loading || !canSubmit}
              className="gap-2 bg-amber-500 hover:bg-amber-600 text-white"
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" />{t('editModal.saving')}</>
                : <><Clock className="w-4 h-4" />{t('editModal.save')}</>}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
