import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { cn } from '../ui/utils';
import { FOCUS_RING, SecondaryButton } from '../onboarding/chrome';
import { Bone, CreateButton, EmptyWord, Mono } from '../projects/bt';
import type { TaskResponse } from '../../services/tasks';
import { GroupEmptyLine, GroupHeader, stampShort } from './bits';
import { GROUP_ORDER, groupOf, showsWhenEmpty, weekEnd, type GroupKey } from './grouping';
import { TaskRow, type AssigneeOption, type RowPermissions } from './TaskRow';

/**
 * The five urgency groups that replaced the four kanban columns.
 *
 * Two of them are drawn even at zero — Overdue and Due today — because their
 * emptiness is the answer to the question that brings anyone to this screen,
 * and a list that starts straight at "This week" makes you deduce it. The
 * other three vanish header and all: they answer nothing when empty and only
 * lengthen the walk of the eye.
 */

/** Finished work opens folded to its first two rows. */
const CLOSED_PREVIEW = 2;

export type ListState = 'loading' | 'data' | 'empty' | 'noMatch' | 'error' | 'forbidden';

export function TaskList({
  state, tasks, permissions, assignees, lang, today, selectedId, flashId, rowErrors, pinned, currentUserName,
  filterCount, openCount, onOpen, onAdvance, onAssign, onUnassign, onSetDates, onEdit, onDelete,
  onSelect, onNew, onRetry, onClearFilters,
}: {
  state: ListState;
  tasks: TaskResponse[];
  permissions: RowPermissions;
  assignees: AssigneeOption[];
  lang: string;
  today: Date;
  selectedId: number | null;
  flashId: number | null;
  rowErrors: Record<number, { step: string; current: string }>;
  /** Rows held in the group they were drawn in, until the next load. */
  pinned: Record<number, GroupKey>;
  /** The reader's display name: their own rows read "Tú". */
  currentUserName: string | null;
  /** How many filters are on — the "no matches" copy names the number. */
  filterCount: number;
  /** Open tasks in the whole tenant, for the "there are N but none match" line. */
  openCount: number | null;
  onOpen: (task: TaskResponse) => void;
  onAdvance: (task: TaskResponse) => void;
  onAssign: (task: TaskResponse, userId: number) => void;
  onUnassign: (task: TaskResponse) => void;
  onSetDates: (task: TaskResponse, startDate: string | null, dueDate: string | null) => void;
  onEdit: (task: TaskResponse) => void;
  onDelete: (task: TaskResponse) => void;
  onSelect: (task: TaskResponse) => void;
  onNew?: () => void;
  onRetry: () => void;
  onClearFilters: () => void;
}) {
  const { t } = useTranslation(['tasks', 'common']);
  const [closedOpen, setClosedOpen] = useState(false);

  // Grouped by where each row is *held*, not by where it now belongs: a row
  // whose action moved it stays put and says so in its subline.
  const groups = useMemo(() => {
    const out: Record<GroupKey, TaskResponse[]> = { overdue: [], today: [], week: [], noDates: [], closed: [] };
    for (const task of tasks) out[pinned[task.id] ?? groupOf(task, today)].push(task);
    return out;
  }, [tasks, today, pinned]);
  const sunday = useMemo(() => stampShort(weekEnd(today).toISOString().slice(0, 10), lang), [today, lang]);

  if (state === 'forbidden') {
    return (
      <div className="bg-white border border-[#E7E1D5]">
        <EmptyWord
          word={t('tasks:forbidden.word')}
          title={t('tasks:forbidden.lead')}
          hint={t('tasks:forbidden.body')}
          className="border-0 py-[76px]"
        />
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="bg-white border border-[#E7E1D5]">
        <EmptyWord
          tone="red"
          word={t('tasks:error.word')}
          title={t('tasks:error.lead')}
          hint={t('tasks:error.body')}
          className="border-0"
          action={<SecondaryButton onClick={onRetry} className="bg-[#FAF7F0]">{t('tasks:error.retry')}</SecondaryButton>}
        />
      </div>
    );
  }

  if (state === 'empty') {
    return (
      <div className="bg-white border border-[#E7E1D5]">
        <EmptyWord
          word={t('tasks:empty.none.word')}
          title={t('tasks:empty.none.lead')}
          hint={onNew ? t('tasks:empty.none.body') : t('tasks:empty.none.supervisor')}
          className="border-0 py-[76px]"
          action={onNew ? <CreateButton onClick={onNew}><Plus className="w-3.5 h-3.5" strokeWidth={2.4} />{t('tasks:new')}</CreateButton> : undefined}
        />
      </div>
    );
  }

  if (state === 'noMatch') {
    return (
      <div className="bg-white border border-[#E7E1D5]">
        <EmptyWord
          word={t('tasks:empty.filters.word')}
          title={openCount != null ? t('tasks:empty.filters.lead', { count: openCount, conditions: filterCount }) : t('tasks:empty.filters.word')}
          className="border-0"
          action={<SecondaryButton onClick={onClearFilters} className="bg-[#FAF7F0]">{t('tasks:empty.filters.clear', { count: filterCount })}</SecondaryButton>}
        />
      </div>
    );
  }

  const headerRow = (
    <div className="hidden md:grid xl:grid-cols-[1fr_168px_124px_138px_172px] grid-cols-[1fr_40px_116px_164px] gap-3 xl:gap-[14px] px-4 md:px-4 h-7 items-center bg-[#FBF8F2] border-b border-[#EDE7DB] font-bt-mono text-[9px] uppercase tracking-[0.13em] text-[#A69C8D]">
      <span>{t('tasks:col.task')}</span>
      <span className="hidden xl:block">{t('tasks:col.assignee')}</span>
      <span className="xl:hidden" />
      <span className="hidden xl:block">{t('tasks:col.step')}</span>
      <span>{t('tasks:col.due')}</span>
      <span>{t('tasks:col.next')}</span>
    </div>
  );

  if (state === 'loading') {
    return (
      <div className="bg-white border border-[#E7E1D5]" data-testid="task-list">
        {headerRow}
        {[0, 1].map(g => (
          <div key={g}>
            <div className="h-6 bg-[#0B0A09]" />
            {[0, 1].map(r => (
              <div key={r} className="px-4 py-3 border-b border-[#F0EBE1] space-y-2">
                <Bone className="w-[45%] h-[13px]" />
                <Bone className="w-[28%] h-[9px]" />
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  const noteFor: Partial<Record<GroupKey, string>> = {
    overdue: t('tasks:group.overdue.note'),
    week: t('tasks:group.week.note', { date: sunday }),
    noDates: t('tasks:group.noDates.note'),
    closed: t('tasks:group.closed.note'),
  };
  const labelFor = (group: GroupKey, count: number) => ({
    overdue: t('tasks:group.overdue', { count }),
    today: t('tasks:group.today', { count }),
    week: t('tasks:group.week', { count }),
    noDates: t('tasks:group.noDates', { count }),
    closed: t('tasks:group.closed', { count }),
  }[group]);

  return (
    <div className="bg-white border border-[#E7E1D5]" data-testid="task-list" data-tour="sec.schedules.groups">
      {headerRow}
      {GROUP_ORDER.map(group => {
        const rows = groups[group];
        if (rows.length === 0 && !showsWhenEmpty(group)) return null;
        const folded = group === 'closed' && !closedOpen;
        const shown = folded ? rows.slice(0, CLOSED_PREVIEW) : rows;
        return (
          <div key={group} data-testid={`task-group-${group}`}>
            <GroupHeader
              label={labelFor(group, rows.length)}
              note={noteFor[group]}
              right={group === 'closed' && rows.length > CLOSED_PREVIEW ? (
                <button
                  type="button"
                  onClick={() => setClosedOpen(o => !o)}
                  className={cn('font-bt-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-[#F97316] hover:text-[#F5F1E8]', FOCUS_RING)}
                >
                  {closedOpen ? t('tasks:group.closed.collapse') : t('tasks:group.closed.seeAll', { count: rows.length })}
                </button>
              ) : undefined}
            />
            {rows.length === 0 ? (
              <GroupEmptyLine>
                {group === 'overdue' ? t('tasks:group.overdue.none') : t('tasks:group.today.none')}
              </GroupEmptyLine>
            ) : (
              shown.map(task => (
                <TaskRow
                  key={task.id}
                  task={task}
                  group={group}
                  permissions={permissions}
                  assignees={assignees}
                  selected={task.id === selectedId}
                  flash={task.id === flashId}
                  error={rowErrors[task.id] ?? null}
                  movedTo={pinned[task.id] != null ? groupOf(task, today) : null}
                  lang={lang}
                  currentUserName={currentUserName}
                  onOpen={() => onOpen(task)}
                  onAdvance={() => onAdvance(task)}
                  onAssign={id => onAssign(task, id)}
                  onUnassign={() => onUnassign(task)}
                  onSetDates={(s, d) => onSetDates(task, s, d)}
                  onEdit={() => onEdit(task)}
                  onDelete={() => onDelete(task)}
                  onSelect={() => onSelect(task)}
                />
              ))
            )}
          </div>
        );
      })}
      <Mono className="sr-only">{t('tasks:group.closed.note')}</Mono>
    </div>
  );
}
