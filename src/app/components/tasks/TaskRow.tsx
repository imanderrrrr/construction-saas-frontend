import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MoreVertical, Search } from 'lucide-react';
import { cn } from '../ui/utils';
import { FOCUS_RING, PrimaryButton, SecondaryButton } from '../onboarding/chrome';
import { Mono } from '../projects/bt';
import type { UserDTO } from '../../services/users';
import type { TaskResponse } from '../../services/tasks';
import { Avatar, CellEmpty, PRIORITY_EDGE, stampDue, stampShort, StepButton, StepChip, toInputDate } from './bits';
import { daysInStep, daysLate, type GroupKey, stepAfter } from './grouping';

/**
 * One task, and everything that can be done to it without opening it.
 *
 * The three floating panels — the ⋯ menu, the person picker and the date
 * picker — are anchored to their own cell and never centred with a backdrop:
 * they interrupt a list somebody is reading out loud.
 *
 * When an action changes which group the row belongs to, the row does not
 * move. It flashes, repaints, and its subline says where it has gone; it is
 * placed again on the next load. A list that reorders itself under the finger
 * loses the place of whoever is reading nine tasks aloud, and that is exactly
 * when this screen is used.
 */

export interface RowPermissions {
  canAssign: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export interface AssigneeOption {
  user: UserDTO;
  openTasks: number;
}

const GRID = 'grid grid-cols-[1fr_168px_124px_138px_172px] gap-[14px] items-center';
const GRID_TABLET = 'grid grid-cols-[1fr_40px_116px_164px] gap-3 items-center';

export function TaskRow({
  task, group, permissions, assignees, selected, flash, error, movedTo, lang, currentUserName,
  onOpen, onAdvance, onAssign, onUnassign, onSetDates, onEdit, onDelete, onSelect,
}: {
  task: TaskResponse;
  group: GroupKey;
  permissions: RowPermissions;
  assignees: AssigneeOption[];
  selected: boolean;
  /** Just changed: two seconds of paper and orange edge. */
  flash: boolean;
  /** The action failed: the row says so in its own subline and offers a retry. */
  error: { step: string; current: string } | null;
  /** The group this row now belongs to, while it is still drawn in the old one. */
  movedTo: GroupKey | null;
  lang: string;
  /** Whoever is reading. Their own tasks read "Tú", not their name back at them. */
  currentUserName: string | null;
  onOpen: () => void;
  onAdvance: () => void;
  onAssign: (userId: number) => void;
  onUnassign: () => void;
  onSetDates: (startDate: string | null, dueDate: string | null) => void;
  onEdit: () => void;
  onDelete: () => void;
  onSelect: () => void;
}) {
  const { t } = useTranslation(['tasks', 'common']);
  const [menuOpen, setMenuOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [datesOpen, setDatesOpen] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selected) rowRef.current?.focus({ preventScroll: false });
  }, [selected]);

  const next = stepAfter(task.status);
  const late = daysLate(task);
  const age = daysInStep(task);
  const closed = task.status === 'DONE';

  const groupLabel = (key: GroupKey) => ({
    overdue: t('tasks:group.overdue', { count: 0 }),
    today: t('tasks:group.today', { count: 0 }),
    week: t('tasks:group.week', { count: 0 }),
    noDates: t('tasks:group.noDates', { count: 0 }),
    closed: t('tasks:group.closed', { count: 0 }),
  }[key].replace(/ · 0$/, ''));

  const subline = error
    ? t('tasks:row.actionFailed', { step: error.step, current: error.current })
    : movedTo
      ? t('tasks:row.movesTo', { group: groupLabel(movedTo) })
      : age != null
        ? t('tasks:row.subline', {
          project: task.projectName,
          priority: t(`tasks:priority.${task.priority}`).toLowerCase(),
          days: age,
          step: t(`tasks:step.${task.status}`).toLowerCase(),
        })
        : t('tasks:row.subline.noAge', {
          project: task.projectName,
          priority: t(`tasks:priority.${task.priority}`).toLowerCase(),
        });

  const dueCell = closed ? (
    <CellEmpty>{t('tasks:row.closedToday')}</CellEmpty>
  ) : !task.dueDate ? (
    permissions.canEdit ? (
      <button
        type="button"
        onClick={e => { e.stopPropagation(); setDatesOpen(true); }}
        className={cn('font-bt-mono text-[10px] uppercase tracking-[0.06em] text-[#5A5346] border border-dashed border-[#DBD0BB] px-2 py-1.5 hover:border-[#F97316] hover:text-[#C2410C]', FOCUS_RING)}
      >
        {t('tasks:action.setDates')}
      </button>
    ) : (
      <CellEmpty>{t('tasks:group.noDates', { count: 1 }).split(' ·')[0]}</CellEmpty>
    )
  ) : late != null ? (
    <Mono className="text-[10px] font-semibold tracking-[0.06em] text-[#B3402A]">
      {t('tasks:due.late', { date: stampShort(task.dueDate, lang), count: late })}
    </Mono>
  ) : group === 'today' ? (
    <Mono className="text-[10px] font-semibold tracking-[0.06em] text-[#C2410C]">
      {t('tasks:due.today', { date: stampShort(task.dueDate, lang) })}
    </Mono>
  ) : (
    <Mono className="text-[10px] tracking-[0.06em] text-[#0B0A09]">{stampDue(task.dueDate, lang)}</Mono>
  );

  const assigneeName = task.assignedToName && task.assignedToName === currentUserName
    ? t('tasks:assignee.you')
    : task.assignedToName;

  const assigneeCell = assigneeName ? (
    <button
      type="button"
      disabled={!permissions.canAssign}
      onClick={e => { e.stopPropagation(); setAssignOpen(true); }}
      className={cn('flex items-center gap-2 min-w-0 text-left', permissions.canAssign && 'hover:text-[#C2410C]', permissions.canAssign && FOCUS_RING)}
    >
      <Avatar name={task.assignedToName} />
      <span className="text-[12px] text-[#0B0A09] truncate hidden lg:inline">{assigneeName}</span>
    </button>
  ) : permissions.canAssign ? (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); setAssignOpen(true); }}
      className={cn('inline-flex items-center gap-1.5 font-bt-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-[#5A5346] border border-dashed border-[#DBD0BB] px-2 py-[5px] hover:border-[#F97316] hover:text-[#C2410C]', FOCUS_RING)}
    >
      <span className="w-[18px] h-[18px] border border-dashed border-[#DBD0BB] inline-block" aria-hidden="true" />
      {t('tasks:action.assign')}
    </button>
  ) : (
    <CellEmpty>{t('tasks:unassigned')}</CellEmpty>
  );

  const actionCell = closed ? (
    <CellEmpty>{t('tasks:step.end')}</CellEmpty>
  ) : next ? (
    <StepButton
      label={error ? t('tasks:row.retry') : t('tasks:action.advance', { step: t(`tasks:step.${next}`) })}
      urgent={group === 'today' && !error}
      className={cn('flex-1 min-w-0', error && 'border-[#B3402A] text-[#B3402A]')}
      onClick={e => { e.stopPropagation(); onAdvance(); }}
    />
  ) : null;

  return (
    <div
      ref={rowRef}
      role="button"
      tabIndex={0}
      data-testid={`task-row-${task.id}`}
      aria-label={t('tasks:aria.selectRow', { title: task.title })}
      onClick={onOpen}
      onFocus={onSelect}
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onOpen(); } }}
      className={cn(
        'relative border-b border-[#F0EBE1] border-l-[3px] cursor-pointer transition-colors bg-white hover:bg-[#FBF8F2]',
        'px-4 md:px-4 py-2 md:py-2 min-h-[56px] md:min-h-[48px]',
        flash && 'bt-row-flash',
        closed && 'opacity-[0.72]',
        FOCUS_RING, 'focus-visible:outline-offset-[-2px]',
      )}
      style={{
        // The group outranks the priority: what is due today is orange and what
        // is finished is green, whatever the task's own priority says.
        borderLeftColor: group === 'today' ? '#F97316' : group === 'closed' ? '#2E7D4F' : PRIORITY_EDGE[task.priority],
      }}
    >
      {/* Desktop: five columns */}
      <div className={cn(GRID, 'hidden xl:grid')}>
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            {flash && !error && (
              <Mono className="text-[8.5px] font-semibold tracking-[0.1em] bg-[#F97316] text-[#0B0A09] px-1.5 py-[2px] flex-shrink-0">{t('tasks:row.new')}</Mono>
            )}
            <span className="text-[13.5px] font-semibold text-[#0B0A09] truncate">{task.title}</span>
          </div>
          <Mono className={cn('block text-[9px] tracking-[0.09em] mt-[3px] truncate', error ? 'text-[#B3402A] font-semibold' : movedTo ? 'text-[#C2410C] font-semibold' : 'text-[#A69C8D]')}>
            {subline}
          </Mono>
        </div>
        <div className="min-w-0">{assigneeCell}</div>
        <div><StepChip status={task.status} /></div>
        <div className="min-w-0">{dueCell}</div>
        <div className="flex items-center gap-1.5">
          {actionCell}
          <RowMenu
            open={menuOpen}
            onOpenChange={setMenuOpen}
            permissions={permissions}
            assigned={task.assignedToId != null}
            closed={closed}
            onOpen={onOpen}
            onEdit={onEdit}
            onUnassign={onUnassign}
            onDelete={onDelete}
          />
        </div>
      </div>

      {/* Tablet: the step drops into the subline, the person keeps only the avatar */}
      <div className={cn(GRID_TABLET, 'hidden md:grid xl:hidden')}>
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-[#0B0A09] truncate">{task.title}</div>
          <Mono className={cn('block text-[9px] tracking-[0.09em] mt-[3px] truncate', error ? 'text-[#B3402A] font-semibold' : 'text-[#A69C8D]')}>
            {subline}
          </Mono>
        </div>
        <div className="flex justify-center">{task.assignedToName ? <Avatar name={task.assignedToName} size={30} /> : <Avatar name={null} size={30} />}</div>
        <div className="min-w-0">{dueCell}</div>
        <div className="flex items-center gap-1.5">
          {actionCell}
          <RowMenu
            open={menuOpen} onOpenChange={setMenuOpen} permissions={permissions}
            assigned={task.assignedToId != null} closed={closed}
            onOpen={onOpen} onEdit={onEdit} onUnassign={onUnassign} onDelete={onDelete}
          />
        </div>
      </div>

      {/* Phone: a card */}
      <div className="md:hidden">
        <div className="flex items-start justify-between gap-2">
          <span className="text-[14.5px] font-semibold text-[#0B0A09] leading-[1.3]">{task.title}</span>
          {late != null && (
            <Mono className="text-[9px] font-semibold tracking-[0.1em] text-[#B3402A] flex-shrink-0 pt-1">+{late} d</Mono>
          )}
        </div>
        <Mono className={cn('block text-[9px] tracking-[0.09em] mt-1', error ? 'text-[#B3402A] font-semibold' : 'text-[#A69C8D]')}>{subline}</Mono>
        <div className="flex items-center gap-2 mt-2">
          <Avatar name={task.assignedToName} size={26} />
          <span className="text-[12px] text-[#0B0A09] truncate flex-1 min-w-0">{assigneeName ?? t('tasks:unassigned')}</span>
          <StepChip status={task.status} />
        </div>
        <div className="flex items-center gap-2 mt-2.5">
          {actionCell && <div className="flex-1">{actionCell}</div>}
          <RowMenu
            open={menuOpen} onOpenChange={setMenuOpen} permissions={permissions}
            assigned={task.assignedToId != null} closed={closed}
            onOpen={onOpen} onEdit={onEdit} onUnassign={onUnassign} onDelete={onDelete}
          />
        </div>
      </div>

      {assignOpen && (
        <AssigneePanel
          assignees={assignees}
          currentId={task.assignedToId}
          onPick={id => { setAssignOpen(false); onAssign(id); }}
          onClose={() => setAssignOpen(false)}
        />
      )}
      {datesOpen && (
        <DatePanel
          startDate={task.startDate}
          dueDate={task.dueDate}
          lang={lang}
          onSave={(s, d) => { setDatesOpen(false); onSetDates(s, d); }}
          onClose={() => setDatesOpen(false)}
        />
      )}
    </div>
  );
}

