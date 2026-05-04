import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import QRCode from 'qrcode';
import { ShieldAlert } from 'lucide-react';

import { usePlatformAuth } from '../context/PlatformAuthContext';
import * as platformAuth from '../services/platformAuth';
import type { PlatformLoginResponse, PlatformRole, PlatformSession } from '../types';

type Stage =
  | { kind: 'CREDENTIALS' }
  | { kind: 'ENROLL'; challengeToken: string; secret: string; otpAuthUri: string }
  | { kind: 'VERIFY'; challengeToken: string };

/**
 * Three-stage login state machine:
 *
 *   CREDENTIALS → email + password → POST /login
 *     → ENROLL (first ever login, render QR + 6-digit code input)
 *     → VERIFY (subsequent logins, just 6-digit code)
 *   ENROLL  → POST /mfa-enroll
 *   VERIFY  → POST /mfa-verify
 *   on SUCCESS → store session → navigate /platform/overview
 *
 * On any error in the MFA stages the user can re-enter the code; the
 * 5-minute challengeToken stays the same (the backend rate-limits
 * code attempts per challenge).
 */
export function PlatformLogin() {
  const { setSession, isAuthenticated } = usePlatformAuth();
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>({ kind: 'CREDENTIALS' });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Credentials form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');

  // Pre-rendered QR data URL when we land in ENROLL.
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  // If somebody hits /platform/login already authenticated, bounce them.
  useEffect(() => {
    if (isAuthenticated) navigate('/platform/overview', { replace: true });
  }, [isAuthenticated, navigate]);

  // Render QR whenever we move into ENROLL. Done as a side-effect (not
  // inline in render) because qrcode.toDataURL is async.
  useEffect(() => {
    if (stage.kind !== 'ENROLL') {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(stage.otpAuthUri, { width: 220, margin: 1 })
      .then(url => { if (!cancelled) setQrDataUrl(url); })
      .catch(() => { if (!cancelled) setQrDataUrl(null); });
    return () => { cancelled = true; };
  }, [stage]);

  const persistSuccessAndGo = (resp: PlatformLoginResponse) => {
    // refreshToken is currently emitted by the backend but no
    // /platform/auth/refresh endpoint exists yet to redeem it (see
    // JwtService.generatePlatformRefreshToken docstring — audit Camino A
    // hallazgo H4). Don't gate the login on its presence; super-admins
    // re-login when the access token expires.
    if (resp.status !== 'SUCCESS' || !resp.accessToken) {
      setError('Unexpected response from server.');
      return;
    }
    const session: PlatformSession = {
      accessToken: resp.accessToken,
      refreshToken: resp.refreshToken,
      role: (resp.role ?? 'SUPPORT') as PlatformRole,
      email: resp.email ?? email,
      fullName: resp.fullName ?? '',
      expiresAt: Date.now() + (resp.expiresInMinutes ?? 60) * 60 * 1000,
    };
    setSession(session);
    navigate('/platform/overview', { replace: true });
  };

  const submitCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const resp = await platformAuth.login(email.trim(), password);
      if (resp.status === 'ENROLLMENT_REQUIRED' && resp.challengeToken && resp.secret && resp.otpAuthUri) {
        setStage({ kind: 'ENROLL', challengeToken: resp.challengeToken, secret: resp.secret, otpAuthUri: resp.otpAuthUri });
      } else if (resp.status === 'MFA_REQUIRED' && resp.challengeToken) {
        setStage({ kind: 'VERIFY', challengeToken: resp.challengeToken });
      } else {
        setError('Unexpected login response.');
      }
    } catch (err) {
      setError(extractMessage(err) ?? 'Sign-in failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (stage.kind === 'CREDENTIALS') return;
    setError(null);
    setSubmitting(true);
    try {
      const resp =
        stage.kind === 'ENROLL'
          ? await platformAuth.enrollMfa(stage.challengeToken, code.trim())
          : await platformAuth.verifyMfa(stage.challengeToken, code.trim());
      persistSuccessAndGo(resp);
    } catch (err) {
      setError(extractMessage(err) ?? 'Authentication code rejected.');
      setCode('');
    } finally {
      setSubmitting(false);
    }
  };

  const restart = () => {
    setStage({ kind: 'CREDENTIALS' });
    setCode('');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white shadow-lg rounded-lg overflow-hidden">
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center gap-2">
          <ShieldAlert size={18} className="text-red-400" />
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-400">BuildTrack</div>
            <div className="text-base font-semibold">Platform Console</div>
          </div>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {error}
            </div>
          )}

          {stage.kind === 'CREDENTIALS' && (
            <form onSubmit={submitCredentials} className="space-y-4">
              <h1 className="text-xl font-semibold">Sign in</h1>
              <p className="text-sm text-slate-600">
                Vendor staff only. All actions are audited.
              </p>

              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:border-blue-500"
                  disabled={submitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:border-blue-500"
                  disabled={submitting}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2 rounded font-medium transition-colors"
              >
                {submitting ? 'Signing in…' : 'Continue'}
              </button>
            </form>
          )}

          {stage.kind === 'ENROLL' && (
            <form onSubmit={submitMfa} className="space-y-4">
              <h1 className="text-xl font-semibold">Set up two-factor</h1>
              <p className="text-sm text-slate-600">
                Scan the QR code with Google Authenticator, 1Password, Authy, or any
                TOTP-compatible app. Then enter the 6-digit code shown in the app.
              </p>

              <div className="flex flex-col items-center bg-slate-50 border border-slate-200 rounded p-4">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="MFA setup QR code" className="rounded" />
                ) : (
                  <div className="w-[220px] h-[220px] bg-slate-200 animate-pulse rounded" />
                )}
                <div className="mt-3 text-xs text-slate-600">
                  Or paste this secret manually:{' '}
                  <code className="px-2 py-0.5 bg-slate-200 rounded font-mono">{stage.secret}</code>
                </div>
              </div>

              <CodeInput value={code} onChange={setCode} disabled={submitting} />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={restart}
                  disabled={submitting}
                  className="px-3 py-2 border border-slate-300 rounded text-sm text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || code.length !== 6}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2 rounded font-medium"
                >
                  {submitting ? 'Verifying…' : 'Activate'}
                </button>
              </div>
            </form>
          )}

          {stage.kind === 'VERIFY' && (
            <form onSubmit={submitMfa} className="space-y-4">
              <h1 className="text-xl font-semibold">Authentication code</h1>
              <p className="text-sm text-slate-600">
                Enter the 6-digit code from your authenticator app.
              </p>

              <CodeInput value={code} onChange={setCode} disabled={submitting} />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={restart}
                  disabled={submitting}
                  className="px-3 py-2 border border-slate-300 rounded text-sm text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || code.length !== 6}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2 rounded font-medium"
                >
                  {submitting ? 'Verifying…' : 'Sign in'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function CodeInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">Authentication code</label>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d{6}"
        maxLength={6}
        required
        autoFocus
        value={value}
        onChange={e => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        disabled={disabled}
        placeholder="000000"
        className="w-full px-3 py-3 text-center text-2xl tracking-[0.5em] font-mono border border-slate-300 rounded focus:outline-none focus:border-blue-500"
      />
    </div>
  );
}

function extractMessage(err: unknown): string | null {
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === 'string') return m;
  }
  return null;
}
