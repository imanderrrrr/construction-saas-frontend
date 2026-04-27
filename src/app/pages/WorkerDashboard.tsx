// WorkerDashboard.tsx — Full worker panel with 6 functional sections
// All sidebar items are functional — zero "SOON" labels.

import { useState, useEffect, lazy, Suspense, Component } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  Clock, Receipt, PlusCircle, Wrench, LayoutDashboard,
  CalendarCheck, AlertTriangle, CheckCircle, DollarSign,
  Pencil, XCircle, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { AppShell, AppShellNavItem } from '../components/AppShell';
import { StatCard } from '../components/StatCard';
import { AuthService } from '../services/auth';
import { Toaster } from '../components/ui/sonner';
import { getMyWorkerSummary, getMyRecords } from '../services/time';
import type { WorkerSummaryResponse, TimeRecordResponse } from '../services/time';
import { getWorkerToolSummary } from '../services/warehouse';
import type { ToolSummary } from '../services/warehouse';
import { getMySummary as getMyExpenseSummary, getMyExpenses } from '../services/expenses';
import type { ExpenseSummaryResponse, ExpenseResponse } from '../services/expenses';
import type { TimeEventType } from '../types';
import { businessToday } from '../helpers/dateTime';

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

// Helpers

const EVENT_ORDER: TimeEventType[] = ['CHECK_IN', 'LUNCH_START', 'LUNCH_END', 'CHECK_OUT'];

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function EventStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'APPROVED':
      return <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />;
    case 'OBSERVED':
      return <Pencil className="w-3.5 h-3.5 text-[#F97316]" />;
    case 'REJECTED':
      return <XCircle className="w-3.5 h-3.5 text-red-500" />;
    default:
      return null;
  }
}

// Dashboard view

