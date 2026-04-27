import React, { useState } from 'react';
import {
  FolderOpen, DollarSign, TrendingDown,
  AlertTriangle, AlertCircle, XCircle, CheckCircle,
  ChevronDown, ChevronRight, Info,
} from 'lucide-react';
import { StatCard } from './StatCard';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from './ui/table';

// Types

interface TypeBreakdown {
  label: string;
  amount: number;
  pct: number;
}

interface SupervisorBudget {
  id: string;
  project: string;
  totalBudget: number;
  consumed: number;
  breakdown: TypeBreakdown[];
}

// Mock data
// TODO: GET /api/v1/supervisor/budgets
// Supervisor sees only the 3 projects they are assigned to

const SUPERVISOR_BUDGETS: SupervisorBudget[] = [
  {
    id: '1',
    project: 'Downtown Plaza',
    totalBudget: 150000,
    consumed: 98500,
    breakdown: [
      { label: 'Materials',     amount: 52000, pct: 52.8 },
      { label: 'Transportation',amount: 15000, pct: 15.2 },
      { label: 'Tools',         amount: 12300, pct: 12.5 },
      { label: 'Fuel',          amount:  8500, pct:  8.6 },
      { label: 'Per diem',      amount:  6200, pct:  6.3 },
      { label: 'Minor purch.',  amount:  4500, pct:  4.6 },
    ],
  },
  {
    id: '2',
    project: 'Highway Bridge',
    totalBudget: 120000,
    consumed: 108000,
    breakdown: [
      { label: 'Materials',     amount: 65000, pct: 60.2 },
      { label: 'Fuel',          amount: 28000, pct: 25.9 },
      { label: 'Tools',         amount: 10000, pct:  9.3 },
      { label: 'Transportation',amount:  5000, pct:  4.6 },
    ],
  },
  {
    id: '3',
    project: 'Office Renovation',
    totalBudget: 45000,
    consumed: 38200,
    breakdown: [
      { label: 'Tools',        amount: 22000, pct: 57.6 },
      { label: 'Materials',    amount: 12000, pct: 31.4 },
      { label: 'Minor purch.', amount:  4200, pct: 11.0 },
    ],
  },
];

// Helpers

function fmtAmount(n: number): string {
  return `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

function getPct(consumed: number, total: number): number {
  if (total === 0) return 0;
  return (consumed / total) * 100;
}

function getProgressColor(pct: number): string {
  if (pct > 100) return 'bg-red-600';
  if (pct >= 90)  return 'bg-red-500';
  if (pct >= 70)  return 'bg-amber-500';
  return 'bg-emerald-500';
}

function getPctColor(pct: number): string {
  if (pct > 100) return 'text-red-700 font-bold';
  if (pct >= 90)  return 'text-red-600 font-semibold';
  if (pct >= 70)  return 'text-amber-600 font-semibold';
  return 'text-emerald-600 font-semibold';
}

// Sub-components

function ProgressCell({ consumed, total }: { consumed: number; total: number }) {
  const pct    = getPct(consumed, total);
  const capped = Math.min(pct, 100);
  return (
    <div className="flex items-center gap-2 min-w-[110px]">
      <div className="flex-1 h-1.5 bg-[#FAFAFA] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${getProgressColor(pct)} ${pct > 100 ? 'animate-pulse' : ''}`}
          style={{ width: `${capped}%` }}
        />
      </div>
      <span className={`text-xs tabular-nums flex-shrink-0 ${getPctColor(pct)}`}>
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}

function AlertCell({ pct }: { pct: number }) {
  if (pct > 100) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 animate-pulse whitespace-nowrap">
        <XCircle className="w-3 h-3" />EXCEEDED
      </span>
    );
  }
  if (pct >= 90) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200 whitespace-nowrap">
        <AlertCircle className="w-3 h-3" />Critical
      </span>
    );
  }
  if (pct >= 70) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
        <AlertTriangle className="w-3 h-3" />Warning
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 whitespace-nowrap">
      <CheckCircle className="w-3 h-3" />On track
    </span>
  );
}

// Main component

