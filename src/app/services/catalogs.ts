// Every option of the pickers and filters that used to stop at the server's
// first page (AUD-055). Each loader walks the pages through `drainCatalog`
// and reports `truncated` if it ever had to stop at the safety bound.

import { drainCatalog, type Catalog } from '../lib/catalog';
import { AuthService } from './auth';
import { listClients } from './clients';
import { listFinanceProjects, listProjects, type ProjectResponse, type ProjectStatus } from './projects';
import { listUsers, type UserDTO } from './users';
import { listTools, listWarehouseProjects, type ToolResponse, type WarehouseProjectResponse } from './warehouse';

type ClientRow = Awaited<ReturnType<typeof listClients>>['content'][number];

/**
 * Projects of the tenant, optionally of one status. FINANCE reads them from
 * its own endpoint (the admin one answers 403 to it); everyone else from the
 * admin endpoint. Closed projects are included unless a status is asked for:
 * history and finance still need them.
 */
export function projectCatalog(opts: { status?: ProjectStatus; role?: string | null } = {}): Promise<Catalog<ProjectResponse>> {
  const role = opts.role ?? AuthService.getCanonicalRole?.() ?? AuthService.getRole?.();
  return drainCatalog((page, size) => (role === 'FINANCE'
    ? listFinanceProjects({ status: opts.status, page, size })
    : listProjects({ status: opts.status, page, size })));
}

/** Users of the tenant, of every status unless one is asked for (people who left still have history). */
export function userCatalog(opts: { role?: string; status?: string } = {}): Promise<Catalog<UserDTO>> {
  return drainCatalog((page, size) => listUsers({ role: opts.role, status: opts.status, page, size }));
}

export function clientCatalog(status?: string): Promise<Catalog<ClientRow>> {
  return drainCatalog((page, size) => listClients(undefined, status, page, size));
}

export function warehouseProjectCatalog(status?: WarehouseProjectResponse['status']): Promise<Catalog<WarehouseProjectResponse>> {
  return drainCatalog((page, size) => listWarehouseProjects({ status, page, size }));
}

export function toolCatalog(opts: { status?: string } = {}): Promise<Catalog<ToolResponse>> {
  return drainCatalog((page, size) => listTools({ status: opts.status, page, size }));
}
