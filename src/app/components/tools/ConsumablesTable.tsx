import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { cn } from '../ui/utils';
import { FOCUS_RING, SecondaryButton } from '../onboarding/chrome';
import { Bone, CreateButton, EmptyWord, Mono } from '../projects/bt';
import type { ConsumableResponse } from '../../services/warehouse';
import { CellEmpty, Code, LIGHT_EDGE, LightChip, stampDay, StockBar } from './bits';
import type { TableState } from './ToolsTable';

/**
 * 04 — the supplies.
 *
 * A screw gets used up, so the question changes: not where it is, but how much
 * is left and when to reorder. The bar carries a mark at the minimum — the
 * number that decides the traffic light — and the light itself is the server's,
 * translated, not one recalculated in the browser where two screens could
 * disagree.
 */

const GRID = 'grid grid-cols-[96px_1fr_300px_140px_168px_132px] gap-3 items-center';
const GRID_MD = 'grid grid-cols-[88px_1fr_240px_132px_96px] gap-3 items-center';

export function ConsumablesTable({ state, consumables, lang, filterCount, total, flashId, onAdjust, onRegister, onRetry, onClearFilters }: {
  state: TableState;
  consumables: ConsumableResponse[];
  lang: string;
  filterCount: number;
  total: number | null;
  /** Just registered, or its minimum just changed. */
  flashId: number | null;
  onAdjust: (consumable: ConsumableResponse) => void;
  onRegister: () => void;
  onRetry: () => void;
  onClearFilters: () => void;
}) {
  const { t } = useTranslation(['tools', 'common']);

  if (state === 'error' || state === 'forbidden') {
    return (
      <div className="bg-white border border-[#E7E1D5]">
        <EmptyWord
          tone="red"
          word={t('tools:error.consumables.word')}
          title={t('tools:error.consumables.lead')}
          className="border-0"
          action={<SecondaryButton onClick={onRetry} className="bg-[#FAF7F0]">{t('tools:retry')}</SecondaryButton>}
        />
      </div>
    );
  }
  if (state === 'empty') {
    return (
      <div className="bg-white border border-[#E7E1D5]">
        <EmptyWord
          word={t('tools:empty.none.consumables.word')}
          title={t('tools:empty.none.consumables.lead')}
          hint={t('tools:empty.none.consumables.body')}
          className="border-0 py-[76px]"
          action={<CreateButton onClick={onRegister}><Plus className="w-3.5 h-3.5" strokeWidth={2.4} />{t('tools:action.registerConsumable')}</CreateButton>}
        />
      </div>
    );
  }
  if (state === 'noMatch') {
    return (
      <div className="bg-white border border-[#E7E1D5]">
        <EmptyWord
          word={t('tools:empty.filters.word')}
          title={total != null ? t('tools:empty.filters.leadConsumables', { count: total, conditions: t('tools:filter.conditions', { count: filterCount }) }) : t('tools:empty.filters.word')}
          className="border-0"
          action={<SecondaryButton onClick={onClearFilters} className="bg-[#FAF7F0]">{t('tools:filter.clear', { count: filterCount })}</SecondaryButton>}
        />
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#E7E1D5]" data-testid="consumables-table" data-tour="sec.tool-inventory.table">
      <div className={cn(GRID, 'hidden xl:grid px-4 h-7 items-center bg-[#FBF8F2] border-b border-[#EDE7DB] font-bt-mono text-[9px] uppercase tracking-[0.13em] text-[#A69C8D]')}>
        <span>{t('tools:table.code')}</span>
        <span>{t('tools:table.supply')}</span>
        <span>{t('tools:table.stock')}</span>
        <span>{t('tools:table.light')}</span>
        <span>{t('tools:table.lastDispatch')}</span>
        <span className="text-right">{t('tools:table.minimum')}</span>
      </div>

      {state === 'loading' && Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="px-4 py-3.5 border-b border-[#F0EBE1] space-y-2">
          <Bone className="w-[30%] h-3" /><Bone className="w-[45%] h-[7px]" />
        </div>
      ))}

      {state === 'data' && consumables.map(c => (
        <Row key={c.id} consumable={c} lang={lang} flash={c.id === flashId} onAdjust={() => onAdjust(c)} />
      ))}
    </div>
  );
}

