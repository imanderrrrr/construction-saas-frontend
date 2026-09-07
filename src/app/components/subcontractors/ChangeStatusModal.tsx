import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../ui/utils';
import { FIELD_LIMITS } from '../../../shared/fieldLimits';
import {
  ADMIN_JOB_TRANSITIONS, updateJobStatus,
  type JobStatus, type SubcontractorJobDTO,
} from '../../services/subcontractors';
import { BtModal } from '../bt/windows';
import { DestroyButton, FOCUS_RING, PrimaryButton, SecondaryButton } from '../onboarding/chrome';
import { FieldError, FieldHint, FieldLabel, INPUT, Mono, PaperNote } from '../projects/bt';
import { JobStatusChip } from './bits';

/**
 * 07 — the manual jump.
 *
 * The two decisions of the day live on the ficha's bar; this window is the
 * emergency exit. It used to be six loose buttons of the same size and colour:
 * approving a job and reopening a closed one cost exactly one click each, and
 * none of them said what it would do.
 *
 * Reopening a closed job gets its own shape — a red warning and a red confirm
 * — because it is the only one that changes what the subcontractor can do from
 * their app.
 */

const REOPEN_TARGETS: JobStatus[] = ['IN_PROGRESS', 'OBSERVED'];
const MAX_COMMENT = FIELD_LIMITS.NOTE;

export function ChangeStatusModal({ open, onOpenChange, job, preset, onChanged }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: SubcontractorJobDTO | null;
  /** "Devolver con observación" arrives here already aimed at Observado. */
  preset?: JobStatus;
  onChanged: (job: SubcontractorJobDTO) => void;
}) {
  const { t } = useTranslation(['subcontractors', 'common']);
  const [target, setTarget] = useState<JobStatus | null>(null);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickError, setPickError] = useState(false);

  const reopening = job?.status === 'CLOSED';
  const options = job
    ? (reopening ? REOPEN_TARGETS : ADMIN_JOB_TRANSITIONS[job.status])
    : [];

  useEffect(() => {
    if (!open) return;
    setTarget(preset && options.includes(preset) ? preset : null);
    setComment('');
    setSaving(false);
    setError(null);
    setPickError(false);
  }, [open, preset, job?.id]); // eslint-disable-line react-hooks/exhaustive-deps -- options derives from job.status

  if (!job) return null;

  const submit = async () => {
    if (!target) { setPickError(true); return; }
    setSaving(true);
    setError(null);
    try {
      const updated = await updateJobStatus(job.id, { status: target, comment: comment.trim() || null });
      onChanged(updated);
      onOpenChange(false);
    } catch {
      setError(t('subcontractors:chg.error.server'));
    } finally {
      setSaving(false);
    }
  };

  const meansKey = (status: JobStatus) =>
    reopening && REOPEN_TARGETS.includes(status)
      ? `subcontractors:chg.reopenMeans.${status}`
      : `subcontractors:chg.means.${status}`;

  return (
    <BtModal
      open={open}
      onOpenChange={onOpenChange}
      width={460}
      dismissible={false}
      closeDisabled={saving}
      kicker={t('subcontractors:chg.kicker', { id: job.id })}
      kickerTone={reopening ? 'red' : 'orange'}
      title={reopening ? t('subcontractors:chg.reopenTitle') : t('subcontractors:chg.title')}
      footer={
        <>
          <SecondaryButton onClick={() => onOpenChange(false)} disabled={saving}>{t('common:buttons.cancel')}</SecondaryButton>
          {reopening ? (
            <DestroyButton onClick={submit} disabled={saving}>
              {saving ? t('subcontractors:chg.submitting') : t('subcontractors:chg.submitReopen')}
            </DestroyButton>
          ) : (
            <PrimaryButton onClick={submit} disabled={saving}>
              {saving ? t('subcontractors:chg.submitting') : t('subcontractors:chg.submit')}
            </PrimaryButton>
          )}
        </>
      }
    >
      <div className="flex items-center gap-3">
        <Mono className="text-[9.5px] font-semibold tracking-[0.12em] text-[#5A5346]">{t('subcontractors:chg.current')}</Mono>
        <JobStatusChip status={job.status} />
      </div>

      {reopening && (
        <PaperNote tone="red" className="mt-4">
          <div className="font-semibold">{t('subcontractors:chg.reopenWarning.title')}</div>
          <div className="mt-1">{t('subcontractors:chg.reopenWarning.body')}</div>
        </PaperNote>
      )}

      <fieldset className="mt-4">
        <legend className="font-bt-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[#5A5346] mb-2">
          {t('subcontractors:chg.moveTo')}
        </legend>
        <div className="border border-[#EDE7DB]">
          {options.map(status => (
            <label
              key={status}
              className={cn(
                'flex items-start gap-3 px-[13px] py-[11px] border-b border-[#F0EBE1] last:border-b-0 cursor-pointer transition-colors',
                target === status ? 'bg-[#FBEDE0]' : 'hover:bg-[#FBF8F2]',
              )}
            >
              <input
                type="radio"
                name={`status-${job.id}`}
                value={status}
                checked={target === status}
                onChange={() => { setTarget(status); setPickError(false); }}
                className={cn('mt-[3px] w-[14px] h-[14px] accent-[#F97316] flex-shrink-0', FOCUS_RING)}
              />
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-[#0A0A0A]">{t(`subcontractors:status.${status}`)}</span>
                <span className="block text-[12.5px] leading-[1.45] text-[#5A5346] mt-[2px]">{t(meansKey(status))}</span>
              </span>
            </label>
          ))}
        </div>
        {pickError && <FieldError>{t('subcontractors:chg.error.pick')}</FieldError>}
      </fieldset>

      <div className="mt-4">
        <FieldLabel htmlFor={`chg-comment-${job.id}`}>{t('subcontractors:chg.comment')}</FieldLabel>
        <textarea
          id={`chg-comment-${job.id}`}
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder={t('subcontractors:chg.commentPlaceholder')}
          maxLength={MAX_COMMENT}
          rows={2}
          className={cn(INPUT, 'h-[62px] resize-none py-2 leading-[1.5]')}
        />
        <div className="flex items-center justify-between gap-3">
          <FieldHint>{reopening ? t('subcontractors:chg.commentHintReopen') : t('subcontractors:chg.commentHint')}</FieldHint>
          <Mono className="text-[9.5px] tracking-[0.06em] text-[#A69C8D] tabular-nums mt-[5px]">
            {t('subcontractors:notes.counter', { count: comment.length, max: MAX_COMMENT })}
          </Mono>
        </div>
      </div>

      {!reopening && <PaperNote className="mt-4">{t('subcontractors:chg.warning')}</PaperNote>}
      {error && <PaperNote tone="red" className="mt-3">{error}</PaperNote>}
    </BtModal>
  );
}
