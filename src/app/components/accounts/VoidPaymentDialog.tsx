import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BtModal } from '../bt/windows';
import { PrimaryButton, SecondaryButton } from '../onboarding/chrome';

export function VoidPaymentDialog({ onConfirm, onClose }: { onConfirm: (reason: string) => Promise<void>; onClose: () => void }) {
  const { t } = useTranslation(['finance','common']);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <BtModal open onOpenChange={open => { if (!open && !busy) onClose(); }} width={480}
    title={t('finance:void.confirmTitle')} closeDisabled={busy} footer={<>
      <SecondaryButton disabled={busy} onClick={onClose}>{t('common:buttons.cancel')}</SecondaryButton>
      <PrimaryButton disabled={busy} onClick={async () => {
        setBusy(true); setError('');
        try { await onConfirm(reason.trim()); onClose(); }
        catch (e) { setError(e instanceof Error ? e.message : t('common:error.generic')); }
        finally { setBusy(false); }
      }}>{t('finance:void.confirm')}</PrimaryButton>
    </>}>
    <p>{t('finance:void.explanation')}</p>
    <label className="block mt-3">{t('finance:void.reason')}<textarea className="w-full border p-2" value={reason} maxLength={500} onChange={e => setReason(e.target.value)} /></label>
    {error && <p role="alert">{error}</p>}
  </BtModal>;
}
