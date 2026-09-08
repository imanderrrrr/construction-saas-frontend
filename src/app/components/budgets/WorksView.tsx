import { useTranslation } from 'react-i18next';
import { MoreVertical } from 'lucide-react';
import { cn } from '../ui/utils';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { FOCUS_RING } from '../onboarding/chrome';
import { EmptyWord, Mono } from '../projects/bt';
import {
  execPct, gaugeTone, money, pct as fmtPct, urgentRows, URGENT_LIMIT, type BudgetRow,
} from './bits';
import { Amount, BlockHead, CountChip, Gauge, JobsiteCell, TableSkeleton } from './ui';

/**
 * La vista de obras (Claude Design "Presupuestos BuildTrack", boards 01–03).
 *
 * Four figures, what is urgent above the list, and the three numbers plus the
 * margin on every row with their names attached. The gauge divides spend by
 * the cost budget; when a jobsite has none it falls back to the contract and
 * says so three times over, because measuring spend against the SALE price is
 * what made every jobsite look comfortable.
 */

const COLS_ADMIN = '1.7fr .9fr 1.05fr .9fr .95fr 1.35fr 36px';
const COLS_READ  = '1.9fr 1fr 1.05fr .9fr .95fr 1.35fr';

export interface WorksActions {
  onDetail: (row: BudgetRow) => void;
  onAdjust: (row: BudgetRow) => void;
  onHistory: (row: BudgetRow) => void;
  onClose: (row: BudgetRow) => void;
  /** Applies the risk filter — the urgency block's "see all" footer. */
  onShowRisk: () => void;
}

