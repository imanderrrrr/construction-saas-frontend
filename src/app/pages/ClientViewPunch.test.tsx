// BuildTrack — public portal, punch-list tab (fase 2): the owner switches to
// "Pendientes", reports an item, and confirms/rejects READY_FOR_REVIEW ones.
// Services are mocked; the real routes table is mounted (createMemoryRouter).

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

const clientViewSvc = vi.hoisted(() => ({
  openClientSession: vi.fn(),
  getClientSiteLogs: vi.fn(),
}));
const punchSvc = vi.hoisted(() => ({
  getClientPunchItems: vi.fn(),
  createClientPunchItem: vi.fn(),
  confirmClientPunchItem: vi.fn(),
  rejectClientPunchItem: vi.fn(),
}));

vi.mock('../services/clientView', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/clientView')>();
  return { ...actual, ...clientViewSvc };
});
vi.mock('../services/clientPunchItems', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/clientPunchItems')>();
  return { ...actual, ...punchSvc };
});

import i18n from '../../i18n';
import { routes } from '../routes';
import type { ClientPunchItem } from '../services/clientPunchItems';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const SESSION = {
  sessionToken: 'sess-1',
  expiresAt: '2026-08-01T00:00:00Z',
  project: { projectName: 'Casa Roble', clientName: 'Don Roberto', address: 'Calle 1' },
};

const SITELOG_PAGE = { content: [], page: 0, size: 10, totalElements: 0, totalPages: 0 };

function punchItem(overrides: Partial<ClientPunchItem> = {}): ClientPunchItem {
  return {
    id: 11,
    title: 'Fuga en el lavamanos',
    description: 'Gotea de noche',
    location: 'Baño principal',
    status: 'OPEN',
    createdAt: '2026-07-08T12:00:00Z',
    readyAt: null,
    readyNote: null,
    closedAt: null,
    closedByCompany: false,
    closeNote: null,
    lastRejectNote: null,
    canReview: false,
    photos: [],
    ...overrides,
  };
}

function page(items: ClientPunchItem[]) {
  return { content: items, page: 0, size: 10, totalElements: items.length, totalPages: 1 };
}

function buttonByText(container: HTMLElement, text: string): HTMLButtonElement {
  const btn = Array.from(container.querySelectorAll('button'))
    .find((b) => (b.textContent ?? '').trim() === text);
  if (!btn) throw new Error(`button not found: ${text}`);
  return btn as HTMLButtonElement;
}

function setValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement
    ? window.HTMLTextAreaElement.prototype
    : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')!.set!;
  setter.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

async function click(el: HTMLElement) {
  await act(async () => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function renderPortalOnPunchTab(root: Root, container: HTMLElement) {
  const router = createMemoryRouter(routes, { initialEntries: ['/client-view/tok123'] });
  await act(async () => {
    root.render(<RouterProvider router={router} />);
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await click(buttonByText(container, i18n.t('punchList:tab.punch')));
}

describe('ClientView punch-list tab (public portal)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
    clientViewSvc.openClientSession.mockResolvedValue(SESSION);
    clientViewSvc.getClientSiteLogs.mockResolvedValue(SITELOG_PAGE);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('switches to the punch tab and lists the items with their state', async () => {
    punchSvc.getClientPunchItems.mockResolvedValue(page([
      punchItem(),
      punchItem({
        id: 12,
        title: 'Puerta del clóset descuadrada',
        status: 'READY_FOR_REVIEW',
        readyAt: '2026-07-09T12:00:00Z',
        readyNote: 'Quedó ajustada',
        canReview: true,
      }),
    ]));

    await renderPortalOnPunchTab(root, container);

    expect(punchSvc.getClientPunchItems).toHaveBeenCalledWith('sess-1', 0, 10);
    expect(container.textContent).toContain('Fuga en el lavamanos');
    expect(container.textContent).toContain(i18n.t('punchList:status.OPEN'));
    expect(container.textContent).toContain('Puerta del clóset descuadrada');
    expect(container.textContent).toContain('Quedó ajustada');
    // Only the READY_FOR_REVIEW item offers the review actions.
    expect(container.textContent).toContain(i18n.t('punchList:client.item.confirm'));
    expect(container.textContent).toContain(i18n.t('punchList:client.item.reject'));
  });

  it('reports a new item (title required, then created on top of the list)', async () => {
    punchSvc.getClientPunchItems.mockResolvedValue(page([]));
    punchSvc.createClientPunchItem.mockResolvedValue(punchItem({ id: 20, title: 'Grieta en la sala' }));

    await renderPortalOnPunchTab(root, container);
    await click(buttonByText(container, i18n.t('punchList:client.report')));

    // Empty title → inline validation, no service call.
    const form = container.querySelector('form')!;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(punchSvc.createClientPunchItem).not.toHaveBeenCalled();
    expect(container.textContent).toContain(i18n.t('punchList:client.form.titleRequired'));

    const title = container.querySelector<HTMLInputElement>('#punch-title')!;
    const location = container.querySelector<HTMLInputElement>('#punch-location')!;
    await act(async () => {
      setValue(title, 'Grieta en la sala');
      setValue(location, 'Sala, 1er nivel');
    });
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(punchSvc.createClientPunchItem).toHaveBeenCalledWith('sess-1', {
      title: 'Grieta en la sala',
      description: '',
      location: 'Sala, 1er nivel',
      photos: [],
    });
    expect(container.textContent).toContain('Grieta en la sala');
  });

  it('confirms a ready item and shows it closed', async () => {
    const ready = punchItem({ id: 30, status: 'READY_FOR_REVIEW', readyAt: '2026-07-09T12:00:00Z', canReview: true });
    punchSvc.getClientPunchItems.mockResolvedValue(page([ready]));
    punchSvc.confirmClientPunchItem.mockResolvedValue({
      ...ready,
      status: 'CLOSED',
      closedAt: '2026-07-10T12:00:00Z',
      canReview: false,
    });

    await renderPortalOnPunchTab(root, container);
    await click(buttonByText(container, i18n.t('punchList:client.item.confirm')));

    expect(punchSvc.confirmClientPunchItem).toHaveBeenCalledWith('sess-1', 30);
    expect(container.textContent).toContain(i18n.t('punchList:status.CLOSED'));
  });

  it('rejects a ready item with a note', async () => {
    const ready = punchItem({ id: 40, status: 'READY_FOR_REVIEW', readyAt: '2026-07-09T12:00:00Z', canReview: true });
    punchSvc.getClientPunchItems.mockResolvedValue(page([ready]));
    punchSvc.rejectClientPunchItem.mockResolvedValue({
      ...ready,
      status: 'REOPENED',
      readyAt: null,
      readyNote: null,
      lastRejectNote: 'Sigue goteando',
      canReview: false,
    });

    await renderPortalOnPunchTab(root, container);
    await click(buttonByText(container, i18n.t('punchList:client.item.reject')));

    const note = container.querySelector<HTMLTextAreaElement>('#reject-note-40')!;
    await act(async () => {
      setValue(note, 'Sigue goteando');
    });
    await click(buttonByText(container, i18n.t('punchList:client.item.rejectSubmit')));

    expect(punchSvc.rejectClientPunchItem).toHaveBeenCalledWith('sess-1', 40, 'Sigue goteando');
    expect(container.textContent).toContain(i18n.t('punchList:status.REOPENED'));
  });
});
