import { useScreenState } from '../workspace/WorkspaceState';
import { SectionHeader } from './workspace/SectionChrome';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  History, Filter as FilterIcon, Loader2,
} from 'lucide-react';
import { Button } from './ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from './ui/select';
import { getGlobalToolHistory } from '../services/warehouse';
import { toolCatalog, userCatalog } from '../services/catalogs';
import type { Catalog } from '../lib/catalog';
import { CatalogNote } from './workspace/CatalogNote';

// Types

type HistoryAction = 'Registered' | 'Assigned' | 'Returned' | 'Status Changed' | 'Reported';

interface HistoryEntry {
  id: string;
  date: string;
  time: string;
  action: HistoryAction;
  toolCode: string;
  toolName: string;
  worker: string;
  project: string;
  notes: string;
}

const ACTIONS: HistoryAction[] = ['Registered', 'Assigned', 'Returned', 'Status Changed', 'Reported'];
const ITEMS_PER_PAGE = 10;

// Helpers

function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getDotColor(action: HistoryAction): string {
  const colors: Record<HistoryAction, string> = {
    'Registered':     'bg-emerald-500',
    'Assigned':       'bg-[#F97316]',
    'Returned':       'bg-amber-500',
    'Status Changed': 'bg-slate-400',
    'Reported':       'bg-red-500',
  };
  return colors[action] ?? 'bg-[#8A8175]';
}

function getLineColor(action: HistoryAction): string {
  const colors: Record<HistoryAction, string> = {
    'Registered':     'bg-emerald-200',
    'Assigned':       'bg-[#F97316]/30',
    'Returned':       'bg-amber-200',
    'Status Changed': 'bg-[#DBD0BB]',
    'Reported':       'bg-red-200',
  };
  return colors[action] ?? 'bg-[#DBD0BB]';
}

// Sub-components

const ACTION_KEYS: Record<HistoryAction, string> = {
  'Registered': 'tools.history.actions.registered',
  'Assigned': 'tools.history.actions.assigned',
  'Returned': 'tools.history.actions.returned',
  'Status Changed': 'tools.history.actions.statusChanged',
  'Reported': 'tools.history.actions.reported',
};

