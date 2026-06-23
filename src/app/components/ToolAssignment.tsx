import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeftRight, Calendar, RotateCcw, ArrowRight, ArrowLeft,
  Camera, Package,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { StatCard } from './StatCard';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from './ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from './ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from './ui/dialog';
import {
  getActiveAssignments,
  getAssignmentLog,
  getAssignmentSummary,
  assignTool as apiAssignTool,
  returnTool as apiReturnTool,
  listTools,
  getWorkerProjects,
  type AssignmentSummaryResponse,
  type WorkerProjectOption,
} from '../services/warehouse';
import { listActiveUsers, type UserDTO } from '../services/users';

// Types

interface Assignment {
  id: string;
  toolCode: string;
  toolName: string;
  category: string;
  status: string;
  worker: string;
  assignedDate: string;
  project: string;
  daysOut: number;
}

interface LogEntry {
  id: string;
  date: string;
  toolCode: string;
  toolName: string;
  action: 'Assigned' | 'Returned';
  worker: string;
  project: string;
  condition: string;
  notes: string;
}

interface AvailableTool { code: string; name: string; }

// Constants

const CONDITIONS = ['Good', 'Minor wear', 'Needs repair', 'Damaged'];

const CONDITION_KEYS: Record<string, string> = {
  'Good': 'assignment.conditions.good',
  'Minor wear': 'assignment.conditions.minorWear',
  'Needs repair': 'assignment.conditions.needsRepair',
  'Damaged': 'assignment.conditions.damaged',
};

// Helpers

