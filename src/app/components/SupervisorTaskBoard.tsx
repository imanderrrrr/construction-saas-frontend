import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import {
  GripVertical, Calendar, User, Loader2, AlertCircle, FolderOpen, Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  type TaskResponse, type TaskStatus, type TaskPriority,
  TASK_STATUSES, TASK_STATUS_LABELS, TASK_PRIORITY_LABELS, TASK_STATUS_ORDER,
  listSupervisorTasks, supervisorMoveTask, supervisorGetTaskHistory,
} from '../services/tasks';
import { TaskHistoryPanel } from './TaskHistoryPanel';

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

const DRAG_TYPE = 'SUPERVISOR_TASK';

function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ── Task Card (no edit/delete) ───────────────────────

function SupervisorTaskCard({
  task, lang, onViewHistory,
}: {
  task: TaskResponse;
  lang: string;
  onViewHistory: (t: TaskResponse) => void;
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
      className={`group bg-white rounded-lg border border-[#D4D4D8] p-3 cursor-grab active:cursor-grabbing
        hover:border-[#F97316]/40 hover:shadow-sm transition-all ${isDragging ? 'opacity-40 rotate-2 scale-95' : ''}`}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="w-3.5 h-3.5 text-[#D4D4D8] mt-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[#0A0A0A] leading-snug line-clamp-2">{task.title}</p>
          {task.description && (
            <p className="text-[11px] text-[#71717A] mt-1 line-clamp-2">{task.description}</p>
          )}
        </div>
        <button
          onClick={() => onViewHistory(task)}
          className="w-6 h-6 flex items-center justify-center rounded text-[#71717A] hover:bg-[#FAFAFA] hover:text-[#F97316] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
        >
          <Clock className="w-3 h-3" />
        </button>
      </div>

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

      {/* Project name badge */}
      <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-[#FAFAFA]">
        <FolderOpen className="w-2.5 h-2.5 text-[#71717A]" />
        <span className="text-[11px] text-[#71717A]">{task.projectName}</span>
      </div>
    </div>
  );
}

// ── Column ───────────────────────────────────────────

function SupervisorColumn({
  status, tasks, lang, onDrop, onViewHistory,
}: {
  status: TaskStatus;
  tasks: TaskResponse[];
  lang: string;
  onDrop: (taskId: number, toStatus: TaskStatus) => void;
  onViewHistory: (t: TaskResponse) => void;
}) {
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
      <div className="flex items-center justify-between px-3 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold text-[#0A0A0A] uppercase tracking-wider">
            {lang === 'es' ? label.es : label.en}
          </h3>
          <span className="text-[10px] font-bold bg-white border border-[#D4D4D8] text-[#71717A] rounded-full w-5 h-5 flex items-center justify-center">
            {tasks.length}
          </span>
        </div>
      </div>

      <div className="flex-1 px-2 pb-2 space-y-2 overflow-y-auto max-h-[calc(100vh-280px)] min-h-[120px]">
        {tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-[11px] text-[#D4D4D8]">
              {lang === 'es' ? 'Sin tareas' : 'No tasks'}
            </p>
          </div>
        )}
        {tasks.map(task => (
          <SupervisorTaskCard key={task.id} task={task} lang={lang} onViewHistory={onViewHistory} />
        ))}
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────

export function SupervisorTaskBoard() {
  const { i18n } = useTranslation();
  const lang = i18n.language;

  const [tasks, setTasks] = useState<TaskResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyTask, setHistoryTask] = useState<TaskResponse | null>(null);

  const loadTasks = useCallback(() => {
    setLoading(true);
    listSupervisorTasks()
      .then(setTasks)
      .catch(() => toast.error(lang === 'es' ? 'Error cargando tareas' : 'Error loading tasks'))
      .finally(() => setLoading(false));
  }, [lang]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const grouped: Record<TaskStatus, TaskResponse[]> = {
    TODO: [], IN_PROGRESS: [], REVIEW: [], DONE: [],
  };
  tasks.forEach(t => grouped[t.status].push(t));

  const handleDrop = async (taskId: number, toStatus: TaskStatus) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    if (TASK_STATUS_ORDER[task.status] >= TASK_STATUS_ORDER[toStatus]) {
      toast.error(lang === 'es' ? 'Las tareas solo pueden avanzar, no retroceder.' : 'Tasks can only move forward.');
      return;
    }
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: toStatus } : t));
    try {
      await supervisorMoveTask(taskId, { status: toStatus });
      toast.success(lang === 'es' ? 'Tarea avanzada' : 'Task moved forward');
    } catch {
      toast.error(lang === 'es' ? 'Error moviendo tarea' : 'Error moving task');
      loadTasks();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-[#F97316]" />
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="w-10 h-10 text-[#D4D4D8] mb-3" />
        <p className="text-sm text-[#71717A]">
          {lang === 'es' ? 'No tienes tareas asignadas por el momento.' : 'No tasks assigned to you at this time.'}
        </p>
      </div>
    );
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="space-y-4">
        <p className="text-xs text-[#71717A]">
          {lang === 'es'
            ? 'Arrastra las tareas hacia adelante para actualizar su progreso.'
            : 'Drag tasks forward to update their progress.'}
        </p>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {TASK_STATUSES.map(status => (
            <SupervisorColumn
              key={status}
              status={status}
              tasks={grouped[status]}
              lang={lang}
              onDrop={handleDrop}
              onViewHistory={setHistoryTask}
            />
          ))}
        </div>

        {historyTask && (
          <TaskHistoryPanel
            taskId={historyTask.id}
            taskTitle={historyTask.title}
            open={!!historyTask}
            onClose={() => setHistoryTask(null)}
            fetchHistory={supervisorGetTaskHistory}
          />
        )}
      </div>
    </DndProvider>
  );
}
