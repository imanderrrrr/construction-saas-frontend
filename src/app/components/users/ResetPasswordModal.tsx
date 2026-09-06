// Reset a user's password from the Usuarios drawer (Claude Design
// "Contraseñas BuildTrack" 06 / 06B). Replaces the browser's window.prompt:
// nobody types a password any more — the panel generates a temporary one in
// the same XXXX-XXXX format as the new-user card, the admin copies it or
// prints the credential sheet, and the person is asked to replace it the
// moment they sign in (the reset puts them behind the temporary-password
// block). Their open sessions are left alone.

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, FileDown, RefreshCw } from 'lucide-react';

import { resetPassword, type UserDTO } from '../../services/users';
import { loadInvoiceIssuer } from '../../services/invoiceBranding';
import { getStoredTenantSlug } from '../../lib/api';
import { businessToday, fmtDate } from '../../helpers/dateTime';
import { credentialPdfLabels, downloadCredentialPdf } from '../../helpers/exportCredentialPdf';
import { cn } from '../ui/utils';
import { PrimaryButton, SecondaryButton } from '../onboarding/chrome';
import { Mono, PaperNote } from '../projects/bt';
import { BtModal } from '../bt/windows';
import { randomPassword } from './shared';

type Stage = 'idle' | 'busy' | 'done' | 'error';

