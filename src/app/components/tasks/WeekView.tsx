import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../ui/utils';
import { FOCUS_RING, SecondaryButton } from '../onboarding/chrome';
import { EmptyWord, Mono } from '../projects/bt';
import type { TaskResponse } from '../../services/tasks';
import { Avatar, PRIORITY_EDGE, stampShort, STEP_MARK } from './bits';
import { daysBetween, daysLate, parseDay, weekStart } from './grouping';

/**
 * 11 — the week.
 *
 * Not another section: the same tasks seen from the other side. The list
 * answers what is due now; this answers who cannot take any more and what
 * overlaps, so the rows are people (or projects) and never steps. The step
 * drops to a two-letter mark inside the bar.
 *
 * A bar runs from start date to due date. With only a due date it occupies
 * that one day; with only a start date it runs from the start to Sunday with
 * its right end open. It is never cropped and never stretched: a bar that
 * leaves the week keeps its full width and grows an edge mark with the real
 * date outside, which is what tells it apart from one that happens to begin on
 * Monday and end on Sunday.
 */

type RowMode = 'people' | 'projects';

const DAY_MS = 86_400_000;

interface Bar {
  task: TaskResponse;
  /** 0-6 within the visible week. */
  from: number;
  to: number;
  /** The task starts before this week / ends after it. */
  cutLeft: boolean;
  cutRight: boolean;
  late: number | null;
}

