import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, Pause, Play, Trash2 } from 'lucide-react';

import { PlatformShell } from '../components/PlatformShell';
import { TenantStatusPill } from '../components/TenantStatusPill';
import { usePlatformAuth } from '../context/PlatformAuthContext';
import {
  deleteTenant,
  getTenant,
  getTenantAudit,
  listTenantUsers,
  reactivateTenant,
  suspendTenant,
} from '../services/platformDashboard';
import type {
  Page,
  PlatformAuditEntry,
  TenantDetail,
  TenantUserSummary,
} from '../types';

type Tab = 'summary' | 'users' | 'audit';

export function PlatformTenantDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const navigate = useNavigate();
  const { role } = usePlatformAuth();

  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [users, setUsers] = useState<Page<TenantUserSummary> | null>(null);
  const [audit, setAudit] = useState<Page<PlatformAuditEntry> | null>(null);
  const [tab, setTab] = useState<Tab>('summary');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog state — held in the parent so dialogs can refresh `tenant` after success.
  const [showSuspend, setShowSuspend] = useState(false);
  const [showReactivate, setShowReactivate] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const loadTenant = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    getTenant(id)
      .then(setTenant)
      .catch(err => setError(err?.message ?? 'Failed to load tenant.'))
      .finally(() => setLoading(false));
  }, [id]);

  const loadUsers = useCallback(() => {
    if (!id) return;
    listTenantUsers(id, 0, 50)
      .then(setUsers)
      .catch(() => setUsers(null));
  }, [id]);

  const loadAudit = useCallback(() => {
    if (!id) return;
    getTenantAudit(id, 0, 100)
      .then(setAudit)
      .catch(() => setAudit(null));
  }, [id]);

  useEffect(() => { loadTenant(); }, [loadTenant]);
  useEffect(() => { if (tab === 'users') loadUsers(); }, [tab, loadUsers]);
  useEffect(() => { if (tab === 'audit') loadAudit(); }, [tab, loadAudit]);

  if (!id) {
    return <PlatformShell><p>Invalid tenant id.</p></PlatformShell>;
  }

  const canSuspend = role === 'OWNER' || role === 'SUPPORT';
  const canDelete = role === 'OWNER';

  return (
    <PlatformShell>
      <button
        type="button"
        onClick={() => navigate('/platform/tenants')}
        className="mb-4 flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft size={16} />
        <span>All tenants</span>
      </button>

      {loading && <p className="text-slate-500">Loading…</p>}
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      {tenant && (
        <>
          <header className="mb-6 flex items-start justify-between gap-6">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold">{tenant.name}</h1>
                <TenantStatusPill status={tenant.status} />
              </div>
              <p className="text-sm text-slate-600 mt-1 font-mono">{tenant.slug}</p>
            </div>

            <div className="flex gap-2">
              {tenant.status === 'ACTIVE' && canSuspend && (
                <button
                  type="button"
                  onClick={() => setShowSuspend(true)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-sm"
                >
                  <Pause size={14} /> Suspend
                </button>
              )}
              {tenant.status === 'SUSPENDED' && canSuspend && (
                <button
                  type="button"
                  onClick={() => setShowReactivate(true)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-sm"
                >
                  <Play size={14} /> Reactivate
                </button>
              )}
              {tenant.status !== 'DELETED' && canDelete && (
                <button
                  type="button"
                  onClick={() => setShowDelete(true)}
                  className="flex items-center gap-1 px-3 py-1.5 border border-red-300 text-red-700 hover:bg-red-50 rounded text-sm"
                >
                  <Trash2 size={14} /> Delete
                </button>
              )}
            </div>
          </header>

          <nav className="flex gap-1 border-b border-slate-200 mb-6">
            {(['summary', 'users', 'audit'] as const).map(key => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-[1px] ${
                  tab === key
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                {key}
              </button>
            ))}
          </nav>

          {tab === 'summary' && <SummaryTab tenant={tenant} />}
          {tab === 'users' && <UsersTab data={users} />}
          {tab === 'audit' && <AuditTab data={audit} />}

          {showSuspend && (
            <SuspendDialog
              tenantSlug={tenant.slug}
              onClose={() => setShowSuspend(false)}
              onSuccess={() => {
                setShowSuspend(false);
                loadTenant();
              }}
              tenantId={tenant.id}
            />
          )}
          {showReactivate && (
            <ReactivateDialog
              onClose={() => setShowReactivate(false)}
              onSuccess={() => {
                setShowReactivate(false);
                loadTenant();
              }}
              tenantId={tenant.id}
            />
          )}
          {showDelete && (
            <DeleteDialog
              tenantSlug={tenant.slug}
              tenantId={tenant.id}
              onClose={() => setShowDelete(false)}
              onSuccess={() => {
                setShowDelete(false);
                loadTenant();
              }}
            />
          )}
        </>
      )}
    </PlatformShell>
  );
}

function SummaryTab({ tenant }: { tenant: TenantDetail }) {
  const items = [
    { label: 'Users (total / active)', value: `${tenant.userCount} / ${tenant.activeUserCount}` },
    { label: 'Projects', value: tenant.projectCount },
    { label: 'Clients', value: tenant.clientCount },
    { label: 'Created', value: new Date(tenant.createdAt).toLocaleString() },
    { label: 'Updated', value: new Date(tenant.updatedAt).toLocaleString() },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {items.map(it => (
        <div key={it.label} className="rounded-lg border border-slate-200 bg-white px-5 py-4">
          <div className="text-sm text-slate-600">{it.label}</div>
          <div className="mt-1 text-xl font-semibold text-slate-900">{it.value}</div>
        </div>
      ))}
    </div>
  );
}

function UsersTab({ data }: { data: Page<TenantUserSummary> | null }) {
  if (!data) return <p className="text-slate-500">Loading users…</p>;
  if (data.content.length === 0) return <p className="text-slate-500">No users.</p>;
  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr className="text-left text-slate-600">
            <th className="px-4 py-2 font-medium">Username</th>
            <th className="px-4 py-2 font-medium">Full name</th>
            <th className="px-4 py-2 font-medium">Role</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 font-medium">Email</th>
          </tr>
        </thead>
        <tbody>
          {data.content.map(u => (
            <tr key={u.id} className="border-b border-slate-100 last:border-0">
              <td className="px-4 py-2 font-mono text-slate-900">{u.username}</td>
              <td className="px-4 py-2 text-slate-700">{u.fullName ?? '—'}</td>
              <td className="px-4 py-2">{u.role}</td>
              <td className="px-4 py-2">{u.status}</td>
              <td className="px-4 py-2 text-slate-600">{u.email ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AuditTab({ data }: { data: Page<PlatformAuditEntry> | null }) {
  if (!data) return <p className="text-slate-500">Loading audit…</p>;
  if (data.content.length === 0) return <p className="text-slate-500">No audit entries.</p>;
  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr className="text-left text-slate-600">
            <th className="px-4 py-2 font-medium">When</th>
            <th className="px-4 py-2 font-medium">Actor</th>
            <th className="px-4 py-2 font-medium">Action</th>
            <th className="px-4 py-2 font-medium">Outcome</th>
            <th className="px-4 py-2 font-medium">Message</th>
          </tr>
        </thead>
        <tbody>
          {data.content.map(a => (
            <tr key={a.id} className="border-b border-slate-100 last:border-0">
              <td className="px-4 py-2 text-slate-600 whitespace-nowrap">{new Date(a.createdAt).toLocaleString()}</td>
              <td className="px-4 py-2 text-slate-700">{a.actorEmail} <span className="text-xs text-slate-500">({a.actorRole})</span></td>
              <td className="px-4 py-2 font-mono text-xs">{a.action}</td>
              <td className="px-4 py-2">{a.outcome}</td>
              <td className="px-4 py-2 text-slate-600">{a.message ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Dialogs ─────────────────────────────────────────────────────

function SuspendDialog({
  tenantId,
  tenantSlug,
  onClose,
  onSuccess,
}: {
  tenantId: number;
  tenantSlug: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (reason.trim().length < 5) {
      setError('Reason must be at least 5 characters.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await suspendTenant(tenantId, reason.trim());
      onSuccess();
    } catch (err) {
      setError(extractMessage(err) ?? 'Suspend failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={`Suspend ${tenantSlug}`} onClose={onClose}>
      <p className="text-sm text-slate-600 mb-4">
        Users of this workspace will be blocked from API access until you reactivate.
        The reason is recorded in the audit log.
      </p>
      {error && <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>}
      <textarea
        value={reason}
        onChange={e => setReason(e.target.value)}
        placeholder="Reason (required, min 5 chars)…"
        rows={4}
        className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
        disabled={submitting}
      />
      <div className="mt-4 flex gap-2 justify-end">
        <button type="button" onClick={onClose} disabled={submitting} className="px-3 py-1.5 border border-slate-300 rounded text-sm">Cancel</button>
        <button type="button" onClick={submit} disabled={submitting} className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white rounded text-sm">{submitting ? 'Suspending…' : 'Suspend'}</button>
      </div>
    </Modal>
  );
}

function ReactivateDialog({
  tenantId,
  onClose,
  onSuccess,
}: {
  tenantId: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await reactivateTenant(tenantId, note.trim() || undefined);
      onSuccess();
    } catch (err) {
      setError(extractMessage(err) ?? 'Reactivate failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Reactivate workspace" onClose={onClose}>
      <p className="text-sm text-slate-600 mb-4">
        Users will regain access immediately. An optional note will appear in the audit log.
      </p>
      {error && <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>}
      <textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="Note (optional)…"
        rows={3}
        className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
        disabled={submitting}
      />
      <div className="mt-4 flex gap-2 justify-end">
        <button type="button" onClick={onClose} disabled={submitting} className="px-3 py-1.5 border border-slate-300 rounded text-sm">Cancel</button>
        <button type="button" onClick={submit} disabled={submitting} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded text-sm">{submitting ? 'Reactivating…' : 'Reactivate'}</button>
      </div>
    </Modal>
  );
}

function DeleteDialog({
  tenantId,
  tenantSlug,
  onClose,
  onSuccess,
}: {
  tenantId: number;
  tenantSlug: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [reason, setReason] = useState('');
  const [confirmSlug, setConfirmSlug] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (reason.trim().length < 5) {
      setError('Reason must be at least 5 characters.');
      return;
    }
    if (confirmSlug.trim() !== tenantSlug) {
      setError('Confirmation slug does not match.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await deleteTenant(tenantId, reason.trim(), confirmSlug.trim());
      onSuccess();
    } catch (err) {
      setError(extractMessage(err) ?? 'Delete failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Delete workspace (soft)" onClose={onClose}>
      <p className="text-sm text-slate-600 mb-4">
        Marks the workspace DELETED. Data rows remain in tables for audit lineage; the
        workspace becomes unreachable. This is irreversible from the dashboard — only
        OWNER can perform it.
      </p>
      <p className="text-sm font-medium mb-2">
        Type <code className="px-1.5 py-0.5 bg-slate-100 rounded font-mono">{tenantSlug}</code> to confirm:
      </p>
      <input
        value={confirmSlug}
        onChange={e => setConfirmSlug(e.target.value)}
        placeholder={tenantSlug}
        className="w-full mb-3 px-3 py-2 border border-slate-300 rounded font-mono text-sm"
        disabled={submitting}
      />
      {error && <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>}
      <textarea
        value={reason}
        onChange={e => setReason(e.target.value)}
        placeholder="Reason (required, min 5 chars)…"
        rows={3}
        className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
        disabled={submitting}
      />
      <div className="mt-4 flex gap-2 justify-end">
        <button type="button" onClick={onClose} disabled={submitting} className="px-3 py-1.5 border border-slate-300 rounded text-sm">Cancel</button>
        <button type="button" onClick={submit} disabled={submitting} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded text-sm">{submitting ? 'Deleting…' : 'Delete'}</button>
      </div>
    </Modal>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-3">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function extractMessage(err: unknown): string | null {
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === 'string') return m;
  }
  return null;
}
