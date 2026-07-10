// SupervisorDashboard.tsx — Supervisor panel (budget access removed per policy)

import { useState, useMemo, lazy, Suspense, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard, FolderKanban, ClipboardCheck,
  ReceiptText, Wrench, CalendarClock,
  Clock, Receipt, Users, Bell, Activity,
  Building2, Loader2, Inbox, CheckCheck, Mail, MailOpen,
  MapPin, ChevronRight, AlertCircle, RefreshCw, NotebookPen, ClipboardList,
} from 'lucide-react';
import { AppShell, AppShellNavItem } from '../components/AppShell';
import { AuthService } from '../services/auth';
import { useSiteLogFeature } from '../hooks/useSiteLogFeature';
import { Toaster } from '../components/ui/sonner';
import { toast } from 'sonner';
import { getSupervisorOutOfRangeAlerts, getSupervisorDashboard, getSupervisorTimeRecords, type OutOfRangeAlertResponse, type SupervisorDashboardResponse, type TimeRecordResponse } from '../services/time';
import { getSupervisorSummary, getSupervisorExpenses, type ExpenseSummaryResponse, type ExpenseResponse } from '../services/expenses';
import { getSupervisorNotifications, getSupervisorUnreadCount, markNotificationRead, markAllNotificationsRead, type NotificationResponse } from '../services/notifications';
import { businessToday, nDaysAgo } from '../helpers/dateTime';

// ——— Lazy-load external component ——————————————————————————————————————

const SupervisorProjects = lazy(() =>
  import('../components/SupervisorProjects').then(m => ({ default: m.SupervisorProjects }))
);
const SupervisorApprovals = lazy(() =>
  import('../components/SupervisorApprovals').then(m => ({ default: m.SupervisorApprovals }))
);
const ExpenseReviews = lazy(() =>
  import('../components/ExpenseReviews').then(m => ({ default: m.ExpenseReviews }))
);
const SupervisorTaskBoard = lazy(() =>
  import('../components/SupervisorTaskBoard').then(m => ({ default: m.SupervisorTaskBoard }))
);
const TeamTools = lazy(() =>
  import('../components/TeamTools').then(m => ({ default: m.TeamTools }))
);
const SupervisorSiteLog = lazy(() =>
  import('../components/sitelog/SupervisorSiteLogSection').then(m => ({ default: m.SupervisorSiteLogSection }))
);
const SupervisorPunchList = lazy(() =>
  import('../components/punchlist/SupervisorPunchListSection').then(m => ({ default: m.SupervisorPunchListSection }))
);
// Supervisors are hourly field staff too: they punch their own time through
// the same worker component/endpoints (backend already authorizes SUPERVISOR
// on /api/v1/worker/**). Their records are approvable only by admins.
const WorkerTime = lazy(() =>
  import('../components/WorkerTime').then(m => ({ default: m.WorkerTime }))
);

// ——— Types & config ——————————————————————————————————————————————————

type Section = 'dashboard' | 'projects' | 'task-board' | 'site-log' | 'punch-list' | 'my-time' | 'time-approvals' | 'expense-reviews' | 'team-tools';

const SECTION_META_KEYS: Record<Section, { titleKey: string; subtitleKey: string }> = {
  'dashboard':       { titleKey: 'supervisor:section.dashboard.title',       subtitleKey: 'supervisor:section.dashboard.subtitle'       },
  'projects':        { titleKey: 'supervisor:section.projects.title',        subtitleKey: 'supervisor:section.projects.subtitle'        },
  'task-board':      { titleKey: 'supervisor:section.taskBoard.title',       subtitleKey: 'supervisor:section.taskBoard.subtitle'       },
  'site-log':        { titleKey: 'siteLog:section.title',                    subtitleKey: 'siteLog:section.subtitle'                    },
  'punch-list':      { titleKey: 'punchList:internal.title',                  subtitleKey: 'punchList:internal.subtitle'                 },
  'my-time':         { titleKey: 'supervisor:section.myTime.title',          subtitleKey: 'supervisor:section.myTime.subtitle'          },
  'time-approvals':  { titleKey: 'supervisor:section.timeApprovals.title',   subtitleKey: 'supervisor:section.timeApprovals.subtitle'   },
  'expense-reviews': { titleKey: 'supervisor:section.expenseReviews.title',  subtitleKey: 'supervisor:section.expenseReviews.subtitle'  },
  'team-tools':      { titleKey: 'supervisor:section.teamTools.title',       subtitleKey: 'supervisor:section.teamTools.subtitle'       },
};

