// BuildTrack — Admin tenant billing & subscription management page.
//
// Acts as the single home for tenant subscription concerns: it shows the
// current local billing snapshot (status, plan, interval, period, last
// webhook), surfaces honest "coming soon" placeholders for cancel /
// change-plan / invoices (none of which have backend endpoints today),
// and keeps the existing Paddle Checkout flow for the two public plans.
//
// Visual language mirrors the public Pricing section
// (`src/app/pages/landing/Pricing.tsx`) — same orange #F97316, ink
// #0A0A0A, soft borders, rounded-2xl cards, Sparkles "Most popular"
// banner, tracking-tight headings — so the billing flow feels like a
// premium extension of the landing rather than a cold admin form. Plan
// content (names, taglines, features, prices) is reused from the
// existing `pricing` i18n namespace so prices stay in one place; chrome
// and CTA copy live in `billing`.
//
// This page is GATED via routes.tsx with ProtectedRoute
// allowedRoles=['ADMIN'] but is deliberately OUTSIDE BillingGuard — it
// is the activation surface that admins are sent to whenever their
// tenant is locked. The frontend never sends tenantId, priceId, amount,
// currency or trial info — it only forwards `planCode + billingInterval`
// to the backend, which mints a Paddle transactionId. We then hand that
// id to Paddle.Checkout.open().
//
// Backend follow-ups (none implemented here, all kept as honest
// placeholders so we don't ship a broken promise):
//   - cancel subscription endpoint
//   - change plan / subscription update endpoint
//   - customer portal / Paddle hosted-management session endpoint
//   - billing enforcement on the server (we still default-deny on the
//     client via BillingGuard, but the SaaS contract has to be enforced
//     on the API too).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  HardHat,
  Info,
  Loader2,
  Lock,
  LogOut,
  Receipt,
  RefreshCw,
  Sparkles,
  AlertCircle,
  AlertTriangle,
  CreditCard,
  XCircle,
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
import { isBillingAllowed } from '../../lib/billing-access';
import { AuthService } from '../../services/auth';
import {
  BillingService,
  type BillingInterval,
  type BillingStatusResponse,
  type PlanCode,
} from '../../services/billing';

// Mirrors `Pricing.tsx` so feature lists stay in lockstep with the
// public-facing pricing without having to import that component.
const FEATURES_PER_PLAN = 13;

// Anchor for the in-page "See plans" / "Choose a plan" links so the
// status panel can scroll to the plan cards without a router round-trip.
const PLANS_SECTION_ID = 'billing-plans-section';

// Brand wordmark — kept inline (matches the inline copy in Landing.tsx)
// so this page doesn't introduce a shared component just to repaint the
// same pixels.
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

// View-level classification of the billing snapshot. We map the raw
// backend strings (which can grow over time) to a closed set the UI knows
// how to render. Unknown values fall into 'unknown' so we never silently
// render a half-activated workspace.
type SubscriptionKind =
  | 'active'
  | 'trialing'
  | 'pending'
  | 'missing'
  | 'pastDue'
  | 'paymentRequired'
  | 'canceled'
  | 'expired'
  | 'incomplete'
  | 'unknown'
  | 'error';

function isMissingBillingStatus(
  value: BillingStatusResponse['billingStatus'] | null | undefined,
): boolean {
  return value == null || value === 'NO_SUBSCRIPTION';
}

function subscriptionKind(
  status: BillingStatusResponse | null,
  hasError: boolean,
): SubscriptionKind {
  if (hasError) return 'error';
  const v = status?.billingStatus ?? null;
  if (isMissingBillingStatus(v)) return 'missing';
  if (v === 'ACTIVE') return 'active';
  if (v === 'TRIALING') return 'trialing';
  if (v === 'CHECKOUT_PENDING') return 'pending';
  if (v === 'PAST_DUE') return 'pastDue';
  if (v === 'PAYMENT_REQUIRED') return 'paymentRequired';
  if (v === 'CANCELED') return 'canceled';
  if (v === 'EXPIRED') return 'expired';
  if (v === 'INCOMPLETE') return 'incomplete';
  return 'unknown';
}

// Map kinds to badge styles + i18n key suffixes. Keeping the mapping next
// to the type avoids drift between the badge and the surrounding copy.
const KIND_META: Record<
  SubscriptionKind,
  { badgeClass: string; key: string }
