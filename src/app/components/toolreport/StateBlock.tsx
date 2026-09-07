import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { cn } from '../ui/utils';
import { Bone, Mono } from '../projects/bt';
import { FOCUS_RING } from '../onboarding/chrome';
import { categoryName, Figure, statusName, StatusChip } from '../tools/bits';
import type { ToolReport } from '../../services/toolReport';
import { formatOneDecimal, formatTenths, largestRemainder } from './bits';
import { Bar, BlockHead, Panel, STATUS_EDGE, STATUS_FILL, TableHead, TotalRow } from './blocks';

/**
 * 01 — what I have and in what state.
 *
 * The first question, and the one the old screen answered wrong: the strip
 * counted five states while the total counted six, so the percentage column
 * stopped at 93.5 % and nobody could tell what was missing. The sixth —
 * awaiting acceptance, out of the warehouse and unsigned — is here with a
 * figure of its own, the column is rounded by largest remainder, and the total
 * row says 100.0 always.
 *
 * The figures are not buttons. In a report you do not filter by pressing a
 * number; you filter at the top, and the whole report is asked for again.
 */

const DIST = 'grid grid-cols-[minmax(120px,200px)_62px_66px_1fr] gap-3 items-center';
const CAT = 'grid grid-cols-[1fr_44px_52px_60px_18px] gap-2.5 items-center';

