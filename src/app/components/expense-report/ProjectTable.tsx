import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { cn } from '../ui/utils';
import { Mono } from '../projects/bt';
import { Amount } from '../budgets/ui';
import { pct } from '../budgets/bits';
import { FOCUS_RING, TertiaryButton } from '../onboarding/chrome';
import type { ProjectExpenseRow } from '../../services/expenses';
import { bigMoney, Dash, EXPENSE_TYPES, ExecutionBar, Head, StateCell } from './bits';

/** Obra · aprobado · del presupuesto · pendiente · devuelto · rechazado. */
export const PROJECT_COLS = '1.55fr .82fr 1.3fr .86fr .78fr .78fr';

export function ProjectTable({ rows, totals, lang, openId, onToggle, onOpenInbox }: {
  rows: ProjectExpenseRow[];
  totals: {
    approvedCents: number;
    pendingCents: number;
    pendingCount: number;
    observedCents: number;
    observedCount: number;
    rejectedCents: number;
    rejectedCount: number;
    projectCount: number;
  };
  lang: string;
  openId: number | null;
  onToggle: (id: number) => void;
  onOpenInbox: (projectId: number, status: 'PENDING' | 'OBSERVED' | 'REJECTED') => void;
}) {
  const { t } = useTranslation('admin');
  const withBudget = rows.filter(r => r.costBudgetCents != null).length;

  return (
    <div>
      <div
        className="hidden md:grid gap-3 px-[18px] py-2 border-b border-[#E7E1D5] bg-[#FBF8F2]"
        style={{ gridTemplateColumns: PROJECT_COLS }}
      >
        <Head>{t('expenseReport.byProject.project')}</Head>
        <Head right>{t('expenseReport.byProject.approved')} ↓</Head>
        <Head right>{t('expenseReport.byProject.ofCostBudget')}</Head>
        <Head right>{t('expenseReport.state.pending')}</Head>
        <Head right>{t('expenseReport.state.observed')}</Head>
        <Head right>{t('expenseReport.state.rejected')}</Head>
      </div>

      {rows.map(row => {
        const open = openId === row.projectId;
        return (
          <div key={row.projectId} className="border-b border-[#F0EBE1] last:border-b-0">
            {/* Escritorio */}
            <div
              className="hidden md:grid gap-3 px-[18px] py-[11px] items-center hover:bg-[#FBF8F2]"
              style={{ gridTemplateColumns: PROJECT_COLS }}
            >
              <button
                type="button"
                onClick={() => onToggle(row.projectId)}
                aria-expanded={open}
                className={cn('flex items-center gap-2 min-w-0 text-left', FOCUS_RING)}
              >
                <ChevronDown
                  className={cn('w-3.5 h-3.5 text-[#8A8175] flex-shrink-0 transition-transform', open && 'rotate-180')}
                  strokeWidth={2.2}
                  aria-hidden="true"
                />
                <span className="text-[13px] text-[#0A0A0A] truncate">{row.projectName}</span>
              </button>
              <Amount className="font-semibold">{bigMoney(row.approvedCents)}</Amount>
              <ExecutionBar approvedCents={row.approvedCents} budgetCents={row.costBudgetCents} lang={lang} />
              <StateCell
                cents={row.pendingCents}
                count={row.pendingCount}
                tone="orange"
                onOpen={() => onOpenInbox(row.projectId, 'PENDING')}
              />
              <StateCell cents={row.observedCents} count={row.observedCount} />
              <StateCell cents={row.rejectedCents} count={row.rejectedCount} />
            </div>

            {/* Móvil: tres líneas, sin scroll horizontal */}
            <button
              type="button"
              onClick={() => onToggle(row.projectId)}
              aria-expanded={open}
              className={cn('md:hidden w-full text-left px-[14px] py-3 space-y-1.5', FOCUS_RING)}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[13px] text-[#0A0A0A] truncate">{row.projectName}</span>
                <Amount className="font-semibold flex-shrink-0">{bigMoney(row.approvedCents)}</Amount>
              </div>
              <ExecutionBar approvedCents={row.approvedCents} budgetCents={row.costBudgetCents} lang={lang} />
              {row.pendingCents > 0 && (
                <Mono className="block text-[9.5px] tracking-[0.08em] text-[#C2410C]">
                  {t('expenseReport.state.pending')} {bigMoney(row.pendingCents)}
                </Mono>
              )}
            </button>

            {open && <Breakdown row={row} lang={lang} onOpenInbox={onOpenInbox} />}
          </div>
        );
      })}

      {/* Total. Dice de cuántas obras es y cuántas traían presupuesto. */}
      <div
        className="hidden md:grid gap-3 px-[18px] py-[11px] items-center border-t border-[#0A0A0A] bg-[#FBF8F2]"
        style={{ gridTemplateColumns: PROJECT_COLS }}
      >
        <Mono className="text-[10px] tracking-[0.1em] text-[#0A0A0A]">
          {t('expenseReport.byProject.total', { count: totals.projectCount })}
        </Mono>
        <Amount className="font-semibold">{bigMoney(totals.approvedCents)}</Amount>
        <Mono className="text-[9px] tracking-[0.08em] text-[#8A8175] text-right block">
          {t('expenseReport.byProject.withBudget', { count: withBudget, total: totals.projectCount })}
        </Mono>
        {totals.pendingCents > 0
          ? <Amount tone="orange">{bigMoney(totals.pendingCents)}</Amount>
          : <div className="text-right"><Dash /></div>}
        {totals.observedCents > 0
          ? <Amount>{bigMoney(totals.observedCents)}</Amount>
          : <div className="text-right"><Dash /></div>}
        {totals.rejectedCents > 0
          ? <Amount>{bigMoney(totals.rejectedCents)}</Amount>
          : <div className="text-right"><Dash /></div>}
      </div>
      <div className="md:hidden px-[14px] py-3 border-t border-[#0A0A0A] bg-[#FBF8F2] flex items-baseline justify-between gap-3">
        <Mono className="text-[10px] tracking-[0.1em] text-[#0A0A0A]">
          {t('expenseReport.byProject.total', { count: totals.projectCount })}
        </Mono>
        <Amount className="font-semibold">{bigMoney(totals.approvedCents)}</Amount>
      </div>
    </div>
  );
}

/**
 * El reparto por tipo de una obra, que era lo mejor que tenía la pantalla.
 *
 * Ahora suma: los tipos con su monto y su cuenta, un total que cuadra con la
 * fila de arriba, y lo que todavía no es gasto puesto aparte — con la única
 * cifra de la pantalla que mezcla estados, que lo dice en la propia frase y no
 * entra en ningún total ni en el documento exportado.
 */
function Breakdown({ row, lang, onOpenInbox }: {
  row: ProjectExpenseRow;
  lang: string;
  onOpenInbox: (projectId: number, status: 'PENDING' | 'OBSERVED' | 'REJECTED') => void;
}) {
  const { t } = useTranslation('admin');
  const total = row.breakdown.reduce((s, b) => s + b.totalCents, 0);
  const ifApproved = row.approvedCents + row.pendingCents;
  const nextShare = row.costBudgetCents != null && row.costBudgetCents > 0
    ? (ifApproved / row.costBudgetCents) * 100
    : null;

  return (
    <div className="bg-[#FBF8F2] border-t border-[#F0EBE1] px-[18px] py-3.5 grid gap-6 md:grid-cols-[1.4fr_1fr]">
      <div>
        <Mono className="block text-[9.5px] tracking-[0.1em] text-[#8A8175] mb-2">
          {t('expenseReport.breakdown.title')}
        </Mono>
        {row.breakdown.length === 0 ? (
          <p className="text-[12.5px] text-[#A69C8D]">{t('expenseReport.breakdown.empty')}</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left pb-1.5"><Head>{t('expenseReport.breakdown.type')}</Head></th>
                <th className="text-right pb-1.5"><Head right>{t('expenseReport.breakdown.amount')}</Head></th>
                <th className="text-right pb-1.5"><Head right>{t('expenseReport.breakdown.count')}</Head></th>
              </tr>
            </thead>
            <tbody>
              {row.breakdown.map(b => (
                <tr key={b.type} className="border-t border-[#F0EBE1]">
                  <td className="py-[7px] text-[12.5px] text-[#0A0A0A]">
                    {t(`expenses.type.${b.type}`, { defaultValue: b.type })}
                  </td>
                  <td className="py-[7px]"><Amount>{bigMoney(b.totalCents)}</Amount></td>
                  <td className="py-[7px]">
                    <Mono className="text-[11px] text-[#5A5346] tabular-nums block text-right">{b.count}</Mono>
                  </td>
                </tr>
              ))}
              <tr className="border-t border-[#0A0A0A]">
                <td className="py-[7px]">
                  <Mono className="text-[9.5px] tracking-[0.1em] text-[#0A0A0A]">
                    {t('expenseReport.breakdown.total', { shown: row.breakdown.length, total: EXPENSE_TYPES.length })}
                  </Mono>
                </td>
                <td className="py-[7px]"><Amount className="font-semibold">{bigMoney(total)}</Amount></td>
                <td className="py-[7px]">
                  <Mono className="text-[11px] text-[#0A0A0A] tabular-nums block text-right">
                    {row.breakdown.reduce((s, b) => s + b.count, 0)}
                  </Mono>
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      <div className="space-y-2.5">
        <Mono className="block text-[9.5px] tracking-[0.1em] text-[#8A8175]">
          {t('expenseReport.breakdown.notYet')}
        </Mono>
        <dl className="space-y-1.5">
          <Line label={t('expenseReport.state.pending')} cents={row.pendingCents} count={row.pendingCount} tone="orange" />
          <Line label={t('expenseReport.state.observed')} cents={row.observedCents} count={row.observedCount} />
          <Line label={t('expenseReport.state.rejected')} cents={row.rejectedCents} count={row.rejectedCount} />
        </dl>
        {row.pendingCents > 0 && (
          <div className="bg-white border border-[#E7E1D5] px-3 py-2.5 space-y-2">
            <p className="text-[12px] leading-[1.5] text-[#5A5346]">
              {nextShare != null
                ? t('expenseReport.breakdown.ifApproved', {
                    count: row.pendingCount,
                    amount: bigMoney(ifApproved),
                    percent: `${pct(nextShare, lang)} %`,
                  })
                : t('expenseReport.breakdown.ifApprovedNoBudget', {
                    count: row.pendingCount,
                    amount: bigMoney(ifApproved),
                  })}
            </p>
            <TertiaryButton onClick={() => onOpenInbox(row.projectId, 'PENDING')}>
              {t('expenseReport.breakdown.review', { count: row.pendingCount })}
            </TertiaryButton>
          </div>
        )}
        <p className="text-[11.5px] leading-[1.5] text-[#A69C8D]">
          {t('expenseReport.breakdown.outOfRange')}
        </p>
      </div>
    </div>
  );
}

function Line({ label, cents, count, tone }: {
  label: string;
  cents: number;
  count: number;
  tone?: 'orange';
}) {
  const { t } = useTranslation('admin');
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[12px] text-[#5A5346]">
        {label}
        {count > 0 && (
          <Mono className="text-[9px] tracking-[0.08em] text-[#A69C8D] ml-1.5">
            {t('expenseReport.state.count', { count })}
          </Mono>
        )}
      </dt>
      <dd>{cents > 0 ? <Amount tone={tone === 'orange' ? 'orange' : 'ink'}>{bigMoney(cents)}</Amount> : <Dash />}</dd>
    </div>
  );
}
