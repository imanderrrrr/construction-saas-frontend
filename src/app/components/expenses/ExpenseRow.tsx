import { useTranslation } from 'react-i18next';
import { cn } from '../ui/utils';
import { Mono, PaperNote } from '../projects/bt';
import { fmtUSD } from '../projects/helpers';
import { Amount } from '../budgets/ui';
import { TertiaryButton } from '../onboarding/chrome';
import {
  AgeCell, BalanceCell, Dash, ReceiptCell, ResubmittedChip, StatusChip, TypeLabel, WorkerBadge,
  ageInDays, type ExpenseStatus,
} from './bits';
import type { ExpenseResponse } from '../../services/expenses';

/** Las columnas de la cola y las del historial — el mismo ancho en las dos. */
export const QUEUE_COLS = '52px 1.55fr .62fr 1.5fr .5fr .74fr 208px';
export const HISTORY_COLS = '52px 1.75fr .78fr .6fr .74fr .8fr 1.2fr';

export interface RowActions {
  onApprove: () => void;
  onObserve: () => void;
  onReject: () => void;
  onReceipt: () => void;
  onRetry: () => void;
}

/**
 * Una fila de la bandeja.
 *
 * Trae lo que hace falta para decidir sin salir de ella: la miniatura del
 * recibo —o «sin foto», que también es un dato—, el saldo de la obra a la que
 * le va a restar, y desde cuándo espera. El acuse de una revisión no es un
 * toast: la fila se queda en su sitio con fondo papel y canto naranja.
 */
