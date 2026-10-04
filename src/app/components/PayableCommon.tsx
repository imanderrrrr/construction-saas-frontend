import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { cn } from './ui/utils';
import { INPUT, MonoSelect } from './projects/bt';
import type { Payable, PayablePayment as ApiPayablePayment } from '../services/finance';
import { FIELD_LIMITS } from '../../shared/fieldLimits';

// Shared payable presentation bits (AP Block 6) — extracted from
// AccountsPayable.tsx so the detail modal can reuse them without a cycle.

export type VendorPayment = ApiPayablePayment;

export type BillCategory = 'materials' | 'equipment-rental' | 'subcontractor' | 'services' | 'other';

export interface VendorBill {
  id: number;
  billNumber: string;
  vendor: string;
  category: BillCategory;
  project: string;
  projectId: number;
  description: string | null;
  documentType: 'BILL' | 'INVOICE';
  invoiceNumber: string | null;
  receivedDate: string;
  dueDate: string;
  amount: number;
  paidAmount: number;
  status: 'paid' | 'pending' | 'partial' | 'overdue';
  notes: string | null;
  payments: VendorPayment[];
  createdAt: string;
  updatedAt: string;
  /** Photos and PDFs on the bill; 0 on a server that doesn't report them yet. */
  attachmentCount: number;
  /** Oldest attachment paintable as an image — null when the bill has only PDFs. */
  firstAttachmentId: number | null;
  /** Sent to the tenant's QuickBooks, whose payments are read from there (phase 4). */
  paymentsInQuickBooks: boolean;
  /**
   * The approved subcontractor invoice this bill belongs to, or null. Its
   * amount, supplier, number, project and category are that invoice's; the
   * panel offers only what the server still lets change (dates, text, payments).
   */
  subcontractorInvoiceId?: number | null;
}

export function toVendorBill(p: Payable): VendorBill {
  return {
    id: p.id,
    billNumber: p.billNumber,
    vendor: p.vendor,
    category: p.category as BillCategory,
    project: p.project,
    projectId: p.projectId,
    description: p.description,
    documentType: p.documentType,
    invoiceNumber: p.invoiceNumber,
    receivedDate: p.receivedDate,
    dueDate: p.dueDate,
    amount: p.amount,
    paidAmount: p.paidAmount,
    status: p.status as VendorBill['status'],
    notes: p.notes,
    payments: p.payments,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    attachmentCount: p.attachmentCount ?? 0,
    firstAttachmentId: p.firstAttachmentId ?? null,
    paymentsInQuickBooks: p.paymentsInQuickBooks ?? false,
    subcontractorInvoiceId: p.subcontractorInvoiceId ?? null,
  };
}

