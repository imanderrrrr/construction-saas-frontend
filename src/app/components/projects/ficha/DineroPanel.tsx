import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../ui/utils';
import { FOCUS_RING, SecondaryButton } from '../../onboarding/chrome';
import {
  getContractHistory, type ContractHistoryEntry,
  listChangeOrders, createChangeOrder, updateChangeOrder, deleteChangeOrder, type ChangeOrderEntry,
} from '../../../services/projects';
import { FIELD_LIMITS } from '../../../../shared/fieldLimits';
import type { Project } from '../types';
import { fmtUSD } from '../helpers';
import { Bone, CreateButton, FieldLabel, INPUT, INPUT_MONO, Mono, PaperNote, stampDate, stampDay } from '../bt';
import { Figure, Panel, SubHead } from './panel';

/**
 * Dinero — the money tab of the ficha (sheet 03B / 03H / 03G).
 *
 * Two strips and two columns: what the client side looks like today
 * (invoiced · collected · owed · spent), what was signed (original · revised ·
 * cost budget · balance), then the change orders that move the revised figure
 * and the ledger that shows how it got there.
 *
 * The change-order form stays visible on an incomplete project, disabled at
 * 75 % with the reason underneath: hiding it would hide what completing the
 * ficha unlocks. On a closed project there is no form at all.
 */

const HISTORY_GRID = 'grid grid-cols-[.8fr_1fr_.9fr_.9fr] gap-3 items-center';