export function ExpenseRow({ expense, mode, justReviewed, error, actions, canReview }: {
  expense: ExpenseResponse;
  mode: 'queue' | 'history';
  justReviewed: boolean;
  /** Fallo de la última acción sobre ESTA fila, con su código. */
  error: { message: string; code?: string } | null;
  actions: RowActions;
  canReview: boolean;
}) {
  const { t, i18n } = useTranslation(['admin', 'common']);
  const status = expense.status as ExpenseStatus;
  const worker = expense.workerName ?? expense.workerUsername;
  const days = ageInDays(expense);
  const sentBack = status === 'OBSERVED';
  const lang = i18n.language;

  const note = (
    <>
      {expense.description
        ? <span className="block text-[12px] leading-[1.45] text-[#5A5346] truncate">{expense.description}</span>
        : <Mono className="block text-[9px] tracking-[0.08em] text-[#A69C8D] mt-0.5">{t('expenses.noNote')}</Mono>}
      <span className="flex items-center gap-1.5 mt-1">
        {expense.resubmittedAt && <ResubmittedChip />}
        {expense.resubmittedAt && (
          <Mono className="text-[9px] tracking-[0.06em] text-[#A69C8D]">
            {t('expenses.resubmittedOn', { date: stamp(expense.resubmittedAt, lang) })}
          </Mono>
        )}
        {sentBack && expense.reviewerComment && (
          <Mono className="text-[9px] tracking-[0.06em] text-[#C2410C] truncate">«{expense.reviewerComment}»</Mono>
        )}
      </span>
    </>
  );

  return (
    <div
      className={cn(
        'border-b border-[#F0EBE1] transition-colors',
        justReviewed && 'bg-[#FBEDE0] border-l-[3px] border-l-[#F97316]',
      )}
      data-testid="expense-row"
    >
      <div
        className="hidden md:grid items-center gap-3 px-[18px] py-[11px]"
        style={{ gridTemplateColumns: mode === 'queue' ? QUEUE_COLS : HISTORY_COLS }}
      >
        <ReceiptCell url={expense.receiptUrl} onOpen={actions.onReceipt} />
        <WorkerBadge name={worker} note={note} />
        <TypeLabel type={expense.expenseType} />

        {mode === 'queue' ? (
          <>
            <BalanceCell project={expense.projectName} budget={expense.projectBudget} />
            {justReviewed ? <Dash /> : <AgeCell days={days} />}
            <Amount tone={sentBack ? 'quiet' : 'ink'}>{fmtUSD(expense.amountCents)}</Amount>
            <div className="flex items-center justify-end gap-2.5 pl-3">
              {justReviewed ? (
                <>
                  <StatusChip status={status} />
                  <Mono className="text-[9px] tracking-[0.1em] text-[#A69C8D]">{t('expenses.reviewedByYou')}</Mono>
                </>
              ) : sentBack ? (
                <Mono className="text-[9px] tracking-[0.1em] text-[#A69C8D]">{t('expenses.group.sentBackNote')}</Mono>
              ) : canReview ? (
                <>
                  <TertiaryButton onClick={actions.onApprove}>{t('expenses.approve.cta')}</TertiaryButton>
                  <TertiaryButton onClick={actions.onObserve}>
                    {expense.receiptUrl ? t('expenses.observe.ctaShort') : t('expenses.receipt.ask')}
                  </TertiaryButton>
                  <TertiaryButton onClick={actions.onReject} className="text-[#B3402A] hover:text-[#B3402A]">
                    {t('expenses.reject.cta')}
                  </TertiaryButton>
                </>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <Mono className="text-[10px] tracking-[0.06em] text-[#5A5346]">{stamp(expense.expenseDate, lang)}</Mono>
            <Amount>{fmtUSD(expense.amountCents)}</Amount>
            <StatusChip status={status} />
            <div className="min-w-0">
              {expense.reviewerName ? (
                <>
                  <span className="block text-[12.5px] text-[#0A0A0A] truncate">{expense.reviewerName}</span>
                  <Mono className="block text-[9px] tracking-[0.06em] text-[#A69C8D] truncate">
                    {expense.reviewedAt ? stampTime(expense.reviewedAt, lang) : ''}
                    {expense.reviewerComment ? ` · «${expense.reviewerComment}»` : ` · ${t('expenses.noNote')}`}
                  </Mono>
                </>
              ) : <Dash />}
            </div>
          </>
        )}
      </div>

      {/* Móvil: tarjeta, con los botones a 44 px */}
      <div className="md:hidden px-4 py-3">
        <div className="flex items-start gap-3">
          <ReceiptCell url={expense.receiptUrl} onOpen={actions.onReceipt} size={52} />
          <div className="min-w-0 flex-1">
            <WorkerBadge name={worker} note={note} />
          </div>
          <Amount className="flex-none">{fmtUSD(expense.amountCents)}</Amount>
        </div>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <TypeLabel type={expense.expenseType} />
          <Mono className="text-[9.5px] tracking-[0.06em] text-[#A69C8D]">{expense.projectName}</Mono>
          {mode === 'queue' ? <AgeCell days={days} /> : <StatusChip status={status} />}
        </div>
        {mode === 'queue' && canReview && !sentBack && !justReviewed && (
          <div className="flex items-center gap-2 mt-2.5">
            <button type="button" onClick={actions.onApprove} className="flex-1 h-11 border border-[#0A0A0A] bg-[#0A0A0A] text-[#F5F1E8] font-bt-mono text-[10px] uppercase tracking-[0.1em]">
              {t('expenses.approve.cta')}
            </button>
            <button type="button" onClick={actions.onObserve} className="flex-1 h-11 border border-[#DBD0BB] font-bt-mono text-[10px] uppercase tracking-[0.1em] text-[#5A5346]">
              {expense.receiptUrl ? t('expenses.observe.ctaShort') : t('expenses.receipt.ask')}
            </button>
            <button type="button" onClick={actions.onReject} className="h-11 px-3 border border-[#DBD0BB] font-bt-mono text-[10px] uppercase tracking-[0.1em] text-[#B3402A]">
              {t('expenses.reject.cta')}
            </button>
          </div>
        )}
      </div>

      {/* El fallo de una acción vive en su fila, no en un mensaje que se va */}
      {error && (
        <div className="px-[18px] pb-3">
          <PaperNote tone="red">
            <span className="text-[12.5px] text-[#B3402A]">{error.message}</span>
            {error.code && <Mono className="block text-[9px] tracking-[0.1em] text-[#A69C8D] mt-1">{error.code}</Mono>}
            <TertiaryButton onClick={actions.onRetry} className="mt-1.5">{t('expenses.retry')}</TertiaryButton>
          </PaperNote>
        </div>
      )}
    </div>
  );
}

function stamp(iso: string, lang: string): string {
  return new Date(iso).toLocaleDateString(lang, { day: '2-digit', month: 'short' });
}

function stampTime(iso: string, lang: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString(lang, { day: '2-digit', month: 'short' })} ${d.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })}`;
}
