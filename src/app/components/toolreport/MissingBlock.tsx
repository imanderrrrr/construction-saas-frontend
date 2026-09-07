import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../ui/utils';
import { Bone, EmptyWord, Mono } from '../projects/bt';
import { FOCUS_RING } from '../onboarding/chrome';
import { Code } from '../tools/bits';
import type { ToolReportMissingRow, ToolReportMissingSummary } from '../../services/toolReport';
import { stampDay } from './bits';
import { BlockHead, DaysChip, Panel, TableHead } from './blocks';

/**
 * 02 — what hasn't come back.
 *
 * The section's own blurb promised "spot the tools that never came back", and
 * until now that only showed as the colour of one column. It is a block: two
 * reasons, one figure and the list that gets chased this week, with a name and
 * a project on every row.
 *
 * Damaged and lost are not here. They are not out — their status already says
 * where they ended up — and putting them on a list of things to recover would
 * make the list stop being actionable.
 */

const GRID = 'grid grid-cols-[84px_1fr_168px_156px_96px_104px] gap-3 items-center';
const GRID_MD = 'grid grid-cols-[80px_1fr_150px_96px] gap-3 items-center';

export function MissingBlock({ summary, outOfWarehouse, rows, loading, failed, lang, page, totalPages, total, onPage, onOpenTool }: {
  summary: ToolReportMissingSummary | null;
  /** Tools out of the warehouse: the set this list is a subset of. */
  outOfWarehouse: number;
  rows: ToolReportMissingRow[];
  loading: boolean;
  failed: boolean;
  lang: string;
  page: number;
  totalPages: number;
  total: number;
  onPage: (page: number) => void;
  onOpenTool: (row: ToolReportMissingRow) => void;
}) {
  const { t } = useTranslation(['admin', 'tools']);
  const empty = summary != null && summary.total === 0;

  return (
    <section data-tour="sec.tool-report.missing" data-testid="report-missing">
      <BlockHead n={2} tone="orange" title={t('admin:toolReport.missing.title')} note={t('admin:toolReport.missing.note')} />

      <div className="bg-white border border-[#E7E1D5] border-t-[3px] border-t-[#F97316]">
        <div className="flex flex-col xl:flex-row">
          {/* The figure and the two reasons */}
          <div className="w-full xl:w-[270px] flex-shrink-0 px-4 py-4 border-b xl:border-b-0 xl:border-r border-[#EDE7DB]">
            <div className="font-bt-display font-extrabold text-[56px] leading-[0.85] tabular-nums text-[#C2410C]" data-testid="missing-count">
              {loading ? <Bone className="w-20 h-10" /> : failed ? <span className="text-[#CDBFA6]">—</span> : summary?.total ?? 0}
            </div>
            <Mono className="block text-[9.5px] tracking-[0.1em] text-[#5A5346] mt-2">{t('admin:toolReport.missing.count')}</Mono>
            {summary && summary.total > 0 && (
              <p className="text-[12px] leading-[1.5] text-[#8A8175] mt-1.5">
                {t('admin:toolReport.missing.count.note', { count: outOfWarehouse })}
              </p>
            )}

            <div className="grid grid-cols-2 gap-2.5 mt-4">
              <Reason
                label={t('admin:toolReport.missing.unsigned')}
                note={summary ? t('admin:toolReport.missing.unsigned.note', { count: summary.unsignedOver48h }) : ''}
                value={summary?.unsigned}
                loading={loading}
              />
              <Reason
                label={t('admin:toolReport.missing.overdue')}
                note={summary?.oldestDays != null ? t('admin:toolReport.missing.overdue.note', { count: summary.oldestDays }) : ''}
                value={summary?.overdue}
                loading={loading}
              />
            </div>

            <p className="text-[11.5px] leading-[1.5] text-[#8A8175] mt-4">{t('admin:toolReport.missing.footnote')}</p>
          </div>

          {/* The list */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-3 px-4 pt-3.5 pb-2.5">
              <Mono className="text-[10px] font-semibold tracking-[0.12em] text-[#0B0A09] uppercase">
                {t('admin:toolReport.missing.list', { count: total })}
              </Mono>
              <Mono className="text-[9px] tracking-[0.08em] text-[#A69C8D] hidden sm:inline">{t('admin:toolReport.missing.legend')}</Mono>
            </div>

            {empty ? (
              <EmptyWord
                word={t('admin:toolReport.missing.empty.word')}
                title={t('admin:toolReport.missing.empty.lead')}
                className="border-0 py-[52px]"
              />
            ) : (
              <>
                <TableHead grid={GRID}>
                  <span className="hidden xl:block">{t('admin:toolReport.missing.col.code')}</span>
                  <span className="hidden xl:block">{t('admin:toolReport.missing.col.tool')}</span>
                  <span className="hidden xl:block">{t('admin:toolReport.missing.col.holder')}</span>
                  <span className="hidden xl:block">{t('admin:toolReport.missing.col.project')}</span>
                  <span className="hidden xl:block">{t('admin:toolReport.missing.col.since')}</span>
                  <span className="hidden xl:block text-right">{t('admin:toolReport.missing.col.days')}</span>
                </TableHead>

                {loading && Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="px-4 py-3 border-b border-[#F0EBE1] space-y-2">
                    <Bone className="w-[35%] h-3" /><Bone className="w-[55%] h-[7px]" />
                  </div>
                ))}

                {!loading && rows.map(row => (
                  <Row key={row.toolId} row={row} lang={lang} onOpen={() => onOpenTool(row)} />
                ))}

                {!loading && totalPages > 1 && (
                  <div className="flex items-center justify-between gap-3 px-4 h-[38px] border-t border-[#EDE7DB]">
                    <Mono className="text-[10px] tracking-[0.06em] text-[#8A8175]">
                      {t('admin:toolReport.missing.list', { count: total })}
                    </Mono>
                    <div className="flex items-center gap-1.5">
                      <PageButton onClick={() => onPage(page - 1)} disabled={page === 0} label="←"><ChevronLeft className="w-3 h-3" strokeWidth={2.4} /></PageButton>
                      <Mono className="text-[10.5px] tabular-nums text-[#0B0A09] min-w-[54px] text-center">{page + 1} / {totalPages}</Mono>
                      <PageButton onClick={() => onPage(page + 1)} disabled={page >= totalPages - 1} label="→"><ChevronRight className="w-3 h-3" strokeWidth={2.4} /></PageButton>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Reason({ label, note, value, loading }: { label: string; note: string; value: number | undefined; loading: boolean }) {
  return (
    <div className="bg-[#FBF8F2] border border-[#EDE7DB] px-3 py-2.5">
      <div className="font-bt-display font-extrabold text-[30px] leading-[0.85] tabular-nums text-[#0B0A09]">
        {loading ? <Bone className="w-8 h-6" /> : value ?? '—'}
      </div>
      <Mono className="block text-[9px] font-semibold tracking-[0.09em] text-[#5A5346] mt-1.5">{label}</Mono>
      {note && <Mono className="block text-[8.5px] tracking-[0.08em] text-[#A69C8D] mt-[3px]">{note}</Mono>}
    </div>
  );
}

function Row({ row, lang, onOpen }: { row: ToolReportMissingRow; lang: string; onOpen: () => void }) {
  const { t } = useTranslation(['admin']);

  // Unsigned says how long in its own words: it is a paperwork problem
  // measured in hours, not the same clock as "out too long".
  const unsignedLine = row.unsigned
    ? (row.daysOut == null
        ? t('admin:toolReport.missing.noDate')
        : row.daysOut === 0
          ? t('admin:toolReport.missing.unsignedToday')
          : t('admin:toolReport.missing.unsignedFor', { count: row.daysOut }))
    : null;

  return (
    <div
      role="button"
      tabIndex={0}
      data-testid={`missing-row-${row.toolId}`}
      onClick={onOpen}
      onKeyDown={e => { if (e.key === 'Enter') onOpen(); }}
      className={cn(
        'border-b border-[#F0EBE1] px-4 py-2.5 min-h-[46px] cursor-pointer transition-colors hover:bg-[#FBF8F2]',
        FOCUS_RING, 'focus-visible:outline-offset-[-2px]',
      )}
    >
      <div className={cn(GRID, 'hidden xl:grid')}>
        <Code className="text-[11px] truncate">{row.code}</Code>
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-[#0B0A09] truncate">{row.name}</div>
          {unsignedLine && <Mono className="block text-[9px] tracking-[0.08em] text-[#C2410C] mt-[2px] truncate">{unsignedLine}</Mono>}
        </div>
        <span className="text-[12.5px] text-[#0B0A09] truncate">{row.worker ?? '—'}</span>
        <span className="text-[12px] text-[#5A5346] truncate">{row.project ?? '—'}</span>
        <Mono className="text-[10px] tracking-[0.05em] uppercase text-[#5A5346] truncate">
          {row.outSince ? stampDay(row.outSince, lang) : '—'}
        </Mono>
        <div className="text-right"><DaysChip days={row.daysOut} /></div>
      </div>

      <div className={cn(GRID_MD, 'hidden md:grid xl:hidden')}>
        <Code className="text-[11px] truncate">{row.code}</Code>
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-[#0B0A09] truncate">{row.name}</div>
          <Mono className="block text-[9px] tracking-[0.08em] text-[#8A8175] mt-[2px] truncate">
            {[row.worker, row.project].filter(Boolean).join(' · ')}
          </Mono>
        </div>
        <Mono className="text-[10px] tracking-[0.05em] uppercase text-[#5A5346] truncate">
          {row.outSince ? stampDay(row.outSince, lang) : '—'}
        </Mono>
        <div className="text-right"><DaysChip days={row.daysOut} /></div>
      </div>

      <div className="md:hidden">
        <div className="flex items-start justify-between gap-2">
          <Code className="text-[11px]">{row.code}</Code>
          <DaysChip days={row.daysOut} />
        </div>
        <div className="text-[14px] font-semibold text-[#0B0A09] mt-1">{row.name}</div>
        <Mono className="block text-[9.5px] tracking-[0.08em] text-[#8A8175] mt-1 truncate">
          {[row.worker, row.project].filter(Boolean).join(' · ')}
        </Mono>
        {unsignedLine && <Mono className="block text-[9px] tracking-[0.08em] text-[#C2410C] mt-1">{unsignedLine}</Mono>}
      </div>
    </div>
  );
}

function PageButton({ onClick, disabled, label, children }: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'w-[30px] h-[30px] border border-[#DBD0BB] bg-[#FAF7F0] flex items-center justify-center text-[#0B0A09]',
        'hover:border-[#F97316] hover:text-[#C2410C] disabled:text-[#B4A992] disabled:hover:border-[#DBD0BB] disabled:cursor-not-allowed',
        FOCUS_RING,
      )}
    >
      {children}
    </button>
  );
}