export function WorksView({ rows, total, loading, readOnly, filtered, onResetFilters, actions }: {
  rows: BudgetRow[];
  /** How many jobsites exist before the filters — the empty state says so. */
  total: number;
  loading: boolean;
  readOnly: boolean;
  filtered: boolean;
  onResetFilters: () => void;
  actions: WorksActions;
}) {
  const { t, i18n } = useTranslation(['admin', 'common']);
  const lang = i18n.language;
  const cols = readOnly ? COLS_READ : COLS_ADMIN;
  const urgent = urgentRows(rows);

  return (
    <div className="space-y-3">
      {/* Lo urgente, arriba. Only jobsites with a cost budget: the others are
          being compared to their sale price and do not belong in a warning. */}
      {!loading && urgent.length > 0 && (
        <div className="bg-white border border-[#E7E1D5] border-t-[3px] border-t-[#F97316]">
          <BlockHead
            title={t('admin:budgets.urgent.title')}
            hint={t('admin:budgets.urgent.hint')}
            right={<CountChip>{t('admin:budgets.urgent.count', { count: urgent.length })}</CountChip>}
          />
          {urgent.slice(0, URGENT_LIMIT).map(row => {
            const pctValue = execPct(row);
            const tone = gaugeTone(pctValue);
            const left = (row.costBudget ?? 0) - row.consumed;
            return (
              <div
                key={row.id}
                className={cn(
                  'grid gap-3.5 items-center px-[18px] py-2.5 border-t border-[#F0EBE1] grid-cols-2',
                  'lg:[grid-template-columns:1.6fr_1fr_1fr_1.5fr_132px]',
                  tone === 'over' ? 'border-l-[3px] border-l-[#B3402A] bg-[#FBF8F2]' : 'border-l-[3px] border-l-[#F97316]',
                )}
              >
                <JobsiteCell name={row.name} client={row.clientName} costCode={row.costCode} />
                <Stat value={money(row.consumed)} label={t('admin:budgets.metric.spent.short')} />
                <Stat value={money(row.costBudget ?? 0)} label={t('admin:budgets.metric.costBudget.short')} />
                <div>
                  <div className="flex items-baseline justify-between gap-2">
                    <Mono className={cn('text-[12px] font-semibold tabular-nums', tone === 'over' ? 'text-[#B3402A]' : 'text-[#C2410C]')}>
                      {fmtPct(pctValue, lang)} %
                    </Mono>
                    <Mono className={cn('text-[9.5px] tracking-[0.06em]', tone === 'over' ? 'text-[#B3402A]' : 'text-[#C2410C]')}>
                      {left < 0
                        ? t('admin:budgets.urgent.over', { amount: money(-left) })
                        : t('admin:budgets.urgent.left', { amount: money(left) })}
                    </Mono>
                  </div>
                  <div className="h-[7px] mt-[5px] flex bg-[#F3EEE4] border border-[#EDE7DB]">
                    <div className={tone === 'over' ? 'bg-[#B3402A]' : 'bg-[#F97316]'} style={{ width: `${Math.min(pctValue, 100)}%` }} />
                  </div>
                </div>
                <Mono
                  className={cn(
                    'text-[9.5px] tracking-[0.1em] px-2 py-1 justify-self-start lg:justify-self-end whitespace-nowrap',
                    tone === 'over' ? 'bg-[#B3402A] text-white' : 'bg-[#FBEDE0] border border-[#F97316] text-[#C2410C]',
                  )}
                >
                  {t(tone === 'over' ? 'admin:budgets.badge.over' : 'admin:budgets.badge.limit')}
                </Mono>
              </div>
            );
          })}
          {urgent.length > URGENT_LIMIT && (
            <button
              type="button"
              onClick={actions.onShowRisk}
              className={cn(
                'w-full text-left border-t border-[#F0EBE1] px-[18px] py-2.5 font-bt-mono text-[9.5px] font-semibold uppercase tracking-[0.1em] text-[#C2410C] hover:text-[#F97316]',
                FOCUS_RING,
              )}
            >
              {t('admin:budgets.urgent.more', { count: urgent.length - URGENT_LIMIT })}
            </button>
          )}
        </div>
      )}

      {/* La lista */}
      <div className="bg-white border border-[#E7E1D5]">
        <div
          className="hidden lg:grid gap-3 px-[18px] py-2.5 bg-[#FBF8F2] border-b border-[#EDE7DB] font-bt-mono text-[9.5px] uppercase tracking-[0.12em] text-[#8A8175]"
          style={{ gridTemplateColumns: cols }}
        >
          <span>{t('admin:budgets.col.jobsite')}</span>
          <span className="text-right">{t('admin:budgets.col.contract')}</span>
          <span className="text-right">{t('admin:budgets.col.costBudget')}</span>
          <span className="text-right">{t('admin:budgets.col.spent')}</span>
          <span className="text-right">{t('admin:budgets.col.margin')}</span>
          <span>{t('admin:budgets.col.execution')}</span>
          {!readOnly && <span />}
        </div>

        {loading ? (
          <TableSkeleton cols={cols} />
        ) : rows.length === 0 ? (
          <EmptyWord
            word={t(filtered ? 'admin:budgets.empty.noMatch.word' : 'admin:budgets.empty.none.word')}
            title={t(filtered ? 'admin:budgets.empty.noMatch.lead' : 'admin:budgets.empty.none.lead')}
            hint={t(filtered ? 'admin:budgets.empty.noMatch.body' : 'admin:budgets.empty.none.body', { count: total })}
            className="border-0"
            action={filtered ? (
              <button
                type="button"
                onClick={onResetFilters}
                className={cn('font-bt-mono text-[9.5px] font-semibold uppercase tracking-[0.1em] text-[#C2410C] hover:text-[#F97316]', FOCUS_RING)}
              >
                {t('admin:budgets.filter.reset')}
              </button>
            ) : undefined}
          />
        ) : (
          rows.map(row => (
            <WorksRow key={row.id} row={row} cols={cols} lang={lang} readOnly={readOnly} actions={actions} />
          ))
        )}
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <Mono className="block text-[12.5px] tabular-nums text-[#0B0A09] normal-case">{value}</Mono>
      <Mono className="block text-[9px] tracking-[0.08em] text-[#A69C8D] mt-0.5">{label}</Mono>
    </div>
  );
}

