// BuildTrack — Admin tenant billing & subscription page.
//
// Renders the local billing snapshot — status, plan, interval, period,
// trial window, last webhook — and nothing else: no prices, no plan
// cards, no checkout.
//
// BuildTrack is sold demo-led: a plan is quoted per customer on a call
// and the beta is activated by hand, so there is no public amount a
// button here could honestly charge. Everything that used to mutate
// billing from this page (Paddle checkout, self-serve change-plan) is
// therefore off — an admin who needs to activate, reactivate or move
// plan emails us and we do it. The backend keeps its plan/Paddle logic
// untouched; only this surface stopped offering it.
//
// This page is GATED via routes.tsx with ProtectedRoute
// allowedRoles=['ADMIN'] but is deliberately OUTSIDE BillingGuard — it
// is where admins are sent whenever their tenant is locked, so it has
// to render while blocked. It only READS billing state (GET
// /billing/status); the one action it offers is a mailto.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Clock,
  HardHat,
  Lock,
  LogOut,
  Mail,
  RefreshCw,
  AlertTriangle,
  CreditCard,
} from 'lucide-react';

import { Button } from '../../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { BETA_EMAIL, mailtoWithSubject } from '../../components/landing/contact';
import { isBillingAllowed } from '../../lib/billing-access';
import { AuthService } from '../../services/auth';
import {
  BillingService,
  type BillingStatusResponse,
} from '../../services/billing';

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

// Locked banner — surfaced at the top of /admin/billing when the tenant
// can't use the app (no subscription, checkout pending, lapsed status, or
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

