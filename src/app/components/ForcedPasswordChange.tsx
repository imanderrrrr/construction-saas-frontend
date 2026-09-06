// BuildTrack — the screen a user meets when their password is still the one
// an admin handed them (Claude Design "Contraseñas BuildTrack" 04 / 04B).
//
// Rendered BY PasswordChangeGuard in place of the dashboard, rather than as a
// route of its own: the user has already been routed to the dashboard their
// role earns them, and this is the first thing waiting there. Keeping the URL
// on the dashboard is what makes "you landed in your workspace, and the first
// thing it asks is this" true, and it means the guard can simply stop
// rendering the screen once the password is set — no second navigation.
//
// It is NOT the login again: the person is in. So the surface is the panel's
// — the 82 px ink bar with their name, paper behind, a 560 px panel — with no
// sidebar and nothing else to touch. There is deliberately no way past it. No
// cancel, no "later", no link into the app: the backend rejects everything
// else anyway (see TemporaryPasswordFilter). Signing out is the one
// alternative, because trapping someone in a session they cannot leave is
// worse than the block itself.
//
// On success the welcome ceremony takes the screen (the same one the login
// starts) and the guard reveals the dashboard behind it — no success screen
// of its own.

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Building2 } from 'lucide-react';

import { ApiError, AuthService } from '../services/auth';
import { getBranding } from '../services/branding';
import { getStoredTenantSlug } from '../lib/api';
import { retryAfterMinutes } from '../lib/rateLimit';
import { setPasswordChangeRequired, clearPasswordChangeState } from '../lib/passwordChangeState';
import { setWelcomeCompany, startWelcome } from '../lib/welcome';
import { cn } from './ui/utils';
import { InkBar, TertiaryButton } from './onboarding/chrome';
import { CreateButton, Mono, PaperNote } from './projects/bt';
import { LanguageSwitcher } from './LanguageSwitcher';
import { PasswordField } from './account/PasswordField';

interface FormFields {
  currentPassword: string;
  newPassword: string;
}

interface ForcedPasswordChangeProps {
  /** Called once the server has accepted the new password. */
  onChanged: () => void;
}

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 100;

type Failure = { kind: 'rateLimited'; minutes: number } | { kind: 'server' } | null;

