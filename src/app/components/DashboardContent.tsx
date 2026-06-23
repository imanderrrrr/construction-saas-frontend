import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Users, UserMinus, FolderOpen, Folder, UserPlus, Plus,
  Activity, AlertCircle, RefreshCw,
  ChevronRight, Clock, ShieldCheck, Wrench, Receipt, Wallet, Shield,
} from 'lucide-react';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { StatCard } from './StatCard';
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from './ui/table';
import { listUsers } from '../services/users';
import { listProjects, type ProjectResponse } from '../services/projects';
import { searchAuditLogs, type AuditLogDTO } from '../services/audit';
import { getAdminHoursReport } from '../services/time';
import { getAdminSummary } from '../services/expenses';
import { getAdminToolSummary } from '../services/warehouse';

// Types

type ViewState = 'loading' | 'ok' | 'empty' | 'error';

interface KpiData {
  activeUsers: number;
  inactiveUsers: number;
  activeProjects: number;
  totalProjects: number;
}

interface SystemKpis {
  activeWorkersToday: number;
  hoursThisWeek: number;
  pendingExpenses: number;
  budgetCriticalProjects: number;
  toolsAssigned: number;
  auditEventsToday: number;
}

// Constants

/** Maps real backend action names to badge colors. Fallback style used for unknowns. */
const ACTION_STYLES: Record<string, { bg: string; text: string }> = {
  // Auth & Security
  LOGIN_SUCCESS:               { bg: 'bg-emerald-50',    text: 'text-emerald-700'  },
  LOGIN_FAILED:                { bg: 'bg-red-50',         text: 'text-red-700'      },
  ACCESS_DENIED:               { bg: 'bg-red-50',         text: 'text-red-700'      },
  // Users
  USER_CREATED:                { bg: 'bg-[#F97316]/10',  text: 'text-[#F97316]'    },
  USER_UPDATED:                { bg: 'bg-purple-50',      text: 'text-purple-700'   },
  USER_STATUS_CHANGED:         { bg: 'bg-amber-50',       text: 'text-amber-700'    },
  PASSWORD_RESET:              { bg: 'bg-amber-50',       text: 'text-amber-700'    },
  // Projects
  PROJECT_CREATED:             { bg: 'bg-blue-50',        text: 'text-blue-700'     },
  PROJECT_UPDATED:             { bg: 'bg-blue-50',        text: 'text-blue-600'     },
  PROJECT_CLOSED:              { bg: 'bg-slate-100',      text: 'text-slate-700'    },
  PROJECT_GEOFENCE_UPDATED:    { bg: 'bg-cyan-50',        text: 'text-cyan-700'     },
  PROJECT_ASSIGNMENTS_UPDATED: { bg: 'bg-indigo-50',      text: 'text-indigo-700'   },
  // Time
  TIME_CHECK_IN:               { bg: 'bg-emerald-50',    text: 'text-emerald-700'  },
  TIME_CHECK_OUT:              { bg: 'bg-orange-50',      text: 'text-orange-700'   },
  TIME_LUNCH_START:            { bg: 'bg-yellow-50',      text: 'text-yellow-700'   },
  TIME_LUNCH_END:              { bg: 'bg-yellow-50',      text: 'text-yellow-600'   },
  TIME_ENTRY_APPROVED:         { bg: 'bg-emerald-50',    text: 'text-emerald-700'  },
  TIME_ENTRY_REJECTED:         { bg: 'bg-red-50',         text: 'text-red-700'      },
  TIME_ENTRY_CORRECTED:        { bg: 'bg-amber-50',       text: 'text-amber-700'    },
  TIME_EVENT_APPROVED:         { bg: 'bg-emerald-50',    text: 'text-emerald-700'  },
  TIME_EVENT_REJECTED:         { bg: 'bg-red-50',         text: 'text-red-700'      },
  TIME_EVENT_CORRECTED:        { bg: 'bg-amber-50',       text: 'text-amber-700'    },
};

const QUICK_ACTIONS = [
  { icon: UserPlus,    labelKey: 'admin:dashboard.createUser',     descKey: 'admin:dashboard.createUserDesc',     color: 'text-[#F97316]',  bg: 'bg-[#F97316]/10', nav: 'users'    },
  { icon: Plus,        labelKey: 'admin:dashboard.createProject',  descKey: 'admin:dashboard.createProjectDesc',  color: 'text-emerald-600', bg: 'bg-emerald-50',   nav: 'projects' },
  { icon: ShieldCheck, labelKey: 'admin:dashboard.viewAuditLogs',  descKey: 'admin:dashboard.viewAuditLogsDesc',  color: 'text-purple-600',  bg: 'bg-purple-50',    nav: 'audit'    },
];

