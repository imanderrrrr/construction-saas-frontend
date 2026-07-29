// BuildTrack — regression: punch-list dueDate is a DATE-ONLY string
// ('YYYY-MM-DD'). Fed to new Date(iso) it parses as UTC midnight, so any
// timezone west of Greenwich (business TZ Guatemala, UTC-6) renders the
// PREVIOUS calendar day (save July 20 → card shows July 19). The card must
// show the day exactly as written. Services mocked, as in PunchList.test.tsx.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const svc = vi.hoisted(() => ({
  listPunchItems: vi.fn(),
}));

vi.mock('../../services/punchItems', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/punchItems')>();
  return { ...actual, ...svc };
});

import i18n from '../../../i18n';
import { PunchList } from './PunchList';
import type { PunchItem } from '../../services/punchItems';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// The suite may run in any machine timezone (CI is typically UTC, where the
// shift is invisible) — pin the business one. Assigning process.env.TZ resets
// both Date and Intl's default timezone in Node.
const ORIGINAL_TZ = process.env.TZ;
beforeAll(() => { process.env.TZ = 'America/Guatemala'; });
afterAll(() => {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ORIGINAL_TZ;
});

const PROJECT = { id: 7, name: 'Casa Roble', assignees: [{ id: 3, name: 'Obrero Uno' }] };

function item(overrides: Partial<PunchItem> = {}): PunchItem {
  return {
    id: 1,
    itemNumber: 1,
    displayNumber: '#001',
    origin: 'CLIENT',
    title: 'Fuga en el lavamanos',
    description: null,
    location: 'Baño principal',
    status: 'OPEN',
    assigneeId: null,
    assigneeName: null,
    dueDate: null,
    createdByName: null,
    createdByClient: true,
    readyAt: null,
    readyNote: null,
    closedAt: null,
    closedByName: null,
    closedByClient: false,
    closeNote: null,
    reopenCount: 0,
    closableInternally: false,
    photos: [],
    events: [],
    comments: [],
    commentCount: 0,
    createdAt: '2026-07-08T12:00:00Z',
    updatedAt: '2026-07-08T12:00:00Z',
    ...overrides,
  };
}

describe('PunchList dueDate (date-only) rendering', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('shows dueDate 2026-07-20 as day 20, not 19, in Guatemala time', async () => {
    svc.listPunchItems.mockResolvedValue([item({ dueDate: '2026-07-20' })]);

    await act(async () => {
      root.render(<PunchList projects={[PROJECT]} />);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const label = i18n.t('punchList:internal.dueDate');
    const span = Array.from(container.querySelectorAll('span'))
      .find((s) => (s.textContent ?? '').startsWith(`${label}:`));
    expect(span).toBeDefined();

    const rendered = (span!.textContent ?? '').slice(`${label}:`.length).trim();
    // Standalone day number — (?<!\d)/(?!\d) keeps '2026' from matching.
    expect(rendered).toMatch(/(?<!\d)20(?!\d)/);
    expect(rendered).not.toMatch(/(?<!\d)19(?!\d)/);
  });
});
