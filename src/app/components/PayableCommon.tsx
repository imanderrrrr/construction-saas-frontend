import { useTranslation } from 'react-i18next';
import type { Payable, PayablePayment as ApiPayablePayment } from '../services/finance';

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
