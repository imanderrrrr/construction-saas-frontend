// The two windows that write: fixing a status, and the form.
//
// Both carry a rule that is ours and not the API's — the server accepts an
// empty reason, and it lets the code through unchanged — so if these ever go
// quiet, the trace goes with them.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const svc = vi.hoisted(() => ({ changeToolStatus: vi.fn(), createTool: vi.fn(), updateTool: vi.fn(), getAdminTools: vi.fn() }));
vi.mock('../../services/warehouse', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/warehouse')>()),
  ...svc,
}));

import i18n from '../../../i18n';
import { statusName } from './bits';
import { FixStatusModal } from './FixStatusModal';
import { ToolFormModal } from './ToolFormModal';
import { buttonByText, click, flush, page, tool, type } from './testing';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const KEEPERS = [{ id: 9, username: 'sixcot', fullName: 'Sandra Ixcot' }];
const AVAILABLE = tool({ id: 3, code: 'HT-002', name: 'Juego de llaves Stanley', category: 'Hand Tools', status: 'Available' });
const OUT = tool({ id: 2, code: 'PT-021', name: 'Sierra circular Makita 5007', status: 'Assigned', assignedTo: 'Byron Chávez', assignedToId: 44 });

describe('the windows that write', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(async () => { await i18n.changeLanguage('es'); });

  beforeEach(() => {
    vi.clearAllMocks();
    svc.getAdminTools.mockResolvedValue(page([]));
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  describe('FixStatusModal', () => {
    async function mount(t = AVAILABLE, onFixed = vi.fn()) {
      await act(async () => {
        root.render(<FixStatusModal open onOpenChange={vi.fn()} tool={t} lang="es" keepers={KEEPERS} onFixed={onFixed} />);
      });
      await flush();
      return onFixed;
    }

    it('offers only the paths that exist from the current status', async () => {
      await mount();
      const options = Array.from(document.body.querySelectorAll<HTMLInputElement>('input[type="radio"]')).map(r => r.value);
      expect(options).toEqual(['In Review', 'Damaged', 'Lost']);
      // Not greyed out among six: the impossible ones are simply not drawn.
      expect(document.body.textContent).not.toContain(statusName(i18n.getFixedT('es', 'tools'), 'Assigned'));
    });

    it('will not send without a reason of at least five characters', async () => {
      const onFixed = await mount();
      const submit = buttonByText(document.body, i18n.t('tools:fixStatus.submit'))!;
      expect(submit.disabled).toBe(true);

      click(document.body.querySelector('input[value="Damaged"]'));
      expect(buttonByText(document.body, i18n.t('tools:fixStatus.submit'))!.disabled).toBe(true);

      type(document.body.querySelector<HTMLTextAreaElement>('textarea')!, 'roto');
      expect(buttonByText(document.body, i18n.t('tools:fixStatus.submit'))!.disabled).toBe(true);

      type(document.body.querySelector<HTMLTextAreaElement>('textarea')!, 'Se cayó del andamio');
      const ready = buttonByText(document.body, i18n.t('tools:fixStatus.submit'))!;
      expect(ready.disabled).toBe(false);

      svc.changeToolStatus.mockResolvedValue({ ...AVAILABLE, status: 'Damaged' });
      click(ready);
      await flush();
      expect(svc.changeToolStatus).toHaveBeenCalledWith(3, { newStatus: 'Damaged', reason: 'Se cayó del andamio' });
      expect(onFixed).toHaveBeenCalled();
    });

    it('blocks the whole window while the tool is out, and names who can unblock it', async () => {
      await mount(OUT);

      expect(document.body.querySelectorAll('input[type="radio"]').length).toBe(0);
      expect(document.body.textContent).toContain(i18n.t('tools:fixStatus.blocked.title'));
      expect(document.body.textContent).toContain('Byron Chávez');
      expect(document.body.textContent).toContain(i18n.t('tools:whoCan'));
      expect(document.body.textContent).toContain('Sandra Ixcot');
      expect(buttonByText(document.body, i18n.t('tools:fixStatus.submit'))).toBeUndefined();
    });

    it('says so when the company has no warehouse user at all', async () => {
      await act(async () => {
        root.render(<FixStatusModal open onOpenChange={vi.fn()} tool={OUT} lang="es" keepers={[]} onGoUsers={vi.fn()} onFixed={vi.fn()} />);
      });
      await flush();
      expect(document.body.textContent).toContain(i18n.t('tools:whoCan.none'));
      expect(buttonByText(document.body, i18n.t('tools:whoCan.goUsers'))).toBeTruthy();
    });
  });

  describe('ToolFormModal', () => {
    it('registers with the typed code, upper-cased, and no status to choose', async () => {
      const onSaved = vi.fn();
      await act(async () => { root.render(<ToolFormModal open onOpenChange={vi.fn()} tool={null} onSaved={onSaved} />); });
      await flush();

      const inputs = Array.from(document.body.querySelectorAll('input'));
      type(inputs[0], 'pt-099');
      type(inputs[1], 'Pulidora Dewalt');
      svc.createTool.mockResolvedValue(tool({ id: 9, code: 'PT-099', name: 'Pulidora Dewalt' }));
      click(buttonByText(document.body, i18n.t('tools:form.submit.new')));
      await flush();

      expect(svc.createTool).toHaveBeenCalledWith(expect.objectContaining({ code: 'PT-099', name: 'Pulidora Dewalt' }));
      expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: 9 }), 'create');
    });

    it('will not change the code when editing: it is on the label and in the history', async () => {
      await act(async () => { root.render(<ToolFormModal open onOpenChange={vi.fn()} tool={OUT} onSaved={vi.fn()} />); });
      await flush();

      const code = Array.from(document.body.querySelectorAll('input')).find(i => i.value === 'PT-021');
      expect(code === undefined || code.disabled || code.readOnly).toBe(true);
      expect(document.body.textContent).toContain('PT-021');

      svc.updateTool.mockResolvedValue({ ...OUT, name: 'Sierra circular Makita' });
      const name = Array.from(document.body.querySelectorAll('input')).find(i => i.value.startsWith('Sierra'))!;
      type(name, 'Sierra circular Makita');
      click(buttonByText(document.body, i18n.t('tools:form.submit.edit')));
      await flush();
      expect(svc.updateTool).toHaveBeenCalledWith(2, expect.objectContaining({ name: 'Sierra circular Makita' }));
      // No status field: editing a tool never moves it.
      expect(svc.changeToolStatus).not.toHaveBeenCalled();
    });
  });
});