export function ForcedPasswordChange({ onChanged }: ForcedPasswordChangeProps) {
  const { t, i18n } = useTranslation(['auth', 'common']);

  const [isLoading, setIsLoading] = useState(false);
  const [failure, setFailure] = useState<Failure>(null);
  const [fieldError, setFieldError] = useState<'current' | 'new' | null>(null);
  const [me, setMe] = useState<{ name: string; username: string } | null>(null);

  // Whose panel this is. /auth/me is on the temporary-password allowlist;
  // branding is not, so the company waits for the welcome.
  useEffect(() => {
    let cancelled = false;
    Promise.resolve()
      .then(() => AuthService.getMe())
      .then(m => { if (!cancelled) setMe({ name: m.fullName?.trim() || m.username, username: m.username }); })
      .catch(() => { /* the bar falls back to the stored username */ });
    return () => { cancelled = true; };
  }, []);

  const username = me?.username ?? AuthService.getUsername() ?? '';
  const name = me?.name ?? username;
  const slug = getStoredTenantSlug();
  const workspace = slug && slug !== 'default' ? slug : null;

  const stamp = useMemo(() => {
    const locale = (i18n?.language ?? 'es').startsWith('en') ? 'en-US' : 'es';
    const now = new Date();
    const date = now.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' }).replace(/\./g, '');
    const time = now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    return `${date} · ${time}`.toUpperCase();
  }, [i18n?.language]);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<FormFields>({ defaultValues: { currentPassword: '', newPassword: '' } });

  const onSubmit = async (data: FormFields) => {
    setIsLoading(true);
    setFailure(null);
    setFieldError(null);
    try {
      await AuthService.changePassword(data);
      // The backend lifts the block on this same session, so the guard can
      // let the dashboard through immediately — no re-login, no reload. The
      // welcome covers the reveal, exactly as after a sign-in.
      setPasswordChangeRequired(false);
      startWelcome(name);
      getBranding()
        .then(b => setWelcomeCompany(b.organizationName ?? null))
        .catch(() => { /* the seal reads "Entrando al panel" on its own */ });
      onChanged();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setFieldError('current');
      else if (err instanceof ApiError && err.code === 'PASSWORD_UNCHANGED') setFieldError('new');
      else if (err instanceof ApiError && err.status === 429) setFailure({ kind: 'rateLimited', minutes: retryAfterMinutes(err, 15) });
      else setFailure({ kind: 'server' });
    } finally {
      setIsLoading(false);
    }
  };

  const onSignOut = async () => {
    clearPasswordChangeState();
    await AuthService.logout();
    window.location.href = '/login';
  };

  const missing = Math.max(0, PASSWORD_MIN - (getValues('newPassword')?.length ?? 0));

  return (
    <div className="min-h-screen flex flex-col bg-[#F3EEE4]" data-testid="forced-password-change">
      {/* The panel's bar, not the login's column: the person is in. */}
      <InkBar grid={26} className="flex-shrink-0 h-[82px] px-5 lg:px-8">
        <div className="relative h-full flex items-center justify-between gap-4">
          <div className="flex items-center gap-5 min-w-0">
            <span className="inline-flex items-center gap-2.5 flex-shrink-0">
              <span className="w-8 h-8 bg-[#F97316] flex items-center justify-center" aria-hidden="true">
                <Building2 className="w-4 h-4 text-[#0A0A0A]" strokeWidth={1.8} />
              </span>
              <span className="font-bt-display font-extrabold uppercase text-[26px] leading-none tracking-[0.01em] text-[#F5F1E8]">BuildTrack</span>
            </span>
            <Mono className="hidden sm:inline-flex items-center gap-2 text-[9.5px] font-semibold tracking-[0.14em] text-[#F97316]">
              <span className="inline-block w-2 h-2 bg-[#F97316]" aria-hidden="true" />
              {t('auth:changePassword.barSeal')}
            </Mono>
          </div>
          <div className="flex items-center gap-3 min-w-0">
            <div className="text-right min-w-0 hidden sm:block">
              <p className="text-[13px] font-semibold text-[#F5F1E8] truncate">{name}</p>
              <Mono className="block text-[9px] tracking-[0.12em] text-[rgba(245,241,232,0.6)] truncate">{workspace ? `${username} · ${workspace}` : username}</Mono>
            </div>
            <span className="w-8 h-8 flex-shrink-0 flex items-center justify-center bg-[#F5F1E8] text-[#0A0A0A] font-bt-mono text-[10px] font-semibold" aria-hidden="true">
              {initials(name, username)}
            </span>
          </div>
        </div>
      </InkBar>

      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <section className="w-full max-w-[560px] bg-[#FAF7F0] border border-[#DBD0BB] shadow-[0_16px_48px_rgba(23,19,15,0.12)]">
          <div className="px-6 py-7 lg:px-10 lg:py-[34px]">
            <Mono className="block text-[9.5px] font-semibold tracking-[0.14em] text-[#8A8175]">{t('auth:changePassword.kicker')}</Mono>
            <h1 className="font-bt-display font-extrabold uppercase text-[40px] lg:text-[48px] leading-[0.94] text-[#0A0A0A] mt-2">{t('auth:changePassword.title')}</h1>

            <PaperNote tone="orange" className="mt-5">
              <Mono className="block text-[9.5px] font-semibold tracking-[0.12em] text-[#C2410C]">{t('auth:changePassword.notice.title')}</Mono>
              <p className="text-[13.5px] leading-[1.5] text-[#43301F] mt-1">{t('auth:changePassword.notice.message')}</p>
            </PaperNote>

            {failure?.kind === 'rateLimited' && (
              <div role="alert" className="mt-4">
                <PaperNote tone="orange">
                  <Mono className="block text-[9.5px] font-semibold tracking-[0.12em] text-[#C2410C]">{t('auth:changePassword.error.rateLimited.title')}</Mono>
                  <p className="text-[13.5px] leading-[1.5] text-[#43301F] mt-1">{t('auth:changePassword.error.rateLimited.message', { minutes: failure.minutes })}</p>
                </PaperNote>
              </div>
            )}
            {failure?.kind === 'server' && (
              <div role="alert" className="mt-4">
                <PaperNote tone="red">
                  <Mono className="block text-[9.5px] font-semibold tracking-[0.12em] text-[#B3402A]">{t('auth:changePassword.error.server.title')}</Mono>
                  <p className="text-[13.5px] leading-[1.5] text-[#43301F] mt-1">{t('auth:changePassword.error.server.message')}</p>
                </PaperNote>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 mt-6" noValidate>
              <PasswordField
                id="currentPassword"
                label={t('auth:changePassword.currentPassword.label')}
                hint={t('auth:changePassword.currentPassword.hint')}
                error={errors.currentPassword?.message ?? (fieldError === 'current' ? t('auth:changePassword.error.credentials') : undefined)}
                autoComplete="current-password"
                disabled={isLoading}
                {...register('currentPassword', {
                  required: t('auth:changePassword.currentPassword.required'),
                  onChange: () => { if (fieldError === 'current') setFieldError(null); },
                })}
              />
              <PasswordField
                id="newPassword"
                label={t('auth:changePassword.newPassword.label')}
                hint={t('auth:changePassword.newPassword.hint')}
                error={
                  errors.newPassword
                    ? (errors.newPassword.type === 'minLength'
                      ? t('auth:changePassword.newPassword.tooShort', { count: missing })
                      : errors.newPassword.message)
                    : fieldError === 'new' ? t('auth:changePassword.error.unchanged') : undefined
                }
                autoComplete="new-password"
                maxLength={PASSWORD_MAX}
                disabled={isLoading}
                {...register('newPassword', {
                  required: t('auth:changePassword.newPassword.required'),
                  minLength: { value: PASSWORD_MIN, message: 'tooShort' },
                  onChange: () => { if (fieldError === 'new') setFieldError(null); },
                })}
              />

              <CreateButton
                type="submit"
                disabled={isLoading || failure?.kind === 'rateLimited'}
                aria-busy={isLoading || undefined}
                className={cn('w-full py-4 mt-1', isLoading && 'bg-[#3A3733] hover:bg-[#3A3733] hover:text-[#F5F1E8] cursor-wait')}
              >
                {isLoading ? (
                  <>
                    <span className="inline-block w-3 h-3 rounded-full border-2 border-[rgba(245,241,232,0.35)] border-t-[#F97316] animate-spin" aria-hidden="true" />
                    {t('auth:changePassword.submitting')}
                  </>
                ) : (
                  <>
                    {t('auth:changePassword.submit')}
                    <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
                  </>
                )}
              </CreateButton>

              <Mono className="inline-flex items-center gap-2.5 text-[9.5px] tracking-[0.14em] text-[#8A8175] mt-1">
                <span className="inline-block w-2 h-2 bg-[#F97316]" aria-hidden="true" />
                {t('auth:changePassword.privateNote')}
              </Mono>
            </form>
          </div>

          <div className="flex items-center justify-between gap-3 bg-[#F3EEE4] border-t border-[#DBD0BB] px-6 lg:px-10 py-3">
            <LanguageSwitcher variant="shell" />
            <TertiaryButton onClick={onSignOut}>{t('auth:changePassword.signOut')}</TertiaryButton>
          </div>
        </section>
      </main>

      <footer className="flex items-center justify-between gap-4 px-5 lg:px-8 pb-5 font-bt-mono text-[9px] uppercase tracking-[0.14em] text-[#A69C8D]">
        <span>{t('auth:changePassword.blockedSeal')}</span>
        <span>{stamp}</span>
      </footer>
    </div>
  );
}

function initials(name: string, username: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  if (words.length === 1 && words[0]) return words[0].slice(0, 2).toUpperCase();
  return username.slice(0, 2).toUpperCase();
}
