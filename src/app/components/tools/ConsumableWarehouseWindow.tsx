import { useWarehouseScope } from '../../lib/useWarehouseScope';
import { textPreview } from '../../../shared/textPolicy';
import { TextValue } from './TextValue';
import { warehouseDate } from '../../lib/warehouseDate';
import { useCallback, useEffect, useState } from 'react';
import { money } from '../budgets/bits';
import { useTranslation } from 'react-i18next';
import { getConsumableDispatches, listConsumables, restockConsumable, type ConsumableResponse, type DispatchResponse } from '../../services/warehouse';
import { intentSlot, newIntent, readIntent, sendIntent } from '../../lib/warehouseIntent';
import { warehouseErrorText } from '../../lib/warehouseErrorText';
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
  const { scope, active } = useWarehouseScope();
  const slot = intentSlot(scope, `restock:${consumable.id}`);
  const [pending, setPending] = useState(() => readIntent<{ quantity: number }>(slot));
  const [quantity, setQuantity] = useState(() => String(pending?.payload.quantity ?? ''));
  const [current, setCurrent] = useState(consumable);
  const [stockKnown, setStockKnown] = useState(false);
  const queryStock = useCallback(async () => {
    const rows = await listConsumables({ search: consumable.code });
    const fresh = rows.find(row => row.id === consumable.id);
    if (!fresh) throw new Error(t('consumables.intent.stockUnknown'));
    return fresh;
  }, [consumable.id, consumable.code, t]);
  async function refreshStock() {
    try { setCurrent(await queryStock()); setStockKnown(true); }
    catch { setStockKnown(false); }
  }
  useEffect(() => {
    let cancelled = false;
    queryStock().then(fresh => { if (!cancelled) { setCurrent(fresh); setStockKnown(true); } })
      .catch(() => { if (!cancelled) setStockKnown(false); });
    return () => { cancelled = true; };
  }, [queryStock]);
  useEffect(() => {
    const sync = () => setPending(readIntent<{ quantity: number }>(slot));
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [slot]);
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
  // Whole units: the stock is a count, and the server adds exactly this number.
  const valid = Number.isInteger(amount) && amount > 0;
  async function restock() {
    if (busy || (!pending && (!valid || !stockKnown))) return;
    setBusy(true); setError(null);
    try {
      const resolved = await sendIntent(scope, `restock:${consumable.id}`, { quantity: amount }, async (intent) => {
        const saved = await restockConsumable(consumable.id, intent.payload.quantity, intent.key);
        setCurrent(saved); onSaved(saved); setStockKnown(true);
      });
      setPending(resolved);
      await refreshStock();
    } catch (err) {
      setPending(readIntent<{ quantity: number }>(slot));
      setError(warehouseErrorText(err, t('common:error.generic')));
      void refreshStock();
    } finally { setBusy(false); }
  }

  async function startNew() {
    if (!pending || busy) return;
    setBusy(true); setError(null);
    try { await newIntent(slot, pending.key); setPending(readIntent(slot)); setQuantity(''); }
    catch (err) { setError(err instanceof Error ? err.message : t('common:error.generic')); }
    finally { setBusy(false); }
  }

  if (!active) return <BtModal open title={t('consumables.intent.sessionChanged')} onOpenChange={() => onClose()}><PaperNote>{t('consumables.intent.sessionChanged')}</PaperNote></BtModal>;

  return <BtModal open onOpenChange={open => { if (!open && !busy) onClose(); }} width={720}
    closeDisabled={busy} kicker={consumable.code} title={textPreview(consumable.name)}
    footer={<>
      <SecondaryButton onClick={onEdit} disabled={busy || pending?.state === 'pending'}>{t('consumables.editItem')}</SecondaryButton>
      <SecondaryButton onClick={onMinimum} disabled={busy}>{t('tools:table.minimum')}</SecondaryButton>
      <SecondaryButton onClick={onClose} disabled={busy}>{t('common:buttons.close')}</SecondaryButton>
    </>}>
    {consumable.name.length > 25 && <TextValue value={consumable.name} className="mb-3 text-sm" />}
    <PaperNote>{t('consumables.dialog.currentStockInfo', { name: textPreview(consumable.name), stock: current.currentStock, unit: current.unit })}</PaperNote>
    {!stockKnown && <PaperNote>{t('consumables.intent.stockUnknown')} <SecondaryButton onClick={refreshStock}>{t('common:buttons.retry')}</SecondaryButton></PaperNote>}
    {pending && <div role="status" className="mt-3"><PaperNote>{t(`consumables.intent.${pending.state}`, { quantity: pending.payload.quantity })}</PaperNote><Mono className="block text-xs break-all">{pending.key}</Mono></div>}
    <div className="flex flex-wrap items-end gap-3 mt-4">
      <div className="flex-1 min-w-0">
        <FieldLabel htmlFor="warehouse-restock">{t('consumables.dialog.quantityToAdd')}</FieldLabel>
        <input id="warehouse-restock" type="number" min="1" step="1" value={quantity} onChange={e => setQuantity(e.target.value)} className={INPUT} disabled={busy || !!pending} />
      </div>
      {pending && pending.state !== 'pending'
        ? <PrimaryButton disabled={busy || !stockKnown} onClick={startNew}>{t('consumables.intent.newRestock')}</PrimaryButton>
        : <PrimaryButton disabled={busy || (!pending && (!valid || !stockKnown))} onClick={restock}>{t(pending ? 'consumables.intent.reconcile' : 'consumables.restock')}</PrimaryButton>}
    </div>
    {error && <div role="alert" className="mt-3"><PaperNote tone="red">{error}</PaperNote></div>}
    <section className="mt-6 border-t border-[#E7E1D5] pt-4" aria-label={t('consumables.dispatchHistory')}>
      <Mono className="block text-[10px] tracking-[0.12em] mb-3">{t('consumables.dispatchHistory')}</Mono>
      {historyError ? <PaperNote tone="red">{t('consumables.dialog.dispatchHistoryError')} <SecondaryButton onClick={() => { setHistoryError(false); setReload(n => n + 1); }}>{t('common:buttons.retry')}</SecondaryButton></PaperNote>
        : history == null ? <Bone className="h-16" />
        : history.length === 0 ? <p className="text-sm text-[#8A8175]">{t('consumables.dialog.noDispatchRecords')}</p>
        : <ul className="divide-y divide-[#E7E1D5]">{history.map(row => <li key={row.id} className="py-3 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0"><p className="text-sm font-semibold">{row.project}</p><Mono className="block text-[10px] text-[#8A8175] mt-1">{warehouseDate(row.date)} · {row.requestedBy}</Mono>{row.notes && <p className="text-sm text-[#5A5346] mt-1">{row.notes}</p>}</div>
          <Mono className="text-sm max-w-full [overflow-wrap:anywhere]">{row.quantity} {row.unit}<span className="block text-xs text-[#8A8175] mt-1">{money((row.totalCostCents ?? 0) / 100)}</span></Mono>
        </li>)}</ul>}
    </section>
  </BtModal>;
}
