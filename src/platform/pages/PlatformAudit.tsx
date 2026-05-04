import { useEffect, useState } from 'react';

import { PlatformShell } from '../components/PlatformShell';
import { searchAudit } from '../services/platformDashboard';
import type { Page, PlatformAuditEntry } from '../types';

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
    <PlatformShell>
      <header className="mb-4">
        <h1 className="text-2xl font-semibold">Platform audit log</h1>
        <p className="text-sm text-slate-600 mt-1">
          Actions performed by platform staff. {data ? `${data.totalElements} total` : ''}
        </p>
      </header>

      <section className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <input
          value={actionFilter}
          onChange={e => { setActionFilter(e.target.value); setPage(0); }}
          placeholder="Action (e.g. SUSPEND_TENANT)"
          className="px-3 py-2 border border-slate-300 rounded text-sm"
        />
        <input
          value={tenantIdFilter}
          onChange={e => { setTenantIdFilter(e.target.value.replace(/\D/g, '')); setPage(0); }}
          placeholder="Target tenant id"
          className="px-3 py-2 border border-slate-300 rounded text-sm font-mono"
        />
        <input
          value={actorIdFilter}
          onChange={e => { setActorIdFilter(e.target.value.replace(/\D/g, '')); setPage(0); }}
          placeholder="Actor platform user id"
          className="px-3 py-2 border border-slate-300 rounded text-sm font-mono"
        />
      </section>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-left text-slate-600">
              <th className="px-4 py-2 font-medium">When</th>
              <th className="px-4 py-2 font-medium">Actor</th>
              <th className="px-4 py-2 font-medium">Action</th>
              <th className="px-4 py-2 font-medium">Target tenant</th>
              <th className="px-4 py-2 font-medium">Outcome</th>
              <th className="px-4 py-2 font-medium">Message</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="px-4 py-6 text-slate-500">Loading…</td></tr>
            )}
            {!loading && (data?.content.length ?? 0) === 0 && !error && (
              <tr><td colSpan={6} className="px-4 py-6 text-slate-500">No audit entries match the filters.</td></tr>
            )}
            {data?.content.map(a => (
              <tr key={a.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2 text-slate-600 whitespace-nowrap">{new Date(a.createdAt).toLocaleString()}</td>
                <td className="px-4 py-2 text-slate-700">
                  {a.actorEmail}
                  <div className="text-xs text-slate-500">{a.actorRole}</div>
                </td>
                <td className="px-4 py-2 font-mono text-xs">{a.action}</td>
                <td className="px-4 py-2 text-slate-700">
                  {a.targetTenantSlug ?? '—'}
                  {a.targetTenantId !== null && (
                    <div className="text-xs text-slate-500 font-mono">id={a.targetTenantId}</div>
                  )}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={
                      a.outcome === 'SUCCESS'
                        ? 'text-emerald-700'
                        : 'text-red-700'
                    }
                  >
                    {a.outcome}
                  </span>
                </td>
                <td className="px-4 py-2 text-slate-600 max-w-md truncate" title={a.message ?? ''}>
                  {a.message ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
          <span>Page {page + 1} of {totalPages}</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0 || loading} className="px-3 py-1.5 border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50">Previous</button>
            <button type="button" onClick={() => setPage(p => p + 1)} disabled={page + 1 >= totalPages || loading} className="px-3 py-1.5 border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50">Next</button>
          </div>
        </div>
      )}
    </PlatformShell>
  );
}
