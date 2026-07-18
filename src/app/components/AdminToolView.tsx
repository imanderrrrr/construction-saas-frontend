import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Package, CheckCircle, ArrowLeftRight, AlertTriangle, XCircle,
  Search, ChevronDown, ChevronRight, Wrench, Loader2, Boxes,
} from 'lucide-react';
import { StatCard } from './StatCard';
import { Input } from './ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from './ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from './ui/select';
import { Button } from './ui/button';
import { toast } from 'sonner';
import {
  getAdminTools, getAdminToolSummary, listConsumables,
  type ToolResponse, type ToolSummary, type ConsumableResponse,
} from '../services/warehouse';

// Constants

const ITEMS_PER_PAGE = 6;
const ADMIN_COLOR = '#C2410C';

// Key maps

const STATUS_KEY_MAP: Record<string, string> = {
  'Available': 'toolReport.status.available',
  'Assigned':  'toolReport.status.assigned',
  'In Review': 'toolReport.status.inReview',
  'Damaged':   'toolReport.status.damaged',
  'Lost':      'toolReport.status.lost',
};

const ACTION_KEY_MAP: Record<string, string> = {
  'Registered':     'toolView.action.registered',
  'Assigned':       'toolView.action.assigned',
  'Returned':       'toolView.action.returned',
  'Status Changed': 'toolView.action.statusChanged',
  'Reported':       'toolView.action.reported',
};

const CATEGORY_KEY_MAP: Record<string, string> = {
  'Power Tools':       'toolReport.category.powerTools',
  'Hand Tools':        'toolReport.category.handTools',
  'Measurement':       'toolReport.category.measurement',
  'Safety Equipment':  'toolReport.category.safetyEquipment',
  'Heavy Machinery':   'toolReport.category.heavyMachinery',
};

// Helpers

import { fmtDate, fmtDateShort } from '../helpers/dateTime';
import { FIELD_LIMITS } from '../../shared/fieldLimits';

// Sub-components

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation('admin');
  const cfg: Record<string, string> = {
    'Available': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Assigned':  'bg-[#F97316]/10 text-[#F97316] border-[#F97316]/30',
    'In Review': 'bg-amber-50 text-amber-700 border-amber-200',
    'Damaged':   'bg-red-50 text-red-700 border-red-200',
    'Lost':      'bg-slate-50 text-slate-600 border-slate-200',
  };
  const dot: Record<string, string> = {
    'Available': 'bg-emerald-500', 'Assigned': 'bg-[#F97316]',
    'In Review': 'bg-amber-500',   'Damaged':  'bg-red-500', 'Lost': 'bg-slate-400',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap ${cfg[status] ?? 'bg-[#FAFAFA] text-[#71717A] border-[#D4D4D8]'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot[status] ?? 'bg-slate-400'}`} />{t(STATUS_KEY_MAP[status] ?? status)}
    </span>
  );
}

function HistActionBadge({ action }: { action: string }) {
  const { t } = useTranslation('admin');
  const cfg: Record<string, string> = {
    'Registered':     'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Assigned':       'bg-[#F97316]/10 text-[#F97316] border-[#F97316]/20',
    'Returned':       'bg-amber-50 text-amber-700 border-amber-200',
    'Status Changed': 'bg-slate-50 text-slate-600 border-slate-200',
    'Reported':       'bg-red-50 text-red-600 border-red-200',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap ${cfg[action] ?? 'bg-[#FAFAFA] text-[#71717A] border-[#D4D4D8]'}`}>
      {t(ACTION_KEY_MAP[action] ?? action)}
    </span>
  );
}