function ActionBadge({ action }: { action: HistoryAction }) {
  const { t } = useTranslation('inventory');
  const cfg: Record<HistoryAction, string> = {
    'Registered':     'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Assigned':       'bg-[#F97316]/10 text-[#F97316] border-[#F97316]/20',
    'Returned':       'bg-amber-50 text-amber-700 border-amber-200',
    'Status Changed': 'bg-slate-50 text-[#5A5346] border-slate-200',
    'Reported':       'bg-red-50 text-red-600 border-red-200',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-bt-mono text-[11px] font-semibold border whitespace-nowrap ${cfg[action] ?? 'bg-[#FAF7F0] text-[#8A8175] border-[#DBD0BB]'}`}>
      {/* The row's action is cast from the server string (see the mapper): an
          unmapped one would hand `t` an undefined key and leave the badge blank. */}
      {ACTION_KEYS[action] ? t(ACTION_KEYS[action]) : action}
    </span>
  );
}

function Pagination({ current, total, onPage }: { current: number; total: number; onPage: (p: number) => void }) {
  const { t } = useTranslation('common');
  if (total <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-1 py-6">
      <button onClick={() => onPage(current - 1)} disabled={current === 1}
        className="h-8 px-3 font-bt-mono text-xs font-medium text-[#8A8175] hover:text-amber-700 hover:bg-amber-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">{t('buttons.prev')}</button>
      {Array.from({ length: total }, (_, i) => i + 1).map(p => (
        <button key={p} onClick={() => onPage(p)}
          className={`h-8 w-8 text-xs font-semibold transition-colors ${p === current ? 'bg-amber-500 text-white' : 'text-[#8A8175] hover:bg-amber-50 hover:text-amber-700'}`}>{p}</button>
      ))}
      <button onClick={() => onPage(current + 1)} disabled={current === total}
        className="h-8 px-3 font-bt-mono text-xs font-medium text-[#8A8175] hover:text-amber-700 hover:bg-amber-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">{t('buttons.next')}</button>
    </div>
  );
}

const NO_OPTIONS = { items: [], total: 0, truncated: false };

// Main component

export function ToolHistory() {
  const { t } = useTranslation('inventory');
  // Filter state
  const [toolFilter,   setToolFilter]   = useScreenState('herramienta', 'all');
  const [actionFilter, setActionFilter] = useScreenState('accion', 'all');
  const [workerFilter, setWorkerFilter] = useScreenState('persona', 'all');
  const [fromDate,     setFromDate]     = useScreenState('desde', '');
  const [toDate,       setToDate]       = useScreenState('hasta', '');
  const [appliedTool,   setAppliedTool]   = useScreenState('f-herramienta', 'all');
  const [appliedAction, setAppliedAction] = useScreenState('f-accion', 'all');
  const [appliedWorker, setAppliedWorker] = useScreenState('f-persona', 'all');
  const [appliedFrom,   setAppliedFrom]   = useScreenState('f-desde', '');
  const [appliedTo,     setAppliedTo]     = useScreenState('f-hasta', '');
  const [currentPage,  setCurrentPage]  = useScreenState('pagina', 1);

  // Data state
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(true);
  const [toolOptions, setToolOptions] = useState<Catalog<{ code: string; name: string }>>(NO_OPTIONS);
  const [workers, setWorkers] = useState<Catalog<{ username: string; label: string }>>(NO_OPTIONS);

  // The filter options are whole catalogs (AUD-055). They used to be the first
  // 100 tools, and the "Person" list was whoever HOLDS one of those 100 today —
  // so the history of someone who had returned everything (someone who left)
  // could not be filtered, and the value sent was the display name while the
  // server matches the username, which made the filter silently match nobody
  // and return everything. Every tool, whatever its state now, and every
  // worker, active or not: both still have a history. The value is the username.
  useEffect(() => {
    let cancelled = false;
    toolCatalog()
      .then(c => { if (!cancelled) setToolOptions({ ...c, items: c.items.map(tool => ({ code: tool.code, name: tool.name })) }); })
      .catch(err => toast.error(err?.message));
    userCatalog({ role: 'WORKER' })
      .then(c => { if (!cancelled) setWorkers({ ...c, items: c.items.map(u => ({ username: u.username, label: u.fullName ?? u.username })) }); })
      .catch(err => toast.error(err?.message));
    return () => { cancelled = true; };
  }, []);

  // Fetch history when applied filters or page change; a late answer for
  // filters or a page already left is dropped.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params: any = { page: currentPage - 1, size: ITEMS_PER_PAGE };
    if (appliedTool !== 'all') params.toolCode = appliedTool;
    if (appliedAction !== 'all') params.action = appliedAction;
    if (appliedWorker !== 'all') params.worker = appliedWorker;
    if (appliedFrom) params.dateFrom = appliedFrom;
    if (appliedTo) params.dateTo = appliedTo;
    getGlobalToolHistory(params)
      .then(res => {
        if (cancelled) return;
        setEntries(res.content.map(e => ({
          id: String(e.id), date: e.date, time: e.time,
          action: (e.action ?? 'Registered') as HistoryAction,
          toolCode: e.toolCode ?? '', toolName: e.toolName ?? '',
          worker: e.worker ?? '', project: e.project ?? '',
          notes: e.notes ?? '',
        })));
        setTotalElements(res.totalElements);
      })
      .catch(err => { if (!cancelled) toast.error(err?.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [appliedTool, appliedAction, appliedWorker, appliedFrom, appliedTo, currentPage]);

  function handleApply() {
    setAppliedTool(toolFilter); setAppliedAction(actionFilter);
    setAppliedWorker(workerFilter); setAppliedFrom(fromDate); setAppliedTo(toDate);
    setCurrentPage(1);
  }

  function handleReset() {
    setToolFilter('all'); setActionFilter('all'); setWorkerFilter('all');
    setFromDate(''); setToDate('');
    setAppliedTool('all'); setAppliedAction('all'); setAppliedWorker('all');
    setAppliedFrom(''); setAppliedTo('');
    setCurrentPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(totalElements / ITEMS_PER_PAGE));

  // Render
  return (
    <div className="space-y-6 max-w-4xl">

      {/* Header */}
      <SectionHeader kicker={t('warehouse.panelLabel')} title={t('tools.history.title')} description={t('tools.history.fullSubtitle')} />

      {/* Filter bar */}
      <div className="bg-white border border-[#DBD0BB] p-5">
        <div className="flex items-center gap-2 mb-4">
          <FilterIcon className="w-4 h-4 text-[#8A8175]" />
          <span className="text-sm font-semibold text-[#0A0A0A]">{t('tools.history.filters')}</span>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {/* Tool */}
          <div className="flex flex-col gap-1.5 min-w-[180px]">
            <label className="font-bt-mono text-[11px] font-semibold text-[#8A8175] uppercase tracking-wide">{t('assignment.table.tool')}</label>
            <Select value={toolFilter} onValueChange={setToolFilter}>
              <SelectTrigger className="rounded-none h-9 border-[#DBD0BB] text-sm"><SelectValue placeholder={t('tools.history.allTools')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('tools.history.allTools')}</SelectItem>
                {toolOptions.items.map(t => (
                  <SelectItem key={t.code} value={t.code}>
                    <span className="font-bt-mono text-xs mr-1 text-[#8A8175]">{t.code}</span>{t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <CatalogNote shown={toolOptions.items.length} total={toolOptions.total} truncated={toolOptions.truncated} />
          </div>
          {/* Action */}
          <div className="flex flex-col gap-1.5 min-w-[155px]">
            <label className="font-bt-mono text-[11px] font-semibold text-[#8A8175] uppercase tracking-wide">{t('tools.history.action')}</label>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="rounded-none h-9 border-[#DBD0BB] text-sm"><SelectValue placeholder={t('tools.history.allActions')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('tools.history.allActions')}</SelectItem>
                {ACTIONS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {/* Worker */}
          <div className="flex flex-col gap-1.5 min-w-[155px]">
            <label className="font-bt-mono text-[11px] font-semibold text-[#8A8175] uppercase tracking-wide">{t('tools.history.worker')}</label>
            <Select value={workerFilter} onValueChange={setWorkerFilter}>
              <SelectTrigger className="rounded-none h-9 border-[#DBD0BB] text-sm"><SelectValue placeholder={t('tools.history.allWorkers')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('tools.history.allWorkers')}</SelectItem>
                {workers.items.map(w => <SelectItem key={w.username} value={w.username}>{w.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <CatalogNote shown={workers.items.length} total={workers.total} truncated={workers.truncated} />
          </div>
          {/* Date range */}
          <div className="flex flex-col gap-1.5">
            <label className="font-bt-mono text-[11px] font-semibold text-[#8A8175] uppercase tracking-wide">{t('labels.from', { ns: 'common' })}</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
              className="h-9 rounded-md border border-[#DBD0BB] bg-white px-3 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-bt-mono text-[11px] font-semibold text-[#8A8175] uppercase tracking-wide">{t('labels.to', { ns: 'common' })}</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
              className="h-9 rounded-md border border-[#DBD0BB] bg-white px-3 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <div className="flex items-center gap-2 mt-auto">
            <Button variant="outline" size="sm" onClick={handleReset}
              className="rounded-none h-9 px-4 text-xs border-[#DBD0BB] text-[#8A8175] hover:text-[#0A0A0A]">{t('buttons.reset', { ns: 'common' })}</Button>
            <Button size="sm" onClick={handleApply}
              className="rounded-none h-9 px-4 text-xs bg-[#0A0A0A] hover:bg-[#F97316] text-[#F5F1E8] hover:text-[#0A0A0A]">{t('buttons.apply', { ns: 'common' })}</Button>
          </div>
        </div>
        <p className="text-[11px] text-[#8A8175] mt-3 pt-3 border-t border-[#FAF7F0]">
          {t('labels.showing', { ns: 'common' })} <span className="font-medium text-[#0A0A0A]">{entries.length}</span> {t('labels.of', { ns: 'common', defaultValue: 'of' })} {totalElements} {t('tools.history.entries', { defaultValue: 'entries' })}
        </p>
      </div>

      {/* Timeline */}
      <div className="space-y-0">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
          </div>
        )}
        {!loading && entries.length === 0 && (
          <div className="bg-white border border-[#DBD0BB] flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 bg-[#FAF7F0] rounded-full flex items-center justify-center mb-3">
              <History className="w-7 h-7 text-[#DBD0BB]" />
            </div>
            <p className="text-sm font-semibold text-[#0A0A0A] mb-1">{t('tools.history.noEntries')}</p>
            <p className="text-xs text-[#8A8175]">{t('tools.history.noEntriesHint')}</p>
          </div>
        )}

        {!loading && entries.map((entry, index) => {
          const isLast = index === entries.length - 1;
          return (
            <div key={entry.id} className="flex gap-4">
              {/* Timeline left: dot + connector */}
              <div className="flex flex-col items-center flex-shrink-0" style={{ width: 16 }}>
                <div className={`w-3 h-3 rounded-full flex-shrink-0 mt-2 border-2 border-white shadow-sm ${getDotColor(entry.action)}`} />
                {!isLast && (
                  <div className={`w-0.5 flex-1 min-h-[20px] mt-1 ${getLineColor(entry.action)}`} />
                )}
              </div>

              {/* Content card */}
              <div className="flex-1 pb-3">
                <div className="bg-white border border-[#DBD0BB] p-4 hover:border-amber-200 hover:shadow-sm transition-all">

                  {/* Top row: badge + tool + time */}
                  <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <ActionBadge action={entry.action} />
                      <span className="font-bt-mono text-xs font-bold text-[#0A0A0A]">{entry.toolCode}</span>
                      <span className="text-xs text-[#8A8175]">—</span>
                      <span className="font-bt-mono text-xs font-medium text-[#0A0A0A]">{entry.toolName}</span>
                    </div>
                    <span className="text-[11px] text-[#8A8175] flex-shrink-0 whitespace-nowrap">
                      {fmtDate(entry.date)} · {entry.time}
                    </span>
                  </div>

                  {/* Worker + Project */}
                  {entry.worker && (
                    <div className="flex items-center gap-2 text-xs mb-1.5 flex-wrap">
                      <div className="w-5 h-5 bg-[#F97316]/10 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-[8px] font-bold text-[#F97316]">
                          {entry.worker.split(' ').map(w => w[0]).join('')}
                        </span>
                      </div>
                      <span className="font-medium text-[#0A0A0A]">{entry.worker}</span>
                      {entry.project && (
                        <>
                          <span className="text-[#DBD0BB]">→</span>
                          <span className="text-[#8A8175]">{entry.project}</span>
                        </>
                      )}
                    </div>
                  )}

                  {/* Notes */}
                  {entry.notes && (
                    <p className="text-xs text-[#8A8175] italic">"{entry.notes}"</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Pagination current={currentPage} total={totalPages} onPage={p => { setCurrentPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
    </div>
  );
}
