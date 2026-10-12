import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { AuthService } from '../services/auth';
import { BillingService, type BillingAccess } from '../services/billing';

/** Refresh in the background: navigation never destroys a form or panel. */
export function BillingGuard({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation('common');
  const [access, setAccess] = useState<BillingAccess | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const refresh = () => BillingService.getAccess().then(value => {
      if (!cancelled) { setAccess(value); setError(false); }
    }).catch(() => { if (!cancelled) setError(true); });
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60000);
    window.addEventListener('focus', refresh);
    return () => { cancelled = true; clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, []);
  const blocked = access?.tier === 'BLOCKED';
  const checking = access === null && !error;
  return <>
    {checking && <p role="status" className="p-3">{t('labels.loading')}</p>}
    {blocked && <div role="alert" className="p-6">
      <p>{t('billing.blocked')}</p>
      {AuthService.getRole() === 'ADMIN' && <Link to="/admin/billing">{t('billing.recover')}</Link>}
    </div>}
    <div hidden={blocked || checking}>
      {(error || access?.tier === 'READ_ONLY') && <p role="status" className="bg-amber-50 p-3">
        {t(error ? 'billing.unavailable' : 'billing.readOnly')}
        {AuthService.getRole() === 'ADMIN' && <Link className="ml-2 underline" to="/admin/billing">{t('billing.recover')}</Link>}
      </p>}
      {children}
    </div>
  </>;
}
