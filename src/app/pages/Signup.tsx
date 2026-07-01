// Public BuildTrack tenant signup. Drives the pre-payment surface:
//
//   1. `/api/v1/signup/checkout` — persists a temporary intent and mints
//      a Paddle checkout transaction. NO tenant exists yet.
//   2. `Paddle.Checkout.open(transactionId, successUrl=/checkout/success)` —
//      the customer pays. If they cancel, nothing has been created and
//      the workspace identifier is released once the intent expires.
//   3. `/checkout/success` reads the saved intent id and calls
//      `/api/v1/signup/complete` to materialise the tenant + admin.
//
// The legacy `/auth/signup` path is intentionally NOT used here. It still
// exists for tests and any internal flow that doesn't go through Paddle.

import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';

import { ApiError } from '../lib/api';
import {
  SignupService,
  rememberSignupIntent,
  type SignupCheckoutPayload,
} from '../services/signup';
import { openCheckout } from '../lib/paddle';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import {
  AlertCircle,
  HardHat,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Check,
  ChevronRight,
  Eye,
  EyeOff,
} from 'lucide-react';

// Inline alert (kept local for now — tiny duplication is cheaper than a shared component)
function AlertDestructive({ title, message }: { title: string; message: string }) {
  return (
    <div
      role="alert"
      className="mb-5 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 animate-in fade-in-0 slide-in-from-top-1 duration-200"
    >
      <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
        <AlertCircle className="w-4 h-4 text-red-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-red-900">{title}</p>
        <p className="text-sm text-red-700 mt-0.5 leading-relaxed">{message}</p>
      </div>
    </div>
  );
}

// Form
//
// The form fields the customer types are the same as before, but the
// payload we POST goes to `/signup/checkout` (not `/auth/signup`) and
// also carries the plan + interval the customer picked on the pricing
// page. A plan IS required for this flow — without it we cannot open
// Paddle, so a customer who lands on /signup directly is bounced to
// /pricing rather than allowed to create a no-plan tenant.

interface SignupFormFields {
  companyName: string;
  tenantSlug: string;
  adminFullName: string;
  adminEmail: string;
  adminUsername: string;
  adminPassword: string;
}

type SignupPlanCode = 'PRO' | 'BUSINESS';
type SignupBillingInterval = 'MONTHLY' | 'ANNUAL';

interface SignupPlanIntent {
  plan: SignupPlanCode;
  interval: SignupBillingInterval;
}

function parseSignupPlanIntent(searchParams: URLSearchParams): SignupPlanIntent | null {
  const plan = searchParams.get('plan');
  if (plan !== 'PRO' && plan !== 'BUSINESS') return null;

  const interval = searchParams.get('interval');
  return {
    plan,
    interval: interval === 'ANNUAL' ? 'ANNUAL' : 'MONTHLY',
  };
}

// Backend error code → i18n key prefix.
//
// `slugInFlight` is new in the pre-payment flow: it surfaces when another
// browser tab / session is currently mid-checkout for the same slug. We
// keep the i18n suffix in sync with the legacy `slugTaken` family so the
// auth.json bundle can house all signup error copy together.
type SignupErrorKey =
  | 'slugTaken'
  | 'slugReserved'
  | 'slugInFlight'
  | 'paddleUnavailable'
  | 'rateLimited'
  | 'validation'
  | 'server';

function classifyError(err: unknown): SignupErrorKey {
  if (err instanceof ApiError) {
    const code = err.code ?? '';
    // New pre-payment codes — keep in sync with SignupCheckoutErrorCodes.kt
    if (code === 'WORKSPACE_TAKEN') return 'slugTaken';
    if (code === 'WORKSPACE_RESERVED') return 'slugReserved';
    if (code === 'WORKSPACE_IN_FLIGHT') return 'slugInFlight';
    // Legacy /auth/signup codes — retained so this classifier still
    // works if a caller goes through the old endpoint.
    if (err.status === 409 || code === 'TENANT_SLUG_TAKEN') return 'slugTaken';
    if (code === 'TENANT_SLUG_RESERVED') return 'slugReserved';
    if (err.status === 429 || code === 'RATE_LIMITED') return 'rateLimited';
    if (err.status === 400) return 'validation';
    if (code === 'BILLING_PADDLE_NOT_CONFIGURED' ||
        code === 'BILLING_PRICE_NOT_CONFIGURED' ||
        code === 'BILLING_CHECKOUT_FAILED') {
      return 'paddleUnavailable';
    }
  }
  if (err instanceof Error && err.message.includes('VITE_PADDLE_CLIENT_TOKEN')) {
    return 'paddleUnavailable';
  }
  return 'server';
}

