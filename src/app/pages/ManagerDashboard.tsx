// ManagerDashboard.tsx — Supervisor Panel — Prompt 14 full rewrite
// Sidebar with 6 sections, all functional with mock data. Zero "SOON" labels.

import { useState, useRef, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router';
import { AuthService } from '../services/auth';
import { Button } from '../components/ui/button';
import {
  Building2, LayoutDashboard, FolderKanban, ClipboardCheck,
  ReceiptText, Wallet, Wrench, LogOut, User, Menu, X,
  Clock, Receipt, Users, Bell, Activity, AlertTriangle,
  CheckCircle, Info, TrendingUp, MoreHorizontal,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Toaster } from '../components/ui/sonner';
import { toast } from 'sonner';

// Lazy external component

const SupervisorProjects = lazy(() =>
  import('../components/SupervisorProjects').then(m => ({ default: m.SupervisorProjects }))
);

// Types

type ActiveSection =
  | 'dashboard' | 'projects'
  | 'time-approvals' | 'expense-reviews'
  | 'budget-overview' | 'team-tools';

// Navigation groups

const NAV_GROUPS = [
  {
    label: 'General',
    items: [
      { key: 'dashboard' as ActiveSection, label: 'Dashboard', icon: LayoutDashboard },
      { key: 'projects' as ActiveSection, label: 'My Projects', icon: FolderKanban },
    ],
  },
  {
    label: 'Time Management',
    items: [
      { key: 'time-approvals' as ActiveSection, label: 'Time Approvals', icon: ClipboardCheck },
    ],
  },
  {
    label: 'Expenses',
    items: [
      { key: 'expense-reviews' as ActiveSection, label: 'Expense Reviews', icon: ReceiptText },
    ],
  },
  {
    label: 'Budgets',
    items: [
      { key: 'budget-overview' as ActiveSection, label: 'Budget Overview', icon: Wallet },
    ],
  },
  {
    label: 'Tools',
    items: [
      { key: 'team-tools' as ActiveSection, label: 'Team Tools', icon: Wrench },
    ],
  },
];

const SECTION_META: Record<ActiveSection, { title: string; subtitle: string }> = {
  'dashboard':       { title: 'Dashboard',       subtitle: 'Operational overview of your projects'  },
  'projects':        { title: 'My Projects',     subtitle: 'View your assigned projects and team details' },
  'time-approvals':  { title: 'Time Approvals',  subtitle: 'Review and approve team time entries'   },
  'expense-reviews': { title: 'Expense Reviews', subtitle: 'Review and approve team expenses'       },
  'budget-overview': { title: 'Budget Overview', subtitle: 'Monitor project budgets and spending'    },
  'team-tools':      { title: 'Team Tools',      subtitle: 'Manage tools assigned to your team'     },
};

// Helpers

function budgetBarColor(pct: number) {
  if (pct > 90) return 'bg-[#d4183d]';
  if (pct >= 70) return 'bg-amber-500';
  return 'bg-emerald-500';
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function fmtCurrency(n: number) {
  return '$' + n.toLocaleString('en-US');
}

// Spinner

function SectionSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 border-2 border-[#F97316] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// A.1  SupervisorDashboardContent

function SupervisorDashboardContent({ username, onNavigate }: { username: string; onNavigate: (s: string) => void }) {

  const overviewProjects = [
    { name: 'Downtown Office Tower',    status: 'Active',    pct: 38, spent: '$45,200',  total: '$120,000', members: 8  },
    { name: 'Harbor Bridge Repair',     status: 'Active',    pct: 38, spent: '$28,500',  total: '$75,000',  members: 5  },
    { name: 'Residential Complex Ph.2', status: 'Active',    pct: 85, spent: '$102,000', total: '$120,000', members: 4  },
    { name: 'School Renovation',        status: 'Completed', pct: 96, spent: '$57,600',  total: '$60,000',  members: 1  },
  ];

  const alerts = [
    { type: 'error',   text: 'Residential Complex Ph.2 budget at 85%',    time: '1h ago'     },
    { type: 'warning', text: '3 time entries pending over 24h',            time: '2h ago'     },
    { type: 'warning', text: 'Expense $890 awaiting review (J. Martinez)', time: 'Today'      },
    { type: 'info',    text: 'Harbor Bridge: 2 new team members assigned', time: 'Yesterday'  },
    { type: 'success', text: 'School Renovation marked as completed',      time: '2 days ago' },
  ];

  const recentActivity = [
    { ini: 'CR', name: 'Carlos R.',  action: 'Clocked in',               project: 'Downtown Office Tower', time: '8:02 AM'           },
    { ini: 'ML', name: 'Maria L.',   action: 'Submitted expense ($245)', project: 'Harbor Bridge Repair',  time: '7:45 AM'           },
    { ini: 'PS', name: 'Pedro S.',   action: 'Clocked in',               project: 'Residential Complex',   time: '7:38 AM'           },
    { ini: 'AG', name: 'Ana G.',     action: 'Uploaded receipt',          project: 'Downtown Office Tower', time: 'Yesterday 5:30 PM' },
    { ini: 'LM', name: 'Luis M.',    action: 'Clocked out',              project: 'Harbor Bridge Repair',  time: 'Yesterday 5:15 PM' },
    { ini: 'JF', name: 'Jorge F.',   action: 'Registered 8.5 hrs',       project: 'Downtown Office Tower', time: 'Yesterday 5:00 PM' },
    { ini: 'CR', name: 'Carlos R.',  action: 'Submitted expense ($120)', project: 'Residential Complex',   time: 'Yesterday 4:45 PM' },
    { ini: 'ML', name: 'Maria L.',   action: 'Clocked out',              project: 'Downtown Office Tower', time: 'Yesterday 4:30 PM' },
  ];

  function AlertIcon({ type }: { type: string }) {
    if (type === 'error')   return <div className="bg-red-50 rounded-full p-1.5 flex-shrink-0"><AlertTriangle className="w-4 h-4 text-[#d4183d]" /></div>;
    if (type === 'warning') return <div className="bg-amber-50 rounded-full p-1.5 flex-shrink-0"><AlertTriangle className="w-4 h-4 text-amber-600" /></div>;
    if (type === 'info')    return <div className="bg-blue-50 rounded-full p-1.5 flex-shrink-0"><Info className="w-4 h-4 text-[#F97316]" /></div>;
    return <div className="bg-emerald-50 rounded-full p-1.5 flex-shrink-0"><CheckCircle className="w-4 h-4 text-emerald-600" /></div>;
  }

  function StatusBadge({ status }: { status: string }) {
    if (status === 'Active') return <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-700">Active</span>;
    return <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600">Completed</span>;
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Welcome */}
      <div>
        <h2 className="text-2xl font-bold text-[#0A0A0A]">Welcome back, {username}!</h2>
        <p className="text-sm text-[#71717A] mt-1">Here's your operational overview for today.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Assigned Projects */}
        <div className="rounded-xl border border-[#D4D4D8] bg-white p-5 relative">
          <div className="w-10 h-10 bg-[#F97316]/10 rounded-lg flex items-center justify-center mb-3">
            <FolderKanban className="w-5 h-5 text-[#F97316]" />
          </div>
          <p className="text-2xl font-bold text-[#0A0A0A]">4</p>
          <p className="text-sm text-[#71717A]">Assigned Projects</p>
          <p className="text-xs text-[#71717A] mt-1">3 active · 1 completed</p>
        </div>
        {/* Pending Approvals */}
        <div className="rounded-xl border border-[#D4D4D8] bg-white p-5 relative">
          <span className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-amber-500" />
          <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center mb-3">
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-[#0A0A0A]">12</p>
          <p className="text-sm text-[#71717A]">Pending Approvals</p>
          <p className="text-xs text-[#71717A] mt-1">6 from today</p>
        </div>
        {/* Expense Reviews */}
        <div className="rounded-xl border border-[#D4D4D8] bg-white p-5 relative">
          <span className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-orange-500" />
          <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center mb-3">
            <Receipt className="w-5 h-5 text-orange-600" />
          </div>
          <p className="text-2xl font-bold text-[#0A0A0A]">5</p>
          <p className="text-sm text-[#71717A]">Expense Reviews</p>
          <p className="text-xs text-[#71717A] mt-1">$2,340.00 pending</p>
        </div>
        {/* Team Members */}
        <div className="rounded-xl border border-[#D4D4D8] bg-white p-5 relative">
          <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center mb-3">
            <Users className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-[#0A0A0A]">18</p>
          <p className="text-sm text-[#71717A]">Team Members</p>
          <p className="text-xs text-[#71717A] mt-1">15 active today</p>
        </div>
      </div>

      {/* Projects Overview + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Projects Overview */}
        <div className="lg:col-span-3 rounded-xl border border-[#D4D4D8] bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#F97316]" />
              <h3 className="text-base font-semibold text-[#0A0A0A]">Projects Overview</h3>
            </div>
            <span className="text-xs bg-[#F97316]/10 text-[#F97316] px-2 py-0.5 rounded-full font-medium">4 projects</span>
          </div>
          {overviewProjects.map(proj => (
            <div key={proj.name} className="py-3 border-b border-[#D4D4D8]/50 last:border-b-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-[#0A0A0A]">{proj.name}</span>
                <StatusBadge status={proj.status} />
              </div>
              <div className="h-1.5 rounded-full bg-[#FAFAFA] mt-2">
                <div className={`h-full rounded-full ${budgetBarColor(proj.pct)}`} style={{ width: `${proj.pct}%` }} />
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-xs text-[#71717A]">{proj.spent} / {proj.total} ({proj.pct}%)</span>
                <span className="text-xs text-[#71717A]">{proj.members} members</span>
              </div>
            </div>
          ))}
          <button onClick={() => onNavigate('projects')} className="text-sm text-[#F97316] hover:underline font-medium mt-3">
            View all projects &rarr;
          </button>
        </div>

        {/* Alerts & Notifications */}
        <div className="lg:col-span-2 rounded-xl border border-[#D4D4D8] bg-white p-6">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-5 h-5 text-[#F97316]" />
            <h3 className="text-base font-semibold text-[#0A0A0A]">Alerts & Notifications</h3>
          </div>
          {alerts.map((a, i) => (
            <div key={i} className="flex gap-3 py-2.5 border-b border-[#D4D4D8]/50 last:border-b-0">
              <AlertIcon type={a.type} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#0A0A0A]">{a.text}</p>
                <p className="text-[11px] text-[#71717A]">{a.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Team Activity */}
      <div className="rounded-xl border border-[#D4D4D8] bg-white p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-[#F97316]" />
          <h3 className="text-base font-semibold text-[#0A0A0A]">Recent Team Activity</h3>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#D4D4D8]">
                <th className="text-left text-xs text-[#71717A] uppercase tracking-wider py-2">Team Member</th>
                <th className="text-left text-xs text-[#71717A] uppercase tracking-wider py-2">Action</th>
                <th className="text-left text-xs text-[#71717A] uppercase tracking-wider py-2">Project</th>
                <th className="text-left text-xs text-[#71717A] uppercase tracking-wider py-2">Time</th>
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
                  <td className="py-3 text-xs text-[#71717A] whitespace-nowrap">{r.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile list */}
        <div className="md:hidden">
          {recentActivity.map((r, i) => (
            <div key={i} className="py-3 border-b border-[#D4D4D8]/50 last:border-b-0">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-xs font-medium text-slate-600">{r.ini}</div>
                <span className="text-sm font-medium text-[#0A0A0A]">{r.name}</span>
              </div>
              <p className="text-sm text-[#0A0A0A] ml-10">{r.action}</p>
              <p className="text-xs text-[#71717A] ml-10">{r.project} &middot; {r.time}</p>
            </div>
          ))}
        </div>

        <button onClick={() => onNavigate('time-approvals')} className="text-sm text-[#F97316] hover:underline font-medium mt-3">
          View all activity &rarr;
        </button>
      </div>
    </div>
  );
}

// A.2  TimeApprovalsContent

function TimeApprovalsContent() {
  const [filter, setFilter] = useState('all');

  const entries = [
    { ini: 'CR', name: 'Carlos R.',  project: 'Downtown Office Tower', date: 'Feb 27, 2026', hours: '8.5',  type: 'Regular',  status: 'Pending'  },
    { ini: 'ML', name: 'Maria L.',   project: 'Harbor Bridge Repair',  date: 'Feb 27, 2026', hours: '9.0',  type: 'Overtime',  status: 'Pending'  },
    { ini: 'PS', name: 'Pedro S.',   project: 'Residential Complex',   date: 'Feb 27, 2026', hours: '8.0',  type: 'Regular',  status: 'Pending'  },
    { ini: 'AG', name: 'Ana G.',     project: 'Downtown Office Tower', date: 'Feb 27, 2026', hours: '7.5',  type: 'Regular',  status: 'Pending'  },
    { ini: 'LM', name: 'Luis M.',    project: 'Harbor Bridge Repair',  date: 'Feb 26, 2026', hours: '8.0',  type: 'Regular',  status: 'Pending'  },
    { ini: 'JF', name: 'Jorge F.',   project: 'Downtown Office Tower', date: 'Feb 26, 2026', hours: '10.0', type: 'Overtime',  status: 'Pending'  },
    { ini: 'CR', name: 'Carlos R.',  project: 'Residential Complex',   date: 'Feb 26, 2026', hours: '8.0',  type: 'Regular',  status: 'Approved' },
    { ini: 'ML', name: 'Maria L.',   project: 'Downtown Office Tower', date: 'Feb 26, 2026', hours: '8.5',  type: 'Regular',  status: 'Approved' },
  ];

  const filtered = filter === 'all' ? entries : entries.filter(e => e.project === filter);

  function StatusBadge({ status }: { status: string }) {
    if (status === 'Approved') return <span className="bg-emerald-50 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full font-medium">Approved</span>;
    if (status === 'Rejected') return <span className="bg-red-50 text-red-700 text-[10px] px-2 py-0.5 rounded-full font-medium">Rejected</span>;
    return <span className="bg-amber-50 text-amber-700 text-[10px] px-2 py-0.5 rounded-full font-medium">Pending</span>;
  }

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-[#0A0A0A]">Pending Time Entries</h2>
          <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium">12 pending</span>
        </div>
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="text-sm border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-[#0A0A0A] bg-white"
        >
          <option value="all">All Projects</option>
          <option value="Downtown Office Tower">Downtown Office Tower</option>
          <option value="Harbor Bridge Repair">Harbor Bridge Repair</option>
          <option value="Residential Complex">Residential Complex</option>
          <option value="School Renovation">School Renovation</option>
        </select>
      </div>

      <div className="rounded-xl border border-[#D4D4D8] bg-white">
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#D4D4D8]">
                {['Employee', 'Project', 'Date', 'Hours', 'Type', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left text-xs text-[#71717A] uppercase tracking-wider px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((e, i) => (
                <tr key={i} className="border-b border-[#D4D4D8]/50 last:border-b-0 hover:bg-[#FAFAFA]/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-xs font-medium text-slate-600">{e.ini}</div>
                      <span className="text-sm text-[#0A0A0A] font-medium whitespace-nowrap">{e.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#0A0A0A] whitespace-nowrap">{e.project}</td>
                  <td className="px-4 py-3 text-sm text-[#71717A] whitespace-nowrap">{e.date}</td>
                  <td className="px-4 py-3 text-sm font-medium text-[#0A0A0A]">{e.hours} hrs</td>
                  <td className="px-4 py-3">
                    {e.type === 'Overtime'
                      ? <span className="text-amber-600 text-xs font-medium">Overtime</span>
                      : <span className="text-[#71717A] text-xs">Regular</span>}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={e.status} /></td>
                  <td className="px-4 py-3 text-xs text-[#71717A]">
                    {e.status === 'Pending' ? 'Awaiting review' : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden">
          {filtered.map((e, i) => (
            <div key={i} className="p-4 border-b border-[#D4D4D8]/50 last:border-b-0">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-xs font-medium text-slate-600">{e.ini}</div>
                  <span className="text-sm font-medium text-[#0A0A0A]">{e.name}</span>
                </div>
                <StatusBadge status={e.status} />
              </div>
              <p className="text-xs text-[#71717A] mb-1">{e.project} &middot; {e.date}</p>
              <p className="text-sm text-[#0A0A0A] mb-2">
                {e.hours} hrs &middot;{' '}
                {e.type === 'Overtime'
                  ? <span className="text-amber-600 font-medium">Overtime</span>
                  : <span className="text-[#71717A]">Regular</span>}
              </p>

            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// A.3  ExpenseReviewsContent

function ExpenseReviewsContent() {
  const [filter, setFilter] = useState('all');

  const expenses = [
    { ini: 'ML', name: 'Maria L.',  project: 'Harbor Bridge Repair',  category: 'Materials',        amount: 890,    date: 'Feb 27, 2026', receipt: true,  status: 'Pending'  },
    { ini: 'CR', name: 'Carlos R.', project: 'Residential Complex',   category: 'Transportation',   amount: 120,    date: 'Feb 27, 2026', receipt: true,  status: 'Pending'  },
    { ini: 'PS', name: 'Pedro S.',  project: 'Downtown Office Tower', category: 'Equipment Rental', amount: 450,    date: 'Feb 26, 2026', receipt: true,  status: 'Pending'  },
    { ini: 'AG', name: 'Ana G.',    project: 'Downtown Office Tower', category: 'Supplies',         amount: 380,    date: 'Feb 26, 2026', receipt: false, status: 'Pending'  },
    { ini: 'LM', name: 'Luis M.',   project: 'Harbor Bridge Repair',  category: 'Fuel',             amount: 500,    date: 'Feb 25, 2026', receipt: true,  status: 'Pending'  },
    { ini: 'JF', name: 'Jorge F.',  project: 'Downtown Office Tower', category: 'Materials',        amount: 1200,   date: 'Feb 24, 2026', receipt: true,  status: 'Approved' },
  ];

  const filtered = filter === 'all' ? expenses : expenses.filter(e => e.project === filter);

  function StatusBadge({ status }: { status: string }) {
    if (status === 'Approved') return <span className="bg-emerald-50 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full font-medium">Approved</span>;
    if (status === 'Rejected') return <span className="bg-red-50 text-red-700 text-[10px] px-2 py-0.5 rounded-full font-medium">Rejected</span>;
    return <span className="bg-amber-50 text-amber-700 text-[10px] px-2 py-0.5 rounded-full font-medium">Pending</span>;
  }

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-lg font-semibold text-[#0A0A0A]">Pending Expenses</h2>
          <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium">5 pending</span>
          <span className="text-xs text-[#71717A]">$2,340.00 total</span>
        </div>
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="text-sm border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-[#0A0A0A] bg-white"
        >
          <option value="all">All Projects</option>
          <option value="Downtown Office Tower">Downtown Office Tower</option>
          <option value="Harbor Bridge Repair">Harbor Bridge Repair</option>
          <option value="Residential Complex">Residential Complex</option>
        </select>
      </div>

      <div className="rounded-xl border border-[#D4D4D8] bg-white">
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#D4D4D8]">
                {['Employee', 'Project', 'Category', 'Amount', 'Date', 'Receipt', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left text-xs text-[#71717A] uppercase tracking-wider px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((e, i) => (
                <tr key={i} className="border-b border-[#D4D4D8]/50 last:border-b-0 hover:bg-[#FAFAFA]/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-xs font-medium text-slate-600">{e.ini}</div>
                      <span className="text-sm text-[#0A0A0A] font-medium whitespace-nowrap">{e.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#0A0A0A] whitespace-nowrap">{e.project}</td>
                  <td className="px-4 py-3 text-sm text-[#71717A]">{e.category}</td>
                  <td className="px-4 py-3 text-sm font-medium text-[#0A0A0A]">{fmtCurrency(e.amount)}</td>
                  <td className="px-4 py-3 text-sm text-[#71717A] whitespace-nowrap">{e.date}</td>
                  <td className="px-4 py-3">
                    {e.receipt
                      ? <CheckCircle className="w-4 h-4 text-emerald-500" />
                      : <AlertTriangle className="w-4 h-4 text-amber-500" />}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={e.status} /></td>
                  <td className="px-4 py-3">
                    {e.status === 'Pending' && (
                      <div className="flex gap-1.5">
                        <button onClick={() => toast.success('Expense approved')} className="text-xs px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-medium">Approve</button>
                        <button onClick={() => toast.error('Expense rejected')} className="text-xs px-2.5 py-1 rounded-md bg-red-50 text-red-700 hover:bg-red-100 font-medium">Reject</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden">
          {filtered.map((e, i) => (
            <div key={i} className="p-4 border-b border-[#D4D4D8]/50 last:border-b-0">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-xs font-medium text-slate-600">{e.ini}</div>
                  <span className="text-sm font-medium text-[#0A0A0A]">{e.name}</span>
                </div>
                <StatusBadge status={e.status} />
              </div>
              <p className="text-xs text-[#71717A] mb-1">{e.project} &middot; {e.category}</p>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-[#0A0A0A]">{fmtCurrency(e.amount)}</span>
                <span className="text-xs text-[#71717A]">{e.date}</span>
                {e.receipt
                  ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                  : <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
              </div>
              {e.status === 'Pending' && (
                <div className="flex gap-2 mt-2">
                  <button onClick={() => toast.success('Expense approved')} className="text-xs px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-medium">Approve</button>
                  <button onClick={() => toast.error('Expense rejected')} className="text-xs px-2.5 py-1 rounded-md bg-red-50 text-red-700 hover:bg-red-100 font-medium">Reject</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// A.4  BudgetOverviewContent

function BudgetOverviewContent() {
  const budgetProjects = [
    {
      name: 'Downtown Office Tower', status: 'Active', spent: 45200, total: 120000, pct: 38,
      categories: [
        { label: 'Materials', amount: 18000 },
        { label: 'Labor', amount: 15200 },
        { label: 'Equipment', amount: 8000 },
        { label: 'Other', amount: 4000 },
      ],
    },
    {
      name: 'Harbor Bridge Repair', status: 'Active', spent: 28500, total: 75000, pct: 38,
      categories: [
        { label: 'Materials', amount: 12000 },
        { label: 'Labor', amount: 10500 },
        { label: 'Equipment', amount: 4000 },
        { label: 'Other', amount: 2000 },
      ],
    },
    {
      name: 'Residential Complex Ph.2', status: 'Active', spent: 102000, total: 120000, pct: 85,
      categories: [
        { label: 'Materials', amount: 45000 },
        { label: 'Labor', amount: 35000 },
        { label: 'Equipment', amount: 15000 },
        { label: 'Other', amount: 7000 },
      ],
    },
    {
      name: 'School Renovation', status: 'Completed', spent: 57600, total: 60000, pct: 96,
      categories: [
        { label: 'Materials', amount: 25000 },
        { label: 'Labor', amount: 20000 },
        { label: 'Equipment', amount: 8600 },
        { label: 'Other', amount: 4000 },
      ],
    },
  ];

  function ProjStatusBadge({ status }: { status: string }) {
    if (status === 'Active') return <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-700">Active</span>;
    return <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600">Completed</span>;
  }

  return (
    <div className="max-w-6xl space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-[#0A0A0A]">Budget Overview</h2>
        <p className="text-sm text-[#71717A]">Monitor spending across your projects</p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-[#D4D4D8] bg-white p-5">
          <div className="w-10 h-10 bg-[#F97316]/10 rounded-lg flex items-center justify-center mb-3">
            <Wallet className="w-5 h-5 text-[#F97316]" />
          </div>
          <p className="text-2xl font-bold text-[#0A0A0A]">$375,000</p>
          <p className="text-sm text-[#71717A]">Total Budget</p>
          <p className="text-xs text-[#71717A] mt-1">Across 4 projects</p>
        </div>
        <div className="rounded-xl border border-[#D4D4D8] bg-white p-5">
          <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center mb-3">
            <TrendingUp className="w-5 h-5 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-[#0A0A0A]">$233,300</p>
          <p className="text-sm text-[#71717A]">Total Spent</p>
          <p className="text-xs text-[#71717A] mt-1">62.2% utilized</p>
        </div>
        <div className="rounded-xl border border-[#D4D4D8] bg-white p-5">
          <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center mb-3">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-[#0A0A0A]">$141,700</p>
          <p className="text-sm text-[#71717A]">Remaining</p>
          <p className="text-xs text-[#71717A] mt-1">Projected on track</p>
        </div>
      </div>

      {/* Budget Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {budgetProjects.map(proj => {
          const maxCat = Math.max(...proj.categories.map(c => c.amount));
          const isCompleted = proj.status === 'Completed';
          return (
            <div key={proj.name} className={`rounded-xl border border-[#D4D4D8] bg-white p-6 ${isCompleted ? 'opacity-75' : ''}`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold text-[#0A0A0A]">{proj.name}</h3>
                <ProjStatusBadge status={proj.status} />
              </div>
              {/* Budget bar */}
              <div className="h-2 rounded-full bg-[#FAFAFA] mb-2">
                <div className={`h-full rounded-full ${budgetBarColor(proj.pct)}`} style={{ width: `${proj.pct}%` }} />
              </div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs text-[#71717A]">{fmtCurrency(proj.spent)} / {fmtCurrency(proj.total)}</span>
                <span className="text-xs font-medium text-[#0A0A0A]">{proj.pct}%</span>
              </div>
              {/* Category breakdown */}
              <div className="bg-[#FAFAFA] rounded-lg p-4">
                {proj.categories.map(cat => (
                  <div key={cat.label} className="flex items-center gap-3 mb-2 last:mb-0">
                    <span className="text-xs text-[#71717A] w-20 flex-shrink-0">{cat.label}</span>
                    <div className="flex-1 h-1.5 bg-[#D4D4D8]/50 rounded-full">
                      <div className="h-full rounded-full bg-[#F97316]" style={{ width: `${(cat.amount / maxCat) * 100}%` }} />
                    </div>
                    <span className="text-xs font-medium text-[#0A0A0A] w-16 text-right">{fmtCurrency(cat.amount)}</span>
                  </div>
                ))}
              </div>
              {/* Warning */}
              {proj.pct >= 70 && proj.status !== 'Completed' && (
                <div className="flex items-center gap-2 mt-3 p-2 bg-amber-50 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span className="text-xs text-amber-700 font-medium">Budget exceeds 80% threshold</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// A.5  TeamToolsContent

function TeamToolsContent() {
  const [filter, setFilter] = useState('all');

  const tools = [
    { tool: 'DeWalt Drill DCD996',     serial: 'DW-2024-001', assignee: 'Carlos R.', project: 'Downtown Office Tower', status: 'In Use',      condition: 'Good'          },
    { tool: 'Milwaukee Saw',           serial: 'MW-2024-015', assignee: 'Maria L.',  project: 'Harbor Bridge Repair',  status: 'In Use',      condition: 'Good'          },
    { tool: 'Hilti Hammer Drill',      serial: 'HI-2023-088', assignee: 'Pedro S.',  project: 'Residential Complex',   status: 'In Use',      condition: 'Fair'          },
    { tool: 'Bosch Laser Level',       serial: 'BO-2024-003', assignee: 'Ana G.',    project: 'Downtown Office Tower', status: 'In Use',      condition: 'Good'          },
    { tool: 'Makita Grinder',          serial: 'MK-2023-042', assignee: '',          project: '',                      status: 'Available',   condition: 'Good'          },
    { tool: 'CAT Generator 5kW',       serial: 'CT-2022-011', assignee: 'Luis M.',   project: 'Harbor Bridge Repair',  status: 'In Use',      condition: 'Needs Service' },
    { tool: 'Wacker Neuson Plate',     serial: 'WN-2024-007', assignee: '',          project: '',                      status: 'Maintenance', condition: 'Under Repair'  },
    { tool: 'Stanley Total Station',   serial: 'ST-2023-019', assignee: 'Jorge F.',  project: 'Downtown Office Tower', status: 'In Use',      condition: 'Good'          },
  ];

  const filtered = filter === 'all' ? tools : tools.filter(t => t.status === filter);

  function ToolStatusBadge({ status }: { status: string }) {
    if (status === 'In Use')      return <span className="bg-[#F97316]/10 text-[#F97316] text-[10px] px-2 py-0.5 rounded-full font-medium">In Use</span>;
    if (status === 'Available')   return <span className="bg-emerald-50 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full font-medium">Available</span>;
    return <span className="bg-amber-50 text-amber-700 text-[10px] px-2 py-0.5 rounded-full font-medium">Maintenance</span>;
  }

  function ConditionText({ condition }: { condition: string }) {
    const cls: Record<string, string> = {
      'Good':          'text-emerald-600',
      'Fair':          'text-amber-600',
      'Needs Service': 'text-orange-600',
      'Under Repair':  'text-[#d4183d]',
    };
    return <span className={`text-xs font-medium ${cls[condition] ?? 'text-[#71717A]'}`}>{condition}</span>;
  }

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-[#0A0A0A]">Team Tools</h2>
          <span className="text-xs bg-[#F97316]/10 text-[#F97316] px-2 py-0.5 rounded-full font-medium">23 tools assigned</span>
        </div>
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="text-sm border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-[#0A0A0A] bg-white"
        >
          <option value="all">All Status</option>
          <option value="In Use">In Use</option>
          <option value="Available">Available</option>
          <option value="Maintenance">Maintenance</option>
        </select>
      </div>

      <div className="rounded-xl border border-[#D4D4D8] bg-white">
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#D4D4D8]">
                {['Tool', 'Serial #', 'Assigned To', 'Project', 'Status', 'Condition'].map(h => (
                  <th key={h} className="text-left text-xs text-[#71717A] uppercase tracking-wider px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((t, i) => (
                <tr key={i} className="border-b border-[#D4D4D8]/50 last:border-b-0 hover:bg-[#FAFAFA]/50">
                  <td className="px-4 py-3 text-sm font-medium text-[#0A0A0A] whitespace-nowrap">{t.tool}</td>
                  <td className="px-4 py-3 text-xs text-[#71717A] font-mono">{t.serial}</td>
                  <td className="px-4 py-3 text-sm text-[#0A0A0A]">{t.assignee || <span className="text-xs text-[#71717A]">&mdash;</span>}</td>
                  <td className="px-4 py-3 text-sm text-[#71717A]">{t.project || <span className="text-xs text-[#71717A]">&mdash;</span>}</td>
                  <td className="px-4 py-3"><ToolStatusBadge status={t.status} /></td>
                  <td className="px-4 py-3"><ConditionText condition={t.condition} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden">
          {filtered.map((t, i) => (
            <div key={i} className="p-4 border-b border-[#D4D4D8]/50 last:border-b-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-[#0A0A0A]">{t.tool}</span>
                <ToolStatusBadge status={t.status} />
              </div>
              <p className="text-xs text-[#71717A] mb-1">Serial: {t.serial}</p>
              {t.assignee && <p className="text-xs text-[#0A0A0A]">Assigned: {t.assignee}</p>}
              {t.project && <p className="text-xs text-[#71717A]">{t.project}</p>}
              <div className="mt-1"><ConditionText condition={t.condition} /></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Main component

export function ManagerDashboard() {
  const navigate = useNavigate();
  const username = AuthService.getUsername() ?? 'supervisor';
  const userInits = (username ?? 'S').slice(0, 2).toUpperCase();

  const [activeSection, setActiveSection] = useState<ActiveSection>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navScrollPos = useRef(0);

  const handleLogout = () => { document.cookie = 'ofjr_session=; Path=/; Max-Age=0'; navigate('/'); AuthService.logout(); };

  const handleNavigate = (section: string) => {
    setActiveSection(section as ActiveSection);
    setSidebarOpen(false);
  };

  const meta = SECTION_META[activeSection];

  // NavItem
  function NavItem({ item }: { item: { key: ActiveSection; label: string; icon: React.ElementType } }) {
    const isActive = activeSection === item.key;
    return (
      <button
        onClick={() => handleNavigate(item.key)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left group ${
          isActive
            ? 'bg-[#F97316]/10 text-[#F97316]'
            : 'text-[#0A0A0A] hover:bg-[#FAFAFA] hover:text-[#F97316]'
        }`}
      >
        <item.icon className="flex-shrink-0" style={{ width: 18, height: 18 }} />
        <span className={`text-sm flex-1 ${isActive ? 'font-semibold' : 'font-medium'}`}>
          {item.label}
        </span>
        {isActive && (
          <span className="w-1.5 h-1.5 rounded-full bg-[#F97316] flex-shrink-0" />
        )}
      </button>
    );
  }

  // SidebarContent
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
              <h1 className="text-sm font-semibold text-[#0A0A0A] leading-tight">BuildTrack</h1>
              <p className="text-[11px] text-[#71717A]">Supervisor Panel</p>
            </div>
          </div>
        </div>

        {/* Navigation with groups */}
        <nav
          className="flex-1 p-3 overflow-y-auto min-h-0"
          ref={(el) => { if (el) el.scrollTop = navScrollPos.current; }}
          onScroll={(e) => { navScrollPos.current = e.currentTarget.scrollTop; }}
        >
          {NAV_GROUPS.map((group, idx) => (
            <div key={group.label}>
              {idx > 0 && <div className="my-2 border-t border-[#D4D4D8]" />}
              <p className="px-3 py-1.5 text-[10px] font-semibold text-[#71717A] uppercase tracking-wider">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map(item => (
                  <NavItem key={item.key} item={item} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div className="p-3 border-t border-[#D4D4D8] flex-shrink-0">
          <div className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-[#FAFAFA] transition-colors">
            <div className="w-8 h-8 bg-[#F97316] rounded-full flex items-center justify-center text-xs text-white font-bold flex-shrink-0">
              {userInits}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[#0A0A0A] truncate">{username}</p>
              <p className="text-[10px] text-[#71717A]">SUPERVISOR</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-[#71717A] hover:text-red-600 transition-colors p-1 rounded flex-shrink-0"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[10px] text-[#D4D4D8] px-2 mt-2">v1.0.0 · Phase 1-5</p>
        </div>
      </>
    );
  }

  // Render
  return (
    <div className="min-h-screen bg-[#FAFAFA] flex">

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 bg-white border-r border-[#D4D4D8] flex-col flex-shrink-0 sticky top-0 h-screen">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-[#0A0A0A]/50 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-white flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#D4D4D8] flex-shrink-0">
              <span className="text-sm font-semibold text-[#0A0A0A]">Menu</span>
              <button onClick={() => setSidebarOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-[#71717A] hover:bg-[#FAFAFA]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 flex flex-col overflow-hidden min-h-0">
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
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg border border-[#D4D4D8] text-[#0A0A0A] hover:bg-[#FAFAFA] flex-shrink-0"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-[#0A0A0A] truncate">{meta.title}</h2>
              <p className="text-[11px] text-[#71717A] truncate hidden sm:block">{meta.subtitle}</p>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 h-9 px-3">
                <div className="w-7 h-7 rounded-full bg-[#F97316] flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-[10px] font-bold">{userInits}</span>
                </div>
                <div className="text-left hidden sm:block">
                  <div className="text-xs font-semibold text-[#0A0A0A]">{username}</div>
                  <div className="text-[10px] text-[#71717A]">SUPERVISOR</div>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="text-xs text-[#71717A]">Signed in as {username}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 text-sm cursor-pointer">
                <User className="w-4 h-4" />Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="gap-2 text-sm text-red-600 focus:text-red-600 cursor-pointer">
                <LogOut className="w-4 h-4" />Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Content area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <Suspense fallback={<SectionSpinner />}>
            {activeSection === 'dashboard'       && <SupervisorDashboardContent username={username} onNavigate={handleNavigate} />}
            {activeSection === 'projects'        && <SupervisorProjects />}
            {activeSection === 'time-approvals'  && <TimeApprovalsContent />}
            {activeSection === 'expense-reviews' && <ExpenseReviewsContent />}
            {activeSection === 'budget-overview' && <BudgetOverviewContent />}
            {activeSection === 'team-tools'      && <TeamToolsContent />}
          </Suspense>
        </main>
      </div>

      <Toaster position="top-right" richColors />
    </div>
  );
}

export default ManagerDashboard;
