import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownToLine, ArrowRight, ArrowUpFromLine, Banknote, CheckCircle, FileBarChart, RefreshCw, UserRound, Wallet } from 'lucide-react';
import { listAllReceivables, listAllPayables, type Payable, type Receivable } from '../../services/finance';
import { getFinanceExpenses, type ExpenseResponse } from '../../services/expenses';
import { businessToday, fmtDate } from '../../helpers/dateTime';
import { FOCUS_RING, InkBar, SecondaryButton } from '../onboarding/chrome';
import { Bone, Mono, stampDay } from '../projects/bt';
import { addDays } from '../accounts/accounting';
import { financeOverview, type AttentionDocument } from './overview';

type Block<T> = { state: 'loading' } | { state: 'error' } | { state: 'ready'; data: T };
type Navigate = (section: string, values?: Record<string, string | number | null>) => void;

export function FinanceOverview({ username, onNavigate, onStartTutorial }: {
  username: string; onNavigate: Navigate; onStartTutorial?: () => void;
}) {
  const { t, i18n } = useTranslation(['finance', 'common']);
  const [receivables, setReceivables] = useState<Block<Receivable[]>>({ state: 'loading' });
  const [payables, setPayables] = useState<Block<Payable[]>>({ state: 'loading' });
  const [expenses, setExpenses] = useState<Block<ExpenseResponse[]>>({ state: 'loading' });
  const generation = useRef(0);
  const mounted = useRef(false);
  const load = useCallback(async () => {
    const current = ++generation.current;
    const [ar, ap, recent] = await Promise.allSettled([
      listAllReceivables(), listAllPayables(), getFinanceExpenses({ size: 5, page: 0 }),
    ]);
    if (!mounted.current || current !== generation.current) return;
    setReceivables(ar.status === 'fulfilled' ? { state: 'ready', data: ar.value } : { state: 'error' });
    setPayables(ap.status === 'fulfilled' ? { state: 'ready', data: ap.value } : { state: 'error' });
    setExpenses(recent.status === 'fulfilled' ? { state: 'ready', data: recent.value.content } : { state: 'error' });
  }, []);
  useEffect(() => { mounted.current = true; void load(); return () => { mounted.current = false; }; }, [load]);
  const refresh = () => {
    setReceivables({ state: 'loading' }); setPayables({ state: 'loading' }); setExpenses({ state: 'loading' });
    void load();
  };
  const today = businessToday();
  const ar = receivables.state === 'ready' ? receivables.data : null;
  const ap = payables.state === 'ready' ? payables.data : null;
  const metrics = financeOverview(ar ?? [], ap ?? [], today);
  const loading = [receivables, payables, expenses].some(block => block.state === 'loading');
  const failed = [receivables, payables, expenses].some(block => block.state === 'error');
  const money = (cents: number | null) => cents == null ? '—' : new Intl.NumberFormat(i18n.language === 'es' ? 'es-GT' : 'en-US', { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol' }).format(cents / 100);
  const date = (value: string) => fmtDate(value, i18n.language === 'es' ? 'es' : 'en-US');
  const monthLabel = new Intl.DateTimeFormat(i18n.language === 'es' ? 'es' : 'en-US', { month: 'long', year: 'numeric' }).format(new Date(`${today.slice(0, 7)}-01T12:00:00`));
  const monthlyMax = Math.max(metrics.collected.cents, metrics.paid.cents, 1);
  const figures = [
    { key: 'receivables', label: 'overview.receivables', value: ar ? metrics.receivableBalanceCents : null, loading: receivables.state === 'loading', hint: ar ? t('finance:overview.overdueReceivables', { amount: money(metrics.overdueReceivableCents), count: metrics.overdueReceivables.length }) : null, target: 'accounts-receivable' },
    { key: 'payables', label: 'overview.payables', value: ap ? metrics.payableBalanceCents : null, loading: payables.state === 'loading', hint: ap ? t('finance:overview.overduePayables', { count: metrics.overduePayables.length }) : null, target: 'accounts-payable' },
  ];
  const openDocument = (target: string, doc: AttentionDocument) => onNavigate(target, {
    obra: null, registro: doc.id, vista: target === 'accounts-receivable' ? 'docs' : 'lanes',
    estado: null, rango: null, q: null, grupo: null, 'cliente-nombre': null, proveedor: null, categoria: null, vencidas: null,
  });
  const documentRows = (docs: AttentionDocument[], target: string) => docs.slice(0, 3).map(doc => <button key={doc.id} onClick={() => openDocument(target, doc)} className={`w-full px-5 py-3 border-t border-[#EDE7DB] hover:bg-[#FBF8F2] flex items-center justify-between gap-3 text-left ${FOCUS_RING}`}>
    <span className="min-w-0"><span className="block text-[13px] font-semibold truncate">{doc.party}</span><Mono className="block text-[9px] text-[#8A8175] mt-1 truncate">{doc.number} · {doc.project}</Mono></span>
    <span className="text-right shrink-0"><Mono className="block text-[12px] font-semibold tabular-nums">{money(doc.balanceCents)}</Mono><Mono className={`block text-[9px] mt-1 ${doc.dueDate < today ? 'text-[#B3402A]' : 'text-[#8A8175]'}`}>{date(doc.dueDate)}</Mono></span>
  </button>);
  const shortcuts = [
    { key: 'clients', label: 'nav.clients', desc: 'overview.clientsHint', icon: UserRound },
    { key: 'accounts-receivable', label: 'nav.accountsReceivable', desc: 'dash.card.accountsReceivableDesc', icon: ArrowDownToLine },
    { key: 'accounts-payable', label: 'nav.accountsPayable', desc: 'dash.card.accountsPayableDesc', icon: ArrowUpFromLine },
    { key: 'budgets', label: 'nav.budgets', desc: 'dash.card.projectBudgetsDesc', icon: Wallet },
    { key: 'expense-report', label: 'nav.expenseReport', desc: 'dash.card.expenseReportDesc', icon: FileBarChart },
    { key: 'labor-payroll', label: 'nav.laborPayroll', desc: 'dash.card.laborPayrollDesc', icon: Banknote },
  ];

  return <div className="max-w-[1500px] mx-auto space-y-5">
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
      <div><Mono className="block text-[10px] tracking-[0.16em] text-[#8A8175]">{t('finance:overview.greeting', { username })}</Mono><h2 className="font-bt-display font-extrabold uppercase text-4xl md:text-5xl leading-none text-[#0A0A0A] mt-2">{t('finance:overview.title')}</h2><p className="text-[13px] text-[#5A5346] mt-2">{t('finance:overview.subtitle')}</p></div>
      <div className="flex flex-wrap items-center gap-3"><Mono className="text-[10px] tracking-[0.08em] text-[#8A8175]">{stampDay(today, i18n.language)}</Mono>{onStartTutorial && <SecondaryButton onClick={onStartTutorial}>{t('finance:overview.guide')}</SecondaryButton>}<SecondaryButton onClick={refresh} disabled={loading} className="bg-[#FAF7F0]"><RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />{t('common:buttons.refresh')}</SecondaryButton></div>
    </div>
    {failed && <div role="alert" data-testid="finance-dash-load-error" className="border border-[#E7D0C4] bg-[#FBF0E9] p-4 flex flex-wrap items-center justify-between gap-3 text-[13px] text-[#B3402A]"><span>{t('finance:dash.loadFailed')}</span><SecondaryButton onClick={refresh} disabled={loading}>{t('common:buttons.retry')}</SecondaryButton></div>}

    <div data-tour="sec.finance-overview.position"><InkBar className="p-5 md:p-6">
      <Mono className="relative block text-[10px] tracking-[0.16em] text-[#F97316] mb-5">{t('finance:overview.financialPosition')}</Mono>
      <div className="relative grid grid-cols-1 sm:grid-cols-2 gap-5">{figures.map(figure => <button key={figure.key} onClick={() => onNavigate(figure.target)} className={`text-left p-3 border border-white/10 hover:border-[#F97316] transition-colors ${FOCUS_RING}`} data-testid={`finance-figure-${figure.key}`}>
        <Mono className="block text-[10px] tracking-[0.1em] text-[#B4A992]">{t(`finance:${figure.label}`)}</Mono>{figure.loading ? <Bone className="w-32 h-10 mt-3 bg-white/10" /> : <span className="block font-bt-display font-bold text-[32px] leading-none text-[#F5F1E8] tabular-nums mt-3">{money(figure.value)}</span>}<Mono className="block text-[9px] tracking-[0.05em] text-[#F97316] mt-3 min-h-4">{figure.hint ?? '—'}</Mono>
      </button>)}</div>
    </InkBar></div>

    <div><Mono className="block text-[10px] tracking-[0.12em] font-semibold text-[#8A8175] mb-3">{t('finance:overview.attention')}</Mono>
      <div className="grid lg:grid-cols-2 gap-5">
        <section className="bg-white border border-[#E7E1D5] min-w-0" aria-label={t('finance:overview.overdueCollections')} data-tour="sec.finance-overview.overdue">
          <div className="p-5 border-t-[3px] border-[#C2410C]">
            <div className="flex items-center justify-between gap-3"><Mono className="text-[10px] font-semibold tracking-[0.1em]">{t('finance:overview.overdueCollections')}</Mono><button onClick={() => onNavigate('accounts-receivable', { obra: null, registro: null, estado: null, rango: null, q: null, 'cliente-nombre': null, vencidas: 'true' })} className={`font-bt-mono uppercase text-[10px] text-[#C2410C] ${FOCUS_RING}`}>{t('finance:dash.viewAll')}</button></div>
            {receivables.state === 'loading' ? <Bone className="h-10 w-32 mt-3" /> : <p className="font-bt-display font-bold text-3xl text-[#B3402A] tabular-nums mt-3">{money(ar ? metrics.overdueReceivableCents : null)}</p>}
            <p className="text-[12px] text-[#8A8175] mt-2">{ar ? t('finance:overview.documents', { count: metrics.overdueReceivables.length }) : '—'} · {t('finance:overview.pendingBalance')}</p>
          </div>
          {receivables.state === 'error' ? <p className="px-5 pb-5 text-[13px] text-[#B3402A]">{t('finance:overview.receivablesError')}</p> : ar && metrics.overdueReceivables.length === 0 ? <p className="px-5 pb-5 text-[13px] text-[#8A8175]">{t('finance:overview.noOverdueCollections')}</p> : documentRows(metrics.overdueReceivables, 'accounts-receivable')}
        </section>
        <section className="bg-white border border-[#E7E1D5] min-w-0" aria-label={t('finance:overview.nextSevenDays')} data-tour="sec.finance-overview.payments">
          <div className="p-5 border-t-[3px] border-[#0A0A0A]">
            <div className="flex items-center justify-between gap-3"><Mono className="text-[10px] font-semibold tracking-[0.1em]">{t('finance:overview.nextSevenDays')}</Mono><button onClick={() => onNavigate('accounts-payable')} className={`font-bt-mono uppercase text-[10px] text-[#C2410C] ${FOCUS_RING}`}>{t('finance:dash.viewAll')}</button></div>
            {payables.state === 'loading' ? <Bone className="h-10 w-32 mt-3" /> : <p className="font-bt-display font-bold text-3xl tabular-nums mt-3">{money(ap ? metrics.nextPaymentCents : null)}</p>}
            <p className="text-[12px] text-[#8A8175] mt-2">{date(today)} – {date(addDays(today, 7))} · {ap ? t('finance:overview.documents', { count: metrics.nextPayments.length }) : '—'}</p>
          </div>
          {payables.state === 'error' ? <p className="px-5 pb-5 text-[13px] text-[#B3402A]">{t('finance:overview.payablesError')}</p> : ap && metrics.nextPayments.length === 0 ? <p className="px-5 pb-5 text-[13px] text-[#8A8175]">{t('finance:overview.noUpcomingPayments')}</p> : documentRows(metrics.nextPayments, 'accounts-payable')}
          {ap && metrics.overduePayables.length > 0 && <button onClick={() => onNavigate('accounts-payable')} className={`w-full border-t border-[#E7E1D5] bg-[#FBF0E9] px-5 py-3 text-left text-[12px] text-[#B3402A] ${FOCUS_RING}`}>{t('finance:overview.overduePaymentWarning', { amount: money(metrics.overduePayableCents), count: metrics.overduePayables.length })} →</button>}
        </section>
      </div>
    </div>

    <section className="bg-[#FAF7F0] border border-[#DBD0BB] p-5 md:p-6" aria-label={t('finance:overview.monthlyMovement')} data-tour="sec.finance-overview.month">
      <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="font-bt-display font-bold uppercase text-2xl">{t('finance:overview.monthlyMovement')}</h3><Mono className="text-[10px] text-[#8A8175]">{monthLabel} · {t('finance:overview.throughToday')}</Mono></div>
      <p className="text-[12px] text-[#5A5346] mt-2">{t('finance:overview.cashScope')}</p>
      <div className="grid md:grid-cols-[1fr_auto] gap-6 mt-5">
        <div className="space-y-5 min-w-0">{[
          { key: 'collections', label: 'overview.collectedFromClients', value: ar ? metrics.collected.cents : null, count: metrics.collected.count, state: receivables.state, color: '#42634B' },
          { key: 'paid', label: 'overview.paidToVendors', value: ap ? metrics.paid.cents : null, count: metrics.paid.count, state: payables.state, color: '#C2410C' },
        ].map(item => <div key={item.key} data-testid={`finance-figure-${item.key}`}>
          <div className="flex items-center justify-between gap-3"><div><Mono className="block text-[10px] font-semibold">{t(`finance:${item.label}`)}</Mono><span className="block text-[11px] text-[#8A8175] mt-1">{item.state === 'ready' ? t('finance:overview.paymentsRegistered', { count: item.count }) : '—'}</span></div>{item.state === 'loading' ? <Bone className="w-24 h-7" /> : <Mono className="text-[18px] font-semibold tabular-nums">{money(item.value)}</Mono>}</div>
          <div aria-hidden="true" className="h-2 bg-[#E7DECE] mt-2">{item.value != null && ar && ap && <div className="h-2" style={{ width: `${item.value / monthlyMax * 100}%`, backgroundColor: item.color }} />}</div>
        </div>)}</div>
        <div className="md:border-l border-[#DBD0BB] md:pl-6 md:min-w-[180px]" data-testid="finance-month-net"><Mono className="block text-[10px] text-[#5A5346]">{t('finance:overview.netMovement')}</Mono><p className={`font-bt-display font-bold text-3xl tabular-nums mt-3 ${metrics.netCents < 0 ? 'text-[#B3402A]' : 'text-[#42634B]'}`}>{money(ar && ap ? metrics.netCents : null)}</p><p className="text-[11px] text-[#8A8175] mt-2">{t('finance:overview.netFormula')}</p></div>
      </div>
    </section>

    <section className="bg-white border border-[#E7E1D5] min-w-0" aria-label={t('finance:dash.recentApprovedExpenses')}>
      <div className="px-5 py-4 border-b border-[#EDE7DB] flex items-center justify-between gap-3"><Mono className="text-[10px] font-semibold tracking-[0.12em]">{t('finance:dash.recentApprovedExpenses')}</Mono><button onClick={() => onNavigate('approved-expenses')} className={`font-bt-mono uppercase text-[10px] text-[#C2410C] ${FOCUS_RING}`}>{t('finance:dash.viewAll')}</button></div>
      {expenses.state === 'loading' ? <Bone className="h-24 m-5" /> : expenses.state === 'error' ? <p className="px-5 py-6 text-[13px] text-[#B3402A]">{t('finance:overview.expensesError')}</p> : expenses.data.length === 0 ? <div className="px-5 py-6 text-[13px] text-[#8A8175] flex items-center gap-2"><CheckCircle className="w-4 h-4" />{t('finance:dash.noApprovedExpenses')}</div> : expenses.data.map(expense => <div key={expense.id} className="px-5 py-3 border-b border-[#EDE7DB] flex items-center justify-between gap-3"><span className="min-w-0"><span className="block text-[13px] font-semibold truncate">{expense.workerName ?? expense.workerUsername}</span><Mono className="block text-[9px] text-[#8A8175] mt-1 truncate">{expense.projectName} · {t(`finance:type.${expense.expenseType}`, { defaultValue: expense.expenseType })}</Mono></span><Mono className="text-[12px] font-semibold tabular-nums shrink-0">{money(expense.amountCents)}</Mono></div>)}
    </section>

    <section aria-label={t('finance:overview.shortcuts')}><Mono className="block text-[10px] font-semibold tracking-[0.12em] text-[#8A8175] mb-3">{t('finance:overview.shortcuts')}</Mono><div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">{shortcuts.map(shortcut => <button key={shortcut.key} onClick={() => onNavigate(shortcut.key)} className={`bg-[#FAF7F0] border border-[#DBD0BB] p-4 text-left hover:border-[#F97316] transition-colors group ${FOCUS_RING}`}><div className="flex items-center gap-2"><shortcut.icon className="w-4 h-4 text-[#C2410C]" /><Mono className="flex-1 text-[11px] font-semibold tracking-[0.08em]">{t(`finance:${shortcut.label}`)}</Mono><ArrowRight className="w-3.5 h-3.5 text-[#8A8175] group-hover:text-[#C2410C]" /></div><p className="text-[12px] text-[#8A8175] mt-2">{t(`finance:${shortcut.desc}`)}</p></button>)}</div></section>
  </div>;
}
