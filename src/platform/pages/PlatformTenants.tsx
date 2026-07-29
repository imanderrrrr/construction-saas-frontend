import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { CircleCheck, Plus } from 'lucide-react';
import { motion } from 'motion/react';

import { usePlatformAuth } from '../context/PlatformAuthContext';
import { listTenants } from '../services/platformDashboard';
import type { CreateTenantResponse, Page, TenantSummary } from '../types';
import { TenantStatusPill } from '../components/TenantStatusPill';
import { fmtDate } from '../../app/helpers/dateTime';
import {
  cardCx,
  colHeadCx,
  errorBoxCx,
  pageTitleCx,
  primaryBtnCx,
  rowDelay,
  secondaryBtnCx,
  Skeleton,
} from '../components/console';

const PAGE_SIZE = 50;

export function PlatformTenants() {
  const [page, setPage] = useState(0);
  const [data, setData] = useState<Page<TenantSummary> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { role } = usePlatformAuth();

  // Set by PlatformTenantCreate's "Back to tenants" button so the list can
  // confirm what was just created (the old in-page dialog's success banner).
  const created = (location.state as { created?: CreateTenantResponse } | null)?.created ?? null;

  // Mirrors the backend's @PreAuthorize on POST /platform/tenants. The server
  // is the authority; this only avoids showing ENGINEERING/BILLING a button
  // that would 403.
  const canCreate = role === 'OWNER' || role === 'SUPPORT';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listTenants(page, PAGE_SIZE)
      .then(d => { if (!cancelled) setData(d); })
      .catch(err => { if (!cancelled) setError(err?.message ?? 'Failed to load tenants.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page]);

  const totalPages = data?.totalPages ?? 0;
  const rows = data?.content ?? [];

  return (
    <>
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className={pageTitleCx}>Tenants</h1>
          <p className="mt-2.5 text-sm text-bt-muted">
            {data ? `${data.totalElements} total` : 'Loading…'}
          </p>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={() => navigate('/platform/tenants/new')}
            className={primaryBtnCx}
          >
            <Plus size={14} strokeWidth={2.2} />
            New tenant
          </button>
        )}
      </header>

      {created && (
        <div
          role="status"
          className={`${cardCx} mt-6 flex items-start gap-3 px-5 py-4`}
        >
          <span className="mt-0.5 flex size-6 flex-none items-center justify-center rounded-full bg-bt-orange shadow-[0_0_0_4px_rgba(249,115,22,0.14)]">
            <CircleCheck size={14} strokeWidth={2.5} className="text-white" />
          </span>
          <div className="text-sm leading-relaxed text-bt-muted">
            <p className="font-semibold text-bt-ink">
              {created.billingProvider === 'PADDLE'
                ? `Created ${created.companyName} (${created.tenantSlug}) on a Paddle-billed ${created.planCode} plan — pending its first payment.`
                : `Created ${created.companyName} (${created.tenantSlug}) on a manual ${created.planCode} plan.`}
            </p>
            <p className="mt-0.5">
              {created.setupLinkSent
                ? `${created.adminUsername} was emailed a link at ${created.adminEmail} to set their password.`
                : `Heads up: the set-up email to ${created.adminEmail} could not be sent. Ask ${created.adminUsername} to use “Forgot password” on the login screen with the identifier ${created.tenantSlug}.`}
              {created.billingProvider === 'PADDLE' &&
                (created.checkoutUrl
                  ? ' The payment link is on the tenant page if you need to re-copy it.'
                  : ' No payment link could be issued — open the tenant page to issue one.')}
            </p>
          </div>
        </div>
      )}

      {error && <div className={`${errorBoxCx} mt-6`}>{error}</div>}

      <div className={`${cardCx} mt-6 overflow-hidden`}>
        <table className="w-full text-sm">
          <thead>
            <tr className={`text-left ${colHeadCx}`}>
              <th className="px-6 pb-2.5 pt-4 font-semibold">Company</th>
              <th className="px-4 pb-2.5 pt-4 font-semibold">Identifier</th>
              <th className="px-4 pb-2.5 pt-4 font-semibold">Status</th>
              <th className="px-4 pb-2.5 pt-4 font-semibold">Users</th>
              <th className="px-4 pb-2.5 pt-4 font-semibold">Created</th>
              <th className="px-6 pb-2.5 pt-4 font-semibold">Updated</th>
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: 5 }, (_, i) => (
                <tr key={`s${i}`} className="border-t border-bt-rule-3">
                  <td className="px-6 py-3.5"><Skeleton className="h-3.5 w-40" /></td>
                  <td className="px-4 py-3.5"><Skeleton className="h-3.5 w-32" /></td>
                  <td className="px-4 py-3.5"><Skeleton className="h-5 w-20 rounded-full" /></td>
                  <td className="px-4 py-3.5"><Skeleton className="h-3.5 w-8" /></td>
                  <td className="px-4 py-3.5"><Skeleton className="h-3.5 w-24" /></td>
                  <td className="px-6 py-3.5"><Skeleton className="h-3.5 w-24" /></td>
                </tr>
              ))}
            {!loading && rows.length === 0 && !error && (
              <tr className="border-t border-bt-rule-3">
                <td className="px-6 py-8 text-bt-muted" colSpan={6}>No tenants yet.</td>
              </tr>
            )}
            {!loading &&
              rows.map((t, i) => (
                <motion.tr
                  key={t.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: rowDelay(i) }}
                  className="cursor-pointer border-t border-bt-rule-3 transition-colors hover:bg-[#F9F5EC]"
                  onClick={() => navigate(`/platform/tenants/${t.id}`)}
                >
                  <td className="px-6 py-3 text-[13px] font-semibold text-bt-ink">{t.name}</td>
                  <td className="px-4 py-3 font-bt-mono text-xs text-bt-muted">{t.slug}</td>
                  <td className="px-4 py-3"><TenantStatusPill status={t.status} /></td>
                  <td className="px-4 py-3 font-bt-mono text-xs text-bt-ink">{t.userCount}</td>
                  <td className="px-4 py-3 font-bt-mono text-xs text-bt-muted">{fmtDate(t.createdAt)}</td>
                  <td className="px-6 py-3 font-bt-mono text-xs text-bt-muted">{fmtDate(t.updatedAt)}</td>
                </motion.tr>
              ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <span className="font-bt-mono text-[11px] font-semibold tracking-[0.1em] text-bt-muted-2">
            PAGE {page + 1} OF {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0 || loading}
              className={secondaryBtnCx}
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage(p => p + 1)}
              disabled={page + 1 >= totalPages || loading}
              className={secondaryBtnCx}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </>
  );
}
