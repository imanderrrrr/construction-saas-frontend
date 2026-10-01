import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ════════════════════════════════════════════════════════════════════════
// A transit the worker is still on the road for, opened in the drawer.
//
// The backend (PR #156) answers every path that would approve or correct it
// with 409 TRANSIT_IN_PROGRESS and a sentence it already localized: approve or
// observe the day, approve or observe the punch, fix its time. The drawer has
// no code of its own for that, because run() toasts err.message. This pins it
// through the REAL services and api() (only fetch is faked), so the sentence
// the admin reads is the one the server wrote, and the code the inbox's bulk
// approve sorts on is the one the server sent.
// ════════════════════════════════════════════════════════════════════════

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), toast) }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'es' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

import { RecordDrawer } from './RecordDrawer';
import { approveRecord } from '../../services/time';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const SENTENCE = 'Este traslado sigue en curso: el trabajador todavía no ha registrado su '
  + 'entrada en la obra, y el traslado se paga hasta esa entrada. Podrá aprobarse o corregirse '
  + 'cuando llegue, o rechazarse ahora.';

// Left Obra Norte for Obra 1 and has not checked in yet: the transit is the
// only punch in its record and the worker's last one today.
const EN_ROUTE = {
  id: 501, workerId: 9, workerUsername: 'juan', workerName: 'Juan',
  projectId: 1, projectName: 'Obra 1',
  projectLatitude: null, projectLongitude: null, geofenceRadiusMeters: 100,
  workDate: '2026-09-24', approvalStatus: 'PENDING', isLate: false, pendingEventCount: 1,
  events: [{
    id: 51, type: 'IN_TRANSIT',
    capturedAtClient: '2026-09-24T18:10:00Z', capturedAtServer: '2026-09-24T18:10:01Z',
    lat: null, lng: null, locationStatus: null, distanceMeters: null,
    eventApprovalStatus: 'PENDING',
    eventReviewComment: null, eventReviewerUsername: null, eventReviewedAt: null,
    sourceProjectId: 2, sourceProjectName: 'Obra Norte',
    disputeStatus: null, disputeReason: null, awardedTransitMinutes: null,
    disputeResolvedBy: null, disputeResolvedAt: null, manualCreatorUsername: null,
  }],
  reviews: [],
  createdAt: '2026-09-24T18:10:01Z', updatedAt: '2026-09-24T18:10:01Z',
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('RecordDrawer — a transit still on the road (TRANSIT_IN_PROGRESS)', () => {
  let container: HTMLDivElement;
  let root: Root;
  const onClose = vi.fn();
  const onChanged = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // The record reads fine; every review on it is refused, with the backend's
    // ErrorResponse body.
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) =>
      (init?.method ?? 'GET') === 'GET'
        ? json(200, EN_ROUTE)
        : json(409, {
          code: 'TRANSIT_IN_PROGRESS', message: SENTENCE, details: null,
          timestamp: '2026-09-24T18:20:00Z', path: url,
        }));
    // Observing a punch asks for the comment, fixing its time for the reason.
    window.prompt = vi.fn(() => 'sigue en ruta') as unknown as typeof window.prompt;
    container = document.createElement('div');
    document.body.appendChild(container);
    act(() => { root = createRoot(container); });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const buttons = (text: string) =>
    [...container.querySelectorAll('button')].filter(b => b.textContent === text);
  const last = (text: string) => buttons(text).reverse()[0];

  async function click(button: HTMLButtonElement | undefined) {
    expect(button).toBeTruthy();
    await act(async () => { button!.click(); });
  }

  it('the 409 reaches the panel with the code the bulk approve sorts on and the sentence it shows', async () => {
    await expect(approveRecord(501)).rejects.toMatchObject({
      name: 'ApiError', status: 409, code: 'TRANSIT_IN_PROGRESS', message: SENTENCE,
    });
  });

  // Each path the backend refuses: the request it sends, and how to get there.
  // The timeline renders before the pinned actions, so for "observe" the
  // punch's button comes first and the day's comes last.
  const paths: [string, string, RegExp, () => Promise<void>][] = [
    ['approve the day', 'POST', /\/time-records\/501\/approve$/,
      () => click(buttons('admin:apr.d.approveDay')[0])],
    ['observe the day', 'POST', /\/time-records\/501\/correct$/, async () => {
      await click(last('admin:apr.observe'));
      const box = container.querySelector('textarea')!;
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(box, 'sigue en ruta');
        box.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await click(last('admin:apr.observe'));
    }],
    ['approve the punch', 'POST', /\/time-records\/501\/events\/51\/approve$/,
      () => click(buttons('admin:apr.approve')[0])],
    ['observe the punch', 'POST', /\/time-records\/501\/events\/51\/correct$/,
      () => click(buttons('admin:apr.observe')[0])],
    ['fix the punch time', 'PATCH', /\/time-records\/501\/events\/51\/edit-time$/, async () => {
      await click(buttons('admin:apr.d.fixTime')[0]);
      await click(buttons('common:buttons.save')[0]);
    }],
  ];

  it.each(paths)('%s: the toast is the sentence the backend wrote, and the drawer stays open', async (_, method, endpoint, perform) => {
    await act(async () => {
      root.render(<RecordDrawer recordId={501} onClose={onClose} onChanged={onChanged} />);
    });
    expect(container.textContent).toContain('Obra 1');

    await perform();

    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(endpoint), expect.objectContaining({ method }));
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith(SENTENCE);
    expect(onChanged).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
