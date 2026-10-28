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
  it('isolates article, operation, account, tenant and subsequent login epochs', async () => {
    const scope = warehouseScope();
    await expect(sendIntent(scope, 'restock:7', { quantity: 5 }, async () => { throw new Error('lost'); })).rejects.toThrow();
    expect(readIntent(intentSlot(scope, 'restock:8'))).toBeNull();
    expect(readIntent(intentSlot(scope, 'dispatch'))).toBeNull();
    document.cookie = 'bt_tenant=test-b; Path=/';
    expect(readIntent(intentSlot(warehouseScope(), 'restock:7'))).toBeNull();
    document.cookie = `ofjr_session=${encodeURIComponent(JSON.stringify({ role: 'WAREHOUSE', username: 'other' }))}; Path=/`;
    const other = warehouseScope(); expect(other).not.toBe(scope);
    const send = vi.fn(); await expect(sendIntent(scope, 'restock:7', { quantity: 5 }, send)).rejects.toThrow(i18n.t('inventory:consumables.intent.sessionChanged'));
    expect(send).not.toHaveBeenCalled();
    clearSessionCookie(); beginWarehouseSession('test-a', 'keeper');
    document.cookie = 'bt_tenant=test-a; Path=/';
    document.cookie = `ofjr_session=${encodeURIComponent(JSON.stringify({ role: 'WAREHOUSE', username: 'keeper' }))}; Path=/`;
    expect(readIntent(intentSlot(warehouseScope(), 'restock:7'))).toBeNull();
    expect(readIntent(intentSlot(scope, 'restock:7'))?.state).toBe('pending');
  });
  it('sends nothing if durable storage fails', async () => {
    const scope = warehouseScope(); const send = vi.fn();
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('quota'); });
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