function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateShort(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getDaysOutColor(days: number): string {
  if (days > 30) return 'text-red-600 font-semibold';
  if (days >= 7)  return 'text-amber-600 font-semibold';
  return 'text-emerald-600 font-semibold';
}

// Sub-components

function ActionBadge({ action }: { action: 'Assigned' | 'Returned' }) {
  const { t } = useTranslation('inventory');
  return action === 'Assigned' ? (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border bg-[#F97316]/10 text-[#F97316] border-[#F97316]/20">{t('assignment.action.assigned')}</span>
  ) : (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border bg-amber-50 text-amber-700 border-amber-200">{t('assignment.action.returned')}</span>
  );
}

function Pagination({ current, total, onPage }: { current: number; total: number; onPage: (p: number) => void }) {
  const { t } = useTranslation('common');
  if (total <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-1 py-4 border-t border-[#D4D4D8]">
      <button onClick={() => onPage(current - 1)} disabled={current === 1}
        className="h-8 px-3 rounded-lg text-xs font-medium text-[#71717A] hover:text-amber-700 hover:bg-amber-50 disabled:opacity-30 disabled:cursor-not-allowed">{t('buttons.prev')}</button>
      {Array.from({ length: total }, (_, i) => i + 1).map(p => (
        <button key={p} onClick={() => onPage(p)}
          className={`h-8 w-8 rounded-lg text-xs font-semibold transition-colors ${p === current ? 'bg-amber-500 text-white' : 'text-[#71717A] hover:bg-amber-50 hover:text-amber-700'}`}>{p}</button>
      ))}
      <button onClick={() => onPage(current + 1)} disabled={current === total}
        className="h-8 px-3 rounded-lg text-xs font-medium text-[#71717A] hover:text-amber-700 hover:bg-amber-50 disabled:opacity-30 disabled:cursor-not-allowed">{t('buttons.next')}</button>
    </div>
  );
}

// Assign Tool Modal

function AssignModal({ open, availableTools, workers, onClose, onAssign }: {
  open: boolean;
  availableTools: AvailableTool[];
  workers: UserDTO[];
  onClose: () => void;
  onAssign: (toolCode: string, toolName: string, workerId: number, workerName: string, projectId: number, projectName: string, notes: string) => void;
}) {
  const { t } = useTranslation('inventory');
  const [toolCode,        setToolCode]        = useState('');
  const [workerId,        setWorkerId]        = useState('');
  const [projectId,       setProjectId]       = useState('');
  const [notes,           setNotes]           = useState('');
  const [workerProjects,  setWorkerProjects]  = useState<WorkerProjectOption[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  useEffect(() => { if (open) { setToolCode(''); setWorkerId(''); setProjectId(''); setNotes(''); setWorkerProjects([]); } }, [open]);

  // Cascading: when worker changes, load their projects
  useEffect(() => {
    if (!workerId) { setWorkerProjects([]); setProjectId(''); return; }
    setLoadingProjects(true);
    setProjectId('');
    getWorkerProjects(Number(workerId))
      .then(setWorkerProjects)
      .catch(() => { setWorkerProjects([]); toast.error(t('assignment.dialog.errorLoadingProjects')); })
      .finally(() => setLoadingProjects(false));
  }, [workerId]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedTool    = availableTools.find(t => t.code === toolCode);
  const selectedProject = workerProjects.find(p => String(p.id) === projectId);
  const selectedWorker  = workers.find(w => String(w.id) === workerId);
  const valid           = toolCode && workerId && projectId;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{t('assignment.dialog.assign')}</DialogTitle></DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#71717A] uppercase tracking-wide">{t('assignment.dialog.tool')} *</label>
            {availableTools.length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">{t('assignment.dialog.noTools')}</div>
            ) : (
              <Select value={toolCode} onValueChange={setToolCode}>
                <SelectTrigger className="border-[#D4D4D8] text-sm"><SelectValue placeholder={t('assignment.dialog.toolPlaceholder')} /></SelectTrigger>
                <SelectContent>
                  {availableTools.map(t => (
                    <SelectItem key={t.code} value={t.code}>
                      <span className="font-mono text-xs mr-2 text-[#71717A]">{t.code}</span>{t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#71717A] uppercase tracking-wide">{t('assignment.dialog.worker')} *</label>
              <Select value={workerId} onValueChange={setWorkerId}>
                <SelectTrigger className="border-[#D4D4D8] text-sm"><SelectValue placeholder={t('assignment.dialog.workerPlaceholder')} /></SelectTrigger>
                <SelectContent>
                  {workers.map(w => (
                    <SelectItem key={w.id} value={String(w.id)}>
                      {w.fullName ?? w.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#71717A] uppercase tracking-wide">{t('assignment.dialog.project')} *</label>
              <Select value={projectId} onValueChange={setProjectId} disabled={!workerId || loadingProjects}>
                <SelectTrigger className="border-[#D4D4D8] text-sm">
                  <SelectValue placeholder={loadingProjects ? t('assignment.dialog.loadingProjects') : t('assignment.dialog.projectPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {workerProjects.map(p => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {workerId && !loadingProjects && workerProjects.length === 0 && (
                <p className="text-[11px] text-amber-600">{t('assignment.dialog.noWorkerProjects')}</p>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#71717A] uppercase tracking-wide">{t('assignment.dialog.notes')}</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder={t('assignment.dialog.assignmentNotes')}
              className="w-full rounded-md border border-[#D4D4D8] bg-white px-3 py-2 text-sm placeholder:text-[#71717A] focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none" />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="border-[#D4D4D8] text-[#71717A]">{t('buttons.cancel', { ns: 'common' })}</Button>
          <Button
            onClick={() => valid && selectedWorker && selectedProject &&
              onAssign(toolCode, selectedTool?.name ?? '', selectedWorker.id, selectedWorker.fullName ?? selectedWorker.username, selectedProject.id, selectedProject.name, notes)
            }
            disabled={!valid || availableTools.length === 0}
            className="bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50">
            {t('assignment.assignTool')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Return Tool Modal

function ReturnModal({ open, activeAssignments, onClose, onReturn }: {
  open: boolean; activeAssignments: Assignment[]; onClose: () => void;
  onReturn: (assignmentId: string, condition: string, notes: string) => void;
}) {
  const { t } = useTranslation('inventory');
  const [assignId,   setAssignId]   = useState('');
  const [condition,  setCondition]  = useState('');
  const [notes,      setNotes]      = useState('');

  useEffect(() => { if (open) { setAssignId(''); setCondition(''); setNotes(''); } }, [open]);

  const valid = assignId && condition;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{t('assignment.dialog.return')}</DialogTitle></DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#71717A] uppercase tracking-wide">{t('assignment.dialog.tool')} *</label>
            {activeAssignments.length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">{t('assignment.dialog.noAssigned')}</div>
            ) : (
              <Select value={assignId} onValueChange={setAssignId}>
                <SelectTrigger className="border-[#D4D4D8] text-sm"><SelectValue placeholder={t('assignment.dialog.selectAssignedTool')} /></SelectTrigger>
                <SelectContent>
                  {activeAssignments.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      <span className="font-mono text-xs mr-1 text-[#71717A]">{a.toolCode}</span>
                      {a.toolName}
                      <span className="text-[#71717A] ml-1">({t('assignment.dialog.assignedTo', { worker: a.worker })})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#71717A] uppercase tracking-wide">{t('assignment.dialog.conditionOnReturn')} *</label>
            <Select value={condition} onValueChange={setCondition}>
              <SelectTrigger className="border-[#D4D4D8] text-sm"><SelectValue placeholder={t('assignment.dialog.selectCondition')} /></SelectTrigger>
              <SelectContent>{CONDITIONS.map(c => <SelectItem key={c} value={c}>{t(CONDITION_KEYS[c])}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#71717A] uppercase tracking-wide">{t('assignment.dialog.notes')}</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder={t('assignment.dialog.returnObservations')}
              className="w-full rounded-md border border-[#D4D4D8] bg-white px-3 py-2 text-sm placeholder:text-[#71717A] focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none" />
          </div>
          {/* Photo evidence placeholder */}
          {/* TODO: Implement photo upload */}
          <div className="flex items-center gap-3 bg-amber-50 border border-dashed border-amber-300 rounded-xl p-3 opacity-60 cursor-not-allowed select-none">
            <Camera className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-amber-700">{t('assignment.dialog.photoEvidence')}</p>
              <p className="text-[11px] text-amber-600">{t('assignment.dialog.comingSoon')}</p>
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="border-[#D4D4D8] text-[#71717A]">{t('buttons.cancel', { ns: 'common' })}</Button>
          <Button onClick={() => valid && onReturn(assignId, condition, notes)}
            disabled={!valid || activeAssignments.length === 0}
            className="bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50">
            {t('assignment.dialog.confirmReturn')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Main component

const ITEMS_PER_PAGE = 5;

export function ToolAssignment() {
  const { t } = useTranslation('inventory');
  const [activeAssignments, setActiveAssignments] = useState<Assignment[]>([]);
  const [assignmentLog,     setAssignmentLog]     = useState<LogEntry[]>([]);
  const [availableTools,    setAvailableTools]    = useState<AvailableTool[]>([]);
  const [summaryData,       setSummaryData]       = useState<AssignmentSummaryResponse>({ activeAssignments: 0, assignedToday: 0, returnedToday: 0 });
  const [workers,           setWorkers]           = useState<UserDTO[]>([]);
  const [loading,           setLoading]           = useState(true);
  const [logTotalPages,     setLogTotalPages]     = useState(1);

  const [activeTab, setActiveTab] = useState<'active' | 'log'>('active');
  const [showAssign, setShowAssign] = useState(false);
  const [showReturn, setShowReturn] = useState(false);

  const [activePage, setActivePage] = useState(1);
  const [logPage,    setLogPage]    = useState(1);

  // Fetch all data from API
  const loadAllData = useCallback((currentLogPage = logPage) => {
    setLoading(true);
    Promise.all([
      getActiveAssignments(),
      getAssignmentLog({ page: currentLogPage - 1, size: ITEMS_PER_PAGE }),
      getAssignmentSummary(),
      listTools({ status: 'Available', size: 100 }),
      listActiveUsers('WORKER'),
    ]).then(([active, log, summary, available, userList]) => {
      setActiveAssignments(active.map(a => ({ ...a, id: String(a.id) })));
      setAssignmentLog(log.content.map(l => ({ ...l, id: String(l.id), action: l.action as 'Assigned' | 'Returned' })));
      setLogTotalPages(Math.max(1, log.totalPages));
      setSummaryData(summary);
      setAvailableTools(available.content.map(t => ({ code: t.code, name: t.name })));
      setWorkers(userList);
    }).catch(err => toast.error(err?.message)).finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadAllData(1); }, [loadAllData]);

  // Refetch log when page changes
  useEffect(() => {
    getAssignmentLog({ page: logPage - 1, size: ITEMS_PER_PAGE }).then(log => {
      setAssignmentLog(log.content.map(l => ({ ...l, id: String(l.id), action: l.action as 'Assigned' | 'Returned' })));
      setLogTotalPages(Math.max(1, log.totalPages));
    }).catch(err => toast.error(err?.message));
  }, [logPage]);

  const activeTotalPages = Math.max(1, Math.ceil(activeAssignments.length / ITEMS_PER_PAGE));
  const activePageRows   = activeAssignments.slice((activePage - 1) * ITEMS_PER_PAGE, activePage * ITEMS_PER_PAGE);
  const logPageRows      = assignmentLog;

  // KPIs from API summary
  const assignedToday = summaryData.assignedToday;
  const returnsToday  = summaryData.returnedToday;

  function handleAssign(toolCode: string, toolName: string, workerId: number, workerName: string, projectId: number, projectName: string, notes: string) {
    apiAssignTool({
      toolCode,
      toolName,
      workerId,
      worker: workerName,
      projectId,
      project: projectName,
      notes: notes || undefined,
    }).then(() => {
      setShowAssign(false);
      toast.success(t('inventory:toast.toolAssigned', 'Assigned {{code}} {{name}} to {{worker}} — {{project}}', { code: toolCode, name: toolName, worker: workerName, project: projectName }));
      loadAllData();
    }).catch(() => {
      toast.error(t('inventory:toast.assignError', 'Failed to assign tool. Please try again.'));
    });
  }

  function handleReturn(assignmentId: string, condition: string, notes: string) {
    const assignment = activeAssignments.find(a => a.id === assignmentId);
    if (!assignment) return;

    apiReturnTool(Number(assignmentId), {
      condition,
      notes: notes || undefined,
    }).then(() => {
      setShowReturn(false);
      toast.success(t('inventory:toast.toolReturned', 'Returned {{code}} {{name}} — condition: {{condition}}', { code: assignment.toolCode, name: assignment.toolName, condition }));
      loadAllData();
    }).catch(() => {
      toast.error(t('inventory:toast.returnError', 'Failed to return tool. Please try again.'));
    });
  }

  // Render
  if (loading && activeAssignments.length === 0) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-[#0A0A0A]">{t('assignment.title')}</h2>
          <p className="text-[11px] text-[#71717A] mt-0.5">{t('assignment.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowReturn(true)}
            variant="outline" className="border-amber-500 text-amber-600 hover:bg-amber-50 gap-2 h-9 text-xs">
            <ArrowLeft className="w-4 h-4" />{t('assignment.returnTool')}
          </Button>
          <Button onClick={() => setShowAssign(true)}
            className="bg-amber-500 hover:bg-amber-600 text-white gap-2 h-9 text-xs">
            <ArrowRight className="w-4 h-4" />{t('assignment.assignTool')}
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={ArrowLeftRight}title={t('assignment.kpi.currentlyAssigned')}  value={summaryData.activeAssignments.toString()} subtitle={t('assignment.kpi.outWithWorkers')}  iconBgColor="bg-amber-50"     iconColor="text-amber-600"   />
        <StatCard icon={Calendar}      title={t('assignment.kpi.assignedToday')}      value={assignedToday.toString()}            subtitle={t('assignment.kpi.newToday')}         iconBgColor="bg-emerald-50"   iconColor="text-emerald-600" />
        <StatCard icon={RotateCcw}     title={t('assignment.kpi.returnsToday')}       value={returnsToday.toString()}             subtitle={t('assignment.kpi.returnedToday')}    iconBgColor="bg-[#F97316]/10" iconColor="text-[#F97316]"   />
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
        <div className="flex border-b border-[#D4D4D8]">
          {([['active', t('assignment.activeAssignments')], ['log', t('assignment.assignmentLog')]] as ['active' | 'log', string][]).map(([key, label]) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`flex-1 sm:flex-none px-6 py-3.5 text-sm font-semibold transition-colors border-b-2 ${
                activeTab === key
                  ? 'border-amber-500 text-amber-700 bg-amber-50/50'
                  : 'border-transparent text-[#71717A] hover:text-[#0A0A0A] hover:bg-[#FAFAFA]'
              }`}>
              {label}
              {key === 'active' && (
                <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                  {activeAssignments.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Active Assignments tab */}
        {activeTab === 'active' && (
          <>
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#FAFAFA] hover:bg-[#FAFAFA]">
                    {[t('assignment.table.tool'), t('assignment.table.category'), t('assignment.table.worker'), t('assignment.table.assignedDate'), t('assignment.table.project'), t('assignment.table.daysOut'), t('assignment.table.actions')].map(h => (
                      <TableHead key={h} className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider whitespace-nowrap">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activePageRows.map(a => (
                    <TableRow key={a.id} className="border-b border-[#D4D4D8]/50 hover:bg-[#FAFAFA]/50">
                      <TableCell className="py-3">
                        <div className="flex items-center gap-2">
                          <div>
                            <p className="text-sm font-semibold text-[#0A0A0A]">{a.toolName}</p>
                            <p className="text-[11px] font-mono text-[#71717A]">{a.toolCode}</p>
                          </div>
                          {a.status === 'PENDING_ACCEPTANCE' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-amber-50 text-amber-700 border-amber-200">
                              {t('assignment.pendingAcceptance')}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-3 text-sm text-[#71717A]">{a.category}</TableCell>
                      <TableCell className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-[#F97316]/10 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-[8px] font-bold text-[#F97316]">{a.worker.split(' ').map(w => w[0]).join('')}</span>
                          </div>
                          <span className="text-sm text-[#0A0A0A] font-medium">{a.worker}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-3 text-sm text-[#71717A] whitespace-nowrap">{fmtDate(a.assignedDate)}</TableCell>
                      <TableCell className="py-3 text-sm text-[#71717A]">{a.project}</TableCell>
                      <TableCell className="py-3">
                        <span className={`text-sm ${getDaysOutColor(a.daysOut)}`}>
                          {a.daysOut === 0 ? t('assignment.today') : t('assignment.daysShort', { days: a.daysOut })}
                        </span>
                      </TableCell>
                      <TableCell className="py-3">
                        <Button onClick={() => setShowReturn(true)} variant="outline" size="sm"
                          className="border-amber-500 text-amber-600 hover:bg-amber-50 gap-1.5 h-7 text-xs px-2">
                          <RotateCcw className="w-3 h-3" />{t('assignment.return')}
                     </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {activeAssignments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-16 text-center text-sm text-[#71717A]">
                        <Package className="w-8 h-8 text-[#D4D4D8] mx-auto mb-2" />
                        {t('assignment.noToolsAssigned')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            {/* Mobile */}
            <div className="md:hidden divide-y divide-[#D4D4D8]">
              {activePageRows.map(a => (
                <div key={a.id} className="p-4 flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-[#0A0A0A]">{a.toolName}</p>
                      {a.status === 'PENDING_ACCEPTANCE' && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold border bg-amber-50 text-amber-700 border-amber-200">
                          {t('assignment.pendingAcceptance')}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-mono text-[#71717A]">{a.toolCode}</p>
                    <p className="text-xs text-[#71717A] mt-1">{a.worker} · {a.project}</p>
                    <p className={`text-xs mt-0.5 ${getDaysOutColor(a.daysOut)}`}>{a.daysOut === 0 ? t('assignment.today') : t('assignment.daysOutLong', { days: a.daysOut })}</p>
                  </div>
                  <Button onClick={() => setShowReturn(true)} variant="outline" size="sm"
                    className="border-amber-500 text-amber-600 hover:bg-amber-50 gap-1 h-7 text-xs px-2 flex-shrink-0">
                    <RotateCcw className="w-3 h-3" />{t('assignment.return')}
                  </Button>
                </div>
              ))}
            </div>
            <Pagination current={activePage} total={activeTotalPages} onPage={setActivePage} />
          </>
        )}

        {/* Assignment Log tab */}
        {activeTab === 'log' && (
          <>
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#FAFAFA] hover:bg-[#FAFAFA]">
                    {[t('assignment.log.date'), t('assignment.log.tool'), t('assignment.log.action'), t('assignment.log.worker'), t('assignment.log.project'), t('assignment.log.condition'), t('assignment.log.notes')].map(h => (
                      <TableHead key={h} className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider whitespace-nowrap">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logPageRows.map(l => (
                    <TableRow key={l.id} className="border-b border-[#D4D4D8]/50 hover:bg-[#FAFAFA]/50">
                      <TableCell className="py-3 text-sm text-[#71717A] whitespace-nowrap">{fmtDateShort(l.date)}</TableCell>
                      <TableCell className="py-3">
                        <p className="text-sm font-medium text-[#0A0A0A]">{l.toolName}</p>
                        <p className="text-[11px] font-mono text-[#71717A]">{l.toolCode}</p>
                      </TableCell>
                      <TableCell className="py-3"><ActionBadge action={l.action} /></TableCell>
                      <TableCell className="py-3 text-sm text-[#0A0A0A]">{l.worker}</TableCell>
                      <TableCell className="py-3 text-sm text-[#71717A]">{l.project}</TableCell>
                      <TableCell className="py-3">
                        {l.condition ? (
                          <span className={`text-xs font-medium ${l.condition === 'Good' || l.condition === 'Minor wear' ? 'text-emerald-600' : 'text-red-600'}`}>
                            {l.condition}
                          </span>
                        ) : <span className="text-[#D4D4D8]">—</span>}
                      </TableCell>
                      <TableCell className="py-3 text-sm text-[#71717A] italic">{l.notes || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {/* Mobile */}
            <div className="md:hidden divide-y divide-[#D4D4D8]">
              {logPageRows.map(l => (
                <div key={l.id} className="p-4 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <ActionBadge action={l.action} />
                    <span className="text-[11px] text-[#71717A]">{fmtDateShort(l.date)}</span>
                  </div>
                  <p className="text-sm font-medium text-[#0A0A0A]">{l.toolName} <span className="font-mono text-[#71717A] text-xs">({l.toolCode})</span></p>
                  <p className="text-xs text-[#71717A]">{l.worker} · {l.project}</p>
                  {l.condition && <p className="text-xs text-[#71717A]">{t('assignment.conditionLabel', { condition: l.condition })}</p>}
                </div>
              ))}
            </div>
            <Pagination current={logPage} total={logTotalPages} onPage={setLogPage} />
          </>
        )}
      </div>

      {/* Modals */}
      <AssignModal open={showAssign} availableTools={availableTools} workers={workers} onClose={() => setShowAssign(false)} onAssign={handleAssign} />
      <ReturnModal open={showReturn} activeAssignments={activeAssignments} onClose={() => setShowReturn(false)} onReturn={handleReturn} />
    </div>
  );
}