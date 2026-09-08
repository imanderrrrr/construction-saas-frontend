/**
 * The contract book, read the right way round (Claude Design "Presupuestos
 * BuildTrack", board 07).
 *
 * Two defects live here, and both are arithmetic rather than styling:
 *
 *  1. The arrow ran backwards. The screen computed the previous balance as
 *     `balanceAfter + amount`, so a $25,000 supplier payment was drawn as the
 *     budget CLIMBING from $50,000 to $75,000 when the movement was
 *     $100,000 → $75,000. The amount is signed; the balance before a movement
 *     is `balanceAfter − amount`.
 *  2. Six of the nine movement types collapsed into the word "Modified", and
 *     a tenth — `PROJECT_CLOSED` — was mapped although the backend never
 *     writes it. Closing shows in the project's status, not in this book.
 */

import type { ContractHistoryEntry } from '../../services/projects';
import { money } from './bits';

/** How a movement moves the balance. `base` is the opening assignment. */
export type MovementSign = 'base' | 'up' | 'down' | 'both';

export interface Movement {
  /** i18n suffix: `budgets.history.type.<key>`. */
  key: string;
  sign: MovementSign;
  /** True when the system writes it — payments, expenses, payroll. */
  system: boolean;
}

export const MOVEMENTS: Record<string, Movement> = {
  INITIAL_ASSIGNMENT:    { key: 'initialAssignment',   sign: 'base', system: false },
  CONTRACT_ADJUSTMENT:   { key: 'contractAdjustment',  sign: 'both', system: false },
  EXPENSE_DEDUCTION:     { key: 'expenseDeduction',    sign: 'down', system: true  },
  PAYABLE_DEDUCTION:     { key: 'payableDeduction',    sign: 'down', system: true  },
  PAYABLE_PAYMENT_VOID:  { key: 'payablePaymentVoid',  sign: 'up',   system: true  },
  LABOR_PAYMENT:         { key: 'laborPayment',        sign: 'down', system: true  },
  CHANGE_ORDER:          { key: 'changeOrder',         sign: 'up',   system: false },
  CHANGE_ORDER_EDIT:     { key: 'changeOrderEdit',     sign: 'both', system: false },
  CHANGE_ORDER_REVERSED: { key: 'changeOrderReversed', sign: 'down', system: false },
};

export interface HistoryRow {
  id: number;
  date: string;
  /** Null for a `changeType` this build does not know — the raw code is shown. */
  movement: Movement | null;
  rawType: string;
  amount: number;
  before: number;
  after: number;
  /** Free text from the server; already de-machined by `humanReason`. */
  reason: string;
}

export function toHistoryRow(entry: ContractHistoryEntry): HistoryRow {
  const amount = entry.amountCents / 100;
  const after = entry.balanceAfterCents / 100;
  return {
    id: entry.id,
    date: entry.createdAt,
    movement: MOVEMENTS[entry.changeType] ?? null,
    rawType: entry.changeType,
    amount,
    // Signed amount, so this subtraction works for both directions.
    before: after - amount,
    after,
    reason: humanReason(entry.description),
  };
}

/** Contract movements only — the "SOLO CONTRATO" half of the type filter. */
export function isContractMovement(row: HistoryRow): boolean {
  return row.movement != null && !row.movement.system;
}

const MACHINE = /^Contract amount adjusted from ([\d.]+) to ([\d.]+)$/;

/**
 * The server's own description, made readable.
 *
 * `"Contract amount adjusted from 125000.0 to 175000.0"` used to be printed as
 * it came — in English, with raw decimals, in italics and inside quotation
 * marks, as though a person had typed it. The one pattern the backend
 * generates is rewritten with formatted amounts; anything else is a human
 * sentence already (a change-order note, say) and passes through untouched.
 */
export function humanReason(description: string | null): string {
  if (!description) return '';
  const match = MACHINE.exec(description.trim());
  if (!match) return description;
  return `${money(parseFloat(match[1]))} → ${money(parseFloat(match[2]))}`;
}

/** True when the description was a machine string this module rewrote. */
export function wasMachineReason(description: string | null): boolean {
  return description != null && MACHINE.test(description.trim());
}
