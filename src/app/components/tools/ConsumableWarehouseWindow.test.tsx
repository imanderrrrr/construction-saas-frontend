// AUD-049 — the restock sends a quantity, never a stock computed from this
// screen, and one restock intention keeps one key across a retry whose first
// answer was lost (so the server never adds it twice).

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const svc = vi.hoisted(() => ({ getConsumableDispatches: vi.fn(), restockConsumable: vi.fn(), updateConsumable: vi.fn() }));
vi.mock('../../services/warehouse', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/warehouse')>()),
  ...svc,
}));

import i18n from '../../../i18n';
import { ApiError } from '../../lib/api';
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

    click(restockButton()); // the same intention, retried
    await flush();
    const [, , first] = svc.restockConsumable.mock.calls[0];
    const [, , retry] = svc.restockConsumable.mock.calls[1];
    expect(retry).toBe(first);

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
    click(restockButton());
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
});
