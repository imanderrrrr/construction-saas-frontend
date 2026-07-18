import { useEffect, useRef, useState, type ReactNode } from 'react';
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
  FileText,
  Download,
  Eye,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { AuthImage } from './sitelog/AuthImage';
import { Lightbox } from './sitelog/Lightbox';
import {
  type TaskResponse,
  type TaskStatus,
  type TaskPriority,
  type TaskStatusHistoryEntry,
  type TaskComment,
  type TaskAttachment,
  TASK_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
  getTaskHistory,
  getTaskComments,
  addTaskComment,
  getTaskAttachments,
  uploadTaskAttachment,
  deleteTaskAttachment,
  taskAttachmentUrl,
  isImageAttachment,
  formatFileSize,
} from '../services/tasks';
import { FIELD_LIMITS } from '../../shared/fieldLimits';

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

  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // ── Attachments ──────────────────────────────────
  useEffect(() => {
    if (!open || !task) return;
    setLightboxIndex(null);
    setAttachmentsLoading(true);
    getTaskAttachments(task.id)
      .then(setAttachments)
      .catch(() => setAttachments([]))
      .finally(() => setAttachmentsLoading(false));
  }, [open, task]);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0 || !task) return;
    const files = Array.from(fileList);
    setUploading(true);
    try {
      const results = await Promise.allSettled(files.map((f) => uploadTaskAttachment(task.id, f)));
      const uploaded: TaskAttachment[] = [];
      let failures = 0;
      for (const r of results) {
        if (r.status === 'fulfilled') uploaded.push(r.value);
        else failures += 1;
      }
      if (uploaded.length) setAttachments((prev) => [...prev, ...uploaded]);
      if (failures) {
        toast.error(
          failures === 1 ? 'No se pudo subir un archivo' : `No se pudieron subir ${failures} archivos`,
        );
      }
    } finally {
      setUploading(false);
    }
  }

  async function downloadAttachment(a: TaskAttachment) {
    if (!task) return;
    try {
      const res = await fetch(taskAttachmentUrl(task.id, a.id), { credentials: 'include' as RequestCredentials });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = a.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (err) {
      toast.error('No se pudo descargar el archivo', { description: (err as Error)?.message });
    }
  }

  async function previewAttachment(a: TaskAttachment) {
    if (!task) return;
    // Open the tab synchronously (in the click handler) so the post-fetch
    // navigation isn't treated as a blocked popup.
    const win = window.open('', '_blank');
    try {
      const res = await fetch(taskAttachmentUrl(task.id, a.id), { credentials: 'include' as RequestCredentials });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (win) win.location.href = url;
      else window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      if (win) win.close();
      toast.error('No se pudo abrir el archivo', { description: (err as Error)?.message });
    }
  }

  async function removeAttachment(attId: number) {
    if (!task) return;
    if (!window.confirm('¿Eliminar este archivo adjunto?')) return;
    try {
      await deleteTaskAttachment(task.id, attId);
      setAttachments((prev) => prev.filter((a) => a.id !== attId));
      // If the lightbox is open on a now-deleted image, clamp or close it.
      setLightboxIndex((idx) => {
        if (idx == null) return idx;
        const remaining = attachments.filter((a) => a.id !== attId && isImageAttachment(a));
        if (remaining.length === 0) return null;
        return Math.min(idx, remaining.length - 1);
      });
    } catch (err) {
      toast.error('No se pudo eliminar el archivo', { description: (err as Error)?.message });
    }
  }

  if (!task) return null;
  const statusLabel = TASK_STATUS_LABELS[task.status];
  const prioLabel = TASK_PRIORITY_LABELS[task.priority];
  const pick = (l: { es: string; en: string }) => (lang === 'es' ? l.es : l.en);

  const imageAttachments = attachments.filter(isImageAttachment);
  const docAttachments = attachments.filter((a) => !isImageAttachment(a));

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) return;
        // While the image lightbox is open, ESC / outside-press closes the
        // lightbox first — not the whole modal.
        if (lightboxIndex != null) {
          setLightboxIndex(null);
          return;
        }
        onClose();
      }}
    >
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

          {/* Attachments */}
          <Section icon={Paperclip} title="Adjuntos" badge={attachments.length ? String(attachments.length) : undefined}>
            <div className="space-y-4">
              {/* Upload dropzone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
                onClick={() => fileInputRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
                  dragOver ? 'border-[#F97316] bg-[#F97316]/5' : 'border-[#D4D4D8] bg-[#FAFAFA] hover:border-[#F97316]/60'
                }`}
              >
                <UploadCloud className="h-7 w-7 text-[#A1A1AA]" />
                <p className="text-sm font-medium text-[#71717A]">
                  {uploading ? 'Subiendo…' : 'Arrastra archivos o haz clic para subir'}
                </p>
                <p className="text-xs text-[#A1A1AA]">Imágenes y documentos (PDF, Word, Excel). Máx. 25 MB.</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                  className="hidden"
                  onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
                />
              </div>

              {attachmentsLoading ? (
                <p className="text-sm text-[#71717A]">Cargando…</p>
              ) : attachments.length === 0 ? (
                <p className="text-sm text-[#71717A]">Aún no hay archivos adjuntos.</p>
              ) : (
                <div className="space-y-3">
                  {/* Image thumbnails → lightbox */}
                  {imageAttachments.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {imageAttachments.map((a, i) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => setLightboxIndex(i)}
                          title={a.fileName}
                          className="group relative aspect-square overflow-hidden rounded-lg border border-[#E4E4E7] bg-[#FAFAFA]"
                        >
                          <AuthImage
                            src={taskAttachmentUrl(task.id, a.id)}
                            alt={a.fileName}
                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Document rows */}
                  {docAttachments.length > 0 && (
                    <ul className="space-y-2">
                      {docAttachments.map((a) => (
                        <li key={a.id} className="flex items-center gap-3 rounded-xl border border-[#E4E4E7] bg-white p-3">
                          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[#F97316]/10 text-[#C2410C]">
                            <FileText className="h-5 w-5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-[#0A0A0A]">{a.fileName}</p>
                            <p className="truncate text-xs text-[#A1A1AA]">
                              {formatFileSize(a.sizeBytes)} · {a.uploadedByName} · {formatDateTime(a.createdAt, lang)}
                            </p>
                          </div>
                          {a.contentType === 'application/pdf' && (
                            <button
                              type="button"
                              onClick={() => previewAttachment(a)}
                              title="Vista previa"
                              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-[#71717A] hover:bg-[#F4F4F5] hover:text-[#0A0A0A]"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => downloadAttachment(a)}
                            title="Descargar"
                            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-[#71717A] hover:bg-[#F4F4F5] hover:text-[#0A0A0A]"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeAttachment(a.id)}
                            title="Eliminar"
                            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-[#71717A] hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
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
                  maxLength={FIELD_LIMITS.LONG_TEXT}
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

        {/* Image lightbox — overlays the modal (fixed, above the dialog) */}
        {lightboxIndex != null && imageAttachments[lightboxIndex] && (
          <Lightbox
            images={imageAttachments.map((a) => ({
              id: a.id,
              url: taskAttachmentUrl(task.id, a.id),
              alt: a.fileName,
              downloadName: a.fileName,
              caption: a.fileName,
              meta: (
                <>
                  <span>{a.uploadedByName}</span>
                  <span>·</span>
                  <span>{formatDateTime(a.createdAt, lang)}</span>
                </>
              ),
            }))}
            index={lightboxIndex}
            onIndexChange={setLightboxIndex}
            onClose={() => setLightboxIndex(null)}
            onDownloadError={() => toast.error('No se pudo descargar el archivo')}
            actions={(img) => (
              <button
                type="button"
                onClick={() => removeAttachment(Number(img.id))}
                title="Eliminar"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-red-500/20 hover:text-red-300"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            )}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
