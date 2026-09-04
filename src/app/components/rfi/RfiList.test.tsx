// BuildTrack — internal RFI view: drafts (save/send/edit/discard), the
// thread with the client, impacts, and closing with THE official response.
// Services mocked.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const svc = vi.hoisted(() => ({
  listRfis: vi.fn(),
  createRfi: vi.fn(),
  getRfi: vi.fn(),
  updateRfiDraft: vi.fn(),
  deleteRfiDraft: vi.fn(),
  submitRfi: vi.fn(),
  addRfiResponse: vi.fn(),
  updateRfiImpacts: vi.fn(),
  closeRfi: vi.fn(),
}));

vi.mock('../../services/rfis', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/rfis')>();
  return { ...actual, ...svc };
});

import i18n from '../../../i18n';
import { RfiList } from './RfiList';
import type { Rfi, RfiResponseEntry } from '../../services/rfis';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const PROJECT = { id: 7, name: 'Casa Roble' };

function rfi(overrides: Partial<Rfi> = {}): Rfi {
  return {
    id: 1,
    rfiNumber: 1,
    displayNumber: 'RFI #001',
    subject: 'Detalle de anclaje',
    question: '¿Qué espesor lleva la platina?',
    status: 'OPEN',
    ballInCourt: 'CLIENT',
    overdue: false,
    dueDate: null,
    costImpact: 'TBD',
    costImpactAmountCents: null,
    scheduleImpact: 'TBD',
    scheduleImpactDays: null,
    officialResponseId: null,
    createdByName: 'Admin Uno',
    submittedAt: '2026-07-08T12:00:00Z',
    submittedByName: 'Admin Uno',
    respondedAt: null,
    closedAt: null,
    closedByName: null,
    closable: false,
    responseCount: 0,
    questionPhotos: [],
    responses: [],
    events: [],
    createdAt: '2026-07-08T12:00:00Z',
    updatedAt: '2026-07-08T12:00:00Z',
    ...overrides,
  };
}

