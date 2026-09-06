// Public forgot-password request page (Claude Design "Contraseñas
// BuildTrack" 01 / 01B / 01C). The person supplies their workspace
// identifier + email; the server emails the reset link.
//
// Anti-enumeration: the backend returns 204 for BOTH a matching and a
// non-matching (slug, email) pair, so a *successful* request reveals nothing
// about whether the account exists — we therefore show one generic "check
// your inbox" state for every 204, in the same 404 px the form occupied. The
// only signal we act on is transport success vs failure: if the request
// REJECTS (timeout / network / 5xx / 429) we keep the form and say so.

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';

import { PasswordResetService, PasswordResetRequestPayload } from '../services/passwordReset';
import { getStoredTenantSlug, ApiError } from '../lib/api';
import { retryAfterMinutes } from '../lib/rateLimit';
import { cn } from '../components/ui/utils';
import { FieldError, FieldHint, FieldLabel, INPUT_MONO } from '../components/projects/bt';
import {
  authField, AuthChip, AuthNotice, AuthRetryButton, AuthSeal, AuthSecondaryButton, AuthShell, AuthSubmitButton,
  AuthTextLink, PaperKicker, PaperLead, PaperTitle,
} from '../components/auth/AuthShell';
import { FIELD_LIMITS } from '../../shared/fieldLimits';

type Failure = { kind: 'rateLimited'; minutes: number } | { kind: 'server' };

export function ForgotPassword() {
  const { t } = useTranslation('auth');

  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const remembered = getStoredTenantSlug() ?? '';

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<PasswordResetRequestPayload>({
    defaultValues: { tenantSlug: remembered, email: '' },
  });

  const send = async (data: PasswordResetRequestPayload) => {
    setIsLoading(true);
    setFailure(null);
    try {
      await PasswordResetService.request({
        tenantSlug: data.tenantSlug.trim().toLowerCase(),
        email: data.email.trim(),
      });
      // 204 for a real account and for an unknown one alike — this branch
      // says only "the request went through".
      setSubmitted(true);
    } catch (err) {
      // Never reached its 204: timeout, network, 5xx or 429. Keep the form
      // up. Branches ONLY on transport, never on account existence.
      setFailure(
        err instanceof ApiError && err.status === 429
          ? { kind: 'rateLimited', minutes: retryAfterMinutes(err, 30) }
          : { kind: 'server' },
      );
    } finally {
      setIsLoading(false);
    }
  };

  const field = (bad: boolean) => authField(bad, isLoading);
  const locked = isLoading || failure?.kind === 'rateLimited';

  return (
    <AuthShell
      kicker={t('forgotPassword.kicker')}
      heroTitle={t('forgotPassword.hero.title')}
      heroBody={t('forgotPassword.hero.body')}
      stamps={[
        { value: t('forgotPassword.hero.ttlValue'), label: t('forgotPassword.hero.ttl') },
        { value: t('forgotPassword.hero.onceValue'), label: t('forgotPassword.hero.once') },
      ]}
    >
      <PaperKicker>{t('forgotPassword.paperKicker')}</PaperKicker>

      {submitted ? (
        // 01B "Enviado": the paper panel takes the form's place; the ink
        // column and the composition stay, so nobody doubts the send happened.
        <div data-testid="forgot-sent">
          <AuthChip className="mt-4">{t('forgotPassword.sent.chip')}</AuthChip>
          <h1 className="font-bt-display font-extrabold uppercase text-[34px] lg:text-[40px] leading-[0.94] text-[#0A0A0A] mt-3">{t('forgotPassword.sent.title')}</h1>
          <p className="text-[14px] leading-[1.6] text-[#3B342A] mt-4">{t('forgotPassword.sentBody')}</p>
          <div className="flex flex-wrap gap-x-6 gap-y-2 mt-5">
            <AuthSeal>{t('forgotPassword.sent.expires')}</AuthSeal>
            <AuthSeal>{t('forgotPassword.sent.once')}</AuthSeal>
          </div>
          <AuthNotice tone="orange" className="mt-6 mb-0">{t('forgotPassword.sent.note')}</AuthNotice>
          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <AuthSecondaryButton onClick={() => { setSubmitted(false); setFailure(null); }} className="sm:flex-1">
              {t('forgotPassword.sent.again')}
            </AuthSecondaryButton>
            <AuthTextLink to="/login" className="inline-flex items-center justify-center py-3 sm:flex-1">{t('forgotPassword.sent.back')}</AuthTextLink>
          </div>
        </div>
      ) : (
        <>
          <PaperTitle>{t('forgotPassword.title')}</PaperTitle>
          <PaperLead className="mb-7">{t('forgotPassword.subtitle')}</PaperLead>

          {failure?.kind === 'rateLimited' && (
            <AuthNotice tone="orange" title={t('forgotPassword.rateLimited.title')}>
              {t('forgotPassword.rateLimited.message', { minutes: failure.minutes })}
              <span className="block mt-1.5 text-[12.5px] text-[#5A5346]">{t('forgotPassword.rateLimited.note')}</span>
            </AuthNotice>
          )}
          {failure?.kind === 'server' && (
            <AuthNotice
              tone="red"
              title={t('forgotPassword.serverError.title')}
              action={<AuthRetryButton onClick={() => send(getValues())}>{t('forgotPassword.retry')}</AuthRetryButton>}
            >
              {t('forgotPassword.error')}
            </AuthNotice>
          )}

          <form onSubmit={handleSubmit(send)} className="flex flex-col gap-[15px] lg:gap-4" noValidate>
            <div>
              <FieldLabel htmlFor="tenantSlug">{t('login.tenantSlug.label')}</FieldLabel>
              <input
                id="tenantSlug"
                type="text"
                autoComplete="organization"
                placeholder={t('login.tenantSlug.placeholder')}
                disabled={locked}
                {...register('tenantSlug')}
                maxLength={FIELD_LIMITS.LEGACY_WORKSPACE_SLUG}
                className={cn(field(!!errors.tenantSlug), INPUT_MONO, 'text-[13.5px] lg:text-[13px]')}
              />
              <FieldHint className="normal-case tracking-normal">{t('forgotPassword.tenantSlug.help')}</FieldHint>
            </div>

            <div>
              <FieldLabel htmlFor="email">{t('forgotPassword.email.label')}</FieldLabel>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder={t('forgotPassword.email.placeholder')}
                maxLength={FIELD_LIMITS.EMAIL}
                disabled={locked}
                {...register('email', {
                  required: t('forgotPassword.email.required'),
                  pattern: { value: /^[^@\s]+@[^@\s]+\.[^@\s]+$/, message: t('forgotPassword.email.invalid') },
                })}
                aria-invalid={errors.email ? 'true' : 'false'}
                className={field(!!errors.email)}
              />
              {errors.email
                ? <FieldError>{errors.email.message}</FieldError>
                : <FieldHint className="normal-case tracking-normal">{t('forgotPassword.email.hint')}</FieldHint>}
            </div>

            <AuthSubmitButton busy={isLoading} busyLabel={t('forgotPassword.submitting')} disabled={failure?.kind === 'rateLimited'} className="mt-1">
              {t('forgotPassword.submit')}
              <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
            </AuthSubmitButton>

            <div className="flex items-center justify-between gap-4 mt-2">
              <AuthTextLink to="/login">{t('forgotPassword.backToLogin')}</AuthTextLink>
              <AuthSeal>{t('forgotPassword.expiresSeal')}</AuthSeal>
            </div>
          </form>
        </>
      )}
    </AuthShell>
  );
}
