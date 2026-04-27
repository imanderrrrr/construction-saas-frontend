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
import { getGlobalToolHistory, listTools } from '../services/warehouse';

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
  return colors[action] ?? 'bg-[#71717A]';
}

function getLineColor(action: HistoryAction): string {
  const colors: Record<HistoryAction, string> = {
    'Registered':     'bg-emerald-200',
    'Assigned':       'bg-[#F97316]/30',
    'Returned':       'bg-amber-200',
    'Status Changed': 'bg-slate-200',
    'Reported':       'bg-red-200',
  };
  return colors[action] ?? 'bg-[#D4D4D8]';
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
    'Status Changed': 'bg-slate-50 text-slate-600 border-slate-200',
    'Reported':       'bg-red-50 text-red-600 border-red-200',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap ${cfg[action]}`}>
      {t(ACTION_KEYS[action])}
    </span>
  );
}

function Pagination({ current, total, onPage }: { current: number; total: number; onPage: (p: number) => void }) {
  const { t } = useTranslation('common');
  if (total <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-1 py-6">
      <button onClick={() => onPage(current - 1)} disabled={current === 1}
        className="h-8 px-3 rounded-lg text-xs font-medium text-[#71717A] hover:text-amber-700 hover:bg-amber-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">{t('buttons.prev')}</button>
      {Array.from({ length: total }, (_, i) => i + 1).map(p => (
        <button key={p} onClick={() => onPage(p)}
          className={`h-8 w-8 rounded-lg text-xs font-semibold transition-colors ${p === current ? 'bg-amber-500 text-white' : 'text-[#71717A] hover:bg-amber-50 hover:text-amber-700'}`}>{p}</button>
      ))}
      <button onClick={() => onPage(current + 1)} disabled={current === total}
        className="h-8 px-3 rounded-lg text-xs font-medium text-[#71717A] hover:text-amber-700 hover:bg-amber-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">{t('buttons.next')}</button>
    </div>
  );
}

// Main component

export function ToolHistory() {
  const { t } = useTranslation('inventory');
  // Filter state
  const [toolFilter,   setToolFilter]   = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [workerFilter, setWorkerFilter] = useState('all');
  const [fromDate,     setFromDate]     = useState('');
  const [toDate,       setToDate]       = useState('');
  const [appliedTool,   setAppliedTool]   = useState('all');
  const [appliedAction, setAppliedAction] = useState('all');
  const [appliedWorker, setAppliedWorker] = useState('all');
  const [appliedFrom,   setAppliedFrom]   = useState('');
  const [appliedTo,     setAppliedTo]     = useState('');
  const [currentPage,  setCurrentPage]  = useState(1);

  // Data state
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(true);
  const [toolOptions, setToolOptions] = useState<{code:string;name:string}[]>([]);
  const [workers, setWorkers] = useState<string[]>([]);

  // Load tool options and workers on mount
  useEffect(() => {
    listTools({ size: 200 }).then(res => {
      setToolOptions(res.content.map((t: any) => ({ code: t.code, name: t.name })));
      const uniqueWorkers = [...new Set(res.content.filter((t: any) => t.assignedTo).map((t: any) => t.assignedTo!))];
      setWorkers(uniqueWorkers as string[]);
    }).catch(err => toast.error(err?.message));
  }, []);

  // Fetch history when applied filters or page change
  useEffect(() => {
    setLoading(true);
    const params: any = { page: currentPage - 1, size: ITEMS_PER_PAGE };
    if (appliedTool !== 'all') params.toolCode = appliedTool;
    if (appliedAction !== 'all') params.action = appliedAction;
    if (appliedWorker !== 'all') params.worker = appliedWorker;
    if (appliedFrom) params.dateFrom = appliedFrom;
    if (appliedTo) params.dateTo = appliedTo;
    getGlobalToolHistory(params)
      .then(res => {
        setEntries(res.content.map(e => ({
          id: String(e.id), date: e.date, time: e.time,
          action: (e.action ?? 'Registered') as HistoryAction,
          toolCode: e.toolCode ?? '', toolName: e.toolName ?? '',
          worker: e.worker ?? '', project: e.project ?? '',
          notes: e.notes ?? '',
        })));
        setTotalElements(res.totalElements);
      })
      .catch(err => toast.error(err?.message))
      .finally(() => setLoading(false));
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
      <div>
        <h2 className="text-sm font-semibold text-[#0A0A0A]">{t('tools.history.title')}</h2>
        <p className="text-[11px] text-[#71717A] mt-0.5">{t('tools.history.fullSubtitle')}</p>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] p-5">
        <div className="flex items-center gap-2 mb-4">
          <FilterIcon className="w-4 h-4 text-[#71717A]" />
          <span className="text-sm font-semibold text-[#0A0A0A]">{t('tools.history.filters')}</span>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {/* Tool */}
          <div className="flex flex-col gap-1.5 min-w-[180px]">
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('assignment.table.tool')}</label>
            <Select value={toolFilter} onValueChange={setToolFilter}>
              <SelectTrigger className="h-9 border-[#D4D4D8] text-sm"><SelectValue placeholder={t('tools.history.allTools')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('tools.history.allTools')}</SelectItem>
                {toolOptions.map(t => (
                  <SelectItem key={t.code} value={t.code}>
                    <span className="font-mono text-xs mr-1 text-[#71717A]">{t.code}</span>{t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Action */}
          <div className="flex flex-col gap-1.5 min-w-[155px]">
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('tools.history.action')}</label>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="h-9 border-[#D4D4D8] text-sm"><SelectValue placeholder={t('tools.history.allActions')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('tools.history.allActions')}</SelectItem>
                {ACTIONS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {/* Worker */}
          <div className="flex flex-col gap-1.5 min-w-[155px]">
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('tools.history.worker')}</label>
            <Select value={workerFilter} onValueChange={setWorkerFilter}>
              <SelectTrigger className="h-9 border-[#D4D4D8] text-sm"><SelectValue placeholder={t('tools.history.allWorkers')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('tools.history.allWorkers')}</SelectItem>
                {workers.map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {/* Date range */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('labels.from', { ns: 'common' })}</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
              className="h-9 rounded-md border border-[#D4D4D8] bg-white px-3 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('labels.to', { ns: 'common' })}</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
              className="h-9 rounded-md border border-[#D4D4D8] bg-white px-3 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <div className="flex items-center gap-2 mt-auto">
            <Button variant="outline" size="sm" onClick={handleReset}
              className="h-9 px-4 text-xs border-[#D4D4D8] text-[#71717A] hover:text-[#0A0A0A]">{t('buttons.reset', { ns: 'common' })}</Button>
            <Button size="sm" onClick={handleApply}
              className="h-9 px-4 text-xs bg-amber-500 hover:bg-amber-600 text-white">{t('buttons.apply', { ns: 'common' })}</Button>
          </div>
        </div>
        <p className="text-[11px] text-[#71717A] mt-3 pt-3 border-t border-[#FAFAFA]">
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
          <div className="bg-white rounded-xl border border-[#D4D4D8] flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 bg-[#FAFAFA] rounded-full flex items-center justify-center mb-3">
              <History className="w-7 h-7 text-[#D4D4D8]" />
            </div>
            <p className="text-sm font-semibold text-[#0A0A0A] mb-1">{t('tools.history.noEntries')}</p>
            <p className="text-xs text-[#71717A]">{t('tools.history.noEntriesHint')}</p>
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
                <div className="bg-white rounded-xl border border-[#D4D4D8] p-4 hover:border-amber-200 hover:shadow-sm transition-all">

                  {/* Top row: badge + tool + time */}
                  <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <ActionBadge action={entry.action} />
                      <span className="font-mono text-xs font-bold text-[#0A0A0A]">{entry.toolCode}</span>
                      <span className="text-xs text-[#71717A]">—</span>
                      <span className="text-xs font-medium text-[#0A0A0A]">{entry.toolName}</span>
                    </div>
                    <span className="text-[11px] text-[#71717A] flex-shrink-0 whitespace-nowrap">
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
                          <span className="text-[#D4D4D8]">→</span>
                          <span className="text-[#71717A]">{entry.project}</span>
                        </>
                      )}
                    </div>
                  )}

                  {/* Notes */}
                  {entry.notes && (
                    <p className="text-xs text-[#71717A] italic">"{entry.notes}"</p>
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
