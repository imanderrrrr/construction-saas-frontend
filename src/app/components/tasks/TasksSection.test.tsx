// The section, and the four things the kanban could not do: land on every
// project at once, tell you what is overdue when nothing is, move a task
// without dragging it, and ask before the one step that has no way back.

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
  moveTask: vi.fn(),
  supervisorMoveTask: vi.fn(),
  updateTask: vi.fn(),
  unassignTask: vi.fn(),
  deleteTask: vi.fn(),
}));
vi.mock('../../services/tasks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/tasks')>()),
  ...svc,
}));
vi.mock('../../services/users', () => ({
  listUsers: vi.fn().mockResolvedValue({
    content: [
      { id: 11, username: 'anibal', fullName: 'Aníbal Pérez', role: 'SUPERVISOR', status: 'ACTIVE', updatedAt: '' },
      { id: 12, username: 'marisol', fullName: 'Marisol Tzoc', role: 'SUPERVISOR', status: 'ACTIVE', updatedAt: '' },
    ],
    totalElements: 2, totalPages: 1, number: 0, size: 20,
  }),
}));
vi.mock('../../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/api')>()),
  api: vi.fn().mockResolvedValue({ content: [{ id: 1, name: 'Torre Zona 14' }, { id: 2, name: 'San Cristóbal' }] }),
}));
// The window has its own suite; here it is a landmark.
vi.mock('./TaskWindow', () => ({
  TaskWindow: (p: { open: boolean; task: { title: string } | null }) =>
    p.open && p.task ? <div data-testid="task-window">{p.task.title}</div> : null,
}));

