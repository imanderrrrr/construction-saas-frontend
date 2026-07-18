import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Building2, Plus, Search, Trash2, Pencil, Loader2,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { Button } from './ui/button';
import { StatCard } from './StatCard';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from './ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from './ui/select';
import { EmptyState } from './EmptyState';
import { toast } from 'sonner';
import {
  listOfficeExpenses, createOfficeExpense, updateOfficeExpense, deleteOfficeExpense,
  type OfficeExpense,
} from '../services/officeExpenses';
import { FIELD_LIMITS } from '../../shared/fieldLimits';

// Helpers

import { fmtDate, businessToday } from '../helpers/dateTime';

function fmtAmount(n: number) {
  return `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

const CATEGORIES = [
  'office_supplies', 'cleaning', 'food_beverages',
  'tech_equipment', 'utilities', 'furniture', 'other',
] as const;

type Category = typeof CATEGORIES[number];

const ITEMS_PER_PAGE = 10;

// Category badge

function CategoryBadge({ category }: { category: string }) {
  const { t } = useTranslation('admin');
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FAFAFA] text-[#0A0A0A] border border-[#D4D4D8]">
      {t(`officeExpense.category.${category}`, { defaultValue: category })}
    </span>
  );
}

// Component

export function OfficeExpenses() {
  const { t, i18n } = useTranslation(['admin', 'common']);
  const dateLoc = i18n.language === 'es' ? 'es' : 'en-US';

  const [items, setItems] = useState<OfficeExpense[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterSearch, setFilterSearch] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  // Dialogs
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<OfficeExpense | null>(null);
  const [deleteItem, setDeleteItem] = useState<OfficeExpense | null>(null);

  // Form state
  const [formDesc, setFormDesc] = useState('');
  const [formCategory, setFormCategory] = useState<Category>('other');
  const [formAmount, setFormAmount] = useState('');
  const [formDate, setFormDate] = useState(businessToday());
  const [formPurchasedBy, setFormPurchasedBy] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Fetch
  const fetchData = useCallback(async (page = 0) => {
    setLoading(true);
    try {
      const res = await listOfficeExpenses({
        category: filterCategory !== 'all' ? filterCategory : undefined,
        from: filterFrom || undefined,
        to: filterTo || undefined,
        search: filterSearch || undefined,
        page,
        size: ITEMS_PER_PAGE,
      });
      setItems(res.content);
      setTotalElements(res.totalElements);
      setTotalPages(res.totalPages);
      setCurrentPage(res.page);
    } catch {
      toast.error(t('admin:officeExpense.toast.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [filterCategory, filterFrom, filterTo, filterSearch, t]);

  useEffect(() => { fetchData(0); }, [fetchData]);

  // KPIs
  const totalAmount = items.reduce((s, e) => s + e.amount, 0);

  // Reset form
  function resetForm() {
    setFormDesc('');
    setFormCategory('other');
    setFormAmount('');
    setFormDate(businessToday());
    setFormPurchasedBy('');
    setFormNotes('');
  }

  // Open edit dialog
  function openEdit(item: OfficeExpense) {
    setFormDesc(item.description);
    setFormCategory(item.category as Category);
    setFormAmount(item.amount.toFixed(2));
    setFormDate(item.purchaseDate);
    setFormPurchasedBy(item.purchasedBy ?? '');
    setFormNotes(item.notes ?? '');
    setEditItem(item);
  }

  // Create
  async function handleCreate() {
    const amount = parseFloat(formAmount);
    if (!formDesc.trim() || isNaN(amount) || amount <= 0 || !formDate) {
      toast.warning(t('admin:officeExpense.validation.requiredFields'));
      return;
    }
    setSubmitting(true);
    try {
      await createOfficeExpense({
        description: formDesc.trim(),
        category: formCategory,
        amount,
        purchaseDate: formDate,
        purchasedBy: formPurchasedBy.trim() || undefined,
        notes: formNotes.trim() || undefined,
      });
      toast.success(t('admin:officeExpense.toast.created'));
      setShowCreate(false);
      resetForm();
      fetchData(currentPage);
    } catch {
      toast.error(t('admin:officeExpense.toast.createFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  // Update
  async function handleUpdate() {
    if (!editItem) return;
    const amount = parseFloat(formAmount);
    if (!formDesc.trim() || isNaN(amount) || amount <= 0 || !formDate) {
      toast.warning(t('admin:officeExpense.validation.requiredFields'));
      return;
    }
    setSubmitting(true);
    try {
      await updateOfficeExpense(editItem.id, {
        description: formDesc.trim(),
        category: formCategory,
        amount,
        purchaseDate: formDate,
        purchasedBy: formPurchasedBy.trim() || undefined,
        notes: formNotes.trim() || undefined,
      });
      toast.success(t('admin:officeExpense.toast.updated'));
      setEditItem(null);
      resetForm();
      fetchData(currentPage);
    } catch {
      toast.error(t('admin:officeExpense.toast.updateFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  // Delete
  async function handleDelete() {
    if (!deleteItem) return;
    setSubmitting(true);
    try {
      await deleteOfficeExpense(deleteItem.id);
      toast.success(t('admin:officeExpense.toast.deleted'));
      setDeleteItem(null);
      fetchData(currentPage);
    } catch {
      toast.error(t('admin:officeExpense.toast.deleteFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  // Form fields (shared between create and edit dialogs)
  function FormFields() {
    return (
      <div className="space-y-4">
        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-[#0A0A0A] mb-1">
            {t('admin:officeExpense.form.description')} *
          </label>
          <input
            type="text"
            value={formDesc}
            onChange={e => setFormDesc(e.target.value)}
            maxLength={FIELD_LIMITS.NOTE}
            placeholder={t('admin:officeExpense.form.descriptionPlaceholder')}
            className="w-full h-9 px-3 text-sm border border-[#D4D4D8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316]/30"
          />
        </div>

        {/* Category & Amount */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[#0A0A0A] mb-1">
              {t('admin:officeExpense.form.category')} *
            </label>
            <Select value={formCategory} onValueChange={v => setFormCategory(v as Category)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => (
                  <SelectItem key={c} value={c}>
                    {t(`admin:officeExpense.category.${c}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#0A0A0A] mb-1">
              {t('admin:officeExpense.form.amount')} *
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={formAmount}
              onChange={e => setFormAmount(e.target.value)}
              placeholder="0.00"
              className="w-full h-9 px-3 text-sm border border-[#D4D4D8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316]/30"
            />
          </div>
        </div>

        {/* Date & Purchased by */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[#0A0A0A] mb-1">
              {t('admin:officeExpense.form.purchaseDate')} *
            </label>
            <input
              type="date"
              value={formDate}
              onChange={e => setFormDate(e.target.value)}
              className="w-full h-9 px-3 text-sm border border-[#D4D4D8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316]/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#0A0A0A] mb-1">
              {t('admin:officeExpense.form.purchasedBy')}
            </label>
            <input
              type="text"
              value={formPurchasedBy}
              onChange={e => setFormPurchasedBy(e.target.value)}
              maxLength={FIELD_LIMITS.LEGACY_PERSON_NAME}
              placeholder={t('admin:officeExpense.form.purchasedByPlaceholder')}
              className="w-full h-9 px-3 text-sm border border-[#D4D4D8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316]/30"
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-[#0A0A0A] mb-1">
            {t('admin:officeExpense.form.notes')}
          </label>
          <textarea
            value={formNotes}
            onChange={e => setFormNotes(e.target.value)}
            rows={2}
            maxLength={FIELD_LIMITS.EXTENDED_NOTE}
            placeholder={t('admin:officeExpense.form.notesPlaceholder')}
            className="w-full px-3 py-2 text-sm border border-[#D4D4D8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 resize-none"
          />
        </div>
      </div>
    );
  }

  const tableHeaders = [
    t('admin:officeExpense.table.date'),
    t('admin:officeExpense.table.description'),
    t('admin:officeExpense.table.category'),
    t('admin:officeExpense.table.amount'),
    t('admin:officeExpense.table.purchasedBy'),
    t('admin:officeExpense.table.actions'),
  ];

  return (
    <div className="space-y-6 max-w-6xl">

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          icon={Building2}
          title={t('admin:officeExpense.kpi.totalExpenses')}
          value={loading ? '...' : String(totalElements)}
          subtitle={t('admin:officeExpense.kpi.allRecords')}
          iconBgColor="bg-blue-50"
          iconColor="text-blue-600"
        />
        <StatCard
          icon={Building2}
          title={t('admin:officeExpense.kpi.pageTotal')}
          value={loading ? '...' : fmtAmount(totalAmount)}
          subtitle={t('admin:officeExpense.kpi.currentPage')}
          iconBgColor="bg-emerald-50"
          iconColor="text-emerald-600"
        />
      </div>

      {/* Filters + actions */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-6 py-4 border-b border-[#D4D4D8]">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#71717A]" />
            <span className="text-sm font-semibold text-[#0A0A0A]">
              {t('admin:officeExpense.title')}
            </span>
            <span className="text-xs text-[#71717A]">
              · {t('admin:officeExpense.recordCount', { count: totalElements })}
            </span>
          </div>
          <Button
            size="sm"
            className="gap-1.5 bg-[#F97316] hover:bg-[#C2410C] text-white"
            onClick={() => { resetForm(); setShowCreate(true); }}
          >
            <Plus className="w-3.5 h-3.5" />
            {t('admin:officeExpense.newExpense')}
          </Button>
        </div>

        {/* Filter row */}
        <div className="flex flex-wrap items-center gap-3 px-6 py-3 bg-[#FAFAFA]/50 border-b border-[#D4D4D8]/50">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#71717A]" />
            <input
              type="text"
              placeholder={t('admin:officeExpense.searchPlaceholder')}
              maxLength={FIELD_LIMITS.SEARCH}
              value={filterSearch}
              onChange={e => setFilterSearch(e.target.value)}
              className="w-full h-8 pl-8 pr-3 text-xs border border-[#D4D4D8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316]/30"
            />
          </div>
          <Select value={filterCategory} onValueChange={v => { setFilterCategory(v); setCurrentPage(0); }}>
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue placeholder={t('admin:officeExpense.allCategories')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('admin:officeExpense.allCategories')}</SelectItem>
              {CATEGORIES.map(c => (
                <SelectItem key={c} value={c}>{t(`admin:officeExpense.category.${c}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input
            type="date"
            value={filterFrom}
            onChange={e => setFilterFrom(e.target.value)}
            className="h-8 px-2 text-xs border border-[#D4D4D8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316]/30"
            title={t('admin:officeExpense.form.purchaseDate')}
          />
          <input
            type="date"
            value={filterTo}
            onChange={e => setFilterTo(e.target.value)}
            className="h-8 px-2 text-xs border border-[#D4D4D8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316]/30"
            title={t('admin:officeExpense.form.purchaseDate')}
          />
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-[#F97316]" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Building2}
            title={t('admin:officeExpense.noExpenses')}
            description={t('admin:officeExpense.noExpensesHint')}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#FAFAFA]">
                    {tableHeaders.map(h => (
                      <th key={h} className="text-left text-[11px] font-semibold text-[#71717A] uppercase tracking-wider px-4 py-2.5">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id} className="border-t border-[#D4D4D8]/50 hover:bg-[#FAFAFA]/50 transition-colors">
                      <td className="px-4 py-3 text-sm text-[#0A0A0A] whitespace-nowrap">
                        {fmtDate(item.purchaseDate, dateLoc)}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#0A0A0A] max-w-[250px]">
                        <div className="truncate">{item.description}</div>
                        {item.notes && (
                          <div className="text-[11px] text-[#71717A] truncate mt-0.5">{item.notes}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <CategoryBadge category={item.category} />
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-sm text-[#0A0A0A]">
                        {fmtAmount(item.amount)}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#71717A]">
                        {item.purchasedBy ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEdit(item)}
                            className="p-1.5 rounded-md text-[#71717A] hover:text-[#F97316] hover:bg-[#F97316]/10 transition-colors"
                            title={t('buttons.edit', { ns: 'common' })}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteItem(item)}
                            className="p-1.5 rounded-md text-[#71717A] hover:text-red-600 hover:bg-red-50 transition-colors"
                            title={t('buttons.delete', { ns: 'common' })}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer with pagination */}
            <div className="px-6 py-3 border-t border-[#D4D4D8]/50 bg-[#FAFAFA]/50 flex items-center justify-between">
              <p className="text-[11px] text-[#71717A]">
                {t('admin:officeExpense.showingOf', { shown: items.length, total: totalElements })}
              </p>
              <div className="flex items-center gap-2">
                <button
                  disabled={currentPage === 0}
                  onClick={() => fetchData(currentPage - 1)}
                  className="p-1 rounded disabled:opacity-30 hover:bg-[#D4D4D8]/50 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs text-[#71717A]">
                  {t('admin:officeExpense.pageOf', { current: currentPage + 1, total: Math.max(totalPages, 1) })}
                </span>
                <button
                  disabled={currentPage >= totalPages - 1}
                  onClick={() => fetchData(currentPage + 1)}
                  className="p-1 rounded disabled:opacity-30 hover:bg-[#D4D4D8]/50 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={v => { if (!v) setShowCreate(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">{t('admin:officeExpense.dialog.create')}</DialogTitle>
          </DialogHeader>
          {FormFields()}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>
              {t('buttons.cancel', { ns: 'common' })}
            </Button>
            <Button
              size="sm"
              className="bg-[#F97316] hover:bg-[#C2410C] text-white"
              onClick={handleCreate}
              disabled={submitting}
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
              {t('admin:officeExpense.dialog.submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editItem} onOpenChange={v => { if (!v) { setEditItem(null); resetForm(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">{t('admin:officeExpense.dialog.edit')}</DialogTitle>
          </DialogHeader>
          {FormFields()}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setEditItem(null); resetForm(); }}>
              {t('buttons.cancel', { ns: 'common' })}
            </Button>
            <Button
              size="sm"
              className="bg-[#F97316] hover:bg-[#C2410C] text-white"
              onClick={handleUpdate}
              disabled={submitting}
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
              {t('buttons.save', { ns: 'common' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteItem} onOpenChange={v => { if (!v) setDeleteItem(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">{t('admin:officeExpense.dialog.deleteTitle')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[#71717A]">
            {t('admin:officeExpense.dialog.deleteConfirm', { desc: deleteItem?.description ?? '' })}
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteItem(null)}>
              {t('buttons.cancel', { ns: 'common' })}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleDelete}
              disabled={submitting}
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
              {t('buttons.delete', { ns: 'common' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
