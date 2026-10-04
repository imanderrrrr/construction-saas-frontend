import { useState, useEffect, lazy, Suspense, Component, type ComponentType, type ReactNode } from 'react';
import { useMarkDashboardReady } from '../lib/dashboardReady';
import { useLocation, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { AuthService } from '../services/auth';

import { Building2, LayoutDashboard, Users, FolderOpen, Shield, Clock, CalendarClock, ClipboardList, Receipt, FileBarChart, Wallet, Wrench, Banknote, HardHat, ArrowDownToLine, ArrowUpFromLine, UserRound, Briefcase, CreditCard, FileSignature, HelpCircle, PenLine, PlugZap, FileText } from 'lucide-react';
import { OnboardingTour } from '../components/onboarding/OnboardingTour';
import { SectionTour } from '../components/onboarding/SectionTour';
import { BillingSection } from '../components/BillingSection';

import { DashboardContent } from '../components/DashboardContent';
import { UsersRoster } from '../components/users/UsersRoster';
import { ProjectManagement } from '../components/ProjectManagement';
import { AuditLog } from '../components/AuditLog';
import { ApprovalsInbox } from '../components/approvals/ApprovalsInbox';
import { ClientsSection } from '../components/clients/ClientsSection';
import { Toaster } from '../components/ui/sonner';
import { AppShell } from '../components/AppShell';
import { useSectionNavigation } from '../workspace/WorkspaceState';
import { WORKSPACE_PATHS } from '../workspace/paths';
import { clearSectionIntent, peekSectionIntent, setSectionIntent } from '../lib/sectionIntent';
import { parseQuickBooksOutcome, type QuickBooksOutcome } from '../services/quickbooks';

// Error boundary for lazy-loaded sections — prevents white screen on chunk load failure
class SectionErrorBoundary extends Component<
  { children: ReactNode; resetKey: string },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; resetKey: string }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidUpdate(prevProps: { children: ReactNode; resetKey: string }) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center">
            <span className="text-xl">⚠️</span>
          </div>
          <p className="text-sm font-semibold text-[#0A0A0A]">Failed to load section</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="text-xs font-medium text-[#F97316] hover:text-[#C2410C] underline transition-colors"
          >
            Retry section
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const CHUNK_ERROR_RE = /(ChunkLoadError|Failed to fetch dynamically imported module|Importing a module script failed|ERR_CACHE_READ_FAILURE)/i;

async function withChunkRetry<T>(importer: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await importer();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const shouldRetry = CHUNK_ERROR_RE.test(message);
      if (!shouldRetry || i === attempts - 1) break;
      await new Promise(resolve => setTimeout(resolve, 250 * (i + 1)));
    }
  }
  throw lastError;
}

function lazyWithRetry<T extends { default: ComponentType<any> }>(importer: () => Promise<T>) {
  return lazy(() => withChunkRetry(importer));
}

// Tiempo y material. Both halves live on this dashboard because ADMIN is on
// both role gates: the field surface (capture + collect the signature on site)
// and the office one (convert a signed ticket into a change order).
const AdminTmField = lazyWithRetry(() =>
  import('../components/tm/TmFieldSection').then(m => ({ default: m.TmFieldSection }))
);
const AdminTmOffice = lazyWithRetry(() =>
  import('../components/tm/TmOfficeSection').then(m => ({ default: m.TmOfficeSection }))
);

// Lazy-loaded phase-2 sections
const TasksSection = lazyWithRetry(() =>
  import('../components/tasks/TasksSection').then(m => ({ default: m.TasksSection }))
);
const HoursReport = lazyWithRetry(() =>
  import('../components/labor/HoursReportScreen').then(m => ({ default: m.HoursReportScreen }))
);

// Lazy-loaded phase-3 sections
const ExpensesSection = lazyWithRetry(() =>
  import('../components/expenses/ExpensesSection').then(m => ({ default: m.ExpensesSection }))
);
const ExpenseReportSection = lazyWithRetry(() =>
  import('../components/expense-report/ExpenseReportSection').then(m => ({ default: m.ExpenseReportSection }))
);

// Lazy-loaded phase-4 sections
// Presupuestos: one screen with two views (Obras | Reporte). The report is no
// longer a section of its own — see components/budgets/BudgetsSection.
const BudgetsSection = lazyWithRetry(() =>
  import('../components/budgets/BudgetsSection').then(m => ({ default: m.BudgetsSection }))
);

