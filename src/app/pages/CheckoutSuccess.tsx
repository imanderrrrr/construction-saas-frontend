// BuildTrack — Public success page after Paddle Checkout.
//
// Two flavours of caller land here:
//
// 1. Brand-new customers who just paid for a fresh workspace. Their
//    /signup/checkout call left a `signupIntentId` in sessionStorage —
//    on mount we exchange that for a real tenant + admin session by
//    calling `/api/v1/signup/complete`. This is the ONLY moment the
//    new tenant is materialised; before payment, nothing has been
//    created server-side.
//
// 2. Existing-tenant admins coming back from /admin/billing → Paddle
//    (upgrade / change-plan flow). They have NO signupIntentId in
//    sessionStorage. For them this page stays intentionally INERT
//    (the BillingGuard / webhook activates them) — same behaviour as
//    before the signup intent refactor.
//
// Activation of billing state itself is STILL driven by the signed
// Paddle webhook server-side. The completion call here just creates
// the tenant + admin so the customer can sign in. BillingGuard handles
// the moment the webhook confirms / rejects the subscription.

import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  CheckCircle2,
  HardHat,
  Loader2,
  AlertCircle,
} from 'lucide-react';

import { Button } from '../components/ui/button';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { ApiError } from '../lib/api';
import {
  SignupService,
  readSignupIntent,
  clearSignupIntent,
} from '../services/signup';

