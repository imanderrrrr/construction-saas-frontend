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
export function intentSlot(scope: string, operation: string) { return `bt.warehouse.intent.v1:${scope}:${operation}`; }
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
      // A refusal on the first attempt is certain. Once any attempt has an
      // unknown outcome, a later 4xx cannot prove that earlier attempt failed.
      if (!previousAttempt && err instanceof ApiError && [400, 403, 404, 409, 422].includes(err.status)) {
        localStorage.setItem(slot, JSON.stringify({ ...intent, state: 'refused' }));
      }
      throw err;
    }
    const confirmed: WarehouseIntent<T> = { ...intent, state: 'confirmed' };
    localStorage.setItem(slot, JSON.stringify(confirmed));
    return confirmed;
  });
}
export async function newIntent(slot: string, confirmedKey: string) {
  if (!navigator.locks) throw new Error(i18n.t('inventory:consumables.intent.lockUnavailable'));
  return navigator.locks.request(slot, () => {
    // A stale tab cannot clear a different or unresolved movement.
    const current = readIntent(slot);
    if (current && current.state !== 'pending' && current.key === confirmedKey) localStorage.removeItem(slot);
  });
}
