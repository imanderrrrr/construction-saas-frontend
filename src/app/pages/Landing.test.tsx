import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// `t` echoes the key, so these assertions are about structure and destinations
// — the wording itself is covered by publicSite.i18n.test.ts.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) =>
      options?.title ? `${key}:${options.title}` : key,
    i18n: { language: 'es', changeLanguage: vi.fn() },
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

import { Landing } from './Landing';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// jsdom ships no matchMedia, and the demo clips ask it whether the reader wants
// less motion. Stub it, and let a test flip the answer.
let prefersReducedMotion = false;
window.matchMedia = ((query: string) => ({
  matches: query.includes('prefers-reduced-motion') ? prefersReducedMotion : false,
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
})) as typeof window.matchMedia;

describe('Landing — public CTAs and content rules', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    prefersReducedMotion = false;
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

  function hrefs(): string[] {
    return Array.from(container.querySelectorAll<HTMLAnchorElement>('a')).map(
      (a) => a.getAttribute('href') ?? a.getAttribute('data-link-to') ?? '',
    );
  }

  // The point of the redesign: the site sells nothing directly. Every
  // commercial path is a conversation by email, so no CTA may lead into the
  // plan-picker / checkout flow.
  it('never links into the /choose-plan billing flow', async () => {
    await render();
    expect(hrefs().filter((h) => h.includes('/choose-plan'))).toHaveLength(0);
  });

  it('never links a CTA straight to /signup', async () => {
    await render();
    expect(hrefs().filter((h) => h.includes('/signup'))).toHaveLength(0);
  });

  it('books the demo by email to demo@buildtrack.gt', async () => {
    await render();
    const demo = hrefs().filter((h) => h.startsWith('mailto:demo@buildtrack.gt'));
    expect(demo.length).toBeGreaterThan(0);
    expect(demo[0]).toContain('subject=');
  });

  it('joins the beta by email to beta@buildtrack.gt', async () => {
    await render();
    const beta = hrefs().filter((h) => h.startsWith('mailto:beta@buildtrack.gt'));
    expect(beta.length).toBeGreaterThan(0);
    expect(beta[0]).toContain('subject=');
  });

  // "Precios" is a nav label, not a price list: it scrolls to the demo section.
  it('points the "Precios" nav link at the demo section', async () => {
    await render();
    const pricingLink = Array.from(container.querySelectorAll('a')).find(
      (a) => a.textContent === 'nav.pricing',
    );
    expect(pricingLink).toBeDefined();
    expect(pricingLink!.getAttribute('href')).toBe('#demo');
  });

  it('links the two public sub-pages from the nav and footer', async () => {
    await render();
    expect(hrefs().filter((h) => h === '/docs').length).toBeGreaterThanOrEqual(2);
    expect(hrefs().filter((h) => h === '/status').length).toBeGreaterThanOrEqual(2);
  });

  it('renders the six real demo clips with webm + mp4 sources and a poster', async () => {
    await render();
    const videos = Array.from(container.querySelectorAll('video'));
    expect(videos).toHaveLength(6);

    for (const key of [
      'bitacora',
      'tiempo',
      'kanban',
      'finanzas',
      'punch-list',
      'cuentas-por-pagar',
    ]) {
      const video = videos.find((v) => v.getAttribute('poster') === `/demos/${key}.jpg`);
      expect(video, `missing clip: ${key}`).toBeDefined();
      const sources = Array.from(video!.querySelectorAll('source')).map((s) => s.getAttribute('src'));
      expect(sources).toEqual([`/demos/${key}.webm`, `/demos/${key}.mp4`]);
    }
  });

  it('leaves no placeholder video slots behind', async () => {
    await render();
    const figures = Array.from(container.querySelectorAll('figure'));
    expect(figures).toHaveLength(6);
    for (const figure of figures) {
      expect(figure.querySelector('video')).not.toBeNull();
    }
  });

  it('autoplays the clips by default', async () => {
    await render();
    for (const video of Array.from(container.querySelectorAll('video'))) {
      expect(video.autoplay).toBe(true);
      expect(video.loop).toBe(true);
      expect(video.muted).toBe(true);
    }
  });

  // Six silent loops at once is exactly the motion someone asking for less of
  // it does not want: hand them a poster and a play button instead.
  it('stops autoplaying and offers controls when the reader prefers reduced motion', async () => {
    prefersReducedMotion = true;
    await render();
    const videos = Array.from(container.querySelectorAll('video'));
    expect(videos).toHaveLength(6);
    for (const video of videos) {
      expect(video.autoplay).toBe(false);
      expect(video.loop).toBe(false);
      expect(video.controls).toBe(true);
    }
  });
});
