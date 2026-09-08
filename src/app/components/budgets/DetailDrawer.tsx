import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../ui/utils';
import { listAllPayables, type Payable } from '../../services/finance';
import { BtDrawer } from '../bt/windows';
import { PrimaryButton, SecondaryButton } from '../onboarding/chrome';
import { Mono, stampDay } from '../projects/bt';
import {
  execPct, money, pct as fmtPct, sharePct, type BudgetRow, type ConsumptionSplit,
} from './bits';
import { Gauge } from './ui';

/**
 * El detalle de la obra (Claude Design "Presupuestos BuildTrack", board 04).
 *
 * The four numbers together, each with its name and where it came from, and
 * the question no screen answered: is this jobsite making money? The margin —
 * contract minus spend — is not in the system; the owner saw a percentage
 * against the cost, finance saw another against the contract, and the
 * dashboard printed the cost budget under the label "CONTRATO".
 *
 * There is no spending-pace card. The one the sheet draws needs
 * `GET /budgets/consumption-breakdown`, which does not exist; the "estimated
 * days remaining" it replaces extrapolated from the day the jobsite was
 * created with a floor of one day, so two jobsites created five minutes
 * earlier read "2 days" and "4 days" in red. Nothing is better than that.
 */
export function DetailDrawer({ row, open, onOpenChange, split, splitLoading, readOnly, onAdjust, onHistory, onClose }: {
  row: BudgetRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  split: ConsumptionSplit | null;
  splitLoading: boolean;
  readOnly: boolean;
  onAdjust: () => void;
  onHistory: () => void;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation(['admin', 'common']);
  const lang = i18n.language;
  const [bills, setBills] = useState<Payable[] | null>(null);
  const [billsFailed, setBillsFailed] = useState(false);
  const projectId = row?.id ?? null;

  useEffect(() => {
    if (projectId == null || !open) return;
    let cancelled = false;
    setBills(null);
    setBillsFailed(false);
    // Scoped server-side: a browser-side filter over one page silently drops
    // this jobsite's older bills once the tenant outgrows a page.
    listAllPayables({ projectId })
      .then(list => { if (!cancelled) setBills(list); })
      .catch(() => { if (!cancelled) setBillsFailed(true); });
    return () => { cancelled = true; };
  }, [projectId, open]);

  if (!row) return null;
  const fallback = row.costBudget == null;

  return (
    <BtDrawer
      open={open}
      onOpenChange={onOpenChange}
      kicker={[row.clientName, row.costCode].filter(Boolean).join(' · ') || t('admin:budgets.detail.noClient')}
      title={row.name}
      footer={
        <>
          <SecondaryButton onClick={onHistory}>{t('admin:budgets.menu.history')}</SecondaryButton>
          {!readOnly && !row.closed && (
            <>
              <SecondaryButton onClick={onClose} className="text-[#B3402A] border-[#B3402A] hover:bg-[#B3402A] hover:text-white">
                {t('admin:budgets.menu.close')}
              </SecondaryButton>
              <PrimaryButton onClick={onAdjust}>{t('admin:budgets.menu.adjustShort')}</PrimaryButton>
            </>
          )}
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <Figure
            label={t('admin:budgets.metric.contract')}
            value={money(row.contract)}
            origin={t('admin:budgets.detail.contractOrigin', {
              original: money(row.originalContract),
              orders: money(row.changeOrders),
            })}
          />
          <Figure
            label={t('admin:budgets.metric.costBudget')}
            value={row.costBudget == null ? t('admin:budgets.noCostBudget') : money(row.costBudget)}
            origin={row.costBudget == null ? t('admin:budgets.detail.noCostBudgetOrigin') : undefined}
          />
          <Figure
            label={t('admin:budgets.metric.spent')}
            value={money(row.consumed)}
            origin={t('admin:budgets.detail.spentOrigin')}
          />
          <Figure
            label={t('admin:budgets.metric.margin')}
            value={money(row.margin)}
            tone={row.margin < 0 ? 'red' : 'green'}
            origin={t('admin:budgets.detail.marginOrigin', {
              pct: `${fmtPct(row.contract > 0 ? (row.margin / row.contract) * 100 : 0, lang)} %`,
            })}
          />
        </div>

        <section>
          <Mono className="block text-[9.5px] font-semibold tracking-[0.13em] text-[#8A8175] mb-2">
            {t('admin:budgets.detail.gauge')}
          </Mono>
          <Gauge
            pctValue={execPct(row)}
            fallback={fallback}
            lang={lang}
            note={
              <Mono className="text-[9.5px] tracking-[0.06em] text-[#5A5346]">
                {row.base - row.consumed >= 0
                  ? t('admin:budgets.detail.left', { amount: money(row.base - row.consumed) })
                  : t('admin:budgets.detail.over', { amount: money(row.consumed - row.base) })}
              </Mono>
            }
          />
        </section>

        <section>
          <Mono className="block text-[9.5px] font-semibold tracking-[0.13em] text-[#8A8175] mb-2">
            {t('admin:budgets.detail.sources')}
          </Mono>
          {splitLoading || !split ? (
            <div className="space-y-2" aria-hidden="true">
              <div className="bt-skeleton h-3" />
              <div className="bt-skeleton h-3" />
              <div className="bt-skeleton h-3" />
            </div>
          ) : (
            <div className="space-y-2">
              <SourceBar label={t('admin:budgets.source.payroll')} amount={split.payroll} share={sharePct(split.payroll, row.consumed)} lang={lang} imputed={split.payrollImputed} color="bg-[#0B0A09]" />
              <SourceBar label={t('admin:budgets.source.suppliers')} amount={split.suppliers} share={sharePct(split.suppliers, row.consumed)} lang={lang} imputed color="bg-[#F97316]" />
              <SourceBar label={t('admin:budgets.source.expenses')} amount={split.expenses} share={sharePct(split.expenses, row.consumed)} lang={lang} imputed color="bg-[#B4A992]" />
            </div>
          )}
          {/* Provisional, and it says so on the screen as well as in the code:
              payroll is the residual until consumption-breakdown exists. */}
          <Mono className="block text-[9px] tracking-[0.06em] text-[#A69C8D] mt-2 leading-[1.5]">
            {t('admin:budgets.source.provisional')}
          </Mono>
        </section>

        <section>
          <Mono className="block text-[9.5px] font-semibold tracking-[0.13em] text-[#8A8175] mb-2">
            {t('admin:budgets.detail.bills')}
          </Mono>
          {billsFailed ? (
            <p className="text-[12.5px] text-[#8A8175]">{t('admin:budgets.detail.billsFailed')}</p>
          ) : bills == null ? (
            <div className="space-y-2" aria-hidden="true"><div className="bt-skeleton h-3" /><div className="bt-skeleton h-3" /></div>
          ) : bills.length === 0 ? (
            <p className="text-[12.5px] text-[#8A8175]">{t('admin:budgets.detail.noBills')}</p>
          ) : (
            <div className="border border-[#E7E1D5]">
              {bills.slice(0, 8).map(bill => (
                <div key={bill.id} className="flex items-center justify-between gap-3 px-3 py-2.5 border-b border-[#F0EBE1] last:border-b-0">
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-[#0B0A09] truncate">{bill.vendor}</div>
                    <Mono className="block text-[9.5px] tracking-[0.04em] text-[#A69C8D] mt-0.5 normal-case">
                      {/* stampDay, not stampDate: `receivedDate` is a bare
                          business date, and a UTC parse of one renders the day
                          before in a UTC-6 tenant. */}
                      {bill.billNumber} · {stampDay(bill.receivedDate, lang)}
                    </Mono>
                  </div>
                  <div className="flex items-center gap-2.5 flex-shrink-0">
                    <Mono className="text-[12px] tabular-nums text-[#0B0A09] normal-case">{money(bill.amount)}</Mono>
                    <BillStatus status={bill.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </BtDrawer>
  );
}

function Figure({ label, value, origin, tone }: { label: string; value: string; origin?: string; tone?: 'green' | 'red' }) {
  return (
    <div>
      <Mono className="block text-[9px] tracking-[0.1em] text-[#8A8175]">{label}</Mono>
      <div
        className={cn(
          'font-bt-display font-extrabold text-[28px] leading-[0.9] tabular-nums mt-1',
          tone === 'green' && 'text-[#2E7D4F]',
          tone === 'red' && 'text-[#B3402A]',
          !tone && 'text-[#0B0A09]',
        )}
      >
        {value}
      </div>
      {origin && <Mono className="block text-[9px] tracking-[0.06em] text-[#A69C8D] mt-1 leading-[1.45]">{origin}</Mono>}
    </div>
  );
}

function SourceBar({ label, amount, share, lang, imputed, color }: {
  label: string; amount: number; share: number; lang: string; imputed: boolean; color: string;
}) {
  const { t } = useTranslation('admin');
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <Mono className="text-[9.5px] tracking-[0.08em] text-[#5A5346]">{label}</Mono>
        <div className="flex items-baseline gap-2.5">
          <Mono className="text-[12px] tabular-nums text-[#0B0A09] normal-case">{money(amount)}</Mono>
          <Mono className={cn('text-[10px] tracking-[0.06em] w-[76px] text-right', imputed ? 'text-[#5A5346]' : 'text-[#A69C8D]')}>
            {imputed ? `${fmtPct(share, lang)} %` : t('budgets.source.unimputed')}
          </Mono>
        </div>
      </div>
      <div className="h-[7px] mt-1 flex bg-[#F3EEE4] border border-[#EDE7DB]">
        <div className={color} style={{ width: `${Math.min(share, 100)}%` }} />
      </div>
    </div>
  );
}

/** Translated, always: the status used to reach the screen as raw `paid`. */
function BillStatus({ status }: { status: string }) {
  const { t } = useTranslation('common');
  const key = status.toLowerCase();
  const known = ['paid', 'pending', 'partial', 'overdue'].includes(key);
  return (
    <Mono
      className={cn(
        'text-[9px] tracking-[0.1em] px-1.5 py-[3px] border whitespace-nowrap',
        key === 'paid' && 'border-[#2E7D4F] text-[#2E7D4F]',
        key === 'overdue' && 'border-[#B3402A] text-[#B3402A]',
        key !== 'paid' && key !== 'overdue' && 'border-[#DBD0BB] text-[#5A5346]',
      )}
    >
      {known ? t(`status.${key}`) : status}
    </Mono>
  );
}
