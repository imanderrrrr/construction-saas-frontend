// BuildTrack — internal punch-list view: list + filters + workflow actions
// (assign / mark ready / close under the D3 rules). Services mocked.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const svc = vi.hoisted(() => ({
  listPunchItems: vi.fn(),
  createPunchItem: vi.fn(),
  getPunchItem: vi.fn(),
  assignPunchItem: vi.fn(),
  markPunchItemReady: vi.fn(),
  returnPunchItemToProgress: vi.fn(),
  closePunchItem: vi.fn(),
  listPunchItemComments: vi.fn(),
  addPunchItemComment: vi.fn(),
}));

vi.mock('../../services/punchItems', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/punchItems')>();
  return { ...actual, ...svc };
});

import i18n from '../../../i18n';
import { PunchList } from './PunchList';
import type { PunchItem } from '../../services/punchItems';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

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

function buttonByText(container: HTMLElement, text: string): HTMLButtonElement {
  const btn = Array.from(container.querySelectorAll('button'))
    .find((b) => (b.textContent ?? '').trim() === text);
  if (!btn) throw new Error(`button not found: ${text}`);
  return btn as HTMLButtonElement;
}

async function click(el: HTMLElement) {
  await act(async () => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function render(root: Root) {
  await act(async () => {
    root.render(<PunchList projects={[PROJECT]} />);
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('PunchList (internal view)', () => {
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

  it('lists items with status, origin and the client review hint', async () => {
    svc.listPunchItems.mockResolvedValue([
      item(),
      item({
        id: 2,
        origin: 'CLIENT',
        title: 'Puerta descuadrada',
        status: 'READY_FOR_REVIEW',
        readyAt: '2026-07-10T10:00:00Z',
        readyNote: 'Ajustada y probada',
        closableInternally: false,
        reopenCount: 1,
      }),
    ]);

    await render(root);

    expect(svc.listPunchItems).toHaveBeenCalledWith(7, {});
    expect(container.textContent).toContain('Fuga en el lavamanos');
    expect(container.textContent).toContain(i18n.t('punchList:status.OPEN'));
    expect(container.textContent).toContain(i18n.t('punchList:internal.origin.CLIENT'));
    expect(container.textContent).toContain(i18n.t('punchList:internal.waitingClient'));
    // Client item fresh in review: no close button, only the 7-day hint.
    expect(container.textContent).toContain(i18n.t('punchList:internal.close.clientWindowHint'));
  });

  it('filters by status through the chip row', async () => {
    svc.listPunchItems.mockResolvedValue([]);
    await render(root);

    await click(buttonByText(container, i18n.t('punchList:status.OPEN')));
    expect(svc.listPunchItems).toHaveBeenLastCalledWith(7, { status: 'OPEN' });
  });

  it('assigns an item from the dropdown', async () => {
    svc.listPunchItems.mockResolvedValue([item()]);
    svc.assignPunchItem.mockResolvedValue(item({ status: 'IN_PROGRESS', assigneeId: 3, assigneeName: 'Obrero Uno' }));

    await render(root);

    const select = container.querySelector<HTMLSelectElement>('article select')!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')!.set!;
      setter.call(select, '3');
      select.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(svc.assignPunchItem).toHaveBeenCalledWith(1, 3);
    expect(container.textContent).toContain(i18n.t('punchList:status.IN_PROGRESS'));
  });

  it('marks an item ready through the evidence form', async () => {
    svc.listPunchItems.mockResolvedValue([item({ status: 'IN_PROGRESS', assigneeId: 3, assigneeName: 'Obrero Uno' })]);
    svc.markPunchItemReady.mockResolvedValue(item({
      status: 'READY_FOR_REVIEW',
      readyAt: '2026-07-10T10:00:00Z',
      readyNote: 'Cambiamos el empaque',
    }));

    await render(root);
    await click(buttonByText(container, i18n.t('punchList:internal.ready')));

    const note = container.querySelector<HTMLTextAreaElement>('textarea[id^="ready-note-"]')!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')!.set!;
      setter.call(note, 'Cambiamos el empaque');
      note.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await click(buttonByText(container, i18n.t('punchList:internal.ready.submit')));

    expect(svc.markPunchItemReady).toHaveBeenCalledWith(1, { note: 'Cambiamos el empaque', photos: [] });
    expect(container.textContent).toContain(i18n.t('punchList:internal.waitingClient'));
  });

  it('closes an internal item (closable at any time)', async () => {
    svc.listPunchItems.mockResolvedValue([item({
      id: 9,
      origin: 'INTERNAL',
      title: 'Resane de pared',
      createdByClient: false,
      createdByName: 'admin',
      closableInternally: true,
    })]);
    svc.closePunchItem.mockResolvedValue(item({
      id: 9,
      origin: 'INTERNAL',
      title: 'Resane de pared',
      status: 'CLOSED',
      closedAt: '2026-07-10T12:00:00Z',
      closedByName: 'admin',
      closableInternally: false,
    }));

    await render(root);
    await click(buttonByText(container, i18n.t('punchList:internal.close')));
    await click(buttonByText(container, i18n.t('punchList:internal.close.submit')));

    expect(svc.closePunchItem).toHaveBeenCalledWith(9, '');
    expect(container.textContent).toContain(i18n.t('punchList:status.CLOSED'));
  });

  it('shows the event timeline on demand', async () => {
    svc.listPunchItems.mockResolvedValue([item()]);
    svc.getPunchItem.mockResolvedValue(item({
      events: [
        { type: 'CREATED', actorName: null, byClient: true, note: null, createdAt: '2026-07-08T12:00:00Z' },
        { type: 'ASSIGNED', actorName: 'supervisor', byClient: false, note: 'Obrero Uno', createdAt: '2026-07-09T09:00:00Z' },
      ],
    }));

    await render(root);
    await click(buttonByText(container, i18n.t('punchList:internal.timeline.show')));

    expect(svc.getPunchItem).toHaveBeenCalledWith(1);
    expect(container.textContent).toContain(i18n.t('punchList:internal.event.CREATED'));
    expect(container.textContent).toContain(i18n.t('punchList:internal.timeline.client'));
    expect(container.textContent).toContain(i18n.t('punchList:internal.event.ASSIGNED'));
  });

  it('shows the per-project number on the card and the export trigger', async () => {
    svc.listPunchItems.mockResolvedValue([item({ itemNumber: 12, displayNumber: '#012' })]);

    await render(root);

    expect(container.textContent).toContain('#012');
    expect(container.textContent).toContain(i18n.t('punchList:internal.export'));
  });

  it('opens the comment thread, labels both sides and posts a reply', async () => {
    svc.listPunchItems.mockResolvedValue([item({ commentCount: 1 })]);
    svc.listPunchItemComments.mockResolvedValue([
      { id: 1, authorName: null, byClient: true, body: '¿Cuándo vienen?', createdAt: '2026-07-09T10:00:00Z' },
      { id: 2, authorName: 'Ana Admin', byClient: false, body: 'Mañana a primera hora', createdAt: '2026-07-09T11:00:00Z' },
    ]);
    svc.addPunchItemComment.mockResolvedValue(
      { id: 3, authorName: 'Ana Admin', byClient: false, body: 'Ya quedó', createdAt: '2026-07-09T12:00:00Z' },
    );

    await render(root);
    await click(buttonByText(container, i18n.t('punchList:internal.comments.toggle', { count: 1 })));

    expect(svc.listPunchItemComments).toHaveBeenCalledWith(1);
    // The client's message is labelled as the client; the internal one by name.
    expect(container.textContent).toContain(i18n.t('punchList:internal.comments.client'));
    expect(container.textContent).toContain('¿Cuándo vienen?');
    expect(container.textContent).toContain('Ana Admin');
    // A CLIENT item warns that the owner reads the thread.
    expect(container.textContent).toContain(i18n.t('punchList:internal.comments.visibleHint'));

    const box = container.querySelector<HTMLTextAreaElement>(
      `textarea[placeholder="${i18n.t('punchList:internal.comments.placeholder')}"]`,
    )!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')!.set!;
      setter.call(box, 'Ya quedó');
      box.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await click(buttonByText(container, i18n.t('punchList:internal.comments.send')));

    expect(svc.addPunchItemComment).toHaveBeenCalledWith(1, 'Ya quedó');
    expect(container.textContent).toContain('Ya quedó');
    // The toggle badge follows the loaded thread size.
    expect(container.textContent).toContain(i18n.t('punchList:internal.comments.toggle', { count: 3 }));
  });
});
