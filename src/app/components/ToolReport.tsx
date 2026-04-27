import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  TrendingUp, Clock, AlertTriangle, Award, ChevronDown, ChevronRight,
  Download, FileText, FileSpreadsheet, Loader2, Boxes, Package,
  CheckCircle, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { StatCard } from './StatCard';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from './ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from './ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  getAdminTools, getAdminToolSummary, getActiveAssignments, listConsumables,
  type ToolResponse, type ToolSummary, type AssignmentResponse, type ConsumableResponse,
} from '../services/warehouse';
import { exportToolExcel, exportToolPdf } from '../helpers/exportToolReport';

// Key maps

const STATUS_KEY_MAP: Record<string, string> = {
  'Available': 'toolReport.status.available',
  'Assigned':  'toolReport.status.assigned',
  'In Review': 'toolReport.status.inReview',
  'Damaged':   'toolReport.status.damaged',
  'Lost':      'toolReport.status.lost',
};

const CATEGORY_KEY_MAP: Record<string, string> = {
  'Power Tools':      'toolReport.category.powerTools',
  'Hand Tools':       'toolReport.category.handTools',
  'Measurement':      'toolReport.category.measurement',
  'Safety Equipment': 'toolReport.category.safetyEquipment',
  'Heavy Machinery':  'toolReport.category.heavyMachinery',
};

const STATUS_STYLES: Record<string, { color: string; badgeCls: string; dot: string }> = {
  'Available':  { color: 'bg-emerald-500', badgeCls: 'bg-emerald-50 text-emerald-700 border-emerald-200',         dot: 'bg-emerald-500' },
  'Assigned':   { color: 'bg-[#F97316]',   badgeCls: 'bg-[#F97316]/10 text-[#F97316] border-[#F97316]/30',       dot: 'bg-[#F97316]'   },
  'In Review':  { color: 'bg-amber-500',   badgeCls: 'bg-amber-50 text-amber-700 border-amber-200',               dot: 'bg-amber-500'   },
  'Damaged':    { color: 'bg-red-500',     badgeCls: 'bg-red-50 text-red-700 border-red-200',                     dot: 'bg-red-500'     },
  'Lost':       { color: 'bg-slate-400',   badgeCls: 'bg-slate-50 text-slate-600 border-slate-200',               dot: 'bg-slate-400'   },
};

const ALL_STATUSES = ['Available', 'Assigned', 'In Review', 'Damaged', 'Lost'];

// Helpers

function fmtDate(iso: string, locale = 'en-US') {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}
function getDaysOutColor(days: number) {
  if (days > 30) return 'text-red-600 font-semibold';
  if (days >= 7)  return 'text-amber-600 font-semibold';
  return 'text-emerald-600 font-semibold';
}
function getUtilizationColor(pct: number) {
  if (pct >= 80) return 'text-red-600';
  if (pct >= 50) return 'text-amber-600';
  return 'text-emerald-600';
}

function ToolStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation('admin');
  const style = STATUS_STYLES[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap ${style?.badgeCls ?? 'bg-[#FAFAFA] text-[#71717A] border-[#D4D4D8]'}`}>
      {t(STATUS_KEY_MAP[status] ?? status)}
    </span>
  );
}

// Derived data builders

interface StatusRow {
  status: string; count: number; pct: number;
  color: string; badgeCls: string; dot: string;
}

interface CategoryRow {
  category: string; total: number; available: number; assigned: number;
  other: string; utilization: number;
  tools: { code: string; name: string; status: string; assignedTo: string }[];
}

function buildStatusBreakdown(summary: ToolSummary): StatusRow[] {
  const total = summary.total || 1;
  return [
    { status: 'Available',  count: summary.available, pct: (summary.available / total) * 100, ...STATUS_STYLES['Available']  },
    { status: 'Assigned',   count: summary.assigned,  pct: (summary.assigned / total) * 100,  ...STATUS_STYLES['Assigned']   },
    { status: 'In Review',  count: summary.inReview,  pct: (summary.inReview / total) * 100,  ...STATUS_STYLES['In Review']  },
    { status: 'Damaged',    count: summary.damaged,   pct: (summary.damaged / total) * 100,   ...STATUS_STYLES['Damaged']    },
    { status: 'Lost',       count: summary.lost,      pct: (summary.lost / total) * 100,      ...STATUS_STYLES['Lost']       },
  ];
}

function buildCategoryBreakdown(tools: ToolResponse[]): CategoryRow[] {
  const grouped = new Map<string, ToolResponse[]>();
  for (const t of tools) {
    const list = grouped.get(t.category) ?? [];
    list.push(t);
    grouped.set(t.category, list);
  }

  return [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, items]) => {
      const available = items.filter(t => t.status === 'Available').length;
      const assigned  = items.filter(t => t.status === 'Assigned').length;
      const otherCount = items.length - available - assigned;
      const otherStatuses = items
        .filter(t => t.status !== 'Available' && t.status !== 'Assigned')
        .reduce((acc, t) => {
          acc[t.status] = (acc[t.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
      const otherStr = Object.entries(otherStatuses).map(([s, c]) => `${c} ${s}`).join(', ') || '—';

      return {
        category,
        total: items.length,
        available,
        assigned,
        other: otherStr,
        utilization: items.length > 0 ? Math.round((assigned / items.length) * 100) : 0,
        tools: items.map(t => ({
          code: t.code,
          name: t.name,
          status: t.status,
          assignedTo: t.assignedTo ?? '—',
        })),
      };
    });
}

// Consumable helpers

type StockStatus = 'In Stock' | 'Low Stock' | 'Out of Stock';

function getStockStatus(item: ConsumableResponse): StockStatus {
  if (item.currentStock === 0) return 'Out of Stock';
  if (item.currentStock <= item.minimumStock) return 'Low Stock';
  return 'In Stock';
}

const STOCK_STATUS_STYLES: Record<StockStatus, { color: string; badgeCls: string; dot: string }> = {
  'In Stock':     { color: 'bg-emerald-500', badgeCls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  'Low Stock':    { color: 'bg-amber-500',   badgeCls: 'bg-amber-50 text-amber-700 border-amber-200',      dot: 'bg-amber-500'   },
  'Out of Stock': { color: 'bg-red-500',     badgeCls: 'bg-red-50 text-red-600 border-red-200',            dot: 'bg-red-500'     },
};

interface ConsumableCategoryRow {
  category: string;
  total: number;
  totalStock: number;
  inStock: number;
  lowStock: number;
  outOfStock: number;
}

function buildConsumableCategoryBreakdown(consumables: ConsumableResponse[]): ConsumableCategoryRow[] {
  const grouped = new Map<string, ConsumableResponse[]>();
  for (const c of consumables) {
    const list = grouped.get(c.category) ?? [];
    list.push(c);
    grouped.set(c.category, list);
  }
  return [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, items]) => ({
      category,
      total: items.length,
      totalStock: items.reduce((s, i) => s + i.currentStock, 0),
      inStock: items.filter(i => getStockStatus(i) === 'In Stock').length,
      lowStock: items.filter(i => getStockStatus(i) === 'Low Stock').length,
      outOfStock: items.filter(i => getStockStatus(i) === 'Out of Stock').length,
    }));
}

// Main component

export function ToolReport() {
  const { t, i18n } = useTranslation(['admin', 'common']);

  const [tools,       setTools]       = useState<ToolResponse[]>([]);
  const [summary,     setSummary]     = useState<ToolSummary | null>(null);
  const [assignments, setAssignments] = useState<AssignmentResponse[]>([]);
  const [consumables, setConsumables] = useState<ConsumableResponse[]>([]);
  const [loading,     setLoading]     = useState(true);

  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter,   setStatusFilter]   = useState('all');
  const [expandedCat,    setExpandedCat]    = useState<string | null>(null);

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([
      getAdminTools({ size: 500 }),
      getAdminToolSummary(),
      getActiveAssignments(),
      listConsumables(),
    ])
      .then(([toolsPage, sum, assigns, cons]) => {
        setTools(toolsPage.content);
        setSummary(sum);
        setAssignments(assigns);
        setConsumables(cons);
      })
      .catch(() => toast.error('Failed to load report data'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  function handleReset() { setCategoryFilter('all'); setStatusFilter('all'); }

  async function handleExport(format: string) {
    if (!summary) return;
    try {
      const consumableBreakdown = buildConsumableCategoryBreakdown(consumables);
      const params = {
        statusBreakdown: statusBreakdown.map(s => ({ status: s.status, count: s.count, pct: s.pct })),
        categoryBreakdown: categoryBreakdown.map(c => ({ category: c.category, total: c.total, available: c.available, assigned: c.assigned, other: c.other, utilization: c.utilization })),
        consumableBreakdown,
        kpis: { totalTools, utilization: utilizationPct, avgDaysOut, needsAttention },
      };
      if (format === 'excel') {
        await exportToolExcel(params);
      } else {
        exportToolPdf(params);
      }
      toast.success(t('admin:toolReport.exportSuccess', 'Export started'));
    } catch {
      toast.error(t('admin:toolReport.exportError', 'Export failed'));
    }
  }

  // Derived data
  const statusBreakdown   = useMemo(() => summary ? buildStatusBreakdown(summary) : [], [summary]);
  const categoryBreakdown = useMemo(() => buildCategoryBreakdown(tools), [tools]);
  const categories        = useMemo(() => [...new Set(tools.map(t => t.category))].sort(), [tools]);

  const filteredStatus   = statusFilter === 'all' ? statusBreakdown : statusBreakdown.filter(s => s.status === statusFilter);
  const filteredCategory = categoryFilter === 'all' ? categoryBreakdown : categoryBreakdown.filter(c => c.category === categoryFilter);

  // KPI calculations
  const totalTools   = summary?.total ?? 0;
  const assignedCount = summary?.assigned ?? 0;
  const utilizationPct = totalTools > 0 ? ((assignedCount / totalTools) * 100).toFixed(1) : '0';
  const avgDaysOut = assignments.length > 0
    ? (assignments.reduce((sum, a) => sum + a.daysOut, 0) / assignments.length).toFixed(1)
    : '0';
  const needsAttention = (summary?.damaged ?? 0) + (summary?.lost ?? 0);
  const topCategory = categoryBreakdown.length > 0
    ? categoryBreakdown.reduce((top, c) => c.utilization > top.utilization ? c : top, categoryBreakdown[0])
    : null;

  return (
    <div className="space-y-6 max-w-5xl">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-[#0A0A0A]">{t('admin:toolReport.title')}</h2>
          <p className="text-[11px] text-[#71717A] mt-0.5">{t('admin:toolReport.subtitle')}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="border-[#D4D4D8] text-[#71717A] gap-2 h-9 text-xs">
              <Download className="w-3.5 h-3.5" />{t('common:buttons.export')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => handleExport('PDF')} className="gap-2 text-sm cursor-pointer">
              <FileText className="w-4 h-4 text-red-500" />{t('admin:toolReport.exportPdf')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('Excel')} className="gap-2 text-sm cursor-pointer">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />{t('admin:toolReport.exportExcel')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5 min-w-[160px]">
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('admin:toolReport.byCategory.table.category')}</label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-9 border-[#D4D4D8] text-sm"><SelectValue placeholder={t('common:labels.allCategories')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common:labels.allCategories')}</SelectItem>
                {categories.map(c => <SelectItem key={c} value={c}>{t(`admin:${CATEGORY_KEY_MAP[c] ?? c}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5 min-w-[130px]">
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('common:labels.status')}</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 border-[#D4D4D8] text-sm"><SelectValue placeholder={t('common:labels.all')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common:labels.all')}</SelectItem>
                {ALL_STATUSES.map(s => <SelectItem key={s} value={s}>{t(`admin:${STATUS_KEY_MAP[s]}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleReset} variant="outline" className="h-9 text-xs border-[#D4D4D8] text-[#71717A] hover:text-[#0A0A0A]">
            {t('common:buttons.reset')}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-[#71717A]" />
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={TrendingUp}    title={t('admin:toolReport.kpi.utilization')}    value={`${utilizationPct}%`}                                                subtitle={t('admin:toolReport.kpi.utilizationSub', { count: assignedCount, total: totalTools })} iconBgColor="bg-[#F97316]/10" iconColor="text-[#F97316]"   />
            <StatCard icon={Clock}         title={t('admin:toolReport.kpi.avgDaysOut')}     value={`${avgDaysOut} days`}                                                subtitle={t('admin:toolReport.kpi.perTool')}                                                    iconBgColor="bg-amber-50"     iconColor="text-amber-600"   />
            <StatCard icon={AlertTriangle} title={t('admin:toolReport.kpi.needsAttention')} value={needsAttention.toString()}                                           subtitle={t('admin:toolReport.kpi.damagedLost')}                                                iconBgColor="bg-red-50"       iconColor="text-red-600"     />
            <StatCard icon={Award}         title={t('admin:toolReport.kpi.topCategory')}    value={topCategory ? t(`admin:${CATEGORY_KEY_MAP[topCategory.category] ?? topCategory.category}`) : '—'} subtitle={t('admin:toolReport.kpi.highestUtil')} iconBgColor="bg-emerald-50" iconColor="text-emerald-600" />
          </div>

          {/* Table: Tools by Status */}
          <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#D4D4D8]">
              <h3 className="text-sm font-semibold text-[#0A0A0A]">{t('admin:toolReport.byStatus.title')}</h3>
              <p className="text-xs text-[#71717A] mt-0.5">{t('admin:toolReport.byStatus.subtitle', { count: totalTools })}</p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#FAFAFA] hover:bg-[#FAFAFA]">
                    {[t('admin:toolReport.byStatus.table.status'), t('admin:toolReport.byStatus.table.count'), t('admin:toolReport.byStatus.table.percentage'), t('admin:toolReport.byStatus.table.visual')].map(h => (
                      <TableHead key={h} className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider whitespace-nowrap">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStatus.map(s => (
                    <TableRow key={s.status} className="border-b border-[#D4D4D8]/50 hover:bg-[#FAFAFA]/50">
                      <TableCell className="py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${s.badgeCls}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />{t(`admin:${STATUS_KEY_MAP[s.status]}`)}
                        </span>
                      </TableCell>
                      <TableCell className="py-3 text-sm font-bold text-[#0A0A0A]">{s.count}</TableCell>
                      <TableCell className="py-3 text-sm text-[#71717A]">{s.pct.toFixed(1)}%</TableCell>
                      <TableCell className="py-3 pr-6 min-w-[160px]">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-[#FAFAFA] rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${s.color}`} style={{ width: `${s.pct}%` }} />
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Table: Tools by Category */}
          <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#D4D4D8]">
              <h3 className="text-sm font-semibold text-[#0A0A0A]">{t('admin:toolReport.byCategory.title')}</h3>
              <p className="text-xs text-[#71717A] mt-0.5">{t('admin:toolReport.byCategory.subtitle')}</p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#FAFAFA] hover:bg-[#FAFAFA]">
                    <TableHead className="w-8" />
                    {[t('admin:toolReport.byCategory.table.category'), t('admin:toolReport.byCategory.table.total'), t('admin:toolReport.byCategory.table.available'), t('admin:toolReport.byCategory.table.assigned'), t('admin:toolReport.byCategory.table.other'), t('admin:toolReport.byCategory.table.utilization')].map(h => (
                      <TableHead key={h} className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider whitespace-nowrap">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCategory.flatMap(row => {
                    const isExp = expandedCat === row.category;

                    const mainRow = (
                      <TableRow key={`${row.category}-main`}
                        className={`border-b border-[#D4D4D8]/50 cursor-pointer transition-colors ${isExp ? 'bg-[#F97316]/5' : 'hover:bg-[#FAFAFA]/50'}`}
                        onClick={() => setExpandedCat(isExp ? null : row.category)}>
                        <TableCell className="py-3 pl-4 pr-0">
                          {isExp ? <ChevronDown className="w-3.5 h-3.5 text-[#F97316]" /> : <ChevronRight className="w-3.5 h-3.5 text-[#71717A]" />}
                        </TableCell>
                        <TableCell className="py-3 text-sm font-semibold text-[#0A0A0A]">{t(`admin:${CATEGORY_KEY_MAP[row.category] ?? row.category}`)}</TableCell>
                        <TableCell className="py-3 text-sm font-bold text-[#0A0A0A]">{row.total}</TableCell>
                        <TableCell className="py-3 text-sm text-emerald-600 font-medium">{row.available}</TableCell>
                        <TableCell className="py-3 text-sm text-[#F97316] font-medium">{row.assigned}</TableCell>
                        <TableCell className="py-3 text-sm text-[#71717A]">{row.other}</TableCell>
                        <TableCell className="py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-[#FAFAFA] rounded-full overflow-hidden">
                              <div className="h-full bg-[#F97316] rounded-full" style={{ width: `${row.utilization}%` }} />
                            </div>
                            <span className={`text-sm font-semibold ${getUtilizationColor(row.utilization)}`}>{row.utilization}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );

                    if (!isExp) return [mainRow];

                    const expandedRow = (
                      <TableRow key={`${row.category}-exp`} className="hover:bg-[#FAFAFA]/30">
                        <TableCell colSpan={7} className="px-6 py-4 border-b border-[#D4D4D8]/50">
                          <div className="space-y-2">
                            <p className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-2">
                              {t('admin:toolReport.byCategory.toolCount', { category: t(`admin:${CATEGORY_KEY_MAP[row.category] ?? row.category}`), count: row.tools.length })}
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {row.tools.map(tool => (
                                <div key={tool.code} className="flex items-center gap-2 bg-[#FAFAFA] rounded-lg px-3 py-2">
                                  <span className="font-mono text-[11px] font-bold text-[#71717A] flex-shrink-0">{tool.code}</span>
                                  <span className="text-xs font-medium text-[#0A0A0A] flex-1 min-w-0 truncate">{tool.name}</span>
                                  <ToolStatusBadge status={tool.status} />
                                  {tool.assignedTo !== '—' && <span className="text-[11px] text-[#71717A] flex-shrink-0">{tool.assignedTo}</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    );

                    return [mainRow, expandedRow];
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Table: Currently Assigned Tools */}
          <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#D4D4D8] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[#0A0A0A]">{t('admin:toolReport.assigned.title')}</h3>
                <p className="text-xs text-[#71717A] mt-0.5">{t('admin:toolReport.assigned.subtitle', { count: assignments.length })}</p>
              </div>
            </div>
            <div className="overflow-x-auto hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#FAFAFA] hover:bg-[#FAFAFA]">
                    {[t('admin:toolReport.assigned.table.tool'), t('admin:toolReport.assigned.table.worker'), t('admin:toolReport.assigned.table.project'), t('admin:toolReport.assigned.table.assignedSince'), t('admin:toolReport.assigned.table.daysOut')].map(h => (
                      <TableHead key={h} className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider whitespace-nowrap">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.map(a => (
                    <TableRow key={a.id} className="border-b border-[#D4D4D8]/50 hover:bg-[#FAFAFA]/50">
                      <TableCell className="py-3">
                        <p className="text-sm font-semibold text-[#0A0A0A]">{a.toolName}</p>
                        <p className="text-[11px] font-mono text-[#71717A]">{a.toolCode}</p>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-[#F97316]/10 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-[8px] font-bold text-[#F97316]">{a.worker.split(' ').map(w => w[0]).join('')}</span>
                          </div>
                          <span className="text-sm font-medium text-[#0A0A0A]">{a.worker}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-3 text-sm text-[#71717A]">{a.project}</TableCell>
                      <TableCell className="py-3 text-sm text-[#71717A] whitespace-nowrap">{fmtDate(a.assignedDate, i18n.language)}</TableCell>
                      <TableCell className="py-3">
                        <span className={`text-sm ${getDaysOutColor(a.daysOut)}`}>
                          {a.daysOut === 0 ? t('admin:toolReport.assigned.today') : `${a.daysOut}d`}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                  {assignments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-sm text-[#71717A]">
                        No tools currently assigned.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            {/* Mobile */}
            <div className="md:hidden divide-y divide-[#D4D4D8]">
              {assignments.map(a => (
                <div key={a.id} className="p-4 space-y-1">
                  <p className="text-sm font-semibold text-[#0A0A0A]">{a.toolName} <span className="font-mono text-[#71717A] text-xs">({a.toolCode})</span></p>
                  <p className="text-xs text-[#71717A]">{a.worker} · {a.project}</p>
                  <p className="text-xs text-[#71717A]">{t('admin:toolReport.assigned.since')} {fmtDate(a.assignedDate, i18n.language)} · <span className={getDaysOutColor(a.daysOut)}>{a.daysOut === 0 ? t('admin:toolReport.assigned.today') : `${a.daysOut}d`}</span></p>
                </div>
              ))}
            </div>
          </div>

          {/* Consumable Supplies Section */}
          <ConsumableReportSection consumables={consumables} t={t} />
        </>
      )}
    </div>
  );
}

// Consumable report sub-component

function ConsumableReportSection({ consumables, t }: { consumables: ConsumableResponse[]; t: (key: string, opts?: Record<string, unknown>) => string }) {
  const cInStock    = consumables.filter(i => getStockStatus(i) === 'In Stock').length;
  const cLowStock   = consumables.filter(i => getStockStatus(i) === 'Low Stock').length;
  const cOutOfStock = consumables.filter(i => getStockStatus(i) === 'Out of Stock').length;
  const cTotalUnits = consumables.reduce((s, i) => s + i.currentStock, 0);
  const categoryBreakdown = useMemo(() => buildConsumableCategoryBreakdown(consumables), [consumables]);

  // Stock status breakdown
  const stockRows = [
    { status: 'In Stock' as StockStatus,     count: cInStock,    pct: consumables.length ? (cInStock / consumables.length) * 100 : 0 },
    { status: 'Low Stock' as StockStatus,    count: cLowStock,   pct: consumables.length ? (cLowStock / consumables.length) * 100 : 0 },
    { status: 'Out of Stock' as StockStatus, count: cOutOfStock, pct: consumables.length ? (cOutOfStock / consumables.length) * 100 : 0 },
  ];

  if (consumables.length === 0) return null;

  return (
    <>
      {/* Divider */}
      <div className="flex items-center gap-3 pt-2">
        <div className="h-px flex-1 bg-[#D4D4D8]" />
        <div className="flex items-center gap-2 text-[#71717A]">
          <Boxes className="w-4 h-4" />
          <span className="text-xs font-semibold uppercase tracking-wider">{t('admin:toolReport.consumables.sectionTitle')}</span>
        </div>
        <div className="h-px flex-1 bg-[#D4D4D8]" />
      </div>

      {/* Consumable KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Package}       title={t('admin:consumableView.kpi.total')}      value={consumables.length.toString()} subtitle={t('admin:consumableView.kpi.items')}                             iconBgColor="bg-[#C2410C]/10" iconColor="text-[#C2410C]"   />
        <StatCard icon={CheckCircle}   title={t('admin:consumableView.kpi.inStock')}    value={cInStock.toString()}           subtitle={`${cTotalUnits} ${t('admin:consumableView.kpi.units')}`}        iconBgColor="bg-emerald-50"   iconColor="text-emerald-600" />
        <StatCard icon={AlertTriangle} title={t('admin:consumableView.kpi.lowStock')}   value={cLowStock.toString()}          subtitle={t('admin:consumableView.kpi.belowMin')}                         iconBgColor="bg-amber-50"     iconColor="text-amber-600"   />
        <StatCard icon={XCircle}       title={t('admin:consumableView.kpi.outOfStock')} value={cOutOfStock.toString()}        subtitle={t('admin:consumableView.kpi.needRestock')}                      iconBgColor="bg-red-50"       iconColor="text-red-600"     />
      </div>

      {/* Stock Status Breakdown */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#D4D4D8]">
          <h3 className="text-sm font-semibold text-[#0A0A0A]">{t('admin:toolReport.consumables.byStatus')}</h3>
          <p className="text-xs text-[#71717A] mt-0.5">{t('admin:toolReport.consumables.byStatusSub', { count: consumables.length })}</p>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#FAFAFA] hover:bg-[#FAFAFA]">
                {[t('common:labels.status'), t('admin:toolReport.byStatus.table.count'), t('admin:toolReport.byStatus.table.percentage'), t('admin:toolReport.byStatus.table.visual')].map(h => (
                  <TableHead key={h} className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider whitespace-nowrap">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {stockRows.map(s => {
                const style = STOCK_STATUS_STYLES[s.status];
                return (
                  <TableRow key={s.status} className="border-b border-[#D4D4D8]/50 hover:bg-[#FAFAFA]/50">
                    <TableCell className="py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${style.badgeCls}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />{t(`admin:consumableView.status.${s.status === 'In Stock' ? 'inStock' : s.status === 'Low Stock' ? 'lowStock' : 'outOfStock'}`)}
                      </span>
                    </TableCell>
                    <TableCell className="py-3 text-sm font-bold text-[#0A0A0A]">{s.count}</TableCell>
                    <TableCell className="py-3 text-sm text-[#71717A]">{s.pct.toFixed(1)}%</TableCell>
                    <TableCell className="py-3 pr-6 min-w-[160px]">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-[#FAFAFA] rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${style.color}`} style={{ width: `${s.pct}%` }} />
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Consumables by Category */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#D4D4D8]">
          <h3 className="text-sm font-semibold text-[#0A0A0A]">{t('admin:toolReport.consumables.byCategory')}</h3>
          <p className="text-xs text-[#71717A] mt-0.5">{t('admin:toolReport.consumables.byCategorySub')}</p>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#FAFAFA] hover:bg-[#FAFAFA]">
                {[t('common:labels.category'), t('admin:toolReport.consumables.table.items'), t('admin:toolReport.consumables.table.totalStock'), t('admin:consumableView.status.inStock'), t('admin:consumableView.status.lowStock'), t('admin:consumableView.status.outOfStock')].map(h => (
                  <TableHead key={h} className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider whitespace-nowrap">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {categoryBreakdown.map(row => (
                <TableRow key={row.category} className="border-b border-[#D4D4D8]/50 hover:bg-[#FAFAFA]/50">
                  <TableCell className="py-3 text-sm font-semibold text-[#0A0A0A]">{row.category}</TableCell>
                  <TableCell className="py-3 text-sm font-bold text-[#0A0A0A]">{row.total}</TableCell>
                  <TableCell className="py-3 text-sm text-[#71717A] tabular-nums">{row.totalStock}</TableCell>
                  <TableCell className="py-3 text-sm text-emerald-600 font-medium">{row.inStock}</TableCell>
                  <TableCell className="py-3 text-sm text-amber-600 font-medium">{row.lowStock}</TableCell>
                  <TableCell className="py-3 text-sm text-red-600 font-medium">{row.outOfStock}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
