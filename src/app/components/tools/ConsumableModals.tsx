import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../ui/utils';
import { FIELD_LIMITS } from '../../../shared/fieldLimits';
import { createConsumable, updateConsumable, type ConsumableResponse } from '../../services/warehouse';
import { BtModal } from '../bt/windows';
import { PrimaryButton, SecondaryButton } from '../onboarding/chrome';
import { FieldError, FieldHint, FieldLabel, INPUT, INPUT_ERROR, Mono, PaperNote } from '../projects/bt';
import { LightChip, lightName, StockBar } from './bits';

/**
 * 08A / 08B — register a supply, and adjust its minimum.
 *
 * The minimum is an abstract number until it turns a light on, so both windows
 * put the effect in front: the bar and the chip as they will look, and which
 * figure of the header moves. That is how a minimum gets raised on purpose
 * instead of discovering nine supplies in orange tomorrow.
 *
 * Stock is not edited here. It moves when the warehouse dispatches and when it
 * restocks; a stock field in this window would be the back door for balancing
 * the inventory by hand with no trace.
 */

/** The same rule the server applies: zero is out, at or below the minimum is low. */
export function lightFor(stock: number, minimum: number): string {
  if (stock === 0) return 'Out of Stock';
  return stock <= minimum ? 'Low Stock' : 'In Stock';
}

export function ConsumableFormModal({ open, onOpenChange, onSaved }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (consumable: ConsumableResponse) => void;
}) {
  const { t } = useTranslation(['tools', 'common']);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [stock, setStock] = useState('0');
  const [minimum, setMinimum] = useState('0');
  const [errors, setErrors] = useState<{ name?: string; unit?: string; numbers?: string; server?: string }>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(''); setUnit(''); setStock('0'); setMinimum('0'); setErrors({}); setSaving(false);
  }, [open]);

  const stockNumber = Number(stock) || 0;
  const minimumNumber = Number(minimum) || 0;

  const submit = async () => {
    const next: typeof errors = {};
    if (!name.trim()) next.name = t('tools:consumable.err.name');
    if (!unit.trim()) next.unit = t('tools:consumable.err.unit');
    if (stockNumber < 0 || minimumNumber < 0) next.numbers = t('tools:consumable.err.negative');
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      // The code is the server's: CS-00x, never typed.
      const saved = await createConsumable({
        name: name.trim(),
        category: 'General',
        unit: unit.trim(),
        currentStock: stockNumber,
        minimumStock: minimumNumber,
      });
      onSaved(saved);
      onOpenChange(false);
    } catch {
      setErrors({ server: t('tools:form.err.server') });
    } finally {
      setSaving(false);
    }
  };

  const light = lightFor(stockNumber, minimumNumber);

  return (
    <BtModal
      open={open}
      onOpenChange={onOpenChange}
      width={560}
      dismissible={false}
      closeDisabled={saving}
      kicker={t('tools:consumable.kicker')}
      title={t('tools:consumable.title')}
      footer={
        <>
          <Mono className="text-[9px] tracking-[0.08em] text-[#A69C8D] md:mr-auto">{t('tools:consumable.footer')}</Mono>
          <SecondaryButton onClick={() => onOpenChange(false)} disabled={saving}>{t('common:buttons.cancel')}</SecondaryButton>
          <PrimaryButton onClick={submit} disabled={saving}>
            {saving ? t('tools:form.submitting.new') : t('tools:form.submit.new')}
          </PrimaryButton>
        </>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-[150px_1fr] gap-[14px]">
        <div>
          <FieldLabel>{t('tools:form.code')}</FieldLabel>
          <div className="w-full h-10 border border-[#DBD0BB] bg-[#F3EEE4] px-3 flex items-center justify-between gap-2">
            <Mono className="text-[13px] font-semibold tracking-[0.05em] text-[#8A8175]">CS-…</Mono>
            <Mono className="text-[9px] tracking-[0.1em] text-[#A69C8D]">{t('tools:consumable.code.auto')}</Mono>
          </div>
          <FieldHint>{t('tools:consumable.code.hint')}</FieldHint>
        </div>
        <div>
          <FieldLabel htmlFor="cs-name" required>{t('tools:consumable.name')}</FieldLabel>
          <input id="cs-name" value={name} onChange={e => setName(e.target.value)} maxLength={FIELD_LIMITS.SHORT_NAME} className={cn(INPUT, 'bg-[#FAF7F0]', errors.name && INPUT_ERROR)} />
          {errors.name && <FieldError>{errors.name}</FieldError>}
        </div>
      </div>

      <div className="mt-[14px]">
        <FieldLabel htmlFor="cs-unit" required>{t('tools:consumable.unit')}</FieldLabel>
        <input id="cs-unit" value={unit} onChange={e => setUnit(e.target.value)} maxLength={FIELD_LIMITS.ENUM_TOKEN} className={cn(INPUT, 'bg-[#FAF7F0]', errors.unit && INPUT_ERROR)} />
        {errors.unit ? <FieldError>{errors.unit}</FieldError> : <FieldHint>{t('tools:consumable.unit.hint')}</FieldHint>}
      </div>

      <div className="grid grid-cols-2 gap-[14px] mt-[14px]">
        <div>
          <FieldLabel htmlFor="cs-stock" required>{t('tools:consumable.stock')}</FieldLabel>
          <input id="cs-stock" type="number" min="0" value={stock} onChange={e => setStock(e.target.value)} className={cn(INPUT, 'bg-[#FAF7F0] tabular-nums', errors.numbers && INPUT_ERROR)} />
          <FieldHint>{t('tools:consumable.stock.hint')}</FieldHint>
        </div>
        <div>
          <FieldLabel htmlFor="cs-min" required>{t('tools:consumable.minimum')}</FieldLabel>
          <input id="cs-min" type="number" min="0" value={minimum} onChange={e => setMinimum(e.target.value)} className={cn(INPUT, 'bg-[#FAF7F0] tabular-nums', errors.numbers && INPUT_ERROR)} />
          <FieldHint>{t('tools:consumable.minimum.hint')}</FieldHint>
        </div>
      </div>
      {errors.numbers && <FieldError>{errors.numbers}</FieldError>}

      <div className="bg-[#FBF8F2] border border-[#EDE7DB] px-4 py-3.5 mt-4">
        <Mono className="block text-[9.5px] font-semibold tracking-[0.12em] text-[#5A5346] mb-2.5">{t('tools:consumable.preview')}</Mono>
        <div className="flex items-center gap-3">
          <LightChip light={light} />
          <StockBar stock={stockNumber} minimum={minimumNumber} light={light} className="flex-1" />
        </div>
        <Mono className="block text-[9.5px] tracking-[0.08em] text-[#A69C8D] mt-2">
          {t('tools:consumable.preview.line', { stock: stockNumber, unit: unit.trim() || '—', minimum: minimumNumber })}
        </Mono>
      </div>

      {errors.server && <PaperNote tone="red" className="mt-4">{errors.server}</PaperNote>}
    </BtModal>
  );
}

