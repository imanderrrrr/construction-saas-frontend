// D9 (audit 2026-10-28): the server refuses a duplicate tool code with
// 409 TOOL_CODE_EXISTS and a localized sentence. The form looked for "code" and
// "exist" in that sentence, which neither language contains, so a duplicate
// always came back as "could not save, try again".
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const svc = vi.hoisted(() => ({ createTool: vi.fn(), updateTool: vi.fn(), getAdminTools: vi.fn() }));
vi.mock('../../services/warehouse', async original => ({ ...await original<typeof import('../../services/warehouse')>(), ...svc }));

import i18n from '../../../i18n';
import { ApiError } from '../../lib/api';
import { ToolFormModal } from './ToolFormModal';
import { buttonByText, click, flush, page, type } from './testing';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.clearAllMocks();
  svc.getAdminTools.mockResolvedValue(page([]));
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

it.each([
  ['es', 'Este código de herramienta ya está en uso.'],
  ['en', 'This tool code is already in use.'],
])('names the code field when the server refuses a duplicate code (%s)', async (lang, serverMessage) => {
  await i18n.changeLanguage(lang);
  svc.createTool.mockRejectedValue(new ApiError(409, serverMessage, undefined, 'TOOL_CODE_EXISTS'));
  await act(async () => { root.render(<ToolFormModal open tool={null} onOpenChange={vi.fn()} onSaved={vi.fn()} />); });
  await flush();
  type(document.body.querySelector<HTMLInputElement>('#tool-code')!, 'her-10');
  type(document.body.querySelector<HTMLInputElement>('#tool-name')!, 'Taladro');
  click(buttonByText(document.body, i18n.t('tools:form.submit.new'))!);
  await flush();

  expect(svc.createTool).toHaveBeenCalledWith(expect.objectContaining({ code: 'HER-10' }));
  expect(document.body.textContent).toContain(i18n.t('tools:form.code.taken'));
  expect(document.body.textContent).not.toContain(i18n.t('tools:form.err.server'));
});

it('keeps the generic message for failures that are not a duplicate', async () => {
  await i18n.changeLanguage('es');
  svc.createTool.mockRejectedValue(new ApiError(500, 'Error interno', undefined, 'INTERNAL_ERROR'));
  await act(async () => { root.render(<ToolFormModal open tool={null} onOpenChange={vi.fn()} onSaved={vi.fn()} />); });
  await flush();
  type(document.body.querySelector<HTMLInputElement>('#tool-code')!, 'HER-11');
  type(document.body.querySelector<HTMLInputElement>('#tool-name')!, 'Taladro');
  click(buttonByText(document.body, i18n.t('tools:form.submit.new'))!);
  await flush();

  expect(document.body.textContent).toContain(i18n.t('tools:form.err.server'));
  expect(document.body.textContent).not.toContain(i18n.t('tools:form.code.taken'));
});
