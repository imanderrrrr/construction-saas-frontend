import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import { ApiError } from '../../lib/api';
import { updateProject, type UpdateProjectPayload } from '../../services/projects';
import { BtModal } from '../bt/windows';
import { PrimaryButton, SecondaryButton } from '../onboarding/chrome';
import { Mono, PaperNote } from '../projects/bt';
import { execPct, money, pct as fmtPct, type BudgetRow } from './bits';

/**
 * Ajustar presupuesto (Claude Design "Presupuestos BuildTrack", board 05).
 *
 * The window this replaces corrupted the figure it was given. It sent
 * `nuevoTotal − consumido` as `contractAmountCents`, and the backend reads
 * that field as the new ORIGINAL CONTRACT: typing $200,000 on a jobsite with
 * $25,000 spent saved $175,000, showed a success toast, and said nothing. On a
 * jobsite that had a cost budget it was worse — it moved the contract while
 * drawing the cost budget, so the owner's screen and his accountant's stopped
 * agreeing about what had been changed.
 *
 * Three rules, from the sheet:
 *
 *  1. The amount typed is the amount sent. Two fields, two destinations: the
 *     cost budget to `costBudgetCents`, the contract to its own book.
 *  2. Each field shows its consequence before saving, with the figure already
 *     worked out — the new execution percentage, or the new revised contract.
 *  3. The reason is not asked for. `UpdateProjectRequest` has no column for
 *     one, so today's window demands ten characters, promises they are stored
 *     "with author, date and reason", and throws them away. Data that is not
 *     kept is not collected.
 *
 * A cost budget below what has already been spent is allowed, with a warning:
 * a jobsite at 138 % is a fact about the jobsite, not a validation error.
 */

/** "12,000.00" — what the field shows for a stored amount. */
function toField(value: number | null): string {
  if (value == null) return '';
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** What the field means. `undefined` when it is blank or unreadable. */
export function parseField(text: string): number | undefined {
  const cleaned = text.replace(/[^0-9.]/g, '');
  if (!cleaned) return undefined;
  const value = parseFloat(cleaned);
  return isNaN(value) || value < 0 ? undefined : value;
}

const toCents = (value: number) => Math.round(value * 100);

function MoneyField({ id, value, onChange, accent }: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  accent?: boolean;
}) {
  return (
    <div className={cn('flex h-10 border bg-white focus-within:border-[#F97316]', accent ? 'border-[#F97316]' : 'border-[#DBD0BB]')}>
      <span className="w-8 flex items-center justify-center bg-[#F3EEE4] border-r border-[#DBD0BB] font-bt-mono text-[13px] text-[#5A5346]">$</span>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        value={value}
        onChange={e => onChange(e.target.value.replace(/[^0-9.,]/g, ''))}
        className="flex-1 min-w-0 border-0 bg-transparent px-3 outline-none font-bt-mono text-[14px] tracking-[0.02em] text-[#0B0A09]"
      />
    </div>
  );
}

function FieldHead({ label, chip, chipTone }: { label: string; chip: string; chipTone: 'quiet' | 'orange' }) {
  return (
    <div className="flex items-baseline justify-between gap-2.5 mb-1.5 flex-wrap">
      <Mono className="text-[9.5px] font-semibold tracking-[0.13em] text-[#8A8175]">{label}</Mono>
      <Mono
        className={cn(
          'text-[9px] tracking-[0.1em] px-[7px] py-[3px]',
          chipTone === 'orange' ? 'bg-[#FBEDE0] border border-[#F97316] text-[#C2410C]' : 'bg-[#F3EEE4] text-[#5A5346]',
        )}
      >
        {chip}
      </Mono>
    </div>
  );
}

function Snapshot({ label, value, tone }: { label: string; value: string; tone?: 'green' | 'red' }) {
  return (
    <div>
      <Mono
        className={cn(
          'block text-[12.5px] font-semibold tabular-nums normal-case',
          tone === 'green' && 'text-[#2E7D4F]',
          tone === 'red' && 'text-[#B3402A]',
          !tone && 'text-[#0B0A09]',
        )}
      >
        {value}
      </Mono>
      <Mono className="block text-[8.5px] tracking-[0.08em] text-[#A69C8D] mt-0.5">{label}</Mono>
    </div>
  );
}

