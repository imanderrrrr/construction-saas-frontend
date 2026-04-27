// Public reset-password landing — token comes from the URL the user
// clicked in the email. After confirmation we route them to /login so they
// can sign in with the new password (the backend revoked their existing
// sessions as part of the rotation).

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';

import { ApiError } from '../services/auth';
import { PasswordResetService } from '../services/passwordReset';
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
  CheckCircle2,
} from 'lucide-react';

interface FormFields {
  newPassword: string;
}

export function ResetPassword() {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const { token } = useParams<{ token: string }>();

  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<'expired' | 'server' | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormFields>({ defaultValues: { newPassword: '' } });

  const onSubmit = async (data: FormFields) => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      await PasswordResetService.confirm({ token, newPassword: data.newPassword });
      setSuccess(true);
      // Bounce to /login after a brief moment so the user reads the success.
      setTimeout(() => navigate('/login'), 1800);
    } catch (err) {
      if (err instanceof ApiError && err.status === 410) setError('expired');
      else setError('server');
    } finally {
      setIsLoading(false);
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
            {t('resetPassword.title')}
          </h1>
          <p className="text-[#71717A]">{t('resetPassword.subtitle')}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 border border-[#D4D4D8]/50">
          {success ? (
            <div className="text-center space-y-3">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-emerald-50 rounded-full">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>
              <p className="text-sm text-[#71717A]">{t('resetPassword.success')}</p>
            </div>
          ) : (
            <>
              {error === 'expired' && (
                <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                  <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-red-900">
                      {t('resetPassword.error.expired.title')}
                    </p>
                    <p className="text-sm text-red-700 mt-0.5">
                      {t('resetPassword.error.expired.message')}
                    </p>
                  </div>
                </div>
              )}
              {error === 'server' && (
                <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                  <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-red-900">
                      {t('resetPassword.error.server.title')}
                    </p>
                    <p className="text-sm text-red-700 mt-0.5">
                      {t('resetPassword.error.server.message')}
                    </p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
                <div className="space-y-1.5">
                  <Label htmlFor="newPassword" className="text-sm font-medium text-[#0A0A0A]">
                    {t('resetPassword.newPassword.label')}
                  </Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder={t('resetPassword.newPassword.placeholder')}
                      disabled={isLoading}
                      {...register('newPassword', {
                        required: t('resetPassword.newPassword.required'),
                        minLength: {
                          value: 8,
                          message: t('resetPassword.newPassword.tooShort'),
                        },
                      })}
                      aria-invalid={errors.newPassword ? 'true' : 'false'}
                      className={`${inputCls(!!errors.newPassword, isLoading)} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#71717A] hover:text-[#0A0A0A]"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.newPassword && (
                    <p className="text-xs text-red-600">{errors.newPassword.message}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 text-base bg-[#F97316] hover:bg-[#C2410C] text-white"
                >
                  {isLoading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('resetPassword.submitting')}</>
                  ) : (
                    <>{t('resetPassword.submit')}<ArrowRight className="w-4 h-4 ml-1" /></>
                  )}
                </Button>

                <p className="text-center text-sm text-[#71717A]">
                  <Link to="/login" className="text-[#F97316] hover:text-[#C2410C] font-medium">
                    {t('forgotPassword.backToLogin')}
                  </Link>
                </p>
              </form>
            </>
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
