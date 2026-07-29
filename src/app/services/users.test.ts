import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/api', () => ({
  api: vi.fn(),
}));

import { api } from '../lib/api';
import {
  getWorkerQr,
  regenerateWorkerQr,
  setWorkerPin,
  type WorkerQrDTO,
} from './users';

const apiMock = vi.mocked(api);

const SAMPLE: WorkerQrDTO = {
  qrToken: 'signed.qr.token',
  username: 'jdoe',
  tenant: 'acme',
  hasPin: true,
};

describe('getWorkerQr', () => {
  beforeEach(() => apiMock.mockReset());

  it('GETs the worker QR endpoint and returns the DTO', async () => {
    apiMock.mockResolvedValueOnce(SAMPLE);

    const result = await getWorkerQr(42);

    expect(apiMock).toHaveBeenCalledWith('/api/v1/admin/users/42/qr');
    expect(apiMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual(SAMPLE);
  });
});

describe('regenerateWorkerQr', () => {
  beforeEach(() => apiMock.mockReset());

  it('POSTs to the regenerate endpoint and returns the new DTO', async () => {
    const fresh = { ...SAMPLE, qrToken: 'new.qr.token' };
    apiMock.mockResolvedValueOnce(fresh);

    const result = await regenerateWorkerQr(7);

    expect(apiMock).toHaveBeenCalledWith('/api/v1/admin/users/7/qr/regenerate', {
      method: 'POST',
    });
    expect(result.qrToken).toBe('new.qr.token');
  });
});

describe('setWorkerPin', () => {
  beforeEach(() => apiMock.mockReset());

  it('POSTs the PIN as a JSON body to the pin endpoint', async () => {
    apiMock.mockResolvedValueOnce(undefined);

    await setWorkerPin(13, '123456');

    expect(apiMock).toHaveBeenCalledWith('/api/v1/admin/users/13/pin', {
      method: 'POST',
      body: JSON.stringify({ pin: '123456' }),
    });

    const [, options] = apiMock.mock.calls[0];
    expect(JSON.parse(String(options!.body))).toEqual({ pin: '123456' });
  });
});
