import { useSectionNavigation } from '../workspace/WorkspaceState';
// WorkerDashboard.tsx — Full worker panel with 6 functional sections
// All sidebar items are functional — zero "SOON" labels.

import { lazy, Suspense, Component } from 'react';
import { useMarkDashboardReady } from '../lib/dashboardReady';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';

import { Clock, Receipt, PlusCircle, Wrench, CalendarCheck } from 'lucide-react';
import { AppShell, AppShellNavItem } from '../components/AppShell';

import { AuthService } from '../services/auth';
import { Toaster } from '../components/ui/sonner';

// Section error boundary

class SectionErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return <ErrorFallback />;
    }
    return this.props.children;
  }
}

function ErrorFallback() {
  const { t } = useTranslation('worker');
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center">
        <span className="text-xl">⚠️</span>
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-[#0A0A0A]">{t('error.failedToLoad')}</p>
        <p className="text-xs text-[#71717A] mt-1">{t('error.refreshHint')}</p>
      </div>
      <button
        onClick={() => window.location.reload()}
        className="text-xs font-medium text-[#F97316] hover:text-[#C2410C] underline transition-colors"
      >
        {t('error.refreshPage')}
      </button>
    </div>
  );
}

// Lazy-loaded sections

const WorkerTime = lazy(() =>
  import('../components/WorkerTime').then(m => ({ default: m.WorkerTime }))
);
const MyHours = lazy(() =>
  import('../components/MyHours').then(m => ({ default: m.MyHours }))
);
const NewExpense = lazy(() =>
  import('../components/NewExpense').then(m => ({ default: m.NewExpense }))
);
const MyExpenses = lazy(() =>
  import('../components/MyExpenses').then(m => ({ default: m.MyExpenses }))
);
const MyTools = lazy(() =>
  import('../components/MyTools').then(m => ({ default: m.MyTools }))
);

// Types & config

type Section = 'dashboard' | 'time' | 'my-hours' | 'new-expense' | 'my-expenses' | 'my-tools';

const SECTION_KEYS: Record<Section, string> = {
  'dashboard':   'dashboard',
  'time':        'time',
  'my-hours':    'myHours',
  'new-expense': 'newExpense',
  'my-expenses': 'myExpenses',
  'my-tools':    'myTools',
};

export function WorkerDashboard({ initialSection = 'time' }: { initialSection?: Section } = {}) {
  // The welcome overlay fades once this page is on screen (lib/dashboardReady).
  useMarkDashboardReady();
  const { t } = useTranslation('worker');
  const navigate = useNavigate();
  const username = AuthService.getUsername() ?? 'worker';
  const [active, setActive] = useSectionNavigation<Section>('WORKER', initialSection);

  const handleLogout = () => { document.cookie = 'ofjr_session=; Path=/; Max-Age=0'; navigate('/'); AuthService.logout(); };
  const handleNavigate = (s: string) => setActive(s as Section);

  const NAV_ITEMS: AppShellNavItem[] = [
    { key: 'time', label: t('common:workspace.myDay'), icon: Clock },
    { key: 'my-hours', label: t('nav.myHours'), icon: CalendarCheck },
    { key: 'my-expenses', label: t('common:workspace.expenses'), icon: Receipt, group: 'expenses' },
    { key: 'new-expense', label: t('nav.newExpense'), icon: PlusCircle, group: 'expenses' },
    { key: 'my-tools', label: t('nav.myTools'), icon: Wrench },
  ];
  const NAV_GROUPS = [{ key: 'expenses', label: t('common:workspace.expenses'), icon: Receipt }];

  const sectionKey = SECTION_KEYS[active === 'dashboard' ? 'time' : active];
  const meta = {
    title: t(`section.${sectionKey}.title`),
    subtitle: t(`section.${sectionKey}.subtitle`),
  };

  const fallback = (
    <div className="animate-pulse h-64 bg-white rounded-xl border border-[#D4D4D8]" />
  );

  return (
    <>
      <AppShell
        role="WORKER"
        username={username}
        panelLabel={t('panelLabel')}
        navItems={NAV_ITEMS}
        navGroups={NAV_GROUPS}
        activeSection={active}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        pageTitle={meta.title}
        pageSubtitle={meta.subtitle}
      >

        {(active === 'time' || active === 'dashboard') && <SectionErrorBoundary><Suspense fallback={fallback}><WorkerTime username={username} /></Suspense></SectionErrorBoundary>}
        {active === 'my-hours'    && <SectionErrorBoundary><Suspense fallback={fallback}><MyHours /></Suspense></SectionErrorBoundary>}
        {active === 'new-expense' && <SectionErrorBoundary><Suspense fallback={fallback}><NewExpense onSubmitSuccess={() => setActive('my-expenses')} /></Suspense></SectionErrorBoundary>}
        {active === 'my-expenses' && <SectionErrorBoundary><Suspense fallback={fallback}><MyExpenses /></Suspense></SectionErrorBoundary>}
        {active === 'my-tools'    && <SectionErrorBoundary><Suspense fallback={fallback}><MyTools /></Suspense></SectionErrorBoundary>}
      </AppShell>
      <Toaster position="top-right" richColors />
    </>
  );
}
