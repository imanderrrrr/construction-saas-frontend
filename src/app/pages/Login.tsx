import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { AuthService, LoginCredentials, ApiError } from '../services/auth';
import { getStoredTenantSlug } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import {
  AlertCircle,
  Building2,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Clock,
  Eye,
  EyeOff,
} from 'lucide-react';
import { FIELD_LIMITS } from '../../shared/fieldLimits';

// Alert Components

function AlertDestructive({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: React.ReactNode;
}) {
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
        {action && <div className="mt-2.5">{action}</div>}
      </div>
    </div>
  );
}

function AlertWarning({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div
      role="alert"
      className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 animate-in fade-in-0 slide-in-from-top-1 duration-200"
    >
      <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
        <AlertTriangle className="w-4 h-4 text-amber-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-900">{title}</p>
        <p className="text-sm text-amber-700 mt-0.5 leading-relaxed">{message}</p>
      </div>
    </div>
  );
}

// Login Component

export function Login() {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const isFormDisabled = isLoading;
  const showRetryButton = error === 'server';

  const onSubmit = async (data: LoginFormFields) => {
    setIsLoading(true);
    setError(null);

    try {
      const { tenantSlug, ...credentials } = data;
      const response = await AuthService.login(credentials, tenantSlug);
      // Cookies are set by the server — no client-side persistence needed
      const dashboardRoute = AuthService.getDashboardRoute(response.role);
      navigate(dashboardRoute);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setError('401');
          resetField('password');
        } else if (err.status === 403) {
          setError('403');
        } else {
          setError('server');
        }
      } else {
        setError('server');
      }
    } finally {
      setIsLoading(false);
    }
  };

  function renderAlert() {
    if (error === '401') {
      return (
        <AlertDestructive
          title={t('login.error.invalidCredentials.title')}
          message={t('login.error.invalidCredentials.message')}
        />
      );
    }
    if (error === '403') {
      return (
        <AlertDestructive
          title={t('login.error.accessRestricted.title')}
          message={t('login.error.accessRestricted.message')}
        />
      );
    }
    if (error === 'server') {
      return (
        <AlertDestructive
          title={t('login.error.serverDown.title')}
          message={t('login.error.serverDown.message')}
        />
      );
    }
    if (sessionExpired && !error) {
      return (
        <AlertWarning
          title={t('login.error.sessionExpired.title')}
          message={t('login.error.sessionExpired.message')}
        />
      );
    }
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#FAFAFA] to-[#D4D4D8] px-4 py-8">

      <div className="w-full max-w-md">

        {/* Language Switcher */}
        <div className="flex justify-end mb-4">
          <LanguageSwitcher />
        </div>

        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#F97316] rounded-xl mb-4 shadow-lg shadow-[#F97316]/25">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-[#0A0A0A] mb-2">BuildTrack</h1>
          <p className="text-[#71717A]">{t('login.subtitle')}</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-[#D4D4D8]/50">

          {/* Session expired chip */}
          {sessionExpired && !error && (
            <div className="flex items-center gap-2 mb-5 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg w-fit">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span className="text-xs font-medium text-amber-800">{t('login.error.sessionExpired.chip')}</span>
            </div>
          )}

          <h2 className="text-xl font-semibold text-[#0A0A0A] mb-6">
            {t('login.title')}
          </h2>

          {/* Alert Area */}
          {renderAlert()}

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>

            {/* Tenant slug — optional. Blank routes to the default (legacy)
                tenant; SaaS customers type the same identifier they chose at
                signup so the backend looks them up in the right tenant. */}
            <div className="space-y-1.5">
              <Label
                htmlFor="tenantSlug"
                className="text-sm font-medium text-[#0A0A0A] block"
              >
                {t('login.tenantSlug.label')}
              </Label>
              <Input
                id="tenantSlug"
                type="text"
                autoComplete="organization"
                placeholder={t('login.tenantSlug.placeholder')}
                {...register('tenantSlug')}
                maxLength={FIELD_LIMITS.LEGACY_WORKSPACE_SLUG}
                className={[
                  'w-full h-11 px-3.5',
                  'border border-[#D4D4D8] rounded-lg',
                  'text-[#0A0A0A] placeholder:text-[#71717A]',
                  'focus:outline-none focus:ring-2 focus:ring-[#F97316]/25 focus:border-[#F97316]',
                  'hover:border-[#71717A] transition-colors duration-150',
                  isFormDisabled
                    ? 'opacity-50 cursor-not-allowed bg-[#FAFAFA] select-none'
                    : 'bg-white',
                ]
                  .filter(Boolean)
                  .join(' ')}
                disabled={isFormDisabled}
              />
              <p className="text-xs text-[#71717A]">{t('login.tenantSlug.help')}</p>
            </div>

            {/* Username */}
            <div className="space-y-1.5">
              <Label
                htmlFor="username"
                className="text-sm font-medium text-[#0A0A0A] block"
              >
                {t('login.username.label')}
              </Label>
              <Input
                id="username"
                type="text"
                autoComplete="username"
                placeholder={t('login.username.placeholder')}
                {...register('username', { required: t('login.username.required') })}
                maxLength={FIELD_LIMITS.LEGACY_USERNAME}
                className={[
                  'w-full h-11 px-3.5',
                  'border border-[#D4D4D8] rounded-lg',
                  'text-[#0A0A0A] placeholder:text-[#71717A]',
                  'focus:outline-none focus:ring-2 focus:ring-[#F97316]/25 focus:border-[#F97316]',
                  'hover:border-[#71717A] transition-colors duration-150',
                  errors.username
                    ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                    : '',
                  isFormDisabled
                    ? 'opacity-50 cursor-not-allowed bg-[#FAFAFA] select-none'
                    : 'bg-white',
                ]
                  .filter(Boolean)
                  .join(' ')}
                disabled={isFormDisabled}
              />
              {errors.username && (
                <p className="flex items-center gap-1 text-xs text-red-600 mt-1">
                  <AlertCircle className="w-3 h-3 flex-shrink-0" />
                  {errors.username.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="password"
                  className="text-sm font-medium text-[#0A0A0A] block"
                >
                  {t('login.password.label')}
                </Label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-[#F97316] hover:text-[#C2410C] font-medium"
                >
                  {t('login.forgotPassword')}
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder={t('login.password.placeholder')}
                  {...register('password', { required: t('login.password.required') })}
                  className={[
                    'w-full h-11 px-3.5 pr-10',
                    'border border-[#D4D4D8] rounded-lg',
                    'text-[#0A0A0A] placeholder:text-[#71717A]',
                    'focus:outline-none focus:ring-2 focus:ring-[#F97316]/25 focus:border-[#F97316]',
                    'hover:border-[#71717A] transition-colors duration-150',
                    errors.password
                      ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                      : '',
                    isFormDisabled
                      ? 'opacity-50 cursor-not-allowed bg-[#FAFAFA] select-none'
                      : 'bg-white',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  disabled={isFormDisabled}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#71717A] hover:text-[#0A0A0A] transition-colors focus:outline-none"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="flex items-center gap-1 text-xs text-red-600 mt-1">
                  <AlertCircle className="w-3 h-3 flex-shrink-0" />
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className={`flex gap-3 pt-1 ${showRetryButton ? '' : 'flex-col'}`}>

              {/* Retry button — only for server error state */}
              {showRetryButton && (
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 h-11 border-[#D4D4D8] text-[#0A0A0A] hover:border-[#F97316] hover:text-[#F97316] gap-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316]"
                >
                  <RefreshCw className="w-4 h-4" />
                  {t('login.retry')}
                </Button>
              )}

              {/* Sign in button */}
              <Button
                type="submit"
                className={[
                  showRetryButton ? 'flex-1' : 'w-full',
                  'h-11',
                  'bg-[#F97316] hover:bg-[#C2410C] active:bg-[#C2410C]',
                  'text-white',
                  'transition-colors duration-150',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316] focus-visible:ring-offset-2',
                  'disabled:opacity-60 disabled:cursor-not-allowed disabled:pointer-events-none',
                  'gap-2',
                ]
                  .join(' ')}
                disabled={isFormDisabled}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('login.submitting')}
                  </>
                ) : (
                  t('login.submit')
                )}
              </Button>
            </div>

            {/* Loading subtext — shown only during loading state */}
            {isLoading && (
              <p className="text-center text-xs text-[#71717A] animate-pulse">
                {t('login.signingYouIn')}
              </p>
            )}
          </form>

        </div>

        {/* Footer */}
        <div className="mt-6 flex flex-col items-center gap-3">
          <div className="flex items-center gap-3 text-sm">
            <a href="/privacy" target="_blank" rel="noopener noreferrer"
              className="text-[#71717A] hover:text-amber-500 transition-colors underline underline-offset-2">
              {t('privacyPolicy', { ns: 'common' })}
            </a>
            <span className="text-[#6E7681]">·</span>
            <a href="/terms" target="_blank" rel="noopener noreferrer"
              className="text-[#71717A] hover:text-amber-500 transition-colors underline underline-offset-2">
              {t('termsOfService', { ns: 'common' })}
            </a>
          </div>

          {/* Powered By */}
          <div className="flex flex-col items-center gap-1.5 pt-3 border-t border-[#21262D] w-full">
            <span className="text-xs text-[#6E7681] tracking-widest uppercase">
              {t('poweredBy', { ns: 'common' })}
            </span>
            <img
              src="/archlogic-logo.png"
              alt="ArchLogic Systems"
              className="h-12 w-auto opacity-75 hover:opacity-100 transition-opacity duration-300"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
