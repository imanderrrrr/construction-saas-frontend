import { platformApi } from '../lib/platformApi';
import type { Page, PlatformLead } from '../types';

/** Contacts left on the public landing, newest first. Every read is recorded in the platform audit log. */
export async function listLeads(page = 0, size = 25): Promise<Page<PlatformLead>> {
  return platformApi<Page<PlatformLead>>(`/platform/leads?page=${page}&size=${size}`);
}

/** Deletes one contact for good (OWNER only); the deletion is audited. */
export async function deleteLead(id: number): Promise<void> {
  await platformApi<void>(`/platform/leads/${id}`, { method: 'DELETE' });
}
