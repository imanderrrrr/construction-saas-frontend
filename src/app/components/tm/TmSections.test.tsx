// BuildTrack — the two T&M section screens.
//
// The office half carries the one irreversible action in this module, so most
// of what is here is about that: converting is behind a confirmation, the
// confirmation says that money moves, and the button only exists when the
// server says the ticket is convertible.
//
// The site half is checked for the distinction the client cares about —
// "he hasn't signed it yet" and "he wouldn't sign it" must not read the same.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const svc = vi.hoisted(() => ({
  listFieldTmTickets: vi.fn(),
  getFieldTmPending: vi.fn(),
  listOfficeTmTickets: vi.fn(),
  getOfficeTmPending: vi.fn(),
  convertTmTicket: vi.fn(),
  requestTmSignature: vi.fn(),
  revokeTmSignature: vi.fn(),
}));

vi.mock('../../services/tm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/tm')>();
  return { ...actual, ...svc };
});

vi.mock('../../services/time', () => ({
  getSupervisorProjects: vi.fn().mockResolvedValue([{ id: 7, name: 'Torre Norte' }]),
}));

vi.mock('../../services/projects', () => ({
  listProjects: vi.fn().mockResolvedValue({ content: [{ id: 7, name: 'Torre Norte' }] }),
}));

import { TmFieldSection } from './TmFieldSection';
import { TmOfficeSection } from './TmOfficeSection';
import i18n from '../../../i18n';
import type { TmTicket } from '../../services/tm';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function ticket(over: Partial<TmTicket> = {}): TmTicket {
  return {
    id: 1,
    ticketNumber: 'TM-000001',
    projectId: 7,
    projectName: 'Torre Norte',
    description: 'Cambio de madera podrida',
    notes: null,
    workDate: '2026-08-10',
    workerCount: 3,
    hours: 7.5,
    hourlyRate: 20,
    material: 125.5,
    labor: 450,
    total: 575.5,
    status: 'DRAFT',
    convertible: false,
    editable: true,
    signatureRequestId: null,
    signatureRequestedAt: null,
    signedAt: null,
    signerName: null,
    signerTitle: null,
    declinedAt: null,
    declineReason: null,
    documentHash: null,
    signUrl: null,
    changeOrderId: null,
    convertedAt: null,
    convertedBy: null,
    createdBy: 'encargado1',
    createdAt: '2026-08-11T14:00:00Z',
    ageDays: 1,
    ...over,
  };
}

const EMPTY_SUMMARY = { ticketCount: 0, totalPending: 0, oldestAgeDays: 0, tickets: [] };

let container: HTMLDivElement;
let root: Root;

function findByText(text: string): HTMLElement | undefined {
  return Array.from(container.querySelectorAll('button, p, h3, dd, span'))
    .find(el => el.textContent?.trim() === text) as HTMLElement | undefined;
}

async function click(el: Element | undefined) {
  if (!el) throw new Error('element not found');
  await act(async () => { (el as HTMLElement).click(); });
  await act(async () => { await Promise.resolve(); });
}

async function render(node: React.ReactElement) {
  await act(async () => { root.render(node); });
  await act(async () => { await Promise.resolve(); });
  await act(async () => { await Promise.resolve(); });
}

beforeEach(async () => {
  await i18n.changeLanguage('en');
  for (const fn of Object.values(svc)) fn.mockReset();
  svc.listFieldTmTickets.mockResolvedValue([]);
  svc.getFieldTmPending.mockResolvedValue(EMPTY_SUMMARY);
  svc.listOfficeTmTickets.mockResolvedValue([]);
  svc.getOfficeTmPending.mockResolvedValue(EMPTY_SUMMARY);
  svc.convertTmTicket.mockResolvedValue(ticket({ status: 'CONVERTED' }));
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => { root.unmount(); });
  container.remove();
});

