// Public landing for invitation links: /accept-invite/:token (Claude Design
// "Contraseñas BuildTrack" 03 / 03B / 03C). The token in the URL IS the auth.
// On submit the server creates the user in the inviting workspace and opens
// the session, so the page hands over to the welcome and the role's panel —
// never to the sign-in form.

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';

import { InvitationsService, InvitationPreview, AcceptInvitationPayload } from '../services/invitations';
import { AuthService, ApiError } from '../services/auth';
import { retryAfterMinutes } from '../lib/rateLimit';
import { setPasswordChangeRequired } from '../lib/passwordChangeState';
import { setWelcomeCompany, startWelcome } from '../lib/welcome';
import { cn } from '../components/ui/utils';
import { FieldError, FieldHint, FieldLabel, Mono, stampDay } from '../components/projects/bt';
import { FOCUS_RING } from '../components/onboarding/chrome';
import {
  authField, AuthDone, AuthNotice, AuthRetryButton, AuthSeal, AuthShell, AuthSpinner, AuthSubmitButton, AuthTextLink,
  EyeButton, PaperKicker, PaperLead, PaperTitle,
} from '../components/auth/AuthShell';
import { FIELD_LIMITS } from '../../shared/fieldLimits';
import { DONE_MS, PASSWORD_MAX, PASSWORD_MIN } from './ResetPassword';

type Stage = 'loading' | 'form' | 'invalid' | 'done';
type Failure =
  | { kind: 'usernameTaken'; suggestions: string[] }
  | { kind: 'rateLimited'; minutes: number }
  | { kind: 'validation' }
  | { kind: 'server' }
  | null;

const USERNAME_PATTERN = /^[a-zA-Z0-9._-]+$/;

/**
 * Three alternatives for a taken username, built on the client from what
 * the person typed and their name: "otto.ramirez" → otto.ramirez2, o.ramirez,
 * otto.r. They are suggestions, not checked against the server — a second
 * clash simply comes back as another 409.
 */
export function suggestUsernames(username: string, fullName: string): string[] {
  const clean = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9._-]/g, '');
  const base = clean(username) || 'usuario';
  const parts = fullName.trim().split(/\s+/).map(clean).filter(Boolean);
  const out: string[] = [`${base}2`];
  if (parts.length >= 2) {
    const first = parts[0];
    const last = parts[parts.length - 1];
    out.push(`${first[0]}.${last}`, `${first}.${last[0]}`);
  } else if (parts.length === 1) {
    out.push(`${parts[0]}.1`, `${parts[0]}${new Date().getFullYear() % 100}`);
  }
  return [...new Set(out)].filter(s => s !== username && USERNAME_PATTERN.test(s)).slice(0, 3);
}

