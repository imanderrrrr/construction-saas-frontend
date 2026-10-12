// AUD-055 — Tareas took one page of 100 for the whole list. The server orders
// by due date with the undated last, so past 100 tasks the "no dates" group
// silently lost its rows; the project and person filters read one page too.
// With 230 tasks, 230 projects and 230 people, every one of them must be there.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const svc = vi.hoisted(() => ({
  listTasks: vi.fn(),
  listSupervisorTasks: vi.fn(),
  getTasksSummary: vi.fn(),
  getSupervisorTasksSummary: vi.fn(),
  getTask: vi.fn(),
  getSupervisorTask: vi.fn(),
}));
const users = vi.hoisted(() => ({ listUsers: vi.fn() }));
const http = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock('../../services/tasks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/tasks')>()),
  ...svc,
}));
vi.mock('../../services/users', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/users')>()),
  ...users,
}));
vi.mock('../../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/api')>()),
  api: (...args: unknown[]) => http.api(...args),
}));
vi.mock('./TaskWindow', () => ({ TaskWindow: () => null }));

import i18n from '../../../i18n';
import { TasksSection } from './TasksSection';
import type { TaskResponse, TaskSummary } from '../../services/tasks';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const N = 230;
const today = new Date();
const inDays = (delta: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function task(id: number, over: Partial<TaskResponse> = {}): TaskResponse {
  return {
    id, title: `Tarea ${id}`, projectId: 1, projectName: 'Obra 001', description: null,
    status: 'TODO', priority: 'MEDIUM', assignedToId: null, assignedToName: null,
    startDate: null, dueDate: id <= 200 ? inDays(3) : null, sortOrder: 0, createdById: 1, createdByName: 'Ander',
    createdAt: '2026-08-25T07:55:00Z', updatedAt: '2026-08-25T07:55:00Z',
    stepSince: '2026-08-25T07:55:00Z', commentCount: 0, photoCount: 0, documentCount: 0, historyCount: 1,
    ...over,
  };
}

// Dated first, undated last: the server's order.
const TASKS = Array.from({ length: N }, (_, i) => task(i + 1));
const PROJECTS = Array.from({ length: N }, (_, i) => ({ id: i + 1, name: `Obra ${String(i + 1).padStart(3, '0')}`, status: 'ACTIVE' }));
const PEOPLE = Array.from({ length: N }, (_, i) => ({
  id: i + 1, username: `persona${i + 1}`, fullName: `Persona ${String(i + 1).padStart(3, '0')}`, role: 'WORKER', status: 'ACTIVE', updatedAt: '',
}));
const SUMMARY: TaskSummary = {
  open: N, overdue: 0, dueToday: 0, thisWeek: 200, noDates: 30, unassigned: N, closedThisWeek: 0,
  openByProject: {}, openByAssignee: {},
};

/** A server that caps every page at 100 rows, whatever was asked for. */
function slice<T>(rows: T[], page = 0, size = 20) {
  const s = Math.min(size, 100);
  return { content: rows.slice(page * s, page * s + s), page, size: s, totalElements: rows.length, totalPages: Math.ceil(rows.length / s) };
}

describe('TasksSection — volumes past the server page', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => i18n.changeLanguage('es'));

  beforeEach(() => {
    vi.clearAllMocks();
    svc.listTasks.mockImplementation(async (q: { page?: number; size?: number } = {}) => slice(TASKS, q.page, q.size ?? 100));
    svc.getTasksSummary.mockResolvedValue(SUMMARY);
    users.listUsers.mockImplementation(async (q: { page?: number; size?: number } = {}) => slice(PEOPLE, q.page, q.size));
    http.api.mockImplementation(async (path: string) => {
      if (path.startsWith('/api/v1/admin/projects')) {
        const q = new URLSearchParams(path.split('?')[1] ?? '');
        return slice(PROJECTS, Number(q.get('page') ?? 0), Number(q.get('size') ?? 20));
      }
      if (path.startsWith('/api/v1/auth/me')) return { username: 'ander', fullName: 'Ander' };
      throw new Error(`Unexpected request: ${path}`);
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  const render = async () => {
    await act(async () => root.render(<TasksSection />));
    for (let i = 0; i < 4; i += 1) await act(async () => { await new Promise(r => setTimeout(r, 0)); });
  };

  const options = (label: string) =>
    Array.from(container.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)?.options ?? []).map(o => o.value);

  it('keeps the undated tasks that sort after the first hundred', async () => {
    await render();
    const undated = container.querySelector('[data-testid="task-group-noDates"]');
    expect(undated).not.toBeNull();
    expect(container.querySelector('[data-testid="task-row-230"]')).not.toBeNull();
    expect(container.querySelectorAll('[data-testid^="task-row-"]').length).toBe(N);
  });

  it('offers the 230th project and the 230th person in the filters', async () => {
    await render();
    expect(options(i18n.t('tasks:filter.projects'))).toContain(String(N));
    expect(options(i18n.t('tasks:filter.person'))).toContain(String(N));
  });

  it('ignores the late list of a filter already changed', async () => {
    let releaseAll: (() => void) | undefined;
    svc.listTasks.mockImplementation((q: { status?: string; page?: number; size?: number } = {}) => {
      if (q.status === 'REVIEW') return Promise.resolve(slice([task(7, { status: 'REVIEW' })], q.page, q.size ?? 100));
      return new Promise(resolve => { releaseAll = () => resolve(slice(TASKS, q.page, q.size ?? 100)); });
    });
    await render();
    const step = container.querySelector<HTMLSelectElement>(`select[aria-label="${i18n.t('tasks:filter.step')}"]`)!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(step, 'REVIEW');
      step.dispatchEvent(new Event('change', { bubbles: true }));
    });
    for (let i = 0; i < 3; i += 1) await act(async () => { await new Promise(r => setTimeout(r, 0)); });
    await act(async () => { releaseAll?.(); });
    for (let i = 0; i < 3; i += 1) await act(async () => { await new Promise(r => setTimeout(r, 0)); });
    expect(container.querySelectorAll('[data-testid^="task-row-"]').length).toBe(1);
    expect(container.querySelector('[data-testid="task-row-7"]')).not.toBeNull();
  });
});