// ——— Helpers ——————————————————————————————————————————————————————————

function fmtCurrency(n: number) {
  return '$' + n.toLocaleString('en-US');
}

// ——— Spinner ——————————————————————————————————————————————————————————

function SectionSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 border-2 border-[#F97316] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// ——— Main component ——————————————————————————————————————————————————

export function SupervisorDashboard() {
  const navigate = useNavigate();
  const { t } = useTranslation(['supervisor', 'common', 'siteLog', 'punchList']);
  const username = AuthService.getUsername() ?? 'supervisor1';
  const [active, setActive] = useState<Section>('dashboard');
  // Bitácora de obra is gated behind the `bitacora` plan feature — hide its nav
  // entry (and section) entirely when the tenant's plan does not include it.
  const { enabled: siteLogEnabled } = useSiteLogFeature();

  const handleLogout = () => { document.cookie = 'ofjr_session=; Path=/; Max-Age=0'; navigate('/'); AuthService.logout(); };

  const navItems: AppShellNavItem[] = useMemo(() => {
    const items: AppShellNavItem[] = [
      { key: 'dashboard',       label: t('supervisor:nav.dashboard'),       icon: LayoutDashboard, group: 'general'  },
      { key: 'projects',        label: t('supervisor:nav.projects'),        icon: FolderKanban,    group: 'general'  },
      { key: 'task-board',      label: t('supervisor:nav.taskBoard'),       icon: CalendarClock,   group: 'general'  },
    ];
    if (siteLogEnabled) {
      items.push({ key: 'site-log', label: t('siteLog:nav.bitacora'), icon: NotebookPen, group: 'general' });
      // Punch list rides the same plan feature as the client portal (D8).
      items.push({ key: 'punch-list', label: t('punchList:internal.title'), icon: ClipboardList, group: 'general' });
    }
    items.push(
      { key: 'my-time',         label: t('supervisor:nav.myTime'),          icon: Clock,           group: 'time'     },
      { key: 'time-approvals',  label: t('supervisor:nav.timeApprovals'),   icon: ClipboardCheck,  group: 'time'     },
      { key: 'expense-reviews', label: t('supervisor:nav.expenseReviews'),  icon: ReceiptText,     group: 'expenses' },
      { key: 'team-tools',      label: t('supervisor:nav.teamTools'),       icon: Wrench,          group: 'tools'    },
    );
    return items;
  }, [t, siteLogEnabled]);

  const navGroups = useMemo(() => [
    { key: 'general',  label: t('supervisor:group.general')  },
    { key: 'time',     label: t('supervisor:group.time')     },
    { key: 'expenses', label: t('supervisor:group.expenses') },
    { key: 'tools',    label: t('supervisor:group.tools')    },
  ], [t]);

  const metaKeys = SECTION_META_KEYS[active];

  return (
    <>
      <AppShell
        role="SUPERVISOR"
        username={username}
        panelLabel={t('supervisor:panelLabel')}
        navItems={navItems}
        navGroups={navGroups}
        activeSection={active}
        onNavigate={s => setActive(s as Section)}
        onLogout={handleLogout}
        pageTitle={t(metaKeys.titleKey)}
        pageSubtitle={t(metaKeys.subtitleKey)}
      >
        <Suspense fallback={<SectionSpinner />}>
          {active === 'dashboard'       && <SupervisorDashboardContent username={username} onNavigate={s => setActive(s as Section)} />}
          {active === 'projects'        && <SupervisorProjects />}
          {active === 'task-board'      && <SupervisorTaskBoard />}
          {active === 'site-log'        && siteLogEnabled && <SupervisorSiteLog />}
          {active === 'punch-list'      && siteLogEnabled && <SupervisorPunchList />}
          {active === 'my-time'         && <WorkerTime username={username} />}
          {active === 'time-approvals'  && <SupervisorApprovals mode="supervisor" />}
          {active === 'expense-reviews' && <ExpenseReviews />}
          {active === 'team-tools'      && <TeamTools />}
        </Suspense>
      </AppShell>
      <Toaster position="top-right" richColors />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// INTERNAL SECTION COMPONENTS
// ═══════════════════════════════════════════════════════════════════════

// ——— SupervisorDashboardContent ———————————————————————————————————————

function SupervisorDashboardContent({ username, onNavigate }: { username: string; onNavigate: (s: string) => void }) {
  const { t } = useTranslation(['supervisor', 'common', 'siteLog', 'punchList']);

  // Out-of-range alerts (live data)
  const [oorAlerts, setOorAlerts] = useState<OutOfRangeAlertResponse[]>([]);
  const [dashboard, setDashboard] = useState<SupervisorDashboardResponse | null>(null);
  const [expenseSummary, setExpenseSummary] = useState<ExpenseSummaryResponse | null>(null);
  const [dashLoading, setDashLoading] = useState(true);
  // Per-source error flags — surfaced so a failed load is never shown as a real "0"
  const [dashError, setDashError] = useState(false);
  const [expenseError, setExpenseError] = useState(false);
  const [alertsError, setAlertsError] = useState(false);

  // Notifications
  const [notifications, setNotifications] = useState<NotificationResponse[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifLoading, setNotifLoading] = useState(true);
  const [notifError, setNotifError] = useState(false);

  const loadCards = useCallback(() => {
    setDashLoading(true);
    setDashError(false);
    setAlertsError(false);
    setExpenseError(false);
    getSupervisorOutOfRangeAlerts()
      .then(setOorAlerts)
      .catch(() => setAlertsError(true));
    getSupervisorSummary()
      .then(setExpenseSummary)
      .catch(() => setExpenseError(true));
    getSupervisorDashboard()
      .then(setDashboard)
      .catch(() => setDashError(true))
      .finally(() => setDashLoading(false));
  }, []);

  const loadNotifications = useCallback(() => {
    setNotifLoading(true);
    setNotifError(false);
    getSupervisorNotifications(0, 20)
      .then(page => setNotifications(page.content))
      .catch(() => setNotifError(true))
      .finally(() => setNotifLoading(false));
    getSupervisorUnreadCount()
      .then(({ count }) => setUnreadCount(count))
      .catch(() => { /* unread badge is non-critical; the inbox shows its own error */ });
  }, []);

  useEffect(() => { loadCards(); }, [loadCards]);
  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  async function handleMarkRead(id: number) {
    try {
      await markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch { toast.error(t('supervisor:dash.markReadError', 'Could not update the notification. Please try again.')); }
  }

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch { toast.error(t('supervisor:dash.markReadError', 'Could not update the notification. Please try again.')); }
  }

  // Recent team activity (combined time events + expenses)
  interface ActivityItem { ini: string; name: string; action: string; project: string; time: string; sortKey: string; }
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState(false);

  const eventLabels: Record<string, string> = useMemo(() => ({
    CHECK_IN: t('dash.clockedIn'), LUNCH_START: t('dash.lunchStart'),
    LUNCH_END: t('dash.lunchEnd'), CHECK_OUT: t('dash.clockedOut'),
  }), [t]);

  const loadActivity = useCallback(async () => {
      setActivityLoading(true);
      setActivityError(false);
      try {
        const today = businessToday();
        const fromStr = nDaysAgo(2);

        const [timeRes, expRes] = await Promise.all([
          getSupervisorTimeRecords({ dateFrom: fromStr, dateTo: today, size: 50 }),
          getSupervisorExpenses({ dateFrom: fromStr, dateTo: today, size: 20 }),
        ]);

        const items: ActivityItem[] = [];

        // Map time events
        const labels: Record<string, string> = {
          CHECK_IN: t('dash.clockedIn'), LUNCH_START: t('dash.lunchStart'),
          LUNCH_END: t('dash.lunchEnd'), CHECK_OUT: t('dash.clockedOut'),
        };
        for (const rec of timeRes.content) {
          const workerName = rec.workerName ?? rec.workerUsername;
          const ini = workerName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
          for (const ev of rec.events) {
            items.push({
              ini,
              name: workerName,
              action: labels[ev.type] ?? ev.type,
              project: rec.projectName,
              time: ev.capturedAtClient,
              sortKey: ev.capturedAtClient,
            });
          }
        }

        // Map expenses
        for (const exp of expRes.content) {
          const workerName = exp.workerName ?? exp.workerUsername;
          const ini = workerName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
          const amt = (exp.amountCents / 100).toFixed(2);
          items.push({
            ini,
            name: workerName,
            action: t('dash.submittedExpense', { amount: amt }),
            project: exp.projectName,
            time: exp.createdAt,
            sortKey: exp.createdAt,
          });
        }

        // Sort by time desc, take top 10
        items.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
        setRecentActivity(items.slice(0, 10));
      } catch { setActivityError(true); }
      finally { setActivityLoading(false); }
  }, [t]);

  useEffect(() => { loadActivity(); }, [loadActivity]);

  function StatusBadge({ status }: { status: string }) {
    if (status === 'ACTIVE') return <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-700">{t('dash.statusActive')}</span>;
    if (status === 'CLOSED') return <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600">{t('dash.statusClosed')}</span>;
    return <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-amber-50 text-amber-600">{t('dash.statusInactive')}</span>;
  }

  /** Format a relative time string */
  function relativeTime(iso: string): string {
    const diffMs  = Date.now() - new Date(iso).getTime();
    const diffMin = Math.max(0, Math.floor(diffMs / 60_000));
    if (diffMin < 60) return diffMin <= 1 ? t('dash.justNow') : t('dash.minAgo', { count: diffMin });
    const hrs = Math.floor(diffMin / 60);
    const mins = diffMin % 60;
    return mins > 0 ? t('dash.hrsMinAgo', { hrs, mins }) : t('dash.hrsAgo', { hrs });
  }

  /** Inline error state for a panel (alerts / inbox / activity) with a retry action */
  function PanelError({ message, onRetry }: { message: string; onRetry: () => void }) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center mb-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
        </div>
        <p className="text-sm font-medium text-red-900">{t('supervisor:dash.panelError', 'Something went wrong')}</p>
        <p className="text-[11px] text-[#71717A] mt-0.5">{message}</p>
        <button onClick={onRetry} className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-[#F97316] hover:text-[#C2410C] transition-colors">
          <RefreshCw className="w-3.5 h-3.5" />{t('common:buttons.retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Welcome */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-[#0A0A0A]">{t('dash.welcome', { username })}</h2>
        <p className="text-sm text-[#71717A] mt-1">{t('dash.overview')}</p>
      </div>

      {/* Error banner — a "—" in a card means the value is unavailable, not a real zero */}
      {(dashError || expenseError || alertsError) && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-red-900">{t('supervisor:dash.errorTitle', 'Could not load dashboard data')}</p>
              <p className="text-xs text-red-600 mt-0.5">{t('supervisor:dash.errorDesc', 'Some sections failed to load. A “—” means the value is unavailable, not zero.')}</p>
            </div>
          </div>
          <button onClick={loadCards} className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-100/50 transition-colors shrink-0">
            <RefreshCw className="w-3.5 h-3.5" />{t('common:buttons.retry')}
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-xl border border-[#D4D4D8] bg-white p-4 sm:p-5 relative overflow-hidden">
          <div className="w-9 h-9 sm:w-10 sm:h-10 bg-[#F97316]/10 rounded-lg flex items-center justify-center mb-2 sm:mb-3">
            <FolderKanban className="w-4 h-4 sm:w-5 sm:h-5 text-[#F97316]" />
          </div>
          {dashLoading ? (
            <div className="h-7 w-12 bg-slate-100 rounded animate-pulse" />
          ) : (
            <p className="text-xl sm:text-2xl font-bold text-[#0A0A0A]">{dashError ? '—' : (dashboard?.assignedProjects ?? 0)}</p>
          )}
          <p className="text-xs sm:text-sm text-[#71717A] truncate">{t('dash.assignedProjects')}</p>
          <p className="text-[10px] sm:text-xs text-[#71717A] mt-1 truncate">
            {dashboard ? t('dash.activeClosedCount', { active: dashboard.activeProjects, closed: dashboard.closedProjects }) : '—'}
          </p>
        </div>
        <div className="rounded-xl border border-[#D4D4D8] bg-white p-4 sm:p-5 relative overflow-hidden">
          {!dashLoading && (dashboard?.pendingApprovals ?? 0) > 0 && (
            <span className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-amber-500" />
          )}
          <div className="w-9 h-9 sm:w-10 sm:h-10 bg-amber-50 rounded-lg flex items-center justify-center mb-2 sm:mb-3">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
          </div>
          {dashLoading ? (
            <div className="h-7 w-12 bg-slate-100 rounded animate-pulse" />
          ) : (
            <p className="text-xl sm:text-2xl font-bold text-[#0A0A0A]">{dashError ? '—' : (dashboard?.pendingApprovals ?? 0)}</p>
          )}
          <p className="text-xs sm:text-sm text-[#71717A] truncate">{t('dash.pendingApprovals')}</p>
          <p className="text-[10px] sm:text-xs text-[#71717A] mt-1 truncate">
            {dashboard ? t('dash.fromToday', { count: dashboard.pendingApprovalsToday }) : '—'}
          </p>
        </div>
        <button
          onClick={() => onNavigate('expense-reviews')}
          className="rounded-xl border border-[#D4D4D8] bg-white p-4 sm:p-5 relative text-left group cursor-pointer hover:border-orange-400/60 hover:shadow-sm transition-all overflow-hidden"
        >
          {(expenseSummary?.pendingCount ?? 0) > 0 && (
            <span className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-orange-500" />
          )}
          <div className="w-9 h-9 sm:w-10 sm:h-10 bg-orange-50 rounded-lg flex items-center justify-center mb-2 sm:mb-3">
            <Receipt className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />
          </div>
          {dashLoading ? (
            <div className="h-7 w-12 bg-slate-100 rounded animate-pulse" />
          ) : (
            <p className="text-xl sm:text-2xl font-bold text-[#0A0A0A]">{expenseError ? '—' : (expenseSummary?.pendingCount ?? 0)}</p>
          )}
          <p className="text-xs sm:text-sm text-[#71717A] truncate">{t('dash.expenseReviews')}</p>
          <p className="text-[10px] sm:text-xs text-[#71717A] mt-1 truncate">
            {expenseSummary ? t('dash.approved', { amount: fmtCurrency(expenseSummary.totalApprovedCents / 100) }) : '—'}
          </p>
          <p className="text-[10px] text-[#F97316] font-medium mt-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {t('dash.viewDetails')} <ChevronRight className="w-3 h-3" />
          </p>
        </button>
        <div className="rounded-xl border border-[#D4D4D8] bg-white p-4 sm:p-5 relative overflow-hidden">
          <div className="w-9 h-9 sm:w-10 sm:h-10 bg-emerald-50 rounded-lg flex items-center justify-center mb-2 sm:mb-3">
            <Users className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
          </div>
          {dashLoading ? (
            <div className="h-7 w-12 bg-slate-100 rounded animate-pulse" />
          ) : (
            <p className="text-xl sm:text-2xl font-bold text-[#0A0A0A]">
              {dashError ? '—' : (dashboard?.projects.reduce((s, p) => s + p.members, 0) ?? 0)}
            </p>
          )}
          <p className="text-xs sm:text-sm text-[#71717A] truncate">{t('dash.teamMembers')}</p>
          <p className="text-[10px] sm:text-xs text-[#71717A] mt-1 truncate">
            {dashboard ? (dashboard.projects.length !== 1
              ? t('dash.acrossProjectsPlural', { count: dashboard.projects.length })
              : t('dash.acrossProjects', { count: dashboard.projects.length })
            ) : '—'}
          </p>
        </div>
      </div>

      {/* Projects Overview + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
        <div className="lg:col-span-3 rounded-xl border border-[#D4D4D8] bg-white p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#F97316]" />
              <h3 className="text-base font-semibold text-[#0A0A0A]">{t('dash.projectsOverview')}</h3>
            </div>
            <span className="text-xs bg-[#F97316]/10 text-[#F97316] px-2 py-0.5 rounded-full font-medium">
              {t('dash.projectsCount', { count: dashboard?.projects.length ?? 0 })}
            </span>
          </div>
          {dashLoading ? (
            <div className="space-y-4 py-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="py-3 border-b border-[#D4D4D8]/50 last:border-b-0">
                  <div className="h-4 w-48 bg-slate-100 rounded animate-pulse mb-2" />
                  <div className="h-3 w-24 bg-slate-100 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : (dashboard?.projects.length ?? 0) === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-10 h-10 bg-[#FAFAFA] rounded-full flex items-center justify-center mb-3">
                <Building2 className="w-5 h-5 text-[#D4D4D8]" />
              </div>
              <p className="text-sm font-medium text-[#71717A]">{t('dash.noProjectsAssigned')}</p>
              <p className="text-[11px] text-[#71717A] mt-0.5">{t('dash.notAssignedToProjects')}</p>
            </div>
          ) : (
            dashboard!.projects.map(proj => {
              const MAX_AVATARS = 3;
              const visible = proj.assignedUsers.slice(0, MAX_AVATARS);
              const overflow = proj.members - MAX_AVATARS;

              function initials(name: string | null): string {
                if (!name) return '?';
                const parts = name.trim().split(/\s+/);
                if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
                return name.slice(0, 2).toUpperCase();
              }

              return (
                <div key={proj.id} className="py-3 border-b border-[#D4D4D8]/50 last:border-b-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-[#0A0A0A]">{proj.name}</span>
                    <StatusBadge status={proj.status} />
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center">
                      {visible.map((u, i) => (
                        <div
                          key={u.id}
                          title={u.fullName ?? undefined}
                          className="w-7 h-7 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-[10px] font-medium text-slate-600"
                          style={{ marginLeft: i > 0 ? -8 : 0, zIndex: MAX_AVATARS - i }}
                        >
                          {initials(u.fullName)}
                        </div>
                      ))}
                      {overflow > 0 && (
                        <span className="text-[11px] text-[#71717A] ml-1.5">{t('dash.more', { count: overflow })}</span>
                      )}
                    </div>
                    <span className="text-xs text-[#71717A]">{t('dash.members', { count: proj.members })}</span>
                  </div>
                </div>
              );
            })
          )}
          <button onClick={() => onNavigate('projects')} className="text-sm text-[#F97316] hover:underline font-medium mt-3">
            {t('dash.viewAllProjects')}
          </button>
        </div>

        <div className="lg:col-span-2 rounded-xl border border-[#D4D4D8] bg-white p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-[#F97316]" />
              <h3 className="text-base font-semibold text-[#0A0A0A]">{t('dash.alertsNotifications')}</h3>
            </div>
            {oorAlerts.length > 0 && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                {t('dash.outOfRange', { count: oorAlerts.length })}
              </span>
            )}
          </div>

          {/* Out-of-range alerts (live) */}
          {alertsError ? (
            <PanelError message={t('supervisor:dash.alertsError', "We couldn't load location alerts. They may be out of date.")} onRetry={loadCards} />
          ) : oorAlerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-10 h-10 bg-[#FAFAFA] rounded-full flex items-center justify-center mb-3">
                <Bell className="w-5 h-5 text-[#D4D4D8]" />
              </div>
              <p className="text-sm font-medium text-[#71717A]">{t('dash.noAlerts')}</p>
              <p className="text-[11px] text-[#71717A] mt-0.5">{t('dash.allWithinArea')}</p>
            </div>
          ) : (
            oorAlerts.map((alert) => (
              <div
                key={`oor-${alert.workerId}-${alert.projectId}`}
                className="flex gap-3 py-2.5 border-b border-[#D4D4D8]/50 last:border-b-0 cursor-pointer hover:bg-red-50/40 rounded-lg px-1 -mx-1 transition-colors"
                onClick={() => onNavigate('time-approvals')}
                title={t('supervisor:section.timeApprovals.title')}
              >
                <div className="bg-red-100 rounded-lg w-7 h-7 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <MapPin className="w-4 h-4 text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#0A0A0A] font-medium">
                    {alert.workerName ?? alert.workerUsername}{' '}
                    <span className="font-normal text-red-600">
                      {alert.eventCount > 0 ? t('dash.outsideWorkArea') : t('dash.punchedWithoutGps')}
                    </span>
                  </p>
                  <p className="text-[11px] text-[#71717A] truncate">{alert.projectName}</p>
                  <p className="text-[11px] text-red-500 font-medium">
                    {t('dash.firstReported', { time: relativeTime(alert.firstOccurredAt) })}
                    {alert.eventCount > 1 && ` ${t('dash.eventCount', { count: alert.eventCount })}`}
                    {alert.unavailableCount > 0 && ` ${t('dash.unavailableCount', { count: alert.unavailableCount })}`}
                  </p>
                  {/* Exact punch locations — one Google Maps deep-link per flagged mark */}
                  {(alert.events ?? []).some(ev => ev.lat != null && ev.lng != null) && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {(alert.events ?? [])
                        .filter(ev => ev.lat != null && ev.lng != null)
                        .map(ev => (
                          <a
                            key={ev.eventId}
                            href={`https://www.google.com/maps?q=${ev.lat},${ev.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            title={t('dash.viewInMaps')}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-red-200 bg-white text-[10px] font-semibold text-red-600 hover:bg-red-50"
                          >
                            <MapPin className="w-3 h-3" />
                            {new Date(ev.capturedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {ev.distanceMeters != null && (
                              <span className="font-normal">· {Math.round(ev.distanceMeters).toLocaleString()} m</span>
                            )}
                          </a>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Notification Inbox */}
      <div className="rounded-xl border border-[#D4D4D8] bg-white p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Inbox className="w-5 h-5 text-[#F97316]" />
            <h3 className="text-base font-semibold text-[#0A0A0A]">{t('dash.notificationInbox')}</h3>
            {unreadCount > 0 && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F97316]/10 text-[#F97316] border border-[#F97316]/20">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1 text-xs text-[#F97316] hover:underline font-medium"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              {t('dash.markAllRead')}
            </button>
          )}
        </div>

        {notifLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-[#F97316]" />
          </div>
        ) : notifError ? (
          <PanelError message={t('supervisor:dash.notificationsError', "We couldn't load your notifications.")} onRetry={loadNotifications} />
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-10 h-10 bg-[#FAFAFA] rounded-full flex items-center justify-center mb-3">
              <Inbox className="w-5 h-5 text-[#D4D4D8]" />
            </div>
            <p className="text-sm font-medium text-[#71717A]">{t('dash.noNotifications')}</p>
            <p className="text-[11px] text-[#71717A] mt-0.5">{t('dash.notificationsWillAppear')}</p>
          </div>
        ) : (
          <div className="space-y-0.5 max-h-[320px] overflow-y-auto">
            {notifications.map(n => (
              <div
                key={n.id}
                onClick={() => !n.isRead && handleMarkRead(n.id)}
                className={`flex gap-3 py-2.5 px-2 -mx-1 rounded-lg transition-colors cursor-pointer ${
                  n.isRead ? 'opacity-60 hover:opacity-80' : 'bg-[#F97316]/[0.03] hover:bg-[#F97316]/[0.06]'
                }`}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {n.isRead
                    ? <MailOpen className="w-4 h-4 text-[#71717A]" />
                    : <Mail className="w-4 h-4 text-[#F97316]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${n.isRead ? 'text-[#71717A]' : 'text-[#0A0A0A] font-medium'}`}>
                    {n.title}
                  </p>
                  <p className="text-[11px] text-[#71717A] mt-0.5 line-clamp-2">{n.message}</p>
                  <p className="text-[10px] text-[#71717A] mt-1">{relativeTime(n.createdAt)}</p>
                </div>
                {!n.isRead && (
                  <div className="w-2 h-2 rounded-full bg-[#F97316] flex-shrink-0 mt-2" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Team Activity */}
      <div className="rounded-xl border border-[#D4D4D8] bg-white p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-[#F97316]" />
          <h3 className="text-base font-semibold text-[#0A0A0A]">{t('dash.recentTeamActivity')}</h3>
        </div>

        {activityLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-[#F97316]" />
          </div>
        ) : activityError ? (
          <PanelError message={t('supervisor:dash.activityError', "We couldn't load recent team activity.")} onRetry={loadActivity} />
        ) : recentActivity.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Activity className="w-8 h-8 text-[#D4D4D8] mb-2" />
            <p className="text-sm font-medium text-[#71717A]">{t('dash.noRecentActivity')}</p>
            <p className="text-xs text-[#71717A] mt-0.5">{t('dash.timeEventsWillAppear')}</p>
          </div>
        ) : (
          <>
            <div className="hidden md:block">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#D4D4D8]">
                    <th className="text-left text-xs text-[#71717A] uppercase tracking-wider py-2">{t('dash.table.teamMember')}</th>
                    <th className="text-left text-xs text-[#71717A] uppercase tracking-wider py-2">{t('dash.table.action')}</th>
                    <th className="text-left text-xs text-[#71717A] uppercase tracking-wider py-2">{t('dash.table.project')}</th>
                    <th className="text-left text-xs text-[#71717A] uppercase tracking-wider py-2">{t('dash.table.time')}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentActivity.map((r, i) => (
                    <tr key={i} className="border-b border-[#D4D4D8]/50 last:border-b-0">
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-xs font-medium text-slate-600">{r.ini}</div>
                          <span className="text-sm text-[#0A0A0A] font-medium">{r.name}</span>
                        </div>
                      </td>
                      <td className="py-3 text-sm text-[#0A0A0A]">{r.action}</td>
                      <td className="py-3 text-sm text-[#71717A]">{r.project}</td>
                      <td className="py-3 text-xs text-[#71717A] whitespace-nowrap">{relativeTime(r.time)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden">
              {recentActivity.map((r, i) => (
                <div key={i} className="py-3 border-b border-[#D4D4D8]/50 last:border-b-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-xs font-medium text-slate-600">{r.ini}</div>
                    <span className="text-sm font-medium text-[#0A0A0A]">{r.name}</span>
                  </div>
                  <p className="text-sm text-[#0A0A0A] ml-10">{r.action}</p>
                  <p className="text-xs text-[#71717A] ml-10">{r.project} &middot; {relativeTime(r.time)}</p>
                </div>
              ))}
            </div>
          </>
        )}

        <button onClick={() => onNavigate('time-approvals')} className="text-sm text-[#F97316] hover:underline font-medium mt-3">
          {t('dash.viewAllActivity')}
        </button>
      </div>
    </div>
  );
}


// ——— BudgetOverviewContent ————————————————————————————————————————————
