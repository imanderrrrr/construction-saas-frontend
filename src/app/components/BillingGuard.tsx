// BuildTrack — Billing entitlement guard for internal routes.
//
// Wraps any tenant-internal page (dashboards, modules) and checks the local
// billing snapshot via `GET /api/v1/billing/status` before letting the
// caller render. Only enforced for ADMIN — the SaaS billing contract lives
// on the tenant admin, and the backend doesn't (yet) expose this endpoint
// to other roles, so blocking them on a status fetch would just lock them
// out of their own dashboards for no benefit. Non-admin roles pass through
// unchanged and we report this in the task summary as a backend follow-up.
//
// Allowed states (ACTIVE, TRIALING) render the children. Everything else,
// including a null snapshot, an unknown string, or a failed fetch, sends
// the admin to /admin/billing with a `reason=` query so the page can show
// the right copy. We default-deny so backend additions don't silently
// unlock the workspace.

import { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation } from 'react-router';

import { AuthService } from '../services/auth';
import { BillingService } from '../services/billing';
import {
  billingBlockReason,
  isBillingAllowed,
  type BillingBlockReason,
} from '../lib/billing-access';

type GuardState =
  | { phase: 'loading' }
  | { phase: 'allowed' }
  | { phase: 'blocked'; reason: BillingBlockReason };

interface BillingGuardProps {
  children: React.ReactNode;
}

export function BillingGuard({ children }: BillingGuardProps) {
  const location = useLocation();
  const role = AuthService.getRole();
  // Only ADMIN is currently gated. See file header for rationale.
  const enforce = role === 'ADMIN';

  const [state, setState] = useState<GuardState>(
    enforce ? { phase: 'loading' } : { phase: 'allowed' },
  );

  // Guard against late setState after unmount — important because the
  // billing fetch goes through the api() wrapper which can take seconds
  // on a cold backend.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enforce) return;
    let cancelled = false;
    setState({ phase: 'loading' });

    BillingService.getStatus()
      .then((status) => {
        if (cancelled || !mountedRef.current) return;
        if (isBillingAllowed(status?.billingStatus)) {
          setState({ phase: 'allowed' });
        } else {
          setState({
            phase: 'blocked',
            reason: billingBlockReason(status?.billingStatus),
          });
        }
      })
      .catch(() => {
        // Default-deny: a failed status read is treated as "not entitled"
        // so we never let an admin into the dashboard while billing is in
        // an unknown state. The billing page surfaces the error copy.
        if (cancelled || !mountedRef.current) return;
        setState({ phase: 'blocked', reason: 'error' });
      });

    return () => {
      cancelled = true;
    };
    // Re-run when the user navigates between guarded routes so a stale
    // "allowed" decision can't survive a logout-then-login.
  }, [enforce, location.pathname]);

  if (state.phase === 'loading') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-10 h-10 border-3 border-[#F97316] border-t-transparent rounded-full animate-spin"
            aria-hidden="true"
          />
          <p className="text-sm text-[#71717A]">Loading…</p>
        </div>
      </div>
    );
  }

  if (state.phase === 'blocked') {
    return (
      <Navigate
        to={`/admin/billing?reason=${state.reason}`}
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  return <>{children}</>;
}
