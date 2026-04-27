import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Wrench, Package, CheckCircle, ArrowLeftRight, AlertTriangle, XCircle,
  Plus, Search, ChevronDown, ChevronRight, MoreHorizontal,
  Pencil, History, RefreshCw, ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { StatCard } from './StatCard';
import { Input } from './ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from './ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from './ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from './ui/dialog';
import {
  listTools, getToolSummary, createTool, updateTool, changeToolStatus,
} from '../services/warehouse';
import type { ToolResponse, ToolSummary, ToolHistoryEntry as ApiToolHistoryEntry } from '../services/warehouse';

// Types

type ToolStatus   = 'Available' | 'Assigned' | 'In Review' | 'Damaged' | 'Lost';
type HistoryAction = 'Registered' | 'Assigned' | 'Returned' | 'Status Changed' | 'Reported';

interface ToolHistoryEntry {
  id: string;
  date: string;
  time: string;
  action: HistoryAction;
  worker?: string;
  project?: string;
  notes: string;
}

interface Tool {
  id: string;
  code: string;
  name: string;
  category: string;
  status: ToolStatus;
  assignedTo?: string;
  lastActivity: string;
  dateRegistered: string;
  notes?: string;
  history: ToolHistoryEntry[];
}

// Constants

const CATEGORIES = ['Power Tools', 'Hand Tools', 'Measurement', 'Safety Equipment', 'Heavy Machinery'];
const ITEMS_PER_PAGE = 6;

// Helper to map API ToolResponse to local Tool interface

function mapToolResponse(t: ToolResponse): Tool {
  return {
    id: String(t.id), code: t.code, name: t.name, category: t.category,
    status: t.status as ToolStatus, assignedTo: t.assignedTo ?? undefined,
    lastActivity: t.lastActivity, dateRegistered: t.dateRegistered,
    notes: t.notes ?? undefined,
    history: (t.history ?? []).map(h => ({
      id: String(h.id), date: h.date, time: h.time,
      action: h.action as HistoryAction,
      worker: h.worker ?? undefined, project: h.project ?? undefined,
      notes: h.notes ?? '',
    })),
  };
}

// Helpers

function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateShort(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getValidTransitions(status: ToolStatus): ToolStatus[] {
  const map: Record<ToolStatus, ToolStatus[]> = {
    'Available':  ['In Review', 'Damaged', 'Lost'],
    'In Review':  ['Available', 'Damaged', 'Lost'],
    'Damaged':    ['In Review', 'Available', 'Lost'],
    'Assigned':   [],
    'Lost':       ['Available'],
  };
  return map[status] ?? [];
}

// Sub-components

function StatusBadge({ status }: { status: ToolStatus }) {
  const { t } = useTranslation('inventory');
  const statusKeyMap: Record<ToolStatus, string> = {
    'Available': 'tools.status.available',
    'Assigned': 'tools.status.assigned',
    'In Review': 'tools.status.inReview',
    'Damaged': 'tools.status.damaged',
    'Lost': 'tools.status.lost',
  };
  const cfg: Record<ToolStatus, string> = {
    'Available': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Assigned':  'bg-[#F97316]/10 text-[#F97316] border-[#F97316]/30',
    'In Review': 'bg-amber-50 text-amber-700 border-amber-200',
    'Damaged':   'bg-red-50 text-red-700 border-red-200',
    'Lost':      'bg-slate-50 text-slate-600 border-slate-200',
  };
  const dotCfg: Record<ToolStatus, string> = {
    'Available': 'bg-emerald-500', 'Assigned': 'bg-[#F97316]',
    'In Review': 'bg-amber-500',   'Damaged': 'bg-red-500', 'Lost': 'bg-slate-400',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap ${cfg[status]}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotCfg[status]}`} />
      {t(statusKeyMap[status])}
    </span>
  );
}

function HistActionBadge({ action }: { action: HistoryAction }) {
  const cfg: Record<HistoryAction, string> = {
    'Registered':     'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Assigned':       'bg-[#F97316]/10 text-[#F97316] border-[#F97316]/20',
    'Returned':       'bg-amber-50 text-amber-700 border-amber-200',
    'Status Changed': 'bg-slate-50 text-slate-600 border-slate-200',
    'Reported':       'bg-red-50 text-red-600 border-red-200',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap ${cfg[action]}`}>
      {action}
    </span>
  );
}

