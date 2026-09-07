// Shared fixtures and DOM helpers of the Herramientas suites.

import { act } from 'react';
import type { ConsumableResponse, ToolResponse } from '../../services/warehouse';

export function tool(over: Partial<ToolResponse> & { id: number; code: string; name: string }): ToolResponse {
  return {
    category: 'Power Tools', status: 'Available', assignedTo: null, assignedToId: null, projectName: null,
    dateRegistered: '2026-03-03T12:00:00Z', lastActivityAt: '2026-09-05T22:40:00Z', notes: null, zone: null,
    lastActivity: null, history: [],
    ...over,
  } as ToolResponse;
}

export function consumable(over: Partial<ConsumableResponse> & { id: number; code: string; name: string }): ConsumableResponse {
  return {
    category: 'General', unit: 'unidades', currentStock: 40, minimumStock: 12, status: 'In Stock',
    lastRestocked: '2026-09-01T12:00:00Z',
    ...over,
  } as ConsumableResponse;
}

export const SUMMARY = {
  total: 214, available: 96, assigned: 74, pendingAcceptance: 14, inReview: 18, damaged: 8, lost: 4,
};

export const CONSUMABLE_SUMMARY = { total: 62, inStock: 41, lowStock: 15, outOfStock: 6 };

export function page<T>(content: T[], totalElements = content.length, size = 20, pageNo = 0) {
  return { content, page: pageNo, size, totalElements, totalPages: Math.max(1, Math.ceil(totalElements / size)) };
}

export function type(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')!.set!;
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
