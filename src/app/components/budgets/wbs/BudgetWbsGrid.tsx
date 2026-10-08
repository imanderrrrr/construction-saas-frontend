import { Fragment, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ApiError } from '../../../lib/api';
import { moneyInputCents } from '../../../lib/moneyInput';
import { formatCents } from '../../../helpers/tmMoney';
import {
  bulkImportLineItems, createLineItem, deleteLineItem, getWbsSummary, updateLineItem,
  LINE_ITEM_CATEGORIES, type BudgetLineItem, type CreateLineItemPayload, type LineItemCategory,
  type ProjectWbsSummary, type UpdateLineItemPayload,
} from '../../../services/budgetLineItems';
import { BtModal } from '../../bt/windows';
import { PrimaryButton, SecondaryButton } from '../../onboarding/chrome';
import { FieldLabel, INPUT } from '../../projects/bt';
import { cn } from '../../ui/utils';
import { parseWbsImport, WbsImportError } from './state';

const tones = {
  OK: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  WARNING: 'bg-amber-50 text-amber-800 border-amber-200',
  OVER_BUDGET: 'bg-red-50 text-red-800 border-red-200',
};
const pillars = ['payroll', 'subcontractor', 'supplier', 'warehouse', 'expense'] as const;

export function BudgetWbsGrid({ projectId, readOnly = false }: { projectId: number; readOnly?: boolean }) {
  const { t, i18n } = useTranslation('admin');
  const [summary, setSummary] = useState<ProjectWbsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [editor, setEditor] = useState<BudgetLineItem | 'new' | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [remove, setRemove] = useState<BudgetLineItem | null>(null);
  const [removing, setRemoving] = useState(false);
  const refresh = useCallback(() => setReload(n => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setFailed(false); setSummary(null); setExpanded(null);
    getWbsSummary(projectId, readOnly)
      .then(data => { if (!cancelled) setSummary(data); })
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId, readOnly, reload]);

  const percent = (value: number) => new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }).format(value);
  async function confirmDelete() {
    if (!remove) return;
    setRemoving(true);
    try {
      await deleteLineItem(remove.id); setRemove(null); refresh(); toast.success(t('wbs.deleted'));
    } catch (err) {
      toast.error(err instanceof ApiError && (err.status === 409 || err.code === 'CANNOT_DELETE_LINE_ITEM_WITH_TRANSACTIONS')
        ? t('wbs.deleteProtected') : t('wbs.saveFailed'), { description: err instanceof Error ? err.message : undefined });
    } finally { setRemoving(false); }
  }

  return <section data-testid="budget-wbs-grid" className="space-y-4" aria-label={t('wbs.title')}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="font-bt-display font-bold text-xl">{t('wbs.title')}</h3><p className="text-xs text-[#8A8175] mt-1">{t('wbs.hint')}</p></div>
      {!readOnly && <div className="flex gap-2">
        <SecondaryButton onClick={() => setImportOpen(true)}>{t('wbs.import')}</SecondaryButton>
        <PrimaryButton onClick={() => setEditor('new')}>{t('wbs.new')}</PrimaryButton>
      </div>}
    </div>
    {readOnly && <p className="text-xs text-[#8A8175]">{t('wbs.readOnly')}</p>}
    {loading ? <p role="status" className="py-6 text-sm text-[#8A8175]">{t('wbs.loading')}</p>
      : failed ? <div role="alert" className="border border-red-200 bg-red-50 p-4 text-sm text-red-800">{t('wbs.loadFailed')} <button type="button" onClick={refresh} className="underline ml-2">{t('wbs.retry')}</button></div>
      : summary && <>
        <dl className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {(['revised', 'spent', 'balance', 'committed'] as const).map(key => {
            const value = key === 'revised' ? summary.totalRevisedBudgetCents : key === 'spent' ? summary.totalSpentCents : key === 'balance' ? summary.totalBalanceCents : summary.totalCommittedCents;
            return <div key={key} className="border border-[#E7E1D5] bg-[#FBF8F2] p-3"><dt className="text-xs text-[#8A8175]">{t(`wbs.${key}`)}</dt><dd className={cn('font-bt-mono font-semibold text-lg mt-1', value < 0 && 'text-red-700')}>{formatCents(value)}</dd></div>;
          })}
        </dl>
        <p className="text-xs text-[#5A5346]" aria-live="polite">{t('wbs.radar', { count: summary.itemsCount, warning: summary.warningCount, over: summary.overBudgetCount })}</p>
        {!summary.items.length ? <p className="py-8 text-sm text-[#8A8175] text-center border border-[#E7E1D5]">{t('wbs.empty')}</p>
          : <div className="overflow-x-auto border border-[#E7E1D5]">
            <table className="w-full min-w-[950px] text-sm text-left">
              <thead className="bg-[#FAF7F0]"><tr>{['code', 'name', 'category', 'original', 'revised', 'spent', 'balance', 'consumption', 'status', ...(!readOnly ? ['actions'] : [])].map(key => <th key={key} scope="col" className="px-3 py-3 text-xs font-semibold text-[#5A5346] whitespace-nowrap">{t(`wbs.${key}`)}</th>)}</tr></thead>
              <tbody>{summary.items.map(item => <Fragment key={item.id}>
                <tr className={cn('border-t border-[#E7E1D5] cursor-pointer', item.varianceStatus === 'WARNING' && 'bg-amber-50/50', item.varianceStatus === 'OVER_BUDGET' && 'bg-red-50/60')}
                  onClick={() => setExpanded(expanded === item.id ? null : item.id)}>
                  <td className="px-3 py-3 font-bt-mono"><button type="button" aria-expanded={expanded === item.id} aria-controls={`wbs-pillars-${item.id}`} onClick={e => { e.stopPropagation(); setExpanded(expanded === item.id ? null : item.id); }} className="underline underline-offset-4">{item.code}</button></td>
                  <td className="px-3 py-3 font-medium">{item.name}</td>
                  <td className="px-3 py-3"><span className="text-xs border border-[#DBD0BB] px-1.5 py-1 whitespace-nowrap">{t(`wbs.category.${item.category}`)}</span></td>
                  {[item.originalBudgetCents, item.revisedBudgetCents, item.spentCents, item.balanceCents].map((value, index) => <td key={index} className={cn('px-3 py-3 font-bt-mono whitespace-nowrap', value < 0 && 'text-red-700 font-semibold')}>{formatCents(value)}</td>)}
                  <td className="px-3 py-3 font-bt-mono whitespace-nowrap">{percent(item.consumptionPct)} %</td>
                  <td className="px-3 py-3"><span className={cn('text-xs border px-2 py-1 whitespace-nowrap', tones[item.varianceStatus])}>{t(`wbs.status.${item.varianceStatus}`)}</span></td>
                  {!readOnly && <td className="px-3 py-3 whitespace-nowrap"><button type="button" onClick={e => { e.stopPropagation(); setEditor(item); }} className="underline mr-3">{t('wbs.edit')}</button><button type="button" onClick={e => { e.stopPropagation(); setRemove(item); }} className="underline text-red-700">{t('wbs.delete')}</button></td>}
                </tr>
                {expanded === item.id && <tr id={`wbs-pillars-${item.id}`}><td colSpan={readOnly ? 9 : 10} className="p-4 border-t border-[#E7E1D5] bg-[#FBF8F2]">
                  <p className="text-xs font-semibold mb-3">{t('wbs.pillars', { code: item.code })}</p>
                  <dl className="grid grid-cols-2 sm:grid-cols-5 gap-3">{pillars.map(pillar => <div key={pillar}><dt className="text-xs text-[#8A8175]">{t(`wbs.pillar.${pillar}`)}</dt><dd className="font-bt-mono mt-1">{formatCents(item.spendByPillar[`${pillar}Cents`])}</dd></div>)}</dl>
                  {item.notes && <p className="text-xs text-[#5A5346] mt-3 whitespace-pre-wrap">{item.notes}</p>}
                </td></tr>}
              </Fragment>)}</tbody>
            </table>
          </div>}
      </>}
    {!readOnly && editor && <LineItemEditor key={typeof editor === 'string' ? 'new' : editor.id} item={editor === 'new' ? null : editor} projectId={projectId} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); refresh(); }} />}
    {!readOnly && importOpen && <LineItemImport projectId={projectId} onClose={() => setImportOpen(false)} onSaved={() => { setImportOpen(false); refresh(); }} />}
    <BtModal open={!!remove} onOpenChange={open => { if (!open) setRemove(null); }} closeDisabled={removing} title={t('wbs.deleteTitle')}
      description={t('wbs.deleteDescription', { code: remove?.code, name: remove?.name })}
      footer={<><SecondaryButton disabled={removing} onClick={() => setRemove(null)}>{t('wbs.cancel')}</SecondaryButton><PrimaryButton disabled={removing} onClick={confirmDelete}>{t('wbs.delete')}</PrimaryButton></>} />
  </section>;
}