function DashboardView({ username, onNavigate }: { username: string; onNavigate: (s: string) => void }) {
  const { t } = useTranslation('worker');
  const [summary, setSummary] = useState<WorkerSummaryResponse | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState(false);

  const [todayRecords, setTodayRecords] = useState<TimeRecordResponse[]>([]);
  const [todayLoading, setTodayLoading] = useState(true);
  const [carouselIdx, setCarouselIdx] = useState(0);

  const [toolSummary, setToolSummary] = useState<ToolSummary | null>(null);
  const [toolsLoading, setToolsLoading] = useState(true);
  const [toolsError, setToolsError] = useState(false);

  const [expenseSummary, setExpenseSummary] = useState<ExpenseSummaryResponse | null>(null);
  const [expensesLoading, setExpensesLoading] = useState(true);
  const [expensesError, setExpensesError] = useState(false);

  const [recentExpenses, setRecentExpenses] = useState<ExpenseResponse[]>([]);
  const [recentExpLoading, setRecentExpLoading] = useState(true);

  const EVENT_LABELS: Record<TimeEventType, string> = {
    CHECK_IN: t('event.clockIn'),
    LUNCH_START: t('event.lunchStart'),
    LUNCH_END: t('event.lunchEnd'),
    CHECK_OUT: t('event.clockOut'),
  };

  useEffect(() => {
    setSummaryLoading(true);
    getMyWorkerSummary()
      .then(setSummary)
      .catch(() => setSummaryError(true))
      .finally(() => setSummaryLoading(false));

    const today = businessToday();
    setTodayLoading(true);
    getMyRecords({ dateFrom: today, dateTo: today })
      .then(setTodayRecords)
      .catch(err => toast.error(err?.message))
      .finally(() => setTodayLoading(false));

    setToolsLoading(true);
    getWorkerToolSummary()
      .then(setToolSummary)
      .catch(() => setToolsError(true))
      .finally(() => setToolsLoading(false));

    setExpensesLoading(true);
    getMyExpenseSummary()
      .then(setExpenseSummary)
      .catch(() => setExpensesError(true))
      .finally(() => setExpensesLoading(false));

    setRecentExpLoading(true);
    getMyExpenses({ page: 0, size: 3 })
      .then(res => setRecentExpenses(res.content))
      .catch(err => toast.error(err?.message))
      .finally(() => setRecentExpLoading(false));
  }, []);

  const totalProjects = todayRecords.length;
  const safeIdx = totalProjects > 0 ? carouselIdx % totalProjects : 0;
  const activeRecord = todayRecords[safeIdx] ?? null;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Welcome */}
      <div>
        <h2 className="text-2xl font-bold text-[#0A0A0A]">{t('dashboard.welcome', { username })}</h2>
        <p className="text-sm text-[#71717A] mt-1">{t('dashboard.summary')}</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Clock}
          title={t('dashboard.hoursThisWeek')}
          value={summary ? `${summary.approvedHoursThisWeek}h` : '—'}
          subtitle={t('dashboard.approvedMonFri')}
          iconBgColor="bg-emerald-50"
          iconColor="text-emerald-600"
          isLoading={summaryLoading}
          isError={summaryError}
        />
        <StatCard
          icon={AlertTriangle}
          title={t('dashboard.pendingApprovals')}
          value={summary ? String(summary.pendingApprovals) : '—'}
          subtitle={t('dashboard.awaitingReview')}
          iconBgColor="bg-amber-50"
          iconColor="text-amber-600"
          isLoading={summaryLoading}
          isError={summaryError}
        />
        <StatCard
          icon={DollarSign}
          title={t('dashboard.expensesThisMonth')}
          value={expenseSummary ? `$${(expenseSummary.totalApprovedCents / 100).toFixed(2)}` : '—'}
          subtitle={t('dashboard.submitted', { count: expenseSummary?.totalSubmitted ?? 0 })}
          iconBgColor="bg-[#F97316]/10"
          iconColor="text-[#F97316]"
          isLoading={expensesLoading}
          isError={expensesError}
        />
        <StatCard
          icon={Wrench}
          title={t('dashboard.toolsAssigned')}
          value={toolSummary ? String(toolSummary.assigned) : '—'}
          subtitle={t('dashboard.currentlyHeld')}
          iconBgColor="bg-purple-50"
          iconColor="text-purple-600"
          isLoading={toolsLoading}
          isError={toolsError}
        />
      </div>

      {/* Today's Shift */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#D4D4D8]">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#71717A]" />
            <span className="text-sm font-semibold text-[#0A0A0A]">{t('dashboard.todaysShift')}</span>
            {totalProjects > 1 && (
              <span className="text-xs text-[#71717A]">
                · {activeRecord?.projectName} ({safeIdx + 1}/{totalProjects})
              </span>
            )}
            {totalProjects === 1 && activeRecord && (
              <span className="text-xs text-[#71717A]">· {activeRecord.projectName}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {totalProjects > 1 && (
              <>
                <button
                  onClick={() => setCarouselIdx((safeIdx - 1 + totalProjects) % totalProjects)}
                  className="p-1 rounded hover:bg-[#FAFAFA] transition-colors"
                  aria-label={t('dashboard.previousProject')}
                >
                  <ChevronLeft className="w-4 h-4 text-[#71717A]" />
                </button>
                <button
                  onClick={() => setCarouselIdx((safeIdx + 1) % totalProjects)}
                  className="p-1 rounded hover:bg-[#FAFAFA] transition-colors"
                  aria-label={t('dashboard.nextProject')}
                >
                  <ChevronRight className="w-4 h-4 text-[#71717A]" />
                </button>
              </>
            )}
            <button onClick={() => onNavigate('time')}
              className="text-xs font-medium text-emerald-600 hover:text-emerald-800 transition-colors">
              {t('dashboard.goToTimeClock')}
            </button>
          </div>
        </div>
        <div className="p-6">
          {todayLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {EVENT_ORDER.map(t => (
                <div key={t} className="text-center">
                  <p className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wide mb-1">{EVENT_LABELS[t]}</p>
                  <div className="h-5 w-16 mx-auto rounded bg-[#FAFAFA] animate-pulse" />
                </div>
              ))}
            </div>
          ) : totalProjects === 0 ? (
            <p className="text-sm text-[#71717A] text-center py-4">{t('dashboard.noTimeEntries')}</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {EVENT_ORDER.map(eventType => {
                const evt = activeRecord?.events.find(e => e.type === eventType);
                const done = !!evt;
                return (
                  <div key={eventType} className="text-center">
                    <p className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wide mb-1">
                      {EVENT_LABELS[eventType]}
                    </p>
                    <div className={`flex items-center justify-center gap-1.5 ${done ? '' : 'text-[#D4D4D8]'}`}>
                      {done && <EventStatusIcon status={evt.eventApprovalStatus} />}
                      <span className={`text-sm font-semibold ${done ? 'text-[#0A0A0A]' : 'text-[#D4D4D8]'}`}>
                        {done ? formatTime(evt.capturedAtClient) : '—'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {/* Carousel dots */}
          {totalProjects > 1 && (
            <div className="flex justify-center gap-1.5 mt-4">
              {todayRecords.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCarouselIdx(i)}
                  className={`w-2 h-2 rounded-full transition-colors ${i === safeIdx ? 'bg-emerald-600' : 'bg-[#D4D4D8]'}`}
                  aria-label={t('dashboard.goToProject', { index: i + 1 })}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Expenses */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#D4D4D8]">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-[#71717A]" />
            <span className="text-sm font-semibold text-[#0A0A0A]">{t('dashboard.recentExpenses')}</span>
            <span className="text-xs text-[#71717A]">· {t('dashboard.last3')}</span>
          </div>
          <button onClick={() => onNavigate('my-expenses')}
            className="text-xs font-medium text-emerald-600 hover:text-emerald-800 transition-colors">
            {t('dashboard.viewAll')}
          </button>
        </div>
        <div className="divide-y divide-[#D4D4D8]/50">
          {recentExpLoading ? (
            <div className="px-6 py-8 space-y-3">
              {[0, 1, 2].map(i => (
                <div key={i} className="flex items-center justify-between">
                  <div className="space-y-1.5">
                    <div className="h-4 w-20 bg-[#FAFAFA] rounded animate-pulse" />
                    <div className="h-3 w-14 bg-[#FAFAFA] rounded animate-pulse" />
                  </div>
                  <div className="h-4 w-16 bg-[#FAFAFA] rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : recentExpenses.length === 0 ? (
            <p className="text-sm text-[#71717A] text-center py-6">{t('dashboard.noExpenses')}</p>
          ) : (
            recentExpenses.map(exp => {
              const statusColor: Record<string, string> = {
                PENDING:  'bg-amber-50 text-amber-700 border-amber-200',
                APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                OBSERVED: 'bg-blue-50 text-blue-700 border-blue-200',
                REJECTED: 'bg-red-50 text-red-700 border-red-200',
              };
              const date = new Date(exp.expenseDate).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' });
              return (
                <div key={exp.id} className="flex items-center justify-between px-6 py-3 hover:bg-[#FAFAFA]/50 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-[#0A0A0A]">{exp.expenseType}</p>
                    <p className="text-[11px] text-[#71717A]">{date}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-[#0A0A0A]">${(exp.amountCents / 100).toFixed(2)}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusColor[exp.status] ?? 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                      {exp.status}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Quick access */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button onClick={() => onNavigate('time')}
          className="bg-white rounded-xl border border-[#D4D4D8] p-5 text-left hover:border-emerald-400 hover:shadow-sm transition-all group">
          <div className="w-9 h-9 bg-emerald-50 rounded-lg flex items-center justify-center mb-3">
            <Clock className="text-emerald-600" style={{ width: 18, height: 18 }} />
          </div>
          <p className="text-sm font-semibold text-[#0A0A0A] mb-0.5 group-hover:text-emerald-600 transition-colors">{t('nav.timeClock')}</p>
          <p className="text-xs text-[#71717A]">{t('dashboard.timeClockDesc')}</p>
        </button>
        <button onClick={() => onNavigate('new-expense')}
          className="bg-white rounded-xl border border-[#D4D4D8] p-5 text-left hover:border-emerald-400 hover:shadow-sm transition-all group">
          <div className="w-9 h-9 bg-[#F97316]/10 rounded-lg flex items-center justify-center mb-3">
            <PlusCircle className="text-[#F97316]" style={{ width: 18, height: 18 }} />
          </div>
          <p className="text-sm font-semibold text-[#0A0A0A] mb-0.5 group-hover:text-emerald-600 transition-colors">{t('nav.newExpense')}</p>
          <p className="text-xs text-[#71717A]">{t('dashboard.newExpenseDesc')}</p>
        </button>
      </div>
    </div>
  );
}

// Main component

export function WorkerDashboard() {
  const { t } = useTranslation('worker');
  const navigate = useNavigate();
  const username = AuthService.getUsername() ?? 'worker';
  const [active, setActive] = useState<Section>('time');

  const handleLogout = () => { document.cookie = 'ofjr_session=; Path=/; Max-Age=0'; navigate('/'); AuthService.logout(); };
  const handleNavigate = (s: string) => setActive(s as Section);

  const NAV_ITEMS: AppShellNavItem[] = [
    { key: 'dashboard',   label: t('nav.dashboard'),   icon: LayoutDashboard },
    { key: 'time',        label: t('nav.timeClock'),    icon: Clock,          group: 'work' },
    { key: 'my-hours',    label: t('nav.myHours'),      icon: CalendarCheck,  group: 'work' },
    { key: 'new-expense', label: t('nav.newExpense'),   icon: PlusCircle,     group: 'expenses' },
    { key: 'my-expenses', label: t('nav.myExpenses'),   icon: Receipt,        group: 'expenses' },
    { key: 'my-tools',    label: t('nav.myTools'),      icon: Wrench,         group: 'equipment' },
  ];

  const NAV_GROUPS = [
    { key: 'work',      label: t('group.work') },
    { key: 'expenses',  label: t('group.expenses') },
    { key: 'equipment', label: t('group.equipment') },
  ];

  const sectionKey = SECTION_KEYS[active];
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
        {active === 'dashboard'   && <DashboardView username={username} onNavigate={handleNavigate} />}
        {active === 'time'        && <SectionErrorBoundary><Suspense fallback={fallback}><WorkerTime username={username} /></Suspense></SectionErrorBoundary>}
        {active === 'my-hours'    && <SectionErrorBoundary><Suspense fallback={fallback}><MyHours /></Suspense></SectionErrorBoundary>}
        {active === 'new-expense' && <SectionErrorBoundary><Suspense fallback={fallback}><NewExpense onSubmitSuccess={() => setActive('my-expenses')} /></Suspense></SectionErrorBoundary>}
        {active === 'my-expenses' && <SectionErrorBoundary><Suspense fallback={fallback}><MyExpenses /></Suspense></SectionErrorBoundary>}
        {active === 'my-tools'    && <SectionErrorBoundary><Suspense fallback={fallback}><MyTools /></Suspense></SectionErrorBoundary>}
      </AppShell>
      <Toaster position="top-right" richColors />
    </>
  );
}
