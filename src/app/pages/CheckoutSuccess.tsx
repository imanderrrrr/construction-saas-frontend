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

import { useEffect, useRef, useState, type ComponentType } from 'react';
import { Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  HardHat,
  Loader2,
  Mail,
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
    <span className={`inline-flex items-center gap-2 font-bold tracking-tight ${className}`}>
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#F97316] text-white">
        <HardHat className="h-5 w-5" aria-hidden="true" />
      </span>
      <span>
        Build<span className="text-[#F97316]">Track</span>
      </span>
    </span>
  );
}

// One row of the activation stepper shown while completing.
function Step({
  icon: Icon,
  iconClass,
  spin = false,
  label,
  labelClass,
}: {
  icon: ComponentType<{ className?: string }>;
  iconClass: string;
  spin?: boolean;
  label: string;
  labelClass: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <Icon className={`h-5 w-5 flex-shrink-0 ${iconClass} ${spin ? 'animate-spin' : ''}`} aria-hidden="true" />
      <span className={`text-[15px] ${labelClass}`}>{label}</span>
    </div>
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
          (err.code === 'SIGNUP_INTENT_FAILED' || err.code === 'SIGNUP_PAYMENT_FAILED')
        ) {
          clearSignupIntent();
          setState({ status: 'failed', reason: 'failed' });
          return;
        }
        if (
          err instanceof ApiError &&
          (err.code === 'SIGNUP_PAYMENT_NOT_CONFIRMED' || err.code === 'SIGNUP_INTENT_NOT_PAID')
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
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-[#F4F4F5] px-4 py-12 font-sans text-[#0A0A0A]">
      <div className="absolute right-5 top-5">
        <LanguageSwitcher />
      </div>

      <Link to="/" className="mb-7" aria-label="BuildTrack">
        <BuildTrackLogo className="text-lg" />
      </Link>

      <div className="w-full max-w-[520px] rounded-2xl border border-[#D4D4D8] bg-white p-10 shadow-[0_10px_30px_rgba(10,10,10,0.07)]">
        {/* Completing — "procesando tu pago" */}
        {state.status === 'completing' && (
          <div role="status" data-testid="signup-completing" className="flex flex-col items-center text-center">
            <Loader2 className="h-14 w-14 animate-spin text-[#F97316]" aria-hidden="true" />
            <h1 className="mt-5 text-[25px] font-bold leading-tight">{t('success.completing.title')}</h1>
            <p className="mt-2 max-w-[380px] text-[15px] leading-relaxed text-[#71717A]">
              {t('success.completing.body')}
            </p>
            <div className="mt-7 space-y-3.5 text-left">
              <Step icon={CheckCircle2} iconClass="text-[#16A34A]" label={t('success.steps.paid', 'Pago confirmado')} labelClass="font-medium text-[#0A0A0A]" />
              <Step icon={Loader2} spin iconClass="text-[#F97316]" label={t('success.steps.activating', 'Activando tu cuenta')} labelClass="font-semibold text-[#0A0A0A]" />
              <Step icon={Circle} iconClass="text-[#71717A]" label={t('success.steps.ready', 'Listo para entrar')} labelClass="text-[#71717A]" />
            </div>
            <p className="mt-7 flex items-center gap-2 text-[13px] text-[#71717A]">
              <Mail className="h-4 w-4" aria-hidden="true" />
              {t('success.emailNote', 'Te enviaremos la confirmación a tu correo.')}
            </p>
          </div>
        )}

        {/* Waiting — payment not yet confirmed */}
        {state.status === 'waiting' && (
          <div role="status" data-testid="signup-waiting" className="flex flex-col items-center text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <Loader2 className="h-7 w-7 animate-spin" aria-hidden="true" />
            </span>
            <h1 className="mt-5 text-[25px] font-bold leading-tight">{t('success.waiting.title')}</h1>
            <p className="mt-2 max-w-[380px] text-[15px] leading-relaxed text-[#71717A]">{t('success.waiting.body')}</p>
            <Button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-7 h-12 bg-[#F97316] px-7 text-base text-white hover:bg-[#C2410C]"
            >
              {t('success.waiting.cta.refresh')}
            </Button>
          </div>
        )}

        {/* Completed / idle — success */}
        {(state.status === 'idle' || state.status === 'completed') && (
          <div data-testid="signup-success" className="flex flex-col items-center text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#E7F6EC] text-[#16A34A]">
              <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
            </span>
            <h1 className="mt-5 text-[25px] font-bold leading-tight">{t('success.title')}</h1>
            <p className="mt-2 max-w-[400px] text-[15px] leading-relaxed text-[#71717A]">{t('success.body')}</p>
            <p className="mt-2 max-w-[400px] text-[13px] leading-relaxed text-[#71717A]">{t('success.note')}</p>
            <Link to="/admin/dashboard" className="mt-7">
              <Button className="h-12 bg-[#F97316] px-7 text-base text-white hover:bg-[#C2410C]">
                {t('success.cta.dashboard')}
                <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
              </Button>
            </Link>
          </div>
        )}

        {/* Failed */}
        {state.status === 'failed' && (
          <div role="alert" data-testid="signup-failed" data-reason={state.reason} className="flex flex-col items-center text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
              <AlertCircle className="h-7 w-7" aria-hidden="true" />
            </span>
            <h1 className="mt-5 text-[25px] font-bold leading-tight">{t(`success.failed.${state.reason}.title`)}</h1>
            <p className="mt-2 max-w-[400px] text-[15px] leading-relaxed text-[#71717A]">
              {t(`success.failed.${state.reason}.body`)}
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link to="/#pricing">
                <Button className="h-12 bg-[#F97316] px-7 text-base text-white hover:bg-[#C2410C]">
                  {t('success.failed.cta.restart')}
                  <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
                </Button>
              </Link>
              <Link to="/">
                <Button variant="outline" className="h-12 border-[#0A0A0A] px-7 text-base text-[#0A0A0A] hover:bg-[#0A0A0A] hover:text-white">
                  {t('success.failed.cta.home')}
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
