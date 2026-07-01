import { useEffect, useState, type ReactNode } from 'react';
import {
  Calendar,
  Flag,
  Activity,
  Paperclip,
  MessageSquare,
  Pencil,
  UploadCloud,
  ArrowRight,
  Clock,
} from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import {
  type TaskResponse,
  type TaskStatus,
  type TaskPriority,
  type TaskStatusHistoryEntry,
  type TaskComment,
  TASK_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
  getTaskHistory,
  getTaskComments,
  addTaskComment,
} from '../services/tasks';

const STATUS_BADGE: Record<TaskStatus, string> = {
  TODO: 'bg-[#F4F4F5] text-[#71717A]',
  IN_PROGRESS: 'bg-[#F97316]/10 text-[#C2410C]',
  REVIEW: 'bg-amber-100 text-amber-700',
  DONE: 'bg-emerald-100 text-emerald-700',
};

const PRIORITY_BADGE: Record<TaskPriority, string> = {
  LOW: 'bg-gray-100 text-gray-600',
  MEDIUM: 'bg-blue-100 text-blue-700',
  HIGH: 'bg-orange-100 text-orange-700',
  URGENT: 'bg-red-100 text-red-700',
};

function formatDate(d: string | null, lang: string): string {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString(lang === 'es' ? 'es' : 'en', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(iso: string, lang: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(lang === 'es' ? 'es' : 'en', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function Section({ icon: Icon, title, badge, children }: { icon: React.ComponentType<{ className?: string }>; title: string; badge?: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2.5 flex items-center gap-2">
        <Icon className="h-4 w-4 text-[#71717A]" />
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-[#71717A]">{title}</h3>
        {badge && (
          <span className="rounded-full bg-[#F97316]/10 px-2 py-0.5 text-[10px] font-semibold text-[#C2410C]">{badge}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function Person({ label, name, muted = false }: { label: string; name: string; muted?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#D4D4D8] bg-white p-3">
      <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${muted ? 'bg-[#F4F4F5] text-[#71717A]' : 'bg-[#F97316]/12 text-[#C2410C]'}`}>
        {muted ? '—' : initials(name)}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-[#71717A]">{label}</p>
        <p className={`truncate text-sm font-semibold ${muted ? 'text-[#71717A]' : 'text-[#0A0A0A]'}`}>{name}</p>
      </div>
    </div>
  );
}

export function TaskDetailModal({
  task,
  open,
  lang,
  onClose,
  onEdit,
}: {
  task: TaskResponse | null;
  open: boolean;
  lang: string;
  onClose: () => void;
  onEdit: (t: TaskResponse) => void;
}) {
  const [history, setHistory] = useState<TaskStatusHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [comments, setComments] = useState<TaskComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (!open || !task) return;
    setHistoryLoading(true);
    getTaskHistory(task.id)
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false));
  }, [open, task]);

  useEffect(() => {
    if (!open || !task) return;
    setNewComment('');
    setCommentsLoading(true);
    getTaskComments(task.id)
      .then(setComments)
      .catch(() => setComments([]))
      .finally(() => setCommentsLoading(false));
  }, [open, task]);

  async function submitComment() {
    const body = newComment.trim();
    if (!body || posting || !task) return;
    setPosting(true);
    try {
      const created = await addTaskComment(task.id, body);
      setComments((prev) => [...prev, created]);
      setNewComment('');
    } catch {
      // Keep the draft in the textarea so the user can retry.
    } finally {
      setPosting(false);
    }
  }

  if (!task) return null;
  const statusLabel = TASK_STATUS_LABELS[task.status];
  const prioLabel = TASK_PRIORITY_LABELS[task.priority];
  const pick = (l: { es: string; en: string }) => (lang === 'es' ? l.es : l.en);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] gap-0 overflow-y-auto p-0 sm:max-w-2xl">
        {/* Header */}
        <div className="border-b border-[#F4F4F5] p-6">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${STATUS_BADGE[task.status]}`}>{pick(statusLabel)}</span>
            <span className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${PRIORITY_BADGE[task.priority]}`}>{pick(prioLabel)}</span>
          </div>
          <DialogTitle className="text-xl font-bold leading-snug text-[#0A0A0A]">{task.title}</DialogTitle>
          <p className="mt-1 text-sm text-[#71717A]">{task.projectName}</p>
        </div>

        {/* Body */}
        <div className="space-y-6 p-6">
          {/* Description */}
          <Section icon={MessageSquare} title="Descripción">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#3F3F46]">
              {task.description?.trim() || 'Sin descripción.'}
            </p>
          </Section>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-[#D4D4D8] bg-white p-3">
              <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-[#71717A]"><Calendar className="h-3.5 w-3.5" /> Inicio</p>
              <p className="mt-1 text-sm font-semibold text-[#0A0A0A]">{formatDate(task.startDate, lang)}</p>
            </div>
            <div className="rounded-xl border border-[#D4D4D8] bg-white p-3">
              <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-[#71717A]"><Flag className="h-3.5 w-3.5" /> Vence</p>
              <p className="mt-1 text-sm font-semibold text-[#0A0A0A]">{formatDate(task.dueDate, lang)}</p>
            </div>
          </div>

          {/* People */}
          <Section icon={Activity} title="Personas">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Person label="Creada por" name={task.createdByName} />
              <Person label="Asignada a" name={task.assignedToName ?? 'Sin asignar'} muted={!task.assignedToName} />
            </div>
          </Section>

          {/* Attachments — shell (wired in next phase) */}
          <Section icon={Paperclip} title="Adjuntos" badge="Próximamente">
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#D4D4D8] bg-[#FAFAFA] px-4 py-8 text-center">
              <UploadCloud className="h-7 w-7 text-[#A1A1AA]" />
              <p className="text-sm font-medium text-[#71717A]">Sube imágenes y documentos</p>
              <p className="text-xs text-[#A1A1AA]">Las imágenes se verán en grande al hacer clic; los documentos con vista previa.</p>
            </div>
          </Section>

          {/* Comments */}
          <Section icon={MessageSquare} title="Comentarios">
            <div className="space-y-4">
              {commentsLoading ? (
                <p className="text-sm text-[#71717A]">Cargando…</p>
              ) : comments.length === 0 ? (
                <p className="text-sm text-[#71717A]">Sé el primero en comentar.</p>
              ) : (
                <ul className="space-y-3">
                  {comments.map((c) => (
                    <li key={c.id} className="flex items-start gap-3">
                      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#F97316]/12 text-[11px] font-bold text-[#C2410C]">
                        {initials(c.authorName)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <span className="text-sm font-semibold text-[#0A0A0A]">{c.authorName}</span>
                          <span className="text-xs text-[#A1A1AA]">{formatDateTime(c.createdAt, lang)}</span>
                        </div>
                        <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-[#3F3F46]">{c.body}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {/* Composer */}
              <div className="flex flex-col items-end gap-2">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={3}
                  placeholder="Escribe un comentario…"
                  className="w-full resize-y rounded-xl border border-[#D4D4D8] bg-white px-3.5 py-2.5 text-sm text-[#0A0A0A] placeholder:text-[#A1A1AA] focus:border-[#F97316] focus:outline-none focus:ring-1 focus:ring-[#F97316]"
                />
                <Button
                  size="sm"
                  onClick={submitComment}
                  disabled={posting || !newComment.trim()}
                  className="bg-[#F97316] text-white hover:bg-[#C2410C] disabled:opacity-50"
                >
                  {posting ? 'Enviando…' : 'Comentar'}
                </Button>
              </div>
            </div>
          </Section>

          {/* History */}
          <Section icon={Clock} title="Historial">
            {historyLoading ? (
              <p className="text-sm text-[#71717A]">Cargando…</p>
            ) : history.length === 0 ? (
              <p className="text-sm text-[#71717A]">Sin movimientos registrados.</p>
            ) : (
              <ol className="space-y-3">
                {history.map((h) => (
                  <li key={h.id} className="flex items-center gap-3 text-sm">
                    <span className="h-2 w-2 flex-shrink-0 rounded-full bg-[#F97316]" />
                    <span className="flex flex-wrap items-center gap-1.5 text-[#3F3F46]">
                      <span className="font-semibold text-[#0A0A0A]">{h.movedByFullName ?? h.movedByUsername}</span>
                      {h.fromStatus ? (
                        <>
                          movió de <span className="font-medium">{pick(TASK_STATUS_LABELS[h.fromStatus])}</span>
                          <ArrowRight className="h-3 w-3 text-[#71717A]" />
                          <span className="font-medium">{pick(TASK_STATUS_LABELS[h.toStatus])}</span>
                        </>
                      ) : (
                        <>creó la tarea en <span className="font-medium">{pick(TASK_STATUS_LABELS[h.toStatus])}</span></>
                      )}
                    </span>
                    <span className="ml-auto whitespace-nowrap text-xs text-[#A1A1AA]">{formatDateTime(h.movedAt, lang)}</span>
                  </li>
                ))}
              </ol>
            )}
          </Section>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-[#F4F4F5] p-4">
          <Button variant="outline" size="sm" onClick={onClose} className="border-[#D4D4D8] text-[#71717A] hover:text-[#0A0A0A]">
            Cerrar
          </Button>
          <Button size="sm" onClick={() => onEdit(task)} className="gap-1.5 bg-[#F97316] text-white hover:bg-[#C2410C]">
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
