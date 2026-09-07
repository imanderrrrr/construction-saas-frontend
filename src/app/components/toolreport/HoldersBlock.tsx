import { useTranslation } from 'react-i18next';
import { cn } from '../ui/utils';
import { Bone, EmptyWord, Mono } from '../projects/bt';
import type { ToolReport } from '../../services/toolReport';
import { initials, largestRemainder } from './bits';
import { Bar, BlockHead, DaysChip, Panel, TableHead, TotalRow } from './blocks';

/**
 * 03 — who has what.
 *
 * This used to be a flat table of every tool that is out: to know how many are
 * on one site you had to count them by hand. It starts with the two
 * breakdowns instead — twelve lines that are read at a glance — and the
 * "unsigned" column sits right beside "out", because that is the one that says
 * on which site the paperwork is going missing, and who to have that
 * conversation with.
 *
 * The five workers with the most are shown, not all of them: the point is to
 * decide who to call, and eighteen rows is a list, not a decision.
 */

const PROJECT = 'grid grid-cols-[1fr_58px_60px_minmax(60px,1fr)] gap-3 items-center';
const WORKER = 'grid grid-cols-[1fr_62px_66px_90px] gap-3 items-center';
const TOP_WORKERS = 5;

export function HoldersBlock({ report, loading, failed }: {
  report: ToolReport | null;
  loading: boolean;
  failed: boolean;
}) {
  const { t } = useTranslation(['admin']);
  const empty = report != null && report.outOfWarehouse === 0;
  const projectShares = report ? largestRemainder(report.byProject.map(p => p.out), report.outOfWarehouse) : [];
  const workers = report?.byWorker.slice(0, TOP_WORKERS) ?? [];

  return (
    <section data-testid="report-holders">
      <BlockHead
        n={3}
        title={t('admin:toolReport.holders.title')}
        note={report
          ? t('admin:toolReport.holders.note', {
              tools: report.outOfWarehouse,
              workers: report.byWorker.length,
              projects: report.byProject.length,
            })
          : undefined}
      />

      {empty ? (
        <EmptyWord
          word={t('admin:toolReport.holders.empty.word')}
          title={t('admin:toolReport.holders.empty.lead')}
          className="py-[52px]"
        />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {/* By project */}
          <Panel>
            <div className="px-4 pt-3.5 pb-2.5">
              <Mono className="text-[10px] font-semibold tracking-[0.12em] text-[#0B0A09] uppercase">{t('admin:toolReport.holders.byProject')}</Mono>
            </div>
            <TableHead grid={PROJECT}>
              <span>{t('admin:toolReport.holders.col.project')}</span>
              <span className="text-right">{t('admin:toolReport.holders.col.out')}</span>
              <span className="text-right">{t('admin:toolReport.holders.col.unsigned')}</span>
              <span>{t('admin:toolReport.holders.col.share')}</span>
            </TableHead>

            {(loading || failed) && Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="px-4 py-2.5 border-b border-[#F0EBE1]"><Bone className="w-full h-3" /></div>
            ))}

            {report?.byProject.map((row, i) => (
              <div key={row.projectId ?? `none-${i}`} className={cn(PROJECT, 'px-4 h-9 border-b border-[#F0EBE1]')}>
                <span className="text-[12.5px] font-semibold text-[#0B0A09] truncate">
                  {row.project ?? t('admin:toolReport.holders.noProject')}
                </span>
                <Mono className="text-[12px] tabular-nums text-right text-[#0B0A09]">{row.out}</Mono>
                <Mono className={cn('text-[12px] tabular-nums text-right', row.unsigned > 0 ? 'text-[#C2410C] font-semibold' : 'text-[#A69C8D]')}>{row.unsigned}</Mono>
                <Bar tenths={projectShares[i] ?? 0} />
              </div>
            ))}

            {report && report.byProject.length > 0 && (
              <TotalRow grid={PROJECT} label={t('admin:toolReport.holders.totalOut')}>
                <Mono className="text-[12px] font-semibold tabular-nums text-right text-[#0B0A09]">{report.outOfWarehouse}</Mono>
                <Mono className="text-[12px] font-semibold tabular-nums text-right text-[#C2410C]">
                  {report.byProject.reduce((a, b) => a + b.unsigned, 0)}
                </Mono>
                <span />
              </TotalRow>
            )}
          </Panel>

          {/* By worker */}
          <Panel>
            <div className="flex items-baseline justify-between gap-3 px-4 pt-3.5 pb-2.5">
              <Mono className="text-[10px] font-semibold tracking-[0.12em] text-[#0B0A09] uppercase">{t('admin:toolReport.holders.byWorker')}</Mono>
              {report && report.byWorker.length > TOP_WORKERS && (
                <Mono className="text-[9px] tracking-[0.08em] text-[#A69C8D]">
                  {t('admin:toolReport.holders.byWorker.note', { count: report.byWorker.length })}
                </Mono>
              )}
            </div>
            <TableHead grid={WORKER}>
              <span>{t('admin:toolReport.holders.col.worker')}</span>
              <span className="text-right">{t('admin:toolReport.holders.col.out')}</span>
              <span className="text-right">{t('admin:toolReport.holders.col.unsigned')}</span>
              <span className="text-right">{t('admin:toolReport.holders.col.oldest')}</span>
            </TableHead>

            {(loading || failed) && Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="px-4 py-2.5 border-b border-[#F0EBE1]"><Bone className="w-full h-3" /></div>
            ))}

            {workers.map((row, i) => {
              const name = row.worker ?? t('admin:toolReport.holders.noWorker');
              return (
                <div key={row.workerId ?? `none-${i}`} className={cn(WORKER, 'px-4 h-9 border-b border-[#F0EBE1]')}>
                  <span className="flex items-center gap-2 min-w-0">
                    <span aria-hidden="true" className="w-[22px] h-[22px] flex-shrink-0 bg-[#0B0A09] text-[#F5F1E8] font-bt-mono text-[8.5px] font-semibold flex items-center justify-center">
                      {initials(name)}
                    </span>
                    <span className="text-[12.5px] font-semibold text-[#0B0A09] truncate">{name}</span>
                  </span>
                  <Mono className="text-[12px] tabular-nums text-right text-[#0B0A09]">{row.out}</Mono>
                  <Mono className={cn('text-[12px] tabular-nums text-right', row.unsigned > 0 ? 'text-[#C2410C] font-semibold' : 'text-[#A69C8D]')}>{row.unsigned}</Mono>
                  <div className="text-right">
                    <DaysChip days={row.oldestDays} suffix={t('admin:toolReport.daysUnit', { count: row.oldestDays ?? 0 })} />
                  </div>
                </div>
              );
            })}
          </Panel>
        </div>
      )}
    </section>
  );
}
