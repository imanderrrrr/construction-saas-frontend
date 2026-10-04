import { AppShell } from '../components/AppShell';
import { useSectionNavigation } from '../workspace/WorkspaceState';
import { useState, useEffect, lazy, Suspense } from 'react';
import { useMarkDashboardReady } from '../lib/dashboardReady';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AuthService } from '../services/auth';

import { LayoutDashboard, Wrench, ArrowLeftRight, History as HistoryIcon, CheckCircle, AlertTriangle, Package, Boxes, Loader2 } from 'lucide-react';

import { StatCard } from '../components/StatCard';
import { Toaster } from '../components/ui/sonner';
import { NotificationInbox } from '../components/notifications/NotificationInbox';
import { getDashboard, type DashboardResponse, type DashboardActivityEntry, type LowStockAlertEntry, type DashboardKpis } from '../services/warehouse';

// Lazy-loaded sections
const ToolInventory = lazy(() =>
  import('../components/ToolInventory').then(m => ({ default: m.ToolInventory }))
);
const ToolAssignment = lazy(() =>
  import('../components/ToolAssignment').then(m => ({ default: m.ToolAssignment }))
);
const ToolHistory = lazy(() =>
  import('../components/ToolHistory').then(m => ({ default: m.ToolHistory }))
);
const ConsumableInventory = lazy(() =>
  import('../components/ConsumableInventory').then(m => ({ default: m.ConsumableInventory }))
);
const ConsumableDispatch = lazy(() =>
  import('../components/ConsumableDispatch').then(m => ({ default: m.ConsumableDispatch }))
);

// Types

type ActiveSection = 'dashboard' | 'tool-inventory' | 'assignments' | 'tool-history' | 'consumables' | 'consumable-dispatch';

// Navigation config

const NAV_ITEMS: {
  key: ActiveSection;
  label: string;
  icon: React.ElementType;
  group: 'main' | 'inventory' | 'consumables';
}[] = [
  { key: 'dashboard',           label: 'warehouse.nav.dashboard',       icon: LayoutDashboard, group: 'main'        },
  { key: 'tool-inventory',      label: 'warehouse.nav.toolInventory',  icon: Wrench,          group: 'inventory'   },
  { key: 'assignments',         label: 'warehouse.nav.assignments',    icon: ArrowLeftRight,  group: 'inventory'   },
  { key: 'tool-history',        label: 'warehouse.nav.toolHistory',    icon: HistoryIcon,     group: 'inventory'   },
  { key: 'consumables',         label: 'warehouse.nav.consumableStock', icon: Boxes,          group: 'consumables' },
  { key: 'consumable-dispatch', label: 'warehouse.nav.dispatchSupply', icon: ArrowLeftRight,  group: 'consumables' },
];

const SECTION_META: Record<ActiveSection, { title: string; subtitle: string }> = {
  'dashboard':           { title: 'warehouse.nav.dashboard',        subtitle: 'warehouse.section.dashboard'        },
  'tool-inventory':      { title: 'warehouse.nav.toolInventory',    subtitle: 'warehouse.section.toolInventory'    },
  'assignments':         { title: 'warehouse.nav.assignments',      subtitle: 'warehouse.section.assignments'      },
  'tool-history':        { title: 'warehouse.nav.toolHistory',      subtitle: 'warehouse.section.toolHistory'      },
  'consumables':         { title: 'warehouse.nav.consumableStock',  subtitle: 'warehouse.section.consumableStock'  },
  'consumable-dispatch': { title: 'warehouse.nav.dispatchSupply',   subtitle: 'warehouse.section.dispatchSupply'   },
};

// Dashboard data loaded from API

function fmtDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function ActivityBadge({ action }: { action: string }) {
  const cfg: Record<string, string> = {
    Assigned:   'bg-[#F97316]/10 text-[#F97316] border-[#F97316]/20',
    Returned:   'bg-amber-50 text-amber-700 border-amber-200',
    Reported:   'bg-red-50 text-red-600 border-red-200',
    Registered: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };
  const cls = cfg[action] ?? 'bg-[#FAFAFA] text-[#71717A] border-[#D4D4D8]';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cls}`}>
      {action}
    </span>
  );
}

// Dashboard view

function DashboardView({ username, onNavigate }: { username: string; onNavigate: (s: string) => void }) {
  const { t } = useTranslation('inventory');
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState<DashboardActivityEntry[]>([]);
  const [lowStockAlerts, setLowStockAlerts] = useState<LowStockAlertEntry[]>([]);
  const [kpis, setKpis] = useState<DashboardKpis>({ totalTools: 0, availableTools: 0, assignedTools: 0, needsAttention: 0, consumableItems: 0, lowStockAlerts: 0 });

  useEffect(() => {
    getDashboard()
      .then(data => { setRecentActivity(data.recentActivity); setLowStockAlerts(data.lowStockAlerts); setKpis(data.kpis); })
      .catch(err => toast.error(err?.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Welcome */}
      <div>
        <h2 className="text-2xl font-bold text-[#0A0A0A]">{t('warehouse.welcome', { username })}</h2>
        <p className="text-sm text-[#71717A] mt-1">{t('warehouse.welcomeSubtitle')}</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard icon={Package}       title={t('warehouse.kpi.totalTools')}       value={kpis.totalTools}       subtitle={t('warehouse.kpi.inInventory')}     iconBgColor="bg-amber-50"     iconColor="text-amber-600"   />
        <StatCard icon={CheckCircle}   title={t('warehouse.kpi.available')}       value={kpis.availableTools}   subtitle={t('warehouse.kpi.readyToAssign')}  iconBgColor="bg-emerald-50"   iconColor="text-emerald-600" />
        <StatCard icon={ArrowLeftRight}title={t('warehouse.kpi.assigned')}        value={kpis.assignedTools}    subtitle={t('warehouse.kpi.outWithWorkers')} iconBgColor="bg-[#F97316]/10" iconColor="text-[#F97316]"   />
        <StatCard icon={AlertTriangle} title={t('warehouse.kpi.needsAttention')}  value={kpis.needsAttention}   subtitle={t('warehouse.kpi.damagedOrLost')}  iconBgColor="bg-red-50"       iconColor="text-red-600"     />
        <StatCard icon={Boxes}         title={t('warehouse.kpi.consumableItems')} value={kpis.consumableItems}  subtitle={t('warehouse.kpi.supplyTypes')}    iconBgColor="bg-purple-50"    iconColor="text-purple-600"  />
        <StatCard icon={AlertTriangle} title={t('warehouse.kpi.lowStockAlerts')}  value={kpis.lowStockAlerts}   subtitle={t('warehouse.kpi.needRestocking')} iconBgColor="bg-red-50"       iconColor="text-red-600"     />
      </div>

      {/* Buzón — the panel is sectioned, so the inbox goes on the landing
          section and only there: it is what the warehouse keeper sees first,
          and repeating it inside an inventory section would poll twice for
          the same rows. Same slot as the other two panels: under the KPIs,
          above the activity table. */}
      <NotificationInbox role="WAREHOUSE" />

      {/* Recent activity */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#D4D4D8]">
          <div className="flex items-center gap-2">
            <HistoryIcon className="w-4 h-4 text-[#71717A]" />
            <span className="text-sm font-semibold text-[#0A0A0A]">{t('warehouse.recentActivity')}</span>
            <span className="text-xs text-[#71717A]">{t('warehouse.last', { count: recentActivity.length })}</span>
          </div>
          <button onClick={() => onNavigate('tool-history')}
            className="text-xs font-medium text-amber-600 hover:text-amber-800 transition-colors">
            {t('warehouse.viewAll')}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[#FAFAFA]">
                {[t('warehouse.tableHeaders.date'), t('warehouse.tableHeaders.tool'), t('warehouse.tableHeaders.action'), t('warehouse.tableHeaders.worker'), t('warehouse.tableHeaders.notes')].map(h => (
                  <th key={h} className="text-left text-[11px] font-semibold text-[#71717A] uppercase tracking-wider px-4 py-2.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentActivity.map(r => (
                <tr key={r.id} className="border-t border-[#D4D4D8]/50 hover:bg-[#FAFAFA]/50 transition-colors">
                  <td className="px-4 py-3 text-sm text-[#0A0A0A] whitespace-nowrap">{fmtDate(r.date)}</td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-[#0A0A0A]">{r.tool}</p>
                    <p className="text-[11px] text-[#71717A] font-mono">{r.code}</p>
                  </td>
                  <td className="px-4 py-3"><ActivityBadge action={r.action} /></td>
                  <td className="px-4 py-3 text-sm text-[#71717A]">{r.worker || '—'}</td>
                  <td className="px-4 py-3 text-sm text-[#71717A]">{r.notes || '—'}</td>
                </tr>
              ))}
              {recentActivity.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-[#71717A]">{t('warehouse.noRecentActivity')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Low stock alerts */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#D4D4D8]">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-sm font-semibold text-[#0A0A0A]">{t('warehouse.lowStockAlerts')}</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">{lowStockAlerts.length}</span>
          </div>
          <button onClick={() => onNavigate('consumables')}
            className="text-xs font-medium text-amber-600 hover:text-amber-800 transition-colors">
            {t('warehouse.manageStock')}
          </button>
        </div>
        <div className="divide-y divide-[#D4D4D8]/50">
          {lowStockAlerts.map(item => (
            <div key={item.code} className="flex items-center justify-between px-6 py-3 hover:bg-[#FAFAFA]/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${item.stock === 0 ? 'bg-red-500' : 'bg-amber-500'}`} />
                <div>
                  <p className="text-sm font-medium text-[#0A0A0A]">{item.name}</p>
                  <p className="text-[11px] text-[#71717A] font-mono">{item.code}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-sm font-semibold ${item.stock === 0 ? 'text-red-600' : 'text-amber-600'}`}>
                  {item.stock} {item.unit}
                </p>
                <p className="text-[11px] text-[#71717A]">{t('warehouse.min', { value: item.min })}</p>
              </div>
            </div>
          ))}
          {lowStockAlerts.length === 0 && (
            <div className="px-6 py-8 text-center text-sm text-[#71717A]">{t('warehouse.allStockHealthy')}</div>
          )}
        </div>
      </div>

      {/* Quick access */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button onClick={() => onNavigate('tool-inventory')}
          className="bg-white rounded-xl border border-[#D4D4D8] p-5 text-left hover:border-amber-400 hover:shadow-sm transition-all group">
          <div className="w-9 h-9 bg-amber-50 rounded-lg flex items-center justify-center mb-3">
            <Wrench className="text-amber-600" style={{ width: 18, height: 18 }} />
          </div>
          <p className="text-sm font-semibold text-[#0A0A0A] mb-0.5 group-hover:text-amber-600 transition-colors">{t('warehouse.quickAccess.toolInventory.title')}</p>
          <p className="text-xs text-[#71717A]">{t('warehouse.quickAccess.toolInventory.subtitle')}</p>
        </button>
        <button onClick={() => onNavigate('assignments')}
          className="bg-white rounded-xl border border-[#D4D4D8] p-5 text-left hover:border-amber-400 hover:shadow-sm transition-all group">
          <div className="w-9 h-9 bg-amber-50 rounded-lg flex items-center justify-center mb-3">
            <ArrowLeftRight className="text-amber-600" style={{ width: 18, height: 18 }} />
          </div>
          <p className="text-sm font-semibold text-[#0A0A0A] mb-0.5 group-hover:text-amber-600 transition-colors">{t('warehouse.quickAccess.assignments.title')}</p>
          <p className="text-xs text-[#71717A]">{t('warehouse.quickAccess.assignments.subtitle')}</p>
        </button>
        <button onClick={() => onNavigate('consumables')}
          className="bg-white rounded-xl border border-[#D4D4D8] p-5 text-left hover:border-amber-400 hover:shadow-sm transition-all group">
          <div className="w-9 h-9 bg-purple-50 rounded-lg flex items-center justify-center mb-3">
            <Boxes className="text-purple-600" style={{ width: 18, height: 18 }} />
          </div>
          <p className="text-sm font-semibold text-[#0A0A0A] mb-0.5 group-hover:text-amber-600 transition-colors">{t('warehouse.quickAccess.consumableStock.title')}</p>
          <p className="text-xs text-[#71717A]">{t('warehouse.quickAccess.consumableStock.subtitle')}</p>
        </button>
        <button onClick={() => onNavigate('consumable-dispatch')}
          className="bg-white rounded-xl border border-[#D4D4D8] p-5 text-left hover:border-amber-400 hover:shadow-sm transition-all group">
          <div className="w-9 h-9 bg-emerald-50 rounded-lg flex items-center justify-center mb-3">
            <ArrowLeftRight className="text-emerald-600" style={{ width: 18, height: 18 }} />
          </div>
          <p className="text-sm font-semibold text-[#0A0A0A] mb-0.5 group-hover:text-amber-600 transition-colors">{t('warehouse.quickAccess.dispatchSupply.title')}</p>
          <p className="text-xs text-[#71717A]">{t('warehouse.quickAccess.dispatchSupply.subtitle')}</p>
        </button>
      </div>
    </div>
  );
}

// Main component

export function WarehouseDashboard({ initialSection = 'dashboard' }: { initialSection?: ActiveSection } = {}) {
  useMarkDashboardReady();
  const navigate = useNavigate();
  const { t } = useTranslation(['inventory', 'common']);
  const username = AuthService.getUsername() ?? 'warehouse';
  const [activeSection, handleNavigate] = useSectionNavigation('WAREHOUSE', initialSection);
  const handleLogout = () => { document.cookie = 'ofjr_session=; Path=/; Max-Age=0'; navigate('/'); void AuthService.logout(); };
  const navItems = NAV_ITEMS.map(item => ({ ...item, label: item.key === 'dashboard' ? t('common:workspace.home') : t(item.label),
    group: item.key === 'dashboard' ? undefined : item.key === 'tool-history' ? 'movements' : item.group }));
  const navGroups = [
    { key: 'inventory', label: t('common:workspace.tools'), icon: Wrench },
    { key: 'consumables', label: t('common:workspace.materials'), icon: Boxes },
    { key: 'movements', label: t('common:workspace.movements'), icon: HistoryIcon },
  ];
  return <>
    <AppShell role="WAREHOUSE" username={username} panelLabel={t('common:roles.WAREHOUSE')}
      navItems={navItems} navGroups={navGroups} activeSection={activeSection} onNavigate={handleNavigate} onLogout={handleLogout}
      pageTitle={t(SECTION_META[activeSection].title)}>
          {activeSection === 'dashboard' && (
            <DashboardView username={username} onNavigate={handleNavigate} />
          )}
          {activeSection === 'tool-inventory' && (
            <Suspense fallback={<div className="animate-pulse h-64 bg-white rounded-xl border border-[#D4D4D8]" />}>
              <ToolInventory onNavigate={handleNavigate} />
            </Suspense>
          )}
          {activeSection === 'assignments' && (
            <Suspense fallback={<div className="animate-pulse h-64 bg-white rounded-xl border border-[#D4D4D8]" />}>
              <ToolAssignment />
            </Suspense>
          )}
          {activeSection === 'tool-history' && (
            <Suspense fallback={<div className="animate-pulse h-64 bg-white rounded-xl border border-[#D4D4D8]" />}>
              <ToolHistory />
            </Suspense>
          )}
          {activeSection === 'consumables' && (
            <Suspense fallback={<div className="animate-pulse h-64 bg-white rounded-xl border border-[#D4D4D8]" />}>
              <ConsumableInventory onNavigate={handleNavigate} />
            </Suspense>
          )}
          {activeSection === 'consumable-dispatch' && (
            <Suspense fallback={<div className="animate-pulse h-64 bg-white rounded-xl border border-[#D4D4D8]" />}>
              <ConsumableDispatch />
            </Suspense>
          )}
    </AppShell><Toaster position="top-right" richColors />
  </>;
}