function Pagination({ current, total, onPage }: { current: number; total: number; onPage: (p: number) => void }) {
  const { t } = useTranslation('common');
  if (total <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-1 py-4 border-t border-[#D4D4D8]">
      <button onClick={() => onPage(current - 1)} disabled={current === 1}
        className="h-8 px-3 rounded-lg text-xs font-medium text-[#71717A] hover:bg-[#FAFAFA] disabled:opacity-30 disabled:cursor-not-allowed">{t('buttons.prev')}</button>
      {Array.from({ length: total }, (_, i) => i + 1).map(p => (
        <button key={p} onClick={() => onPage(p)}
          className={`h-8 w-8 rounded-lg text-xs font-semibold transition-colors ${
            p === current ? 'text-white' : 'text-[#71717A] hover:bg-[#FAFAFA]'
          }`}
          style={p === current ? { backgroundColor: ADMIN_COLOR } : {}}>
          {p}
        </button>
      ))}
      <button onClick={() => onPage(current + 1)} disabled={current === total}
        className="h-8 px-3 rounded-lg text-xs font-medium text-[#71717A] hover:bg-[#FAFAFA] disabled:opacity-30 disabled:cursor-not-allowed">{t('buttons.next')}</button>
    </div>
  );
}

// Consumable helpers

type StockStatus = 'In Stock' | 'Low Stock' | 'Out of Stock';

function getStockStatus(item: ConsumableResponse): StockStatus {
  if (item.currentStock === 0) return 'Out of Stock';
  if (item.currentStock <= item.minimumStock) return 'Low Stock';
  return 'In Stock';
}

function StockStatusBadge({ status }: { status: StockStatus }) {
  const cfg: Record<StockStatus, { bg: string; dot: string }> = {
    'In Stock':     { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
    'Low Stock':    { bg: 'bg-amber-50 text-amber-700 border-amber-200',      dot: 'bg-amber-500'   },
    'Out of Stock': { bg: 'bg-red-50 text-red-600 border-red-200',            dot: 'bg-red-500'     },
  };
  const c = cfg[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${c.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {status}
    </span>
  );
}

function StockBar({ current, minimum }: { current: number; minimum: number }) {
  const max = Math.max(current, minimum) * 1.5 || 1;
  const pct = Math.min((current / max) * 100, 100);
  const color = current === 0 ? 'bg-red-500' : current <= minimum ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-[#FAFAFA] rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-[#71717A] tabular-nums">{current} / {minimum}</span>
    </div>
  );
}

type ActiveTab = 'returnable' | 'consumable';

const CONSUMABLE_ITEMS_PER_PAGE = 8;

// Main component

export function AdminToolView() {
  const { t, i18n } = useTranslation(['admin', 'common']);

  const [activeTab, setActiveTab] = useState<ActiveTab>('returnable');

  // Returnable tools state
  const [tools,   setTools]   = useState<ToolResponse[]>([]);
  const [summary, setSummary] = useState<ToolSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const [search,         setSearch]         = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter,   setStatusFilter]   = useState('all');
  const [workerFilter,   setWorkerFilter]   = useState('all');
  const [expandedId,     setExpandedId]     = useState<number | null>(null);
  const [currentPage,    setCurrentPage]    = useState(1);

  // Consumable state
  const [consumables,      setConsumables]      = useState<ConsumableResponse[]>([]);
  const [consumableLoading, setConsumableLoading] = useState(true);
  const [cSearch,          setCSearch]          = useState('');
  const [cCategoryFilter,  setCCategoryFilter]  = useState('all');
  const [cStatusFilter,    setCStatusFilter]    = useState('all');
  const [cPage,            setCPage]            = useState(1);

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([
      getAdminTools({ size: 500 }),
      getAdminToolSummary(),
    ])
      .then(([toolsPage, sum]) => {
        setTools(toolsPage.content);
        setSummary(sum);
      })
      .catch(() => toast.error(t('admin:adminTools.loadToolsError', 'Failed to load tools')))
      .finally(() => setLoading(false));
  }, []);

  const loadConsumables = useCallback(() => {
    setConsumableLoading(true);
    listConsumables()
      .then(setConsumables)
      .catch(() => toast.error(t('admin:adminTools.loadConsumablesError', 'Failed to load consumables')))
      .finally(() => setConsumableLoading(false));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { loadConsumables(); }, [loadConsumables]);

  // Returnable: Dynamic filter options from loaded data
  const categories = useMemo(() => [...new Set(tools.map(t => t.category))].sort(), [tools]);
  const workers    = useMemo(() => [...new Set(tools.map(t => t.assignedTo).filter(Boolean))].sort() as string[], [tools]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return tools.filter(t => {
      if (q && !t.code.toLowerCase().includes(q) && !t.name.toLowerCase().includes(q)) return false;
      if (categoryFilter !== 'all' && t.category   !== categoryFilter)  return false;
      if (statusFilter   !== 'all' && t.status     !== statusFilter)    return false;
      if (workerFilter   !== 'all' && (t.assignedTo ?? '') !== workerFilter) return false;
      return true;
    });
  }, [tools, search, categoryFilter, statusFilter, workerFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const pageRows   = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Consumable: filter options
  const cCategories = useMemo(() => [...new Set(consumables.map(c => c.category))].sort(), [consumables]);

  const cFiltered = useMemo(() => {
    const q = cSearch.toLowerCase().trim();
    return consumables.filter(item => {
      if (q && !item.code.toLowerCase().includes(q) && !item.name.toLowerCase().includes(q)) return false;
      if (cCategoryFilter !== 'all' && item.category !== cCategoryFilter) return false;
      if (cStatusFilter !== 'all' && getStockStatus(item) !== cStatusFilter) return false;
      return true;
    });
  }, [consumables, cSearch, cCategoryFilter, cStatusFilter]);

  const cTotalPages = Math.max(1, Math.ceil(cFiltered.length / CONSUMABLE_ITEMS_PER_PAGE));
  const cPageRows = cFiltered.slice((cPage - 1) * CONSUMABLE_ITEMS_PER_PAGE, cPage * CONSUMABLE_ITEMS_PER_PAGE);

  // Consumable KPIs
  const cInStock    = consumables.filter(i => getStockStatus(i) === 'In Stock').length;
  const cLowStock   = consumables.filter(i => getStockStatus(i) === 'Low Stock').length;
  const cOutOfStock = consumables.filter(i => getStockStatus(i) === 'Out of Stock').length;
  const cTotalUnits = consumables.reduce((sum, i) => sum + i.currentStock, 0);

  function handleReset() {
    setSearch(''); setCategoryFilter('all'); setStatusFilter('all'); setWorkerFilter('all'); setCurrentPage(1);
  }

  function handleCReset() {
    setCSearch(''); setCCategoryFilter('all'); setCStatusFilter('all'); setCPage(1);
  }

  return (
    <div className="space-y-6 max-w-6xl">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-[#0A0A0A]">{t('admin:toolView.title')}</h2>
          <p className="text-[11px] text-[#71717A] mt-0.5">{t('admin:toolView.subtitle')}</p>
        </div>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
          style={{ backgroundColor: ADMIN_COLOR + '1A', color: ADMIN_COLOR, borderColor: ADMIN_COLOR + '33' }}>
          {t('admin:toolView.readOnly')}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#FAFAFA] rounded-lg p-1">
        <button
          onClick={() => setActiveTab('returnable')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'returnable'
              ? 'bg-white text-[#0A0A0A] shadow-sm'
              : 'text-[#71717A] hover:text-[#0A0A0A]'
          }`}>
          <Wrench className="w-4 h-4" />
          {t('admin:toolView.tab.returnable')}
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
            activeTab === 'returnable' ? 'bg-[#C2410C]/10 text-[#C2410C]' : 'bg-[#D4D4D8]/50 text-[#71717A]'
          }`}>{tools.length}</span>
        </button>
        <button
          onClick={() => setActiveTab('consumable')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'consumable'
              ? 'bg-white text-[#0A0A0A] shadow-sm'
              : 'text-[#71717A] hover:text-[#0A0A0A]'
          }`}>
          <Boxes className="w-4 h-4" />
          {t('admin:toolView.tab.consumable')}
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
            activeTab === 'consumable' ? 'bg-[#C2410C]/10 text-[#C2410C]' : 'bg-[#D4D4D8]/50 text-[#71717A]'
          }`}>{consumables.length}</span>
        </button>
      </div>

      {activeTab === 'returnable' && (
      <>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard icon={Package}       title={t('admin:toolView.kpi.total')}     value={loading ? '—' : (summary?.total     ?? 0).toString()} subtitle={t('admin:toolView.kpi.allTools')}    iconBgColor="bg-[#C2410C]/10" iconColor="text-[#C2410C]"   />
        <StatCard icon={CheckCircle}   title={t('admin:toolView.kpi.available')} value={loading ? '—' : (summary?.available ?? 0).toString()} subtitle={t('admin:toolView.kpi.ready')}        iconBgColor="bg-emerald-50"   iconColor="text-emerald-600" />
        <StatCard icon={ArrowLeftRight}title={t('admin:toolView.kpi.assigned')}  value={loading ? '—' : (summary?.assigned  ?? 0).toString()} subtitle={t('admin:toolView.kpi.out')}          iconBgColor="bg-[#F97316]/10" iconColor="text-[#F97316]"   />
        <StatCard icon={AlertTriangle} title={t('admin:toolView.kpi.damaged')}   value={loading ? '—' : (summary?.damaged   ?? 0).toString()} subtitle={t('admin:toolView.kpi.needsRepair')} iconBgColor="bg-red-50"       iconColor="text-red-600"     />
        <StatCard icon={XCircle}       title={t('admin:toolView.kpi.lost')}      value={loading ? '—' : (summary?.lost      ?? 0).toString()} subtitle={t('admin:toolView.kpi.unaccounted')}  iconBgColor="bg-red-50"       iconColor="text-red-700"     />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5 flex-1 min-w-[160px]">
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('common:labels.search')}</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#71717A]" />
              <Input value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                maxLength={FIELD_LIMITS.SEARCH}
                placeholder={t('admin:toolView.searchPlaceholder')} className="pl-8 h-9 border-[#D4D4D8] text-sm" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5 min-w-[140px]">
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('common:labels.category')}</label>
            <Select value={categoryFilter} onValueChange={v => { setCategoryFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="h-9 border-[#D4D4D8] text-sm"><SelectValue placeholder={t('common:labels.allCategories')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common:labels.allCategories')}</SelectItem>
                {categories.map(c => <SelectItem key={c} value={c}>{t(`admin:${CATEGORY_KEY_MAP[c] ?? c}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5 min-w-[130px]">
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('common:labels.status')}</label>
            <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="h-9 border-[#D4D4D8] text-sm"><SelectValue placeholder={t('common:labels.all')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common:labels.all')}</SelectItem>
                {['Available','Assigned','In Review','Damaged','Lost'].map(s => <SelectItem key={s} value={s}>{t(`admin:${STATUS_KEY_MAP[s]}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5 min-w-[150px]">
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('common:labels.worker')}</label>
            <Select value={workerFilter} onValueChange={v => { setWorkerFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="h-9 border-[#D4D4D8] text-sm"><SelectValue placeholder={t('common:labels.allWorkers')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common:labels.allWorkers')}</SelectItem>
                {workers.map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={handleReset} className="h-9 px-4 text-xs border-[#D4D4D8] text-[#71717A]">{t('common:buttons.reset')}</Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-[#D4D4D8]">
          <Wrench className="w-4 h-4 text-[#71717A]" />
          <span className="text-sm font-semibold text-[#0A0A0A]">{t('admin:toolView.allCompanyTools')}</span>
          <span className="text-xs text-[#71717A] ml-1">· {filtered.length} / {tools.length}</span>
          <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full border"
            style={{ backgroundColor: ADMIN_COLOR + '1A', color: ADMIN_COLOR, borderColor: ADMIN_COLOR + '33' }}>
            {t('admin:toolView.readOnly')}
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-[#71717A]" />
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#FAFAFA] hover:bg-[#FAFAFA]">
                    <TableHead className="w-8" />
                    {[t('common:labels.code'), t('admin:toolView.table.toolName'), t('common:labels.category'), t('common:labels.status'), t('admin:toolView.table.assignedTo'), t('admin:toolView.table.lastActivity')].map(h => (
                      <TableHead key={h} className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider whitespace-nowrap">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.flatMap(tool => {
                    const isExp = expandedId === tool.id;

                    const mainRow = (
                      <TableRow key={`${tool.id}-main`}
                        className={`border-b border-[#D4D4D8]/50 transition-colors ${isExp ? 'bg-[#C2410C]/5' : 'hover:bg-[#FAFAFA]/50'}`}>
                        <TableCell className="py-3 pr-0 pl-4">
                          <button onClick={() => setExpandedId(isExp ? null : tool.id)}
                            className="text-[#71717A] hover:text-[#C2410C] transition-colors">
                            {isExp ? <ChevronDown className="w-3.5 h-3.5" style={{ color: ADMIN_COLOR }} /> : <ChevronRight className="w-3.5 h-3.5" />}
                          </button>
                        </TableCell>
                        <TableCell className="py-3 font-mono text-sm font-semibold text-[#0A0A0A]">{tool.code}</TableCell>
                        <TableCell className="py-3">
                          <p className={`text-sm font-medium text-[#0A0A0A] ${tool.status === 'Lost' ? 'line-through text-[#71717A]' : ''}`}>{tool.name}</p>
                        </TableCell>
                        <TableCell className="py-3 text-sm text-[#71717A]">{t(`admin:${CATEGORY_KEY_MAP[tool.category] ?? tool.category}`)}</TableCell>
                        <TableCell className="py-3"><StatusBadge status={tool.status} /></TableCell>
                        <TableCell className="py-3 text-sm text-[#71717A]">{tool.assignedTo ?? '—'}</TableCell>
                        <TableCell className="py-3 text-sm text-[#71717A] whitespace-nowrap">{fmtDateShort(tool.lastActivity, i18n.language)}</TableCell>
                      </TableRow>
                    );

                    if (!isExp) return [mainRow];

                    const expandedRow = (
                      <TableRow key={`${tool.id}-exp`} className="hover:bg-[#FAFAFA]/30">
                        <TableCell colSpan={7} className="px-6 py-5 border-b border-[#D4D4D8]/50">
                          <div className="space-y-4">
                            {/* Details grid */}
                            <div>
                              <p className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-2">{t('admin:toolView.toolDetails')}</p>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-[#FAFAFA] rounded-xl p-3">
                                {[
                                  [t('common:labels.code'),                    tool.code],
                                  [t('common:labels.category'),                t(`admin:${CATEGORY_KEY_MAP[tool.category] ?? tool.category}`)],
                                  [t('common:labels.status'),                  <StatusBadge key="s" status={tool.status} />],
                                  [t('admin:toolView.detail.assignedTo'),      tool.assignedTo ?? '—'],
                                  [t('admin:toolView.detail.dateRegistered'),  fmtDate(tool.dateRegistered, i18n.language)],
                                  [t('common:labels.notes'),                   tool.notes || '—'],
                                ].map(([label, value]) => (
                                  <div key={String(label)}>
                                    <p className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wide mb-0.5">{label}</p>
                                    {typeof value === 'string'
                                      ? <p className={`text-xs text-[#0A0A0A] ${label === t('common:labels.code') ? 'font-mono font-semibold' : ''}`}>{value}</p>
                                      : value}
                                  </div>
                                ))}
                              </div>
                            </div>
                            {/* Full history inline */}
                            <div>
                              <p className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-2">
                                {t('admin:toolView.fullHistory')} ({t('admin:toolView.entries', { count: tool.history.length })})
                              </p>
                              <div className="bg-white rounded-xl border border-[#D4D4D8] px-4 py-2 space-y-0">
                                {tool.history.map((h, idx) => (
                                  <div key={h.id} className={`flex items-start gap-2 py-2 flex-wrap ${idx < tool.history.length - 1 ? 'border-b border-[#D4D4D8]/40' : ''}`}>
                                    <HistActionBadge action={h.action} />
                                    <span className="text-[11px] text-[#71717A] flex-shrink-0">{fmtDate(h.date, i18n.language)} {h.time}</span>
                                    {h.worker && <span className="text-[11px] text-[#0A0A0A] font-medium flex-shrink-0">· {h.worker}</span>}
                                    {h.project && <span className="text-[11px] text-[#71717A] flex-shrink-0">→ {h.project}</span>}
                                    {h.notes && <span className="text-[11px] text-[#71717A] italic min-w-0">— {h.notes}</span>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    );

                    return [mainRow, expandedRow];
                  })}
                </TableBody>
              </Table>
              {filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center py-14 text-center">
                  <Wrench className="w-8 h-8 text-[#D4D4D8] mb-2" />
                  <p className="text-sm font-semibold text-[#0A0A0A] mb-1">{t('admin:toolView.noMatch')}</p>
                  <p className="text-xs text-[#71717A]">{t('admin:toolView.noMatchHint')}</p>
                </div>
              )}
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-[#D4D4D8]">
              {pageRows.map(tool => {
                const isExp = expandedId === tool.id;
                return (
                  <div key={tool.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs font-bold text-[#0A0A0A]">{tool.code}</span>
                          <StatusBadge status={tool.status} />
                        </div>
                        <p className="text-sm font-medium text-[#0A0A0A]">{tool.name}</p>
                        <p className="text-xs text-[#71717A] mt-0.5">{t(`admin:${CATEGORY_KEY_MAP[tool.category] ?? tool.category}`)} · {tool.assignedTo ?? t('admin:toolView.unassigned')}</p>
                      </div>
                      <button onClick={() => setExpandedId(isExp ? null : tool.id)} className="p-1 text-[#71717A] flex-shrink-0">
                        {isExp ? <ChevronDown className="w-4 h-4" style={{ color: ADMIN_COLOR }} /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    </div>
                    {isExp && (
                      <div className="pt-2 space-y-1.5 border-t border-[#D4D4D8]/50">
                        {tool.history.map(h => (
                          <div key={h.id} className="flex items-center gap-1.5 text-[11px] flex-wrap">
                            <HistActionBadge action={h.action} />
                            <span className="text-[#71717A]">{fmtDateShort(h.date, i18n.language)} {h.time}</span>
                            {h.worker && <span className="text-[#0A0A0A] font-medium">· {h.worker}</span>}
                            {h.notes && <span className="text-[#71717A] italic">— {h.notes}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <Pagination current={currentPage} total={totalPages} onPage={p => { setCurrentPage(p); setExpandedId(null); }} />
          </>
        )}
      </div>
      </>
      )}

      {activeTab === 'consumable' && (
      <>
      {/* Consumable KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={Package}       title={t('admin:consumableView.kpi.total')}      value={consumableLoading ? '--' : consumables.length.toString()}  subtitle={t('admin:consumableView.kpi.items')}       iconBgColor="bg-[#C2410C]/10" iconColor="text-[#C2410C]"   />
        <StatCard icon={CheckCircle}   title={t('admin:consumableView.kpi.inStock')}    value={consumableLoading ? '--' : cInStock.toString()}            subtitle={`${cTotalUnits} ${t('admin:consumableView.kpi.units')}`} iconBgColor="bg-emerald-50" iconColor="text-emerald-600" />
        <StatCard icon={AlertTriangle} title={t('admin:consumableView.kpi.lowStock')}   value={consumableLoading ? '--' : cLowStock.toString()}           subtitle={t('admin:consumableView.kpi.belowMin')}   iconBgColor="bg-amber-50"     iconColor="text-amber-600"   />
        <StatCard icon={XCircle}       title={t('admin:consumableView.kpi.outOfStock')} value={consumableLoading ? '--' : cOutOfStock.toString()}         subtitle={t('admin:consumableView.kpi.needRestock')} iconBgColor="bg-red-50"       iconColor="text-red-600"     />
      </div>

      {/* Consumable Filters */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5 flex-1 min-w-[160px]">
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('common:labels.search')}</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#71717A]" />
              <Input value={cSearch} onChange={e => { setCSearch(e.target.value); setCPage(1); }}
                maxLength={FIELD_LIMITS.SEARCH}
                placeholder={t('admin:consumableView.searchPlaceholder')} className="pl-8 h-9 border-[#D4D4D8] text-sm" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5 min-w-[140px]">
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('common:labels.category')}</label>
            <Select value={cCategoryFilter} onValueChange={v => { setCCategoryFilter(v); setCPage(1); }}>
              <SelectTrigger className="h-9 border-[#D4D4D8] text-sm"><SelectValue placeholder={t('common:labels.allCategories')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common:labels.allCategories')}</SelectItem>
                {cCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5 min-w-[130px]">
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('common:labels.status')}</label>
            <Select value={cStatusFilter} onValueChange={v => { setCStatusFilter(v); setCPage(1); }}>
              <SelectTrigger className="h-9 border-[#D4D4D8] text-sm"><SelectValue placeholder={t('common:labels.all')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common:labels.all')}</SelectItem>
                <SelectItem value="In Stock">{t('admin:consumableView.status.inStock')}</SelectItem>
                <SelectItem value="Low Stock">{t('admin:consumableView.status.lowStock')}</SelectItem>
                <SelectItem value="Out of Stock">{t('admin:consumableView.status.outOfStock')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={handleCReset} className="h-9 px-4 text-xs border-[#D4D4D8] text-[#71717A]">{t('common:buttons.reset')}</Button>
        </div>
      </div>

      {/* Consumable Table */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-[#D4D4D8]">
          <Boxes className="w-4 h-4 text-[#71717A]" />
          <span className="text-sm font-semibold text-[#0A0A0A]">{t('admin:consumableView.tableTitle')}</span>
          <span className="text-xs text-[#71717A] ml-1">- {cFiltered.length} / {consumables.length}</span>
        </div>

        {consumableLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-[#71717A]" />
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#FAFAFA] hover:bg-[#FAFAFA]">
                    {[t('common:labels.code'), t('admin:consumableView.table.name'), t('common:labels.category'), t('admin:consumableView.table.unit'), t('admin:consumableView.table.stock'), t('common:labels.status'), t('admin:consumableView.table.lastRestocked')].map(h => (
                      <TableHead key={h} className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider whitespace-nowrap">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cPageRows.map(item => (
                    <TableRow key={item.id} className="border-b border-[#D4D4D8]/50 hover:bg-[#FAFAFA]/50">
                      <TableCell className="py-3 font-mono text-sm font-semibold text-[#0A0A0A]">{item.code}</TableCell>
                      <TableCell className="py-3">
                        <p className="text-sm font-medium text-[#0A0A0A]">{item.name}</p>
                        {item.notes && <p className="text-[11px] text-[#71717A] mt-0.5">{item.notes}</p>}
                      </TableCell>
                      <TableCell className="py-3 text-sm text-[#71717A]">{item.category}</TableCell>
                      <TableCell className="py-3 text-sm text-[#71717A]">{item.unit}</TableCell>
                      <TableCell className="py-3"><StockBar current={item.currentStock} minimum={item.minimumStock} /></TableCell>
                      <TableCell className="py-3"><StockStatusBadge status={getStockStatus(item)} /></TableCell>
                      <TableCell className="py-3 text-sm text-[#71717A] whitespace-nowrap">
                        {item.lastRestocked ? fmtDate(item.lastRestocked, i18n.language) : '--'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {cFiltered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-14 text-center text-sm text-[#71717A]">
                        {t('admin:consumableView.noMatch')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-[#D4D4D8]">
              {cPageRows.map(item => (
                <div key={item.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs font-bold text-[#0A0A0A]">{item.code}</span>
                        <StockStatusBadge status={getStockStatus(item)} />
                      </div>
                      <p className="text-sm font-medium text-[#0A0A0A]">{item.name}</p>
                      <p className="text-xs text-[#71717A] mt-0.5">{item.category} - {item.unit}</p>
                    </div>
                  </div>
                  <StockBar current={item.currentStock} minimum={item.minimumStock} />
                </div>
              ))}
              {cFiltered.length === 0 && (
                <p className="py-10 text-center text-sm text-[#71717A]">{t('admin:consumableView.noMatch')}</p>
              )}
            </div>

            <Pagination current={cPage} total={cTotalPages} onPage={setCPage} />
          </>
        )}
      </div>
      </>
      )}
    </div>
  );
}