export function StateBlock({ report, loading, lang, onOpenTools }: {
  report: ToolReport | null;
  loading: boolean;
  lang: string;
  /** Opens Tools with this category already filtered. */
  onOpenTools: (category: string) => void;
}) {
  const { t } = useTranslation(['admin', 'tools']);
  const state = loading ? 'loading' : report ? 'ready' : 'failed';

  const statusShares = report ? largestRemainder(report.byStatus.map(s => s.count), report.total) : [];
  const categoryShares = report ? largestRemainder(report.byCategory.map(c => c.count), report.total) : [];
  const filtered = report != null && report.total !== report.totalInCompany;

  return (
    <section data-tour="sec.tool-report.state" data-testid="report-state">
      <BlockHead n={1} title={t('admin:toolReport.state.title')} note={t('admin:toolReport.state.note')} />

      {/* The seven cells: the total and the six that make it up. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 bg-white border border-[#E7E1D5] divide-x divide-[#EDE7DB]" data-testid="report-figures">
        <Figure
          state={state}
          value={report?.total}
          label={t('admin:toolReport.kpi.total')}
          note={t('admin:toolReport.kpi.total.note')}
        />
        {(report?.byStatus ?? Array.from({ length: 6 }, () => null)).map((row, i) => (
          <Figure
            key={row?.status ?? i}
            state={state}
            value={row?.count}
            label={row ? statusName(t, row.status) : ''}
            note={row?.status === 'Pending Acceptance' ? t('admin:toolReport.pending.note') : undefined}
            tone={row ? toneOf(row.status) : 'ink'}
            className={row?.status === 'Pending Acceptance' ? 'bg-[#FFFDFA]' : undefined}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.25fr_1fr] gap-3 mt-3">
        {/* The distribution */}
        <Panel>
          <div className="flex items-baseline justify-between gap-3 px-4 pt-3.5 pb-2.5">
            <Mono className="text-[10px] font-semibold tracking-[0.12em] text-[#0B0A09] uppercase">{t('admin:toolReport.byStatus.title')}</Mono>
            <Mono className="text-[9px] tracking-[0.08em] text-[#A69C8D]">
              {report ? t('admin:toolReport.byStatus.note', { count: report.total }) : ''}
            </Mono>
          </div>
          <TableHead grid={DIST}>
            <span>{t('admin:toolReport.table.status')}</span>
            <span className="text-right">{t('admin:toolReport.table.count')}</span>
            <span className="text-right">{t('admin:toolReport.table.percentage')}</span>
            <span>{t('admin:toolReport.table.share')}</span>
          </TableHead>

          {loading && Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="px-4 py-2.5 border-b border-[#F0EBE1]"><Bone className="w-full h-3" /></div>
          ))}

          {report?.byStatus.map((row, i) => (
            <div
              key={row.status}
              className={cn(DIST, 'px-4 h-9 border-b border-[#F0EBE1] border-l-[3px]')}
              style={{ borderLeftColor: STATUS_EDGE[row.status] ?? '#CDBFA6' }}
              data-testid={`status-row-${row.status.replace(/\s+/g, '-')}`}
            >
              <div className="min-w-0"><StatusChip status={row.status} short /></div>
              <Mono className="text-[12px] tabular-nums text-right text-[#0B0A09]">{row.count}</Mono>
              <Mono className="text-[12px] tabular-nums text-right text-[#0B0A09]">{formatTenths(statusShares[i] ?? 0, lang)}</Mono>
              <Bar tenths={statusShares[i] ?? 0} fill={STATUS_FILL[row.status] ?? '#0B0A09'} />
            </div>
          ))}

          {report && (
            <TotalRow
              grid={DIST}
              label={filtered ? t('admin:toolReport.table.totalFiltered') : t('admin:toolReport.table.total')}
              note={filtered
                ? t('admin:toolReport.table.totalFilteredNote', { total: report.totalInCompany })
                : t('admin:toolReport.table.totalNote')}
            >
              <Mono className="text-[12px] font-semibold tabular-nums text-right text-[#0B0A09]">{report.total}</Mono>
              <span data-testid="share-total" className="text-right">
                <Mono className="text-[12px] font-semibold tabular-nums text-[#0B0A09]">
                  {formatTenths(statusShares.reduce((a, b) => a + b, 0), lang)}
                </Mono>
              </span>
            </TotalRow>
          )}
        </Panel>

        <div className="space-y-3">
          {/* The two derived figures */}
          <div className="grid grid-cols-2 bg-white border border-[#E7E1D5] divide-x divide-[#EDE7DB]">
            <Figure
              state={state}
              value={undefined}
              text={report ? `${formatTenths(share(report.outOfWarehouse, report.total), lang)} %` : undefined}
              label={t('admin:toolReport.kpi.outOfWarehouse')}
              note={report ? t('admin:toolReport.kpi.outOfWarehouse.note', { count: report.outOfWarehouse, total: report.total }) : undefined}
              className="[&_.tabular-nums]:text-[34px]"
            />
            <Figure
              state={state}
              value={undefined}
              // The unit is inside the display and translated together with the
              // number: split into a label beside it, "8,4 días" was coming out
              // in Spanish as "8.4 days".
              text={report?.avgDaysOut != null
                ? t('admin:toolReport.days', { count: report.avgDaysOut, value: formatOneDecimal(report.avgDaysOut, lang) })
                : '—'}
              label={t('admin:toolReport.kpi.avgDaysOut')}
              note={report ? t('admin:toolReport.kpi.avgDaysOut.note', { count: report.outOfWarehouse }) : undefined}
              className="[&_.tabular-nums]:text-[34px]"
            />
          </div>

          {/* By category */}
          <Panel>
            <div className="flex items-baseline justify-between gap-3 px-4 pt-3.5 pb-2.5">
              <Mono className="text-[10px] font-semibold tracking-[0.12em] text-[#0B0A09] uppercase">{t('admin:toolReport.byCategory.title')}</Mono>
              <Mono className="text-[9px] tracking-[0.08em] text-[#A69C8D]">{t('admin:toolReport.byCategory.note')}</Mono>
            </div>
            <TableHead grid={CAT}>
              <span>{t('admin:toolReport.byCategory.col.category')}</span>
              <span className="text-right">{t('admin:toolReport.table.count')}</span>
              <span className="text-right">{t('admin:toolReport.table.percentage')}</span>
              <span className="text-right">{t('admin:toolReport.byCategory.col.out')}</span>
              <span />
            </TableHead>

            {loading && Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="px-4 py-2.5 border-b border-[#F0EBE1]"><Bone className="w-full h-3" /></div>
            ))}

            {report?.byCategory.map((row, i) => (
              <CategoryRow
                key={row.category}
                category={row.category}
                count={row.count}
                out={row.out}
                tenths={categoryShares[i] ?? 0}
                lang={lang}
                onOpenTools={() => onOpenTools(row.category)}
              />
            ))}

            {report && (
              <TotalRow grid={CAT} label={t('admin:toolReport.byCategory.enum')}>
                <Mono className="text-[12px] font-semibold tabular-nums text-right text-[#0B0A09]">{report.total}</Mono>
                <Mono className="text-[12px] font-semibold tabular-nums text-right text-[#0B0A09]">
                  {formatTenths(categoryShares.reduce((a, b) => a + b, 0), lang)}
                </Mono>
                <Mono className="text-[12px] font-semibold tabular-nums text-right text-[#0B0A09]">{report.outOfWarehouse}</Mono>
              </TotalRow>
            )}
          </Panel>
        </div>
      </div>
    </section>
  );
}

