import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { updateProject } from '../../services/projects';
import { BtModal } from '../bt/windows';
import { DestroyButton, SecondaryButton } from '../onboarding/chrome';
import { Mono } from '../projects/bt';
import { adjustError } from './AdjustWindow';
import { execPct, money, pct as fmtPct, type BudgetRow } from './bits';

/**
 * Cerrar la obra (Claude Design "Presupuestos BuildTrack", board 06).
 *
 * Closing stays on this screen — it is a financial decision and it is taken
 * looking at these numbers — while deleting the project moves back to
 * Proyectos, where it is created and where the type-the-name challenge lives.
 * Two clicks apart inside a money card was the wrong place for it.
 *
 * No reason field, for the same reason the adjust window has none: `status`
 * is the only thing `UpdateProjectRequest` takes, so ten mandatory characters
 * would be collected, promised to the history and dropped. Author and reason
 * on `contract_history` are a backend row, not something a form can fake.
 */
export function CloseWindow({ row, open, onOpenChange, onClosed }: {
  row: BudgetRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClosed: () => void;
}) {
  const { t, i18n } = useTranslation(['admin', 'common']);
  const [saving, setSaving] = useState(false);
  if (!row) return null;

  async function confirm() {
    if (!row) return;
    setSaving(true);
    try {
      await updateProject(row.id, { status: 'CLOSED' });
      onOpenChange(false);
      onClosed();
    } catch (err) {
      toast.error(adjustError(t, err));
    } finally {
      setSaving(false);
    }
  }

  const measured = row.costBudget ?? row.contract;
  return (
    <BtModal
      open={open}
      onOpenChange={o => { if (!o) onOpenChange(false); }}
      width={440}
      kickerTone="red"
      kicker={t('admin:budgets.close.kicker')}
      title={t('admin:budgets.close.title', { project: row.name })}
      description={t('admin:budgets.close.body')}
      closeDisabled={saving}
      footer={
        <>
          <SecondaryButton onClick={() => onOpenChange(false)} disabled={saving}>{t('common:buttons.cancel')}</SecondaryButton>
          <DestroyButton onClick={confirm} disabled={saving}>
            {saving ? t('admin:budgets.close.saving') : t('admin:budgets.close.confirm')}
          </DestroyButton>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3 border border-[#E7E1D5] bg-[#FBF8F2] px-3.5 py-3">
        <div>
          <Mono className="block text-[12.5px] font-semibold text-[#0B0A09] tabular-nums normal-case">
            {money(row.consumed)} / {money(measured)}
          </Mono>
          <Mono className="block text-[8.5px] tracking-[0.08em] text-[#A69C8D] mt-1">
            {t(row.costBudget == null ? 'admin:budgets.close.spentOfContract' : 'admin:budgets.close.spentOfCost', {
              pct: `${fmtPct(execPct(row), i18n.language)} %`,
            })}
          </Mono>
        </div>
        <div>
          <Mono className={`block text-[12.5px] font-semibold tabular-nums normal-case ${row.margin < 0 ? 'text-[#B3402A]' : 'text-[#2E7D4F]'}`}>
            {money(row.margin)}
          </Mono>
          <Mono className="block text-[8.5px] tracking-[0.08em] text-[#A69C8D] mt-1">{t('admin:budgets.close.marginAtClose')}</Mono>
        </div>
      </div>
    </BtModal>
  );
}
