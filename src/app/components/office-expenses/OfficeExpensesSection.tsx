import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../ui/utils';
import { BlockHead, Figure, FigureStrip, LoadFailure, TableSkeleton } from '../budgets/ui';
import { pct } from '../budgets/bits';
import { EmptyWord, Mono, MonoSelect, INPUT } from '../projects/bt';
import { FOCUS_RING, PrimaryButton, SecondaryButton, TertiaryButton } from '../onboarding/chrome';
import { tenantCompanyName } from '../../services/branding';
import { listActiveUsers, type UserDTO } from '../../services/users';
import {
  archiveOfficeCategory, createOfficeCategory, createOfficeExpense, deleteOfficeCategory,
  deleteOfficeExpense, removeOfficeReceipt, renameOfficeCategory, restoreOfficeCategory,
  updateOfficeExpense, uploadOfficeReceipt,
  type OfficeExpense, type OfficeExpenseInput, type OfficeExpenseSummary,
} from '../../services/officeExpenses';
import { currentMonth } from '../../helpers/dateTime';
import {
  Absent, bigMoney, CategoryBars, MonthNav, monthName, monthTitle, ReceiptCell, RecurringChip, shortDate,
} from './bits';
import { CategoriesWindow } from './CategoriesWindow';
import { DeleteWindow } from './DeleteWindow';
import { DetailDrawer } from './DetailDrawer';
import { ExpenseWindow } from './ExpenseWindow';
import { RecurringWindow } from './RecurringWindow';
import {
  defaultOfficeFilters, isFiltered, shiftMonth, useOfficeExpenses,
  type Grouping, type OfficeFilters,
} from './useOfficeExpenses';

const COLS = '74px 1.7fr 0.88fr 100px 0.8fr 106px 128px';

/**
 * Gastos de oficina — lo que la empresa paga fuera de obra.
 *
 * Renta, luz, agua, internet, limpieza, papelería. **No descuenta el
 * presupuesto de ninguna obra**, y eso es intencional: si se mezclara, el costo
 * de las obras quedaría inflado.
 *
 * Lo que cambió, y por qué:
 *
 *   · **la pantalla ya dice cuánto gasta la empresa.** La única cifra de dinero
 *     que existía era «total en página» —la suma de las diez filas visibles, que
 *     cambiaba al pasar de página—, así que el sistema no sabía el total de
 *     ningún mes. Ahora las cuatro cifras las suma el servidor;
 *   · **el mes es la unidad**, porque lo que se paga todos los meses se mira
 *     mes a mes. Antes eran dos campos de fecha sin etiqueta con `mm/dd/yyyy`;
 *   · **las categorías las escribe la empresa**, con la renta y las
 *     suscripciones incluidas — las dos partidas más grandes de una oficina,
 *     que el enum de siete no tenía;
 *   · **los fijos existen de verdad.** El recorrido guiado los prometía sin que
 *     hubiera marcador, aviso ni campo en el modelo;
 *   · **dar de baja deja rastro**, y la confirmación nombra el gasto y su monto.
 *
 * Sin botón de exportar: el documento del servidor todavía no existe, y un
 * botón que descarga una hoja hecha en el navegador es exactamente lo que se
 * acaba de quitar del Reporte de gastos.
 */
