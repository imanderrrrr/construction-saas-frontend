// BuildTrack — public client portal page: exchange / PIN gate / dead-link
// states and the read-only timeline. Services are mocked; the real routes
// table is mounted so the /client-view/:token wiring is exercised too.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

const svc = vi.hoisted(() => ({
  openClientSession: vi.fn(),
  getClientSiteLogs: vi.fn(),
}));

vi.mock('../services/clientView', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/clientView')>();
  return {
    ...actual,
    openClientSession: svc.openClientSession,
    getClientSiteLogs: svc.getClientSiteLogs,
  };
});

import { ApiError } from '../lib/api';
import i18n from '../../i18n';
import { routes } from '../routes';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const SESSION = {
  sessionToken: 'sess-1',
  expiresAt: '2026-08-01T00:00:00Z',
  project: { projectName: 'Casa Roble', clientName: 'Don Roberto', address: 'Calle 1' },
};

const ENTRY = {
  workDate: '2026-07-01',
  weather: 'SOLEADO',
  temperatureC: 28,
  notes: 'Se coló la losa',
  attendance: [{ name: 'obrero1' }, { name: 'Pedro (albañil)' }],
  tasksDone: [{ description: 'Losa de entrepiso' }],
  photos: [],
  createdAt: '2026-07-01T20:00:00Z',
  updatedAt: '2026-07-01T20:00:00Z',
};

const PAGE = { content: [ENTRY], page: 0, size: 10, totalElements: 1, totalPages: 1 };

async function renderPortal(root: Root, token = 'tok123') {
  const router = createMemoryRouter(routes, { initialEntries: [`/client-view/${token}`] });
  await act(async () => {
    root.render(<RouterProvider router={router} />);
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('ClientView (public portal page)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    svc.openClientSession.mockReset();
    svc.getClientSiteLogs.mockReset();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('opens the session and renders the read-only timeline', async () => {
    svc.openClientSession.mockResolvedValueOnce(SESSION);
    svc.getClientSiteLogs.mockResolvedValueOnce(PAGE);

    await renderPortal(root);

    expect(svc.openClientSession).toHaveBeenCalledWith('tok123', undefined);
    expect(container.textContent).toContain('Casa Roble');
    expect(container.textContent).toContain('Don Roberto');
    expect(container.textContent).toContain('Se coló la losa');
    expect(container.textContent).toContain('obrero1');
    expect(container.textContent).toContain('Pedro (albañil)');
    expect(container.textContent).toContain('Losa de entrepiso');
    expect(container.textContent).toContain(i18n.t('clientView:header.readOnly'));
    // Nothing editable on the public page: no inputs, no textareas.
    expect(container.querySelectorAll('input, textarea, select').length).toBe(0);
  });

  it('gates a protected link behind the PIN and retries with it', async () => {
    svc.openClientSession
      .mockRejectedValueOnce(new ApiError(401, 'pin', undefined, 'CLIENT_VIEW_PIN_REQUIRED'))
      .mockResolvedValueOnce(SESSION);
    svc.getClientSiteLogs.mockResolvedValueOnce(PAGE);

    await renderPortal(root);

    const pinInput = container.querySelector<HTMLInputElement>('#client-view-pin');
    expect(pinInput).toBeTruthy();

    await act(async () => {
      setInputValue(pinInput!, '246810');
    });
    const form = pinInput!.closest('form')!;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(svc.openClientSession).toHaveBeenLastCalledWith('tok123', '246810');
    expect(container.textContent).toContain('Casa Roble');
  });

  it('shows the wrong-PIN error and stays on the gate', async () => {
    svc.openClientSession
      .mockRejectedValueOnce(new ApiError(401, 'pin', undefined, 'CLIENT_VIEW_PIN_REQUIRED'))
      .mockRejectedValueOnce(new ApiError(401, 'bad', undefined, 'CLIENT_VIEW_AUTH_FAILED'));

    await renderPortal(root);

    const pinInput = container.querySelector<HTMLInputElement>('#client-view-pin')!;
    await act(async () => {
      setInputValue(pinInput, '000000');
    });
    await act(async () => {
      pinInput.closest('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.textContent).toContain(i18n.t('clientView:pin.wrong'));
    expect(container.querySelector('#client-view-pin')).toBeTruthy();
  });

  it('renders the dead-link state on 410 CLIENT_VIEW_GONE', async () => {
    svc.openClientSession.mockRejectedValueOnce(new ApiError(410, 'gone', undefined, 'CLIENT_VIEW_GONE'));

    await renderPortal(root);

    expect(container.textContent).toContain(i18n.t('clientView:gone.title'));
    expect(svc.getClientSiteLogs).not.toHaveBeenCalled();
  });

  it('renders the invalid state for a broken token', async () => {
    svc.openClientSession.mockRejectedValueOnce(new ApiError(401, 'nope', undefined, 'CLIENT_VIEW_INVALID'));

    await renderPortal(root);

    expect(container.textContent).toContain(i18n.t('clientView:invalid.title'));
  });

  it('shows the empty state when there are no published entries yet', async () => {
    svc.openClientSession.mockResolvedValueOnce(SESSION);
    svc.getClientSiteLogs.mockResolvedValueOnce({ ...PAGE, content: [], totalElements: 0, totalPages: 0 });

    await renderPortal(root);

    expect(container.textContent).toContain(i18n.t('clientView:list.empty.title'));
  });
});
