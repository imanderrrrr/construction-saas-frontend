import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const svc = vi.hoisted(() => ({ createTool: vi.fn(), updateTool: vi.fn(), getAdminTools: vi.fn(), createConsumable: vi.fn(), updateConsumable: vi.fn() }));
vi.mock('../../services/warehouse', async original => ({ ...await original<typeof import('../../services/warehouse')>(), ...svc }));

import i18n from '../../../i18n';
import { ToolFormModal } from './ToolFormModal';
import { ConsumableFormModal } from './ConsumableModals';
import { buttonByText, click, consumable, flush, page, tool, type } from './testing';

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

it.each(['es', 'en'])('enforces 25 on tool creation and edit, with a visible %s error for legacy names', async lang => {
  await i18n.changeLanguage(lang);
  for (const editing of [false, true]) {
    const record = tool({ id: 1, code: 'NAME-25', name: 'X'.repeat(200) });
    const onSaved = vi.fn();
    await act(async () => { root.render(<ToolFormModal open tool={editing ? record : null} onOpenChange={vi.fn()} onSaved={onSaved} />); });
    await flush();
    const input = document.body.querySelector<HTMLInputElement>('#tool-name')!;
    expect(input.maxLength).toBe(25);
    if (editing) expect(input.value).toBe(record.name); // Never silently shorten stored names.
    else type(document.body.querySelector<HTMLInputElement>('#tool-code')!, record.code);
    const submit = buttonByText(document.body, i18n.t(editing ? 'tools:form.submit.edit' : 'tools:form.submit.new'))!;
    if (!editing) type(input, 'X'.repeat(26));
    click(submit);
    await flush();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(document.body.textContent).toContain(i18n.t('tools:name.tooLong', { max: 25 }));
    expect(svc.createTool).not.toHaveBeenCalled();
    expect(svc.updateTool).not.toHaveBeenCalled();

    type(input, 'Y'.repeat(25));
    type(document.body.querySelector<HTMLTextAreaElement>('#tool-notes')!, 'N'.repeat(500));
    const save = editing ? svc.updateTool : svc.createTool;
    save.mockResolvedValue({ ...record, name: 'Y'.repeat(25) });
    click(submit);
    await flush();
    const details = save.mock.calls[0][editing ? 1 : 0];
    expect(details).toMatchObject({ name: 'Y'.repeat(25), notes: 'N'.repeat(500) });
    expect(onSaved).toHaveBeenCalledOnce();
    vi.clearAllMocks();
  }
});

it.each(['es', 'en'])('enforces 25 on consumable creation and edit, with a visible %s error for legacy names', async lang => {
  await i18n.changeLanguage(lang);
  for (const editing of [false, true]) {
    const record = consumable({ id: 2, code: 'CS-25', name: 'X'.repeat(200) });
    const onSaved = vi.fn();
    await act(async () => { root.render(<ConsumableFormModal open warehouse consumable={editing ? record : null} onOpenChange={vi.fn()} onSaved={onSaved} />); });
    await flush();
    const input = document.body.querySelector<HTMLInputElement>('#cs-name')!;
    expect(input.maxLength).toBe(25);
    if (editing) expect(input.value).toBe(record.name);
    else {
      type(input, 'X'.repeat(26));
      type(document.body.querySelector<HTMLInputElement>('#cs-unit')!, 'ud');
    }
    const submit = buttonByText(document.body, i18n.t(editing ? 'inventory:consumables.dialog.saveChanges' : 'tools:form.submit.new'))!;
    click(submit);
    await flush();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(document.body.textContent).toContain(i18n.t('tools:name.tooLong', { max: 25 }));
    expect(svc.createConsumable).not.toHaveBeenCalled();
    expect(svc.updateConsumable).not.toHaveBeenCalled();

    type(input, 'Y'.repeat(25));
    type(document.body.querySelector<HTMLTextAreaElement>('#cs-notes')!, 'N'.repeat(500));
    const save = editing ? svc.updateConsumable : svc.createConsumable;
    save.mockResolvedValue({ ...record, name: 'Y'.repeat(25) });
    click(submit);
    await flush();
    const details = save.mock.calls[0][editing ? 1 : 0];
    expect(details).toMatchObject({ name: 'Y'.repeat(25), notes: 'N'.repeat(500) });
    expect(onSaved).toHaveBeenCalledOnce();
    vi.clearAllMocks();
  }
});
