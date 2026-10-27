// BuildTrack — the public status page.
//
// What these pin is honesty more than layout: every bar comes from the
// measured history, a day nobody measured is gray (never green), the
// percentage shown is the backend's, and when the history can't be loaded the
// page says so instead of drawing a clean record.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// t() echoes the key, plus its interpolation values so they can be asserted.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key}|${JSON.stringify(options)}` : key,
    i18n: { language: 'es', resolvedLanguage: 'es', changeLanguage: vi.fn() },
  }),
}));

vi.mock('react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

import { Status } from './Status';
import { STATUS_HISTORY_URL, type StatusHistory } from '../hooks/useStatusHistory';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/** 90 days ending 2026-10-27, all null unless overridden. */
function history(overrides: Record<string, number | null> = {}) {
  const days = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date(Date.UTC(2026, 9, 27 - i));
    const date = d.toISOString().slice(0, 10);
    days.push({ date, uptimePercent: date in overrides ? overrides[date] : null });
  }
  return days;
}

function payload(partial: Partial<StatusHistory> = {}): StatusHistory {
  return {
    generatedAt: '2026-10-27T15:00:00Z',
    timezone: 'America/Guatemala',
    trackingSince: '2026-10-25',
    days: 90,
    components: [
      { key: 'web', current: 'OPERATIONAL', uptimePercent: 100, history: history({ '2026-10-25': 100, '2026-10-26': 100, '2026-10-27': 100 }) },
      { key: 'api', current: 'OPERATIONAL', uptimePercent: 99.4, history: history({ '2026-10-25': 99, '2026-10-26': 95, '2026-10-27': 50 }) },
      { key: 'database', current: 'OPERATIONAL', uptimePercent: 99.97, history: history({ '2026-10-25': 99.6, '2026-10-26': 100, '2026-10-27': 100 }) },
      { key: 'files', current: 'UNKNOWN', uptimePercent: null, history: history() },
    ],
    ...partial,
  };
}

function json(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
}

/** The history endpoint answers `history`; the live health probe answers UP. */
function stubFetch(historyResponse: () => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn((url: string) =>
    url === STATUS_HISTORY_URL ? historyResponse() : json({ status: 'UP' })));
}

describe('Status page', () => {
  let container: HTMLDivElement;
  let root: Root;

  const render = async () => {
    await act(async () => { root.render(<Status />); });
    // Two fetches and their JSON: let every promise settle.
    for (let i = 0; i < 5; i++) await act(async () => { await Promise.resolve(); });
  };
  const component = (key: string) => container.querySelector<HTMLElement>(`[data-testid="status-component-${key}"]`)!;
  const bars = (key: string) =>
    Array.from(container.querySelectorAll<HTMLElement>(`[data-testid="status-bars-${key}"] > span`));
  const levels = (key: string) => bars(key).map(b => b.dataset.level);

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
    vi.unstubAllGlobals();
  });

  it('draws one bar per day for 90 days, for each of the four components', async () => {
    stubFetch(() => json(payload()));
    await render();
    for (const key of ['web', 'api', 'database', 'files']) {
      expect(component(key)).not.toBeNull();
      expect(bars(key)).toHaveLength(90);
    }
    expect(component('web').textContent).toContain('component.web.name');
  });

  it('colours each day by its measured uptime, and a day nobody measured gray', async () => {
    stubFetch(() => json(payload()));
    await render();
    expect(levels('api').slice(-3)).toEqual(['minor', 'partial', 'major']);
    expect(levels('database').slice(-3)).toEqual(['ok', 'ok', 'ok']);
    // Before measuring started: gray, never a made-up green.
    expect(levels('web').slice(0, 87).every(level => level === 'none')).toBe(true);
    expect(levels('files').every(level => level === 'none')).toBe(true);
  });

  it('shows the backend\'s own percentage, and "no data yet" where there is none', async () => {
    stubFetch(() => json(payload()));
    await render();
    expect(component('database').textContent).toContain('bars.uptime|{"percent":"99,97');
    expect(component('files').textContent).toContain('bars.noData');
  });

  it('says since when it measures', async () => {
    stubFetch(() => json(payload()));
    await render();
    expect(container.textContent).toContain('since|{"date":"25 DE OCTUBRE DE 2026"}');
    expect(container.textContent).toContain('method');
  });

  it('states each component from the measurement, and any outage turns the headline', async () => {
    const data = payload();
    data.components[1].current = 'DOWN';
    stubFetch(() => json(data));
    await render();
    expect(component('web').textContent).toContain('state.operational');
    expect(component('api').textContent).toContain('state.down');
    expect(component('files').textContent).toContain('state.unknown');
    expect(container.querySelector('h1')!.textContent).toBe('overall.degraded');
  });

  it('pointing at a day tells its date and what was measured', async () => {
    stubFetch(() => json(payload()));
    await render();
    const strip = container.querySelector<HTMLElement>('[data-testid="status-bars-api"]')!;
    strip.getBoundingClientRect = () => ({ left: 0, width: 900, top: 0, height: 36, right: 900, bottom: 36, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;

    // Day 89 of 90 (10-26) sits at x ≈ 885; the first day at x = 1.
    await act(async () => { strip.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 885 })); });
    let tip = container.querySelector('[role="tooltip"]')!;
    expect(tip.textContent).toContain('tooltip.uptime|{"percent":"95,00');

    await act(async () => { strip.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 1 })); });
    tip = container.querySelector('[role="tooltip"]')!;
    expect(tip.textContent).toContain('tooltip.notTracked');

    await act(async () => { strip.dispatchEvent(new MouseEvent('pointerout', { bubbles: true, relatedTarget: document.body })); });
    expect(container.querySelector('[role="tooltip"]')).toBeNull();
  });

  it('without the history it says so, draws no record, and falls back to the live check', async () => {
    stubFetch(() => Promise.reject(new TypeError('offline')));
    await render();
    expect(container.textContent).toContain('unavailable');
    for (const key of ['web', 'api', 'database', 'files']) {
      expect(levels(key).every(level => level === 'none')).toBe(true);
    }
    // This page loading proves the website; the live probe (UP) covers the API
    // and the database; nothing speaks for file storage.
    expect(component('web').textContent).toContain('state.operational');
    expect(component('api').textContent).toContain('state.operational');
    expect(component('database').textContent).toContain('state.operational');
    expect(component('files').textContent).toContain('state.unknown');
  });

  it('treats an answer that is not a status history as no history', async () => {
    stubFetch(() => json({ error: 'nope' }, 500));
    await render();
    expect(container.textContent).toContain('unavailable');
  });
});
