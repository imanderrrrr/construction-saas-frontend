import { api } from '../lib/api';

// Types

export type ClientStatus = 'ACTIVE' | 'INACTIVE';

/** `WITH_ACTIVE` = at least one ACTIVE project; `NONE` = no projects at all. */
export type ClientProjectsFilter = 'WITH_ACTIVE' | 'NONE';

export interface ClientResponse {
    id: number;
    name: string;
    /** Tax id (NIT / RUC). Called `rfc` in the database by inheritance; never shown under that name. */
    rfc: string | null;
    contact: string | null;
    phone: string | null;
    email: string | null;
    status: ClientStatus;
    /** Projects in ACTIVE status. Absent on a backend that predates the contract → treated as 0. */
    activeProjectsCount: number;
    /** Projects in CLOSED status. */
    completedProjectsCount: number;
    createdAt: string;
    updatedAt: string;
}

export interface ClientsPage {
    content: ClientResponse[];
    page: number;
    size: number;
    totalElements: number;
    totalPages: number;
}

/** The three leading numbers of the list, counted over every client of the tenant. */
export interface ClientsSummary {
    total: number;
    active: number;
    withActiveProjects: number;
}

export interface CreateClientPayload {
    name: string;
    contact?: string;
    rfc?: string;
    phone?: string;
    email?: string;
}

/** A PATCH: omitted = leave alone; an empty string clears contact, rfc, phone or email. */
export interface UpdateClientPayload {
    name?: string;
    contact?: string;
    rfc?: string;
    phone?: string;
    email?: string;
    status?: ClientStatus;
}

// API calls

const BASE = '/api/v1/admin/clients';

/**
 * `search` matches name, contact, phone and email (case-insensitive) on the
 * server. `size` is capped at 100 by the backend.
 */
export async function listClients(
    search?: string,
    status?: string,
    page = 0,
    size = 50,
    projects?: ClientProjectsFilter,
): Promise<ClientsPage> {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    if (projects) params.set('projects', projects);
    params.set('page', String(page));
    params.set('size', String(size));
    return api<ClientsPage>(`${BASE}?${params.toString()}`);
}

export async function getClientsSummary(): Promise<ClientsSummary> {
    return api<ClientsSummary>(`${BASE}/summary`);
}

/** 404 `CLIENT_NOT_FOUND` when the id is not this tenant's. */
export async function getClient(id: number): Promise<ClientResponse> {
    return api<ClientResponse>(`${BASE}/${id}`);
}

export async function createClient(payload: CreateClientPayload): Promise<ClientResponse> {
    return api<ClientResponse>(BASE, {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export async function updateClient(id: number, payload: UpdateClientPayload): Promise<ClientResponse> {
    return api<ClientResponse>(`${BASE}/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
    });
}
