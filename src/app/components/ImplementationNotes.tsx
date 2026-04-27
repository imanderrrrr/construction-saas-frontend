import React, { useState } from 'react';
import {
  FileText, Map, Layers, Database, CheckSquare,
  ChevronRight, User, FolderOpen, Clock, Shield,
  LogIn, Utensils, LogOut, Check, AlertCircle,
} from 'lucide-react';
import { ROLE_NAV_MAP, CanonicalRole, TIME_EVENT_SEQUENCE } from '../types';

// Types

type NoteTab = 'routes' | 'states' | 'components' | 'contracts' | 'checklist';

const TABS: { key: NoteTab; label: string; icon: React.ElementType }[] = [
  { key: 'routes',     label: 'Route map',    icon: Map          },
  { key: 'states',     label: 'UI states',    icon: Layers       },
  { key: 'components', label: 'Components',   icon: FileText     },
  { key: 'contracts',  label: 'Data contracts', icon: Database   },
  { key: 'checklist',  label: 'Checklist',    icon: CheckSquare  },
];

const ROLE_COLORS: Record<CanonicalRole, string> = {
  ADMIN:      'bg-[#C2410C]/10 text-[#C2410C] border-[#C2410C]/20',
  SUPERVISOR: 'bg-[#F97316]/10 text-[#F97316] border-[#F97316]/20',
  WORKER:     'bg-emerald-50 text-emerald-700 border-emerald-200',
  FINANCE:    'bg-purple-50 text-purple-700 border-purple-200',
  WAREHOUSE:      'bg-amber-50 text-amber-700 border-amber-200',
  SUBCONTRACTOR:  'bg-orange-50 text-orange-700 border-orange-200',
};

function RolePill({ role }: { role: CanonicalRole }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono border ${ROLE_COLORS[role]}`}>
      {role}
    </span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider mb-3 pb-2 border-b border-[#D4D4D8]">{children}</h3>;
}

function Tag({ children, color = 'gray' }: { children: React.ReactNode; color?: 'blue' | 'green' | 'gray' | 'amber' | 'red' }) {
  const cls = {
    blue:  'bg-[#F97316]/10 text-[#F97316]',
    green: 'bg-emerald-50 text-emerald-700',
    gray:  'bg-[#FAFAFA] text-[#71717A]',
    amber: 'bg-amber-50 text-amber-700',
    red:   'bg-red-50 text-red-700',
  }[color];
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold font-mono ${cls}`}>{children}</span>;
}

// Tab: Route map

