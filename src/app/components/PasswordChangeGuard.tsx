// BuildTrack — stands between an authenticated user and the app while their
// password is still the one an admin issued.
//
// Sits inside ProtectedRoute, so it covers every internal page at once and the
// role routing above it is untouched: the user is sent to the dashboard their
// role earns them exactly as before, and this decides what renders there.
// That ordering is the product requirement — land in your workspace, and the
// first thing it asks you is to replace the temporary password.
//
// It renders the change screen INSTEAD of the children rather than navigating
// somewhere else, which keeps the URL on the dashboard and means the moment
// the password is set the same route just renders normally.
//
// This is presentation only. The wall is TemporaryPasswordFilter on the
// backend; if this component were deleted the API would still refuse
// everything. What it buys is that the user sees a form instead of a wall of
// 403s.

import { useEffect, useRef, useState } from 'react';

import { AuthService } from '../services/auth';
import {
  getPasswordChangeRequired,
  setPasswordChangeRequired,
} from '../lib/passwordChangeState';
import { ForcedPasswordChange } from './ForcedPasswordChange';

type GuardState = 'checking' | 'required' | 'clear';

interface PasswordChangeGuardProps {
  children: React.ReactNode;
}

export function PasswordChangeGuard({ children }: PasswordChangeGuardProps) {
  // Seed from what login already told us, so the common path renders without
  // a round trip. `null` means this tab has not learned the answer yet —
  // typically a session restored from its cookie, which never saw a
  // LoginResponse.
  const known = getPasswordChangeRequired();
  const [state, setState] = useState<GuardState>(
    known === null ? 'checking' : known ? 'required' : 'clear',
  );

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (state !== 'checking') return;
    let cancelled = false;

    // Deliberately started from a resolved promise: a SYNCHRONOUS throw out of
    // getMe (a stubbed service, a bad build) would otherwise escape the effect
    // and blank the whole app, on a component that wraps every internal route.
    // This routes it into the same fail-open catch as a rejected request.
    Promise.resolve()
      .then(() => AuthService.getMe())
      .then((me) => {
        if (cancelled || !mountedRef.current) return;
        const required = me.passwordChangeRequired === true;
        setPasswordChangeRequired(required);
        setState(required ? 'required' : 'clear');
      })
      .catch(() => {
        // Fail OPEN, unlike BillingGuard's default-deny. The backend is the
        // wall here: if this read failed but the password really is temporary,
        // the very next call the dashboard makes comes back
        // PASSWORD_CHANGE_REQUIRED and api() routes the user here anyway.
        // Failing closed would instead strand a user whose password is fine
        // behind a form they cannot complete, every time /auth/me blips.
        if (cancelled || !mountedRef.current) return;
        setState('clear');
      });

    return () => { cancelled = true; };
  }, [state]);

  if (state === 'checking') {
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

  if (state === 'required') {
    return <ForcedPasswordChange onChanged={() => setState('clear')} />;
  }

  return <>{children}</>;
}
