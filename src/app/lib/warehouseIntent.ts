import i18n from '../../i18n';
import { ApiError, getSessionMeta, getStoredTenantSlug } from './api';
import { beginWarehouseSession, WAREHOUSE_SESSION } from './warehouseSession';

export interface WarehouseIntent<T> { key: string; payload: T; state: 'pending' | 'confirmed' | 'refused'; }
export function warehouseScope(): string {
  const user = getSessionMeta();
  if (!user) return '';
  const tenant = (getStoredTenantSlug() ?? 'default').toLowerCase();
  let session = JSON.parse(localStorage.getItem(WAREHOUSE_SESSION) ?? 'null');
  if (!session || session.tenant !== tenant || session.username !== user.username) {
    session = beginWarehouseSession(tenant, user.username);
  }
  return JSON.stringify([tenant, user.username, session.epoch]);
}
// Keyed by account (tenant + username), not by login epoch: an unknown outcome
// must survive a logout or an expired session and reach the next login of the
// same account, or the same delivery gets recorded twice. The epoch in the
// scope still retires tabs drawn under an older login.
export function intentSlot(scope: string, operation: string) {
  const account = scope ? JSON.stringify((JSON.parse(scope) as string[]).slice(0, 2)) : '';
  return `bt.warehouse.intent.v1:${account}:${operation}`;
}
export function readIntent<T>(slot: string): WarehouseIntent<T> | null {
  const raw = localStorage.getItem(slot);
  if (!raw) return null;
  const record = JSON.parse(raw);
  if (!record.key || !record.payload || !['pending', 'confirmed', 'refused'].includes(record.state)) {
    throw new Error(i18n.t('inventory:consumables.intent.corrupt'));
  }
  return record;
}
// Web Locks serializes tabs before the journal is created. Fail closed when
// storage or locking is unavailable: a non-durable request must never be sent.
export async function sendIntent<T>(scope: string, operation: string, payload: T, send: (intent: WarehouseIntent<T>) => Promise<void>) {
  if (!navigator.locks) throw new Error(i18n.t('inventory:consumables.intent.lockUnavailable'));
  const slot = intentSlot(scope, operation);
  return navigator.locks.request(slot, async () => {
    if (!scope || warehouseScope() !== scope) throw new Error(i18n.t('inventory:consumables.intent.sessionChanged'));
    let intent = readIntent<T>(slot);
    if (intent && intent.state !== 'pending') return intent;
    const previousAttempt = !!intent;
    intent ??= { key: crypto.randomUUID(), payload, state: 'pending' };
    localStorage.setItem(slot, JSON.stringify(intent));
    try { await send(intent); }
    catch (err) {
      // A refusal on the first attempt is certain. After an attempt with an
      // unknown outcome, only answers that prove that attempt was never
      // applied may settle it; anything else keeps it pending.
      const refused = err instanceof ApiError
        && (previousAttempt ? provesNeverApplied(err) : [400, 403, 404, 409, 422].includes(err.status));
      if (refused) localStorage.setItem(slot, JSON.stringify({ ...intent, state: 'refused' }));
      throw err;
    }
    const confirmed: WarehouseIntent<T> = { ...intent, state: 'confirmed' };
    localStorage.setItem(slot, JSON.stringify(confirmed));
    return confirmed;
  });
}
// The server looks the request key up before it decides on stock, the project,
// the people or the budget line, and answers a retry of an applied key with the
// original response. A retry refused with one of these was therefore never
// applied, nor was the attempt before it; a validation refusal (400/422) of the
// same stored payload would have refused that attempt too. Conflicts on the
// key, permissions, 5xx and lost answers prove nothing (WarehouseServiceImpl
// dispatchConsumable / restockConsumable).
const NEVER_APPLIED = new Set([
  'INSUFFICIENT_STOCK', 'PROJECT_CLOSED',
  'CONSUMABLE_NOT_FOUND', 'PROJECT_NOT_FOUND', 'WORKER_NOT_FOUND', 'BUDGET_LINE_ITEM_NOT_FOUND',
]);
function provesNeverApplied(err: ApiError) {
  if (err.status === 400 || err.status === 422) return true;
  return (err.status === 404 || err.status === 409) && NEVER_APPLIED.has(err.code ?? '');
}
export async function newIntent(slot: string, confirmedKey: string) {
  if (!navigator.locks) throw new Error(i18n.t('inventory:consumables.intent.lockUnavailable'));
  return navigator.locks.request(slot, () => {
    // A stale tab cannot clear a different or unresolved movement.
    const current = readIntent(slot);
    if (current && current.state !== 'pending' && current.key === confirmedKey) localStorage.removeItem(slot);
  });
}
