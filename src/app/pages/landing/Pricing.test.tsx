import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) =>
      options?.amount ? `${key}:${options.amount}` : key,
  }),
}));

vi.mock('react-router', () => ({
  useNavigate: () => mocks.navigate,
}));

vi.mock('../../components/ui/switch', () => ({
  Switch: ({
    checked,
    onCheckedChange,
    'aria-label': ariaLabel,
  }: {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    'aria-label'?: string;
  }) => (
    <input
      aria-label={ariaLabel}
      type="checkbox"
      checked={checked}
      onChange={(event) => onCheckedChange(event.currentTarget.checked)}
    />
  ),
}));

import { Pricing } from './Pricing';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function byTestId(container: HTMLElement, id: string): HTMLElement {
  const el = container.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  expect(el).not.toBeNull();
  return el!;
}

describe('Pricing plan intent links', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mocks.navigate.mockReset();

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('Beta CTA is a mailto contact link, not a checkout (no automatic billing)', async () => {
    await act(async () => {
      root.render(<Pricing />);
    });

    const beta = byTestId(container, 'choose-plan-select-beta');
    // The beta is joined by emailing the founder — it must be an <a mailto:>.
    expect(beta.tagName).toBe('A');
    const href = beta.getAttribute('href') ?? '';
    expect(href.startsWith('mailto:')).toBe(true);
    expect(href).toContain('andersonaguirre794@gmail.com');

    beta.click();
    // A contact link never triggers the SPA router / checkout.
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('gates Pro and Business during the beta (buy buttons disabled, no checkout)', async () => {
    await act(async () => {
      root.render(<Pricing />);
    });

    // Gated cards render a disabled button with the betaGate label.
    const gated = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button:disabled'),
    ).filter((b) => b.textContent?.includes('betaGate.cta'));
    expect(gated.length).toBe(2); // Pro + Business

    await act(async () => {
      gated.forEach((b) => b.click());
    });
    // Only the Beta CTA can start checkout — gated clicks do nothing.
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('billing toggle stays functional (annual reference price shows)', async () => {
    await act(async () => {
      root.render(<Pricing />);
    });

    const billingToggle = container.querySelector<HTMLInputElement>(
      'input[type="checkbox"]',
    );
    expect(billingToggle).not.toBeNull();

    await act(async () => {
      billingToggle!.click();
    });

    // The annual amount ($/mo) appears on the reference cards.
    expect(container.textContent).toContain('plans.pro.priceAnnualPerMonth');
  });
});
