// Public reset-password landing — the token comes from the link in the email
// (Claude Design "Contraseñas BuildTrack" 02 / 02A / 02B / 02C).
//
// The page opens by asking the server whose link this is (preflight), so it
// can greet the person, pick the RESET or SETUP wording, and report a dead
// link before anything is typed. Confirming opens the session server-side
// (same shape as /login), so the page never sends anyone back to sign in: a
// short "Contraseña lista" hand-over, then the welcome overlay and the panel.

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';

import { ApiError, AuthService } from '../services/auth';
import { PasswordResetService, type PasswordResetPreview } from '../services/passwordReset';
import { retryAfterMinutes } from '../lib/rateLimit';
import { setPasswordChangeRequired } from '../lib/passwordChangeState';
import { setWelcomeCompany, startWelcome } from '../lib/welcome';
import { cn } from '../components/ui/utils';
import { FieldError, FieldHint, FieldLabel, Mono } from '../components/projects/bt';
import {
  AccountBlock, authField, AuthDone, AuthNotice, AuthRetryButton, AuthSeal, AuthShell, AuthSpinner, AuthSubmitButton,
  AuthTextLink, EyeButton, PaperKicker, PaperLead, PaperTitle,
} from '../components/auth/AuthShell';

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 100;
/** A preflight faster than this paints nothing: the page opens with the account already there. */
const VERIFY_QUIET_MS = 250;
/** How long "Contraseña lista" stays before the welcome takes the screen. */
export const DONE_MS = 900;

type Stage = 'verifying' | 'form' | 'invalid' | 'done';
type Failure = { kind: 'rateLimited'; minutes: number } | { kind: 'server' } | null;
interface FormFields { newPassword: string }