export function ResetPasswordModal({ open, onOpenChange, user, onReset }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserDTO;
  /** Called once the server confirmed the new temporary password. */
  onReset?: () => void;
}) {
  const { t, i18n } = useTranslation(['admin', 'common']);
  const [password, setPassword] = useState(() => randomPassword());
  const [stage, setStage] = useState<Stage>('idle');
  const [copied, setCopied] = useState(false);
  const [pdfError, setPdfError] = useState(false);

  // A fresh password every time the window opens; nothing lingers.
  useEffect(() => {
    if (!open) return;
    setPassword(randomPassword());
    setStage('idle');
    setCopied(false);
    setPdfError(false);
  }, [open]);

  const name = user.fullName?.trim() || user.username;
  const firstName = name.split(/\s+/)[0] || user.username;

  const confirm = async () => {
    setStage('busy');
    try {
      await resetPassword(user.id, { newPassword: password });
      setStage('done');
      onReset?.();
    } catch {
      // The generated password stays on screen: a retry sends the SAME one,
      // so what the admin already read out is what ends up stored.
      setStage('error');
    }
  };

  const copy = () => {
    const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
    if (!clipboard?.writeText) return;
    clipboard.writeText(password).then(() => setCopied(true)).catch(() => { /* leave the value on screen */ });
  };

  const download = async () => {
    setPdfError(false);
    try {
      const issuer = await loadInvoiceIssuer();
      const slug = getStoredTenantSlug();
      downloadCredentialPdf(
        {
          fullName: user.fullName,
          username: user.username,
          roleLabel: t(`common:roles.${user.role}`),
          // Legacy single-tenant deployment: its users leave the identifier
          // blank, so "default" must not be printed as something to type.
          workspaceSlug: slug && slug !== 'default' ? slug : null,
          qrToken: null,
          secret: { kind: 'password', value: password },
        },
        credentialPdfLabels(t, { access: 'OFFICE', date: fmtDate(businessToday(), i18n?.language ?? 'es'), panelUrl: window.location.origin }),
        issuer,
      );
    } catch {
      setPdfError(true);
    }
  };

  const busy = stage === 'busy';
  const done = stage === 'done';

  const footer = done ? (
    <PrimaryButton onClick={() => onOpenChange(false)}>{t('admin:usr.d.reset.done.close')}</PrimaryButton>
  ) : (
    <>
      <SecondaryButton onClick={() => onOpenChange(false)} disabled={busy}>{t('common:buttons.cancel')}</SecondaryButton>
      <PrimaryButton onClick={confirm} disabled={busy} aria-busy={busy || undefined}>
        {busy ? t('admin:usr.d.reset.confirming') : stage === 'error' ? t('admin:usr.d.reset.retry') : t('admin:usr.d.reset.confirm')}
      </PrimaryButton>
    </>
  );

  return (
    <BtModal
      open={open}
      onOpenChange={onOpenChange}
      width={460}
      kicker={t('admin:usr.d.reset.kicker')}
      title={done ? t('admin:usr.d.reset.done.title') : t('admin:usr.d.reset.title', { name: firstName })}
      description={done ? t('admin:usr.d.reset.done.handOver', { name: firstName }) : t('admin:usr.d.reset.description')}
      footer={footer}
      dismissible={!busy}
      closeDisabled={busy}
    >
      <div data-testid="reset-password-modal" data-stage={stage}>
        {done ? (
          <>
            <PaperNote tone="orange">
              <p className="text-[13.5px] leading-[1.5] text-[#43301F]">{t('admin:usr.d.reset.done.once')}</p>
            </PaperNote>
            <div className="mt-4 border border-[#E7E1D5] bg-[#FAF7F0] px-4 py-3.5 grid grid-cols-[110px_1fr] gap-x-3 gap-y-2.5 items-baseline">
              <Mono className="text-[9.5px] tracking-[0.12em] text-[#A69C8D]">{t('admin:usr.d.username')}</Mono>
              <Mono className="text-[13px] normal-case tracking-normal text-[#0A0A0A]">{user.username}</Mono>
              <Mono className="text-[9.5px] tracking-[0.12em] text-[#A69C8D]">{t('admin:usr.d.password')}</Mono>
              <span data-testid="temp-password"><Mono className="text-[22px] font-semibold normal-case tracking-[0.08em] text-[#0A0A0A] select-all">{password}</Mono></span>
            </div>
            <div className="grid grid-cols-[auto_1fr] gap-2.5 mt-3.5">
              <SecondaryButton onClick={copy}><Copy className="w-3.5 h-3.5" />{copied ? t('admin:usr.d.reset.copied') : t('admin:usr.d.reset.copy')}</SecondaryButton>
              <SecondaryButton onClick={download} className="whitespace-normal text-center leading-tight"><FileDown className="w-3.5 h-3.5 flex-shrink-0" />{t('admin:usr.d.reset.done.download')}</SecondaryButton>
            </div>
            {pdfError && (
              <div role="alert" className="mt-3">
                <PaperNote tone="red"><p className="text-[13px] text-[#43301F]">{t('admin:usr.d.reset.pdfError')}</p></PaperNote>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="border border-[#E7E1D5] bg-[#FAF7F0] p-4">
              <Mono className="block text-[9.5px] tracking-[0.12em] text-[#A69C8D]">{t('admin:usr.d.reset.tempLabel')}</Mono>
              <span data-testid="temp-password" className="block mt-1.5">
                <Mono className={cn('block text-[30px] font-semibold normal-case tracking-[0.08em] text-[#0A0A0A] select-all', busy && 'opacity-70')}>
                  {password}
                </Mono>
              </span>
              <div className="grid grid-cols-2 gap-2.5 mt-3.5">
                <SecondaryButton onClick={() => { setPassword(randomPassword()); setCopied(false); }} disabled={busy}>
                  <RefreshCw className="w-3.5 h-3.5" />{t('admin:usr.d.reset.regenerate')}
                </SecondaryButton>
                <SecondaryButton onClick={copy} disabled={busy}>
                  <Copy className="w-3.5 h-3.5" />{copied ? t('admin:usr.d.reset.copied') : t('admin:usr.d.reset.copy')}
                </SecondaryButton>
              </div>
              <Mono className="block text-[9px] tracking-[0.12em] text-[#A69C8D] mt-3 leading-[1.5]">{t('admin:usr.d.reset.format')}</Mono>
            </div>

            {stage === 'error' ? (
              <div role="alert" className="mt-3.5">
                <PaperNote tone="red">
                  <Mono className="block text-[9.5px] font-semibold tracking-[0.12em] text-[#B3402A]">{t('admin:usr.d.reset.error.title')}</Mono>
                  <p className="text-[13.5px] leading-[1.5] text-[#43301F] mt-1">{t('admin:usr.d.reset.error.message', { name: firstName })}</p>
                </PaperNote>
              </div>
            ) : (
              <PaperNote tone="orange" className="mt-3.5">
                <p className="text-[13.5px] leading-[1.5] text-[#43301F]">{t('admin:usr.d.reset.note')}</p>
              </PaperNote>
            )}
          </>
        )}
      </div>
    </BtModal>
  );
}
