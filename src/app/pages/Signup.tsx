// Public BuildTrack tenant signup. Drives backend POST /api/v1/auth/signup.
// On success the server has already set the auth cookies, so we just route
// the brand-new admin to their dashboard.

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';

import { AuthService, ApiError, SignupPayload } from '../services/auth';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import {
  AlertCircle,
  HardHat,
  Loader2,
  ArrowRight,
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

interface SignupFormFields extends SignupPayload {}

// Backend error code → i18n key prefix
type SignupErrorKey =
  | 'slugTaken'
  | 'slugReserved'
  | 'rateLimited'
  | 'validation'
  | 'server';

function classifyError(err: unknown): SignupErrorKey {
  if (err instanceof ApiError) {
    // Backend codes — keep in sync with SignupServiceImpl.
    const code = err.code ?? '';
    if (err.status === 409 || code === 'TENANT_SLUG_TAKEN') return 'slugTaken';
    if (code === 'TENANT_SLUG_RESERVED') return 'slugReserved';
    if (err.status === 429 || code === 'RATE_LIMITED') return 'rateLimited';
    if (err.status === 400) return 'validation';
  }
  return 'server';
}

export function Signup() {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();

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
    try {
      const response = await AuthService.signup({
        ...data,
        tenantSlug: data.tenantSlug.trim().toLowerCase(),
      });
      navigate(AuthService.getDashboardRoute(response.role));
    } catch (err) {
      setError(classifyError(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#FAFAFA] to-[#D4D4D8] px-4 py-8">
      <div className="w-full max-w-xl">
        {/* Language switcher */}
        <div className="flex justify-end mb-4">
          <LanguageSwitcher />
        </div>

        {/* Brand header */}
        <div className="text-center mb-8">
          <Link
            to="/"
            className="inline-flex items-center justify-center w-16 h-16 bg-[#F97316] rounded-xl mb-4 shadow-lg shadow-[#F97316]/25 transition-transform hover:scale-105"
            aria-label="BuildTrack home"
          >
            <HardHat className="w-8 h-8 text-white" />
          </Link>
          <h1 className="text-3xl font-bold text-[#0A0A0A] mb-2">
            {t('signup.title')}
          </h1>
          <p className="text-[#71717A]">{t('signup.subtitle')}</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-[#D4D4D8]/50">
          {error && (
            <AlertDestructive
              title={t(`signup.error.${error}.title`)}
              message={t(`signup.error.${error}.message`)}
            />
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
            {/* Company section */}
            <div className="space-y-4">
              <h2 className="text-xs font-semibold tracking-widest text-[#F97316] uppercase">
                {t('signup.section.company')}
              </h2>

              <div className="space-y-1.5">
                <Label htmlFor="companyName" className="text-sm font-medium text-[#0A0A0A]">
                  {t('signup.companyName.label')}
                </Label>
                <Input
                  id="companyName"
                  type="text"
                  autoComplete="organization"
                  placeholder={t('signup.companyName.placeholder')}
                  disabled={isFormDisabled}
                  {...register('companyName', {
                    required: t('signup.companyName.required'),
                    onBlur: handleCompanyNameBlur,
                  })}
                  aria-invalid={errors.companyName ? 'true' : 'false'}
                  className={inputCls(!!errors.companyName, isFormDisabled)}
                />
                {errors.companyName && (
                  <p className="text-xs text-red-600">{errors.companyName.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tenantSlug" className="text-sm font-medium text-[#0A0A0A]">
                  {t('signup.tenantSlug.label')}
                </Label>
                <Input
                  id="tenantSlug"
                  type="text"
                  autoComplete="off"
                  placeholder={t('signup.tenantSlug.placeholder')}
                  disabled={isFormDisabled}
                  {...register('tenantSlug', {
                    required: t('signup.tenantSlug.required'),
                    pattern: {
                      value: /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/,
                      message: t('signup.tenantSlug.pattern'),
                    },
                  })}
                  aria-invalid={errors.tenantSlug ? 'true' : 'false'}
                  className={inputCls(!!errors.tenantSlug, isFormDisabled)}
                />
                {errors.tenantSlug ? (
                  <p className="text-xs text-red-600">{errors.tenantSlug.message}</p>
                ) : (
                  <p className="text-xs text-[#71717A]">{t('signup.tenantSlug.help')}</p>
                )}
              </div>
            </div>

            {/* Admin section */}
            <div className="space-y-4 pt-2 border-t border-[#F4F4F5]">
              <h2 className="text-xs font-semibold tracking-widest text-[#F97316] uppercase pt-4">
                {t('signup.section.admin')}
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="adminFullName" className="text-sm font-medium text-[#0A0A0A]">
                    {t('signup.adminFullName.label')}
                  </Label>
                  <Input
                    id="adminFullName"
                    type="text"
                    autoComplete="name"
                    placeholder={t('signup.adminFullName.placeholder')}
                    disabled={isFormDisabled}
                    {...register('adminFullName', {
                      required: t('signup.adminFullName.required'),
                    })}
                    aria-invalid={errors.adminFullName ? 'true' : 'false'}
                    className={inputCls(!!errors.adminFullName, isFormDisabled)}
                  />
                  {errors.adminFullName && (
                    <p className="text-xs text-red-600">{errors.adminFullName.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="adminEmail" className="text-sm font-medium text-[#0A0A0A]">
                    {t('signup.adminEmail.label')}
                  </Label>
                  <Input
                    id="adminEmail"
                    type="email"
                    autoComplete="email"
                    placeholder={t('signup.adminEmail.placeholder')}
                    disabled={isFormDisabled}
                    {...register('adminEmail', {
                      required: t('signup.adminEmail.required'),
                      pattern: {
                        value: /^[^@\s]+@[^@\s]+\.[^@\s]+$/,
                        message: t('signup.adminEmail.invalid'),
                      },
                    })}
                    aria-invalid={errors.adminEmail ? 'true' : 'false'}
                    className={inputCls(!!errors.adminEmail, isFormDisabled)}
                  />
                  {errors.adminEmail && (
                    <p className="text-xs text-red-600">{errors.adminEmail.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="adminUsername" className="text-sm font-medium text-[#0A0A0A]">
                  {t('signup.adminUsername.label')}
                </Label>
                <Input
                  id="adminUsername"
                  type="text"
                  autoComplete="username"
                  placeholder={t('signup.adminUsername.placeholder')}
                  disabled={isFormDisabled}
                  {...register('adminUsername', {
                    required: t('signup.adminUsername.required'),
                    pattern: {
                      value: /^[a-zA-Z0-9._-]+$/,
                      message: t('signup.adminUsername.pattern'),
                    },
                  })}
                  aria-invalid={errors.adminUsername ? 'true' : 'false'}
                  className={inputCls(!!errors.adminUsername, isFormDisabled)}
                />
                {errors.adminUsername ? (
                  <p className="text-xs text-red-600">{errors.adminUsername.message}</p>
                ) : (
                  <p className="text-xs text-[#71717A]">{t('signup.adminUsername.help')}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="adminPassword" className="text-sm font-medium text-[#0A0A0A]">
                  {t('signup.adminPassword.label')}
                </Label>
                <div className="relative">
                  <Input
                    id="adminPassword"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder={t('signup.adminPassword.placeholder')}
                    disabled={isFormDisabled}
                    {...register('adminPassword', {
                      required: t('signup.adminPassword.required'),
                      minLength: {
                        value: 8,
                        message: t('signup.adminPassword.tooShort'),
                      },
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
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.adminPassword && (
                  <p className="text-xs text-red-600">{errors.adminPassword.message}</p>
                )}
              </div>
            </div>

            <Button
              type="submit"
              disabled={isFormDisabled}
              className="w-full h-12 text-base bg-[#F97316] hover:bg-[#C2410C] text-white"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('signup.submitting')}
                </>
              ) : (
                <>
                  {t('signup.submit')}
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>

            <p className="text-center text-sm text-[#71717A]">
              {t('signup.alreadyHaveAccount')}{' '}
              <Link to="/login" className="text-[#F97316] hover:text-[#C2410C] font-medium">
                {t('signup.signIn')}
              </Link>
            </p>
          </form>
        </div>
      </div>
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
