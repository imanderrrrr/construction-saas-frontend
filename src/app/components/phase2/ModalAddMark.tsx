import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, AlertCircle, AlertTriangle, Clock, UserCog } from 'lucide-react';
import { Button } from '../ui/button';
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '../ui/dialog';
import type { TimeEventType } from '../../types';
import { TIME_EVENT_SEQUENCE } from '../../types';
import { getManualMarkContext, type ManualMarkInput } from '../../services/time';

// Types

interface ModalAddMarkProps {
  open: boolean;
  recordId: number;
  workerId: number;
  workerName: string;
  projectName: string;
  /** Display-formatted date (parent formats with the active locale). */
  date: string;
  /** YYYY-MM-DD — new marks must belong to this date. */
  workDate: string;
  /** Standard punch types the record is missing, in sequence order. */
  missingTypes: TimeEventType[];
  onClose: () => void;
  onSubmit: (marks: ManualMarkInput[]) => Promise<void>;
}

// Helpers (same conversion logic as ModalCorrect / ModalEditTime)

function buildIso(workDate: string, timeValue: string): string {
  const [year, month, day] = workDate.split('-').map(Number);
  const [hh, mm] = timeValue.split(':').map(Number);
  const d = new Date(year, month - 1, day, hh, mm, 0, 0);
  return d.toISOString();
}

/**
 * Punch dependency chain (payroll safety, mirrors the backend rule):
 * LUNCH_START needs CHECK_IN, LUNCH_END needs LUNCH_START, CHECK_OUT needs
 * CHECK_IN — over existing + new marks combined. Returns the first violated
 * pair, or null.
 */
const MARK_DEPENDENCIES: [TimeEventType, TimeEventType][] = [
  ['LUNCH_START', 'CHECK_IN'],
  ['LUNCH_END', 'LUNCH_START'],
  ['CHECK_OUT', 'CHECK_IN'],
];

function findDependencyViolation(combined: Set<TimeEventType>): [TimeEventType, TimeEventType] | null {
  for (const [dependent, required] of MARK_DEPENDENCIES) {
    if (combined.has(dependent) && !combined.has(required)) return [dependent, required];
  }
  return null;
}

// Component

/**
 * ADMIN/FINANCE adds missing marks to an existing record. One time input per
 * missing punch type — filled rows are submitted together. Marks are created
 * PENDING (normal approval flow). Shows a yellow warning when the day falls
 * inside an already-paid payroll period (context endpoint).
 */
