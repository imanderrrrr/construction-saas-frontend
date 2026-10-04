import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../ui/utils';
import { FIELD_LIMITS } from '../../../shared/fieldLimits';
import { ApiError } from '../../lib/api';
import { newRequestKey } from '../../lib/requestKey';
import { businessToday } from '../../helpers/dateTime';
import { registerPayment, type SubcontractorInvoiceDTO } from '../../services/subcontractors';
import { BtModal } from '../bt/windows';
import { PrimaryButton, SecondaryButton } from '../onboarding/chrome';
import { FieldHint, FieldLabel, INPUT, INPUT_MONO, Mono, PaperNote } from '../projects/bt';
import { PaymentMethodField, resolveMethod } from '../PayableCommon';
import { fmtMoney, InvoiceStatusChip } from './bits';

/**
 * 09 — record a payment, full or partial.
 *
 * It records; it does not move money. The old button was green, and green in
 * this panel means "approved" and nothing else — a green action button broke
 * the one colour rule the panel has.
 *
 * Approving the invoice created its bill in Cuentas por pagar, so a payment
 * here is a payment of that bill: it can cover part of what is owed, it
 * discounts the jobsite's budget, and it can be voided from Pagar. The big
 * figure is therefore what is still owed, not the invoice amount — the one
 * number here that costs money if it is wrong.
 *
 * The window keeps ONE request key per payment it is opened for (see
 * lib/requestKey): a double click or a reply lost on a bad connection books
 * it once.
 */

const MAX_REFERENCE = FIELD_LIMITS.REFERENCE;

/** Server refusals this window explains in its own words instead of retrying. */
type Refusal = 'quickbooks' | 'alreadyRecorded' | 'inPayables' | null;

