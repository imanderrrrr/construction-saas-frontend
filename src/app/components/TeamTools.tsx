import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Wrench, Users, Clock, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { StatCard } from './StatCard';
import { Button } from './ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from './ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from './ui/table';
import { toast } from 'sonner';
import { getSupervisorTools, type AssignmentResponse } from '../services/warehouse';

// Helpers

function fmtDate(iso: string, lang: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getDaysOutColor(days: number) {
  if (days > 30) return 'text-red-600 font-semibold';
  if (days >= 7)  return 'text-amber-600 font-semibold';
  return 'text-emerald-600 font-semibold';
}

function Pagination({ current, total, onPage, t }: { current: number; total: number; onPage: (p: number) => void; t: (key: string) => string }) {
  if (total <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-1 py-4 border-t border-[#D4D4D8]">
      <button onClick={() => onPage(current - 1)} disabled={current === 1}
        className="h-8 px-3 rounded-lg text-xs font-medium text-[#71717A] hover:bg-[#F97316]/10 hover:text-[#F97316] disabled:opacity-30 disabled:cursor-not-allowed">{t('tools.prev')}</button>
      {Array.from({ length: total }, (_, i) => i + 1).map(p => (
        <button key={p} onClick={() => onPage(p)}
          className={`h-8 w-8 rounded-lg text-xs font-semibold transition-colors ${p === current ? 'bg-[#F97316] text-white' : 'text-[#71717A] hover:bg-[#F97316]/10 hover:text-[#F97316]'}`}>{p}</button>
      ))}
      <button onClick={() => onPage(current + 1)} disabled={current === total}
        className="h-8 px-3 rounded-lg text-xs font-medium text-[#71717A] hover:bg-[#F97316]/10 hover:text-[#F97316] disabled:opacity-30 disabled:cursor-not-allowed">{t('tools.next')}</button>
    </div>
  );
}

// Constants

const ITEMS_PER_PAGE = 5;

// Main component

export function TeamTools() {
  const { t, i18n } = useTranslation('supervisor');
  const [tools,       setTools]       = useState<AssignmentResponse[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [workerFilter,   setWorkerFilter]   = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [projectFilter,  setProjectFilter]  = useState('all');
  const [applied,        setApplied]        = useState({ worker: 'all', category: 'all', project: 'all' });
  const [currentPage,    setCurrentPage]    = useState(1);

  const loadTools = useCallback(() => {
    setLoading(true);
    getSupervisorTools()
      .then(setTools)
      .catch(() => toast.error(t('tools.loadError')))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => { loadTools(); }, [loadTools]);

  function handleApply() { setApplied({ worker: workerFilter, category: categoryFilter, project: projectFilter }); setCurrentPage(1); }
  function handleReset() {
    setWorkerFilter('all'); setCategoryFilter('all'); setProjectFilter('all');
    setApplied({ worker: 'all', category: 'all', project: 'all' }); setCurrentPage(1);
  }

  // Dynamic filter options derived from loaded data
  const workers    = useMemo(() => [...new Set(tools.map(t => t.worker))].sort(),   [tools]);
  const categories = useMemo(() => [...new Set(tools.map(t => t.category))].sort(), [tools]);
  const projects   = useMemo(() => [...new Set(tools.map(t => t.project))].sort(),  [tools]);

  const filtered = useMemo(() =>
    tools.filter(t => {
      if (applied.worker   !== 'all' && t.worker   !== applied.worker)   return false;
      if (applied.category !== 'all' && t.category !== applied.category) return false;
      if (applied.project  !== 'all' && t.project  !== applied.project)  return false;
      return true;
    }),
  [tools, applied]);

  const totalPages    = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const pageRows      = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const uniqueWorkers = useMemo(() => new Set(tools.map(t => t.worker)).size, [tools]);
  const avgDaysOut    = tools.length
    ? (tools.reduce((sum, t) => sum + t.daysOut, 0) / tools.length).toFixed(1)
    : '0';

  const tableHeaders = [
    t('tools.table.tool'),
    t('tools.table.category'),
    t('tools.table.worker'),
    t('tools.table.project'),
    t('tools.table.assignedDate'),
    t('tools.table.daysOut'),
  ];

  return (
    <div className="space-y-6 max-w-5xl">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-[#0A0A0A]">{t('tools.title')}</h2>
          <p className="text-[11px] text-[#71717A] mt-0.5">{t('tools.subtitle')}</p>
        </div>
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#F97316]/10 text-[#F97316] border border-[#F97316]/20">
          {t('tools.readOnly')}
        </span>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Wrench} title={t('tools.kpi.teamTools')}        value={loading ? '—' : tools.length.toString()}        subtitle={t('tools.kpi.currentlyOut')} iconBgColor="bg-[#F97316]/10" iconColor="text-[#F97316]"   />
        <StatCard icon={Users}  title={t('tools.kpi.membersWithTools')} value={loading ? '—' : uniqueWorkers.toString()}       subtitle={t('tools.kpi.workers')}      iconBgColor="bg-emerald-50"   iconColor="text-emerald-600" />
        <StatCard icon={Clock}  title={t('tools.kpi.avgDaysOut')}       value={loading ? '—' : t('tools.kpi.days', { count: avgDaysOut })} subtitle={t('tools.kpi.perTool')}     iconBgColor="bg-amber-50"     iconColor="text-amber-600"   />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] p-3 sm:p-4">
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5 sm:min-w-[155px]">
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('tools.filters.worker')}</label>
            <Select value={workerFilter} onValueChange={setWorkerFilter}>
              <SelectTrigger className="h-9 border-[#D4D4D8] text-sm"><SelectValue placeholder={t('tools.filters.allWorkers')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('tools.filters.allWorkers')}</SelectItem>
                {workers.map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5 sm:min-w-[155px]">
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('tools.filters.category')}</label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-9 border-[#D4D4D8] text-sm"><SelectValue placeholder={t('tools.filters.allCategories')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('tools.filters.allCategories')}</SelectItem>
                {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5 col-span-2 sm:min-w-[155px]">
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('tools.filters.project')}</label>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="h-9 border-[#D4D4D8] text-sm"><SelectValue placeholder={t('tools.filters.allProjects')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('tools.filters.allProjects')}</SelectItem>
                {projects.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 col-span-2 sm:col-span-1 mt-auto">
            <Button variant="outline" onClick={handleReset} className="h-9 px-4 text-xs border-[#D4D4D8] text-[#71717A] flex-1 sm:flex-initial">{t('tools.filters.reset')}</Button>
            <Button onClick={handleApply} className="h-9 px-4 text-xs bg-[#F97316] hover:bg-[#C2410C] text-white flex-1 sm:flex-initial">{t('tools.filters.apply')}</Button>
          </div>
          <p className="text-[11px] text-[#71717A] mt-auto col-span-2 sm:col-span-1 sm:ml-auto">
            {t('tools.filters.showing', { filtered: filtered.length, total: tools.length })}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
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
                    {tableHeaders.map(h => (
                      <TableHead key={h} className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider whitespace-nowrap">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.map(tool => (
                    <TableRow key={tool.id} className="border-b border-[#D4D4D8]/50 hover:bg-[#FAFAFA]/50">
                      <TableCell className="py-3">
                        <p className="text-sm font-semibold text-[#0A0A0A]">{tool.toolName}</p>
                        <p className="text-[11px] font-mono text-[#71717A]">{tool.toolCode}</p>
                      </TableCell>
                      <TableCell className="py-3 text-sm text-[#71717A]">{tool.category}</TableCell>
                      <TableCell className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-[#F97316]/10 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-[8px] font-bold text-[#F97316]">{tool.worker.split(' ').map(w => w[0]).join('')}</span>
                          </div>
                          <span className="text-sm font-medium text-[#0A0A0A]">{tool.worker}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-3 text-sm text-[#71717A]">{tool.project}</TableCell>
                      <TableCell className="py-3 text-sm text-[#71717A] whitespace-nowrap">{fmtDate(tool.assignedDate, i18n.language)}</TableCell>
                      <TableCell className="py-3">
                        <span className={`text-sm ${getDaysOutColor(tool.daysOut)}`}>
                          {t('tools.day', { count: tool.daysOut })}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-14 text-center text-sm text-[#71717A]">
                        {t('tools.noMatch')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-[#D4D4D8]">
              {pageRows.map(tool => (
                <div key={tool.id} className="p-4 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-[#0A0A0A]">{tool.toolName}</p>
                      <p className="text-[11px] font-mono text-[#71717A]">{tool.toolCode} · {tool.category}</p>
                    </div>
                    <span className={`text-xs flex-shrink-0 ${getDaysOutColor(tool.daysOut)}`}>
                      {t('tools.day', { count: tool.daysOut })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-5 h-5 bg-[#F97316]/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-[8px] font-bold text-[#F97316]">{tool.worker.split(' ').map(w => w[0]).join('')}</span>
                    </div>
                    <span className="font-medium text-[#0A0A0A]">{tool.worker}</span>
                    <span className="text-[#71717A]">→ {tool.project}</span>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <p className="py-10 text-center text-sm text-[#71717A]">{t('tools.noMatch')}</p>
              )}
            </div>

            <Pagination current={currentPage} total={totalPages} onPage={setCurrentPage} t={t} />
          </>
        )}
      </div>

      {/* Informative note */}
      <div className="flex items-start gap-3 rounded-xl p-4 border"
        style={{ backgroundColor: '#F97316' + '0D', borderColor: '#F97316' + '33' }}>
        <Wrench className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#F97316' }} />
        <p className="text-xs" style={{ color: '#C2410C' }}>
          {t('tools.note')}{' '}
          <span className="font-semibold">{t('tools.noteWarehouse')}</span>.
        </p>
      </div>
    </div>
  );
}
