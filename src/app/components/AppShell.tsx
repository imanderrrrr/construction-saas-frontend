import React, { useState, useEffect, useMemo } from 'react';
import { Building2, Menu, X, LogOut, UserRound, Search, ArrowRight, Star, History, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';
import { LanguageSwitcher } from './LanguageSwitcher';
import { AccountDrawer } from './account/AccountDrawer';
import { isFieldRole } from './users/shared';
import { workspaceStorageKey } from '../workspace/paths';
import type { CanonicalRole } from '../types';

export interface AppShellNavItem {
  key: string; label: string; icon: React.ElementType;
  badge?: string; comingSoon?: boolean; group?: string; parent?: string;
}
export interface AppShellNavGroup {
  key: string; label: string; icon?: React.ElementType; footer?: boolean;
}
interface AppShellProps {
  role: CanonicalRole; username: string; panelLabel?: string;
  navItems: AppShellNavItem[]; navGroups?: AppShellNavGroup[];
  activeSection: string; onNavigate: (section: string) => void; onLogout: () => void;
  pageTitle: string; pageSubtitle?: string; topbarExtra?: React.ReactNode; children: React.ReactNode;
}
function readKeys(key: string): string[] {
  try { const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]'); return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string').slice(0, 20) : []; } catch { return []; }
}
const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F97316]';

