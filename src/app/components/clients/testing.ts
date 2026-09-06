// Shared fixtures and DOM helpers of the Clientes suites.

import { act } from 'react';
import type { ClientResponse } from '../../services/clients';
import type { ProjectResponse } from '../../services/projects';

export const ANDES: ClientResponse = {
  id: 7, name: 'Inmobiliaria Andes', rfc: '7204418-6', contact: 'Marisol Cano · Gerente de proyectos', phone: '2412 8890', email: 'pagos@inmoandes.gt',
  status: 'ACTIVE', activeProjectsCount: 3, completedProjectsCount: 5, createdAt: '2024-01-09T12:00:00Z', updatedAt: '2026-08-01T12:00:00Z',
};
export const SAN_RAFAEL: ClientResponse = {
  id: 8, name: 'Clínica San Rafael', rfc: '8821450-2', contact: 'Dra. Lucía Mejía · Administración', phone: '2331 7745', email: null,
  status: 'ACTIVE', activeProjectsCount: 1, completedProjectsCount: 0, createdAt: '2025-03-02T12:00:00Z', updatedAt: '2026-08-01T12:00:00Z',
};
export const MAJADAS: ClientResponse = {
  id: 9, name: 'Desarrollos Majadas', rfc: null, contact: null, phone: '4429 0071', email: 'info@majadas.com.gt',
  status: 'INACTIVE', activeProjectsCount: 0, completedProjectsCount: 4, createdAt: '2023-06-15T12:00:00Z', updatedAt: '2026-03-12T12:00:00Z',
};

export function project(over: Partial<ProjectResponse> & { id: number; name: string }): ProjectResponse {
  return {
    status: 'ACTIVE', clientId: 7, client: { id: 7, name: 'Inmobiliaria Andes' }, costCode: null,
    originalContractCents: null, changeOrdersTotalCents: 0, revisedContractCents: null, contractAmountCents: null,
    approvedExpensesCents: 0, totalConsumedCents: null, costBudgetCents: null, budgetBaseCents: null, remainingBudgetCents: null,
    invoicedCents: 0, collectedCents: 0, outstandingCents: 0, address: null, latitude: null, longitude: null, geofenceRadiusMeters: 200,
    assignedUserIds: [], createdAt: '2026-02-14T12:00:00Z', updatedAt: '2026-02-14T12:00:00Z',
    ...over,
  } as ProjectResponse;
}

export function page<T>(content: T[], totalElements = content.length, size = 20, pageNo = 0) {
  return { content, page: pageNo, size, totalElements, totalPages: Math.max(1, Math.ceil(totalElements / size)) };
}

export function type(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => {
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

export function select(el: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!;
  act(() => {
    setter.call(el, value);
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

export function click(el: Element | null | undefined) {
  if (!el) throw new Error('nothing to click');
  act(() => { (el as HTMLElement).click(); });
}

export async function flush(ms = 0) {
  await act(async () => { await new Promise(r => setTimeout(r, ms)); });
}

export function byText(root: ParentNode, text: string, selector = '*'): HTMLElement | undefined {
  return Array.from(root.querySelectorAll<HTMLElement>(selector)).find(el => el.textContent?.trim() === text);
}

export function buttonByText(root: ParentNode, text: string | RegExp): HTMLButtonElement | undefined {
  return Array.from(root.querySelectorAll('button')).find(b => typeof text === 'string' ? b.textContent?.trim() === text : text.test(b.textContent ?? ''));
}