function LineItemEditor({ item, projectId, onClose, onSaved }: { item: BudgetLineItem | null; projectId: number; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation('admin');
  const [code, setCode] = useState(item?.code ?? '');
  const [name, setName] = useState(item?.name ?? '');
  const [category, setCategory] = useState<LineItemCategory>(item?.category ?? 'GENERAL');
  const [unit, setUnit] = useState(item?.unit ?? 'GLB');
  const [quantity, setQuantity] = useState(String(item?.quantity ?? 1));
  const [unitCost, setUnitCost] = useState(((item?.unitCostCents ?? 0) / 100).toFixed(2));
  const [amount, setAmount] = useState(item ? (item.originalBudgetCents / 100).toFixed(2) : '');
  const [orders, setOrders] = useState(((item?.changeOrdersCents ?? 0) / 100).toFixed(2));
  const [committed, setCommitted] = useState(((item?.committedCents ?? 0) / 100).toFixed(2));
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    const qty = Number(quantity), unitCostCents = moneyInputCents(unitCost);
    const originalBudgetCents = amount.trim() ? moneyInputCents(amount) : undefined;
    const orderCents = moneyInputCents(orders.replace(/^-/, ''));
    const committedCents = moneyInputCents(committed);
    if (!code.trim() || !name.trim() || !unit.trim() || !/^\d+(?:\.\d{1,4})?$/.test(quantity) || !Number.isFinite(qty) || qty <= 0 || qty >= 10_000_000_000 || unitCostCents == null || originalBudgetCents === null || (item && (originalBudgetCents === undefined || orderCents == null || committedCents == null))) {
      setError(t('wbs.invalid')); return;
    }
    const payload: CreateLineItemPayload = { code: code.trim(), name: name.trim(), category, unit: unit.trim(), quantity: qty, unitCostCents, ...(originalBudgetCents !== undefined ? { originalBudgetCents } : {}), notes: item ? notes.trim() : notes.trim() || null };
    setSaving(true); setError(null);
    try {
      if (item) await updateLineItem(item.id, { ...payload, changeOrdersCents: orders.startsWith('-') ? -orderCents! : orderCents!, committedCents: committedCents! } satisfies UpdateLineItemPayload);
      else await createLineItem(projectId, payload);
      toast.success(t('wbs.saved')); onSaved();
    } catch (err) { setError(err instanceof Error ? err.message : t('wbs.saveFailed')); }
    finally { setSaving(false); }
  }
  return <BtModal open onOpenChange={open => { if (!open) onClose(); }} width={560} title={t(item ? 'wbs.editTitle' : 'wbs.newTitle')} closeDisabled={saving} dismissible={false}
    footer={<><SecondaryButton onClick={onClose} disabled={saving}>{t('wbs.cancel')}</SecondaryButton><PrimaryButton onClick={save} disabled={saving}>{t('wbs.save')}</PrimaryButton></>}>
    <div className="grid grid-cols-2 gap-3">
      <div><FieldLabel htmlFor="wbs-code">{t('wbs.code')}</FieldLabel><input id="wbs-code" className={INPUT} maxLength={50} value={code} onChange={e => setCode(e.target.value)} /></div>
      <div><FieldLabel htmlFor="wbs-category">{t('wbs.category')}</FieldLabel><select id="wbs-category" className={INPUT} value={category} onChange={e => setCategory(e.target.value as LineItemCategory)}>{LINE_ITEM_CATEGORIES.map(value => <option key={value} value={value}>{t(`wbs.category.${value}`)}</option>)}</select></div>
      <div className="col-span-2"><FieldLabel htmlFor="wbs-name">{t('wbs.name')}</FieldLabel><input id="wbs-name" className={INPUT} maxLength={255} value={name} onChange={e => setName(e.target.value)} /></div>
      <div><FieldLabel htmlFor="wbs-unit">{t('wbs.unit')}</FieldLabel><input id="wbs-unit" className={INPUT} maxLength={30} value={unit} onChange={e => setUnit(e.target.value)} /></div>
      <div><FieldLabel htmlFor="wbs-quantity">{t('wbs.quantity')}</FieldLabel><input id="wbs-quantity" className={INPUT} type="number" min="0.0001" step="0.0001" value={quantity} onChange={e => setQuantity(e.target.value)} /></div>
      <div><FieldLabel htmlFor="wbs-unit-cost">{t('wbs.unitCost')}</FieldLabel><input id="wbs-unit-cost" className={INPUT} type="number" min="0" step="0.01" value={unitCost} onChange={e => setUnitCost(e.target.value)} /></div>
      <div><FieldLabel htmlFor="wbs-original">{t('wbs.original')}</FieldLabel><input id="wbs-original" className={INPUT} type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} /></div>
      <p className="col-span-2 text-xs text-[#8A8175]">{t(item ? 'wbs.editAmountHint' : 'wbs.amountHint')}</p>
      {item && <div className="col-span-2"><FieldLabel htmlFor="wbs-orders">{t('wbs.orders')}</FieldLabel><input id="wbs-orders" className={INPUT} type="number" step="0.01" value={orders} onChange={e => setOrders(e.target.value)} /></div>}
      {item && <div className="col-span-2"><FieldLabel htmlFor="wbs-committed">{t('wbs.committedDollars')}</FieldLabel><input id="wbs-committed" className={INPUT} type="number" min="0" step="0.01" value={committed} onChange={e => setCommitted(e.target.value)} /><p className="text-xs text-[#8A8175] mt-1">{t('wbs.committedHint')}</p></div>}
      <div className="col-span-2"><FieldLabel htmlFor="wbs-notes">{t('wbs.notes')}</FieldLabel><textarea id="wbs-notes" rows={3} maxLength={10000} className={cn(INPUT, 'h-auto py-2')} value={notes} onChange={e => setNotes(e.target.value)} /></div>
    </div>
    {error && <p role="alert" className="text-sm text-red-700 mt-3">{error}</p>}
  </BtModal>;
}

