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

vi.mock('../../components/LanguageSwitcher', () => ({
  LanguageSwitcher: () => <span data-testid="language-switcher" />,
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

import { ChoosePlan } from './ChoosePlan';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function getByTestId(container: HTMLElement, testId: string): HTMLElement {
  const el = container.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  expect(el).not.toBeNull();
  return el!;
}

describe('ChoosePlan', () => {
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

  async function render() {
    await act(async () => {
      root.render(<ChoosePlan />);
    });
  }

  it('renders both Pro and Business plan cards', async () => {
    await render();

    expect(container.querySelector('[aria-label="plans.pro.name plan"]'))
      .not.toBeNull();
    expect(container.querySelector('[aria-label="plans.business.name plan"]'))
      .not.toBeNull();
  });

  it('shows monthly prices by default', async () => {
    await render();

    const proPrice = getByTestId(container, 'choose-plan-price-pro');
    const businessPrice = getByTestId(container, 'choose-plan-price-business');

    // Monthly keys are returned verbatim by the mocked t().
    expect(proPrice.textContent).toBe('plans.pro.priceMonthly');
    expect(businessPrice.textContent).toBe('plans.business.priceMonthly');
  });

  it('switches to annual prices when the billing toggle is flipped', async () => {
    await render();

    const toggle = container.querySelector<HTMLInputElement>(
      'input[type="checkbox"]',
    );
    expect(toggle).not.toBeNull();

    await act(async () => {
      toggle!.click();
    });

    const proPrice = getByTestId(container, 'choose-plan-price-pro');
    const businessPrice = getByTestId(container, 'choose-plan-price-business');

    expect(proPrice.textContent).toBe('plans.pro.priceAnnualPerMonth');
    expect(businessPrice.textContent).toBe('plans.business.priceAnnualPerMonth');
  });

  it('renders the Beta plan card with its price', async () => {
    await render();

    expect(getByTestId(container, 'choose-plan-price-beta').textContent).toBe(
      'plans.beta.price',
    );
  });

  it('gates Pro and Business during the beta (buy buttons disabled)', async () => {
    await render();

    const proButton = getByTestId(
      container,
      'choose-plan-select-pro',
    ) as HTMLButtonElement;
    const businessButton = getByTestId(
      container,
      'choose-plan-select-business',
    ) as HTMLButtonElement;

    expect(proButton.disabled).toBe(true);
    expect(businessButton.disabled).toBe(true);

    // Clicking a gated plan must NOT start checkout.
    await act(async () => {
      proButton.click();
      businessButton.click();
    });
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('Beta CTA is a mailto contact link (join by email, no checkout)', async () => {
    await render();

    const beta = getByTestId(container, 'choose-plan-select-beta');
    // No self-serve checkout during the beta — the CTA emails the founder.
    expect(beta.tagName).toBe('A');
    const href = beta.getAttribute('href') ?? '';
    expect(href.startsWith('mailto:')).toBe(true);
    expect(href).toContain('andersonaguirre794@gmail.com');

    await act(async () => {
      beta.click();
    });
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('the monthly/annual toggle still switches Pro/Business reference prices', async () => {
    await render();

    const toggle = container.querySelector<HTMLInputElement>(
      'input[type="checkbox"]',
    );
    await act(async () => {
      toggle!.click();
    });

    // Even gated, the reference cards reflect the chosen interval.
    expect(getByTestId(container, 'choose-plan-price-pro').textContent).toBe(
      'plans.pro.priceAnnualPerMonth',
    );
  });

  it('navigates back via history when the back button is clicked', async () => {
    await render();

    const backButton = getByTestId(container, 'choose-plan-back');
    await act(async () => {
      backButton.click();
    });

    // jsdom's history has length 1 in tests, so the component falls back to "/".
    expect(mocks.navigate).toHaveBeenCalledWith('/');
  });
});
