import { useState, useMemo, useEffect, useCallback, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { AuthService } from '../services/auth';
import {
  LayoutDashboard, CheckCircle, FileBarChart, DollarSign, Clock,
  Wallet, PieChart, ArrowDownToLine, ArrowUpFromLine, BarChart3,
  TrendingUp, TrendingDown, AlertTriangle, Receipt, Banknote, HardHat, Loader2, FileText,
} from 'lucide-react';
import { AppShell, type AppShellNavItem } from '../components/AppShell';
import { StatCard } from '../components/StatCard';
import { Toaster } from '../components/ui/sonner';
import {
  getFinanceExpenses, getFinanceExpenseReport,
  type ExpenseResponse, type ExpenseReportResponse,
} from '../services/expenses';

// Lazy-loaded sections

const FinanceExpenses = lazy(() =>
  import('../components/FinanceExpenses').then(m => ({ default: m.FinanceExpenses }))
);
const ExpenseReport = lazy(() =>
  import('../components/ExpenseReport').then(m => ({ default: m.ExpenseReport }))
);
const FinanceBudgets = lazy(() =>
  import('../components/FinanceBudgets').then(m => ({ default: m.FinanceBudgets }))
);
const BudgetReport = lazy(() =>
  import('../components/BudgetReport').then(m => ({ default: m.BudgetReport }))
);
const AccountsReceivable = lazy(() =>
  import('../components/AccountsReceivable').then(m => ({ default: m.AccountsReceivable }))
);
const AccountsPayable = lazy(() =>
  import('../components/AccountsPayable').then(m => ({ default: m.AccountsPayable }))
);
const InvoiceManager = lazy(() =>
  import('../components/InvoiceManager').then(m => ({ default: m.InvoiceManager }))
);
const ProjectFinancials = lazy(() =>
  import('../components/ProjectFinancials').then(m => ({ default: m.ProjectFinancials }))
);
const LaborCostReport = lazy(() =>
  import('../components/LaborCostReport').then(m => ({ default: m.LaborCostReport }))
);
const LaborPayrollReport = lazy(() =>
  import('../components/LaborPayrollReport').then(m => ({ default: m.LaborPayrollReport }))
);

// Types & config

type ActiveSection =
  | 'dashboard'
  | 'invoices'
  | 'approved-expenses'
  | 'expense-report'
  | 'accounts-receivable'
  | 'accounts-payable'
  | 'budgets'
  | 'budget-report'
  | 'project-financials'
  | 'labor-cost'
  | 'labor-payroll';

const SECTION_META_KEYS: Record<ActiveSection, { titleKey: string; subtitleKey: string }> = {
  'dashboard':            { titleKey: 'finance:section.dashboard.title',            subtitleKey: 'finance:section.dashboard.subtitle'            },
  'invoices':             { titleKey: 'finance:section.invoices.title',             subtitleKey: 'finance:section.invoices.subtitle'             },
  'accounts-receivable':  { titleKey: 'finance:section.accountsReceivable.title',   subtitleKey: 'finance:section.accountsReceivable.subtitle'   },
  'accounts-payable':     { titleKey: 'finance:section.accountsPayable.title',      subtitleKey: 'finance:section.accountsPayable.subtitle'      },
  'approved-expenses':    { titleKey: 'finance:section.approvedExpenses.title',     subtitleKey: 'finance:section.approvedExpenses.subtitle'     },
  'expense-report':       { titleKey: 'finance:section.expenseReport.title',        subtitleKey: 'finance:section.expenseReport.subtitle'        },
  'budgets':              { titleKey: 'finance:section.budgets.title',              subtitleKey: 'finance:section.budgets.subtitle'              },
  'budget-report':        { titleKey: 'finance:section.budgetReport.title',         subtitleKey: 'finance:section.budgetReport.subtitle'         },
  'project-financials':   { titleKey: 'finance:section.projectFinancials.title',    subtitleKey: 'finance:section.projectFinancials.subtitle'    },
  'labor-cost':           { titleKey: 'finance:section.laborCost.title',            subtitleKey: 'finance:section.laborCost.subtitle'            },
  'labor-payroll':        { titleKey: 'finance:section.laborPayroll.title',         subtitleKey: 'finance:section.laborPayroll.subtitle'         },
};

// Helpers

function fmtDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtAmount(n: number) {
  return `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}
function fmtCents(c: number) {
  return fmtAmount(c / 100);
}

// Loading skeleton

function LoadingSkeleton() {
  return <div className="animate-pulse h-64 bg-white rounded-xl border border-[#D4D4D8]" />;
}

// Dashboard view

function DashboardView({ username, onNavigate }: { username: string; onNavigate: (s: string) => void }) {
  const { t } = useTranslation('finance');
  const [loading, setLoading] = useState(true);
  const [recentExpenses, setRecentExpenses] = useState<ExpenseResponse[]>([]);
  const [report, setReport] = useState<ExpenseReportResponse | null>(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const [expensesRes, reportRes] = await Promise.all([
        getFinanceExpenses({ size: 5, page: 0 }),
        getFinanceExpenseReport({}),
      ]);
      setRecentExpenses(expensesRes.content);
      setReport(reportRes);
    } catch {
      /* degrade gracefully — cards show "—" */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  const totalApproved = report ? fmtCents(report.kpis.totalApprovedCents) : '—';
  const avgPerWorker = report?.kpis.avgPerWorkerCents != null ? fmtCents(report.kpis.avgPerWorkerCents) : '—';
  const expenseCount = report ? String(report.kpis.expenseCount) : '—';
  const topCategory = report?.kpis.topCategory
    ? t(`type.${report.kpis.topCategory}`, { defaultValue: report.kpis.topCategory })
    : '—';
  const recentTotal = recentExpenses.reduce((s, e) => s + e.amountCents, 0) / 100;

  const tableHeaders = [
    t('dash.table.date'), t('dash.table.worker'), t('dash.table.type'),
    t('dash.table.amount'), t('dash.table.project'),
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Welcome header */}
      <div>
        <h2 className="text-2xl font-bold text-[#0A0A0A]">{t('dash.welcome', { username })}</h2>
        <p className="text-sm text-[#71717A] mt-1">{t('dash.financialOverview')}</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={DollarSign}   title={t('dash.totalApproved')}  value={loading ? '...' : totalApproved}  subtitle={t('dash.allApprovedExpenses')}   iconBgColor="bg-purple-50"  iconColor="text-purple-600"  />
        <StatCard icon={TrendingDown} title={t('dash.avgPerWorker')}   value={loading ? '...' : avgPerWorker}   subtitle={t('dash.perActiveWorker')}       iconBgColor="bg-amber-50"   iconColor="text-amber-600"   />
        <StatCard icon={TrendingUp}   title={t('dash.topCategory')}    value={loading ? '...' : topCategory}    subtitle={t('dash.byTotalAmount')}         iconBgColor="bg-emerald-50" iconColor="text-emerald-600" />
        <StatCard icon={Receipt}      title={t('dash.expenseCount')}   value={loading ? '...' : expenseCount}   subtitle={t('dash.totalRecords')}          iconBgColor="bg-purple-50"  iconColor="text-purple-600"  />
      </div>

      {/* Recent approved expenses */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#D4D4D8]">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-[#71717A]" />
            <span className="text-sm font-semibold text-[#0A0A0A]">{t('dash.recentApprovedExpenses')}</span>
            <span className="text-xs text-[#71717A]">· {t('dash.last5')}</span>
          </div>
          <button onClick={() => onNavigate('approved-expenses')}
            className="text-xs font-medium text-purple-600 hover:text-purple-800 transition-colors">
            {t('dash.viewAll')}
          </button>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
          </div>
        ) : recentExpenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <CheckCircle className="w-8 h-8 text-[#D4D4D8] mb-2" />
            <p className="text-sm font-medium text-[#71717A]">{t('dash.noApprovedExpenses')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#FAFAFA]">
                  {tableHeaders.map(h => (
                    <th key={h} className="text-left text-[11px] font-semibold text-[#71717A] uppercase tracking-wider px-4 py-2.5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentExpenses.map(exp => (
                  <tr key={exp.id} className="border-t border-[#D4D4D8]/50 hover:bg-[#FAFAFA]/50 transition-colors">
                    <td className="px-4 py-3 text-sm text-[#0A0A0A] whitespace-nowrap">{fmtDate(exp.expenseDate)}</td>
                    <td className="px-4 py-3 text-sm text-[#0A0A0A]">{exp.workerName ?? exp.workerUsername}</td>
                    <td className="px-4 py-3 text-sm text-[#71717A]">{t(`type.${exp.expenseType}`, { defaultValue: exp.expenseType })}</td>
                    <td className="px-4 py-3 font-mono font-semibold text-sm text-[#0A0A0A]">{fmtAmount(exp.amountCents / 100)}</td>
                    <td className="px-4 py-3 text-sm text-[#71717A]">{exp.projectName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && recentExpenses.length > 0 && (
          <div className="px-6 py-3 border-t border-[#D4D4D8]/50 bg-[#FAFAFA]/50 flex items-center justify-between">
            <p className="text-[11px] text-[#71717A]">{t('dash.showingRecent', { count: recentExpenses.length })}</p>
            <p className="text-[11px] font-medium text-[#0A0A0A]">
              {t('dash.total')} <span className="font-mono">{fmtAmount(recentTotal)}</span>
            </p>
          </div>
        )}
      </div>

      {/* Quick access cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { key: 'invoices',             icon: FileText,        label: t('dash.card.invoices'),            desc: t('dash.card.invoicesDesc')            },
          { key: 'accounts-receivable', icon: ArrowDownToLine, label: t('dash.card.accountsReceivable'), desc: t('dash.card.accountsReceivableDesc') },
          { key: 'accounts-payable',    icon: ArrowUpFromLine, label: t('dash.card.accountsPayable'),    desc: t('dash.card.accountsPayableDesc')    },
          { key: 'approved-expenses',   icon: CheckCircle,     label: t('dash.card.approvedExpenses'),   desc: t('dash.card.approvedExpensesDesc')   },
          { key: 'expense-report',      icon: FileBarChart,    label: t('dash.card.expenseReport'),      desc: t('dash.card.expenseReportDesc')      },
          { key: 'budgets',             icon: Wallet,          label: t('dash.card.projectBudgets'),     desc: t('dash.card.projectBudgetsDesc')     },
          { key: 'project-financials',  icon: BarChart3,       label: t('dash.card.projectFinancials'),  desc: t('dash.card.projectFinancialsDesc')  },
          { key: 'labor-cost',          icon: HardHat,         label: t('dash.card.laborCost'),           desc: t('dash.card.laborCostDesc')          },
          { key: 'labor-payroll',       icon: Banknote,        label: t('dash.card.laborPayroll'),        desc: t('dash.card.laborPayrollDesc')       },
        ].map(card => (
          <button key={card.key} onClick={() => onNavigate(card.key)}
            className="bg-white rounded-xl border border-[#D4D4D8] p-5 text-left hover:border-purple-400 hover:shadow-sm transition-all group">
            <div className="w-9 h-9 bg-purple-50 rounded-lg flex items-center justify-center mb-3">
              <card.icon className="text-purple-600" style={{ width: 18, height: 18 }} />
            </div>
            <p className="text-sm font-semibold text-[#0A0A0A] mb-0.5 group-hover:text-purple-600 transition-colors">{card.label}</p>
            <p className="text-xs text-[#71717A]">{card.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// Main component

export function FinanceDashboard() {
  const navigate    = useNavigate();
  const { t }       = useTranslation(['finance', 'common']);
  const username    = AuthService.getUsername() ?? 'finance';
  const [activeSection, setActiveSection] = useState<ActiveSection>('dashboard');

  const handleLogout   = () => { document.cookie = 'ofjr_session=; Path=/; Max-Age=0'; navigate('/'); AuthService.logout(); };
  const handleNavigate = (section: string) => setActiveSection(section as ActiveSection);

  const navItems: AppShellNavItem[] = useMemo(() => [
    { key: 'dashboard',            label: t('finance:nav.dashboard'),            icon: LayoutDashboard },
    { key: 'invoices',              label: t('finance:nav.invoices'),              icon: FileText,        group: 'accounting' },
    { key: 'accounts-receivable',  label: t('finance:nav.accountsReceivable'),   icon: ArrowDownToLine, group: 'accounting' },
    { key: 'accounts-payable',     label: t('finance:nav.accountsPayable'),      icon: ArrowUpFromLine, group: 'accounting' },
    { key: 'approved-expenses',    label: t('finance:nav.approvedExpenses'),     icon: CheckCircle,     group: 'expenses'   },
    { key: 'expense-report',       label: t('finance:nav.expenseReport'),        icon: FileBarChart,    group: 'expenses'   },
    { key: 'budgets',              label: t('finance:nav.budgets'),              icon: Wallet,          group: 'budgets'    },
    { key: 'budget-report',        label: t('finance:nav.budgetReport'),         icon: PieChart,        group: 'budgets'    },
    { key: 'project-financials',   label: t('finance:nav.projectFinancials'),    icon: BarChart3,       group: 'budgets'    },
    { key: 'labor-cost',           label: t('finance:nav.laborCost'),            icon: HardHat,         group: 'labor'      },
    { key: 'labor-payroll',        label: t('finance:nav.laborPayroll'),         icon: Banknote,        group: 'labor'      },
  ], [t]);

  const navGroups = useMemo(() => [
    { key: 'accounting', label: t('finance:group.accounting') },
    { key: 'expenses',   label: t('finance:group.expenses')   },
    { key: 'budgets',    label: t('finance:group.budgets')     },
    { key: 'labor',      label: t('finance:group.labor')       },
  ], [t]);

  const metaKeys = SECTION_META_KEYS[activeSection];

  return (
    <>
      <AppShell
        role="FINANCE"
        username={username}
        panelLabel={t('finance:panelLabel')}
        navItems={navItems}
        navGroups={navGroups}
        activeSection={activeSection}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        pageTitle={t(metaKeys.titleKey)}
        pageSubtitle={t(metaKeys.subtitleKey)}
      >
        {activeSection === 'dashboard' && (
          <DashboardView username={username} onNavigate={handleNavigate} />
        )}
        {activeSection === 'invoices' && (
          <Suspense fallback={<LoadingSkeleton />}>
            <InvoiceManager />
          </Suspense>
        )}
        {activeSection === 'accounts-receivable' && (
          <Suspense fallback={<LoadingSkeleton />}>
            <AccountsReceivable />
          </Suspense>
        )}
        {activeSection === 'accounts-payable' && (
          <Suspense fallback={<LoadingSkeleton />}>
            <AccountsPayable />
          </Suspense>
        )}
        {activeSection === 'approved-expenses' && (
          <Suspense fallback={<LoadingSkeleton />}>
            <FinanceExpenses />
          </Suspense>
        )}
        {activeSection === 'expense-report' && (
          <Suspense fallback={<LoadingSkeleton />}>
            <ExpenseReport readOnly />
          </Suspense>
        )}
        {activeSection === 'budgets' && (
          <Suspense fallback={<LoadingSkeleton />}>
            <FinanceBudgets />
          </Suspense>
        )}
        {activeSection === 'budget-report' && (
          <Suspense fallback={<LoadingSkeleton />}>
            <BudgetReport readOnly />
          </Suspense>
        )}
        {activeSection === 'project-financials' && (
          <Suspense fallback={<LoadingSkeleton />}>
            <ProjectFinancials />
          </Suspense>
        )}
        {activeSection === 'labor-cost' && (
          <Suspense fallback={<LoadingSkeleton />}>
            <LaborCostReport />
          </Suspense>
        )}
        {activeSection === 'labor-payroll' && (
          <Suspense fallback={<LoadingSkeleton />}>
            <LaborPayrollReport />
          </Suspense>
        )}
      </AppShell>
      <Toaster position="top-right" richColors />
    </>
  );
}