// Lazy-loaded phase-5 sections
const ToolsSection = lazyWithRetry(() =>
  import('../components/tools/ToolsSection').then(m => ({ default: m.ToolsSection }))
);
const ToolReportSection = lazyWithRetry(() =>
  import('../components/toolreport/ToolReportSection').then(m => ({ default: m.ToolReportSection }))
);

// Lazy-loaded labor cost sections
const LaborCostReport = lazyWithRetry(() =>
  import('../components/labor/LaborCostScreen').then(m => ({ default: m.LaborCostScreen }))
);
const LaborPayrollReport = lazyWithRetry(() =>
  import('../components/labor/LaborPayrollScreen').then(m => ({ default: m.LaborPayrollScreen }))
);

// Lazy-loaded accounting sections
const AccountsReceivable = lazyWithRetry(() =>
  import('../components/AccountsReceivable').then(m => ({ default: m.AccountsReceivable }))
);
const AccountsPayable = lazyWithRetry(() =>
  import('../components/AccountsPayable').then(m => ({ default: m.AccountsPayable }))
);

// Lazy-loaded office expenses section
const OfficeExpensesSection = lazyWithRetry(() =>
  import('../components/office-expenses/OfficeExpensesSection').then(m => ({ default: m.OfficeExpensesSection }))
);

// Lazy-loaded subcontractor management section
const SubcontractorsSection = lazyWithRetry(() =>
  import('../components/subcontractors/SubcontractorsSection').then(m => ({ default: m.SubcontractorsSection }))
);

// Lazy-loaded invoice template (issuer branding) settings
const InvoiceBrandingSettings = lazyWithRetry(() =>
  import('../components/InvoiceBrandingSettings').then(m => ({ default: m.InvoiceBrandingSettings }))
);

const InvoiceManager = lazyWithRetry(() =>
  import('../components/InvoiceManager').then(m => ({ default: m.InvoiceManager }))
);

// Lazy-loaded QuickBooks Online connection (the tenant's own company)
const QuickBooksSection = lazyWithRetry(() =>
  import('../components/quickbooks/QuickBooksSection').then(m => ({ default: m.QuickBooksSection }))
);

type ActiveSection =
  | 'dashboard' | 'users' | 'schedules' | 'hours' | 'projects' | 'audit'
  | 'clients'
  | 'time-approvals'
  | 'expenses' | 'expense-report'
  | 'budgets'
  | 'tool-inventory' | 'tool-report'
  | 'labor-cost' | 'labor-payroll'
  | 'invoices' | 'invoice-branding'
  | 'accounts-receivable' | 'accounts-payable'
  | 'office-expenses'
  | 'tm-field' | 'tm-office'
  | 'subcontractors'
  | 'quickbooks'
  | 'billing';

// Nav items are either internal sections (clicking sets `activeSection`) or
// route links (clicking calls `navigate(to)`). Route-link items use a string
// key that may sit outside the ActiveSection union — the billing entry is one,
// since /admin/billing is a separate route, not a section of this dashboard.
type NavItem = {
  key: ActiveSection | string;
  labelKey: string;
  icon: React.ElementType;
  badgeKey?: string;
  to?: string;
};

/**
 * Pins survive the sections they were pinned to.
 *
 * `budget-report` is now the second view of `budgets`, so a pin on it becomes
 * a pin on `budgets` — and it has to DEDUPLICATE: an orphan key would simply
 * vanish (favourites are matched against NAV_ITEMS), but somebody who already
 * had `budgets` pinned would otherwise end up with the key twice and two
 * identical entries in the FAVORITES group.
 */
export function migrateFavorites(keys: string[]): string[] {
  const out: string[] = [];
  for (const key of keys) {
    const migrated = key === 'budget-report' ? 'budgets' : key === 'invoices' ? 'accounts-receivable' : key;
    if (!out.includes(migrated)) out.push(migrated);
  }
  return out;
}

const NAV_GENERAL: NavItem[] = [
  { key: 'dashboard', labelKey: 'admin:nav.dashboard', icon: LayoutDashboard },
  { key: 'audit',     labelKey: 'admin:nav.auditLogs', icon: Shield          },
  { key: 'billing',   labelKey: 'admin:nav.billing',   icon: CreditCard },
];

