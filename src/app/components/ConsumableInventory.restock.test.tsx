// AUD-049 — the older warehouse inventory screen restocks with a quantity and
// an intention key too; it never writes `currentStock + quantity` computed
// from its own (possibly stale) list.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const svc = vi.hoisted(() => ({
  listConsumables: vi.fn(),
  restockConsumable: vi.fn(),
  updateConsumable: vi.fn(),
  createConsumable: vi.fn(),
  getConsumableDispatches: vi.fn(),
}));
vi.mock('../services/warehouse', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/warehouse')>()),
  ...svc,
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import i18n from '../../i18n';
import { ConsumableInventory } from './ConsumableInventory';
import { buttonByText, click, consumable, flush, type } from './tools/testing';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('ConsumableInventory restock', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(async () => { await i18n.changeLanguage('es'); });

  beforeEach(() => {
    vi.clearAllMocks();
    svc.listConsumables.mockResolvedValue([consumable({ id: 7, code: 'CS-001', name: 'Cemento', currentStock: 10 })]);
    svc.restockConsumable.mockResolvedValue(consumable({ id: 7, code: 'CS-001', name: 'Cemento', currentStock: 12 }));
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('sends the quantity with an intention key instead of an absolute stock', async () => {
    await act(async () => { root.render(<ConsumableInventory />); });
    await flush();
    click(Array.from(document.body.querySelectorAll('button')).find(b => b.textContent?.trim() === i18n.t('inventory:consumables.restock')));
    await flush();
    const quantity = document.body.querySelector<HTMLInputElement>('[role="dialog"] input[type="number"]')!;
    type(quantity, '5');
    const dialog = document.body.querySelector('[role="dialog"]')!;
    click(buttonByText(dialog, i18n.t('inventory:consumables.restock')));
    await flush();

    expect(svc.updateConsumable).not.toHaveBeenCalled();
    expect(svc.restockConsumable).toHaveBeenCalledTimes(1);
    const [id, sent, key] = svc.restockConsumable.mock.calls[0];
    expect(id).toBe(7);
    expect(sent).toBe(5);
    expect(key).toMatch(/^[A-Za-z0-9._:-]{1,64}$/);
  });
});
