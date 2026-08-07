import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMock = vi.fn();
vi.mock('../lib/api', () => ({ api: (...args: unknown[]) => apiMock(...args) }));

import { listActiveUsers } from './users';

/**
 * `listActiveUsers` used to ask for one page of 100 and return it as the whole
 * staff. Past 100 active users the rest stopped existing for every caller —
 * including the project assignment editor, which keeps ids it cannot show and
 * sends them back on save, so a user off page one became invisible AND
 * unremovable. That is what left a customer unable to delete a project —
 * see the inactive-assignee fix in the backend guard for the sibling case.
 */
describe('listActiveUsers', () => {
  beforeEach(() => apiMock.mockReset());

  const user = (id: number) => ({ id, username: `u${id}`, fullName: null, role: 'WORKER', status: 'ACTIVE' });

  it('returns users beyond the first page', async () => {
    apiMock
      .mockResolvedValueOnce({ content: Array.from({ length: 200 }, (_, i) => user(i + 1)), totalPages: 2 })
      .mockResolvedValueOnce({ content: [user(201), user(202)], totalPages: 2 });

    const users = await listActiveUsers();

    expect(apiMock).toHaveBeenCalledTimes(2);
    expect(users).toHaveLength(202);
    expect(users[users.length - 1].id).toBe(202);
  });

  it('never caps the request at a fixed row count', async () => {
    apiMock.mockResolvedValueOnce({ content: [user(1)], totalPages: 1 });

    await listActiveUsers();

    // The old bug was literally `size: 100` with no second request. Asking for
    // page 0 only is fine; believing one page is everything is not.
    const url = String(apiMock.mock.calls[0][0]);
    expect(url).toContain('status=ACTIVE');
    expect(url).toContain('page=0');
  });

  it('keeps the role filter while draining', async () => {
    apiMock
      .mockResolvedValueOnce({ content: [user(1)], totalPages: 2 })
      .mockResolvedValueOnce({ content: [user(2)], totalPages: 2 });

    await listActiveUsers('WORKER');

    expect(apiMock).toHaveBeenCalledTimes(2);
    for (const call of apiMock.mock.calls) expect(String(call[0])).toContain('role=WORKER');
  });
});
