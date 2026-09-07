import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TaskResponse } from '../../services/tasks';
import { BtModal } from '../bt/windows';
import { DestroyButton, PrimaryButton, SecondaryButton } from '../onboarding/chrome';
import { BulletList } from '../bt/windows';
import { Mono, PaperNote } from '../projects/bt';
import { daysInStep, daysLate } from './grouping';

/**
 * 08 and 09 — the only two things this section asks before doing.
 *
 * The other three advances say nothing: they happen in the row and can be
 * moved forward again. Asking about everything teaches people to press "Yes"
 * without reading, and then the one confirmation that matters stops working.
 */

/**
 * 08 — closing a task.
 *
 * The button is orange, not red. Closing a task is the good ending — it is
 * what the whole week is for — and red is kept for deleting, the only thing
 * here that destroys data. Red in both places would make "I finished" and "I
 * lost it" look the same.
 */
export function ConfirmCompleteModal({ open, onOpenChange, task, lang, onConfirm }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: TaskResponse | null;
  lang: string;
  onConfirm: () => Promise<void>;
}) {
  const { t } = useTranslation(['tasks', 'common']);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setBusy(false); }, [open]);
  if (!task) return null;

  const age = daysInStep(task);

  return (
    <BtModal
      open={open}
      onOpenChange={onOpenChange}
      width={460}
      dismissible={false}
      closeDisabled={busy}
      kicker={t('tasks:complete.eyebrow')}
      title={t('tasks:complete.title')}
      footer={
        <>
          <SecondaryButton onClick={() => onOpenChange(false)} disabled={busy}>{t('common:buttons.cancel')}</SecondaryButton>
          <PrimaryButton
            onClick={async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); } }}
            disabled={busy}
          >
            {busy ? t('tasks:complete.confirming') : t('tasks:complete.confirm')}
          </PrimaryButton>
        </>
      }
    >
      <div className="bg-[#FBF8F2] border border-[#EDE7DB] px-4 py-3">
        <div className="text-[14px] font-semibold text-[#0B0A09]">{task.title}</div>
        <Mono className="block text-[9.5px] tracking-[0.08em] text-[#A69C8D] mt-1">
          {[task.projectName, task.assignedToName ?? t('tasks:unassigned'), age != null ? t('tasks:detail.age.short', { days: age, step: t(`tasks:step.${task.status}`).toLowerCase() }) : null]
            .filter(Boolean)
            .join(' · ')}
        </Mono>
      </div>
      <p className="text-[13px] leading-[1.55] text-[#2E2A24] mt-4">{t('tasks:complete.body')}</p>
      <Mono className="block text-[9.5px] tracking-[0.08em] text-[#8A8175] mt-3">{t('tasks:complete.canDo')}</Mono>
      {/* This window is a reasonable patch, not the fix: while the server has no
          way back, the price of a wrong click is deleting the task whole. */}
    </BtModal>
  );
}

/**
 * 09 — deleting a task.
 *
 * Nothing is deleted in Clientes or Proyectos: there, things are archived.
 * Here it is real, so the window says what disappears with the task's own
 * numbers — "4 entries, 3 comments, 2 photos and 1 PDF" — rather than a
 * generic list. A brand-new task reads "1 entry · no comments · no
 * attachments", and then the window weighs what it should: almost nothing.
 *
 * No typing the name to confirm: in a jobsite, duplicate tasks get deleted
 * every week, and turning each legitimate delete into a twenty-second chore is
 * how people learn to work around the guard rail. The focus lands on Cancel,
 * Escape closes, and Enter does not confirm.
 */
export function ConfirmDeleteModal({ open, onOpenChange, task, lang, onConfirm }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: TaskResponse | null;
  lang: string;
  onConfirm: () => Promise<void>;
}) {
  const { t } = useTranslation(['tasks', 'common']);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => { if (open) { setBusy(false); setFailed(false); } }, [open]);
  if (!task) return null;

  const late = daysLate(task);
  const photos = task.photoCount ?? 0;
  const documents = task.documentCount ?? 0;
  const comments = task.commentCount ?? 0;
  const history = task.historyCount ?? 0;

  const items = [
    t('tasks:delete.item.task'),
    t('tasks:delete.item.history', { count: history }),
    comments === 0 ? t('tasks:delete.item.comments_zero') : t('tasks:delete.item.comments', { count: comments }),
    photos + documents === 0
      ? t('tasks:delete.item.files.none')
      : t('tasks:delete.item.files', {
        photos: t('tasks:delete.photos', { count: photos }),
        documents: t('tasks:delete.documents', { count: documents }),
      }),
  ];

  return (
    <BtModal
      open={open}
      onOpenChange={onOpenChange}
      width={460}
      dismissible={false}
      closeDisabled={busy}
      kicker={t('tasks:delete.eyebrow')}
      kickerTone="red"
      title={t('tasks:delete.title')}
      footer={
        <>
          {/* Focus lands here: in this window you have to aim and press. */}
          <SecondaryButton autoFocus onClick={() => onOpenChange(false)} disabled={busy}>{t('common:buttons.cancel')}</SecondaryButton>
          <DestroyButton
            onClick={async () => {
              setBusy(true);
              setFailed(false);
              try { await onConfirm(); } catch { setFailed(true); } finally { setBusy(false); }
            }}
            disabled={busy}
          >
            {busy ? t('tasks:delete.confirming') : t('tasks:delete.confirm')}
          </DestroyButton>
        </>
      }
    >
      <div className="bg-[#FBF8F2] border border-[#EDE7DB] px-4 py-3">
        <div className="text-[14px] font-semibold text-[#0B0A09]">{task.title}</div>
        <Mono className="block text-[9.5px] tracking-[0.08em] text-[#A69C8D] mt-1">
          {[task.projectName, task.assignedToName ?? t('tasks:unassigned'), late != null ? t('tasks:due.late', { date: '', count: late }).trim().replace(/^·\s*/, '') : null]
            .filter(Boolean)
            .join(' · ')}
        </Mono>
      </div>
      <p className="text-[13px] leading-[1.55] text-[#2E2A24] mt-4">{t('tasks:delete.body')}</p>
      <BulletList items={items} className="mt-3" />
      <PaperNote className="mt-4">{t('tasks:delete.alternative')}</PaperNote>
      {failed && <PaperNote tone="red" className="mt-3">{t('tasks:delete.failed')}</PaperNote>}
    </BtModal>
  );
}
