import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Building2, FileClock, LayoutDashboard, LogOut, ShieldAlert } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router';

import { usePlatformAuth } from '../context/PlatformAuthContext';
import { getMe } from '../services/platformDashboard';
import type { PlatformMe } from '../types';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
}

const NAV: NavItem[] = [
  { to: '/platform/overview', label: 'Overview', icon: <LayoutDashboard size={18} /> },
  { to: '/platform/tenants', label: 'Tenants', icon: <Building2 size={18} /> },
  { to: '/platform/audit', label: 'Audit log', icon: <FileClock size={18} /> },
];

/**
 * Shell wrapping every authenticated platform page. Visually distinct
 * from the tenant `AppShell` so super-admins always know "I'm in the
 * vendor console" — slate sidebar, blue accent (vs the tenant orange),
 * and a permanent red banner at the top.
 */
export function PlatformShell({ children }: { children: ReactNode }) {
  const { session, logout } = usePlatformAuth();
  const navigate = useNavigate();
  const [me, setMe] = useState<PlatformMe | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMe()
      .then(m => { if (!cancelled) setMe(m); })
      .catch(() => { /* fall back to session data */ });
    return () => { cancelled = true; };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/platform/login', { replace: true });
  };

  const displayName = me?.fullName ?? session?.fullName ?? '—';
  const displayEmail = me?.email ?? session?.email ?? '';
  const displayRole = me?.role ?? session?.role ?? '';

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-900">
      {/* Permanent banner — visible on every page */}
      <div className="bg-red-600 text-white text-sm py-2 px-4 flex items-center gap-2 justify-center">
        <ShieldAlert size={16} />
        <span className="font-medium">PLATFORM ADMIN — actions are audited and affect real customer data.</span>
      </div>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="w-60 bg-slate-900 text-slate-100 flex flex-col">
          <div className="px-5 py-5 border-b border-slate-800">
            <div className="text-xs uppercase tracking-wider text-slate-400">BuildTrack</div>
            <div className="text-base font-semibold">Platform Console</div>
          </div>

          <nav className="flex-1 px-2 py-3 space-y-1">
            {NAV.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`
                }
              >
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="px-4 py-3 border-t border-slate-800 text-xs text-slate-400">
            <div className="text-slate-200 truncate font-medium" title={displayName}>{displayName}</div>
            <div className="truncate" title={displayEmail}>{displayEmail}</div>
            <div className="mt-1 inline-block px-1.5 py-0.5 bg-slate-800 rounded text-[10px] tracking-wide">
              {displayRole}
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="mt-3 flex items-center gap-2 text-slate-300 hover:text-white text-sm"
            >
              <LogOut size={14} />
              <span>Sign out</span>
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 px-8 py-8 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
