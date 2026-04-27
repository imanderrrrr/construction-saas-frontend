import React, { useState } from 'react';
import {
  Palette, LayoutDashboard, Users, FolderOpen, Shield,
  AlertCircle, CheckCircle, AlertTriangle, Info,
  Loader2, UserPlus, Plus, Eye, LogOut, PowerOff,
  Bell, X, Check, ChevronRight,
} from 'lucide-react';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { toast } from 'sonner';

// Types

type DSTab = 'overview' | 'states' | 'badges' | 'dialogs' | 'toasts';

const TABS: { key: DSTab; label: string; icon: React.ElementType }[] = [
  { key: 'overview', label: 'Navigation',  icon: LayoutDashboard },
  { key: 'states',   label: 'States',      icon: AlertCircle     },
  { key: 'badges',   label: 'Badges',      icon: Palette         },
  { key: 'dialogs',  label: 'Dialogs',     icon: Eye             },
  { key: 'toasts',   label: 'Toasts',      icon: Bell            },
];

// Badge helpers

function Chip({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${className}`}>
      {children}
    </span>
  );
}

function Dot({ color }: { color: string }) {
  return <span className={`w-1.5 h-1.5 rounded-full ${color}`} />;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider mb-3 pb-2 border-b border-[#D4D4D8]">
      {children}
    </h3>
  );
}

function TokenCard({ label, value, preview }: { label: string; value: string; preview: React.ReactNode }) {
  return (
    <div className="bg-white border border-[#D4D4D8] rounded-xl p-4 flex items-center gap-3">
      <div className="flex-shrink-0">{preview}</div>
      <div>
        <p className="text-xs font-semibold text-[#0A0A0A]">{label}</p>
        <p className="font-mono text-[11px] text-[#71717A]">{value}</p>
      </div>
    </div>
  );
}

// Sidebar preview

function SidebarPreview() {
  const [active, setActive] = useState('dashboard');
  const items = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'users',     label: 'Users',     icon: Users            },
    { key: 'projects',  label: 'Projects',  icon: FolderOpen       },
    { key: 'audit',     label: 'Audit logs',icon: Shield           },
  ];

  return (
    <div className="flex gap-6 flex-wrap">
      {/* Desktop sidebar */}
      <div>
        <p className="text-xs font-medium text-[#71717A] mb-2">Desktop sidebar — 256px</p>
        <div className="w-64 bg-white border border-[#D4D4D8] rounded-xl overflow-hidden shadow-sm">
          {/* Brand */}
          <div className="p-5 border-b border-[#D4D4D8] flex items-center gap-3">
            <div className="w-9 h-9 bg-[#F97316] rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-white text-sm font-bold">O</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-[#0A0A0A]">OFJR Construction</p>
              <p className="text-[11px] text-[#71717A]">Admin Panel</p>
            </div>
          </div>
          {/* Nav items */}
          <nav className="p-3 space-y-0.5">
            {items.map(item => (
              <button key={item.key} onClick={() => setActive(item.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left ${active === item.key ? 'bg-[#F97316]/10 text-[#F97316]' : 'text-[#0A0A0A] hover:bg-[#FAFAFA] hover:text-[#F97316]'}`}>
                <item.icon className="w-4.5 h-4.5 flex-shrink-0" style={{ width: 18, height: 18 }} />
                <span className={`text-sm ${active === item.key ? 'font-semibold' : 'font-medium'}`}>{item.label}</span>
                {active === item.key && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#F97316]" />}
              </button>
            ))}
          </nav>
          {/* Footer */}
          <div className="p-3 mx-3 mb-3 border-t border-[#D4D4D8] mt-2 pt-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-[#F97316] rounded-full flex items-center justify-center text-[10px] text-white font-bold">AD</div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-[#0A0A0A] truncate">admin</p>
                <p className="text-[10px] text-[#71717A]">Administrator</p>
              </div>
              <button className="text-[#71717A] hover:text-red-600 transition-colors">
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile topbar */}
      <div>
        <p className="text-xs font-medium text-[#71717A] mb-2">Mobile topbar — 390px</p>
        <div className="w-80 bg-white border border-[#D4D4D8] rounded-xl overflow-hidden shadow-sm">
          <div className="h-14 flex items-center justify-between px-4 border-b border-[#D4D4D8]">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-[#F97316] rounded-lg flex items-center justify-center">
                <span className="text-white text-xs font-bold">O</span>
              </div>
              <span className="text-sm font-semibold text-[#0A0A0A]">OFJR</span>
            </div>
            {/* Hamburger */}
            <button className="w-9 h-9 flex items-center justify-center rounded-lg border border-[#D4D4D8] text-[#0A0A0A]">
              <div className="space-y-1.5 flex flex-col items-center">
                <div className="w-4 h-0.5 bg-current rounded" />
                <div className="w-4 h-0.5 bg-current rounded" />
                <div className="w-4 h-0.5 bg-current rounded" />
              </div>
            </button>
          </div>
          {/* Mobile sidebar overlay (visual) */}
          <div className="bg-[#0A0A0A]/50 p-2">
            <div className="bg-white rounded-lg p-3 space-y-0.5">
              {items.map(item => (
                <button key={item.key} onClick={() => setActive(item.key)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm ${active === item.key ? 'bg-[#F97316]/10 text-[#F97316] font-semibold' : 'text-[#0A0A0A] font-medium'}`}>
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// States showcase

function StatesTab() {
  return (
    <div className="space-y-8">

      {/* Page Header template */}
      <div>
        <SectionTitle>Standard page header</SectionTitle>
        <div className="bg-white border border-[#D4D4D8] rounded-xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-[#0A0A0A]">Page title</h2>
              <p className="text-sm text-[#71717A] mt-1">Page subtitle or description goes here.</p>
            </div>
            <Button className="bg-[#F97316] hover:bg-[#C2410C] text-white gap-2 self-start">
              <Plus className="w-4 h-4" />Primary action
            </Button>
          </div>
          <p className="text-[10px] font-mono text-[#D4D4D8] mt-4">
            Template: h2 + subtitle p + optional Button in flex justify-between
          </p>
        </div>
      </div>

      {/* Skeleton templates */}
      <div>
        <SectionTitle>Skeleton states</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Table skeleton */}
          <div className="bg-white border border-[#D4D4D8] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#D4D4D8] bg-[#FAFAFA]">
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="p-5 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
                  <Skeleton className="h-4 flex-1" style={{ opacity: 1 - i * 0.1 }} />
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-8 w-8 rounded-lg" />
                </div>
              ))}
            </div>
            <p className="px-5 pb-4 text-[10px] font-mono text-[#D4D4D8]">Table skeleton — 5 rows</p>
          </div>

          {/* KPI card skeleton */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white border border-[#D4D4D8] rounded-xl p-5">
                  <Skeleton className="w-10 h-10 rounded-lg mb-3" />
                  <Skeleton className="h-3 w-20 mb-2" />
                  <Skeleton className="h-7 w-12 mb-1" />
                  <Skeleton className="h-3 w-24" />
                </div>
              ))}
            </div>
            <p className="text-[10px] font-mono text-[#D4D4D8] px-1">KPI card skeleton — 4 cards grid</p>
          </div>
        </div>
      </div>

      {/* Empty states */}
      <div>
        <SectionTitle>Empty states</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: Users, title: 'No users found', desc: 'Try adjusting your search or filters.', cta: 'Create user', ctaIcon: UserPlus },
            { icon: FolderOpen, title: 'No projects yet', desc: 'Create your first project to get started.', cta: 'Create project', ctaIcon: Plus },
            { icon: Shield, title: 'No audit events yet', desc: 'Events will appear here once the API is enabled.', cta: null, ctaIcon: null },
          ].map(item => (
            <div key={item.title} className="bg-white border border-[#D4D4D8] rounded-xl p-8 flex flex-col items-center text-center">
              <div className="w-14 h-14 bg-[#FAFAFA] rounded-full flex items-center justify-center mb-4">
                <item.icon className="w-7 h-7 text-[#D4D4D8]" />
              </div>
              <p className="text-sm font-semibold text-[#0A0A0A] mb-1.5">{item.title}</p>
              <p className="text-xs text-[#71717A] mb-4 max-w-[160px]">{item.desc}</p>
              {item.cta && item.ctaIcon && (
                <Button size="sm" className="bg-[#F97316] hover:bg-[#C2410C] text-white gap-2 h-8 text-xs">
                  <item.ctaIcon className="w-3.5 h-3.5" />{item.cta}
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Error states */}
      <div>
        <SectionTitle>Error states</SectionTitle>
        <div className="space-y-3">
          {/* Inline table error */}
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-red-900">Failed to load [resource]</p>
                <p className="text-xs text-red-600 mt-0.5">The server returned an error. Please try again.</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="gap-2 border-red-200 text-red-700 hover:bg-red-50 shrink-0">
              <Loader2 className="w-3.5 h-3.5" />Retry
            </Button>
          </div>
          {/* Form field error */}
          <div className="bg-white border border-[#D4D4D8] rounded-xl p-5 space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#0A0A0A]">Field label</label>
              <div className="h-10 px-3 flex items-center border-2 border-red-400 rounded-lg bg-red-50/30">
                <span className="text-sm text-[#71717A]">Invalid value</span>
              </div>
              <p className="flex items-center gap-1 text-xs text-red-600">
                <AlertCircle className="w-3 h-3" />Validation error message goes here.
              </p>
            </div>
            <p className="text-[10px] font-mono text-[#D4D4D8]">Field validation error — border-red-400 + text-red-600</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Badges showcase

function BadgesTab() {
  return (
    <div className="space-y-8">

      {/* Role badges */}
      <div>
        <SectionTitle>Role badges</SectionTitle>
        <div className="bg-white border border-[#D4D4D8] rounded-xl p-6">
          <div className="flex flex-wrap gap-3">
            <Chip className="bg-[#C2410C]/10 text-[#C2410C] border-[#C2410C]/20">ADMIN</Chip>
            <Chip className="bg-[#F97316]/10 text-[#F97316] border-[#F97316]/20">SUPERVISOR</Chip>
            <Chip className="bg-emerald-50 text-emerald-700 border-emerald-200">WORKER</Chip>
            <Chip className="bg-purple-50 text-purple-700 border-purple-200">FINANCE</Chip>
            <Chip className="bg-amber-50 text-amber-700 border-amber-200">WAREHOUSE</Chip>
          </div>
          <p className="text-[10px] font-mono text-[#D4D4D8] mt-4">
            font-mono · font-semibold · rounded-full · px-2.5 py-0.5
          </p>
        </div>
      </div>

      {/* Status badges */}
      <div>
        <SectionTitle>Status badges (user &amp; project)</SectionTitle>
        <div className="bg-white border border-[#D4D4D8] rounded-xl p-6">
          <div className="flex flex-wrap gap-3">
            <Chip className="bg-emerald-50 text-emerald-700 border-emerald-200">
              <Dot color="bg-emerald-500" />ACTIVE
            </Chip>
            <Chip className="bg-[#FAFAFA] text-[#71717A] border-[#D4D4D8]">
              <Dot color="bg-[#71717A]" />INACTIVE
            </Chip>
            <Chip className="bg-emerald-50 text-emerald-700 border-emerald-200">
              <Dot color="bg-emerald-400 animate-pulse" />Active session
            </Chip>
            <Chip className="bg-[#FAFAFA] text-[#71717A] border-[#D4D4D8]">Revoked</Chip>
          </div>
        </div>
      </div>

      {/* Audit action badges */}
      <div>
        <SectionTitle>Audit action badges</SectionTitle>
        <div className="bg-white border border-[#D4D4D8] rounded-xl p-6">
          <div className="flex flex-wrap gap-3">
            {[
              { action: 'LOGIN_SUCCESS',       bg: 'bg-emerald-50',   text: 'text-emerald-700', dot: 'bg-emerald-400' },
              { action: 'USER_CREATE',          bg: 'bg-[#F97316]/10', text: 'text-[#F97316]',  dot: 'bg-[#F97316]'  },
              { action: 'USER_UPDATE',          bg: 'bg-purple-50',    text: 'text-purple-700',  dot: 'bg-purple-400'  },
              { action: 'USER_DISABLE',         bg: 'bg-red-50',       text: 'text-red-700',     dot: 'bg-red-400'     },
              { action: 'USER_PASSWORD_RESET',  bg: 'bg-amber-50',     text: 'text-amber-700',   dot: 'bg-amber-400'   },
            ].map(item => (
              <span key={item.action}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium ${item.bg} ${item.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${item.dot}`} />
                {item.action}
              </span>
            ))}
          </div>
          <p className="text-[10px] font-mono text-[#D4D4D8] mt-4">
            font-mono · font-medium · rounded-full · with dot indicator
          </p>
        </div>
      </div>

      {/* Color tokens */}
      <div>
        <SectionTitle>Color tokens</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: 'Primary blue',   value: '#F97316', bg: 'bg-[#F97316]'  },
            { label: 'Dark blue',      value: '#C2410C', bg: 'bg-[#C2410C]'  },
            { label: 'Near black',     value: '#0A0A0A', bg: 'bg-[#0A0A0A]'  },
            { label: 'Off-white bg',   value: '#FAFAFA', bg: 'bg-[#FAFAFA] border border-[#D4D4D8]' },
            { label: 'Border gray',    value: '#D4D4D8', bg: 'bg-[#D4D4D8]'  },
            { label: 'Text muted',     value: '#71717A', bg: 'bg-[#71717A]'  },
          ].map(c => (
            <TokenCard key={c.value} label={c.label} value={c.value}
              preview={<div className={`w-10 h-10 rounded-lg ${c.bg}`} />}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// Dialogs showcase

function DialogsTab() {
  return (
    <div className="space-y-8">

      {/* Form dialog */}
      <div>
        <SectionTitle>Form dialog template</SectionTitle>
        <div className="max-w-md">
          <div className="bg-white border border-[#D4D4D8] rounded-xl shadow-xl overflow-hidden">
            {/* Header */}
            <div className="flex items-start justify-between p-6 pb-4">
              <div>
                <h3 className="text-base font-semibold text-[#0A0A0A]">Dialog title</h3>
                <p className="text-sm text-[#71717A] mt-0.5">Supporting description for the dialog.</p>
              </div>
              <button className="w-7 h-7 flex items-center justify-center rounded-lg text-[#71717A] hover:text-[#0A0A0A] hover:bg-[#FAFAFA] transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Body */}
            <div className="px-6 pb-4 space-y-4">
              {/* Field */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[#0A0A0A]">Field label <span className="text-red-500">*</span></label>
                <div className="h-10 px-3.5 border border-[#D4D4D8] rounded-lg flex items-center">
                  <span className="text-sm text-[#71717A]">Input value…</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[#0A0A0A]">Select field</label>
                <div className="h-10 px-3.5 border border-[#D4D4D8] rounded-lg flex items-center justify-between">
                  <span className="text-sm text-[#71717A]">Select an option…</span>
                  <ChevronRight className="w-4 h-4 text-[#71717A] rotate-90" />
                </div>
              </div>
            </div>
            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[#D4D4D8]">
              <Button variant="outline" size="sm" className="border-[#D4D4D8] text-[#0A0A0A]">Cancel</Button>
              <Button size="sm" className="bg-[#F97316] hover:bg-[#C2410C] text-white">Confirm</Button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation dialog */}
      <div>
        <SectionTitle>Confirmation dialog (destructive)</SectionTitle>
        <div className="max-w-sm">
          <div className="bg-white border border-[#D4D4D8] rounded-xl shadow-xl overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mx-auto mb-4">
                <PowerOff className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">Disable user?</h3>
              <p className="text-sm text-[#71717A] leading-relaxed">
                <span className="font-mono font-semibold text-[#0A0A0A]">username</span> won't be able
                to sign in until re-enabled.
              </p>
            </div>
            <div className="flex items-center gap-2 px-6 pb-6">
              <Button variant="outline" size="sm" className="flex-1 border-[#D4D4D8] text-[#0A0A0A]">Cancel</Button>
              <Button size="sm" className="flex-1 bg-red-600 hover:bg-red-700 text-white gap-2">
                <PowerOff className="w-4 h-4" />Disable
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Details drawer */}
      <div>
        <SectionTitle>Event detail drawer (right panel)</SectionTitle>
        <div className="w-full max-w-sm border border-[#D4D4D8] rounded-xl overflow-hidden shadow-sm">
          {/* Header */}
          <div className="px-5 py-4 bg-[#FAFAFA] border-b border-[#D4D4D8] flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold text-[#0A0A0A]">Event Detail</p>
              <p className="text-xs text-[#71717A] mt-0.5">Audit ID <span className="font-mono text-[#F97316]">#19</span></p>
            </div>
            <button className="w-7 h-7 flex items-center justify-center rounded-lg text-[#71717A] hover:bg-[#D4D4D8]">
              <X className="w-4 h-4" />
            </button>
          </div>
          {/* Body */}
          <div className="p-5 space-y-4 bg-white">
            {/* Action badge */}
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-red-50 text-red-700">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />USER_DISABLE
            </span>
            {/* Fields */}
            {[
              ['Time',     'Feb 21, 2026 10:18 AM'],
              ['Actor ID', '1'],
              ['Entity',   'USER #4'],
            ].map(([label, value]) => (
              <div key={label} className="flex items-start gap-4 py-2 border-b border-[#FAFAFA]">
                <span className="text-xs text-[#71717A] w-20 flex-shrink-0">{label}</span>
                <span className="text-sm font-mono text-[#0A0A0A]">{value}</span>
              </div>
            ))}
            {/* JSON block */}
            <div className="bg-[#0A0A0A] rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono text-white/30">metadata.json</span>
                <button className="text-[10px] text-white/50 hover:text-white/80 flex items-center gap-1">
                  <Check className="w-3 h-3" />Copy JSON
                </button>
              </div>
              <pre className="text-[11px] font-mono text-emerald-300 leading-relaxed">
{`{
  "disabledUsername": "worker2",
  "actor": "admin",
  "ip": "10.0.0.5"
}`}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Toasts showcase

function ToastsTab() {
  const toastExamples = [
    { label: 'Success — User created',       type: 'success' as const, title: 'User created',      desc: 'supervisor2 has been added to the system.' },
    { label: 'Success — Password reset',     type: 'success' as const, title: 'Password updated',  desc: 'Password for worker1 has been reset.' },
    { label: 'Error — Create failed',        type: 'error'   as const, title: 'Failed to create',  desc: 'Username already exists. Please choose another.' },
    { label: 'Warning — Session expiring',   type: 'warning' as const, title: 'Session expiring',  desc: 'Your session will expire in 5 minutes.' },
  ];

  const fire = (t: typeof toastExamples[0]) => {
    if (t.type === 'success') toast.success(t.title, { description: t.desc });
    else if (t.type === 'error') toast.error(t.title, { description: t.desc });
    else toast.warning(t.title, { description: t.desc });
  };

  return (
    <div className="space-y-8">

      {/* Visual previews */}
      <div>
        <SectionTitle>Toast visual templates</SectionTitle>
        <div className="space-y-3 max-w-sm">
          {/* Success */}
          <div className="bg-white border border-[#D4D4D8] rounded-xl p-4 flex items-start gap-3 shadow-md">
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-[#0A0A0A]">User created</p>
              <p className="text-xs text-[#71717A] mt-0.5">supervisor2 has been added to the system.</p>
            </div>
            <button className="text-[#71717A] hover:text-[#0A0A0A] mt-0.5"><X className="w-3.5 h-3.5" /></button>
          </div>

          {/* Error */}
          <div className="bg-white border border-[#D4D4D8] rounded-xl p-4 flex items-start gap-3 shadow-md">
            <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-4 h-4 text-red-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-[#0A0A0A]">Failed to create</p>
              <p className="text-xs text-[#71717A] mt-0.5">Username already exists.</p>
            </div>
            <button className="text-[#71717A] hover:text-[#0A0A0A] mt-0.5"><X className="w-3.5 h-3.5" /></button>
          </div>

          {/* Warning */}
          <div className="bg-white border border-[#D4D4D8] rounded-xl p-4 flex items-start gap-3 shadow-md">
            <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-[#0A0A0A]">Session expiring</p>
              <p className="text-xs text-[#71717A] mt-0.5">Your session will expire in 5 minutes.</p>
            </div>
            <button className="text-[#71717A] hover:text-[#0A0A0A] mt-0.5"><X className="w-3.5 h-3.5" /></button>
          </div>

          {/* Info */}
          <div className="bg-white border border-[#D4D4D8] rounded-xl p-4 flex items-start gap-3 shadow-md">
            <div className="w-8 h-8 bg-[#F97316]/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Info className="w-4 h-4 text-[#F97316]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-[#0A0A0A]">API not enabled</p>
              <p className="text-xs text-[#71717A] mt-0.5">Audit logs will appear once the endpoint is available.</p>
            </div>
            <button className="text-[#71717A] hover:text-[#0A0A0A] mt-0.5"><X className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      </div>

      {/* Live fire */}
      <div>
        <SectionTitle>Fire live toasts</SectionTitle>
        <div className="flex flex-wrap gap-3">
          {toastExamples.map(t => (
            <Button key={t.label} variant="outline" size="sm" onClick={() => fire(t)}
              className="border-[#D4D4D8] text-[#0A0A0A] gap-2 text-xs">
              {t.type === 'success' && <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />}
              {t.type === 'error'   && <AlertCircle className="w-3.5 h-3.5 text-red-600" />}
              {t.type === 'warning' && <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />}
              {t.label}
            </Button>
          ))}
        </div>
        <p className="text-xs text-[#71717A] mt-3 flex items-center gap-1.5">
          <Info className="w-3 h-3" />
          Toasts appear top-right via Sonner (Toaster position="top-right").
        </p>
      </div>

      {/* Alert banner templates */}
      <div>
        <SectionTitle>Alert banner templates (inline)</SectionTitle>
        <div className="space-y-3 max-w-2xl">
          {[
            { bg: 'bg-red-50', border: 'border-red-200', iconBg: 'bg-red-100', icon: AlertCircle, iconColor: 'text-red-600', title: 'Action blocked', msg: "You can't disable the last active ADMIN.", titleColor: 'text-red-900', msgColor: 'text-red-700' },
            { bg: 'bg-amber-50', border: 'border-amber-200', iconBg: 'bg-amber-100', icon: AlertTriangle, iconColor: 'text-amber-600', title: 'Session expired', msg: 'Please sign in again to continue.', titleColor: 'text-amber-900', msgColor: 'text-amber-700' },
            { bg: 'bg-emerald-50', border: 'border-emerald-200', iconBg: 'bg-emerald-100', icon: CheckCircle, iconColor: 'text-emerald-600', title: 'All changes saved', msg: 'Your configuration has been applied.', titleColor: 'text-emerald-900', msgColor: 'text-emerald-700' },
          ].map(item => (
            <div key={item.title} className={`p-4 ${item.bg} border ${item.border} rounded-xl flex items-start gap-3`}>
              <div className={`w-8 h-8 ${item.iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                <item.icon className={`w-4 h-4 ${item.iconColor}`} />
              </div>
              <div>
                <p className={`text-sm font-semibold ${item.titleColor}`}>{item.title}</p>
                <p className={`text-sm ${item.msgColor} mt-0.5`}>{item.msg}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// MAIN DESIGN SYSTEM PAGE

export function DesignSystem() {
  const [activeTab, setActiveTab] = useState<DSTab>('overview');

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 bg-[#F97316]/10 rounded-lg flex items-center justify-center">
              <Palette className="w-4 h-4 text-[#F97316]" />
            </div>
            <span className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">Design System</span>
          </div>
          <h2 className="text-2xl font-bold text-[#0A0A0A]">Admin Components</h2>
          <p className="text-sm text-[#71717A] mt-1">Reusable UI patterns for consistent admin panel design.</p>
        </div>
        <span className="text-[10px] font-semibold px-2.5 py-1 bg-[#0A0A0A] text-white rounded-full">
          Design System / Admin Components
        </span>
      </div>

      {/* Tab navigation */}
      <div className="flex items-center gap-1 p-1 bg-white border border-[#D4D4D8] rounded-xl shadow-sm w-fit flex-wrap">
        {TABS.map(tab => (
          <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.key ? 'bg-[#F97316] text-white shadow-sm' : 'text-[#71717A] hover:text-[#0A0A0A] hover:bg-[#FAFAFA]'}`}>
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'overview' && <SidebarPreview />}
        {activeTab === 'states'   && <StatesTab />}
        {activeTab === 'badges'   && <BadgesTab />}
        {activeTab === 'dialogs'  && <DialogsTab />}
        {activeTab === 'toasts'   && <ToastsTab />}
      </div>
    </div>
  );
}