function BuildTrackLogo({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-2 font-semibold tracking-tight ${className}`}
    >
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#F97316] text-white">
        <HardHat className="w-5 h-5" aria-hidden="true" />
      </span>
      <span>
        Build<span className="text-[#F97316]">Track</span>
      </span>
    </span>
  );
}

// Two view states (besides the "no intent — show neutral message"
// legacy path): completing the signup, and an inline error if it fails.
type CompletionState =
  | { status: 'idle' }
  | { status: 'completing' }
  | { status: 'waiting' }
  | { status: 'completed' }
  | { status: 'failed'; reason: 'expired' | 'failed' | 'generic' };

export function CheckoutSuccess() {
  const { t } = useTranslation('billing');
  const navigate = useNavigate();
  const ranRef = useRef(false);
  const [state, setState] = useState<CompletionState>({ status: 'idle' });

  useEffect(() => {
    // React 18 StrictMode mounts effects twice in dev; guard against
    // running the completion call more than once per tab life.
    if (ranRef.current) return;
    ranRef.current = true;

    const stored = readSignupIntent();
    if (!stored) {
      // Legacy / billing-upgrade path: stay inert.
      return;
    }

    const intentId = stored.signupIntentId;
    setState({ status: 'completing' });

    SignupService.completeSignup({ signupIntentId: intentId })
      .then(() => {
        clearSignupIntent();
        setState({ status: 'completed' });
      })
      .catch((err: unknown) => {
        // Idempotent re-entry: a second completion of the same intent
        // returns 409 with SIGNUP_INTENT_ALREADY_COMPLETED. That just
        // means another tab / refresh already created the workspace —
        // drop the local intent and route to login.
        if (err instanceof ApiError && err.code === 'SIGNUP_INTENT_ALREADY_COMPLETED') {
          clearSignupIntent();
          navigate('/login');
          return;
        }
        if (err instanceof ApiError && err.code === 'SIGNUP_INTENT_EXPIRED') {
          clearSignupIntent();
          setState({ status: 'failed', reason: 'expired' });
          return;
        }
        if (
          err instanceof ApiError &&
          (err.code === 'SIGNUP_INTENT_FAILED' ||
            err.code === 'SIGNUP_PAYMENT_FAILED')
        ) {
          clearSignupIntent();
          setState({ status: 'failed', reason: 'failed' });
          return;
        }
        if (
          err instanceof ApiError &&
          (err.code === 'SIGNUP_PAYMENT_NOT_CONFIRMED' ||
            err.code === 'SIGNUP_INTENT_NOT_PAID')
        ) {
          setState({ status: 'waiting' });
          return;
        }
        // Anything else (network, 5xx) is recoverable from a refresh.
        // We keep the intent in storage so the user can retry simply by
        // reloading the page; we only clear it on terminal codes above.
        setState({ status: 'failed', reason: 'generic' });
      });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-white text-[#0A0A0A] flex flex-col">
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-[#F4F4F5]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <BuildTrackLogo className="text-lg" />
          <nav className="flex items-center gap-3">
            <LanguageSwitcher />
          </nav>
        </div>
      </header>

      <main className="flex-1 relative overflow-hidden flex items-center">
        <div className="absolute inset-0 -z-10">
          <div className="absolute -top-40 -right-32 w-[28rem] h-[28rem] rounded-full bg-[#F97316]/10 blur-3xl" />
          <div className="absolute -bottom-40 -left-32 w-[28rem] h-[28rem] rounded-full bg-[#0A0A0A]/5 blur-3xl" />
        </div>

        <div className="max-w-3xl mx-auto px-6 py-20 w-full">
          {state.status === 'completing' && (
            <div
              role="status"
              data-testid="signup-completing"
              className="rounded-2xl bg-[#0A0A0A] text-white p-8 sm:p-10"
            >
              <div className="flex flex-col items-start gap-6">
                <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#F97316]/15 text-[#F97316]">
                  <Loader2 className="w-7 h-7 animate-spin" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-xs font-semibold tracking-widest text-[#F97316] uppercase mb-3">
                    BuildTrack
                  </p>
                  <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight leading-tight mb-4">
                    {t('success.completing.title')}
                  </h1>
                  <p className="text-sm sm:text-base text-white/80 leading-relaxed">
                    {t('success.completing.body')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {state.status === 'waiting' && (
            <div
              role="status"
              data-testid="signup-waiting"
              className="rounded-2xl border border-amber-200 bg-amber-50 p-8 sm:p-10"
            >
              <div className="flex flex-col items-start gap-6">
                <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-100 text-amber-700">
                  <Loader2 className="w-7 h-7 animate-spin" aria-hidden="true" />
                </span>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight leading-tight text-amber-950 mb-4">
                    {t('success.waiting.title')}
                  </h1>
                  <p className="text-sm sm:text-base text-amber-900 leading-relaxed">
                    {t('success.waiting.body')}
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="h-12 px-7 text-base bg-[#F97316] hover:bg-[#C2410C] text-white"
                >
                  {t('success.waiting.cta.refresh')}
                </Button>
              </div>
            </div>
          )}

          {(state.status === 'idle' || state.status === 'completed') && (
            <div
              data-testid="signup-success"
              className="rounded-2xl bg-[#0A0A0A] text-white p-8 sm:p-10"
            >
              <div className="flex flex-col items-start gap-6">
                <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#F97316]/15 text-[#F97316]">
                  <CheckCircle2 className="w-7 h-7" aria-hidden="true" />
                </span>

                <div>
                  <p className="text-xs font-semibold tracking-widest text-[#F97316] uppercase mb-3">
                    BuildTrack
                  </p>
                  <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight leading-tight mb-4">
                    {t('success.title')}
                  </h1>
                  <p className="text-sm sm:text-base text-white/80 leading-relaxed">
                    {t('success.body')}
                  </p>
                  <p className="text-xs sm:text-sm text-white/60 mt-3 leading-relaxed">
                    {t('success.note')}
                  </p>
                </div>

                <Link to="/admin/dashboard" className="mt-2">
                  <Button className="h-12 px-7 text-base bg-[#F97316] hover:bg-[#C2410C] text-white">
                    {t('success.cta.dashboard')}
                    <ArrowRight className="w-4 h-4 ml-1" aria-hidden="true" />
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {state.status === 'failed' && (
            <div
              role="alert"
              data-testid="signup-failed"
              data-reason={state.reason}
              className="rounded-2xl border border-red-200 bg-red-50 p-8 sm:p-10"
            >
              <div className="flex flex-col items-start gap-6">
                <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-red-100 text-red-600">
                  <AlertCircle className="w-7 h-7" aria-hidden="true" />
                </span>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight leading-tight text-red-900 mb-4">
                    {t(`success.failed.${state.reason}.title`)}
                  </h1>
                  <p className="text-sm sm:text-base text-red-800 leading-relaxed">
                    {t(`success.failed.${state.reason}.body`)}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link to="/#pricing">
                    <Button className="h-12 px-7 text-base bg-[#F97316] hover:bg-[#C2410C] text-white">
                      {t('success.failed.cta.restart')}
                      <ArrowRight className="w-4 h-4 ml-1" aria-hidden="true" />
                    </Button>
                  </Link>
                  <Link to="/">
                    <Button
                      variant="outline"
                      className="h-12 px-7 text-base border-[#0A0A0A] text-[#0A0A0A] hover:bg-[#0A0A0A] hover:text-white"
                    >
                      {t('success.failed.cta.home')}
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="py-8 border-t border-[#F4F4F5]">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-center">
          <BuildTrackLogo className="text-base" />
        </div>
      </footer>
    </div>
  );
}
