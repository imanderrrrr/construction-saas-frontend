import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BtModal } from '../bt/windows';
import { DestroyButton, PrimaryButton, SecondaryButton } from '../onboarding/chrome';
import { FieldLabel, Mono, PaperNote } from '../projects/bt';
import { fmtUSD } from '../projects/helpers';
import { cn } from '../ui/utils';
import type { ExpenseResponse } from '../../services/expenses';

/**
 * Aprobar, devolver y rechazar — las tres ventanas de un gasto.
 *
 * La de aprobar enseña **el saldo de la obra antes y después**, que es lo que
 * decide la aprobación y hasta ahora no salía en ninguna pantalla. Cuando el
 * gasto deja la obra en rojo, el marco y la cifra cambian y aparece una
 * casilla: se avisa, no se bloquea. El presupuesto es un medidor, no una
 * compuerta — el gasto entra y el saldo queda negativo, para que la pérdida se
 * pueda medir.
 */

const MIN_COMMENT = 10;

type Kind = 'approve' | 'observe' | 'reject';

export interface ReviewTarget {
  kind: Kind;
  expense: ExpenseResponse;
  /** «Pedir el recibo» precarga el comentario obligatorio. */
  presetComment?: string;
}

export function ReviewWindow({ target, busy, error, onClose, onConfirm }: {
  target: ReviewTarget | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (comment: string) => void;
}) {
  const { t, i18n } = useTranslation(['admin', 'common']);
  const [comment, setComment] = useState('');
  const [touched, setTouched] = useState(false);
  const [understood, setUnderstood] = useState(false);

  const kind = target?.kind;
  useEffect(() => {
    setComment(target?.presetComment ?? '');
    setTouched(false);
    setUnderstood(false);
  }, [target]);

  if (!target) return null;
  const { expense } = target;
  const worker = expense.workerName ?? expense.workerUsername;
  const budget = expense.projectBudget ?? null;
  const remaining = budget?.remainingCents ?? null;
  const base = budget?.baseCents ?? null;
  const after = remaining != null ? remaining - expense.amountCents : null;
  const overdraft = after != null && after < 0;
  const pct = (value: number | null) =>
    base && base > 0 && value != null ? `${(((base - value) / base) * 100).toFixed(1).replace('.', ',')} %` : null;

  const needsComment = kind !== 'approve';
  const missing = Math.max(0, MIN_COMMENT - comment.trim().length);
  const commentValid = !needsComment || missing === 0;
  const canConfirm = commentValid && (!overdraft || kind !== 'approve' || understood) && !busy;

  const title = t(`expenses.${kind}.title`);
  const lang = i18n.language;

  return (
    <BtModal
      open
      onOpenChange={o => { if (!o) onClose(); }}
      width={520}
      dismissible={false}
      kicker={t(`expenses.${kind}.subtitle`)}
      kickerTone={kind === 'reject' ? 'red' : 'orange'}
      title={title}
      footer={
        <div className="flex items-center justify-end gap-2.5">
          <SecondaryButton onClick={onClose} disabled={busy}>{t('common:buttons.cancel')}</SecondaryButton>
          {kind === 'reject' ? (
            <DestroyButton onClick={() => { setTouched(true); if (canConfirm) onConfirm(comment.trim()); }} disabled={!canConfirm}>
              {t('expenses.reject.confirm')}
            </DestroyButton>
          ) : (
            <PrimaryButton
              onClick={() => { setTouched(true); if (canConfirm) onConfirm(comment.trim()); }}
              disabled={!canConfirm}
            >
              {kind === 'approve'
                ? t(overdraft ? 'expenses.approve.confirmOverdraft' : 'expenses.approve.confirm')
                : t('expenses.observe.ctaShort')}
            </PrimaryButton>
          )}
        </div>
      }
    >
      {/* Qué gasto es, sin tener que volver a la fila */}
      <div className="flex items-baseline gap-3 flex-wrap border-b border-[#F0EBE1] pb-3 mb-3.5">
        <span className="font-bt-display font-extrabold text-[30px] leading-none tabular-nums text-[#0A0A0A]">
          {fmtUSD(expense.amountCents)}
        </span>
        <Mono className="text-[10px] tracking-[0.1em] text-[#5A5346]">
          {worker} · {t(`expenses.type.${expense.expenseType}`, { defaultValue: expense.expenseType })} ·{' '}
          {new Date(expense.expenseDate).toLocaleDateString(lang, { day: '2-digit', month: 'short', year: 'numeric' })}
        </Mono>
        {!expense.receiptUrl && (
          <Mono className="text-[9px] tracking-[0.1em] text-[#A69C8D] border border-dashed border-[#DBD0BB] px-1.5 py-0.5">
            {t('expenses.receipt.none')}
          </Mono>
        )}
      </div>

      {kind === 'approve' && budget && (
        <div className={cn('border p-3.5 mb-3.5', overdraft ? 'border-[#B3402A] bg-[#F6E3DE]' : 'border-[#E7E1D5] bg-[#FBF8F2]')}>
          <Mono className={cn('block text-[10px] font-semibold tracking-[0.12em]', overdraft ? 'text-[#B3402A]' : 'text-[#5A5346]')}>
            {overdraft ? t('expenses.approve.overdraft') : expense.projectName}
          </Mono>
          <div className="grid grid-cols-2 gap-3 mt-2.5">
            <div>
              <Mono className="block text-[9.5px] tracking-[0.1em] text-[#8A8175]">{t('expenses.approve.balanceNow')}</Mono>
              <span className="font-bt-mono text-[15px] tabular-nums text-[#0A0A0A]">{remaining != null ? fmtUSD(remaining) : '—'}</span>
              {pct(remaining) && <Mono className="block text-[9px] text-[#A69C8D] mt-0.5">{pct(remaining)}</Mono>}
            </div>
            <div>
              <Mono className="block text-[9.5px] tracking-[0.1em] text-[#8A8175]">{t('expenses.approve.balanceAfter')}</Mono>
              <span className={cn('font-bt-mono text-[15px] font-semibold tabular-nums', overdraft ? 'text-[#B3402A]' : 'text-[#0A0A0A]')}>
                {after != null ? fmtUSD(after) : '—'}
              </span>
              {pct(after) && <Mono className={cn('block text-[9px] mt-0.5', overdraft ? 'text-[#B3402A]' : 'text-[#A69C8D]')}>{pct(after)}</Mono>}
            </div>
          </div>
          <Mono className={cn('block text-[9.5px] tracking-[0.08em] mt-2.5', overdraft ? 'text-[#B3402A]' : 'text-[#8A8175]')}>
            {after != null && (overdraft
              ? t('expenses.approve.overdraftNote', { amount: fmtUSD(Math.abs(after)) })
              : t('expenses.approve.slackNote', { amount: fmtUSD(after) }))}
          </Mono>
          {/* El aviso de nómina va aquí, bajo el saldo del que habla — no en un
              toast de 10 s con texto de reserva en inglés. */}
          {expense.budgetWarning && (
            <p className="text-[12px] leading-[1.5] text-[#C2410C] mt-2.5">
              {t('common:budgetWarning.desc', { project: expense.projectName })}
            </p>
          )}
        </div>
      )}

      {kind === 'approve' && overdraft && (
        <>
          <p className="text-[12.5px] leading-[1.55] text-[#5A5346] mb-3">{t('expenses.approve.overdraftExplain')}</p>
          <label className="flex items-start gap-2.5 cursor-pointer mb-3.5">
            <input
              type="checkbox"
              checked={understood}
              onChange={e => setUnderstood(e.target.checked)}
              className="mt-0.5 w-3.5 h-3.5 accent-[#0A0A0A]"
            />
            <span className="text-[12.5px] leading-[1.5] text-[#0A0A0A]">
              {t('expenses.approve.overdraftConfirm', {
                project: expense.projectName,
                amount: after != null ? fmtUSD(after) : '',
              })}
            </span>
          </label>
        </>
      )}

      {kind === 'approve' && !overdraft && (
        <p className="text-[12.5px] leading-[1.55] text-[#5A5346] mb-3.5">{t('expenses.approve.explain')}</p>
      )}
      {kind === 'observe' && (
        <p className="text-[12.5px] leading-[1.55] text-[#5A5346] mb-3.5">{t('expenses.observe.explain', { name: worker })}</p>
      )}
      {kind === 'reject' && (
        <p className="text-[12.5px] leading-[1.55] text-[#5A5346] mb-3.5">{t('expenses.reject.explain')}</p>
      )}

      <div>
        <div className="flex items-baseline justify-between gap-3">
          <FieldLabel htmlFor="bt-review-comment">
            {kind === 'approve' ? t('expenses.approve.note') : t(`expenses.${kind}.label`)}
          </FieldLabel>
          <Mono className="text-[9px] tracking-[0.1em] text-[#A69C8D]">
            {kind === 'approve' ? t('expenses.approve.noteOptional') : t('expenses.required')}
          </Mono>
        </div>
        <textarea
          id="bt-review-comment"
          value={comment}
          onChange={e => setComment(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder={kind === 'approve'
            ? t('expenses.approve.notePlaceholder', { name: worker })
            : t('expenses.observe.placeholder', { name: worker })}
          className={cn(
            'w-full border bg-white px-3 py-2.5 text-[13px] leading-[1.5] text-[#0A0A0A] outline-none resize-none',
            'placeholder:text-[#A69C8D] focus:border-[#F97316]',
            touched && !commentValid ? 'border-[#B3402A]' : 'border-[#DBD0BB]',
          )}
        />
        <div className="flex items-baseline justify-between gap-3 mt-1">
          {needsComment && touched && !commentValid ? (
            <span className="text-[11.5px] text-[#B3402A]">{t('expenses.comment.min', { count: missing })}</span>
          ) : <span />}
          {needsComment && (
            <Mono className={cn('text-[9.5px] tracking-[0.06em]', commentValid ? 'text-[#2E7D4F]' : 'text-[#A69C8D]')}>
              {comment.trim().length} / {MIN_COMMENT}{commentValid ? ' ✓' : ''}
            </Mono>
          )}
        </div>
      </div>

      {error && (
        <PaperNote tone="red" className="mt-3.5">
          <span className="text-[12.5px] text-[#B3402A]">{error}</span>
        </PaperNote>
      )}
    </BtModal>
  );
}
