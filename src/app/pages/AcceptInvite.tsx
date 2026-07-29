// Public landing for invitation links: /accept-invite/:token
// The token in the URL IS the auth — no login required to load this page.
// On submit the server creates the User in the inviting tenant and auto-logs
// in via cookies, so we redirect straight to the role's dashboard.

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';

import { InvitationsService, InvitationPreview, AcceptInvitationPayload } from '../services/invitations';
import { AuthService, ApiError } from '../services/auth';
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
  Mail,
} from 'lucide-react';
import { FIELD_LIMITS } from '../../shared/fieldLimits';

function AlertDestructive({ title, message }: { title: string; message: string }) {
  return (
    <div
      role="alert"
      className="mb-5 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3"
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

type AcceptError = 'usernameTaken' | 'expired' | 'validation' | 'rateLimited' | 'server';

function classify(err: unknown): AcceptError {
  if (err instanceof ApiError) {
    if (err.status === 410) return 'expired';
    if (err.status === 409) return 'usernameTaken';
    // UX1 fix: 429 used to fall through to 'server' ("Can't reach the
    // server"), which misleads the user into thinking it's a network
    // issue when in fact the request DID arrive — they're just
    // throttled. The new 'rateLimited' branch surfaces an honest,
    // actionable message ("Espera unos minutos").
    if (err.status === 429) return 'rateLimited';
    if (err.status === 400) return 'validation';
  }
  return 'server';
}

export function AcceptInvite() {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const { token } = useParams<{ token: string }>();

  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [previewError, setPreviewError] = useState<'expired' | 'server' | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<AcceptError | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AcceptInvitationPayload>({
    defaultValues: { username: '', password: '', fullName: '' },
  });

  // Fetch preview on mount. Errors here are terminal — invalid token means
  // the page can't even render the form.
  useEffect(() => {
    if (!token) {
      setPreviewError('expired');
      return;
    }
    InvitationsService.preview(token)
      .then((p) => setPreview(p))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 410) {
          setPreviewError('expired');
        } else {
          setPreviewError('server');
        }
      });
  }, [token]);

  const onSubmit = async (data: AcceptInvitationPayload) => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await InvitationsService.accept(token, data);
      navigate(AuthService.getDashboardRoute(response.role));
    } catch (err) {
      setError(classify(err));
    } finally {
      setIsLoading(false);
    }
  };

  // Terminal error state (bad token).
  if (previewError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#FAFAFA] to-[#D4D4D8] px-4 py-8">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-50 rounded-xl mb-4">
            <Mail className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-[#0A0A0A] mb-2">
            {previewError === 'expired'
              ? t('acceptInvite.expired.title')
              : t('acceptInvite.serverError.title')}
          </h1>
          <p className="text-[#71717A] mb-6">
            {previewError === 'expired'
              ? t('acceptInvite.expired.message')
              : t('acceptInvite.serverError.message')}
          </p>
          <Link to="/" className="text-[#F97316] hover:text-[#C2410C] font-medium">
            {t('acceptInvite.goHome')}
          </Link>
        </div>
      </div>
    );
  }

  // Loading preview.
  if (!preview) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#FAFAFA] to-[#D4D4D8]">
        <Loader2 className="w-8 h-8 text-[#F97316] animate-spin" />
      </div>
    );
  }

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
            {t('acceptInvite.title')}
          </h1>
          <p className="text-[#71717A]">
            {t('acceptInvite.subtitle', {
              tenant: preview.tenantName,
              role: t(`role.${preview.role}`),
            })}
          </p>
          {preview.invitedByName && (
            <p className="text-xs text-[#71717A] mt-2">
              {t('acceptInvite.invitedBy', { name: preview.invitedByName })}
            </p>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 border border-[#D4D4D8]/50">
          {error && (
            <AlertDestructive
              title={t(`acceptInvite.error.${error}.title`)}
              message={t(`acceptInvite.error.${error}.message`)}
            />
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="fullName" className="text-sm font-medium text-[#0A0A0A]">
                {t('acceptInvite.fullName.label')}
              </Label>
              <Input
                id="fullName"
                type="text"
                autoComplete="name"
                placeholder={t('acceptInvite.fullName.placeholder')}
                maxLength={FIELD_LIMITS.PERSON_NAME}
                disabled={isLoading}
                {...register('fullName', {
                  required: t('acceptInvite.fullName.required'),
                })}
                aria-invalid={errors.fullName ? 'true' : 'false'}
                className={inputCls(!!errors.fullName, isLoading)}
              />
              {errors.fullName && (
                <p className="text-xs text-red-600">{errors.fullName.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-sm font-medium text-[#0A0A0A]">
                {t('acceptInvite.username.label')}
              </Label>
              <Input
                id="username"
                type="text"
                autoComplete="username"
                placeholder={t('acceptInvite.username.placeholder')}
                maxLength={FIELD_LIMITS.USERNAME}
                disabled={isLoading}
                {...register('username', {
                  required: t('acceptInvite.username.required'),
                  pattern: {
                    value: /^[a-zA-Z0-9._-]+$/,
                    message: t('acceptInvite.username.pattern'),
                  },
                })}
                aria-invalid={errors.username ? 'true' : 'false'}
                className={inputCls(!!errors.username, isLoading)}
              />
              {errors.username && (
                <p className="text-xs text-red-600">{errors.username.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-[#0A0A0A]">
                {t('acceptInvite.password.label')}
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder={t('acceptInvite.password.placeholder')}
                  disabled={isLoading}
                  {...register('password', {
                    required: t('acceptInvite.password.required'),
                    minLength: {
                      value: 8,
                      message: t('acceptInvite.password.tooShort'),
                    },
                  })}
                  aria-invalid={errors.password ? 'true' : 'false'}
                  className={`${inputCls(!!errors.password, isLoading)} pr-10`}
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
              {errors.password && (
                <p className="text-xs text-red-600">{errors.password.message}</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 text-base bg-[#F97316] hover:bg-[#C2410C] text-white"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('acceptInvite.submitting')}
                </>
              ) : (
                <>
                  {t('acceptInvite.submit')}
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>
          </form>
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
  ]
    .filter(Boolean)
    .join(' ');
}
