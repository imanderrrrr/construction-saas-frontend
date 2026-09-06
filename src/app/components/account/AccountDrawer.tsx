// «Mi cuenta» (Claude Design "Contraseñas BuildTrack" 05 / 05B): the one
// place in the panel where a person with a password of their own can change
// it. Until now the endpoint existed and no screen reached it — the only way
// to change a password was to pretend to have forgotten it.
//
// A right drawer of 492 px: identity above (read-only — the endpoint does not
// edit name or email yet), the change form below, "Cerrar sesión" in the
// foot. On success the confirmation replaces the two fields and the drawer
// stays open: the news sits where the action was, no toast. Changing the
// password closes the person's OTHER sessions (the backend keeps this one).

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { ApiError, AuthService, type MeResponse } from '../../services/auth';
import { getBranding } from '../../services/branding';
import { getStoredRole } from '../../lib/api';
import { retryAfterMinutes } from '../../lib/rateLimit';
import { cn } from '../ui/utils';
import { PrimaryButton, TertiaryButton } from '../onboarding/chrome';
import { Mono, PaperNote } from '../projects/bt';
import { BtDrawer } from '../bt/windows';
import { PasswordField } from './PasswordField';

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 100;

interface FormFields {
  currentPassword: string;
  newPassword: string;
}

type Failure = { kind: 'rateLimited'; minutes: number } | { kind: 'server' } | null;