describe('the site section', () => {
  it('renders the pending summary and an empty state without crashing', async () => {
    await render(<TmFieldSection />);

    expect(container.textContent).toContain(i18n.t('tm:pending.title'));
    expect(container.textContent).toContain(i18n.t('tm:list.empty'));
  });

  it('shows the total of unauthorised work as money', async () => {
    svc.getFieldTmPending.mockResolvedValue({
      ticketCount: 2, totalPending: 1150.75, oldestAgeDays: 9, tickets: [],
    });
    await render(<TmFieldSection />);

    expect(container.textContent).toContain('$1,150.75');
    expect(container.textContent).toContain('9 days');
  });

  it('does not read "waiting" and "refused" the same way', async () => {
    svc.listFieldTmTickets.mockResolvedValue([
      ticket({ id: 1, ticketNumber: 'TM-000001', status: 'PENDING_SIGNATURE', editable: false }),
      ticket({ id: 2, ticketNumber: 'TM-000002', status: 'DECLINED', editable: true }),
    ]);
    await render(<TmFieldSection />);

    expect(container.textContent).toContain(i18n.t('tm:status.PENDING_SIGNATURE'));
    expect(container.textContent).toContain(i18n.t('tm:status.DECLINED'));
    expect(i18n.t('tm:status.PENDING_SIGNATURE')).not.toBe(i18n.t('tm:status.DECLINED'));
  });

  it('offers the on-site signature and the link, and no delete anywhere', async () => {
    svc.listFieldTmTickets.mockResolvedValue([
      ticket({ status: 'PENDING_SIGNATURE', editable: false, signUrl: 'https://x/sign/tok' }),
    ]);
    await render(<TmFieldSection />);
    await click(findByText('TM-000001')?.closest('button') ?? undefined);

    expect(findByText(i18n.t('tm:actions.signHere'))).toBeTruthy();
    expect(findByText(i18n.t('tm:actions.copyLink'))).toBeTruthy();
    expect(findByText(i18n.t('tm:actions.revoke'))).toBeTruthy();
    // There is no delete endpoint; there must be no delete button.
    expect(container.textContent?.toLowerCase()).not.toContain('delete');
  });
});

describe('the office section', () => {
  it('renders without crashing', async () => {
    await render(<TmOfficeSection />);
    expect(container.textContent).toContain(i18n.t('tm:pending.title'));
  });

  it('offers conversion only when the server says the ticket is convertible', async () => {
    svc.listOfficeTmTickets.mockResolvedValue([
      ticket({ status: 'SIGNED', convertible: false, editable: false }),
    ]);
    await render(<TmOfficeSection />);
    await click(findByText('TM-000001')?.closest('button') ?? undefined);

    expect(findByText(i18n.t('tm:office.convert'))).toBeUndefined();
    expect(container.textContent).toContain(i18n.t('tm:office.notConvertible'));
  });

  it('converts only after a confirmation that says money moves', async () => {
    svc.listOfficeTmTickets.mockResolvedValue([
      ticket({ status: 'SIGNED', convertible: true, editable: false }),
    ]);
    await render(<TmOfficeSection />);
    await click(findByText('TM-000001')?.closest('button') ?? undefined);

    // One click opens the confirmation and converts nothing.
    await click(findByText(i18n.t('tm:office.convert')));
    expect(svc.convertTmTicket).not.toHaveBeenCalled();
    expect(container.textContent).toContain(i18n.t('tm:office.convertWarning'));
    expect(container.textContent).toContain('$575.50');

    await click(findByText(i18n.t('tm:office.convertConfirm')));
    expect(svc.convertTmTicket).toHaveBeenCalledWith(1, { changeOrderNumber: undefined });
  });

  it('lets the confirmation be backed out of', async () => {
    svc.listOfficeTmTickets.mockResolvedValue([
      ticket({ status: 'SIGNED', convertible: true, editable: false }),
    ]);
    await render(<TmOfficeSection />);
    await click(findByText('TM-000001')?.closest('button') ?? undefined);
    await click(findByText(i18n.t('tm:office.convert')));
    await click(findByText(i18n.t('tm:office.cancel')));

    expect(svc.convertTmTicket).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain(i18n.t('tm:office.convertWarning'));
  });
});