function Row({ consumable, lang, flash, onAdjust }: { consumable: ConsumableResponse; lang: string; flash: boolean; onAdjust: () => void }) {
  const { t } = useTranslation(['tools']);
  const low = consumable.status !== 'In Stock';
  const stockColor = consumable.status === 'Out of Stock' ? 'text-[#B3402A]' : consumable.status === 'Low Stock' ? 'text-[#C2410C]' : 'text-[#0B0A09]';

  const stockCell = (
    <div className="min-w-0">
      <div className="flex items-baseline gap-1.5">
        <span className={cn('font-bt-display font-extrabold text-[22px] leading-none tabular-nums', stockColor)}>{consumable.currentStock}</span>
        <Mono className="text-[9.5px] tracking-[0.06em] text-[#5A5346]">{consumable.unit}</Mono>
      </div>
      <StockBar stock={consumable.currentStock} minimum={consumable.minimumStock} light={consumable.status} className="mt-1.5" />
    </div>
  );

  return (
    <div
      role="button"
      tabIndex={0}
      data-testid={`consumable-row-${consumable.id}`}
      onClick={onAdjust}
      onKeyDown={e => { if (e.key === 'Enter') onAdjust(); }}
      className={cn(
        'border-b border-[#F0EBE1] border-l-[3px] cursor-pointer transition-colors bg-white hover:bg-[#FBF8F2] px-4 py-2.5 min-h-[56px]',
        flash && 'bt-row-flash',
        FOCUS_RING, 'focus-visible:outline-offset-[-2px]',
      )}
      style={{ borderLeftColor: LIGHT_EDGE[consumable.status] ?? '#CDBFA6' }}
    >
      <div className={cn(GRID, 'hidden xl:grid')}>
        <Code className="text-[11px] truncate">{consumable.code}</Code>
        <div className="min-w-0">
          <div className="text-[13.5px] font-semibold text-[#0B0A09] truncate">{consumable.name}</div>
          <Mono className="block text-[9px] tracking-[0.09em] text-[#A69C8D] mt-[2px] truncate">{consumable.unit}</Mono>
        </div>
        {stockCell}
        <div><LightChip light={consumable.status} /></div>
        {consumable.lastRestocked
          ? <Mono className="text-[10px] tracking-[0.06em] text-[#5A5346] truncate">{stampDay(consumable.lastRestocked, lang)}</Mono>
          : <CellEmpty>—</CellEmpty>}
        <Mono className={cn('text-[12px] tabular-nums text-right', low ? 'text-[#C2410C] font-semibold' : 'text-[#0B0A09]')}>{consumable.minimumStock}</Mono>
      </div>

      <div className={cn(GRID_MD, 'hidden md:grid xl:hidden')}>
        <Code className="text-[11px] truncate">{consumable.code}</Code>
        <div className="min-w-0">
          <div className="text-[13.5px] font-semibold text-[#0B0A09] truncate">{consumable.name}</div>
          <Mono className="block text-[9px] tracking-[0.09em] text-[#A69C8D] mt-[2px] truncate">
            {consumable.lastRestocked ? stampDay(consumable.lastRestocked, lang) : consumable.unit}
          </Mono>
        </div>
        {stockCell}
        <div><LightChip light={consumable.status} /></div>
        {/* The minimum stays: without it the bar cannot be read. */}
        <Mono className={cn('text-[12px] tabular-nums text-right', low ? 'text-[#C2410C] font-semibold' : 'text-[#0B0A09]')}>{consumable.minimumStock}</Mono>
      </div>

      <div className="md:hidden">
        <div className="flex items-center justify-between gap-2">
          <Code className="text-[11px]">{consumable.code}</Code>
          <LightChip light={consumable.status} />
        </div>
        <div className="text-[14.5px] font-semibold text-[#0B0A09] mt-1">{consumable.name}</div>
        <div className="flex items-baseline gap-1.5 mt-1.5">
          <span className={cn('font-bt-display font-extrabold text-[22px] leading-none tabular-nums', stockColor)}>{consumable.currentStock}</span>
          <Mono className="text-[9.5px] tracking-[0.06em] text-[#5A5346]">{consumable.unit}</Mono>
        </div>
        <StockBar stock={consumable.currentStock} minimum={consumable.minimumStock} light={consumable.status} className="mt-1.5" />
        <Mono className="block text-[9px] tracking-[0.08em] text-[#A69C8D] mt-1.5">
          {t('tools:table.minimum')} {consumable.minimumStock}
        </Mono>
      </div>
    </div>
  );
}
