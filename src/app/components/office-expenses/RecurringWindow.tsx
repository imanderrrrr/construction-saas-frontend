import { useTranslation } from 'react-i18next';
import { BtModal } from '../bt/windows';
import { Mono } from '../projects/bt';
import { Amount } from '../budgets/ui';
import { PrimaryButton, SecondaryButton } from '../onboarding/chrome';
import type { OfficeExpenseSummary } from '../../services/officeExpenses';
import { Absent, bigMoney, monthTitle } from './bits';

/**
 * Los fijos del mes: lo que se repite y **lo que falta registrar**.
 *
 * Es la función que el recorrido guiado ya prometía —«Registra recurrentes para
 * no perderlos de vista»— sin que existiera: no había marcador, ni aviso, ni
 * campo en el modelo.
 *
 * Lo previsto de cada fijo sale de **su último registro**, no de un
 * presupuesto: es lo único que el sistema sabe de verdad. Y nada se registra
 * solo — el sistema avisa, la persona registra, porque un gasto que se crea
 * solo es un gasto que nadie revisó.
 */
export function RecurringWindow({ open, month, summary, onClose, onRegister }: {
  open: boolean;
  month: string;
  summary: OfficeExpenseSummary;
  onClose: () => void;
  onRegister: (item: OfficeExpenseSummary['recurringMissing'][number]) => void;
}) {
  const { t, i18n } = useTranslation('admin');
  const lang = i18n.resolvedLanguage ?? 'es';
  const missing = summary.recurringMissing;
  const settled = summary.recurringSettledCount;
  const total = settled + missing.length;

  return (
    <BtModal
      open={open}
      onOpenChange={o => { if (!o) onClose(); }}
      width={560}
      kicker={t('officeExpenses.title')}
      title={t('officeExpenses.recurring.windowTitle', { month: monthTitle(month, lang) })}
      footer={
        <div className="flex items-center justify-end">
          <SecondaryButton onClick={onClose}>{t('officeExpenses.categories.done')}</SecondaryButton>
        </div>
      }
    >
      <div className="space-y-4">
        <Mono className="block text-[10px] tracking-[0.1em] text-[#5A5346]">
          {t('officeExpenses.recurring.headcount', { settled, missing: missing.length })}
        </Mono>

        {total === 0 ? (
          <p className="text-[13px] leading-[1.6] text-[#5A5346]">{t('officeExpenses.recurring.none')}</p>
        ) : (
          <>
            {missing.length > 0 && (
              <div className="border border-[#F97316] bg-[#FBEDE0] px-3.5 py-3">
                <p className="text-[12.5px] leading-[1.55] text-[#0A0A0A]">
                  {t('officeExpenses.recurring.missingLead', {
                    count: missing.length,
                    names: missing.map(m => m.description).join(', '),
                  })}
                </p>
              </div>
            )}

            <div className="border border-[#E7E1D5]">
              <div className="grid grid-cols-[1.5fr_0.9fr_92px_64px_auto] gap-2.5 px-3 py-2 bg-[#FBF8F2] border-b border-[#E7E1D5]">
                <Mono className="text-[9px] tracking-[0.1em] text-[#8A8175]">{t('officeExpenses.recurring.fixed')}</Mono>
                <Mono className="text-[9px] tracking-[0.1em] text-[#8A8175]">{t('officeExpenses.form.category')}</Mono>
                <Mono className="text-[9px] tracking-[0.1em] text-[#8A8175] text-right">{t('officeExpenses.recurring.lastAmount')}</Mono>
                <Mono className="text-[9px] tracking-[0.1em] text-[#8A8175] text-right">{t('officeExpenses.recurring.paidOn')}</Mono>
                <span />
              </div>

              {missing.map(item => (
                <div
                  key={item.templateId}
                  className="grid grid-cols-[1.5fr_0.9fr_92px_64px_auto] gap-2.5 items-baseline px-3 py-2.5 border-b border-[#F0EBE1] last:border-b-0"
                >
                  <span className="text-[12.5px] text-[#0A0A0A] truncate">{item.description}</span>
                  <span className="text-[11.5px] text-[#5A5346] truncate">
                    {item.categoryName ?? <Absent>{t('officeExpenses.byCategory.uncategorised')}</Absent>}
                  </span>
                  <Amount>{bigMoney(item.lastAmountCents)}</Amount>
                  <Mono className="text-[10px] text-[#5A5346] tabular-nums text-right">
                    {item.recurringDay != null ? t('officeExpenses.recurring.day', { day: item.recurringDay }) : '—'}
                  </Mono>
                  <div className="flex items-center gap-2 justify-end">
                    <Mono className="text-[9px] tracking-[0.1em] text-[#C2410C]">
                      {t('officeExpenses.recurring.missing')}
                    </Mono>
                    <PrimaryButton onClick={() => onRegister(item)}>
                      {t('officeExpenses.recurring.register')}
                    </PrimaryButton>
                  </div>
                </div>
              ))}

              {settled > 0 && (
                <div className="px-3 py-2.5 bg-[#FBF8F2] border-t border-[#E7E1D5]">
                  <Mono className="text-[9.5px] tracking-[0.1em] text-[#2E7D4F]">
                    {t('officeExpenses.recurring.settled', { count: settled })}
                  </Mono>
                </div>
              )}
            </div>

            <div className="border-t border-[#E7E1D5] pt-3">
              <Mono className="block text-[9.5px] tracking-[0.1em] text-[#5A5346]">
                {t('officeExpenses.recurring.progress', {
                  registered: bigMoney(summary.monthCents),
                  expected: bigMoney(summary.recurringExpectedCents),
                })}
              </Mono>
              <p className="text-[11.5px] leading-[1.55] text-[#A69C8D] mt-1.5">
                {t('officeExpenses.recurring.expectedHint')}
              </p>
            </div>
          </>
        )}
      </div>
    </BtModal>
  );
}
