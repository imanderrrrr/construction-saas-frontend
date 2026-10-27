import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// `t` echoes the key, so these assertions are about structure and destinations
// — the wording itself is covered by publicSite.i18n.test.ts. The language is
// a `let` because the demo clips are served per language: a test flips it.
const { language } = vi.hoisted(() => ({ language: { current: 'es' } }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) =>
      options?.title ? `${key}:${options.title}` : key,
    i18n: { language: language.current, resolvedLanguage: language.current, changeLanguage: vi.fn() },
  }),
}));

vi.mock('react-router', () => ({
  Link: ({ children, to, onClick }: { children: React.ReactNode; to: string; onClick?: () => void }) => (
    <a href={to} data-link-to={to} onClick={onClick}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}));

vi.mock('../lib/analytics', () => ({ initAnalytics: vi.fn(), track: vi.fn() }));

import { Landing } from './Landing';
import { initAnalytics, track } from '../lib/analytics';
import { SUPPORT_EMAIL } from '../lib/contact';

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
    vi.mocked(track).mockClear();
    vi.mocked(initAnalytics).mockClear();
    prefersReducedMotion = false;
    language.current = 'es';
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
  // commercial path is a conversation by email — we create the account by
  // hand afterwards. /choose-plan and /signup have since been deleted
  // outright, so these now also guard against linking at a dead route.
  it('never links into the /choose-plan billing flow', async () => {
    await render();
    expect(hrefs().filter((h) => h.includes('/choose-plan'))).toHaveLength(0);
  });

  it('never links a CTA straight to /signup', async () => {
    await render();
    expect(hrefs().filter((h) => h.includes('/signup'))).toHaveLength(0);
  });

  // Demo and beta used to have a mailbox each, on a domain that was never
  // registered. Both now reach the one real inbox, so the subject is what keeps
  // the two conversations apart — assert the destination AND that separation.
  it('books the demo by email to the support inbox', async () => {
    await render();
    const demo = hrefs().filter((h) => h.startsWith(`mailto:${SUPPORT_EMAIL}?subject=`));
    expect(demo.some((h) => h.includes('demo.emailSubject'))).toBe(true);
  });

  it('joins the beta by email to the support inbox, under its own subject', async () => {
    await render();
    const beta = hrefs().filter((h) => h.startsWith(`mailto:${SUPPORT_EMAIL}?subject=`));
    expect(beta.some((h) => h.includes('beta.emailSubject'))).toBe(true);
  });

  it('publishes no address other than the support inbox', async () => {
    await render();
    const foreign = hrefs()
      .filter((h) => h.startsWith('mailto:'))
      .filter((h) => !h.startsWith(`mailto:${SUPPORT_EMAIL}`));
    expect(foreign).toEqual([]);
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

  // Docs and its topbar both offer "System status"; the main nav must too.
  it('puts the system status page in the main nav, next to the docs', async () => {
    await render();
    const nav = container.querySelector('nav')!;
    const navHrefs = Array.from(nav.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(navHrefs).toContain('/docs');
    expect(navHrefs).toContain('/status');
    expect(navHrefs.indexOf('/status')).toBe(navHrefs.indexOf('/docs') + 1);
  });

  // One clip per screen worth showing, in module order, in ONE player.
  const CLIPS = [
    'panel',
    'proyectos',
    'contrato',
    'presupuestos',
    'facturas',
    'pendientes',
    'consultas',
    'portal',
  ];

  const tabs = () => Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
  const sourcesOf = (video: HTMLVideoElement) =>
    Array.from(video.querySelectorAll('source')).map((s) => s.getAttribute('src'));

  // The eight clips used to be stacked one under another — a third of the page.
  it('shows the clips in a single player with one tab per clip', async () => {
    await render();
    expect(container.querySelectorAll('video')).toHaveLength(1);
    expect(tabs().map((tab) => tab.textContent)).toEqual(CLIPS.map((key, i) => `V0${i + 1}videos.${key}.title`));
    expect(tabs()[0].getAttribute('aria-selected')).toBe('true');

    const video = container.querySelector('video')!;
    expect(video.getAttribute('poster')).toBe('/demos/es/panel.jpg');
    expect(sourcesOf(video)).toEqual(['/demos/es/panel.webm', '/demos/es/panel.mp4']);
  });

  it('swaps the clip, and names its module under the player, when a tab is picked', async () => {
    await render();
    for (const [i, key] of CLIPS.entries()) {
      await act(async () => {
        tabs()[i].click();
      });
      const video = container.querySelector('video')!;
      expect(video.getAttribute('poster'), `clip ${key}`).toBe(`/demos/es/${key}.jpg`);
      expect(sourcesOf(video)).toEqual([`/demos/es/${key}.webm`, `/demos/es/${key}.mp4`]);
      expect(tabs()[i].getAttribute('aria-selected')).toBe('true');
      const panel = container.querySelector('[role="tabpanel"]')!;
      expect(panel.getAttribute('aria-labelledby')).toBe(tabs()[i].id);
      expect(panel.querySelector('h3')?.textContent).toMatch(/^videos\.group\.\w+\.title$/);
    }
    expect(track).toHaveBeenCalledWith('demo_video_select', { clip: 'portal' });
  });

  it('moves between tabs with the arrow keys', async () => {
    await render();
    await act(async () => {
      tabs()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });
    expect(tabs()[1].getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(tabs()[1]);
    await act(async () => {
      tabs()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    });
    expect(tabs()[CLIPS.length - 1].getAttribute('aria-selected')).toBe('true');
  });

  // A reader who switched the page to English was being shown a Spanish panel
  // under an English heading. The clips follow the page's language.
  it('serves the English recordings when the page is in English', async () => {
    language.current = 'en';
    await render();
    for (const [i, key] of CLIPS.entries()) {
      await act(async () => {
        tabs()[i].click();
      });
      const video = container.querySelector('video')!;
      expect(video.getAttribute('poster'), `missing English clip: ${key}`).toBe(`/demos/en/${key}.jpg`);
      expect(sourcesOf(video)).toEqual([`/demos/en/${key}.webm`, `/demos/en/${key}.mp4`]);
    }
  });

  // A regional tag is still that language; anything we did not record falls
  // back to the Spanish set rather than to a 404.
  it('maps regional and unknown language tags to a set that exists', async () => {
    language.current = 'en-US';
    await render();
    expect(container.querySelector('video')?.getAttribute('poster')).toBe('/demos/en/panel.jpg');

    await act(async () => { root.unmount(); });
    container.remove();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    language.current = 'pt-BR';
    await render();
    expect(container.querySelector('video')?.getAttribute('poster')).toBe('/demos/es/panel.jpg');
  });

  // On a phone a desktop recording is too small to read: the player goes full screen.
  it('offers full screen on the player', async () => {
    await render();
    const button = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('videos.fullscreen'),
    );
    expect(button).toBeDefined();
    expect(button!.closest('[role="tabpanel"]')).not.toBeNull();
  });

  it('autoplays the clip by default', async () => {
    await render();
    const video = container.querySelector('video')!;
    expect(video.autoplay).toBe(true);
    expect(video.loop).toBe(true);
    expect(video.muted).toBe(true);
  });

  // A looping clip is exactly the motion someone asking for less of it does
  // not want: hand them a poster and a play button instead.
  it('stops autoplaying and offers controls when the reader prefers reduced motion', async () => {
    prefersReducedMotion = true;
    await render();
    const video = container.querySelector('video')!;
    expect(video.autoplay).toBe(false);
    expect(video.loop).toBe(false);
    expect(video.controls).toBe(true);
  });

  // "Lo que cambia" restated the modules in a section of its own; it now
  // closes the modules section, one screen shorter.
  it('closes the modules section with what changes, instead of a section of its own', async () => {
    await render();
    const results = container.querySelector('#resultados')!;
    expect(results).not.toBeNull();
    expect(results.tagName).not.toBe('SECTION');
    expect(results.closest('section')?.id).toBe('sistema');
    expect(results.querySelectorAll('h4')).toHaveLength(4);
  });

  // No testimonial is ever invented: the section waits for a real one.
  it('renders no testimonials section while there is no real testimonial', async () => {
    await render();
    expect(container.querySelector('#testimonios')).toBeNull();
  });

  // On a phone the links fold into a menu instead of wrapping into two rows.
  it('folds the links into a menu button on small screens', async () => {
    await render();
    const nav = container.querySelector('nav')!;
    const desktopLinks = nav.querySelector('.max-lg\\:hidden');
    expect(desktopLinks?.querySelector('a[href="/docs"]')).not.toBeNull();

    const menuButton = nav.querySelector<HTMLButtonElement>('button[aria-label="nav.openMenu"]')!;
    expect(menuButton.closest('.lg\\:hidden')).not.toBeNull();
    expect(menuButton.getAttribute('aria-expanded')).toBe('false');

    await act(async () => {
      menuButton.click();
    });
    expect(menuButton.getAttribute('aria-expanded')).toBe('true');
    expect(menuButton.getAttribute('aria-label')).toBe('nav.closeMenu');
    const panel = document.getElementById(menuButton.getAttribute('aria-controls')!)!;
    const panelHrefs = Array.from(panel.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(panelHrefs).toEqual(expect.arrayContaining(['#plataforma', '#app', '/docs', '/status', '#demo', '/login']));

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(menuButton.getAttribute('aria-expanded')).toBe('false');
  });

  // Past the hero there was no way to the demo but scrolling back up.
  it('keeps a bar with the demo button for when the hero has scrolled away', async () => {
    await render();
    const bar = container.querySelector('[data-sticky-bar]')!;
    expect(bar).not.toBeNull();
    expect(bar.className).toContain('fixed');
    // Hidden (and out of the tab order) until the hero leaves the screen.
    expect(bar.getAttribute('data-shown')).toBe('false');
    expect(bar.className).toContain('invisible');
    const demo = Array.from(bar.querySelectorAll('a')).filter((a) => a.textContent === 'cta.demo');
    expect(demo.length).toBeGreaterThan(0);
    expect(demo.every((a) => a.getAttribute('href') === '#demo')).toBe(true);
  });

  it('starts measuring the visit and records which button moved the visitor', async () => {
    await render();
    expect(initAnalytics).toHaveBeenCalled();
    const heroDemo = container.querySelector('header')!.querySelector<HTMLAnchorElement>('a[href="#demo"]:not(nav a)')!;
    await act(async () => {
      heroDemo.click();
    });
    expect(track).toHaveBeenCalledWith('cta_click', { cta: 'demo', place: 'hero' });

    const demoMail = Array.from(container.querySelectorAll<HTMLAnchorElement>('#demo a')).find(
      (a) => a.textContent === 'cta.demo',
    )!;
    demoMail.addEventListener('click', (e) => e.preventDefault());
    await act(async () => {
      demoMail.click();
    });
    expect(track).toHaveBeenCalledWith('contact_email', { topic: 'demo', place: 'demo' });
  });

  // Only the closed button ships with the landing; the panel loads on click.
  it('renders the assistant button', async () => {
    await render();
    const button = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('assistant.fab.label'),
    );
    expect(button).toBeDefined();
    expect(button!.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });
});