/** Areas in the sidebar; destinations of the active area beside its content. */
export function AppShell({ role, username, panelLabel, navItems, navGroups = [], activeSection, onNavigate, onLogout, pageTitle, topbarExtra, children }: AppShellProps) {
  const { t } = useTranslation('common');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const favoritesKey = workspaceStorageKey(role, username, 'favorites');
  const recentsKey = workspaceStorageKey(role, username, 'recent');
  const [favorites, setFavorites] = useState(() => {
    const scoped = readKeys(favoritesKey);
    let migrated = true;
    try { migrated = localStorage.getItem(favoritesKey) != null; } catch { /* optional */ }
    const old = role === 'ADMIN' && !migrated ? readKeys(`bt.navfavs.${username}`) : [];
    return Array.from(new Set([...scoped, ...old].map(k => k === 'invoices' ? 'accounts-receivable' : k === 'budget-report' ? 'budgets' : k)));
  });
  const eligible = navItems.some(i => i.key === activeSection && !i.comingSoon);
  const recent = useMemo(() => eligible ? [activeSection, ...readKeys(recentsKey).filter(k => k !== activeSection)].slice(0, 8) : readKeys(recentsKey), [activeSection, recentsKey, eligible]);
  const activeItem = navItems.find(i => i.key === activeSection);
  const activeGroup = navGroups.find(g => g.key === activeItem?.group);
  const groups = navGroups.map(g => ({ ...g, items: navItems.filter(i => i.group === g.key) })).filter(g => g.items.length);
  const localItems = navItems.filter(i => i.group && i.group === activeItem?.group);
  const activeParent = activeItem?.parent ?? activeItem?.key;
  const visibleLocal = localItems.filter(i => !i.parent || i.parent === activeParent);

  const initials = username.slice(0, 2).toUpperCase();
  const resolvedPanelLabel = panelLabel ?? `${t(`roles.${role}`)} ${t('panelSuffix')}`;

  useEffect(() => {
    if (!sidebarOpen) return;
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = before; };
  }, [sidebarOpen]);
  useEffect(() => {
    const shortcut = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearchOpen(v => !v); }
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, []);
  useEffect(() => {
    if (!eligible) return;
    try { localStorage.setItem(recentsKey, JSON.stringify(recent)); } catch { /* optional */ }
  }, [eligible, recentsKey, recent]);
  useEffect(() => {
    try { localStorage.setItem(favoritesKey, JSON.stringify(favorites)); } catch { /* optional */ }
  }, [favoritesKey, favorites]);
  function go(key: string) { onNavigate(key); setSidebarOpen(false); setSearchOpen(false); setQuery(''); }
  function pin(key: string) {
    const next = favorites.includes(key) ? favorites.filter(k => k !== key) : [...favorites, key];
    setFavorites(next);
    try { localStorage.setItem(favoritesKey, JSON.stringify(next)); } catch { /* optional */ }
  }
  const matches = useMemo(() => {
    const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const q = normalize(query.trim());
    const items = navItems.filter(i => !i.comingSoon);
    if (q) return items.filter(i => normalize(`${i.label} ${navGroups.find(g => g.key === i.group)?.label ?? ''}`).includes(q));
    return Array.from(new Set([...favorites, ...recent, ...items.map(i => i.key)])).map(k => items.find(i => i.key === k)).filter((i): i is AppShellNavItem => !!i);
  }, [query, navItems, navGroups, favorites, recent]);
  function navButton(item: AppShellNavItem, active = activeSection === item.key) {
    return <button key={item.key} type="button" data-tour={item.key} data-section={item.key} aria-current={active ? 'page' : undefined}
      disabled={item.comingSoon} onClick={() => go(item.key)}
      className={`w-full flex items-center gap-3 px-3 py-3 text-left text-[14px] font-medium transition-colors ${FOCUS} ${active ? 'bg-[#0A0A0A] text-[#FAF7F0]' : 'text-[#5A5346] hover:bg-[#EEE7DA] disabled:opacity-50'}`}>
      <item.icon className="w-[18px] h-[18px] shrink-0" /><span className="flex-1">{item.label}</span>{active && <span className="size-1.5 bg-[#F97316]" />}
    </button>;
  }
  function areaButton(group: typeof groups[number]) {
    const first = group.items[0];
    return navButton({ ...first, label: group.label, icon: group.icon ?? first.icon }, activeGroup?.key === group.key);
  }
  function sidebarContent() {
    return <>
      <div className="px-4 py-5 bg-[#0A0A0A] text-[#FAF7F0]"><div className="flex items-center gap-3"><div className="size-9 bg-[#F97316] flex items-center justify-center"><Building2 className="size-5 text-[#0A0A0A]" /></div><div><p className="font-bt-display font-bold uppercase text-lg leading-none">{t('brand')}</p><p className="text-[11px] text-[#C9BFAE] mt-1.5">{resolvedPanelLabel}</p></div></div></div>
      <nav aria-label={t('workspace.primaryNavigation')} className="flex-1 p-3 space-y-1 overflow-y-auto">{navItems.map((item, index) => {
        if (!item.group) return navButton(item);
        const group = groups.find(g => g.key === item.group);
        return group && !group.footer && navItems.findIndex(i => i.group === item.group) === index ? areaButton(group) : null;
      })}</nav>
      <div className="p-3 border-t border-[#DBD0BB]">{groups.filter(g => g.footer).map(g => areaButton(g))}
        <button data-tour="favorites" type="button" onClick={() => { setSearchOpen(true); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-3 text-sm text-[#5A5346] hover:bg-[#EEE7DA] ${FOCUS}`}><Search className="size-4" />{t('workspace.findSection')}</button>
        {!isFieldRole(role) && <button type="button" onClick={() => setAccountOpen(true)} className={`w-full flex items-center gap-3 px-3 py-2 text-sm text-[#5A5346] ${FOCUS}`}><UserRound className="size-4" />{t('account')}</button>}
        <div className="flex items-center gap-2.5 px-3 pt-3"><div className="size-8 flex items-center justify-center bg-[#0A0A0A] text-[#F97316] text-xs font-semibold">{initials}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{username}</p><p className="text-[11px] text-[#8A8175]">{t(`roles.${role}`)}</p></div><button type="button" onClick={onLogout} aria-label={t('signOut')} className={`p-2 text-[#8A8175] hover:text-[#C2410C] ${FOCUS}`}><LogOut className="size-4" /></button></div>
      </div>
    </>;
  }
  return <div className="min-h-screen bg-[#FAFAFA] flex">
    <a href="#workspace-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-white focus:p-3 focus:shadow-lg">{t('workspace.skipToContent')}</a>
    <aside className="hidden md:flex w-60 bg-[#FAF7F0] border-r border-[#DBD0BB] flex-col shrink-0 sticky top-0 h-screen">{sidebarContent()}</aside>
    {sidebarOpen && <div className="fixed inset-0 z-40 md:hidden"><button type="button" aria-label={t('workspace.closeNavigation')} className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} /><aside className="absolute left-0 top-0 bottom-0 w-72 bg-[#FAF7F0] flex flex-col"><button type="button" aria-label={t('workspace.closeNavigation')} onClick={() => setSidebarOpen(false)} className={`self-end p-3 ${FOCUS}`}><X className="size-5" /></button>{sidebarContent()}</aside></div>}
    <div className="flex-1 flex flex-col min-w-0">
      <header className="min-h-16 bg-[#FAF7F0] border-b border-[#DBD0BB] flex flex-wrap items-center justify-between gap-3 px-4 md:px-6 py-3 sticky top-0 z-30">
        <div className="flex items-center gap-3 min-w-0"><button type="button" aria-label={t('workspace.openNavigation')} onClick={() => setSidebarOpen(true)} className={`md:hidden p-2 border border-[#DBD0BB] ${FOCUS}`}><Menu className="size-5" /></button><nav aria-label={t('workspace.location')} className="flex items-center gap-2 text-sm min-w-0">{activeGroup && <><span className="text-[#8A8175]">{activeGroup.label}</span><span aria-hidden="true" className="text-[#B4A992]">/</span></>}<h2 className="truncate font-semibold text-[#0A0A0A]">{pageTitle}</h2></nav></div>
        <div className="flex items-center gap-2">
          <button type="button" aria-label={t('workspace.findSection')} title={`${t('workspace.findSection')} (Ctrl/⌘ K)`} onClick={() => setSearchOpen(true)} className={`size-9 flex items-center justify-center text-[#5A5346] hover:bg-[#EEE7DA] ${FOCUS}`}><Search className="size-[18px]" /></button>
          {topbarExtra}<LanguageSwitcher variant="shell" />
          <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="sm" aria-label={t('account')} className="h-9 px-2 rounded-none"><span className="size-8 flex items-center justify-center bg-[#0A0A0A] text-[#F97316] text-xs font-semibold">{initials}</span></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-56 rounded-none border-[#DBD0BB]"><DropdownMenuLabel>{t('signedInAs', { username })}</DropdownMenuLabel><DropdownMenuSeparator />{!isFieldRole(role) && <DropdownMenuItem onClick={() => setAccountOpen(true)}><UserRound className="size-4 mr-2" />{t('account')}</DropdownMenuItem>}{role === 'ADMIN' && <DropdownMenuItem onClick={() => go('billing')}><Settings className="size-4 mr-2" />{navItems.find(i => i.key === 'billing')?.label}</DropdownMenuItem>}<DropdownMenuItem onClick={onLogout} className="text-[#C2410C]"><LogOut className="size-4 mr-2" />{t('signOut')}</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
        </div>
      </header>
      {visibleLocal.length > 1 && <nav aria-label={t('workspace.sectionNavigation')} className="flex flex-wrap gap-1 px-4 md:px-8 pt-4 pb-2 border-b border-[#E7E1D5] bg-white">{visibleLocal.map(i => <button type="button" key={i.key} data-section={i.key} data-tour={i.key} aria-current={activeSection === i.key ? 'page' : undefined} onClick={() => go(i.key)} className={`px-3 py-2 text-sm border-b-2 ${FOCUS} ${activeSection === i.key ? 'border-[#F97316] text-[#0A0A0A] font-semibold' : 'border-transparent text-[#5A5346] hover:bg-[#FAF7F0]'} ${i.parent ? 'italic' : ''}`}>{i.label}</button>)}</nav>}
      {!isFieldRole(role) && <AccountDrawer open={accountOpen} onOpenChange={setAccountOpen} onSignOut={onLogout} />}
      <main id="workspace-content" tabIndex={-1} className="flex-1 p-4 md:p-8 min-w-0">{children}</main>
    </div>
    <Dialog open={searchOpen} onOpenChange={setSearchOpen}><DialogContent className="max-w-xl rounded-none"><DialogHeader><DialogTitle>{t('workspace.findSection')}</DialogTitle><DialogDescription>{t('workspace.searchHelp')}</DialogDescription></DialogHeader><input autoFocus aria-label={t('workspace.findSection')} placeholder={t('workspace.searchPlaceholder')} value={query} onChange={e => setQuery(e.target.value)} className={`w-full border border-[#DBD0BB] px-3 py-3 text-base ${FOCUS}`} /><div className="max-h-[50vh] overflow-y-auto space-y-1">{!matches.length && <p className="py-8 text-center text-sm text-[#8A8175]">{t('workspace.noResults')}</p>}{matches.map(item => <div key={item.key} className="flex items-center gap-1"><button type="button" onClick={() => go(item.key)} className={`flex-1 min-w-0 flex items-center gap-3 px-3 py-3 text-left hover:bg-[#FAF7F0] ${FOCUS}`}><item.icon className="size-4 shrink-0" /><span className="flex-1"><span className="block text-sm font-medium">{item.label}</span><span className="block text-xs text-[#8A8175]">{navGroups.find(g => g.key === item.group)?.label ?? resolvedPanelLabel}</span></span>{!query && recent.includes(item.key) ? <History className="size-3.5 text-[#8A8175]" /> : <ArrowRight className="size-3.5 text-[#8A8175]" />}</button><button type="button" aria-label={t(favorites.includes(item.key) ? 'workspace.unpin' : 'workspace.pin', { name: item.label })} onClick={() => pin(item.key)} className={`p-3 ${FOCUS} ${favorites.includes(item.key) ? 'text-[#F97316]' : 'text-[#8A8175]'}`}><Star className="size-4" fill={favorites.includes(item.key) ? 'currentColor' : 'none'} /></button></div>)}</div></DialogContent></Dialog>
  </div>;
}