export function AccountDrawer({ open, onOpenChange, onSignOut }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSignOut: () => void;
}) {
  const { t, i18n } = useTranslation(['admin', 'common']);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [company, setCompany] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [failure, setFailure] = useState<Failure>(null);
  const [fieldError, setFieldError] = useState<'current' | 'new' | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    getValues,
    formState: { errors },
  } = useForm<FormFields>({ defaultValues: { currentPassword: '', newPassword: '' } });

  // Fresh facts every time it opens; a closed drawer forgets its form.
  useEffect(() => {
    if (!open) {
      reset();
      setDone(null);
      setFailure(null);
      setFieldError(null);
      return;
    }
    let cancelled = false;
    Promise.resolve()
      .then(() => AuthService.getMe())
      .then(m => { if (!cancelled) setMe(m); })
      .catch(() => { /* the stored username and role stand in */ });
    getBranding()
      .then(b => { if (!cancelled) setCompany(b.organizationName ?? null); })
      .catch(() => { /* the row simply stays empty */ });
    return () => { cancelled = true; };
  }, [open, reset]);

  const username = me?.username ?? AuthService.getUsername() ?? '';
  const role = me?.role ?? getStoredRole() ?? '';
  const name = me?.fullName?.trim() || username;
  const roleLabel = role ? t(`common:roles.${role}`) : '';

  const stampNow = useMemo(() => () => {
    const locale = (i18n?.language ?? 'es').startsWith('en') ? 'en-US' : 'es';
    const now = new Date();
    const date = now.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' }).replace(/\./g, '');
    const time = now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    return `${date} · ${time}`;
  }, [i18n?.language]);

  const onSubmit = async (data: FormFields) => {
    setSaving(true);
    setFailure(null);
    setFieldError(null);
    try {
      await AuthService.changePassword(data);
      setDone(stampNow());
      reset();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setFieldError('current');
      else if (err instanceof ApiError && err.code === 'PASSWORD_UNCHANGED') setFieldError('new');
      else if (err instanceof ApiError && err.status === 429) setFailure({ kind: 'rateLimited', minutes: retryAfterMinutes(err, 15) });
      else setFailure({ kind: 'server' });
    } finally {
      setSaving(false);
    }
  };

  const missing = Math.max(0, PASSWORD_MIN - (getValues('newPassword')?.length ?? 0));

  const footer = done ? (
    <>
      <TertiaryButton onClick={onSignOut}>{t('common:signOut')}</TertiaryButton>
      <PrimaryButton onClick={() => onOpenChange(false)}>{t('admin:account.close')}</PrimaryButton>
    </>
  ) : (
    <>
      <TertiaryButton onClick={onSignOut} disabled={saving}>{t('common:signOut')}</TertiaryButton>
      <PrimaryButton type="submit" form="account-password-form" disabled={saving} aria-busy={saving || undefined}>
        {saving ? t('admin:account.change.submitting') : t('admin:account.change.submit')}
      </PrimaryButton>
    </>
  );

  return (
    <BtDrawer
      open={open}
      onOpenChange={onOpenChange}
      kicker={t('admin:account.kicker')}
      title={(
        <>
          <span className="block">{name}</span>
          <Mono className="block text-[10px] tracking-[0.12em] text-[rgba(245,241,232,0.65)] mt-1.5 normal-case">{username}{roleLabel ? ` · ${roleLabel}` : ''}</Mono>
        </>
      )}
      footer={footer}
      closeDisabled={saving}
    >
      <div data-testid="account-drawer">
        <SubHead>{t('admin:account.identity')}</SubHead>
        <dl className="mt-3 border border-[#E7E1D5] bg-white">
          <Row label={t('admin:account.name')} value={name} />
          <Row label={t('admin:account.username')} value={username} mono />
          <Row label={t('admin:account.role')} value={roleLabel || '—'} />
          <Row label={t('admin:account.company')} value={company ?? '—'} />
        </dl>

        <SubHead className="mt-7">{t('admin:account.change.title')}</SubHead>
        <p className="text-[13px] leading-[1.55] text-[#5A5346] mt-2">{t('admin:account.change.lead')}</p>

        {done ? (
          <div role="status" data-testid="account-done" className="mt-4">
            <PaperNote tone="orange">
              <Mono className="block text-[9.5px] font-semibold tracking-[0.12em] text-[#C2410C]">{t('admin:account.done.title')}</Mono>
              <p className="text-[13.5px] leading-[1.5] text-[#43301F] mt-1">{t('admin:account.done.message')}</p>
              <Mono className="block text-[9px] tracking-[0.12em] text-[#8A8175] mt-2">{done}</Mono>
            </PaperNote>
          </div>
        ) : (
          <form id="account-password-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-[13px] mt-4" noValidate>
            {failure?.kind === 'rateLimited' && (
              <div role="alert">
                <PaperNote tone="orange">
                  <Mono className="block text-[9.5px] font-semibold tracking-[0.12em] text-[#C2410C]">{t('admin:account.change.error.rateLimited.title')}</Mono>
                  <p className="text-[13.5px] leading-[1.5] text-[#43301F] mt-1">{t('admin:account.change.error.rateLimited.message', { minutes: failure.minutes })}</p>
                </PaperNote>
              </div>
            )}
            {failure?.kind === 'server' && (
              <div role="alert">
                <PaperNote tone="red">
                  <Mono className="block text-[9.5px] font-semibold tracking-[0.12em] text-[#B3402A]">{t('admin:account.change.error.server.title')}</Mono>
                  <p className="text-[13.5px] leading-[1.5] text-[#43301F] mt-1">{t('admin:account.change.error.server.message')}</p>
                </PaperNote>
              </div>
            )}
            <PasswordField
              compact
              id="account-current"
              label={t('admin:account.change.current')}
              error={errors.currentPassword?.message ?? (fieldError === 'current' ? t('admin:account.change.error.current') : undefined)}
              autoComplete="current-password"
              disabled={saving}
              {...register('currentPassword', {
                required: t('admin:account.change.currentRequired'),
                onChange: () => { if (fieldError === 'current') setFieldError(null); },
              })}
            />
            <PasswordField
              compact
              id="account-new"
              label={t('admin:account.change.new')}
              hint={t('admin:account.change.hint')}
              error={
                errors.newPassword
                  ? (errors.newPassword.type === 'minLength'
                    ? t('admin:account.change.tooShort', { count: missing })
                    : errors.newPassword.message)
                  : fieldError === 'new' ? t('admin:account.change.error.unchanged') : undefined
              }
              autoComplete="new-password"
              maxLength={PASSWORD_MAX}
              disabled={saving}
              {...register('newPassword', {
                required: t('admin:account.change.newRequired'),
                minLength: { value: PASSWORD_MIN, message: 'tooShort' },
                onChange: () => { if (fieldError === 'new') setFieldError(null); },
              })}
            />
          </form>
        )}
      </div>
    </BtDrawer>
  );
}

function SubHead({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <Mono className="text-[10px] font-semibold tracking-[0.14em] text-[#5A5346]">{children}</Mono>
      <span className="flex-1 h-px bg-[#E7E1D5]" aria-hidden="true" />
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 items-baseline px-3.5 py-2.5 border-b border-[#EDE7DB] last:border-b-0">
      <dt><Mono className="text-[9.5px] tracking-[0.12em] text-[#A69C8D]">{label}</Mono></dt>
      <dd className={cn('text-[13.5px] text-[#0A0A0A] min-w-0 truncate', mono && 'font-bt-mono text-[12.5px]')}>{value}</dd>
    </div>
  );
}
