// ConsumableDispatch.tsx — Dispatch consumable supplies to projects

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight, Package, Building2, Plus,
  ChevronLeft, ChevronRight, Loader2,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { StatCard } from './StatCard';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from './ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from './ui/select';
import { toast } from 'sonner';
import {
  getAllDispatches, dispatchConsumable, listConsumables,
  type DispatchResponse, type ConsumableResponse,
} from '../services/warehouse';
import { listProjects, type ProjectResponse } from '../services/projects';
import { listActiveUsers, type UserDTO } from '../services/users';

// Types

interface DispatchItem {
  id: string;
  consumableCode: string;
  consumableName: string;
  unit: string;
  quantity: number;
  project: string;
  requestedBy: string;
  date: string;
  notes: string;
}

// Constants

const ITEMS_PER_PAGE = 8;

// Helpers

function mapDispatchResponse(d: DispatchResponse): DispatchItem {
  return {
    id: String(d.id),
    consumableCode: d.consumableCode,
    consumableName: d.consumableName,
    unit: d.unit,
    quantity: d.quantity,
    project: d.project,
    requestedBy: d.requestedBy,
    date: d.date,
    notes: d.notes ?? '',
  };
}

function fmtDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Main component

export function ConsumableDispatch() {
  const { t } = useTranslation('inventory');
  const [dispatches, setDispatches] = useState<DispatchItem[]>([]);
  const [consumables, setConsumables] = useState<ConsumableResponse[]>([]);
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [workers, setWorkers] = useState<UserDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([
      getAllDispatches({ page: 0, size: 500 }),
      listConsumables(),
      listProjects({ status: 'ACTIVE', size: 100 }),
      listActiveUsers(),
    ])
      .then(([dispatchPage, consumableList, projectsPage, userList]) => {
        setDispatches(dispatchPage.content.map(mapDispatchResponse));
        setConsumables(consumableList);
        setProjects(projectsPage.content);
        setWorkers(userList);
      })
      .catch(() => toast.error('Failed to load dispatch data'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const totalPages = Math.max(1, Math.ceil(dispatches.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paged = dispatches.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  // KPIs
  const totalDispatches = dispatches.length;
  const totalUnits = dispatches.reduce((s, d) => s + d.quantity, 0);
  const uniqueProjects = new Set(dispatches.map(d => d.project)).size;

  const handleDispatch = (
    consumableCode: string,
    consumableName: string,
    unit: string,
    quantity: number,
    projectId: number,
    projectName: string,
    requestedById: number,
    requestedByName: string,
    notes: string,
  ) => {
    dispatchConsumable({
      consumableCode,
      consumableName,
      unit,
      quantity,
      projectId,
      project: projectName,
      requestedById,
      requestedBy: requestedByName,
      notes: notes || undefined,
    })
      .then(res => {
        setModalOpen(false);
        toast.success(`Dispatched ${res.quantity} ${res.unit} of ${res.consumableName} → ${res.project}`);
        loadData();
      })
      .catch(() => toast.error('Failed to dispatch supply. Check stock and try again.'));
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={ArrowRight}  title={t('dispatch.kpi.totalDispatches')} value={loading ? '…' : totalDispatches} subtitle={t('dispatch.kpi.dispatchRecords')}    iconBgColor="bg-amber-50"     iconColor="text-amber-600"   />
        <StatCard icon={Package}     title={t('dispatch.kpi.unitsDispatched')} value={loading ? '…' : totalUnits}      subtitle={t('dispatch.kpi.totalQuantity')}      iconBgColor="bg-emerald-50"   iconColor="text-emerald-600" />
        <StatCard icon={Building2}   title={t('dispatch.kpi.activeProjects')}  value={loading ? '…' : uniqueProjects}  subtitle={t('dispatch.kpi.receivingSupplies')}  iconBgColor="bg-[#F97316]/10" iconColor="text-[#F97316]"   />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[#0A0A0A]">{t('dispatch.title')}</h3>
          <p className="text-[11px] text-[#71717A] mt-0.5">{t('dispatch.subtitle')}</p>
        </div>
        <Button onClick={() => setModalOpen(true)} disabled={loading} className="bg-amber-500 hover:bg-amber-600 text-white h-9 gap-1.5">
          <ArrowRight className="w-4 h-4" /> {t('dispatch.dispatchSupply')}
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#FAFAFA]">
                    {[t('dispatch.table.date'), t('dispatch.table.item'), t('dispatch.table.qty'), t('dispatch.table.unit'), t('dispatch.table.project'), t('dispatch.table.requestedBy'), t('dispatch.table.notes')].map(h => (
                      <th key={h} className="text-left text-[11px] font-semibold text-[#71717A] uppercase tracking-wider px-4 py-2.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paged.map(d => (
                    <tr key={d.id} className="border-t border-[#D4D4D8]/50 hover:bg-[#FAFAFA]/50 transition-colors">
                      <td className="px-4 py-3 text-sm text-[#0A0A0A] whitespace-nowrap">{fmtDate(d.date)}</td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-[#0A0A0A]">{d.consumableName}</p>
                        <p className="text-[11px] text-[#71717A] font-mono">{d.consumableCode}</p>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-[#0A0A0A]">{d.quantity}</td>
                      <td className="px-4 py-3 text-sm text-[#71717A]">{d.unit}</td>
                      <td className="px-4 py-3 text-sm text-[#0A0A0A]">{d.project}</td>
                      <td className="px-4 py-3 text-sm text-[#71717A]">{d.requestedBy}</td>
                      <td className="px-4 py-3 text-sm text-[#71717A]">{d.notes || '—'}</td>
                    </tr>
                  ))}
                  {paged.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center">
                        <ArrowRight className="w-10 h-10 text-[#D4D4D8] mx-auto mb-2" />
                        <p className="text-sm text-[#71717A]">{t('dispatch.noDispatches')}</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-[#D4D4D8]/50">
              {paged.map(d => (
                <div key={d.id} className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-[#0A0A0A]">{d.consumableName}</p>
                    <span className="text-sm font-semibold text-[#0A0A0A]">{d.quantity} {d.unit}</span>
                  </div>
                  <p className="text-[11px] font-mono text-[#71717A]">{d.consumableCode}</p>
                  <p className="text-xs text-[#71717A] mt-1">{d.project} &middot; {d.requestedBy}</p>
                  <p className="text-xs text-[#71717A]">{fmtDate(d.date)}</p>
                  {d.notes && <p className="text-xs text-[#71717A] italic mt-0.5">{d.notes}</p>}
                </div>
              ))}
              {paged.length === 0 && (
                <div className="p-8 text-center">
                  <ArrowRight className="w-10 h-10 text-[#D4D4D8] mx-auto mb-2" />
                  <p className="text-sm text-[#71717A]">{t('dispatch.noDispatches')}</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-[#71717A]">
            {t('dispatch.showing', { from: (safePage - 1) * ITEMS_PER_PAGE + 1, to: Math.min(safePage * ITEMS_PER_PAGE, dispatches.length), total: dispatches.length })}
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setPage(p => p - 1)} className="h-8 w-8 p-0 border-[#D4D4D8]">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            {Array.from({ length: totalPages }, (_, i) => (
              <Button
                key={i + 1}
                variant={safePage === i + 1 ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPage(i + 1)}
                className={`h-8 w-8 p-0 ${safePage === i + 1 ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500' : 'border-[#D4D4D8]'}`}
              >
                {i + 1}
              </Button>
            ))}
            <Button variant="outline" size="sm" disabled={safePage >= totalPages} onClick={() => setPage(p => p + 1)} className="h-8 w-8 p-0 border-[#D4D4D8]">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Dispatch Modal */}
      {modalOpen && (
        <DispatchModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          consumables={consumables}
          projects={projects}
          workers={workers}
          onDispatch={handleDispatch}
        />
      )}
    </div>
  );
}

// ── Dispatch Modal ────────────────────────────────────────────────────────────

function DispatchModal({
  open, onClose, consumables, projects, workers, onDispatch,
}: {
  open: boolean;
  onClose: () => void;
  consumables: ConsumableResponse[];
  projects: ProjectResponse[];
  workers: UserDTO[];
  onDispatch: (
    consumableCode: string,
    consumableName: string,
    unit: string,
    quantity: number,
    projectId: number,
    projectName: string,
    requestedById: number,
    requestedByName: string,
    notes: string,
  ) => void;
}) {
  const { t } = useTranslation('inventory');
  const [selectedConsumableId, setSelectedConsumableId] = useState('');
  const [qty, setQty] = useState('');
  const [projectId, setProjectId] = useState('');
  const [workerId, setWorkerId] = useState('');
  const [notes, setNotes] = useState('');

  const selected = consumables.find(c => String(c.id) === selectedConsumableId);
  const selectedProject = projects.find(p => String(p.id) === projectId);
  const selectedWorker = workers.find(w => String(w.id) === workerId);

  const maxQty = selected?.currentStock ?? 0;
  const projectClosed = selectedProject?.status === 'CLOSED';
  const qtyNum = Number(qty);
  const canSubmit = selected && qtyNum > 0 && qtyNum <= maxQty && selectedProject && !projectClosed && selectedWorker;

  const handleSubmit = () => {
    if (!canSubmit || !selected || !selectedProject || !selectedWorker) return;
    onDispatch(
      selected.code,
      selected.name,
      selected.unit,
      qtyNum,
      selectedProject.id,
      selectedProject.name,
      selectedWorker.id,
      selectedWorker.fullName ?? selectedWorker.username,
      notes.trim(),
    );
    setSelectedConsumableId(''); setQty(''); setProjectId(''); setWorkerId(''); setNotes('');
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md" aria-describedby="dispatch-desc">
        <DialogHeader>
          <DialogTitle>{t('dispatch.dialog.title')}</DialogTitle>
          <DialogDescription id="dispatch-desc">{t('dispatch.dialog.description')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Supply selector */}
          <div>
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{`${t('dispatch.dialog.supply')} *`}</label>
            <Select value={selectedConsumableId} onValueChange={v => { setSelectedConsumableId(v); setQty(''); }}>
              <SelectTrigger className="mt-1 h-9 border-[#D4D4D8] text-sm"><SelectValue placeholder={t('dispatch.dialog.supplyPlaceholder')} /></SelectTrigger>
              <SelectContent>
                {consumables
                  .filter(c => c.currentStock > 0)
                  .map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      [{c.code}] {c.name} (stock: {c.currentStock} {c.unit})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quantity */}
          <div>
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{`${t('dispatch.dialog.quantity')} *`}</label>
            <Input
              type="number" min={1} max={maxQty}
              value={qty} onChange={e => setQty(e.target.value)}
              className="mt-1 h-9 border-[#D4D4D8] text-sm"
              placeholder={selected ? t('dispatch.dialog.maxQty', { max: maxQty }) : t('dispatch.dialog.selectFirst')}
              disabled={!selectedConsumableId}
            />
            {selected && (
              <p className="text-[11px] text-[#71717A] mt-1">
                {t('dispatch.dialog.available', { stock: selected.currentStock, unit: selected.unit })}
                {qtyNum > maxQty && <span className="text-red-600 ml-1">{t('dispatch.dialog.exceedsStock')}</span>}
              </p>
            )}
          </div>

          {/* Project */}
          <div>
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{`${t('dispatch.dialog.project')} *`}</label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="mt-1 h-9 border-[#D4D4D8] text-sm"><SelectValue placeholder={t('dispatch.dialog.projectPlaceholder')} /></SelectTrigger>
              <SelectContent>
                {projects.map(p => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}
                    {p.status === 'CLOSED' && <span className="ml-1 text-red-600 text-[10px] font-semibold">CLOSED</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {projectClosed && (
              <p className="text-[11px] text-red-600 mt-1">{t('dispatch.dialog.closedProject')}</p>
            )}
          </div>

          {/* Requested by */}
          <div>
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{`${t('dispatch.dialog.requestedBy')} *`}</label>
            <Select value={workerId} onValueChange={setWorkerId}>
              <SelectTrigger className="mt-1 h-9 border-[#D4D4D8] text-sm"><SelectValue placeholder={t('dispatch.dialog.workerPlaceholder')} /></SelectTrigger>
              <SelectContent>
                {workers.map(w => (
                  <SelectItem key={w.id} value={String(w.id)}>
                    {w.fullName ?? w.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div>
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('dispatch.dialog.notes')}</label>
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)}
              className="mt-1 w-full border border-[#D4D4D8] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 resize-none"
              rows={2} placeholder={t('dispatch.dialog.notesPlaceholder')}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-[#D4D4D8]">{t('buttons.cancel', { ns: 'common' })}</Button>
          <Button disabled={!canSubmit} onClick={handleSubmit} className="bg-amber-500 hover:bg-amber-600 text-white">{t('dispatch.dialog.submit')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
