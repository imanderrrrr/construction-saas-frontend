import { useEffect, useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { motion } from 'motion/react';

import { getOverview } from '../services/platformDashboard';
import type { FleetOverview } from '../types';
import {
  cardCx,
  errorBoxCx,
  microLabelCx,
  pageTitleCx,
  riseIn,
  Skeleton,
  staggerParent,
} from '../components/console';

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

  const asOf = new Date()
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    .toUpperCase();

  return (
    <>
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className={pageTitleCx}>Fleet overview</h1>
          <p className="mt-2.5 text-sm leading-relaxed text-bt-muted">Every customer workspace at a glance.</p>
        </div>
        <span className={`${microLabelCx} pb-1`}>AS OF {asOf}</span>
      </header>

      {error && <div className={`${errorBoxCx} mt-6`}>{error}</div>}

      <motion.section
        className="mt-7 grid grid-cols-5 gap-4"
        variants={staggerParent}
        initial="hidden"
        animate="show"
      >
        <Kpi
          label="Total tenants"
          loading={loading}
          value={data?.tenants.total}
          sub={
            data
              ? `${data.tenants.active} active · ${data.tenants.suspended} suspended · ${data.tenants.deleted} deleted`
              : null
          }
        />
        <Kpi label="Tenant users" loading={loading} value={data?.totalTenantUsers} sub="Across every workspace" />
        <Kpi label="Signups (7d)" loading={loading} value={data?.signupsLast7Days} sub="New tenants this week" />
        <Kpi
          label="At-risk tenants"
          loading={loading}
          value={data?.tenantsAtRisk}
          sub="No activity > 14 days"
          tone={data && data.tenantsAtRisk > 0 ? 'warn' : 'default'}
        />
        <Kpi
          label="Platform staff"
          loading={loading}
          value={data?.totalPlatformUsers}
          sub="OWNER / SUPPORT / BILLING / ENGINEERING"
          subMono
        />
      </motion.section>
    </>
  );
}

function Kpi({
  label,
  value,
  sub,
  loading,
  tone = 'default',
  subMono = false,
}: {
  label: string;
  value: number | undefined;
  sub?: string | null;
  loading: boolean;
  tone?: 'default' | 'warn';
  subMono?: boolean;
}) {
  const warn = tone === 'warn';
  return (
    <motion.div
      variants={riseIn}
      className={`flex flex-col gap-2.5 px-5 py-[18px] ${
        warn
          ? 'rounded-xl border border-[#EAD8A6] bg-[#F8EED2] shadow-[0_1px_2px_rgba(23,19,15,0.04)]'
          : cardCx
      }`}
    >
      <span className={`flex items-center gap-1.5 text-[12.5px] font-semibold ${warn ? 'text-[#93640C]' : 'text-bt-muted'}`}>
        {warn && <TriangleAlert size={12} strokeWidth={2.2} />}
        {label}
      </span>
      {loading ? (
        <Skeleton className="h-8 w-14" />
      ) : (
        <span className={`font-bt-mono text-[32px] font-semibold leading-none ${warn ? 'text-[#93640C]' : 'text-bt-ink'}`}>
          {value ?? '—'}
        </span>
      )}
      {sub && (
        <span
          className={`leading-[1.45] ${
            subMono
              ? 'font-bt-mono text-[9.5px] font-semibold tracking-[0.1em]'
              : 'text-[11.5px]'
          } ${warn ? 'text-[#93640C]' : 'text-bt-muted-2'}`}
        >
          {sub}
        </span>
      )}
    </motion.div>
  );
}
