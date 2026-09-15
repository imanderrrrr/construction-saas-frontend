import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Paperclip, X } from 'lucide-react';
import { cn } from '../ui/utils';
import { BtModal } from '../bt/windows';
import { Mono, INPUT, MonoSelect, PaperNote } from '../projects/bt';
import { FOCUS_RING, PrimaryButton, SecondaryButton, TertiaryButton } from '../onboarding/chrome';
import type { UserDTO } from '../../services/users';
import type { OfficeCategory, OfficeExpense, OfficeExpenseInput } from '../../services/officeExpenses';
import { CategoryPicker } from './CategoryPicker';

/**
 * Nuevo gasto y editar, que son el mismo formulario.
 *
 * Los errores viven **bajo su campo**, no en un toast: al intentar guardar se
 * marcan los tres obligatorios y el foco salta al primero que falta. Y el
 * formulario dice, arriba, lo que nadie debería tener que preguntar: **este
 * gasto no se descuenta del presupuesto de ninguna obra**.
 */
export function ExpenseWindow({
  open, expense, categories, users, busy, error, onClose, onSubmit, onManageCategories,
}: {
  open: boolean;
  /** Null = nuevo. */
  expense: OfficeExpense | null;
  categories: OfficeCategory[];
  users: UserDTO[];
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (input: OfficeExpenseInput, receipt: File | null) => void;
  onManageCategories: () => void;
}) {
  const { t } = useTranslation('admin');
  const editing = expense != null;

  const [description, setDescription] = useState(expense?.description ?? '');
  const [categoryId, setCategoryId] = useState<number | null>(expense?.categoryId ?? null);
  const [categoryName, setCategoryName] = useState('');
  const [amount, setAmount] = useState(expense ? (expense.amountCents / 100).toFixed(2) : '');
  const [purchaseDate, setPurchaseDate] = useState(expense?.purchaseDate ?? new Date().toISOString().slice(0, 10));
  const [purchasedByUserId, setPurchasedByUserId] = useState(
    expense?.purchasedByUserId != null ? String(expense.purchasedByUserId) : 'none',
  );
  const [purchasedByFree, setPurchasedByFree] = useState(
    expense?.purchasedByUserId == null ? expense?.purchasedBy ?? '' : '',
  );
  const [notes, setNotes] = useState(expense?.notes ?? '');
  const [recurring, setRecurring] = useState(expense?.recurring ?? false);
  const [recurringDay, setRecurringDay] = useState(expense?.recurringDay != null ? String(expense.recurringDay) : '');
  const [receipt, setReceipt] = useState<File | null>(null);

  const [touched, setTouched] = useState(false);
  const descRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  const cents = parseCents(amount);
  const errors = {
    description: description.trim() === '' ? t('officeExpenses.form.error.description') : null,
    category: categoryId == null && categoryName.trim() === '' ? t('officeExpenses.form.error.category') : null,
    amount: cents == null || cents <= 0 ? t('officeExpenses.form.error.amount') : null,
    date: purchaseDate === '' ? t('officeExpenses.form.error.date') : null,
  };
  const invalid = Object.values(errors).some(Boolean);

  const submit = () => {
    setTouched(true);
    if (invalid) {
      if (errors.description) descRef.current?.focus();
      else if (errors.amount) amountRef.current?.focus();
      return;
    }
    onSubmit(
      {
        description: description.trim(),
        ...(categoryId != null ? { categoryId } : { categoryName: categoryName.trim() }),
        amountCents: cents!,
        purchaseDate,
        ...(purchasedByUserId !== 'none'
          ? { purchasedByUserId: Number(purchasedByUserId) }
          : purchasedByFree.trim()
            ? { purchasedBy: purchasedByFree.trim() }
            : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        recurring,
        ...(recurring && recurringDay ? { recurringDay: Number(recurringDay) } : {}),
      },
      receipt,
    );
  };

  const show = (key: keyof typeof errors) => (touched ? errors[key] : null);

  return (
    <BtModal
      open={open}
      onOpenChange={o => { if (!o && !busy) onClose(); }}
      width={520}
      dismissible={false}
      closeDisabled={busy}
      kicker={t('officeExpenses.title')}
      title={editing ? t('officeExpenses.form.editTitle') : t('officeExpenses.form.newTitle')}
      footer={
        <div className="flex items-center justify-end gap-2.5">
          <SecondaryButton onClick={onClose} disabled={busy}>{t('officeExpenses.form.cancel')}</SecondaryButton>
          <PrimaryButton onClick={submit} disabled={busy}>
            {busy
              ? t('officeExpenses.form.saving')
              : editing ? t('officeExpenses.form.saveEdit') : t('officeExpenses.form.save')}
          </PrimaryButton>
        </div>
      }
    >
      <div className="space-y-4">
        <PaperNote>{t('officeExpenses.form.notSiteCost')}</PaperNote>

        {editing && (expense!.createdBy || expense!.updatedBy) && (
          <Mono className="block text-[9px] tracking-[0.08em] text-[#A69C8D]">
            {t('officeExpenses.audit.line', {
              createdBy: expense!.createdBy ?? '—',
              updatedBy: expense!.updatedBy ?? '—',
            })}
          </Mono>
        )}

        <Field label={`${t('officeExpenses.form.description')} *`} error={show('description')}>
          <input
            ref={descRef}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder={t('officeExpenses.form.descriptionHint')}
            className={INPUT}
            maxLength={500}
          />
        </Field>

        <CategoryPicker
          categories={categories}
          value={categoryId}
          draftName={categoryName}
          onPick={id => { setCategoryId(id); setCategoryName(''); }}
          onDraft={name => { setCategoryName(name); setCategoryId(null); }}
          onManage={onManageCategories}
          error={show('category')}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`${t('officeExpenses.form.amount')} *`} error={show('amount')}>
            <div className="flex items-center border border-[#DBD0BB] bg-white h-10">
              <Mono className="px-2.5 text-[11px] text-[#8A8175]">$</Mono>
              <input
                ref={amountRef}
                value={amount}
                onChange={e => setAmount(e.target.value)}
                inputMode="decimal"
                placeholder="0.00"
                className="flex-1 h-full bg-transparent border-0 outline-none font-bt-mono text-[12.5px] tabular-nums text-[#0A0A0A] pr-2.5"
              />
            </div>
          </Field>
          <Field
            label={`${t('officeExpenses.form.purchaseDate')} *`}
            error={show('date')}
            hint={t('officeExpenses.form.purchaseDateHint')}
          >
            <input
              type="date"
              value={purchaseDate}
              onChange={e => setPurchaseDate(e.target.value)}
              className={INPUT}
            />
          </Field>
        </div>

        <Field label={t('officeExpenses.form.purchasedBy')} hint={t('officeExpenses.form.purchasedByHint')}>
          <MonoSelect value={purchasedByUserId} onChange={e => setPurchasedByUserId(e.target.value)}>
            <option value="none">{t('officeExpenses.form.purchasedByFree')}</option>
            {users.map(u => (
              <option key={u.id} value={String(u.id)}>{u.fullName ?? u.username}</option>
            ))}
          </MonoSelect>
          {purchasedByUserId === 'none' && (
            <input
              value={purchasedByFree}
              onChange={e => setPurchasedByFree(e.target.value)}
              placeholder={t('officeExpenses.form.purchasedByPlaceholder')}
              className={cn(INPUT, 'mt-1.5')}
              maxLength={150}
            />
          )}
        </Field>

        {/* Los fijos. Nada se crea solo: se avisa para que lo registres. */}
        <div className="border border-[#E7E1D5] bg-[#FBF8F2] px-3.5 py-3">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={recurring}
              onChange={e => setRecurring(e.target.checked)}
              className={cn('mt-[3px] w-4 h-4 accent-[#F97316]', FOCUS_RING)}
            />
            <span className="min-w-0">
              <Mono className="block text-[10px] tracking-[0.1em] text-[#0A0A0A]">
                {t('officeExpenses.recurring.checkbox')}
              </Mono>
              <span className="block text-[11.5px] leading-[1.5] text-[#5A5346] mt-1">
                {t('officeExpenses.recurring.checkboxHint')}
              </span>
            </span>
          </label>
          {recurring && (
            <div className="mt-2.5 flex items-end gap-2.5">
              <Field label={t('officeExpenses.recurring.day')}>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={recurringDay}
                  onChange={e => setRecurringDay(e.target.value)}
                  className={cn(INPUT, 'w-[88px]')}
                />
              </Field>
              <Mono className="text-[9px] tracking-[0.08em] text-[#A69C8D] pb-3">
                {t('officeExpenses.recurring.dayHint')}
              </Mono>
            </div>
          )}
        </div>

        {/* El comprobante. En un gasto nuevo se sube al guardar. */}
        <div>
          <Mono className="block text-[9.5px] font-semibold tracking-[0.12em] text-[#5A5346]">
            {t('officeExpenses.form.receipt')}
          </Mono>
          {receipt ? (
            <div className="mt-1.5 flex items-center justify-between gap-3 border border-[#DBD0BB] bg-white px-3 py-2.5">
              <span className="text-[12px] text-[#0A0A0A] truncate">{receipt.name}</span>
              <button
                type="button"
                onClick={() => setReceipt(null)}
                aria-label={t('officeExpenses.receipt.remove')}
                className={cn('flex-shrink-0 text-[#8A8175] hover:text-[#B3402A]', FOCUS_RING)}
              >
                <X className="w-3.5 h-3.5" strokeWidth={2.4} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <label
              className={cn(
                'mt-1.5 flex items-center gap-2.5 border border-dashed border-[#DBD0BB] bg-[#FBF8F2] px-3.5 py-3 cursor-pointer hover:border-[#F97316]',
              )}
            >
              <Paperclip className="w-3.5 h-3.5 text-[#8A8175] flex-shrink-0" strokeWidth={2} aria-hidden="true" />
              <span className="text-[11.5px] leading-[1.5] text-[#5A5346]">{t('officeExpenses.receipt.dropHint')}</span>
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={e => setReceipt(e.target.files?.[0] ?? null)}
              />
            </label>
          )}
        </div>

        <Field label={t('officeExpenses.form.notes')}>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder={t('officeExpenses.form.notesHint')}
            className={cn(INPUT, 'h-auto py-2 normal-case')}
          />
        </Field>

        {/* El fallo no cierra la ventana: lo escrito no se pierde. */}
        {error && (
          <div className="bg-white border border-[#E7E1D5] border-l-[3px] border-l-[#B3402A] px-3.5 py-2.5">
            <p className="text-[12.5px] text-[#B3402A]">{error}</p>
          </div>
        )}
      </div>
    </BtModal>
  );
}

function Field({ label, hint, error, children }: {
  label: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <Mono className="block text-[9.5px] font-semibold tracking-[0.12em] text-[#5A5346]">{label}</Mono>
      <div className="mt-1.5">{children}</div>
      {error
        ? <p className="text-[11.5px] text-[#B3402A] mt-1.5">{error}</p>
        : hint && <Mono className="block text-[9px] tracking-[0.08em] text-[#A69C8D] mt-1.5">{hint}</Mono>}
    </label>
  );
}

/**
 * De lo que se escribe a centavos.
 *
 * Acepta coma o punto como decimal porque en un teclado de Guatemala salen las
 * dos, y redondea al centavo en vez de truncar: `12,345` escrito de más no
 * puede convertirse en doce dólares con treinta y cuatro.
 */
export function parseCents(raw: string): number | null {
  const clean = raw.trim().replace(/\s/g, '').replace(',', '.');
  if (clean === '' || !/^\d*\.?\d*$/.test(clean)) return null;
  const value = Number(clean);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}