> = {
  active: {
    badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    key: 'active',
  },
  trialing: {
    badgeClass: 'bg-[#F97316]/10 text-[#C2410C] border-[#F97316]/30',
    key: 'trialing',
  },
  pending: {
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
    key: 'pending',
  },
  missing: {
    badgeClass: 'bg-[#F4F4F5] text-[#71717A] border-[#D4D4D8]',
    key: 'missing',
  },
  pastDue: {
    badgeClass: 'bg-red-100 text-red-700 border-red-200',
    key: 'pastDue',
  },
  paymentRequired: {
    badgeClass: 'bg-red-100 text-red-700 border-red-200',
    key: 'paymentRequired',
  },
  canceled: {
    badgeClass: 'bg-[#F4F4F5] text-[#71717A] border-[#D4D4D8]',
    key: 'canceled',
  },
  expired: {
    badgeClass: 'bg-[#F4F4F5] text-[#71717A] border-[#D4D4D8]',
    key: 'expired',
  },
  incomplete: {
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
    key: 'incomplete',
  },
  unknown: {
    badgeClass: 'bg-red-100 text-red-700 border-red-200',
    key: 'unknown',
  },
  error: {
    badgeClass: 'bg-red-100 text-red-700 border-red-200',
    key: 'error',
  },
};

// Plan card — visually a copy of Pricing.tsx PlanCard, but the CTA wires
// into Paddle instead of /signup. The card adapts when the tenant
// already has a subscription:
//   - the plan that matches the current backend planCode renders as
//     "Current plan" with a disabled CTA and a hint that explains why,
//   - the other plan keeps the checkout CTA but with hint copy that
//     warns the new checkout does NOT swap the existing subscription
//     (no real change-plan endpoint exists yet).
interface PlanCardProps {
  planKey: 'pro' | 'business';
  billing: BillingInterval;
  featured?: boolean;
  selected?: boolean;
  isCurrentPlan?: boolean;
  hasActiveSubscription?: boolean;
  retry?: boolean;
  disabled?: boolean;
  loading?: boolean;
  onCheckout: (planCode: PlanCode) => void;
}

