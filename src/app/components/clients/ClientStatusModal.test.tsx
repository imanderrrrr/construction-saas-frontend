// Deactivate / reactivate (sheet 04): reversible, no name to type. A client
// with jobsites in progress is warned and listed, never blocked.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const svc = vi.hoisted(() => ({ updateClient: vi.fn(), listProjects: vi.fn() }));
vi.mock('../../services/clients', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/clients')>()),
  updateClient: svc.updateClient,
}));
vi.mock('../../services/projects', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/projects')>()),
  listProjects: svc.listProjects,
}));

import i18n from '../../../i18n';
import type { ClientResponse } from '../../services/clients';
import { ClientStatusModal } from './ClientStatusModal';
import { ANDES, MAJADAS, click, flush, page, project } from './testing';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('ClientStatusModal', () => {
  let container: HTMLDivElement;
  let root: Root;
  const onConfirmed = vi.fn();
  const onOpenChange = vi.fn();

  beforeAll(() => i18n.changeLanguage('es'));

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    onConfirmed.mockReset();
    onOpenChange.mockReset();
    svc.updateClient.mockReset();
    svc.listProjects.mockReset().mockResolvedValue(page([]));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  function render(client: ClientResponse) {
    act(() => { root.render(<ClientStatusModal open onOpenChange={onOpenChange} client={client} onConfirmed={onConfirmed} />); });
  }
  const confirmButton = () => document.querySelector<HTMLButtonElement>('[data-testid="client-status-confirm"]');

  it('deactivating a client without open jobsites lists what does not change', async () => {
    const majadasActive = { ...MAJADAS, status: 'ACTIVE' as const };
    svc.updateClient.mockResolvedValue({ ...majadasActive, status: 'INACTIVE' });
    render(majadasActive);
    expect(document.body.textContent).toContain('Clientes · desactivar');
    expect(document.body.textContent).toContain('Desactivar Desarrollos Majadas');
    expect(document.body.textContent).toContain('Dejará de aparecer al crear obras nuevas. Nada más cambia.');
    const lines = Array.from(document.querySelectorAll('[data-testid="client-status-consequences"] li')).map(li => li.textContent?.trim());
    expect(lines).toEqual([
      '·Sus 4 obras cerradas siguen igual, con él como cliente.',
      '·Sus facturas impresas no se tocan.',
      '·Puedes reactivarlo cuando quieras desde esta misma lista.',
    ]);
    expect(svc.listProjects).not.toHaveBeenCalled();
    expect(confirmButton()?.textContent).toBe('Desactivar');
    click(confirmButton());
    await flush();
    expect(svc.updateClient).toHaveBeenCalledWith(9, { status: 'INACTIVE' });
    expect(onConfirmed).toHaveBeenCalledWith(expect.objectContaining({ id: 9, status: 'INACTIVE' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('a client with jobsites in progress is warned, listed and asked to confirm "igual"', async () => {
    svc.listProjects.mockResolvedValue(page([
      project({ id: 1, name: 'Torre Vista Hermosa' }), project({ id: 2, name: 'Anexo Vista Hermosa II' }), project({ id: 3, name: 'Parqueo Andes Zona 10' }),
    ], 3));
    render(ANDES);
    await flush();
    expect(svc.listProjects).toHaveBeenCalledWith({ clientId: 7, status: 'ACTIVE', page: 0, size: 5 });
    const warning = document.querySelector('[data-testid="client-status-active"]');
    expect(warning?.textContent).toContain('Tiene 3 obras en curso');
    expect(document.body.textContent).toContain('Sus obras siguen igual; solo deja de aparecer al crear obras nuevas.');
    expect(warning?.textContent).toContain('Torre Vista Hermosa');
    expect(warning?.textContent).toContain('Parqueo Andes Zona 10');
    expect(document.querySelector('[data-testid="client-status-consequences"]')).toBeNull();
    expect(confirmButton()?.textContent).toBe('Desactivar igual');
  });

  it('reactivating says where the client comes back, with no date', async () => {
    svc.updateClient.mockResolvedValue({ ...MAJADAS, status: 'ACTIVE' });
    render(MAJADAS);
    expect(document.body.textContent).toContain('Clientes · reactivar');
    expect(document.body.textContent).toContain('Reactivar Desarrollos Majadas');
    expect(document.body.textContent).toContain('Volverá a aparecer en el selector de cliente al crear obras.');
    expect(document.body.textContent).not.toContain('Inactivo desde');
    expect(confirmButton()?.textContent).toBe('Reactivar');
    click(confirmButton());
    await flush();
    expect(svc.updateClient).toHaveBeenCalledWith(9, { status: 'ACTIVE' });
    expect(onConfirmed).toHaveBeenCalledWith(expect.objectContaining({ status: 'ACTIVE' }));
  });

  it('a failed save keeps the modal open and says so', async () => {
    svc.updateClient.mockRejectedValue(new Error('boom'));
    render(MAJADAS);
    click(confirmButton());
    await flush();
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('No se pudo guardar. Vuelve a intentarlo.');
    expect(onConfirmed).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(confirmButton()?.disabled).toBe(false);
  });
});
