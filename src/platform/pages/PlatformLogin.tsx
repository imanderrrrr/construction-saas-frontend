import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import QRCode from 'qrcode';
import { Lock, ShieldCheck } from 'lucide-react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';

import { usePlatformAuth } from '../context/PlatformAuthContext';
import * as platformAuth from '../services/platformAuth';
import type { PlatformLoginResponse, PlatformRole, PlatformSession } from '../types';
import { BuildTrackLogo } from '../../app/components/landing/BuildTrackLogo';
import {
  EASE_OUT,
  FieldError,
  inputCx,
  inputErrTintCx,
  labelCx,
  microLabelCx,
  primaryBtnCx,
  Skeleton,
} from '../components/console';
import '../platform.css';

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
    <MotionConfig reducedMotion="user">
      <div className="flex min-h-screen items-center justify-center bg-bt-paper px-4 font-bt-body text-bt-ink antialiased">
        <motion.div
          className="w-full max-w-[400px]"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: EASE_OUT }}
        >
          <div className="rounded-[14px] border border-bt-rule bg-white px-9 pb-7 pt-[30px] shadow-[0_1px_3px_rgba(23,19,15,0.06)]">
            <div className="flex flex-col items-center text-center">
              <BuildTrackLogo boxPx={28} textPx={17} tone="on-light" />
              <div className="mt-2 flex items-center gap-1.5 text-bt-muted-2">
                <ShieldCheck size={10} strokeWidth={2} />
                <span className="font-bt-mono text-[9.5px] font-semibold tracking-[0.16em]">PLATFORM CONSOLE</span>
              </div>
              <div className="mt-2.5 text-[12.5px] text-bt-muted">Vendor staff only. All actions are audited.</div>
            </div>

            <div className="-mx-9 my-5 h-px bg-bt-rule-3" />

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={stage.kind}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22, ease: EASE_OUT }}
              >
                {stage.kind === 'CREDENTIALS' && (
                  <form onSubmit={submitCredentials} className="flex flex-col gap-3.5">
                    {error && (
                      <div role="alert">
                        <FieldError>{error}</FieldError>
                      </div>
                    )}

                    <div className="flex flex-col gap-1.5">
                      <label className={labelCx} htmlFor="email">Email</label>
                      <input
                        id="email"
                        type="email"
                        required
                        autoComplete="email"
                        spellCheck={false}
                        placeholder="you@buildtrack.example"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className={inputCx}
                        disabled={submitting}
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className={labelCx} htmlFor="password">Password</label>
                      <input
                        id="password"
                        type="password"
                        required
                        autoComplete="current-password"
                        placeholder="••••••••"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className={inputCx}
                        disabled={submitting}
                      />
                    </div>

                    <button type="submit" disabled={submitting} className={`${primaryBtnCx} mt-1 h-10 w-full`}>
                      {submitting ? 'Signing in…' : 'Continue'}
                    </button>

                    <div className="mt-0.5 flex items-center justify-center gap-1.5 text-bt-muted-2">
                      <Lock size={11} strokeWidth={2} />
                      <span className="text-[11.5px]">Staff-only. Every session and action is audited.</span>
                    </div>
                  </form>
                )}

                {stage.kind === 'ENROLL' && (
                  <form onSubmit={submitMfa} className="flex flex-col">
                    <h1 className="font-bt-heading text-[15px] font-bold text-bt-ink">Set up two-factor authentication.</h1>
                    <p className="mt-1.5 text-[12.5px] leading-normal text-bt-muted">
                      Scan the QR code with Google Authenticator, 1Password, Authy, or any
                      TOTP-compatible app. Then enter the 6-digit code shown in the app.
                    </p>

                    <div className="mx-auto mt-[18px] w-[220px]">
                      {qrDataUrl ? (
                        <img
                          src={qrDataUrl}
                          alt="MFA setup QR code"
                          className="w-[220px] rounded-[10px] border border-bt-rule"
                        />
                      ) : (
                        <Skeleton className="h-[220px] w-[220px] rounded-[10px]" />
                      )}
                    </div>

                    <div className="mt-4">
                      <div className={`${microLabelCx} mb-1.5`}>Can't scan? Enter this key instead</div>
                      <div className="cursor-text select-all rounded-[7px] border border-bt-rule-2 bg-bt-paper px-2.5 py-2 text-center font-bt-mono text-[12.5px] font-semibold tracking-[0.08em] text-bt-ink">
                        {stage.secret}
                      </div>
                    </div>

                    <div className="mt-4">
                      <CodeInput value={code} onChange={setCode} disabled={submitting} invalid={!!error} />
                      {error && (
                        <div role="alert" className="mt-1.5">
                          <FieldError>{error}</FieldError>
                        </div>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={submitting || code.length !== 6}
                      className={`${primaryBtnCx} mt-4 h-10 w-full`}
                    >
                      {submitting ? 'Verifying…' : 'Enable 2FA'}
                    </button>
                    <RestartLink onClick={restart} disabled={submitting} />
                  </form>
                )}

                {stage.kind === 'VERIFY' && (
                  <form onSubmit={submitMfa} className="flex flex-col">
                    <h1 className="font-bt-heading text-[15px] font-bold text-bt-ink">Verify it's you</h1>
                    <p className="mt-1.5 text-[12.5px] leading-normal text-bt-muted">
                      Enter the code from your authenticator app.
                    </p>

                    <div className="mt-4">
                      <CodeInput value={code} onChange={setCode} disabled={submitting} invalid={!!error} />
                      {error && (
                        <div role="alert" className="mt-1.5">
                          <FieldError>{error}</FieldError>
                        </div>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={submitting || code.length !== 6}
                      className={`${primaryBtnCx} mt-4 h-10 w-full`}
                    >
                      {submitting ? 'Verifying…' : 'Verify'}
                    </button>
                    <RestartLink onClick={restart} disabled={submitting} />
                  </form>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </MotionConfig>
  );
}

function RestartLink({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="mx-auto mt-3.5 cursor-pointer text-xs font-medium text-bt-muted underline underline-offset-2 transition-colors hover:text-bt-ink disabled:opacity-60"
    >
      Use a different account
    </button>
  );
}

function CodeInput({
  value,
  onChange,
  disabled,
  invalid,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  invalid?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className={labelCx}>6-digit code</label>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d{6}"
        maxLength={6}
        required
        autoFocus
        spellCheck={false}
        value={value}
        onChange={e => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        disabled={disabled}
        placeholder="000000"
        className={`h-[52px] w-full rounded-[10px] border px-3 text-center font-bt-mono text-[22px] font-semibold tracking-[0.35em] text-bt-ink outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-bt-muted-2 focus:border-bt-orange focus:shadow-[0_0_0_3px_rgba(249,115,22,0.18)] disabled:opacity-60 ${invalid ? inputErrTintCx : 'border-bt-rule bg-white'}`}
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
