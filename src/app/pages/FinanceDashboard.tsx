import { useState, useMemo, lazy, Suspense } from 'react';
import { useMarkDashboardReady } from '../lib/dashboardReady';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { AuthService } from '../services/auth';
import {
  LayoutDashboard, CheckCircle, FileBarChart, Clock,
  Wallet, ArrowDownToLine, ArrowUpFromLine, Banknote, HardHat, UserRound,
  FileSignature, HelpCircle,
} from 'lucide-react';
import { AppShell, type AppShellNavItem } from '../components/AppShell';
import { SectionTour } from '../components/onboarding/SectionTour';
import { FOCUS_RING } from '../components/onboarding/chrome';
import { FinanceOverview } from '../components/finance/FinanceOverview';
import { Toaster } from '../components/ui/sonner';
import { cn } from '../components/ui/utils';
import { setSectionIntent } from '../lib/sectionIntent';

// Lazy-loaded sections. FINANCE gets the same screens as Administration —
// the admin panel's design and components — and what this role may not do is
// decided by the components (read-only clients and budgets, finance modes of
// labor and approvals), never by a second, older copy of each screen.

const ClientsSection = lazy(() =>
  import('../components/clients/ClientsSection').then(m => ({ default: m.ClientsSection }))
);
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
// its own Obras | Reporte switcher, so `budget-report` is no longer a section,
// and it answers what `project-financials` used to (that section is retired).
const BudgetsSection = lazy(() =>
  import('../components/budgets/BudgetsSection').then(m => ({ default: m.BudgetsSection }))
);
const LaborCostScreen = lazy(() =>
  import('../components/labor/LaborCostScreen').then(m => ({ default: m.LaborCostScreen }))
);
const LaborPayrollScreen = lazy(() =>
  import('../components/labor/LaborPayrollScreen').then(m => ({ default: m.LaborPayrollScreen }))
);
// Product decision 2026-07-01: finance approves SUPERVISOR hours (workers
// stay with admins/assigned supervisors). The admin's approvals inbox in its
// finance mode, scoped to supervisor-owned records server-side.
const ApprovalsInbox = lazy(() =>
  import('../components/approvals/ApprovalsInbox').then(m => ({ default: m.ApprovalsInbox }))
);

// Types & config

export type FinanceSection =
  | 'dashboard'
  | 'clients'
  | 'approved-expenses'
  | 'expense-report'
  | 'accounts-receivable'
  | 'accounts-payable'
  | 'budgets'
  | 'labor-cost'
  | 'labor-payroll'
  | 'supervisor-hours'
  | 'tm-office';

/**
 * Which onboarding key (SECTION_TOUR_STEPS / INTRO_SECTIONS) each section of
 * THIS panel tours under. Where the admin's copy fits this role word for word
 * (Cobros, Pagar, T&M) it is the same key; where it talks about what only an
 * admin does, the section has its own `-finanzas` key — and those screens
 * also claim it themselves while they are in their finance mode
 * (lib/tourScope), so the right copy wins even through a shared component.
 * Presupuestos claims `budgets-reporte-finanzas` for its report view.
 */
const ONBOARDING_KEY: Partial<Record<FinanceSection, string>> = {
  'dashboard': 'finance-dashboard',
  'clients': 'clients-finanzas',
  'accounts-receivable': 'accounts-receivable',
  'accounts-payable': 'accounts-payable',
  'budgets': 'budgets',
  'labor-cost': 'labor-cost-finanzas',
  'labor-payroll': 'labor-payroll-finanzas',
  'supervisor-hours': 'supervisor-hours-finanzas',
  'tm-office': 'tm-office',
};

const SECTION_META_KEYS: Record<FinanceSection, { titleKey: string; subtitleKey: string }> = {
  'dashboard':            { titleKey: 'finance:section.dashboard.title',            subtitleKey: 'finance:section.dashboard.subtitle'            },
  'clients':              { titleKey: 'finance:section.clients.title',              subtitleKey: 'finance:section.clients.subtitle'              },
  'tm-office':            { titleKey: 'tm:section.office.title',                    subtitleKey: 'tm:section.office.subtitle'                    },
  'accounts-receivable':  { titleKey: 'finance:section.accountsReceivable.title',   subtitleKey: 'finance:section.accountsReceivable.subtitle'   },
  'accounts-payable':     { titleKey: 'finance:section.accountsPayable.title',      subtitleKey: 'finance:section.accountsPayable.subtitle'      },
  'approved-expenses':    { titleKey: 'finance:section.approvedExpenses.title',     subtitleKey: 'finance:section.approvedExpenses.subtitle'     },
  'expense-report':       { titleKey: 'finance:section.expenseReport.title',        subtitleKey: 'finance:section.expenseReport.subtitle'        },
  'budgets':              { titleKey: 'finance:section.budgets.title',              subtitleKey: 'finance:section.budgets.subtitle'              },
  'labor-cost':           { titleKey: 'finance:section.laborCost.title',            subtitleKey: 'finance:section.laborCost.subtitle'            },
  'labor-payroll':        { titleKey: 'finance:section.laborPayroll.title',         subtitleKey: 'finance:section.laborPayroll.subtitle'         },
  'supervisor-hours':     { titleKey: 'finance:section.supervisorHours.title',      subtitleKey: 'finance:section.supervisorHours.subtitle'      },
};

