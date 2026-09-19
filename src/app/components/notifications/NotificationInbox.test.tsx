// BuildTrack — the shared notification inbox card.
//
// Extracted from SupervisorDashboard so the admin (whose dashboard never
// imported the notifications service) gets the same inbox. Mocking mirrors
// FinanceDashboard.loadError.test.tsx; `t` returns its key, so a row that went
// through the resolver reads as the catalogue key and a legacy row as the
// server's text — which is exactly the distinction under test.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getNotifications: vi.fn(),
  getUnreadCount: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, o?: Record<string, unknown>) => (o && 'count' in o ? `${key}:${String(o.count)}` : key),
    i18n: { language: 'es' },
  }),
  // The services module reaches lib/api, which boots src/i18n on import —
  // that needs this export to exist on the mock.
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
vi.mock('sonner', () => ({ toast: { error: mocks.toastError } }));
// The role → endpoint registry stays real: a role without an entry must
// render nothing, and that is the registry's call, not the mock's.
vi.mock('../../services/notifications', async importOriginal => ({
  ...(await importOriginal<typeof import('../../services/notifications')>()),
  getNotifications: mocks.getNotifications,
  getUnreadCount: mocks.getUnreadCount,
  markNotificationRead: mocks.markNotificationRead,
  markAllNotificationsRead: mocks.markAllNotificationsRead,
}));

