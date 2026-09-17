import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle } from '../ui/dialog';
import { cn } from '../ui/utils';
import { FOCUS_RING } from '../onboarding/chrome';
import { FieldLabel, INPUT, INPUT_MONO, Mono, MonoSelect, PaperNote } from '../projects/bt';
import { CATEGORY_KEY_MAP, PaymentMethodField, resolveMethod, splitMethod, type BillCategory, type VendorBill, type VendorPayment } from '../PayableCommon';
import { fmtMoney } from '../invoices/bits';
import { ApiError } from '../../lib/api';
import { FIELD_LIMITS } from '../../../shared/fieldLimits';
import { businessToday } from '../../helpers/dateTime';
import {
  convertPayableToInvoice, createPayable, deletePayable, markPayableUnpaid, reassignPayableProject,
  recordPayablePayment, updatePayableAmount, updatePayableDates, updatePayableInfo,
  updatePayablePayment, uploadPayableAttachment, voidPayablePayment, type Payable,
} from '../../services/finance';
import { ALLOWED_ACCEPT, ALLOWED_TYPES, MAX_BYTES, MAX_COUNT } from '../PayableAttachmentsPanel';
import { WINDOW, WINDOW_SHEET as SHEET, WindowFoot, WindowHead, WindowSubject } from './ui';
import { balanceOf, round2 } from './accounting';

/**
 * The windows of Pagar.
 *
 * Every action the previous screen had is still here — correcting an amount,
 * fixing the text, promoting a bill to an invoice, moving it to another
 * jobsite, undoing a payment, deleting — because a redesign that loses
 * functions is a regression wearing a new coat. What changed is where they
 * live: out of a row of seven buttons and into the bill's own detail.
 */

export type ProjectBudget = { id: number; name: string; remainingBudgetCents: number | null };

function Head({ kicker, title, tone = 'ink' }: { kicker: string; title: string; tone?: 'ink' | 'red' | 'orange' }) {
  return (
    <WindowHead
      kicker={kicker}
      tone={tone}
      title={<DialogTitle className="font-bt-display font-extrabold uppercase text-[26px] leading-[1.05] mt-[3px]">{title}</DialogTitle>}
    />
  );
}

/** Every window's foot, with the shared cancel label. */
function Foot(props: Omit<Parameters<typeof WindowFoot>[0], 'cancelLabel'>) {
  const { t } = useTranslation('common');
  return <WindowFoot {...props} cancelLabel={t('buttons.cancel')} />;
}

/** "Queda después de pagar" — the one number a payment changes elsewhere. */
function BudgetNote({ project, remainingCents, payment }: {
  project: string;
  remainingCents: number | null;
  payment: number;
}) {
  const { t } = useTranslation('finance');
  if (remainingCents == null) return null;
  const now = round2(remainingCents / 100);
  const left = round2(now - payment);
  return (
    <div className={cn('border-l-[3px] px-3 py-2.5', left < 0 ? 'bg-[#FBEDE0] border-l-[#B3402A]' : 'bg-[#FBEDE0] border-l-[#F97316]')}>
      <Mono className="block text-[9px] tracking-[0.12em] text-[#C2410C]">{t('payable.pay.budgetOf', { project })}</Mono>
      <div className="flex items-baseline gap-2.5 mt-1 flex-wrap">
        <span className={cn('font-bt-display font-extrabold text-[26px] leading-none tabular-nums', left < 0 && 'text-[#B3402A]')}>
          {fmtMoney(left)}
        </span>
        <Mono className="text-[10px] tracking-[0.08em] text-[#5A5346]">{t('payable.pay.budgetAfter')}</Mono>
      </div>
      <Mono className="block text-[9.5px] text-[#5A5346] mt-1.5 normal-case">
        {t('payable.pay.budgetMath', { now: fmtMoney(now), payment: fmtMoney(payment) })}
      </Mono>
      {left < 0 && (
        <Mono className="block text-[9.5px] text-[#B3402A] mt-1.5 normal-case leading-[1.5]">{t('payable.pay.budgetOver')}</Mono>
      )}
    </div>
  );
}

/* ── Registrar pago ────────────────────────────────────────────────────── */

