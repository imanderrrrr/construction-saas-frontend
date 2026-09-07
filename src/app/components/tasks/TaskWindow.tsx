import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, FileText, Trash2, UploadCloud } from 'lucide-react';
import { cn } from '../ui/utils';
import { FIELD_LIMITS } from '../../../shared/fieldLimits';
import {
  addTaskComment, deleteTaskAttachment, formatFileSize, getTaskAttachments, getTaskComments,
  getTaskHistory, isImageAttachment, supervisorGetTaskHistory, taskAttachmentUrl, uploadTaskAttachment,
  type TaskAttachment, type TaskComment, type TaskResponse, type TaskStatusHistoryEntry,
} from '../../services/tasks';
import { AuthImage } from '../sitelog/AuthImage';
import { Lightbox } from '../sitelog/Lightbox';
import { BtModal } from '../bt/windows';
import { DarkButton } from '../projects/ficha/panel';
import { FOCUS_RING, PrimaryButton, SecondaryButton } from '../onboarding/chrome';
import { Bone, EmptyWord, Mono, PaperNote } from '../projects/bt';
import { stampDateTime, stampShort, StepChip } from './bits';
import { daysInStep, daysLate, stepAfter } from './grouping';

/**
 * 07 — the task, open.
 *
 * The window already existed and was written by hand in Spanish, inside a
 * bilingual panel: "Descripción", "Personas", "Sé el primero en comentar".
 * Its five sections are not reordered and none is removed — Description,
 * People, Attachments, Comments, History, numbered in reading order. What
 * changes is the language, the weight, and that the ladder's actions move up
 * to the header.
 */

const MAX_ATTACHMENT = 25 * 1024 * 1024;
const ALLOWED = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword', 'application/vnd.ms-excel', 'application/vnd.ms-powerpoint',
];
const MIN_COMMENT = 5;

