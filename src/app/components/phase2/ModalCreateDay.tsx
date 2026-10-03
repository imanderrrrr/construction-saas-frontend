import React, { useCallback, useState, useEffect } from 'react';
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
import { SecondaryButton } from '../onboarding/chrome';
import { PaperNote } from '../projects/bt';

// Types

interface ModalCreateDayProps {
  open: boolean;
  onClose: () => void;
  /** Called after a day is created so the parent can refetch the list. */
  onCreated: () => void;
  /**
   * Only people of this role can be picked. The finance panel approves the
   * supervisors' hours (workers stay with the admins), so it creates days for
   * supervisors only.
   */
  subjectRole?: 'SUPERVISOR';
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
export function ModalCreateDay({ open, onClose, onCreated, subjectRole }: ModalCreateDayProps) {
  const { t } = useTranslation(['time', 'common']);

  const [users, setUsers]           = useState<UserDTO[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersFailed, setUsersFailed]   = useState(false);
  const [userId, setUserId]         = useState('');
  const [workDate, setWorkDate]     = useState(businessToday);
  const [context, setContext]       = useState<ManualMarkContextResponse | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextFailed, setContextFailed]   = useState(false);
  const [projectId, setProjectId]   = useState('');
  const [times, setTimes]           = useState<Partial<Record<TimeEventType, string>>>({});
  const [error, setError]           = useState('');
  const [loading, setLoading]       = useState(false);

