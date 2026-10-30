// BuildTrack — MyHours server paging.
//
// The screen used to download every record of the chosen period and page it
// in the browser. It now asks the server for one page of ten at a time
// (GET /worker/time-records/page) and keeps the same table, the same
// pagination control and the same "N records" line — that number is the
// period's total, not the page's. These tests pin what the switch must not
// break: the totals, page changes, a late answer for an earlier page, a page
// past the end, and a failed load with its retry. Same harness as
// MyExpenses.loadError.test.tsx.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// One stable `t`, as react-i18next gives: MyHours refetches when `t` changes.
const translation = {
  t: (key: string, opts?: { count?: number }) => (opts?.count !== undefined ? `${key}:${opts.count}` : key),
  i18n: { language: 'en' },
};
vi.mock('react-i18next', () => ({
  useTranslation: () => translation,
  Trans: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

const getMyRecordsPage = vi.fn();
const getMyWorkerSummary = vi.fn();
vi.mock('../services/time', () => ({
  getMyRecordsPage: (...a: unknown[]) => getMyRecordsPage(...a),
  getMyWorkerSummary: (...a: unknown[]) => getMyWorkerSummary(...a),
}));

import { MyHours } from './MyHours';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function flush() {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

function record(id: number, workDate: string) {
  return {
    id,
    workerId: 7,
    workerUsername: 'maria',
    workerName: 'María',
    projectId: 1,
    projectName: `Obra ${id}`,
    workDate,
    approvalStatus: 'APPROVED',
    isLate: false,
    pendingEventCount: 0,
    events: [
      { id: id * 10, type: 'CHECK_IN', capturedAtClient: `${workDate}T13:00:00Z`, eventApprovalStatus: 'APPROVED' },
      { id: id * 10 + 1, type: 'CHECK_OUT', capturedAtClient: `${workDate}T21:00:00Z`, eventApprovalStatus: 'APPROVED' },
    ],
    reviews: [],
  };
}

/** Page [page] (0-based) of a 23-record period, ten per page. */
function serverPage(page: number, total = 23) {
  const first = page * 10;
  const content = Array.from({ length: Math.max(0, Math.min(10, total - first)) }, (_, i) => {
    const n = first + i + 1;
    return record(n, `2026-09-${String(30 - Math.floor(n / 2)).padStart(2, '0')}`);
  });
  return { content, page, size: 10, totalElements: total, totalPages: Math.ceil(total / 10) };
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}

describe('MyHours — server paging', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    getMyWorkerSummary.mockResolvedValue({
      hoursThisWeek: 16, approvedHoursThisWeek: 16, pendingApprovals: 0, lateArrivalsThisWeek: 0, daysWorkedThisWeek: 2,
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  async function render() {
    await act(async () => { root.render(<MyHours />); });
    await flush();
  }

  /** Project names of the rendered desktop rows. */
  function rowNames(): string[] {
    return Array.from(container.querySelectorAll('tbody tr td:nth-child(3) span')).map(el => el.textContent ?? '');
  }

  function pageButton(label: string): HTMLButtonElement {
    const button = Array.from(container.querySelectorAll('button')).find(b => b.textContent === label);
    if (!button) throw new Error(`no button "${label}"`);
    return button as HTMLButtonElement;
  }

  it('asks for the first page of ten and reports the period total, not the page size', async () => {
    getMyRecordsPage.mockImplementation(({ page }: { page: number }) => Promise.resolve(serverPage(page)));
    await render();

    expect(getMyRecordsPage).toHaveBeenCalledTimes(1);
    expect(getMyRecordsPage.mock.calls[0][0]).toMatchObject({ page: 0, size: 10 });
    expect(getMyRecordsPage.mock.calls[0][0].dateFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(rowNames()).toHaveLength(10);
    expect(container.textContent).toContain('myHours.recordsFound:23');
    // Same control as before: one button per page.
    expect(pageButton('3')).toBeTruthy();
  });

  it('fetches the chosen page and shows only its rows', async () => {
    getMyRecordsPage.mockImplementation(({ page }: { page: number }) => Promise.resolve(serverPage(page)));
    await render();

    await act(async () => { pageButton('3').click(); });
    await flush();

    expect(getMyRecordsPage).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, size: 10 }));
    expect(rowNames()).toEqual(['Obra 21', 'Obra 22', 'Obra 23']);
    expect(container.textContent).toContain('myHours.recordsFound:23');
  });

  it('ignores a late answer for a page the worker already left', async () => {
    getMyRecordsPage.mockImplementation(({ page }: { page: number }) => Promise.resolve(serverPage(page)));
    await render();

    // Page 2 is requested and stays in flight…
    const slowPage2 = deferred<ReturnType<typeof serverPage>>();
    getMyRecordsPage.mockImplementationOnce(() => slowPage2.promise);
    await act(async () => { pageButton('2').click(); });
    // …while Apply sends the worker back to page 1, which answers at once.
    await act(async () => { pageButton('buttons.apply').click(); });
    await flush();
    expect(rowNames()[0]).toBe('Obra 1');

    // Page 2's answer arrives late: it must not replace the page on screen.
    await act(async () => { slowPage2.resolve(serverPage(1)); });
    await flush();
    expect(rowNames()[0]).toBe('Obra 1');
    expect(rowNames()).not.toContain('Obra 11');
  });

  it('moves a page past the end to the last page that exists', async () => {
    getMyRecordsPage.mockImplementation(({ page }: { page: number }) => Promise.resolve(serverPage(page, 23)));
    await render();
    await act(async () => { pageButton('3').click(); });
    await flush();

    // The period shrinks to 12 records while the worker sits on page 3.
    getMyRecordsPage.mockImplementation(({ page }: { page: number }) => Promise.resolve(serverPage(page, 12)));
    await act(async () => { pageButton('buttons.refresh').click(); });
    await flush();
    await flush();

    expect(getMyRecordsPage).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }));
    expect(rowNames()).toEqual(['Obra 11', 'Obra 12']);
    expect(container.textContent).not.toContain('myHours.empty');
  });

  it('shows the error with a retry instead of an empty list, and recovers', async () => {
    getMyRecordsPage.mockRejectedValueOnce(new Error('boom'));
    getMyRecordsPage.mockImplementation(({ page }: { page: number }) => Promise.resolve(serverPage(page)));
    await render();

    expect(container.textContent).toContain('boom');
    expect(container.textContent).not.toContain('myHours.empty');
    await act(async () => { pageButton('buttons.retry').click(); });
    await flush();

    expect(rowNames()).toHaveLength(10);
    expect(container.textContent).not.toContain('boom');
  });

  it('shows the empty state only when the whole period has no records', async () => {
    getMyRecordsPage.mockResolvedValue({ content: [], page: 0, size: 10, totalElements: 0, totalPages: 0 });
    await render();

    expect(container.textContent).toContain('myHours.empty');
    expect(container.textContent).toContain('myHours.recordsFound:0');
  });
});
