import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, AlertCircle, AlertTriangle, Clock, CalendarPlus, Info } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '../ui/dialog';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '../ui/select';
import type { TimeEventType } from '../../types';
import { TIME_EVENT_SEQUENCE } from '../../types';
import {
  createManualRecord, getManualMarkContext,
  type ManualMarkContextResponse, type ManualMarkInput,
} from '../../services/time';
import { listActiveUsers, type UserDTO } from '../../services/users';
import { businessToday } from '../../helpers/dateTime';
import { ApiError } from '../../lib/api';

// Types

interface ModalCreateDayProps {
  open: boolean;
  onClose: () => void;
  /** Called after a day is created so the parent can refetch the list. */
  onCreated: () => void;
}

/** The four standard punches — IN_TRANSIT is out of scope for manual creation. */
const MANUAL_TYPES = TIME_EVENT_SEQUENCE.filter(type => type !== 'IN_TRANSIT') as TimeEventType[];

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
 * CHECK_IN. Returns the first violated pair, or null.
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
 * ADMIN/FINANCE creates a full day (record + marks) from scratch for a
 * worker/supervisor: user → date → project (fed by the context endpoint, which
 * also drives the paid-period warning and the "record already exists" hint).
 * CHECK_IN is required; the day is born PENDING in the normal approval flow.
 */
