import { useSectionNavigation } from '../workspace/WorkspaceState';
import { resolveSection } from '../workspace/paths';
import { useState, lazy, Suspense } from 'react';
import { useMarkDashboardReady } from '../lib/dashboardReady';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { AuthService } from '../services/auth';
import {
  LayoutDashboard, CheckCircle, FileBarChart, Clock,
  Wallet, ArrowDownToLine, ArrowUpFromLine,
  Banknote, HardHat, UserRound,
  FileSignature, HelpCircle,
} from 'lucide-react';
import { AppShell, type AppShellNavItem } from '../components/AppShell';
import { SectionTour } from '../components/onboarding/SectionTour';
import { ClientsSection } from '../components/clients/ClientsSection';
import { FinanceOverview } from '../components/finance/FinanceOverview';
import { Toaster } from '../components/ui/sonner';
// The same screens as Administration; permissions live in the shared components.
const FinanceExpenses = lazy(() =>
  import('../components/expenses/ExpensesSection').then(m => ({ default: () => <m.ExpensesSection readOnly /> }))
);
const ExpenseReportSection = lazy(() =>
  import('../components/expense-report/ExpenseReportSection').then(m => ({ default: m.ExpenseReportSection }))
);
const AccountsReceivable = lazy(() =>
  import('../components/AccountsReceivable').then(m => ({ default: m.AccountsReceivable }))
);
const AccountsPayable = lazy(() =>
  import('../components/AccountsPayable').then(m => ({ default: m.AccountsPayable }))
);
// Tiempo y material, office half only: FINANCE converts signed tickets into
// change orders. Capture lives on the site surface, which FINANCE is not on.
const TmOffice = lazy(() =>
  import('../components/tm/TmOfficeSection').then(m => ({ default: m.TmOfficeSection }))
);
// Presupuestos: the same screen the admin panel mounts, read-only. It carries
// its own Obras | Reporte switcher, so `budget-report` is no longer a section.
const BudgetsSection = lazy(() =>
  import('../components/budgets/BudgetsSection').then(m => ({ default: m.BudgetsSection }))
);
const LaborCostReport = lazy(() =>
  import('../components/labor/LaborCostScreen').then(m => ({ default: m.LaborCostScreen }))
);
const LaborPayrollReport = lazy(() =>
  import('../components/labor/LaborPayrollScreen').then(m => ({ default: m.LaborPayrollScreen }))
);
// Product decision 2026-07-01: finance approves SUPERVISOR hours (workers
// stay with admins/assigned supervisors). Same shared approvals window; the
// 'finance' mode scopes the list to supervisor-owned records server-side.
const SupervisorApprovals = lazy(() =>
  import('../components/approvals/ApprovalsInbox').then(m => ({ default: m.ApprovalsInbox }))
);

// Types & config

type ActiveSection =
  | 'dashboard'
  | 'clients'
  | 'invoices'
  | 'approved-expenses'
  | 'expense-report'
  | 'accounts-receivable'
  | 'accounts-payable'
  | 'budgets'
  | 'project-financials'
  | 'labor-cost'
  | 'labor-payroll'
  | 'supervisor-hours'
  | 'tm-office';

/**
 * Which onboarding key (SECTION_TOUR_STEPS / INTRO_SECTIONS) each section of
 * THIS panel tours under. The registries are keyed by ADMIN nav keys; most
 * finance sections collide with admin ones whose copy was written for the
 * admin panel, so only what is explicitly mapped gets a tour here. `tm-office`
 * is the same screen under the same key on both panels.
 */
const ONBOARDING_KEY: Partial<Record<ActiveSection, string>> = {
  'tm-office': 'tm-office',
};
// Presupuestos is the exception the comment above describes in reverse: the
// screen itself claims the tour with `pushTourScope`, under a finance-only key
// (`budgets-reporte-finanzas`), so the accountant gets copy written for that
// role instead of the admin's word for word.