function StatusField({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId?: string;
}) {
  return (
    <div className="min-w-0" data-testid={testId}>
      <dt className="text-xs font-semibold uppercase tracking-wide text-[#71717A]">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold text-[#0A0A0A] break-words">
        {value}
      </dd>
    </div>
  );
}

function SubscriptionStatusPanel({
  status,
  loading,
  hasError,
  kind,
  onRefresh,
}: {
  status: BillingStatusResponse | null;
  loading: boolean;
  hasError: boolean;
  kind: SubscriptionKind;
  onRefresh: () => void;
}) {
  const { t } = useTranslation('billing');
  const hasBillingAccount =
    kind !== 'missing' && kind !== 'error' && Boolean(status?.billingStatus);
  const meta = KIND_META[kind];
  const badgeLabel = t(`status.badge.${meta.key}`);
  const headline = t(`status.headline.${meta.key}`);
  const body = t(`status.body.${meta.key}`);

  // Trial flag: prefer the dedicated boolean, fall back to the legacy
  // TRIALING billingStatus. Both convey the same semantic; checking
  // both keeps the UI accurate even if the backend hasn't sent the new
  // field yet (e.g. older deployments).
  const isTrialing = Boolean(status?.isTrialing) || kind === 'trialing';
  const cancelAtPeriodEnd = Boolean(status?.cancelAtPeriodEnd);
  const paddleEnv = status?.paddleEnv ?? null;

  // Offered in every state on purpose: activating, reactivating and
  // moving plan all happen by email now, so there is no state in which
  // "email us" is the wrong next step.
  const contactHref = mailtoWithSubject(BETA_EMAIL, t('contact.subject'));

  return (
    <Card
      data-testid="subscription-status-panel"
      data-kind={kind}
      data-cancel-at-period-end={cancelAtPeriodEnd ? 'true' : 'false'}
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
            {isTrialing && hasBillingAccount && kind !== 'trialing' && (
              <span
                data-testid="status-trial-flag"
                className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border bg-[#F97316]/10 text-[#C2410C] border-[#F97316]/30"
              >
                {t('status.trialFlag')}
              </span>
            )}
            {paddleEnv && hasBillingAccount && (
              <span
                data-testid="status-paddle-env-badge"
                className={[
                  'inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide border',
                  paddleEnv === 'sandbox'
                    ? 'bg-amber-100 text-amber-800 border-amber-200'
                    : 'bg-[#F4F4F5] text-[#0A0A0A] border-[#D4D4D8]',
                ].join(' ')}
              >
                {t(`status.paddleEnv.${paddleEnv}`, {
                  defaultValue: paddleEnv,
                })}
              </span>
            )}
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

          {cancelAtPeriodEnd && hasBillingAccount && (
            <div
              role="status"
              data-testid="status-cancel-notice"
              className="mt-4 p-3 rounded-lg border border-amber-200 bg-amber-50 flex items-start gap-2"
            >
              <Clock
                className="w-4 h-4 mt-0.5 text-amber-700 flex-shrink-0"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-amber-900">
                  {t('status.cancelAtPeriodEnd.title')}
                </p>
                <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                  {t('status.cancelAtPeriodEnd.body', {
                    date: formatBillingDate(status?.currentPeriodEndsAt),
                  })}
                </p>
              </div>
            </div>
          )}
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
              value={
                status?.billingInterval
                  ? t(`toggle.${status.billingInterval.toLowerCase()}`, {
                      defaultValue: status.billingInterval,
                    })
                  : '—'
              }
            />
            {isTrialing ? (
              <>
                <StatusField
                  label={t('status.field.trialStarts')}
                  value={formatBillingDate(status?.trialStartsAt)}
                  testId="status-field-trial-starts"
                />
                <StatusField
                  label={t('status.field.trialEnds')}
                  value={formatBillingDate(status?.trialEndsAt)}
                  testId="status-field-trial-ends"
                />
              </>
            ) : (
              <>
                <StatusField
                  label={t('status.field.periodStarts')}
                  value={formatBillingDate(status?.currentPeriodStartsAt)}
                  testId="status-field-period-starts"
                />
                <StatusField
                  label={t('status.field.periodEnds')}
                  value={formatBillingDate(status?.currentPeriodEndsAt)}
                  testId="status-field-period-ends"
                />
              </>
            )}
            <StatusField
              label={t('status.field.lastEvent')}
              value={formatStatusValue(status?.lastEventId)}
            />
            {status?.lastEventOccurredAt && (
              <StatusField
                label={t('status.field.lastEventAt')}
                value={formatBillingDate(status?.lastEventOccurredAt)}
                testId="status-field-last-event-at"
              />
            )}
            {status?.updatedAt && (
              <StatusField
                label={t('status.field.updatedAt')}
                value={formatBillingDate(status?.updatedAt)}
                testId="status-field-updated-at"
              />
            )}
          </dl>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button
            asChild
            className="bg-[#F97316] hover:bg-[#C2410C] text-white h-10"
          >
            <a href={contactHref} data-testid="status-contact-cta">
              <Mail className="w-4 h-4 mr-2" aria-hidden="true" />
              {t('status.cta.contact')}
            </a>
          </Button>
          <p className="text-xs text-[#71717A]">{t('status.cta.contactHint')}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// Page

export function BillingPage() {
  const { t } = useTranslation('billing');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // The BillingGuard sends admins here with `reason=` so we can render
  // the locked panel without waiting on the status fetch. We still
  // recompute it from the live status once the fetch lands.
  const guardReason = searchParams.get('reason');

  const [billingStatus, setBillingStatus] =
    useState<BillingStatusResponse | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState(false);

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

  const handleRefreshStatus = useCallback(() => {
    void loadBillingStatus();
  }, [loadBillingStatus]);

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

      {/* Hero band — soft orange/black blurs as in the Landing hero. */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute -top-40 -right-32 w-[28rem] h-[28rem] rounded-full bg-[#F97316]/10 blur-3xl" />
          <div className="absolute -bottom-40 -left-32 w-[28rem] h-[28rem] rounded-full bg-[#0A0A0A]/5 blur-3xl" />
        </div>

        <div className="max-w-6xl mx-auto px-6 pt-16 pb-20">
          <div className="text-center max-w-2xl mx-auto">
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#0A0A0A] mb-4">
              {t('page.title')}
            </h1>
            <p className="text-[#71717A] leading-relaxed">
              {t('page.subtitle')}
            </p>
            <div className="mt-6 flex items-center justify-center">
              <Button
                type="button"
                variant="outline"
                onClick={handleRefreshStatus}
                disabled={statusLoading}
                data-testid="status-refresh-button-top"
                className="h-10 border-[#D4D4D8] text-[#0A0A0A] hover:bg-[#FFF7ED] hover:text-[#C2410C] hover:border-[#F97316]/40"
              >
                <RefreshCw
                  className={`w-4 h-4 mr-2 ${statusLoading ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                {statusLoading
                  ? t('status.refreshing')
                  : t('status.refresh')}
              </Button>
            </div>
          </div>

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
            onRefresh={handleRefreshStatus}
          />
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
