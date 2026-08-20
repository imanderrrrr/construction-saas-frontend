// BuildTrack — the screen a user meets when their password is still the one
// an admin handed them.
//
// Rendered BY PasswordChangeGuard in place of the dashboard, rather than as a
// route of its own: the user has already been routed to the dashboard their
// role earns them, and this is the first thing waiting there. Keeping the URL
// on the dashboard is what makes "you landed in your workspace, and the first
// thing it asks is this" true, and it means the guard can simply stop
// rendering the screen once the password is set — no second navigation.
//
// There is deliberately no way past it. No cancel, no "later", no link into
// the app: the backend rejects everything else anyway (see
// TemporaryPasswordFilter), so offering an escape would only produce a wall of
// 403s. Signing out is the one alternative, because trapping someone in a
// session they cannot leave is worse than the block itself.

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { AlertCircle, HardHat, Loader2, ArrowRight, Eye, EyeOff, KeyRound } from 'lucide-react';

import { ApiError, AuthService } from '../services/auth';
import { setPasswordChangeRequired, clearPasswordChangeState } from '../lib/passwordChangeState';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { LanguageSwitcher } from './LanguageSwitcher';

interface FormFields {
  currentPassword: string;
  newPassword: string;
}

interface ForcedPasswordChangeProps {
  /** Called once the server has accepted the new password. */
  onChanged: () => void;
}

export function ForcedPasswordChange({ onChanged }: ForcedPasswordChangeProps) {
  const { t } = useTranslation('auth');

  const [isLoading, setIsLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState<'credentials' | 'unchanged' | 'server' | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormFields>({ defaultValues: { currentPassword: '', newPassword: '' } });

  const onSubmit = async (data: FormFields) => {
    setIsLoading(true);
    setError(null);
    try {
      await AuthService.changePassword(data);
      // The backend lifts the block on this same session, so the guard can
      // let the dashboard through immediately — no re-login, no reload.
      setPasswordChangeRequired(false);
      onChanged();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setError('credentials');
      else if (err instanceof ApiError && err.code === 'PASSWORD_UNCHANGED') setError('unchanged');
      else setError('server');
    } finally {
      setIsLoading(false);
    }
  };

  const onSignOut = async () => {
    clearPasswordChangeState();
    await AuthService.logout();
    window.location.href = '/login';
  };

  const errorCopy =
    error === 'credentials'
      ? { title: t('changePassword.error.credentials.title'), body: t('changePassword.error.credentials.message') }
      : error === 'unchanged'
        ? { title: t('changePassword.error.unchanged.title'), body: t('changePassword.error.unchanged.message') }
        : error === 'server'
          ? { title: t('changePassword.error.server.title'), body: t('changePassword.error.server.message') }
          : null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#FAFAFA] to-[#D4D4D8] px-4 py-8">
      <div className="w-full max-w-md">

        <div className="flex justify-end mb-4">
          <LanguageSwitcher />
        </div>

        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-16 h-16 bg-[#F97316] rounded-xl mb-4 shadow-lg shadow-[#F97316]/25"
            aria-hidden="true"
          >
            <HardHat className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-[#0A0A0A] mb-2">
            {t('changePassword.title')}
          </h1>
          <p className="text-[#71717A]">{t('changePassword.subtitle')}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 border border-[#D4D4D8]/50">

          <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
            <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
              <KeyRound className="w-4 h-4 text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900">
                {t('changePassword.notice.title')}
              </p>
              <p className="text-sm text-amber-800 mt-0.5">
                {t('changePassword.notice.message')}
              </p>
            </div>
          </div>

          {errorCopy && (
            <div
              role="alert"
              className="mb-5 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3"
            >
              <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <AlertCircle className="w-4 h-4 text-red-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-900">{errorCopy.title}</p>
                <p className="text-sm text-red-700 mt-0.5">{errorCopy.body}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>

            <div className="space-y-1.5">
              <Label htmlFor="currentPassword" className="text-sm font-medium text-[#0A0A0A]">
                {t('changePassword.currentPassword.label')}
              </Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrent ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder={t('changePassword.currentPassword.placeholder')}
                  disabled={isLoading}
                  {...register('currentPassword', {
                    required: t('changePassword.currentPassword.required'),
                  })}
                  aria-invalid={errors.currentPassword ? 'true' : 'false'}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent((p) => !p)}
                  aria-label={t('changePassword.toggleVisibility')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#71717A] hover:text-[#0A0A0A]"
                >
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.currentPassword && (
                <p className="text-xs text-red-600">{errors.currentPassword.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="newPassword" className="text-sm font-medium text-[#0A0A0A]">
                {t('changePassword.newPassword.label')}
              </Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNew ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder={t('changePassword.newPassword.placeholder')}
                  disabled={isLoading}
                  {...register('newPassword', {
                    required: t('changePassword.newPassword.required'),
                    minLength: {
                      value: 8,
                      message: t('changePassword.newPassword.tooShort'),
                    },
                  })}
                  aria-invalid={errors.newPassword ? 'true' : 'false'}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNew((p) => !p)}
                  aria-label={t('changePassword.toggleVisibility')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#71717A] hover:text-[#0A0A0A]"
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('changePassword.submitting')}</>
              ) : (
                <>{t('changePassword.submit')}<ArrowRight className="w-4 h-4 ml-1" /></>
              )}
            </Button>

            <p className="text-center text-sm text-[#71717A]">
              <button
                type="button"
                onClick={onSignOut}
                className="text-[#F97316] hover:text-[#C2410C] font-medium"
              >
                {t('changePassword.signOut')}
              </button>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