// Helpers

import { fmtDateTime, businessToday, nDaysAgo, startOfDayISO } from '../helpers/dateTime';

function fmtEntity(dto: AuditLogDTO): string {
  if (dto.entityType && dto.entityId) return `${dto.entityType} #${dto.entityId}`;
  if (dto.entityType) return dto.entityType;
  return '—';
}

function ActionBadge({ action }: { action: string }) {
  const s = ACTION_STYLES[action] ?? { bg: 'bg-[#FAFAFA]', text: 'text-[#71717A]' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold ${s.bg} ${s.text}`}>
      {action}
    </span>
  );
}

// Dashboard Content

export function DashboardContent({ onNavigate }: { onNavigate: (section: string) => void }) {
  const { t, i18n } = useTranslation(['admin', 'common']);
  const [viewState, setViewState]       = useState<ViewState>('loading');
  const [kpi, setKpi]                   = useState<KpiData | null>(null);
  const [systemKpis, setSystemKpis]     = useState<SystemKpis | null>(null);
  const [recentActivity, setRecent]     = useState<AuditLogDTO[]>([]);
  const [lastUpdated, setLastUpdated]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setViewState('loading');
    try {
      const today = businessToday();
      const weekAgo = nDaysAgo(7);
      const todayStartISO = startOfDayISO(today);

      const [activeUsersPage, inactiveUsersPage, activeProjectsPage, allProjectsPage, auditPage] =
        await Promise.all([
          listUsers({ status: 'ACTIVE',   page: 0, size: 1 }),
          listUsers({ status: 'INACTIVE', page: 0, size: 1 }),
          listProjects({ status: 'ACTIVE', page: 0, size: 1 }),
          listProjects({ page: 0, size: 1 }),
          searchAuditLogs({ page: 0, size: 6 }),
        ]);

      setKpi({
        activeUsers:    activeUsersPage.totalElements,
        inactiveUsers:  inactiveUsersPage.totalElements,
        activeProjects: activeProjectsPage.totalElements,
        totalProjects:  allProjectsPage.totalElements,
      });
      setRecent(auditPage.content);

      // Fetch system KPIs in parallel (non-blocking — failures show '—')
      const sysPromises = await Promise.allSettled([
        getAdminHoursReport({ dateFrom: weekAgo, dateTo: today }),
        getAdminSummary(),
        getAdminToolSummary(),
        listProjects({ status: 'ACTIVE', page: 0, size: 500 }),
        searchAuditLogs({ page: 0, size: 1, dateFrom: todayStartISO }),
      ]);

      const hoursReport  = sysPromises[0].status === 'fulfilled' ? sysPromises[0].value : null;
      const expSummary   = sysPromises[1].status === 'fulfilled' ? sysPromises[1].value : null;
      const toolSummary  = sysPromises[2].status === 'fulfilled' ? sysPromises[2].value : null;
      const budgetProjects = sysPromises[3].status === 'fulfilled' ? sysPromises[3].value : null;
      const todayAudit   = sysPromises[4].status === 'fulfilled' ? sysPromises[4].value : null;

      // Count active workers (workers with time entries this week)
      const activeWorkersToday = hoursReport?.workers?.length ?? 0;
      const hoursThisWeek = hoursReport?.kpis?.totalApprovedHours ?? 0;
      const pendingExpenses = expSummary?.pendingCount ?? 0;
      const toolsAssigned = toolSummary?.assigned ?? 0;
      const auditEventsToday = todayAudit?.totalElements ?? 0;

      // Budget critical = projects with >90% consumption
      let budgetCriticalProjects = 0;
      if (budgetProjects) {
        budgetCriticalProjects = budgetProjects.content.filter((p: ProjectResponse) => {
          const budget = p.revisedContractCents ?? p.originalContractCents ?? 0;
          const consumed = p.totalConsumedCents ?? 0;
          return budget > 0 && (consumed / budget) >= 0.9;
        }).length;
      }

      setSystemKpis({ activeWorkersToday, hoursThisWeek, pendingExpenses, budgetCriticalProjects, toolsAssigned, auditEventsToday });

      setLastUpdated(fmtDateTime(new Date().toISOString(), i18n.language));
      setViewState(
        allProjectsPage.totalElements === 0 && auditPage.totalElements === 0
          ? 'empty'
          : 'ok'
      );
    } catch (err) {
      setViewState('error');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const isLoading = viewState === 'loading';
  const isError   = viewState === 'error';
  const isEmpty   = viewState === 'empty';
  const isOk      = viewState === 'ok' || viewState === 'empty';

  return (
    <div className="space-y-6">

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#0A0A0A]">{t('admin:dashboard.title')}</h2>
          <p className="text-sm text-[#71717A] mt-1">{t('admin:dashboard.subtitle')}</p>
        </div>
        {lastUpdated && (
          <div className="flex items-center gap-2 text-xs text-[#71717A]">
            <Clock className="w-3.5 h-3.5" />
            <span>{t('admin:dashboard.lastUpdated', { timestamp: lastUpdated })}</span>
          </div>
        )}

      </div>

      {/* Error Banner */}
      {isError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-red-900">{t('admin:dashboard.errorTitle')}</p>
              <p className="text-xs text-red-600 mt-0.5">{t('admin:dashboard.errorDesc')}</p>
            </div>
          </div>
          <Button variant="outline" size="sm"
            onClick={load}
            className="gap-2 border-red-200 text-red-700 hover:bg-red-50 shrink-0">
            <RefreshCw className="w-3.5 h-3.5" />{t('common:buttons.retry')}
          </Button>
        </div>
      )}

      {/* KPI Cards */}
      <div>
        <p className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-4">{t('admin:dashboard.keyMetrics')}</p>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            icon={Users}
            title={t('admin:dashboard.activeUsers')}
            value={kpi?.activeUsers ?? 0}
            subtitle={t('admin:dashboard.activeUsersDesc')}
            iconBgColor="bg-[#F97316]/10"
            iconColor="text-[#F97316]"
            isLoading={isLoading} isError={isError}
          />
          <StatCard
            icon={UserMinus}
            title={t('admin:dashboard.inactiveUsers')}
            value={kpi?.inactiveUsers ?? 0}
            subtitle={t('admin:dashboard.inactiveUsersDesc')}
            iconBgColor="bg-[#71717A]/10"
            iconColor="text-[#71717A]"
            isLoading={isLoading} isError={isError}
          />
          <StatCard
            icon={FolderOpen}
            title={t('admin:dashboard.activeProjects')}
            value={kpi?.activeProjects ?? 0}
            subtitle={t('admin:dashboard.activeProjectsDesc')}
            iconBgColor="bg-emerald-100"
            iconColor="text-emerald-600"
            isLoading={isLoading} isError={isError}
          />
          <StatCard
            icon={Folder}
            title={t('admin:dashboard.totalProjects')}
            value={kpi?.totalProjects ?? 0}
            subtitle={t('admin:dashboard.totalProjectsDesc')}
            iconBgColor="bg-amber-100"
            iconColor="text-amber-600"
            isLoading={isLoading} isError={isError}
          />
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#D4D4D8] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[#0A0A0A]">{t('admin:dashboard.recentActivity')}</h3>
            <p className="text-xs text-[#71717A] mt-0.5">{t('admin:dashboard.recentActivityDesc')}</p>
          </div>
          {isOk && (
            <button onClick={() => onNavigate('audit')}
              className="flex items-center gap-1 text-xs font-medium text-[#F97316] hover:text-[#C2410C] transition-colors">
              {t('admin:dashboard.viewAllAuditLogs')} <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="p-6 space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-6 w-40 rounded-full" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {isEmpty && (
          <div className="flex flex-col items-center justify-center py-14">
            <div className="w-12 h-12 bg-[#FAFAFA] rounded-full flex items-center justify-center mb-3">
              <Activity className="w-6 h-6 text-[#D4D4D8]" />
            </div>
            <p className="text-sm font-medium text-[#0A0A0A]">{t('admin:dashboard.noActivityTitle')}</p>
            <p className="text-xs text-[#71717A] mt-1 text-center max-w-xs">
              {t('admin:dashboard.noActivityDesc')}
            </p>
          </div>
        )}

        {/* Data table */}
        {isOk && recentActivity.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#FAFAFA] border-b border-[#D4D4D8] hover:bg-[#FAFAFA]">
                  <TableHead className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider pl-6">{t('admin:dashboard.tableTimestamp')}</TableHead>
                  <TableHead className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider">{t('admin:dashboard.tableActor')}</TableHead>
                  <TableHead className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider">{t('admin:dashboard.tableAction')}</TableHead>
                  <TableHead className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider pr-6">{t('admin:dashboard.tableEntity')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentActivity.map(ev => (
                  <TableRow key={ev.id} className="border-b border-[#D4D4D8]/40 hover:bg-[#FAFAFA] transition-colors">
                    <TableCell className="pl-6 py-3.5">
                      <span className="font-mono text-xs text-[#71717A] whitespace-nowrap">{fmtDateTime(ev.occurredAt, i18n.language)}</span>
                    </TableCell>
                    <TableCell className="py-3.5">
                      <span className="font-mono text-sm font-medium text-[#0A0A0A]">{ev.actorUsername}</span>
                    </TableCell>
                    <TableCell className="py-3.5"><ActionBadge action={ev.action} /></TableCell>
                    <TableCell className="py-3.5 pr-6">
                      <span className="text-sm text-[#71717A]">{fmtEntity(ev)}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div>
        <p className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-4">{t('admin:dashboard.quickActions')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {QUICK_ACTIONS.map(item => (
            <button key={item.labelKey} onClick={() => onNavigate(item.nav)}
              className="bg-white rounded-xl border border-[#D4D4D8] p-5 flex items-center gap-4 hover:border-[#F97316] hover:shadow-sm transition-all text-left group">
              <div className={`w-10 h-10 ${item.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                <item.icon className={`w-5 h-5 ${item.color}`} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-[#0A0A0A] group-hover:text-[#F97316] transition-colors">
                  {t(item.labelKey)}
                </p>
                <p className="text-xs text-[#71717A] mt-0.5">{t(item.descKey)}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-[#D4D4D8] group-hover:text-[#F97316] transition-colors flex-shrink-0" />
            </button>
          ))}
        </div>
      </div>

      {/* System Overview */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('admin:dashboard.systemOverview')}</p>
            <p className="text-[10px] text-[#71717A] mt-0.5">{t('admin:dashboard.crossModuleMetrics')}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <StatCard icon={Users}   title={t('admin:dashboard.activeWorkersToday')} value={systemKpis?.activeWorkersToday ?? 0} subtitle={t('admin:dashboard.activeUsersDesc')}   iconBgColor="bg-emerald-50"   iconColor="text-emerald-600"  isLoading={isLoading} isError={isError} />
          <StatCard icon={Clock}   title={t('admin:dashboard.hoursThisWeek')}      value={`${systemKpis?.hoursThisWeek ?? 0}h`} subtitle={t('admin:dashboard.crossModuleMetrics')} iconBgColor="bg-[#F97316]/10" iconColor="text-[#F97316]"   isLoading={isLoading} isError={isError} />
          <StatCard icon={Receipt} title={t('admin:dashboard.pendingExpenses')}     value={systemKpis?.pendingExpenses ?? 0}    subtitle={t('admin:dashboard.pendingExpenses')}     iconBgColor="bg-amber-50"     iconColor="text-amber-600"   isLoading={isLoading} isError={isError} />
          <StatCard icon={Wallet}  title={t('admin:dashboard.budgetHealth')}        value={systemKpis?.budgetCriticalProjects ?? 0} subtitle={t('admin:dashboard.budgetHealth')}  iconBgColor="bg-red-50"       iconColor="text-red-600"     isLoading={isLoading} isError={isError} />
          <StatCard icon={Wrench}  title={t('admin:dashboard.toolsAssigned')}       value={systemKpis?.toolsAssigned ?? 0}      subtitle={t('admin:dashboard.toolsAssigned')}       iconBgColor="bg-amber-50"     iconColor="text-amber-600"   isLoading={isLoading} isError={isError} />
          <StatCard icon={Shield}  title={t('admin:dashboard.auditEventsToday')}    value={systemKpis?.auditEventsToday ?? 0}   subtitle={t('admin:dashboard.auditEventsToday')}    iconBgColor="bg-[#C2410C]/10" iconColor="text-[#C2410C]"   isLoading={isLoading} isError={isError} />
        </div>
      </div>

    </div>
  );
}