export function RegisterPaymentModal({ open, onOpenChange, invoice, onPaid }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: SubcontractorInvoiceDTO | null;
  onPaid: (invoice: SubcontractorInvoiceDTO) => void;
}) {
  const { t } = useTranslation(['subcontractors', 'common']);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(businessToday());
  const [method, setMethod] = useState('Bank transfer');
  const [methodOther, setMethodOther] = useState('');
  const [reference, setReference] = useState('');
  const [requestKey, setRequestKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [error, setError] = useState(false);
  const [refusal, setRefusal] = useState<Refusal>(null);

  const outstandingCents = invoice
    ? invoice.outstandingCents ?? invoice.amountCents - (invoice.paidAmountCents ?? 0)
    : 0;

  useEffect(() => {
    if (!open || !invoice) return;
    setAmount((outstandingCents / 100).toFixed(2));
    setDate(businessToday());
    setMethod('Bank transfer');
    setMethodOther('');
    setReference('');
    setRequestKey(newRequestKey());
    setSaving(false);
    setInvalid(false);
    setError(false);
    setRefusal(null);
  }, [open, invoice?.id]); // eslint-disable-line react-hooks/exhaustive-deps -- seed once per opening, not on every keystroke of the parent

  if (!invoice) return null;

  const paidCents = invoice.paidAmountCents ?? 0;

  const submit = async () => {
    const amountCents = Math.round(Number(amount) * 100);
    const resolved = resolveMethod(method, methodOther);
    if (!/^\d+(\.\d{1,2})?$/.test(amount.trim()) || !Number.isSafeInteger(amountCents)
      || amountCents <= 0 || amountCents > outstandingCents || !date || !resolved) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setSaving(true);
    setError(false);
    try {
      const updated = await registerPayment(invoice.id, {
        amountCents,
        date,
        method: resolved,
        requestKey,
        paymentReference: reference.trim() || null,
      });
      onPaid(updated);
      onOpenChange(false);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      if (code === 'QUICKBOOKS_PAYMENTS_IN_QBO') setRefusal('quickbooks');
      else if (code === 'PAYMENT_REQUEST_CONFLICT') setRefusal('alreadyRecorded');
      else if (code === 'SUBCONTRACTOR_INVOICE_IN_PAYABLES') setRefusal('inPayables');
      else setError(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <BtModal
      open={open}
      onOpenChange={onOpenChange}
      width={480}
      dismissible={false}
      closeDisabled={saving}
      kicker={t('subcontractors:pay.kicker')}
      title={t('subcontractors:pay.title')}
      footer={
        <>
          <SecondaryButton onClick={() => onOpenChange(false)} disabled={saving}>
            {refusal ? t('common:buttons.close') : t('common:buttons.cancel')}
          </SecondaryButton>
          {!refusal && (
            <PrimaryButton onClick={submit} disabled={saving}>
              {saving ? t('subcontractors:pay.submitting') : t('subcontractors:pay.submit')}
            </PrimaryButton>
          )}
        </>
      }
    >
      <div className="bg-[#FBF8F2] border border-[#EDE7DB] px-[17px] py-[15px]">
        <div className="flex items-center justify-between gap-3">
          <Mono className="text-[11.5px] font-semibold tracking-[0.06em] text-[#0A0A0A]">
            {invoice.invoiceNumber ?? `#${invoice.id}`}
          </Mono>
          <InvoiceStatusChip status={invoice.status} />
        </div>
        <div className="text-[12.5px] leading-[1.45] text-[#5A5346] mt-2">
          {invoice.subcontractorName ?? ''} · {invoice.jobTitle}
        </div>
        <Mono className="block text-[9.5px] tracking-[0.12em] text-[#8A8175] mt-2.5">{t('subcontractors:pay.owed')}</Mono>
        <div className="font-bt-display font-extrabold text-[46px] leading-none tabular-nums text-[#0A0A0A] mt-1" data-testid="pay-outstanding">
          {fmtMoney(outstandingCents)}
        </div>
        {paidCents > 0 && (
          <Mono className="block text-[10px] tracking-[0.06em] text-[#5A5346] mt-1.5 normal-case">
            {t('subcontractors:pay.paidSoFar', { paid: fmtMoney(paidCents), amount: fmtMoney(invoice.amountCents) })}
          </Mono>
        )}
      </div>

      {invoice.legacyUnlinked && !refusal && (
        <div className="mt-3.5" data-testid="pay-legacy-warning">
          <PaperNote tone="orange">
            <div className="font-semibold">{t('subcontractors:pay.legacy.title')}</div>
            <div className="mt-1">{t('subcontractors:pay.legacy.body')}</div>
          </PaperNote>
        </div>
      )}

      {refusal ? (
        <div className="mt-4" data-testid={`pay-refusal-${refusal}`}>
          <PaperNote tone={refusal === 'quickbooks' ? 'orange' : 'red'}>
            <div className="font-semibold">{t(`subcontractors:pay.refusal.${refusal}.title`)}</div>
            <div className="mt-1">{t(`subcontractors:pay.refusal.${refusal}.body`)}</div>
          </PaperNote>
        </div>
      ) : (
        <>
          <div className="mt-[14px]">
            <FieldLabel htmlFor={`pay-amount-${invoice.id}`} required>{t('subcontractors:pay.amount')}</FieldLabel>
            <input
              id={`pay-amount-${invoice.id}`}
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              max={(outstandingCents / 100).toFixed(2)}
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className={cn(INPUT, 'h-auto border-[#0A0A0A] py-3 font-bt-mono text-[20px] font-semibold tabular-nums')}
            />
            <FieldHint>{t('subcontractors:pay.amountHint', { max: fmtMoney(outstandingCents) })}</FieldHint>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-[14px]">
            <div>
              <FieldLabel htmlFor={`pay-date-${invoice.id}`} required>{t('subcontractors:pay.date')}</FieldLabel>
              <input
                id={`pay-date-${invoice.id}`}
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className={cn(INPUT, INPUT_MONO)}
              />
            </div>
            <div>
              <FieldLabel htmlFor={`pay-method-${invoice.id}`} required>{t('subcontractors:pay.method')}</FieldLabel>
              <PaymentMethodField
                id={`pay-method-${invoice.id}`}
                method={method}
                otherText={methodOther}
                onMethodChange={setMethod}
                onOtherTextChange={setMethodOther}
              />
            </div>
          </div>

          <div className="mt-[14px]">
            <FieldLabel htmlFor={`pay-ref-${invoice.id}`}>{t('subcontractors:pay.reference')}</FieldLabel>
            <input
              id={`pay-ref-${invoice.id}`}
              value={reference}
              onChange={e => setReference(e.target.value)}
              placeholder={t('subcontractors:pay.referencePlaceholder')}
              maxLength={MAX_REFERENCE}
              className={cn(INPUT)}
            />
            <FieldHint>{t('subcontractors:pay.referenceHint', { max: MAX_REFERENCE })}</FieldHint>
          </div>

          {invalid && (
            <div className="mt-3" data-testid="pay-invalid">
              <PaperNote tone="red">{t('subcontractors:pay.validation')}</PaperNote>
            </div>
          )}

          <PaperNote className="mt-4">{t('subcontractors:pay.note')}</PaperNote>

          {error && (
            <PaperNote tone="red" className="mt-3">
              <div className="font-semibold">{t('subcontractors:pay.error.title')}</div>
              <div className="mt-1">{t('subcontractors:pay.error.hint')}</div>
            </PaperNote>
          )}
        </>
      )}
    </BtModal>
  );
}
