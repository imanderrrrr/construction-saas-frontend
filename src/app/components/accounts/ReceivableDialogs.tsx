import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle } from '../ui/dialog';
import { FOCUS_RING } from '../onboarding/chrome';
import { cn } from '../ui/utils';
import { FieldLabel, INPUT, INPUT_MONO, Mono, PaperNote } from '../projects/bt';
import { WINDOW, WINDOW_SHEET as SHEET, WindowFoot as Foot, WindowHead as Head } from './ui';
import { PaymentMethodField, resolveMethod } from '../PayableCommon';
import { fmtMoney } from '../invoices/bits';
import { ApiError } from '../../lib/api';
import { FIELD_LIMITS } from '../../../shared/fieldLimits';
import { businessToday } from '../../helpers/dateTime';
import {
  deleteReceivable, hasLiveQuickBooksPayment, recordReceivablePayment, rejectChangeOrder, updateReceivableInfo,
  type Receivable,
} from '../../services/finance';

/**
 * The windows of Cobrar. Three of them exist because the server draws the
 * lines: a collection is a new fact, the info edit is a PATCH of text only
 * (amounts are immutable once issued), and a change order is either approved
 * or declined — never quietly deleted.
 */

/* ── Registrar cobro ───────────────────────────────────────────────────── */

