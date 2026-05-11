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

  it('navigates to /signup with PRO + MONTHLY when selecting Pro Monthly', async () => {
    await render();

    const proButton = getByTestId(container, 'choose-plan-select-pro');
    await act(async () => {
      proButton.click();
    });

    expect(mocks.navigate).toHaveBeenCalledWith(
      '/signup?plan=PRO&interval=MONTHLY',
    );
  });

  it('navigates to /signup with BUSINESS + MONTHLY when selecting Business Monthly', async () => {
    await render();

    const businessButton = getByTestId(container, 'choose-plan-select-business');
    await act(async () => {
      businessButton.click();
    });

    expect(mocks.navigate).toHaveBeenCalledWith(
      '/signup?plan=BUSINESS&interval=MONTHLY',
    );
  });

  it('navigates to /signup with PRO + ANNUAL after switching to annual', async () => {
    await render();

    const toggle = container.querySelector<HTMLInputElement>(
      'input[type="checkbox"]',
    );
    await act(async () => {
      toggle!.click();
    });

    const proButton = getByTestId(container, 'choose-plan-select-pro');
    await act(async () => {
      proButton.click();
    });

    expect(mocks.navigate).toHaveBeenCalledWith(
      '/signup?plan=PRO&interval=ANNUAL',
    );
  });

  it('navigates to /signup with BUSINESS + ANNUAL after switching to annual', async () => {
    await render();

    const toggle = container.querySelector<HTMLInputElement>(
      'input[type="checkbox"]',
    );
    await act(async () => {
      toggle!.click();
    });

    const businessButton = getByTestId(container, 'choose-plan-select-business');
    await act(async () => {
      businessButton.click();
    });

    expect(mocks.navigate).toHaveBeenCalledWith(
      '/signup?plan=BUSINESS&interval=ANNUAL',
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
