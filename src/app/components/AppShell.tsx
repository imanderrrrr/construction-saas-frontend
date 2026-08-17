import React, { useState, useEffect, useRef } from 'react';
import { Building2, Menu, X, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { LanguageSwitcher } from './LanguageSwitcher';
import { CanonicalRole } from '../types';

// Industrial chassis — the frame speaks the same language as the content:
// mono uppercase, sand/cream surfaces, square corners, ink fills, orange as
// the only accent. Mirrors labor/shared.tsx. Any change here must be applied
// to the sibling copies in pages/AdminDashboard.tsx and
// pages/WarehouseDashboard.tsx, which keep the same markup by hand.

const GRID_INK: React.CSSProperties = {
  backgroundImage:
    'linear-gradient(rgba(245,241,232,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(245,241,232,0.055) 1px, transparent 1px)',
  backgroundSize: '24px 24px',
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
  /** Kept for callers; the masthead identifies the section by title alone —
   *  the content below carries its own description. */
  pageSubtitle?: string;
  topbarExtra?: React.ReactNode;
  children: React.ReactNode;
}

// AppShell

export function AppShell({
  role, username, panelLabel, navItems, navGroups, activeSection,
  onNavigate, onLogout, pageTitle, topbarExtra, children,
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

  const initials = username.slice(0, 2).toUpperCase();
  const resolvedPanelLabel = panelLabel ?? `${t(`roles.${role}`)} ${t('panelSuffix')}`;

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
        {/* Brand plate */}
        <div className="px-4 py-4 bg-[#0A0A0A] flex-shrink-0" style={GRID_INK}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#F97316] flex items-center justify-center flex-shrink-0">
              <Building2 className="w-5 h-5 text-[#0A0A0A]" />
            </div>
            <div className="min-w-0">
              <p className="font-bt-display font-bold uppercase text-[16px] leading-none text-[#F5F1E8] truncate">{t('brand')}</p>
              <p className="font-bt-mono text-[8.5px] uppercase tracking-[0.16em] text-[#B4A992] mt-1 truncate">{resolvedPanelLabel}</p>
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
                  <p className="font-bt-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-[#A69C8D]">{group.label}</p>
                </div>
                {group.items.map(item => (
                  <NavButton key={item.key} item={item} />
                ))}
              </div>
            )
          ))}
        </nav>

        {/* User footer */}
        <div className="p-3 border-t border-[#DBD0BB] flex-shrink-0">
          <div className="flex items-center gap-2.5 p-2">
            <div className="w-9 h-9 bg-[#0A0A0A] flex items-center justify-center font-bt-mono text-[11px] font-semibold text-[#F97316] flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bt-mono text-[11px] font-semibold text-[#0A0A0A] truncate">{username}</p>
              <p className="font-bt-mono text-[8.5px] uppercase tracking-[0.14em] text-[#8A8175] mt-0.5 truncate">{t(`roles.${role}`)}</p>
            </div>
            <button onClick={onLogout} title={t('signOut')}
              className="p-1.5 text-[#8A8175] hover:text-[#C2410C] hover:bg-[#F3EEE4] transition-colors flex-shrink-0">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="font-bt-mono text-[8px] uppercase tracking-[0.1em] text-[#B4A992] px-2 mt-1.5">{t('version')}</p>
        </div>
      </>
    );
  }

  function NavButton({ item }: { item: AppShellNavItem }) {
    const isActive = activeSection === item.key;
    return (
      <button onClick={() => handleNav(item.key, item.comingSoon)}
        title={item.comingSoon ? t('comingSoon') : item.label}
        className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors group font-bt-mono text-[10.5px] font-medium uppercase tracking-[0.07em]
          ${isActive ? 'bg-[#0A0A0A] text-[#F5F1E8]' : item.comingSoon ? 'text-[#C6BCA8] cursor-default' : 'text-[#5A5346] hover:bg-[#F3EEE4] hover:text-[#0A0A0A]'}`}>
        <item.icon className="flex-shrink-0" style={{ width: 15, height: 15 }} />
        <span className={`flex-1 ${isActive ? 'font-semibold' : ''}`}>{item.label}</span>
        {item.comingSoon && (
          <span className="font-bt-mono text-[8.5px] uppercase tracking-[0.05em] px-1.5 py-0.5 border border-[#DBD0BB] text-[#A69C8D]">
            {t('soon')}
          </span>
        )}
        {item.badge && !item.comingSoon && (
          <span className="font-bt-mono text-[8.5px] font-bold uppercase tracking-[0.05em] px-1.5 py-0.5 bg-[#F97316] text-[#0A0A0A]">
            {item.badge}
          </span>
        )}
        {isActive && <span className="w-1.5 h-1.5 bg-[#F97316] flex-shrink-0" />}
      </button>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex">

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 bg-[#FAF7F0] border-r border-[#DBD0BB] flex-col flex-shrink-0 sticky top-0 h-screen">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden" style={{ touchAction: 'none', overscrollBehavior: 'contain' }}>
          <div className="absolute inset-0 bg-[#0A0A0A]/50 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-[#FAF7F0] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#DBD0BB] flex-shrink-0">
              <span className="font-bt-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#0A0A0A]">{t('menu')}</span>
              <button onClick={() => setSidebarOpen(false)}
                className="w-8 h-8 flex items-center justify-center text-[#8A8175] hover:bg-[#F3EEE4] hover:text-[#0A0A0A]">
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

        {/* Topbar — identity + context + actions; the content below carries
            its own display title, so the masthead only whispers where you are. */}
        <header className="h-14 bg-[#FAF7F0] border-b border-[#0A0A0A] flex items-center justify-between px-4 md:px-6 flex-shrink-0 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setSidebarOpen(true)}
              className="md:hidden w-9 h-9 flex items-center justify-center border border-[#0A0A0A] text-[#0A0A0A] hover:bg-[#F3EEE4] flex-shrink-0">
              <Menu className="w-4 h-4" />
            </button>
            <h2 className="min-w-0 truncate font-bt-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#0A0A0A]">
              <span className="text-[#8A8175] hidden sm:inline">{resolvedPanelLabel} · </span>{pageTitle}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {topbarExtra}
            <LanguageSwitcher variant="shell" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 h-9 px-2 rounded-none hover:bg-[#F3EEE4]">
                  <div className="w-7 h-7 bg-[#0A0A0A] flex items-center justify-center flex-shrink-0">
                    <span className="font-bt-mono text-[10px] font-semibold text-[#F97316]">{initials}</span>
                  </div>
                  <div className="text-left hidden sm:block">
                    <div className="font-bt-mono text-[10.5px] font-semibold text-[#0A0A0A]">{username}</div>
                    <div className="font-bt-mono text-[8.5px] uppercase tracking-[0.1em] text-[#8A8175]">{t(`roles.${role}`)}</div>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-none border-[#DBD0BB]">
                <DropdownMenuLabel className="font-bt-mono text-[10px] uppercase tracking-[0.08em] text-[#8A8175]">{t('signedInAs', { username })}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onLogout} className="gap-2 text-sm text-[#C2410C] focus:text-[#C2410C] cursor-pointer">
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
