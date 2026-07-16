import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Plus } from 'lucide-react';

import { PlatformShell } from '../components/PlatformShell';
import { CreateTenantDialog } from '../components/CreateTenantDialog';
import { usePlatformAuth } from '../context/PlatformAuthContext';
import { listTenants } from '../services/platformDashboard';
import type { CreateTenantResponse, Page, TenantSummary } from '../types';
import { TenantStatusPill } from '../components/TenantStatusPill';

const PAGE_SIZE = 50;

export function PlatformTenants() {
  const [page, setPage] = useState(0);
  const [data, setData] = useState<Page<TenantSummary> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [created, setCreated] = useState<CreateTenantResponse | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const navigate = useNavigate();
  const { role } = usePlatformAuth();

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
  }, [page, reloadKey]);

  const totalPages = data?.totalPages ?? 0;
  const rows = data?.content ?? [];

  return (
    <PlatformShell>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Tenants</h1>
          <p className="text-sm text-slate-600 mt-1">
            {data ? `${data.totalElements} total` : 'Loading…'}
          </p>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={() => { setCreated(null); setShowCreate(true); }}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            New tenant
          </button>
        )}
      </header>

      {created && (
        <div
          role="status"
          className="mb-6 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded text-sm text-emerald-900"
        >
          <p className="font-medium">
            Created {created.companyName} ({created.tenantSlug}) on a manual {created.planCode} plan.
          </p>
          <p className="mt-1">
            {created.setupLinkSent
              ? `${created.adminUsername} was emailed a link at ${created.adminEmail} to set their password.`
              : `Heads up: the set-up email to ${created.adminEmail} could not be sent. Ask ${created.adminUsername} to use “Forgot password” on the login screen with the identifier ${created.tenantSlug}.`}
          </p>
        </div>
      )}

      {error && (
        <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-left text-slate-600">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Slug</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Users</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={6}>Loading…</td>
              </tr>
            )}
            {!loading && rows.length === 0 && !error && (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={6}>No tenants yet.</td>
              </tr>
            )}
            {rows.map(t => (
              <tr
                key={t.id}
                className="border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer"
                onClick={() => navigate(`/platform/tenants/${t.id}`)}
              >
                <td className="px-4 py-3 font-medium text-slate-900">{t.name}</td>
                <td className="px-4 py-3 font-mono text-slate-600">{t.slug}</td>
                <td className="px-4 py-3"><TenantStatusPill status={t.status} /></td>
                <td className="px-4 py-3 text-slate-700">{t.userCount}</td>
                <td className="px-4 py-3 text-slate-500">{formatDate(t.createdAt)}</td>
                <td className="px-4 py-3 text-slate-500">{formatDate(t.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
          <span>Page {page + 1} of {totalPages}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0 || loading}
              className="px-3 py-1.5 border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage(p => p + 1)}
              disabled={page + 1 >= totalPages || loading}
              className="px-3 py-1.5 border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {showCreate && (
        <CreateTenantDialog
          onClose={() => setShowCreate(false)}
          onCreated={result => {
            setShowCreate(false);
            setCreated(result);
            // Jump back to the first page: the new tenant is the freshest row
            // and staff expect to see what they just made.
            setPage(0);
            setReloadKey(k => k + 1);
          }}
        />
      )}
    </PlatformShell>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}