/** The address of each section that has one (routes.tsx), so a reload stays put. */
const SECTION_PATH: Partial<Record<FinanceSection, string>> = {
  'dashboard': '/finance/dashboard',
  'clients': '/finance/clients',
  'accounts-receivable': '/finance/receivables',
  'accounts-payable': '/finance/payables',
  'budgets': '/finance/budgets',
  'approved-expenses': '/finance/expenses',
  'labor-cost': '/finance/labor-cost',
  'labor-payroll': '/finance/payroll',
  'supervisor-hours': '/finance/supervisor-hours',
};

/**
 * Section names other screens still use for what is now another section:
 * Facturas joined Cobros, and the old budget screens joined Presupuestos.
 */
function resolveSection(section: string): FinanceSection | null {
  if (section === 'invoices') return 'accounts-receivable';
  if (section === 'project-financials' || section === 'budget-report' || section === 'projects') return 'budgets';
  return section in SECTION_META_KEYS ? section as FinanceSection : null;
}

function LoadingSkeleton() {
  return <div role="status" className="animate-pulse h-64 bg-[#FAF7F0] border border-[#E7E1D5]" />;
}

// Main component

/**
 * Remounted per route: each finance address is its own entry, so going back
 * and forth in the browser lands on the screen the address names.
 */
export function FinanceDashboard({ initialSection }: { initialSection?: FinanceSection } = {}) {
  return <FinancePanel key={initialSection ?? 'dashboard'} initialSection={initialSection} />;
}

function FinancePanel({ initialSection }: { initialSection?: FinanceSection }) {
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
  const [activeSection, setActiveSection] = useState<FinanceSection>(initialSection ?? 'dashboard');

  const handleLogout   = () => { document.cookie = 'ofjr_session=; Path=/; Max-Age=0'; navigate('/'); AuthService.logout(); };
  const handleNavigate = (section: string) => {
    const resolved = resolveSection(section);
    if (!resolved) return;
    // A screen that asks for Facturas means "issue a document".
    if (section === 'invoices') setSectionIntent('accounts-receivable', { openIssue: true });
    const path = SECTION_PATH[resolved];
    if (!path) { setActiveSection(resolved); return; }
    // The route remounts the panel on its section; the same address does not
    // remount, so the section is also set here.
    if (resolved === (initialSection ?? 'dashboard')) setActiveSection(resolved);
    navigate(path);
  };

  const navItems: AppShellNavItem[] = useMemo(() => [
    { key: 'dashboard',            label: t('finance:nav.dashboard'),            icon: LayoutDashboard },
    { key: 'clients',              label: t('finance:nav.clients'),              icon: UserRound,       group: 'accounting' },
    { key: 'accounts-receivable',  label: t('finance:nav.accountsReceivable'),   icon: ArrowDownToLine, group: 'accounting' },
    { key: 'accounts-payable',     label: t('finance:nav.accountsPayable'),      icon: ArrowUpFromLine, group: 'accounting' },
    { key: 'tm-office',            label: t('tm:nav.office'),                     icon: FileSignature,   group: 'accounting' },
    { key: 'approved-expenses',    label: t('finance:nav.approvedExpenses'),     icon: CheckCircle,     group: 'expenses'   },
    { key: 'expense-report',       label: t('finance:nav.expenseReport'),        icon: FileBarChart,    group: 'expenses'   },
    { key: 'budgets',              label: t('finance:nav.budgets'),              icon: Wallet,          group: 'budgets'    },
    { key: 'labor-cost',           label: t('finance:nav.laborCost'),            icon: HardHat,         group: 'labor'      },
    { key: 'labor-payroll',        label: t('finance:nav.laborPayroll'),         icon: Banknote,        group: 'labor'      },
    { key: 'supervisor-hours',     label: t('finance:nav.supervisorHours'),      icon: Clock,           group: 'labor'      },
  ], [t]);

  const navGroups = useMemo(() => [
    { key: 'accounting', label: t('finance:group.accounting') },
    { key: 'expenses',   label: t('finance:group.expenses')   },
    { key: 'budgets',    label: t('finance:group.budgets')     },
    { key: 'labor',      label: t('finance:group.labor')       },
  ], [t]);

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
              type="button"
              onClick={() => setIntroReplay(n => n + 1)}
              title={t('admin:tour.helpButton')}
              aria-label={t('admin:tour.helpButton')}
              className={cn('w-9 h-9 flex items-center justify-center text-[#8A8175] hover:text-[#C2410C] hover:bg-[#F3EEE4] transition-colors', FOCUS_RING)}
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          ) : null
        }
      >
        {onboardingKey && (
          <SectionTour section={onboardingKey} username={username} replayNonce={introReplay} sectionLabel={t(metaKeys.titleKey)} />
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
            <AccountsPayable onNavigate={handleNavigate} />
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
            <LaborCostScreen mode="finance" onNavigate={handleNavigate} />
          </Suspense>
        )}
        {activeSection === 'labor-payroll' && (
          <Suspense fallback={<LoadingSkeleton />}>
            <LaborPayrollScreen mode="finance" onNavigate={handleNavigate} />
          </Suspense>
        )}
        {activeSection === 'supervisor-hours' && (
          <Suspense fallback={<LoadingSkeleton />}>
            <ApprovalsInbox mode="finance" />
          </Suspense>
        )}
      </AppShell>
      <Toaster position="top-right" richColors />
    </>
  );
}
