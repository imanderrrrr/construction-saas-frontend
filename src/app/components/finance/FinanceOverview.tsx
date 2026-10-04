import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowDownToLine, ArrowRight, ArrowUpFromLine, Banknote, CheckCircle, Clock, RefreshCw, UserRound, Wallet,
} from 'lucide-react';
import { cn } from '../ui/utils';
import {
  getPayableSummary, getReceivableSummary, listAllPayables,
  type Payable, type PayableSummary, type ReceivableSummary,
} from '../../services/finance';
import {
  getFinanceExpenseReport, getFinanceExpenses, type ExpenseReportResponse, type ExpenseResponse,
} from '../../services/expenses';
import { businessToday, fmtDate } from '../../helpers/dateTime';
import { FOCUS_RING, InkBar, SecondaryButton } from '../onboarding/chrome';
import { Bone, Mono, PaperNote, stampDay } from '../projects/bt';
import { fmtMoney } from '../invoices/bits';

/**
 * The FINANCE home: where the money stands, before any screen is opened.
 *
 * Four figures in the ink bar — what clients owe, what was collected this
 * month, what the company owes, approved expenses — each one a door to the
 * screen that explains it. Below, the payments coming due and the expenses
 * just approved, then the shortcuts of this role. Every block loads, fails and
 * retries on its own: one failed call never blanks the others, and a failure
 * never reads as a zero.
 *
 * The figures are the server's, over the whole company. The payables one falls
 * back to the bills when the summary endpoint is missing (an older server).
 */

type Block<T> = { state: 'loading' } | { state: 'error' } | { state: 'ready'; data: T };

const LOADING = { state: 'loading' } as const;

function settle<T>(r: PromiseSettledResult<T>): Block<T> {
  return r.status === 'fulfilled' ? { state: 'ready', data: r.value } : { state: 'error' };
}