export function OfficeExpensesSection() {
  const { t, i18n } = useTranslation(['admin', 'common']);
  const lang = i18n.resolvedLanguage ?? 'es';
  const [filters, setFilters] = useState<OfficeFilters>(defaultOfficeFilters);
  const {
    rows, total, page, totalPages, setPage,
    summary, categories, loading, listError, summaryError, reload, reloadCategories,
  } = useOfficeExpenses(filters);

  const [tenant, setTenant] = useState<string | null>(null);
  const [users, setUsers] = useState<UserDTO[]>([]);
  useEffect(() => {
    tenantCompanyName().then(setTenant).catch(() => { /* el antetítulo no lo dice */ });
    listActiveUsers().then(setUsers).catch(() => { /* el selector se queda en texto libre */ });
  }, []);

  const [editing, setEditing] = useState<OfficeExpense | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [prefill, setPrefill] = useState<OfficeExpenseInput | null>(null);
  const [detail, setDetail] = useState<OfficeExpense | null>(null);
  const [removing, setRemoving] = useState<OfficeExpense | null>(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [windowError, setWindowError] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<number | null>(null);
  const [removedNote, setRemovedNote] = useState<string | null>(null);

  const isCurrent = filters.mode === 'month' && filters.month === currentMonth();
  const change = useMemo(() => {
    if (!summary || summary.previousMonthCents <= 0) return null;
    return ((summary.monthCents - summary.previousMonthCents) / summary.previousMonthCents) * 100;
  }, [summary]);

  const flash = (id: number) => {
    setFlashId(id);
    window.setTimeout(() => setFlashId(null), 2000);
  };

  const run = async (action: () => Promise<void>) => {
    setBusy(true); setWindowError(null);
    try {
      await action();
    } catch (err: unknown) {
      setWindowError(err instanceof Error ? err.message : t('officeExpenses.actionFailed'));
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const saveExpense = async (input: OfficeExpenseInput, receipt: File | null) => {
    try {
      await run(async () => {
        const saved = editing
          ? await updateOfficeExpense(editing.id, input)
          : await createOfficeExpense(input);
        if (receipt) await uploadOfficeReceipt(saved.id, receipt);
        setFormOpen(false);
        setEditing(null);
        setPrefill(null);
        // Sin toast: el acuse es la fila, con fondo papel y canto naranja, y las
        // cifras del mes, que se recalculan.
        flash(saved.id);
        reload();
        reloadCategories();
      });
    } catch { /* el error se queda en la ventana */ }
  };

  const confirmDelete = async () => {
    if (!removing) return;
    const gone = removing;
    try {
      await run(async () => {
        await deleteOfficeExpense(gone.id);
        setRemoving(null);
        setDetail(null);
        setRemovedNote(t('officeExpenses.delete.done', {
          description: gone.description,
          amount: bigMoney(gone.amountCents),
        }));
        window.setTimeout(() => setRemovedNote(null), 4000);
        reload();
      });
    } catch { /* el error se queda en la ventana */ }
  };

  const openForRecurring = (item: OfficeExpenseSummary['recurringMissing'][number]) => {
    setRecurringOpen(false);
    setEditing(null);
    setPrefill({
      description: item.description,
      ...(item.categoryId != null ? { categoryId: item.categoryId } : {}),
      amountCents: item.lastAmountCents,
      purchaseDate: `${filters.mode === 'month' ? filters.month : currentMonth()}-${String(item.recurringDay ?? 1).padStart(2, '0')}`,
      recurringOfId: item.templateId,
    });
    setFormOpen(true);
  };

  const grouped = useMemo(() => groupRows(rows, filters.grouping, lang), [rows, filters.grouping, lang]);

  return (
    <div className="space-y-3">
      {/* Titular */}
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div className="min-w-0">
          {tenant && (
            <Mono className="block text-[10px] tracking-[0.14em] text-[#8A8175]">
              {t('officeExpenses.kicker', { tenant })}
            </Mono>
          )}
          <h2 className="font-bt-display font-extrabold uppercase text-[40px] md:text-[46px] leading-[0.92] text-[#0A0A0A] mt-1">
            {t('officeExpenses.title')}
          </h2>
          <Mono className="block text-[10px] tracking-[0.1em] text-[#5A5346] mt-2">
            {t('officeExpenses.notSiteCost')} · {t('officeExpenses.byHand')}
          </Mono>
        </div>
        <PrimaryButton
          onClick={() => { setEditing(null); setPrefill(null); setWindowError(null); setFormOpen(true); }}
        >
          {t('officeExpenses.newExpense')}
        </PrimaryButton>
      </div>

      {/* El mes, que es la unidad — ancla 2 */}
      <div
        className="bg-white border border-[#E7E1D5] px-[18px] py-3 flex items-center justify-between gap-4 flex-wrap"
        data-tour="sec.office-expenses.mes"
      >
        {filters.mode === 'month' ? (
          <MonthNav
            month={filters.month}
            lang={lang}
            isCurrent={isCurrent}
            onShift={d => setFilters(f => ({ ...f, month: shiftMonth(f.month, d) }))}
            onFreeRange={() => setFilters(f => ({
              ...f,
              mode: 'range',
              dateFrom: `${f.month}-01`,
              dateTo: `${f.month}-28`,
            }))}
          />
        ) : (
          <div className="flex items-end gap-3 flex-wrap">
            <Field label={t('officeExpenses.filters.from')}>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))}
                className={INPUT}
              />
            </Field>
            <Field label={t('officeExpenses.filters.to')}>
              <input
                type="date"
                value={filters.dateTo}
                onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))}
                className={INPUT}
              />
            </Field>
            <TertiaryButton onClick={() => setFilters(f => ({ ...f, mode: 'month', month: currentMonth() }))}>
              {t('officeExpenses.month.backToCurrent')}
            </TertiaryButton>
          </div>
        )}
        {(summary?.recurringMissing.length ?? 0) > 0 && (
          <SecondaryButton onClick={() => setRecurringOpen(true)}>
            {t('officeExpenses.recurring.open')}
          </SecondaryButton>
        )}
      </div>

      {/* Las cuatro cifras — ancla 1. Las suma el servidor, nunca la página. */}
      <div data-tour="sec.office-expenses.cifras" className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <Mono className="text-[10px] tracking-[0.12em] text-[#8A8175]">
            {filters.mode === 'month'
              ? t('officeExpenses.summary.titleMonth', { month: monthTitle(filters.month, lang) })
              : t('officeExpenses.summary.titleRange', { from: filters.dateFrom, to: filters.dateTo })}
          </Mono>
          <Mono className="text-[9px] tracking-[0.08em] text-[#A69C8D]">{t('officeExpenses.summary.fromServer')}</Mono>
        </div>
        <FigureStrip filtered={isFiltered(filters)}>
          <Figure
            value={summaryError ? '—' : bigMoney(summary?.periodCents ?? 0)}
            label={
              <>
                {filters.mode === 'month'
                  ? t('officeExpenses.summary.spentIn', { month: monthName(filters.month, lang) })
                  : t('officeExpenses.summary.spentInRange')}
                <span className="block text-[9px] text-[#A69C8D] mt-0.5">
                  {summaryError ? '' : t('officeExpenses.summary.count', { count: summary?.periodCount ?? 0 })}
                </span>
              </>
            }
          />
          <Figure
            value={summaryError || change == null ? '—' : `${change >= 0 ? '+' : '−'}${pct(Math.abs(change), lang)} %`}
            tone={change != null && change > 0 ? 'orange' : 'ink'}
            label={
              <>
                {t('officeExpenses.summary.vsPrev', { month: monthName(shiftMonth(filters.month, -1), lang) })}
                <span className="block text-[9px] text-[#A69C8D] mt-0.5">
                  {summaryError ? '' : bigMoney(summary?.previousMonthCents ?? 0)}
                </span>
              </>
            }
          />
          <Figure
            value={summaryError ? '—' : bigMoney(summary?.yearToDateCents ?? 0)}
            label={
              <>
                {t('officeExpenses.summary.ytd')}
                <span className="block text-[9px] text-[#A69C8D] mt-0.5">
                  {t('officeExpenses.summary.ytdHint')}
                </span>
              </>
            }
          />
          <Figure
            value={summaryError ? '—' : String(summary?.recurringMissing.length ?? 0)}
            last
            tone={(summary?.recurringMissing.length ?? 0) > 0 ? 'orange' : 'ink'}
            label={
              <>
                {t('officeExpenses.recurring.figureLabel')}
                <span className="block text-[9px] text-[#A69C8D] mt-0.5">
                  {(summary?.recurringMissing.length ?? 0) > 0
                    ? summary!.recurringMissing.map(m => m.description).join(', ')
                    : t('officeExpenses.recurring.allSettled')}
                </span>
                {/* La salida va DEBAJO del nombre de los fijos, no al lado de la
                    cifra: pegada al «2» se leía como si fuera parte del número. */}
                {(summary?.recurringMissing.length ?? 0) > 0 && (
                  <span className="block mt-1.5">
                    <TertiaryButton onClick={() => setRecurringOpen(true)}>
                      {t('officeExpenses.recurring.register')}
                    </TertiaryButton>
                  </span>
                )}
              </>
            }
          />
        </FigureStrip>
        {summaryError && (
          <div className="flex items-center gap-3 bg-white border border-[#E7E1D5] border-l-[3px] border-l-[#B3402A] px-3.5 py-2">
            <span className="text-[12.5px] text-[#B3402A]">{t('officeExpenses.summaryError')}</span>
            <SecondaryButton onClick={reload}>{t('officeExpenses.retry')}</SecondaryButton>
          </div>
        )}
      </div>

      {/* En qué se fue */}
      {!summaryError && (summary?.byCategory.length ?? 0) > 0 && (
        <div className="bg-white border border-[#E7E1D5]">
          <BlockHead title={t('officeExpenses.byCategory.title')} hint={t('officeExpenses.byCategory.hint')} />
          <CategoryBars
            slices={summary!.byCategory}
            totalCents={summary!.periodCents}
            lang={lang}
            onOpenAll={() => setCategoriesOpen(true)}
          />
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white border border-[#E7E1D5] px-[18px] py-3 flex flex-wrap items-end gap-3">
        <Field label={t('officeExpenses.filters.category')}>
          <MonoSelect
            value={filters.categoryId}
            onChange={e => setFilters(f => ({ ...f, categoryId: e.target.value }))}
            className="min-w-[236px]"
          >
            {/* 236 px: con «Todas las categorías» entero. El control anterior
                tenía 160 y cortaba su propio texto en «Todas las categoría». */}
            <option value="all">{t('officeExpenses.filters.allCategories')}</option>
            {categories.filter(c => !c.archived).map(c => (
              <option key={c.id} value={String(c.id)}>{c.name}</option>
            ))}
            {categories.some(c => c.archived) && (
              <optgroup label={t('officeExpenses.categories.archivedLabel')}>
                {categories.filter(c => c.archived).map(c => (
                  <option key={c.id} value={String(c.id)}>{c.name}</option>
                ))}
              </optgroup>
            )}
          </MonoSelect>
        </Field>
        <Field label={t('officeExpenses.filters.purchasedBy')}>
          <MonoSelect
            value={filters.purchasedByUserId}
            onChange={e => setFilters(f => ({ ...f, purchasedByUserId: e.target.value }))}
          >
            <option value="all">{t('officeExpenses.filters.anyone')}</option>
            {users.map(u => <option key={u.id} value={String(u.id)}>{u.fullName ?? u.username}</option>)}
          </MonoSelect>
        </Field>
        <Field label={t('officeExpenses.filters.grouping')}>
          <MonoSelect
            value={filters.grouping}
            onChange={e => setFilters(f => ({ ...f, grouping: e.target.value as Grouping }))}
          >
            <option value="none">{t('officeExpenses.filters.groupNone')}</option>
            <option value="category">{t('officeExpenses.filters.groupCategory')}</option>
            <option value="month">{t('officeExpenses.filters.groupMonth')}</option>
          </MonoSelect>
        </Field>
        <Field label={t('officeExpenses.filters.search')} hint={t('officeExpenses.filters.searchHint')}>
          <input
            value={filters.search}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            placeholder={t('officeExpenses.filters.searchPlaceholder')}
            className={INPUT}
          />
        </Field>
        <div className="ml-auto flex items-end gap-2.5">
          <TertiaryButton onClick={() => setCategoriesOpen(true)}>
            {t('officeExpenses.categories.manage')}
          </TertiaryButton>
          <SecondaryButton onClick={() => setFilters(defaultOfficeFilters())}>
            {t('officeExpenses.filters.reset')}
          </SecondaryButton>
        </div>
      </div>

      {/* La tabla — ancla 3, en el contenedor: se pinta también vacía */}
      <div className="bg-white border border-[#E7E1D5]" data-tour="sec.office-expenses.fijos">
        <div className="hidden md:grid gap-3 px-[18px] py-2 border-b border-[#E7E1D5] bg-[#FBF8F2]" style={{ gridTemplateColumns: COLS }}>
          <Head>{t('officeExpenses.table.date')}</Head>
          <Head>{t('officeExpenses.table.description')}</Head>
          <Head>{t('officeExpenses.form.category')}</Head>
          <Head>{t('officeExpenses.form.receipt')}</Head>
          <Head>{t('officeExpenses.table.purchasedBy')}</Head>
          <Head right>{t('officeExpenses.table.amount')}</Head>
          <span />
        </div>

        {removedNote && (
          <div className="px-[18px] py-2.5 bg-[#F3EEE4] border-b border-[#E7E1D5]">
            <Mono className="text-[9.5px] tracking-[0.1em] text-[#5A5346]">{removedNote}</Mono>
          </div>
        )}

        {loading && rows.length === 0 ? (
          <TableSkeleton rows={4} cols={COLS} />
        ) : listError ? (
          <div className="p-[18px]">
            <LoadFailure
              title={t('officeExpenses.loadErrorTitle')}
              body={t('officeExpenses.loadErrorBody')}
              code={listError}
              onRetry={reload}
            />
          </div>
        ) : rows.length === 0 ? (
          <Empty
            filters={filters}
            everRegistered={(summary?.yearToDateCents ?? 0) > 0}
            lang={lang}
            onReset={() => setFilters(defaultOfficeFilters())}
            onNew={() => { setEditing(null); setPrefill(null); setFormOpen(true); }}
            onCurrentMonth={() => setFilters(f => ({ ...f, mode: 'month', month: currentMonth() }))}
          />
        ) : (
          grouped.map(([label, list, subtotal]) => (
            <div key={label || 'all'}>
              {label && (
                <div className="flex items-baseline justify-between gap-3 px-[18px] py-2 bg-[#FBF8F2] border-b border-[#F0EBE1]">
                  <Mono className="text-[9.5px] tracking-[0.1em] text-[#0A0A0A]">
                    {label} · {t('officeExpenses.summary.count', { count: list.length })}
                  </Mono>
                  <Mono className="text-[11px] tabular-nums text-[#0A0A0A] normal-case">{bigMoney(subtotal)}</Mono>
                </div>
              )}
              {list.map(e => (
                <Row
                  key={e.id}
                  expense={e}
                  lang={lang}
                  flash={flashId === e.id}
                  onOpen={() => { setWindowError(null); setDetail(e); }}
                  onEdit={() => { setEditing(e); setPrefill(null); setWindowError(null); setFormOpen(true); }}
                  onDelete={() => { setWindowError(null); setRemoving(e); }}
                />
              ))}
            </div>
          ))
        )}

        {rows.length > 0 && (
          <div className="flex items-center justify-between gap-3 flex-wrap px-[18px] py-2.5 border-t border-[#0A0A0A] bg-[#FBF8F2]">
            <Mono className="text-[9.5px] tracking-[0.1em] text-[#5A5346]">
              {t('officeExpenses.table.showing', { shown: rows.length, total })}
            </Mono>
            <Mono className="text-[11px] tabular-nums text-[#0A0A0A] normal-case">
              {t('officeExpenses.table.periodTotal', { amount: bigMoney(summary?.periodCents ?? 0) })}
            </Mono>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Page disabled={page === 0} onClick={() => setPage(page - 1)} label={t('officeExpenses.table.prev')}>
                  <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2.2} aria-hidden="true" />
                </Page>
                <Mono className="text-[9.5px] tracking-[0.08em] text-[#5A5346] tabular-nums">
                  {t('officeExpenses.table.page', { page: page + 1, pages: totalPages })}
                </Mono>
                <Page disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)} label={t('officeExpenses.table.next')}>
                  <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.2} aria-hidden="true" />
                </Page>
              </div>
            )}
          </div>
        )}
      </div>

      {formOpen && (
        <ExpenseWindow
          key={editing?.id ?? (prefill ? `pre-${prefill.recurringOfId}` : 'new')}
          open
          expense={editing ?? (prefill ? prefillAsExpense(prefill) : null)}
          categories={categories}
          users={users}
          busy={busy}
          error={windowError}
          onClose={() => { setFormOpen(false); setEditing(null); setPrefill(null); }}
          onSubmit={(input, receipt) => saveExpense(
            prefill?.recurringOfId != null && !editing
              ? { ...input, recurringOfId: prefill.recurringOfId }
              : input,
            receipt,
          )}
          onManageCategories={() => setCategoriesOpen(true)}
        />
      )}

      {detail && (
        <DetailDrawer
          expense={detail}
          busy={busy}
          error={windowError}
          onClose={() => setDetail(null)}
          onEdit={() => { setEditing(detail); setDetail(null); setFormOpen(true); }}
          onDelete={() => setRemoving(detail)}
          onUpload={file => {
            run(async () => {
              const saved = await uploadOfficeReceipt(detail.id, file);
              setDetail(saved);
              reload();
            }).catch(() => { /* el error se queda en el panel */ });
          }}
          onRemoveReceipt={() => {
            run(async () => {
              const saved = await removeOfficeReceipt(detail.id);
              setDetail(saved);
              reload();
            }).catch(() => { /* el error se queda en el panel */ });
          }}
        />
      )}

      {removing && (
        <DeleteWindow
          open
          expense={removing}
          monthCents={summary?.monthCents ?? 0}
          busy={busy}
          error={windowError}
          onClose={() => setRemoving(null)}
          onConfirm={confirmDelete}
        />
      )}

      {categoriesOpen && (
        <CategoriesWindow
          open
          categories={categories}
          busy={busy}
          error={windowError}
          onClose={() => { setCategoriesOpen(false); setWindowError(null); }}
          onCreate={name => run(async () => { await createOfficeCategory(name); reloadCategories(); }).catch(() => {})}
          onRename={(id, name) => run(async () => { await renameOfficeCategory(id, name); reloadCategories(); reload(); }).catch(() => {})}
          onArchive={id => run(async () => { await archiveOfficeCategory(id); reloadCategories(); }).catch(() => {})}
          onRestore={id => run(async () => { await restoreOfficeCategory(id); reloadCategories(); }).catch(() => {})}
          onDelete={id => run(async () => { await deleteOfficeCategory(id); reloadCategories(); }).catch(() => {})}
        />
      )}

      {recurringOpen && summary && (
        <RecurringWindow
          open
          month={filters.mode === 'month' ? filters.month : currentMonth()}
          summary={summary}
          onClose={() => setRecurringOpen(false)}
          onRegister={openForRecurring}
        />
      )}
    </div>
  );
}

