// ConsumableInventory.tsx — Consumable supplies inventory management

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Package, CheckCircle, AlertTriangle, CircleX, Boxes,
  Plus, Search, MoreHorizontal, X, RotateCcw, ChevronLeft, ChevronRight,
  Loader2, RefreshCw,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { StatCard } from './StatCard';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from './ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from './ui/select';
import { toast } from 'sonner';
import {
  listConsumables, createConsumable, updateConsumable, getConsumableDispatches,
  type ConsumableResponse, type DispatchResponse,
} from '../services/warehouse';

// Types

type StockStatus = 'In Stock' | 'Low Stock' | 'Out of Stock';

interface ConsumableItem {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  minimumStock: number;
  lastRestocked: string | null;
  notes?: string;
}

// Constants

const CONSUMABLE_CATEGORIES = ['Fasteners', 'Safety Gear', 'Abrasives', 'Adhesives & Tape', 'Electrical', 'General'];
const UNIT_OPTIONS = ['pcs', 'box', 'pair', 'roll', 'pack', 'set', 'bag', 'liter'];
const ITEMS_PER_PAGE = 8;

// Helpers

function mapConsumableResponse(c: ConsumableResponse): ConsumableItem {
  return {
    id: String(c.id),
    code: c.code,
    name: c.name,
    category: c.category,
    unit: c.unit,
    currentStock: c.currentStock,
    minimumStock: c.minimumStock,
    lastRestocked: c.lastRestocked ?? null,
    notes: c.notes ?? undefined,
  };
}

function getStockStatus(item: ConsumableItem): StockStatus {
  if (item.currentStock === 0) return 'Out of Stock';
  if (item.currentStock <= item.minimumStock) return 'Low Stock';
  return 'In Stock';
}

function fmtDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_KEYS: Record<StockStatus, string> = {
  'In Stock': 'consumables.status.inStock',
  'Low Stock': 'consumables.status.lowStock',
  'Out of Stock': 'consumables.status.outOfStock',
};

