import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { listLineItemOptions, type LineItemOption } from '../../../services/budgetLineItems';

export function BudgetLineItemSelector({ projectId, value, onChange, disabled = false, allowGeneral = true, selectedLabel }: {
  projectId: number | null | undefined;
  value: number | null | undefined;
  onChange: (id: number | null) => void;
  disabled?: boolean;
  /** Some review APIs preserve existing attribution when the ID is omitted. */
  allowGeneral?: boolean;
  selectedLabel?: string;
}) {
  const { t } = useTranslation('admin');
  const id = useId();
  const [options, setOptions] = useState<LineItemOption[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setOptions([]);
    if (!projectId) { setState('idle'); return; }
    setState('loading');
    listLineItemOptions(projectId)
      .then(items => { if (!cancelled) { setOptions(items); setState('ready'); } })
      .catch(() => { if (!cancelled) setState('error'); });
    return () => { cancelled = true; };
  }, [projectId, retry]);
  return <div className="space-y-1">
    <label htmlFor={id} className="block text-xs font-medium text-[#5A5346]">{t('wbs.selector.label')}</label>
    <select id={id} data-testid="budget-line-item-select" value={value ?? ''} onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}
      disabled={disabled || !projectId || state === 'loading' || state === 'error'}
      className="w-full h-10 border border-[#DBD0BB] bg-white px-3 text-sm disabled:opacity-60">
      <option value="" disabled={!allowGeneral}>{state === 'loading' ? t('wbs.loading') : t('wbs.selector.general')}</option>
      {value != null && !options.some(item => item.id === value) && <option value={value}>{selectedLabel || t('wbs.selector.assigned', { id: value })}</option>}
      {options.map(item => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}
    </select>
    {state === 'error' ? <p role="alert" className="text-xs text-[#B3402A]">{t(allowGeneral ? 'wbs.selector.failed' : 'wbs.selector.assignedFailed')} <button type="button" onClick={() => setRetry(n => n + 1)} className="underline">{t('wbs.retry')}</button></p>
      : <p className="text-xs text-[#8A8175]">{!projectId ? t('wbs.selector.projectFirst') : !allowGeneral ? t('wbs.selector.assignedHint') : state === 'ready' && !options.length ? t('wbs.selector.empty') : t('wbs.selector.hint')}</p>}
  </div>;
}
