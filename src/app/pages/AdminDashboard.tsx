import { useState, useEffect, useRef, lazy, Suspense, Component, type ComponentType, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { AuthService } from '../services/auth';
import { Button } from '../components/ui/button';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import {
  Building2, LayoutDashboard, Users, FolderOpen,
  Shield, LogOut, User, Menu, X,
  Clock, CalendarClock, ClipboardList, Receipt, FileBarChart,
  Wallet, PieChart, Wrench, Banknote, HardHat,
  ArrowDownToLine, ArrowUpFromLine, UserRound, FileText, Briefcase,
  CreditCard, FileSignature, HelpCircle,
} from 'lucide-react';
import { OnboardingTour } from '../components/onboarding/OnboardingTour';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { DashboardContent } from '../components/DashboardContent';
import { UserManagement } from '../components/UserManagement';
import { ProjectManagement } from '../components/ProjectManagement';
import { AuditLog } from '../components/AuditLog';
import { SupervisorApprovals } from '../components/SupervisorApprovals';
import { ClientManagement } from '../components/ClientManagement';
import { Toaster } from '../components/ui/sonner';
import { TimezoneSwitcher } from '../components/TimezoneSwitcher';

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

// Lazy-loaded phase-2 sections
const KanbanBoard = lazyWithRetry(() =>
  import('../components/KanbanBoard').then(m => ({ default: m.KanbanBoard }))
);
const HoursReport = lazyWithRetry(() =>
  import('../components/HoursReport').then(m => ({ default: m.HoursReport }))
);

// Lazy-loaded phase-3 sections
const ExpenseManagement = lazyWithRetry(() =>
  import('../components/ExpenseManagement').then(m => ({ default: m.ExpenseManagement }))
);
const ExpenseReport = lazyWithRetry(() =>
  import('../components/ExpenseReport').then(m => ({ default: m.ExpenseReport }))
);

// Lazy-loaded phase-4 sections
const BudgetManagement = lazyWithRetry(() =>
  import('../components/BudgetManagement').then(m => ({ default: m.BudgetManagement }))
);
const BudgetReport = lazyWithRetry(() =>
  import('../components/BudgetReport').then(m => ({ default: m.BudgetReport }))
);

// Lazy-loaded phase-5 sections
const AdminToolView = lazyWithRetry(() =>
  import('../components/AdminToolView').then(m => ({ default: m.AdminToolView }))
);
const ToolReport = lazyWithRetry(() =>
  import('../components/ToolReport').then(m => ({ default: m.ToolReport }))
);

// Lazy-loaded labor cost sections
const LaborCostReport = lazyWithRetry(() =>
  import('../components/LaborCostReport').then(m => ({ default: m.LaborCostReport }))
);
const LaborPayrollReport = lazyWithRetry(() =>
  import('../components/LaborPayrollReport').then(m => ({ default: m.LaborPayrollReport }))
);

// Lazy-loaded accounting sections
const AccountsReceivable = lazyWithRetry(() =>
  import('../components/AccountsReceivable').then(m => ({ default: m.AccountsReceivable }))
);
const AccountsPayable = lazyWithRetry(() =>
  import('../components/AccountsPayable').then(m => ({ default: m.AccountsPayable }))
);

// Lazy-loaded invoice manager
const InvoiceManager = lazyWithRetry(() =>
  import('../components/InvoiceManager').then(m => ({ default: m.InvoiceManager }))
);

// Lazy-loaded office expenses section
const OfficeExpenses = lazyWithRetry(() =>
  import('../components/OfficeExpenses').then(m => ({ default: m.OfficeExpenses }))
);

// Lazy-loaded subcontractor management section
const SubcontractorManagement = lazyWithRetry(() =>
  import('../components/SubcontractorManagement').then(m => ({ default: m.SubcontractorManagement }))
);

// Lazy-loaded invoice template (issuer branding) settings
const InvoiceBrandingSettings = lazyWithRetry(() =>
  import('../components/InvoiceBrandingSettings').then(m => ({ default: m.InvoiceBrandingSettings }))
);

type ActiveSection =
  | 'dashboard' | 'users' | 'schedules' | 'hours' | 'projects' | 'audit'
  | 'clients'
  | 'time-approvals'
  | 'expenses' | 'expense-report'
  | 'budgets'  | 'budget-report'
  | 'tool-inventory' | 'tool-report'
  | 'labor-cost' | 'labor-payroll'
  | 'invoices' | 'invoice-branding'
  | 'accounts-receivable' | 'accounts-payable'
  | 'office-expenses'
  | 'subcontractors';

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

const NAV_GENERAL: NavItem[] = [
  { key: 'dashboard', labelKey: 'admin:nav.dashboard', icon: LayoutDashboard },
  { key: 'audit',     labelKey: 'admin:nav.auditLogs', icon: Shield          },
  { key: 'billing',   labelKey: 'admin:nav.billing',   icon: CreditCard, to: '/admin/billing' },
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
];

const NAV_FINANCE: NavItem[] = [
  { key: 'invoices',             labelKey: 'admin:nav.invoices',            icon: FileText        },
  { key: 'invoice-branding',     labelKey: 'admin:nav.invoiceBranding',     icon: FileSignature   },
  { key: 'budgets',              labelKey: 'admin:nav.budgets',             icon: Wallet          },
  { key: 'budget-report',        labelKey: 'admin:nav.budgetReport',        icon: PieChart        },
  { key: 'expenses',             labelKey: 'admin:nav.allExpenses',         icon: Receipt         },
  { key: 'expense-report',       labelKey: 'admin:nav.expenseReport',       icon: FileBarChart    },
  { key: 'office-expenses',      labelKey: 'admin:nav.officeExpenses',      icon: Building2       },
  { key: 'accounts-receivable',  labelKey: 'admin:nav.accountsReceivable',  icon: ArrowDownToLine },
  { key: 'accounts-payable',     labelKey: 'admin:nav.accountsPayable',     icon: ArrowUpFromLine },
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
  'budget-report':   { titleKey: 'admin:section.budgetReport.title',    subtitleKey: 'admin:section.budgetReport.subtitle'    },
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
};

export function AdminDashboard() {
  const navigate = useNavigate();
  const { t } = useTranslation(['admin', 'common']);
  const username = AuthService.getUsername();
  const [activeSection, setActiveSection] = useState<ActiveSection>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tourReplay, setTourReplay] = useState(0);
  const navScrollPos = useRef(0);

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  const handleLogout = () => {
    document.cookie = 'ofjr_session=; Path=/; Max-Age=0';
    navigate('/');
    AuthService.logout(); // fire-and-forget server revocation
  };

  const handleNavigate = (section: string) => {
    setActiveSection(section as ActiveSection);
    setSidebarOpen(false);
  };

  const meta = SECTION_META[activeSection];

  // Sidebar nav item
  function NavItem({ item }: { item: typeof NAV_ITEMS[number] }) {
    // Route-link items (item.to set) are never "active" within the dashboard —
    // clicking them leaves AdminDashboard for a different route.
    const isActive = !item.to && activeSection === item.key;
    const handleClick = () => {
      if (item.to) {
        setSidebarOpen(false);
        navigate(item.to);
      } else {
        handleNavigate(item.key);
      }
    };
    return (
      <button
        onClick={handleClick}
        data-tour={item.key}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left group ${
          isActive
            ? 'bg-[#F97316]/10 text-[#F97316]'
            : 'text-[#0A0A0A] hover:bg-[#FAFAFA] hover:text-[#F97316]'
        }`}
      >
        <item.icon className="w-4.5 h-4.5 flex-shrink-0" style={{ width: 18, height: 18 }} />
        <span className={`text-sm flex-1 ${isActive ? 'font-semibold' : 'font-medium'}`}>
          {t(item.labelKey)}
        </span>
        {item.badgeKey && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 bg-[#F97316]/10 text-[#F97316] rounded-md">
            {t(item.badgeKey)}
          </span>
        )}
        {isActive && (
          <span className="w-1.5 h-1.5 rounded-full bg-[#F97316] flex-shrink-0" />
        )}
      </button>
    );
  }

  // Sidebar content
  function SidebarContent() {
    return (
      <>
        {/* Brand */}
        <div className="p-5 border-b border-[#D4D4D8] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 bg-[#F97316] rounded-lg flex-shrink-0">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-[#0A0A0A] leading-tight">{t('common:brand')}</h1>
              <p className="text-[11px] text-[#71717A]">{t('admin:panelLabel')}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav
          className="flex-1 p-3 space-y-0.5 overflow-y-auto min-h-0"
          ref={(el) => { if (el) el.scrollTop = navScrollPos.current; }}
          onScroll={(e) => { navScrollPos.current = e.currentTarget.scrollTop; }}
        >
          {/* General */}
          <p className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider px-3 py-2">
            {t('admin:group.general')}
          </p>
          {NAV_GENERAL.map(item => (
            <NavItem key={item.key} item={item} />
          ))}

          {/* Personnel */}
          <div className="my-3 border-t border-[#D4D4D8]" />
          <p className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider px-3 py-2">
            {t('admin:group.personnel')}
          </p>
          {NAV_PERSONNEL.map(item => (
            <NavItem key={item.key} item={item} />
          ))}

          {/* Projects */}
          <div className="my-3 border-t border-[#D4D4D8]" />
          <p className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider px-3 py-2">
            {t('admin:group.projects')}
          </p>
          {NAV_PROJECTS.map(item => (
            <NavItem key={item.key} item={item} />
          ))}

          {/* Finance */}
          <div className="my-3 border-t border-[#D4D4D8]" />
          <p className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider px-3 py-2">
            {t('admin:group.finance')}
          </p>
          {NAV_FINANCE.map(item => (
            <NavItem key={item.key} item={item} />
          ))}
        </nav>

        {/* User footer */}
        <div className="p-3 border-t border-[#D4D4D8] flex-shrink-0">
          <div className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-[#FAFAFA] transition-colors">
            <div className="w-8 h-8 bg-[#F97316] rounded-full flex items-center justify-center text-xs text-white font-bold flex-shrink-0">
              {(username ?? 'A').slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[#0A0A0A] truncate">{username}</p>
              <p className="text-[10px] text-[#71717A]">ADMIN</p>
            </div>
            <button onClick={handleLogout}
              className="text-[#71717A] hover:text-red-600 transition-colors p-1 rounded"
              title={t('common:signOut')}>
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="px-2 mt-2">
            <TimezoneSwitcher />
          </div>
          <p className="text-[10px] text-[#D4D4D8] px-2 mt-1.5">{t('admin:sidebar.version')}</p>
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex">

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 bg-white border-r border-[#D4D4D8] flex-col flex-shrink-0 sticky top-0 h-screen overflow-hidden">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden" style={{ touchAction: 'none', overscrollBehavior: 'contain' }}>
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-[#0A0A0A]/50 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          {/* Drawer */}
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-white flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#D4D4D8]">
              <span className="text-sm font-semibold text-[#0A0A0A]">{t('admin:sidebar.menu')}</span>
              <button onClick={() => setSidebarOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-[#71717A] hover:bg-[#FAFAFA]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 flex flex-col overflow-hidden">
              <SidebarContent />
            </div>
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Topbar */}
        <header className="h-14 bg-white border-b border-[#D4D4D8] flex items-center justify-between px-4 md:px-6 flex-shrink-0 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile hamburger */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg border border-[#D4D4D8] text-[#0A0A0A] hover:bg-[#FAFAFA] flex-shrink-0"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-[#0A0A0A] truncate">{t(meta.titleKey)}</h2>
              <p className="text-[11px] text-[#71717A] truncate hidden sm:block">{t(meta.subtitleKey)}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
          <button
            data-tour="help"
            onClick={() => setTourReplay(n => n + 1)}
            title={t('admin:tour.helpButton')}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-[#71717A] hover:text-[#F97316] hover:bg-[#FAFAFA] transition-colors"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
          <LanguageSwitcher />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 h-9 px-3">
                <div className="w-7 h-7 bg-[#F97316] rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-[10px] font-bold">
                    {(username ?? 'A').slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <div className="text-left hidden sm:block">
                  <div className="text-xs font-semibold text-[#0A0A0A]">{username}</div>
                  <div className="text-[10px] text-[#71717A]">{t('admin:topbar.administrator')}</div>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="text-xs text-[#71717A]">{t('admin:topbar.signedInAs', { username })}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 text-sm cursor-pointer">
                <User className="w-4 h-4" />{t('common:profile')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate('/admin/billing')}
                className="gap-2 text-sm cursor-pointer"
              >
                <CreditCard className="w-4 h-4" />{t('admin:nav.billing')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="gap-2 text-sm text-red-600 focus:text-red-600 cursor-pointer">
                <LogOut className="w-4 h-4" />{t('common:signOut')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </header>

        {/* Content area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          {activeSection === 'dashboard'    && <DashboardContent onNavigate={handleNavigate} />}
          {activeSection === 'users'        && <UserManagement />}
          {activeSection === 'schedules'    && (
            <SectionErrorBoundary resetKey={activeSection}><Suspense fallback={<div className="animate-pulse h-64 bg-white rounded-xl border border-[#D4D4D8]" />}>
              <KanbanBoard />
            </Suspense></SectionErrorBoundary>
          )}
          {activeSection === 'hours'        && (
            <SectionErrorBoundary resetKey={activeSection}><Suspense fallback={<div className="animate-pulse h-64 bg-white rounded-xl border border-[#D4D4D8]" />}>
              <HoursReport />
            </Suspense></SectionErrorBoundary>
          )}
          {activeSection === 'expenses'     && (
            <SectionErrorBoundary resetKey={activeSection}><Suspense fallback={<div className="animate-pulse h-64 bg-white rounded-xl border border-[#D4D4D8]" />}>
              <ExpenseManagement />
            </Suspense></SectionErrorBoundary>
          )}
          {activeSection === 'expense-report' && (
            <SectionErrorBoundary resetKey={activeSection}><Suspense fallback={<div className="animate-pulse h-64 bg-white rounded-xl border border-[#D4D4D8]" />}>
              <ExpenseReport />
            </Suspense></SectionErrorBoundary>
          )}
          {activeSection === 'budgets'     && (
            <SectionErrorBoundary resetKey={activeSection}><Suspense fallback={<div className="animate-pulse h-64 bg-white rounded-xl border border-[#D4D4D8]" />}>
              <BudgetManagement />
            </Suspense></SectionErrorBoundary>
          )}
          {activeSection === 'budget-report' && (
            <SectionErrorBoundary resetKey={activeSection}><Suspense fallback={<div className="animate-pulse h-64 bg-white rounded-xl border border-[#D4D4D8]" />}>
              <BudgetReport />
            </Suspense></SectionErrorBoundary>
          )}
          {activeSection === 'tool-inventory' && (
            <SectionErrorBoundary resetKey={activeSection}><Suspense fallback={<div className="animate-pulse h-64 bg-white rounded-xl border border-[#D4D4D8]" />}>
              <AdminToolView />
            </Suspense></SectionErrorBoundary>
          )}
          {activeSection === 'tool-report' && (
            <SectionErrorBoundary resetKey={activeSection}><Suspense fallback={<div className="animate-pulse h-64 bg-white rounded-xl border border-[#D4D4D8]" />}>
              <ToolReport />
            </Suspense></SectionErrorBoundary>
          )}
          {activeSection === 'labor-cost' && (
            <SectionErrorBoundary resetKey={activeSection}><Suspense fallback={<div className="animate-pulse h-64 bg-white rounded-xl border border-[#D4D4D8]" />}>
              <LaborCostReport />
            </Suspense></SectionErrorBoundary>
          )}
          {activeSection === 'labor-payroll' && (
            <SectionErrorBoundary resetKey={activeSection}><Suspense fallback={<div className="animate-pulse h-64 bg-white rounded-xl border border-[#D4D4D8]" />}>
              <LaborPayrollReport />
            </Suspense></SectionErrorBoundary>
          )}
          {activeSection === 'invoices' && (
            <SectionErrorBoundary resetKey={activeSection}><Suspense fallback={<div className="animate-pulse h-64 bg-white rounded-xl border border-[#D4D4D8]" />}>
              <InvoiceManager />
            </Suspense></SectionErrorBoundary>
          )}
          {activeSection === 'invoice-branding' && (
            <SectionErrorBoundary resetKey={activeSection}><Suspense fallback={<div className="animate-pulse h-64 bg-white rounded-xl border border-[#D4D4D8]" />}>
              <InvoiceBrandingSettings />
            </Suspense></SectionErrorBoundary>
          )}
          {activeSection === 'accounts-receivable' && (
            <SectionErrorBoundary resetKey={activeSection}><Suspense fallback={<div className="animate-pulse h-64 bg-white rounded-xl border border-[#D4D4D8]" />}>
              <AccountsReceivable />
            </Suspense></SectionErrorBoundary>
          )}
          {activeSection === 'accounts-payable' && (
            <SectionErrorBoundary resetKey={activeSection}><Suspense fallback={<div className="animate-pulse h-64 bg-white rounded-xl border border-[#D4D4D8]" />}>
              <AccountsPayable />
            </Suspense></SectionErrorBoundary>
          )}
          {activeSection === 'office-expenses' && (
            <SectionErrorBoundary resetKey={activeSection}><Suspense fallback={<div className="animate-pulse h-64 bg-white rounded-xl border border-[#D4D4D8]" />}>
              <OfficeExpenses />
            </Suspense></SectionErrorBoundary>
          )}
          {activeSection === 'subcontractors' && (
            <SectionErrorBoundary resetKey={activeSection}><Suspense fallback={<div className="animate-pulse h-64 bg-white rounded-xl border border-[#D4D4D8]" />}>
              <SubcontractorManagement />
            </Suspense></SectionErrorBoundary>
          )}
          {activeSection === 'projects'     && <ProjectManagement />}
          {activeSection === 'clients'      && <ClientManagement />}
          {activeSection === 'audit'        && <AuditLog />}
          {activeSection === 'time-approvals'&& <SupervisorApprovals />}
        </main>
      </div>

      <Toaster position="top-right" richColors />
      <OnboardingTour username={username} replayNonce={tourReplay} />
    </div>
  );
}