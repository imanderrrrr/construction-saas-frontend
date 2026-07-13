import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pencil, RotateCcw, Ban, Receipt, Trash2, ArrowRightLeft, FileText, DollarSign,
} from 'lucide-react';
import { Button } from './ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from './ui/dialog';
import { fmtDate, fmtDateTime, daysOverdue } from '../helpers/dateTime';
import {
  StatusBadge, CategoryBadge, fmtAmount, type VendorBill, type VendorPayment,
} from './PayableCommon';
import { PayableAttachmentsPanel } from './PayableAttachmentsPanel';

/**
 * AP Block 6 — full detail view for a payable, opened by clicking its row.
 * Shows every PayableResponse field plus the payment history and the invoice
 * images, and consolidates every existing action (they open the already-existing
 * dialogs, which stack on top of this modal; the bill prop is derived from the
 * page's state by id, so the detail refreshes live after each action).
 */
export function PayableDetailModal({
  bill,
  onClose,
  canManage,
  submitting,
  onRecordPayment,
  onEditAmountDates,
  onEditInfo,
  onConvert,
  onReassign,
  onMarkUnpaid,
  onDelete,
  onVoidPayment,
  onEditPayment,
}: {
  bill: VendorBill | null;
  onClose: () => void;
  canManage: boolean;
  submitting: boolean;
  onRecordPayment: (bill: VendorBill) => void;
  onEditAmountDates: (bill: VendorBill) => void;
  onEditInfo: (bill: VendorBill) => void;
  onConvert: (bill: VendorBill) => void;
  onReassign: (bill: VendorBill) => void;
  onMarkUnpaid: (bill: VendorBill) => void;
  onDelete: (bill: VendorBill) => void;
  onVoidPayment: (bill: VendorBill, paymentId: number) => void;
  onEditPayment: (bill: VendorBill, payment: VendorPayment) => void;
}) {
  const { t, i18n } = useTranslation('finance');
  const dateLoc = i18n.language === 'es' ? 'es' : 'en-US';

  if (!bill) return null;

  const balance = bill.amount - bill.paidAmount;
  const isOverdue = bill.status === 'overdue';
  const hasActivePayments = bill.payments.some(p => !p.voided);

  const field = (label: string, value: ReactNode, opts?: { wide?: boolean; mono?: boolean }) => (
    <div className={opts?.wide ? 'sm:col-span-2' : undefined}>
      <p className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-0.5">{label}</p>
      <div className={`text-sm text-[#0A0A0A] ${opts?.mono ? 'font-mono' : ''}`}>{value ?? '—'}</div>
    </div>
  );

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('payable.detail.title')} — <span className="font-mono">{bill.billNumber}</span></DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-1 max-h-[70vh] overflow-y-auto pr-1">
          {/* Status strip */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FAFAFA] text-[#0A0A0A] border border-[#D4D4D8]">
              {bill.documentType === 'INVOICE' ? t('payable.detail.docType.invoice') : t('payable.detail.docType.bill')}
            </span>
            {bill.documentType === 'INVOICE' && bill.invoiceNumber && (
              <span className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-700">
                <Receipt className="h-2.5 w-2.5" /> {bill.invoiceNumber}
              </span>
            )}
            <StatusBadge status={bill.status} />
            {isOverdue && (
              <span className="text-[11px] font-medium text-red-600">
                {t('labels.daysOverdue', { ns: 'common', count: daysOverdue(bill.dueDate) })}
              </span>
            )}
          </div>

          {/* Money summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-[#D4D4D8] bg-[#FAFAFA]/60 p-3">
              <p className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('payable.table.amount')}</p>
              <p className="font-mono text-base font-semibold text-[#0A0A0A]">{fmtAmount(bill.amount)}</p>
            </div>
            <div className="rounded-lg border border-[#D4D4D8] bg-[#FAFAFA]/60 p-3">
              <p className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('payable.table.paid')}</p>
              <p className={`font-mono text-base font-semibold ${bill.paidAmount >= bill.amount ? 'text-emerald-600' : 'text-[#0A0A0A]'}`}>{fmtAmount(bill.paidAmount)}</p>
            </div>
            <div className="rounded-lg border border-[#D4D4D8] bg-[#FAFAFA]/60 p-3">
              <p className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('payable.table.balance')}</p>
              <p className={`font-mono text-base font-semibold ${balance === 0 ? 'text-emerald-600' : isOverdue ? 'text-red-600' : 'text-amber-600'}`}>{fmtAmount(balance)}</p>
            </div>
          </div>

          {/* All fields */}
          <div>
            <p className="text-xs font-semibold text-[#71717A] uppercase tracking-wide mb-2">{t('payable.detail.infoSection')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 rounded-lg border border-[#D4D4D8] p-4">
              {field(t('payable.table.billNo'), bill.billNumber, { mono: true })}
              {field(t('payable.info.invoiceNumber'), bill.invoiceNumber ?? '—', { mono: true })}
              {field(t('payable.info.vendor'), bill.vendor)}
              {field(t('payable.info.category'), <CategoryBadge category={bill.category} />)}
              {field(t('labels.project', { ns: 'common' }), bill.project)}
              {field(t('payable.detail.documentType'), bill.documentType === 'INVOICE' ? t('payable.detail.docType.invoice') : t('payable.detail.docType.bill'))}
              {field(t('payable.table.received'), fmtDate(bill.receivedDate, dateLoc))}
              {field(
                t('payable.table.dueDate'),
                <span className={isOverdue ? 'text-red-600 font-medium' : undefined}>
                  {fmtDate(bill.dueDate, dateLoc)}
                  {isOverdue && ` · ${t('labels.daysOverdue', { ns: 'common', count: daysOverdue(bill.dueDate) })}`}
                </span>,
              )}
              {field(t('payable.info.description'), bill.description || '—', { wide: true })}
              {field(t('payable.info.notes'), bill.notes || '—', { wide: true })}
              {field(t('payable.detail.createdAt'), fmtDateTime(bill.createdAt, dateLoc))}
              {field(t('payable.detail.updatedAt'), fmtDateTime(bill.updatedAt, dateLoc))}
            </div>
          </div>

          {/* Actions — the detail is the item's operations hub */}
          <div>
            <p className="text-xs font-semibold text-[#71717A] uppercase tracking-wide mb-2">{t('payable.table.actions')}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <Button size="sm" disabled={bill.status === 'paid'} onClick={() => onRecordPayment(bill)}
                className="h-8 text-xs bg-purple-600 hover:bg-purple-700 text-white gap-1.5 disabled:opacity-40">
                <DollarSign className="w-3.5 h-3.5" /> {t('payable.recordPayment')}
              </Button>
              {canManage && (
                <>
                  <Button variant="outline" size="sm" onClick={() => onEditAmountDates(bill)}
                    className="h-8 text-xs border-[#D4D4D8] gap-1.5">
                    <Pencil className="w-3.5 h-3.5" /> {t('payable.edit.action')}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => onEditInfo(bill)}
                    className="h-8 text-xs border-[#D4D4D8] gap-1.5">
                    <FileText className="w-3.5 h-3.5" /> {t('payable.info.action')}
                  </Button>
                  {bill.documentType === 'BILL' && (
                    <Button variant="outline" size="sm" onClick={() => onConvert(bill)}
                      className="h-8 text-xs border-[#D4D4D8] gap-1.5">
                      <Receipt className="w-3.5 h-3.5" /> {t('payable.convert.action')}
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => onReassign(bill)}
                    className="h-8 text-xs border-[#D4D4D8] gap-1.5">
                    <ArrowRightLeft className="w-3.5 h-3.5" /> {t('payable.reassign.action')}
                  </Button>
                  {hasActivePayments && (
                    <Button variant="outline" size="sm" onClick={() => onMarkUnpaid(bill)}
                      className="h-8 text-xs border-amber-200 text-amber-600 hover:bg-amber-50 hover:text-amber-700 gap-1.5">
                      <RotateCcw className="w-3.5 h-3.5" /> {t('payable.unpay.action')}
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => onDelete(bill)}
                    className="h-8 text-xs border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600 gap-1.5">
                    <Trash2 className="w-3.5 h-3.5" /> {t('payable.delete.action')}
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Payment history */}
          <div>
            <p className="text-xs font-semibold text-[#71717A] uppercase tracking-wide mb-2">{t('payable.paymentHistory')}</p>
            {bill.payments.length === 0 ? (
              <p className="text-sm text-[#71717A]">{t('payable.noPayments')}</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-[#D4D4D8]">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#FAFAFA]">
                      {[t('payable.paymentHistory.date'), t('labels.amount', { ns: 'common' }), t('payable.paymentHistory.method'), t('payable.paymentHistory.reference'), t('payable.paymentHistory.approvedBy')].map(h => (
                        <th key={h} className="text-left text-[10px] font-semibold text-[#71717A] uppercase tracking-wider px-3 py-1.5">{h}</th>
                      ))}
                      {canManage && <th className="px-3 py-1.5" />}
                    </tr>
                  </thead>
                  <tbody>
                    {bill.payments.map(p => (
                      <tr key={p.id} className={`border-t border-[#D4D4D8]/30 ${p.voided ? 'opacity-60' : ''}`}>
                        <td className="px-3 py-2 text-sm text-[#0A0A0A] whitespace-nowrap">{fmtDate(p.date, dateLoc)}</td>
                        <td className={`px-3 py-2 font-mono text-sm font-semibold ${p.voided ? 'text-[#71717A] line-through' : 'text-emerald-600'}`}>{fmtAmount(p.amount)}</td>
                        <td className="px-3 py-2 text-sm text-[#71717A]">{p.method}</td>
                        <td className="px-3 py-2 font-mono text-sm text-[#71717A]">{p.reference ?? '—'}</td>
                        <td className="px-3 py-2 text-sm text-[#71717A]">
                          {p.voided
                            ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200" title={p.voidReason ?? undefined}><Ban className="w-3 h-3" />{t('payable.void.voided')}</span>
                            : (p.approvedBy ?? '—')}
                        </td>
                        {canManage && (
                          <td className="px-3 py-2 text-right">
                            {!p.voided && (
                              <div className="inline-flex items-center gap-3">
                                <button onClick={() => onEditPayment(bill, p)} disabled={submitting}
                                  title={t('payable.editPayment.action')} aria-label={t('payable.editPayment.action')}
                                  className="inline-flex items-center gap-1 text-[11px] text-[#0A0A0A] hover:text-purple-700 disabled:opacity-40">
                                  <Pencil className="w-3.5 h-3.5" /> {t('payable.editPayment.action')}
                                </button>
                                <button onClick={() => onVoidPayment(bill, p.id)} disabled={submitting}
                                  title={t('payable.void.action')} aria-label={t('payable.void.action')}
                                  className="inline-flex items-center gap-1 text-[11px] text-red-600 hover:text-red-700 disabled:opacity-40">
                                  <Ban className="w-3.5 h-3.5" /> {t('payable.void.action')}
                                </button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Invoice images */}
          <div className="pt-1 border-t border-[#D4D4D8]/40">
            <PayableAttachmentsPanel payableId={bill.id} canManage={canManage} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>{t('buttons.close', { ns: 'common' })}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
