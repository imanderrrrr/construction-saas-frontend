// BuildTrack — the bitácora survives a weather value it has never seen.
//
// WEATHER_ICON maps the five values the Weather enum declares today. Index it
// with anything else — a value the backend grows later, a row written before
// the enum was narrowed — and it yields `undefined`. That `undefined` is then
// handed to React as a component, which throws "Element type is invalid", and
// React unmounts the tree: the supervisor gets the white "Unexpected
// Application Error" screen instead of the site log. Not a degraded weather
// card — the whole app.
//
// Found on 2026-09-17 with a demo fixture that sent the English `CLOUDY`.
// These tests pin the fallback so a widened enum can never blank the screen,
// and so the status chip prints a value rather than a raw i18n key.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const svc = vi.hoisted(() => ({
  getSiteLogByDate: vi.fn(),
  getSiteLogSuggestion: vi.fn(),
  getSiteLogHistory: vi.fn(),
  saveSiteLog: vi.fn(),
  uploadSiteLogPhoto: vi.fn(),
  deleteSiteLogPhoto: vi.fn(),
}));

vi.mock('../../services/siteLog', () => svc);
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));

// The real i18n on purpose: a stubbed `t` that echoes its key would hide the
// very thing the status assertions are about.
import i18n from '../../../i18n';
import { SiteLog } from './SiteLog';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const PROJECTS = [{ id: 7, name: 'Casa Roble' }];

function apiLog(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    projectId: 7,
    projectName: 'Casa Roble',
    partida: null,
    workDate: '2026-09-17',
    authorId: 3,
    authorName: 'Ana Supervisora',
    status: 'DRAFT',
    weather: 'SOLEADO',
    temperatureC: 24,
    notes: null,
    attendance: [],
    tasksDone: [],
    photos: [],
    createdAt: '2026-09-17T12:00:00Z',
    updatedAt: '2026-09-17T12:00:00Z',
    ...overrides,
  };
}

/** The stat card carrying `label`, so its icon and value can be read. */
function statCard(container: HTMLElement, label: string): HTMLElement {
  const text = Array.from(container.querySelectorAll('p'))
    .find((p) => p.textContent?.trim() === label);
  expect(text, `no stat card labelled "${label}"`).toBeTruthy();
  return text!.closest('div.bg-white') as HTMLElement;
}

describe('SiteLog — values outside the enum', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    await i18n.changeLanguage('es');
    svc.getSiteLogSuggestion.mockResolvedValue(null);
    svc.getSiteLogHistory.mockResolvedValue({ content: [], page: 0, size: 30, totalElements: 0, totalPages: 0 });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  async function mount(log: unknown) {
    svc.getSiteLogByDate.mockResolvedValue(log);
    await act(async () => {
      root.render(<SiteLog projects={PROJECTS} canEdit />);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  it('renders the log when the server sends a weather the enum does not have', async () => {
    // Throws "Element type is invalid" on the un-guarded lookup, which takes
    // down the whole tree — hence the assertions below on real content.
    await mount(apiLog({ weather: 'CLOUDY' }));

    const card = statCard(container, 'Clima');
    // The card is still standing, and it still has an icon: the neutral cloud.
    expect(card.querySelector('svg')).toBeTruthy();
    // The rest of the screen came up with it.
    expect(statCard(container, 'Asistencia')).toBeTruthy();
    expect(container.textContent).toContain('Ana Supervisora');
  });

  it('labels an unknown weather with the value itself, not an i18n key', async () => {
    await mount(apiLog({ weather: 'CLOUDY' }));

    const card = statCard(container, 'Clima');
    expect(card.textContent).toContain('CLOUDY');
    expect(card.textContent).not.toContain('weather.CLOUDY');
  });

  it('still translates the five weathers the enum does declare', async () => {
    await mount(apiLog({ weather: 'LLUVIA' }));

    expect(statCard(container, 'Clima').textContent).toContain('Lluvia');
  });

  it('prints an unknown status as its value instead of the raw key', async () => {
    // `status.SUBMITTED` on screen is what an out-of-enum status used to show.
    await mount(apiLog({ status: 'SUBMITTED' }));

    expect(container.textContent).toContain('SUBMITTED');
    expect(container.textContent).not.toContain('status.SUBMITTED');
  });

  it('still translates the two statuses the enum does declare', async () => {
    await mount(apiLog({ status: 'PUBLISHED' }));

    expect(container.textContent).toContain('Publicada');
  });
});