import { NotificationInbox, whenLabel } from './NotificationInbox';
import type { NotificationResponse } from '../../services/notifications';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function flush() {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

function notif(id: number, over: Partial<NotificationResponse> = {}): NotificationResponse {
  return {
    id,
    type: 'INVOICE_SUBMITTED',
    title: `Server title ${id}`,
    message: `Server message ${id}`,
    i18n: null,
    relatedEntityType: null,
    relatedEntityId: null,
    isRead: false,
    createdAt: new Date().toISOString(),
    readAt: null,
    ...over,
  };
}

const KEYED = notif(1, {
  i18n: { titleKey: 'notifInvoiceSubmittedTitle', bodyKey: 'notifInvoiceSubmittedBody', params: { actor: 'S', amountCents: 100, job: 'J' } },
});
const LEGACY = notif(2, { isRead: true });

const rows = (c: HTMLElement) => Array.from(c.querySelectorAll<HTMLElement>('[data-testid="notification-row"]'));

describe('NotificationInbox', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUnreadCount.mockResolvedValue({ count: 1 });
    mocks.markNotificationRead.mockResolvedValue(undefined);
    mocks.markAllNotificationsRead.mockResolvedValue(undefined);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('renders nothing, and fetches nothing, for a role with no inbox endpoint yet', async () => {
    await act(async () => root.render(<NotificationInbox role="FINANCE" />));
    await flush();
    expect(container.innerHTML).toBe('');
    expect(mocks.getNotifications).not.toHaveBeenCalled();
  });

  it('ADMIN reads the supervisor endpoint and rows go through the resolver', async () => {
    mocks.getNotifications.mockResolvedValue({ content: [KEYED, LEGACY] });
    await act(async () => root.render(<NotificationInbox role="ADMIN" />));
    await flush();

    expect(mocks.getNotifications).toHaveBeenCalledWith('ADMIN', 0, 20);
    const [first, second] = rows(container);
    // Keyed row: composed from the catalogue (the mock t echoes the key).
    expect(first.textContent).toContain('notifications:notifInvoiceSubmittedTitle');
    expect(first.textContent).not.toContain('Server title 1');
    // Legacy row (no i18n): the server's text, both fields.
    expect(second.textContent).toContain('Server title 2');
    expect(second.textContent).toContain('Server message 2');
    expect(first.dataset.read).toBe('false');
    expect(second.dataset.read).toBe('true');
    // Unread badge from the count endpoint.
    expect(container.textContent).toContain('inbox.markAllRead');
  });

  it('a failed load shows the ErrorBanner + retry, never the empty state', async () => {
    mocks.getNotifications.mockRejectedValueOnce(new Error('boom'));
    await act(async () => root.render(<NotificationInbox role="SUPERVISOR" />));
    await flush();

    const banner = container.querySelector('[data-testid="notification-inbox-load-error"]');
    expect(banner).not.toBeNull();
    expect(banner!.textContent).toContain('inbox.loadError');
    expect(container.textContent).not.toContain('inbox.empty');

    mocks.getNotifications.mockResolvedValueOnce({ content: [LEGACY] });
    const buttons = Array.from(banner!.querySelectorAll('button'));
    await act(async () => buttons[buttons.length - 1].click());
    await flush();

    expect(mocks.getNotifications).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[data-testid="notification-inbox-load-error"]')).toBeNull();
    expect(rows(container)).toHaveLength(1);
  });

  it('an empty inbox says so', async () => {
    mocks.getNotifications.mockResolvedValue({ content: [] });
    mocks.getUnreadCount.mockResolvedValue({ count: 0 });
    await act(async () => root.render(<NotificationInbox role="SUPERVISOR" />));
    await flush();
    expect(container.textContent).toContain('inbox.empty');
    expect(container.textContent).not.toContain('inbox.markAllRead');
  });

  it('marking read is optimistic and rolls back with a toast when the server refuses', async () => {
    mocks.getNotifications.mockResolvedValue({ content: [KEYED] });
    let reject!: (e: Error) => void;
    mocks.markNotificationRead.mockReturnValue(new Promise<void>((_, rej) => { reject = rej; }));
    await act(async () => root.render(<NotificationInbox role="SUPERVISOR" />));
    await flush();

    await act(async () => rows(container)[0].click());
    // Flipped before the server answered; the badge went with it.
    expect(rows(container)[0].dataset.read).toBe('true');
    expect(container.textContent).not.toContain('inbox.markAllRead');
    expect(mocks.markNotificationRead).toHaveBeenCalledWith('SUPERVISOR', 1);

    await act(async () => { reject(new Error('503')); });
    await flush();
    expect(rows(container)[0].dataset.read).toBe('false');
    expect(container.textContent).toContain('inbox.markAllRead');
    expect(mocks.toastError).toHaveBeenCalledWith('inbox.markReadError');
  });

  it('a read row is inert', async () => {
    mocks.getNotifications.mockResolvedValue({ content: [LEGACY] });
    await act(async () => root.render(<NotificationInbox role="SUPERVISOR" />));
    await flush();
    await act(async () => rows(container)[0].click());
    expect(mocks.markNotificationRead).not.toHaveBeenCalled();
  });

  it('mark all as read flips every row and calls the role endpoint', async () => {
    mocks.getNotifications.mockResolvedValue({ content: [KEYED, notif(3)] });
    mocks.getUnreadCount.mockResolvedValue({ count: 2 });
    await act(async () => root.render(<NotificationInbox role="ADMIN" />));
    await flush();

    const markAll = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('inbox.markAllRead'))!;
    await act(async () => markAll.click());
    await flush();

    expect(rows(container).map(r => r.dataset.read)).toEqual(['true', 'true']);
    expect(mocks.markAllNotificationsRead).toHaveBeenCalledWith('ADMIN');
    expect(container.textContent).not.toContain('inbox.markAllRead');
  });

  it('a failed mark-all puts every row back', async () => {
    mocks.getNotifications.mockResolvedValue({ content: [KEYED, LEGACY] });
    mocks.markAllNotificationsRead.mockRejectedValue(new Error('503'));
    await act(async () => root.render(<NotificationInbox role="ADMIN" />));
    await flush();

    const markAll = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('inbox.markAllRead'))!;
    await act(async () => markAll.click());
    await flush();

    expect(rows(container).map(r => r.dataset.read)).toEqual(['false', 'true']);
    expect(mocks.toastError).toHaveBeenCalledWith('inbox.markReadError');
  });
});

describe('whenLabel', () => {
  const now = Date.parse('2026-09-19T15:00:00Z');
  const at = (minutesAgo: number) => new Date(now - minutesAgo * 60_000).toISOString();

  it('follows the language: minutes, hours, days, then the date', () => {
    expect(whenLabel(at(0), 'es', 'justo ahora', now)).toBe('justo ahora');
    expect(whenLabel(at(5), 'es', 'x', now)).toBe('hace 5 minutos');
    expect(whenLabel(at(5), 'en', 'x', now)).toBe('5 minutes ago');
    expect(whenLabel(at(3 * 60), 'es', 'x', now)).toBe('hace 3 horas');
    expect(whenLabel(at(26 * 60), 'es', 'x', now)).toBe('ayer');
    expect(whenLabel(at(26 * 60), 'en', 'x', now)).toBe('yesterday');
    expect(whenLabel(at(3 * 24 * 60), 'en', 'x', now)).toBe('3 days ago');
    expect(whenLabel(at(10 * 24 * 60), 'en', 'x', now)).toMatch(/Sep 9, 2026/);
    expect(whenLabel(at(10 * 24 * 60), 'es', 'x', now)).toMatch(/9 sept 2026/);
  });
});
