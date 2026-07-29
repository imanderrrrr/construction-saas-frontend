import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  issueCheckoutLink: vi.fn(),
}));

vi.mock('../services/platformDashboard', () => ({
  issueCheckoutLink: (...args: unknown[]) => mocks.issueCheckoutLink(...args),
}));

// jsdom ships no matchMedia; motion's reduced-motion probe asks for it when
// the first animation mounts. Answer "no preference" so components render.
window.matchMedia = ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
})) as typeof window.matchMedia;

import { IssueCheckoutLinkDialog } from './IssueCheckoutLinkDialog';

const ISSUED = {
  tenantId: 7,
  checkoutAttemptId: '0d9e6f4a-0000-0000-0000-000000000000',
  paddleTransactionId: 'txn_456',
  checkoutUrl: 'https://sandbox-pay.paddle.io/hsc_fresh',
  amountCents: 35_000,
  planCode: 'PRO',
  billingInterval: 'MONTHLY',
  billingStatus: 'CHECKOUT_PENDING',
  emailSent: true,
};

describe('IssueCheckoutLinkDialog', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mocks.issueCheckoutLink.mockReset();
    mocks.issueCheckoutLink.mockResolvedValue(ISSUED);
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

  const render = (onIssued = vi.fn(), onClose = vi.fn()) => {
    act(() => {
      root.render(
        <IssueCheckoutLinkDialog
          tenantId={7}
          tenantName="Acme Construcciones"
          onClose={onClose}
          onIssued={onIssued}
        />,
      );
    });
    return { onIssued, onClose };
  };

  const buttonByText = (text: string) =>
    Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes(text))!;

  it('warns about the side effects before anything is issued', () => {
    render();

    const text = container.textContent ?? '';
    expect(text).toContain('previous link stops working');
    expect(text).toContain('7-day');
    expect(mocks.issueCheckoutLink).not.toHaveBeenCalled();
  });

  it('issues the link for the tenant and hands the response up', async () => {
    const { onIssued } = render();

    await act(async () => {
      buttonByText('Issue new link').click();
    });

    expect(mocks.issueCheckoutLink).toHaveBeenCalledWith(7);
    expect(onIssued).toHaveBeenCalledWith(ISSUED);
  });

  it('surfaces a backend refusal and stays open', async () => {
    mocks.issueCheckoutLink.mockRejectedValueOnce(
      Object.assign(new Error('Billing account is already active.'), { code: 'BILLING_ALREADY_ACTIVE' }),
    );
    const { onIssued } = render();

    await act(async () => {
      buttonByText('Issue new link').click();
    });

    expect(onIssued).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('already active');
    expect(buttonByText('Issue new link')).toBeTruthy();
  });

  it('hands Cancel to the caller without issuing anything', () => {
    const { onClose } = render();

    act(() => {
      buttonByText('Cancel').click();
    });

    expect(onClose).toHaveBeenCalled();
    expect(mocks.issueCheckoutLink).not.toHaveBeenCalled();
  });
});