export function fmtAmount(n: number) {
  return `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

export const CATEGORY_KEY_MAP: Record<BillCategory, string> = {
  materials: 'payable.category.materials',
  'equipment-rental': 'payable.category.equipmentRental',
  subcontractor: 'payable.category.subcontractor',
  services: 'payable.category.services',
  other: 'payable.category.other',
};

export function CategoryBadge({ category }: { category: BillCategory }) {
  const { t } = useTranslation('finance');
  return (
    <span className="inline-flex items-center rounded-none border border-[#CDBFA6] bg-[#FAF7F0] px-1.5 py-[3px] font-bt-mono text-[9.5px] uppercase tracking-[0.09em] text-[#0A0A0A]">
      {t(CATEGORY_KEY_MAP[category])}
    </span>
  );
}

// ── AP Block 3 — payment method picker ───────────────────
// Shared by the "record payment" and "edit payment" dialogs. The method is free
// text: five presets plus a typed-in "Other" (the backend stores the string
// verbatim — no allow-list). Fully controlled by two parent-owned fields, the
// same idiom the create-bill dialog already uses for the vendor "Other" case:
//   · `method`    — the dropdown value (a preset, or the sentinel 'Other')
//   · `otherText` — the free-text box, shown only when 'Other' is picked
// resolveMethod() collapses the pair to the string to POST/PATCH; splitMethod()
// seeds the pair from an existing payment's method (for the edit dialog).

export const PAYMENT_METHOD_PRESETS = ['Bank transfer', 'Check', 'Cash', 'Wire transfer', 'Credit card'] as const;
export const OTHER_METHOD = 'Other';

/** Effective method string to send to the API (trimmed custom text when 'Other'). */
export function resolveMethod(method: string, otherText: string): string {
  return method === OTHER_METHOD ? otherText.trim() : method;
}

/** Seed the (dropdown, text) pair from an existing payment method. */
export function splitMethod(method: string): { method: string; otherText: string } {
  return (PAYMENT_METHOD_PRESETS as readonly string[]).includes(method)
    ? { method, otherText: '' }
    : { method: OTHER_METHOD, otherText: method };
}

/**
 * i18n key for each preset — the picker stores these values language-independently
 * (so the data doesn't drift when the UI language changes) but the payment-history
 * tables were rendering them RAW, so a payment made by picking "Transferencia
 * bancaria" showed back as "Bank transfer".
 */
const PRESET_LABEL_KEYS: Record<(typeof PAYMENT_METHOD_PRESETS)[number], string> = {
  'Bank transfer': 'finance:paymentMethod.bankTransfer',
  'Check': 'finance:paymentMethod.check',
  'Cash': 'finance:paymentMethod.cash',
  'Wire transfer': 'finance:paymentMethod.wireTransfer',
  'Credit card': 'finance:paymentMethod.creditCard',
};

/**
 * Localize a stored payment method for display. Presets map to the current UI
 * language; a typed-in custom ("Other") method — or any unknown value — is
 * returned verbatim rather than blanked.
 */
/**
 * Methods only QuickBooks writes (phase 4: a credit memo or a vendor credit
 * applied there). Never offered in the pay dialog, but named in the panel's
 * language when a payment read from QuickBooks carries one.
 */
const QUICKBOOKS_METHOD_KEYS: Record<string, string> = {
  'Credit memo': 'finance:paymentMethod.creditMemo',
  'Vendor credit': 'finance:paymentMethod.vendorCredit',
};

export function paymentMethodLabel(method: string, t: TFunction): string {
  const key = PRESET_LABEL_KEYS[method as (typeof PAYMENT_METHOD_PRESETS)[number]]
    ?? QUICKBOOKS_METHOD_KEYS[method]
    // The server's own default when a payment arrives without a method (an
    // older panel paying a subcontractor invoice): name it, don't print it raw.
    ?? (method === OTHER_METHOD ? 'finance:paymentMethod.other' : undefined);
  return key ? t(key, method) : method;
}

export function PaymentMethodField({
  id,
  method,
  otherText,
  onMethodChange,
  onOtherTextChange,
}: {
  /** For a <label htmlFor> outside the field. */
  id?: string;
  method: string;
  otherText: string;
  onMethodChange: (v: string) => void;
  onOtherTextChange: (v: string) => void;
}) {
  const { t } = useTranslation('finance');
  const presets = [
    { value: 'Bank transfer', label: t('paymentMethod.bankTransfer') },
    { value: 'Check', label: t('paymentMethod.check') },
    { value: 'Cash', label: t('paymentMethod.cash') },
    { value: 'Wire transfer', label: t('paymentMethod.wireTransfer') },
    { value: 'Credit card', label: t('paymentMethod.creditCard') },
  ];
  // The panel's own square select and input — this field sits inside every
  // payment window (Cobrar, Pagar, subcontractors), so it wears their look.
  return (
    <>
      <MonoSelect
        id={id}
        value={method}
        onChange={e => onMethodChange(e.target.value)}
        aria-label={t('paymentMethod.label')}
        className="w-full h-10"
      >
        {presets.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        <option value={OTHER_METHOD}>{t('paymentMethod.other')}</option>
      </MonoSelect>
      {method === OTHER_METHOD && (
        <input
          type="text"
          value={otherText}
          onChange={e => onOtherTextChange(e.target.value)}
          maxLength={FIELD_LIMITS.SHORT_NAME}
          placeholder={t('paymentMethod.otherPlaceholder')}
          aria-label={t('paymentMethod.otherPlaceholder')}
          className={cn(INPUT, 'mt-2')}
        />
      )}
    </>
  );
}