export function AcceptInvite() {
  const { t, i18n } = useTranslation('auth');
  const navigate = useNavigate();
  const { token } = useParams<{ token: string }>();

  const [stage, setStage] = useState<Stage>('loading');
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [failure, setFailure] = useState<Failure>(null);
  const [done, setDone] = useState<{ name: string; role: string } | null>(null);

  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<AcceptInvitationPayload>({
    defaultValues: { username: '', password: '', fullName: '' },
  });

  // Fetch the preview on mount. A dead token cannot even show the form.
  useEffect(() => {
    if (!token) { setStage('invalid'); return; }
    let cancelled = false;
    InvitationsService.preview(token)
      .then(p => { if (!cancelled) { setPreview(p); setStage('form'); } })
      .catch((err: unknown) => {
        if (cancelled) return;
        // Anything but a live preview is the same dead end for the invitee:
        // they cannot mint themselves another link.
        setStage(err instanceof ApiError && err.status === 410 ? 'invalid' : 'invalid');
      });
    return () => { cancelled = true; };
  }, [token]);

  const onSubmit = async (data: AcceptInvitationPayload) => {
    if (!token) return;
    setIsLoading(true);
    setFailure(null);
    try {
      const response = await InvitationsService.accept(token, {
        fullName: data.fullName.trim(),
        username: data.username.trim(),
        password: data.password,
      });
      setPasswordChangeRequired(response.passwordChangeRequired === true);
      setDone({ name: response.fullName?.trim() || data.fullName.trim() || response.username, role: response.role });
      setStage('done');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 410) { setStage('invalid'); return; }
        if (err.status === 409) { setFailure({ kind: 'usernameTaken', suggestions: suggestUsernames(data.username.trim(), data.fullName) }); return; }
        if (err.status === 429) { setFailure({ kind: 'rateLimited', minutes: retryAfterMinutes(err, 30) }); return; }
        if (err.status === 400) { setFailure({ kind: 'validation' }); return; }
      }
      setFailure({ kind: 'server' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (stage !== 'done' || !done) return;
    const timer = window.setTimeout(() => {
      startWelcome(done.name);
      setWelcomeCompany(preview?.tenantName ?? null);
      navigate(AuthService.getDashboardRoute(done.role));
    }, DONE_MS);
    return () => window.clearTimeout(timer);
  }, [stage, done, preview, navigate]);

  const roleLabel = preview ? t(`role.${preview.role}`) : '';
  const roleInSentence = roleLabel.toLowerCase();
  const expires = preview ? stampDay(preview.expiresAt, i18n.language ?? 'es') : '';
  const field = (bad: boolean) => authField(bad, isLoading);

  return (
    <>
      <AuthShell
        kicker={t('acceptInvite.kicker')}
        heroTitle={preview ? t('acceptInvite.hero.title', { tenant: preview.tenantName }) : t('acceptInvite.hero.titleGeneric')}
        heroBody={
          preview
            ? (preview.invitedByName
              ? t('acceptInvite.hero.body', { name: preview.invitedByName, role: roleInSentence })
              : t('acceptInvite.hero.bodyNoInviter', { role: roleInSentence }))
            : t('acceptInvite.hero.bodyGeneric')
        }
        heroExtra={preview ? (
          <div className="flex flex-wrap gap-2 mt-6">
            <Mono className="bg-[#F97316] text-[#0A0A0A] text-[9.5px] font-semibold tracking-[0.14em] px-2.5 py-1">{roleLabel}</Mono>
            <Mono className="border border-[rgba(245,241,232,0.35)] text-[#F5F1E8] text-[9.5px] tracking-[0.14em] px-2.5 py-1">{preview.tenantName}</Mono>
          </div>
        ) : undefined}
        stamps={[
          { value: t('acceptInvite.hero.ttlValue'), label: t('acceptInvite.hero.ttl') },
          { value: t('acceptInvite.hero.onceValue'), label: t('acceptInvite.hero.once') },
        ]}
      >
        <PaperKicker>{t('acceptInvite.paperKicker')}</PaperKicker>

        {stage === 'loading' && (
          <div role="status" data-testid="invite-loading" className="mt-6">
            <Mono className="inline-flex items-center gap-2.5 text-[10px] tracking-[0.14em] text-[#8A8175]">
              <AuthSpinner onPaper />
              {t('acceptInvite.loading')}
            </Mono>
          </div>
        )}

        {stage === 'invalid' && (
          <div data-testid="invite-invalid">
            <PaperTitle>{t('acceptInvite.invalid.title')}</PaperTitle>
            <PaperLead className="mb-7">{t('acceptInvite.invalid.message')}</PaperLead>
            {/* No primary here on purpose: the invitee cannot mint a new link. */}
            <AuthTextLink to="/login">{t('acceptInvite.invalid.goLogin')}</AuthTextLink>
          </div>
        )}

        {(stage === 'form' || stage === 'done') && preview && (
          <>
            <PaperTitle>{t('acceptInvite.title')}</PaperTitle>
            <PaperLead className="mb-7">
              {t('acceptInvite.subtitle', { tenant: preview.tenantName, role: roleInSentence })}
            </PaperLead>

            {failure?.kind === 'rateLimited' && (
              <AuthNotice tone="orange" title={t('acceptInvite.error.rateLimited.title')}>
                {t('acceptInvite.error.rateLimited.message', { minutes: failure.minutes })}
              </AuthNotice>
            )}
            {failure?.kind === 'validation' && (
              <AuthNotice tone="red" title={t('acceptInvite.error.validation.title')}>{t('acceptInvite.error.validation.message')}</AuthNotice>
            )}
            {failure?.kind === 'server' && (
              <AuthNotice
                tone="red"
                title={t('acceptInvite.error.server.title')}
                action={<AuthRetryButton onClick={() => onSubmit(getValues())}>{t('acceptInvite.retry')}</AuthRetryButton>}
              >
                {t('acceptInvite.error.server.message')}
              </AuthNotice>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-[15px] lg:gap-4" noValidate>
              <div>
                <FieldLabel htmlFor="fullName">{t('acceptInvite.fullName.label')}</FieldLabel>
                <input
                  id="fullName"
                  type="text"
                  autoComplete="name"
                  placeholder={t('acceptInvite.fullName.placeholder')}
                  maxLength={FIELD_LIMITS.PERSON_NAME}
                  disabled={isLoading}
                  {...register('fullName', { required: t('acceptInvite.fullName.required') })}
                  aria-invalid={errors.fullName ? 'true' : 'false'}
                  className={field(!!errors.fullName)}
                />
                {errors.fullName && <FieldError>{errors.fullName.message}</FieldError>}
              </div>

              <div>
                <FieldLabel htmlFor="username">{t('acceptInvite.username.label')}</FieldLabel>
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  placeholder={t('acceptInvite.username.placeholder')}
                  maxLength={FIELD_LIMITS.USERNAME}
                  disabled={isLoading}
                  {...register('username', {
                    required: t('acceptInvite.username.required'),
                    pattern: { value: USERNAME_PATTERN, message: t('acceptInvite.username.pattern') },
                    onChange: () => { if (failure?.kind === 'usernameTaken') setFailure(null); },
                  })}
                  aria-invalid={errors.username || failure?.kind === 'usernameTaken' ? 'true' : 'false'}
                  className={field(!!errors.username || failure?.kind === 'usernameTaken')}
                />
                {errors.username
                  ? <FieldError>{errors.username.message}</FieldError>
                  : failure?.kind === 'usernameTaken'
                    ? (
                      <div data-testid="username-taken">
                        <FieldError>{t('acceptInvite.usernameTaken', { tenant: preview.tenantName })}</FieldError>
                        {failure.suggestions.length > 0 && (
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <Mono className="text-[9px] tracking-[0.12em] text-[#8A8175]">{t('acceptInvite.suggestions')}</Mono>
                            {failure.suggestions.map(s => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => { setValue('username', s, { shouldValidate: true }); setFailure(null); }}
                                className={cn('font-bt-mono text-[10.5px] px-2.5 py-1 border border-[#DBD0BB] bg-white text-[#0A0A0A] hover:border-[#F97316] hover:text-[#C2410C]', FOCUS_RING)}
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                    : <FieldHint className="normal-case tracking-normal">{t('acceptInvite.username.hint')}</FieldHint>}
              </div>

              <div>
                <FieldLabel htmlFor="password">{t('acceptInvite.password.label')}</FieldLabel>
                <div className="flex">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    maxLength={PASSWORD_MAX}
                    disabled={isLoading}
                    {...register('password', {
                      required: t('acceptInvite.password.required'),
                      minLength: { value: PASSWORD_MIN, message: 'tooShort' },
                    })}
                    aria-invalid={errors.password ? 'true' : 'false'}
                    className={cn(field(!!errors.password), 'flex-1 min-w-0')}
                  />
                  <EyeButton
                    shown={showPassword}
                    onToggle={() => setShowPassword(prev => !prev)}
                    showLabel={t('login.password.show')}
                    hideLabel={t('login.password.hide')}
                    disabled={isLoading}
                  />
                </div>
                {errors.password
                  ? (
                    <FieldError>
                      {errors.password.type === 'minLength'
                        ? t('acceptInvite.password.tooShort', { count: Math.max(0, PASSWORD_MIN - (getValues('password')?.length ?? 0)) })
                        : errors.password.message}
                    </FieldError>
                  )
                  : <FieldHint className="normal-case tracking-normal">{t('acceptInvite.password.hint')}</FieldHint>}
              </div>

              <AuthSubmitButton busy={isLoading} busyLabel={t('acceptInvite.submitting')} className="mt-1">
                {t('acceptInvite.submit')}
                <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
              </AuthSubmitButton>

              <AuthSeal className="mt-2">
                {preview.invitedByName
                  ? t('acceptInvite.seal.invitedBy', { name: preview.invitedByName, date: expires })
                  : t('acceptInvite.seal.noInviter', { date: expires })}
              </AuthSeal>
            </form>
          </>
        )}
      </AuthShell>

      {stage === 'done' && done && (
        <AuthDone title={t('acceptInvite.done.title')} subtitle={t('acceptInvite.done.entering')} name={done.name} tenantName={preview?.tenantName} />
      )}
    </>
  );
}
