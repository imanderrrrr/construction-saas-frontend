import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Building2, FileClock, LayoutDashboard, LogOut, ShieldCheck, TriangleAlert } from 'lucide-react';
import { NavLink, useLocation, useNavigate, useOutlet } from 'react-router';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';

import { usePlatformAuth } from '../context/PlatformAuthContext';
import { getMe } from '../services/platformDashboard';
import type { PlatformMe } from '../types';
import { BuildTrackLogo } from '../../app/components/landing/BuildTrackLogo';
import { EASE_OUT } from './console';
import '../platform.css';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
}

const NAV: NavItem[] = [
  { to: '/platform/overview', label: 'Overview', icon: <LayoutDashboard size={16} strokeWidth={1.8} /> },
  { to: '/platform/tenants', label: 'Tenants', icon: <Building2 size={16} strokeWidth={1.8} /> },
  { to: '/platform/audit', label: 'Audit log', icon: <FileClock size={16} strokeWidth={1.8} /> },
];

/**
 * Shell wrapping every authenticated platform page. Now the BuildTrack brand
 * skin (warm paper + ink sidebar + the one orange accent) per the approved
 * Claude Design reference, but still visually distinct from the tenant
 * `AppShell`: brand display faces, a permanent red audit banner, and mono
 * identifiers everywhere.
 *
 * Mounted as the `/platform` layout route: pages render through the router
 * outlet, and route changes cross-fade (AnimatePresence keyed by pathname).
 * `children` is still accepted so the shell also works standalone.
 */
export function PlatformShell({ children }: { children?: ReactNode }) {
  const { session, logout } = usePlatformAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const outlet = useOutlet();
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
  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(w => w[0])
      .join('')
      .toUpperCase() || 'PC';

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex min-h-screen flex-col bg-bt-paper font-bt-body text-bt-ink antialiased">
        {/* Permanent banner — visible on every page */}
        <div className="flex h-[34px] flex-none items-center justify-center gap-2.5 bg-[#B42318] text-white">
          <TriangleAlert size={13} strokeWidth={2.2} />
          <span className="font-bt-mono text-[11px] font-semibold tracking-[0.09em]">PLATFORM ADMIN</span>
          <span className="text-xs font-medium text-white/90">— actions are audited and affect real customer data.</span>
        </div>

        <div className="flex min-h-0 flex-1">
          {/* Sidebar */}
          <aside className="flex w-[236px] flex-none flex-col bg-bt-ink px-3 pb-4 pt-5 text-bt-paper">
            <div className="mb-3.5 border-b border-bt-paper/10 px-2 pb-4">
              <BuildTrackLogo boxPx={34} textPx={15.5} tone="on-dark" />
              <div className="mt-1.5 flex items-center gap-1.5 pl-[44px] text-bt-muted-2">
                <ShieldCheck size={10} strokeWidth={2} />
                <span className="font-bt-mono text-[9px] font-semibold tracking-[0.14em]">PLATFORM CONSOLE</span>
              </div>
            </div>

            <div className="px-2.5 pb-2 pt-1 font-bt-mono text-[9.5px] font-semibold tracking-[0.16em] text-bt-muted-2">
              CONSOLE
            </div>
            <nav className="flex flex-col gap-0.5">
              {NAV.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors ${
                      isActive
                        ? 'bg-bt-orange font-semibold text-bt-ink shadow-[0_1px_2px_rgba(23,19,15,0.4)] hover:bg-bt-orange-hover'
                        : 'font-medium text-bt-paper-2 hover:bg-bt-paper/[0.07] hover:text-bt-paper'
                    }`
                  }
                >
                  {item.icon}
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>

            <div className="flex-1" />

            <div className="border-t border-bt-paper/10 px-2 pt-3">
              <div className="flex items-center gap-2.5">
                <div className="flex size-7 flex-none items-center justify-center rounded-full bg-[#3A3126] font-bt-mono text-[10px] font-semibold tracking-[0.05em] text-bt-paper-2">
                  {initials}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold text-bt-paper-2" title={displayName}>{displayName}</div>
                  <div className="truncate font-bt-mono text-[10px] text-bt-muted-2" title={displayEmail}>{displayEmail}</div>
                </div>
              </div>
              <div className="mt-2 inline-block rounded border border-bt-paper/15 px-1.5 py-0.5 font-bt-mono text-[9px] font-semibold tracking-[0.12em] text-bt-muted-2">
                {displayRole}
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="mt-3 flex cursor-pointer items-center gap-2 text-[13px] font-medium text-bt-paper-2 transition-colors hover:text-bt-paper"
              >
                <LogOut size={14} />
                <span>Sign out</span>
              </button>
            </div>
          </aside>

          {/* Main — route changes cross-fade */}
          <main className="min-w-0 flex-1 overflow-auto">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE_OUT } }}
                exit={{ opacity: 0, transition: { duration: 0.12 } }}
              >
                <div className="mx-auto w-full max-w-[1072px] px-11 pb-14 pt-9">{children ?? outlet}</div>
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </MotionConfig>
  );
}