export function PayDialog({ bill, project, onClose, onPaid }: {
  bill: VendorBill | null;
  project: ProjectBudget | undefined;
  onClose: () => void;
  onPaid: (updated: Payable) => void;
}) {
  const { t } = useTranslation(['finance', 'common']);
  const [seeded, setSeeded] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(businessToday());
  const [method, setMethod] = useState('Bank transfer');
  const [methodOther, setMethodOther] = useState('');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);

  const balance = bill ? balanceOf(bill) : 0;
  if (bill && seeded !== bill.id) {
    setSeeded(bill.id);
    setAmount(balance.toFixed(2));
    setDate(businessToday());
    setMethod('Bank transfer');
    setMethodOther('');
    setReference('');
  }
  if (!bill) return null;

  const entered = parseFloat(amount) || 0;

  async function submit() {
    if (!bill) return;
    if (!entered || entered <= 0 || entered > balance || !date) {
      toast.error(t('finance:payable.validation.checkFields'));
      return;
    }
    const resolved = resolveMethod(method, methodOther);
    if (!resolved) {
      toast.error(t('finance:payable.validation.methodRequired'));
      return;
    }
    setBusy(true);
    try {
      const updated = await recordPayablePayment(bill.id, {
        amount: entered, date, method: resolved, reference: reference.trim() || undefined, approvedBy: 'finance',
      });
      toast.success(t('finance:payable.toast.paymentRecorded', { amount: fmtMoney(entered), bill: bill.billNumber }));
      onPaid(updated);
      onClose();
    } catch (err: unknown) {
      toast.error(t('finance:payable.toast.paymentFailed'), { description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className={WINDOW}>
        <Head kicker={t('finance:payable.eyebrow')} title={t('finance:payable.pay.title')} />
        <div className={SHEET}>
          <WindowSubject
            number={bill.billNumber}
            who={`${bill.vendor} · ${bill.project}`}
            label={t('finance:accounts.balance')}
            amount={fmtMoney(balance)}
          />
          <div>
            <FieldLabel htmlFor="ap-pay-amount">{t('finance:payable.pay.amount')}</FieldLabel>
            <input id="ap-pay-amount" type="number" step="0.01" min="0.01" max={balance}
              value={amount} onChange={e => setAmount(e.target.value)}
              className={cn(INPUT, 'h-auto border-[#0A0A0A] py-3 font-bt-mono text-[20px] font-semibold tabular-nums')} />
            <div className="flex gap-2 mt-2">
              <button type="button" onClick={() => setAmount(balance.toFixed(2))}
                className={cn('font-bt-mono text-[9.5px] uppercase tracking-[0.09em] px-2.5 py-1.5 bg-[#0A0A0A] text-[#F5F1E8] cursor-pointer', FOCUS_RING)}>
                {t('finance:payable.pay.whole')}
              </button>
              <button type="button" onClick={() => setAmount('')}
                className={cn('font-bt-mono text-[9.5px] uppercase tracking-[0.09em] px-2.5 py-1.5 border border-[#DBD0BB] text-[#5A5346] cursor-pointer', FOCUS_RING)}>
                {t('finance:payable.pay.partial')}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <FieldLabel htmlFor="ap-pay-date">{t('finance:payable.pay.date')}</FieldLabel>
              <input id="ap-pay-date" type="date" value={date} onChange={e => setDate(e.target.value)} className={cn(INPUT, INPUT_MONO)} />
            </div>
            <div>
              <FieldLabel>{t('finance:payable.pay.method')}</FieldLabel>
              <PaymentMethodField method={method} otherText={methodOther} onMethodChange={setMethod} onOtherTextChange={setMethodOther} />
            </div>
          </div>
          <div>
            <FieldLabel htmlFor="ap-pay-ref">{t('finance:payable.pay.reference')}</FieldLabel>
            <input id="ap-pay-ref" value={reference} maxLength={FIELD_LIMITS.REFERENCE}
              onChange={e => setReference(e.target.value)} placeholder={t('finance:payable.pay.referencePlaceholder')}
              className={cn(INPUT, INPUT_MONO)} />
          </div>
          <BudgetNote project={bill.project} remainingCents={project?.remainingBudgetCents ?? null} payment={entered} />
        </div>
        <Foot
          confirm={t('finance:payable.pay.confirm', { amount: fmtMoney(entered || 0) })}
          onConfirm={() => void submit()}
          onCancel={onClose}
          busy={busy}
          disabled={!entered}
          tone="ink"
        />
      </DialogContent>
    </Dialog>
  );
}

/* ── Pagar en lote ─────────────────────────────────────────────────────── */

type BatchRow = { bill: VendorBill; amount: string; reference: string; error: string | null; done: boolean };

/**
 * The Friday payment run.
 *
 * The API records one payment at a time, so this does too — in sequence, with
 * each result kept per bill. A batch that fails halfway must not lie in either
 * direction: what went through is marked done and removed from the selection,
 * what failed keeps its message and stays selected to be retried.
 */
export function BatchPayDialog({ bills, projects, onClose, onFinished }: {
  bills: VendorBill[];
  projects: ProjectBudget[];
  onClose: () => void;
  onFinished: (updated: Payable[], stillSelected: number[]) => void;
}) {
  const { t } = useTranslation(['finance', 'common']);
  const [date, setDate] = useState(businessToday());
  const [method, setMethod] = useState('Bank transfer');
  const [methodOther, setMethodOther] = useState('');
  const [rows, setRows] = useState<BatchRow[]>(() =>
    bills.map(bill => ({ bill, amount: balanceOf(bill).toFixed(2), reference: '', error: null, done: false })));
  const [busy, setBusy] = useState(false);

  const pending = rows.filter(r => !r.done);
  const total = round2(pending.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0));

  // One line per jobsite: a run that pays three bills of two projects has two
  // budgets to answer for, and a single figure would hide one of them.
  const byProject = new Map<number, { name: string; remainingCents: number | null; payment: number }>();
  for (const r of pending) {
    const p = projects.find(x => x.id === r.bill.projectId);
    const entry = byProject.get(r.bill.projectId)
      ?? { name: r.bill.project, remainingCents: p?.remainingBudgetCents ?? null, payment: 0 };
    entry.payment = round2(entry.payment + (parseFloat(r.amount) || 0));
    byProject.set(r.bill.projectId, entry);
  }

  function setRow(id: number, patch: Partial<BatchRow>) {
    setRows(prev => prev.map(r => (r.bill.id === id ? { ...r, ...patch } : r)));
  }

  async function submit() {
    const resolved = resolveMethod(method, methodOther);
    if (!resolved) { toast.error(t('finance:payable.validation.methodRequired')); return; }
    if (!date) { toast.error(t('finance:payable.validation.checkFields')); return; }
    const targets = rows.filter(r => !r.done);
    if (targets.some(r => { const a = parseFloat(r.amount) || 0; return a <= 0 || a > balanceOf(r.bill); })) {
      toast.error(t('finance:payable.batch.checkAmounts'));
      return;
    }

    setBusy(true);
    const updated: Payable[] = [];
    const failed: number[] = [];
    for (const row of targets) {
      try {
        const res = await recordPayablePayment(row.bill.id, {
          amount: parseFloat(row.amount), date, method: resolved,
          reference: row.reference.trim() || undefined, approvedBy: 'finance',
        });
        updated.push(res);
        setRow(row.bill.id, { done: true, error: null });
      } catch (err: unknown) {
        failed.push(row.bill.id);
        setRow(row.bill.id, { error: err instanceof Error ? err.message : String(err) });
      }
    }
    setBusy(false);

    if (failed.length === 0) {
      toast.success(t('finance:payable.batch.done', { count: updated.length, amount: fmtMoney(round2(updated.reduce((s, u, i) => s + (parseFloat(targets[i].amount) || 0), 0))) }));
      onFinished(updated, []);
      onClose();
      return;
    }
    toast.warning(t('finance:payable.batch.partial', { ok: updated.length, failed: failed.length }));
    onFinished(updated, failed);
  }

  return (
    <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
      <DialogContent className={cn(WINDOW, 'sm:max-w-[560px]')}>
        <Head kicker={t('finance:payable.batch.kicker')} title={t('finance:payable.batch.title', { count: pending.length, amount: fmtMoney(total) })} />
        <div className={cn(SHEET, 'max-h-[64vh] overflow-y-auto')}>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <FieldLabel htmlFor="ap-batch-date">{t('finance:payable.batch.date')}</FieldLabel>
              <input id="ap-batch-date" type="date" value={date} onChange={e => setDate(e.target.value)} className={cn(INPUT, INPUT_MONO)} />
            </div>
            <div>
              <FieldLabel>{t('finance:payable.batch.method')}</FieldLabel>
              <PaymentMethodField method={method} otherText={methodOther} onMethodChange={setMethod} onOtherTextChange={setMethodOther} />
            </div>
          </div>

          <div>
            <Mono className="block text-[9.5px] tracking-[0.13em] text-[#8A8175] mb-1">{t('finance:payable.batch.perBill')}</Mono>
            {rows.map(row => (
              <div key={row.bill.id} className={cn('py-2.5 border-b border-[#F0EBE1]', row.done && 'opacity-55')}>
                <div className="grid grid-cols-[1.4fr_.9fr_1fr] gap-2.5 items-center">
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-semibold text-[#0A0A0A] truncate">{row.bill.vendor}</div>
                    <Mono className="block text-[9.5px] text-[#A69C8D] mt-0.5 normal-case truncate">
                      {row.bill.billNumber} · {t('finance:payable.batch.billBalance', { amount: fmtMoney(balanceOf(row.bill)) })}
                    </Mono>
                  </div>
                  <input
                    type="number" step="0.01" min="0.01" max={balanceOf(row.bill)}
                    value={row.amount}
                    disabled={row.done}
                    onChange={e => setRow(row.bill.id, { amount: e.target.value })}
                    aria-label={t('finance:payable.batch.amountFor', { vendor: row.bill.vendor })}
                    className={cn(INPUT, 'h-auto py-1.5 font-bt-mono text-[12px] font-semibold text-right tabular-nums')}
                  />
                  <input
                    value={row.reference}
                    disabled={row.done}
                    maxLength={FIELD_LIMITS.REFERENCE}
                    onChange={e => setRow(row.bill.id, { reference: e.target.value })}
                    placeholder={t('finance:payable.pay.reference')}
                    aria-label={t('finance:payable.batch.referenceFor', { vendor: row.bill.vendor })}
                    className={cn(INPUT, 'h-auto py-1.5 font-bt-mono text-[10.5px]')}
                  />
                </div>
                {row.done && <Mono className="block text-[9.5px] text-[#2E7D4F] mt-1.5 normal-case">{t('finance:payable.batch.rowDone')}</Mono>}
                {row.error && <Mono className="block text-[9.5px] text-[#B3402A] mt-1.5 normal-case leading-[1.5]">{row.error}</Mono>}
              </div>
            ))}
          </div>

          {[...byProject.values()].map(p => (
            <BudgetNote key={p.name} project={p.name} remainingCents={p.remainingCents} payment={p.payment} />
          ))}
        </div>
        <Foot
          confirm={t('finance:payable.batch.confirm', { count: pending.length, amount: fmtMoney(total) })}
          onConfirm={() => void submit()}
          onCancel={onClose}
          busy={busy}
          disabled={pending.length === 0}
          tone="ink"
          note={t('finance:payable.batch.note')}
        />
      </DialogContent>
    </Dialog>
  );
}

/* ── Registrar cuenta ──────────────────────────────────────────────────── */

export function CreateBillDialog({ open, vendors, projects, suggestedNumber, onClose, onCreated }: {
  open: boolean;
  vendors: string[];
  projects: ProjectBudget[];
  suggestedNumber: string;
  onClose: () => void;
  onCreated: (created: Payable) => void;
}) {
  const { t } = useTranslation(['finance', 'common']);
  const [seeded, setSeeded] = useState(false);
  const [number, setNumber] = useState(suggestedNumber);
  const [vendor, setVendor] = useState('');
  const [vendorOther, setVendorOther] = useState('');
  const [category, setCategory] = useState('');
  const [projectId, setProjectId] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [receivedDate, setReceivedDate] = useState(businessToday());
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  if (open && !seeded) {
    setSeeded(true);
    setNumber(suggestedNumber);
    setVendor(''); setVendorOther(''); setCategory(''); setProjectId('');
    setDescription(''); setAmount(''); setReceivedDate(businessToday()); setDueDate('');
    setNotes(''); setFiles([]);
  }
  if (!open && seeded) setSeeded(false);
  if (!open) return null;

  function addFiles(incoming: File[]) {
    const accepted: File[] = [];
    for (const f of incoming) {
      if (!ALLOWED_TYPES.includes(f.type)) { toast.error(t('finance:payable.attachments.typeNotAllowed', { name: f.name })); continue; }
      if (f.size > MAX_BYTES) { toast.error(t('finance:payable.attachments.tooLarge', { name: f.name })); continue; }
      accepted.push(f);
    }
    if (files.length + accepted.length > MAX_COUNT) { toast.error(t('finance:payable.attachments.tooMany', { max: MAX_COUNT })); return; }
    if (accepted.length) setFiles(prev => [...prev, ...accepted]);
  }

  async function submit() {
    const who = vendor === 'Other' ? vendorOther.trim() : vendor;
    const amt = parseFloat(amount);
    const project = projects.find(p => String(p.id) === projectId);
    if (!who || !category || !project || !description.trim() || !amt || amt <= 0 || !receivedDate || !dueDate) {
      toast.error(t('finance:payable.validation.requiredFields'));
      return;
    }
    if (dueDate < receivedDate) { toast.error(t('finance:payable.validation.dueDateAfter')); return; }

    setBusy(true);
    try {
      const created = await createPayable({
        billNumber: number || undefined, vendor: who, category, projectId: project.id,
        description: description.trim(), receivedDate, dueDate, amount: amt,
        notes: notes.trim() || undefined,
      });
      // The bill exists now; a photo that fails must not undo it.
      const failed: string[] = [];
      for (const f of files) {
        try { await uploadPayableAttachment(created.id, f); } catch { failed.push(f.name); }
      }
      toast.success(t('finance:payable.create.done', { bill: created.billNumber }));
      if (failed.length) {
        toast.warning(t('finance:payable.create.photosFailed', { count: failed.length }), { description: failed.join(', '), duration: 10_000 });
      }
      onCreated(created);
      onClose();
    } catch (err: unknown) {
      toast.error(t('finance:payable.create.failed'), { description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className={cn(WINDOW, 'sm:max-w-[520px]')}>
        <Head kicker={t('finance:payable.eyebrow')} title={t('finance:payable.create.title')} />
        <div className={cn(SHEET, 'max-h-[64vh] overflow-y-auto')}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <FieldLabel htmlFor="ap-new-number">{t('finance:payable.create.number')}</FieldLabel>
              <input id="ap-new-number" value={number} maxLength={FIELD_LIMITS.IDENTIFIER}
                onChange={e => setNumber(e.target.value)} className={cn(INPUT, INPUT_MONO)} />
            </div>
            <div>
              <FieldLabel htmlFor="ap-new-vendor">{t('finance:payable.create.vendor')}</FieldLabel>
              <MonoSelect id="ap-new-vendor" value={vendor} onChange={e => setVendor(e.target.value)} className="w-full h-10 normal-case">
                <option value="">{t('finance:payable.create.vendorPlaceholder')}</option>
                {vendors.map(v => <option key={v} value={v}>{v}</option>)}
                <option value="Other">{t('finance:payable.create.vendorOther')}</option>
              </MonoSelect>
              {vendor === 'Other' && (
                <input value={vendorOther} maxLength={FIELD_LIMITS.SHORT_NAME} onChange={e => setVendorOther(e.target.value)}
                  placeholder={t('finance:payable.create.vendorPlaceholder')} className={cn(INPUT, 'mt-2')} />
              )}
            </div>
            <div>
              <FieldLabel htmlFor="ap-new-category">{t('finance:payable.create.category')}</FieldLabel>
              <MonoSelect id="ap-new-category" value={category} onChange={e => setCategory(e.target.value)} className="w-full h-10">
                <option value="">{t('finance:payable.create.categoryPlaceholder')}</option>
                {Object.entries(CATEGORY_KEY_MAP).map(([k, key]) => <option key={k} value={k}>{t(`finance:${key}`)}</option>)}
              </MonoSelect>
            </div>
            <div>
              <FieldLabel htmlFor="ap-new-project">{t('common:labels.project')}</FieldLabel>
              <MonoSelect id="ap-new-project" value={projectId} onChange={e => setProjectId(e.target.value)} className="w-full h-10 normal-case">
                <option value="">{t('finance:payable.create.projectPlaceholder')}</option>
                {projects.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
              </MonoSelect>
            </div>
          </div>
          <div>
            <FieldLabel htmlFor="ap-new-desc">{t('finance:payable.create.description')}</FieldLabel>
            <input id="ap-new-desc" value={description} maxLength={FIELD_LIMITS.NOTE}
              onChange={e => setDescription(e.target.value)} placeholder={t('finance:payable.create.descriptionPlaceholder')} className={INPUT} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <FieldLabel htmlFor="ap-new-amount">{t('finance:payable.create.amount')}</FieldLabel>
              <input id="ap-new-amount" type="number" step="0.01" min="0.01" value={amount}
                onChange={e => setAmount(e.target.value)} className={cn(INPUT, INPUT_MONO, 'text-right')} />
            </div>
            <div>
              <FieldLabel htmlFor="ap-new-received">{t('finance:payable.create.received')}</FieldLabel>
              <input id="ap-new-received" type="date" value={receivedDate} onChange={e => setReceivedDate(e.target.value)} className={cn(INPUT, INPUT_MONO)} />
            </div>
            <div>
              <FieldLabel htmlFor="ap-new-due">{t('finance:payable.create.due')}</FieldLabel>
              <input id="ap-new-due" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={cn(INPUT, INPUT_MONO)} />
            </div>
          </div>
          <div>
            <FieldLabel htmlFor="ap-new-notes">{t('finance:payable.create.notes')}</FieldLabel>
            <textarea id="ap-new-notes" rows={2} value={notes} maxLength={FIELD_LIMITS.EXTENDED_NOTE}
              onChange={e => setNotes(e.target.value)} className={cn(INPUT, 'h-auto py-2.5 resize-none')} />
          </div>
          <div>
            <FieldLabel>{t('finance:payable.create.photos')}</FieldLabel>
            <label
              onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={e => { e.preventDefault(); e.stopPropagation(); addFiles(Array.from(e.dataTransfer.files)); }}
              className={cn('flex flex-col items-center justify-center gap-1.5 border border-dashed border-[#DBD0BB] bg-[#FAF7F0] py-4 cursor-pointer transition-colors hover:border-[#F97316]', FOCUS_RING)}
            >
              <Mono className="text-[10px] tracking-[0.09em] text-[#8A8175]">{t('finance:payable.create.dropPhotos')}</Mono>
              <Mono className="text-[9px] tracking-[0.06em] text-[#A69C8D] normal-case">{t('finance:payable.create.photoFormats', { max: MAX_COUNT })}</Mono>
              <input type="file" multiple accept={ALLOWED_ACCEPT} className="hidden"
                onChange={e => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
            </label>
            {files.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {files.map((f, i) => (
                  <div key={`${f.name}-${i}`} className="flex items-center gap-2 border border-[#E7E1D5] bg-white px-2.5 py-1.5">
                    <Mono className="text-[10.5px] text-[#0A0A0A] normal-case truncate flex-1">{f.name}</Mono>
                    <button type="button" onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))}
                      className={cn('font-bt-mono text-[9.5px] uppercase tracking-[0.08em] text-[#B3402A] cursor-pointer', FOCUS_RING)}>
                      {t('common:buttons.remove', 'Quitar')}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <Foot confirm={t('finance:payable.create.confirm')} onConfirm={() => void submit()} onCancel={onClose} busy={busy} tone="ink" />
      </DialogContent>
    </Dialog>
  );
}

/* ── The six actions of the detail ─────────────────────────────────────── */

export function EditAmountDatesDialog({ bill, onClose, onSaved }: {
  bill: VendorBill | null; onClose: () => void; onSaved: (u: Payable) => void;
}) {
  const { t } = useTranslation(['finance', 'common']);
  const [seeded, setSeeded] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [received, setReceived] = useState('');
  const [due, setDue] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  if (bill && seeded !== bill.id) {
    setSeeded(bill.id);
    setAmount(bill.amount.toFixed(2));
    setReceived(bill.receivedDate);
    setDue(bill.dueDate);
    setReason('');
  }
  if (!bill) return null;

  async function submit() {
    if (!bill) return;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast.error(t('finance:payable.validation.amountPositive')); return; }
    if (amt < bill.paidAmount) { toast.error(t('finance:payable.edit.belowPaid', { paid: fmtMoney(bill.paidAmount) })); return; }
    if (!received || !due) { toast.error(t('finance:payable.validation.requiredFields')); return; }
    if (due < received) { toast.error(t('finance:payable.validation.dueDateAfter')); return; }

    const amountChanged = Math.round(amt * 100) !== Math.round(bill.amount * 100);
    const datesChanged = received !== bill.receivedDate || due !== bill.dueDate;
    if (!amountChanged && !datesChanged) { onClose(); return; }

    setBusy(true);
    try {
      let updated: Payable | undefined;
      // Amount and dates are separate endpoints; each returns the whole bill.
      if (amountChanged) updated = await updatePayableAmount(bill.id, { amount: amt, reason: reason.trim() || undefined });
      if (datesChanged) updated = await updatePayableDates(bill.id, { receivedDate: received, dueDate: due });
      if (updated) onSaved(updated);
      toast.success(t('finance:payable.edit.updated', { bill: bill.billNumber }));
      onClose();
    } catch (err: unknown) {
      toast.error(t('finance:payable.edit.failed'), { description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className={WINDOW}>
        <Head kicker={bill.billNumber} title={t('finance:payable.edit.title')} />
        <div className={SHEET}>
          {bill.paidAmount > 0 && <PaperNote tone="orange">{t('finance:payable.edit.paidHint', { paid: fmtMoney(bill.paidAmount) })}</PaperNote>}
          <div>
            <FieldLabel htmlFor="ap-edit-amount">{t('finance:payable.edit.newAmount')}</FieldLabel>
            <input id="ap-edit-amount" type="number" step="0.01" min="0.01" value={amount}
              onChange={e => setAmount(e.target.value)} className={cn(INPUT, INPUT_MONO, 'text-right')} />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <FieldLabel htmlFor="ap-edit-received">{t('finance:payable.create.received')}</FieldLabel>
              <input id="ap-edit-received" type="date" value={received} onChange={e => setReceived(e.target.value)} className={cn(INPUT, INPUT_MONO)} />
            </div>
            <div>
              <FieldLabel htmlFor="ap-edit-due">{t('finance:payable.create.due')}</FieldLabel>
              <input id="ap-edit-due" type="date" value={due} onChange={e => setDue(e.target.value)} className={cn(INPUT, INPUT_MONO)} />
            </div>
          </div>
          <div>
            <FieldLabel htmlFor="ap-edit-reason">{t('finance:payable.edit.reason')}</FieldLabel>
            <textarea id="ap-edit-reason" rows={2} value={reason} maxLength={FIELD_LIMITS.NOTE}
              onChange={e => setReason(e.target.value)} placeholder={t('finance:payable.edit.reasonPlaceholder')}
              className={cn(INPUT, 'h-auto py-2.5 resize-none')} />
          </div>
        </div>
        <Foot confirm={t('common:buttons.save')} onConfirm={() => void submit()} onCancel={onClose} busy={busy} tone="ink" />
      </DialogContent>
    </Dialog>
  );
}

export function EditBillInfoDialog({ bill, vendors, onClose, onSaved }: {
  bill: VendorBill | null; vendors: string[]; onClose: () => void; onSaved: (u: Payable) => void;
}) {
  const { t } = useTranslation(['finance', 'common']);
  const [seeded, setSeeded] = useState<number | null>(null);
  const [vendor, setVendor] = useState('');
  const [category, setCategory] = useState<string>('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [busy, setBusy] = useState(false);

  if (bill && seeded !== bill.id) {
    setSeeded(bill.id);
    setVendor(bill.vendor);
    setCategory(bill.category);
    setDescription(bill.description ?? '');
    setNotes(bill.notes ?? '');
    setInvoiceNumber(bill.invoiceNumber ?? '');
  }
  if (!bill) return null;

  async function submit() {
    if (!bill) return;
    const who = vendor.trim();
    if (!who) { toast.error(t('finance:payable.info.vendorRequired')); return; }
    const payload: { vendor?: string; category?: string; description?: string | null; notes?: string | null; invoiceNumber?: string } = {};
    if (who !== bill.vendor) payload.vendor = who;
    if (category && category !== bill.category) payload.category = category;
    const d = description.trim();
    if (d !== (bill.description ?? '')) payload.description = d || null;
    const n = notes.trim();
    if (n !== (bill.notes ?? '')) payload.notes = n || null;
    if (bill.documentType === 'INVOICE') {
      const inv = invoiceNumber.trim();
      if (inv && inv !== (bill.invoiceNumber ?? '')) payload.invoiceNumber = inv;
    }
    if (Object.keys(payload).length === 0) { onClose(); return; }

    setBusy(true);
    try {
      const updated = await updatePayableInfo(bill.id, payload);
      toast.success(t('finance:payable.info.updated', { bill: bill.billNumber }));
      onSaved(updated);
      onClose();
    } catch (err: unknown) {
      if (err instanceof ApiError && err.code === 'DUPLICATE_INVOICE_NUMBER') {
        toast.error(t('finance:payable.convert.duplicate'), { description: err.message });
      } else if (err instanceof ApiError && err.code === 'NOT_AN_INVOICE') {
        toast.error(t('finance:payable.info.notAnInvoice'), { description: err.message });
      } else {
        toast.error(t('finance:payable.info.failed'), { description: err instanceof Error ? err.message : undefined });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className={WINDOW}>
        <Head kicker={bill.billNumber} title={t('finance:payable.info.title')} />
        <div className={SHEET}>
          <div>
            <FieldLabel htmlFor="ap-info-vendor">{t('finance:payable.info.vendor')}</FieldLabel>
            <input id="ap-info-vendor" value={vendor} list="ap-info-vendors" maxLength={FIELD_LIMITS.SHORT_NAME}
              onChange={e => setVendor(e.target.value)} className={INPUT} />
            <datalist id="ap-info-vendors">{vendors.map(v => <option key={v} value={v} />)}</datalist>
          </div>
          <div>
            <FieldLabel htmlFor="ap-info-category">{t('finance:payable.info.category')}</FieldLabel>
            <MonoSelect id="ap-info-category" value={category} onChange={e => setCategory(e.target.value)} className="w-full h-10">
              {(Object.keys(CATEGORY_KEY_MAP) as BillCategory[]).map(c => (
                <option key={c} value={c}>{t(`finance:${CATEGORY_KEY_MAP[c]}`)}</option>
              ))}
            </MonoSelect>
          </div>
          <div>
            <FieldLabel htmlFor="ap-info-desc">{t('finance:payable.info.description')}</FieldLabel>
            <input id="ap-info-desc" value={description} maxLength={FIELD_LIMITS.NOTE} onChange={e => setDescription(e.target.value)} className={INPUT} />
          </div>
          <div>
            <FieldLabel htmlFor="ap-info-notes">{t('finance:payable.info.notes')}</FieldLabel>
            <textarea id="ap-info-notes" rows={2} value={notes} maxLength={FIELD_LIMITS.EXTENDED_NOTE}
              onChange={e => setNotes(e.target.value)} className={cn(INPUT, 'h-auto py-2.5 resize-none')} />
          </div>
          {bill.documentType === 'INVOICE' ? (
            <div>
              <FieldLabel htmlFor="ap-info-invoice">{t('finance:payable.info.invoiceNumber')}</FieldLabel>
              <input id="ap-info-invoice" value={invoiceNumber} maxLength={FIELD_LIMITS.DOCUMENT_NUMBER}
                onChange={e => setInvoiceNumber(e.target.value)} className={cn(INPUT, INPUT_MONO)} />
            </div>
          ) : (
            <PaperNote tone="none">{t('finance:payable.info.invoiceNumberBillHint')}</PaperNote>
          )}
        </div>
        <Foot confirm={t('common:buttons.save')} onConfirm={() => void submit()} onCancel={onClose} busy={busy} tone="ink" />
      </DialogContent>
    </Dialog>
  );
}

export function ConvertDialog({ bill, onClose, onConverted }: {
  bill: VendorBill | null; onClose: () => void; onConverted: (u: Payable) => void;
}) {
  const { t } = useTranslation(['finance', 'common']);
  const [seeded, setSeeded] = useState<number | null>(null);
  const [number, setNumber] = useState('');
  const [busy, setBusy] = useState(false);
  if (bill && seeded !== bill.id) { setSeeded(bill.id); setNumber(bill.invoiceNumber ?? ''); }
  if (!bill) return null;

  async function submit() {
    if (!bill) return;
    const n = number.trim();
    if (!n) { toast.error(t('finance:payable.convert.numberRequired')); return; }
    setBusy(true);
    try {
      const updated = await convertPayableToInvoice(bill.id, n);
      toast.success(t('finance:payable.convert.done', { number: n }));
      onConverted(updated);
      onClose();
    } catch (err: unknown) {
      if (err instanceof ApiError && err.code === 'DUPLICATE_INVOICE_NUMBER') {
        toast.error(t('finance:payable.convert.duplicate'), { description: err.message });
      } else {
        toast.error(t('finance:payable.convert.failed'), { description: err instanceof Error ? err.message : undefined });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className={WINDOW}>
        <Head kicker={bill.billNumber} title={t('finance:payable.convert.title')} />
        <div className={SHEET}>
          <PaperNote>{t('finance:payable.convert.hint')}</PaperNote>
          <div>
            <FieldLabel htmlFor="ap-convert-number">{t('finance:payable.convert.number')}</FieldLabel>
            <input id="ap-convert-number" value={number} maxLength={FIELD_LIMITS.DOCUMENT_NUMBER}
              onChange={e => setNumber(e.target.value)} placeholder={t('finance:payable.convert.numberPlaceholder')}
              className={cn(INPUT, INPUT_MONO)} />
          </div>
        </div>
        <Foot confirm={t('finance:payable.convert.confirm')} onConfirm={() => void submit()} onCancel={onClose} busy={busy} tone="ink" />
      </DialogContent>
    </Dialog>
  );
}

export function ReassignDialog({ bill, projects, onClose, onReassigned }: {
  bill: VendorBill | null; projects: ProjectBudget[]; onClose: () => void; onReassigned: (u: Payable) => void;
}) {
  const { t } = useTranslation(['finance', 'common']);
  const [seeded, setSeeded] = useState<number | null>(null);
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  if (bill && seeded !== bill.id) { setSeeded(bill.id); setTarget(''); }
  if (!bill) return null;

  async function submit() {
    if (!bill || !target) return;
    setBusy(true);
    try {
      const updated = await reassignPayableProject(bill.id, Number(target));
      toast.success(t('finance:payable.reassign.done', { bill: bill.billNumber, project: updated.project }));
      onReassigned(updated);
      onClose();
    } catch (err: unknown) {
      const code = err instanceof ApiError ? err.code : undefined;
      const key = code === 'PAYABLE_HAS_ACTIVE_PAYMENTS' ? 'hasPayments'
        : code === 'PROJECT_NOT_ACTIVE' ? 'notActive'
        : code === 'PAYABLE_ALREADY_IN_PROJECT' ? 'sameProject' : 'failed';
      toast.error(t(`finance:payable.reassign.${key}`), { description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  const hasActive = bill.payments.some(p => !p.voided);
  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className={WINDOW}>
        <Head kicker={bill.billNumber} title={t('finance:payable.reassign.title')} />
        <div className={SHEET}>
          <p className="text-[12.5px] leading-[1.5] text-[#2E2A24]">{t('finance:payable.reassign.description', { project: bill.project })}</p>
          {hasActive && <PaperNote tone="orange">{t('finance:payable.reassign.activePaymentsHint')}</PaperNote>}
          <div>
            <FieldLabel htmlFor="ap-reassign-target">{t('finance:payable.reassign.targetLabel')}</FieldLabel>
            <MonoSelect id="ap-reassign-target" value={target} onChange={e => setTarget(e.target.value)} className="w-full h-10 normal-case">
              <option value="">{t('finance:payable.reassign.targetPlaceholder')}</option>
              {projects.filter(p => p.id !== bill.projectId).map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
            </MonoSelect>
          </div>
        </div>
        <Foot confirm={t('finance:payable.reassign.confirm')} onConfirm={() => void submit()} onCancel={onClose} busy={busy} disabled={!target} tone="ink" />
      </DialogContent>
    </Dialog>
  );
}

export function UnpayDialog({ bill, onClose, onUnpaid }: {
  bill: VendorBill | null; onClose: () => void; onUnpaid: (u: Payable) => void;
}) {
  const { t } = useTranslation(['finance', 'common']);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  if (!bill) return null;

  async function submit() {
    if (!bill) return;
    setBusy(true);
    try {
      const updated = await markPayableUnpaid(bill.id, reason.trim() || undefined);
      toast.success(t('finance:payable.unpay.done', { bill: bill.billNumber }));
      onUnpaid(updated);
      onClose();
    } catch (err: unknown) {
      toast.error(t('finance:payable.unpay.failed'), { description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className={WINDOW}>
        <Head kicker={bill.billNumber} title={t('finance:payable.unpay.title')} tone="red" />
        <div className={SHEET}>
          <PaperNote tone="red">{t('finance:payable.unpay.warning')}</PaperNote>
          <div>
            <FieldLabel htmlFor="ap-unpay-reason">{t('finance:payable.unpay.reason')}</FieldLabel>
            <textarea id="ap-unpay-reason" rows={2} value={reason} maxLength={FIELD_LIMITS.NOTE}
              onChange={e => setReason(e.target.value)} placeholder={t('finance:payable.unpay.reasonPlaceholder')}
              className={cn(INPUT, 'h-auto py-2.5 resize-none')} />
          </div>
        </div>
        <Foot confirm={t('finance:payable.unpay.confirm')} onConfirm={() => void submit()} onCancel={onClose} busy={busy} tone="red" />
      </DialogContent>
    </Dialog>
  );
}

export function DeleteBillDialog({ bill, onClose, onDeleted }: {
  bill: VendorBill | null; onClose: () => void; onDeleted: (id: number) => void;
}) {
  const { t } = useTranslation(['finance', 'common']);
  const [step, setStep] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);
  const [seeded, setSeeded] = useState<number | null>(null);
  if (bill && seeded !== bill.id) { setSeeded(bill.id); setStep(1); }
  if (!bill) return null;

  async function submit() {
    if (!bill) return;
    if (step === 1) { setStep(2); return; }
    setBusy(true);
    try {
      await deletePayable(bill.id);
      toast.success(t('finance:payable.delete.done', { bill: bill.billNumber }));
      onDeleted(bill.id);
      onClose();
    } catch (err: unknown) {
      if (err instanceof ApiError && err.code === 'PAYABLE_HAS_ACTIVE_PAYMENTS') {
        toast.error(t('finance:payable.delete.hasPayments'), { description: err.message });
      } else {
        toast.error(t('finance:payable.delete.failed'), { description: err instanceof Error ? err.message : undefined });
      }
      onClose();
    } finally {
      setBusy(false);
    }
  }

  const hasActive = bill.payments.some(p => !p.voided);
  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className={WINDOW}>
        <Head kicker={bill.billNumber} title={t('finance:payable.delete.title')} tone="red" />
        <div className={SHEET}>
          <PaperNote tone="red">{t('finance:payable.delete.warning')}</PaperNote>
          {hasActive && <PaperNote tone="orange">{t('finance:payable.delete.activePaymentsHint')}</PaperNote>}
          {step === 2 && (
            <p className="text-[12.5px] font-semibold leading-[1.5] text-[#B3402A]">{t('finance:payable.delete.confirmFinal')}</p>
          )}
        </div>
        <Foot
          confirm={step === 1 ? t('finance:payable.delete.continue') : t('finance:payable.delete.confirm')}
          onConfirm={() => void submit()}
          onCancel={onClose}
          busy={busy}
          tone="red"
        />
      </DialogContent>
    </Dialog>
  );
}

export function EditPaymentDialog({ subject, onClose, onSaved }: {
  subject: { bill: VendorBill; payment: VendorPayment } | null;
  onClose: () => void;
  onSaved: (u: Payable) => void;
}) {
  const { t } = useTranslation(['finance', 'common']);
  const [seeded, setSeeded] = useState<number | null>(null);
  const [method, setMethod] = useState('Bank transfer');
  const [methodOther, setMethodOther] = useState('');
  const [date, setDate] = useState('');
  const [busy, setBusy] = useState(false);

  if (subject && seeded !== subject.payment.id) {
    setSeeded(subject.payment.id);
    const split = splitMethod(subject.payment.method);
    setMethod(split.method);
    setMethodOther(split.otherText);
    setDate(subject.payment.date);
  }
  if (!subject) return null;

  async function submit() {
    if (!subject) return;
    const resolved = resolveMethod(method, methodOther);
    if (!resolved) { toast.error(t('finance:payable.validation.methodRequired')); return; }
    if (!date) { toast.error(t('finance:payable.validation.checkFields')); return; }
    setBusy(true);
    try {
      const updated = await updatePayablePayment(subject.bill.id, subject.payment.id, { method: resolved, date });
      toast.success(t('finance:payable.editPayment.done'));
      onSaved(updated);
      onClose();
    } catch (err: unknown) {
      toast.error(t('finance:payable.editPayment.failed'), { description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className={WINDOW}>
        <Head kicker={subject.bill.billNumber} title={t('finance:payable.editPayment.title')} />
        <div className={SHEET}>
          <WindowSubject
            number={fmtMoney(subject.payment.amount)}
            who={subject.bill.vendor}
            label={t('finance:payable.editPayment.amountFixed')}
            amount=""
          />
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <FieldLabel htmlFor="ap-ep-date">{t('finance:payable.pay.date')}</FieldLabel>
              <input id="ap-ep-date" type="date" value={date} onChange={e => setDate(e.target.value)} className={cn(INPUT, INPUT_MONO)} />
            </div>
            <div>
              <FieldLabel>{t('finance:payable.pay.method')}</FieldLabel>
              <PaymentMethodField method={method} otherText={methodOther} onMethodChange={setMethod} onOtherTextChange={setMethodOther} />
            </div>
          </div>
        </div>
        <Foot confirm={t('common:buttons.save')} onConfirm={() => void submit()} onCancel={onClose} busy={busy} tone="ink" />
      </DialogContent>
    </Dialog>
  );
}

/** Void one payment — kept listed, struck through, with its reason. */
export async function voidOnePayment(billId: number, paymentId: number): Promise<Payable> {
  return voidPayablePayment(billId, paymentId);
}
