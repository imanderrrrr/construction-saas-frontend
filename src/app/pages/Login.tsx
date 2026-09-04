import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Building2, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { AuthService, LoginCredentials, ApiError } from '../services/auth';
import { getBranding } from '../services/branding';
import { getStoredTenantSlug } from '../lib/api';
import { setPasswordChangeRequired } from '../lib/passwordChangeState';
import { setWelcomeCompany, startWelcome } from '../lib/welcome';
import { PANEL_REV } from '../lib/panelRev';
import { cn } from '../components/ui/utils';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { FOCUS_RING, inkGrid } from '../components/onboarding/chrome';
import { FieldError, FieldHint, FieldLabel, INPUT, INPUT_ERROR, INPUT_MONO, Mono } from '../components/projects/bt';
import { FIELD_LIMITS } from '../../shared/fieldLimits';

/**
 * Login (Claude Design "Login BuildTrack" 01 / 01B / 01C).
 *
 * Two columns on desktop: a fixed ink column with the blueprint grid and the
 * panel's one-line pitch, and the form on paper — no card, the ink column is
 * what separates it from the background. Under 1024 px the ink column folds
 * into an 82 px bar; on phones the fields grow to 44 px and the button fills
 * the width.
 *
 * On success the page does two things in the same breath: it starts the
 * welcome ceremony (lib/welcome — the overlay App.tsx mounts above the
 * router) and navigates to the dashboard the role earns. The ceremony covers
 * the route change and the guards, so nobody sees a spinner between the form
 * and their panel. The company name is fetched in parallel and lands on the
 * ceremony's seal when it arrives.
 */

type LoginError = '401' | '403' | 'server';
type ErrorCode = 'USER_INACTIVE' | 'TENANT_INACTIVE' | null;

