import { useTranslation } from 'react-i18next';
import { cn } from '../ui/utils';
import { Bone, Mono } from '../projects/bt';
import { Code, Figure, LightChip, StockBar } from '../tools/bits';
import type { ConsumableResponse } from '../../services/warehouse';
import type { ToolReportSupplies } from '../../services/toolReport';
import { largestRemainder } from './bits';
import { Bar, BlockHead, Panel, TableHead } from './blocks';

/**
 * 04 — what's being used up.
 *
 * Supplies used to open the screen with four figures of their own, which made
 * the whole report look like a supplies report. They answer the least urgent
 * question — what runs out gets restocked, not chased — so they come fourth.
 *
 * And they come whole: the filters at the top are TOOL filters, and a tool
 * category means nothing to a box of screws. Narrowing supplies by one of them
 * would be inventing a relationship; the block says so instead.
 */

const RESTOCK = 'grid grid-cols-[76px_1fr_150px_108px] gap-3 items-center';
const USED = 'grid grid-cols-[1fr_92px_minmax(60px,1fr)] gap-3 items-center';

export function SuppliesBlock({ supplies, restock, loading, failed }: {
  supplies: ToolReportSupplies | null;
  /** The ones at or below their minimum, from the inventory's own search. */
  restock: ConsumableResponse[];
  loading: boolean;
  failed: boolean;
}) {
  const { t } = useTranslation(['admin', 'tools']);
  const state = loading ? 'loading' : supplies ? 'ready' : 'failed';
  const usedShares = supplies
    ? largestRemainder(supplies.topUsed.map(u => u.quantity), supplies.topUsed.reduce((a, b) => a + b.quantity, 0))
    : [];

  return (
    <section data-testid="report-supplies">
      <BlockHead
        n={4}
        title={t('admin:toolReport.supplies.title')}
        note={supplies
          ? t('admin:toolReport.supplies.note', { items: supplies.total, dispatches: supplies.dispatches })
          : undefined}
      />

      <Mono className="block text-[9.5px] tracking-[0.08em] text-[#A69C8D] mb-2.5">{t('admin:toolReport.supplies.categoryNote')}</Mono>

      <div className="grid grid-cols-2 xl:grid-cols-4 bg-white border border-[#E7E1D5] divide-x divide-[#EDE7DB]" data-testid="supplies-figures">
        <Figure state={state} value={supplies?.total} label={t('admin:toolReport.supplies.kpi.total')} />
        <Figure state={state} value={supplies?.inStock} label={t('admin:toolReport.supplies.kpi.inStock')} tone="green" />
        <Figure state={state} value={supplies?.lowStock} label={t('admin:toolReport.supplies.kpi.lowStock')} tone="orange" />
        <Figure
          state={state}
          value={supplies?.outOfStock}
          label={t('admin:toolReport.supplies.kpi.outOfStock')}
          note={t('admin:toolReport.supplies.kpi.outOfStock.note')}
          tone="red"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 mt-3">
        {/* What has to be reordered */}
        <Panel>
          <div className="flex items-baseline justify-between gap-3 px-4 pt-3.5 pb-2.5">
            <Mono className="text-[10px] font-semibold tracking-[0.12em] text-[#0B0A09] uppercase">
              {t('admin:toolReport.supplies.restock')}
              {restock.length > 0 && <span className="text-[#C2410C]"> · {restock.length}</span>}
            </Mono>
            <Mono className="text-[9px] tracking-[0.08em] text-[#A69C8D] hidden sm:inline">{t('admin:toolReport.supplies.restock.note')}</Mono>
          </div>
          <TableHead grid={RESTOCK}>
            <span>{t('admin:toolReport.supplies.col.code')}</span>
            <span>{t('admin:toolReport.supplies.col.item')}</span>
            <span>{t('admin:toolReport.supplies.col.stock')}</span>
            <span>{t('admin:toolReport.supplies.col.light')}</span>
          </TableHead>

          {loading && Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="px-4 py-2.5 border-b border-[#F0EBE1]"><Bone className="w-full h-3" /></div>
          ))}

          {!loading && restock.length === 0 && (
            <div className="px-4 py-5 text-center">
              <Mono className="text-[10px] tracking-[0.08em] text-[#A69C8D]">{t('admin:toolReport.supplies.restock.empty')}</Mono>
            </div>
          )}

          {!loading && restock.map(item => (
            <div key={item.id} className={cn(RESTOCK, 'px-4 py-2 border-b border-[#F0EBE1] last:border-b-0 min-h-[44px]')}>
              <Code className="text-[11px] truncate">{item.code}</Code>
              <span className="text-[12.5px] font-semibold text-[#0B0A09] truncate">{item.name}</span>
              <div className="min-w-0">
                <div className="flex items-baseline gap-1.5">
                  <span className={cn(
                    'font-bt-display font-extrabold text-[18px] leading-none tabular-nums',
                    item.status === 'Out of Stock' ? 'text-[#B3402A]' : 'text-[#C2410C]',
                  )}>
                    {item.currentStock}
                  </span>
                  <Mono className="text-[9px] tracking-[0.06em] text-[#8A8175]">
                    {t('admin:toolReport.supplies.ofMin', { count: item.minimumStock })}
                  </Mono>
                </div>
                <StockBar stock={item.currentStock} minimum={item.minimumStock} light={item.status} className="mt-1" />
              </div>
              <div><LightChip light={item.status} /></div>
            </div>
          ))}
        </Panel>

        {/* What gets used up */}
        <Panel>
          <div className="flex items-baseline justify-between gap-3 px-4 pt-3.5 pb-2.5">
            <Mono className="text-[10px] font-semibold tracking-[0.12em] text-[#0B0A09] uppercase">{t('admin:toolReport.supplies.topUsed')}</Mono>
            <Mono className="text-[9px] tracking-[0.08em] text-[#A69C8D]">{t('admin:toolReport.supplies.topUsed.note')}</Mono>
          </div>
          <TableHead grid={USED}>
            <span>{t('admin:toolReport.supplies.col.item')}</span>
            <span className="text-right">{t('admin:toolReport.supplies.col.dispatched')}</span>
            <span>{t('admin:toolReport.table.share')}</span>
          </TableHead>

          {(loading || failed) && Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="px-4 py-2.5 border-b border-[#F0EBE1]"><Bone className="w-full h-3" /></div>
          ))}

          {supplies && supplies.topUsed.length === 0 && (
            <div className="px-4 py-5 text-center">
              <Mono className="text-[10px] tracking-[0.08em] text-[#A69C8D]">{t('admin:toolReport.supplies.topUsed.empty')}</Mono>
            </div>
          )}

          {supplies?.topUsed.map((row, i) => (
            <div key={row.consumableId} className={cn(USED, 'px-4 h-9 border-b border-[#F0EBE1] last:border-b-0')}>
              <span className="text-[12.5px] font-semibold text-[#0B0A09] truncate">{row.name}</span>
              <Mono className="text-[12px] tabular-nums text-right text-[#0B0A09] truncate">{row.quantity} {row.unit}</Mono>
              <Bar tenths={usedShares[i] ?? 0} fill="#0B0A09" />
            </div>
          ))}
        </Panel>
      </div>
    </section>
  );
}
