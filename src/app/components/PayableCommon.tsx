import { useTranslation } from 'react-i18next';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from './ui/select';
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

export function StatusBadge({ status }: { status: VendorBill['status'] }) {
  const { t } = useTranslation('common');
  const map: Record<string, string> = {
    paid:    'bg-emerald-50 text-emerald-700 border-emerald-200',
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    partial: 'bg-blue-50 text-blue-700 border-blue-200',
    overdue: 'bg-red-50 text-red-700 border-red-200',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${map[status]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'paid' ? 'bg-emerald-500' : status === 'partial' ? 'bg-blue-500' : status === 'pending' ? 'bg-amber-500' : 'bg-red-500'}`} />
      {t('status.' + status)}
    </span>
  );
}

export function CategoryBadge({ category }: { category: BillCategory }) {
  const { t } = useTranslation('finance');
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FAFAFA] text-[#0A0A0A] border border-[#D4D4D8]">
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

export function PaymentMethodField({
  method,
  otherText,
  onMethodChange,
  onOtherTextChange,
}: {
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
  return (
    <>
      <Select value={method} onValueChange={onMethodChange}>
        <SelectTrigger className="h-9 text-sm border-[#D4D4D8]"><SelectValue /></SelectTrigger>
        <SelectContent>
          {presets.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
          <SelectItem value={OTHER_METHOD}>{t('paymentMethod.other')}</SelectItem>
        </SelectContent>
      </Select>
      {method === OTHER_METHOD && (
        <input
          type="text"
          value={otherText}
          onChange={e => onOtherTextChange(e.target.value)}
          maxLength={FIELD_LIMITS.SHORT_NAME}
          placeholder={t('paymentMethod.otherPlaceholder')}
          aria-label={t('paymentMethod.otherPlaceholder')}
          className="mt-2 h-9 w-full rounded-md border border-[#D4D4D8] px-3 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-purple-400"
        />
      )}
    </>
  );
}
