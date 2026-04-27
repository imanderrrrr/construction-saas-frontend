// Public forgot-password request page. The user supplies their tenant slug
// + email; the server (in dev) logs the reset link to console, (in prod)
// emails it via the configured EmailSender.
//
// We always show the same success state regardless of whether the email is
// real to mirror the backend's anti-enumeration response.

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';

import { PasswordResetService, PasswordResetRequestPayload } from '../services/passwordReset';
import { getStoredTenantSlug } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { HardHat, Loader2, ArrowRight, CheckCircle2 } from 'lucide-react';

export function ForgotPassword() {
  const { t } = useTranslation('auth');

  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const remembered = getStoredTenantSlug() ?? '';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PasswordResetRequestPayload>({
    defaultValues: { tenantSlug: remembered, email: '' },
  });

  const onSubmit = async (data: PasswordResetRequestPayload) => {
    setIsLoading(true);
    try {
      await PasswordResetService.request({
        tenantSlug: data.tenantSlug.trim().toLowerCase(),
        email: data.email.trim(),
      });
    } catch {
      // Backend swallows "not found" — any error here is genuine network /
      // server pain. We still show the success state to keep the UX flow
      // (a real user should retry from the email).
    } finally {
      setIsLoading(false);
      setSubmitted(true);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#FAFAFA] to-[#D4D4D8] px-4 py-8">
      <div className="w-full max-w-md">

        <div className="flex justify-end mb-4">
          <LanguageSwitcher />
        </div>

        <div className="text-center mb-8">
          <Link
            to="/"
            className="inline-flex items-center justify-center w-16 h-16 bg-[#F97316] rounded-xl mb-4 shadow-lg shadow-[#F97316]/25"
            aria-label="BuildTrack home"
          >
            <HardHat className="w-8 h-8 text-white" />
          </Link>
          <h1 className="text-3xl font-bold text-[#0A0A0A] mb-2">
            {t('forgotPassword.title')}
          </h1>
          <p className="text-[#71717A]">
            {submitted ? t('forgotPassword.sentSubtitle') : t('forgotPassword.subtitle')}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 border border-[#D4D4D8]/50">
          {submitted ? (
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-emerald-50 rounded-full">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>
              <p className="text-sm text-[#71717A] leading-relaxed">
                {t('forgotPassword.sentBody')}
              </p>
              <Link to="/login" className="text-[#F97316] hover:text-[#C2410C] font-medium text-sm inline-block mt-2">
                {t('forgotPassword.backToLogin')}
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="tenantSlug" className="text-sm font-medium text-[#0A0A0A]">
                  {t('login.tenantSlug.label')}
                </Label>
                <Input
                  id="tenantSlug"
                  type="text"
                  autoComplete="organization"
                  placeholder={t('login.tenantSlug.placeholder')}
                  disabled={isLoading}
                  {...register('tenantSlug', { required: t('forgotPassword.tenantSlug.required') })}
                  aria-invalid={errors.tenantSlug ? 'true' : 'false'}
                  className={inputCls(!!errors.tenantSlug, isLoading)}
                />
                {errors.tenantSlug && (
                  <p className="text-xs text-red-600">{errors.tenantSlug.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium text-[#0A0A0A]">
                  {t('forgotPassword.email.label')}
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder={t('forgotPassword.email.placeholder')}
                  disabled={isLoading}
                  {...register('email', {
                    required: t('forgotPassword.email.required'),
                    pattern: {
                      value: /^[^@\s]+@[^@\s]+\.[^@\s]+$/,
                      message: t('forgotPassword.email.invalid'),
                    },
                  })}
                  aria-invalid={errors.email ? 'true' : 'false'}
                  className={inputCls(!!errors.email, isLoading)}
                />
                {errors.email && (
                  <p className="text-xs text-red-600">{errors.email.message}</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 text-base bg-[#F97316] hover:bg-[#C2410C] text-white"
              >
                {isLoading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('forgotPassword.submitting')}</>
                ) : (
                  <>{t('forgotPassword.submit')}<ArrowRight className="w-4 h-4 ml-1" /></>
                )}
              </Button>

              <p className="text-center text-sm text-[#71717A]">
                <Link to="/login" className="text-[#F97316] hover:text-[#C2410C] font-medium">
                  {t('forgotPassword.backToLogin')}
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function inputCls(invalid: boolean, disabled: boolean): string {
  return [
    'w-full h-11 px-3.5',
    'border border-[#D4D4D8] rounded-lg',
    'text-[#0A0A0A] placeholder:text-[#71717A]',
    'focus:outline-none focus:ring-2 focus:ring-[#F97316]/25 focus:border-[#F97316]',
    'hover:border-[#71717A] transition-colors duration-150',
    invalid ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20' : '',
    disabled ? 'opacity-50 cursor-not-allowed bg-[#FAFAFA] select-none' : 'bg-white',
  ].filter(Boolean).join(' ');
}
