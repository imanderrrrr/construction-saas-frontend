// BuildTrack — the role → inbox endpoint registry.
//
// Every network call in this service is parameterised by role, so the whole
// contract is one table: which roles have an inbox, and which path each one
// reads. WAREHOUSE joined it once backend PR #148 mapped the unified
// NotificationInboxController to /api/v1/warehouse/notifications; FINANCE is
// still absent on purpose — inventing a path for it would 404 at runtime.

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/api', () => ({
  api: vi.fn(),
}));

import { api } from '../lib/api';
import {
  getNotifications,
  getUnreadCount,
  hasNotificationInbox,
  markAllNotificationsRead,
  markNotificationRead,
} from './notifications';

const apiMock = vi.mocked(api);

describe('hasNotificationInbox', () => {
  it('is true for the three roles whose panel is the web app', () => {
    expect(hasNotificationInbox('SUPERVISOR')).toBe(true);
    expect(hasNotificationInbox('ADMIN')).toBe(true);
    expect(hasNotificationInbox('WAREHOUSE')).toBe(true);
  });

  it('is false for FINANCE (no endpoint) and for the mobile-only roles', () => {
    expect(hasNotificationInbox('FINANCE')).toBe(false);
    expect(hasNotificationInbox('WORKER')).toBe(false);
    expect(hasNotificationInbox('SUBCONTRACTOR')).toBe(false);
  });
});

describe('WAREHOUSE reads its own endpoint', () => {
  const WAREHOUSE_INBOX = '/api/v1/warehouse/notifications';

  beforeEach(() => apiMock.mockReset());

  it('GETs the paginated list', async () => {
    apiMock.mockResolvedValueOnce({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 });

    await getNotifications('WAREHOUSE', 0, 20);

    expect(apiMock).toHaveBeenCalledWith(`${WAREHOUSE_INBOX}?page=0&size=20`);
  });

  it('GETs the unread count', async () => {
    apiMock.mockResolvedValueOnce({ count: 3 });

    await expect(getUnreadCount('WAREHOUSE')).resolves.toEqual({ count: 3 });

    expect(apiMock).toHaveBeenCalledWith(`${WAREHOUSE_INBOX}/unread-count`);
  });

  it('PATCHes one row read and all rows read', async () => {
    apiMock.mockResolvedValue(undefined);

    await markNotificationRead('WAREHOUSE', 7);
    expect(apiMock).toHaveBeenCalledWith(`${WAREHOUSE_INBOX}/7/read`, { method: 'PATCH' });

    await markAllNotificationsRead('WAREHOUSE');
    expect(apiMock).toHaveBeenCalledWith(`${WAREHOUSE_INBOX}/read-all`, { method: 'PATCH' });
  });

  it('does not borrow the supervisor path the way ADMIN does', async () => {
    apiMock.mockResolvedValueOnce({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 });

    await getNotifications('WAREHOUSE');

    expect(apiMock.mock.calls[0][0]).not.toContain('/supervisor/');
  });
});

describe('a role with no endpoint', () => {
  beforeEach(() => apiMock.mockReset());

  it('throws instead of guessing a path, and never reaches the network', () => {
    expect(() => getNotifications('FINANCE')).toThrow(/FINANCE/);
    expect(apiMock).not.toHaveBeenCalled();
  });
});
