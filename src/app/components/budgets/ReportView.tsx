import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../ui/utils';
import { FOCUS_RING, SecondaryButton } from '../onboarding/chrome';
import { EmptyWord, Mono } from '../projects/bt';
import {
  collectedPct, money, pct as fmtPct, sharePct,
  type BudgetRow, type ConsumptionSplit, type RiskFilter,
} from './bits';
import type { Consumption } from './useConsumption';
import { Amount, BlockHead, CollectionBar, CountChip, JobsiteCell, TableSkeleton, TourAnchor } from './ui';

/**
 * La vista de reporte (Claude Design "Presupuestos Reporte BuildTrack").
 *
 * It does not repeat the other view: what is running out of budget stays in
 * Obras. This one answers the two questions no screen answered — what the
 * client still owes (the backend has been returning `invoicedCents` all along
 * and nobody drew it) and where the money went, jobsite against jobsite, so
 * the next one can be quoted with figures instead of a hunch.
 *
 * "Contrato" here is the contract, full stop. The cost budget and the gauge
 * live in Obras: the old column called itself CONTRATO ($) and held the cost
 * budget, and that column is not renamed — it is split in two.
 */

const COLS = '1.5fr .8fr .8fr .8fr .8fr .85fr 96px 30px';
const COMPARE_COLS = '190px 1fr 104px 104px';

export function ReportView({
  rows, total, loading, filtered, readOnly, risk, onResetFilters, onSeeGauge,
  consumption, onRetrySplit, onOpenWorks, onOpenInvoices,
}: {
  rows: BudgetRow[];
  total: number;
  loading: boolean;
  filtered: boolean;
  readOnly: boolean;
  /** Survives the change of view, so the table says in words what it cut. */
  risk: RiskFilter;
  onResetFilters: () => void;
  onSeeGauge: () => void;
  consumption: Consumption;
  onRetrySplit: () => void;
  onOpenWorks: (row: BudgetRow) => void;
  onOpenInvoices?: () => void;
}) {
  const { t, i18n } = useTranslation(['admin', 'common']);
  const lang = i18n.language;
  // By id, never by name: the old screen kept the expanded row as a project
  // NAME, so two jobsites called the same thing opened each other.
  const [expanded, setExpanded] = useState<number | null>(null);

  const totals = useMemo(() => ({
    contract: rows.reduce((s, r) => s + r.contract, 0),
    consumed: rows.reduce((s, r) => s + r.consumed, 0),
    invoiced: rows.reduce((s, r) => s + r.invoiced, 0),
    collected: rows.reduce((s, r) => s + r.collected, 0),
    outstanding: rows.reduce((s, r) => s + r.outstanding, 0),
  }), [rows]);

  return (
    <div className="space-y-3">
      <div className="bg-white border border-[#E7E1D5]">
        <BlockHead
          title={t('admin:budgets.report.table.title')}
          hint={t('admin:budgets.report.table.hint')}
          right={
            filtered
              ? <CountChip>{t('admin:budgets.report.table.filtered', { count: rows.length, total })}</CountChip>
              : <Mono className="text-[9.5px] tracking-[0.1em] text-[#8A8175]">{t('admin:budgets.report.table.clickHint')}</Mono>
          }
        />
        {/* Risk survives a change of view, but its criterion — spend against
            the cost budget — is exactly what this table leaves to the other
            one. So the cut is spelled out here, with the way to go and see it. */}
        {risk !== 'all' && (
          <div className="flex items-center justify-between gap-3 flex-wrap bg-[#FBF8F2] border-y border-[#EDE7DB] px-[18px] py-2.5">
            <span className="text-[12.5px] text-[#43301F]">
              {t('admin:budgets.report.riskNote', { count: rows.length, criterion: t(`admin:budgets.risk.${riskKey(risk)}.short`) })}
            </span>
            <button
              type="button"
              onClick={onSeeGauge}
              className={cn('font-bt-mono text-[9.5px] font-semibold uppercase tracking-[0.1em] text-[#C2410C] hover:text-[#F97316]', FOCUS_RING)}
            >
              {t('admin:budgets.report.seeGauge')}
            </button>
          </div>
        )}
        <div
          className="hidden lg:grid gap-3 px-[18px] py-2.5 bg-[#FBF8F2] border-y border-[#EDE7DB] font-bt-mono text-[9.5px] uppercase tracking-[0.12em] text-[#8A8175]"
          style={{ gridTemplateColumns: COLS }}
        >
          <span>{t('admin:budgets.col.jobsite')}</span>
          <span className="text-right">{t('admin:budgets.col.contract')}</span>
          <span className="text-right">{t('admin:budgets.col.spent')}</span>
          <span className="text-right">{t('admin:budgets.col.invoiced')}</span>
          <span className="text-right">{t('admin:budgets.col.collected')}</span>
          <span className="text-right">{t('admin:budgets.col.outstanding')}</span>
          <span>{t('admin:budgets.col.collectedOfInvoiced')}</span>
          <span />
        </div>

        {loading ? (
          <TableSkeleton cols={COLS} />
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
          <>
            {rows.map(row => (
              <ReportRow
                key={row.id}
                row={row}
                lang={lang}
                expanded={expanded === row.id}
                onToggle={() => setExpanded(expanded === row.id ? null : row.id)}
                split={consumption.splits.get(row.id) ?? null}
                splitLoading={consumption.state === 'loading'}
                onOpenWorks={() => onOpenWorks(row)}
                onOpenInvoices={onOpenInvoices}
              />
            ))}
            {/* The table's own total, which is the same number as the figures
                above it. That it once was not is why this screen exists. */}
            <div
              className="grid gap-3 items-center px-[18px] py-2.5 bg-[#F3EEE4] border-t border-[#EDE7DB] grid-cols-2 lg:[grid-template-columns:var(--bt-cols)]"
              style={{ '--bt-cols': COLS } as React.CSSProperties}
            >
              <Mono className="text-[9.5px] font-semibold tracking-[0.1em] text-[#5A5346]">
                {t('admin:budgets.report.table.total', { count: rows.length })}
              </Mono>
              <Amount className="font-semibold">{money(totals.contract)}</Amount>
              <Amount className="font-semibold">{money(totals.consumed)}</Amount>
              <Amount className="font-semibold">{money(totals.invoiced)}</Amount>
              <Amount className="font-semibold">{money(totals.collected)}</Amount>
              <Amount tone="orange">{money(totals.outstanding)}</Amount>
              <Mono className="text-[10.5px] font-semibold text-[#5A5346] tabular-nums normal-case">
                {fmtPct(totals.invoiced > 0 ? (totals.collected / totals.invoiced) * 100 : 0, lang)} %
              </Mono>
              <span />
            </div>
          </>
        )}
      </div>

      {/* The stop is anchored on the CONTAINER, which is painted in every
          state — empty, failed, still loading — because `visibleSteps()` drops
          a missing anchor and a tour that shrinks reads as a bug. */}
      <TourAnchor step="reparto" readOnly={readOnly}>
        <Comparator rows={rows} consumption={consumption} onRetrySplit={onRetrySplit} lang={lang} loading={loading} />
      </TourAnchor>
    </div>
  );
}