export function DineroPanel({ project, closed, incomplete, lang }: {
  project: Project;
  closed: boolean;
  incomplete: boolean;
  lang: string;
}) {
  const { t } = useTranslation(['admin', 'common']);
  const hasContract = project.originalContractCents != null;

  const [history, setHistory] = useState<ContractHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  const [changeOrders, setChangeOrders] = useState<ChangeOrderEntry[]>([]);
  const [cosLoading, setCosLoading] = useState(false);
  const [cosError, setCosError] = useState(false);

  const [coNumber, setCoNumber] = useState('');
  const [coDesc, setCoDesc] = useState('');
  const [coAmount, setCoAmount] = useState('');
  const [coSign, setCoSign] = useState<'+' | '-'>('+');
  const [coSaving, setCoSaving] = useState(false);
  const [editingCoId, setEditingCoId] = useState<number | null>(null);

  const loadChangeOrders = useCallback(() => {
    setCosLoading(true);
    setCosError(false);
    listChangeOrders(project.id)
      .then(setChangeOrders)
      .catch(() => setCosError(true))
      .finally(() => setCosLoading(false));
  }, [project.id]);

  const loadHistory = useCallback(() => {
    setHistoryLoading(true);
    setHistoryError(false);
    getContractHistory(project.id)
      .then(setHistory)
      .catch(() => setHistoryError(true))
      .finally(() => setHistoryLoading(false));
  }, [project.id]);

  useEffect(() => {
    if (hasContract) {
      loadHistory();
      loadChangeOrders();
    }
  }, [hasContract, loadHistory, loadChangeOrders]);

  const resetCoForm = () => {
    setCoNumber('');
    setCoDesc('');
    setCoAmount('');
    setCoSign('+');
    setEditingCoId(null);
  };

  const startEditCO = (co: ChangeOrderEntry) => {
    setEditingCoId(co.id);
    setCoNumber(co.number ?? '');
    setCoDesc(co.description);
    setCoSign(co.amountCents < 0 ? '-' : '+');
    setCoAmount((Math.abs(co.amountCents) / 100).toString());
  };

  // Create (POST) or edit (PATCH). A positive amount may push the revised
  // contract above the original — there is intentionally no cap.
  const handleSubmitCO = async () => {
    const cents = Math.round(parseFloat(coAmount.replace(/[^0-9.]/g, '')) * 100);
    if (!coDesc.trim() || isNaN(cents) || cents <= 0) return;
    const signedCents = coSign === '+' ? cents : -cents;
    const number = coNumber.trim() || null;
    setCoSaving(true);
    try {
      if (editingCoId != null) {
        await updateChangeOrder(project.id, editingCoId, { description: coDesc.trim(), amountCents: signedCents, number });
        toast.success(t('admin:changeOrders.updated'));
      } else {
        await createChangeOrder(project.id, { description: coDesc.trim(), amountCents: signedCents, number });
        toast.success(t('admin:changeOrders.created'));
      }
      resetCoForm();
      loadChangeOrders();
      loadHistory();
    } catch {
      toast.error(editingCoId != null ? t('admin:changeOrders.updateFailed') : t('admin:changeOrders.createFailed'));
    } finally {
      setCoSaving(false);
    }
  };

  const handleDeleteCO = async (coId: number) => {
    try {
      await deleteChangeOrder(project.id, coId);
      loadChangeOrders();
      loadHistory();
      toast.success(t('admin:changeOrders.deleted'));
    } catch {
      toast.error(t('admin:changeOrders.deleteFailed'));
    }
  };

  const coTotal = changeOrders.reduce((s, co) => s + co.amountCents, 0);
  const revisedCents = hasContract ? (project.originalContractCents as number) + coTotal : null;
  const revisedMoved = revisedCents != null && revisedCents !== project.originalContractCents;
  const remaining = project.remainingBudgetCents;
  const consumed = project.totalConsumedCents ?? 0;

  const money = (cents: number | null) => (cents == null ? '—' : fmtUSD(cents));
  const compact = (cents: number) => {
    const sign = cents < 0 ? '-' : '';
    return sign + '$' + Math.round(Math.abs(cents) / 100).toLocaleString('en-US');
  };

  const historyType = (type: string) => {
    if (type === 'INITIAL_ASSIGNMENT') return t('admin:projectDetails.historyType.initial');
    if (type === 'CHANGE_ORDER') return t('admin:projectDetails.historyType.changeOrder');
    if (type === 'CHANGE_ORDER_REVERSED') return t('admin:projectDetails.historyType.changeOrderReversed');
    return t('admin:projectDetails.historyType.deduction');
  };

  const formLocked = !hasContract;
  const showForm = !closed;

  return (
    <Panel title={t('admin:projectFicha.tab.dinero')} purpose={t('admin:projectFicha.purpose.dinero')}>
      {/* Receivable side */}
      <div className="grid grid-cols-2 md:grid-cols-4 border border-[#E7E1D5]" data-tour="sec.projects-ficha-dinero.billing" data-testid="project-billing-card">
        <Figure value={compact(project.invoicedCents)} label={t('admin:projectDetails.billing.invoiced')} className="px-4 py-3.5 border-r border-[#E7E1D5] border-b md:border-b-0" />
        <Figure value={compact(project.collectedCents)} label={t('admin:projectDetails.billing.collected')} className="px-4 py-3.5 md:border-r border-[#E7E1D5] border-b md:border-b-0" />
        <Figure value={compact(project.outstandingCents)} label={t('admin:projectDetails.billing.outstanding')} tone={project.outstandingCents > 0 ? 'orange' : 'ink'} className="px-4 py-3.5 border-r border-[#E7E1D5]" />
        <Figure value={compact(consumed)} label={t('admin:projectDetails.billing.spent')} className="px-4 py-3.5" />
      </div>
      {project.invoicedCents === 0 && (
        <p className="text-[12.5px] text-[#8A8175] mt-2">{t('admin:projectDetails.billing.noDocuments')}</p>
      )}

      {/* Contract side */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-[#FAF7F0] border border-[#EDE7DB] px-4 py-3.5 mt-4" data-tour="sec.projects-ficha-dinero.contract">
        <div>
          <Mono className="block text-[9.5px] tracking-[0.12em] text-[#5A5346]">{t('admin:projectDetails.field.originalContract')}</Mono>
          <div className="font-bt-mono text-[14px] font-semibold text-[#0A0A0A] mt-1.5 tabular-nums">{money(project.originalContractCents)}</div>
        </div>
        <div>
          <Mono className="block text-[9.5px] tracking-[0.12em] text-[#5A5346]">{t('admin:projectDetails.field.revisedContract')}</Mono>
          <div className={cn('font-bt-mono text-[14px] font-semibold mt-1.5 tabular-nums', revisedMoved ? 'text-[#C2410C]' : 'text-[#0A0A0A]')}>{money(revisedCents)}</div>
        </div>
        <div>
          <Mono className="block text-[9.5px] tracking-[0.12em] text-[#5A5346]">{t('admin:projectDetails.field.costBudget')}</Mono>
          <div className="font-bt-mono text-[14px] font-semibold text-[#0A0A0A] mt-1.5 tabular-nums">
            {project.costBudgetCents != null ? fmtUSD(project.costBudgetCents) : <span className="font-sans italic font-normal text-[13px] text-[#A69C8D]">{t('admin:projectDetails.notSet')}</span>}
          </div>
        </div>
        <div>
          <Mono className="block text-[9.5px] tracking-[0.12em] text-[#5A5346]">{t('admin:projectFicha.dinero.balanceConsumed', { amount: compact(consumed) })}</Mono>
          <div className={cn('font-bt-mono text-[14px] font-semibold mt-1.5 tabular-nums', remaining != null && remaining < 0 ? 'text-[#B3402A]' : 'text-[#0A0A0A]')}>{money(remaining)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-6 mt-6">
        {/* Change orders */}
        <div>
          <SubHead>{t('admin:changeOrders.title')}</SubHead>
          {cosLoading && <div className="flex flex-col gap-2"><Bone className="h-10 w-full" /><Bone className="h-10 w-full" /></div>}
          {!cosLoading && cosError && (
            <PaperNote tone="red" className="flex items-center justify-between gap-3">
              <span className="text-[13px] text-[#0A0A0A]">{t('admin:changeOrders.loadError')}</span>
              <button type="button" onClick={loadChangeOrders} className={cn('font-bt-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-[#C2410C] hover:text-[#F97316]', FOCUS_RING)}>{t('common:buttons.retry')}</button>
            </PaperNote>
          )}
          {!cosLoading && !cosError && changeOrders.length === 0 && (
            <div className="py-3">
              <p className="text-[13.5px] font-semibold text-[#0A0A0A]">{t('admin:changeOrders.noOrders')}</p>
              <p className="text-[12.5px] text-[#8A8175] mt-0.5">{t('admin:projectFicha.dinero.noOrdersHint')}</p>
            </div>
          )}
          {!cosLoading && !cosError && changeOrders.length > 0 && (
            <ul className="flex flex-col">
              {changeOrders.map(co => (
                <li key={co.id} className={cn('flex items-start justify-between gap-3 py-2.5 border-b border-[#F0EBE1]', editingCoId === co.id && 'bg-[#FBEDE0] -mx-2 px-2')}>
                  <div className="min-w-0">
                    <p className="text-[13.5px] text-[#0A0A0A] truncate">
                      {co.number && <Mono className="text-[10.5px] font-semibold text-[#C2410C] mr-2">{co.number}</Mono>}
                      <span className="font-semibold">{co.description}</span>
                    </p>
                    <Mono className="block text-[9.5px] tracking-[0.1em] text-[#8A8175] mt-1">{stampDay(co.createdAt, lang)}{co.createdBy ? ` · ${co.createdBy}` : ''}</Mono>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className={cn('font-bt-mono text-[13px] font-semibold tabular-nums', co.amountCents < 0 ? 'text-[#B3402A]' : 'text-[#0A0A0A]')}>
                      {co.amountCents >= 0 ? '+' : '−'}{fmtUSD(Math.abs(co.amountCents))}
                    </span>
                    {!closed && (
                      <>
                        <button type="button" onClick={() => startEditCO(co)} title={t('common:buttons.edit')} aria-label={t('common:buttons.edit')} className={cn('w-7 h-7 flex items-center justify-center text-[#8A8175] hover:text-[#C2410C]', FOCUS_RING)}>
                          <Pencil className="w-3.5 h-3.5" strokeWidth={2} />
                        </button>
                        <button type="button" onClick={() => void handleDeleteCO(co.id)} title={t('common:buttons.delete')} aria-label={t('common:buttons.delete')} className={cn('w-7 h-7 flex items-center justify-center text-[#8A8175] hover:text-[#B3402A]', FOCUS_RING)}>
                          <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                        </button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {showForm && (
            <div className="mt-4 pt-4 border-t border-[#E7E1D5]" data-tour="sec.projects-ficha-dinero.co-form">
              <fieldset disabled={formLocked || coSaving} className={cn('min-w-0', formLocked && 'opacity-75')}>
                <legend className="sr-only">{editingCoId != null ? t('admin:changeOrders.editTitle') : t('admin:changeOrders.addTitle')}</legend>
                <div className="flex flex-wrap gap-3">
                  <div className="w-full sm:w-[160px]">
                    <FieldLabel htmlFor="co-number">{t('admin:changeOrders.number')}</FieldLabel>
                    <input id="co-number" value={coNumber} onChange={e => setCoNumber(e.target.value)} placeholder={t('admin:changeOrders.numberPlaceholder')} maxLength={50}
                      className={cn(INPUT, INPUT_MONO, 'h-[34px] py-0 uppercase')} />
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <FieldLabel htmlFor="co-desc">{t('admin:changeOrders.description')}</FieldLabel>
                    <input id="co-desc" value={coDesc} onChange={e => setCoDesc(e.target.value)} placeholder={t('admin:changeOrders.descriptionPlaceholder')} maxLength={FIELD_LIMITS.NOTE}
                      className={cn(INPUT, 'h-[34px] py-0')} />
                  </div>
                </div>
                <div className="flex flex-wrap items-end gap-3 mt-3">
                  <div className="w-full sm:w-[180px]">
                    <FieldLabel htmlFor="co-amount">{t('admin:changeOrders.amount')}</FieldLabel>
                    <div className="flex">
                      <span className="w-8 h-[34px] flex items-center justify-center border border-r-0 border-[#DBD0BB] bg-[#FAF7F0] font-bt-mono text-[12px] text-[#5A5346]">$</span>
                      <input id="co-amount" value={coAmount} onChange={e => setCoAmount(e.target.value)} placeholder={t('admin:changeOrders.amountPlaceholder')} inputMode="decimal"
                        className={cn(INPUT, INPUT_MONO, 'h-[34px] py-0 text-right')} />
                    </div>
                  </div>
                  <div className="flex" role="group" aria-label={t('admin:changeOrders.amount')}>
                    {(['+', '-'] as const).map(sign => (
                      <button
                        key={sign}
                        type="button"
                        aria-pressed={coSign === sign}
                        onClick={() => setCoSign(sign)}
                        className={cn(
                          'h-[34px] px-3 border border-[#DBD0BB] -ml-px first:ml-0 font-bt-mono text-[10px] font-semibold uppercase tracking-[0.1em] transition-colors',
                          coSign === sign ? 'bg-[#0A0A0A] text-[#F5F1E8] border-[#0A0A0A] relative z-[1]' : 'bg-white text-[#5A5346] hover:text-[#0A0A0A]',
                          FOCUS_RING,
                        )}
                      >
                        {sign === '+' ? t('admin:changeOrders.increase') : t('admin:changeOrders.decrease')}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2.5 ml-auto">
                    {editingCoId != null && (
                      <SecondaryButton onClick={resetCoForm} className="h-[34px] px-3 py-0 text-[10px]">{t('common:buttons.cancel')}</SecondaryButton>
                    )}
                    <CreateButton onClick={() => void handleSubmitCO()} disabled={!coDesc.trim() || !coAmount.trim()} className="h-[34px] px-3.5 py-0 text-[10px]">
                      {coSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                      {coSaving
                        ? (editingCoId != null ? t('admin:changeOrders.updating') : t('admin:changeOrders.saving'))
                        : (editingCoId != null ? t('admin:changeOrders.update') : t('admin:changeOrders.save'))}
                    </CreateButton>
                  </div>
                </div>
              </fieldset>
              {formLocked && (
                <Mono className="block text-[9.5px] font-semibold tracking-[0.1em] text-[#C2410C] mt-2.5">{t('admin:projectFicha.dinero.coLocked')}</Mono>
              )}
            </div>
          )}
        </div>

        {/* Contract history */}
        <div data-tour="sec.projects-ficha-dinero.history">
          <SubHead>{t('admin:projectDetails.contractHistory')}</SubHead>
          {historyLoading && <div className="flex flex-col gap-2"><Bone className="h-8 w-full" /><Bone className="h-8 w-full" /><Bone className="h-8 w-full" /></div>}
          {!historyLoading && historyError && (
            <PaperNote tone="red" className="flex items-center justify-between gap-3">
              <span className="text-[13px] text-[#0A0A0A]">{t('admin:projectDetails.historyError')}</span>
              <button type="button" onClick={loadHistory} className={cn('font-bt-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-[#C2410C] hover:text-[#F97316]', FOCUS_RING)}>{t('common:buttons.retry')}</button>
            </PaperNote>
          )}
          {!historyLoading && !historyError && history.length === 0 && (
            <div className="py-3">
              <p className="text-[13.5px] font-semibold text-[#0A0A0A]">{t('admin:projectDetails.noHistory')}</p>
              <p className="text-[12.5px] text-[#8A8175] mt-0.5">{t('admin:projectDetails.noHistoryHint')}</p>
            </div>
          )}
          {!historyLoading && !historyError && history.length > 0 && (
            <div className="overflow-x-auto">
              <div className="min-w-[380px]">
                <div className={cn(HISTORY_GRID, 'bg-[#FBF8F2] border-y border-[#E7E1D5] px-2.5 py-2')}>
                  {[t('admin:projectDetails.historyTable.date'), t('admin:projectDetails.historyTable.type'), t('admin:projectDetails.historyTable.amount'), t('admin:projectDetails.historyTable.balance')].map((h, i) => (
                    <Mono key={h} className={cn('text-[9.5px] tracking-[0.13em] text-[#8A8175]', i >= 2 && 'text-right')}>{h}</Mono>
                  ))}
                </div>
                {history.map(entry => (
                  <div key={entry.id} className={cn(HISTORY_GRID, 'px-2.5 py-2.5 border-b border-[#F0EBE1]')} title={entry.description || undefined}>
                    <Mono className="text-[10px] tracking-[0.06em] text-[#8A8175]">{stampDate(entry.createdAt, lang)}</Mono>
                    <span className="text-[12.5px] text-[#0A0A0A] truncate">{historyType(entry.changeType)}</span>
                    <span className={cn('font-bt-mono text-[11.5px] font-semibold text-right tabular-nums', entry.amountCents < 0 ? 'text-[#B3402A]' : 'text-[#0A0A0A]')}>
                      {entry.amountCents >= 0 ? '+' : '−'}{fmtUSD(Math.abs(entry.amountCents))}
                    </span>
                    <span className={cn('font-bt-mono text-[11.5px] text-right tabular-nums', entry.balanceAfterCents < 0 ? 'text-[#B3402A] font-semibold' : 'text-[#0A0A0A]')}>
                      {fmtUSD(entry.balanceAfterCents)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <Mono className="block text-[9.5px] tracking-[0.12em] text-[#8A8175] mt-5">{t('admin:projectFicha.dinero.footnote')}</Mono>
      {incomplete && !hasContract && <span className="sr-only">{t('admin:projectFicha.dinero.coLocked')}</span>}
    </Panel>
  );
}
