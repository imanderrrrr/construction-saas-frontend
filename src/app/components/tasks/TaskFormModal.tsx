import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../ui/utils';
import { FIELD_LIMITS } from '../../../shared/fieldLimits';
import type { UserDTO } from '../../services/users';
import {
  createTask, updateTask, TASK_PRIORITIES,
  type TaskPriority, type TaskResponse,
} from '../../services/tasks';
import { BtModal } from '../bt/windows';
import { FOCUS_RING, PrimaryButton, SecondaryButton } from '../onboarding/chrome';
import { FieldError, FieldHint, FieldLabel, INPUT, INPUT_ERROR, Mono, PaperNote } from '../projects/bt';
import { daysInStep, daysLate } from './grouping';
import { stampShort, toInputDate } from './bits';

/**
 * 05 / 06 — new task and edit task, the same 560 px window.
 *
 * What was never possible: saying whose it is. The server has always accepted
 * `assignedToId` at creation and the form simply had no field, so no task
 * could leave this panel with an owner.
 *
 * Four differences when editing: the fields sit on white instead of paper
 * (something is written and is being changed), the project is read-only
 * (moving a task between projects has no endpoint), past dates are accepted,
 * and the header carries the age in the step — the figure that usually brought
 * whoever opened this window here.
 */

export interface ProjectOption { id: number; name: string }

interface Errors {
  projectId?: string;
  title?: string;
  description?: string;
  startDate?: string;
  dueDate?: string;
  server?: string;
}