export function MinimumStockModal({ open, onOpenChange, consumable, onSaved }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  consumable: ConsumableResponse | null;
  onSaved: (consumable: ConsumableResponse) => void;
}) {
  const { t } = useTranslation(['tools', 'common']);
  const [minimum, setMinimum] = useState('0');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open || !consumable) return;
    setMinimum(String(consumable.minimumStock));
    setSaving(false);
    setFailed(false);
  }, [open, consumable]);

  if (!consumable) return null;

  const next = Number(minimum) || 0;
  const changed = next !== consumable.minimumStock && next >= 0;
  const light = lightFor(consumable.currentStock, next);

  const submit = async () => {
    if (!changed) return;
    setSaving(true);
    setFailed(false);
    try {
      onSaved(await updateConsumable(consumable.id, { minimumStock: next }));
      onOpenChange(false);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <BtModal
      open={open}
      onOpenChange={onOpenChange}
      width={460}
      dismissible={false}
      closeDisabled={saving}
      kicker={`${consumable.code} · ${consumable.name}`}
      title={t('tools:minimum.title')}
      footer={
        <>
          <SecondaryButton onClick={() => onOpenChange(false)} disabled={saving}>{t('common:buttons.cancel')}</SecondaryButton>
          {/* Disabled with no message when nothing changed: there is no error,
              there is no change. */}
          <PrimaryButton onClick={submit} disabled={saving || !changed}>
            {saving ? t('tools:form.submitting.edit') : t('tools:minimum.submit')}
          </PrimaryButton>
        </>
      }
    >
      <div className="flex items-center gap-4 bg-[#FBF8F2] border border-[#EDE7DB] px-4 py-3.5">
        <div>
          <Mono className="block text-[9.5px] tracking-[0.1em] text-[#5A5346]">{t('tools:minimum.stockToday')}</Mono>
          <div className="font-bt-display font-extrabold text-[26px] leading-none tabular-nums text-[#0B0A09] mt-1">{consumable.currentStock}</div>
        </div>
        <span className="w-px h-9 bg-[#DBD0BB]" aria-hidden="true" />
        <div>
          <Mono className="block text-[9.5px] tracking-[0.1em] text-[#5A5346]">{t('tools:minimum.current')}</Mono>
          <div className="font-bt-display font-extrabold text-[26px] leading-none tabular-nums text-[#0B0A09] mt-1">{consumable.minimumStock}</div>
        </div>
        <LightChip light={consumable.status} className="ml-auto" />
      </div>

      <div className="mt-[14px]">
        <FieldLabel htmlFor="cs-newmin" required>{t('tools:minimum.new')}</FieldLabel>
        <input id="cs-newmin" type="number" min="0" value={minimum} onChange={e => setMinimum(e.target.value)} className={cn(INPUT, 'tabular-nums')} />
        <FieldHint>{t('tools:minimum.new.hint', { unit: consumable.unit })}</FieldHint>
      </div>

      <PaperNote className="mt-4">
        <Mono className="block text-[9.5px] font-semibold tracking-[0.12em] text-[#C2410C] mb-2">{t('tools:minimum.effect')}</Mono>
        <div className="flex items-center gap-3">
          <LightChip light={light} />
          <StockBar stock={consumable.currentStock} minimum={next} light={light} className="flex-1 transition-all duration-200" />
        </div>
        <div className="mt-2">
          {t('tools:minimum.effect.line', {
            minimum: next,
            stock: `${consumable.currentStock} ${consumable.unit}`,
            light: lightName(t, light),
          })}
        </div>
      </PaperNote>

      {failed && <PaperNote tone="red" className="mt-3">{t('tools:form.err.server')}</PaperNote>}
    </BtModal>
  );
}