function RoutesTab() {
  const roles: CanonicalRole[] = ['ADMIN','SUPERVISOR','WORKER','FINANCE','WAREHOUSE'];
  return (
    <div className="space-y-6">
      {roles.map(role => (
        <div key={role} className="bg-white border border-[#D4D4D8] rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[#D4D4D8] bg-[#FAFAFA]/50 flex items-center gap-2">
            <RolePill role={role} />
            <span className="text-xs text-[#71717A]">navigation</span>
          </div>
          <div className="divide-y divide-[#FAFAFA]">
            {ROLE_NAV_MAP[role].map(item => (
              <div key={item.key} className="flex items-center justify-between px-5 py-3 gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="font-mono text-xs text-[#0A0A0A] truncate">{item.route}</span>
                  {item.comingSoon && <Tag color="gray">SOON</Tag>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-[#71717A]">{item.label}</span>
                  <Tag color={item.phase === 2 ? 'blue' : 'green'}>Phase {item.phase}</Tag>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Tab: UI states

function StatesTab() {
  const screens = [
    {
      screen: '/worker/time',
      role: 'WORKER' as CanonicalRole,
      states: ['loading — fetching today\'s punches', 'idle — no punches yet', 'in-progress — ≥1 punches recorded', 'complete — all 4 punches done', 'confirming — punch confirmation modal open', 'submitting — API call in flight', 'success — punch saved (banner, 2.5s)', 'error — punch failed (retry banner)'],
      extra: 'Location states: detecting | OK | NO_PERMISSION | UNAVAILABLE | OUT_OF_RANGE',
    },
    {
      screen: '/supervisor/time-approvals (list)',
      role: 'SUPERVISOR' as CanonicalRole,
      states: ['loading — skeleton rows', 'empty — no pending records', 'error — API failed + Retry', 'data — table/cards with filters'],
    },
    {
      screen: '/supervisor/time-approvals (detail)',
      role: 'SUPERVISOR' as CanonicalRole,
      states: ['loading — skeleton timeline', 'idle — timeline + action buttons (if PENDING)', 'action loading — approve/correct/reject spinner', 'success — toast + return to list', 'error — toast (retry from list)'],
    },
    {
      screen: '/admin/time-approvals',
      role: 'ADMIN' as CanonicalRole,
      states: ['Same as supervisor list+detail, with extra role filter'],
    },
    {
      screen: '/admin/dashboard',
      role: 'ADMIN' as CanonicalRole,
      states: ['loading — skeleton KPI cards + activity', 'empty — no activity', 'error — alert + Retry', 'data — KPIs + recent audit + quick actions'],
    },
  ];

  return (
    <div className="space-y-4">
      {screens.map(s => (
        <div key={s.screen} className="bg-white border border-[#D4D4D8] rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[#D4D4D8] bg-[#FAFAFA]/50 flex items-center gap-2">
            <RolePill role={s.role} />
            <span className="font-mono text-xs text-[#0A0A0A]">{s.screen}</span>
          </div>
          <ul className="p-4 space-y-1.5">
            {s.states.map((state, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-[#0A0A0A]">
                <ChevronRight className="w-3 h-3 text-[#71717A] flex-shrink-0 mt-0.5" />
                <code className="text-[11px] text-[#71717A]">{state}</code>
              </li>
            ))}
            {s.extra && (
              <li className="flex items-start gap-2 text-xs mt-2 pt-2 border-t border-[#FAFAFA]">
                <AlertCircle className="w-3 h-3 text-amber-500 flex-shrink-0 mt-0.5" />
                <code className="text-[11px] text-amber-700">{s.extra}</code>
              </li>
            )}
          </ul>
        </div>
      ))}
    </div>
  );
}

// Tab: Components

function ComponentsTab() {
  const components = [
    {
      name: 'TimePunchButton',
      path: 'components/phase2/TimePunchButton.tsx',
      props: 'type: TimeEventType | state: PunchState | capturedAt?: string | onClick?: () => void',
      states: 'done · next (pulsing ring) · loading · upcoming',
      usedIn: ['/worker/time'],
    },
    {
      name: 'ApprovalStatusBadge',
      path: 'components/phase2/ApprovalStatusBadge.tsx',
      props: 'status: ApprovalStatus | size?: sm | md',
      states: 'PENDING · APPROVED · OBSERVED · REJECTED',
      usedIn: ['/supervisor/time-approvals', '/admin/time-approvals'],
    },
    {
      name: 'LocationIndicator',
      path: 'components/phase2/LocationIndicator.tsx',
      props: 'status: LocationStatus | detecting | coords?: {lat,lng} | onRequestPermission?',
      states: 'detecting · OK · NO_PERMISSION · UNAVAILABLE · OUT_OF_RANGE',
      usedIn: ['/worker/time'],
    },
    {
      name: 'TimelineItem / TimelineItemMissing',
      path: 'components/phase2/TimelineItem.tsx',
      props: 'event: TimeEvent | isLast?: boolean',
      states: 'recorded (with location chip) · missing (dashed placeholder)',
      usedIn: ['/supervisor/time-approvals (detail)'],
    },
    {
      name: 'ModalCorrect',
      path: 'components/phase2/ModalCorrect.tsx',
      props: 'open | action: correct|reject | workerName | projectName | date | onClose | onSubmit',
      states: 'idle · loading · error (inline)',
      usedIn: ['/supervisor/time-approvals (detail)', '/admin/time-approvals (detail)'],
    },
    {
      name: 'AppShell',
      path: 'components/AppShell.tsx',
      props: 'role | username | navItems | activeSection | onNavigate | onLogout | pageTitle | children',
      states: 'desktop sidebar · mobile hamburger overlay',
      usedIn: ['WorkerDashboard', 'SupervisorDashboard'],
    },
    {
      name: 'StatCard',
      path: 'components/StatCard.tsx',
      props: 'icon | title | value | subtitle | iconBgColor | iconColor | isLoading | isError | trend?',
      states: 'data · loading skeleton · error',
      usedIn: ['/admin/dashboard'],
    },
    {
      name: 'EmptyState',
      path: 'components/EmptyState.tsx',
      props: 'icon | title | description? | action?',
      states: 'static — renders always',
      usedIn: ['All list screens'],
    },
  ];

  return (
    <div className="space-y-4">
      {components.map(c => (
        <div key={c.name} className="bg-white border border-[#D4D4D8] rounded-xl p-5">
          <div className="flex items-start justify-between gap-3 mb-2">
            <p className="text-sm font-semibold font-mono text-[#0A0A0A]">{c.name}</p>
            <span className="text-[10px] font-mono text-[#71717A] shrink-0">{c.path}</span>
          </div>
          <p className="text-[11px] text-[#71717A] font-mono mb-2 leading-relaxed">{c.props}</p>
          <div className="flex flex-wrap gap-2">
            <Tag color="blue">States: {c.states}</Tag>
          </div>
          <p className="text-[10px] text-[#71717A] mt-2">Used in: {c.usedIn.join(' · ')}</p>
        </div>
      ))}
    </div>
  );
}

// Tab: Data contracts

function ContractsTab() {
  const contracts = [
    {
      name: 'CanonicalRole',
      type: 'union',
      source: 'types/index.ts',
      values: ["'ADMIN'", "'SUPERVISOR'", "'WORKER'", "'FINANCE'", "'WAREHOUSE'"],
      note: 'Source of truth. Backend: UserEntity.role / LoginResponse.role',
    },
    {
      name: 'TimeEventType',
      type: 'union',
      source: 'types/index.ts',
      values: ["'CHECK_IN'", "'LUNCH_START'", "'LUNCH_END'", "'CHECK_OUT'"],
      note: 'Strict order: CHECK_IN → LUNCH_START → LUNCH_END → CHECK_OUT',
    },
    {
      name: 'ApprovalStatus',
      type: 'union',
      source: 'types/index.ts',
      values: ["'PENDING'", "'APPROVED'", "'OBSERVED'", "'REJECTED'"],
      note: 'Backend: TimeRecordEntity.approvalStatus',
    },
    {
      name: 'LocationStatus',
      type: 'union',
      source: 'types/index.ts',
      values: ["'OK'", "'NO_PERMISSION'", "'UNAVAILABLE'", "'OUT_OF_RANGE'"],
      note: 'Captured per punch. Backend: TimeEventEntity.locationStatus',
    },
    {
      name: 'TimeEvent',
      type: 'interface',
      source: 'types/index.ts',
      values: ['id: number', 'type: TimeEventType', 'capturedAt: string (ISO 8601)', 'locationStatus: LocationStatus'],
      note: 'Single punch. Backend: TimeEventEntity',
    },
    {
      name: 'TimeRecord',
      type: 'interface',
      source: 'types/index.ts',
      values: ['id: number', 'worker: UserRef', 'project: ProjectRef', 'date: string (YYYY-MM-DD)', 'events: TimeEvent[]', 'approvalStatus: ApprovalStatus', 'review: Review | null'],
      note: 'One worker\'s full day on a project. Backend: TimeRecordEntity',
    },
    {
      name: 'Review',
      type: 'interface',
      source: 'types/index.ts',
      values: ['reviewerName: string', 'reviewedAt: string (ISO 8601)', 'comment: string | null'],
      note: 'comment required when status is OBSERVED or REJECTED',
    },
  ];

  return (
    <div className="space-y-4">
      {contracts.map(c => (
        <div key={c.name} className="bg-white border border-[#D4D4D8] rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[#D4D4D8] bg-[#FAFAFA]/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-semibold text-[#0A0A0A]">{c.name}</span>
              <Tag color={c.type === 'union' ? 'blue' : 'green'}>{c.type}</Tag>
            </div>
            <span className="text-[10px] font-mono text-[#71717A]">{c.source}</span>
          </div>
          <div className="px-5 py-3">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {c.values.map(v => (
                <span key={v} className="font-mono text-[11px] px-2 py-0.5 bg-[#0A0A0A] text-emerald-300 rounded">{v}</span>
              ))}
            </div>
            <p className="text-xs text-[#71717A]">{c.note}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// Tab: Checklist

function ChecklistTab() {
  const items = [
    { done: true,  text: 'No "manager/user/admin" lowercase roles — only canonical ADMIN | SUPERVISOR | WORKER | FINANCE | WAREHOUSE' },
    { done: true,  text: 'Canonical roles defined in types/index.ts as source of truth' },
    { done: true,  text: 'AuthService updated to map all mock users to CanonicalRole' },
    { done: true,  text: 'getDashboardRoute uses ROLE_DASHBOARD_ROUTES from types/index.ts' },
    { done: true,  text: 'Routes.tsx updated with canonical paths for all roles' },
    { done: true,  text: 'AppShell supports all 5 roles with SOON badges for Phase 2 coming soon items' },
    { done: true,  text: 'Worker /worker/time — complete punch UI with all 4 events + confirmation modal' },
    { done: true,  text: 'Worker location states — detecting | OK | NO_PERMISSION | UNAVAILABLE | OUT_OF_RANGE' },
    { done: true,  text: 'Worker day states — fresh | checked_in | at_lunch | back_from_lunch | complete' },
    { done: true,  text: 'Supervisor /supervisor/time-approvals list — filters, desktop table, mobile cards, all 4 list states' },
    { done: true,  text: 'Supervisor approvals detail — timeline, approve/correct/reject, location chips' },
    { done: true,  text: 'ModalCorrect — required comment, min 10 chars, correct + reject variants' },
    { done: true,  text: 'Admin /admin/time-approvals — same as supervisor with showAdminFilters prop' },
    { done: true,  text: 'TimePunchButton — 4 states (done/next/loading/upcoming) with pulse ring' },
    { done: true,  text: 'ApprovalStatusBadge — PENDING/APPROVED/OBSERVED/REJECTED with dot indicator' },
    { done: true,  text: 'LocationIndicator — all 5 states including permission CTA' },
    { done: true,  text: 'TimelineItem + TimelineItemMissing — event type + location chip + context note' },
    { done: true,  text: 'All screens have loading / empty / error / success / data states' },
    { done: true,  text: 'All screens have Desktop (1440px) and Mobile (390px) preview switcher' },
    { done: true,  text: 'Preview toolbar on every screen for design QA' },
    { done: true,  text: 'Implementation Notes page created (/admin/design-system → Implementation Notes tab)' },
    { done: false, text: '[Phase 2 backend] Connect WorkerTime punch buttons to POST /time-events' },
    { done: false, text: '[Phase 2 backend] Connect SupervisorApprovals to GET /time-records + POST /approve|correct|reject' },
    { done: false, text: '[Phase 2 backend] Implement real GPS geofencing in LocationIndicator' },
    { done: false, text: '[Future] FINANCE dashboard + expenses/budgets screens' },
    { done: false, text: '[Future] WAREHOUSE dashboard + inventory screens' },
    { done: false, text: '[Future] SUPERVISOR projects screen' },
  ];

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${item.done ? 'bg-emerald-50/50 border-emerald-100' : 'bg-[#FAFAFA] border-[#D4D4D8]'}`}>
          <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 ${item.done ? 'bg-emerald-100' : 'bg-[#D4D4D8]/50'}`}>
            {item.done
              ? <Check className="w-3 h-3 text-emerald-700" />
              : <div className="w-2 h-2 rounded-full bg-[#D4D4D8]" />}
          </div>
          <p className={`text-xs leading-relaxed ${item.done ? 'text-emerald-800' : 'text-[#71717A]'}`}>
            {item.text}
          </p>
        </div>
      ))}
      <p className="text-[10px] text-[#71717A] text-right pt-2">
        {items.filter(i => i.done).length}/{items.length} complete
      </p>
    </div>
  );
}

// Main

export function ImplementationNotes() {
  const [activeTab, setActiveTab] = useState<NoteTab>('routes');

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 bg-[#F97316]/10 rounded-lg flex items-center justify-center">
              <FileText className="w-4 h-4 text-[#F97316]" />
            </div>
            <span className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">Dev documentation</span>
          </div>
          <h2 className="text-2xl font-bold text-[#0A0A0A]">Implementation Notes</h2>
          <p className="text-sm text-[#71717A] mt-1">
            Single source of truth for routes, data contracts, component API and UI states. Phase 1 + 2.
          </p>
        </div>
        <span className="text-[10px] font-semibold px-2.5 py-1 bg-[#0A0A0A] text-white rounded-full shrink-0">
          Phase 1 + 2
        </span>
      </div>

      {/* Tab nav */}
      <div className="flex items-center gap-1 p-1 bg-white border border-[#D4D4D8] rounded-xl shadow-sm w-fit flex-wrap">
        {TABS.map(tab => (
          <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.key ? 'bg-[#F97316] text-white shadow-sm' : 'text-[#71717A] hover:text-[#0A0A0A] hover:bg-[#FAFAFA]'}`}>
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div>
        {activeTab === 'routes'     && <RoutesTab />}
        {activeTab === 'states'     && <StatesTab />}
        {activeTab === 'components' && <ComponentsTab />}
        {activeTab === 'contracts'  && <ContractsTab />}
        {activeTab === 'checklist'  && <ChecklistTab />}
      </div>
    </div>
  );
}
