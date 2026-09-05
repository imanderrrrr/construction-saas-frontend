import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { AuthService, LoginCredentials, ApiError } from '../services/auth';
import { getBranding } from '../services/branding';
import { getStoredTenantSlug } from '../lib/api';
import { setPasswordChangeRequired } from '../lib/passwordChangeState';
import { setWelcomeCompany, startWelcome } from '../lib/welcome';
import { PANEL_REV } from '../lib/panelRev';
import { cn } from '../components/ui/utils';
import { FOCUS_RING } from '../components/onboarding/chrome';
import { FieldError, FieldHint, FieldLabel, INPUT_MONO, Mono } from '../components/projects/bt';
import {
  authField, AuthNotice, AuthRetryButton, AuthShell, AuthSubmitButton, EyeButton, PaperKicker, PaperTitle,
} from '../components/auth/AuthShell';
import { FIELD_LIMITS } from '../../shared/fieldLimits';

/**
 * Login (Claude Design "Login BuildTrack" 01 / 01B / 01C).
 *
 * The composition — ink column, 82 px bar under 1024 px, 404 px form on
 * paper — lives in components/auth/AuthShell and is shared with the public
 * password pages; this file is only the form and its conversation.
 *
 * On success the page does two things in the same breath: it starts the
 * welcome ceremony (lib/welcome — the overlay App.tsx mounts above the
 * router) and navigates to the dashboard the role earns. The ceremony covers
 * the route change and the guards, so nobody sees a spinner between the form
 * and their panel. The company name is fetched in parallel and lands on the
 * ceremony's seal when it arrives.
 */

type LoginError = '401' | '403' | 'server' | 'staleSession';
type ErrorCode = 'USER_INACTIVE' | 'TENANT_INACTIVE' | null;