  // Selectable subjects: workers + supervisors (supervisors punch too), or
  // only `subjectRole`. A failure is said in the window, with a retry — a
  // toast fades and leaves an empty picker that reads as "nobody to pick".
  const loadUsers = useCallback(() => {
    setUsersLoading(true);
    setUsersFailed(false);
    const usersRequest = subjectRole
      ? listActiveUsers(subjectRole)
      : Promise.all([listActiveUsers('WORKER'), listActiveUsers('SUPERVISOR')]).then(([workers, supervisors]) => [...workers, ...supervisors]);
    usersRequest
      .then(setUsers)
      .catch(() => {
        setUsers([]);
        setUsersFailed(true);
      })
      .finally(() => setUsersLoading(false));
  }, [subjectRole]);

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
    loadUsers();
  }, [open, loadUsers]);

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
      <DialogContent className="sm:max-w-md bg-white rounded-none border-[#CDBFA6] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 bg-[#FBEDE0] rounded-none flex items-center justify-center flex-shrink-0">
              <CalendarPlus className="w-5 h-5 text-[#C2410C]" />
            </div>
            <div>
              <DialogTitle className="font-bt-display uppercase text-2xl text-[#0A0A0A]">{t('manualMarks.createTitle', 'Create day')}</DialogTitle>
              <DialogDescription className="text-[11px] text-[#5A5346]">
                {subjectRole
                  ? t('manualMarks.createSubtitle.supervisor', 'Register a full day on behalf of a supervisor.')
                  : t('manualMarks.createSubtitle', 'Register a full day on behalf of a worker or supervisor.')}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Subject (worker / supervisor) */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[#0A0A0A]">
              {subjectRole ? t('common:roles.SUPERVISOR', 'Supervisor') : t('manualMarks.userLabel', 'Worker / Supervisor')} <span className="text-[#B3402A]">*</span>
            </label>
            <Select value={userId} onValueChange={v => { setUserId(v); setError(''); }} disabled={usersLoading || loading}>
              <SelectTrigger className="rounded-none bg-white h-10 border-[#DBD0BB] w-full data-[placeholder]:text-[#8A8175]" data-testid="create-day-user">
                <SelectValue placeholder={usersLoading ? t('manualMarks.loading', 'Loading…') : t('manualMarks.userPlaceholder', 'Select a user')} />
              </SelectTrigger>
              <SelectContent>
                {users.map(u => (
                  <SelectItem key={u.id} value={String(u.id)}>
                    {/* The role tag only tells people apart when both roles are listed. */}
                    {(u.fullName ?? u.username) + (u.role === 'SUPERVISOR' && !subjectRole ? ` — ${t('manualMarks.supervisorTag', 'Supervisor')}` : '')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {usersFailed && (
              <div data-testid="create-day-users-failed">
                <PaperNote tone="red" className="flex items-center justify-between gap-3">
                  <span>{t('manualMarks.usersLoadFailed', 'Could not load the user list.')}</span>
                  <SecondaryButton onClick={loadUsers} className="bg-white text-[10px] px-3 py-1.5">
                    {t('common:buttons.retry', 'Retry')}
                  </SecondaryButton>
                </PaperNote>
              </div>
            )}
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[#0A0A0A]">
              {t('manualMarks.dateLabel', 'Date')} <span className="text-[#B3402A]">*</span>
            </label>
            <input
              type="date"
              value={workDate}
              max={businessToday()}
              onChange={e => { setWorkDate(e.target.value); setError(''); }}
              disabled={loading}
              data-testid="create-day-date"
              className="w-full px-3.5 py-2.5 border rounded-none text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 transition-all border-[#DBD0BB] focus:ring-[#F97316]/25 focus:border-[#F97316] disabled:opacity-50 bg-white"
            />
          </div>

          {/* Project — fed by the context endpoint (subject's assigned ACTIVE projects) */}
          {userId && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#0A0A0A]">
                {t('manualMarks.projectLabel', 'Project')} <span className="text-[#B3402A]">*</span>
              </label>
              <Select value={projectId} onValueChange={v => { setProjectId(v); setError(''); }}
                disabled={contextLoading || loading || !context}>
                <SelectTrigger className="rounded-none bg-white h-10 border-[#DBD0BB] w-full data-[placeholder]:text-[#8A8175]" data-testid="create-day-project">
                  <SelectValue placeholder={contextLoading ? t('manualMarks.loading', 'Loading…') : t('manualMarks.projectPlaceholder', 'Select a project')} />
                </SelectTrigger>
                <SelectContent>
                  {(context?.assignedProjects ?? []).map(p => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {context && context.assignedProjects.length === 0 && (
                <p className="text-[11px] text-[#8A8175]">
                  {t('manualMarks.noProjects', 'This user has no active project assignments.')}
                </p>
              )}
              {contextFailed && (
                <p className="flex items-center gap-1 text-[11px] text-[#8A8175]">
                  <Info className="w-3 h-3 flex-shrink-0" />
                  {t('manualMarks.notAvailable', 'Manual marks are not available on the server yet.')}
                </p>
              )}
            </div>
          )}

          {/* Paid-period warning */}
          {context?.paidPeriod && (
            <div data-testid="paid-period-warning">
              <PaperNote tone="orange" className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-[#C2410C] flex-shrink-0 mt-0.5" />
                <p>
                  {t('manualMarks.paidPeriodWarning',
                    'This day falls inside an already-paid period. New marks still require approval and will need an incremental re-payment of the period.')}
                </p>
              </PaperNote>
            </div>
          )}

          {/* Record already exists on this project+date → route to "Add marks" */}
          {existingOnProject && (
            <div data-testid="record-exists-hint">
              <PaperNote tone="red" className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-[#B3402A] flex-shrink-0 mt-0.5" />
                <p>
                  {t('manualMarks.recordExists',
                    'A record already exists for this user, project and date (#{{id}}). Open it in the approvals list and use "Add marks" instead.',
                    { id: existingOnProject.recordId })}
                </p>
              </PaperNote>
            </div>
          )}

          {/* Times for the four punches — CHECK_IN required */}
          <div className="space-y-2.5">
            {MANUAL_TYPES.map(type => (
              <div key={type} className="space-y-1">
                <label className="text-sm font-medium text-[#0A0A0A] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#C2410C]" />
                  {t(`modalCorrect.event.${type}`)}
                  {type === 'CHECK_IN'
                    ? <span className="text-[#B3402A]">*</span>
                    : <span className="text-[10px] font-normal text-[#8A8175] ml-1">{t('manualMarks.optionalLeaveEmpty', '(leave empty to skip)')}</span>}
                </label>
                <input
                  type="time"
                  value={times[type] ?? ''}
                  onChange={e => { setTimes(prev => ({ ...prev, [type]: e.target.value })); setError(''); }}
                  disabled={loading}
                  data-testid={`time-input-${type}`}
                  className="w-full px-3.5 py-2.5 border rounded-none text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 transition-all border-[#DBD0BB] focus:ring-[#F97316]/25 focus:border-[#F97316] disabled:opacity-50 bg-white"
                />
              </div>
            ))}
          </div>

          {error ? (
            <p className="flex items-center gap-1 text-xs text-[#B3402A]">
              <AlertCircle className="w-3 h-3 flex-shrink-0" />{error}
            </p>
          ) : (
            <p className="text-[10px] text-[#8A8175]">
              {t('manualMarks.pendingNote', 'Marks are created as PENDING and go through the normal approval flow, labeled with your username.')}
            </p>
          )}

          <DialogFooter className="pt-1">
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}
              className="rounded-none bg-white border-[#DBD0BB] text-[#5A5346] hover:bg-white hover:border-[#F97316] hover:text-[#C2410C] font-bt-mono uppercase text-[10px] tracking-[0.07em]">
              {t('common:buttons.cancel', 'Cancel')}
            </Button>
            <Button type="submit" disabled={!canSubmit}
              className="rounded-none bg-[#0A0A0A] hover:bg-[#C2410C] text-[#F5F1E8] font-bt-mono uppercase text-[10px] tracking-[0.07em] gap-2" data-testid="create-day-submit">
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