export function Signup() {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedPlan = parseSignupPlanIntent(searchParams);

  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<SignupErrorKey | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<SignupFormFields>({
    defaultValues: {
      companyName: '',
      tenantSlug: '',
      adminUsername: '',
      adminPassword: '',
      adminFullName: '',
      adminEmail: '',
    },
  });

  const isFormDisabled = isLoading;

  // Auto-suggest a slug from the company name as the user types.
  const companyName = watch('companyName');
  const tenantSlug = watch('tenantSlug');
  const slugify = (input: string) =>
    input
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // strip accents
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);

  const handleCompanyNameBlur = () => {
    if (!tenantSlug && companyName) {
      const suggested = slugify(companyName);
      if (suggested) setValue('tenantSlug', suggested, { shouldValidate: true });
    }
  };

  const onSubmit = async (data: SignupFormFields) => {
    setIsLoading(true);
    setError(null);

    // Hard requirement of the pre-payment flow: a plan must be selected.
    // The Pricing page is the only entry that supplies this; a customer
    // who arrived directly is bounced there rather than allowed to create
    // a no-plan workspace (and therefore a no-tenant intent).
    if (!selectedPlan) {
      setIsLoading(false);
      navigate('/#pricing');
      return;
    }

    const checkoutPayload: SignupCheckoutPayload = {
      companyName: data.companyName,
      workspaceIdentifier: data.tenantSlug.trim().toLowerCase(),
      adminUsername: data.adminUsername,
      adminPassword: data.adminPassword,
      adminFullName: data.adminFullName,
      adminEmail: data.adminEmail,
      planCode: selectedPlan.plan,
      billingInterval: selectedPlan.interval,
    };

    try {
      const intent = await SignupService.createCheckoutIntent(checkoutPayload);

      // Persist the intent id so /checkout/success can complete signup
      // after Paddle redirects the user back. Stored in sessionStorage
      // — survives the popup round-trip, dies with the tab.
      rememberSignupIntent({
        signupIntentId: intent.signupIntentId,
        planCode: intent.planCode,
        billingInterval: intent.billingInterval,
      });

      try {
        await openCheckout({
          transactionId: intent.transactionId,
          settings: {
            // Paddle redirects here on success. The success page will
            // call /signup/complete with the stored intent id; if the
            // popup is dismissed we land on /checkout/cancel and the
            // workspace identifier stays soft-reserved only until
            // the intent expires.
            successUrl: `${window.location.origin}/checkout/success`,
          },
        });
      } catch (paddleError) {
        // Paddle.js failed to load (blocked by extension, missing
        // client token, network). The intent row stays in the DB; the
        // customer can refresh and try again. We surface a precise
        // error so support knows what to look at.
        setError(classifyError(paddleError));
        return;
      }
    } catch (err) {
      if (
        err instanceof ApiError &&
        err.code === 'SIGNUP_PAYMENT_ALREADY_RETURNED'
      ) {
        navigate('/checkout/success');
        return;
      }
      setError(classifyError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const planName = selectedPlan ? t(`signup.selectedPlan.plan.${selectedPlan.plan}`) : '';
  const intervalName = selectedPlan ? t(`signup.selectedPlan.interval.${selectedPlan.interval}`) : '';

  return (
    <div className="flex min-h-screen bg-white font-sans text-[#0A0A0A]">
      {/* Left brand panel (desktop) */}
      <aside className="hidden w-[44%] max-w-[560px] flex-col justify-between bg-[#0A0A0A] p-14 lg:flex">
        <div>
          <Link
            to="/choose-plan"
            className="inline-flex items-center gap-2 text-sm font-medium text-[#A1A1AA] transition hover:text-white"
          >
            <ArrowLeft className="h-[18px] w-[18px]" />
            {t('signup.back', 'Volver')}
          </Link>

          <Link to="/" className="mt-10 flex w-fit items-center gap-2.5" aria-label="BuildTrack">
            <span className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-[#F97316]">
              <HardHat className="h-[18px] w-[18px] text-white" />
            </span>
            <span className="text-xl font-bold text-white">BuildTrack</span>
          </Link>

          <p className="mt-10 text-xs font-semibold tracking-widest text-[#F97316]">GESTIÓN DE CONSTRUCCIÓN</p>
          <h2 className="mt-4 max-w-[400px] text-[38px] font-bold leading-[1.1] text-white">
            Toda tu obra, en un solo lugar.
          </h2>
          <p className="mt-4 max-w-[400px] text-[15px] leading-relaxed text-[#A1A1AA]">
            Desde la bitácora diaria hasta las finanzas. Menos papeleo, más control de tu operación.
          </p>

          <ul className="mt-9 space-y-3.5">
            {['Bitácora de obra diaria', 'Control de tiempo con GPS', 'Almacén, gastos y finanzas', 'Reportes en PDF y Excel'].map((f) => (
              <li key={f} className="flex items-center gap-2.5 text-[15px] text-white">
                <Check className="h-[18px] w-[18px] flex-shrink-0 text-[#F97316]" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        {selectedPlan && (
          <div className="rounded-xl border border-white/15 bg-white/[0.06] p-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold tracking-wide text-[#A1A1AA]">
                {t('signup.selectedPlan.title')}
              </p>
              <Link to="/choose-plan" className="inline-flex items-center gap-0.5 text-xs font-semibold text-[#F97316] hover:underline">
                {t('signup.selectedPlan.change', 'Cambiar')}
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <p className="mt-1.5 text-base font-semibold text-white">
              {planName} · {intervalName}
            </p>
            <p className="mt-1.5 text-[13px] text-[#A1A1AA]">{t('signup.selectedPlan.note')}</p>
          </div>
        )}
      </aside>

      {/* Right form panel */}
      <main className="flex flex-1 flex-col px-6 py-8 sm:px-12">
        <div className="flex items-center justify-between">
          <Link to="/choose-plan" className="inline-flex items-center gap-1.5 text-sm text-[#71717A] transition hover:text-[#0A0A0A] lg:invisible">
            <ArrowLeft className="h-4 w-4" />
            {t('signup.back', 'Volver')}
          </Link>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <p className="hidden text-sm text-[#71717A] sm:block">
              {t('signup.alreadyHaveAccount')}{' '}
              <Link to="/login" className="font-semibold text-[#F97316] hover:text-[#C2410C]">
                {t('signup.signIn')}
              </Link>
            </p>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center py-8">
          <div className="w-full max-w-[440px]">
            <h1 className="text-[28px] font-bold leading-tight text-[#0A0A0A]">{t('signup.title')}</h1>
            <p className="mt-2 text-[15px] text-[#71717A]">{t('signup.subtitle')}</p>

            {/* Plan summary (mobile — desktop shows it on the left panel) */}
            {selectedPlan && (
              <div className="mt-5 flex items-center justify-between rounded-xl border border-[#FED7AA] bg-[#FFF7ED] px-4 py-3 lg:hidden">
                <div>
                  <p className="text-[11px] font-semibold tracking-wide text-[#F97316]">
                    {t('signup.selectedPlan.title')}
                  </p>
                  <p className="text-sm font-semibold text-[#0A0A0A]">{planName} · {intervalName}</p>
                </div>
                <Link to="/choose-plan" className="text-xs font-semibold text-[#F97316] hover:underline">
                  {t('signup.selectedPlan.change', 'Cambiar')}
                </Link>
              </div>
            )}

            {error && (
              <div className="mt-5">
                <AlertDestructive
                  title={t(`signup.error.${error}.title`)}
                  message={t(`signup.error.${error}.message`)}
                />
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
              <Field label={t('signup.companyName.label')} htmlFor="companyName" error={errors.companyName?.message}>
                <Input
                  id="companyName"
                  type="text"
                  autoComplete="organization"
                  placeholder={t('signup.companyName.placeholder')}
                  disabled={isFormDisabled}
                  {...register('companyName', { required: t('signup.companyName.required'), onBlur: handleCompanyNameBlur })}
                  aria-invalid={errors.companyName ? 'true' : 'false'}
                  className={inputCls(!!errors.companyName, isFormDisabled)}
                />
              </Field>

              <Field
                label={t('signup.tenantSlug.label')}
                htmlFor="tenantSlug"
                error={errors.tenantSlug?.message}
                help={t('signup.tenantSlug.help')}
              >
                <Input
                  id="tenantSlug"
                  type="text"
                  autoComplete="off"
                  placeholder={t('signup.tenantSlug.placeholder')}
                  disabled={isFormDisabled}
                  {...register('tenantSlug', {
                    required: t('signup.tenantSlug.required'),
                    pattern: { value: /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, message: t('signup.tenantSlug.pattern') },
                  })}
                  aria-invalid={errors.tenantSlug ? 'true' : 'false'}
                  className={inputCls(!!errors.tenantSlug, isFormDisabled)}
                />
              </Field>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label={t('signup.adminFullName.label')} htmlFor="adminFullName" error={errors.adminFullName?.message}>
                  <Input
                    id="adminFullName"
                    type="text"
                    autoComplete="name"
                    placeholder={t('signup.adminFullName.placeholder')}
                    disabled={isFormDisabled}
                    {...register('adminFullName', { required: t('signup.adminFullName.required') })}
                    aria-invalid={errors.adminFullName ? 'true' : 'false'}
                    className={inputCls(!!errors.adminFullName, isFormDisabled)}
                  />
                </Field>

                <Field label={t('signup.adminEmail.label')} htmlFor="adminEmail" error={errors.adminEmail?.message}>
                  <Input
                    id="adminEmail"
                    type="email"
                    autoComplete="email"
                    placeholder={t('signup.adminEmail.placeholder')}
                    disabled={isFormDisabled}
                    {...register('adminEmail', {
                      required: t('signup.adminEmail.required'),
                      pattern: { value: /^[^@\s]+@[^@\s]+\.[^@\s]+$/, message: t('signup.adminEmail.invalid') },
                    })}
                    aria-invalid={errors.adminEmail ? 'true' : 'false'}
                    className={inputCls(!!errors.adminEmail, isFormDisabled)}
                  />
                </Field>
              </div>

              <Field
                label={t('signup.adminUsername.label')}
                htmlFor="adminUsername"
                error={errors.adminUsername?.message}
                help={t('signup.adminUsername.help')}
              >
                <Input
                  id="adminUsername"
                  type="text"
                  autoComplete="username"
                  placeholder={t('signup.adminUsername.placeholder')}
                  disabled={isFormDisabled}
                  {...register('adminUsername', {
                    required: t('signup.adminUsername.required'),
                    pattern: { value: /^[a-zA-Z0-9._-]+$/, message: t('signup.adminUsername.pattern') },
                  })}
                  aria-invalid={errors.adminUsername ? 'true' : 'false'}
                  className={inputCls(!!errors.adminUsername, isFormDisabled)}
                />
              </Field>

              <Field label={t('signup.adminPassword.label')} htmlFor="adminPassword" error={errors.adminPassword?.message}>
                <div className="relative">
                  <Input
                    id="adminPassword"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder={t('signup.adminPassword.placeholder')}
                    disabled={isFormDisabled}
                    {...register('adminPassword', {
                      required: t('signup.adminPassword.required'),
                      minLength: { value: 8, message: t('signup.adminPassword.tooShort') },
                    })}
                    aria-invalid={errors.adminPassword ? 'true' : 'false'}
                    className={`${inputCls(!!errors.adminPassword, isFormDisabled)} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#71717A] hover:text-[#0A0A0A]"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>

              <Button
                type="submit"
                disabled={isFormDisabled}
                className="h-12 w-full bg-[#F97316] text-base text-white hover:bg-[#C2410C]"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('signup.submit.openingPaddle')}
                  </>
                ) : (
                  <>
                    {selectedPlan ? t('signup.submit.continueToPayment') : t('signup.submit')}
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </>
                )}
              </Button>

              <p className="text-center text-xs leading-relaxed text-[#71717A]">{t('signup.legal', 'Al continuar aceptas los Términos y la Política de privacidad.')}</p>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}

// Field wrapper — label + control + help/error, matches the mockup styling.
function Field({
  label,
  htmlFor,
  error,
  help,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  help?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-[13px] font-medium text-[#0A0A0A]">
        {label}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : help ? (
        <p className="text-xs text-[#71717A]">{help}</p>
      ) : null}
    </div>
  );
}

// Shared className helper for inputs — keeps the JSX above readable.
function inputCls(invalid: boolean, disabled: boolean): string {
  return [
    'w-full h-11 px-3.5',
    'border border-[#D4D4D8] rounded-lg',
    'text-[#0A0A0A] placeholder:text-[#71717A]',
    'focus:outline-none focus:ring-2 focus:ring-[#F97316]/25 focus:border-[#F97316]',
    'hover:border-[#71717A] transition-colors duration-150',
    invalid ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20' : '',
    disabled ? 'opacity-50 cursor-not-allowed bg-[#FAFAFA] select-none' : 'bg-white',
  ]
    .filter(Boolean)
    .join(' ');
}
