import '../../lib/warehouseIntent.testing';
// AUD-049 — the restock sends a quantity, never a stock computed from this
// screen, and one restock intention keeps one key across a retry whose first
// answer was lost (so the server never adds it twice).

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const svc = vi.hoisted(() => ({ listConsumables: vi.fn(), getConsumableDispatches: vi.fn(), restockConsumable: vi.fn(), updateConsumable: vi.fn() }));
vi.mock('../../services/warehouse', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/warehouse')>()),
  ...svc,
}));

import i18n from '../../../i18n';
import { ApiError, NoResponseError } from '../../lib/api';
import { ConsumableWarehouseWindow } from './ConsumableWarehouseWindow';
import { buttonByText, click, consumable, flush, type } from './testing';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const STALE = consumable({ id: 7, code: 'CS-001', name: 'Cemento', currentStock: 10, unit: 'sacos', stockVersion: 4 });

describe('ConsumableWarehouseWindow restock', () => {
  let container: HTMLDivElement;
  let root: Root;
  const onSaved = vi.fn();

  beforeAll(async () => { await i18n.changeLanguage('es'); });

  beforeEach(() => {
    vi.clearAllMocks();
    svc.getConsumableDispatches.mockResolvedValue([]);
    svc.listConsumables.mockResolvedValue([STALE]);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function mount() {
    await act(async () => {
      root.render(<ConsumableWarehouseWindow consumable={STALE} onClose={vi.fn()} onSaved={onSaved} onEdit={vi.fn()} onMinimum={vi.fn()} />);
    });
    await flush();
  }

  const input = () => document.body.querySelector<HTMLInputElement>('#warehouse-restock')!;
  const restockButton = () => buttonByText(document.body, i18n.t('inventory:consumables.restock'))!;

  it('sends the quantity, not the stale stock plus the quantity', async () => {
    svc.restockConsumable.mockResolvedValue({ ...STALE, currentStock: 12, stockVersion: 6 });
    await mount();
    type(input(), '5');
    click(restockButton());
    await flush();

    expect(svc.updateConsumable).not.toHaveBeenCalled();
    expect(svc.restockConsumable).toHaveBeenCalledTimes(1);
    const [id, quantity, key] = svc.restockConsumable.mock.calls[0];
    expect(id).toBe(7);
    expect(quantity).toBe(5); // never 15 = 10 (stale) + 5
    expect(key).toMatch(/^[A-Za-z0-9._:-]{1,64}$/);
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ currentStock: 12 }));
  });

  it('retries a lost answer with the same key, and a new quantity with a new one', async () => {
    svc.restockConsumable
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ ...STALE, currentStock: 15 })
      .mockResolvedValueOnce({ ...STALE, currentStock: 22 });
    await mount();
    type(input(), '5');
    click(restockButton());
    await flush();
    expect(document.body.querySelector('[role="alert"]')).not.toBeNull();

    click(buttonByText(document.body, i18n.t('inventory:consumables.intent.reconcile'))!); // persisted retry
    await flush();
    const [, , first] = svc.restockConsumable.mock.calls[0];
    const [, , retry] = svc.restockConsumable.mock.calls[1];
    expect(retry).toBe(first);

    click(buttonByText(document.body, i18n.t('inventory:consumables.intent.newRestock'))!); await flush();
    type(input(), '7'); // a new intention
    click(restockButton());
    await flush();
    const [, quantity, next] = svc.restockConsumable.mock.calls[2];
    expect(quantity).toBe(7);
    expect(next).not.toBe(first);
  });

  it('starts a new intention after a definitive refusal', async () => {
    svc.restockConsumable
      .mockRejectedValueOnce(new ApiError(400, 'La cantidad no es válida', undefined, 'INVALID_QUANTITY'))
      .mockResolvedValueOnce({ ...STALE, currentStock: 15 });
    await mount();
    type(input(), '5');
    click(restockButton());
    await flush();
    click(buttonByText(document.body, i18n.t('inventory:consumables.intent.newRestock'))!); await flush();
    type(input(), '5'); click(restockButton());
    await flush();
    expect(svc.restockConsumable.mock.calls[1][2]).not.toBe(svc.restockConsumable.mock.calls[0][2]);
  });

  it('does not offer fractions of a unit', async () => {
    await mount();
    type(input(), '2.5');
    expect(restockButton().disabled).toBe(true);
    type(input(), '0');
    expect(restockButton().disabled).toBe(true);
    type(input(), '3');
    expect(restockButton().disabled).toBe(false);
  });
  it('recovers an unknown intention after unmount with the exact payload and prevents editing it', async () => {
    svc.restockConsumable.mockRejectedValueOnce(new Error('lost after commit')).mockResolvedValueOnce({ ...STALE, currentStock: 15 });
    await mount(); type(input(), '5'); click(restockButton()); await flush();
    const original = svc.restockConsumable.mock.calls[0];
    act(() => root.unmount()); root = createRoot(container); await mount();
    expect(input().value).toBe('5'); expect(input().disabled).toBe(true);
    expect(document.body.textContent).toContain(original[2]);
    click(buttonByText(document.body, i18n.t('inventory:consumables.intent.reconcile'))!); await flush();
    expect(svc.restockConsumable.mock.calls[1]).toEqual(original);
  });

  // B2 (audit 2026-10-28): the same lock as the dispatch, per supply.
  it('frees the window when the retry of an unknown restock is refused', async () => {
    svc.restockConsumable
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new ApiError(400, 'La cantidad no es válida', undefined, 'INVALID_QUANTITY'))
      .mockResolvedValueOnce({ ...STALE, currentStock: 13 });
    await mount(); type(input(), '5'); click(restockButton()); await flush();
    click(buttonByText(document.body, i18n.t('inventory:consumables.intent.reconcile'))!); await flush();
    expect(document.body.textContent).toContain(i18n.t('inventory:consumables.intent.refused'));
    click(buttonByText(document.body, i18n.t('inventory:consumables.intent.newRestock'))!); await flush();
    type(input(), '3'); click(restockButton()); await flush();
    expect(svc.restockConsumable).toHaveBeenCalledTimes(3);
    expect(svc.restockConsumable.mock.calls[2][2]).not.toBe(svc.restockConsumable.mock.calls[0][2]);
  });

  // D6 (audit 2026-10-28): the browser's own English words, not the reader's language.
  it('says the connection failed in the reader\'s language', async () => {
    svc.restockConsumable.mockRejectedValueOnce(new NoResponseError(true, new DOMException('signal is aborted without reason', 'AbortError')));
    await mount(); type(input(), '5'); click(restockButton()); await flush();
    expect(document.body.querySelector('[role="alert"]')?.textContent).toBe(i18n.t('common:error.network'));
  });

  it('hides the old account intention when another tab changes the login', async () => {
    svc.restockConsumable.mockRejectedValue(new Error('lost'));
    await mount(); type(input(), '5'); click(restockButton()); await flush();
    const key = svc.restockConsumable.mock.calls[0][2];
    document.cookie = `ofjr_session=${encodeURIComponent(JSON.stringify({ role: 'WAREHOUSE', username: 'other' }))}; Path=/`;
    await act(async () => window.dispatchEvent(new StorageEvent('storage')));
    expect(document.body.textContent).not.toContain(key);
    expect(document.body.textContent).toContain(i18n.t('inventory:consumables.intent.sessionChanged'));
    expect(svc.restockConsumable).toHaveBeenCalledTimes(1);
  });

});
