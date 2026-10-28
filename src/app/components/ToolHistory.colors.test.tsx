// D10 (audit 2026-10-28): history rows carry the action's enum name, the colour
// maps were keyed by the old display names, and every badge fell back to grey.
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';

const svc = vi.hoisted(() => ({ listTools: vi.fn(), getGlobalToolHistory: vi.fn() }));
const users = vi.hoisted(() => ({ listUsers: vi.fn() }));
vi.mock('../services/warehouse', async (importOriginal) => ({ ...(await importOriginal<typeof import('../services/warehouse')>()), ...svc }));
vi.mock('../services/users', async (importOriginal) => ({ ...(await importOriginal<typeof import('../services/users')>()), ...users }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import i18n from '../../i18n';
import { ToolHistory } from './ToolHistory';
import { actionName } from './tools/bits';
import { flush, page } from './tools/testing';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: Root;
const entry = (id: number, actionId: string) => ({ id, date: '2026-10-28', time: '10:00', action: actionId, actionId,
  worker: 'Ana', project: 'Obra', toolCode: `T-${id}`, toolName: 'Taladro', notes: null });

beforeAll(async () => { await i18n.changeLanguage('es'); });
beforeEach(() => {
  svc.listTools.mockResolvedValue(page([]));
  users.listUsers.mockResolvedValue(page([]));
  svc.getGlobalToolHistory.mockResolvedValue(page([entry(1, 'REGISTERED'), entry(2, 'ACCEPTED'), entry(3, 'LOST'), entry(4, 'RETURNED'), entry(5, 'RECOVERED')]));
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

it('colours each action by its enum name instead of falling back to grey', async () => {
  await act(async () => { root.render(<ToolHistory />); });
  await flush();
  const t = i18n.getFixedT('es', 'tools');
  const badge = (id: string) => Array.from(container.querySelectorAll('span')).find(s => s.textContent === actionName(t, id))!;
  expect(badge('REGISTERED').className).toContain('text-emerald-700');
  expect(badge('ACCEPTED').className).toContain('text-[#F97316]');
  expect(badge('LOST').className).toContain('text-red-600');
  expect(badge('RETURNED').className).toContain('text-amber-700');
  expect(badge('RECOVERED').className).toContain('text-emerald-700');
  for (const id of ['REGISTERED', 'ACCEPTED', 'LOST', 'RETURNED', 'RECOVERED']) expect(badge(id).className).not.toContain('text-[#8A8175]');
});
