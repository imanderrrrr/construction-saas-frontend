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

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) =>
      options?.amount ? `${key}:${options.amount}` : key,
  }),
}));

vi.mock('react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to} data-link-to={to}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}));

vi.mock('../components/LanguageSwitcher', () => ({
  LanguageSwitcher: () => <span data-testid="language-switcher" />,
}));

vi.mock('../components/LandingVideoCarousel', () => ({
  LandingVideoCarousel: () => <div data-testid="video-carousel" />,
}));

vi.mock('../components/ui/switch', () => ({
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

import { Landing } from './Landing';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function findLinkByLabel(container: HTMLElement, label: string): HTMLAnchorElement | null {
  const anchors = Array.from(container.querySelectorAll<HTMLAnchorElement>('a[data-link-to]'));
  return anchors.find((a) => a.textContent?.includes(label)) ?? null;
}

describe('Landing public CTAs', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
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
      root.render(<Landing />);
    });
  }

  it('points the header "Get started" CTA at /choose-plan, not /signup', async () => {
    await render();

    const headerCta = findLinkByLabel(container, 'nav.start');
    expect(headerCta).not.toBeNull();
    expect(headerCta!.getAttribute('href')).toBe('/choose-plan');
  });

  it('points the hero primary CTA at /choose-plan, not /signup', async () => {
    await render();

    const heroCta = findLinkByLabel(container, 'hero.ctaPrimary');
    expect(heroCta).not.toBeNull();
    expect(heroCta!.getAttribute('href')).toBe('/choose-plan');
  });

  it('points the lower CTA section primary button at /choose-plan, not /signup', async () => {
    await render();

    const lowerCta = findLinkByLabel(container, 'cta.primary');
    expect(lowerCta).not.toBeNull();
    expect(lowerCta!.getAttribute('href')).toBe('/choose-plan');
  });

  it('never links a general CTA directly to /signup', async () => {
    await render();

    const signupLinks = Array.from(
      container.querySelectorAll<HTMLAnchorElement>('a[data-link-to="/signup"]'),
    );
    expect(signupLinks).toHaveLength(0);
  });
});
