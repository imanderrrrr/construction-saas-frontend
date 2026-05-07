// BuildTrack — Admin tenant billing page.
//
// Mirrors the visual language of the public Pricing section
// (`src/app/pages/landing/Pricing.tsx`) so the billing flow feels like a
// premium extension of the landing rather than a cold admin form. We
// intentionally keep the same paint (orange #F97316, ink #0A0A0A, soft
// borders, rounded-2xl cards, Sparkles "Most popular" banner, tracking-tight
// headings) but the CTA wires straight into Paddle Checkout instead of a
// signup redirect. Plan content (names, taglines, features, prices) is
// reused from the existing `pricing` i18n namespace so prices stay in one
// place; the chrome and CTA copy live in `billing`.
//
// This page is GATED via routes.tsx with ProtectedRoute allowedRoles=['ADMIN'].
// The frontend never sends tenantId, priceId, amount, currency or trial
// info — it only forwards `planCode + billingInterval` to the backend,
// which mints a Paddle transactionId. We then hand that id to
// Paddle.Checkout.open().

import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  HardHat,
  Loader2,
  Sparkles,
  AlertCircle,
} from 'lucide-react';

import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { Switch } from '../../components/ui/switch';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { ApiError } from '../../lib/api';
import { openCheckout } from '../../lib/paddle';
import {
  BillingService,
  type BillingInterval,
  type PlanCode,
} from '../../services/billing';

// Mirrors `Pricing.tsx` so feature lists stay in lockstep with the
// public-facing pricing without having to import that component.
const FEATURES_PER_PLAN = 13;

// Brand wordmark — kept inline (matches the inline copy in Landing.tsx) so
// this page doesn't introduce a shared component just to repaint the same
// pixels. If we end up using it in a fourth place we can extract.
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

// Plan card — visually a copy of Pricing.tsx PlanCard, but the CTA wires
// into Paddle instead of /signup. Kept local to this page (rather than
// extracted) because the public Pricing card has a different CTA target
// and slightly different hint copy; sharing them would force a generic
// component with too many configuration knobs for two callers.
interface PlanCardProps {
  planKey: 'pro' | 'business';
  billing: BillingInterval;
  featured?: boolean;
  selected?: boolean;
  disabled?: boolean;
  loading?: boolean;
  onCheckout: (planCode: PlanCode) => void;
}