const NAV_PERSONNEL: NavItem[] = [
  { key: 'users',           labelKey: 'admin:nav.users',           icon: Users         },
  { key: 'time-approvals',  labelKey: 'admin:nav.timeApprovals',   icon: Clock,          badgeKey: 'admin:badge.time' },
  { key: 'hours',           labelKey: 'admin:nav.hoursReport',     icon: ClipboardList },
  { key: 'labor-cost',      labelKey: 'admin:nav.laborCost',       icon: HardHat       },
  { key: 'labor-payroll',   labelKey: 'admin:nav.laborPayroll',    icon: Banknote      },
];

const NAV_PROJECTS: NavItem[] = [
  { key: 'projects',        labelKey: 'admin:nav.projects',        icon: FolderOpen    },
  { key: 'clients',         labelKey: 'admin:nav.clients',         icon: UserRound     },
  { key: 'subcontractors',  labelKey: 'admin:nav.subcontractors',  icon: Briefcase     },
  { key: 'schedules',       labelKey: 'admin:nav.schedules',       icon: CalendarClock },
  { key: 'tool-inventory',  labelKey: 'admin:nav.allTools',        icon: Wrench        },
  { key: 'tool-report',     labelKey: 'admin:nav.toolReport',      icon: ClipboardList },
  { key: 'tm-field',        labelKey: 'tm:nav.field',              icon: PenLine       },
];

const NAV_FINANCE: NavItem[] = [
  { key: 'invoice-branding',     labelKey: 'admin:nav.invoiceBranding',     icon: FileSignature   },
  { key: 'budgets',              labelKey: 'admin:nav.budgets',             icon: Wallet          },
  { key: 'expenses',             labelKey: 'admin:nav.allExpenses',         icon: Receipt         },
  { key: 'expense-report',       labelKey: 'admin:nav.expenseReport',       icon: FileBarChart    },
  { key: 'office-expenses',      labelKey: 'admin:nav.officeExpenses',      icon: Building2       },
  { key: 'accounts-receivable',  labelKey: 'admin:nav.accountsReceivable',  icon: ArrowDownToLine },
  { key: 'invoices',             labelKey: 'admin:nav.invoices',            icon: FileText },
  { key: 'accounts-payable',     labelKey: 'admin:nav.accountsPayable',     icon: ArrowUpFromLine },
  { key: 'tm-office',            labelKey: 'tm:nav.office',                icon: FileSignature   },
  { key: 'quickbooks',           labelKey: 'admin:nav.quickbooks',          icon: PlugZap         },
];

/** Flat list used for lookups (section meta, rendering content, etc.) */
const NAV_ITEMS: NavItem[] = [...NAV_GENERAL, ...NAV_PERSONNEL, ...NAV_PROJECTS, ...NAV_FINANCE];