function LineItemImport({ projectId, onClose, onSaved }: { projectId: number; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation('admin');
  const [source, setSource] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  let items: CreateLineItemPayload[] = [];
  let parseError: string | null = null;
  if (source.trim()) {
    try { items = parseWbsImport(source); }
    catch (err) { parseError = err instanceof WbsImportError ? t(`wbs.importError.${err.reason}`, { row: err.row }) : t('wbs.invalid'); }
  }
  async function readFile(file?: File) {
    if (!file) return;
    if (!/\.(csv|tsv|txt)$/i.test(file.name) || file.size > 2 * 1024 * 1024) { setError(t('wbs.fileInvalid')); return; }
    try { setSource(await file.text()); setError(null); }
    catch { setError(t('wbs.fileFailed')); }
  }
  async function save() {
    if (!items.length || parseError) return;
    setSaving(true); setError(null);
    try { await bulkImportLineItems(projectId, items); toast.success(t('wbs.imported', { count: items.length })); onSaved(); }
    catch (err) { setError(err instanceof Error ? err.message : t('wbs.saveFailed')); }
    finally { setSaving(false); }
  }
  return <BtModal open onOpenChange={open => { if (!open) onClose(); }} width={620} title={t('wbs.importTitle')} closeDisabled={saving} dismissible={false}
    footer={<><SecondaryButton onClick={onClose} disabled={saving}>{t('wbs.cancel')}</SecondaryButton><PrimaryButton onClick={save} disabled={saving || !items.length || !!parseError}>{t('wbs.importConfirm', { count: items.length })}</PrimaryButton></>}>
    <p className="text-sm text-[#5A5346] mb-3">{t('wbs.importHint')}</p>
    <label className="block border border-dashed border-[#DBD0BB] p-4 text-sm cursor-pointer text-center" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void readFile(e.dataTransfer.files[0]); }}>
      {t('wbs.dropFile')}<input type="file" accept=".csv,.tsv,.txt" className="block mt-2 w-full text-xs" onChange={e => void readFile(e.target.files?.[0])} disabled={saving} />
    </label>
    <FieldLabel htmlFor="wbs-import-source">{t('wbs.paste')}</FieldLabel>
    <textarea id="wbs-import-source" rows={7} value={source} disabled={saving} onChange={e => { setSource(e.target.value); setError(null); }} className={cn(INPUT, 'h-auto py-2 font-bt-mono')} placeholder={t('wbs.importExample')} />
    {(error || parseError) && <p role="alert" className="text-sm text-red-700 mt-3">{error || parseError}</p>}
    {!!items.length && <div className="mt-3 text-sm text-[#5A5346]" aria-live="polite"><p>{t('wbs.importPreview', { count: items.length, total: formatCents(items.reduce((sum, item) => sum + (item.originalBudgetCents ?? 0), 0)) })}</p><ul className="mt-2 max-h-32 overflow-y-auto">{items.slice(0, 20).map(item => <li key={item.code}>{item.code} · {item.name} · {formatCents(item.originalBudgetCents ?? 0)}</li>)}</ul></div>}
  </BtModal>;
}
