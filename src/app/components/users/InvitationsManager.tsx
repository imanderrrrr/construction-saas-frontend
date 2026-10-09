import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { InvitationsService, type AdminInvitation } from '../../services/invitations';
import { fmtDateTime } from '../../helpers/dateTime';

export function InvitationsManager({ revision }: { revision: number }) {
  const { t, i18n } = useTranslation(['admin', 'common']);
  const [rows, setRows] = useState<AdminInvitation[]>([]);
  const [error, setError] = useState('');
  const [target, setTarget] = useState<AdminInvitation | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const load = () => InvitationsService.list().then(rows => { setRows(rows); setError(''); }).catch(e => setError(e.message));
  useEffect(() => { void load(); }, [revision]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer); }, []);
  async function revoke() {
    if (!target) return;
    setBusy(true); setError('');
    try { await InvitationsService.revoke(target.id); setTarget(null); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : t('common:error.generic')); }
    finally { setBusy(false); }
  }
  return <details className="border p-3 bg-white">
    <summary className="cursor-pointer">{t('admin:usr.invites.title')} ({rows.filter(r => r.status === 'PENDING').length})</summary>
    {error && <p role="alert">{error}</p>}
    {rows.length === 0 && <p>{t('admin:usr.invites.empty')}</p>}
    <ul>{rows.map(row => <li key={row.id} className="flex gap-3 items-center py-2 border-b text-sm">
      <span>{t(`common:roles.${row.role}`)}</span><span>{t('admin:usr.invites.status.' + row.status)}</span>
      <time dateTime={row.expiresAt}>{fmtDateTime(row.expiresAt, i18n.language)}</time>
      {row.status === 'PENDING' && new Date(row.expiresAt).getTime() > now && <button className="border px-2 py-1" onClick={() => setTarget(row)}>{t('admin:usr.invites.revoke')}</button>}
    </li>)}</ul>
    {target && <div role="dialog" aria-modal="true" className="fixed inset-0 z-[90] bg-black/40 grid place-items-center"><div className="bg-white p-5">
      <p>{t('admin:usr.invites.confirm')}</p><button disabled={busy} onClick={() => void revoke()}>{t('admin:usr.invites.revoke')}</button>
      <button disabled={busy} onClick={() => setTarget(null)}>{t('common:buttons.cancel')}</button>
    </div></div>}
  </details>;
}
