import './warehouseIntent.testing';
import { describe, expect, it, vi } from 'vitest';
import i18n from '../../i18n';
import { ApiError, clearSessionCookie } from './api';
import { beginWarehouseSession } from './warehouseSession';
import { intentSlot, newIntent, readIntent, sendIntent, warehouseScope } from './warehouseIntent';

describe('durable warehouse journal', () => {
  it('persists the same payload and key after module reload and ignores edited quantities', async () => {
    const scope = warehouseScope(); const slot = intentSlot(scope, 'restock:7');
    const send = vi.fn().mockRejectedValueOnce(new TypeError('lost after commit')).mockResolvedValue(undefined);
    await expect(sendIntent(scope, 'restock:7', { quantity: 5 }, send)).rejects.toThrow();
    const original = readIntent(slot);
    vi.resetModules();
    const reloaded = await import('./warehouseIntent');
    await reloaded.sendIntent(scope, 'restock:7', { quantity: 900 }, send);
    expect(send.mock.calls[1][0]).toEqual(original);
    expect(readIntent(slot)?.state).toBe('confirmed');
    await reloaded.sendIntent(scope, 'restock:7', { quantity: 5 }, send);
    expect(send).toHaveBeenCalledTimes(2); // confirmed tombstone blocks stale tabs
    await newIntent(slot, original!.key);
    await reloaded.sendIntent(scope, 'restock:7', { quantity: 5 }, send);
    expect(send.mock.calls[2][0].key).not.toBe(original!.key);
  });
  it('serializes concurrent repetitions into one movement', async () => {
    const scope = warehouseScope(); const send = vi.fn().mockResolvedValue(undefined);
    await Promise.all([sendIntent(scope, 'dispatch', ['CS', 5], send), sendIntent(scope, 'dispatch', ['CS', 5], send)]);
    expect(send).toHaveBeenCalledTimes(1);
  });
  it('never deletes unknown intent on a later refusal or a stale reset', async () => {
    const scope = warehouseScope(); const slot = intentSlot(scope, 'restock:7');
    await expect(sendIntent(scope, 'restock:7', { quantity: 5 }, async () => { throw new Error('lost'); })).rejects.toThrow();
    const key = readIntent(slot)!.key;
    await expect(sendIntent(scope, 'restock:7', { quantity: 9 }, async () => { throw new ApiError(409, 'conflict'); })).rejects.toThrow();
    await newIntent(slot, key);
    expect(readIntent(slot)).toMatchObject({ key, state: 'pending', payload: { quantity: 5 } });
  });
  it('isolates article, operation, account and tenant', async () => {
    const scope = warehouseScope();
    await expect(sendIntent(scope, 'restock:7', { quantity: 5 }, async () => { throw new Error('lost'); })).rejects.toThrow();
    expect(readIntent(intentSlot(scope, 'restock:8'))).toBeNull();
    expect(readIntent(intentSlot(scope, 'dispatch'))).toBeNull();
    document.cookie = 'bt_tenant=test-b; Path=/';
    expect(readIntent(intentSlot(warehouseScope(), 'restock:7'))).toBeNull();
    document.cookie = `ofjr_session=${encodeURIComponent(JSON.stringify({ role: 'WAREHOUSE', username: 'other' }))}; Path=/`;
    const other = warehouseScope(); expect(other).not.toBe(scope);
    expect(readIntent(intentSlot(other, 'restock:7'))).toBeNull();
    const send = vi.fn(); await expect(sendIntent(scope, 'restock:7', { quantity: 5 }, send)).rejects.toThrow(i18n.t('inventory:consumables.intent.sessionChanged'));
    expect(send).not.toHaveBeenCalled();
  });
  // B1 (audit 2026-10-28): every login starts a new epoch, and the journal was
  // keyed by it — so logging out, or coming back the next day, hid the unknown
  // movement and let the same delivery be recorded again under a new key.
  it('keeps an unknown movement for the same account across logout and a later login', async () => {
    const scope = warehouseScope();
    await expect(sendIntent(scope, 'dispatch', ['CS', 4], async () => { throw new TypeError('lost after commit'); })).rejects.toThrow();
    const key = readIntent(intentSlot(scope, 'dispatch'))!.key;
    clearSessionCookie(); // logout, or a refresh that failed
    document.cookie = `ofjr_session=${encodeURIComponent(JSON.stringify({ role: 'WAREHOUSE', username: 'keeper' }))}; Path=/`;
    beginWarehouseSession('test-a', 'keeper'); // what a new login does
    const next = warehouseScope();
    expect(next).not.toBe(scope); // a tab drawn under the previous login is still retired
    expect(readIntent(intentSlot(next, 'dispatch'))).toMatchObject({ key, state: 'pending', payload: ['CS', 4] });
    const send = vi.fn().mockResolvedValue(undefined);
    await sendIntent(next, 'dispatch', ['CS', 9], send);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({ key, payload: ['CS', 4] });
  });
  // B2 (audit 2026-10-28): the server looks the request key up before it checks
  // stock, the project or the people, and replays the original answer when the
  // key was applied. These answers to a retry therefore prove the earlier,
  // unknown attempt was never applied; leaving the intention pending locked the
  // form for good.
  it.each([
    [409, 'INSUFFICIENT_STOCK'], [409, 'PROJECT_CLOSED'],
    [404, 'CONSUMABLE_NOT_FOUND'], [404, 'PROJECT_NOT_FOUND'], [404, 'WORKER_NOT_FOUND'], [404, 'BUDGET_LINE_ITEM_NOT_FOUND'],
    [400, 'VALIDATION_ERROR'], [400, 'INVALID_QUANTITY'], [422, undefined],
  ])('settles a retried movement as refused on %i %s', async (status, code) => {
    const scope = warehouseScope(); const slot = intentSlot(scope, 'dispatch');
    await expect(sendIntent(scope, 'dispatch', ['CS', 10], async () => { throw new TypeError('lost'); })).rejects.toThrow();
    await expect(sendIntent(scope, 'dispatch', ['CS', 10], async () => { throw new ApiError(status, 'refused', undefined, code); })).rejects.toThrow('refused');
    expect(readIntent(slot)?.state).toBe('refused');
  });
  it.each([
    [409, 'IDEMPOTENCY_KEY_CONFLICT'], [409, 'CONFLICT'], [409, 'CONCURRENT_UPDATE'], [409, undefined],
    [404, undefined], [403, 'TENANT_MISSING'], [401, undefined], [429, 'RATE_LIMITED'], [500, 'INTERNAL_ERROR'], [503, 'NETWORK_ERROR'],
  ])('keeps a retried movement pending on %i %s, which cannot prove it was never applied', async (status, code) => {
    const scope = warehouseScope(); const slot = intentSlot(scope, 'dispatch');
    await expect(sendIntent(scope, 'dispatch', ['CS', 10], async () => { throw new TypeError('lost'); })).rejects.toThrow();
    const key = readIntent(slot)!.key;
    await expect(sendIntent(scope, 'dispatch', ['CS', 10], async () => { throw new ApiError(status, 'unclear', undefined, code); })).rejects.toThrow('unclear');
    expect(readIntent(slot)).toMatchObject({ key, state: 'pending' });
  });
  it('sends nothing if durable storage fails', async () => {
    const scope = warehouseScope(); const send = vi.fn();
    // On the object's own prototype: jsdom stores an own `setItem` assignment as an item instead of
    // replacing the method, and Node's native storage (Node 22+) is not jsdom's `Storage`.
    const spy = vi.spyOn(Object.getPrototypeOf(localStorage) as Storage, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    await expect(sendIntent(scope, 'restock:7', { quantity: 5 }, send)).rejects.toThrow('quota');
    spy.mockRestore(); expect(send).not.toHaveBeenCalled();
  });
  it('a delayed reset of a previous confirmation cannot erase a new unknown movement', async () => {
    const scope = warehouseScope(); const slot = intentSlot(scope, 'restock:7');
    const previous = await sendIntent(scope, 'restock:7', { quantity: 5 }, async () => {});
    await newIntent(slot, previous.key);
    let started!: () => void; let fail!: (error: Error) => void;
    const entered = new Promise<void>(resolve => { started = resolve; });
    const sending = sendIntent(scope, 'restock:7', { quantity: 2 }, async () => {
      started(); await new Promise<void>((_resolve, reject) => { fail = reject; });
    });
    const refused = expect(sending).rejects.toThrow('lost');
    await entered;
    const staleReset = newIntent(slot, previous.key);
    fail(new Error('lost')); await refused; await staleReset;
    expect(readIntent(slot)).toMatchObject({ state: 'pending', payload: { quantity: 2 } });
    expect(readIntent(slot)?.key).not.toBe(previous.key);
  });

});
