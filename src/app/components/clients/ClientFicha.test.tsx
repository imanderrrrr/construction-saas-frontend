// The client ficha (sheet 02): the ink bar composes the kicker from id and
// tax id, Resumen shows the empties in mono, Obras is the client's jobsites
// with a way into each and into Proyectos, Facturas is padlocked, and the
// two shortcuts do what they say.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const svc = vi.hoisted(() => ({ listProjects: vi.fn() }));
vi.mock('../../services/projects', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/projects')>()),
  listProjects: svc.listProjects,
}));
// The jobsite window has its own suite; here it only has to receive the client.
vi.mock('../projects/ProjectWindow', () => ({
  ProjectWindow: (p: { initialClient?: { id: number; name: string } | null; onSaved: (x: unknown) => void; onClose: () => void }) => (
    <div data-testid="project-window">{p.initialClient?.name}<button onClick={() => { p.onSaved({}); p.onClose(); }}>stub-save</button></div>
  ),
}));

import i18n from '../../../i18n';
import { resetTourScope, useTourScope } from '../../lib/tourScope';
import type { ClientResponse } from '../../services/clients';
import { ClientFicha } from './ClientFicha';
import { ANDES, MAJADAS, buttonByText, click, flush, page, project } from './testing';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function ScopeProbe() {
  const scope = useTourScope();
  return <span data-testid="scope">{scope?.key ?? 'none'}</span>;
}

const PROJECTS = [
  project({ id: 1, name: 'Torre Vista Hermosa', costCode: 'GDL-TC-2026-001', originalContractCents: 40_000_000, revisedContractCents: 42_000_000 }),
  project({ id: 4, name: 'Oficinas Andes Reforma', status: 'CLOSED', costCode: null, originalContractCents: 31_800_000, revisedContractCents: null }),
];

describe('ClientFicha', () => {
  let container: HTMLDivElement;
  let root: Root;
  const handlers = {
    onBack: vi.fn(), onEdit: vi.fn(), onToggleStatus: vi.fn(), onOpenProjects: vi.fn(), onOpenProject: vi.fn(), onClientChanged: vi.fn(),
  };
  const writeText = vi.fn();

  beforeAll(() => {
    i18n.changeLanguage('es');
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  });

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    Object.values(handlers).forEach(h => h.mockReset());
    writeText.mockReset().mockResolvedValue(undefined);
    svc.listProjects.mockReset().mockResolvedValue(page(PROJECTS, 8));
    resetTourScope();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  async function render(client: ClientResponse = ANDES) {
    act(() => { root.render(<><ClientFicha client={client} {...handlers} /><ScopeProbe /></>); });
    await flush();
  }
  const tab = (label: string) => Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find(b => b.textContent?.startsWith(label));

  it('composes the ink bar from the sheet: kicker with id and tax id, status, alta and open jobsites', async () => {
    await render();
    expect(container.textContent).toContain('Cliente · #7 · 7204418-6');
    expect(container.querySelector('h2')?.textContent).toBe('Inmobiliaria Andes');
    expect(container.textContent).toContain('Alta 09 ENE 2024 · 3 obras en curso');
    expect(container.textContent).toContain('Desactivar');
    expect(container.querySelector('[data-testid="scope"]')?.textContent).toBe('clients-ficha');
    expect(svc.listProjects).toHaveBeenCalledWith({ clientId: 7, page: 0, size: 20 });
    // The tab count is the server's total, not the two counters added up.
    expect(tab('Obras')?.textContent).toContain('8');
    expect(tab('Facturas')?.getAttribute('aria-disabled')).toBe('true');
  });

  it('a client with nothing on file says so in mono, never with a dash', async () => {
    await render(MAJADAS);
    expect(container.textContent).toContain('Cliente · #9');
    expect(container.textContent).not.toContain('Cliente · #9 ·');
    expect(container.textContent).toContain('Sin contacto');
    expect(container.textContent).toContain('Sin registro fiscal');
    expect(container.textContent).toContain('Reactivar');
    expect(container.textContent).not.toContain('obras en curso');
  });

  it('Resumen: copying the billing details puts them on the clipboard one per line', async () => {
    await render();
    const copy = buttonByText(container, 'Copiar datos de facturación');
    click(copy);
    await flush();
    expect(writeText).toHaveBeenCalledWith('Inmobiliaria Andes\n7204418-6\nMarisol Cano · Gerente de proyectos\n2412 8890\npagos@inmoandes.gt');
    expect(copy?.textContent).toBe('Copiado');
  });

  it('Resumen: "Crear obra para este cliente" opens the jobsite window with the client picked and re-reads on save', async () => {
    await render();
    click(buttonByText(container, 'Crear obra para este cliente'));
    expect(container.querySelector('[data-testid="project-window"]')?.textContent).toContain('Inmobiliaria Andes');
    click(buttonByText(container, 'stub-save'));
    await flush();
    expect(handlers.onClientChanged).toHaveBeenCalledTimes(1);
    expect(svc.listProjects).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[data-testid="project-window"]')).toBeNull();
  });

  it('Obras: the jobsites with code, status and revised-or-original contract; each row and "Ver todas" lead to Proyectos', async () => {
    await render();
    click(tab('Obras'));
    const table = container.querySelector('[data-testid="client-projects"]');
    expect(table?.textContent).toContain('Torre Vista Hermosa');
    expect(table?.textContent).toContain('GDL-TC-2026-001');
    expect(table?.textContent).toContain('$420,000.00');
    expect(table?.textContent).toContain('$318,000.00');
    expect(table?.textContent).toContain('Sin código');
    expect(table?.textContent).toContain('1–2 de 8');
    click(Array.from(table!.querySelectorAll('[role="button"]')).find(r => r.textContent?.includes('Oficinas Andes Reforma')));
    expect(handlers.onOpenProject).toHaveBeenCalledWith(4);
    click(buttonByText(container, /Ver todas en Proyectos/));
    expect(handlers.onOpenProjects).toHaveBeenCalledTimes(1);
  });

  it('Obras with nothing built yet says so and offers to create the first', async () => {
    svc.listProjects.mockResolvedValue(page([], 0));
    await render(MAJADAS);
    click(tab('Obras'));
    expect(container.textContent).toContain('Sin obras');
    expect(container.textContent).toContain('Todavía no le has construido nada.');
    expect(buttonByText(container, /Crear obra$/)).toBeTruthy();
  });

  it('Facturas is padlocked and explains why instead of inventing a balance', async () => {
    await render();
    click(tab('Facturas'));
    expect(container.textContent).toContain('Todavía no');
    expect(container.textContent).toContain('Las facturas todavía no se ligan al cliente. Se verán aquí cuando lo hagan.');
  });

  it('the breadcrumb goes back; Editar and Desactivar are the parent\'s windows', async () => {
    await render();
    click(container.querySelector('nav button'));
    expect(handlers.onBack).toHaveBeenCalledTimes(1);
    click(buttonByText(container, 'Editar'));
    expect(handlers.onEdit).toHaveBeenCalledTimes(1);
    click(buttonByText(container, 'Desactivar'));
    expect(handlers.onToggleStatus).toHaveBeenCalledTimes(1);
  });
});
