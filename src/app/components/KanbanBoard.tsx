import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import {
  Plus, GripVertical, Pencil, Trash2, Calendar, Flag,
  User, Loader2, AlertCircle, ChevronDown, Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from './ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from './ui/select';
import {
  type TaskResponse, type TaskStatus, type TaskPriority,
  type CreateTaskPayload, type UpdateTaskPayload,
  TASK_STATUSES, TASK_STATUS_LABELS, TASK_PRIORITY_LABELS, TASK_STATUS_ORDER,
  listTasksByProject, createTask, updateTask, moveTask, deleteTask, getTaskHistory,
} from '../services/tasks';
import { listProjects, type ProjectResponse } from '../services/projects';
import { TaskHistoryPanel } from './TaskHistoryPanel';
import { TaskDetailModal } from './TaskDetailModal';
import { businessToday } from '../helpers/dateTime';
import { FIELD_LIMITS } from '../../shared/fieldLimits';

// ── Constants ────────────────────────────────────────

const COLUMN_COLORS: Record<TaskStatus, string> = {
  TODO:        'border-t-[#71717A]',
  IN_PROGRESS: 'border-t-[#F97316]',
  REVIEW:      'border-t-amber-500',
  DONE:        'border-t-emerald-500',
};

const COLUMN_BG: Record<TaskStatus, string> = {
  TODO:        'bg-[#FAFAFA]',
  IN_PROGRESS: 'bg-blue-50/50',
  REVIEW:      'bg-amber-50/50',
  DONE:        'bg-emerald-50/50',
};

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  LOW:    'bg-gray-100 text-gray-600',
  MEDIUM: 'bg-blue-100 text-blue-700',
  HIGH:   'bg-orange-100 text-orange-700',
  URGENT: 'bg-red-100 text-red-700',
};

const DRAG_TYPE = 'KANBAN_TASK';

// ── Helpers ──────────────────────────────────────────

function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ── Task Card ────────────────────────────────────────

