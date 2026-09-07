import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react';
import { cn } from '../ui/utils';
import { FIELD_LIMITS } from '../../../shared/fieldLimits';
import { changeToolStatus, type ToolResponse } from '../../services/warehouse';
import { BtModal } from '../bt/windows';
import { FOCUS_RING, PrimaryButton, SecondaryButton } from '../onboarding/chrome';
import { FieldHint, FieldLabel, INPUT, Mono, PaperNote } from '../projects/bt';
import { daysSince, isOut, pathsFrom, stampDay, statusName, StatusChip, WhoCan } from './bits';

/**
 * 07 — fix the status.
 *
 * Fixing is not dispatching: it is repairing what the counter recorded wrong,
 * or what happened outside the system — the lost one turned up, the harness is
 * repaired. That is why the reason is required and lands in the history with a
 * name and an hour.
 *
 * The window only draws the paths that exist from the current status, never a
 * list of six with three greyed out. And "Assigned" is in no list, because
 * assigning is a counter act with a person in front of you, not a change of
 * field.
 */

const MIN_REASON = 5;
const MAX_REASON = FIELD_LIMITS.NOTE;

export function FixStatusModal({ open, onOpenChange, tool, lang, keepers, onGoUsers, onFixed }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tool: ToolResponse | null;
  lang: string;
  /** The company's warehouse users: who can take this tool back. */
  keepers: { id: number; fullName?: string | null; username: string }[];
  /** Only used when there is no warehouse user to name. */
  onGoUsers?: () => void;
  onFixed: (tool: ToolResponse) => void;
}) {
  const { t } = useTranslation(['tools', 'common']);
  const [target, setTarget] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTarget(null);
    setReason('');
    setSaving(false);
    setFailed(false);
  }, [open, tool?.id]);

  if (!tool) return null;

  const blocked = isOut(tool.status);
  const options = pathsFrom(tool.status);
  const since = daysSince(tool.lastActivityAt);

  const submit = async () => {
    if (!target || reason.trim().length < MIN_REASON) return;
    setSaving(true);
    setFailed(false);
    try {
      onFixed(await changeToolStatus(tool.id, { newStatus: target, reason: reason.trim() }));
      onOpenChange(false);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <BtModal
      open={open}
      onOpenChange={onOpenChange}
      width={460}
      dismissible={false}
      closeDisabled={saving}
      kicker={t('tools:fixStatus.kicker', { code: tool.code, name: tool.name })}
      kickerTone={blocked ? 'red' : 'orange'}
      title={t('tools:fixStatus.title')}
      footer={
        blocked ? (
          <SecondaryButton onClick={() => onOpenChange(false)}>{t('common:buttons.close')}</SecondaryButton>
        ) : (
          <>
            <SecondaryButton onClick={() => onOpenChange(false)} disabled={saving}>{t('common:buttons.cancel')}</SecondaryButton>
            <PrimaryButton onClick={submit} disabled={saving || !target || reason.trim().length < MIN_REASON}>
              {saving ? t('tools:fixStatus.submitting') : t('tools:fixStatus.submit')}
            </PrimaryButton>
          </>
        )
      }
    >
      <div className="flex items-center justify-between gap-3 bg-[#FBF8F2] border border-[#EDE7DB] px-3.5 h-[42px]">
        <Mono className="text-[9.5px] font-semibold tracking-[0.12em] text-[#5A5346]">{t('tools:fixStatus.now')}</Mono>
        <div className="flex items-center gap-2.5">
          <StatusChip status={tool.status} />
          {blocked
            ? <Mono className="text-[9.5px] tracking-[0.08em] text-[#A69C8D] truncate max-w-[180px]">{tool.assignedTo ?? ''}</Mono>
            : since != null && <Mono className="text-[9.5px] tracking-[0.08em] text-[#A69C8D]">{t('tools:fixStatus.since', { date: stampDay(tool.lastActivityAt, lang), count: since })}</Mono>}
        </div>
      </div>

      {blocked ? (
        // Not "disabled": the window changes what it contains, says what has to
        // happen first, and hands over the way to get there.
        <>
          <PaperNote tone="red" className="mt-4">
            <div className="flex items-start gap-2.5">
              <Lock className="w-3.5 h-3.5 text-[#B3402A] flex-shrink-0 mt-[3px]" strokeWidth={2.2} />
              <div>
                <div className="font-semibold">{t('tools:fixStatus.blocked.title')}</div>
                <div className="mt-1.5">
                  {tool.assignedTo
                    ? t('tools:fixStatus.blocked.body', { name: tool.assignedTo })
                    : t('tools:fixStatus.blocked.bodyNobody')}
                </div>
              </div>
            </div>
          </PaperNote>
          <Mono className="block text-[9.5px] tracking-[0.08em] text-[#A69C8D] mt-3">{t('tools:fixStatus.blocked.alsoPending')}</Mono>
          <WhoCan keepers={keepers} onGoUsers={onGoUsers} className="mt-4 border-t border-[#EDE7DB] pt-4" />
        </>
      ) : (
        <>
          <fieldset className="mt-4">
            <legend className="font-bt-mono text-[9.5px] font-semibold uppercase tracking-[0.12em] text-[#5A5346] mb-2">
              {t('tools:fixStatus.changesTo')} <span className="text-[#F97316]">*</span>
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
                    name={`fix-${tool.id}`}
                    value={status}
                    checked={target === status}
                    onChange={() => setTarget(status)}
                    className={cn('mt-[3px] w-3 h-3 accent-[#F97316] flex-shrink-0', FOCUS_RING)}
                  />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-[#0B0A09]">{statusName(t, status)}</span>
                    <span className="block text-[12px] leading-[1.45] text-[#5A5346] mt-[2px]">{meaning(t, status)}</span>
                  </span>
                </label>
              ))}
            </div>
            <FieldHint>{t('tools:fixStatus.only', { status: statusName(t, tool.status).toLowerCase() })}</FieldHint>
          </fieldset>

          <div className="mt-4">
            <FieldLabel htmlFor={`fix-reason-${tool.id}`} required>{t('tools:fixStatus.reason')}</FieldLabel>
            <textarea
              id={`fix-reason-${tool.id}`}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder={t('tools:fixStatus.reason.placeholder')}
              maxLength={MAX_REASON}
              rows={2}
              className={cn(INPUT, 'h-[62px] resize-none py-2 leading-[1.5]')}
            />
            <div className="flex items-start justify-between gap-3">
              {/* Required by our decision, not by the API: the server accepts an
                  empty field. It is the only thing that tells a legitimate fix
                  from a quiet hand-balance of the inventory. */}
              <FieldHint>{t('tools:fixStatus.reason.hint')}</FieldHint>
              <Mono className="text-[9.5px] tracking-[0.04em] tabular-nums text-[#A69C8D] mt-[5px]">{reason.length} / {MAX_REASON}</Mono>
            </div>
          </div>

          {failed && <PaperNote tone="red" className="mt-3">{t('tools:fixStatus.err.server')}</PaperNote>}
        </>
      )}
    </BtModal>
  );
}

function meaning(t: (k: string) => string, status: string): string {
  return {
    'Available': t('tools:fixStatus.means.available'),
    'In Review': t('tools:fixStatus.means.inReview'),
    'Damaged': t('tools:fixStatus.means.damaged'),
    'Lost': t('tools:fixStatus.means.lost'),
  }[status] ?? '';
}
