import React, { useState, useEffect, useRef } from 'react';
import { Building2, Menu, X, LogOut, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { LanguageSwitcher } from './LanguageSwitcher';
import { CanonicalRole } from '../types';

// Role styles

const ROLE_ACCENT: Record<CanonicalRole, { dot: string; badge: string; avatarBg: string }> = {
  ADMIN:      { dot: 'bg-[#C2410C]',   badge: 'bg-[#C2410C]/10 text-[#C2410C] border-[#C2410C]/20',   avatarBg: 'bg-[#C2410C]'   },
  SUPERVISOR: { dot: 'bg-[#F97316]',   badge: 'bg-[#F97316]/10 text-[#F97316] border-[#F97316]/20',   avatarBg: 'bg-[#F97316]'   },
  WORKER:     { dot: 'bg-emerald-600', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',      avatarBg: 'bg-emerald-600' },
  FINANCE:    { dot: 'bg-purple-600',  badge: 'bg-purple-50 text-purple-700 border-purple-200',         avatarBg: 'bg-purple-600'  },
  WAREHOUSE:      { dot: 'bg-amber-600',   badge: 'bg-amber-50 text-amber-700 border-amber-200',            avatarBg: 'bg-amber-600'   },
  SUBCONTRACTOR:  { dot: 'bg-orange-600',  badge: 'bg-orange-50 text-orange-700 border-orange-200',        avatarBg: 'bg-orange-600'  },
};

// Types

export interface AppShellNavItem {
  key: string;
  label: string;
  icon: React.ElementType;
  badge?: string;
  comingSoon?: boolean;
  group?: string;
}

interface AppShellProps {
  role: CanonicalRole;
  username: string;
  panelLabel?: string;
  navItems: AppShellNavItem[];
  navGroups?: { key: string; label: string }[];
  activeSection: string;
  onNavigate: (section: string) => void;
  onLogout: () => void;
  pageTitle: string;
  pageSubtitle?: string;
  topbarExtra?: React.ReactNode;
  children: React.ReactNode;
}

// AppShell

export function AppShell({
  role, username, panelLabel, navItems, navGroups, activeSection,
  onNavigate, onLogout, pageTitle, pageSubtitle, topbarExtra, children,
}: AppShellProps) {
  const { t } = useTranslation('common');
  const [sidebarOpen, setSidebarOpen] = useState(false);
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

  const accent = ROLE_ACCENT[role];
  const initials = username.slice(0, 2).toUpperCase();

  function handleNav(key: string, comingSoon?: boolean) {
    if (comingSoon) return;
    onNavigate(key);
    setSidebarOpen(false);
  }

  // Group items: items with group key go under that group
  const ungrouped = navItems.filter(i => !i.group);
  const grouped = navGroups?.map(g => ({
    ...g,
    items: navItems.filter(i => i.group === g.key),
  })) ?? [];

  function SidebarContent() {
    return (
      <>
        {/* Brand */}
        <div className="p-5 border-b border-[#D4D4D8] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#F97316] rounded-lg flex items-center justify-center flex-shrink-0">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#0A0A0A] leading-tight truncate">{t('brand')}</p>
              <p className="text-[11px] text-[#71717A]">{panelLabel ?? `${t(`roles.${role}`)} ${t('panelSuffix')}`}</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav
          className="flex-1 p-3 space-y-0.5 overflow-y-auto min-h-0"
          ref={(el) => { if (el) el.scrollTop = navScrollPos.current; }}
          onScroll={(e) => { navScrollPos.current = e.currentTarget.scrollTop; }}
        >
          {ungrouped.map(item => (
            <NavButton key={item.key} item={item} />
          ))}
          {grouped.map(group => (
            group.items.length > 0 && (
              <div key={group.key}>
                <div className="px-3 pt-4 pb-1.5">
                  <p className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider">{group.label}</p>
                </div>
                {group.items.map(item => (
                  <NavButton key={item.key} item={item} />
                ))}
              </div>
            )
          ))}
        </nav>

        {/* User footer */}
        <div className="p-3 border-t border-[#D4D4D8] flex-shrink-0">
          <div className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-[#FAFAFA] transition-colors">
            <div className={`w-8 h-8 ${accent.avatarBg} rounded-full flex items-center justify-center text-[11px] text-white font-bold flex-shrink-0`}>
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[#0A0A0A] truncate">{username}</p>
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${accent.badge}`}>
                <span className={`w-1 h-1 rounded-full ${accent.dot}`} />{t(`roles.${role}`)}
              </span>
            </div>
            <button onClick={onLogout} title={t('signOut')}
              className="text-[#71717A] hover:text-red-600 transition-colors p-1 rounded flex-shrink-0">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[9px] text-[#D4D4D8] px-2 mt-1.5">{t('version')}</p>
        </div>
      </>
    );
  }

  function NavButton({ item }: { item: AppShellNavItem }) {
    const isActive = activeSection === item.key;
    return (
      <button onClick={() => handleNav(item.key, item.comingSoon)}
        title={item.comingSoon ? t('comingSoon') : item.label}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left group
          ${isActive ? 'bg-[#F97316]/10 text-[#F97316]' : item.comingSoon ? 'text-[#D4D4D8] cursor-default' : 'text-[#0A0A0A] hover:bg-[#FAFAFA] hover:text-[#F97316]'}`}>
        <item.icon className="flex-shrink-0" style={{ width: 17, height: 17 }} />
        <span className={`text-sm flex-1 ${isActive ? 'font-semibold' : 'font-medium'}`}>{item.label}</span>
        {item.comingSoon && (
          <span className="text-[9px] font-semibold px-1.5 py-0.5 bg-[#FAFAFA] text-[#D4D4D8] border border-[#D4D4D8] rounded-md">
            {t('soon')}
          </span>
        )}
        {item.badge && !item.comingSoon && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 bg-[#F97316]/10 text-[#F97316] rounded-md">
            {item.badge}
          </span>
        )}
        {isActive && <span className="w-1.5 h-1.5 rounded-full bg-[#F97316] flex-shrink-0" />}
      </button>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex">

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 bg-white border-r border-[#D4D4D8] flex-col flex-shrink-0 sticky top-0 h-screen">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden" style={{ touchAction: 'none', overscrollBehavior: 'contain' }}>
          <div className="absolute inset-0 bg-[#0A0A0A]/50 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-white flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#D4D4D8] flex-shrink-0">
              <span className="text-sm font-semibold text-[#0A0A0A]">{t('menu')}</span>
              <button onClick={() => setSidebarOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-[#71717A] hover:bg-[#FAFAFA]">
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
            <button onClick={() => setSidebarOpen(true)}
              className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg border border-[#D4D4D8] text-[#0A0A0A] hover:bg-[#FAFAFA] flex-shrink-0">
              <Menu className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-[#0A0A0A] truncate">{pageTitle}</h2>
              {pageSubtitle && <p className="text-[11px] text-[#71717A] truncate hidden sm:block">{pageSubtitle}</p>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {topbarExtra}
            <LanguageSwitcher />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 h-9 px-3">
                  <div className={`w-7 h-7 ${accent.avatarBg} rounded-full flex items-center justify-center flex-shrink-0`}>
                    <span className="text-white text-[10px] font-bold">{initials}</span>
                  </div>
                  <div className="text-left hidden sm:block">
                    <div className="text-xs font-semibold text-[#0A0A0A]">{username}</div>
                    <div className="text-[10px] text-[#71717A]">{t(`roles.${role}`)}</div>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="text-xs text-[#71717A]">{t('signedInAs', { username })}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onLogout} className="gap-2 text-sm text-red-600 focus:text-red-600 cursor-pointer">
                  <LogOut className="w-4 h-4" />{t('signOut')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