export function TaskWindow({ open, onOpenChange, task, lang, supervisor, onAdvance, onEdit, onDelete, onChanged }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: TaskResponse | null;
  lang: string;
  /** The supervisor reads the same window: no editing, no deleting, no assigning. */
  supervisor: boolean;
  onAdvance: () => void;
  onEdit: () => void;
  onDelete: () => void;
  /** Something inside changed a count the list shows. */
  onChanged: () => void;
}) {
  const { t } = useTranslation(['tasks', 'common']);
  const [history, setHistory] = useState<TaskStatusHistoryEntry[] | null>(null);
  const [comments, setComments] = useState<TaskComment[] | null>(null);
  const [files, setFiles] = useState<TaskAttachment[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [commentFailed, setCommentFailed] = useState(false);

  const [uploading, setUploading] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [viewer, setViewer] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const taskId = task?.id ?? null;

  const load = useCallback(() => {
    if (taskId == null) return;
    setLoadFailed(false);
    const historyOf = supervisor ? supervisorGetTaskHistory : getTaskHistory;
    Promise.all([historyOf(taskId), getTaskComments(taskId), getTaskAttachments(taskId)])
      .then(([h, c, f]) => { setHistory(h); setComments(c); setFiles(f); })
      .catch(() => setLoadFailed(true));
  }, [taskId, supervisor]);

  useEffect(() => {
    if (!open || taskId == null) return;
    setHistory(null); setComments(null); setFiles(null);
    setDraft(''); setFileError(null); setCommentFailed(false);
    load();
  }, [open, taskId, load]);

  if (!task) return null;

  const closed = task.status === 'DONE';
  const next = stepAfter(task.status);
  const age = daysInStep(task);
  const late = daysLate(task);
  const images = (files ?? []).filter(isImageAttachment);
  const documents = (files ?? []).filter(f => !isImageAttachment(f));

  const post = async () => {
    const body = draft.trim();
    if (body.length < MIN_COMMENT || posting) return;
    setPosting(true);
    setCommentFailed(false);
    try {
      const added = await addTaskComment(task.id, body);
      setComments(prev => [...(prev ?? []), added]);
      setDraft('');
      onChanged();
    } catch {
      setCommentFailed(true);
    } finally {
      setPosting(false);
    }
  };

  const pick = async (file: File) => {
    setFileError(null);
    // Checked before a single byte leaves the browser: the point of the copy
    // is that nothing was uploaded, so nothing should have been.
    if (file.size > MAX_ATTACHMENT) {
      setFileError(t('tasks:detail.files.tooBig', { file: file.name, size: formatFileSize(file.size) }));
      return;
    }
    if (!ALLOWED.includes(file.type)) {
      setFileError(t('tasks:detail.files.badType', { file: file.name }));
      return;
    }
    setUploading(file.name);
    try {
      const added = await uploadTaskAttachment(task.id, file);
      setFiles(prev => [...(prev ?? []), added]);
      onChanged();
    } catch {
      setFileError(t('tasks:detail.files.failed', { file: file.name }));
    } finally {
      setUploading(null);
    }
  };

  const removeFile = async (att: TaskAttachment) => {
    try {
      await deleteTaskAttachment(task.id, att.id);
      setFiles(prev => (prev ?? []).filter(f => f.id !== att.id));
      onChanged();
    } catch {
      setFileError(t('tasks:detail.error'));
    }
  };

  const sectionLabel = (text: string, note?: string) => (
    <div className="flex items-baseline justify-between gap-3 mb-2.5">
      <Mono className="text-[10px] font-semibold tracking-[0.12em] text-[#0B0A09]">{text}</Mono>
      {note && <Mono className="text-[9px] tracking-[0.1em] text-[#A69C8D]">{note}</Mono>}
    </div>
  );

  return (
    <>
      <BtModal
        open={open}
        onOpenChange={onOpenChange}
        width={supervisor ? 1112 : 1152}
        kicker={`${task.projectName} · ${supervisor ? t('tasks:detail.people').replace(/^2 · /, '').toLowerCase() : ''}`.trim().replace(/ ·\s*$/, '')}
        title={task.title}
        bodyClassName="px-0 md:px-0 py-0"
        footer={
          <>
            <div className="md:mr-auto flex flex-wrap items-center gap-2">
              <StepChip status={task.status} />
              {age != null && (
                <Mono className="text-[9.5px] tracking-[0.08em] text-[#8A8175]">
                  {task.startDate && task.dueDate
                    ? t('tasks:detail.age', { days: age, step: t(`tasks:step.${task.status}`).toLowerCase(), start: stampShort(task.startDate, lang), due: stampShort(task.dueDate, lang) })
                    : t('tasks:detail.age.short', { days: age, step: t(`tasks:step.${task.status}`).toLowerCase() })}
                </Mono>
              )}
              {late != null && (
                <Mono className="text-[9.5px] font-semibold tracking-[0.08em] text-[#B3402A]">
                  {t('tasks:due.late', { date: stampShort(task.dueDate!, lang), count: late })}
                </Mono>
              )}
            </div>
            {closed ? (
              <Mono className="text-[9.5px] tracking-[0.08em] text-[#A69C8D]">{t('tasks:detail.closed.noNext')}</Mono>
            ) : (
              <>
                {!supervisor && <SecondaryButton onClick={onEdit}>{t('tasks:detail.edit')}</SecondaryButton>}
                {next && (
                  <PrimaryButton onClick={onAdvance}>
                    {t('tasks:detail.advance', { step: t(`tasks:step.${next}`).toLowerCase() })}
                  </PrimaryButton>
                )}
              </>
            )}
          </>
        }
      >
        <div className="flex flex-col lg:flex-row">
          {/* Left: description, attachments, comments */}
          <div className="flex-1 min-w-0 px-5 py-5 md:px-[22px] space-y-6">
            <section>
              {sectionLabel(t('tasks:detail.description'))}
              {task.description
                ? <p className="text-[13.5px] leading-[1.6] text-[#2E2A24] whitespace-pre-wrap break-words">{task.description}</p>
                : <Mono className="text-[10px] tracking-[0.06em] text-[#A69C8D]">{t('tasks:detail.description.empty')}</Mono>}
            </section>

            <section>
              {sectionLabel(
                t('tasks:detail.files', { count: files?.length ?? 0 }),
                supervisor ? t('tasks:detail.files.supervisor') : undefined,
              )}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className={cn('w-full border border-dashed border-[#DBD0BB] bg-[#FBF8F2] px-[15px] py-[13px] text-left hover:border-[#F97316] transition-colors', FOCUS_RING)}
              >
                <span className="flex items-center gap-2.5">
                  <UploadCloud className="w-4 h-4 text-[#8A8175]" strokeWidth={2} />
                  <span className="text-[13px] text-[#2E2A24]">{t('tasks:detail.files.drop')}</span>
                </span>
                <Mono className="block text-[9px] tracking-[0.08em] text-[#A69C8D] mt-1.5">{t('tasks:detail.files.types')}</Mono>
              </button>
              <input
                ref={inputRef}
                type="file"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = ''; }}
              />
              {uploading && (
                <div className="mt-2.5">
                  <Mono className="block text-[9.5px] tracking-[0.08em] text-[#5A5346]">{t('tasks:detail.files.uploading')} · {uploading}</Mono>
                  <div className="h-1 bg-[#EAE4D8] mt-1.5 overflow-hidden"><div className="h-full w-1/2 bg-[#F97316] animate-pulse" /></div>
                </div>
              )}
              {fileError && (
                <PaperNote tone="red" className="mt-2.5">
                  <div>{fileError}</div>
                  <button type="button" onClick={() => { setFileError(null); inputRef.current?.click(); }} className={cn('font-bt-mono text-[9.5px] uppercase tracking-[0.1em] font-semibold text-[#C2410C] hover:text-[#F97316] mt-1.5', FOCUS_RING)}>
                    {t('tasks:detail.files.chooseOther')}
                  </button>
                </PaperNote>
              )}

              {files == null && !loadFailed && <div className="grid grid-cols-3 gap-3 mt-3">{[0, 1, 2].map(i => <div key={i} className="bt-skeleton aspect-[4/3]" />)}</div>}
              {files != null && files.length === 0 && !uploading && (
                <EmptyWord word={t('tasks:detail.files.empty')} title={t('tasks:detail.files.emptyBody')} className="border-0 py-6 bg-transparent" />
              )}
              {images.length > 0 && (
                <div className="grid grid-cols-3 md:grid-cols-3 gap-3 mt-3">
                  {images.map((att, i) => (
                    <button
                      key={att.id}
                      type="button"
                      onClick={() => setViewer(i)}
                      className={cn('block border border-[#DBD0BB] hover:border-[#F97316] transition-colors overflow-hidden aspect-[4/3]', FOCUS_RING)}
                    >
                      <AuthImage src={taskAttachmentUrl(task.id, att.id)} alt={att.fileName} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
              {documents.length > 0 && (
                <div className="border border-[#EDE7DB] mt-3">
                  {documents.map(att => (
                    <div key={att.id} className="flex items-center gap-2.5 px-3 h-10 border-b border-[#F0EBE1] last:border-b-0">
                      <FileText className="w-3.5 h-3.5 text-[#8A8175] flex-shrink-0" strokeWidth={2} />
                      <span className="text-[12.5px] text-[#0B0A09] truncate flex-1 min-w-0">{att.fileName}</span>
                      <Mono className="text-[9px] tracking-[0.06em] text-[#A69C8D] hidden sm:block flex-shrink-0">
                        {att.uploadedByName} · {stampShort(att.createdAt, lang)} · {formatFileSize(att.sizeBytes)}
                      </Mono>
                      <a
                        href={taskAttachmentUrl(task.id, att.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn('font-bt-mono text-[9px] uppercase tracking-[0.1em] text-[#5A5346] hover:text-[#C2410C] flex-shrink-0', FOCUS_RING)}
                      >
                        <Download className="w-3.5 h-3.5" strokeWidth={2} />
                        <span className="sr-only">{t('tasks:detail.files.download')}</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => removeFile(att)}
                        aria-label={t('tasks:detail.files.delete')}
                        className={cn('text-[#B3402A] hover:text-[#8F3221] flex-shrink-0', FOCUS_RING)}
                      >
                        <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              {sectionLabel(t('tasks:detail.comments', { count: comments?.length ?? 0 }), t('tasks:detail.comments.rule'))}
              {comments == null && !loadFailed && <div className="space-y-2.5">{[0, 1].map(i => <div key={i} className="border-l-[3px] border-l-[#EDE7DB] bg-[#FBF8F2] px-3.5 py-3 space-y-2"><Bone className="w-1/3 h-[9px]" /><Bone className="w-[80%] h-3" /></div>)}</div>}
              {comments != null && comments.length === 0 && (
                <EmptyWord word={t('tasks:detail.comments.empty')} title={t('tasks:detail.comments.emptyBody')} className="border-0 py-6 bg-transparent" />
              )}
              {comments != null && comments.length > 0 && (
                <div className="flex flex-col gap-[11px]">
                  {comments.map(c => (
                    <div key={c.id} className="border border-[#EDE7DB] border-l-[3px] border-l-[#DBD0BB] bg-[#FBF8F2] px-3.5 py-[11px]">
                      <div className="flex items-baseline justify-between gap-3 flex-wrap">
                        <Mono className="text-[10px] font-semibold tracking-[0.1em] text-[#0B0A09]">{c.authorName}</Mono>
                        <Mono className="text-[9.5px] tracking-[0.06em] text-[#A69C8D]">{stampDateTime(c.createdAt, lang)}</Mono>
                      </div>
                      <p className="text-[12.8px] leading-[1.55] text-[#2E2A24] mt-1.5 whitespace-pre-wrap break-words">{c.body}</p>
                    </div>
                  ))}
                </div>
              )}
              <div className="bg-[#FAF7F0] border border-[#EDE7DB] px-3.5 py-3 mt-3">
                <textarea
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  placeholder={t('tasks:detail.comments.placeholder')}
                  maxLength={FIELD_LIMITS.LONG_TEXT}
                  rows={2}
                  className={cn('w-full h-[58px] resize-none border border-[#DBD0BB] bg-white px-3 py-2 text-[12.8px] leading-[1.5] outline-none focus:border-[#F97316]', FOCUS_RING)}
                />
                <div className="flex items-center justify-between gap-3 mt-2 flex-wrap">
                  <Mono className="text-[9px] tracking-[0.08em] text-[#A69C8D]">
                    {supervisor ? t('tasks:detail.comments.audience.supervisor') : t('tasks:detail.comments.audience')}
                  </Mono>
                  <div className="flex items-center gap-3">
                    <Mono className="text-[9.5px] tracking-[0.06em] text-[#A69C8D] tabular-nums">{draft.length} / {FIELD_LIMITS.LONG_TEXT}</Mono>
                    <PrimaryButton onClick={post} disabled={draft.trim().length < MIN_COMMENT || posting} className="px-4 py-2.5 text-[10px]">
                      {posting ? t('tasks:detail.comments.submitting') : t('tasks:detail.comments.submit')}
                    </PrimaryButton>
                  </div>
                </div>
                {commentFailed && <PaperNote tone="red" className="mt-2.5">{t('tasks:detail.comments.failed')}</PaperNote>}
              </div>
            </section>
          </div>

          {/* Right: people and history */}
          <div className="w-full lg:w-[360px] flex-shrink-0 bg-[#FBF8F2] border-t lg:border-t-0 lg:border-l border-[#EDE7DB] px-5 py-5 md:px-[22px] space-y-6">
            <section>
              {sectionLabel(t('tasks:detail.people'))}
              <Row label={t('tasks:detail.assignedTo')}>
                <span className="flex items-center gap-2 justify-end">
                  {task.assignedToName ?? <span className="text-[#A69C8D]">{t('tasks:unassigned')}</span>}
                </span>
              </Row>
              {supervisor && task.assignedToName && (
                <Mono className="block text-[9px] tracking-[0.08em] text-[#A69C8D] mt-1 text-right">{t('tasks:detail.assignee.locked')}</Mono>
              )}
              <Row label={t('tasks:detail.createdBy')}>{task.createdByName}</Row>
              <Row label={t('tasks:form.start')}>
                {task.startDate ? stampShort(task.startDate, lang) : <span className="text-[#A69C8D]">—</span>}
              </Row>
              <Row label={t('tasks:form.due')}>
                {task.dueDate ? stampShort(task.dueDate, lang) : <span className="text-[#A69C8D]">—</span>}
              </Row>
              {closed && <PaperNote className="mt-3">{t('tasks:detail.closed.canDo')}</PaperNote>}
              {supervisor && <PaperNote className="mt-3">{t('tasks:detail.readOnly')}</PaperNote>}
              {!supervisor && !closed && (
                <div className="flex justify-end mt-3">
                  <DarkButton onClick={onDelete} className="border-[#B3402A] text-[#B3402A] hover:border-[#8F3221] hover:text-[#8F3221]">
                    {t('tasks:menu.delete')}
                  </DarkButton>
                </div>
              )}
            </section>

            <section>
              {sectionLabel(t('tasks:detail.history', { count: history?.length ?? 0 }))}
              {history == null && !loadFailed && <div className="pl-[22px] border-l border-[#EDE7DB] space-y-4">{[0, 1, 2].map(i => <div key={i} className="space-y-1.5"><Bone className="w-2/3 h-3" /><Bone className="w-1/2 h-[9px]" /></div>)}</div>}
              {loadFailed && (
                <PaperNote tone="red">
                  <div>{t('tasks:detail.error')}</div>
                  <button type="button" onClick={load} className={cn('font-bt-mono text-[9.5px] uppercase tracking-[0.1em] font-semibold text-[#C2410C] hover:text-[#F97316] mt-1.5', FOCUS_RING)}>
                    {t('tasks:error.retry')}
                  </button>
                </PaperNote>
              )}
              {history != null && (
                <ol className="pl-[22px] border-l border-[#EDE7DB]">
                  {[...history].reverse().map((h, i) => (
                    <li key={h.id} className="relative pb-5 last:pb-0">
                      <span
                        aria-hidden="true"
                        className={cn(
                          'absolute -left-[27px] top-[5px] w-[9px] h-[9px]',
                          i === 0 ? 'bg-[#F97316]' : h.fromStatus ? 'bg-[#DBD0BB]' : 'border border-[#DBD0BB] bg-[#FBF8F2]',
                        )}
                      />
                      <div className="font-bt-heading font-bold text-[13px] text-[#0B0A09]">
                        {h.fromStatus
                          ? t('tasks:detail.history.move', { from: t(`tasks:step.${h.fromStatus}`), to: t(`tasks:step.${h.toStatus}`) })
                          : t('tasks:detail.history.created', { step: t(`tasks:step.${h.toStatus}`) })}
                      </div>
                      <Mono className="block text-[9.5px] tracking-[0.08em] text-[#8A8175] mt-1">
                        {h.movedByFullName ?? h.movedByUsername} · {stampDateTime(h.movedAt, lang)}
                      </Mono>
                      {!h.fromStatus && (
                        <Mono className="block text-[9px] tracking-[0.08em] text-[#A69C8D] mt-[3px]">{t('tasks:detail.history.firstNote')}</Mono>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        </div>
      </BtModal>

      {viewer != null && images.length > 0 && (
        <Lightbox
          images={images.map(att => ({
            id: att.id,
            url: taskAttachmentUrl(task.id, att.id),
            alt: att.fileName,
            downloadName: att.fileName,
            caption: task.title,
            meta: <>{att.uploadedByName} · {stampShort(att.createdAt, lang)} · {formatFileSize(att.sizeBytes)}</>,
          }))}
          index={Math.min(viewer, images.length - 1)}
          onIndexChange={setViewer}
          onClose={() => setViewer(null)}
          labels={{ download: t('tasks:detail.files.download'), close: t('common:buttons.close') }}
          actions={img => (
            <button
              type="button"
              onClick={() => {
                const att = images.find(a => a.id === img.id);
                if (!att) return;
                if (images.length === 1) setViewer(null);
                removeFile(att);
              }}
              title={t('tasks:detail.files.deleteNote')}
              className={cn('inline-flex items-center gap-1.5 font-bt-mono text-[10px] font-semibold uppercase tracking-[0.1em] px-3 py-2 border border-[rgba(245,241,232,0.25)] text-[#F5F1E8] hover:border-[#B3402A] hover:text-[#B3402A]', FOCUS_RING)}
            >
              <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
              <span className="hidden sm:inline">{t('tasks:detail.files.delete')}</span>
            </button>
          )}
        />
      )}
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-[9px] border-b border-[#F0EBE1] last:border-b-0">
      <Mono className="text-[9.5px] font-semibold tracking-[0.12em] text-[#5A5346] flex-shrink-0 pt-[3px]">{label}</Mono>
      <div className="text-[13px] leading-[1.45] text-[#0B0A09] text-right min-w-0 break-words">{children}</div>
    </div>
  );
}
