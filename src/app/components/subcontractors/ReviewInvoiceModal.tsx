import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';
import { cn } from '../ui/utils';
import { FIELD_LIMITS } from '../../../shared/fieldLimits';
import {
  getInvoiceFileUrl, isPayable, isReviewable, reviewInvoice,
  type SubcontractorInvoiceDTO,
} from '../../services/subcontractors';
import { BtModal } from '../bt/windows';
import { FOCUS_RING, PrimaryButton, SecondaryButton } from '../onboarding/chrome';
import { EmptyWord, FieldError, FieldHint, FieldLabel, INPUT, INPUT_ERROR, Mono, PaperNote } from '../projects/bt';
import { fmtMoney, InvoiceStatusChip, softDate, stampDateTime } from './bits';

/**
 * 08 — review an invoice.
 *
 * The one thing this screen already did well is kept: the file, large, beside
 * the data, with nothing to download first. What changes is the language, the
 * order of the decision, and a rule the backend has always enforced and the
 * interface never said — observing requires a comment, approving does not.
 *
 * An invoice already reviewed loses both actions (the server refuses a second
 * review) and offers the next step instead, which is payment.
 */

const MAX_COMMENT = FIELD_LIMITS.NOTE;

export function ReviewInvoiceModal({ open, onOpenChange, invoice, agreedAmountCents, onReviewed, onPay }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: SubcontractorInvoiceDTO | null;
  /** The job's agreed amount, when the caller knows it: it is what the figure is compared against. */
  agreedAmountCents?: number | null;
  onReviewed: (invoice: SubcontractorInvoiceDTO) => void;
  onPay: (invoice: SubcontractorInvoiceDTO) => void;
}) {
  const { t, i18n } = useTranslation(['subcontractors', 'common']);
  const lang = i18n.language;
  const [decision, setDecision] = useState<'APPROVE' | 'OBSERVE' | null>(null);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [commentError, setCommentError] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDecision(null);
    setComment('');
    setSaving(false);
    setCommentError(false);
    setError(null);
  }, [open, invoice?.id]);

  if (!invoice) return null;

  const canReview = isReviewable(invoice.status);
  const fileUrl = getInvoiceFileUrl(invoice.id);
  const isPdf = invoice.fileContentType === 'application/pdf';
  const isImage = invoice.fileContentType?.startsWith('image/') ?? false;

  const submit = async () => {
    if (!decision) return;
    // The server requires it; saying so before the round trip is the point.
    if (decision === 'OBSERVE' && !comment.trim()) { setCommentError(true); return; }
    setSaving(true);
    setError(null);
    try {
      const updated = await reviewInvoice(invoice.id, { action: decision, comment: comment.trim() || null });
      onReviewed(updated);
      onOpenChange(false);
    } catch {
      setError(t('subcontractors:rev.error.server'));
    } finally {
      setSaving(false);
    }
  };

  const comparison = agreedAmountCents == null || agreedAmountCents === 0
    ? null
    : invoice.amountCents === agreedAmountCents
      ? t('subcontractors:rev.matchesAgreed')
      : invoice.amountCents > agreedAmountCents
        ? t('subcontractors:rev.overAgreed', { agreed: fmtMoney(agreedAmountCents) })
        : t('subcontractors:rev.underAgreed', { agreed: fmtMoney(agreedAmountCents) });

  const detail = (label: string, value: React.ReactNode) => (
    <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 items-baseline py-[7px] border-b border-[#F0EBE1] last:border-b-0">
      <Mono className="text-[9.5px] font-semibold tracking-[0.12em] text-[#5A5346] w-[86px]">{label}</Mono>
      <div className="text-[12.5px] leading-[1.45] text-[#0A0A0A] text-right break-words">{value}</div>
    </div>
  );

  return (
    <BtModal
      open={open}
      onOpenChange={onOpenChange}
      width={1152}
      dismissible={false}
      closeDisabled={saving}
      kicker={t('subcontractors:rev.kicker')}
      title={t('subcontractors:rev.title', { number: invoice.invoiceNumber ?? `#${invoice.id}` })}
      bodyClassName="p-0 md:px-0 md:py-0"
      footer={
        canReview ? (
          <>
            <SecondaryButton onClick={() => onOpenChange(false)} disabled={saving}>{t('common:buttons.cancel')}</SecondaryButton>
            <PrimaryButton onClick={submit} disabled={saving || !decision}>
              {saving
                ? t('subcontractors:rev.submitting')
                : decision === 'OBSERVE' ? t('subcontractors:rev.submitObserve') : t('subcontractors:rev.submitApprove')}
            </PrimaryButton>
          </>
        ) : (
          <>
            <SecondaryButton onClick={() => onOpenChange(false)}>{t('common:buttons.close')}</SecondaryButton>
            {isPayable(invoice.status) && (
              <PrimaryButton onClick={() => { onOpenChange(false); onPay(invoice); }}>{t('subcontractors:inv.action.pay')}</PrimaryButton>
            )}
          </>
        )
      }
    >
      <div className="flex flex-col lg:flex-row lg:h-[600px]">
        {/* The file */}
        <div className="flex-1 min-w-0 bg-[#FBF8F2] border-b lg:border-b-0 lg:border-r border-[#EDE7DB] flex flex-col">
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-[#EDE7DB] flex-shrink-0">
            <Mono className="text-[9.5px] tracking-[0.08em] text-[#5A5346] truncate">
              {invoice.hasFile ? (invoice.fileContentType ?? '') : t('subcontractors:rev.noFile.title')}
            </Mono>
            {invoice.hasFile && (
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn('inline-flex items-center gap-1.5 font-bt-mono text-[10px] font-semibold uppercase tracking-[0.1em] border border-[#DBD0BB] px-[11px] py-1.5 text-[#5A5346] hover:border-[#F97316] hover:text-[#C2410C] flex-shrink-0', FOCUS_RING)}
              >
                <Download className="w-3 h-3" strokeWidth={2.2} />{t('subcontractors:rev.download')}
              </a>
            )}
          </div>
          <div className="flex-1 min-h-[280px] lg:min-h-0 flex items-center justify-center p-4 overflow-auto">
            {!invoice.hasFile ? (
              <EmptyWord
                word={t('subcontractors:rev.noFile.big')}
                title={t('subcontractors:rev.noFile.title')}
                hint={t('subcontractors:rev.noFile.hint')}
                className="border-0 bg-transparent"
              />
            ) : isPdf ? (
              <iframe src={fileUrl} title={t('subcontractors:rev.title', { number: invoice.invoiceNumber ?? `#${invoice.id}` })} className="w-full h-full min-h-[420px] border border-[#DBD0BB] bg-white" />
            ) : isImage ? (
              <img src={fileUrl} alt={t('subcontractors:rev.title', { number: invoice.invoiceNumber ?? `#${invoice.id}` })} className="max-w-full max-h-full object-contain" />
            ) : (
              <div className="text-center">
                <p className="text-[13.5px] text-[#5A5346]">{t('subcontractors:rev.noPreview')}</p>
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn('inline-flex items-center gap-1.5 font-bt-mono text-[10px] font-semibold uppercase tracking-[0.1em] border border-[#DBD0BB] px-[13px] py-2 text-[#5A5346] hover:border-[#F97316] hover:text-[#C2410C] mt-3', FOCUS_RING)}
                >
                  <Download className="w-3 h-3" strokeWidth={2.2} />{t('subcontractors:rev.download')}
                </a>
              </div>
            )}
          </div>
        </div>

        {/* The decision */}
        <div className="w-full lg:w-[320px] flex-shrink-0 p-[18px] overflow-y-auto">
          <Mono className="block text-[9.5px] font-semibold tracking-[0.12em] text-[#5A5346]">{t('subcontractors:rev.amount')}</Mono>
          <div className="font-bt-display font-extrabold text-[44px] leading-none tabular-nums text-[#0A0A0A] mt-1.5">{fmtMoney(invoice.amountCents)}</div>
          {comparison && <Mono className="block text-[9.5px] tracking-[0.08em] text-[#8A8175] mt-1.5">{comparison}</Mono>}

          <div className="mt-4">
            {detail(t('subcontractors:rev.field.job'), invoice.jobTitle)}
            {detail(t('subcontractors:rev.field.project'), invoice.projectName ?? <span className="text-[#A69C8D]">{t('subcontractors:inv.row.noProject')}</span>)}
            {detail(t('subcontractors:rev.field.issuer'), invoice.subcontractorName ?? '')}
            {detail(t('subcontractors:rev.field.submitted'), <Mono className="text-[11px] tracking-[0.04em]">{stampDateTime(invoice.createdAt, lang)}</Mono>)}
            {detail(t('subcontractors:rev.field.status'), <InvoiceStatusChip status={invoice.status} />)}
          </div>

          {invoice.description && <p className="text-[12.5px] leading-[1.5] text-[#5A5346] mt-3">{invoice.description}</p>}

          {invoice.reviewerComment && (
            <PaperNote className="mt-4">
              <Mono className="block text-[9px] font-semibold tracking-[0.12em] text-[#C2410C] mb-1.5">
                {t('subcontractors:rev.previous', { date: softDate(invoice.reviewedAt, lang) })}
              </Mono>
              <div>{invoice.reviewerComment}</div>
              {invoice.reviewerName && <Mono className="block text-[9.5px] tracking-[0.08em] text-[#A69C8D] mt-1.5">{invoice.reviewerName}</Mono>}
            </PaperNote>
          )}

          {canReview ? (
            <div className="mt-5">
              <Mono className="block text-[10px] font-semibold tracking-[0.12em] text-[#0A0A0A] mb-2">{t('subcontractors:rev.decision')}</Mono>
              <div className="grid grid-cols-2 gap-2">
                {(['APPROVE', 'OBSERVE'] as const).map(option => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => { setDecision(option); setCommentError(false); }}
                    aria-pressed={decision === option}
                    className={cn(
                      'font-bt-mono text-[10.5px] font-semibold uppercase tracking-[0.1em] px-3 py-[11px] border transition-colors',
                      decision === option
                        ? 'bg-[#0A0A0A] text-[#F5F1E8] border-[#0A0A0A]'
                        : 'bg-white border-[#DBD0BB] text-[#5A5346] hover:border-[#F97316] hover:text-[#C2410C]',
                      FOCUS_RING,
                    )}
                  >
                    {option === 'APPROVE' ? t('subcontractors:rev.approve') : t('subcontractors:rev.observe')}
                  </button>
                ))}
              </div>
              <FieldHint>{t('subcontractors:rev.decisionHint')}</FieldHint>

              {decision === 'OBSERVE' && (
                <div className="mt-4">
                  <FieldLabel htmlFor={`rev-comment-${invoice.id}`} required>{t('subcontractors:rev.comment')}</FieldLabel>
                  <textarea
                    id={`rev-comment-${invoice.id}`}
                    value={comment}
                    onChange={e => { setComment(e.target.value); if (e.target.value.trim()) setCommentError(false); }}
                    placeholder={t('subcontractors:rev.commentPlaceholder')}
                    maxLength={MAX_COMMENT}
                    rows={3}
                    autoFocus
                    className={cn(INPUT, 'h-[80px] resize-none py-2 leading-[1.5]', commentError && INPUT_ERROR)}
                  />
                  {commentError
                    ? <FieldError>{t('subcontractors:rev.error.comment')}</FieldError>
                    : <FieldHint>{t('subcontractors:rev.commentHint', { max: MAX_COMMENT })}</FieldHint>}
                </div>
              )}
            </div>
          ) : (
            <PaperNote className="mt-5">
              <Mono className="block text-[9.5px] font-semibold tracking-[0.12em] text-[#C2410C] mb-1.5">
                {t('subcontractors:rev.reviewed.title', {
                  status: t(`subcontractors:invoiceStatus.${invoice.status}`),
                  date: softDate(invoice.reviewedAt ?? invoice.updatedAt, lang),
                })}
              </Mono>
              <div>
                {invoice.status === 'PAID'
                  ? t('subcontractors:rev.reviewedPaid.body')
                  : invoice.status === 'OBSERVED'
                    ? t('subcontractors:rev.reviewedObserved.body')
                    : t('subcontractors:rev.reviewed.body')}
              </div>
            </PaperNote>
          )}

          {error && <PaperNote tone="red" className="mt-3">{error}</PaperNote>}
        </div>
      </div>
    </BtModal>
  );
}
