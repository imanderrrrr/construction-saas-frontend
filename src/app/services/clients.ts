import { api } from '../lib/api';

// Types

export interface ClientResponse {
    id: number;
    name: string;
    rfc: string | null;
    contact: string | null;
    phone: string | null;
    email: string | null;
    status: 'ACTIVE' | 'INACTIVE';
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

export interface CreateClientPayload {
    name: string;
    phone: string;
    email?: string;
}

export interface UpdateClientPayload {
    name?: string;
    phone?: string;
    email?: string;
    status?: 'ACTIVE' | 'INACTIVE';
}

// API calls

const BASE = '/api/v1/admin/clients';

export async function listClients(
    search?: string,
    status?: string,
    page = 0,
    size = 50,
): Promise<ClientsPage> {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    params.set('page', String(page));
    params.set('size', String(size));
    return api<ClientsPage>(`${BASE}?${params.toString()}`);
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
