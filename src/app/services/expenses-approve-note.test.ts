import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/api', () => ({
  api: vi.fn(),
  apiMultipart: vi.fn(),
  getBaseUrl: () => '',
}));

import { api } from '../lib/api';
import { approveExpense, observeExpense } from './expenses';

const apiMock = vi.mocked(api);

/**
 * The approve dialog has always had a note textarea, but `approveExpense` sent
 * no body, so the note was dropped on submit. These pin the wire contract on
 * this side of the boundary; `ExpenseApproveNoteEndpointTest` pins the other.
 */
describe('approveExpense — optional note', () => {
  beforeEach(() => apiMock.mockReset());

  it('sends the note as a JSON comment when the reviewer typed one', async () => {
    apiMock.mockResolvedValueOnce({});

    await approveExpense(42, 'admin', 'Verified against PO-4471');

    expect(apiMock).toHaveBeenCalledWith('/api/v1/admin/expenses/42/approve', {
      method: 'PUT',
      body: JSON.stringify({ comment: 'Verified against PO-4471' }),
    });
  });

  it('trims the note before sending', async () => {
    apiMock.mockResolvedValueOnce({});

    await approveExpense(42, 'admin', '  Verified against PO-4471  ');

    expect(apiMock).toHaveBeenCalledWith('/api/v1/admin/expenses/42/approve', {
      method: 'PUT',
      body: JSON.stringify({ comment: 'Verified against PO-4471' }),
    });
  });

  it('sends NO body when the note is omitted', async () => {
    apiMock.mockResolvedValueOnce({});

    await approveExpense(42, 'admin');

    expect(apiMock).toHaveBeenCalledWith('/api/v1/admin/expenses/42/approve', { method: 'PUT' });
  });

  it('sends NO body when the textarea was left blank', async () => {
    apiMock.mockResolvedValueOnce({});

    // The dialog passes its state straight through, so an untouched textarea
    // arrives as '' — that must not become `{"comment":""}`.
    await approveExpense(42, 'admin', '   ');

    expect(apiMock).toHaveBeenCalledWith('/api/v1/admin/expenses/42/approve', { method: 'PUT' });
  });

  it('routes to the supervisor endpoint for supervisors', async () => {
    apiMock.mockResolvedValueOnce({});

    await approveExpense(7, 'supervisor', 'Checked on site');

    expect(apiMock).toHaveBeenCalledWith('/api/v1/supervisor/expenses/7/approve', {
      method: 'PUT',
      body: JSON.stringify({ comment: 'Checked on site' }),
    });
  });

  it('leaves the observe contract untouched (its comment stays required)', async () => {
    apiMock.mockResolvedValueOnce({});

    await observeExpense(42, 'Missing the receipt', 'admin');

    expect(apiMock).toHaveBeenCalledWith('/api/v1/admin/expenses/42/observe', {
      method: 'PUT',
      body: JSON.stringify({ comment: 'Missing the receipt' }),
    });
  });
});
