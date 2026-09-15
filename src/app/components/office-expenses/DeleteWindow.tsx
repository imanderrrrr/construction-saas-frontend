import { useTranslation } from 'react-i18next';
import { BtModal } from '../bt/windows';
import { Mono, PaperNote } from '../projects/bt';
import { DestroyButton, SecondaryButton } from '../onboarding/chrome';
import type { OfficeExpense } from '../../services/officeExpenses';
import { bigMoney, shortDate } from './bits';

/**
 * Dar de baja un gasto.
 *
 * La ventana anterior decía «¿Eliminar este gasto? Esta acción no se puede
 * deshacer.» — sin el nombre, sin el monto, y describiendo un borrado físico
 * que además no dejaba ningún rastro. Ahora **nombra el gasto y su monto**,
 * dice en cuánto queda el mes sin él, y dice la verdad de lo que pasa: el
 * gasto sale de la lista y de los totales, y la fila queda para auditoría con
 * quién la dio de baja.
 */
export function DeleteWindow({ open, expense, monthCents, busy, error, onClose, onConfirm }: {
  open: boolean;
  expense: OfficeExpense;
  /** El total del mes ANTES de la baja, para poder decir en cuánto queda. */
  monthCents: number;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t, i18n } = useTranslation('admin');
  const lang = i18n.resolvedLanguage ?? 'es';

  return (
    <BtModal
      open={open}
      onOpenChange={o => { if (!o && !busy) onClose(); }}
      width={440}
      closeDisabled={busy}
      kickerTone="red"
      kicker={t('officeExpenses.delete.kicker')}
      title={t('officeExpenses.delete.title')}
      footer={
        <div className="flex items-center justify-end gap-2.5">
          <SecondaryButton onClick={onClose} disabled={busy}>{t('officeExpenses.form.cancel')}</SecondaryButton>
          <DestroyButton onClick={onConfirm} disabled={busy}>
            {busy ? t('officeExpenses.delete.working') : t('officeExpenses.delete.confirm')}
          </DestroyButton>
        </div>
      }
    >
      <div className="space-y-3.5">
        <div className="border border-[#E7E1D5] bg-[#FBF8F2] px-3.5 py-3">
          <p className="text-[13.5px] leading-[1.45] text-[#0A0A0A]">{expense.description}</p>
          <Mono className="block text-[9.5px] tracking-[0.08em] text-[#8A8175] mt-1">
            {[expense.categoryName, shortDate(expense.purchaseDate, lang)].filter(Boolean).join(' · ')}
          </Mono>
          <span className="block font-bt-display font-extrabold text-[30px] leading-none tabular-nums text-[#0A0A0A] mt-2">
            {bigMoney(expense.amountCents)}
          </span>
        </div>

        <p className="text-[12.5px] leading-[1.55] text-[#5A5346]">
          {t('officeExpenses.delete.body', {
            amount: bigMoney(Math.max(monthCents - expense.amountCents, 0)),
          })}
        </p>

        <PaperNote tone="none">{t('officeExpenses.delete.trail')}</PaperNote>

        {expense.receipt && (
          <Mono className="block text-[9px] tracking-[0.08em] text-[#A69C8D]">
            {t('officeExpenses.delete.receiptKept')}
          </Mono>
        )}

        {error && (
          <div className="bg-white border border-[#E7E1D5] border-l-[3px] border-l-[#B3402A] px-3.5 py-2.5">
            <p className="text-[12.5px] text-[#B3402A]">{error}</p>
          </div>
        )}
      </div>
    </BtModal>
  );
}
