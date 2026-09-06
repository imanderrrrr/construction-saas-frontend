import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { updateClient, type ClientResponse } from '../../services/clients';
import { listProjects, type ProjectResponse } from '../../services/projects';
import { DestroyButton, PrimaryButton, SecondaryButton } from '../onboarding/chrome';
import { BtModal } from '../bt/windows';
import { PaperNote } from '../projects/bt';
import { StatusBadge } from '../projects/badges';
import { activeCount, closedCount } from './bits';

/**
 * Deactivate / reactivate a client — a 440 px modal, reversible, no name to
 * type (Claude Design "Clientes BuildTrack" 04). Writing the name is reserved
 * for what has no way back; this undoes with two clicks, and the outlined
 * #B3402A button already says it is serious.
 *
 * A client with jobsites in progress is not blocked, only warned: the
 * notice lists them and the button becomes "Desactivar igual".
 */

/** How many in-progress jobsites the warning lists before "y N más". */
const LISTED = 5;

export function ClientStatusModal({ open, onOpenChange, client, onConfirmed }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: ClientResponse | null;
  onConfirmed: (client: ClientResponse) => void;
}) {
  const { t } = useTranslation(['admin', 'common']);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState<ProjectResponse[] | null>(null);

  const deactivating = client?.status === 'ACTIVE';
  const inProgress = client ? activeCount(client) : 0;

  useEffect(() => {
    if (!open) return;
    setFailed(false);
    setSaving(false);
    setActive(null);
    if (!client || !deactivating || inProgress === 0) return;
    let cancelled = false;
    listProjects({ clientId: client.id, status: 'ACTIVE', page: 0, size: LISTED })
      .then(page => { if (!cancelled) setActive(page.content); })
      .catch(() => { /* the count in the title still tells the story */ });
    return () => { cancelled = true; };
  }, [open, client, deactivating, inProgress]);

  if (!client) return null;

  const confirm = async () => {
    setSaving(true);
    setFailed(false);
    try {
      const updated = await updateClient(client.id, { status: deactivating ? 'INACTIVE' : 'ACTIVE' });
      onConfirmed(updated);
      onOpenChange(false);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  const closed = closedCount(client);

  return (
    <BtModal
      open={open}
      onOpenChange={o => { if (!o) onOpenChange(false); }}
      width={440}
      kicker={deactivating ? t('admin:clients.status.kickerOff') : t('admin:clients.status.kickerOn')}
      kickerTone={deactivating ? 'red' : 'orange'}
      title={deactivating ? t('admin:clients.status.titleOff', { name: client.name }) : t('admin:clients.status.titleOn', { name: client.name })}
      description={deactivating
        ? (inProgress > 0 ? t('admin:clients.status.hasActiveBody') : t('admin:clients.status.offLead'))
        : t('admin:clients.status.onLead')}
      closeDisabled={saving}
      bodyClassName={deactivating ? undefined : 'py-2'}
      footer={(
        <>
          <SecondaryButton onClick={() => onOpenChange(false)} disabled={saving} className="px-4 py-[11px]">{t('common:buttons.cancel')}</SecondaryButton>
          {deactivating ? (
            <DestroyButton onClick={confirm} disabled={saving} className="px-[18px] py-[11px]" data-testid="client-status-confirm">
              {saving
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />{t('admin:clients.status.saving')}</>
                : inProgress > 0 ? t('admin:clients.status.confirmOffAnyway') : t('admin:clients.status.confirmOff')}
            </DestroyButton>
          ) : (
            <PrimaryButton onClick={confirm} disabled={saving} className="px-[18px] py-[11px]" data-testid="client-status-confirm">
              {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />{t('admin:clients.status.saving')}</> : t('admin:clients.status.confirmOn')}
            </PrimaryButton>
          )}
        </>
      )}
    >
      {failed && <div role="alert" className="mb-3"><PaperNote tone="red">{t('admin:clients.status.error')}</PaperNote></div>}

      {deactivating && inProgress > 0 && (
        <div data-testid="client-status-active">
          <PaperNote>
            <span className="block font-semibold text-[#0A0A0A]">{t('admin:clients.status.hasActive', { count: inProgress })}</span>
          </PaperNote>
          <ul className="mt-3 border-t border-[#EDE7DB]">
            {(active ?? []).map(p => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2 border-b border-[#F0EBE1] text-[13px] text-[#0A0A0A]">
                <span className="truncate">{p.name}</span>
                <StatusBadge status={p.status} className="flex-shrink-0" />
              </li>
            ))}
            {active && inProgress > active.length && (
              <li className="py-2 font-bt-mono text-[10px] uppercase tracking-[0.1em] text-[#8A8175]">
                {t('admin:clients.status.moreActive', { count: inProgress - active.length })}
              </li>
            )}
          </ul>
        </div>
      )}

      {deactivating && inProgress === 0 && (
        <ul className="border-t border-[#EDE7DB]" data-testid="client-status-consequences">
          {[
            closed > 0 ? t('admin:clients.status.offClosed', { count: closed }) : t('admin:clients.status.offClosedNone'),
            t('admin:clients.status.offInvoices'),
            t('admin:clients.status.offUndo'),
          ].map(line => (
            <li key={line} className="flex gap-2.5 py-2 border-b border-[#F0EBE1] text-[13px] leading-[1.5] text-[#0A0A0A]">
              <span className="text-[#F97316] font-bold flex-shrink-0" aria-hidden="true">·</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      )}
    </BtModal>
  );
}