export function TaskFormModal({ open, onOpenChange, task, projects, users, presetProjectId, lang, onSaved }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Null to create. */
  task: TaskResponse | null;
  projects: ProjectOption[];
  users: UserDTO[];
  presetProjectId?: number;
  lang: string;
  onSaved: (task: TaskResponse, mode: 'create' | 'edit') => void;
}) {
  const { t } = useTranslation(['tasks', 'common']);
  const editing = task != null;

  const [projectId, setProjectId] = useState<number | ''>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [assigneeId, setAssigneeId] = useState<number | ''>('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setProjectId(task?.projectId ?? presetProjectId ?? '');
    setTitle(task?.title ?? '');
    setDescription(task?.description ?? '');
    setPriority(task?.priority ?? 'MEDIUM');
    setAssigneeId(task?.assignedToId ?? '');
    setStartDate(task?.startDate ?? '');
    setDueDate(task?.dueDate ?? '');
    setErrors({});
    setSaving(false);
  }, [open, task, presetProjectId]);

  const submit = async () => {
    const next: Errors = {};
    if (!editing && !projectId) next.projectId = t('tasks:form.err.project');
    if (!title.trim()) next.title = t('tasks:form.err.title');
    if (title.length > FIELD_LIMITS.TITLE) next.title = t('tasks:form.err.tooLong', { count: FIELD_LIMITS.TITLE });
    if (description.length > FIELD_LIMITS.LONG_TEXT) next.description = t('tasks:form.err.tooLong', { count: FIELD_LIMITS.LONG_TEXT });
    // Creating a task is planning, and planning backwards means nothing. The
    // same rule the server now enforces.
    if (!editing && startDate && startDate < toInputDate(new Date())) next.startDate = t('tasks:form.err.pastStart');
    if (startDate && dueDate && dueDate < startDate) next.dueDate = t('tasks:form.err.dueBeforeStart');
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      if (editing) {
        const saved = await updateTask(task.id, {
          title: title.trim(),
          description: description.trim(),
          priority,
          assignedToId: assigneeId === '' ? undefined : Number(assigneeId),
          startDate: startDate || undefined,
          dueDate: dueDate || undefined,
        });
        onSaved(saved, 'edit');
      } else {
        const saved = await createTask({
          projectId: Number(projectId),
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          assignedToId: assigneeId === '' ? undefined : Number(assigneeId),
          startDate: startDate || undefined,
          dueDate: dueDate || undefined,
        });
        onSaved(saved, 'create');
      }
      onOpenChange(false);
    } catch {
      setErrors({ server: t('tasks:form.err.server') });
    } finally {
      setSaving(false);
    }
  };

  const age = task ? daysInStep(task) : null;
  const late = task ? daysLate(task) : null;
  const fieldBg = editing ? 'bg-white' : 'bg-[#FAF7F0]';

  return (
    <BtModal
      open={open}
      onOpenChange={onOpenChange}
      width={560}
      dismissible={false}
      closeDisabled={saving}
      kicker={editing ? t('tasks:form.edit.kicker') : t('tasks:form.new.kicker')}
      title={editing ? t('tasks:form.edit.title') : t('tasks:form.new.title')}
      description={editing && age != null && task
        ? t('tasks:form.edit.age', { step: t(`tasks:step.${task.status}`).toLowerCase(), date: task.stepSince ? stampShort(task.stepSince, lang) : '', days: age })
        : undefined}
      footer={
        <>
          <Mono className="text-[9px] tracking-[0.08em] text-[#A69C8D] md:mr-auto">
            {editing ? t('tasks:form.footer.edit') : t('tasks:form.footer.new')}
          </Mono>
          <SecondaryButton onClick={() => onOpenChange(false)} disabled={saving}>{t('common:buttons.cancel')}</SecondaryButton>
          <PrimaryButton onClick={submit} disabled={saving}>
            {saving
              ? (editing ? t('tasks:form.submitting.edit') : t('tasks:form.submitting.new'))
              : (editing ? t('tasks:form.submit.edit') : t('tasks:form.submit.new'))}
          </PrimaryButton>
        </>
      }
    >
      <div>
        <FieldLabel htmlFor="task-project" required={!editing}>{t('tasks:form.project')}</FieldLabel>
        {editing ? (
          <>
            <div className="w-full h-10 border border-[#DBD0BB] bg-[#F3EEE4] px-3 flex items-center text-sm text-[#8A8175]">
              {task.projectName}
            </div>
            <FieldHint>{t('tasks:form.project.locked')}</FieldHint>
          </>
        ) : (
          <>
            <select
              id="task-project"
              value={projectId}
              onChange={e => setProjectId(e.target.value ? Number(e.target.value) : '')}
              className={cn(INPUT, fieldBg, 'appearance-none cursor-pointer', errors.projectId && INPUT_ERROR)}
            >
              <option value="">{t('tasks:form.project.pick')}</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {errors.projectId ? <FieldError>{errors.projectId}</FieldError> : <FieldHint>{t('tasks:form.project.hint')}</FieldHint>}
          </>
        )}
      </div>

      <div className="mt-[14px]">
        <FieldLabel htmlFor="task-title" required>{t('tasks:form.title')}</FieldLabel>
        <input
          id="task-title"
          value={title}
          onChange={e => setTitle(e.target.value)}
          maxLength={FIELD_LIMITS.TITLE}
          className={cn(INPUT, fieldBg, errors.title && INPUT_ERROR)}
        />
        <div className="flex items-start justify-between gap-3">
          {errors.title ? <FieldError>{errors.title}</FieldError> : <FieldHint>{t('tasks:form.title.hint')}</FieldHint>}
          <Counter value={title.length} max={FIELD_LIMITS.TITLE} />
        </div>
      </div>

      <div className="mt-[14px]">
        <FieldLabel htmlFor="task-description">{t('tasks:form.description')}</FieldLabel>
        <textarea
          id="task-description"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder={t('tasks:form.description.placeholder')}
          rows={3}
          className={cn(INPUT, fieldBg, 'h-[76px] resize-none py-2 leading-[1.5]', errors.description && INPUT_ERROR)}
        />
        <div className="flex items-start justify-between gap-3">
          {errors.description ? <FieldError>{errors.description}</FieldError> : <FieldHint>{t('tasks:form.description.hint')}</FieldHint>}
          <Counter value={description.length} max={FIELD_LIMITS.LONG_TEXT} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-[14px] mt-[14px]">
        <div>
          <FieldLabel>{t('tasks:form.priority')}</FieldLabel>
          <div className="flex">
            {TASK_PRIORITIES.map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                aria-pressed={priority === p}
                className={cn(
                  'flex-1 py-[11px] font-bt-mono text-[9.5px] font-semibold uppercase tracking-[0.08em] border -ml-px first:ml-0 transition-colors',
                  priority === p
                    ? 'bg-[#0B0A09] text-[#F5F1E8] border-[#0B0A09]'
                    : cn('bg-white border-[#DBD0BB] hover:border-[#F97316]', p === 'URGENT' ? 'text-[#B3402A]' : 'text-[#5A5346]'),
                  FOCUS_RING, 'focus-visible:outline-offset-[-2px]',
                )}
              >
                {t(`tasks:priority.${p}`)}
              </button>
            ))}
          </div>
          <FieldHint>{t('tasks:form.priority.hint')}</FieldHint>
        </div>
        <div>
          <FieldLabel htmlFor="task-assignee">{t('tasks:form.assignee')}</FieldLabel>
          <select
            id="task-assignee"
            value={assigneeId}
            onChange={e => setAssigneeId(e.target.value ? Number(e.target.value) : '')}
            className={cn(INPUT, fieldBg, 'appearance-none cursor-pointer')}
          >
            <option value="">{t('tasks:unassigned')}</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.fullName ?? u.username}</option>)}
          </select>
          <FieldHint>{t('tasks:form.assignee.hint')}</FieldHint>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-[14px] mt-[14px]">
        <div>
          <FieldLabel htmlFor="task-start">{t('tasks:form.start')}</FieldLabel>
          <input
            id="task-start"
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className={cn(INPUT, fieldBg, 'tabular-nums', errors.startDate && INPUT_ERROR)}
          />
          {errors.startDate
            ? <FieldError>{errors.startDate}</FieldError>
            : <FieldHint>{editing ? t('tasks:form.start.hintEdit') : t('tasks:form.start.hint')}</FieldHint>}
        </div>
        <div>
          <FieldLabel htmlFor="task-due">{t('tasks:form.due')}</FieldLabel>
          <input
            id="task-due"
            type="date"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            className={cn(INPUT, fieldBg, 'tabular-nums', errors.dueDate && INPUT_ERROR)}
          />
          {errors.dueDate ? (
            <FieldError>{errors.dueDate}</FieldError>
          ) : editing && late != null ? (
            // Said, not blocked: the point of editing is often to move it.
            <Mono className="block text-[9.5px] tracking-[0.04em] uppercase text-[#B3402A] mt-[5px]">
              {t('tasks:form.due.overdue', { count: late })}
            </Mono>
          ) : (
            <FieldHint>{t('tasks:form.due.hint')}</FieldHint>
          )}
        </div>
      </div>

      {errors.server && <PaperNote tone="red" className="mt-4">{errors.server}</PaperNote>}
    </BtModal>
  );
}

/** "0 / 255", red past the limit. */
function Counter({ value, max }: { value: number; max: number }) {
  return (
    <Mono className={cn('text-[9.5px] tracking-[0.04em] tabular-nums mt-[5px] flex-shrink-0', value > max ? 'text-[#B3402A] font-semibold' : 'text-[#A69C8D]')}>
      {value} / {max}
    </Mono>
  );
}