function TaskCard({
  task, lang, onEdit, onDelete, onViewHistory, onOpenDetail,
}: {
  task: TaskResponse;
  lang: string;
  onEdit: (t: TaskResponse) => void;
  onDelete: (id: number) => void;
  onViewHistory: (t: TaskResponse) => void;
  onOpenDetail: (t: TaskResponse) => void;
}) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: DRAG_TYPE,
    item: { id: task.id, status: task.status },
    collect: (m) => ({ isDragging: m.isDragging() }),
  }), [task.id, task.status]);

  const pLabel = TASK_PRIORITY_LABELS[task.priority];

  return (
    <div
      ref={drag as unknown as React.Ref<HTMLDivElement>}
      onClick={() => onOpenDetail(task)}
      className={`group bg-white rounded-lg border border-[#D4D4D8] p-3 cursor-grab active:cursor-grabbing
        hover:border-[#F97316]/40 hover:shadow-sm transition-all ${isDragging ? 'opacity-40 rotate-2 scale-95' : ''}`}
    >
      {/* Header */}
      <div className="flex items-start gap-2">
        <GripVertical className="w-3.5 h-3.5 text-[#D4D4D8] mt-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[#0A0A0A] leading-snug line-clamp-2">{task.title}</p>
          {task.description && (
            <p className="text-[11px] text-[#71717A] mt-1 line-clamp-2">{task.description}</p>
          )}
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={(e) => { e.stopPropagation(); onViewHistory(task); }}
            className="w-6 h-6 flex items-center justify-center rounded text-[#71717A] hover:bg-[#FAFAFA] hover:text-[#F97316]">
            <Clock className="w-3 h-3" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onEdit(task); }}
            className="w-6 h-6 flex items-center justify-center rounded text-[#F97316] hover:bg-[#F97316]/10">
            <Pencil className="w-3 h-3" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
            className="w-6 h-6 flex items-center justify-center rounded text-[#d4183d] hover:bg-red-50">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Meta */}
      <div className="flex items-center gap-2 mt-2.5 flex-wrap">
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${PRIORITY_COLORS[task.priority]}`}>
          {lang === 'es' ? pLabel.es : pLabel.en}
        </span>
        {task.startDate && (
          <span className="flex items-center gap-1 text-[10px] text-[#71717A]">
            <Calendar className="w-2.5 h-2.5" />
            {formatDate(task.startDate)}
          </span>
        )}
        {task.dueDate && (
          <span className="flex items-center gap-1 text-[10px] text-[#71717A]">
            → {formatDate(task.dueDate)}
          </span>
        )}
      </div>

      {/* Assignee */}
      {task.assignedToName && (
        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-[#FAFAFA]">
          <div className="w-5 h-5 rounded-full bg-[#F97316]/10 flex items-center justify-center">
            <User className="w-2.5 h-2.5 text-[#F97316]" />
          </div>
          <span className="text-[11px] text-[#71717A]">{task.assignedToName}</span>
        </div>
      )}
    </div>
  );
}

// ── Column ───────────────────────────────────────────

function KanbanColumn({
  status, tasks, lang, onDrop, onEdit, onDelete, onAddClick, onViewHistory, onOpenDetail,
}: {
  status: TaskStatus;
  tasks: TaskResponse[];
  lang: string;
  onDrop: (taskId: number, toStatus: TaskStatus) => void;
  onEdit: (t: TaskResponse) => void;
  onDelete: (id: number) => void;
  onAddClick: () => void;
  onViewHistory: (t: TaskResponse) => void;
  onOpenDetail: (t: TaskResponse) => void;
}) {
  const { t } = useTranslation('admin');
  const label = TASK_STATUS_LABELS[status];

  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: DRAG_TYPE,
    canDrop: (item: { id: number; status: TaskStatus }) =>
      item.status !== status && TASK_STATUS_ORDER[item.status] < TASK_STATUS_ORDER[status],
    drop: (item: { id: number; status: TaskStatus }) => {
      if (item.status !== status) onDrop(item.id, status);
    },
    collect: (m) => ({ isOver: m.isOver(), canDrop: m.canDrop() }),
  }), [status, onDrop]);

  const dropHighlight = isOver && canDrop
    ? 'ring-2 ring-[#F97316]/30 bg-[#F97316]/5'
    : isOver && !canDrop
      ? 'ring-2 ring-red-200 bg-red-50/50'
      : '';

  return (
    <div
      ref={drop as unknown as React.Ref<HTMLDivElement>}
      className={`flex flex-col rounded-xl border border-[#D4D4D8] border-t-4 ${COLUMN_COLORS[status]}
        ${COLUMN_BG[status]} min-w-[260px] w-[280px] flex-shrink-0 ${dropHighlight} transition-all`}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold text-[#0A0A0A] uppercase tracking-wider">
            {lang === 'es' ? label.es : label.en}
          </h3>
          <span className="text-[10px] font-bold bg-white border border-[#D4D4D8] text-[#71717A] rounded-full w-5 h-5 flex items-center justify-center">
            {tasks.length}
          </span>
        </div>
        {status === 'TODO' && (
          <button onClick={onAddClick}
            className="w-6 h-6 flex items-center justify-center rounded-lg text-[#F97316] hover:bg-[#F97316]/10 transition-colors">
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Cards */}
      <div className="flex-1 px-2 pb-2 space-y-2 overflow-y-auto max-h-[calc(100vh-280px)] min-h-[120px]">
        {tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-8 h-8 bg-white rounded-full border border-dashed border-[#D4D4D8] flex items-center justify-center mb-2">
              <Plus className="w-3.5 h-3.5 text-[#D4D4D8]" />
            </div>
            <p className="text-[11px] text-[#D4D4D8]">{t('kanban.emptyColumn')}</p>
          </div>
        )}
        {tasks.map(task => (
          <TaskCard
            key={task.id}
            task={task}
            lang={lang}
            onEdit={onEdit}
            onDelete={onDelete}
            onViewHistory={onViewHistory}
            onOpenDetail={onOpenDetail}
          />
        ))}
      </div>
    </div>
  );
}

// ── Empty form ───────────────────────────────────────

interface TaskForm {
  title: string;
  description: string;
  priority: TaskPriority;
  startDate: string;
  dueDate: string;
}

const EMPTY_FORM: TaskForm = {
  title: '', description: '', priority: 'MEDIUM', startDate: '', dueDate: '',
};

// ── Input classes ────────────────────────────────────

const inputCls =
  'h-9 w-full rounded-lg border border-[#D4D4D8] bg-white px-3 text-sm text-[#0A0A0A] ' +
  'focus:outline-none focus:ring-2 focus:ring-[#F97316]/25 focus:border-[#F97316] transition-colors';

// ── Main Component ───────────────────────────────────

export function KanbanBoard() {
  const { t, i18n } = useTranslation(['admin', 'common']);
  const lang = i18n.language;
  const todayISO = businessToday();

  // State
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [tasks, setTasks] = useState<TaskResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [projectsLoading, setProjectsLoading] = useState(true);

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskResponse | null>(null);
  const [form, setForm] = useState<TaskForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // History
  const [historyTask, setHistoryTask] = useState<TaskResponse | null>(null);

  // Detail modal
  const [detailTask, setDetailTask] = useState<TaskResponse | null>(null);

  // Load projects
  useEffect(() => {
    setProjectsLoading(true);
    listProjects({ status: 'ACTIVE', size: 100 })
      .then(page => {
        setProjects(page.content);
        if (page.content.length > 0 && !selectedProjectId) {
          setSelectedProjectId(page.content[0].id);
        }
      })
      .catch(() => toast.error(t('kanban.errorLoadingProjects')))
      .finally(() => setProjectsLoading(false));
  }, []);

  // Load tasks when project changes
  const loadTasks = useCallback(() => {
    if (!selectedProjectId) return;
    setLoading(true);
    listTasksByProject(selectedProjectId)
      .then(setTasks)
      .catch(() => toast.error(t('kanban.errorLoadingTasks')))
      .finally(() => setLoading(false));
  }, [selectedProjectId, t]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  // Group tasks by status
  const grouped: Record<TaskStatus, TaskResponse[]> = {
    TODO: [], IN_PROGRESS: [], REVIEW: [], DONE: [],
  };
  tasks.forEach(t => grouped[t.status].push(t));

  // Handlers
  const handleDrop = async (taskId: number, toStatus: TaskStatus) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    // Guard: forward-only moves — the column's canDrop also blocks the UI,
    // but we double-check here in case of a programmatic call.
    if (TASK_STATUS_ORDER[task.status] >= TASK_STATUS_ORDER[toStatus]) {
      toast.error(t('kanban.errorBackwardMove'));
      return;
    }
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: toStatus } : t));
    try {
      await moveTask(taskId, { status: toStatus });
    } catch {
      toast.error(t('kanban.errorMovingTask'));
      loadTasks();
    }
  };

  const handleOpenCreate = () => {
    setEditingTask(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const handleOpenEdit = (task: TaskResponse) => {
    setEditingTask(task);
    setForm({
      title: task.title,
      description: task.description ?? '',
      priority: task.priority,
      startDate: task.startDate ?? '',
      dueDate: task.dueDate ?? '',
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    try {
      await deleteTask(id);
      toast.success(t('kanban.taskDeleted'));
    } catch {
      toast.error(t('kanban.errorDeletingTask'));
      loadTasks();
    }
  };

  const handleSave = async () => {
    if (!form.title.trim() || !selectedProjectId) return;
    const today = businessToday();
    if (form.startDate && form.startDate < today) {
      toast.warning(t('kanban.startDatePast'));
      return;
    }
    if (form.dueDate && form.dueDate < today) {
      toast.warning(t('kanban.dueDatePast'));
      return;
    }
    if (form.startDate && form.dueDate && form.dueDate < form.startDate) {
      toast.warning(t('kanban.dueDateBeforeStart'));
      return;
    }
    setSaving(true);
    try {
      if (editingTask) {
        const payload: UpdateTaskPayload = {
          title: form.title,
          description: form.description || undefined,
          priority: form.priority,
          startDate: form.startDate || undefined,
          dueDate: form.dueDate || undefined,
        };
        const updated = await updateTask(editingTask.id, payload);
        setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
        toast.success(t('kanban.taskUpdated'));
      } else {
        const payload: CreateTaskPayload = {
          projectId: selectedProjectId,
          title: form.title,
          description: form.description || undefined,
          priority: form.priority,
          startDate: form.startDate || undefined,
          dueDate: form.dueDate || undefined,
        };
        const created = await createTask(payload);
        setTasks(prev => [...prev, created]);
        toast.success(t('kanban.taskCreated'));
      }
      setDialogOpen(false);
    } catch {
      toast.error(editingTask ? t('kanban.errorUpdatingTask') : t('kanban.errorCreatingTask'));
    } finally {
      setSaving(false);
    }
  };

  // Render
  return (
    <DndProvider backend={HTML5Backend}>
      <div className="space-y-5">
        {/* Project selector */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <label className="text-xs font-semibold text-[#71717A] uppercase tracking-wide whitespace-nowrap">
              {t('kanban.project')}
            </label>
            {projectsLoading ? (
              <div className="flex items-center gap-2 text-sm text-[#71717A]">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            ) : (
              <Select
                value={selectedProjectId?.toString() ?? ''}
                onValueChange={v => setSelectedProjectId(Number(v))}
              >
                <SelectTrigger className="h-9 border-[#D4D4D8] text-sm max-w-xs">
                  <SelectValue placeholder={t('kanban.selectProject')} />
                </SelectTrigger>
                <SelectContent>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <Button
            onClick={handleOpenCreate}
            disabled={!selectedProjectId}
            className="bg-[#F97316] hover:bg-[#C2410C] text-white text-xs gap-2 h-9 px-4"
          >
            <Plus className="w-3.5 h-3.5" />
            {t('kanban.addTask')}
          </Button>
        </div>

        {/* Board */}
        {!selectedProjectId ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <AlertCircle className="w-10 h-10 text-[#D4D4D8] mb-3" />
            <p className="text-sm text-[#71717A]">{t('kanban.selectProjectPrompt')}</p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-[#F97316]" />
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {TASK_STATUSES.map(status => (
              <KanbanColumn
                key={status}
                status={status}
                tasks={grouped[status]}
                lang={lang}
                onDrop={handleDrop}
                onEdit={handleOpenEdit}
                onDelete={handleDelete}
                onAddClick={handleOpenCreate}
                onViewHistory={setHistoryTask}
                onOpenDetail={setDetailTask}
              />
            ))}
          </div>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={o => { if (!o) setDialogOpen(false); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-[#0A0A0A]">
                {editingTask ? t('kanban.editTask') : t('kanban.newTask')}
              </DialogTitle>
              <DialogDescription className="text-xs text-[#71717A]">
                {editingTask ? t('kanban.editTaskDesc') : t('kanban.newTaskDesc')}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-1">
              {/* Title */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#71717A] uppercase tracking-wide">
                  {t('kanban.taskTitle')}
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder={t('kanban.taskTitlePlaceholder')}
                  maxLength={FIELD_LIMITS.TITLE}
                  className={inputCls}
                  autoFocus
                />
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#71717A] uppercase tracking-wide">
                  {t('kanban.description')}
                </label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder={t('kanban.descriptionPlaceholder')}
                  rows={3}
                  maxLength={FIELD_LIMITS.LONG_TEXT}
                  className={`${inputCls} h-auto py-2 resize-none`}
                />
              </div>

              {/* Priority */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#71717A] uppercase tracking-wide">
                  {t('kanban.priority')}
                </label>
                <Select value={form.priority} onValueChange={(v: string) => setForm(f => ({ ...f, priority: v as TaskPriority }))}>
                  <SelectTrigger className="h-9 border-[#D4D4D8] text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as TaskPriority[]).map(p => (
                      <SelectItem key={p} value={p}>
                        <span className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${
                            p === 'LOW' ? 'bg-gray-400' : p === 'MEDIUM' ? 'bg-blue-500' :
                            p === 'HIGH' ? 'bg-orange-500' : 'bg-red-500'
                          }`} />
                          {lang === 'es' ? TASK_PRIORITY_LABELS[p].es : TASK_PRIORITY_LABELS[p].en}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-[#71717A] uppercase tracking-wide">
                    {t('kanban.startDate')}
                  </label>
                  <input
                    type="date"
                    value={form.startDate}
                    min={todayISO}
                    onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-[#71717A] uppercase tracking-wide">
                    {t('kanban.dueDate')}
                  </label>
                  <input
                    type="date"
                    value={form.dueDate}
                    min={form.startDate || todayISO}
                    onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                    className={inputCls}
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline" size="sm"
                onClick={() => setDialogOpen(false)}
                className="border-[#D4D4D8] text-[#71717A] hover:text-[#0A0A0A] text-xs"
              >
                {t('common:buttons.cancel')}
              </Button>
              <Button
                size="sm"
                disabled={!form.title.trim() || saving}
                onClick={handleSave}
                className="bg-[#F97316] hover:bg-[#C2410C] text-white text-xs gap-1.5 disabled:opacity-40"
              >
                {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                {editingTask ? t('kanban.updateTask') : t('kanban.createTask')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Task history panel */}
        {historyTask && (
          <TaskHistoryPanel
            taskId={historyTask.id}
            taskTitle={historyTask.title}
            open={!!historyTask}
            onClose={() => setHistoryTask(null)}
            fetchHistory={getTaskHistory}
          />
        )}

        {/* Task detail modal */}
        <TaskDetailModal
          task={detailTask}
          open={!!detailTask}
          lang={lang}
          onClose={() => setDetailTask(null)}
          onEdit={(t) => { setDetailTask(null); handleOpenEdit(t); }}
        />
      </div>
    </DndProvider>
  );
}
