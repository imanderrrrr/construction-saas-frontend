/** Shared bits for the Usuarios screens (roster, drawer, new-user flow). */

import { cn } from '../ui/utils';

export type AccessKind = 'FIELD' | 'OFFICE';

/** Roles that sign in on the phone with QR + PIN (no password). */
export const FIELD_ROLES = ['WORKER', 'SUPERVISOR', 'SUBCONTRACTOR'] as const;

export function isFieldRole(role: string): boolean {
  return (FIELD_ROLES as readonly string[]).includes(role);
}

export function initials(fullName: string | null | undefined, username: string): string {
  const base = (fullName && fullName.trim()) || username;
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** Six random digits — the PIN the admin dictates to the worker. */
export function randomPin(): string {
  return Array.from({ length: 6 }, () => Math.floor(Math.random() * 10)).join('');
}

/** Temp password for office users; they change it on first sign-in. */
export function randomPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const pick = () => alphabet[Math.floor(Math.random() * alphabet.length)];
  return `${Array.from({ length: 4 }, pick).join('')}-${Array.from({ length: 4 }, pick).join('')}`;
}

export function Mono({ children, className = '', style }: {
  children: React.ReactNode; className?: string; style?: React.CSSProperties;
}) {
  // cn() (tailwind-merge), NOT template interpolation. Both `uppercase` and
  // `normal-case` set text-transform, so with plain interpolation BOTH land in
  // the class attribute and the winner is decided by the order Tailwind emits
  // them in the stylesheet — where `.uppercase` comes after `.normal-case`.
  // The base `uppercase` therefore beat every caller that asked for
  // `normal-case`, no matter how the attribute was written.
  //
  // That silently upper-cased the temporary password on the new-user
  // credential card: the admin read "LA7R-MHC7" while "LA7r-MHC7" was what
  // got stored, so the handover password was rejected as invalid. The
  // username right above it was mangled the same way. cn() resolves the
  // conflict in the class string instead, so the last utility wins.
  return (
    <span className={cn('font-bt-mono uppercase tracking-[0.1em]', className)} style={style}>
      {children}
    </span>
  );
}

/** Blueprint grid used on ink surfaces, same motif as the dashboard. */
export const GRID_INK: React.CSSProperties = {
  backgroundImage:
    'linear-gradient(rgba(245,241,232,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(245,241,232,0.055) 1px, transparent 1px)',
  backgroundSize: '26px 26px',
};