export function ModalCreateDay({ open, onClose, onCreated }: ModalCreateDayProps) {
  const { t } = useTranslation(['time', 'common']);

  const [users, setUsers]           = useState<UserDTO[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userId, setUserId]         = useState('');
  const [workDate, setWorkDate]     = useState(businessToday);
  const [context, setContext]       = useState<ManualMarkContextResponse | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextFailed, setContextFailed]   = useState(false);
  const [projectId, setProjectId]   = useState('');
  const [times, setTimes]           = useState<Partial<Record<TimeEventType, string>>>({});
  const [error, setError]           = useState('');
  const [loading, setLoading]       = useState(false);

  // Load selectable subjects (workers + supervisors — supervisors punch too).
  useEffect(() => {
    if (!open) return;
    setUserId('');
    setWorkDate(businessToday());
    setContext(null);
    setContextFailed(false);
    setProjectId('');
    setTimes({});
    setError('');
    setLoading(false);
    setUsersLoading(true);
    Promise.all([listActiveUsers('WORKER'), listActiveUsers('SUPERVISOR')])
      .then(([workers, supervisors]) => setUsers([...workers, ...supervisors]))
      .catch(() => {
        setUsers([]);
        toast.error(t('manualMarks.usersLoadFailed', 'Could not load the user list.'));
      })
      .finally(() => setUsersLoading(false));
  }, [open]);

  // User + date chosen → fetch context (assigned projects, paid flag, existing records).
  useEffect(() => {
    if (!open || !userId || !workDate) return;
    setContextLoading(true);
    setContextFailed(false);
    setContext(null);
    setProjectId('');
    getManualMarkContext(Number(userId), workDate)
      .then(setContext)
      .catch(() => setContextFailed(true))
      .finally(() => setContextLoading(false));
  }, [open, userId, workDate]);

  const existingOnProject = context?.records.find(r => r.projectId === Number(projectId)) ?? null;
  const filled = MANUAL_TYPES.filter(type => (times[type] ?? '') !== '');
  const orderBroken = (() => {
    const seq = filled.map(type => times[type]!);
    return seq.some((v, i) => i > 0 && v <= seq[i - 1]);
  })();
  const canSubmit = !!userId && !!projectId && !!workDate
    && (times.CHECK_IN ?? '') !== '' && !existingOnProject && !loading;

  const handleClose = () => {
    if (loading) return;
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((times.CHECK_IN ?? '') === '') {
      setError(t('manualMarks.checkInRequired', 'CHECK_IN is required to create a day.'));
      return;
    }
    if (orderBroken) {
      setError(t('manualMarks.orderError', 'Times must follow the punch order.'));
      return;
    }
    const violation = findDependencyViolation(new Set(filled));
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
      await createManualRecord({
        userId: Number(userId),
        projectId: Number(projectId),
        workDate,
        marks,
      });
      toast.success(t('manualMarks.dayCreated', 'Day created — marks pending approval.'));
      onCreated();
      onClose();
    } catch (err) {
      const message = err instanceof ApiError && err.status === 404
        ? t('manualMarks.notAvailable', 'Manual marks are not available on the server yet.')
        : err instanceof Error ? err.message : t('manualMarks.submitFailed', 'Could not create the marks. Check the times and try again.');
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-md bg-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <CalendarPlus className="w-5 h-5 text-violet-700" />
            </div>
            <div>
              <DialogTitle className="text-[#0A0A0A]">{t('manualMarks.createTitle', 'Create day')}</DialogTitle>
              <DialogDescription className="text-[11px]">
                {t('manualMarks.createSubtitle', 'Register a full day on behalf of a worker or supervisor.')}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Subject (worker / supervisor) */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[#0A0A0A]">
              {t('manualMarks.userLabel', 'Worker / Supervisor')} <span className="text-red-500">*</span>
            </label>
            <Select value={userId} onValueChange={v => { setUserId(v); setError(''); }} disabled={usersLoading || loading}>
              <SelectTrigger className="h-10 border-[#D4D4D8] w-full" data-testid="create-day-user">
                <SelectValue placeholder={usersLoading ? t('manualMarks.loading', 'Loading…') : t('manualMarks.userPlaceholder', 'Select a user')} />
              </SelectTrigger>
              <SelectContent>
                {users.map(u => (
                  <SelectItem key={u.id} value={String(u.id)}>
                    {(u.fullName ?? u.username) + (u.role === 'SUPERVISOR' ? ` — ${t('manualMarks.supervisorTag', 'Supervisor')}` : '')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[#0A0A0A]">
              {t('manualMarks.dateLabel', 'Date')} <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={workDate}
              max={businessToday()}
              onChange={e => { setWorkDate(e.target.value); setError(''); }}
              disabled={loading}
              data-testid="create-day-date"
              className="w-full px-3.5 py-2.5 border rounded-xl text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 transition-all border-[#D4D4D8] focus:ring-violet-200 focus:border-violet-400 disabled:opacity-50 bg-white"
            />
          </div>

          {/* Project — fed by the context endpoint (subject's assigned ACTIVE projects) */}
          {userId && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#0A0A0A]">
                {t('manualMarks.projectLabel', 'Project')} <span className="text-red-500">*</span>
              </label>
              <Select value={projectId} onValueChange={v => { setProjectId(v); setError(''); }}
                disabled={contextLoading || loading || !context}>
                <SelectTrigger className="h-10 border-[#D4D4D8] w-full" data-testid="create-day-project">
                  <SelectValue placeholder={contextLoading ? t('manualMarks.loading', 'Loading…') : t('manualMarks.projectPlaceholder', 'Select a project')} />
                </SelectTrigger>
                <SelectContent>
                  {(context?.assignedProjects ?? []).map(p => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {context && context.assignedProjects.length === 0 && (
                <p className="text-[11px] text-[#71717A]">
                  {t('manualMarks.noProjects', 'This user has no active project assignments.')}
                </p>
              )}
              {contextFailed && (
                <p className="flex items-center gap-1 text-[11px] text-[#71717A]">
                  <Info className="w-3 h-3 flex-shrink-0" />
                  {t('manualMarks.notAvailable', 'Manual marks are not available on the server yet.')}
                </p>
              )}
            </div>
          )}

          {/* Paid-period warning (yellow) */}
          {context?.paidPeriod && (
            <div className="flex items-start gap-2 px-3.5 py-3 rounded-xl bg-amber-50 border border-amber-200"
              data-testid="paid-period-warning">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">
                {t('manualMarks.paidPeriodWarning',
                  'This day falls inside an already-paid period. New marks still require approval and will need an incremental re-payment of the period.')}
              </p>
            </div>
          )}

          {/* Record already exists on this project+date → route to "Add marks" */}
          {existingOnProject && (
            <div className="flex items-start gap-2 px-3.5 py-3 rounded-xl bg-red-50 border border-red-200"
              data-testid="record-exists-hint">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">
                {t('manualMarks.recordExists',
                  'A record already exists for this user, project and date (#{{id}}). Open it in the approvals list and use "Add marks" instead.',
                  { id: existingOnProject.recordId })}
              </p>
            </div>
          )}

          {/* Times for the four punches — CHECK_IN required */}
          <div className="space-y-2.5">
            {MANUAL_TYPES.map(type => (
              <div key={type} className="space-y-1">
                <label className="text-sm font-medium text-[#0A0A0A] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-violet-500" />
                  {t(`modalCorrect.event.${type}`)}
                  {type === 'CHECK_IN'
                    ? <span className="text-red-500">*</span>
                    : <span className="text-[10px] font-normal text-[#71717A] ml-1">{t('manualMarks.optionalLeaveEmpty', '(leave empty to skip)')}</span>}
                </label>
                <input
                  type="time"
                  value={times[type] ?? ''}
                  onChange={e => { setTimes(prev => ({ ...prev, [type]: e.target.value })); setError(''); }}
                  disabled={loading}
                  data-testid={`time-input-${type}`}
                  className="w-full px-3.5 py-2.5 border rounded-xl text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 transition-all border-[#D4D4D8] focus:ring-violet-200 focus:border-violet-400 disabled:opacity-50 bg-white"
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
            <Button type="submit" disabled={!canSubmit}
              className="gap-2 bg-violet-600 hover:bg-violet-700 text-white" data-testid="create-day-submit">
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" />{t('manualMarks.submitting', 'Creating…')}</>
                : <><CalendarPlus className="w-4 h-4" />{t('manualMarks.createSubmit', 'Create day')}</>}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