/** Un fijo a medio registrar se pinta en el formulario como si fuera un gasto. */
function prefillAsExpense(input: OfficeExpenseInput): OfficeExpense {
  return {
    id: 0,
    description: input.description,
    category: 'other',
    categoryId: input.categoryId ?? null,
    categoryName: null,
    categoryArchived: false,
    amount: input.amountCents / 100,
    amountCents: input.amountCents,
    purchaseDate: input.purchaseDate,
    purchasedBy: null,
    purchasedByUserId: null,
    notes: null,
    recurring: false,
    recurringDay: null,
    receipt: null,
    createdBy: null,
    updatedBy: null,
    createdAt: '',
    updatedAt: '',
  };
}

function Row({ expense, lang, flash, onOpen, onEdit, onDelete }: {
  expense: OfficeExpense;
  lang: string;
  flash: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation('admin');
  return (
    <div className={cn('border-b border-[#F0EBE1] last:border-b-0', flash && 'bg-[#FAF7F0] border-l-[3px] border-l-[#F97316]')}>
      <div className="hidden md:grid gap-3 px-[18px] py-[10px] items-baseline hover:bg-[#FBF8F2]" style={{ gridTemplateColumns: COLS }}>
        <Mono className="text-[10px] tracking-[0.08em] text-[#5A5346]">{shortDate(expense.purchaseDate, lang)}</Mono>
        <div className="min-w-0">
          <button
            type="button"
            onClick={onOpen}
            className={cn('text-left text-[13px] text-[#0A0A0A] hover:text-[#C2410C] hover:underline decoration-[#F97316] underline-offset-2 truncate w-full', FOCUS_RING)}
          >
            {expense.description}
          </button>
          <div className="flex items-center gap-2 mt-[3px]">
            {expense.recurring && <RecurringChip />}
            {expense.notes && (
              <span className="text-[11px] text-[#8A8175] truncate">{expense.notes}</span>
            )}
          </div>
        </div>
        <span className="text-[12px] text-[#5A5346] truncate">
          {expense.categoryName ?? <Absent>{t('officeExpenses.byCategory.uncategorised')}</Absent>}
        </span>
        <ReceiptCell expense={expense} onView={onOpen} />
        <span className="text-[12px] text-[#5A5346] truncate">
          {expense.purchasedBy ?? <Absent>{t('officeExpenses.detail.noBuyer')}</Absent>}
        </span>
        <Mono className="text-[12.5px] tabular-nums text-right text-[#0A0A0A] normal-case">
          {bigMoney(expense.amountCents)}
        </Mono>
        <div className="flex items-center gap-2.5 justify-end">
          <TertiaryButton onClick={onEdit}>{t('officeExpenses.table.edit')}</TertiaryButton>
          <button
            type="button"
            onClick={onDelete}
            className={cn('font-bt-mono text-[9.5px] uppercase tracking-[0.1em] text-[#B3402A] underline underline-offset-2', FOCUS_RING)}
          >
            {t('officeExpenses.table.delete')}
          </button>
        </div>
      </div>

      {/* Móvil: ficha de ancho completo, sin scroll horizontal */}
      <button
        type="button"
        onClick={onOpen}
        className={cn('md:hidden w-full text-left px-[14px] py-3 space-y-1.5', FOCUS_RING)}
      >
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[13px] text-[#0A0A0A] truncate">{expense.description}</span>
          <Mono className="text-[12.5px] tabular-nums text-[#0A0A0A] flex-shrink-0 normal-case">
            {bigMoney(expense.amountCents)}
          </Mono>
        </div>
        <Mono className="block text-[9px] tracking-[0.08em] text-[#8A8175]">
          {[shortDate(expense.purchaseDate, lang), expense.categoryName].filter(Boolean).join(' · ')}
        </Mono>
      </button>
    </div>
  );
}

/**
 * Tres vacíos distintos, y **nunca el mismo texto**.
 *
 * El de un mes dice que ese mes está en blanco y ofrece volver al actual; el de
 * un filtro ofrece restablecerlo; el de la primera vez explica para qué sirve
 * la pantalla. Antes los tres eran «No se encontraron gastos de oficina ·
 * Intenta ajustar los filtros o registra un nuevo gasto».
 */
function Empty({ filters, everRegistered, lang, onReset, onNew, onCurrentMonth }: {
  filters: OfficeFilters;
  everRegistered: boolean;
  lang: string;
  onReset: () => void;
  onNew: () => void;
  onCurrentMonth: () => void;
}) {
  const { t } = useTranslation('admin');

  if (isFiltered(filters)) {
    return (
      <EmptyWord
        className="border-0"
        word={t('officeExpenses.empty.filterWord')}
        title={t('officeExpenses.empty.filterTitle')}
        hint={t('officeExpenses.empty.filterHint')}
        action={<PrimaryButton onClick={onReset}>{t('officeExpenses.empty.resetFilters')}</PrimaryButton>}
      />
    );
  }
  if (!everRegistered) {
    return (
      <EmptyWord
        className="border-0"
        word={t('officeExpenses.empty.firstWord')}
        title={t('officeExpenses.empty.firstTitle')}
        hint={t('officeExpenses.empty.firstHint')}
        action={<PrimaryButton onClick={onNew}>{t('officeExpenses.empty.registerFirst')}</PrimaryButton>}
      />
    );
  }
  return (
    <EmptyWord
      className="border-0"
      word={filters.mode === 'month' ? monthName(filters.month, lang) : t('officeExpenses.empty.monthWord')}
      title={t('officeExpenses.empty.monthTitle')}
      hint={
        filters.mode === 'month'
          ? t('officeExpenses.empty.monthHint', { month: monthTitle(filters.month, lang) })
          : t('officeExpenses.empty.rangeHint', { from: filters.dateFrom, to: filters.dateTo })
      }
      action={
        <div className="flex items-center gap-2.5">
          <PrimaryButton onClick={onNew}>{t('officeExpenses.empty.registerHere')}</PrimaryButton>
          <SecondaryButton onClick={onCurrentMonth}>{t('officeExpenses.month.backToCurrent')}</SecondaryButton>
        </div>
      }
    />
  );
}

function groupRows(
  rows: OfficeExpense[],
  grouping: Grouping,
  lang: string,
): Array<[string, OfficeExpense[], number]> {
  const sum = (list: OfficeExpense[]) => list.reduce((s, e) => s + e.amountCents, 0);
  if (grouping === 'none') return [['', rows, sum(rows)]];
  const buckets = new Map<string, OfficeExpense[]>();
  rows.forEach(e => {
    const key = grouping === 'category'
      ? e.categoryName ?? '—'
      : monthTitle(e.purchaseDate.slice(0, 7), lang);
    buckets.set(key, [...(buckets.get(key) ?? []), e]);
  });
  return [...buckets.entries()].map(([k, list]) => [k, list, sum(list)]);
}

function Head({ children, right = false }: { children: React.ReactNode; right?: boolean }) {
  return (
    <Mono className={cn('text-[9px] tracking-[0.1em] text-[#8A8175]', right && 'text-right')}>{children}</Mono>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <Mono className="text-[9.5px] font-semibold tracking-[0.12em] text-[#5A5346]">{label}</Mono>
      {children}
      {hint && <Mono className="text-[9px] tracking-[0.08em] text-[#A69C8D]">{hint}</Mono>}
    </label>
  );
}

function Page({ children, disabled, onClick, label }: {
  children: React.ReactNode;
  disabled: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'w-7 h-7 flex items-center justify-center border border-[#DBD0BB] text-[#5A5346]',
        disabled ? 'opacity-40 cursor-not-allowed' : 'hover:border-[#F97316] hover:text-[#C2410C]',
        FOCUS_RING,
      )}
    >
      {children}
    </button>
  );
}
