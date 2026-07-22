import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  recordTenantPayment: vi.fn(),
}));

vi.mock('../services/platformDashboard', () => ({
  recordTenantPayment: (...args: unknown[]) => mocks.recordTenantPayment(...args),
}));

import { RecordPaymentDialog, defaultCoversUntil } from './RecordPaymentDialog';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// The dialog derives its date pre-fills via helpers/dateTime.businessToday(),
// which reads localStorage — not backed by jsdom here. Null-returning stub →
// the helpers fall back to the default business timezone.
vi.stubGlobal('localStorage', {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
  key: () => null,
  length: 0,
});

describe('RecordPaymentDialog', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mocks.recordTenantPayment.mockReset();
    mocks.recordTenantPayment.mockResolvedValue({
      tenantId: 7,
      billingProvider: 'MANUAL',
      billingStatus: 'ACTIVE',
      planCode: 'PRO',
      billingInterval: 'MONTHLY',
      currentPeriodEndsAt: '2026-08-12T23:59:59.999Z',
      payments: [{ id: 1 }],
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    act(() => {
      root = createRoot(container);
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = (onSuccess = vi.fn(), onClose = vi.fn(), currentPeriodEndsAt: string | null = null) => {
    act(() => {
      root.render(
        <RecordPaymentDialog
          tenantId={7}
          tenantName="Constructora OFJR"
          currentPeriodEndsAt={currentPeriodEndsAt}
          onClose={onClose}
          onSuccess={onSuccess}
        />,
      );
    });
    return { onSuccess, onClose };
  };

  // DOM order: amount, paidDate, method, reference, coversDate.
  const inputs = () => Array.from(container.querySelectorAll('input'));
  const buttonByText = (text: string) =>
    Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes(text))!;

  const setValue = (el: HTMLInputElement, value: string) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    act(() => {
      setter.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
  };

  const fillValid = () => {
    const [amount, , method, reference] = inputs();
    setValue(amount, '350.00');
    setValue(method, 'Wire transfer');
    setValue(reference, '#4471');
  };

  it('sends dollars as cents and the trimmed method, and hands the result to onSuccess', async () => {
    const { onSuccess } = render();
    fillValid();

    await act(async () => {
      buttonByText('Record payment').click();
    });

    expect(mocks.recordTenantPayment).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ amountCents: 35_000, method: 'Wire transfer', reference: '#4471' }),
    );
    // Dates go out as ISO instants (business-TZ-anchored), not bare YYYY-MM-DD.
    const [, body] = mocks.recordTenantPayment.mock.calls[0];
    expect(body.paidAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(body.coversUntil).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ billingStatus: 'ACTIVE' }));
  });

  it('rejects a non-positive amount without calling the API', async () => {
    render();
    const [amount, , method] = inputs();
    setValue(amount, '0');
    setValue(method, 'Wire');

    await act(async () => {
      buttonByText('Record payment').click();
    });

    expect(mocks.recordTenantPayment).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('greater than zero');
  });

  it('requires a payment method', async () => {
    render();
    setValue(inputs()[0], '350');

    await act(async () => {
      buttonByText('Record payment').click();
    });

    expect(mocks.recordTenantPayment).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('method');
  });

  it('omits a blank reference', async () => {
    render();
    const [amount, , method, reference] = inputs();
    setValue(amount, '350');
    setValue(method, 'Cash');
    setValue(reference, '   ');

    await act(async () => {
      buttonByText('Record payment').click();
    });

    const [, body] = mocks.recordTenantPayment.mock.calls[0];
    expect(body.reference).toBeUndefined();
  });

  it('pre-fills "covers until" one month out (editable)', () => {
    render();
    const coversInput = inputs()[4];
    expect(coversInput.value).toBe(defaultCoversUntil(null));
  });

  it('surfaces a backend error and stays open', async () => {
    mocks.recordTenantPayment.mockRejectedValueOnce(
      Object.assign(new Error('Tenant is billed through PADDLE; its period cannot be set by hand.'), {
        code: 'BILLING_ACCOUNT_NOT_MANUAL',
      }),
    );
    const { onSuccess } = render();
    fillValid();

    await act(async () => {
      buttonByText('Record payment').click();
    });

    expect(container.querySelector('[role="alert"]')?.textContent).toContain('PADDLE');
    expect(onSuccess).not.toHaveBeenCalled();
    expect(buttonByText('Record payment')).toBeTruthy();
  });
});