function Pagination({ current, total, onPage }: { current: number; total: number; onPage: (p: number) => void }) {
  const { t } = useTranslation('common');
  if (total <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-1 py-4 border-t border-[#D4D4D8]">
      <button onClick={() => onPage(current - 1)} disabled={current === 1}
        className="h-8 px-3 rounded-lg text-xs font-medium text-[#71717A] hover:text-amber-700 hover:bg-amber-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
        {t('buttons.prev')}
      </button>
      {Array.from({ length: total }, (_, i) => i + 1).map(p => (
        <button key={p} onClick={() => onPage(p)}
          className={`h-8 w-8 rounded-lg text-xs font-semibold transition-colors ${
            p === current ? 'bg-amber-500 text-white' : 'text-[#71717A] hover:bg-amber-50 hover:text-amber-700'
          }`}>{p}</button>
      ))}
      <button onClick={() => onPage(current + 1)} disabled={current === total}
        className="h-8 px-3 rounded-lg text-xs font-medium text-[#71717A] hover:text-amber-700 hover:bg-amber-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
        {t('buttons.next')}
      </button>
    </div>
  );
}

// Add Tool Modal

function AddToolModal({ open, onClose, onAdd }: {
  open: boolean; onClose: () => void;
  onAdd: (code: string, name: string, category: string, notes: string) => void;
}) {
  const { t } = useTranslation('inventory');
  const [code, setCode]         = useState('');
  const [name, setName]         = useState('');
  const [category, setCategory] = useState('');
  const [notes, setNotes]       = useState('');

  useEffect(() => {
    if (open) { setCode(''); setName(''); setCategory(''); setNotes(''); }
  }, [open]);

  const valid = code.trim().length > 0 && name.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{t('tools.newTool')}</DialogTitle></DialogHeader>
        {/* TODO: POST /api/v1/warehouse/tools */}
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#71717A] uppercase tracking-wide">{t('tools.table.code')} *</label>
              <Input value={code} onChange={e => setCode(e.target.value)} placeholder="TL-XXX"
                className="border-[#D4D4D8] text-sm font-mono" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#71717A] uppercase tracking-wide">{t('labels.category', { ns: 'common' })}</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="border-[#D4D4D8] text-sm"><SelectValue placeholder={t('labels.category', { ns: 'common' })} /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#71717A] uppercase tracking-wide">{t('tools.table.toolName')} *</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Bosch Laser Level 5"
              className="border-[#D4D4D8] text-sm" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#71717A] uppercase tracking-wide">{t('labels.notes', { ns: 'common' })}</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder={t('labels.notesOptional', { ns: 'common' })}
              className="w-full rounded-md border border-[#D4D4D8] bg-white px-3 py-2 text-sm text-[#0A0A0A] placeholder:text-[#71717A] focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none" />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="border-[#D4D4D8] text-[#71717A]">{t('buttons.cancel', { ns: 'common' })}</Button>
          <Button onClick={() => valid && onAdd(code.trim(), name.trim(), category || CATEGORIES[0], notes.trim())}
            disabled={!valid} className="bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50">
            {t('tools.newTool')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Edit Tool Modal

function EditToolModal({ open, tool, onClose, onSave }: {
  open: boolean; tool: Tool | null; onClose: () => void;
  onSave: (id: string, name: string, category: string, notes: string) => void;
}) {
  const { t } = useTranslation('inventory');
  const [name, setName]         = useState('');
  const [category, setCategory] = useState('');
  const [notes, setNotes]       = useState('');

  useEffect(() => {
    if (tool) { setName(tool.name); setCategory(tool.category); setNotes(tool.notes ?? ''); }
  }, [tool]);

  if (!tool) return null;
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{t('tools.editTool')} — {tool.code}</DialogTitle></DialogHeader>
        {/* TODO: PUT /api/v1/warehouse/tools/{id} */}
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#71717A] uppercase tracking-wide">{t('tools.table.code')}</label>
            <Input value={tool.code} disabled className="border-[#D4D4D8] text-sm font-mono bg-[#FAFAFA] text-[#71717A]" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#71717A] uppercase tracking-wide">{t('tools.table.toolName')} *</label>
            <Input value={name} onChange={e => setName(e.target.value)} className="border-[#D4D4D8] text-sm" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#71717A] uppercase tracking-wide">{t('labels.category', { ns: 'common' })}</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="border-[#D4D4D8] text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#71717A] uppercase tracking-wide">{t('labels.notes', { ns: 'common' })}</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              className="w-full rounded-md border border-[#D4D4D8] bg-white px-3 py-2 text-sm text-[#0A0A0A] placeholder:text-[#71717A] focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none" />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="border-[#D4D4D8] text-[#71717A]">{t('buttons.cancel', { ns: 'common' })}</Button>
          <Button onClick={() => name.trim() && onSave(tool.id, name.trim(), category, notes.trim())}
            disabled={!name.trim()} className="bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50">
            {t('buttons.save', { ns: 'common' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Change Status Modal

function ChangeStatusModal({ open, tool, onClose, onSave }: {
  open: boolean; tool: Tool | null; onClose: () => void;
  onSave: (id: string, newStatus: ToolStatus, reason: string) => void;
}) {
  const { t } = useTranslation('inventory');
  const [newStatus, setNewStatus] = useState<string>('');
  const [reason,    setReason]    = useState('');

  useEffect(() => { if (open) { setNewStatus(''); setReason(''); } }, [open]);

  if (!tool) return null;
  const transitions = getValidTransitions(tool.status);
  const valid = newStatus.length > 0 && reason.trim().length >= 10;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{t('tools.dialog.changeStatus')} — {tool.code} {tool.name}</DialogTitle></DialogHeader>
        {/* TODO: PUT /api/v1/warehouse/tools/{id}/status */}
        <div className="space-y-4 py-2">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold text-[#71717A] uppercase tracking-wide">{t('labels.status', { ns: 'common' })}:</p>
            <StatusBadge status={tool.status} />
          </div>
          {transitions.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
              This tool is currently <span className="font-semibold">{t('tools.status.assigned')}</span> and cannot be manually changed. Use the Return Tool function in Assignments.
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#71717A] uppercase tracking-wide">{t('tools.dialog.newStatus')} *</label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger className="border-[#D4D4D8] text-sm"><SelectValue placeholder={t('tools.dialog.newStatus')} /></SelectTrigger>
                  <SelectContent>{transitions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#71717A] uppercase tracking-wide">
                  {t('tools.dialog.reason')} *
                </label>
                <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
                  placeholder={t('tools.dialog.reason')}
                  className="w-full rounded-md border border-[#D4D4D8] bg-white px-3 py-2 text-sm text-[#0A0A0A] placeholder:text-[#71717A] focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none" />
                {reason.length > 0 && reason.length < 10 && (
                  <p className="text-[11px] text-red-500">{10 - reason.length} more characters required</p>
                )}
              </div>
            </>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="border-[#D4D4D8] text-[#71717A]">{t('buttons.cancel', { ns: 'common' })}</Button>
          {transitions.length > 0 && (
            <Button onClick={() => valid && onSave(tool.id, newStatus as ToolStatus, reason.trim())}
              disabled={!valid} className="bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50">
              {t('tools.changeStatus')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// History Modal

function ToolHistoryModal({ open, tool, onClose }: {
  open: boolean; tool: Tool | null; onClose: () => void;
}) {
  const { t } = useTranslation('inventory');
  if (!tool) return null;
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        {/* TODO: GET /api/v1/warehouse/tools/{id}/history */}
        <DialogHeader><DialogTitle>{t('tools.history.title')} — {tool.code} {tool.name}</DialogTitle></DialogHeader>
        <div className="max-h-80 overflow-y-auto space-y-2 py-2 pr-1">
          {tool.history.length === 0 && (
            <p className="text-sm text-[#71717A] text-center py-6">{t('tools.history.noHistory')}</p>
          )}
          {tool.history.map(entry => (
            <div key={entry.id} className="bg-[#FAFAFA] rounded-xl border border-[#D4D4D8] p-3 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <HistActionBadge action={entry.action} />
                <span className="text-[11px] text-[#71717A]">{fmtDate(entry.date)} at {entry.time}</span>
              </div>
              {entry.worker && (
                <div className="flex items-center gap-1.5 text-xs">
                  <div className="w-5 h-5 bg-[#F97316]/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-[8px] font-bold text-[#F97316]">{entry.worker.split(' ').map(w => w[0]).join('')}</span>
                  </div>
                  <span className="font-medium text-[#0A0A0A]">{entry.worker}</span>
                  {entry.project && <span className="text-[#71717A]">→ {entry.project}</span>}
                </div>
              )}
              {entry.notes && <p className="text-xs text-[#71717A] italic">"{entry.notes}"</p>}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={onClose} className="bg-amber-500 hover:bg-amber-600 text-white">{t('buttons.close', { ns: 'common' })}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Main component

interface ToolInventoryProps {
  onNavigate?: (section: string) => void;
}

export function ToolInventory({ onNavigate }: ToolInventoryProps) {
  const { t } = useTranslation('inventory');
  // Tool state
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalElements, setTotalElements] = useState(0);
  const [summary, setSummary] = useState<ToolSummary>({ total: 0, available: 0, assigned: 0, inReview: 0, damaged: 0, lost: 0 });

  // Modal state
  const [showAdd,      setShowAdd]      = useState(false);
  const [editingTool,  setEditingTool]  = useState<Tool | null>(null);
  const [statusTool,   setStatusTool]   = useState<Tool | null>(null);
  const [historyTool,  setHistoryTool]  = useState<Tool | null>(null);

  // Filter state
  const [search,         setSearch]         = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter,   setStatusFilter]   = useState('all');

  // UI state
  const [expandedId,   setExpandedId]   = useState<string | null>(null);
  const [currentPage,  setCurrentPage]  = useState(1);

  // Data loading
  const loadTools = useCallback(() => {
    setLoading(true);
    const params: any = { page: currentPage - 1, size: ITEMS_PER_PAGE };
    if (statusFilter !== 'all') params.status = statusFilter;
    if (categoryFilter !== 'all') params.category = categoryFilter;
    if (search) params.search = search;
    listTools(params)
      .then(res => { setTools(res.content.map(mapToolResponse)); setTotalElements(res.totalElements); })
      .catch(err => toast.error(err?.message))
      .finally(() => setLoading(false));
  }, [search, categoryFilter, statusFilter, currentPage]);

  useEffect(() => { loadTools(); }, [loadTools]);

  const loadSummary = useCallback(() => { getToolSummary().then(setSummary).catch(err => toast.error(err?.message)); }, []);
  useEffect(() => { loadSummary(); }, [loadSummary]);

  // KPIs from API summary
  const kpis = summary;

  const totalPages = Math.max(1, Math.ceil(totalElements / ITEMS_PER_PAGE));

  // Handlers
  function handleReset() { setSearch(''); setCategoryFilter('all'); setStatusFilter('all'); setCurrentPage(1); }

  function handleAddTool(code: string, name: string, category: string, notes: string) {
    createTool({ code, name, category, notes: notes || undefined })
      .then(res => {
        setShowAdd(false);
        toast.success(`Tool registered — ${res.code} ${res.name}`);
        loadTools();
        loadSummary();
      })
      .catch(() => toast.error('Failed to register tool'));
  }

  function handleEditTool(id: string, name: string, category: string, notes: string) {
    updateTool(Number(id), { name, category, notes: notes || undefined })
      .then(res => {
        setEditingTool(null);
        toast.success(`Tool updated — ${res.code}`);
        loadTools();
      })
      .catch(() => toast.error('Failed to update tool'));
  }

  function handleChangeStatus(id: string, newStatus: ToolStatus, reason: string) {
    const tool = tools.find(t => t.id === id);
    changeToolStatus(Number(id), { newStatus, reason })
      .then(() => {
        setStatusTool(null);
        toast.info(`Status changed — ${tool?.code}: ${tool?.status} → ${newStatus}`);
        loadTools();
        loadSummary();
      })
      .catch(() => toast.error('Failed to change status'));
  }

  // Render
  return (
    <div className="space-y-6 max-w-6xl">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-[#0A0A0A]">{t('tools.kpi.totalTools')}</h2>
          <p className="text-[11px] text-[#71717A] mt-0.5">{t('tools.kpi.allEquipment')}</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="bg-amber-500 hover:bg-amber-600 text-white gap-2 h-9">
          <Plus className="w-4 h-4" />{t('tools.newTool')}
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard icon={Package}       title={t('tools.kpi.totalTools')} value={kpis.total.toString()}     subtitle={t('tools.kpi.allEquipment')}        iconBgColor="bg-amber-50"     iconColor="text-amber-600"   />
        <StatCard icon={CheckCircle}   title={t('tools.kpi.available')} value={kpis.available.toString()} subtitle={t('tools.kpi.readyToUse')}         iconBgColor="bg-emerald-50"   iconColor="text-emerald-600" />
        <StatCard icon={ArrowLeftRight}title={t('tools.kpi.assigned')}  value={kpis.assigned.toString()}  subtitle={t('tools.kpi.deployed')}  iconBgColor="bg-[#F97316]/10" iconColor="text-[#F97316]"   />
        <StatCard icon={AlertTriangle} title={t('tools.kpi.damaged')}   value={kpis.damaged.toString()}   subtitle={t('tools.kpi.notUsable')}  iconBgColor="bg-red-50"       iconColor="text-red-600"     />
        <StatCard icon={XCircle}       title={t('tools.kpi.lost')}      value={kpis.lost.toString()}      subtitle={t('tools.kpi.missingItems')}   iconBgColor="bg-red-50"       iconColor="text-red-700"     />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5 flex-1 min-w-[180px]">
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('consumables.search', { defaultValue: 'Search' })}</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#71717A]" />
              <Input value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                placeholder={t('consumables.search')} className="pl-8 h-9 border-[#D4D4D8] text-sm" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5 min-w-[150px]">
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('labels.category', { ns: 'common' })}</label>
            <Select value={categoryFilter} onValueChange={v => { setCategoryFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="h-9 border-[#D4D4D8] text-sm"><SelectValue placeholder={t('labels.allCategories', { ns: 'common' })} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('labels.allCategories', { ns: 'common' })}</SelectItem>
                {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5 min-w-[140px]">
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('labels.status', { ns: 'common' })}</label>
            <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="h-9 border-[#D4D4D8] text-sm"><SelectValue placeholder={t('labels.allStatuses', { ns: 'common' })} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('labels.allStatuses', { ns: 'common' })}</SelectItem>
                {['Available', 'Assigned', 'In Review', 'Damaged', 'Lost'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={handleReset} className="h-9 px-4 text-xs border-[#D4D4D8] text-[#71717A] hover:text-[#0A0A0A]">
            {t('buttons.reset', { ns: 'common' })}
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-[#D4D4D8]">
          <Wrench className="w-4 h-4 text-[#71717A]" />
          <span className="text-sm font-semibold text-[#0A0A0A]">{t('tools.kpi.totalTools')}</span>
          <span className="text-xs text-[#71717A] ml-1">· {tools.length} of {totalElements} tools</span>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#FAFAFA] hover:bg-[#FAFAFA]">
                <TableHead className="w-8" />
                {[t('tools.table.code'), t('tools.table.toolName'), t('tools.table.category'), t('tools.table.status'), t('tools.table.assignedTo'), t('tools.table.lastActivity'), t('tools.table.actions')].map(h => (
                  <TableHead key={h} className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider whitespace-nowrap">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {tools.flatMap(tool => {
                const isExpanded = expandedId === tool.id;

                const mainRow = (
                  <TableRow key={`${tool.id}-main`}
                    className={`border-b border-[#D4D4D8]/50 transition-colors ${isExpanded ? 'bg-amber-50/30' : 'hover:bg-[#FAFAFA]/50'}`}>
                    <TableCell className="py-3 pr-0 pl-4">
                      <button onClick={() => setExpandedId(isExpanded ? null : tool.id)}
                        className="text-[#71717A] hover:text-amber-600 transition-colors">
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-amber-500" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </button>
                    </TableCell>
                    <TableCell className="py-3">
                      <span className="font-mono text-sm font-semibold text-[#0A0A0A]">{tool.code}</span>
                    </TableCell>
                    <TableCell className="py-3">
                      <p className={`text-sm font-medium text-[#0A0A0A] ${tool.status === 'Lost' ? 'line-through text-[#71717A]' : ''}`}>{tool.name}</p>
                    </TableCell>
                    <TableCell className="py-3 text-sm text-[#71717A]">{tool.category}</TableCell>
                    <TableCell className="py-3"><StatusBadge status={tool.status} /></TableCell>
                    <TableCell className="py-3 text-sm text-[#71717A]">{tool.assignedTo ?? '—'}</TableCell>
                    <TableCell className="py-3 text-sm text-[#71717A] whitespace-nowrap">{fmtDateShort(tool.lastActivity)}</TableCell>
                    <TableCell className="py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-amber-50">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => setEditingTool(tool)} className="gap-2 text-sm cursor-pointer">
                            <Pencil className="w-4 h-4" />{t('tools.editTool')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setHistoryTool(tool)} className="gap-2 text-sm cursor-pointer">
                            <History className="w-4 h-4" />{t('tools.viewHistory')}
                          </DropdownMenuItem>
                          {tool.status !== 'Assigned' && (
                            <DropdownMenuItem onClick={() => setStatusTool(tool)} className="gap-2 text-sm cursor-pointer">
                              <RefreshCw className="w-4 h-4" />{t('tools.changeStatus')}
                            </DropdownMenuItem>
                          )}
                          {tool.status === 'Available' && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => onNavigate?.('assignments')} className="gap-2 text-sm cursor-pointer text-amber-700 focus:text-amber-700">
                                <ArrowRight className="w-4 h-4" />{t('assignment.assignTool')}
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );

                if (!isExpanded) return [mainRow];

                const expandedRow = (
                  <TableRow key={`${tool.id}-exp`} className="bg-amber-50/20 hover:bg-amber-50/20">
                    <TableCell colSpan={8} className="px-6 py-5 border-b border-[#D4D4D8]/50">
                      <div className="space-y-4">
                        {/* Details grid */}
                        <div>
                          <p className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-2">{t('tools.table.toolName')}</p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {[
                              [t('tools.table.code'),            tool.code],
                              [t('tools.table.category'),        tool.category],
                              [t('tools.table.status'),          <StatusBadge key="s" status={tool.status} />],
                              [t('tools.table.assignedTo'),     tool.assignedTo ?? '—'],
                              [t('labels.date', { ns: 'common' }), fmtDate(tool.dateRegistered)],
                              [t('labels.notes', { ns: 'common' }),           tool.notes || '—'],
                            ].map(([label, value]) => (
                              <div key={String(label)}>
                                <p className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wide mb-0.5">{label}</p>
                                {typeof value === 'string'
                                  ? <p className={`text-xs text-[#0A0A0A] ${label === 'Code' ? 'font-mono font-semibold' : ''}`}>{value}</p>
                                  : value}
                              </div>
                            ))}
                          </div>
                        </div>
                        {/* Mini history */}
                        <div>
                          <p className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-2">
                            {t('tools.history.title')} <span className="font-normal lowercase">(last {Math.min(tool.history.length, 3)})</span>
                          </p>
                          <div className="bg-white rounded-xl border border-[#D4D4D8] px-4 py-2 space-y-0">
                            {tool.history.slice(0, 3).map((h, idx) => (
                              <div key={h.id} className={`flex items-start gap-2 py-2 ${idx < Math.min(tool.history.length, 3) - 1 ? 'border-b border-[#D4D4D8]/40' : ''}`}>
                                <HistActionBadge action={h.action} />
                                <span className="text-[11px] text-[#71717A] flex-shrink-0">{fmtDateShort(h.date)} {h.time}</span>
                                {h.worker && <span className="text-[11px] text-[#0A0A0A] font-medium flex-shrink-0">· {h.worker}</span>}
                                {h.notes && <span className="text-[11px] text-[#71717A] italic truncate min-w-0">— {h.notes}</span>}
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
          {tools.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 bg-[#FAFAFA] rounded-full flex items-center justify-center mb-3">
                <Wrench className="w-7 h-7 text-[#D4D4D8]" />
              </div>
              <p className="text-sm font-semibold text-[#0A0A0A] mb-1">{t('labels.noDataAvailable', { ns: 'common' })}</p>
              <p className="text-xs text-[#71717A]">{t('buttons.resetFilters', { ns: 'common' })}</p>
            </div>
          )}
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-[#D4D4D8]">
          {tools.map(tool => {
            const isExp = expandedId === tool.id;
            return (
              <div key={tool.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-bold text-[#0A0A0A]">{tool.code}</span>
                      <StatusBadge status={tool.status} />
                    </div>
                    <p className={`text-sm font-medium ${tool.status === 'Lost' ? 'line-through text-[#71717A]' : 'text-[#0A0A0A]'}`}>{tool.name}</p>
                    <p className="text-xs text-[#71717A] mt-0.5">{tool.category} · {tool.assignedTo ?? t('tools.status.available')}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => setExpandedId(isExp ? null : tool.id)} className="p-1 text-[#71717A]">
                      {isExp ? <ChevronDown className="w-4 h-4 text-amber-500" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><MoreHorizontal className="w-4 h-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={() => setEditingTool(tool)} className="gap-2 text-sm cursor-pointer"><Pencil className="w-4 h-4" />{t('buttons.edit', { ns: 'common' })}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setHistoryTool(tool)} className="gap-2 text-sm cursor-pointer"><History className="w-4 h-4" />{t('tools.viewHistory')}</DropdownMenuItem>
                        {tool.status !== 'Assigned' && (
                          <DropdownMenuItem onClick={() => setStatusTool(tool)} className="gap-2 text-sm cursor-pointer"><RefreshCw className="w-4 h-4" />{t('tools.changeStatus')}</DropdownMenuItem>
                        )}
                        {tool.status === 'Available' && (
                          <DropdownMenuItem onClick={() => onNavigate?.('assignments')} className="gap-2 text-sm cursor-pointer text-amber-700"><ArrowRight className="w-4 h-4" />{t('assignment.assignTool')}</DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                {isExp && (
                  <div className="pt-2 space-y-1 border-t border-[#D4D4D8]/50">
                    {tool.history.slice(0, 3).map(h => (
                      <div key={h.id} className="flex items-center gap-1.5 text-[11px]">
                        <HistActionBadge action={h.action} />
                        <span className="text-[#71717A]">{fmtDateShort(h.date)}</span>
                        {h.notes && <span className="text-[#71717A] italic truncate">— {h.notes}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <Pagination current={currentPage} total={totalPages} onPage={p => { setCurrentPage(p); setExpandedId(null); }} />
      </div>

      {/* Modals */}
      <AddToolModal open={showAdd} onClose={() => setShowAdd(false)} onAdd={handleAddTool} />
      <EditToolModal open={!!editingTool} tool={editingTool} onClose={() => setEditingTool(null)} onSave={handleEditTool} />
      <ChangeStatusModal open={!!statusTool} tool={statusTool} onClose={() => setStatusTool(null)} onSave={handleChangeStatus} />
      <ToolHistoryModal open={!!historyTool} tool={historyTool} onClose={() => setHistoryTool(null)} />
    </div>
  );
}