export function ResetPassword() {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const { token } = useParams<{ token: string }>();

  const [stage, setStage] = useState<Stage>('verifying');
  const [showVerifying, setShowVerifying] = useState(false);
  const [preview, setPreview] = useState<PasswordResetPreview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [failure, setFailure] = useState<Failure>(null);
  const [done, setDone] = useState<{ name: string; tenantName: string | null; role: string } | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    getValues,
    formState: { errors },
  } = useForm<FormFields>({ defaultValues: { newPassword: '' } });
  const typed = watch('newPassword') ?? '';

  // Preflight: who is this link for, and is it still alive.
  useEffect(() => {
    if (!token) { setStage('invalid'); return; }
    let cancelled = false;
    const quiet = window.setTimeout(() => { if (!cancelled) setShowVerifying(true); }, VERIFY_QUIET_MS);
    PasswordResetService.preview(token)
      .then(p => { if (!cancelled) { setPreview(p); setStage('form'); } })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 410) { setStage('invalid'); return; }
        // A backend without the endpoint yet (404) or no network: the
        // neutral form with the RESET wording; a dead link then surfaces on
        // submit, as it always did.
        setStage('form');
      })
      .finally(() => window.clearTimeout(quiet));
    return () => { cancelled = true; window.clearTimeout(quiet); };
  }, [token]);

  const onSubmit = async ({ newPassword }: FormFields) => {
    if (!token) return;
    setIsLoading(true);
    setFailure(null);
    try {
      const response = await PasswordResetService.confirm({ token, newPassword });
      // The person just chose this password: never a temporary one.
      setPasswordChangeRequired(response.passwordChangeRequired === true);
      setDone({
        name: response.fullName?.trim() || preview?.fullName?.trim() || response.username,
        tenantName: preview?.tenantName ?? null,
        role: response.role,
      });
      setStage('done');
    } catch (err) {
      if (err instanceof ApiError && err.status === 410) setStage('invalid');
      else if (err instanceof ApiError && err.status === 429) setFailure({ kind: 'rateLimited', minutes: retryAfterMinutes(err, 30) });
      else setFailure({ kind: 'server' });
    } finally {
      setIsLoading(false);
    }
  };

  // "Contraseña lista" for a beat, then the welcome overlay covers the route
  // change and the panel's first paint — the same ceremony as the login.
  useEffect(() => {
    if (stage !== 'done' || !done) return;
    const timer = window.setTimeout(() => {
      startWelcome(done.name);
      setWelcomeCompany(done.tenantName);
      navigate(AuthService.getDashboardRoute(done.role));
    }, DONE_MS);
    return () => window.clearTimeout(timer);
  }, [stage, done, navigate]);

  const setup = preview?.intent === 'SETUP';
  // 02 and 02A share the layout; these are the words that differ.
  const copy = setup
    ? {
        kicker: t('resetPassword.setup.kicker'),
        heroTitle: t('resetPassword.setup.hero.title'),
        heroBody: t('resetPassword.setup.hero.body'),
        stamps: [
          { value: t('resetPassword.setup.hero.ttlValue'), label: t('resetPassword.setup.hero.ttl') },
          { value: t('resetPassword.hero.rangeValue'), label: t('resetPassword.hero.range') },
        ],
        paperKicker: t('resetPassword.setup.paperKicker'),
        title: t('resetPassword.setup.title'),
        subtitle: t('resetPassword.setup.subtitle'),
        label: t('resetPassword.setup.newPassword.label'),
        submit: t('resetPassword.setup.submit'),
        seal: t('resetPassword.setup.seal'),
      }
    : {
        kicker: t('resetPassword.kicker'),
        heroTitle: t('resetPassword.hero.title'),
        heroBody: t('resetPassword.hero.body'),
        stamps: [
          { value: t('resetPassword.hero.rangeValue'), label: t('resetPassword.hero.range') },
          { value: t('resetPassword.hero.rulesValue'), label: t('resetPassword.hero.rules') },
        ],
        paperKicker: t('resetPassword.paperKicker'),
        title: t('resetPassword.title'),
        subtitle: t('resetPassword.subtitle'),
        label: t('resetPassword.newPassword.label'),
        submit: t('resetPassword.submit'),
        seal: t('resetPassword.singleUseSeal'),
      };

  const missing = Math.max(0, PASSWORD_MIN - typed.length);
  const meetsMinimum = typed.length >= PASSWORD_MIN;
  const field = (bad: boolean) => authField(bad, isLoading);

  return (
    <>
      <AuthShell kicker={copy.kicker} heroTitle={copy.heroTitle} heroBody={copy.heroBody} stamps={copy.stamps}>
        <PaperKicker>{copy.paperKicker}</PaperKicker>

        {stage === 'verifying' && showVerifying && (
          <div role="status" data-testid="reset-verifying" className="mt-6">
            <Mono className="inline-flex items-center gap-2.5 text-[10px] tracking-[0.14em] text-[#8A8175]">
              <AuthSpinner onPaper />
              {t('resetPassword.verifying')}
            </Mono>
          </div>
        )}

        {stage === 'invalid' && (
          <div data-testid="reset-invalid">
            <PaperTitle>{t('resetPassword.invalid.title')}</PaperTitle>
            <PaperLead className="mb-7">{t('resetPassword.invalid.message')}</PaperLead>
            <AuthSubmitButton type="button" onClick={() => navigate('/forgot-password')}>
              {t('resetPassword.invalid.request')}
              <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
            </AuthSubmitButton>
            <div className="mt-5">
              <AuthTextLink to="/login">{t('resetPassword.backToLogin')}</AuthTextLink>
            </div>
          </div>
        )}

        {(stage === 'form' || stage === 'done') && (
          <>
            <PaperTitle>{copy.title}</PaperTitle>
            {preview && (
              <AccountBlock username={preview.username} fullName={preview.fullName} tenantName={preview.tenantName} className="mt-5" />
            )}
            <PaperLead className={cn('mb-7', preview && 'mt-4')}>{copy.subtitle}</PaperLead>

            {failure?.kind === 'rateLimited' && (
              <AuthNotice tone="orange" title={t('resetPassword.rateLimited.title')}>
                {t('resetPassword.rateLimited.message', { minutes: failure.minutes })}
              </AuthNotice>
            )}
            {failure?.kind === 'server' && (
              <AuthNotice
                tone="red"
                title={t('resetPassword.error.server.title')}
                action={<AuthRetryButton onClick={() => onSubmit(getValues())}>{t('resetPassword.retry')}</AuthRetryButton>}
              >
                {t('resetPassword.error.server.message')}
              </AuthNotice>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-[15px] lg:gap-4" noValidate>
              <div>
                <FieldLabel htmlFor="newPassword">{copy.label}</FieldLabel>
                <div className="flex">
                  <input
                    id="newPassword"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    maxLength={PASSWORD_MAX}
                    disabled={isLoading}
                    {...register('newPassword', {
                      required: t('resetPassword.newPassword.required'),
                      minLength: { value: PASSWORD_MIN, message: 'tooShort' },
                    })}
                    aria-invalid={errors.newPassword ? 'true' : 'false'}
                    aria-describedby="newPassword-hint"
                    className={cn(field(!!errors.newPassword), 'flex-1 min-w-0')}
                  />
                  <EyeButton
                    shown={showPassword}
                    onToggle={() => setShowPassword(prev => !prev)}
                    showLabel={t('login.password.show')}
                    hideLabel={t('login.password.hide')}
                    disabled={isLoading}
                  />
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  {errors.newPassword
                    ? (
                      <FieldError>
                        {errors.newPassword.type === 'minLength'
                          ? t('resetPassword.newPassword.tooShort', { count: missing })
                          : errors.newPassword.message}
                      </FieldError>
                    )
                    : <span id="newPassword-hint"><FieldHint className="normal-case tracking-normal">{t('resetPassword.newPassword.hint')}</FieldHint></span>}
                  {typed.length > 0 && (
                    <span data-testid="password-counter" className="flex-shrink-0 mt-1.5">
                      <Mono className="text-[9.5px] tracking-[0.1em] text-[#8A8175]">{typed.length}/{PASSWORD_MAX}</Mono>
                    </span>
                  )}
                </div>
                {meetsMinimum && <AuthSeal tone="orange" className="mt-2">{t('resetPassword.meetsMinimum')}</AuthSeal>}
              </div>

              <AuthSubmitButton busy={isLoading} busyLabel={t('resetPassword.submitting')} className="mt-1">
                {copy.submit}
                <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
              </AuthSubmitButton>

              <div className="flex items-center justify-between gap-4 mt-2">
                <AuthTextLink to="/login">{t('resetPassword.backToLogin')}</AuthTextLink>
                <AuthSeal>{copy.seal}</AuthSeal>
              </div>
            </form>
          </>
        )}
      </AuthShell>

      {stage === 'done' && done && (
        <AuthDone title={t('resetPassword.done.title')} subtitle={t('resetPassword.done.entering')} name={done.name} tenantName={done.tenantName} />
      )}
    </>
  );
}
