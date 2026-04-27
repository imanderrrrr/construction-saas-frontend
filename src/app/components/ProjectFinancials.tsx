import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DollarSign, TrendingDown, TrendingUp, AlertTriangle,
  ChevronUp, ChevronDown as ChevronDownIcon, Loader2,
} from 'lucide-react';
import { StatCard } from './StatCard';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from './ui/select';
import { listFinanceProjects, type ProjectResponse } from '../services/projects';
import {
  getFinanceExpenseReport, getFinanceExpenses,
  type ExpenseReportResponse, type ProjectExpenseRow, type ExpenseResponse,
} from '../services/expenses';

// Helpers

function centsToUsd(c: number) { return c / 100; }

function fmtAmount(n: number) {
  return `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}
function fmtAmountShort(n: number) {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}
function fmtDate(iso: string, locale: string = 'en-US') {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
}

const EXPENSE_TYPE_COLORS: Record<string, string> = {
  FUEL: '#ef4444',
  MATERIALS: '#9333ea',
  TOOLS: '#d97706',
  PER_DIEM: '#0ea5e9',
  MINOR_PURCHASES: '#10b981',
  TRANSPORTATION: '#6366f1',
  OTHER: '#71717A',
};

// Types for processed data

interface ProjectFinancial {
  id: number;
  name: string;
  status: 'Active' | 'Closed';
  startDate: string;
  contractValue: number;       // total budget in dollars
  totalActualCost: number;     // approved expenses in dollars
  typeBreakdown: { type: string; totalCents: number }[];
}

interface MonthlyData {
  month: string;       // "Jan 2026"
  budget: number;      // contract value (same each month, for reference)
  costs: number;       // approved expenses that month
}

// Component

export function ProjectFinancials() {
  const { t, i18n } = useTranslation(['finance', 'common']);

  function getTypeLabel(type: string): string {
    return t(`finance:type.long.${type}`, { defaultValue: type });
  }

  const fmtLocale = i18n.language === 'es' ? 'es' : 'en-US';

  const [selectedProject, setSelectedProject] = useState('all');
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<ProjectFinancial[]>([]);
  const [monthlyByProject, setMonthlyByProject] = useState<Record<number, MonthlyData[]>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [projPage, report, expPage] = await Promise.all([
          listFinanceProjects({ size: 500 }),
          getFinanceExpenseReport(),
          getFinanceExpenses({ size: 1000 }),  // for monthly grouping
        ]);

        if (cancelled) return;

        // Build lookup of expense report by project
        const reportByProject = new Map<number, ProjectExpenseRow>();
        report.byProject.forEach(r => reportByProject.set(r.projectId, r));

        // Map projects
        const mapped: ProjectFinancial[] = projPage.content
          .filter(p => p.originalContractCents != null || (p.totalConsumedCents ?? 0) > 0)
          .map(p => {
            const totalBudgetCents = p.revisedContractCents ?? p.originalContractCents ?? 0;
            const rp = reportByProject.get(p.id);
            return {
              id: p.id,
              name: p.name,
              status: p.status === 'CLOSED' ? 'Closed' as const : 'Active' as const,
              startDate: p.createdAt.split('T')[0],
              contractValue: centsToUsd(totalBudgetCents),
              totalActualCost: centsToUsd(p.totalConsumedCents ?? 0),
              typeBreakdown: rp?.breakdown ?? [],
            };
          });

        setProjects(mapped);

        // Build monthly trend from individual expenses
        const monthly: Record<number, Record<string, number>> = {};
        expPage.content
          .filter((e: ExpenseResponse) => e.status === 'APPROVED')
          .forEach((e: ExpenseResponse) => {
            const d = new Date(e.expenseDate);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (!monthly[e.projectId]) monthly[e.projectId] = {};
            monthly[e.projectId][key] = (monthly[e.projectId][key] ?? 0) + e.amountCents;
          });

        // Convert to sorted MonthlyData arrays
        const result: Record<number, MonthlyData[]> = {};
        const projMap = new Map(mapped.map(p => [p.id, p]));
        for (const [pid, months] of Object.entries(monthly)) {
          const projId = Number(pid);
          const proj = projMap.get(projId);
          const sorted = Object.entries(months)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([ym, cents]) => {
              const [y, m] = ym.split('-');
              const label = new Date(Number(y), Number(m) - 1).toLocaleDateString(i18n.language === 'es' ? 'es' : 'en-US', { month: 'short', year: 'numeric' });
              return { month: label, budget: proj?.contractValue ?? 0, costs: centsToUsd(cents) };
            });
          result[projId] = sorted;
        }
        setMonthlyByProject(result);
      } catch (err) {
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Aggregate KPIs
  const totals = useMemo(() => {
    const totalRevenue = projects.reduce((s, p) => s + p.contractValue, 0);
    const totalCost = projects.reduce((s, p) => s + p.totalActualCost, 0);
    const overBudgetCount = projects.filter(p => p.totalActualCost > p.contractValue && p.contractValue > 0).length;
    const margin = totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue * 100) : 0;
    return { totalRevenue, totalCost, margin, overBudgetCount };
  }, [projects]);

  const selectedData = selectedProject !== 'all'
    ? projects.find(p => String(p.id) === selectedProject)
    : null;

  // Get unique expense types across all projects for table headers
  const allTypes = useMemo(() => {
    const types = new Set<string>();
    projects.forEach(p => p.typeBreakdown.forEach(b => types.add(b.type)));
    return Array.from(types).sort();
  }, [projects]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#F97316]" />
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="text-center py-20 text-[#71717A] text-sm">
        {t('finance:projectFinancials.noProjects')}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1 block">{t('common:labels.project')}</label>
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger className="h-9 text-sm border-[#D4D4D8]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common:labels.allProjects')}</SelectItem>
                {projects.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* All Projects overview */}
      {!selectedData && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={DollarSign}     title={t('finance:projectFinancials.kpi.totalBudget')}    value={fmtAmount(totals.totalRevenue)} subtitle={t('finance:projectFinancials.kpi.acrossAllProjects')}  iconBgColor="bg-purple-50"  iconColor="text-purple-600" />
            <StatCard icon={TrendingDown}   title={t('finance:projectFinancials.kpi.totalCosts')}     value={fmtAmount(totals.totalCost)}    subtitle={t('finance:projectFinancials.kpi.approvedExpenses')}     iconBgColor="bg-amber-50"   iconColor="text-amber-600" />
            <StatCard icon={TrendingUp}     title={t('finance:projectFinancials.kpi.remaining')}       value={`${totals.margin.toFixed(1)}%`} subtitle={t('finance:projectFinancials.kpi.budgetRemaining')}      iconBgColor="bg-emerald-50" iconColor="text-emerald-600" />
            <StatCard icon={AlertTriangle}  title={t('finance:projectFinancials.kpi.overBudget')}     value={`${totals.overBudgetCount} project${totals.overBudgetCount !== 1 ? 's' : ''}`} subtitle={t('finance:projectFinancials.kpi.needsAttention')} iconBgColor="bg-red-50" iconColor="text-red-600" />
          </div>

          {/* Comparison table */}
          <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#D4D4D8]">
              <span className="text-sm font-semibold text-[#0A0A0A]">{t('finance:projectFinancials.projectsComparison')}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[750px]">
                <thead>
                  <tr className="bg-[#FAFAFA]">
                    {[t('finance:projectFinancials.table.project'), t('finance:projectFinancials.table.budget'), ...allTypes.map(tp => getTypeLabel(tp)), t('finance:projectFinancials.table.totalCost'), t('finance:projectFinancials.table.margin'), t('finance:projectFinancials.table.budgetUsage')].map(h => (
                      <th key={h} className="text-left text-[11px] font-semibold text-[#71717A] uppercase tracking-wider px-3 py-2.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {projects.map(p => {
                    const margin = p.contractValue > 0 ? ((p.contractValue - p.totalActualCost) / p.contractValue * 100) : 0;
                    const budgetPct = p.contractValue > 0 ? (p.totalActualCost / p.contractValue * 100) : 0;
                    const marginColor = margin >= 20 ? 'text-emerald-600' : margin >= 10 ? 'text-amber-600' : 'text-red-600';
                    const barColor = budgetPct > 100 ? 'bg-red-500' : budgetPct >= 80 ? 'bg-amber-500' : 'bg-emerald-500';
                    const breakdownMap = new Map(p.typeBreakdown.map(b => [b.type, b.totalCents]));
                    return (
                      <tr key={p.id} className="border-b border-[#D4D4D8]/50 hover:bg-[#FAFAFA]/60 transition-colors cursor-pointer"
                        onClick={() => setSelectedProject(String(p.id))}>
                        <td className="py-3 px-3 text-sm font-medium text-[#0A0A0A]">{p.name}</td>
                        <td className="py-3 px-3 font-mono text-sm text-[#0A0A0A]">{fmtAmountShort(p.contractValue)}</td>
                        {allTypes.map(t => (
                          <td key={t} className="py-3 px-3 font-mono text-sm text-[#71717A]">
                            {fmtAmountShort(centsToUsd(breakdownMap.get(t) ?? 0))}
                          </td>
                        ))}
                        <td className="py-3 px-3 font-mono font-semibold text-sm text-[#0A0A0A]">{fmtAmountShort(p.totalActualCost)}</td>
                        <td className={`py-3 px-3 font-semibold text-sm ${marginColor}`}>{margin.toFixed(1)}%</td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-2 bg-[#FAFAFA] rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(budgetPct, 100)}%` }} />
                            </div>
                            <span className={`text-xs font-medium ${budgetPct > 100 ? 'text-red-600' : 'text-[#71717A]'}`}>{budgetPct.toFixed(0)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Single project detail */}
      {selectedData && (
        <>
          {/* Project header */}
          <div className="bg-white rounded-xl border border-[#D4D4D8] p-6">
            <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-xl font-bold text-[#0A0A0A]">{selectedData.name}</h2>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                    selectedData.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-[#FAFAFA] text-[#71717A] border-[#D4D4D8]'
                  }`}>{selectedData.status}</span>
                </div>
                <p className="text-xs text-[#71717A]">
                  {t('finance:projectFinancials.started', { date: fmtDate(selectedData.startDate, fmtLocale) })}
                </p>
              </div>
              <button onClick={() => setSelectedProject('all')}
                className="text-xs font-medium text-purple-600 hover:text-purple-800 transition-colors">
                {t('finance:projectFinancials.backToAll')}
              </button>
            </div>
            {/* Large KPIs */}
            {(() => {
              const margin = selectedData.contractValue > 0
                ? ((selectedData.contractValue - selectedData.totalActualCost) / selectedData.contractValue * 100)
                : 0;
              const marginColor = margin >= 20 ? 'text-emerald-600' : margin >= 10 ? 'text-amber-600' : 'text-red-600';
              return (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="text-center">
                    <p className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wide mb-1">{t('finance:projectFinancials.totalBudget')}</p>
                    <p className="text-2xl font-bold text-[#0A0A0A] font-mono">{fmtAmount(selectedData.contractValue)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wide mb-1">{t('finance:projectFinancials.totalCost')}</p>
                    <p className="text-2xl font-bold text-[#0A0A0A] font-mono">{fmtAmount(selectedData.totalActualCost)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wide mb-1">{t('finance:projectFinancials.margin')}</p>
                    <p className={`text-2xl font-bold ${marginColor}`}>{margin.toFixed(1)}%</p>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Cost breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Expense by Type */}
            <div className="bg-white rounded-xl border border-[#D4D4D8] p-6">
              <p className="text-sm font-semibold text-[#0A0A0A] mb-4">{t('finance:projectFinancials.expensesByType')}</p>
              <div className="space-y-5">
                {selectedData.typeBreakdown.length === 0 ? (
                  <p className="text-sm text-[#71717A]">{t('finance:projectFinancials.noExpenses')}</p>
                ) : (
                  selectedData.typeBreakdown.map(b => {
                    const actual = centsToUsd(b.totalCents);
                    const pct = selectedData.contractValue > 0 ? (actual / selectedData.contractValue * 100) : 0;
                    return (
                      <div key={b.type}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-[#0A0A0A]">{getTypeLabel(b.type)}</span>
                          <span className="text-xs font-semibold text-[#71717A]">
                            {fmtAmount(actual)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <div className="w-full h-3 bg-[#FAFAFA] rounded-full overflow-hidden border border-[#D4D4D8]">
                              <div className="h-full rounded-full transition-all"
                                style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: EXPENSE_TYPE_COLORS[b.type] ?? '#71717A' }} />
                            </div>
                          </div>
                          <span className="text-xs text-[#71717A] w-12 text-right">{pct.toFixed(1)}%</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Cost Distribution */}
            <div className="bg-white rounded-xl border border-[#D4D4D8] p-6">
              <p className="text-sm font-semibold text-[#0A0A0A] mb-4">{t('finance:projectFinancials.costDistribution')}</p>
              {(() => {
                const totalCost = selectedData.totalActualCost;
                const breakdown = selectedData.typeBreakdown;
                if (breakdown.length === 0) {
                  return <p className="text-sm text-[#71717A]">{t('finance:projectFinancials.noExpenses')}</p>;
                }
                return (
                  <div className="space-y-4">
                    {/* Stacked bar */}
                    <div className="w-full h-8 rounded-lg overflow-hidden flex">
                      {breakdown.map(b => {
                        const pct = totalCost > 0 ? (centsToUsd(b.totalCents) / totalCost * 100) : 0;
                        return (
                          <div key={b.type} style={{ width: `${pct}%`, backgroundColor: EXPENSE_TYPE_COLORS[b.type] ?? '#71717A' }}
                            className="h-full transition-all" title={`${getTypeLabel(b.type)}: ${pct.toFixed(1)}%`} />
                        );
                      })}
                    </div>
                    {/* Legend */}
                    <div className="space-y-2">
                      {breakdown.map(b => {
                        const val = centsToUsd(b.totalCents);
                        const pct = totalCost > 0 ? (val / totalCost * 100) : 0;
                        return (
                          <div key={b.type} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded" style={{ backgroundColor: EXPENSE_TYPE_COLORS[b.type] ?? '#71717A' }} />
                              <span className="text-sm text-[#0A0A0A]">{getTypeLabel(b.type)}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-sm text-[#0A0A0A]">{fmtAmount(val)}</span>
                              <span className="text-xs text-[#71717A] w-12 text-right">{pct.toFixed(1)}%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="pt-3 border-t border-[#D4D4D8]">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-[#0A0A0A]">{t('finance:projectFinancials.total')}</span>
                        <span className="font-mono font-semibold text-sm text-[#0A0A0A]">{fmtAmount(totalCost)}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Monthly trend */}
          {monthlyByProject[selectedData.id] && monthlyByProject[selectedData.id].length > 0 && (
            <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
              <div className="px-6 py-4 border-b border-[#D4D4D8]">
                <span className="text-sm font-semibold text-[#0A0A0A]">{t('finance:projectFinancials.monthlyExpenses')}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#FAFAFA]">
                      <th className="text-left text-[11px] font-semibold text-[#71717A] uppercase tracking-wider px-4 py-2.5">{t('finance:projectFinancials.table.month')}</th>
                      <th className="text-right text-[11px] font-semibold text-[#71717A] uppercase tracking-wider px-4 py-2.5">{t('finance:projectFinancials.table.expenses')}</th>
                      <th className="text-right text-[11px] font-semibold text-[#71717A] uppercase tracking-wider px-4 py-2.5">{t('finance:projectFinancials.table.trend')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyByProject[selectedData.id].map((m, i, arr) => {
                      const prev = i > 0 ? arr[i - 1].costs : null;
                      return (
                        <tr key={m.month} className="border-b border-[#D4D4D8]/50">
                          <td className="px-4 py-3 text-sm font-medium text-[#0A0A0A]">{m.month}</td>
                          <td className="px-4 py-3 text-right font-mono text-sm text-[#0A0A0A]">{fmtAmount(m.costs)}</td>
                          <td className="px-4 py-3 text-right">
                            {prev !== null && (
                              <div className="flex items-center justify-end gap-1">
                                {m.costs > prev
                                  ? <><ChevronUp className="w-3 h-3 text-red-500" /><span className="text-xs text-red-500">+{fmtAmountShort(m.costs - prev)}</span></>
                                  : m.costs < prev
                                    ? <><ChevronDownIcon className="w-3 h-3 text-emerald-500" /><span className="text-xs text-emerald-500">-{fmtAmountShort(prev - m.costs)}</span></>
                                    : <span className="text-xs text-[#71717A]">—</span>
                                }
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
