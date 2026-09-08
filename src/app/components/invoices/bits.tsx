import type { ReactNode } from 'react';
import type { TFunction } from 'i18next';
import { cn } from '../ui/utils';
import { Mono } from '../projects/bt';
import { ApiError } from '../../lib/api';
import type { ProjectResponse } from '../../services/projects';

/**
 * Pieces the two Facturas screens share (Claude Design "Facturas BuildTrack",
 * 2026-09): the two chips, the money format, the billable ceiling, and the
 * translation of the server's error codes.
 */

const CHIP = 'inline-flex items-center font-bt-mono text-[9.5px] uppercase tracking-[0.1em] whitespace-nowrap';

/**
 * The document's state, as the server reports it.
 *
 * `overdue` never exists in the database — ReceivableServiceImpl derives it on
 * read from the due date and the business zone — so it arrives per row but
 * cannot be filtered or counted server-side. See the note on the status filter
 * in InvoiceManager.
 */
export type ReceivableUiStatus = 'pending' | 'partial' | 'paid' | 'overdue' | 'pending_approval' | 'rejected';

export function InvoiceStatusChip({ status, className }: { status: string; className?: string }) {
  const { t } = useT();
  const s = status.toLowerCase() as ReceivableUiStatus;
  const look: Record<string, string> = {
    // Green is a state, never a button.
    paid: 'border border-[#2E7D4F] text-[#2E7D4F] bg-[#FAF7F0] px-[7px] py-[3px]',
    overdue: 'bg-[#B3402A] text-white px-2 py-1',
    partial: 'border border-[#DBD0BB] text-[#5A5346] px-[7px] py-[3px]',
    pending: 'bg-[#F3EEE4] text-[#0A0A0A] px-2 py-1',
    pending_approval: 'bg-[#FBEDE0] border border-dashed border-[#F97316] text-[#C2410C] px-[7px] py-[3px]',
    rejected: 'border border-[#B3402A] text-[#B3402A] px-[7px] py-[3px]',
  };
  return <span className={cn(CHIP, look[s] ?? look.pending, className)}>{t(`invoice.state.${s}`)}</span>;
}

export function DocTypeChip({ type, className }: { type: string; className?: string }) {
  const { t } = useT();
  const isCO = type === 'CHANGE_ORDER_REQUEST';
  return (
    <span className={cn(CHIP, 'px-2 py-1', isCO ? 'bg-[#0A0A0A] text-[#F5F1E8]' : 'bg-[#F3EEE4] text-[#0A0A0A]', className)}>
      {t(isCO ? 'invoice.type.changeOrder' : 'invoice.type.invoice')}
    </span>
  );
}

/** An empty cell: mono, sand-grey, uppercase — never a dash, never italic. */
export function CellEmpty({ children, className }: { children: ReactNode; className?: string }) {
  return <Mono className={cn('text-[10px] tracking-[0.06em] text-[#A69C8D]', className)}>{children}</Mono>;
}

// The chips need `t` without every caller threading it; a tiny local hook
// keeps them drop-in the way clients/bits.tsx does.
import { useTranslation } from 'react-i18next';
function useT() { return useTranslation('finance'); }

/* ── Money ─────────────────────────────────────────────────────────────── */

/**
 * Amounts arrive from this API in dollars, not cents (see ReceivableResponse).
 * Guatemala groups thousands with a comma and separates decimals with a dot,
 * exactly as en-US does, so one grouping serves both panels.
 */
export function fmtMoney(amount: number, { decimals = true }: { decimals?: boolean } = {}): string {
  const sign = amount < 0 ? '-' : '';
  return `${sign}$${Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  })}`;
}

export function fmtCents(cents: number, opts?: { decimals?: boolean }): string {
  return fmtMoney(cents / 100, opts);
}

/* ── The billable ceiling ──────────────────────────────────────────────── */

export type CeilingBand = 'room' | 'tight' | 'none' | 'unknown';

