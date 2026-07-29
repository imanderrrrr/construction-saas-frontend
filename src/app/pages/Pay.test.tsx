// BuildTrack — /pay, the Paddle default-payment-link target. The Paddle SDK
// is mocked; the real routes table and i18n are mounted so the route wiring
// and translations are exercised too. What matters here is the conversation:
// auto-open on `_ptxn`, closed-without-paying, completed, and dead links.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

const paddle = vi.hoisted(() => ({
  getPaddle: vi.fn(),
  openCheckout: vi.fn(),
}));

vi.mock('../lib/paddle', () => ({
  getPaddle: (...args: unknown[]) => paddle.getPaddle(...args),
  openCheckout: (...args: unknown[]) => paddle.openCheckout(...args),
}));

import i18n from '../../i18n';
import { routes } from '../routes';
import type { PaddleEvent } from '../lib/paddle';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('Pay page', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    paddle.getPaddle.mockReset();
    paddle.openCheckout.mockReset();
    paddle.getPaddle.mockResolvedValue({});
    paddle.openCheckout.mockResolvedValue(undefined);
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

  const mount = async (path: string) => {
    const router = createMemoryRouter(routes, { initialEntries: [path] });
    await act(async () => {
      root.render(<RouterProvider router={router} />);
    });
  };

  /** The eventCallback the page registered with the (mocked) SDK. */
  const eventCallback = (): ((event: PaddleEvent) => void) => {
    const calls = paddle.getPaddle.mock.calls;
    const call = calls[calls.length - 1];
    const cb = (call?.[0] as { eventCallback?: (event: PaddleEvent) => void } | undefined)
      ?.eventCallback;
    expect(cb, 'page should register an eventCallback with getPaddle').toBeTypeOf('function');
    return cb!;
  };

  const fire = async (name: string) => {
    await act(async () => {
      eventCallback()({ name });
    });
  };

  const tt = (key: string) => i18n.t(key, { ns: 'pay' });

  it('without a _ptxn param, explains the link is incomplete and never touches Paddle', async () => {
    await mount('/pay');

    expect(container.textContent).toContain(tt('missing.title'));
    expect(paddle.getPaddle).not.toHaveBeenCalled();
  });

  it('with a _ptxn param, initialises Paddle (auto-open) and shows the opening state', async () => {
    await mount('/pay?_ptxn=txn_abc123');

    expect(paddle.getPaddle).toHaveBeenCalledTimes(1);
    eventCallback();
    expect(container.textContent).toContain(tt('opening.title'));
    // The always-there fallback for when the overlay doesn't auto-open.
    expect(container.textContent).toContain(tt('opening.manual'));
  });

  it('reaches the paid state on checkout.completed and stays there when the overlay closes', async () => {
    await mount('/pay?_ptxn=txn_abc123');

    await fire('checkout.completed');
    expect(container.textContent).toContain(tt('completed.title'));

    // Paddle fires checkout.closed when the buyer closes the receipt —
    // that must not un-pay the screen.
    await fire('checkout.closed');
    expect(container.textContent).toContain(tt('completed.title'));
  });

  it('offers to reopen after closing without paying, wiring the same transaction id', async () => {
    await mount('/pay?_ptxn=txn_abc123');

    await fire('checkout.closed');
    expect(container.textContent).toContain(tt('closed.title'));

    const reopen = Array.from(container.querySelectorAll('button')).find(b =>
      b.textContent?.includes(tt('closed.reopen')),
    )!;
    await act(async () => {
      reopen.click();
    });

    expect(paddle.openCheckout).toHaveBeenCalledWith({ transactionId: 'txn_abc123' });
    expect(container.textContent).toContain(tt('opening.title'));
  });

  it('shows the dead-link state on checkout.error, sticky across the closing overlay', async () => {
    await mount('/pay?_ptxn=txn_abc123');

    await fire('checkout.error');
    expect(container.textContent).toContain(tt('error.title'));

    await fire('checkout.closed');
    expect(container.textContent).toContain(tt('error.title'));
  });

  it('falls to the error state when the SDK itself cannot initialise', async () => {
    paddle.getPaddle.mockRejectedValueOnce(new Error('VITE_PADDLE_CLIENT_TOKEN is not set.'));

    await mount('/pay?_ptxn=txn_abc123');

    expect(container.textContent).toContain(tt('error.title'));
  });
});
