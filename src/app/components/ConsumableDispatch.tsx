import { useScreenState } from '../workspace/WorkspaceState';
import { money } from './budgets/bits';
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
import { SectionHeader } from './workspace/SectionChrome';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from './ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from './ui/select';
import { toast } from 'sonner';
import {
  getAllDispatches, dispatchConsumable, listConsumables, listWarehouseProjects,
  type DispatchResponse, type ConsumableResponse, type WarehouseProjectResponse,
} from '../services/warehouse';
import { listActiveUsers, type UserDTO } from '../services/users';
import { FIELD_LIMITS } from '../../shared/fieldLimits';
import { BudgetLineItemSelector } from './budgets/wbs/BudgetLineItemSelector';

// Types

interface DispatchItem {
  id: string;
  consumableCode: string;
  consumableName: string;
  unit: string;
  quantity: number;
  totalCostCents: number;
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
    totalCostCents: d.totalCostCents ?? 0,
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
  const [projects, setProjects] = useState<WarehouseProjectResponse[]>([]);
  const [workers, setWorkers] = useState<UserDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useScreenState('pagina', 1);
  const [modalOpen, setModalOpen] = useState(false);

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([
      getAllDispatches({ page: 0, size: 500 }),
      listConsumables(),
      listWarehouseProjects({ status: 'ACTIVE', size: 100 }),
      listActiveUsers(),
    ])
      .then(([dispatchPage, consumableList, projectsPage, userList]) => {
        setDispatches(dispatchPage.content.map(mapDispatchResponse));
        setConsumables(consumableList);
        setProjects(projectsPage.content);
        setWorkers(userList);
      })
      .catch(() => toast.error(t('inventory:toast.loadDispatchError', 'Failed to load dispatch data')))
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
    budgetLineItemId?: number | null,
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
      ...(budgetLineItemId != null ? { budgetLineItemId } : {}),
    })
      .then(res => {
        setModalOpen(false);
        toast.success(t('inventory:toast.dispatched', 'Dispatched {{quantity}} {{unit}} of {{name}} → {{project}}', { quantity: res.quantity, unit: res.unit, name: res.consumableName, project: res.project }));
        loadData();
      })
      .catch(() => toast.error(t('inventory:toast.dispatchError', 'Failed to dispatch supply. Check stock and try again.')));
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard appearance="workspace" icon={ArrowRight}  title={t('dispatch.kpi.totalDispatches')} value={loading ? '…' : totalDispatches} subtitle={t('dispatch.kpi.dispatchRecords')}    iconBgColor="bg-amber-50"     iconColor="text-amber-600"   />
        <StatCard appearance="workspace" icon={Package}     title={t('dispatch.kpi.unitsDispatched')} value={loading ? '…' : totalUnits}      subtitle={t('dispatch.kpi.totalQuantity')}      iconBgColor="bg-emerald-50"   iconColor="text-emerald-600" />
        <StatCard appearance="workspace" icon={Building2}   title={t('dispatch.kpi.activeProjects')}  value={loading ? '…' : uniqueProjects}  subtitle={t('dispatch.kpi.receivingSupplies')}  iconBgColor="bg-[#F97316]/10" iconColor="text-[#F97316]"   />
      </div>

      {/* Header */}
      <SectionHeader kicker={t('warehouse.panelLabel')} title={t('dispatch.title')} description={t('dispatch.subtitle')} action={<Button onClick={() => setModalOpen(true)} disabled={loading} className="bg-[#0A0A0A] hover:bg-[#F97316] text-[#F5F1E8] hover:text-[#0A0A0A] h-9 gap-1.5 rounded-none font-bt-mono uppercase">
          <ArrowRight className="w-4 h-4" /> {t('dispatch.dispatchSupply')}
        </Button>} />

      {/* Table */}
      <div className="bg-white border border-[#DBD0BB] overflow-hidden">
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
                  <tr className="bg-[#FAF7F0]">
                    {[t('dispatch.table.date'), t('dispatch.table.item'), t('dispatch.table.qty'), t('dispatch.table.unit'), t('dispatch.table.project'), t('dispatch.table.requestedBy'), t('dispatch.table.notes')].map(h => (
                      <th key={h} className="text-left font-bt-mono text-[11px] font-semibold text-[#8A8175] uppercase tracking-wider px-4 py-2.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paged.map(d => (
                    <tr key={d.id} className="border-t border-[#DBD0BB]/50 hover:bg-[#FAF7F0]/50 transition-colors">
                      <td className="px-4 py-3 text-sm text-[#0A0A0A] whitespace-nowrap">{fmtDate(d.date)}</td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-[#0A0A0A]">{d.consumableName}</p>
                        <p className="text-[11px] text-[#8A8175] font-bt-mono">{d.consumableCode}</p>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-[#0A0A0A]">{d.quantity}<span className="block text-xs text-[#8A8175]">{money(d.totalCostCents / 100)}</span></td>
                      <td className="px-4 py-3 text-sm text-[#8A8175]">{d.unit}</td>
                      <td className="px-4 py-3 text-sm text-[#0A0A0A]">{d.project}</td>
                      <td className="px-4 py-3 text-sm text-[#8A8175]">{d.requestedBy}</td>
                      <td className="px-4 py-3 text-sm text-[#8A8175]">{d.notes || '—'}</td>
                    </tr>
                  ))}
                  {paged.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center">
                        <ArrowRight className="w-10 h-10 text-[#DBD0BB] mx-auto mb-2" />
                        <p className="text-sm text-[#8A8175]">{t('dispatch.noDispatches')}</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-[#DBD0BB]/50">
              {paged.map(d => (
                <div key={d.id} className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-[#0A0A0A]">{d.consumableName}</p>
                    <span className="text-sm font-semibold text-[#0A0A0A]">{d.quantity} {d.unit} · {money(d.totalCostCents / 100)}</span>
                  </div>
                  <p className="text-[11px] font-bt-mono text-[#8A8175]">{d.consumableCode}</p>
                  <p className="text-xs text-[#8A8175] mt-1">{d.project} &middot; {d.requestedBy}</p>
                  <p className="text-xs text-[#8A8175]">{fmtDate(d.date)}</p>
                  {d.notes && <p className="text-xs text-[#8A8175] italic mt-0.5">{d.notes}</p>}
                </div>
              ))}
              {paged.length === 0 && (
                <div className="p-8 text-center">
                  <ArrowRight className="w-10 h-10 text-[#DBD0BB] mx-auto mb-2" />
                  <p className="text-sm text-[#8A8175]">{t('dispatch.noDispatches')}</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-[#8A8175]">
            {t('dispatch.showing', { from: (safePage - 1) * ITEMS_PER_PAGE + 1, to: Math.min(safePage * ITEMS_PER_PAGE, dispatches.length), total: dispatches.length })}
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setPage(p => p - 1)} className="h-8 w-8 p-0 border-[#DBD0BB]">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            {Array.from({ length: totalPages }, (_, i) => (
              <Button
                key={i + 1}
                variant={safePage === i + 1 ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPage(i + 1)}
                className={`h-8 w-8 p-0 ${safePage === i + 1 ? 'bg-[#0A0A0A] hover:bg-[#F97316] text-[#F5F1E8] hover:text-[#0A0A0A] border-amber-500' : 'border-[#DBD0BB]'}`}
              >
                {i + 1}
              </Button>
            ))}
            <Button variant="outline" size="sm" disabled={safePage >= totalPages} onClick={() => setPage(p => p + 1)} className="h-8 w-8 p-0 border-[#DBD0BB]">
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
  projects: WarehouseProjectResponse[];
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
    budgetLineItemId?: number | null,
  ) => void;
}) {
  const { t } = useTranslation('inventory');
  const [selectedConsumableId, setSelectedConsumableId] = useState('');
  const [qty, setQty] = useState('');
  const [projectId, setProjectId] = useState('');
  const [budgetLineItemId, setBudgetLineItemId] = useState<number | null>(null);
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
      budgetLineItemId,
    );
    setSelectedConsumableId(''); setQty(''); setProjectId(''); setWorkerId(''); setNotes('');
    setBudgetLineItemId(null);
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="rounded-none sm:max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto" aria-describedby="dispatch-desc">
        <DialogHeader>
          <DialogTitle className="font-bt-display uppercase text-2xl">{t('dispatch.dialog.title')}</DialogTitle>
          <DialogDescription id="dispatch-desc">{t('dispatch.dialog.description')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Supply selector */}
          <div>
            <label className="font-bt-mono text-[11px] font-semibold text-[#8A8175] uppercase tracking-wide">{`${t('dispatch.dialog.supply')} *`}</label>
            <Select value={selectedConsumableId} onValueChange={v => { setSelectedConsumableId(v); setQty(''); }}>
              <SelectTrigger className="rounded-none mt-1 h-9 border-[#DBD0BB] text-sm"><SelectValue placeholder={t('dispatch.dialog.supplyPlaceholder')} /></SelectTrigger>
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
            <label className="font-bt-mono text-[11px] font-semibold text-[#8A8175] uppercase tracking-wide">{`${t('dispatch.dialog.quantity')} *`}</label>
            <Input
              type="number" min={1} max={maxQty}
              value={qty} onChange={e => setQty(e.target.value)}
              className="mt-1 h-9 border-[#DBD0BB] text-sm"
              placeholder={selected ? t('dispatch.dialog.maxQty', { max: maxQty }) : t('dispatch.dialog.selectFirst')}
              disabled={!selectedConsumableId}
            />
            {selected && (
              <p className="text-[11px] text-[#8A8175] mt-1">
                {t('dispatch.dialog.available', { stock: selected.currentStock, unit: selected.unit })}
                {qtyNum > maxQty && <span className="text-red-600 ml-1">{t('dispatch.dialog.exceedsStock')}</span>}
              </p>
            )}
          </div>

          {selected && <div className="border border-[#E7E1D5] bg-[#FBF8F2] p-3" aria-live="polite">
            <p className="text-sm font-semibold">{t('dispatch.dialog.estimatedCost', { quantity: qtyNum || 0, unitCost: money((selected.unitCostCents ?? 0) / 100), total: money((qtyNum || 0) * (selected.unitCostCents ?? 0) / 100) })}</p>
            <p className="text-xs text-[#8A8175] mt-1">{t('dispatch.dialog.budgetCostNote')}</p>
          </div>}

          {/* Project */}
          <div>
            <label className="font-bt-mono text-[11px] font-semibold text-[#8A8175] uppercase tracking-wide">{`${t('dispatch.dialog.project')} *`}</label>
            <Select value={projectId} onValueChange={value => { setProjectId(value); setBudgetLineItemId(null); }}>
              <SelectTrigger className="rounded-none mt-1 h-9 border-[#DBD0BB] text-sm"><SelectValue placeholder={t('dispatch.dialog.projectPlaceholder')} /></SelectTrigger>
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

          <BudgetLineItemSelector projectId={projectId ? Number(projectId) : null} value={budgetLineItemId} onChange={setBudgetLineItemId} />

          {/* Requested by */}
          <div>
            <label className="font-bt-mono text-[11px] font-semibold text-[#8A8175] uppercase tracking-wide">{`${t('dispatch.dialog.requestedBy')} *`}</label>
            <Select value={workerId} onValueChange={setWorkerId}>
              <SelectTrigger className="rounded-none mt-1 h-9 border-[#DBD0BB] text-sm"><SelectValue placeholder={t('dispatch.dialog.workerPlaceholder')} /></SelectTrigger>
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
            <label className="font-bt-mono text-[11px] font-semibold text-[#8A8175] uppercase tracking-wide">{t('dispatch.dialog.notes')}</label>
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)}
              className="mt-1 w-full border border-[#DBD0BB] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 resize-none"
              rows={2} maxLength={FIELD_LIMITS.LONG_TEXT} placeholder={t('dispatch.dialog.notesPlaceholder')}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="rounded-none border-[#DBD0BB]">{t('buttons.cancel', { ns: 'common' })}</Button>
          <Button disabled={!canSubmit} onClick={handleSubmit} className="rounded-none bg-[#0A0A0A] hover:bg-[#F97316] text-[#F5F1E8] hover:text-[#0A0A0A]">{t('dispatch.dialog.submit')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