/** `no-cost-budget` is the one option whose key is not already camelCase. */
function riskKey(risk: RiskFilter): string {
  return risk === 'no-cost-budget' ? 'noCostBudget' : risk;
}

function ReportRow({ row, lang, expanded, onToggle, split, splitLoading, onOpenWorks, onOpenInvoices }: {
  row: BudgetRow;
  lang: string;
  expanded: boolean;
  onToggle: () => void;
  split: ConsumptionSplit | null;
  splitLoading: boolean;
  onOpenWorks: () => void;
  onOpenInvoices?: () => void;
}) {
  const { t } = useTranslation(['admin', 'common']);
  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={onToggle}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
        className={cn(
          'grid gap-3 items-center px-[18px] py-[11px] border-b border-[#F0EBE1] cursor-pointer',
          'border-l-2 border-l-transparent hover:bg-[#FBF8F2] hover:border-l-[#F97316] transition-colors',
          'grid-cols-2 lg:[grid-template-columns:var(--bt-cols)]',
          expanded && 'bg-[#FBF8F2] border-l-[#F97316]',
          FOCUS_RING,
        )}
        style={{ '--bt-cols': COLS } as React.CSSProperties}
      >
        <JobsiteCell name={row.name} client={row.clientName} costCode={row.costCode} />
        <Amount>{money(row.contract)}</Amount>
        <Amount>{money(row.consumed)}</Amount>
        <Amount>{money(row.invoiced)}</Amount>
        <Amount>{money(row.collected)}</Amount>
        <Amount tone={row.outstanding > 0 ? 'orange' : 'quiet'}>{money(row.outstanding)}</Amount>
        <CollectionBar pctValue={collectedPct(row)} lang={lang} />
        <Mono className="text-[13px] text-[#A69C8D] justify-self-end" aria-hidden="true">{expanded ? '−' : '+'}</Mono>
      </div>

      {expanded && (
        <div className="bg-[#FBF8F2] border-b border-[#F0EBE1] border-l-2 border-l-[#F97316] px-[18px] py-4">
          <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
            <div className="bg-white border border-[#E7E1D5] px-3.5 py-3">
              <Mono className="block text-[9.5px] tracking-[0.12em] text-[#8A8175]">
                {t('admin:budgets.report.split.title', { amount: money(row.consumed) })}
              </Mono>
              <div className="mt-2.5 space-y-2">
                {splitLoading || !split ? (
                  <>
                    <div className="bt-skeleton h-3" aria-hidden="true" />
                    <div className="bt-skeleton h-3 w-3/4" aria-hidden="true" />
                    <div className="bt-skeleton h-3 w-1/2" aria-hidden="true" />
                  </>
                ) : (
                  <>
                    <SourceLine
                      label={t('admin:budgets.source.payroll')}
                      amount={split.payroll}
                      share={sharePct(split.payroll, row.consumed)}
                      lang={lang}
                      imputed={split.payrollImputed}
                      color="bg-[#0B0A09]"
                    />
                    <SourceLine
                      label={t('admin:budgets.source.suppliers')}
                      amount={split.suppliers}
                      share={sharePct(split.suppliers, row.consumed)}
                      lang={lang}
                      imputed
                      color="bg-[#F97316]"
                    />
                    <SourceLine
                      label={t('admin:budgets.source.expenses')}
                      amount={split.expenses}
                      share={sharePct(split.expenses, row.consumed)}
                      lang={lang}
                      imputed
                      color="bg-[#B4A992]"
                    />
                  </>
                )}
              </div>
            </div>

            <div className="bg-white border border-[#E7E1D5] px-3.5 py-3">
              <Mono className="block text-[9.5px] tracking-[0.12em] text-[#8A8175]">{t('admin:budgets.report.billing.title')}</Mono>
              <div className="mt-2.5 space-y-1.5">
                <BillingLine label={t('admin:budgets.col.invoiced')} value={money(row.invoiced)} />
                <BillingLine label={t('admin:budgets.col.collected')} value={money(row.collected)} />
                <BillingLine label={t('admin:budgets.col.outstanding')} value={money(row.outstanding)} tone={row.outstanding > 0 ? 'orange' : undefined} />
              </div>
              {row.invoiced > 0 && row.outstanding === 0 && (
                <Mono className="block text-[9.5px] tracking-[0.1em] text-[#2E7D4F] mt-2.5">{t('admin:budgets.report.billing.settled')}</Mono>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 mt-3">
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onOpenWorks(); }}
              className={cn('font-bt-mono text-[9.5px] font-semibold uppercase tracking-[0.1em] text-[#C2410C] hover:text-[#F97316]', FOCUS_RING)}
            >
              {t('admin:budgets.report.seeInWorks')}
            </button>
            {onOpenInvoices && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onOpenInvoices(); }}
                className={cn('font-bt-mono text-[9.5px] font-semibold uppercase tracking-[0.1em] text-[#C2410C] hover:text-[#F97316]', FOCUS_RING)}
              >
                {t('admin:budgets.report.seeInvoices')}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function SourceLine({ label, amount, share, lang, imputed, color }: {
  label: string; amount: number; share: number; lang: string; imputed: boolean; color: string;
}) {
  const { t } = useTranslation('admin');
  return (
    <div className="flex items-center gap-2.5">
      <span className={cn('w-2 h-2 flex-shrink-0', color)} aria-hidden="true" />
      <Mono className="text-[9.5px] tracking-[0.08em] text-[#5A5346] w-[124px] flex-shrink-0">{label}</Mono>
      <Mono className="text-[12px] tabular-nums text-[#0B0A09] normal-case flex-1 text-right">{money(amount)}</Mono>
      {/* Not a 0 %: an unimputed residual is an absence of data, and drawing
          it as zero would read like a measurement. */}
      <Mono className={cn('text-[10px] tracking-[0.06em] w-[92px] text-right', imputed ? 'text-[#5A5346]' : 'text-[#A69C8D]')}>
        {imputed ? `${fmtPct(share, lang)} %` : t('budgets.source.unimputed')}
      </Mono>
    </div>
  );
}

function BillingLine({ label, value, tone }: { label: string; value: string; tone?: 'orange' }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <Mono className="text-[9.5px] tracking-[0.08em] text-[#8A8175]">{label}</Mono>
      <Mono className={cn('text-[12px] tabular-nums normal-case', tone === 'orange' ? 'font-semibold text-[#C2410C]' : 'text-[#0B0A09]')}>{value}</Mono>
    </div>
  );
}

/**
 * El comparador.
 *
 * The block Finanzas de Proyecto used to answer on its own screen, dividing by
 * the contract while this one divided by the cost budget. One jobsite spent
 * 62 % of its money on labour and another of the same size spent 44 %: when
 * quoting a warehouse, 62 % is the number to use, not the company average.
 *
 * Anchored as a container that is always painted, empty or not — a stop of the
 * guided tour points at it, and `visibleSteps()` drops a missing anchor, which
 * would shrink "1 de 4" to "1 de 1" on a fresh account.
 */
function Comparator({ rows, consumption, onRetrySplit, lang, loading }: {
  rows: BudgetRow[];
  consumption: Consumption;
  onRetrySplit: () => void;
  lang: string;
  loading: boolean;
}) {
  const { t } = useTranslation(['admin', 'common']);
  const [mode, setMode] = useState<'share' | 'amount'>('share');

  const spent = useMemo(
    () => rows.filter(row => row.consumed > 0).sort((a, b) => b.consumed - a.consumed),
    [rows],
  );
  const totals = useMemo(() => {
    let payroll = 0, suppliers = 0, expenses = 0, consumed = 0;
    spent.forEach(row => {
      const split = consumption.splits.get(row.id);
      if (!split) return;
      payroll += split.payroll;
      suppliers += split.suppliers;
      expenses += split.expenses;
      consumed += row.consumed;
    });
    return { payroll, suppliers, expenses, consumed };
  }, [spent, consumption.splits]);

  return (
    <div className="bg-white border border-[#E7E1D5] px-[18px] md:px-[22px] py-[18px]">
      <div className="flex items-end justify-between gap-5 flex-wrap mb-4">
        <div>
          <span className="font-bt-display font-extrabold text-[24px] md:text-[26px] leading-none uppercase text-[#0B0A09]">
            {t('admin:budgets.report.compare.title')}
          </span>
          <Mono className="block text-[10px] tracking-[0.12em] text-[#8A8175] mt-[5px]">
            {t('admin:budgets.report.compare.hint', { count: spent.length })}
          </Mono>
        </div>
        <div className="flex items-center gap-3.5 flex-wrap">
          <Legend color="bg-[#0B0A09]" label={t('admin:budgets.source.payroll')} />
          <Legend color="bg-[#F97316]" label={t('admin:budgets.source.suppliers')} />
          <Legend color="bg-[#B4A992]" label={t('admin:budgets.source.expenses')} />
          <div className="flex border border-[#DBD0BB]">
            {(['share', 'amount'] as const).map((key, i) => (
              <button
                key={key}
                type="button"
                aria-pressed={mode === key}
                onClick={() => setMode(key)}
                className={cn(
                  'font-bt-mono text-[9.5px] font-semibold uppercase tracking-[0.1em] px-[11px] py-[7px] transition-colors',
                  i > 0 && 'border-l border-[#DBD0BB]',
                  mode === key ? 'bg-[#0B0A09] text-[#F5F1E8]' : 'bg-[#FAF7F0] text-[#5A5346] hover:text-[#C2410C]',
                  FOCUS_RING,
                )}
              >
                {t(key === 'share' ? 'admin:budgets.report.compare.share' : 'admin:budgets.report.compare.amount')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {consumption.state === 'failed' ? (
        <div className="flex items-center justify-between gap-4 flex-wrap border border-[#E7E1D5] border-l-[3px] border-l-[#B3402A] bg-[#FBF8F2] px-3.5 py-3">
          <span className="text-[13px] text-[#5A5346]">{t('admin:budgets.report.compare.failed')}</span>
          <SecondaryButton onClick={onRetrySplit} className="bg-white">{t('admin:budgets.retry')}</SecondaryButton>
        </div>
      ) : loading || consumption.state !== 'ready' ? (
        <div className="space-y-2.5" aria-live="polite">
          <Mono className="block text-[9.5px] tracking-[0.1em] text-[#A69C8D]">{t('admin:budgets.report.compare.loading')}</Mono>
          <div className="bt-skeleton h-[22px]" aria-hidden="true" />
          <div className="bt-skeleton h-[22px]" aria-hidden="true" />
          <div className="bt-skeleton h-[22px]" aria-hidden="true" />
        </div>
      ) : spent.length === 0 ? (
        <p className="text-[13px] text-[#8A8175] py-4">{t('admin:budgets.report.compare.nothing')}</p>
      ) : (
        <>
          <div
            className="hidden lg:grid gap-4 pb-2 border-b border-[#0B0A09] font-bt-mono text-[9px] uppercase tracking-[0.12em] text-[#A69C8D]"
            style={{ gridTemplateColumns: COMPARE_COLS }}
          >
            <span>{t('admin:budgets.col.jobsite')}</span>
            <span>{t('admin:budgets.report.compare.split')}</span>
            <span className="text-right">{t('admin:budgets.col.spent')}</span>
            <span className="text-right">{t('admin:budgets.source.payroll')}</span>
          </div>
          {spent.map(row => {
            const split = consumption.splits.get(row.id);
            if (!split) return null;
            return (
              <div
                key={row.id}
                className="grid gap-4 items-center py-3 border-b border-[#F0EBE1] grid-cols-1 lg:[grid-template-columns:var(--bt-cols)]"
                style={{ '--bt-cols': COMPARE_COLS } as React.CSSProperties}
              >
                <div className="min-w-0">
                  <div className="text-[13.5px] font-semibold text-[#0B0A09] truncate">{row.name}</div>
                  {row.clientName && <Mono className="block text-[9.5px] tracking-[0.04em] text-[#A69C8D] mt-0.5 truncate">{row.clientName}</Mono>}
                </div>
                <SplitBar row={row} split={split} lang={lang} mode={mode} />
                <Amount>{money(row.consumed)}</Amount>
                <Mono className={cn('text-[12.5px] text-right tabular-nums normal-case', split.payrollImputed ? 'font-semibold text-[#0B0A09]' : 'text-[#A69C8D] uppercase text-[9.5px] tracking-[0.08em]')}>
                  {split.payrollImputed ? `${fmtPct(sharePct(split.payroll, row.consumed), lang)} %` : t('admin:budgets.source.unimputed')}
                </Mono>
              </div>
            );
          })}
          <div
            className="grid gap-4 items-center py-3 grid-cols-1 lg:[grid-template-columns:var(--bt-cols)]"
            style={{ '--bt-cols': COMPARE_COLS } as React.CSSProperties}
          >
            <Mono className="text-[9.5px] font-semibold tracking-[0.1em] text-[#5A5346]">
              {t('admin:budgets.report.compare.total', { count: spent.length })}
            </Mono>
            <SplitBar
              row={{ consumed: totals.consumed } as BudgetRow}
              split={{ payroll: totals.payroll, suppliers: totals.suppliers, expenses: totals.expenses, payrollImputed: totals.payroll > 0 }}
              lang={lang}
              mode={mode}
            />
            <Amount className="font-semibold">{money(totals.consumed)}</Amount>
            <Mono className="text-[12.5px] font-semibold text-right tabular-nums text-[#0B0A09] normal-case">
              {fmtPct(sharePct(totals.payroll, totals.consumed), lang)} %
            </Mono>
          </div>
        </>
      )}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn('w-[9px] h-[9px] block', color)} aria-hidden="true" />
      <Mono className="text-[9px] tracking-[0.1em] text-[#5A5346]">{label}</Mono>
    </span>
  );
}

function SplitBar({ row, split, lang, mode }: {
  row: Pick<BudgetRow, 'consumed'>;
  split: ConsumptionSplit;
  lang: string;
  mode: 'share' | 'amount';
}) {
  const { t } = useTranslation('admin');
  const segments = [
    { key: 'payroll', value: split.payroll, bg: 'bg-[#0B0A09]', fg: 'text-[#F5F1E8]', shown: split.payrollImputed },
    { key: 'suppliers', value: split.suppliers, bg: 'bg-[#F97316]', fg: 'text-[#43301F]', shown: true },
    { key: 'expenses', value: split.expenses, bg: 'bg-[#B4A992]', fg: 'text-[#43301F]', shown: true },
  ].filter(seg => seg.value > 0 && seg.shown);

  if (segments.length === 0) {
    return <Mono className="text-[9.5px] tracking-[0.08em] text-[#A69C8D]">{t('budgets.source.unimputed')}</Mono>;
  }

  const onlySuppliers = segments.length === 1 && segments[0].key === 'suppliers';
  return (
    <div className="h-[22px] flex" role="img" aria-label={t('budgets.report.compare.barLabel')}>
      {segments.map(seg => {
        const share = sharePct(seg.value, row.consumed);
        return (
          <div
            key={seg.key}
            className={cn('flex items-center px-2 overflow-hidden', seg.bg)}
            style={{ width: `${share}%` }}
          >
            <Mono className={cn('text-[10px] tracking-[0.06em] whitespace-nowrap normal-case', seg.fg)}>
              {onlySuppliers
                ? t('budgets.report.compare.allSuppliers', { amount: money(seg.value) })
                : mode === 'amount' ? money(seg.value) : `${fmtPct(share, lang)} %`}
            </Mono>
          </div>
        );
      })}
    </div>
  );
}