function entry(overrides: Partial<RfiResponseEntry> = {}): RfiResponseEntry {
  return {
    id: 51,
    authorName: null,
    byClient: true,
    body: 'Platina de 3/8, como la memoria',
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

async function render(root: Root) {
  await act(async () => {
    root.render(<RfiList projects={[PROJECT]} />);
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('RfiList (internal view)', () => {
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

  it('lists RFIs with number, status, ball-in-court and overdue badges', async () => {
    svc.listRfis.mockResolvedValue([
      rfi(),
      rfi({ id: 2, rfiNumber: 2, displayNumber: 'RFI #002', subject: 'Color de fachada', status: 'RESPONDED', ballInCourt: 'COMPANY', responseCount: 1 }),
      rfi({ id: 3, rfiNumber: 3, displayNumber: 'RFI #003', subject: 'Nivel de piso', overdue: true, dueDate: '2026-07-01' }),
    ]);
    await render(root);

    expect(svc.listRfis).toHaveBeenCalledWith(7, {});
    expect(container.textContent).toContain('RFI #001');
    expect(container.textContent).toContain('Detalle de anclaje');
    expect(container.textContent).toContain(i18n.t('rfi:status.OPEN'));
    expect(container.textContent).toContain(i18n.t('rfi:status.RESPONDED'));
    expect(container.textContent).toContain(i18n.t('rfi:ball.CLIENT'));
    expect(container.textContent).toContain(i18n.t('rfi:ball.COMPANY'));
    expect(container.textContent).toContain(i18n.t('rfi:status.overdue'));
  });

  it('filters by status through the chips', async () => {
    svc.listRfis.mockResolvedValue([]);
    await render(root);

    await click(buttonByText(container, i18n.t('rfi:status.DRAFT')));
    expect(svc.listRfis).toHaveBeenLastCalledWith(7, { status: 'DRAFT' });
  });

  it('the "my move" chip hides RFIs waiting on the client', async () => {
    svc.listRfis.mockResolvedValue([
      rfi({ subject: 'Esperando al cliente' }),
      rfi({ id: 2, rfiNumber: 2, displayNumber: 'RFI #002', subject: 'Para cerrar', status: 'RESPONDED', ballInCourt: 'COMPANY' }),
    ]);
    await render(root);

    await click(buttonByText(container, i18n.t('rfi:internal.filter.mine')));
    expect(container.textContent).not.toContain('Esperando al cliente');
    expect(container.textContent).toContain('Para cerrar');
  });

  it('saves a draft or sends directly from the create form', async () => {
    svc.listRfis.mockResolvedValue([]);
    svc.createRfi.mockResolvedValue(rfi({ status: 'DRAFT', rfiNumber: null, displayNumber: null, ballInCourt: 'COMPANY' }));
    await render(root);

    await click(buttonByText(container, i18n.t('rfi:internal.new')));
    // The form is a drawer, portaled to <body>.
    const subject = document.querySelector<HTMLInputElement>('#rfi-subject-new')!;
    const question = document.querySelector<HTMLTextAreaElement>('#rfi-question-new')!;
    await act(async () => {
      setValue(subject, 'Nueva consulta de prueba');
      setValue(question, '¿Cómo va esto?');
    });
    await click(buttonByText(document.body, i18n.t('rfi:internal.form.saveDraft')));

    expect(svc.createRfi).toHaveBeenCalledWith(7, expect.objectContaining({
      subject: 'Nueva consulta de prueba',
      question: '¿Cómo va esto?',
      submit: false,
    }));
    expect(container.textContent).toContain(i18n.t('rfi:status.DRAFT'));
  });

  it('a draft can be sent — it gains its number and the ball moves to the client', async () => {
    svc.listRfis.mockResolvedValue([
      rfi({ status: 'DRAFT', rfiNumber: null, displayNumber: null, ballInCourt: 'COMPANY' }),
    ]);
    svc.submitRfi.mockResolvedValue(rfi());
    await render(root);

    await click(buttonByText(container, i18n.t('rfi:internal.draft.send')));
    expect(svc.submitRfi).toHaveBeenCalledWith(1);
    expect(container.textContent).toContain('RFI #001');
    expect(container.textContent).toContain(i18n.t('rfi:ball.CLIENT'));
  });

  it('a draft can be discarded after confirmation', async () => {
    svc.listRfis.mockResolvedValue([
      rfi({ status: 'DRAFT', rfiNumber: null, displayNumber: null, subject: 'Borrador descartable', ballInCourt: 'COMPANY' }),
    ]);
    svc.deleteRfiDraft.mockResolvedValue(undefined);
    await render(root);

    await click(buttonByText(container, i18n.t('rfi:internal.draft.delete')));
    // First click only opens the 440 px confirmation; nothing is deleted yet.
    expect(svc.deleteRfiDraft).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain(i18n.t('rfi:internal.draft.deleteTitle'));
    await click(buttonByText(document.body, i18n.t('common:buttons.delete')));
    expect(svc.deleteRfiDraft).toHaveBeenCalledWith(1);
    expect(container.textContent).not.toContain('Borrador descartable');
  });

  it('shows the thread with both faces and posts an internal follow-up', async () => {
    const detail = rfi({
      status: 'RESPONDED',
      ballInCourt: 'COMPANY',
      responseCount: 1,
      responses: [entry()],
      events: [],
    });
    svc.listRfis.mockResolvedValue([detail]);
    svc.getRfi.mockResolvedValue(detail);
    svc.addRfiResponse.mockResolvedValue(entry({ id: 52, authorName: 'Admin Uno', byClient: false, body: 'Gracias, confirmado' }));
    await render(root);

    await click(buttonByText(container, i18n.t('rfi:internal.responses.toggle', { count: 1 })));
    expect(svc.getRfi).toHaveBeenCalledWith(1);
    expect(container.textContent).toContain(i18n.t('rfi:internal.responses.client'));
    expect(container.textContent).toContain('Platina de 3/8');

    const textarea = container.querySelector<HTMLTextAreaElement>(
      `textarea[aria-label="${i18n.t('rfi:internal.responses.placeholder')}"]`,
    )!;
    await act(async () => {
      setValue(textarea, 'Gracias, confirmado');
    });
    await click(buttonByText(container, i18n.t('rfi:internal.responses.send')));
    expect(svc.addRfiResponse).toHaveBeenCalledWith(1, expect.objectContaining({ body: 'Gracias, confirmado' }));
    expect(container.textContent).toContain('Gracias, confirmado');
  });

  it('closing demands picking the official response and freezes the record', async () => {
    const clientEntry = entry();
    const detail = rfi({
      status: 'RESPONDED',
      ballInCourt: 'COMPANY',
      closable: true,
      responseCount: 1,
      responses: [clientEntry],
    });
    svc.listRfis.mockResolvedValue([detail]);
    svc.getRfi.mockResolvedValue(detail);
    svc.closeRfi.mockResolvedValue(rfi({
      status: 'CLOSED',
      ballInCourt: 'NONE',
      officialResponseId: clientEntry.id,
      closedAt: '2026-07-10T12:00:00Z',
      closedByName: 'Admin Uno',
      costImpact: 'NO',
      scheduleImpact: 'NO',
      responses: [{ ...clientEntry, official: true }],
      responseCount: 1,
    }));
    await render(root);

    await click(buttonByText(container, i18n.t('rfi:internal.close')));
    // Closing is a modal (portaled): the confirm button stays disabled until a response is picked.
    const confirmBtn = buttonByText(document.body, i18n.t('rfi:internal.close.confirm'));
    expect(confirmBtn.disabled).toBe(true);

    const radio = document.querySelector<HTMLInputElement>(`input[name="rfi-official-1"]`)!;
    await click(radio);
    await click(buttonByText(document.body, i18n.t('rfi:internal.close.confirm')));

    expect(svc.closeRfi).toHaveBeenCalledWith(1, expect.objectContaining({ officialResponseId: clientEntry.id }));
    expect(container.textContent).toContain(i18n.t('rfi:status.CLOSED'));
  });

  it('edits the impacts while the RFI is open', async () => {
    svc.listRfis.mockResolvedValue([rfi()]);
    svc.updateRfiImpacts.mockResolvedValue(rfi({ costImpact: 'YES', costImpactAmountCents: 150000 }));
    await render(root);

    await click(buttonByText(container, i18n.t('rfi:internal.impacts.edit')));
    // Sí / No / Por definir are joined squares; the amount wakes up on "Sí".
    await click(container.querySelector<HTMLButtonElement>('[data-testid="rfi-impact-cost-YES"]')!);
    const amount = container.querySelector<HTMLInputElement>(
      `input[aria-label="${i18n.t('rfi:impact.amount')}"]`,
    )!;
    await act(async () => {
      setValue(amount, '1500');
    });
    await click(buttonByText(container, i18n.t('rfi:internal.impacts.save')));

    expect(svc.updateRfiImpacts).toHaveBeenCalledWith(1, expect.objectContaining({
      costImpact: 'YES',
      costImpactAmountCents: 150000,
    }));
    expect(container.textContent).toContain('1,500.00');
  });
});