const SECTION_META_KEYS: Record<ActiveSection, { titleKey: string; subtitleKey: string }> = {
  'clients':              { titleKey: 'finance:section.clients.title', subtitleKey: 'finance:section.clients.subtitle' },
  'dashboard':            { titleKey: 'finance:section.dashboard.title',            subtitleKey: 'finance:section.dashboard.subtitle'            },
  'tm-office':            { titleKey: 'tm:section.office.title',                    subtitleKey: 'tm:section.office.subtitle'                    },
  'invoices':             { titleKey: 'finance:section.invoices.title',             subtitleKey: 'finance:section.invoices.subtitle'             },
  'accounts-receivable':  { titleKey: 'finance:section.accountsReceivable.title',   subtitleKey: 'finance:section.accountsReceivable.subtitle'   },
  'accounts-payable':     { titleKey: 'finance:section.accountsPayable.title',      subtitleKey: 'finance:section.accountsPayable.subtitle'      },
  'approved-expenses':    { titleKey: 'finance:section.approvedExpenses.title',     subtitleKey: 'finance:section.approvedExpenses.subtitle'     },
  'expense-report':       { titleKey: 'finance:section.expenseReport.title',        subtitleKey: 'finance:section.expenseReport.subtitle'        },
  'budgets':              { titleKey: 'finance:section.budgets.title',              subtitleKey: 'finance:section.budgets.subtitle'              },
  'project-financials':   { titleKey: 'finance:section.projectFinancials.title',    subtitleKey: 'finance:section.projectFinancials.subtitle'    },
  'labor-cost':           { titleKey: 'finance:section.laborCost.title',            subtitleKey: 'finance:section.laborCost.subtitle'            },
  'labor-payroll':        { titleKey: 'finance:section.laborPayroll.title',         subtitleKey: 'finance:section.laborPayroll.subtitle'         },
  'supervisor-hours':     { titleKey: 'finance:section.supervisorHours.title',      subtitleKey: 'finance:section.supervisorHours.subtitle'      },
};

function LoadingSkeleton() {
  return <div role="status" className="animate-pulse h-64 bg-[#FAF7F0] border border-[#DBD0BB]" />;
}

// Main component

export function FinanceDashboard({ initialSection }: { initialSection?: ActiveSection } = {}) {
  return <FinancePanel key={initialSection ?? 'dashboard'} initialSection={initialSection} />;
}

