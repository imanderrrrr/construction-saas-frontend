import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, RefreshCw, Search } from 'lucide-react';
import { cn } from '../ui/utils';
import { ApiError, api } from '../../lib/api';
import { FIELD_LIMITS } from '../../../shared/fieldLimits';
import { useTourScopeWhileMounted } from '../../lib/tourScope';
import { AuthService } from '../../services/auth';
import { listUsers, type UserDTO } from '../../services/users';
import {
  deleteTask, getSupervisorTask, getSupervisorTasksSummary, getTask, getTasksSummary,
  listSupervisorTasks, listTasks, moveTask, supervisorMoveTask, unassignTask, updateTask,
  TASK_STATUSES,
  type TaskResponse, type TaskStatus, type TaskSummary,
} from '../../services/tasks';
import { FOCUS_RING, SecondaryButton } from '../onboarding/chrome';
import { Bone, CreateButton, Mono, MonoSelect } from '../projects/bt';
import { stampLongDay } from './bits';
import { groupOf, stepAfter, type GroupKey } from './grouping';
import { TaskList, type ListState } from './TaskList';
import type { AssigneeOption, RowPermissions } from './TaskRow';
import { TaskFormModal, type ProjectOption } from './TaskFormModal';
import { TaskWindow } from './TaskWindow';
import { ConfirmCompleteModal, ConfirmDeleteModal } from './TaskConfirmModals';
import { WeekView } from './WeekView';

/**
 * Tareas — the section (Claude Design "Tareas BuildTrack", concept 1C).
 *
 * The kanban is gone. Its four columns promised a way back the server has
 * never allowed, and its drag-and-drop was HTML5 — which does not answer to a
 * finger, so the site manager with the tablet could see the board and not move
 * anything on it. What replaced it is the day's report: one list across every
 * project, grouped by urgency, with a button on every row named after the next
 * step.
 *
 * The same component serves the supervisor. The differences are permissions,
 * not a second screen: no creating, editing, deleting or assigning, and the
 * header speaks in the second person.
 *
 * The section key stays `schedules` — renaming it would reset everyone's
 * "already seen this" flag for the tour. Only the menu label changed.
 */

/** The whole list is fetched in one page: the groups have to be complete to be honest. */
const PAGE_SIZE = 100;
const FLASH_MS = 2200;
/** Below this the week's seven day-columns cannot be drawn without lying. */
const WEEK_MIN_WIDTH = 1200;

type View = 'list' | 'week';