export function FinanceOverview({ username, onNavigate }: { username: string; onNavigate: (section: string) => void }) {
  const { t, i18n } = useTranslation(['finance', 'common']);
  const lang = i18n.language;
  const dateLocale = lang.startsWith('es') ? 'es' : 'en-US';
  const [receivables, setReceivables] = useState<Block<ReceivableSummary>>(LOADING);
  const [payableSummary, setPayableSummary] = useState<Block<PayableSummary>>(LOADING);
  const [payables, setPayables] = useState<Block<Payable[]>>(LOADING);
  const [expenses, setExpenses] = useState<Block<ExpenseResponse[]>>(LOADING);
  const [report, setReport] = useState<Block<ExpenseReportResponse>>(LOADING);
  // A newer load wins: a slow answer from a previous click never overwrites it.
  const generation = useRef(0);

  const fetchAll = useCallback(async () => {
    const current = ++generation.current;
    const [ar, apSummary, ap, recent, totals] = await Promise.allSettled([
      getReceivableSummary(),
      getPayableSummary(),
      listAllPayables(),
      getFinanceExpenses({ size: 5, page: 0 }).then(r => r.content),
      getFinanceExpenseReport({}),
    ]);
    if (current !== generation.current) return;
    setReceivables(settle(ar));
    setPayableSummary(settle(apSummary));
    setPayables(settle(ap));
    setExpenses(settle(recent));
    setReport(settle(totals));
  }, []);

  useEffect(() => {
    void fetchAll();
    return () => { generation.current += 1; };
  }, [fetchAll]);

  /** «Actualizar» and «Reintentar»: every block back to loading, then one fresh load. */
  const load = () => {
    setReceivables(LOADING);
    setPayableSummary(LOADING);
    setPayables(LOADING);
    setExpenses(LOADING);
    setReport(LOADING);
    void fetchAll();
  };

  const today = businessToday();
  const ar = receivables.state === 'ready' ? receivables.data : null;
  const bills = payables.state === 'ready' ? payables.data : null;
  const owedOn = (bill: Payable) => Math.round(bill.amount * 100) - Math.round(bill.paidAmount * 100);
  const openBills = (bills ?? []).filter(bill => owedOn(bill) > 0);
  const nextBills = [...openBills].sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id - b.id).slice(0, 5);

  // Payables: the server's figure; the bills' only when there is no summary.
  const apFigure = payableSummary.state === 'ready'
    ? { cents: payableSummary.data.outstandingCents, overdue: payableSummary.data.overdueCount }
    : payableSummary.state === 'error' && bills
      ? { cents: openBills.reduce((s, b) => s + owedOn(b), 0), overdue: openBills.filter(b => b.dueDate < today).length }
      : null;

  const loading = [receivables, payableSummary, payables, expenses, report].some(b => b.state === 'loading');
  const failed = receivables.state === 'error' || payables.state === 'error' || expenses.state === 'error' || report.state === 'error';
  const money = (dollars: number | null) => (dollars == null ? '—' : fmtMoney(dollars));

  const figures = [
    {
      key: 'receivables', target: 'accounts-receivable',
      label: t('finance:overview.receivables'),
      value: ar ? money(ar.outstanding) : null,
      hint: ar ? t('finance:overview.overdueReceivables', { amount: fmtMoney(ar.overdue), count: ar.overdueCount }) : null,
      waiting: receivables.state === 'loading',
    },
    {
      key: 'collections', target: 'accounts-receivable',
      label: t('finance:overview.collections'),
      value: ar && ar.collectedThisMonth != null ? money(ar.collectedThisMonth) : ar ? '—' : null,
      hint: ar && ar.collectedThisMonthCount != null
        ? t('finance:overview.collectionCount', { count: ar.collectedThisMonthCount })
        : null,
      waiting: receivables.state === 'loading',
    },
    {
      key: 'payables', target: 'accounts-payable',
      label: t('finance:overview.payables'),
      value: apFigure ? money(apFigure.cents / 100) : null,
      hint: apFigure ? t('finance:overview.overduePayables', { count: apFigure.overdue }) : null,
      waiting: payableSummary.state === 'loading' || (payableSummary.state === 'error' && payables.state === 'loading'),
    },
    {
      key: 'expenses', target: 'approved-expenses',
      label: t('finance:overview.expenses'),
      value: report.state === 'ready' ? money(report.data.kpis.totalApprovedCents / 100) : null,
      hint: report.state === 'ready' ? t('finance:overview.expenseCount', { count: report.data.kpis.expenseCount }) : null,
      waiting: report.state === 'loading',
    },
  ];

  const shortcuts = [
    { key: 'accounts-receivable', label: t('finance:nav.accountsReceivable'), desc: t('finance:overview.receivablesHint'), icon: ArrowDownToLine },
    { key: 'accounts-payable', label: t('finance:nav.accountsPayable'), desc: t('finance:dash.card.accountsPayableDesc'), icon: ArrowUpFromLine },
    { key: 'clients', label: t('finance:nav.clients'), desc: t('finance:overview.clientsHint'), icon: UserRound },
    { key: 'budgets', label: t('finance:nav.budgets'), desc: t('finance:dash.card.projectBudgetsDesc'), icon: Wallet },
    { key: 'labor-payroll', label: t('finance:nav.laborPayroll'), desc: t('finance:dash.card.laborPayrollDesc'), icon: Banknote },
    { key: 'supervisor-hours', label: t('finance:nav.supervisorHours'), desc: t('finance:overview.supervisorHoursHint'), icon: Clock },
  ];

  return (
    <div className="max-w-[1500px] mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <Mono className="block text-[10px] tracking-[0.16em] text-[#8A8175]">{t('finance:overview.greeting', { username })}</Mono>
          <h2 className="font-bt-display font-extrabold uppercase text-[38px] md:text-[50px] leading-[0.92] text-[#0A0A0A] mt-1">
            {t('finance:overview.title')}
          </h2>
          <p className="text-[13px] text-[#5A5346] mt-2">{t('finance:overview.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <Mono className="text-[11px] tracking-[0.08em] text-[#0A0A0A]">{stampDay(today, lang)}</Mono>
          <SecondaryButton onClick={() => void load()} disabled={loading} className="bg-[#FAF7F0] gap-1.5">
            <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />{t('common:buttons.refresh')}
          </SecondaryButton>
        </div>
      </div>

      {failed && (
        <div role="alert" data-testid="finance-dash-load-error">
          <PaperNote tone="red">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>{t('finance:dash.loadFailed')}</span>
              <SecondaryButton onClick={() => void load()} disabled={loading} className="bg-white">{t('common:buttons.retry')}</SecondaryButton>
            </div>
          </PaperNote>
        </div>
      )}

      <div data-tour="sec.finance-dashboard.figures">
        <InkBar className="p-5 md:p-6">
          <Mono className="relative block text-[10px] tracking-[0.16em] text-[#F97316] mb-5">{t('finance:overview.financialPosition')}</Mono>
          <div className="relative grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {figures.map(figure => (
              <button
                key={figure.key}
                type="button"
                onClick={() => onNavigate(figure.target)}
                data-testid={`finance-figure-${figure.key}`}
                className={cn('text-left p-3 border border-[#3A342C] hover:border-[#F97316] transition-colors', FOCUS_RING)}
              >
                <Mono className="block text-[10px] tracking-[0.1em] text-[#B4A992]">{figure.label}</Mono>
                {figure.waiting
                  ? <Bone className="w-32 h-9 mt-3 bg-[#2A251F]" />
                  : <span className="block font-bt-display font-bold text-[32px] leading-none text-[#F5F1E8] tabular-nums mt-3">{figure.value ?? '—'}</span>}
                <Mono className="block text-[9.5px] tracking-[0.05em] text-[#F97316] mt-3 min-h-4 normal-case">{figure.hint ?? '—'}</Mono>
              </button>
            ))}
          </div>
        </InkBar>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <section className="bg-white border border-[#E7E1D5] min-w-0" aria-label={t('finance:overview.nextPayments')} data-tour="sec.finance-dashboard.payments">
          <div className="px-5 py-4 border-b border-[#EDE7DB] flex items-center justify-between gap-3">
            <Mono className="text-[10px] font-semibold tracking-[0.12em] text-[#0A0A0A]">{t('finance:overview.nextPayments')}</Mono>
            <button type="button" onClick={() => onNavigate('accounts-payable')}
              className={cn('font-bt-mono uppercase text-[10px] tracking-[0.1em] text-[#C2410C] hover:text-[#F97316]', FOCUS_RING)}>
              {t('finance:dash.viewAll')}
            </button>
          </div>
          {payables.state === 'loading' && <div className="p-5"><Bone className="h-36" /></div>}
          {payables.state === 'error' && <p className="px-5 py-8 text-[13px] text-[#B3402A]">{t('finance:overview.payablesError')}</p>}
          {payables.state === 'ready' && nextBills.length === 0 && (
            <p className="px-5 py-8 text-[13px] text-[#8A8175]">{t('finance:overview.noPayments')}</p>
          )}
          {payables.state === 'ready' && nextBills.map(bill => (
            <button
              key={bill.id}
              type="button"
              onClick={() => onNavigate('accounts-payable')}
              className={cn('w-full px-5 py-3 border-b border-[#EDE7DB] last:border-b-0 hover:bg-[#FBF8F2] flex items-center justify-between gap-3 text-left', FOCUS_RING)}
            >
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-[#0A0A0A] truncate">{bill.vendor}</span>
                <Mono className="block text-[9.5px] text-[#8A8175] mt-1 truncate normal-case">{bill.invoiceNumber ?? bill.billNumber} · {bill.project}</Mono>
              </span>
              <span className="text-right shrink-0">
                <Mono className="block text-[12px] font-semibold tabular-nums text-[#0A0A0A]">{fmtMoney(owedOn(bill) / 100)}</Mono>
                <Mono className={cn('block text-[9.5px] mt-1', bill.dueDate < today ? 'text-[#B3402A]' : 'text-[#8A8175]')}>
                  {fmtDate(bill.dueDate, dateLocale)}
                </Mono>
              </span>
            </button>
          ))}
        </section>

        <section className="bg-white border border-[#E7E1D5] min-w-0" aria-label={t('finance:dash.recentApprovedExpenses')} data-tour="sec.finance-dashboard.expenses">
          <div className="px-5 py-4 border-b border-[#EDE7DB] flex items-center justify-between gap-3">
            <Mono className="text-[10px] font-semibold tracking-[0.12em] text-[#0A0A0A]">{t('finance:dash.recentApprovedExpenses')}</Mono>
            <button type="button" onClick={() => onNavigate('approved-expenses')}
              className={cn('font-bt-mono uppercase text-[10px] tracking-[0.1em] text-[#C2410C] hover:text-[#F97316]', FOCUS_RING)}>
              {t('finance:dash.viewAll')}
            </button>
          </div>
          {expenses.state === 'loading' && <div className="p-5"><Bone className="h-36" /></div>}
          {expenses.state === 'error' && <p className="px-5 py-8 text-[13px] text-[#B3402A]">{t('finance:overview.expensesError')}</p>}
          {expenses.state === 'ready' && expenses.data.length === 0 && (
            <div className="px-5 py-8 text-[13px] text-[#8A8175] flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />{t('finance:dash.noApprovedExpenses')}
            </div>
          )}
          {expenses.state === 'ready' && expenses.data.map(expense => (
            <div key={expense.id} className="px-5 py-3 border-b border-[#EDE7DB] last:border-b-0 flex items-center justify-between gap-3">
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-[#0A0A0A] truncate">{expense.workerName ?? expense.workerUsername}</span>
                <Mono className="block text-[9.5px] text-[#8A8175] mt-1 truncate normal-case">
                  {expense.projectName} · {t(`finance:type.${expense.expenseType}`, { defaultValue: expense.expenseType })}
                </Mono>
              </span>
              <Mono className="text-[12px] font-semibold tabular-nums text-[#0A0A0A] shrink-0">{fmtMoney(expense.amountCents / 100)}</Mono>
            </div>
          ))}
        </section>
      </div>

      <section aria-label={t('finance:overview.shortcuts')} data-tour="sec.finance-dashboard.shortcuts">
        <Mono className="block text-[10px] font-semibold tracking-[0.12em] text-[#8A8175] mb-3">{t('finance:overview.shortcuts')}</Mono>
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {shortcuts.map(shortcut => (
            <button
              key={shortcut.key}
              type="button"
              onClick={() => onNavigate(shortcut.key)}
              className={cn('bg-[#FAF7F0] border border-[#DBD0BB] p-4 text-left hover:border-[#F97316] transition-colors group', FOCUS_RING)}
            >
              <div className="flex items-center gap-2">
                <shortcut.icon className="w-4 h-4 text-[#C2410C]" />
                <Mono className="flex-1 text-[11px] font-semibold tracking-[0.08em] text-[#0A0A0A]">{shortcut.label}</Mono>
                <ArrowRight className="w-3.5 h-3.5 text-[#8A8175] group-hover:text-[#C2410C]" />
              </div>
              <p className="text-[12px] text-[#5A5346] mt-2">{shortcut.desc}</p>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