export function AdjustWindow({ row, open, onOpenChange, onSaved }: {
  row: BudgetRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const { t, i18n } = useTranslation(['admin', 'common']);
  const lang = i18n.language;
  const [costBudget, setCostBudget] = useState('');
  const [contract, setContract] = useState('');
  const [saving, setSaving] = useState(false);
  // Re-seed the fields whenever a different jobsite opens the window.
  const [seeded, setSeeded] = useState<number | null>(null);

  if (row && seeded !== row.id) {
    setSeeded(row.id);
    setCostBudget(toField(row.costBudget));
    setContract(toField(row.originalContract));
  }

  const nextCost = parseField(costBudget);
  const nextContract = parseField(contract);

  const costChanged = row != null && (nextCost ?? null) !== (row.costBudget ?? null);
  const contractChanged = row != null && nextContract != null && toCents(nextContract) !== toCents(row.originalContract);
  const changes = [costChanged, contractChanged].filter(Boolean).length;

  /** What the gauge will read once this cost budget is saved. */
  const nextExecution = useMemo(() => {
    if (!row) return null;
    const base = nextCost ?? (nextContract != null ? nextContract + row.changeOrders : row.contract);
    return base > 0 ? (row.consumed / base) * 100 : null;
  }, [row, nextCost, nextContract]);

  const belowConsumed = row != null && nextCost != null && nextCost < row.consumed;

  if (!row) return null;

  const currentExecution = execPct(row);
  const nextRevised = nextContract != null ? nextContract + row.changeOrders : row.contract;

  async function save() {
    if (!row || changes === 0) return;
    const payload: UpdateProjectPayload = {};
    // The amount typed, never the amount minus what has been spent. A cleared
    // field sends 0, which is how a PATCH says "no cost budget".
    if (costChanged) payload.costBudgetCents = nextCost == null ? 0 : toCents(nextCost);
    if (contractChanged && nextContract != null) payload.contractAmountCents = toCents(nextContract);

    setSaving(true);
    try {
      await updateProject(row.id, payload);
      // No success toast: the sheet's rule, and this window's own history —
      // a toast confirming a corrupted figure is worse than no toast at all.
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(adjustError(t, err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <BtModal
      open={open}
      onOpenChange={o => { if (!o) onOpenChange(false); }}
      width={560}
      dismissible={false}
      closeDisabled={saving}
      kicker={t('admin:budgets.adjust.kicker')}
      title={t('admin:budgets.adjust.title', { project: row.name })}
      footer={
        <>
          <Mono className="text-[9.5px] tracking-[0.08em] text-[#8A8175] md:mr-auto">
            {changes === 0
              ? t('admin:budgets.adjust.noChanges')
              : t('admin:budgets.adjust.changeCount', { count: changes })}
          </Mono>
          <SecondaryButton onClick={() => onOpenChange(false)} disabled={saving}>
            {t('common:buttons.cancel')}
          </SecondaryButton>
          <PrimaryButton onClick={save} disabled={saving || changes === 0}>
            {saving ? t('admin:budgets.adjust.saving') : t('admin:budgets.adjust.save')}
          </PrimaryButton>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <div className="border border-[#E7E1D5] bg-[#FBF8F2] px-3.5 py-3">
          <Mono className="block text-[9px] tracking-[0.13em] text-[#8A8175] mb-2">{t('admin:budgets.adjust.snapshot')}</Mono>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <Snapshot label={t('admin:budgets.metric.contract.short')} value={money(row.contract)} />
            <Snapshot
              label={t('admin:budgets.metric.costBudget.short')}
              value={row.costBudget == null ? t('admin:budgets.noCostBudget') : money(row.costBudget)}
            />
            <Snapshot label={t('admin:budgets.metric.spent.short')} value={money(row.consumed)} />
            <Snapshot label={t('admin:budgets.metric.margin.short')} value={money(row.margin)} tone={row.margin < 0 ? 'red' : 'green'} />
          </div>
        </div>

        <div>
          <FieldHead
            label={t('admin:budgets.adjust.costLabel')}
            chip={t('admin:budgets.adjust.costChip')}
            chipTone="quiet"
          />
          <MoneyField id="bt-adjust-cost" value={costBudget} onChange={setCostBudget} accent={costChanged} />
          <p className="text-[12px] leading-[1.5] text-[#5A5346] mt-1.5">
            {t('admin:budgets.adjust.costHelp')}
            {nextExecution != null && (
              <>
                {' '}
                <span className="text-[#0B0A09]">
                  {t('admin:budgets.adjust.costConsequence', {
                    from: `${fmtPct(currentExecution, lang)} %`,
                    to: `${fmtPct(nextExecution, lang)} %`,
                  })}
                </span>
              </>
            )}
          </p>
          {belowConsumed && (
            <PaperNote className="mt-2">
              {t('admin:budgets.adjust.belowConsumed', {
                spent: money(row.consumed),
                pct: `${fmtPct(nextExecution ?? 0, lang)} %`,
              })}
            </PaperNote>
          )}
        </div>

        <div>
          <FieldHead
            label={t('admin:budgets.adjust.contractLabel')}
            chip={t('admin:budgets.adjust.contractChip')}
            chipTone="orange"
          />
          <MoneyField id="bt-adjust-contract" value={contract} onChange={setContract} accent={contractChanged} />
          <p className="text-[12px] leading-[1.5] text-[#5A5346] mt-1.5">{t('admin:budgets.adjust.contractHelp')}</p>
          <div className="flex items-center gap-2.5 mt-2 bg-[#FBF8F2] border-l-2 border-l-[#DBD0BB] px-[11px] py-2 flex-wrap">
            <Mono className="text-[10px] tracking-[0.08em] text-[#8A8175]">
              {contractChanged ? t('admin:budgets.adjust.revisedChanges') : t('admin:budgets.adjust.revisedSame')}
            </Mono>
            <Mono className="text-[11px] text-[#5A5346] normal-case tabular-nums">
              {t('admin:budgets.adjust.revisedValue', { amount: money(nextRevised) })}
            </Mono>
          </div>
        </div>
      </div>
    </BtModal>
  );
}

/**
 * The backend's own message arrives raw and in English — `toast.error(e.message)`
 * is how the whole Spanish panel ends up quoting a Kotlin exception. Known
 * codes get our own copy; anything else gets a sentence, with the raw text
 * kept as the description for support.
 */
export function adjustError(t: (key: string, opts?: Record<string, unknown>) => string, err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'PROJECT_CLOSED' || err.status === 409) return t('admin:budgets.error.closed');
    if (err.status === 403) return t('admin:budgets.error.forbidden');
    if (err.status === 400) return t('admin:budgets.error.invalid');
  }
  return t('admin:budgets.error.saveFailed');
}
