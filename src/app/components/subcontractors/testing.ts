// Shared fixtures and DOM helpers of the Subcontratistas suites.

import { act } from 'react';
import type {
  EvidenceEntry, ObservationEntry, SubcontractorDirectoryRow,
  SubcontractorInvoiceDTO, SubcontractorJobDTO, SubcontractorsSummary, TimelineEntry,
} from '../../services/subcontractors';

export const SUMMARY: SubcontractorsSummary = {
  activeSubcontractors: 12,
  openJobs: 14,
  balanceDueCents: 2_855_000,
  totalJobs: 143,
  jobsInReview: 7,
  jobsOverdue: 5,
  invoicesToReview: 4,
  invoicesToPayCount: 9,
  invoicesToPayCents: 2_855_000,
  paidThisMonthCents: 4_120_000,
};

export const XELAJU: SubcontractorDirectoryRow = {
  subcontractorId: 21, fullName: 'Herrería y Estructuras Xelajú', username: 'herreria.xelaju',
  email: 'operaciones@herreriaxelaju.gt', status: 'ACTIVE',
  totalJobs: 6, openJobs: 4, overdueJobs: 1, invoicesToPay: 2, balanceCents: 1_840_000,
};

export const RUANO: SubcontractorDirectoryRow = {
  subcontractorId: 26, fullName: 'Cimentaciones Ruano', username: 'cruano', email: null, status: 'INACTIVE',
  totalJobs: 0, openJobs: 0, overdueJobs: 0, invoicesToPay: 0, balanceCents: 0,
};

export function job(over: Partial<SubcontractorJobDTO> & { id: number; title: string }): SubcontractorJobDTO {
  return {
    subcontractorId: 21, subcontractorName: 'Herrería Xelajú', projectId: 3, projectName: 'Torre Vista Hermosa',
    description: null, status: 'IN_REVIEW', agreedAmountCents: 840_000, dueDate: '2026-09-12',
    assignedAt: '2026-08-18T11:02:00Z', startedAt: null, submittedAt: null, approvedAt: null, closedAt: null,
    createdAt: '2026-08-18T11:02:00Z', updatedAt: '2026-09-04T16:58:00Z',
    evidenceCount: 6, observationCount: 3, isOverdue: false,
    ...over,
  };
}

export function invoice(over: Partial<SubcontractorInvoiceDTO> & { id: number }): SubcontractorInvoiceDTO {
  return {
    jobId: 418, jobTitle: 'Herrería de balcones · niveles 3 a 7', projectName: 'Torre Vista Hermosa',
    subcontractorId: 21, subcontractorName: 'Herrería Xelajú', amountCents: 840_000,
    invoiceNumber: 'F-2026-0418', description: null, status: 'SUBMITTED', hasFile: true, fileContentType: 'application/pdf',
    reviewerId: null, reviewerName: null, reviewerComment: null, reviewedAt: null, paidAt: null, paymentReference: null,
    createdAt: '2026-09-02T14:20:00Z', updatedAt: '2026-09-02T14:20:00Z',
    ...over,
  };
}

export function timelineEntry(over: Partial<TimelineEntry> & { id: number; action: string }): TimelineEntry {
  return {
    jobId: 418, actorId: 1, actorName: 'Anderson Rivas',
    fromStatus: null, toStatus: null, message: null, i18n: null,
    createdAt: '2026-09-04T16:58:00Z',
    ...over,
  };
}

export function evidence(over: Partial<EvidenceEntry> & { id: number }): EvidenceEntry {
  return {
    jobId: 418, uploaderId: 21, uploaderName: 'Marvin Xelajú', evidenceType: 'PROGRESS_PHOTO',
    contentType: 'image/jpeg', originalName: 'anclaje-nivel-4.jpg', description: null, i18n: null,
    createdAt: '2026-09-03T08:11:00Z',
    ...over,
  };
}

export function note(over: Partial<ObservationEntry> & { id: number; message: string }): ObservationEntry {
  return {
    authorId: 21, authorName: 'Marvin Xelajú', authorRole: 'SUBCONTRACTOR',
    createdAt: '2026-09-03T08:12:00Z',
    ...over,
  };
}

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
