import { beforeEach, describe, expect, it, vi } from 'vitest';

// The service is a thin shell over the platform fetch wrapper — mock it and
// assert the wire contract (path, method).
const platformApiMock = vi.fn();
vi.mock('../lib/platformApi', () => ({
  platformApi: (...args: unknown[]) => platformApiMock(...args),
}));

import { deleteLead, listLeads } from './platformLeads';

describe('platformLeads', () => {
  beforeEach(() => {
    platformApiMock.mockReset();
    platformApiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 25 });
  });

  it('listLeads calls GET /platform/leads?page=0&size=25', async () => {
    await listLeads();
    expect(platformApiMock).toHaveBeenCalledWith('/platform/leads?page=0&size=25');
  });

  it('listLeads passes the page it is asked for', async () => {
    await listLeads(3);
    expect(platformApiMock).toHaveBeenCalledWith('/platform/leads?page=3&size=25');
  });

  it('deleteLead calls DELETE /platform/leads/7', async () => {
    platformApiMock.mockResolvedValueOnce(undefined);
    await expect(deleteLead(7)).resolves.toBeUndefined();
    expect(platformApiMock).toHaveBeenCalledWith('/platform/leads/7', { method: 'DELETE' });
  });
});