export function WeekView({ tasks, lang, today, onOpen, onAssign, onSetDates }: {
  tasks: TaskResponse[];
  lang: string;
  today: Date;
  onOpen: (task: TaskResponse) => void;
  onAssign: (task: TaskResponse) => void;
  onSetDates: (task: TaskResponse) => void;
}) {
  const { t } = useTranslation(['tasks', 'common']);
  const [offset, setOffset] = useState(0);
  const [mode, setMode] = useState<RowMode>('people');

  const start = useMemo(() => {
    const d = weekStart(today);
    d.setDate(d.getDate() + offset * 7);
    return d;
  }, [today, offset]);
  const end = useMemo(() => new Date(start.getTime() + 6 * DAY_MS), [start]);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => new Date(start.getTime() + i * DAY_MS)),
    [start],
  );

  /** Where a task's bar lands in this week, or null when it misses it entirely. */
  const barOf = (task: TaskResponse): Bar | null => {
    if (!task.startDate && !task.dueDate) return null;
    const from = task.startDate ? parseDay(task.startDate) : parseDay(task.dueDate!);
    // Only a start date: it runs to Sunday with the right end open.
    const to = task.dueDate ? parseDay(task.dueDate) : end;
    if (to < start || from > end) return null;
    return {
      task,
      from: Math.max(0, daysBetween(start, from)),
      to: Math.min(6, daysBetween(start, to)),
      cutLeft: from < start,
      cutRight: to > end,
      late: daysLate(task, today),
    };
  };

  const undated = tasks.filter(t2 => !t2.startDate && !t2.dueDate && t2.status !== 'DONE');

  const rows = useMemo(() => {
    const map = new Map<string, { key: string; label: string; isUnassigned: boolean; bars: Bar[]; tasks: TaskResponse[] }>();
    for (const task of tasks) {
      const bar = barOf(task);
      if (!bar) continue;
      const key = mode === 'people'
        ? (task.assignedToId != null ? `u${task.assignedToId}` : 'none')
        : `p${task.projectId}`;
      const label = mode === 'people'
        ? (task.assignedToName ?? t('tasks:week.unassigned'))
        : task.projectName;
      if (!map.has(key)) map.set(key, { key, label, isUnassigned: mode === 'people' && key === 'none', bars: [], tasks: [] });
      const row = map.get(key)!;
      row.bars.push(bar);
      row.tasks.push(task);
    }
    // Rows sort by urgency: whoever has something overdue first, then due
    // today. "Unassigned" always sinks to the end, on orange paper.
    return [...map.values()].sort((a, b) => {
      if (a.isUnassigned !== b.isUnassigned) return a.isUnassigned ? 1 : -1;
      const overdue = (r: typeof a) => r.bars.filter(x => x.late != null).length;
      if (overdue(b) !== overdue(a)) return overdue(b) - overdue(a);
      return a.label.localeCompare(b.label);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- barOf closes over start/end/today, all derived from the deps below
  }, [tasks, mode, start, end, today, t]);

  const label = t('tasks:week.range', {
    from: stampShort(toISO(start), lang),
    to: stampShort(toISO(end), lang),
    week: isoWeek(start),
  });
  const isThisWeek = offset === 0;

  const nav = (
    <div className="flex items-center gap-1.5" data-tour="sec.schedules-semana.nav">
      <button
        type="button" onClick={() => setOffset(o => o - 1)} aria-label={t('tasks:week.prev')}
        className={cn('w-8 h-8 border border-[#DBD0BB] bg-[#FAF7F0] flex items-center justify-center text-[#0B0A09] hover:border-[#F97316] hover:text-[#C2410C]', FOCUS_RING)}
      >
        <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2.4} />
      </button>
      <Mono className="text-[11px] font-semibold tracking-[0.1em] text-[#0B0A09] min-w-[168px] text-center">{label}</Mono>
      <button
        type="button" onClick={() => setOffset(o => o + 1)} aria-label={t('tasks:week.next')}
        className={cn('w-8 h-8 border border-[#DBD0BB] bg-[#FAF7F0] flex items-center justify-center text-[#0B0A09] hover:border-[#F97316] hover:text-[#C2410C]', FOCUS_RING)}
      >
        <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.4} />
      </button>
    </div>
  );

  return (
    <div className="space-y-3" data-testid="week-view">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {nav}
        <div className="flex" data-tour="sec.schedules-semana.rows">
          {(['people', 'projects'] as RowMode[]).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={cn(
                'px-3.5 py-2 font-bt-mono text-[10px] font-semibold uppercase tracking-[0.1em] border -ml-px first:ml-0 transition-colors',
                mode === m ? 'bg-[#0B0A09] text-[#F5F1E8] border-[#0B0A09]' : 'bg-white border-[#DBD0BB] text-[#5A5346] hover:text-[#0B0A09]',
                FOCUS_RING,
              )}
            >
              {m === 'people' ? t('tasks:week.rows.people') : t('tasks:week.rows.projects')}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-[#E7E1D5] overflow-x-auto">
        <div className="min-w-[900px]">
          <div className="grid grid-cols-[200px_repeat(7,1fr)] border-b border-[#EDE7DB] bg-[#FBF8F2]">
            <div className="px-3.5 py-2">
              <Mono className="text-[9px] tracking-[0.13em] text-[#A69C8D]">
                {mode === 'people' ? t('tasks:week.rows.person') : t('tasks:week.rows.project')}
              </Mono>
            </div>
            {days.map((d, i) => {
              const isToday = sameDay(d, today);
              return (
                <div key={i} className={cn('px-2 py-2 border-l border-[#EDE7DB]', isToday && 'bg-[#F3EEE4]', (i === 5 || i === 6) && !isToday && 'bg-[#FAF7F0]')}>
                  <Mono className={cn('text-[9px] tracking-[0.1em]', isToday ? 'text-[#C2410C] font-semibold' : 'text-[#A69C8D]')}>
                    {d.toLocaleDateString(lang.startsWith('es') ? 'es-GT' : 'en-US', { weekday: 'short', day: 'numeric' }).replace(/\./g, '')}
                    {isToday && ` · ${t('tasks:week.today')}`}
                  </Mono>
                </div>
              );
            })}
          </div>

          {rows.length === 0 ? (
            <EmptyWord
              word={t('tasks:week.empty.word')}
              title={t('tasks:week.empty.lead', { from: stampShort(toISO(start), lang), to: stampShort(toISO(end), lang) })}
              className="border-0"
              action={!isThisWeek ? <SecondaryButton onClick={() => setOffset(0)} className="bg-[#FAF7F0]">{t('tasks:week.empty.back')}</SecondaryButton> : undefined}
            />
          ) : (
            rows.map(row => (
              <div key={row.key} className={cn('grid grid-cols-[200px_repeat(7,1fr)] border-b border-[#F0EBE1] min-h-[50px]', row.isUnassigned && 'bg-[#FBEDE0]')}>
                <div className="px-3.5 py-2.5 flex items-center gap-2 min-w-0">
                  {mode === 'people' && <Avatar name={row.isUnassigned ? null : row.label} />}
                  <span className="min-w-0">
                    <span className="block text-[12.5px] font-semibold text-[#0B0A09] truncate">{row.label}</span>
                    <Mono className="block text-[9px] tracking-[0.08em] text-[#A69C8D] truncate">{loadLine(row.bars, t)}</Mono>
                  </span>
                </div>
                <div className="col-span-7 relative py-1.5 pr-2">
                  <div className="grid grid-cols-7 absolute inset-0 pointer-events-none" aria-hidden="true">
                    {days.map((d, i) => (
                      <div key={i} className={cn('border-l border-[#EDE7DB]', sameDay(d, today) && 'bg-[#F3EEE4]', (i === 5 || i === 6) && !sameDay(d, today) && 'bg-[#FAF7F0]')} />
                    ))}
                  </div>
                  <div className="relative flex flex-col gap-[5px]">
                    {row.bars.map(bar => (
                      <BarView
                        key={bar.task.id}
                        bar={bar}
                        lang={lang}
                        onOpen={() => onOpen(bar.task)}
                        onAssign={() => onAssign(bar.task)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* The drawer is always mounted, empty included: tasks with no dates fit
          in no week, and pretending they do not exist is how they get lost. */}
      <div className="bg-white border border-[#E7E1D5] border-l-[3px] border-l-[#CDBFA6] px-3.5 py-2.5 flex flex-wrap items-center gap-3 min-h-[44px]" data-tour="sec.schedules-semana.undated">
        <Mono className="text-[9.5px] font-semibold tracking-[0.12em] text-[#0B0A09]">
          {t('tasks:week.undated', { count: undated.length })}
        </Mono>
        {undated.length === 0 ? (
          <Mono className="text-[9.5px] tracking-[0.08em] text-[#A69C8D]">{t('tasks:week.undated.none')}</Mono>
        ) : (
          <div className="flex flex-wrap gap-2 flex-1 min-w-0">
            {undated.map(task => (
              <button
                key={task.id}
                type="button"
                onClick={() => onSetDates(task)}
                className={cn('inline-flex items-center gap-2 border border-dashed border-[#DBD0BB] px-2 py-1 text-[12px] text-[#0B0A09] hover:border-[#F97316] hover:text-[#C2410C]', FOCUS_RING)}
              >
                <span className="truncate max-w-[220px]">{task.title}</span>
                <Mono className="text-[9px] tracking-[0.08em] text-[#C2410C]">{t('tasks:action.setDates')}</Mono>
              </button>
            ))}
          </div>
        )}
        <Mono className="text-[9px] tracking-[0.08em] text-[#A69C8D] ml-auto hidden md:block">{t('tasks:week.undated.note')}</Mono>
      </div>
    </div>
  );
}

/** One bar. It never crops: it grows an edge mark and the real date outside the week. */
function BarView({ bar, lang, onOpen, onAssign }: { bar: Bar; lang: string; onOpen: () => void; onAssign: () => void }) {
  const { t, i18n } = useTranslation(['tasks']);
  const mark = STEP_MARK[bar.task.status][i18n.language.startsWith('es') ? 'es' : 'en'];
  const overdue = bar.late != null;
  const unowned = bar.task.assignedToId == null;

  return (
    <div className="grid grid-cols-7 items-center">
      <div
        className="min-w-0 flex items-center gap-1.5"
        style={{ gridColumnStart: bar.from + 1, gridColumnEnd: bar.to + 2 }}
      >
        <button
          type="button"
          onClick={onOpen}
          className={cn(
            'flex-1 min-w-0 h-[30px] flex items-center gap-2 px-2 mx-[3px] border bg-white text-left transition-colors hover:border-[#F97316]',
            overdue ? 'border-[#B3402A]' : 'border-[#DBD0BB]',
            FOCUS_RING,
          )}
          style={{ borderLeftWidth: 3, borderLeftColor: overdue ? '#B3402A' : PRIORITY_EDGE[bar.task.priority] }}
        >
          {bar.cutLeft && (
            <Mono className={cn('text-[8.5px] font-semibold tracking-[0.06em] flex-shrink-0', overdue ? 'text-[#B3402A]' : 'text-[#8A8175]')}>
              ◀ {bar.task.startDate ? stampShort(bar.task.startDate, lang) : ''}
            </Mono>
          )}
          <Mono className="text-[8.5px] font-semibold tracking-[0.1em] bg-[#F3EEE4] text-[#5A5346] px-1 py-[2px] flex-shrink-0">{mark}</Mono>
          <span className="text-[11.5px] text-[#0B0A09] truncate flex-1 min-w-0">{bar.task.title}</span>
          {bar.cutRight && bar.task.dueDate && (
            <Mono className="text-[8.5px] font-semibold tracking-[0.06em] text-[#8A8175] flex-shrink-0">{stampShort(bar.task.dueDate, lang)} ▶</Mono>
          )}
        </button>
        {unowned && (
          <button
            type="button"
            onClick={onAssign}
            className={cn('font-bt-mono text-[9px] font-semibold uppercase tracking-[0.1em] border border-dashed border-[#F97316] text-[#C2410C] px-[7px] py-1 flex-shrink-0', FOCUS_RING)}
          >
            {t('tasks:action.assign')}
          </button>
        )}
      </div>
      {/* The overdue notice sits in the free space to the bar's right, never
          inside it: it does not fit there. */}
      {overdue && bar.to < 6 && (
        <div style={{ gridColumnStart: bar.to + 2, gridColumnEnd: 8 }} className="pl-2 min-w-0">
          <Mono className="text-[9px] font-semibold tracking-[0.1em] text-[#B3402A] truncate">
            {t('tasks:week.overdueMark', { date: stampShort(bar.task.dueDate!, lang), count: bar.late ?? 0 })}
          </Mono>
        </div>
      )}
    </div>
  );
}

function loadLine(bars: Bar[], t: (k: string, o?: Record<string, unknown>) => string): string {
  if (bars.length === 0) return t('tasks:week.load.none');
  const overdue = bars.filter(b => b.late != null).length;
  const parts = [t('tasks:week.load.open', { count: bars.length })];
  if (overdue > 0) parts.push(t('tasks:week.load.overdue', { count: overdue }));
  return parts.join(' · ');
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** ISO-8601 week number, so "semana 37" means the same thing everywhere. */
function isoWeek(d: Date): number {
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDay + 3);
  return 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * DAY_MS));
}
