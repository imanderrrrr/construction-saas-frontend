import { useTranslation } from 'react-i18next';
import { ArrowRightLeft, Ban, FileText, Pencil, Receipt, RotateCcw, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '../ui/dialog';
import { cn } from '../ui/utils';
import { FOCUS_RING } from '../onboarding/chrome';
import { Mono } from '../projects/bt';
import { Amount } from '../budgets/ui';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { CategoryBadge, paymentMethodLabel, type VendorBill, type VendorPayment } from '../PayableCommon';
import { PayableAttachmentsPanel } from '../PayableAttachmentsPanel';
import { fmtMoney } from '../invoices/bits';
import { fmtDate } from '../../helpers/dateTime';
import { balanceOf, daysLate, isSettled, round2 } from './accounting';
import { MENU_CONTENT, MENU_ITEM, MENU_ITEM_DANGER, MENU_LABEL, Tag, WindowHead } from './ui';
import type { ProjectBudget } from './PayableDialogs';

/**
 * A bill, opened.
 *
 * Everything the old modal held is still here — the payments, the photos, the
 * jobsite's budget — and so is every action, but they sit in a menu instead of
 * a seven-button row that was cut in half by the modal's own scroll. The
 * bill's own figures come first because they are what the reader came for.
 */
export function PayableDetailPanel({ bill, project, canManage, today, dateLocale, onClose, onPay, onEditAmounts, onEditInfo, onConvert, onReassign, onUnpay, onDelete, onVoidPayment, onEditPayment, busy }: {
  bill: VendorBill | null;
  project: ProjectBudget | undefined;
  canManage: boolean;
  today: string;
  dateLocale: string;
  onClose: () => void;
  onPay: (b: VendorBill) => void;
  onEditAmounts: (b: VendorBill) => void;
  onEditInfo: (b: VendorBill) => void;
  onConvert: (b: VendorBill) => void;
  onReassign: (b: VendorBill) => void;
  onUnpay: (b: VendorBill) => void;
  onDelete: (b: VendorBill) => void;
  onVoidPayment: (b: VendorBill, paymentId: number) => void;
  onEditPayment: (b: VendorBill, p: VendorPayment) => void;
  busy: boolean;
}) {
  const { t } = useTranslation(['finance', 'common']);
  if (!bill) return null;

  const balance = balanceOf(bill);
  const settled = isSettled({ ...bill, party: bill.vendor, status: bill.status });
  const late = daysLate(bill.dueDate, today);
  const hasActivePayments = bill.payments.some(p => !p.voided);
  const remaining = project?.remainingBudgetCents == null ? null : round2(project.remainingBudgetCents / 100);
  const after = remaining == null ? null : round2(remaining - balance);

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="rounded-none border border-[#CDBFA6] p-0 gap-0 sm:max-w-[540px] bg-white">
        <WindowHead
          tone="ink"
          kicker={`${bill.documentType === 'INVOICE' ? t('finance:payable.detail.docType.invoice') : t('finance:payable.detail.docType.bill')}${settled ? ` · ${t('common:status.paid')}` : bill.status === 'partial' ? ` · ${t('common:status.partial')}` : ''}`}
          title={
            <>
              <DialogTitle className="font-bt-display font-extrabold uppercase text-[28px] leading-[1.05] mt-[3px]">{bill.vendor}</DialogTitle>
              <Mono className="block text-[11px] tracking-[0.06em] text-[#F5F1E8] mt-1.5 normal-case">
                {bill.billNumber}{bill.invoiceNumber ? ` · ${bill.invoiceNumber}` : ''} · {bill.project}
              </Mono>
              <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                <Mono className="text-[9px] tracking-[0.09em] border border-[#5A5346] px-1.5 py-1">
                  {t(`finance:payable.category.${bill.category === 'equipment-rental' ? 'equipmentRental' : bill.category}`)}
                </Mono>
                {!settled && late > 0 && (
                  <Mono className="text-[9px] tracking-[0.09em] bg-[#B3402A] text-white px-1.5 py-1">
                    {t('finance:accounts.due.daysLate', { count: late })}
                  </Mono>
                )}
                {!settled && late === -1 && (
                  <Mono className="text-[9px] tracking-[0.09em] bg-[#F97316] text-[#0A0A0A] px-1.5 py-1">{t('finance:accounts.due.tomorrow')}</Mono>
                )}
              </div>
            </>
          }
        />

        <div className="max-h-[66vh] overflow-y-auto">
          {/* The three figures of this bill */}
          <div className="grid grid-cols-3 border-b border-[#E7E1D5]">
            <div className="px-4 py-3 border-r border-[#EDE7DB]">
              <Mono className="block text-[9px] tracking-[0.12em] text-[#8A8175]">{t('finance:payable.detail.total')}</Mono>
              <Mono className="block text-[15px] font-semibold normal-case tabular-nums mt-1">{fmtMoney(bill.amount)}</Mono>
            </div>
            <div className="px-4 py-3 border-r border-[#EDE7DB]">
              <Mono className="block text-[9px] tracking-[0.12em] text-[#8A8175]">{t('finance:payable.detail.paid')}</Mono>
              <Mono className={cn('block text-[15px] font-semibold normal-case tabular-nums mt-1', bill.paidAmount > 0 && 'text-[#2E7D4F]')}>
                {fmtMoney(bill.paidAmount)}
              </Mono>
            </div>
            <div className="px-4 py-3">
              <Mono className="block text-[9px] tracking-[0.12em] text-[#8A8175]">{t('finance:accounts.balance')}</Mono>
              <Mono className={cn('block text-[15px] font-semibold normal-case tabular-nums mt-1', !settled && late > 0 && 'text-[#B3402A]')}>
                {fmtMoney(balance)}
              </Mono>
            </div>
          </div>

          {/* Dates and text */}
          <div className="px-4 py-3.5 border-b border-[#E7E1D5] grid grid-cols-2 gap-x-5 gap-y-2.5">
            <Field label={t('finance:payable.create.received')}>{fmtDate(bill.receivedDate, dateLocale)}</Field>
            <Field label={t('finance:payable.create.due')}>{fmtDate(bill.dueDate, dateLocale)}</Field>
            {bill.description && <Field label={t('finance:payable.info.description')} wide>{bill.description}</Field>}
            {bill.notes && <Field label={t('finance:payable.info.notes')} wide>{bill.notes}</Field>}
          </div>

          {/* Payments — the voided ones stay, struck through, with the reason */}
          <div className="px-4 py-3.5 border-b border-[#E7E1D5]">
            <Mono className="block text-[9.5px] tracking-[0.13em] text-[#8A8175] mb-2">
              {t('finance:payable.detail.payments', { count: bill.payments.length })}
            </Mono>
            {bill.payments.length === 0 ? (
              <p className="text-[12.5px] text-[#8A8175]">{t('finance:payable.detail.noPayments')}</p>
            ) : (
              <div className="space-y-2">
                {bill.payments.map(p => (
                  <div key={p.id} className={cn('flex items-center gap-3 flex-wrap bg-[#FAF7F0] border-l-2 px-3 py-2.5', p.voided ? 'border-l-[#CDBFA6]' : 'border-l-[#2E7D4F]')}>
                    <Mono className={cn('text-[13px] font-semibold normal-case tabular-nums', p.voided && 'text-[#8A8175] line-through')}>
                      {fmtMoney(p.amount)}
                    </Mono>
                    <div className="min-w-0">
                      <Mono className={cn('block text-[10.5px] normal-case', p.voided ? 'text-[#8A8175] line-through' : 'text-[#5A5346]')}>
                        {fmtDate(p.date, dateLocale)} · {paymentMethodLabel(p.method, t)}
                      </Mono>
                      {p.voided
                        ? <Mono className="block text-[9.5px] text-[#B3402A] mt-[3px] normal-case">
                            {t('finance:payable.void.voided')}{p.voidReason ? ` · ${p.voidReason}` : ''}
                          </Mono>
                        : p.reference && <Mono className="block text-[9.5px] text-[#A69C8D] mt-[3px] normal-case">{p.reference}</Mono>}
                    </div>
                    {p.voided
                      ? <Tag tone="red" className="ml-auto">{t('finance:payable.void.voided')}</Tag>
                      : canManage && (
                        <div className="ml-auto flex items-center gap-3">
                          <button type="button" disabled={busy} onClick={() => onEditPayment(bill, p)}
                            className={cn('font-bt-mono text-[9.5px] uppercase tracking-[0.09em] text-[#0A0A0A] hover:text-[#C2410C] disabled:opacity-40 cursor-pointer', FOCUS_RING)}>
                            {t('finance:payable.editPayment.action')}
                          </button>
                          <button type="button" disabled={busy} onClick={() => onVoidPayment(bill, p.id)}
                            className={cn('inline-flex items-center gap-1 font-bt-mono text-[9.5px] uppercase tracking-[0.09em] text-[#B3402A] hover:text-[#8F3221] disabled:opacity-40 cursor-pointer', FOCUS_RING)}>
                            <Ban className="w-3 h-3" />{t('finance:payable.void.action')}
                          </button>
                        </div>
                      )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* The jobsite's budget — what this bill leaves behind */}
          {remaining != null && (
            <div className="px-4 py-3.5 border-b border-[#E7E1D5]">
              <Mono className="block text-[9.5px] tracking-[0.13em] text-[#8A8175] mb-2">{t('finance:payable.pay.budgetOf', { project: bill.project })}</Mono>
              <div className="flex items-end justify-between gap-3 flex-wrap">
                <div>
                  <span className="font-bt-display font-extrabold text-[30px] leading-[0.9] tabular-nums">{fmtMoney(remaining)}</span>
                  <Mono className="block text-[9.5px] tracking-[0.09em] text-[#5A5346] mt-1">{t('finance:payable.detail.budgetNow')}</Mono>
                </div>
                {!settled && after != null && (
                  <div className="text-right">
                    <Amount tone={after < 0 ? 'red' : 'orange'} className="block text-[13px]">{fmtMoney(after)}</Amount>
                    <Mono className="block text-[9.5px] tracking-[0.09em] text-[#8A8175] mt-1">{t('finance:payable.detail.budgetIfPaid')}</Mono>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Photos of the document */}
          <div className="px-4 py-3.5 border-b border-[#E7E1D5]">
            <PayableAttachmentsPanel payableId={bill.id} canManage={canManage} />
          </div>
        </div>

        {/* Actions: the everyday one, and the rest behind a menu */}
        <div className="bg-[#FBF8F2] border-t border-[#E7E1D5] px-4 py-3.5 flex items-center gap-2.5">
          {!settled && (
            <button
              type="button"
              onClick={() => onPay(bill)}
              className={cn('flex-1 bg-[#0A0A0A] text-[#F5F1E8] border-0 cursor-pointer px-4 py-3.5 font-bt-mono text-[11px] font-semibold uppercase tracking-[0.09em] transition-colors hover:bg-[#F97316] hover:text-[#0A0A0A]', FOCUS_RING)}
            >
              {t('finance:payable.action.pay')}
            </button>
          )}
          {settled && (
            <Mono className="flex-1 text-[10px] tracking-[0.09em] text-[#8A8175]">{t('finance:payable.detail.settledNote')}</Mono>
          )}
          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn('border border-[#DBD0BB] bg-white cursor-pointer px-3.5 py-3.5 font-bt-mono text-[10.5px] uppercase tracking-[0.09em] text-[#0A0A0A] transition-colors hover:border-[#F97316] hover:text-[#C2410C]', FOCUS_RING)}
                >
                  {t('finance:payable.detail.moreActions')}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className={MENU_CONTENT}>
                <DropdownMenuLabel className={MENU_LABEL}>{bill.billNumber} · {fmtMoney(bill.amount)}</DropdownMenuLabel>
                <DropdownMenuItem className={MENU_ITEM} onClick={() => onEditAmounts(bill)}>
                  <Pencil className="w-3 h-3 mr-2" />{t('finance:payable.edit.action')}
                </DropdownMenuItem>
                <DropdownMenuItem className={MENU_ITEM} onClick={() => onEditInfo(bill)}>
                  <FileText className="w-3 h-3 mr-2" />{t('finance:payable.info.action')}
                </DropdownMenuItem>
                {bill.documentType === 'BILL' && (
                  <DropdownMenuItem className={MENU_ITEM} onClick={() => onConvert(bill)}>
                    <Receipt className="w-3 h-3 mr-2" />{t('finance:payable.convert.action')}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem className={MENU_ITEM} onClick={() => onReassign(bill)}>
                  <ArrowRightLeft className="w-3 h-3 mr-2" />{t('finance:payable.reassign.action')}
                </DropdownMenuItem>
                {hasActivePayments && (
                  <DropdownMenuItem className={cn(MENU_ITEM, 'text-[#C2410C] border-t border-t-[#EDE7DB]')} onClick={() => onUnpay(bill)}>
                    <RotateCcw className="w-3 h-3 mr-2" />{t('finance:payable.unpay.action')}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem className={cn(MENU_ITEM_DANGER, 'border-t border-t-[#EDE7DB]')} onClick={() => onDelete(bill)}>
                  <Trash2 className="w-3 h-3 mr-2" />{t('finance:payable.delete.action')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'col-span-2' : undefined}>
      <Mono className="block text-[9px] tracking-[0.12em] text-[#8A8175]">{label}</Mono>
      <div className="text-[12.5px] text-[#0A0A0A] mt-1 leading-[1.5]">{children}</div>
    </div>
  );
}

/** Re-exported so the screen can label the category chip the same way. */
export { CategoryBadge };