export interface Ceiling {
  band: CeilingBand;
  /** Contract plus approved change orders, in cents. Null when never recorded. */
  ceilingCents: number | null;
  invoicedCents: number;
  remainingCents: number;
  /** 0–1, how much of the ceiling is already invoiced. */
  used: number;
}

/**
 * How much more may be billed against this jobsite.
 *
 * Issuing an invoice does NOT draw down the jobsite's budget — that is what
 * approved expenses, supplier payments and payroll do. The server only
 * *compares* the new document against a ceiling: the original contract plus
 * every change order (`revisedContractCents`), less what has already been
 * billed (`invoicedCents`). Both figures travel on every project, so the
 * screen can show the number BEFORE the invoice is written instead of
 * quoting it back inside a rejection.
 *
 * `unknown` when the jobsite never had a contract recorded: `billableCeiling`
 * falls back to the spend balance there and `revisedContractCents` is null,
 * so the honest answer is that this screen cannot say.
 *
 * The three bands are a design decision, not the server's: more than 20 % free
 * is room, under 5 % is tight, nothing left is none.
 */
export function ceilingOf(project: Pick<ProjectResponse, 'revisedContractCents' | 'invoicedCents'> | null | undefined): Ceiling {
  const ceilingCents = project?.revisedContractCents ?? null;
  const invoicedCents = project?.invoicedCents ?? 0;
  if (ceilingCents == null || ceilingCents <= 0) {
    return { band: 'unknown', ceilingCents: null, invoicedCents, remainingCents: 0, used: 0 };
  }
  const remainingCents = ceilingCents - invoicedCents;
  const used = Math.min(1, Math.max(0, invoicedCents / ceilingCents));
  const band: CeilingBand = remainingCents <= 0 ? 'none' : remainingCents / ceilingCents < 0.05 ? 'tight' : 'room';
  return { band, ceilingCents, invoicedCents, remainingCents, used };
}

/* ── Server errors, in the panel's language ────────────────────────────── */

/**
 * The codes ReceivableServiceImpl.create can raise, and which field owns each
 * one — so the message lands in the row that caused it.
 */
const ERROR_FIELD = {
  DUPLICATE_INVOICE_NUMBER: 'number',
  PROJECT_CLOSED: 'project',
  PROJECT_INCOMPLETE_FOR_ACCOUNTING: 'project',
  INVALID_DISCOUNT: 'discount',
  EXCEEDS_CONTRACT: 'total',
  INVALID_AMOUNT: 'total',
  MISSING_AMOUNT: 'total',
  INVALID_DATES: 'dates',
} as const satisfies Record<string, InvoiceSubmitError['field']>;

export interface InvoiceSubmitError {
  /** Which field owns the message, so it lands in that row instead of a toast. */
  field: 'number' | 'project' | 'discount' | 'total' | 'dates' | null;
  message: string;
  /** The raw code, shown only in the "for support" fold of an unknown failure. */
  detail: string | null;
}

/**
 * The server's rejection, translated and placed.
 *
 * These used to be painted raw with `toast.error(e.message)` — in English,
 * in a toast that fades: "Invoice amount exceeds project contract. Remaining
 * invoiceable: $5000.00". The amounts inside the message are not re-used:
 * the ceiling block above the form already carries the same figure, from the
 * project, in the panel's format.
 */
export function submitError(err: unknown, t: TFunction): InvoiceSubmitError {
  const code = err instanceof ApiError ? err.code : undefined;
  const status = err instanceof ApiError ? err.status : undefined;
  if (code && code in ERROR_FIELD) {
    const field = ERROR_FIELD[code as keyof typeof ERROR_FIELD];
    return { field, message: t(`invoice.error.${code}`), detail: null };
  }
  // Anything else keeps the form intact and drops one line at the foot of the
  // window, with the technical detail folded away for support.
  return {
    field: null,
    message: t('invoice.error.unknown'),
    detail: [code, status, err instanceof Error ? err.message : null].filter(Boolean).join(' · ') || null,
  };
}