/** 01B — panel of paper with a red edge; the expired-session variant is orange. */
function Notice({ tone, title, children, action }: {
  tone: 'red' | 'orange';
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      role="alert"
      className={cn(
        'border border-[#EDE7DB] border-l-[3px] px-[15px] py-[13px] mb-5',
        tone === 'red' ? 'bg-white border-l-[#B3402A]' : 'bg-[#FBEDE0] border-l-[#F97316]',
      )}
    >
      <Mono className={cn('block text-[9.5px] font-semibold tracking-[0.12em]', tone === 'red' ? 'text-[#B3402A]' : 'text-[#C2410C]')}>{title}</Mono>
      <p className="text-[13.5px] leading-[1.5] text-[#43301F] mt-1">{children}</p>
      {action && <div className="mt-2.5">{action}</div>}
    </div>
  );
}

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
        if (err.status === 401) {
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
    <button
      type="button"
      onClick={() => setError(null)}
      className={cn('inline-flex items-center gap-1.5 font-bt-mono text-[10px] font-semibold uppercase tracking-[0.1em] px-3 py-2 border border-[#DBD0BB] bg-white text-[#0A0A0A] hover:border-[#F97316] hover:text-[#C2410C] transition-colors', FOCUS_RING)}
    >
      <RefreshCw className="w-3.5 h-3.5" strokeWidth={2} />
      {t('auth:login.retry')}
    </button>
  );

  function renderNotice() {
    if (error === '401') {
      return <Notice tone="red" title={t('auth:login.error.invalidCredentials.title')}>{t('auth:login.error.invalidCredentials.message')}</Notice>;
    }
    if (error === '403') {
      return (
        <Notice tone="red" title={t('auth:login.error.accessRestricted.title')}>
          {errorCode === 'TENANT_INACTIVE' ? t('auth:login.error.accessRestricted.tenant') : t('auth:login.error.accessRestricted.message')}
        </Notice>
      );
    }
    if (error === 'server') {
      return <Notice tone="red" title={t('auth:login.error.serverDown.title')} action={retryButton}>{t('auth:login.error.serverDown.message')}</Notice>;
    }
    if (sessionExpired) {
      return <Notice tone="orange" title={t('auth:login.error.sessionExpired.chip')}>{t('auth:login.error.sessionExpired.message')}</Notice>;
    }
    return null;
  }

  const field = (bad: boolean) => cn(INPUT, 'h-11 lg:h-10', bad && INPUT_ERROR, isLoading && 'opacity-75');

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#FAF7F0]">
      {/* Ink column — the pitch; folds into a bar under 1024 px */}
      <aside className="relative bg-[#0A0A0A] text-[#F5F1E8] overflow-hidden flex-shrink-0 h-[82px] lg:h-auto lg:min-h-screen lg:w-[592px]">
        <div className="absolute inset-0 pointer-events-none" style={inkGrid(26)} aria-hidden="true" />

        {/* Bar (phones and tablets) */}
        <div className="relative lg:hidden h-full flex items-center justify-between px-5">
          <Wordmark />
          <Mono className="text-[9.5px] font-semibold tracking-[0.14em] text-[#F97316]">{t('auth:login.kicker')}</Mono>
        </div>

        {/* Column (desktop) */}
        <div className="relative hidden lg:flex flex-col justify-between h-full px-12 py-11">
          <Wordmark />
          <div>
            <Mono className="block text-[10px] font-semibold tracking-[0.14em] text-[#F97316]">{t('auth:login.kicker')}</Mono>
            <h2 className="font-bt-display font-extrabold uppercase text-[76px] leading-[0.9] tracking-[0.01em] max-w-[420px] mt-4">{t('auth:login.hero.title')}</h2>
            <span className="block w-16 h-[2px] bg-[#F97316] mt-6" aria-hidden="true" />
            <p className="text-[15px] leading-[1.6] text-[rgba(245,241,232,0.78)] max-w-[440px] mt-5">{t('auth:login.hero.body')}</p>
          </div>
          <div className="flex items-end gap-10">
            <div>
              <div className="font-bt-display font-extrabold text-[30px] leading-none text-[#F97316]">{t('auth:login.hero.revValue', { rev: PANEL_REV })}</div>
              <Mono className="block text-[9.5px] tracking-[0.12em] text-[rgba(245,241,232,0.6)] mt-2">{t('auth:login.hero.rev')}</Mono>
            </div>
            <div>
              <div className="font-bt-display font-extrabold text-[30px] leading-none text-[#F5F1E8]">ES · EN</div>
              <Mono className="block text-[9.5px] tracking-[0.12em] text-[rgba(245,241,232,0.6)] mt-2">{t('auth:login.hero.langs')}</Mono>
            </div>
          </div>
        </div>
      </aside>

      {/* Paper column — the form */}
      <main className="flex-1 flex flex-col min-w-0">
        <div className="flex justify-end px-5 pt-5 lg:px-12 lg:pt-8">
          <LanguageSwitcher variant="shell" />
        </div>

        <div className="flex-1 flex items-center justify-center px-5 py-8 lg:px-12">
          <div className="w-full max-w-[404px]">
            <Mono className="block text-[10px] font-semibold tracking-[0.14em] text-[#8A8175]">{t('auth:login.subtitle')}</Mono>
            <h1 className="font-bt-display font-extrabold uppercase text-[38px] lg:text-[46px] leading-[0.94] text-[#0A0A0A] mt-2 mb-7">{t('auth:login.title')}</h1>

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
                  <button
                    type="button"
                    onClick={() => setShowPassword(prev => !prev)}
                    aria-label={showPassword ? t('auth:login.password.hide') : t('auth:login.password.show')}
                    aria-pressed={showPassword}
                    tabIndex={-1}
                    disabled={isLoading}
                    className={cn('w-[42px] lg:w-[38px] flex-shrink-0 flex items-center justify-center border border-l-0 border-[#DBD0BB] bg-[#FAF7F0] text-[#5A5346] hover:text-[#C2410C] disabled:opacity-75', FOCUS_RING)}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" strokeWidth={1.8} /> : <Eye className="w-4 h-4" strokeWidth={1.8} />}
                  </button>
                </div>
                {errors.password
                  ? <FieldError>{errors.password.message}</FieldError>
                  : passwordCleared && error === '401' && <FieldError>{t('auth:login.password.cleared')}</FieldError>}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                aria-busy={isLoading}
                className={cn(
                  'w-full inline-flex items-center justify-center gap-2.5 mt-1 py-[17px] lg:py-4 font-bt-mono text-[11.5px] font-semibold uppercase tracking-[0.12em] transition-colors',
                  isLoading ? 'bg-[#3A3733] text-[#F5F1E8] cursor-wait' : 'bg-[#0A0A0A] text-[#F5F1E8] hover:bg-[#F97316] hover:text-[#0A0A0A]',
                  FOCUS_RING,
                )}
              >
                {isLoading ? (
                  <>
                    <span className="inline-block w-3 h-3 rounded-full border-2 border-[rgba(245,241,232,0.35)] border-t-[#F97316] animate-spin" aria-hidden="true" />
                    {t('auth:login.signingYouIn')}
                  </>
                ) : (
                  <>
                    {t('auth:login.submit')}
                    <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
                  </>
                )}
              </button>

              <Mono className="inline-flex items-center gap-2.5 text-[9.5px] tracking-[0.14em] text-[#8A8175] mt-2">
                <span className="inline-block w-2 h-2 bg-[#F97316]" aria-hidden="true" />
                {t('auth:login.encrypted')}
              </Mono>
            </form>
          </div>
        </div>

        <footer className="flex flex-col items-center gap-2 px-5 pb-6 lg:px-12 lg:pb-8">
          <div className="flex items-center gap-3 font-bt-mono text-[9.5px] uppercase tracking-[0.14em] text-[#8A8175]">
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className={cn('hover:text-[#C2410C]', FOCUS_RING)}>{t('common:privacyPolicy')}</a>
            <span aria-hidden="true">·</span>
            <a href="/terms" target="_blank" rel="noopener noreferrer" className={cn('hover:text-[#C2410C]', FOCUS_RING)}>{t('common:termsOfService')}</a>
          </div>
          <span className="font-bt-mono text-[9px] uppercase tracking-[0.14em] text-[#B4A992]">{t('common:poweredBy')} ArchLogic Systems</span>
        </footer>
      </main>
    </div>
  );
}

function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="w-8 h-8 bg-[#F97316] flex items-center justify-center flex-shrink-0" aria-hidden="true">
        <Building2 className="w-4 h-4 text-[#0A0A0A]" strokeWidth={1.8} />
      </span>
      <span className="font-bt-display font-extrabold uppercase text-[26px] leading-none tracking-[0.01em]">BuildTrack</span>
    </span>
  );
}
