import { useEffect, useState } from 'react';
import { motion } from 'motion/react';

import { searchAudit } from '../services/platformDashboard';
import type { Page, PlatformAuditEntry } from '../types';
import { fmtDateTime } from '../../app/helpers/dateTime';
import {
  cardCx,
  colHeadCx,
  errorBoxCx,
  inputCx,
  monoInputCx,
  pageTitleCx,
  rowDelay,
  secondaryBtnCx,
  Skeleton,
} from '../components/console';
import { FIELD_LIMITS } from '../../shared/fieldLimits';

const PAGE_SIZE = 100;

export function PlatformAudit() {
  const [actionFilter, setActionFilter] = useState('');
  const [tenantIdFilter, setTenantIdFilter] = useState('');
  const [actorIdFilter, setActorIdFilter] = useState('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState<Page<PlatformAuditEntry> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Refetch whenever filters or page change.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    searchAudit({
      action: actionFilter.trim() || undefined,
      targetTenantId: tenantIdFilter ? Number(tenantIdFilter) : undefined,
      actorId: actorIdFilter ? Number(actorIdFilter) : undefined,
      page,
      size: PAGE_SIZE,
    })
      .then(d => { if (!cancelled) setData(d); })
      .catch(err => { if (!cancelled) setError(err?.message ?? 'Failed to load audit log.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [actionFilter, tenantIdFilter, actorIdFilter, page]);

  const totalPages = data?.totalPages ?? 0;

  return (
    <>
      <header>
        <h1 className={pageTitleCx}>Platform audit log</h1>
        <p className="mt-2.5 text-sm text-bt-muted">
          Actions performed by platform staff. {data ? `${data.totalElements} total` : ''}
        </p>
      </header>

      <section className="mt-6 grid grid-cols-3 gap-3">
        <input
          value={actionFilter}
          onChange={e => { setActionFilter(e.target.value); setPage(0); }}
          placeholder="Action (e.g. SUSPEND_TENANT)"
          maxLength={FIELD_LIMITS.SEARCH}
          className={inputCx}
        />
        <input
          value={tenantIdFilter}
          onChange={e => { setTenantIdFilter(e.target.value.replace(/\D/g, '')); setPage(0); }}
          placeholder="Target tenant id"
          maxLength={FIELD_LIMITS.CODE}
          className={monoInputCx}
        />
        <input
          value={actorIdFilter}
          onChange={e => { setActorIdFilter(e.target.value.replace(/\D/g, '')); setPage(0); }}
          placeholder="Actor platform user id"
          maxLength={FIELD_LIMITS.CODE}
          className={monoInputCx}
        />
      </section>

      {error && <div className={`${errorBoxCx} mt-4`}>{error}</div>}

      <div className={`${cardCx} mt-4 overflow-hidden`}>
        <table className="w-full text-sm">
          <thead>
            <tr className={`text-left ${colHeadCx}`}>
              <th className="px-6 pb-2.5 pt-4 font-semibold">When</th>
              <th className="px-4 pb-2.5 pt-4 font-semibold">Actor</th>
              <th className="px-4 pb-2.5 pt-4 font-semibold">Action</th>
              <th className="px-4 pb-2.5 pt-4 font-semibold">Target tenant</th>
              <th className="px-4 pb-2.5 pt-4 font-semibold">Outcome</th>
              <th className="px-6 pb-2.5 pt-4 font-semibold">Message</th>
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: 5 }, (_, i) => (
                <tr key={`s${i}`} className="border-t border-bt-rule-3">
                  {Array.from({ length: 6 }, (_, j) => (
                    <td key={j} className="px-4 py-3.5 first:pl-6 last:pr-6">
                      <Skeleton className="h-3.5 w-24" />
                    </td>
                  ))}
                </tr>
              ))}
            {!loading && (data?.content.length ?? 0) === 0 && !error && (
              <tr className="border-t border-bt-rule-3">
                <td colSpan={6} className="px-6 py-8 text-bt-muted">No audit entries match the filters.</td>
              </tr>
            )}
            {!loading &&
              data?.content.map((a, i) => (
                <motion.tr
                  key={a.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, delay: rowDelay(i) }}
                  className="border-t border-bt-rule-3 transition-colors hover:bg-[#F9F5EC]"
                >
                  <td className="whitespace-nowrap px-6 py-3 font-bt-mono text-xs text-bt-muted">{fmtDateTime(a.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="font-bt-mono text-xs text-bt-muted">{a.actorEmail}</div>
                    <div className="text-[11px] text-bt-muted-2">{a.actorRole}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-block rounded-[5px] border border-bt-rule-2 bg-bt-paper px-1.5 py-0.5 font-bt-mono text-[11px] font-semibold text-bt-ink">
                      {a.action}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[13px] text-bt-ink">{a.targetTenantSlug ?? '—'}</span>
                    {a.targetTenantId !== null && (
                      <div className="font-bt-mono text-[11px] text-bt-muted-2">id={a.targetTenantId}</div>
                    )}
                  </td>
                  <td className={`px-4 py-3 text-[12.5px] font-semibold ${
                    a.outcome === 'SUCCESS' ? 'text-[#3D6112]' : 'text-[#B42318]'
                  }`}>
                    {a.outcome}
                  </td>
                  <td className="max-w-md truncate px-6 py-3 text-[12.5px] text-bt-muted" title={a.message ?? ''}>
                    {a.message ?? '—'}
                  </td>
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
            <button type="button" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0 || loading} className={secondaryBtnCx}>Previous</button>
            <button type="button" onClick={() => setPage(p => p + 1)} disabled={page + 1 >= totalPages || loading} className={secondaryBtnCx}>Next</button>
          </div>
        </div>
      )}
    </>
  );
}
