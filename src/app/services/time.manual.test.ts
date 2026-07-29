import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/api', () => ({
  api: vi.fn(),
}));

import { api } from '../lib/api';
import {
  addManualMarks, createManualRecord, getManualMarkContext,
  type ManualMarkContextResponse,
} from './time';

const apiMock = vi.mocked(api);

const CONTEXT: ManualMarkContextResponse = {
  userId: 7,
  date: '2026-07-01',
  paidPeriod: true,
  records: [
    {
      recordId: 42,
      projectId: 3,
      projectName: 'Torre Norte',
      approvalStatus: 'AUTO_REJECTED',
      paid: false,
      presentTypes: ['CHECK_IN'],
    },
  ],
  assignedProjects: [{ id: 3, name: 'Torre Norte' }],
};

beforeEach(() => apiMock.mockReset());

describe('getManualMarkContext', () => {
  it('GETs the context endpoint with userId and date', async () => {
    apiMock.mockResolvedValueOnce(CONTEXT);
    const result = await getManualMarkContext(7, '2026-07-01');
    expect(apiMock).toHaveBeenCalledWith('/api/v1/time-records/manual/context?userId=7&date=2026-07-01');
    expect(apiMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual(CONTEXT);
    expect(result.paidPeriod).toBe(true);
  });
});

describe('createManualRecord', () => {
  it('POSTs the full-day payload to /time-records/manual', async () => {
    apiMock.mockResolvedValueOnce({ id: 99 });
    const request = {
      userId: 7,
      projectId: 3,
      workDate: '2026-07-01',
      marks: [
        { type: 'CHECK_IN' as const, capturedAt: '2026-07-01T13:00:00.000Z' },
        { type: 'CHECK_OUT' as const, capturedAt: '2026-07-01T22:00:00.000Z' },
      ],
    };
    await createManualRecord(request);
    expect(apiMock).toHaveBeenCalledWith('/api/v1/time-records/manual', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  });
});

describe('addManualMarks', () => {
  it('POSTs the marks to the record-scoped manual endpoint', async () => {
    apiMock.mockResolvedValueOnce({ id: 42 });
    const marks = [{ type: 'CHECK_OUT' as const, capturedAt: '2026-07-01T22:00:00.000Z' }];
    await addManualMarks(42, marks);
    expect(apiMock).toHaveBeenCalledWith('/api/v1/time-records/42/events/manual', {
      method: 'POST',
      body: JSON.stringify({ marks }),
    });
  });

  it('propagates API errors to the caller (modal shows the backend message)', async () => {
    apiMock.mockRejectedValueOnce(new Error('El registro ya tiene una marca de CHECK_OUT.'));
    await expect(addManualMarks(42, [{ type: 'CHECK_OUT', capturedAt: 'x' }]))
      .rejects.toThrow('El registro ya tiene una marca de CHECK_OUT.');
  });
});