function PlanCard({
  planKey,
  billing,
  featured = false,
  selected = false,
  isCurrentPlan = false,
  hasActiveSubscription = false,
  retry = false,
  disabled = false,
  loading = false,
  onCheckout,
}: PlanCardProps) {
  // Plan content (names, taglines, features, prices) lives in `pricing`;
  // chrome (CTA copy, hint, error labels) lives in `billing`. Single
  // source of truth for prices.
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

  // Visual upgrade hint: Business is the upgrade target when the tenant
  // is on Pro; we never present Pro as a "downgrade" because we don't
  // support real downgrades on the backend.
  const isUpgradeTarget =
    hasActiveSubscription && !isCurrentPlan && planKey === 'business';

  // Choose CTA copy by state. Order matters — current-plan wins over
  // retry, retry wins over alt-plan, alt-plan wins over the default.
  let ctaLabel: string;
  let hintLabel: string;
  if (isCurrentPlan) {
    ctaLabel = tBilling('card.cta.currentPlan');
    hintLabel = tBilling('card.cta.hintCurrent');
  } else if (retry) {
    ctaLabel = tBilling('card.cta.retryCheckout', { plan: name });
    hintLabel = tBilling('card.cta.hint');
  } else if (hasActiveSubscription) {
    ctaLabel = tBilling('card.cta.startCheckout', { plan: name });
    hintLabel = tBilling('card.cta.hintAlternative');
  } else {
    ctaLabel = tBilling('card.cta.checkout', { plan: name });
    hintLabel = tBilling('card.cta.hint');
  }

  const ctaDisabled = disabled || loading || isCurrentPlan;

  return (
    <Card
      aria-label={`${name} plan`}
      data-testid={`plan-card-${planKey}`}
      data-current={isCurrentPlan ? 'true' : 'false'}
      className={[
        'relative flex flex-col p-0 overflow-hidden',
        isCurrentPlan
          ? 'border-2 border-emerald-500 shadow-xl shadow-emerald-500/10'
          : selected || featured
            ? 'border-2 border-[#F97316] shadow-xl shadow-[#F97316]/10'
            : 'border border-[#D4D4D8]',
        selected && !isCurrentPlan ? 'ring-2 ring-[#F97316]/25 ring-offset-2' : '',
      ].join(' ')}
    >
      {featured && !isCurrentPlan && (
        <div className="absolute top-0 inset-x-0 bg-[#F97316] text-white text-xs font-semibold tracking-wide py-1.5 px-4 flex items-center justify-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{tPricing('plans.business.badge')}</span>
        </div>
      )}
      {isCurrentPlan && (
        <div className="absolute top-0 inset-x-0 bg-emerald-500 text-white text-xs font-semibold tracking-wide py-1.5 px-4 flex items-center justify-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{tBilling('card.badge.current')}</span>
        </div>
      )}

      <CardHeader className={featured || isCurrentPlan ? 'pt-12' : 'pt-8'}>
        <CardTitle className="text-2xl font-semibold text-[#0A0A0A]">
          {name}
        </CardTitle>
        <CardDescription className="text-sm text-[#71717A] mt-1">
          {tagline}
        </CardDescription>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {selected && !isCurrentPlan && (
            <Badge className="w-fit bg-[#F97316]/10 text-[#C2410C] border-0 text-[11px] font-semibold">
              {tBilling('selectedFromSignup.badge')}
            </Badge>
          )}
          {isUpgradeTarget && (
            <Badge className="w-fit bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold">
              {tBilling('card.badge.upgrade')}
            </Badge>
          )}
        </div>

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
          disabled={ctaDisabled}
          aria-busy={loading}
          data-current-plan={isCurrentPlan ? 'true' : 'false'}
          className={[
            'w-full h-11 text-base',
            isCurrentPlan
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-100 disabled:bg-emerald-600 disabled:text-white'
              : featured
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
          ) : isCurrentPlan ? (
            <>
              <CheckCircle2 className="w-4 h-4 mr-1.5" aria-hidden="true" />
              {ctaLabel}
            </>
          ) : (
            <>
              {ctaLabel}
              <ArrowRight className="w-4 h-4 ml-1" aria-hidden="true" />
            </>
          )}
        </Button>
        <p className="text-xs text-[#71717A] text-center">{hintLabel}</p>
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

// Activation banner — surfaced at the top of /admin/billing when the
// tenant is locked (no subscription, checkout pending, lapsed status, or
// the status fetch errored). The BillingGuard sends admins here with a
// `reason=` query but the panel also computes its own state from the
// status response so a direct visit to /admin/billing in a locked state
// still shows the right copy.
type ActivationVariant = 'missing' | 'pending' | 'inactive' | 'error';

function activationVariantFromStatus(
  status: BillingStatusResponse | null,
  hasError: boolean,
  loading: boolean,
): ActivationVariant | null {
  if (loading) return null;
  if (hasError) return 'error';
  const value = status?.billingStatus ?? null;
  if (isBillingAllowed(value)) return null;
  if (isMissingBillingStatus(value)) return 'missing';
  if (value === 'CHECKOUT_PENDING') return 'pending';
  return 'inactive';
}

function ActivationPanel({
  variant,
  onSignOut,
}: {
  variant: ActivationVariant;
  onSignOut: () => void;
}) {
  const { t } = useTranslation('billing');

  const isError = variant === 'error';
  const titleKey =
    variant === 'error'
      ? 'activation.statusError.title'
      : variant === 'pending'
        ? 'activation.pending.title'
        : 'activation.required.title';
  const bodyKey =
    variant === 'error'
      ? 'activation.statusError.body'
      : variant === 'pending'
        ? 'activation.pending.body'
        : 'activation.required.body';

  const Icon = isError ? AlertTriangle : Lock;

  return (
    <div
      role={isError ? 'alert' : 'status'}
      data-testid="billing-activation-panel"
      data-variant={variant}
      className={[
        'max-w-4xl mx-auto mt-10 rounded-2xl border p-6 sm:p-7',
        isError
          ? 'border-red-200 bg-red-50'
          : 'border-[#F97316]/30 bg-[#FFF7ED]',
      ].join(' ')}
    >
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div
          className={[
            'w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0',
            isError
              ? 'bg-red-100 text-red-600'
              : 'bg-[#F97316]/10 text-[#F97316]',
          ].join(' ')}
        >
          <Icon className="w-5 h-5" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <h2
            className={[
              'text-base sm:text-lg font-semibold tracking-tight',
              isError ? 'text-red-900' : 'text-[#0A0A0A]',
            ].join(' ')}
          >
            {t(titleKey)}
          </h2>
          <p
            className={[
              'text-sm mt-1 leading-relaxed',
              isError ? 'text-red-800' : 'text-[#0A0A0A]/80',
            ].join(' ')}
          >
            {t(bodyKey)}
          </p>
          {variant !== 'error' && (
            <p className="text-sm font-semibold text-[#0A0A0A] mt-2">
              {t('activation.required.cta')}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex items-center text-xs font-semibold text-[#71717A] hover:text-[#0A0A0A] transition"
            >
              <LogOut className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
              {t('activation.signOut')}
            </button>
          </div>
        </div>
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

function formatStatusValue(value: string | null | undefined): string {
  return value ?? '—';
}

function formatBillingDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(date);
}

function StatusField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-[#71717A]">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold text-[#0A0A0A] break-words">
        {value}
      </dd>
    </div>
  );
}

// Scrolls the plan section into view. Soft-fail when the anchor isn't on
// the DOM yet (e.g. status panel rendered without the rest of the page
// in a unit test).
function scrollToPlans(): void {
  if (typeof document === 'undefined') return;
  const el = document.getElementById(PLANS_SECTION_ID);
  if (el && typeof el.scrollIntoView === 'function') {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function SubscriptionStatusPanel({
  status,
  loading,
  hasError,
  kind,
  onRefresh,
  onRetry,
  canRetry,
  retryBusy,
}: {
  status: BillingStatusResponse | null;
  loading: boolean;
  hasError: boolean;
  kind: SubscriptionKind;
  onRefresh: () => void;
  onRetry: () => void;
  canRetry: boolean;
  retryBusy: boolean;
}) {
  const { t } = useTranslation('billing');
  const hasBillingAccount =
    kind !== 'missing' && kind !== 'error' && Boolean(status?.billingStatus);
  const meta = KIND_META[kind];
  const badgeLabel = t(`status.badge.${meta.key}`);
  const headline = t(`status.headline.${meta.key}`);
  const body = t(`status.body.${meta.key}`);

  // Per-kind action chips. We always offer a soft "see plans" affordance
  // so the user can reach the plan cards from this panel.
  const showRetry =
    canRetry &&
    (kind === 'pending' ||
      kind === 'pastDue' ||
      kind === 'paymentRequired' ||
      kind === 'incomplete');
  const showSeePlans =
    kind === 'missing' ||
    kind === 'canceled' ||
    kind === 'expired' ||
    kind === 'incomplete' ||
    kind === 'pastDue' ||
    kind === 'paymentRequired' ||
    kind === 'unknown' ||
    (kind === 'pending' && !canRetry) ||
    (kind === 'active' && hasBillingAccount) ||
    (kind === 'trialing' && hasBillingAccount);

  return (
    <Card
      data-testid="subscription-status-panel"
      data-kind={kind}
      className="max-w-4xl mx-auto mt-8 border border-[#D4D4D8] shadow-sm overflow-hidden"
    >
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#F97316]/10 text-[#F97316] flex items-center justify-center flex-shrink-0">
              <CreditCard className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-xl font-semibold text-[#0A0A0A]">
                {t('status.title')}
              </CardTitle>
              <CardDescription className="text-sm text-[#71717A] mt-1">
                {hasBillingAccount
                  ? t('status.configured')
                  : t('status.empty.body')}
              </CardDescription>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={onRefresh}
            disabled={loading}
            data-testid="status-refresh-button"
            className="h-10 border-[#D4D4D8] text-[#0A0A0A] hover:bg-[#FFF7ED] hover:text-[#C2410C] hover:border-[#F97316]/40"
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            {loading ? t('status.refreshing') : t('status.refresh')}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="border-t border-[#F4F4F5] pt-5">
          <div className="flex flex-wrap items-center gap-2">
            <span
              data-testid="status-badge"
              className={[
                'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border',
                meta.badgeClass,
              ].join(' ')}
            >
              {badgeLabel}
            </span>
            {hasError && (
              <span className="text-xs font-medium text-[#C2410C]">
                {t('status.error')}
              </span>
            )}
            {!hasBillingAccount && !loading && !hasError && (
              <span className="text-xs font-semibold text-[#71717A]">
                {t('status.empty.title')}
              </span>
            )}
          </div>

          <h3 className="text-lg font-semibold text-[#0A0A0A] mt-3 tracking-tight">
            {headline}
          </h3>
          <p className="text-sm text-[#71717A] mt-1 leading-relaxed">{body}</p>
        </div>

        {hasBillingAccount ? (
          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-5 mt-6">
            <StatusField
              label={t('status.field.status')}
              value={formatStatusValue(status?.billingStatus)}
            />
            <StatusField
              label={t('status.field.plan')}
              value={formatStatusValue(status?.planCode)}
            />
            <StatusField
              label={t('status.field.interval')}
              value={formatStatusValue(status?.billingInterval)}
            />
            <StatusField
              label={t('status.field.paddleEnv')}
              value={formatStatusValue(status?.paddleEnv)}
            />
            <StatusField
              label={t('status.field.periodEnds')}
              value={formatBillingDate(status?.currentPeriodEndsAt)}
            />
            <StatusField
              label={t('status.field.lastEvent')}
              value={formatStatusValue(status?.lastEventId)}
            />
          </dl>
        ) : null}

        {(showRetry || showSeePlans) && (
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {showRetry && (
              <Button
                type="button"
                onClick={onRetry}
                disabled={loading || retryBusy}
                aria-busy={retryBusy}
                data-testid="status-retry-checkout"
                className="bg-[#F97316] hover:bg-[#C2410C] text-white h-10"
              >
                <RefreshCw
                  className={`w-4 h-4 mr-2 ${
                    loading || retryBusy ? 'animate-spin' : ''
                  }`}
                  aria-hidden="true"
                />
                {retryBusy ? t('card.cta.processing') : t('status.cta.retry')}
              </Button>
            )}
            {showSeePlans && (
              <Button
                type="button"
                variant="outline"
                onClick={scrollToPlans}
                data-testid="status-see-plans"
                className="h-10 border-[#D4D4D8] text-[#0A0A0A] hover:bg-[#FFF7ED] hover:text-[#C2410C] hover:border-[#F97316]/40"
              >
                {t('status.cta.choosePlan')}
                <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Manage subscription section — shown for any kind that means the
// tenant already has a Paddle subscription on file (active or trialing).
// The actions intentionally do NOT call any endpoints because the
// backend does not expose them yet. Each button opens an inline notice
// that explains the missing capability honestly. Keeping the UI here
// avoids leaving the user on /admin/billing with nothing to do when
// their subscription is healthy.
type ManageNotice = 'changePlan' | 'cancel' | 'invoices';

function ManageActionCard({
  icon,
  title,
  body,
  cta,
  onClick,
  testId,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  cta: string;
  onClick: () => void;
  testId: string;
}) {
  return (
    <div className="flex flex-col h-full p-5 rounded-xl border border-[#D4D4D8] bg-white hover:border-[#F97316]/40 hover:shadow-sm transition">
      <div className="w-10 h-10 rounded-lg bg-[#F97316]/10 text-[#F97316] flex items-center justify-center mb-4">
        {icon}
      </div>
      <h4 className="text-base font-semibold text-[#0A0A0A] tracking-tight">
        {title}
      </h4>
      <p className="text-sm text-[#71717A] mt-1 leading-relaxed flex-1">
        {body}
      </p>
      <Button
        type="button"
        variant="outline"
        onClick={onClick}
        data-testid={testId}
        className="mt-4 h-9 border-[#D4D4D8] text-[#0A0A0A] hover:bg-[#FFF7ED] hover:text-[#C2410C] hover:border-[#F97316]/40 justify-between"
      >
        <span>{cta}</span>
        <Info className="w-4 h-4 ml-2" aria-hidden="true" />
      </Button>
    </div>
  );
}

function ManageSubscriptionSection() {
  const { t } = useTranslation('billing');
  const [notice, setNotice] = useState<ManageNotice | null>(null);

  return (
    <Card
      data-testid="manage-subscription-section"
      className="max-w-4xl mx-auto mt-6 border border-[#D4D4D8] shadow-sm overflow-hidden"
    >
      <CardHeader className="pb-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0A0A0A] text-white flex items-center justify-center flex-shrink-0">
            <CreditCard className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-xl font-semibold text-[#0A0A0A]">
              {t('manage.title')}
            </CardTitle>
            <CardDescription className="text-sm text-[#71717A] mt-1">
              {t('manage.subtitle')}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ManageActionCard
            icon={<ArrowUpRight className="w-5 h-5" aria-hidden="true" />}
            title={t('manage.changePlan.title')}
            body={t('manage.changePlan.body')}
            cta={t('manage.changePlan.cta')}
            onClick={() => setNotice('changePlan')}
            testId="manage-action-change-plan"
          />
          <ManageActionCard
            icon={<XCircle className="w-5 h-5" aria-hidden="true" />}
            title={t('manage.cancel.title')}
            body={t('manage.cancel.body')}
            cta={t('manage.cancel.cta')}
            onClick={() => setNotice('cancel')}
            testId="manage-action-cancel"
          />
          <ManageActionCard
            icon={<Receipt className="w-5 h-5" aria-hidden="true" />}
            title={t('manage.invoices.title')}
            body={t('manage.invoices.body')}
            cta={t('manage.invoices.cta')}
            onClick={() => setNotice('invoices')}
            testId="manage-action-invoices"
          />
        </div>

        {notice && (
          <div
            role="status"
            data-testid="manage-notice"
            data-action={notice}
            className="mt-5 p-4 rounded-xl border border-[#F97316]/25 bg-[#FFF7ED] flex flex-col sm:flex-row sm:items-start gap-3"
          >
            <div className="w-9 h-9 rounded-lg bg-[#F97316]/15 text-[#F97316] flex items-center justify-center flex-shrink-0">
              <Info className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-[#0A0A0A]">
                  {t(`manage.notice.${notice}Title`)}
                </p>
                <Badge className="bg-[#0A0A0A] text-white border-0 text-[10px] font-semibold uppercase tracking-wide">
                  {t('manage.notice.badge')}
                </Badge>
              </div>
              <p className="text-sm text-[#0A0A0A]/80 mt-1 leading-relaxed">
                {t(`manage.notice.${notice}Body`)}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setNotice(null)}
              data-testid="manage-notice-close"
              className="h-9 border-[#D4D4D8] text-[#0A0A0A] hover:bg-white hover:text-[#0A0A0A] sm:self-start"
            >
              {t('manage.notice.close')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Page

export function BillingPage() {
  const { t } = useTranslation('billing');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedPlan = parseBillingPlanIntent(searchParams);
  // The BillingGuard sends admins here with `reason=` so we can render
  // the activation panel without waiting on the status fetch. We still
  // recompute it from the live status once the fetch lands.
  const guardReason = searchParams.get('reason');

  const [billing, setBilling] = useState<BillingInterval>(
    () => selectedPlan?.interval ?? 'MONTHLY',
  );
  const [billingStatus, setBillingStatus] =
    useState<BillingStatusResponse | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState(false);
  // Track which plan is currently being processed so we can show a spinner
  // on the right card and disable both CTAs to prevent double-submits.
  const [busyPlan, setBusyPlan] = useState<PlanCode | null>(null);
  const busyPlanRef = useRef<PlanCode | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadBillingStatus = useCallback(async () => {
    setStatusLoading(true);
    setStatusError(false);
    try {
      const status = await BillingService.getStatus();
      setBillingStatus(status);
    } catch {
      setBillingStatus(null);
      setStatusError(true);
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBillingStatus();
  }, [loadBillingStatus]);

  const kind = useMemo<SubscriptionKind>(
    () => subscriptionKind(billingStatus, statusError),
    [billingStatus, statusError],
  );

  const activationVariant = useMemo<ActivationVariant | null>(() => {
    // While we're still loading the live status, fall back to the
    // reason carried by BillingGuard so the panel renders immediately
    // for users coming in from a blocked route.
    const fromStatus = activationVariantFromStatus(
      billingStatus,
      statusError,
      statusLoading,
    );
    if (fromStatus) return fromStatus;
    if (statusLoading && guardReason) {
      if (guardReason === 'pending') return 'pending';
      if (guardReason === 'missing') return 'missing';
      if (guardReason === 'inactive') return 'inactive';
      if (guardReason === 'error') return 'error';
    }
    return null;
  }, [billingStatus, guardReason, statusError, statusLoading]);

  const handleSignOut = useCallback(() => {
    void AuthService.logout().finally(() => {
      // Hard navigation so any cached billing state in this tab is gone.
      window.location.href = '/';
    });
  }, []);

  const handleCheckout = useCallback(async (
    planCode: PlanCode,
    intervalOverride?: BillingInterval,
  ) => {
    if (busyPlanRef.current !== null) return; // Hard guard against re-entry.
    busyPlanRef.current = planCode;
    setBusyPlan(planCode);
    setErrorMessage(null);

    try {
      const { transactionId } = await BillingService.createCheckout({
        planCode,
        billingInterval: intervalOverride ?? billing,
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
      } else {
        setErrorMessage(t('error.generic'));
      }
    } finally {
      busyPlanRef.current = null;
      setBusyPlan(null);
    }
  }, [billing, t]);

  // Retry checkout from the status panel: reuse the plan + interval the
  // backend remembers about the current/pending subscription. Falls back
  // to scrolling to the plans section when we don't know either field.
  const handleRetryCheckout = useCallback(() => {
    const plan = billingStatus?.planCode;
    const interval = billingStatus?.billingInterval;
    if (plan && interval) {
      void handleCheckout(plan, interval);
    } else {
      scrollToPlans();
    }
  }, [billingStatus?.planCode, billingStatus?.billingInterval, handleCheckout]);

  const canRetry = Boolean(
    billingStatus?.planCode && billingStatus?.billingInterval,
  );

  const currentPlan = billingStatus?.planCode ?? null;
  const hasActiveSubscription = kind === 'active' || kind === 'trialing';
  const showManageSection = hasActiveSubscription;

  // For "pending" we mark the pending plan card so its CTA reads "Retry".
  const pendingPlan = kind === 'pending' ? billingStatus?.planCode ?? null : null;

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
            {/* Always available so a tenant locked at activation can sign
                out without getting stuck in a billing redirect bounce. */}
            <Button
              type="button"
              variant="ghost"
              onClick={handleSignOut}
              className="text-sm text-[#71717A] hover:text-[#0A0A0A] hover:bg-[#F4F4F5]"
            >
              <LogOut className="w-4 h-4 mr-1" aria-hidden="true" />
              {t('activation.signOut')}
            </Button>
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

          {activationVariant && (
            <ActivationPanel
              variant={activationVariant}
              onSignOut={handleSignOut}
            />
          )}

          <SubscriptionStatusPanel
            status={billingStatus}
            loading={statusLoading}
            hasError={statusError}
            kind={kind}
            onRefresh={loadBillingStatus}
            onRetry={handleRetryCheckout}
            canRetry={canRetry}
            retryBusy={busyPlan !== null}
          />

          {showManageSection && <ManageSubscriptionSection />}

          {/* Plans section header */}
          <div
            id={PLANS_SECTION_ID}
            data-testid="plans-section"
            className="max-w-4xl mx-auto mt-12 mb-6 text-center"
          >
            <h2 className="text-2xl font-semibold tracking-tight text-[#0A0A0A]">
              {t('plans.title')}
            </h2>
            <p className="text-sm text-[#71717A] mt-2 leading-relaxed">
              {hasActiveSubscription
                ? t('plans.subtitleActive')
                : t('plans.subtitleDefault')}
            </p>
          </div>

          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-3 mb-10">
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
              isCurrentPlan={hasActiveSubscription && currentPlan === 'PRO'}
              hasActiveSubscription={hasActiveSubscription}
              retry={pendingPlan === 'PRO'}
              loading={busyPlan === 'PRO'}
              disabled={busyPlan !== null && busyPlan !== 'PRO'}
              onCheckout={handleCheckout}
            />
            <PlanCard
              planKey="business"
              billing={billing}
              featured
              selected={selectedPlan?.plan === 'BUSINESS'}
              isCurrentPlan={hasActiveSubscription && currentPlan === 'BUSINESS'}
              hasActiveSubscription={hasActiveSubscription}
              retry={pendingPlan === 'BUSINESS'}
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
