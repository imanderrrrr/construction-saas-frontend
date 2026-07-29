// BuildTrack — public portal, RFI tab ("Consultas"): the owner switches to
// the tab, reads the builder's question, and answers it (rate-limit aware).
// Services are mocked; the real routes table is mounted (createMemoryRouter).

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

const clientViewSvc = vi.hoisted(() => ({
  openClientSession: vi.fn(),
  getClientSiteLogs: vi.fn(),
}));
const rfiSvc = vi.hoisted(() => ({
  getClientRfis: vi.fn(),
  getClientRfiResponses: vi.fn(),
  respondClientRfi: vi.fn(),
}));

vi.mock('../services/clientView', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/clientView')>();
  return { ...actual, ...clientViewSvc };
});
vi.mock('../services/clientRfis', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/clientRfis')>();
  return { ...actual, ...rfiSvc };
});

import i18n from '../../i18n';
import { routes } from '../routes';
import { ApiError } from '../lib/api';
import type { ClientRfi, ClientRfiResponseEntry } from '../services/clientRfis';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const SESSION = {
  sessionToken: 'sess-1',
  expiresAt: '2026-08-01T00:00:00Z',
  project: { projectName: 'Casa Roble', clientName: 'Don Roberto', address: 'Calle 1' },
};

const SITELOG_PAGE = { content: [], page: 0, size: 10, totalElements: 0, totalPages: 0 };

function clientRfi(overrides: Partial<ClientRfi> = {}): ClientRfi {
  return {
    id: 21,
    rfiNumber: 1,
    displayNumber: 'RFI #001',
    subject: 'Detalle de anclaje',
    question: '¿Qué espesor lleva la platina?',
    status: 'OPEN',
    awaitingClient: true,
    dueDate: '2026-07-20',
    overdue: false,
    canRespond: true,
    sentAt: '2026-07-08T12:00:00Z',
    respondedAt: null,
    closedAt: null,
    officialResponseId: null,
    responseCount: 0,
    questionPhotos: [],
    ...overrides,
  };
}

function page(items: ClientRfi[]) {
  return { content: items, page: 0, size: 10, totalElements: items.length, totalPages: 1 };
}

function responseEntry(overrides: Partial<ClientRfiResponseEntry> = {}): ClientRfiResponseEntry {
  return {
    id: 61,
    byClient: true,
    body: 'Platina de 3/8',
    official: false,
    photos: [],
    createdAt: '2026-07-09T12:00:00Z',
    ...overrides,
  };
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

/** Mounts the real app router on the portal URL and opens the RFI tab. */
async function openRfiTab(root: Root, container: HTMLElement) {
  const router = createMemoryRouter(routes, { initialEntries: ['/client-view/tok123'] });
  await act(async () => {
    root.render(<RouterProvider router={router} />);
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await click(buttonByText(container, i18n.t('rfi:tab.rfi')));
}

describe('ClientView — RFI tab (public portal)', () => {
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

  it('switching to the tab lists the builder questions with number, due date and waiting banner', async () => {
    rfiSvc.getClientRfis.mockResolvedValue(page([clientRfi()]));
    await openRfiTab(root, container);

    expect(rfiSvc.getClientRfis).toHaveBeenCalledWith('sess-1', 0, 10);
    expect(container.textContent).toContain('RFI #001');
    expect(container.textContent).toContain('Detalle de anclaje');
    expect(container.textContent).toContain('¿Qué espesor lleva la platina?');
    expect(container.textContent).toContain(i18n.t('rfi:client.waiting'));
    expect(container.textContent).toContain(i18n.t('rfi:status.OPEN'));
  });

  it('the client answers — the card flips to answered and the thread gains the entry', async () => {
    rfiSvc.getClientRfis.mockResolvedValue(page([clientRfi()]));
    rfiSvc.respondClientRfi.mockResolvedValue(responseEntry());
    await openRfiTab(root, container);

    await click(buttonByText(container, i18n.t('rfi:client.respond')));
    const textarea = container.querySelector<HTMLTextAreaElement>('#rfi-answer-21')!;
    await act(async () => {
      setValue(textarea, 'Platina de 3/8');
    });
    await click(buttonByText(container, i18n.t('rfi:client.respond.send')));

    expect(rfiSvc.respondClientRfi).toHaveBeenCalledWith('sess-1', 21, expect.objectContaining({
      body: 'Platina de 3/8',
    }));
    expect(container.textContent).toContain(i18n.t('rfi:status.RESPONDED'));
    expect(container.textContent).not.toContain(i18n.t('rfi:client.waiting'));
  });

  it('an empty answer is rejected client-side', async () => {
    rfiSvc.getClientRfis.mockResolvedValue(page([clientRfi()]));
    await openRfiTab(root, container);

    await click(buttonByText(container, i18n.t('rfi:client.respond')));
    await click(buttonByText(container, i18n.t('rfi:client.respond.send')));

    expect(rfiSvc.respondClientRfi).not.toHaveBeenCalled();
    expect(container.textContent).toContain(i18n.t('rfi:client.respond.required'));
  });

  it('a 429 surfaces the rate-limit message', async () => {
    rfiSvc.getClientRfis.mockResolvedValue(page([clientRfi()]));
    rfiSvc.respondClientRfi.mockRejectedValue(new ApiError(429, 'rate limited', undefined, 'RATE_LIMITED'));
    await openRfiTab(root, container);

    await click(buttonByText(container, i18n.t('rfi:client.respond')));
    const textarea = container.querySelector<HTMLTextAreaElement>('#rfi-answer-21')!;
    await act(async () => {
      setValue(textarea, 'otra respuesta más');
    });
    await click(buttonByText(container, i18n.t('rfi:client.respond.send')));

    expect(container.textContent).toContain(i18n.t('rfi:client.respond.rateLimited'));
  });

  it('the thread labels the team anonymously and the client by name — official starred', async () => {
    rfiSvc.getClientRfis.mockResolvedValue(page([
      clientRfi({
        status: 'CLOSED',
        awaitingClient: false,
        canRespond: false,
        closedAt: '2026-07-10T12:00:00Z',
        officialResponseId: 61,
        responseCount: 2,
      }),
    ]));
    rfiSvc.getClientRfiResponses.mockResolvedValue([
      responseEntry({ official: true }),
      responseEntry({ id: 62, byClient: false, body: 'Gracias, procedemos así' }),
    ]);
    await openRfiTab(root, container);

    await click(buttonByText(container, i18n.t('rfi:client.responses.toggle', { count: 2 })));

    expect(rfiSvc.getClientRfiResponses).toHaveBeenCalledWith('sess-1', 21);
    expect(container.textContent).toContain('Don Roberto');
    expect(container.textContent).toContain(i18n.t('rfi:client.responses.team'));
    expect(container.textContent).toContain(i18n.t('rfi:client.responses.official'));
    expect(container.textContent).toContain(i18n.t('rfi:client.closedInfo'));
    // A closed question offers no answer button.
    expect(Array.from(container.querySelectorAll('button'))
      .some((b) => (b.textContent ?? '').trim() === i18n.t('rfi:client.respond'))).toBe(false);
  });
});
