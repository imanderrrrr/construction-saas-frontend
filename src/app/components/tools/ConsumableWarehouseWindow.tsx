import { useEffect, useState } from 'react';
import { money } from '../budgets/bits';
import { useTranslation } from 'react-i18next';
import { getConsumableDispatches, updateConsumable, type ConsumableResponse, type DispatchResponse } from '../../services/warehouse';
import { BtModal } from '../bt/windows';
import { PrimaryButton, SecondaryButton } from '../onboarding/chrome';
import { Bone, FieldLabel, INPUT, Mono, PaperNote } from '../projects/bt';

/** Warehouse counter actions inside the existing inventory window chrome. */
export function ConsumableWarehouseWindow({ consumable, onClose, onSaved, onEdit, onMinimum }: {
  consumable: ConsumableResponse;
  onClose: () => void;
  onSaved: (saved: ConsumableResponse) => void;
  onEdit: () => void;
  onMinimum: () => void;
}) {
  const { t } = useTranslation(['inventory', 'tools', 'common']);
  const [quantity, setQuantity] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<DispatchResponse[] | null>(null);
  const [historyError, setHistoryError] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let cancelled = false;
    getConsumableDispatches(consumable.id)
      .then(rows => { if (!cancelled) { setHistory(rows); setHistoryError(false); } })
      .catch(() => { if (!cancelled) setHistoryError(true); });
    return () => { cancelled = true; };
  }, [consumable.id, reload]);

  const amount = Number(quantity);
  const valid = Number.isFinite(amount) && amount > 0;
  async function restock() {
    if (!valid || busy) return;
    setBusy(true); setError(null);
    try {
      const saved = await updateConsumable(consumable.id, { currentStock: consumable.currentStock + amount });
      onSaved(saved); setQuantity('');
    } catch (err) { setError(err instanceof Error ? err.message : t('common:error.generic')); }
    finally { setBusy(false); }
  }

  return <BtModal open onOpenChange={open => { if (!open && !busy) onClose(); }} width={720}
    closeDisabled={busy} kicker={consumable.code} title={consumable.name}
    footer={<>
      <SecondaryButton onClick={onEdit} disabled={busy}>{t('consumables.editItem')}</SecondaryButton>
      <SecondaryButton onClick={onMinimum} disabled={busy}>{t('tools:table.minimum')}</SecondaryButton>
      <SecondaryButton onClick={onClose} disabled={busy}>{t('common:buttons.close')}</SecondaryButton>
    </>}>
    <PaperNote>{t('consumables.dialog.currentStockInfo', { name: consumable.name, stock: consumable.currentStock, unit: consumable.unit })}</PaperNote>
    <div className="flex flex-wrap items-end gap-3 mt-4">
      <div className="flex-1 min-w-0">
        <FieldLabel htmlFor="warehouse-restock">{t('consumables.dialog.quantityToAdd')}</FieldLabel>
        <input id="warehouse-restock" type="number" min="0" step="any" value={quantity} onChange={e => setQuantity(e.target.value)} className={INPUT} disabled={busy} />
      </div>
      <PrimaryButton disabled={!valid || busy} onClick={restock}>{t('consumables.restock')}</PrimaryButton>
    </div>
    {error && <div role="alert" className="mt-3"><PaperNote tone="red">{error}</PaperNote></div>}
    <section className="mt-6 border-t border-[#E7E1D5] pt-4" aria-label={t('consumables.dispatchHistory')}>
      <Mono className="block text-[10px] tracking-[0.12em] mb-3">{t('consumables.dispatchHistory')}</Mono>
      {historyError ? <PaperNote tone="red">{t('consumables.dialog.dispatchHistoryError')} <SecondaryButton onClick={() => { setHistoryError(false); setReload(n => n + 1); }}>{t('common:buttons.retry')}</SecondaryButton></PaperNote>
        : history == null ? <Bone className="h-16" />
        : history.length === 0 ? <p className="text-sm text-[#8A8175]">{t('consumables.dialog.noDispatchRecords')}</p>
        : <ul className="divide-y divide-[#E7E1D5]">{history.map(row => <li key={row.id} className="py-3 flex items-start justify-between gap-3">
          <div className="min-w-0"><p className="text-sm font-semibold">{row.project}</p><Mono className="block text-[10px] text-[#8A8175] mt-1">{row.date} · {row.requestedBy}</Mono>{row.notes && <p className="text-sm text-[#5A5346] mt-1">{row.notes}</p>}</div>
          <Mono className="text-sm shrink-0">{row.quantity} {row.unit}<span className="block text-xs text-[#8A8175] mt-1">{money((row.totalCostCents ?? 0) / 100)}</span></Mono>
        </li>)}</ul>}
    </section>
  </BtModal>;
}
