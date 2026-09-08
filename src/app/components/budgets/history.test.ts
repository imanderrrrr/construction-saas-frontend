// The contract book, read the right way round.
//
// The arrow used to run backwards: a $25,000 supplier payment was drawn as the
// budget CLIMBING from $50,000 to $75,000 when the movement was
// $100,000 → $75,000. And six of the nine movements collapsed into "Modified",
// while a tenth that the backend never writes was mapped anyway.

import { describe, expect, it } from 'vitest';
import type { ContractHistoryEntry } from '../../services/projects';
import { humanReason, isContractMovement, MOVEMENTS, toHistoryRow, wasMachineReason } from './history';

const entry = (over: Partial<ContractHistoryEntry>): ContractHistoryEntry => ({
  id: 1,
  changeType: 'PAYABLE_DEDUCTION',
  amountCents: -25_000_00,
  balanceAfterCents: 75_000_00,
  referenceId: null,
  description: null,
  createdAt: '2026-09-03T10:00:00Z',
  ...over,
});

describe('the balance before a movement', () => {
  it('is the balance after MINUS the signed amount', () => {
    const row = toHistoryRow(entry({}));
    expect(row.before).toBe(100_000);
    expect(row.after).toBe(75_000);
  });

  it('is the number the old screen got backwards', () => {
    const row = toHistoryRow(entry({}));
    // What `balanceAfter + amount` produced, and what the row used to read.
    expect(row.before).not.toBe(50_000);
  });

  it('works the same for a movement that adds', () => {
    const row = toHistoryRow(entry({ changeType: 'CHANGE_ORDER', amountCents: 55_000_00, balanceAfterCents: 255_000_00 }));
    expect(row.before).toBe(200_000);
    expect(row.after).toBe(255_000);
  });
});

describe('the nine movements', () => {
  it('names every type the backend writes', () => {
    expect(Object.keys(MOVEMENTS)).toHaveLength(9);
    expect(MOVEMENTS.LABOR_PAYMENT.key).toBe('laborPayment');
    expect(MOVEMENTS.PAYABLE_PAYMENT_VOID.sign).toBe('up');
  });

  // Closing shows in the project's status; the ledger never records it.
  it('does not map PROJECT_CLOSED, which the backend never writes', () => {
    expect(MOVEMENTS.PROJECT_CLOSED).toBeUndefined();
    expect(toHistoryRow(entry({ changeType: 'PROJECT_CLOSED' })).movement).toBeNull();
  });

  it('keeps an unknown type readable instead of blank', () => {
    expect(toHistoryRow(entry({ changeType: 'SOMETHING_NEW' })).rawType).toBe('SOMETHING_NEW');
  });

  it('separates what a person did from what the system wrote', () => {
    expect(isContractMovement(toHistoryRow(entry({ changeType: 'CHANGE_ORDER' })))).toBe(true);
    expect(isContractMovement(toHistoryRow(entry({ changeType: 'LABOR_PAYMENT' })))).toBe(false);
  });
});

describe('the description', () => {
  it('rewrites the one machine string with formatted amounts', () => {
    expect(humanReason('Contract amount adjusted from 125000.0 to 175000.0')).toBe('$125,000.00 → $175,000.00');
    expect(wasMachineReason('Contract amount adjusted from 125000.0 to 175000.0')).toBe(true);
  });

  it('leaves a sentence a person wrote alone', () => {
    const human = 'COR-2026-2 · aprobada por el cliente el 11/03';
    expect(humanReason(human)).toBe(human);
    expect(wasMachineReason(human)).toBe(false);
  });

  it('reads a missing description as empty, not as "null"', () => {
    expect(humanReason(null)).toBe('');
  });
});