function FinancePanel({ initialSection }: { initialSection?: ActiveSection }) {
  // The welcome overlay fades once this page is on screen (lib/dashboardReady).
  useMarkDashboardReady();
  const navigate    = useNavigate();
  // `admin` is on the list because the onboarding chrome (the "?" tooltip)
  // lives there — SectionTour reads that namespace itself.
  const { t }       = useTranslation(['finance', 'common', 'tm', 'admin']);
  const username    = AuthService.getUsername() ?? 'finance';
  /** Bumped by the topbar "?" — replays the tour of the section on screen. */
  const [introReplay, setIntroReplay] = useState(0);
  // `initialSection` lets a deep-link route (e.g. /finance/expenses) open the
  // dashboard straight on a section while keeping the full shell + sidebar.
  const [activeSection, navigateSection] = useSectionNavigation<ActiveSection>('FINANCE', initialSection === 'invoices' ? 'accounts-receivable' : initialSection === 'project-financials' ? 'budgets' : initialSection ?? 'dashboard');

  const handleLogout   = () => { document.cookie = 'ofjr_session=; Path=/; Max-Age=0'; navigate('/'); AuthService.logout(); };
  const handleNavigate = (section: string) => {
    const resolved = resolveSection('FINANCE', section);
    if (!(resolved in SECTION_META_KEYS)) return;
    navigateSection(resolved);
  };

  const navItems: AppShellNavItem[] = [
    { key: 'dashboard', label: t('common:workspace.home'), icon: LayoutDashboard },
    { key: 'accounts-receivable', label: t('finance:nav.accountsReceivable'), icon: ArrowDownToLine, group: 'collections' },
    { key: 'clients', label: t('finance:nav.clients'), icon: UserRound, group: 'collections' },
    { key: 'tm-office', label: t('tm:nav.office'), icon: FileSignature, group: 'collections' },
    { key: 'accounts-payable', label: t('finance:nav.accountsPayable'), icon: ArrowUpFromLine, group: 'payments' },
    { key: 'approved-expenses', label: t('finance:nav.approvedExpenses'), icon: CheckCircle, group: 'payments' },
    { key: 'labor-payroll', label: t('finance:nav.laborPayroll'), icon: Banknote, group: 'payroll' },
    { key: 'supervisor-hours', label: t('finance:nav.supervisorHours'), icon: Clock, group: 'payroll' },
    { key: 'budgets', label: t('finance:nav.budgets'), icon: Wallet, group: 'works' },
    { key: 'labor-cost', label: t('finance:nav.laborCost'), icon: HardHat, group: 'reports' },
    { key: 'expense-report', label: t('finance:nav.expenseReport'), icon: FileBarChart, group: 'reports' },
  ];
  const navGroups = [
    { key: 'collections', label: t('common:workspace.collections'), icon: ArrowDownToLine },
    { key: 'payments', label: t('common:workspace.payments'), icon: ArrowUpFromLine },
    { key: 'payroll', label: t('common:workspace.payroll'), icon: Banknote },
    { key: 'works', label: t('common:workspace.works'), icon: Wallet },
    { key: 'reports', label: t('common:workspace.reports'), icon: FileBarChart },
  ];

  const metaKeys = SECTION_META_KEYS[activeSection];
  const onboardingKey = ONBOARDING_KEY[activeSection];

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
        topbarExtra={
          /* Only offered where there is a tour to replay — same button as the
             admin topbar's. */
          onboardingKey ? (
            <button
              onClick={() => setIntroReplay(n => n + 1)}
              title={t('admin:tour.helpButton')}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-[#71717A] hover:text-[#F97316] hover:bg-[#FAFAFA] transition-colors"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          ) : null
        }
      >
        {onboardingKey && (
          <SectionTour autoStart={false} section={onboardingKey} username={username} replayNonce={introReplay} sectionLabel={t(metaKeys.titleKey)} />
        )}
        {activeSection === 'dashboard' && (
          <FinanceOverview username={username} onNavigate={handleNavigate} />
        )}
        {activeSection === 'clients' && (
          <Suspense fallback={<LoadingSkeleton />}>
            <ClientsSection readOnly projectSection="budgets" onNavigate={handleNavigate} />
          </Suspense>
        )}
        {activeSection === 'tm-office' && (
          <Suspense fallback={<LoadingSkeleton />}>
            <TmOffice />
          </Suspense>
        )}
        {activeSection === 'accounts-receivable' && (
          <Suspense fallback={<LoadingSkeleton />}>
            <AccountsReceivable onNavigate={handleNavigate} />
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
            <ExpenseReportSection readOnly onNavigate={handleNavigate} />
          </Suspense>
        )}
        {activeSection === 'budgets' && (
          <Suspense fallback={<LoadingSkeleton />}>
            <BudgetsSection readOnly onNavigate={handleNavigate} />
          </Suspense>
        )}
        {activeSection === 'labor-cost' && (
          <Suspense fallback={<LoadingSkeleton />}>
            <LaborCostReport mode="finance" onNavigate={handleNavigate} />
          </Suspense>
        )}
        {activeSection === 'labor-payroll' && (
          <Suspense fallback={<LoadingSkeleton />}>
            <LaborPayrollReport mode="finance" onNavigate={handleNavigate} />
          </Suspense>
        )}
        {activeSection === 'supervisor-hours' && (
          <Suspense fallback={<LoadingSkeleton />}>
            <SupervisorApprovals mode="finance" />
          </Suspense>
        )}
      </AppShell>
      <Toaster position="top-right" richColors />
    </>
  );
}
