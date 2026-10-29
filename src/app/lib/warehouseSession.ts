// A login epoch is shared by tabs, survives reload, and is retired on logout.
// Pending journals are never deleted here: an unknown outcome is not a cancellation.
export const WAREHOUSE_SESSION = 'bt.warehouse.session.v1';
export function retireWarehouseSession() {
  try { localStorage.removeItem(WAREHOUSE_SESSION); } catch { /* Logout must still clear cookies if storage is unavailable. */ }
}
export function beginWarehouseSession(tenant: string, username: string) {
  const session = { tenant: tenant.trim().toLowerCase(), username, epoch: crypto.randomUUID() };
  localStorage.setItem(WAREHOUSE_SESSION, JSON.stringify(session));
  return session;
}