export function CollectDialog({ doc, onClose, onCollected, clientOverdue }: {
  doc: Receivable | null;
  onClose: () => void;
  onCollected: (updated: Receivable) => void;
  /** What this client still has overdue — a collection here does not change it. */
  clientOverdue: number;
}) {
  const { t } = useTranslation(['finance', 'common']);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(businessToday());
  const [method, setMethod] = useState('Bank transfer');
  const [methodOther, setMethodOther] = useState('');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [seeded, setSeeded] = useState<number | null>(null);

  const balance = doc ? Math.round((doc.amount - doc.paidAmount) * 100) / 100 : 0;

  // Seed from the document the first time this one opens, not on every render.
  if (doc && seeded !== doc.id) {
    setSeeded(doc.id);
    setAmount(balance.toFixed(2));
    setDate(businessToday());
    setMethod('Bank transfer');
    setMethodOther('');
    setReference('');
  }

  if (!doc) return null;

  const entered = parseFloat(amount) || 0;
  const left = Math.round((balance - entered) * 100) / 100;

  async function submit() {
    if (!doc) return;
    if (!entered || entered <= 0 || entered > balance || !date) {
      toast.error(t('finance:receivable.collect.checkFields'));
      return;
    }
    const resolved = resolveMethod(method, methodOther);
    if (!resolved) {
      toast.error(t('finance:payable.validation.methodRequired'));
      return;
    }
    setBusy(true);
    try {
      const updated = await recordReceivablePayment(doc.id, {
        amount: entered, date, method: resolved, reference: reference.trim() || undefined,
      });
      toast.success(t('finance:receivable.collect.done', { amount: fmtMoney(entered), invoice: doc.invoiceNumber }));
      onCollected(updated);
      onClose();
    } catch (err: unknown) {
      toast.error(t('finance:receivable.collect.failed'), { description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className={WINDOW}>
        <Head kicker={t('finance:receivable.eyebrow')} tone="orange" title={<DialogTitle className="font-bt-display font-extrabold uppercase text-[26px] leading-[1.05] mt-[3px]">{t('finance:receivable.collect.title')}</DialogTitle>} />
        <div className={SHEET}>
          <div className="flex items-center justify-between gap-2.5 bg-[#F3EEE4] px-3 py-2.5">
            <div className="min-w-0">
              <Mono className="block text-[12.5px] font-semibold normal-case text-[#0A0A0A]">{doc.invoiceNumber}</Mono>
              <span className="block text-[12.5px] text-[#5A5346] mt-[3px] truncate">{doc.client} · {doc.project}</span>
            </div>
            <div className="text-right flex-shrink-0">
              <Mono className="block text-[9.5px] tracking-[0.1em] text-[#8A8175]">{t('finance:accounts.balance')}</Mono>
              <Mono className="block text-[14px] font-semibold normal-case tabular-nums">{fmtMoney(balance)}</Mono>
            </div>
          </div>

          <div>
            <FieldLabel htmlFor="ar-collect-amount">{t('finance:receivable.collect.amount')}</FieldLabel>
            <input
              id="ar-collect-amount"
              type="number" step="0.01" min="0.01" max={balance}
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className={cn(INPUT, 'h-auto border-[#F97316] py-3 font-bt-mono text-[20px] font-semibold tabular-nums')}
            />
            <div className="flex gap-2 mt-2">
              <button type="button" onClick={() => setAmount(balance.toFixed(2))}
                className={cn('font-bt-mono text-[9.5px] uppercase tracking-[0.09em] px-2.5 py-1.5 bg-[#0A0A0A] text-[#F5F1E8] cursor-pointer', FOCUS_RING)}>
                {t('finance:receivable.collect.whole')}
              </button>
              <button type="button" onClick={() => setAmount('')}
                className={cn('font-bt-mono text-[9.5px] uppercase tracking-[0.09em] px-2.5 py-1.5 border border-[#DBD0BB] text-[#5A5346] cursor-pointer', FOCUS_RING)}>
                {t('finance:receivable.collect.partial')}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <FieldLabel htmlFor="ar-collect-date">{t('finance:receivable.collect.date')}</FieldLabel>
              <input id="ar-collect-date" type="date" value={date} onChange={e => setDate(e.target.value)} className={cn(INPUT, INPUT_MONO)} />
            </div>
            <div>
              <FieldLabel>{t('finance:receivable.collect.method')}</FieldLabel>
              <PaymentMethodField method={method} otherText={methodOther} onMethodChange={setMethod} onOtherTextChange={setMethodOther} />
            </div>
          </div>

          <div>
            <FieldLabel htmlFor="ar-collect-ref">{t('finance:receivable.collect.reference')}</FieldLabel>
            <input id="ar-collect-ref" type="text" value={reference} maxLength={FIELD_LIMITS.REFERENCE}
              onChange={e => setReference(e.target.value)} placeholder={t('finance:receivable.collect.referencePlaceholder')}
              className={cn(INPUT, INPUT_MONO)} />
          </div>

          <div className="bg-[#FBF8F2] border-l-[3px] border-l-[#2E7D4F] px-3 py-2.5">
            <Mono className="block text-[9px] tracking-[0.12em] text-[#8A8175]">{t('finance:receivable.collect.after')}</Mono>
            <div className="flex items-baseline gap-2.5 mt-1 flex-wrap">
              <span className="font-bt-display font-extrabold text-[26px] leading-none tabular-nums">{fmtMoney(Math.max(left, 0))}</span>
              <Mono className={cn('text-[10px] tracking-[0.08em]', left <= 0 ? 'text-[#2E7D4F]' : 'text-[#5A5346]')}>
                {left <= 0 ? t('finance:receivable.collect.settles') : t('finance:receivable.collect.stillOwed')}
              </Mono>
            </div>
            {clientOverdue > 0 && (
              <Mono className="block text-[9.5px] tracking-[0.04em] text-[#8A8175] mt-1.5 normal-case">
                {t('finance:receivable.collect.clientOverdue', { amount: fmtMoney(clientOverdue) })}
              </Mono>
            )}
          </div>
        </div>
        <Foot cancelLabel={t('common:buttons.cancel')}
          confirm={t('finance:receivable.collect.confirm', { amount: fmtMoney(entered || 0) })}
          onConfirm={() => void submit()}
          onCancel={onClose}
          busy={busy}
          tone="orange"
          disabled={!entered}
        />
      </DialogContent>
    </Dialog>
  );
}

/* ── Rechazar una orden de cambio ──────────────────────────────────────── */

export function RejectChangeOrderDialog({ doc, onClose, onRejected }: {
  doc: Receivable | null;
  onClose: () => void;
  onRejected: () => void;
}) {
  const { t } = useTranslation(['finance', 'common']);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  if (!doc) return null;

  async function submit() {
    if (!doc) return;
    setBusy(true);
    try {
      await rejectChangeOrder(doc.id, reason);
      toast.success(t('finance:receivable.reject.done', { number: doc.invoiceNumber }));
      onRejected();
      onClose();
    } catch (err: unknown) {
      toast.error(t('finance:receivable.reject.failed'), { description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className={WINDOW}>
        <Head kicker={t('finance:receivable.co.pending')} tone="orange" title={<DialogTitle className="font-bt-display font-extrabold uppercase text-[26px] leading-[1.05] mt-[3px]">{t('finance:receivable.reject.title', { number: doc.invoiceNumber })}</DialogTitle>} />
        <div className={SHEET}>
          <p className="text-[12.5px] leading-[1.5] text-[#2E2A24]">
            {doc.client} · {doc.project} · <b>{fmtMoney(doc.amount)}</b>
          </p>
          <div>
            <FieldLabel htmlFor="ar-reject-reason">{t('finance:receivable.reject.reason')}</FieldLabel>
            <textarea id="ar-reject-reason" rows={3} value={reason} maxLength={FIELD_LIMITS.NOTE}
              onChange={e => setReason(e.target.value)} placeholder={t('finance:receivable.reject.reasonPlaceholder')}
              className={cn(INPUT, 'h-auto py-2.5 resize-none')} />
          </div>
        </div>
        <Foot cancelLabel={t('common:buttons.cancel')}
          confirm={t('finance:receivable.reject.confirm')}
          onConfirm={() => void submit()}
          onCancel={onClose}
          busy={busy}
          tone="red"
          note={t('finance:receivable.reject.note')}
        />
      </DialogContent>
    </Dialog>
  );
}

/* ── Editar información ────────────────────────────────────────────────── */

export function EditInfoDialog({ doc, onClose, onSaved }: {
  doc: Receivable | null;
  onClose: () => void;
  onSaved: (updated: Receivable) => void;
}) {
  const { t } = useTranslation(['finance', 'common']);
  const [seeded, setSeeded] = useState<number | null>(null);
  const [number, setNumber] = useState('');
  const [client, setClient] = useState('');
  const [description, setDescription] = useState('');
  const [issuedDate, setIssuedDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  if (doc && seeded !== doc.id) {
    setSeeded(doc.id);
    setNumber(doc.invoiceNumber);
    setClient(doc.client);
    setDescription(doc.description ?? '');
    setIssuedDate(doc.issuedDate);
    setDueDate(doc.dueDate);
    setNotes(doc.notes ?? '');
  }

  if (!doc) return null;

  async function submit() {
    if (!doc) return;
    const n = number.trim();
    const c = client.trim();
    if (!n || !c) {
      toast.error(t('finance:receivable.edit.requiredFields'));
      return;
    }
    if (dueDate < issuedDate) {
      toast.error(t('finance:receivable.edit.dueBeforeIssued'));
      return;
    }
    // Partial PATCH: send what changed, leave the rest untouched.
    const payload: Parameters<typeof updateReceivableInfo>[1] = {};
    if (n !== doc.invoiceNumber) payload.invoiceNumber = n;
    if (c !== doc.client) payload.client = c;
    const d = description.trim();
    if (d !== (doc.description ?? '')) payload.description = d || null;
    const no = notes.trim();
    if (no !== (doc.notes ?? '')) payload.notes = no || null;
    if (issuedDate !== doc.issuedDate) payload.issuedDate = issuedDate;
    if (dueDate !== doc.dueDate) payload.dueDate = dueDate;
    if (Object.keys(payload).length === 0) { onClose(); return; }

    setBusy(true);
    try {
      const updated = await updateReceivableInfo(doc.id, payload);
      toast.success(t('finance:receivable.edit.done'));
      onSaved(updated);
      onClose();
    } catch (err: unknown) {
      if (err instanceof ApiError && err.code === 'DUPLICATE_INVOICE_NUMBER') {
        toast.error(t('finance:receivable.edit.duplicate'), { description: err.message });
      } else {
        toast.error(t('finance:receivable.edit.failed'), { description: err instanceof Error ? err.message : undefined });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className={cn(WINDOW, 'sm:max-w-[520px]')}>
        <Head kicker={t('finance:receivable.eyebrow')} tone="orange" title={<DialogTitle className="font-bt-display font-extrabold uppercase text-[26px] leading-[1.05] mt-[3px]">{t('finance:receivable.edit.title')}</DialogTitle>} />
        <div className={SHEET}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <FieldLabel htmlFor="ar-edit-number">{t('finance:receivable.edit.number')}</FieldLabel>
              <input id="ar-edit-number" value={number} maxLength={FIELD_LIMITS.IDENTIFIER}
                onChange={e => setNumber(e.target.value)} className={cn(INPUT, INPUT_MONO)} />
            </div>
            <div>
              <FieldLabel htmlFor="ar-edit-client">{t('finance:receivable.edit.client')}</FieldLabel>
              <input id="ar-edit-client" value={client} maxLength={FIELD_LIMITS.SHORT_NAME}
                onChange={e => setClient(e.target.value)} className={INPUT} />
            </div>
            <div>
              <FieldLabel htmlFor="ar-edit-issued">{t('finance:receivable.edit.issued')}</FieldLabel>
              <input id="ar-edit-issued" type="date" value={issuedDate} onChange={e => setIssuedDate(e.target.value)} className={cn(INPUT, INPUT_MONO)} />
            </div>
            <div>
              <FieldLabel htmlFor="ar-edit-due">{t('finance:receivable.edit.due')}</FieldLabel>
              <input id="ar-edit-due" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={cn(INPUT, INPUT_MONO)} />
            </div>
          </div>
          <div>
            <FieldLabel htmlFor="ar-edit-desc">{t('finance:receivable.edit.description')}</FieldLabel>
            <input id="ar-edit-desc" value={description} maxLength={FIELD_LIMITS.NOTE}
              onChange={e => setDescription(e.target.value)} className={INPUT} />
          </div>
          <div>
            <FieldLabel htmlFor="ar-edit-notes">{t('finance:receivable.edit.notes')}</FieldLabel>
            <textarea id="ar-edit-notes" rows={2} value={notes} maxLength={FIELD_LIMITS.EXTENDED_NOTE}
              onChange={e => setNotes(e.target.value)} className={cn(INPUT, 'h-auto py-2.5 resize-none')} />
          </div>
          <PaperNote>{t('finance:receivable.edit.amountsHint')}</PaperNote>
        </div>
        <Foot cancelLabel={t('common:buttons.cancel')} confirm={t('common:buttons.save')} onConfirm={() => void submit()} onCancel={onClose} busy={busy} tone="orange" />
      </DialogContent>
    </Dialog>
  );
}

/* ── Eliminar ──────────────────────────────────────────────────────────── */

export function DeleteReceivableDialog({ doc, onClose, onDeleted }: {
  doc: Receivable | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { t } = useTranslation(['finance', 'common']);
  const [busy, setBusy] = useState(false);
  if (!doc) return null;

  async function submit() {
    if (!doc) return;
    setBusy(true);
    try {
      await deleteReceivable(doc.id);
      toast.success(t('finance:receivable.delete.done'), { description: doc.invoiceNumber });
      onDeleted();
      onClose();
    } catch (err: unknown) {
      if (err instanceof ApiError && err.code === 'RECEIVABLE_HAS_PAYMENTS') {
        // A collection read from QuickBooks is undone there; the server's
        // sentence (the description) already says so.
        toast.error(
          t(hasLiveQuickBooksPayment(doc) ? 'finance:receivable.delete.hasQuickBooksPayments' : 'finance:receivable.delete.hasPayments'),
          { description: err.message },
        );
      } else {
        toast.error(t('finance:receivable.delete.failed'), { description: err instanceof Error ? err.message : undefined });
      }
      onClose();
    } finally {
      setBusy(false);
    }
  }

  const isApprovedCo = doc.documentType === 'CHANGE_ORDER_REQUEST';
  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className={WINDOW}>
        <Head kicker={t('finance:receivable.eyebrow')} tone="red" title={<DialogTitle className="font-bt-display font-extrabold uppercase text-[26px] leading-[1.05] mt-[3px]">{t('finance:receivable.delete.title', { number: doc.invoiceNumber })}</DialogTitle>} />
        <div className={SHEET}>
          <p className="text-[12.5px] leading-[1.5] text-[#2E2A24]">{t('finance:receivable.delete.confirmText')}</p>
          {isApprovedCo && <PaperNote tone="orange">{t('finance:receivable.delete.coHeadroomNote')}</PaperNote>}
        </div>
        <Foot cancelLabel={t('common:buttons.cancel')} confirm={t('finance:receivable.delete.action')} onConfirm={() => void submit()} onCancel={onClose} busy={busy} tone="red" />
      </DialogContent>
    </Dialog>
  );
}
