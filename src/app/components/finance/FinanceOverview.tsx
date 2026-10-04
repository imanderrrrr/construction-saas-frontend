import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownToLine, ArrowRight, ArrowUpFromLine, Banknote, CheckCircle, FileBarChart, RefreshCw, UserRound, Wallet } from 'lucide-react';
import { getReceivableSummary, listAllPayables, type Payable, type ReceivableSummary } from '../../services/finance';
import { getFinanceExpenses, getFinanceExpenseReport, type ExpenseResponse, type ExpenseReportResponse } from '../../services/expenses';
import { businessToday, fmtDate } from '../../helpers/dateTime';
import { FOCUS_RING, InkBar, SecondaryButton } from '../onboarding/chrome';
import { Bone, Mono, PaperNote, stampDay } from '../projects/bt';

type Block<T> = { state: 'loading' } | { state: 'error' } | { state: 'ready'; data: T };

export function FinanceOverview({ username, onNavigate }: { username: string; onNavigate: (section: string) => void }) {
  const { t, i18n } = useTranslation(['finance', 'common']);
  const [receivables, setReceivables] = useState<Block<ReceivableSummary>>({ state: 'loading' });
  const [payables, setPayables] = useState<Block<Payable[]>>({ state: 'loading' });
  const [expenses, setExpenses] = useState<Block<ExpenseResponse[]>>({ state: 'loading' });
  const [report, setReport] = useState<Block<ExpenseReportResponse>>({ state: 'loading' });
  const generation = useRef(0);
  const mounted = useRef(false);

  const load = useCallback(async () => {
    const current = ++generation.current;
    const [ar, ap, recent, totals] = await Promise.allSettled([
      getReceivableSummary(), listAllPayables(),
      getFinanceExpenses({ size: 5, page: 0 }), getFinanceExpenseReport({}),
    ]);
    if (!mounted.current || current !== generation.current) return;
    setReceivables(ar.status === 'fulfilled' ? { state: 'ready', data: ar.value } : { state: 'error' });
    setPayables(ap.status === 'fulfilled' ? { state: 'ready', data: ap.value } : { state: 'error' });
    setExpenses(recent.status === 'fulfilled' ? { state: 'ready', data: recent.value.content } : { state: 'error' });
    setReport(totals.status === 'fulfilled' ? { state: 'ready', data: totals.value } : { state: 'error' });
  }, []);
  useEffect(() => { mounted.current = true; void load(); return () => { mounted.current = false; }; }, [load]);
  const refresh = () => {
    setReceivables({ state: 'loading' });
    setPayables({ state: 'loading' });
    setExpenses({ state: 'loading' });
    setReport({ state: 'loading' });
    void load();
  };

  const today = businessToday();
  const ar = receivables.state === 'ready' ? receivables.data : null;
  const ap = payables.state === 'ready' ? payables.data : null;
  const outstandingBills = ap?.filter(bill => bill.amount > bill.paidAmount) ?? [];
  const overdueBills = outstandingBills.filter(bill => bill.dueDate < today);
  const dueBills = [...outstandingBills].sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id - b.id).slice(0, 5);
  const remaining = (bill: Payable) => Math.round(bill.amount * 100) - Math.round(bill.paidAmount * 100);
  const payableBalance = ap ? outstandingBills.reduce((sum, bill) => sum + remaining(bill), 0) : null;
  const loading = [receivables, payables, expenses, report].some(block => block.state === 'loading');
  const failed = [receivables, payables, expenses, report].some(block => block.state === 'error');
  const money = (cents: number | null) => cents == null ? '—' : new Intl.NumberFormat(i18n.language === 'es' ? 'es-GT' : 'en-US', { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol' }).format(cents / 100);

  const figures = [
    { key: 'receivables', label: 'overview.receivables', value: ar ? Math.round(ar.outstanding * 100) : null, loading: receivables.state === 'loading', hint: ar ? t('finance:overview.overdueReceivables', { amount: money(Math.round(ar.overdue * 100)), count: ar.overdueCount }) : null, target: 'accounts-receivable' },
    { key: 'payables', label: 'overview.payables', value: payableBalance, loading: payables.state === 'loading', hint: ap ? t('finance:overview.overduePayables', { count: overdueBills.length }) : null, target: 'accounts-payable' },
    { key: 'collections', label: 'overview.collections', value: ar ? Math.round(ar.collectedThisMonth * 100) : null, loading: receivables.state === 'loading', hint: ar ? new Intl.DateTimeFormat(i18n.language === 'es' ? 'es' : 'en-US', { month: 'short', year: 'numeric' }).format(new Date(`${ar.month}-01T12:00:00`)) : null, target: 'accounts-receivable' },
    { key: 'expenses', label: 'overview.expenses', value: report.state === 'ready' ? report.data.kpis.totalApprovedCents : null, loading: report.state === 'loading', hint: report.state === 'ready' ? t('finance:overview.expenseCount', { count: report.data.kpis.expenseCount }) : null, target: 'approved-expenses' },
  ];

  const shortcuts = [
    { key: 'clients', label: 'nav.clients', desc: 'overview.clientsHint', icon: UserRound },
    { key: 'accounts-receivable', label: 'nav.accountsReceivable', desc: 'dash.card.accountsReceivableDesc', icon: ArrowDownToLine },
    { key: 'accounts-payable', label: 'nav.accountsPayable', desc: 'dash.card.accountsPayableDesc', icon: ArrowUpFromLine },
    { key: 'budgets', label: 'nav.budgets', desc: 'dash.card.projectBudgetsDesc', icon: Wallet },
    { key: 'expense-report', label: 'nav.expenseReport', desc: 'dash.card.expenseReportDesc', icon: FileBarChart },
    { key: 'labor-payroll', label: 'nav.laborPayroll', desc: 'dash.card.laborPayrollDesc', icon: Banknote },
  ];

  return (
    <div className="max-w-[1500px] mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <Mono className="block text-[10px] tracking-[0.16em] text-[#8A8175]">{t('finance:overview.greeting', { username })}</Mono>
          <h2 className="font-bt-display font-extrabold uppercase text-4xl md:text-5xl leading-none text-[#0A0A0A] mt-2">{t('finance:overview.title')}</h2>
          <p className="text-[13px] text-[#5A5346] mt-2">{t('finance:overview.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <Mono className="text-[10px] tracking-[0.08em] text-[#8A8175]">{stampDay(today, i18n.language)}</Mono>
          <SecondaryButton onClick={refresh} disabled={loading} className="bg-[#FAF7F0]">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />{t('common:buttons.refresh')}
          </SecondaryButton>
        </div>
      </div>

      {failed && <div role="alert" data-testid="finance-dash-load-error"><PaperNote tone="red">
        <div className="flex flex-wrap items-center justify-between gap-3"><span>{t('finance:dash.loadFailed')}</span><SecondaryButton onClick={refresh} disabled={loading}>{t('common:buttons.retry')}</SecondaryButton></div>
      </PaperNote></div>}

      <InkBar className="p-5 md:p-6">
        <Mono className="relative block text-[10px] tracking-[0.16em] text-[#F97316] mb-5">{t('finance:overview.financialPosition')}</Mono>
        <div className="relative grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {figures.map(figure => <button key={figure.key} onClick={() => onNavigate(figure.target)} className={`text-left p-3 border border-white/10 hover:border-[#F97316] transition-colors ${FOCUS_RING}`} data-testid={`finance-figure-${figure.key}`}>
            <Mono className="block text-[10px] tracking-[0.1em] text-[#B4A992]">{t(`finance:${figure.label}`)}</Mono>
            {figure.loading ? <Bone className="w-32 h-10 mt-3 bg-white/10" /> : <span className="block font-bt-display font-bold text-[32px] leading-none text-[#F5F1E8] tabular-nums mt-3">{money(figure.value)}</span>}
            <Mono className="block text-[9px] tracking-[0.05em] text-[#F97316] mt-3 min-h-4">{figure.hint ?? '—'}</Mono>
          </button>)}
        </div>
      </InkBar>

      <div className="grid lg:grid-cols-2 gap-5">
        <section className="bg-white border border-[#E7E1D5] min-w-0" aria-label={t('finance:overview.nextPayments')}>
          <div className="px-5 py-4 border-b border-[#EDE7DB] flex items-center justify-between gap-3">
            <Mono className="text-[10px] font-semibold tracking-[0.12em]">{t('finance:overview.nextPayments')}</Mono>
            <button onClick={() => onNavigate('accounts-payable')} className={`font-bt-mono uppercase text-[10px] text-[#C2410C] ${FOCUS_RING}`}>{t('finance:dash.viewAll')}</button>
          </div>
          {payables.state === 'loading' ? <Bone className="h-36 m-5" /> : payables.state === 'error' ? <p className="px-5 py-8 text-[13px] text-[#B3402A]">{t('finance:overview.payablesError')}</p> : dueBills.length === 0 ? <p className="px-5 py-8 text-[13px] text-[#8A8175]">{t('finance:overview.noPayments')}</p> : dueBills.map(bill => <button key={bill.id} onClick={() => onNavigate('accounts-payable')} className={`w-full px-5 py-3 border-b border-[#EDE7DB] hover:bg-[#FBF8F2] flex items-center justify-between gap-3 text-left ${FOCUS_RING}`}>
            <span className="min-w-0"><span className="block text-[13px] font-semibold truncate">{bill.vendor}</span><Mono className="block text-[9px] text-[#8A8175] mt-1 truncate">{bill.invoiceNumber ?? bill.billNumber} · {bill.project}</Mono></span>
            <span className="text-right shrink-0"><Mono className="block text-[12px] font-semibold tabular-nums">{money(remaining(bill))}</Mono><Mono className={`block text-[9px] mt-1 ${bill.dueDate < today ? 'text-[#B3402A]' : 'text-[#8A8175]'}`}>{fmtDate(bill.dueDate, i18n.language === 'es' ? 'es' : 'en-US')}</Mono></span>
          </button>)}
        </section>

        <section className="bg-white border border-[#E7E1D5] min-w-0" aria-label={t('finance:dash.recentApprovedExpenses')}>
          <div className="px-5 py-4 border-b border-[#EDE7DB] flex items-center justify-between gap-3">
            <Mono className="text-[10px] font-semibold tracking-[0.12em]">{t('finance:dash.recentApprovedExpenses')}</Mono>
            <button onClick={() => onNavigate('approved-expenses')} className={`font-bt-mono uppercase text-[10px] text-[#C2410C] ${FOCUS_RING}`}>{t('finance:dash.viewAll')}</button>
          </div>
          {expenses.state === 'loading' ? <Bone className="h-36 m-5" /> : expenses.state === 'error' ? <p className="px-5 py-8 text-[13px] text-[#B3402A]">{t('finance:overview.expensesError')}</p> : expenses.data.length === 0 ? <div className="px-5 py-8 text-[13px] text-[#8A8175] flex items-center gap-2"><CheckCircle className="w-4 h-4" />{t('finance:dash.noApprovedExpenses')}</div> : expenses.data.map(expense => <div key={expense.id} className="px-5 py-3 border-b border-[#EDE7DB] flex items-center justify-between gap-3">
            <span className="min-w-0"><span className="block text-[13px] font-semibold truncate">{expense.workerName ?? expense.workerUsername}</span><Mono className="block text-[9px] text-[#8A8175] mt-1 truncate">{expense.projectName} · {t(`finance:type.${expense.expenseType}`, { defaultValue: expense.expenseType })}</Mono></span><Mono className="text-[12px] font-semibold tabular-nums shrink-0">{money(expense.amountCents)}</Mono>
          </div>)}
        </section>
      </div>

      <section aria-label={t('finance:overview.shortcuts')}>
        <Mono className="block text-[10px] font-semibold tracking-[0.12em] text-[#8A8175] mb-3">{t('finance:overview.shortcuts')}</Mono>
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {shortcuts.map(shortcut => <button key={shortcut.key} onClick={() => onNavigate(shortcut.key)} className={`bg-[#FAF7F0] border border-[#DBD0BB] p-4 text-left hover:border-[#F97316] transition-colors group ${FOCUS_RING}`}>
            <div className="flex items-center gap-2"><shortcut.icon className="w-4 h-4 text-[#C2410C]" /><Mono className="flex-1 text-[11px] font-semibold tracking-[0.08em]">{t(`finance:${shortcut.label}`)}</Mono><ArrowRight className="w-3.5 h-3.5 text-[#8A8175] group-hover:text-[#C2410C]" /></div>
            <p className="text-[12px] text-[#8A8175] mt-2">{t(`finance:${shortcut.desc}`)}</p>
          </button>)}
        </div>
      </section>
    </div>
  );
}
