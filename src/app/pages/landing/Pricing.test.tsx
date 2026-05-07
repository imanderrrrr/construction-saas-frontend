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

function buttons(container: HTMLElement): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll('button'));
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

  it('opens signup with uppercase PRO and MONTHLY by default', async () => {
    await act(async () => {
      root.render(<Pricing />);
    });

    const [proCta] = buttons(container);
    proCta.click();

    expect(mocks.navigate).toHaveBeenCalledWith(
      '/signup?plan=PRO&interval=MONTHLY',
    );
  });

  it('preserves annual interval when opening BUSINESS signup', async () => {
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

    const [, businessCta] = buttons(container);
    businessCta.click();

    expect(mocks.navigate).toHaveBeenCalledWith(
      '/signup?plan=BUSINESS&interval=ANNUAL',
    );
  });
});