export function BudgetOverview() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // KPI totals (static — supervisor's assigned projects)
  // TODO: GET /api/v1/supervisor/budgets/summary
  const totalAssigned = SUPERVISOR_BUDGETS.reduce((s, b) => s + b.totalBudget, 0);
  const totalConsumed = SUPERVISOR_BUDGETS.reduce((s, b) => s + b.consumed,    0);

  return (
    <div className="space-y-6 max-w-5xl">

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-sm font-semibold text-[#0A0A0A]">Budget Overview</h2>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#F97316]/10 text-[#F97316] border border-[#F97316]/20">
            Read only
          </span>
        </div>
        <p className="text-[11px] text-[#71717A] mt-0.5">Budget status for your assigned projects</p>
      </div>

      {/* KPI cards (3 — supervisor sees fewer KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={FolderOpen}   title="My projects"     value={SUPERVISOR_BUDGETS.length.toString()} subtitle="Assigned to me"    iconBgColor="bg-[#F97316]/10" iconColor="text-[#F97316]"   />
        <StatCard icon={DollarSign}   title="Total assigned"  value={fmtAmount(totalAssigned)}              subtitle="Budget allocated"  iconBgColor="bg-emerald-50"   iconColor="text-emerald-600" />
        <StatCard icon={TrendingDown} title="Total consumed"  value={fmtAmount(totalConsumed)}              subtitle="Approved expenses" iconBgColor="bg-amber-50"     iconColor="text-amber-600"   />
      </div>

      {/* Table card */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-[#D4D4D8]">
          <FolderOpen className="w-4 h-4 text-[#71717A]" />
          <span className="text-sm font-semibold text-[#0A0A0A]">Assigned Project Budgets</span>
          <span className="ml-1 text-xs text-[#71717A]">· {SUPERVISOR_BUDGETS.length} project{SUPERVISOR_BUDGETS.length !== 1 ? 's' : ''}</span>
          <span className="hidden sm:inline text-[11px] text-[#71717A] ml-1">— click a row for expense breakdown</span>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#FAFAFA] hover:bg-[#FAFAFA]">
                <TableHead className="w-8" />
                {['Project','Total Budget','Consumed','Available','Execution','Alert'].map(h => (
                  <TableHead key={h} className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider whitespace-nowrap">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {SUPERVISOR_BUDGETS.flatMap(budget => {
                const pct        = getPct(budget.consumed, budget.totalBudget);
                const available  = budget.totalBudget - budget.consumed;
                const isExpanded = expandedId === budget.id;

                const mainRow = (
                  <TableRow key={`${budget.id}-main`}
                    onClick={() => setExpandedId(isExpanded ? null : budget.id)}
                    className={`cursor-pointer border-b border-[#D4D4D8]/50 transition-colors ${isExpanded ? 'bg-[#F97316]/5' : 'hover:bg-[#FAFAFA]/50'}`}>
                    <TableCell className="py-3 pr-0 pl-4 text-[#71717A]">
                      {isExpanded
                        ? <ChevronDown className="w-3.5 h-3.5 text-[#F97316]" />
                        : <ChevronRight className="w-3.5 h-3.5" />}
                    </TableCell>
                    {/* Project */}
                    <TableCell className="py-3">
                      <p className="text-sm font-semibold text-[#0A0A0A]">{budget.project}</p>
                    </TableCell>
                    {/* Total Budget */}
                    <TableCell className="py-3">
                      <span className="font-mono font-semibold text-sm text-[#0A0A0A]">{fmtAmount(budget.totalBudget)}</span>
                    </TableCell>
                    {/* Consumed */}
                    <TableCell className="py-3">
                      <span className={`font-mono text-sm font-semibold ${pct >= 90 ? 'text-red-600' : pct >= 70 ? 'text-amber-600' : 'text-[#0A0A0A]'}`}>
                        {fmtAmount(budget.consumed)}
                      </span>
                    </TableCell>
                    {/* Available */}
                    <TableCell className="py-3">
                      <span className={`font-mono text-sm font-semibold ${available < 0 ? 'text-red-700' : 'text-[#0A0A0A]'}`}>
                        {fmtAmount(Math.max(available, 0))}
                      </span>
                    </TableCell>
                    {/* Execution */}
                    <TableCell className="py-3 min-w-[130px]">
                      <ProgressCell consumed={budget.consumed} total={budget.totalBudget} />
                    </TableCell>
                    {/* Alert */}
                    <TableCell className="py-3"><AlertCell pct={pct} /></TableCell>
                  </TableRow>
                );

                if (!isExpanded) return [mainRow];

                const expandedRow = (
                  <TableRow key={`${budget.id}-exp`} className="bg-[#F97316]/5 hover:bg-[#F97316]/5">
                    <TableCell colSpan={7} className="px-6 py-5 border-b border-[#D4D4D8]/50">

                      {/* Expense Breakdown */}
                      {budget.breakdown.length > 0 ? (
                        <div>
                          <p className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-3">
                            Expense Breakdown — {budget.project}
                          </p>
                          <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden max-w-xl">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-[#FAFAFA] hover:bg-[#FAFAFA]">
                                  {['Type','Amount','Share','Progress'].map(h => (
                                    <TableHead key={h} className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider py-2">{h}</TableHead>
                                  ))}
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {budget.breakdown.map(b => (
                                  <TableRow key={b.label} className="border-b border-[#D4D4D8]/50 last:border-0 hover:bg-[#FAFAFA]/50">
                                    <TableCell className="py-2 text-sm font-medium text-[#0A0A0A]">{b.label}</TableCell>
                                    <TableCell className="py-2 font-mono text-sm font-semibold text-[#0A0A0A]">{fmtAmount(b.amount)}</TableCell>
                                    <TableCell className="py-2 text-sm text-[#71717A]">{b.pct.toFixed(1)}%</TableCell>
                                    <TableCell className="py-2 min-w-[100px]">
                                      <div className="h-1.5 bg-[#FAFAFA] rounded-full overflow-hidden">
                                        <div className="h-full bg-[#F97316] rounded-full" style={{ width: `${b.pct}%` }} />
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-[#71717A]">No expenses recorded yet for this project.</p>
                      )}

                    </TableCell>
                  </TableRow>
                );

                return [mainRow, expandedRow];
              })}
            </TableBody>
          </Table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-[#D4D4D8]">
          {SUPERVISOR_BUDGETS.map(budget => {
            const pct        = getPct(budget.consumed, budget.totalBudget);
            const available  = budget.totalBudget - budget.consumed;
            const isExpanded = expandedId === budget.id;
            return (
              <div key={budget.id} className="p-4 space-y-3">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : budget.id)}
                  className="w-full flex items-start justify-between gap-2 text-left"
                >
                  <div>
                    <p className="text-sm font-semibold text-[#0A0A0A]">{budget.project}</p>
                    <div className="mt-1"><AlertCell pct={pct} /></div>
                  </div>
                  {isExpanded
                    ? <ChevronDown className="w-4 h-4 text-[#F97316] flex-shrink-0 mt-0.5" />
                    : <ChevronRight className="w-4 h-4 text-[#71717A] flex-shrink-0 mt-0.5" />}
                </button>
                <ProgressCell consumed={budget.consumed} total={budget.totalBudget} />
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    ['Total',     `$${(budget.totalBudget / 1000).toFixed(0)}k`],
                    ['Consumed',  `$${(budget.consumed / 1000).toFixed(0)}k`],
                    ['Available', `$${(Math.max(available, 0) / 1000).toFixed(0)}k`],
                  ].map(([label, val]) => (
                    <div key={label} className="bg-[#FAFAFA] rounded-lg p-2">
                      <p className="text-[10px] text-[#71717A] uppercase tracking-wide">{label}</p>
                      <p className="text-xs font-mono font-semibold text-[#0A0A0A]">{val}</p>
                    </div>
                  ))}
                </div>
                {/* Mobile breakdown */}
                {isExpanded && budget.breakdown.length > 0 && (
                  <div className="pt-2 space-y-2">
                    <p className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">Expense Breakdown</p>
                    {budget.breakdown.map(b => (
                      <div key={b.label} className="flex items-center gap-2">
                        <span className="text-xs text-[#0A0A0A] w-24 flex-shrink-0">{b.label}</span>
                        <div className="flex-1 h-1.5 bg-[#FAFAFA] rounded-full overflow-hidden">
                          <div className="h-full bg-[#F97316] rounded-full" style={{ width: `${b.pct}%` }} />
                        </div>
                        <span className="text-[11px] font-mono text-[#71717A] flex-shrink-0">
                          {fmtAmount(b.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Informational note at bottom of table */}
        <div className="px-6 py-4 border-t border-[#D4D4D8]/60">
          <div className="flex items-start gap-3 bg-[#F97316]/5 border border-[#F97316]/20 rounded-xl p-4">
            <Info className="w-4 h-4 text-[#F97316] flex-shrink-0 mt-0.5" />
            <p className="text-sm text-[#0A0A0A] leading-relaxed">
              You're seeing budgets for your assigned projects only. Contact an administrator for budget modifications.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