function PlanCard({
  planKey,
  billing,
  featured = false,
  selected = false,
  disabled = false,
  loading = false,
  onCheckout,
}: PlanCardProps) {
  // We pull plan content (names, taglines, features, prices) from `pricing`
  // and chrome (CTA copy, hint, error labels) from `billing`. Single source
  // of truth for prices.
  const { t: tPricing } = useTranslation('pricing');
  const { t: tBilling } = useTranslation('billing');

  const planCode: PlanCode = planKey === 'pro' ? 'PRO' : 'BUSINESS';

  const name = tPricing(`plans.${planKey}.name`);
  const tagline = tPricing(`plans.${planKey}.tagline`);
  const monthlyPrice = tPricing(`plans.${planKey}.priceMonthly`);
  const annualPerMonth = tPricing(`plans.${planKey}.priceAnnualPerMonth`);
  const annualTotal = tPricing(`plans.${planKey}.priceAnnualTotal`);
  const saving = tPricing(`plans.${planKey}.saving`);

  const features = Array.from({ length: FEATURES_PER_PLAN }, (_, i) =>
    tPricing(`plans.${planKey}.feature.${i}`),
  );

  const showAnnual = billing === 'ANNUAL';
  const displayPrice = showAnnual ? annualPerMonth : monthlyPrice;

  return (
    <Card
      aria-label={`${name} plan`}
      className={[
        'relative flex flex-col p-0 overflow-hidden',
        selected || featured
          ? 'border-2 border-[#F97316] shadow-xl shadow-[#F97316]/10'
          : 'border border-[#D4D4D8]',
        selected ? 'ring-2 ring-[#F97316]/25 ring-offset-2' : '',
      ].join(' ')}
    >
      {featured && (
        <div className="absolute top-0 inset-x-0 bg-[#F97316] text-white text-xs font-semibold tracking-wide py-1.5 px-4 flex items-center justify-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{tPricing('plans.business.badge')}</span>
        </div>
      )}

      <CardHeader className={featured ? 'pt-12' : 'pt-8'}>
        <CardTitle className="text-2xl font-semibold text-[#0A0A0A]">
          {name}
        </CardTitle>
        <CardDescription className="text-sm text-[#71717A] mt-1">
          {tagline}
        </CardDescription>

        {selected && (
          <Badge className="mt-3 w-fit bg-[#F97316]/10 text-[#C2410C] border-0 text-[11px] font-semibold">
            {tBilling('selectedFromSignup.badge')}
          </Badge>
        )}

        <div className="mt-6">
          <div className="flex items-baseline gap-1">
            <span className="text-5xl font-bold tracking-tight text-[#0A0A0A]">
              {displayPrice}
            </span>
            <span className="text-base text-[#71717A]">
              {tPricing('perMonth')}
            </span>
          </div>

          {showAnnual ? (
            <div className="mt-2 space-y-1">
              <p className="text-xs text-[#71717A]">
                {annualTotal} {tPricing('billing.billedAnnually')}
              </p>
              <Badge
                variant="secondary"
                className="bg-[#F97316]/10 text-[#F97316] border-0 text-[11px] font-semibold"
              >
                {tPricing('save', { amount: saving })}
              </Badge>
            </div>
          ) : (
            // Empty placeholder so monthly + annual cards stay the same height.
            <p className="mt-2 text-xs text-transparent select-none">·</p>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1">
        {planKey === 'business' && (
          <p className="text-xs font-medium text-[#0A0A0A] mb-3">
            {tBilling('card.everythingInPro')}
          </p>
        )}
        <ul className="space-y-2.5">
          {features.map((feature, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm">
              <Check
                className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                  featured ? 'text-[#F97316]' : 'text-[#0A0A0A]'
                }`}
                aria-hidden="true"
              />
              <span className="text-[#0A0A0A] leading-snug">{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>

      <CardFooter className="flex flex-col gap-2 pb-8">
        <Button
          onClick={() => onCheckout(planCode)}
          disabled={disabled || loading}
          aria-busy={loading}
          className={[
            'w-full h-11 text-base',
            featured
              ? 'bg-[#F97316] hover:bg-[#C2410C] text-white'
              : 'bg-[#0A0A0A] hover:bg-[#27272A] text-white',
          ].join(' ')}
        >
          {loading ? (
            <>
              <Loader2
                className="w-4 h-4 mr-2 animate-spin"
                aria-hidden="true"
              />
              {tBilling('card.cta.processing')}
            </>
          ) : (
            <>
              {tBilling('card.cta.checkout', { plan: name })}
              <ArrowRight className="w-4 h-4 ml-1" aria-hidden="true" />
            </>
          )}
        </Button>
        <p className="text-xs text-[#71717A] text-center">
          {tBilling('card.cta.hint')}
        </p>
      </CardFooter>
    </Card>
  );
}

// Inline error banner — matches the visual language used in Signup.tsx.
function ErrorBanner({ title, message }: { title: string; message: string }) {
  return (
    <div
      role="alert"
      className="mb-8 max-w-3xl mx-auto p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 animate-in fade-in-0 slide-in-from-top-1 duration-200"
    >
      <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
        <AlertCircle className="w-4 h-4 text-red-600" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-red-900">{title}</p>
        <p className="text-sm text-red-700 mt-0.5 leading-relaxed">{message}</p>
      </div>
    </div>
  );
}

function SelectedPlanBanner() {
  const { t } = useTranslation('billing');

  return (
    <div className="mt-8 max-w-3xl mx-auto p-4 rounded-xl border border-[#F97316]/25 bg-[#FFF7ED] flex items-start gap-3">
      <div className="w-8 h-8 bg-[#F97316]/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
        <Sparkles className="w-4 h-4 text-[#F97316]" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#0A0A0A]">
          {t('selectedFromSignup.title')}
        </p>
        <p className="text-sm text-[#71717A] mt-0.5 leading-relaxed">
          {t('selectedFromSignup.body')}
        </p>
      </div>
    </div>
  );
}

interface BillingPlanIntent {
  plan: PlanCode;
  interval: BillingInterval;
}

function parseBillingPlanIntent(searchParams: URLSearchParams): BillingPlanIntent | null {
  const plan = searchParams.get('plan');
  const interval = searchParams.get('interval');
  if (plan !== 'PRO' && plan !== 'BUSINESS') return null;
  if (interval !== 'MONTHLY' && interval !== 'ANNUAL') return null;
  return { plan, interval };
}

// Page

export function BillingPage() {
  const { t } = useTranslation('billing');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedPlan = parseBillingPlanIntent(searchParams);

  const [billing, setBilling] = useState<BillingInterval>(
    () => selectedPlan?.interval ?? 'MONTHLY',
  );
  // Track which plan is currently being processed so we can show a spinner
  // on the right card and disable both CTAs to prevent double-submits.
  const [busyPlan, setBusyPlan] = useState<PlanCode | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCheckout = async (planCode: PlanCode) => {
    if (busyPlan !== null) return; // Hard guard against re-entry.
    setBusyPlan(planCode);
    setErrorMessage(null);

    try {
      const { transactionId } = await BillingService.createCheckout({
        planCode,
        billingInterval: billing,
      });

      try {
        await openCheckout({
          transactionId,
          settings: {
            // Paddle redirects here on success. We catch the return on the
            // public /checkout/success route which never activates the
            // tenant — activation comes from the signed Paddle webhook
            // landing on the backend, not from this redirect.
            successUrl: `${window.location.origin}/checkout/success`,
          },
        });
      } catch (paddleError) {
        // The most common failure here is the client token being missing
        // or the Paddle.js script being blocked — surface a precise message
        // when we recognise it, otherwise generic.
        const msg =
          paddleError instanceof Error ? paddleError.message : '';
        if (msg.includes('VITE_PADDLE_CLIENT_TOKEN')) {
          setErrorMessage(t('error.missingToken'));
        } else {
          setErrorMessage(t('error.generic'));
        }
        // Re-throw to log to console so devs can inspect during sandbox
        // testing. The caller's outer catch will release `busyPlan`.
        throw paddleError;
      }
    } catch (error) {
      // Backend errors (network, 401/403, validation) — distinguish a
      // network-style failure from anything else for clearer copy.
      const msg = error instanceof Error ? error.message : '';
      if (msg.includes('VITE_PADDLE_CLIENT_TOKEN')) {
        setErrorMessage(t('error.missingToken'));
      } else if (error instanceof ApiError) {
        setErrorMessage(error.message || t('error.generic'));
      } else if (error instanceof TypeError) {
        // `fetch` throws TypeError when the network is offline.
        setErrorMessage(t('error.network'));
      } else if (errorMessage === null) {
        // Only fall back if we haven't already set a more specific error
        // above (e.g. missing-token from the inner try).
        setErrorMessage(t('error.generic'));
      }
    } finally {
      setBusyPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-white text-[#0A0A0A]">
      {/* Nav — keep the same chrome as the public landing so the page
          feels like a continuation of it. */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-[#F4F4F5]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <BuildTrackLogo className="text-lg" />
          <nav className="flex items-center gap-3">
            <LanguageSwitcher />
            <Link to="/admin/dashboard">
              <Button
                variant="ghost"
                className="text-sm text-[#0A0A0A] hover:bg-[#F4F4F5]"
              >
                <ArrowLeft className="w-4 h-4 mr-1" aria-hidden="true" />
                {t('page.backToDashboard')}
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero band — soft orange/black blurs as in the Landing hero, kept
          subtle since this isn't a marketing page. */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute -top-40 -right-32 w-[28rem] h-[28rem] rounded-full bg-[#F97316]/10 blur-3xl" />
          <div className="absolute -bottom-40 -left-32 w-[28rem] h-[28rem] rounded-full bg-[#0A0A0A]/5 blur-3xl" />
        </div>

        <div className="max-w-6xl mx-auto px-6 pt-16 pb-10">
          <div className="text-center max-w-2xl mx-auto">
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#0A0A0A] mb-4">
              {t('page.title')}
            </h1>
            <p className="text-[#71717A] leading-relaxed">
              {t('page.subtitle')}
            </p>
          </div>

          {selectedPlan && <SelectedPlanBanner />}

          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-3 mt-10 mb-10">
            <span
              className={`text-sm font-medium transition ${
                billing === 'MONTHLY' ? 'text-[#0A0A0A]' : 'text-[#71717A]'
              }`}
            >
              {t('toggle.monthly')}
            </span>
            <Switch
              checked={billing === 'ANNUAL'}
              onCheckedChange={(checked) =>
                setBilling(checked ? 'ANNUAL' : 'MONTHLY')
              }
              aria-label={`${t('toggle.monthly')} / ${t('toggle.annual')}`}
              disabled={busyPlan !== null}
            />
            <span
              className={`text-sm font-medium transition ${
                billing === 'ANNUAL' ? 'text-[#0A0A0A]' : 'text-[#71717A]'
              }`}
            >
              {t('toggle.annual')}
            </span>
            {billing === 'ANNUAL' && (
              <Badge className="bg-[#F97316]/10 text-[#F97316] border-0 text-[11px] font-semibold ml-1">
                {t('toggle.annualBadge')}
              </Badge>
            )}
          </div>

          {/* Inline error */}
          {errorMessage && (
            <ErrorBanner
              title={t('error.title')}
              message={errorMessage}
            />
          )}

          {/* Plan cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto pb-20">
            <PlanCard
              planKey="pro"
              billing={billing}
              selected={selectedPlan?.plan === 'PRO'}
              loading={busyPlan === 'PRO'}
              disabled={busyPlan !== null && busyPlan !== 'PRO'}
              onCheckout={handleCheckout}
            />
            <PlanCard
              planKey="business"
              billing={billing}
              featured
              selected={selectedPlan?.plan === 'BUSINESS'}
              loading={busyPlan === 'BUSINESS'}
              disabled={busyPlan !== null && busyPlan !== 'BUSINESS'}
              onCheckout={handleCheckout}
            />
          </div>
        </div>
      </section>

      {/* Footer — minimal echo of the landing footer for visual closure. */}
      <footer className="py-8 border-t border-[#F4F4F5]">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <BuildTrackLogo className="text-base" />
          <button
            type="button"
            onClick={() => navigate('/admin/dashboard')}
            className="text-sm text-[#71717A] hover:text-[#0A0A0A] transition"
          >
            {t('page.backToDashboard')}
          </button>
        </div>
      </footer>
    </div>
  );
}