export function TasksSection({ supervisor = false }: { supervisor?: boolean } = {}) {
  const { t, i18n } = useTranslation(['tasks', 'common']);
  const lang = i18n.language;
  const today = useMemo(() => new Date(), []);

  const [view, setView] = useState<View>('list');
  const [wide, setWide] = useState(() => typeof window === 'undefined' || window.innerWidth >= WEEK_MIN_WIDTH);
  useEffect(() => {
    const onResize = () => setWide(window.innerWidth >= WEEK_MIN_WIDTH);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  useEffect(() => { if (!wide && view === 'week') setView('list'); }, [wide, view]);

  useTourScopeWhileMounted(view === 'week' ? 'schedules-semana' : null, t('tasks:week.title'));

  const [tasks, setTasks] = useState<TaskResponse[]>([]);
  const [state, setState] = useState<ListState>('loading');
  const [reloadNonce, setReloadNonce] = useState(0);

  const [summary, setSummary] = useState<TaskSummary | null>(null);
  const [summaryFailed, setSummaryFailed] = useState(false);

  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [users, setUsers] = useState<UserDTO[]>([]);

  // Filters
  const [projectId, setProjectId] = useState<number | ''>('');
  const [assigneeId, setAssigneeId] = useState<number | '' | 'none'>('');
  const [status, setStatus] = useState<'' | TaskStatus>('');
  const [showClosed, setShowClosed] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Interaction
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [flashId, setFlashId] = useState<number | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<number, { step: string; current: string }>>({});
  /**
   * Rows whose action moved them to another group, held in the group they were
   * drawn in until the next load. A list that reorders itself under the finger
   * loses the place of whoever is reading nine tasks out loud, and that is
   * exactly when this screen is used — so the counters move at once and the row
   * says where it has gone instead of jumping there.
   */
  const [pinned, setPinned] = useState<Record<number, GroupKey>>({});

  /**
   * Whoever is reading, by the name the rows carry. The supervisor's list is
   * his own, so a task assigned to him reads "Tú" instead of his own name
   * repeated back at him.
   *
   * Matched on the display name rather than an id because `/auth/me` does not
   * return one, and `assignedToName` is built from the same `fullName ??
   * username` the session knows.
   */
  const [me, setMe] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    AuthService.getMe()
      .then(m => { if (!cancelled) setMe(m.fullName ?? m.username); })
      .catch(() => { /* the rows just show the name; nothing else depends on it */ });
    return () => { cancelled = true; };
  }, []);

  // Windows
  const [formOpen, setFormOpen] = useState(false);
  const [formTask, setFormTask] = useState<TaskResponse | null>(null);
  const [openTask, setOpenTask] = useState<TaskResponse | null>(null);
  const [completeTask, setCompleteTask] = useState<TaskResponse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TaskResponse | null>(null);

  const permissions: RowPermissions = {
    canAssign: !supervisor,
    canEdit: !supervisor,
    canDelete: !supervisor,
  };

  const searchTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (search === debouncedSearch) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 350);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search, debouncedSearch]);

  const fetchTasks = useCallback(async () => {
    setState('loading');
    setPinned({});
    try {
      const query = {
        projectId: projectId || undefined,
        assigneeId: typeof assigneeId === 'number' ? assigneeId : undefined,
        unassigned: assigneeId === 'none' || undefined,
        status: status || undefined,
        openOnly: !showClosed || undefined,
        search: debouncedSearch || undefined,
        size: PAGE_SIZE,
      };
      const page = supervisor ? await listSupervisorTasks(query) : await listTasks(query);
      setTasks(page.content);
      const hasFilters = !!(projectId || assigneeId || status || debouncedSearch);
      setState(page.content.length === 0 ? (hasFilters ? 'noMatch' : 'empty') : 'data');
    } catch (err) {
      setState(err instanceof ApiError && err.status === 403 ? 'forbidden' : 'error');
    }
  }, [projectId, assigneeId, status, showClosed, debouncedSearch, supervisor, reloadNonce]); // eslint-disable-line react-hooks/exhaustive-deps -- reloadNonce forces a refetch with unchanged filters

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const fetchSummary = useCallback(() => {
    const load = supervisor ? getSupervisorTasksSummary : getTasksSummary;
    load()
      .then(s => { setSummary(s); setSummaryFailed(false); })
      .catch(() => setSummaryFailed(true));
  }, [supervisor]);
  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  // The two lists the filters and the form need. The admin's only: a
  // supervisor neither assigns nor creates, so asking for them would be a
  // pointless call that a 403 would then make look like a failure.
  useEffect(() => {
    if (supervisor) return;
    api<{ content: ProjectOption[] }>('/api/v1/admin/projects?size=200')
      .then(p => setProjects(p.content))
      .catch(() => { /* the chips degrade to "all projects"; the list still loads */ });
    listUsers({ size: 200 })
      .then(u => setUsers(u.content))
      .catch(() => { /* the picker degrades to empty and says so */ });
  }, [supervisor]);

  useEffect(() => {
    if (flashId == null) return;
    const timer = window.setTimeout(() => setFlashId(null), FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [flashId]);

  const assignees: AssigneeOption[] = useMemo(
    () => users.map(u => ({ user: u, openTasks: summary?.openByAssignee?.[String(u.id)] ?? 0 })),
    [users, summary],
  );

  /** Replace one row in place. The list is never reordered under the finger. */
  const replace = useCallback((task: TaskResponse) => {
    setTasks(prev => {
      const before = prev.find(t2 => t2.id === task.id);
      if (before) {
        const wasIn = groupOf(before, today);
        if (wasIn !== groupOf(task, today)) setPinned(p => ({ ...p, [task.id]: wasIn }));
      }
      return prev.map(t2 => (t2.id === task.id ? task : t2));
    });
    setOpenTask(prev => (prev?.id === task.id ? task : prev));
    setFlashId(task.id);
    setRowErrors(prev => { const { [task.id]: _drop, ...rest } = prev; return rest; });
    fetchSummary();
  }, [fetchSummary, today]);

  const refreshRow = useCallback(async (id: number) => {
    try {
      const fresh = supervisor ? await getSupervisorTask(id) : await getTask(id);
      setTasks(prev => prev.map(t2 => (t2.id === id ? fresh : t2)));
      setOpenTask(prev => (prev?.id === id ? fresh : prev));
    } catch { /* the counts catch up on the next load */ }
  }, [supervisor]);

  const advance = useCallback(async (task: TaskResponse) => {
    const next = stepAfter(task.status);
    if (!next) return;
    // Only the last rung asks. Asking about all of them teaches people to press
    // "Yes" without reading, and then the one that matters stops working.
    if (next === 'DONE') { setCompleteTask(task); return; }
    try {
      const move = supervisor ? supervisorMoveTask : moveTask;
      replace(await move(task.id, { status: next }));
    } catch {
      setRowErrors(prev => ({
        ...prev,
        [task.id]: { step: t(`tasks:step.${next}`).toLowerCase(), current: t(`tasks:step.${task.status}`).toLowerCase() },
      }));
    }
  }, [supervisor, replace, t]);

  const confirmComplete = useCallback(async () => {
    if (!completeTask) return;
    const move = supervisor ? supervisorMoveTask : moveTask;
    replace(await move(completeTask.id, { status: 'DONE' }));
    setCompleteTask(null);
  }, [completeTask, supervisor, replace]);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    await deleteTask(deleteTarget.id);
    setTasks(prev => prev.filter(t2 => t2.id !== deleteTarget.id));
    setOpenTask(prev => (prev?.id === deleteTarget.id ? null : prev));
    setDeleteTarget(null);
    fetchSummary();
  }, [deleteTarget, fetchSummary]);

  const assign = useCallback(async (task: TaskResponse, userId: number) => {
    try { replace(await updateTask(task.id, { assignedToId: userId })); } catch { /* the row keeps what it had */ }
  }, [replace]);

  const unassign = useCallback(async (task: TaskResponse) => {
    try { replace(await unassignTask(task.id)); } catch { /* the row keeps what it had */ }
  }, [replace]);

  const setDates = useCallback(async (task: TaskResponse, startDate: string | null, dueDate: string | null) => {
    try {
      replace(await updateTask(task.id, { startDate: startDate ?? undefined, dueDate: dueDate ?? undefined }));
    } catch { /* the row keeps what it had */ }
  }, [replace]);

  const openWindow = useCallback((task: TaskResponse) => {
    setOpenTask(task);
    // The list rows are cheap; the window shows counts, so re-read the task.
    refreshRow(task.id);
  }, [refreshRow]);

  /** J / K / → / A / Enter / N / — the bar at the foot of the list is their documentation. */
  useEffect(() => {
    if (view !== 'list') return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (formOpen || openTask || completeTask || deleteTarget) return;
      const index = tasks.findIndex(t2 => t2.id === selectedId);
      if (e.key === 'j' || e.key === 'k') {
        e.preventDefault();
        const nextIndex = e.key === 'j' ? Math.min(tasks.length - 1, index + 1) : Math.max(0, index <= 0 ? 0 : index - 1);
        if (tasks[nextIndex]) setSelectedId(tasks[nextIndex].id);
      } else if (e.key === 'n' && !supervisor) {
        e.preventDefault();
        setFormTask(null); setFormOpen(true);
      } else if (e.key === '/') {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('[data-tasks-search]')?.focus();
      } else if (index >= 0) {
        const task = tasks[index];
        if (e.key === 'ArrowRight') { e.preventDefault(); advance(task); }
        else if (e.key === 'Enter') { e.preventDefault(); openWindow(task); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, tasks, selectedId, supervisor, advance, openWindow, formOpen, openTask, completeTask, deleteTarget]);

  const filterCount = [projectId, assigneeId, status, debouncedSearch].filter(Boolean).length;
  const clearFilters = () => {
    setProjectId(''); setAssigneeId(''); setStatus(''); setSearch(''); setDebouncedSearch('');
  };

  const countLine = summaryFailed
    ? t('tasks:count.summaryFailed')
    : summary
      ? [
        t('tasks:count.open', { count: summary.open }),
        t('tasks:count.overdue', { count: summary.overdue }),
        t('tasks:count.dueToday', { count: summary.dueToday }),
        !supervisor ? t('tasks:count.unassigned', { count: summary.unassigned }) : null,
      ].filter(Boolean).join(' · ')
      : null;

  return (
    <>
      <div className="space-y-3.5">
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-end justify-between gap-5 flex-wrap" data-tour="sec.schedules.header">
          <div>
            <Mono className="block text-[10px] tracking-[0.15em] text-[#8A8175]">
              {t(supervisor ? 'tasks:eyebrow.date.supervisor' : 'tasks:eyebrow.date', { date: stampLongDay(today, lang) })}
            </Mono>
            <h2 className="font-bt-display font-extrabold uppercase text-[30px] md:text-[44px] leading-[0.92] text-[#0B0A09] mt-1">
              {view === 'week'
                ? t('tasks:week.title')
                : t(supervisor ? 'tasks:title.supervisor' : 'tasks:title')}
            </h2>
            {countLine
              ? <Mono className="block text-[12px] tracking-[0.07em] text-[#5A5346] mt-2">{countLine}</Mono>
              : <Bone className="w-56 h-3 mt-2.5" />}
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex" data-tour="sec.schedules.views">
              {(['list', 'week'] as View[]).map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  disabled={v === 'week' && !wide}
                  aria-pressed={view === v}
                  title={v === 'week' && !wide ? t('tasks:view.listOnly') : undefined}
                  className={cn(
                    'px-3.5 py-2.5 font-bt-mono text-[10px] font-semibold uppercase tracking-[0.1em] border -ml-px first:ml-0 transition-colors',
                    view === v ? 'bg-[#0B0A09] text-[#F5F1E8] border-[#0B0A09]' : 'bg-white border-[#DBD0BB] text-[#5A5346] hover:text-[#0B0A09]',
                    'disabled:bg-[#EAE4D8] disabled:text-[#A69C8D] disabled:cursor-not-allowed',
                    FOCUS_RING,
                  )}
                >
                  {v === 'list' ? t('tasks:view.list') : t('tasks:view.week')}
                </button>
              ))}
            </div>
            {!supervisor && (
              <CreateButton onClick={() => { setFormTask(null); setFormOpen(true); }} className="py-2.5 px-3.5 text-[10.5px]">
                <Plus className="w-3.5 h-3.5" strokeWidth={2.4} />{t('tasks:new')}
              </CreateButton>
            )}
          </div>
        </div>
        {!wide && <Mono className="block text-[9.5px] tracking-[0.1em] text-[#A69C8D] -mt-1">{t('tasks:view.listOnly')}</Mono>}

        {/* ── Filters ─────────────────────────────────────────────────── */}
        <div className="bg-white border border-[#E7E1D5] px-3 py-2.5" data-tour="sec.schedules.filters">
          <div className="flex flex-wrap items-center gap-[9px]">
            <div className="relative flex-1 min-w-[180px] md:max-w-[280px]">
              <Search className="w-3.5 h-3.5 text-[#A69C8D] absolute left-[10px] top-1/2 -translate-y-1/2" />
              <input
                data-tasks-search
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('tasks:search.placeholder')}
                maxLength={FIELD_LIMITS.SEARCH}
                aria-label={t('tasks:search.placeholder')}
                className={cn('w-full border border-[#DBD0BB] bg-[#FAF7F0] py-[7px] pl-8 pr-3 text-[12.5px] text-[#0B0A09] outline-none focus:border-[#F97316]', FOCUS_RING, 'focus-visible:outline-offset-[-1px]')}
              />
            </div>
            {supervisor ? (
              <Mono className="text-[9.5px] tracking-[0.08em] text-[#A69C8D]">{t('tasks:filter.supervisorNote')}</Mono>
            ) : (
              <>
                {/* Chips on desktop, a select below it: the same order and the same counts. */}
                <div className="hidden xl:flex items-center gap-[7px] flex-wrap">
                  <ProjectChip
                    active={projectId === ''}
                    label={t('tasks:filter.allProjects', { count: projects.length, total: summary?.open ?? 0 })}
                    onClick={() => setProjectId('')}
                  />
                  {projects.map(p => (
                    <ProjectChip
                      key={p.id}
                      active={projectId === p.id}
                      label={`${p.name} · ${summary?.openByProject?.[String(p.id)] ?? 0}`}
                      onClick={() => setProjectId(projectId === p.id ? '' : p.id)}
                    />
                  ))}
                </div>
                <MonoSelect
                  value={projectId}
                  onChange={e => setProjectId(e.target.value ? Number(e.target.value) : '')}
                  className="xl:hidden py-1.5"
                  aria-label={t('tasks:filter.projects')}
                >
                  <option value="">{t('tasks:filter.projects')}</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </MonoSelect>
                <MonoSelect
                  value={assigneeId}
                  onChange={e => setAssigneeId(e.target.value === 'none' ? 'none' : e.target.value ? Number(e.target.value) : '')}
                  className="hidden md:block py-1.5"
                  aria-label={t('tasks:filter.person')}
                >
                  <option value="">{t('tasks:filter.person')}</option>
                  <option value="none">{t('tasks:filter.unassigned')}</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.fullName ?? u.username}</option>)}
                </MonoSelect>
              </>
            )}
            <MonoSelect
              value={status}
              onChange={e => setStatus(e.target.value as '' | TaskStatus)}
              className="hidden md:block py-1.5"
              aria-label={t('tasks:filter.step')}
            >
              <option value="">{t('tasks:filter.step')}</option>
              {TASK_STATUSES.map(s => <option key={s} value={s}>{t(`tasks:step.${s}`)}</option>)}
            </MonoSelect>
            <label className={cn('inline-flex items-center gap-1.5 font-bt-mono text-[9.5px] uppercase tracking-[0.08em] text-[#5A5346] cursor-pointer', FOCUS_RING)}>
              <input type="checkbox" checked={showClosed} onChange={e => setShowClosed(e.target.checked)} className="w-3 h-3 accent-[#F97316]" />
              {t('tasks:filter.seeClosed')}
            </label>
            <div className="ml-auto flex items-center gap-2">
              {filterCount > 0 && (
                <button type="button" onClick={clearFilters} className={cn('font-bt-mono text-[9.5px] uppercase tracking-[0.1em] font-semibold text-[#C2410C] hover:text-[#F97316]', FOCUS_RING)}>
                  {t('tasks:empty.filters.clear', { count: filterCount })} ✕
                </button>
              )}
              <SecondaryButton onClick={() => { setReloadNonce(n => n + 1); fetchSummary(); }} className="text-[10px] px-2.5 py-[7px] bg-[#FAF7F0] gap-1.5">
                <RefreshCw className={cn('w-3 h-3', state === 'loading' && 'animate-spin')} />
                <span className="hidden sm:inline">{t('common:buttons.refresh')}</span>
              </SecondaryButton>
            </div>
          </div>
          {summary && (
            <Mono className="block text-[9.5px] tracking-[0.08em] text-[#A69C8D] mt-2">
              {[
                t('tasks:count.overdue', { count: summary.overdue }),
                t('tasks:count.dueToday', { count: summary.dueToday }),
                t('tasks:count.thisWeek', { count: summary.thisWeek }),
                t('tasks:count.noDates', { count: summary.noDates }),
                t('tasks:count.closedNote', { count: summary.closedThisWeek }),
              ].join(' · ')}
            </Mono>
          )}
        </div>

        {view === 'list' ? (
          <TaskList
            state={state}
            tasks={tasks}
            permissions={permissions}
            assignees={assignees}
            lang={lang}
            today={today}
            selectedId={selectedId}
            flashId={flashId}
            rowErrors={rowErrors}
            pinned={pinned}
            currentUserName={me}
            filterCount={filterCount}
            openCount={summary?.open ?? null}
            onOpen={openWindow}
            onAdvance={advance}
            onAssign={assign}
            onUnassign={unassign}
            onSetDates={setDates}
            onEdit={task => { setFormTask(task); setFormOpen(true); }}
            onDelete={setDeleteTarget}
            onSelect={task => setSelectedId(task.id)}
            onNew={supervisor ? undefined : () => { setFormTask(null); setFormOpen(true); }}
            onRetry={() => { setReloadNonce(n => n + 1); fetchSummary(); }}
            onClearFilters={clearFilters}
          />
        ) : (
          <WeekView
            tasks={tasks}
            lang={lang}
            today={today}
            onOpen={openWindow}
            onAssign={openWindow}
            onSetDates={openWindow}
          />
        )}

        {/* The shortcuts bar is its own documentation: always in sight, never a
            dialog you have to ask for. It goes with the keyboard on phones. */}
        {view === 'list' && (
          <div className="hidden xl:flex items-center gap-3.5 bg-white border border-[#E7E1D5] px-3 h-[34px]" data-tour="sec.schedules.shortcuts">
            {[
              { keys: ['J', 'K'], label: t('tasks:shortcuts.move') },
              { keys: ['→'], label: t('tasks:shortcuts.advance') },
              { keys: ['Enter'], label: t('tasks:shortcuts.open') },
              ...(supervisor ? [] : [{ keys: ['N'], label: t('tasks:shortcuts.new') }]),
              { keys: ['/'], label: t('tasks:search.placeholder').replace('…', '') },
            ].map(s => (
              <span key={s.label} className="inline-flex items-center gap-1.5">
                {s.keys.map(k => (
                  <Mono key={k} className="text-[9px] font-semibold tracking-[0.06em] border border-[#DBD0BB] bg-[#FAF7F0] px-[5px] py-[2px] text-[#0B0A09]">{k}</Mono>
                ))}
                <Mono className="text-[9px] tracking-[0.09em] text-[#8A8175]">{s.label}</Mono>
              </span>
            ))}
            <Mono className="text-[9px] tracking-[0.09em] text-[#A69C8D] ml-auto">{t('tasks:shortcuts.confirm')}</Mono>
          </div>
        )}
      </div>

      {!supervisor && (
        <TaskFormModal
          open={formOpen}
          onOpenChange={setFormOpen}
          task={formTask}
          projects={projects}
          users={users}
          presetProjectId={typeof projectId === 'number' ? projectId : undefined}
          lang={lang}
          onSaved={(task, mode) => {
            if (mode === 'edit') { replace(task); return; }
            // A new task may not match the filters that are on; the only time an
            // action touches them.
            clearFilters();
            setReloadNonce(n => n + 1);
            setFlashId(task.id);
            fetchSummary();
          }}
        />
      )}
      <TaskWindow
        open={openTask != null}
        onOpenChange={open => { if (!open) setOpenTask(null); }}
        task={openTask}
        lang={lang}
        supervisor={supervisor}
        onAdvance={() => { if (openTask) { setOpenTask(null); advance(openTask); } }}
        onEdit={() => { if (openTask) { setFormTask(openTask); setOpenTask(null); setFormOpen(true); } }}
        onDelete={() => { if (openTask) { setDeleteTarget(openTask); setOpenTask(null); } }}
        onChanged={() => { if (openTask) refreshRow(openTask.id); }}
      />
      <ConfirmCompleteModal
        open={completeTask != null}
        onOpenChange={open => { if (!open) setCompleteTask(null); }}
        task={completeTask}
        lang={lang}
        onConfirm={confirmComplete}
      />
      <ConfirmDeleteModal
        open={deleteTarget != null}
        onOpenChange={open => { if (!open) setDeleteTarget(null); }}
        task={deleteTarget}
        lang={lang}
        onConfirm={confirmDelete}
      />
    </>
  );
}

function ProjectChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'font-bt-mono text-[9.5px] uppercase tracking-[0.08em] px-2.5 py-1.5 border whitespace-nowrap transition-colors',
        active ? 'bg-[#0B0A09] text-[#F5F1E8] border-[#0B0A09]' : 'bg-white border-[#DBD0BB] text-[#5A5346] hover:border-[#F97316] hover:text-[#C2410C]',
        FOCUS_RING,
      )}
    >
      {label}
    </button>
  );
}