export function Login() {
  const { t } = useTranslation(['auth', 'common']);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<LoginError | null>(null);
  const [errorCode, setErrorCode] = useState<ErrorCode>(null);
  const [passwordCleared, setPasswordCleared] = useState(false);
  const sessionExpired = searchParams.get('session') === 'expired';

  // The form carries the tenant slug as an optional string (blank → backend
  // falls back to the "default" tenant for the legacy single-tenant setup).
  type LoginFormFields = LoginCredentials & { tenantSlug?: string };

  // Pre-fill the workspace identifier from the long-lived `bt_tenant` cookie
  // the backend dropped after this user's last login/signup. Falls back to
  // empty for first-time visitors and customers of the legacy default tenant.
  const rememberedSlug = getStoredTenantSlug() ?? '';

  const {
    register,
    handleSubmit,
    formState: { errors },
    resetField,
  } = useForm<LoginFormFields>({
    defaultValues: {
      tenantSlug: rememberedSlug,
      username: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormFields) => {
    setIsLoading(true);
    setError(null);
    setErrorCode(null);

    try {
      const { tenantSlug, ...credentials } = data;
      const response = await AuthService.login(credentials, tenantSlug);
      // Cookies are set by the server — no client-side persistence needed.
      // The server has already applied the office-vs-field policy, so this is
      // recorded verbatim; PasswordChangeGuard reads it on the dashboard and
      // shows the change screen there. Routing itself is unchanged — the user
      // still lands on the dashboard their role earns them.
      setPasswordChangeRequired(response.passwordChangeRequired === true);
      // The ceremony starts NOW, before the route changes: it is what the
      // person sees instead of the guards' spinners. The company name follows
      // as soon as branding answers; a slow answer just leaves the seal short.
      startWelcome(response.fullName?.trim() || response.username);
      getBranding()
        .then(b => setWelcomeCompany(b.organizationName ?? null))
        .catch(() => { /* the seal reads "Entrando al panel" on its own */ });
      navigate(AuthService.getDashboardRoute(response.role));
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401 && err.code && err.code !== 'INVALID_CREDENTIALS') {
          // No password was checked: a 401 whose code is not
          // INVALID_CREDENTIALS (SESSION_REVOKED, INVALID_TOKEN) is the JWT
          // filter refusing a dead session cookie this browser still carries.
          // Blaming the password — and wiping it — sent someone with the
          // right password off to reset it (2026-09-04). Keep what they typed
          // and say what actually happened.
          setError('staleSession');
        } else if (err.status === 401) {
          setError('401');
          resetField('password');
          setPasswordCleared(true);
        } else if (err.status === 403) {
          setError('403');
          setErrorCode(err.code === 'TENANT_INACTIVE' ? 'TENANT_INACTIVE' : 'USER_INACTIVE');
        } else {
          setError('server');
        }
      } else {
        setError('server');
      }
      setIsLoading(false);
    }
  };

  const retryButton = (
    <AuthRetryButton onClick={() => setError(null)}>{t('auth:login.retry')}</AuthRetryButton>
  );

  function renderNotice() {
    if (error === '401') {
      return <AuthNotice tone="red" title={t('auth:login.error.invalidCredentials.title')}>{t('auth:login.error.invalidCredentials.message')}</AuthNotice>;
    }
    if (error === 'staleSession') {
      return <AuthNotice tone="red" title={t('auth:login.error.staleSession.title')}>{t('auth:login.error.staleSession.message')}</AuthNotice>;
    }
    if (error === '403') {
      return (
        <AuthNotice tone="red" title={t('auth:login.error.accessRestricted.title')}>
          {errorCode === 'TENANT_INACTIVE' ? t('auth:login.error.accessRestricted.tenant') : t('auth:login.error.accessRestricted.message')}
        </AuthNotice>
      );
    }
    if (error === 'server') {
      return <AuthNotice tone="red" title={t('auth:login.error.serverDown.title')} action={retryButton}>{t('auth:login.error.serverDown.message')}</AuthNotice>;
    }
    if (sessionExpired) {
      return <AuthNotice tone="orange" title={t('auth:login.error.sessionExpired.chip')}>{t('auth:login.error.sessionExpired.message')}</AuthNotice>;
    }
    return null;
  }

  const field = (bad: boolean) => authField(bad, isLoading);

  return (
    <AuthShell
      kicker={t('auth:login.kicker')}
      heroTitle={t('auth:login.hero.title')}
      heroBody={t('auth:login.hero.body')}
      stamps={[
        { value: t('auth:login.hero.revValue', { rev: PANEL_REV }), label: t('auth:login.hero.rev') },
        { value: 'ES · EN', label: t('auth:login.hero.langs') },
      ]}
    >
      <PaperKicker>{t('auth:login.subtitle')}</PaperKicker>
      <PaperTitle className="mb-7">{t('auth:login.title')}</PaperTitle>

      {renderNotice()}

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-[15px] lg:gap-4" noValidate>
        {/* Tenant slug — optional. Blank routes to the default (legacy)
            tenant; SaaS customers type the same identifier they chose at
            signup so the backend looks them up in the right tenant. */}
        <div>
          <FieldLabel htmlFor="tenantSlug">{t('auth:login.tenantSlug.label')}</FieldLabel>
          <input
            id="tenantSlug"
            type="text"
            autoComplete="organization"
            placeholder={t('auth:login.tenantSlug.placeholder')}
            {...register('tenantSlug')}
            maxLength={FIELD_LIMITS.LEGACY_WORKSPACE_SLUG}
            disabled={isLoading}
            className={cn(field(false), INPUT_MONO, 'text-[13.5px] lg:text-[13px]')}
          />
          <FieldHint className="normal-case tracking-normal">{t('auth:login.tenantSlug.help')}</FieldHint>
        </div>

        <div>
          <FieldLabel htmlFor="username">{t('auth:login.username.label')}</FieldLabel>
          <input
            id="username"
            type="text"
            autoComplete="username"
            placeholder={t('auth:login.username.placeholder')}
            {...register('username', { required: t('auth:login.username.required') })}
            maxLength={FIELD_LIMITS.LEGACY_USERNAME}
            disabled={isLoading}
            className={field(!!errors.username)}
          />
          {errors.username && <FieldError>{errors.username.message}</FieldError>}
        </div>

        <div>
          <div className="flex items-baseline justify-between gap-3">
            <FieldLabel htmlFor="password">{t('auth:login.password.label')}</FieldLabel>
            <Link
              to="/forgot-password"
              className={cn('font-bt-mono text-[9.5px] font-semibold uppercase tracking-[0.1em] text-[#C2410C] hover:text-[#F97316] mb-1.5', FOCUS_RING)}
            >
              {t('auth:login.forgotPassword')}
            </Link>
          </div>
          <div className="flex">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder={t('auth:login.password.placeholder')}
              {...register('password', { required: t('auth:login.password.required'), onChange: () => setPasswordCleared(false) })}
              disabled={isLoading}
              className={cn(field(!!errors.password), 'flex-1 min-w-0')}
            />
            <EyeButton
              shown={showPassword}
              onToggle={() => setShowPassword(prev => !prev)}
              showLabel={t('auth:login.password.show')}
              hideLabel={t('auth:login.password.hide')}
              disabled={isLoading}
            />
          </div>
          {errors.password
            ? <FieldError>{errors.password.message}</FieldError>
            : passwordCleared && error === '401' && <FieldError>{t('auth:login.password.cleared')}</FieldError>}
        </div>

        <AuthSubmitButton busy={isLoading} busyLabel={t('auth:login.signingYouIn')} className="mt-1">
          {t('auth:login.submit')}
          <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
        </AuthSubmitButton>

        <Mono className="inline-flex items-center gap-2.5 text-[9.5px] tracking-[0.14em] text-[#8A8175] mt-2">
          <span className="inline-block w-2 h-2 bg-[#F97316]" aria-hidden="true" />
          {t('auth:login.encrypted')}
        </Mono>
      </form>
    </AuthShell>
  );
}