/** The ⋯ menu. Three entries at most, and never a "Reopen" the server has no endpoint for. */
function RowMenu({ open, onOpenChange, permissions, assigned, closed, onOpen, onEdit, onUnassign, onDelete }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  permissions: RowPermissions;
  assigned: boolean;
  closed: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onUnassign: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation(['tasks']);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, () => onOpenChange(false));

  const items = [
    { key: 'open', label: t('tasks:menu.open'), onClick: onOpen, show: true },
    { key: 'edit', label: t('tasks:menu.edit'), onClick: onEdit, show: permissions.canEdit && !closed },
    { key: 'unassign', label: t('tasks:menu.unassign'), onClick: onUnassign, show: permissions.canAssign && assigned },
    { key: 'delete', label: t('tasks:menu.delete'), onClick: onDelete, show: permissions.canDelete, danger: true },
  ].filter(i => i.show);

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        type="button"
        aria-label={t('tasks:action.more')}
        aria-expanded={open}
        onClick={e => { e.stopPropagation(); onOpenChange(!open); }}
        className={cn('w-[30px] h-[30px] md:w-[30px] md:h-[30px] flex items-center justify-center border border-[#DBD0BB] bg-white text-[#5A5346] hover:border-[#F97316] hover:text-[#C2410C]', FOCUS_RING)}
      >
        <MoreVertical className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div
          onClick={e => e.stopPropagation()}
          className="absolute right-0 top-[34px] z-30 w-[220px] bg-white border border-[#CDBFA6] shadow-[0_12px_32px_rgba(23,19,15,0.22)]"
        >
          {items.map(item => (
            <button
              key={item.key}
              type="button"
              onClick={() => { onOpenChange(false); item.onClick(); }}
              className={cn(
                'w-full text-left px-[13px] py-[11px] font-bt-mono text-[10.5px] uppercase tracking-[0.08em] border-b border-[#F0EBE1] last:border-b-0 hover:bg-[#F3EEE4]',
                item.danger ? 'text-[#B3402A]' : 'text-[#0B0A09]',
                FOCUS_RING, 'focus-visible:outline-offset-[-2px]',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The person picker: every user of the company, because that is what the
 * server accepts — no role filter — with their role underneath and their open
 * load beside it.
 */
function AssigneePanel({ assignees, currentId, onPick, onClose }: {
  assignees: AssigneeOption[];
  currentId: number | null;
  onPick: (id: number) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation(['tasks', 'common']);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const [showAll, setShowAll] = useState(false);
  useDismiss(ref, true, onClose);

  const needle = query.trim().toLowerCase();
  const matches = assignees.filter(a =>
    !needle || (a.user.fullName ?? a.user.username).toLowerCase().includes(needle) || a.user.username.toLowerCase().includes(needle),
  );
  const shown = showAll || needle ? matches : matches.slice(0, 4);

  return (
    <div
      ref={ref}
      onClick={e => e.stopPropagation()}
      className="absolute left-4 md:left-[30%] top-[46px] z-30 w-[288px] bg-white border border-[#CDBFA6] shadow-[0_12px_32px_rgba(23,19,15,0.22)]"
    >
      <div className="px-3 pt-3 pb-2 border-b border-[#F0EBE1]">
        <Mono className="block text-[9px] tracking-[0.12em] text-[#8A8175] mb-2">
          {t('tasks:assign.title', { count: assignees.length })}
        </Mono>
        <div className="relative">
          <Search className="w-3 h-3 text-[#A69C8D] absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('tasks:assign.search')}
            className={cn('w-full h-8 border border-[#DBD0BB] bg-[#FAF7F0] pl-7 pr-2 text-[12.5px] outline-none focus:border-[#F97316]', FOCUS_RING, 'focus-visible:outline-offset-[-1px]')}
          />
        </div>
      </div>
      <div className="max-h-[260px] overflow-y-auto">
        {shown.length === 0 && <div className="px-3 py-3 text-[12.5px] text-[#8A8175]">{t('tasks:assign.none')}</div>}
        {shown.map(({ user, openTasks }) => (
          <button
            key={user.id}
            type="button"
            onClick={() => onPick(user.id)}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-2 text-left border-b border-[#F0EBE1] last:border-b-0 hover:bg-[#FBF8F2]',
              user.id === currentId && 'bg-[#FBEDE0]',
              FOCUS_RING, 'focus-visible:outline-offset-[-2px]',
            )}
          >
            <Avatar name={user.fullName ?? user.username} size={24} />
            <span className="min-w-0 flex-1">
              <span className="block text-[12.5px] font-semibold text-[#0B0A09] truncate">{user.fullName ?? user.username}</span>
              <Mono className="block text-[9px] tracking-[0.08em] text-[#A69C8D] truncate">{user.role.toLowerCase()}</Mono>
            </span>
            <Mono className="text-[9px] tracking-[0.06em] text-[#5A5346] flex-shrink-0">{t('tasks:assign.load', { count: openTasks })}</Mono>
          </button>
        ))}
        {!showAll && !needle && matches.length > 4 && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className={cn('w-full px-3 py-2 font-bt-mono text-[9.5px] uppercase tracking-[0.1em] text-[#C2410C] hover:bg-[#FBF8F2]', FOCUS_RING)}
          >
            {t('tasks:assign.seeAll', { count: matches.length })}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * The date picker of a row. Past dates are accepted here: putting a date on a
 * task from the list is an edit, not a creation, and a task that was already
 * running late has to be able to say so.
 */
function DatePanel({ startDate, dueDate, lang, onSave, onClose }: {
  startDate: string | null;
  dueDate: string | null;
  lang: string;
  onSave: (startDate: string | null, dueDate: string | null) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation(['tasks', 'common']);
  const [start, setStart] = useState(startDate ?? '');
  const [due, setDue] = useState(dueDate ?? '');
  const [error, setError] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, true, onClose);

  const today = new Date();
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const friday = new Date(today); friday.setDate(today.getDate() + ((5 - today.getDay() + 7) % 7 || 7));
  const sunday = new Date(today); sunday.setDate(today.getDate() + ((0 - today.getDay() + 7) % 7 || 7));

  const shortcuts: { key: string; label: string; date: Date }[] = [
    { key: 'today', label: t('tasks:dates.today'), date: today },
    { key: 'tomorrow', label: t('tasks:dates.tomorrow'), date: tomorrow },
    { key: 'friday', label: t('tasks:dates.friday', { day: friday.getDate() }), date: friday },
    { key: 'sunday', label: t('tasks:dates.sunday', { day: sunday.getDate() }), date: sunday },
  ];

  const save = () => {
    if (start && due && due < start) { setError(true); return; }
    onSave(start || null, due || null);
  };

  const field = cn('w-full h-9 border border-[#DBD0BB] bg-white px-2.5 text-[12.5px] outline-none focus:border-[#F97316] tabular-nums', FOCUS_RING);

  return (
    <div
      ref={ref}
      onClick={e => e.stopPropagation()}
      className="absolute right-4 md:right-[190px] top-[46px] z-30 w-[300px] bg-white border border-[#CDBFA6] shadow-[0_12px_32px_rgba(23,19,15,0.22)] p-3"
    >
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <Mono className="block text-[9px] font-semibold tracking-[0.12em] text-[#5A5346] mb-1">{t('tasks:dates.start')}</Mono>
          <input type="date" value={start} onChange={e => { setStart(e.target.value); setError(false); }} className={field} />
        </div>
        <div>
          <Mono className="block text-[9px] font-semibold tracking-[0.12em] text-[#5A5346] mb-1">{t('tasks:dates.due')}</Mono>
          <input type="date" value={due} onChange={e => { setDue(e.target.value); setError(false); }} className={cn(field, error && 'border-[#B3402A]')} />
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2.5">
        {shortcuts.map(s => (
          <button
            key={s.key}
            type="button"
            onClick={() => { setDue(toInputDate(s.date)); setError(false); }}
            className={cn('font-bt-mono text-[9px] uppercase tracking-[0.08em] border border-[#DBD0BB] px-2 py-1 text-[#5A5346] hover:border-[#F97316] hover:text-[#C2410C]', FOCUS_RING)}
          >
            {s.label}
          </button>
        ))}
      </div>
      {error && (
        <Mono className="block text-[9px] font-semibold tracking-[0.08em] text-[#B3402A] mt-2">{t('tasks:dates.err.dueBeforeStart')}</Mono>
      )}
      <div className="flex items-center justify-between gap-2 mt-3">
        <SecondaryButton onClick={onClose} className="text-[10px] px-3 py-2">{t('common:buttons.cancel')}</SecondaryButton>
        <PrimaryButton onClick={save} className="text-[10px] px-3 py-2">{t('tasks:dates.save')}</PrimaryButton>
      </div>
    </div>
  );
}

/** Esc and a click outside close a floating panel. There is no backdrop to click. */
function useDismiss(ref: React.RefObject<HTMLElement>, active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('mousedown', onDown);
    };
  }, [ref, active, onClose]);
}
