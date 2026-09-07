import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../ui/utils';
import { FIELD_LIMITS } from '../../../shared/fieldLimits';
import { createJob, type SubcontractorJobDTO } from '../../services/subcontractors';
import { BtModal } from '../bt/windows';
import { PrimaryButton, SecondaryButton, TertiaryButton } from '../onboarding/chrome';
import { FieldError, FieldHint, FieldLabel, INPUT, INPUT_ERROR, Mono, PaperNote } from '../projects/bt';
import type { RefData } from './refData';

/**
 * 06 — assign a job.
 *
 * The agreed amount finally gets asked for: the column is in the model, the
 * endpoint has always accepted it, and no screen ever showed it. It is typed
 * in dollars and stored in cents; there is no currency picker because the
 * model has no currency.
 *
 * The server rejects a job assigned to anyone without the subcontractor role,
 * so the selector only offers users who have it. When that list comes back
 * empty the empty state points at Usuarios, which is the only place it can be
 * fixed.
 */

const MAX_TITLE = FIELD_LIMITS.SHORT_NAME;
const MAX_DESCRIPTION = FIELD_LIMITS.LONG_TEXT;

interface Errors {
  subcontractorId?: string;
  projectId?: string;
  title?: string;
  amount?: string;
  server?: string;
}

export function AssignJobModal({ open, onOpenChange, refData, presetSubcontractorId, onAssigned, onGoToUsers }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  refData: RefData;
  presetSubcontractorId?: number;
  onAssigned: (job: SubcontractorJobDTO) => void;
  onGoToUsers: () => void;
}) {
  const { t } = useTranslation(['subcontractors', 'common']);
  const [subcontractorId, setSubcontractorId] = useState<number | ''>('');
  const [projectId, setProjectId] = useState<number | ''>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSubcontractorId(presetSubcontractorId ?? '');
    setProjectId('');
    setTitle('');
    setDescription('');
    setAmount('');
    setDueDate('');
    setErrors({});
    setSaving(false);
  }, [open, presetSubcontractorId]);

  const submit = async () => {
    const next: Errors = {};
    if (!subcontractorId) next.subcontractorId = t('subcontractors:assign.error.subcontractor');
    if (!projectId) next.projectId = t('subcontractors:assign.error.project');
    if (!title.trim()) next.title = t('subcontractors:assign.error.title');
    // Empty is fine — the amount is optional. Zero, negative or unparseable is not.
    let agreedAmountCents: number | null = null;
    if (amount.trim()) {
      const parsed = Number(amount);
      if (!Number.isFinite(parsed) || parsed <= 0) next.amount = t('subcontractors:assign.error.amount');
      else agreedAmountCents = Math.round(parsed * 100);
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      const job = await createJob({
        subcontractorId: Number(subcontractorId),
        projectId: Number(projectId),
        title: title.trim(),
        description: description.trim() || null,
        agreedAmountCents,
        dueDate: dueDate || null,
      });
      onAssigned(job);
      onOpenChange(false);
    } catch {
      setErrors({ server: t('subcontractors:assign.error.server') });
    } finally {
      setSaving(false);
    }
  };

  const noSubcontractors = refData.state === 'ready' && refData.subcontractors.length === 0;

  return (
    <BtModal
      open={open}
      onOpenChange={onOpenChange}
      width={560}
      dismissible={false}
      closeDisabled={saving}
      kicker={t('subcontractors:assign.kicker')}
      title={t('subcontractors:assign.title')}
      footer={
        <>
          <Mono className="text-[9.5px] tracking-[0.08em] text-[#A69C8D] md:mr-auto">{t('subcontractors:assign.footNote')}</Mono>
          <SecondaryButton onClick={() => onOpenChange(false)} disabled={saving}>{t('common:buttons.cancel')}</SecondaryButton>
          <PrimaryButton onClick={submit} disabled={saving || refData.state === 'failed'}>
            {saving ? t('subcontractors:assign.submitting') : t('subcontractors:assign.submit')}
          </PrimaryButton>
        </>
      }
    >
      {refData.state === 'failed' && (
        <PaperNote tone="red" className="mb-4">
          <div className="font-semibold">{t('subcontractors:assign.refError.title')}</div>
          <div className="mt-1">{t('subcontractors:assign.refError.hint')}</div>
          <TertiaryButton onClick={refData.reload} className="mt-2">{t('common:buttons.retry')}</TertiaryButton>
        </PaperNote>
      )}
      {noSubcontractors && (
        <PaperNote className="mb-4">
          <div>{t('subcontractors:assign.noSubs.hint')}</div>
          <TertiaryButton onClick={onGoToUsers} className="mt-2">{t('subcontractors:dir.empty.cta')} →</TertiaryButton>
        </PaperNote>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-[14px]">
        <div>
          <FieldLabel htmlFor="assign-sub" required>{t('subcontractors:assign.subcontractor')}</FieldLabel>
          <select
            id="assign-sub"
            value={subcontractorId}
            onChange={e => setSubcontractorId(e.target.value ? Number(e.target.value) : '')}
            disabled={refData.state !== 'ready'}
            className={cn(INPUT, 'appearance-none cursor-pointer', errors.subcontractorId && INPUT_ERROR)}
          >
            <option value="">{t('subcontractors:assign.pickOne')}</option>
            {refData.subcontractors.map(s => <option key={s.id} value={s.id}>{s.fullName ?? s.username}</option>)}
          </select>
          {errors.subcontractorId && <FieldError>{errors.subcontractorId}</FieldError>}
        </div>
        <div>
          <FieldLabel htmlFor="assign-project" required>{t('subcontractors:assign.project')}</FieldLabel>
          <select
            id="assign-project"
            value={projectId}
            onChange={e => setProjectId(e.target.value ? Number(e.target.value) : '')}
            disabled={refData.state !== 'ready'}
            className={cn(INPUT, 'appearance-none cursor-pointer', errors.projectId && INPUT_ERROR)}
          >
            <option value="">{t('subcontractors:assign.pickOneF')}</option>
            {refData.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {errors.projectId && <FieldError>{errors.projectId}</FieldError>}
        </div>
      </div>

      <div className="mt-[14px]">
        <FieldLabel htmlFor="assign-title" required>{t('subcontractors:assign.jobTitle')}</FieldLabel>
        <input
          id="assign-title"
          value={title}
          onChange={e => setTitle(e.target.value)}
          maxLength={MAX_TITLE}
          className={cn(INPUT, errors.title && INPUT_ERROR)}
        />
        {errors.title ? <FieldError>{errors.title}</FieldError> : <FieldHint>{t('subcontractors:assign.jobTitleHint', { max: MAX_TITLE })}</FieldHint>}
      </div>

      <div className="mt-[14px]">
        <FieldLabel htmlFor="assign-description">{t('subcontractors:assign.description')}</FieldLabel>
        <textarea
          id="assign-description"
          value={description}
          onChange={e => setDescription(e.target.value)}
          maxLength={MAX_DESCRIPTION}
          rows={3}
          className={cn(INPUT, 'h-[76px] resize-none py-2 leading-[1.5]')}
        />
        <div className="flex items-center justify-between gap-3">
          <FieldHint>{t('subcontractors:assign.descriptionHint')}</FieldHint>
          <Mono className="text-[9.5px] tracking-[0.06em] text-[#A69C8D] tabular-nums mt-[5px]">
            {t('subcontractors:notes.counter', { count: description.length, max: MAX_DESCRIPTION })}
          </Mono>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-[14px] mt-[14px]">
        <div>
          <FieldLabel htmlFor="assign-amount">{t('subcontractors:assign.amount')}</FieldLabel>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bt-mono text-[13px] text-[#8A8175]" aria-hidden="true">$</span>
            <input
              id="assign-amount"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className={cn(INPUT, 'pl-7 tabular-nums', errors.amount && INPUT_ERROR)}
            />
          </div>
          {errors.amount ? <FieldError>{errors.amount}</FieldError> : <FieldHint>{t('subcontractors:assign.amountHint')}</FieldHint>}
        </div>
        <div>
          <FieldLabel htmlFor="assign-due">{t('subcontractors:assign.dueDate')}</FieldLabel>
          <input id="assign-due" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={cn(INPUT, 'tabular-nums')} />
          <FieldHint>{t('subcontractors:assign.dueDateHint')}</FieldHint>
        </div>
      </div>

      {errors.server && <PaperNote tone="red" className="mt-4">{errors.server}</PaperNote>}
    </BtModal>
  );
}
