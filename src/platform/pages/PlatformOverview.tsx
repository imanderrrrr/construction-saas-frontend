import { useEffect, useState } from 'react';
import { AlertTriangle, Building2, UserCheck, Users } from 'lucide-react';

import { PlatformShell } from '../components/PlatformShell';
import { getOverview } from '../services/platformDashboard';
import type { FleetOverview } from '../types';

export function PlatformOverview() {
  const [data, setData] = useState<FleetOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getOverview()
      .then(d => { if (!cancelled) setData(d); })
      .catch(err => { if (!cancelled) setError(err?.message ?? 'Failed to load overview.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <PlatformShell>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Fleet overview</h1>
        <p className="text-sm text-slate-600 mt-1">
          KPIs across every tenant. Refresh the page for live numbers.
        </p>
      </header>

      {error && (
        <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi
          icon={<Building2 size={20} />}
          label="Total tenants"
          value={loading ? '…' : data?.tenants.total ?? '—'}
          sub={
            data
              ? `${data.tenants.active} active · ${data.tenants.suspended} suspended · ${data.tenants.deleted} deleted`
              : null
          }
        />
        <Kpi
          icon={<Users size={20} />}
          label="Tenant users"
          value={loading ? '…' : data?.totalTenantUsers ?? '—'}
          sub="Across every workspace"
        />
        <Kpi
          icon={<UserCheck size={20} />}
          label="Signups (7d)"
          value={loading ? '…' : data?.signupsLast7Days ?? '—'}
          sub="New tenants this week"
        />
        <Kpi
          icon={<AlertTriangle size={20} />}
          label="At-risk tenants"
          value={loading ? '…' : data?.tenantsAtRisk ?? '—'}
          sub="No activity > 14 days"
          tone={data && data.tenantsAtRisk > 0 ? 'warn' : 'default'}
        />
      </section>

      <section className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Kpi
          label="Platform staff"
          value={loading ? '…' : data?.totalPlatformUsers ?? '—'}
          sub="OWNERs / SUPPORT / ENGINEERING / BILLING"
        />
      </section>
    </PlatformShell>
  );
}

function Kpi({
  icon,
  label,
  value,
  sub,
  tone = 'default',
}: {
  icon?: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string | null;
  tone?: 'default' | 'warn';
}) {
  const toneClasses =
    tone === 'warn'
      ? 'border-amber-300 bg-amber-50'
      : 'border-slate-200 bg-white';
  return (
    <div className={`rounded-lg border ${toneClasses} px-5 py-4 shadow-sm`}>
      <div className="flex items-center gap-2 text-sm text-slate-600">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-2 text-3xl font-semibold text-slate-900">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}