function StockStatusBadge({ status }: { status: StockStatus }) {
  const { t } = useTranslation('inventory');
  const cfg: Record<StockStatus, { bg: string; dot: string }> = {
    'In Stock':     { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
    'Low Stock':    { bg: 'bg-amber-50 text-amber-700 border-amber-200',      dot: 'bg-amber-500'   },
    'Out of Stock': { bg: 'bg-red-50 text-red-600 border-red-200',            dot: 'bg-red-500'     },
  };
  const c = cfg[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${c.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {t(STATUS_KEYS[status])}
    </span>
  );
}

// Main component

export function ConsumableInventory({ onNavigate }: { onNavigate?: (section: string) => void }) {
  const { t } = useTranslation('inventory');
  const [items, setItems] = useState<ConsumableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);

  // Modals
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<ConsumableItem | null>(null);
  const [restockItem, setRestockItem] = useState<ConsumableItem | null>(null);
  const [historyItem, setHistoryItem] = useState<ConsumableItem | null>(null);

  // Load from API
  const loadItems = useCallback(() => {
    setLoading(true);
    listConsumables()
      .then(res => setItems(res.map(mapConsumableResponse)))
      .catch(() => toast.error(t('inventory:toast.loadConsumablesError', 'Failed to load consumables')))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadItems(); }, [loadItems]);

  // Client-side filtering (search, category, status)
  const filtered = items.filter(item => {
    const matchSearch = search === '' ||
      item.code.toLowerCase().includes(search.toLowerCase()) ||
      item.name.toLowerCase().includes(search.toLowerCase());
    const matchCategory = categoryFilter === 'all' || item.category === categoryFilter;
    const status = getStockStatus(item);
    const matchStatus = statusFilter === 'all' || status === statusFilter;
    return matchSearch && matchCategory && matchStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  // KPIs
  const inStock    = items.filter(i => getStockStatus(i) === 'In Stock').length;
  const lowStock   = items.filter(i => getStockStatus(i) === 'Low Stock').length;
  const outOfStock = items.filter(i => getStockStatus(i) === 'Out of Stock').length;
  const totalUnits = items.reduce((sum, i) => sum + i.currentStock, 0);

  // Handlers
  const handleAddConsumable = (payload: Omit<ConsumableItem, 'id' | 'code' | 'lastRestocked'>) => {
    createConsumable({
      name:         payload.name,
      category:     payload.category,
      unit:         payload.unit,
      currentStock: payload.currentStock,
      minimumStock: payload.minimumStock,
      notes:        payload.notes || undefined,
    })
      .then(res => {
        setAddOpen(false);
        toast.success(t('inventory:toast.consumableAdded', 'Added {{code}} — {{name}}', { code: res.code, name: res.name }));
        loadItems();
      })
      .catch(() => toast.error(t('inventory:toast.addSupplyError', 'Failed to add supply')));
  };

  const handleEditConsumable = (updated: ConsumableItem) => {
    updateConsumable(Number(updated.id), {
      name:         updated.name,
      category:     updated.category,
      unit:         updated.unit,
      minimumStock: updated.minimumStock,
      notes:        updated.notes || undefined,
    })
      .then(res => {
        setEditItem(null);
        toast.success(t('inventory:toast.consumableUpdated', 'Updated {{code}} — {{name}}', { code: res.code, name: res.name }));
        loadItems();
      })
      .catch(() => toast.error(t('inventory:toast.updateSupplyError', 'Failed to update supply')));
  };

  const handleRestock = (itemId: string, quantity: number) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    updateConsumable(Number(itemId), { currentStock: item.currentStock + quantity })
      .then(res => {
        setRestockItem(null);
        toast.success(t('inventory:toast.consumableRestocked', 'Restocked {{code}} — +{{quantity}} units (new stock: {{stock}})', { code: res.code, quantity, stock: res.currentStock }));
        loadItems();
      })
      .catch(() => toast.error(t('inventory:toast.restockError', 'Failed to restock')));
  };

  const resetFilters = () => { setSearch(''); setCategoryFilter('all'); setStatusFilter('all'); setPage(1); };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard icon={Package}       title={t('consumables.kpi.totalItems')}  value={loading ? '…' : items.length}  subtitle={t('consumables.kpi.supplyTypes')}    iconBgColor="bg-amber-50"      iconColor="text-amber-600"   />
        <StatCard icon={CheckCircle}   title={t('consumables.kpi.inStock')}     value={loading ? '…' : inStock}       subtitle={t('consumables.kpi.aboveMinimum')}   iconBgColor="bg-emerald-50"    iconColor="text-emerald-600" />
        <StatCard icon={AlertTriangle} title={t('consumables.kpi.lowStock')}    value={loading ? '…' : lowStock}      subtitle={t('consumables.kpi.needRestocking')} iconBgColor="bg-amber-50"      iconColor="text-amber-600"   />
        <StatCard icon={CircleX}       title={t('consumables.kpi.outOfStock')} value={loading ? '…' : outOfStock}    subtitle={t('consumables.kpi.noUnitsLeft')}   iconBgColor="bg-red-50"        iconColor="text-red-600"     />
        <StatCard icon={Boxes}         title={t('consumables.kpi.totalUnits')}  value={loading ? '…' : totalUnits}    subtitle={t('consumables.kpi.combinedStock')}  iconBgColor="bg-[#F97316]/10"  iconColor="text-[#F97316]"   />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 flex-1 w-full">
          <div className="relative flex-1 min-w-0 w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#71717A]" />
            <Input
              placeholder={t('consumables.search')}
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="pl-9 h-9 border-[#D4D4D8] text-sm"
            />
          </div>
          <Select value={categoryFilter} onValueChange={v => { setCategoryFilter(v); setPage(1); }}>
            <SelectTrigger className="h-9 w-full sm:w-[160px] border-[#D4D4D8] text-sm">
              <SelectValue placeholder={t('consumables.filter.category')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('labels.allCategories', { ns: 'common' })}</SelectItem>
              {CONSUMABLE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="h-9 w-full sm:w-[140px] border-[#D4D4D8] text-sm">
              <SelectValue placeholder={t('consumables.filter.status')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('labels.allStatuses', { ns: 'common' })}</SelectItem>
              <SelectItem value="In Stock">{t('consumables.status.inStock')}</SelectItem>
              <SelectItem value="Low Stock">{t('consumables.status.lowStock')}</SelectItem>
              <SelectItem value="Out of Stock">{t('consumables.status.outOfStock')}</SelectItem>
            </SelectContent>
          </Select>
          {(search || categoryFilter !== 'all' || statusFilter !== 'all') && (
            <Button variant="ghost" size="sm" onClick={resetFilters} className="text-xs text-[#71717A] h-9 gap-1">
              <RotateCcw className="w-3 h-3" /> {t('buttons.reset', { ns: 'common' })}
            </Button>
          )}
        </div>
        <Button onClick={() => setAddOpen(true)} className="bg-amber-500 hover:bg-amber-600 text-white h-9 gap-1.5">
          <Plus className="w-4 h-4" /> {t('consumables.addSupply')}
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
                    {[t('consumables.table.code'), t('consumables.table.itemName'), t('consumables.table.category'), t('consumables.table.unit'), t('consumables.table.stock'), t('consumables.table.minStock'), t('consumables.table.status'), t('consumables.table.actions')].map(h => (
                      <th key={h} className="text-left text-[11px] font-semibold text-[#71717A] uppercase tracking-wider px-4 py-2.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paged.map(item => {
                    const status = getStockStatus(item);
                    const stockPct = Math.min(100, (item.currentStock / Math.max(item.currentStock, item.minimumStock * 2)) * 100);
                    const barColor = status === 'Out of Stock' ? 'bg-red-500' : status === 'Low Stock' ? 'bg-amber-500' : 'bg-emerald-500';
                    const stockTextColor = status === 'Out of Stock' ? 'text-red-600' : status === 'Low Stock' ? 'text-amber-600' : 'text-[#0A0A0A]';
                    return (
                      <tr key={item.id} className="border-t border-[#D4D4D8]/50 hover:bg-[#FAFAFA]/50 transition-colors">
                        <td className="px-4 py-3 text-sm font-mono text-[#71717A]">{item.code}</td>
                        <td className="px-4 py-3 text-sm font-medium text-[#0A0A0A]">{item.name}</td>
                        <td className="px-4 py-3 text-sm text-[#71717A]">{item.category}</td>
                        <td className="px-4 py-3 text-sm text-[#71717A]">{item.unit}</td>
                        <td className="px-4 py-3">
                          <span className={`text-sm font-semibold ${stockTextColor}`}>{item.currentStock}</span>
                          <div className="h-1 rounded-full bg-[#FAFAFA] mt-1 w-16">
                            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${stockPct}%` }} />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-[#71717A]">{item.minimumStock}</td>
                        <td className="px-4 py-3"><StockStatusBadge status={status} /></td>
                        <td className="px-4 py-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal className="w-4 h-4 text-[#71717A]" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setEditItem(item)} className="text-sm cursor-pointer">{t('consumables.editItem')}</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setRestockItem(item)} className="text-sm cursor-pointer">{t('consumables.restock')}</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setHistoryItem(item)} className="text-sm cursor-pointer">{t('consumables.dispatchHistory')}</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                  {paged.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center">
                        <Package className="w-10 h-10 text-[#D4D4D8] mx-auto mb-2" />
                        <p className="text-sm text-[#71717A]">{t('consumables.noConsumables')}</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-[#D4D4D8]/50">
              {paged.map(item => {
                const status = getStockStatus(item);
                const stockTextColor = status === 'Out of Stock' ? 'text-red-600' : status === 'Low Stock' ? 'text-amber-600' : 'text-[#0A0A0A]';
                return (
                  <div key={item.id} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="text-[11px] font-mono text-[#71717A]">{item.code}</span>
                        <p className="text-sm font-medium text-[#0A0A0A]">{item.name}</p>
                      </div>
                      <StockStatusBadge status={status} />
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[#71717A]">
                      <span>{item.category}</span>
                      <span>&middot;</span>
                      <span className={`font-semibold ${stockTextColor}`}>{item.currentStock} {item.unit}</span>
                      <span>&middot;</span>
                      <span>{t('consumables.min', { value: item.minimumStock })}</span>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => setEditItem(item)} className="text-xs text-[#F97316] font-medium">{t('consumables.edit')}</button>
                      <button onClick={() => setRestockItem(item)} className="text-xs text-amber-600 font-medium">{t('consumables.restock')}</button>
                      <button onClick={() => setHistoryItem(item)} className="text-xs text-[#71717A] font-medium">{t('consumables.viewHistory')}</button>
                    </div>
                  </div>
                );
              })}
              {paged.length === 0 && (
                <div className="p-8 text-center">
                  <Package className="w-10 h-10 text-[#D4D4D8] mx-auto mb-2" />
                  <p className="text-sm text-[#71717A]">{t('consumables.noConsumables')}</p>
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
            {t('consumables.showing', { from: (safePage - 1) * ITEMS_PER_PAGE + 1, to: Math.min(safePage * ITEMS_PER_PAGE, filtered.length), total: filtered.length })}
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

      {/* Modals */}
      <AddConsumableModal open={addOpen} onClose={() => setAddOpen(false)} onAdd={handleAddConsumable} />

      {editItem && (
        <EditConsumableModal item={editItem} onClose={() => setEditItem(null)} onSave={handleEditConsumable} />
      )}

      {restockItem && (
        <RestockModal item={restockItem} onClose={() => setRestockItem(null)} onRestock={handleRestock} />
      )}

      {historyItem && (
        <DispatchHistoryModal item={historyItem} onClose={() => setHistoryItem(null)} />
      )}
    </div>
  );
}

// ── Modals ────────────────────────────────────────────────────────────────────

// Add

function AddConsumableModal({ open, onClose, onAdd }: {
  open: boolean;
  onClose: () => void;
  onAdd: (item: Omit<ConsumableItem, 'id' | 'code' | 'lastRestocked'>) => void;
}) {
  const { t } = useTranslation('inventory');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('');
  const [stock, setStock] = useState('');
  const [minStock, setMinStock] = useState('');
  const [notes, setNotes] = useState('');

  const canSubmit = name.trim() && category && unit && Number(stock) >= 0 && Number(minStock) >= 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onAdd({
      name: name.trim(),
      category,
      unit,
      currentStock: Number(stock),
      minimumStock: Number(minStock),
      notes: notes.trim() || undefined,
    });
    setName(''); setCategory(''); setUnit(''); setStock(''); setMinStock(''); setNotes('');
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md" aria-describedby="add-consumable-desc">
        <DialogHeader>
          <DialogTitle>{t('consumables.dialog.addTitle')}</DialogTitle>
          <DialogDescription id="add-consumable-desc">{t('consumables.dialog.addDescription')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('consumables.dialog.name')} *</label>
            <Input value={name} onChange={e => setName(e.target.value)} className="mt-1 h-9 border-[#D4D4D8] text-sm" placeholder='e.g. Concrete Nails 3"' />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('consumables.dialog.category')} *</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="mt-1 h-9 border-[#D4D4D8] text-sm"><SelectValue placeholder={t('consumables.dialog.select')} /></SelectTrigger>
                <SelectContent>
                  {CONSUMABLE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('consumables.dialog.unit')} *</label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger className="mt-1 h-9 border-[#D4D4D8] text-sm"><SelectValue placeholder={t('consumables.dialog.select')} /></SelectTrigger>
                <SelectContent>
                  {UNIT_OPTIONS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('consumables.dialog.initialStock')} *</label>
              <Input type="number" min={0} value={stock} onChange={e => setStock(e.target.value)} className="mt-1 h-9 border-[#D4D4D8] text-sm" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('consumables.dialog.minimumStock')} *</label>
              <Input type="number" min={0} value={minStock} onChange={e => setMinStock(e.target.value)} className="mt-1 h-9 border-[#D4D4D8] text-sm" />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('consumables.dialog.notes')}</label>
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)}
              className="mt-1 w-full border border-[#D4D4D8] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 resize-none"
              rows={2} placeholder={t('consumables.dialog.notesPlaceholder')}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-[#D4D4D8]">{t('buttons.cancel', { ns: 'common' })}</Button>
          <Button disabled={!canSubmit} onClick={handleSubmit} className="bg-amber-500 hover:bg-amber-600 text-white">{t('consumables.addSupply')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Edit

function EditConsumableModal({ item, onClose, onSave }: {
  item: ConsumableItem;
  onClose: () => void;
  onSave: (updated: ConsumableItem) => void;
}) {
  const { t } = useTranslation('inventory');
  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState(item.category);
  const [unit, setUnit] = useState(item.unit);
  const [minStock, setMinStock] = useState(String(item.minimumStock));
  const [notes, setNotes] = useState(item.notes ?? '');

  const canSubmit = name.trim() && category && unit && Number(minStock) >= 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSave({ ...item, name: name.trim(), category, unit, minimumStock: Number(minStock), notes: notes.trim() || undefined });
  };

  return (
    <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md" aria-describedby="edit-consumable-desc">
        <DialogHeader>
          <DialogTitle>{t('consumables.dialog.editTitle', { code: item.code })}</DialogTitle>
          <DialogDescription id="edit-consumable-desc">{t('consumables.dialog.editDescription')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('consumables.dialog.code')}</label>
            <Input value={item.code} disabled className="mt-1 h-9 bg-[#FAFAFA] text-sm" />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('consumables.dialog.name')} *</label>
            <Input value={name} onChange={e => setName(e.target.value)} className="mt-1 h-9 border-[#D4D4D8] text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('consumables.dialog.category')}</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="mt-1 h-9 border-[#D4D4D8] text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONSUMABLE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('consumables.dialog.unit')}</label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger className="mt-1 h-9 border-[#D4D4D8] text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNIT_OPTIONS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('consumables.dialog.minimumStock')} *</label>
            <Input type="number" min={0} value={minStock} onChange={e => setMinStock(e.target.value)} className="mt-1 h-9 border-[#D4D4D8] text-sm" />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('consumables.dialog.notes')}</label>
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)}
              className="mt-1 w-full border border-[#D4D4D8] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 resize-none"
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-[#D4D4D8]">{t('buttons.cancel', { ns: 'common' })}</Button>
          <Button disabled={!canSubmit} onClick={handleSubmit} className="bg-amber-500 hover:bg-amber-600 text-white">{t('consumables.dialog.saveChanges')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Restock

function RestockModal({ item, onClose, onRestock }: {
  item: ConsumableItem;
  onClose: () => void;
  onRestock: (itemId: string, quantity: number) => void;
}) {
  const { t } = useTranslation('inventory');
  const [qty, setQty] = useState('');
  const canSubmit = Number(qty) > 0;

  return (
    <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-sm" aria-describedby="restock-desc">
        <DialogHeader>
          <DialogTitle>{t('consumables.dialog.restockTitle', { code: item.code })}</DialogTitle>
          <DialogDescription id="restock-desc">{t('consumables.dialog.currentStockInfo', { name: item.name, stock: item.currentStock, unit: item.unit })}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('consumables.dialog.quantityToAdd')} *</label>
            <Input type="number" min={1} value={qty} onChange={e => setQty(e.target.value)} className="mt-1 h-9 border-[#D4D4D8] text-sm" placeholder="e.g. 20" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-[#D4D4D8]">{t('buttons.cancel', { ns: 'common' })}</Button>
          <Button disabled={!canSubmit} onClick={() => onRestock(item.id, Number(qty))} className="bg-amber-500 hover:bg-amber-600 text-white">{t('consumables.restock')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Dispatch History (fetches from API)

function DispatchHistoryModal({ item, onClose }: {
  item: ConsumableItem;
  onClose: () => void;
}) {
  const { t } = useTranslation('inventory');
  const [records, setRecords] = useState<DispatchResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    getConsumableDispatches(Number(item.id))
      .then(setRecords)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [item.id]);

  useEffect(() => { load(); }, [load]);

  return (
    <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-lg" aria-describedby="history-desc">
        <DialogHeader>
          <DialogTitle>{t('consumables.dialog.dispatchHistoryTitle', { code: item.code })}</DialogTitle>
          <DialogDescription id="history-desc">{item.name}</DialogDescription>
        </DialogHeader>
        <div className="py-2 max-h-80 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <AlertTriangle className="w-10 h-10 text-red-300 mx-auto mb-2" />
              <p className="text-sm text-red-600">{t('consumables.dialog.dispatchHistoryError', "We couldn't load the dispatch history.")}</p>
              <button
                type="button"
                onClick={load}
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-red-700 hover:text-red-900 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />{t('buttons.retry', { ns: 'common' })}
              </button>
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-8">
              <Package className="w-10 h-10 text-[#D4D4D8] mx-auto mb-2" />
              <p className="text-sm text-[#71717A]">{t('consumables.dialog.noDispatchRecords')}</p>
            </div>
          ) : (
            <div className="space-y-0">
              {records.map((r, i) => (
                <div key={r.id} className="relative pl-6 pb-4 last:pb-0">
                  {i < records.length - 1 && (
                    <div className="absolute left-[9px] top-3 bottom-0 w-px bg-[#D4D4D8]" />
                  )}
                  <div className="absolute left-0 top-1.5 w-[18px] h-[18px] rounded-full bg-amber-100 border-2 border-amber-400 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  </div>
                  <div className="ml-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-[#0A0A0A]">{fmtDate(r.date)}</span>
                      <span className="text-xs text-amber-600 font-semibold">-{r.quantity} {r.unit}</span>
                    </div>
                    <p className="text-xs text-[#71717A] mt-0.5">
                      {r.project} &middot; {t('consumables.requestedBy', { name: r.requestedBy })}
                    </p>
                    {r.notes && <p className="text-xs text-[#71717A] italic mt-0.5">{r.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-[#D4D4D8]">{t('buttons.close', { ns: 'common' })}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