import i18n from '../../../i18n';
import { TasksSection } from './TasksSection';
import type { TaskResponse, TaskSummary } from '../../services/tasks';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const today = new Date();
const iso = (delta: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function task(over: Partial<TaskResponse> & { id: number; title: string }): TaskResponse {
  return {
    projectId: 1, projectName: 'Torre Zona 14', description: null,
    status: 'TODO', priority: 'MEDIUM', assignedToId: null, assignedToName: null,
    startDate: null, dueDate: null, sortOrder: 0, createdById: 1, createdByName: 'Ander',
    createdAt: '2026-08-25T07:55:00Z', updatedAt: '2026-08-25T07:55:00Z',
    stepSince: '2026-08-25T07:55:00Z', commentCount: 0, photoCount: 0, documentCount: 0, historyCount: 1,
    ...over,
  };
}

const SUMMARY: TaskSummary = {
  open: 9, overdue: 2, dueToday: 1, thisWeek: 5, noDates: 1, unassigned: 1, closedThisWeek: 7,
  openByProject: { '1': 4, '2': 5 }, openByAssignee: { '11': 2 },
};

const page = (content: TaskResponse[]) => ({ content, page: 0, size: 100, totalElements: content.length, totalPages: 1 });

const THREE = [
  task({ id: 1, title: 'Muro perimetral', status: 'REVIEW', dueDate: iso(-2), assignedToId: 11, assignedToName: 'Aníbal Pérez' }),
  task({ id: 2, title: 'Impermeabilización', status: 'IN_PROGRESS', dueDate: iso(0) }),
  task({ id: 3, title: 'Armado de columnas', dueDate: iso(4) }),
];

describe('TasksSection', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => i18n.changeLanguage('es'));

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    Object.values(svc).forEach(fn => fn.mockReset());
    svc.listTasks.mockResolvedValue(page(THREE));
    svc.listSupervisorTasks.mockResolvedValue(page(THREE));
    svc.getTasksSummary.mockResolvedValue(SUMMARY);
    svc.getSupervisorTasksSummary.mockResolvedValue(SUMMARY);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  const render = async (supervisor = false) => {
    await act(async () => root.render(<TasksSection supervisor={supervisor} />));
    await act(async () => { await new Promise(r => setTimeout(r, 0)); });
  };

  const byText = (text: string | RegExp) =>
    Array.from(container.querySelectorAll<HTMLElement>('*')).find(el =>
      el.children.length === 0 && (typeof text === 'string' ? el.textContent?.trim() === text : text.test(el.textContent ?? '')));

  it('lands on every project at once — no picker to get past first', async () => {
    await render();
    expect(svc.listTasks).toHaveBeenCalledWith(expect.not.objectContaining({ projectId: expect.anything() }));
    expect(container.querySelector('[data-testid="task-list"]')).toBeTruthy();
  });

  it('groups by urgency, not by step', async () => {
    await render();
    expect(container.querySelector('[data-testid="task-group-overdue"]')?.textContent).toContain('Muro perimetral');
    expect(container.querySelector('[data-testid="task-group-today"]')?.textContent).toContain('Impermeabilización');
    expect(container.querySelector('[data-testid="task-group-week"]')?.textContent).toContain('Armado de columnas');
  });

  it('draws Overdue and Due today at zero, and hides the empty rest', async () => {
    svc.listTasks.mockResolvedValue(page([task({ id: 9, title: 'Sola', dueDate: iso(3) })]));
    await render();
    expect(container.querySelector('[data-testid="task-group-overdue"]')?.textContent).toContain('nada se pasó de fecha');
    expect(container.querySelector('[data-testid="task-group-today"]')?.textContent).toContain('hoy no vence nada');
    expect(container.querySelector('[data-testid="task-group-noDates"]')).toBeNull();
    expect(container.querySelector('[data-testid="task-group-closed"]')).toBeNull();
  });

  it('counts the tenant in the header, never the rows on screen', async () => {
    await render();
    // Three rows are loaded; the header still says nine open.
    expect(container.textContent).toContain('9 abiertas');
    expect(container.textContent).toContain('2 vencidas');
    expect(container.textContent).toContain('7 cerradas, fuera de la cuenta');
  });

  it('says so when the figures fail, instead of adding up the page', async () => {
    svc.getTasksSummary.mockRejectedValue(new Error('boom'));
    await render();
    expect(container.textContent).toContain('Las cifras no cargaron');
    expect(container.textContent).not.toContain('3 abiertas');
  });

  it('moves a task with a button named after the next step', async () => {
    await render();
    const row = container.querySelector('[data-testid="task-row-3"]')!;
    const button = Array.from(row.querySelectorAll('button')).find(b => b.textContent?.includes('En progreso'))!;
    expect(button).toBeTruthy();
    svc.moveTask.mockResolvedValue(task({ id: 3, title: 'Armado de columnas', status: 'IN_PROGRESS', dueDate: iso(4) }));
    await act(async () => { button.click(); });
    expect(svc.moveTask).toHaveBeenCalledWith(3, { status: 'IN_PROGRESS' });
  });

  it('asks before the only step with no way back, and not before the others', async () => {
    await render();
    // Review → Completed opens the confirmation instead of moving.
    const row = container.querySelector('[data-testid="task-row-1"]')!;
    const button = Array.from(row.querySelectorAll('button')).find(b => b.textContent?.includes('Completado'))!;
    await act(async () => { button.click(); });
    expect(svc.moveTask).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('¿Cerrar esta tarea?');
  });

  it('says in the row itself when an action fails, and offers to retry', async () => {
    await render();
    svc.moveTask.mockRejectedValue(new Error('nope'));
    const row = container.querySelector('[data-testid="task-row-3"]')!;
    const button = Array.from(row.querySelectorAll('button')).find(b => b.textContent?.includes('En progreso'))!;
    await act(async () => { button.click(); });
    const after = container.querySelector('[data-testid="task-row-3"]')!;
    expect(after.textContent).toContain('No se pudo mover');
    expect(Array.from(after.querySelectorAll('button')).some(b => b.textContent?.includes('Reintentar'))).toBe(true);
  });

  it('gives the supervisor the same list without the admin\'s hands', async () => {
    await render(true);
    expect(svc.listSupervisorTasks).toHaveBeenCalled();
    expect(svc.listTasks).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Tu parte del día');
    // No creating, and the unowned row offers no "Assign".
    expect(Array.from(container.querySelectorAll('button')).some(b => b.textContent?.trim() === 'Nueva tarea')).toBe(false);
    const unowned = container.querySelector('[data-testid="task-row-2"]')!;
    expect(Array.from(unowned.querySelectorAll('button')).some(b => b.textContent?.includes('Asignar'))).toBe(false);
    expect(unowned.textContent).toContain('Sin asignar');
  });

  it('holds a moved row where it was drawn, and says where it went', async () => {
    await render();
    // Advancing this one to Review does not change its group; moving the
    // overdue one to Completed does — and that is the case that matters.
    svc.moveTask.mockResolvedValue(task({ id: 3, title: 'Armado de columnas', status: 'IN_PROGRESS', dueDate: iso(-1) }));
    const row = container.querySelector('[data-testid="task-row-3"]')!;
    const button = Array.from(row.querySelectorAll('button')).find(b => b.textContent?.includes('En progreso'))!;
    await act(async () => { button.click(); });

    // It stays in "Esta semana", where the reader last saw it…
    expect(container.querySelector('[data-testid="task-group-week"]')?.textContent).toContain('Armado de columnas');
    expect(container.querySelector('[data-testid="task-group-overdue"]')?.textContent).not.toContain('Armado de columnas');
    // …and says where it now belongs.
    expect(container.querySelector('[data-testid="task-row-3"]')?.textContent).toContain('Pasa a Vencidas');
  });

  it('sends the search to the server rather than filtering what is on screen', async () => {
    await render();
    const input = container.querySelector<HTMLInputElement>('[data-tasks-search]')!;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    await act(async () => {
      setter.call(input, 'muro');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => { await new Promise(r => setTimeout(r, 420)); });
    expect(svc.listTasks).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'muro' }));
  });

  it('offers no way back up the ladder', async () => {
    await render();
    // Nothing on the screen names a step that comes before the current one.
    expect(byText('Por hacer ▸')).toBeUndefined();
    expect(container.textContent).not.toMatch(/reabrir/i);
  });
});
