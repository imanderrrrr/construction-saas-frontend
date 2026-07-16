import { useState } from 'react';

import { PlatformModal } from './PlatformModal';
import { extractMessage } from '../lib/platformError';
import { recordTenantPayment } from '../services/platformDashboard';
import type { TenantPayments } from '../types';
import {
  businessToday,
  endOfDayISO,
  getBusinessTz,
  startOfDayISO,
} from '../../app/helpers/dateTime';

/** Instant → YYYY-MM-DD in the business timezone (for the date-input pre-fill). */
function isoToBusinessDate(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: getBusinessTz(),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

/** Add whole calendar months to a YYYY-MM-DD (JS month overflow tolerated). */
function addMonthsToDate(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1 + months, d);
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${dt.getFullYear()}-${mm}-${dd}`;
}

/** Pre-fill per the approved flow: max(currentPeriodEndsAt, today) + 1 month. Editable. */
export function defaultCoversUntil(currentPeriodEndsAt: string | null): string {
  const today = businessToday();
  const endDate = currentPeriodEndsAt ? isoToBusinessDate(currentPeriodEndsAt) : null;
  const base = endDate && endDate > today ? endDate : today;
  return addMonthsToDate(base, 1);
}

/**
 * Record an out-of-band payment for a MANUAL-billed tenant. Mirrors the
 * console's CreateTenantDialog shape (controlled inputs, a synchronous
 * validate(), a role="alert" error box, submit → service → onSuccess).
 *
 * Dates are date-only inputs converted to business-TZ-anchored instants
 * (startOfDay / endOfDay) so they round-trip through fmtDate without the
 * one-day UTC drift; the amount is entered in USD dollars and sent as cents.
 */
export function RecordPaymentDialog({
  tenantId,
  tenantName,
  currentPeriodEndsAt,
  onClose,
  onSuccess,
}: {
  tenantId: number;
  tenantName: string;
  currentPeriodEndsAt: string | null;
  onClose: () => void;
  onSuccess: (updated: TenantPayments) => void;
}) {
  const [amount, setAmount] = useState('');
  const [paidDate, setPaidDate] = useState(businessToday());
  const [method, setMethod] = useState('');
  const [reference, setReference] = useState('');
  const [coversDate, setCoversDate] = useState(() => defaultCoversUntil(currentPeriodEndsAt));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = (): string | null => {
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) return 'Enter an amount greater than zero.';
    if (!paidDate) return 'Pick the date the payment was received.';
    if (method.trim().length === 0) return 'Enter a payment method.';
    if (!coversDate) return 'Pick the date this payment covers until.';
    return null;
  };

  const submit = async () => {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const updated = await recordTenantPayment(tenantId, {
        amountCents: Math.round(parseFloat(amount) * 100),
        paidAt: startOfDayISO(paidDate),
        method: method.trim(),
        reference: reference.trim() || undefined,
        coversUntil: endOfDayISO(coversDate),
      });
      onSuccess(updated);
    } catch (err) {
      setError(extractMessage(err) ?? 'Could not record the payment.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = 'w-full px-3 py-2 border border-slate-300 rounded text-sm disabled:bg-slate-50';

  return (
    <PlatformModal title={`Record payment · ${tenantName}`} onClose={onClose}>
      <p className="text-sm text-slate-600 mb-4">
        Records an out-of-band payment (USD) and extends the workspace&apos;s access until the
        &ldquo;covers until&rdquo; date. Reactivates the account if it had expired.
      </p>
      {error && (
        <div role="alert" className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="space-y-3">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Amount (USD)</span>
          <div className="relative mt-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="350.00"
              className={`${inputClass} pl-6`}
              disabled={submitting}
            />
          </div>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Payment date</span>
          <input
            type="date"
            value={paidDate}
            onChange={e => setPaidDate(e.target.value)}
            className={`${inputClass} mt-1`}
            disabled={submitting}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Method</span>
          <input
            type="text"
            value={method}
            onChange={e => setMethod(e.target.value)}
            placeholder="Wire, Wise, PayPal, transfer…"
            maxLength={100}
            className={`${inputClass} mt-1`}
            disabled={submitting}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">
            Reference <span className="font-normal text-slate-400">(optional)</span>
          </span>
          <input
            type="text"
            value={reference}
            onChange={e => setReference(e.target.value)}
            placeholder="Transfer #, invoice #…"
            maxLength={200}
            className={`${inputClass} mt-1`}
            disabled={submitting}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Covers until</span>
          <input
            type="date"
            value={coversDate}
            onChange={e => setCoversDate(e.target.value)}
            className={`${inputClass} mt-1`}
            disabled={submitting}
          />
          <span className="mt-1 block text-xs text-slate-500">
            The workspace stays active through this date. Pre-filled one month out; edit as negotiated.
          </span>
        </label>
      </div>
      <div className="mt-4 flex gap-2 justify-end">
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="px-3 py-1.5 border border-slate-300 rounded text-sm"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded text-sm"
        >
          {submitting ? 'Recording…' : 'Record payment'}
        </button>
      </div>
    </PlatformModal>
  );
}