export function ModalAddMark({
  open, recordId, workerId, workerName, projectName, date, workDate, missingTypes, onClose, onSubmit,
}: ModalAddMarkProps) {
  const { t } = useTranslation(['time', 'common']);
  const [times, setTimes]     = useState<Partial<Record<TimeEventType, string>>>({});
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [paidPeriod, setPaidPeriod] = useState(false);
  const [recordPaid, setRecordPaid] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTimes({});
    setError('');
    setLoading(false);
    setPaidPeriod(false);
    setRecordPaid(false);
    // Payroll context — degrade silently if the endpoint isn't available yet.
    getManualMarkContext(workerId, workDate)
      .then(ctx => {
        setPaidPeriod(ctx.paidPeriod);
        setRecordPaid(ctx.records.find(r => r.recordId === recordId)?.paid ?? false);
      })
      .catch(() => { /* warning simply not shown; the backend still validates on submit */ });
  }, [open, workerId, workDate, recordId]);

  const filled = missingTypes.filter(type => (times[type] ?? '') !== '');

  /** Filled times must respect the punch sequence (HH:MM strings compare lexicographically). */
  const orderBroken = (() => {
    const seq = filled.map(type => times[type]!);
    return seq.some((v, i) => i > 0 && v <= seq[i - 1]);
  })();

  const handleClose = () => {
    if (loading) return;
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (filled.length === 0) {
      setError(t('manualMarks.atLeastOne', 'Fill in at least one mark.'));
      return;
    }
    if (orderBroken) {
      setError(t('manualMarks.orderError', 'Times must follow the punch order.'));
      return;
    }
    const presentTypes = TIME_EVENT_SEQUENCE.filter(type => !missingTypes.includes(type));
    const violation = findDependencyViolation(new Set([...presentTypes, ...filled]));
    if (violation) {
      setError(t('manualMarks.dependencyError', '{{mark}} requires a {{requires}} mark on the same day.',
        { mark: violation[0], requires: violation[1] }));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const marks: ManualMarkInput[] = filled.map(type => ({
        type,
        capturedAt: buildIso(workDate, times[type]!),
      }));
      await onSubmit(marks);
      handleClose();
    } catch (err) {
      // Keep the modal open and surface the backend's validation message.
      setError(err instanceof Error && err.message
        ? err.message
        : t('manualMarks.submitFailed', 'Could not create the marks. Check the times and try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-md bg-white">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <UserCog className="w-5 h-5 text-violet-700" />
            </div>
            <div>
              <DialogTitle className="text-[#0A0A0A]">{t('manualMarks.addTitle', 'Add missing marks')}</DialogTitle>
              <DialogDescription className="text-[11px]">
                {workerName} · {projectName} · {date}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Paid-period warning (yellow) */}
          {paidPeriod && (
            <div className="flex items-start gap-2 px-3.5 py-3 rounded-xl bg-amber-50 border border-amber-200"
              data-testid="paid-period-warning">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">
                {t('manualMarks.paidPeriodWarning',
                  'This day falls inside an already-paid period. New marks still require approval and will need an incremental re-payment of the period.')}
              </p>
            </div>
          )}

          {/* Record already paid — backend will refuse; explain up front */}
          {recordPaid && (
            <div className="flex items-start gap-2 px-3.5 py-3 rounded-xl bg-red-50 border border-red-200">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">
                {t('manualMarks.recordPaid', 'This record was already paid — marks can no longer be added to it.')}
              </p>
            </div>
          )}

          {/* One time input per missing punch type */}
          <div className="space-y-2.5">
            {missingTypes.map(type => (
              <div key={type} className="space-y-1">
                <label className="text-sm font-medium text-[#0A0A0A] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-violet-500" />
                  {t(`modalCorrect.event.${type}`)}
                  <span className="text-[10px] font-normal text-[#71717A] ml-1">
                    {t('manualMarks.optionalLeaveEmpty', '(leave empty to skip)')}
                  </span>
                </label>
                <input
                  type="time"
                  value={times[type] ?? ''}
                  onChange={e => { setTimes(prev => ({ ...prev, [type]: e.target.value })); setError(''); }}
                  disabled={loading || recordPaid}
                  data-testid={`time-input-${type}`}
                  className="w-full px-3.5 py-2.5 border rounded-xl text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 transition-all border-[#D4D4D8] focus:ring-violet-200 focus:border-violet-400 disabled:opacity-50 disabled:bg-[#FAFAFA] bg-white"
                />
              </div>
            ))}
          </div>

          {error ? (
            <p className="flex items-center gap-1 text-xs text-red-600">
              <AlertCircle className="w-3 h-3 flex-shrink-0" />{error}
            </p>
          ) : (
            <p className="text-[10px] text-[#71717A]">
              {t('manualMarks.pendingNote', 'Marks are created as PENDING and go through the normal approval flow, labeled with your username.')}
            </p>
          )}

          <DialogFooter className="pt-1">
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}
              className="border-[#D4D4D8] text-[#0A0A0A]">
              {t('common:buttons.cancel', 'Cancel')}
            </Button>
            <Button type="submit" disabled={loading || recordPaid || filled.length === 0}
              className="gap-2 bg-violet-600 hover:bg-violet-700 text-white">
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" />{t('manualMarks.submitting', 'Creating…')}</>
                : <><UserCog className="w-4 h-4" />{t('manualMarks.addSubmit', 'Add marks')}</>}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