function WorksRow({ row, cols, lang, readOnly, actions }: {
  row: BudgetRow;
  cols: string;
  lang: string;
  readOnly: boolean;
  actions: WorksActions;
}) {
  const { t } = useTranslation(['admin', 'common']);
  const fallback = row.costBudget == null;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => actions.onDetail(row)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); actions.onDetail(row); } }}
      className={cn(
        'grid gap-3 items-center px-[18px] py-3 border-b border-[#F0EBE1] last:border-b-0 cursor-pointer',
        'border-l-2 border-l-transparent hover:bg-[#FBF8F2] hover:border-l-[#F97316] transition-colors',
        'grid-cols-2 lg:[grid-template-columns:var(--bt-cols)]',
        row.closed && 'opacity-[0.72]',
        FOCUS_RING,
      )}
      style={{ '--bt-cols': cols } as React.CSSProperties}
    >
      <div className="flex items-center gap-2 min-w-0">
        <JobsiteCell name={row.name} client={row.clientName} costCode={row.costCode} />
        {row.closed && (
          <Mono className="text-[9px] tracking-[0.1em] border border-[#DBD0BB] text-[#8A8175] px-1.5 py-[3px] flex-shrink-0">
            {t('admin:budgets.badge.closed')}
          </Mono>
        )}
      </div>
      <Amount>{money(row.contract)}</Amount>
      {/* Never a dash and never a zero: a cost budget that was never typed is
          a different thing from one that is zero. */}
      {fallback
        ? <Mono className="text-[10px] tracking-[0.06em] text-[#A69C8D] text-right">{t('admin:budgets.noCostBudget')}</Mono>
        : <Amount>{money(row.costBudget ?? 0)}</Amount>}
      <Amount>{money(row.consumed)}</Amount>
      <Amount tone={row.margin < 0 ? 'red' : 'green'}>{money(row.margin)}</Amount>
      <Gauge pctValue={execPct(row)} fallback={fallback} lang={lang} />
      {!readOnly && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={t('admin:budgets.rowActions', { project: row.name })}
              onClick={e => e.stopPropagation()}
              className={cn(
                'w-7 h-7 flex items-center justify-center border border-[#DBD0BB] bg-white text-[#5A5346] hover:border-[#F97316] hover:text-[#C2410C] transition-colors flex-shrink-0 justify-self-end',
                FOCUS_RING,
              )}
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-[248px] rounded-none border-[#CDBFA6] p-0 shadow-[0_16px_48px_rgba(23,19,15,0.3)]"
            onClick={e => e.stopPropagation()}
          >
            <DropdownMenuLabel className="font-bt-mono text-[9.5px] font-normal uppercase tracking-[0.14em] text-[#8A8175] px-3.5 pt-2.5 pb-2 border-b border-[#EDE7DB] truncate">
              {row.name}
            </DropdownMenuLabel>
            {([
              { key: 'detail', label: t('admin:budgets.menu.detail'), onClick: () => actions.onDetail(row) },
              // A closed jobsite cannot be modified — the backend rejects it
              // with PROJECT_CLOSED — so the menu does not offer it.
              !row.closed && { key: 'adjust', label: t('admin:budgets.menu.adjust'), onClick: () => actions.onAdjust(row) },
              { key: 'history', sep: true, label: t('admin:budgets.menu.history'), onClick: () => actions.onHistory(row) },
              !row.closed && { key: 'close', danger: true, label: t('admin:budgets.menu.close'), onClick: () => actions.onClose(row) },
            ] as Array<false | { key: string; label: string; onClick: () => void; danger?: boolean; sep?: boolean }>)
              .filter((item): item is { key: string; label: string; onClick: () => void; danger?: boolean; sep?: boolean } => !!item)
              .map(item => (
                <DropdownMenuItem
                  key={item.key}
                  onClick={item.onClick}
                  className={cn(
                    'rounded-none cursor-pointer px-3.5 py-[11px] font-bt-mono text-[10.5px] uppercase tracking-[0.08em] border-l-2 border-l-transparent focus:bg-[#F3EEE4] focus:border-l-[#F97316] data-[highlighted]:bg-[#F3EEE4]',
                    item.sep && 'border-t border-t-[#EDE7DB]',
                    item.danger ? 'text-[#B3402A] focus:text-[#B3402A] focus:border-l-[#B3402A]' : 'text-[#0A0A0A] focus:text-[#0A0A0A]',
                  )}
                >
                  {item.label}
                </DropdownMenuItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