const SECTION_META: Record<ActiveSection, { titleKey: string; subtitleKey: string }> = {
  'dashboard':       { titleKey: 'admin:section.dashboard.title',       subtitleKey: 'admin:section.dashboard.subtitle'       },
  'users':           { titleKey: 'admin:section.users.title',           subtitleKey: 'admin:section.users.subtitle'           },
  'schedules':       { titleKey: 'admin:section.schedules.title',       subtitleKey: 'admin:section.schedules.subtitle'       },
  'hours':           { titleKey: 'admin:section.hours.title',           subtitleKey: 'admin:section.hours.subtitle'           },
  'projects':        { titleKey: 'admin:section.projects.title',        subtitleKey: 'admin:section.projects.subtitle'        },
  'audit':           { titleKey: 'admin:section.audit.title',           subtitleKey: 'admin:section.audit.subtitle'           },
  'expenses':        { titleKey: 'admin:section.expenses.title',        subtitleKey: 'admin:section.expenses.subtitle'        },
  'expense-report':  { titleKey: 'admin:section.expenseReport.title',   subtitleKey: 'admin:section.expenseReport.subtitle'   },
  'budgets':         { titleKey: 'admin:section.budgets.title',         subtitleKey: 'admin:section.budgets.subtitle'         },
  'tool-inventory':  { titleKey: 'admin:section.toolInventory.title',   subtitleKey: 'admin:section.toolInventory.subtitle'   },
  'tool-report':     { titleKey: 'admin:section.toolReport.title',      subtitleKey: 'admin:section.toolReport.subtitle'      },
  'labor-cost':           { titleKey: 'admin:section.laborCost.title',           subtitleKey: 'admin:section.laborCost.subtitle'           },
  'labor-payroll':        { titleKey: 'admin:section.laborPayroll.title',        subtitleKey: 'admin:section.laborPayroll.subtitle'        },
  'invoices':             { titleKey: 'admin:section.invoices.title',             subtitleKey: 'admin:section.invoices.subtitle'             },
  'invoice-branding':     { titleKey: 'admin:section.invoiceBranding.title',      subtitleKey: 'admin:section.invoiceBranding.subtitle'      },
  'accounts-receivable':  { titleKey: 'admin:section.accountsReceivable.title',  subtitleKey: 'admin:section.accountsReceivable.subtitle'  },
  'accounts-payable':     { titleKey: 'admin:section.accountsPayable.title',     subtitleKey: 'admin:section.accountsPayable.subtitle'     },
  'office-expenses':      { titleKey: 'admin:section.officeExpenses.title',      subtitleKey: 'admin:section.officeExpenses.subtitle'      },
  'time-approvals':       { titleKey: 'admin:section.timeApprovals.title',       subtitleKey: 'admin:section.timeApprovals.subtitle'       },
  'clients':              { titleKey: 'admin:section.clients.title',              subtitleKey: 'admin:section.clients.subtitle'              },
  'subcontractors':       { titleKey: 'admin:section.subcontractors.title',       subtitleKey: 'admin:section.subcontractors.subtitle'       },
  'billing':              { titleKey: 'admin:section.billing.title',              subtitleKey: 'admin:section.billing.subtitle'              },
  'tm-field':             { titleKey: 'tm:section.field.title',                    subtitleKey: 'tm:section.field.subtitle'                   },
  'tm-office':            { titleKey: 'tm:section.office.title',                   subtitleKey: 'tm:section.office.subtitle'                  },
  'quickbooks':           { titleKey: 'admin:section.quickbooks.title',           subtitleKey: 'admin:section.quickbooks.subtitle'           },
};