function CategoryRow({ category, count, out, tenths, lang, onOpenTools }: {
  category: string;
  count: number;
  out: number;
  tenths: number;
  lang: string;
  onOpenTools: () => void;
}) {
  const { t } = useTranslation(['admin', 'tools']);
  const [open, setOpen] = useState(false);
  const empty = count === 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className={cn(CAT, 'w-full px-4 py-2 border-b border-[#F0EBE1] text-left transition-colors hover:bg-[#FBF8F2]', FOCUS_RING, 'focus-visible:outline-offset-[-2px]')}
      >
        <span className="text-[13px] font-semibold text-[#0B0A09] truncate">{categoryName(t, category)}</span>
        <Mono className="text-[12px] tabular-nums text-right text-[#0B0A09]">{count}</Mono>
        <Mono className="text-[12px] tabular-nums text-right text-[#0B0A09]">{formatTenths(tenths, lang)}</Mono>
        <Mono className={cn('text-[12px] tabular-nums text-right', out > 0 ? 'text-[#C2410C] font-semibold' : 'text-[#A69C8D]')}>{out}</Mono>
        {open
          ? <ChevronDown className="w-3.5 h-3.5 text-[#C2410C]" strokeWidth={2.2} />
          : <ChevronRight className="w-3.5 h-3.5 text-[#A69C8D]" strokeWidth={2.2} />}
      </button>

      {open && (
        <div className="px-4 py-3 bg-[#FBF8F2] border-b border-[#F0EBE1]">
          {empty ? (
            <Mono className="text-[10px] tracking-[0.08em] text-[#A69C8D]">{t('admin:toolReport.byCategory.none')}</Mono>
          ) : (
            // The rows themselves are not listed here: the report counts, and
            // Tools is where a tool is looked at. The link carries the filter.
            <button
              type="button"
              onClick={onOpenTools}
              className={cn('inline-flex items-center gap-1.5 font-bt-mono text-[9.5px] uppercase tracking-[0.1em] font-semibold text-[#C2410C] hover:text-[#F97316]', FOCUS_RING)}
            >
              {t('admin:toolReport.byCategory.seeAll', { count })}
              <ExternalLink className="w-3 h-3" strokeWidth={2.2} />
            </button>
          )}
        </div>
      )}
    </>
  );
}

/** Tenths of a percent, the same rule the column uses for a single figure. */
function share(part: number, total: number): number {
  return total <= 0 ? 0 : Math.round((part * 1000) / total);
}

function toneOf(status: string): 'ink' | 'orange' | 'red' | 'green' {
  if (status === 'Available') return 'green';
  if (status === 'Pending Acceptance') return 'orange';
  if (status === 'Damaged' || status === 'Lost') return 'red';
  return 'ink';
}
