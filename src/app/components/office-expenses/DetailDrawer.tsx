import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Image as ImageIcon, Paperclip } from 'lucide-react';
import { cn } from '../ui/utils';
import { BtDrawer } from '../bt/windows';
import { Mono } from '../projects/bt';
import { FOCUS_RING, PrimaryButton, SecondaryButton, TertiaryButton, DestroyButton } from '../onboarding/chrome';
import type { OfficeExpense } from '../../services/officeExpenses';
import { officeReceiptUrl } from '../../services/officeExpenses';
import { Absent, bigMoney, shortDate } from './bits';

/**
 * Un gasto abierto: el comprobante, las notas, quién compró y **el rastro**.
 *
 * El rastro es lo que el servidor no escribía: un gasto se editaba o se
 * borraba y no quedaba constancia de quién ni cuándo. Ahora la fila lleva
 * quién la creó y quién la editó por última vez, y se enseña aquí sin tener
 * que salir a buscarlo a la bitácora.
 */
export function DetailDrawer({
  expense, busy, error, onClose, onEdit, onDelete, onUpload, onRemoveReceipt,
}: {
  expense: OfficeExpense;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onUpload: (file: File) => void;
  onRemoveReceipt: () => void;
}) {
  const { t, i18n } = useTranslation('admin');
  const lang = i18n.resolvedLanguage ?? 'es';
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(false);
  const isPdf = expense.receipt?.contentType === 'application/pdf';

  return (
    <BtDrawer
      open
      onOpenChange={o => { if (!o && !busy) onClose(); }}
      width={468}
      closeDisabled={busy}
      kicker={t('officeExpenses.detail.kicker', { date: shortDate(expense.purchaseDate, lang) })}
      title={expense.description}
      footer={
        <div className="flex items-center justify-between gap-2.5 flex-wrap">
          <DestroyButton onClick={onDelete} disabled={busy}>{t('officeExpenses.detail.delete')}</DestroyButton>
          <PrimaryButton onClick={onEdit} disabled={busy}>{t('officeExpenses.detail.edit')}</PrimaryButton>
        </div>
      }
    >
      <div className="space-y-5">
        <div>
          <span className="block font-bt-display font-extrabold text-[40px] leading-[0.85] tabular-nums text-[#0A0A0A]">
            {bigMoney(expense.amountCents)}
          </span>
          <Mono className="block text-[10px] tracking-[0.1em] text-[#5A5346] mt-1.5">
            {expense.categoryName ?? t('officeExpenses.byCategory.uncategorised')}
            {expense.categoryArchived && ` · ${t('officeExpenses.categories.archivedOne')}`}
            {expense.recurring && ` · ${t('officeExpenses.recurring.flag')}`}
          </Mono>
        </div>

        <Row label={t('officeExpenses.form.purchaseDate')}>
          <span className="text-[13px] text-[#0A0A0A]">
            {shortDate(expense.purchaseDate, lang)}
            <Mono className="text-[9px] tracking-[0.08em] text-[#A69C8D] ml-2">
              {t('officeExpenses.form.purchaseDateHint')}
            </Mono>
          </span>
        </Row>

        <Row label={t('officeExpenses.form.purchasedBy')}>
          {expense.purchasedBy
            ? (
                <span className="text-[13px] text-[#0A0A0A]">
                  {expense.purchasedBy}
                  {expense.purchasedByUserId != null && (
                    <Mono className="text-[8.5px] tracking-[0.1em] text-[#5A5346] border border-[#DBD0BB] px-1.5 py-[2px] ml-2">
                      {t('officeExpenses.detail.systemUser')}
                    </Mono>
                  )}
                </span>
              )
            : <Absent>{t('officeExpenses.detail.noBuyer')}</Absent>}
        </Row>

        <Row label={t('officeExpenses.form.notes')}>
          {expense.notes
            ? <p className="text-[13px] leading-[1.55] text-[#0A0A0A]">{expense.notes}</p>
            : <Absent>{t('officeExpenses.detail.noNotes')}</Absent>}
        </Row>

        {/* El comprobante */}
        <Row label={t('officeExpenses.form.receipt')}>
          {expense.receipt ? (
            <div className="border border-[#DBD0BB] bg-[#FBF8F2] px-3 py-2.5 space-y-2">
              <div className="flex items-start gap-2.5">
                {isPdf
                  ? <FileText className="w-4 h-4 text-[#5A5346] mt-[2px] flex-shrink-0" strokeWidth={2} aria-hidden="true" />
                  : <ImageIcon className="w-4 h-4 text-[#5A5346] mt-[2px] flex-shrink-0" strokeWidth={2} aria-hidden="true" />}
                <div className="min-w-0">
                  <p className="text-[12.5px] text-[#0A0A0A] break-all">
                    {expense.receipt.filename ?? t('officeExpenses.receipt.unnamed')}
                  </p>
                  <Mono className="block text-[9px] tracking-[0.08em] text-[#A69C8D] mt-[2px]">
                    {[
                      expense.receipt.sizeBytes != null ? `${Math.round(expense.receipt.sizeBytes / 1024)} KB` : null,
                      expense.receipt.uploadedAt
                        ? t('officeExpenses.receipt.uploadedAt', {
                            date: shortDate(expense.receipt.uploadedAt.slice(0, 10), lang),
                          })
                        : null,
                    ].filter(Boolean).join(' · ')}
                  </Mono>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <SecondaryButton onClick={() => setPreview(p => !p)}>
                  {preview ? t('officeExpenses.receipt.hide') : t('officeExpenses.receipt.view')}
                </SecondaryButton>
                <TertiaryButton onClick={onRemoveReceipt}>{t('officeExpenses.receipt.remove')}</TertiaryButton>
              </div>
              {preview && (
                isPdf ? (
                  <a
                    href={officeReceiptUrl(expense.id)}
                    target="_blank"
                    rel="noreferrer"
                    className={cn('font-bt-mono text-[10px] uppercase tracking-[0.1em] text-[#C2410C] underline underline-offset-2', FOCUS_RING)}
                  >
                    {t('officeExpenses.receipt.openPdf')}
                  </a>
                ) : (
                  <img
                    src={officeReceiptUrl(expense.id)}
                    alt={expense.receipt.filename ?? ''}
                    className="w-full border border-[#E7E1D5]"
                  />
                )
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Absent>{t('officeExpenses.receipt.none')}</Absent>
              <p className="text-[11.5px] leading-[1.55] text-[#A69C8D]">{t('officeExpenses.receipt.optional')}</p>
              <SecondaryButton onClick={() => fileRef.current?.click()} disabled={busy}>
                <span className="flex items-center gap-1.5">
                  <Paperclip className="w-3 h-3" strokeWidth={2.2} aria-hidden="true" />
                  {t('officeExpenses.receipt.attach')}
                </span>
              </SecondaryButton>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) onUpload(file);
                  e.target.value = '';
                }}
              />
            </div>
          )}
        </Row>

        {/* El rastro */}
        <Row label={t('officeExpenses.audit.title')}>
          <dl className="space-y-1">
            <Trail label={t('officeExpenses.audit.createdBy')} who={expense.createdBy} when={expense.createdAt} lang={lang} />
            <Trail label={t('officeExpenses.audit.updatedBy')} who={expense.updatedBy} when={expense.updatedAt} lang={lang} />
          </dl>
        </Row>

        {error && (
          <div className="bg-white border border-[#E7E1D5] border-l-[3px] border-l-[#B3402A] px-3.5 py-2.5">
            <p className="text-[12.5px] text-[#B3402A]">{error}</p>
          </div>
        )}
      </div>
    </BtDrawer>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Mono className="block text-[9px] tracking-[0.12em] text-[#8A8175]">{label}</Mono>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function Trail({ label, who, when, lang }: { label: string; who: string | null; when: string; lang: string }) {
  const { t } = useTranslation('admin');
  if (!who) {
    return (
      <div className="flex items-baseline gap-2">
        <dt className="text-[11.5px] text-[#8A8175] w-[52px] flex-shrink-0">{label}</dt>
        <dd><Absent>{t('officeExpenses.audit.unknown')}</Absent></dd>
      </div>
    );
  }
  let stamp = when;
  try {
    stamp = new Date(when).toLocaleString(lang, {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch { /* la cadena cruda antes que nada */ }
  return (
    <div className="flex items-baseline gap-2">
      <dt className="text-[11.5px] text-[#8A8175] w-[52px] flex-shrink-0">{label}</dt>
      <dd className="text-[11.5px] text-[#0A0A0A]">
        {who}
        <Mono className="text-[9px] tracking-[0.08em] text-[#A69C8D] ml-1.5 normal-case">{stamp}</Mono>
      </dd>
    </div>
  );
}