export function AdminDashboard({ initialSection = 'dashboard' }: { initialSection?: ActiveSection } = {}) {
  useMarkDashboardReady();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation(['admin', 'common', 'tm']);
  const username = AuthService.getUsername() ?? 'admin';
  const returnedOutcome = parseQuickBooksOutcome(location.search);
  const [activeSection, navigateSection] = useSectionNavigation('ADMIN', returnedOutcome ? 'quickbooks' : initialSection);
  const [qbOutcome, setQbOutcome] = useState<QuickBooksOutcome | null>(() => returnedOutcome
    ?? (new URLSearchParams(location.search).has('quickbooks') ? null : peekSectionIntent('quickbooks')?.outcome ?? null));
  const handleNavigate = (section: string) => { clearSectionIntent('quickbooks'); setQbOutcome(null); navigateSection(section); };
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.has('quickbooks')) {
      const outcome = parseQuickBooksOutcome(location.search);
      if (outcome) setSectionIntent('quickbooks', { outcome });
      params.delete('quickbooks');
      navigate({ pathname: outcome ? WORKSPACE_PATHS.ADMIN.quickbooks : location.pathname, search: params.size ? `?${params}` : '' },
        { replace: true });
    }
  }, [location.pathname, location.search, navigate]);
  const [tourReplay, setTourReplay] = useState(0);
  const [introReplay, setIntroReplay] = useState(0);
  const handleLogout = () => { document.cookie = 'ofjr_session=; Path=/; Max-Age=0'; navigate('/'); void AuthService.logout(); };
  const areaFor: Record<string, string> = {
    projects: 'works', clients: 'works', subcontractors: 'works', schedules: 'works', 'tm-field': 'works',
    users: 'team', 'time-approvals': 'team',
    'accounts-receivable': 'finance', 'accounts-payable': 'finance', expenses: 'finance', 'office-expenses': 'finance', budgets: 'finance', 'labor-payroll': 'finance', 'tm-office': 'finance',
    'tool-inventory': 'inventory', hours: 'reports', 'labor-cost': 'reports', 'expense-report': 'reports', 'tool-report': 'reports',
    invoices: 'finance', 'invoice-branding': 'settings', billing: 'settings', audit: 'settings', quickbooks: 'settings',
  };
  const order = ['dashboard', 'projects', 'clients', 'subcontractors', 'schedules', 'tm-field', 'users', 'time-approvals',
    'accounts-receivable', 'invoices', 'accounts-payable', 'expenses', 'office-expenses', 'budgets', 'labor-payroll', 'tm-office',
    'tool-inventory', 'hours', 'labor-cost', 'expense-report', 'tool-report', 'invoice-branding', 'billing', 'audit', 'quickbooks'];
  const navItems = order.flatMap(key => {
    const item = NAV_ITEMS.find(i => i.key === key);
    return item ? [{ key, label: key === 'dashboard' ? t('common:workspace.home') : t(item.labelKey), icon: item.icon, group: areaFor[key],
      parent: key === 'office-expenses' ? 'expenses' : ['tm-office', 'invoices'].includes(key) ? 'accounts-receivable' : undefined }] : [];
  });
  const navGroups = [
    { key: 'works', label: t('common:workspace.works'), icon: FolderOpen },
    { key: 'team', label: t('common:workspace.team'), icon: Users },
    { key: 'finance', label: t('common:workspace.finance'), icon: Wallet },
    { key: 'inventory', label: t('common:workspace.inventory'), icon: Wrench },
    { key: 'reports', label: t('common:workspace.reports'), icon: FileBarChart },
    { key: 'settings', label: t('common:workspace.settings'), icon: Shield, footer: true },
  ];
  const meta = SECTION_META[activeSection];
  return <>
    <AppShell role="ADMIN" username={username} panelLabel={t('admin:panelLabel')} navItems={navItems} navGroups={navGroups}
      activeSection={activeSection} onNavigate={handleNavigate} onLogout={handleLogout} pageTitle={t(meta.titleKey)}
      topbarExtra={<button data-tour="help" type="button" onClick={() => activeSection === 'dashboard' ? setTourReplay(n => n + 1) : setIntroReplay(n => n + 1)} title={t('admin:tour.helpButton')} className="p-2 text-[#5A5346] focus-visible:outline-2 focus-visible:outline-[#F97316]"><HelpCircle className="size-4" /></button>}>
      <SectionTour autoStart={false} section={activeSection} username={username} replayNonce={introReplay} sectionLabel={t(meta.titleKey)} />
          {activeSection === 'dashboard'    && <DashboardContent onNavigate={handleNavigate} />}
          {activeSection === 'invoices' && <SectionErrorBoundary resetKey={activeSection}><Suspense fallback={<div role="status" className="animate-pulse h-64" />}><InvoiceManager onNavigate={handleNavigate} /></Suspense></SectionErrorBoundary>}
          {activeSection === 'billing'      && <BillingSection />}
          {activeSection === 'tm-field'     && (
            <SectionErrorBoundary resetKey={activeSection}><Suspense fallback={<div className="animate-pulse h-64 bg-white rounded-xl border border-[#D4D4D8]" />}>
              <AdminTmField />
            </Suspense></SectionErrorBoundary>
          )}
          {activeSection === 'tm-office'    && (
            <SectionErrorBoundary resetKey={activeSection}><Suspense fallback={<div className="animate-pulse h-64 bg-white rounded-xl border border-[#D4D4D8]" />}>
              <AdminTmOffice />
            </Suspense></SectionErrorBoundary>
          )}
          {activeSection === 'users'        && <UsersRoster />}
          {activeSection === 'schedules'    && (
            <SectionErrorBoundary resetKey={activeSection}><Suspense fallback={<div className="animate-pulse h-64 bg-white rounded-xl border border-[#D4D4D8]" />}>
              <TasksSection />
            </Suspense></SectionErrorBoundary>
          )}
          {activeSection === 'hours'        && (
            <SectionErrorBoundary resetKey={activeSection}><Suspense fallback={<div className="animate-pulse h-64 bg-white rounded-xl border border-[#D4D4D8]" />}>
              <HoursReport onNavigate={handleNavigate} />
            </Suspense></SectionErrorBoundary>
          )}
          {activeSection === 'expenses'     && (
            <SectionErrorBoundary resetKey={activeSection}><Suspense fallback={<div className="animate-pulse h-64 bg-white rounded-xl border border-[#D4D4D8]" />}>
              <ExpensesSection />
            </Suspense></SectionErrorBoundary>
          )}
          {activeSection === 'expense-report' && (
            <SectionErrorBoundary resetKey={activeSection}><Suspense fallback={<div className="animate-pulse h-64 bg-white rounded-xl border border-[#D4D4D8]" />}>
              <ExpenseReportSection onNavigate={handleNavigate} />
            </Suspense></SectionErrorBoundary>
          )}
          {activeSection === 'budgets'     && (
            <SectionErrorBoundary resetKey={activeSection}><Suspense fallback={<div className="animate-pulse h-64 bg-white rounded-xl border border-[#D4D4D8]" />}>
              <BudgetsSection onNavigate={handleNavigate} />
            </Suspense></SectionErrorBoundary>
          )}
          {activeSection === 'tool-inventory' && (
            <SectionErrorBoundary resetKey={activeSection}><Suspense fallback={<div className="animate-pulse h-64 bg-white rounded-xl border border-[#D4D4D8]" />}>
              <ToolsSection onNavigate={handleNavigate} />
            </Suspense></SectionErrorBoundary>
          )}
          {activeSection === 'tool-report' && (
            <SectionErrorBoundary resetKey={activeSection}><Suspense fallback={<div className="animate-pulse h-64 bg-white rounded-xl border border-[#D4D4D8]" />}>
              <ToolReportSection onNavigate={handleNavigate} />
            </Suspense></SectionErrorBoundary>
          )}
          {activeSection === 'labor-cost' && (
            <SectionErrorBoundary resetKey={activeSection}><Suspense fallback={<div className="animate-pulse h-64 bg-white rounded-xl border border-[#D4D4D8]" />}>
              <LaborCostReport onNavigate={handleNavigate} />
            </Suspense></SectionErrorBoundary>
          )}
          {activeSection === 'labor-payroll' && (
            <SectionErrorBoundary resetKey={activeSection}><Suspense fallback={<div className="animate-pulse h-64 bg-white rounded-xl border border-[#D4D4D8]" />}>
              <LaborPayrollReport onNavigate={handleNavigate} />
            </Suspense></SectionErrorBoundary>
          )}
          {activeSection === 'invoice-branding' && (
            <SectionErrorBoundary resetKey={activeSection}><Suspense fallback={<div className="animate-pulse h-64 bg-white rounded-xl border border-[#D4D4D8]" />}>
              <InvoiceBrandingSettings />
            </Suspense></SectionErrorBoundary>
          )}
          {activeSection === 'accounts-receivable' && (
            <SectionErrorBoundary resetKey={activeSection}><Suspense fallback={<div className="animate-pulse h-64 bg-white rounded-xl border border-[#D4D4D8]" />}>
              <AccountsReceivable onNavigate={handleNavigate} />
            </Suspense></SectionErrorBoundary>
          )}
          {activeSection === 'accounts-payable' && (
            <SectionErrorBoundary resetKey={activeSection}><Suspense fallback={<div className="animate-pulse h-64 bg-white rounded-xl border border-[#D4D4D8]" />}>
              <AccountsPayable onNavigate={handleNavigate} />
            </Suspense></SectionErrorBoundary>
          )}
          {activeSection === 'office-expenses' && (
            <SectionErrorBoundary resetKey={activeSection}><Suspense fallback={<div className="animate-pulse h-64 bg-white rounded-xl border border-[#D4D4D8]" />}>
              <OfficeExpensesSection />
            </Suspense></SectionErrorBoundary>
          )}
          {activeSection === 'subcontractors' && (
            // The section is the only one of the Proyectos block that is code-split.
            // Its placeholder is the redesign's own skeleton — square, sand, no
            // rounded white card left over from the old look.
            <SectionErrorBoundary resetKey={activeSection}><Suspense fallback={<div className="bt-skeleton h-64 border border-[#E7E1D5]" />}>
              <SubcontractorsSection onNavigate={handleNavigate} />
            </Suspense></SectionErrorBoundary>
          )}
          {activeSection === 'quickbooks' && (
            <SectionErrorBoundary resetKey={activeSection}><Suspense fallback={<div className="bt-skeleton h-64 border border-[#E7E1D5]" />}>
              <QuickBooksSection outcome={qbOutcome} />
            </Suspense></SectionErrorBoundary>
          )}
          {activeSection === 'projects'     && <ProjectManagement onNavigate={handleNavigate} />}
          {activeSection === 'clients'      && <ClientsSection onNavigate={handleNavigate} />}
          {activeSection === 'audit'        && <AuditLog />}
          {activeSection === 'time-approvals'&& <ApprovalsInbox />}
    </AppShell>
    <Toaster position="top-right" richColors />
    <OnboardingTour username={username} replayNonce={tourReplay} onNavigate={handleNavigate} />
  </>;
}
