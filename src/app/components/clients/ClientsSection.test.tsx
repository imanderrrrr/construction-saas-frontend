// The list (sheets 01 / 01B / 01C): section-owned header with the count
// line, three figures of which two are filters, a server-side search that
// rests before asking, four states, a row menu without "Eliminar", the
// hand-off to Proyectos, and the new-client flash.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const svc = vi.hoisted(() => ({
  listClients: vi.fn(), getClientsSummary: vi.fn(), getClient: vi.fn(),
  NEW: {
    id: 10, name: 'Constructora del Valle', rfc: '5512033-8', contact: 'Silvia Arriola', phone: null, email: null,
    status: 'ACTIVE', activeProjectsCount: 0, completedProjectsCount: 0, createdAt: '2026-09-05T12:00:00Z', updatedAt: '2026-09-05T12:00:00Z',
  },
}));
vi.mock('../../services/clients', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/clients')>()),
  listClients: svc.listClients,
  getClientsSummary: svc.getClientsSummary,
  getClient: svc.getClient,
}));
// The row menu inline, so its items are queryable without driving Radix in jsdom.
vi.mock('../ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children, onClick }: { children: React.ReactNode; onClick?: (e: React.MouseEvent) => void }) => <div onClick={onClick}>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => <button onClick={onClick}>{children}</button>,
  DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
// The ficha and the two windows have their own suites; here they are landmarks that talk back.
vi.mock('./ClientFicha', () => ({
  ClientFicha: (p: { client: { name: string }; onBack: () => void }) => (
    <div data-testid="client-ficha">{p.client.name}<button onClick={p.onBack}>stub-back</button></div>
  ),
}));
vi.mock('./ClientFormModal', () => ({
  ClientFormModal: (p: { open: boolean; client?: unknown; onSaved: (c: unknown, mode: string) => void; onOpenChange: (o: boolean) => void }) => p.open ? (
    <div data-testid="client-form-stub" data-mode={p.client ? 'edit' : 'create'}>
      <button onClick={() => { p.onSaved(svc.NEW, 'create'); p.onOpenChange(false); }}>stub-create</button>
    </div>
  ) : null,
}));
vi.mock('./ClientStatusModal', () => ({
  ClientStatusModal: (p: { open: boolean; client: { name: string } | null }) => p.open && p.client ? <div data-testid="client-status-stub">{p.client.name}</div> : null,
}));

import i18n from '../../../i18n';
import { peekSectionIntent, resetSectionIntents } from '../../lib/sectionIntent';
import { ClientsSection } from './ClientsSection';
import { ANDES, MAJADAS, SAN_RAFAEL, buttonByText, click, flush, page, type } from './testing';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const THREE = [ANDES, SAN_RAFAEL, MAJADAS];
const SUMMARY = { total: 48, active: 41, withActiveProjects: 17 };

describe('ClientsSection', () => {
  let container: HTMLDivElement;
  let root: Root;
  const onNavigate = vi.fn();

  beforeAll(() => i18n.changeLanguage('es'));

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    onNavigate.mockReset();
    svc.listClients.mockReset().mockResolvedValue(page(THREE, 48));
    svc.getClientsSummary.mockReset().mockResolvedValue(SUMMARY);
    svc.getClient.mockReset();
    resetSectionIntents();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  async function render() {
    act(() => { root.render(<ClientsSection onNavigate={onNavigate} />); });
    await flush();
  }
  const row = (id: number) => container.querySelector<HTMLElement>(`[data-testid="client-row-${id}"]`);
  const lastListArgs = () => svc.listClients.mock.calls[svc.listClients.mock.calls.length - 1];
  const figureButtons = () => Array.from(container.querySelectorAll<HTMLButtonElement>('[data-testid="clients-figures"] button'));

  it('leads with the count line and the three figures; every row says what is missing in mono', async () => {
    await render();
    expect(svc.listClients).toHaveBeenCalledWith(undefined, undefined, 0, 20, undefined);
    expect(container.textContent).toContain('Clientes · quién te contrata');
    expect(container.textContent).toContain('48 clientes · 41 activos · 7 inactivos');
    expect(container.textContent).toContain('Registra · asigna · factura');
    const figures = container.querySelector('[data-testid="clients-figures"]')!.textContent;
    expect(figures).toContain('48');
    expect(figures).toContain('Clientes registrados');
    expect(figures).toContain('41');
    expect(figures).toContain('Activos · aparecen al crear obras');
    expect(figures).toContain('17');
    expect(figures).toContain('Con obras en curso · no los desactives');
    expect(row(7)?.textContent).toContain('3 en curso');
    expect(row(7)?.textContent).toContain('5 cerradas');
    expect(row(8)?.textContent).toContain('Sin correo');
    expect(row(9)?.textContent).toContain('Sin contacto');
    expect(row(9)?.textContent).toContain('Sin registro');
    expect(row(9)?.className).toContain('opacity-[0.72]');
    expect(row(9)?.textContent).toContain('Inactivo');
    expect(container.textContent).toContain('1–20 de 48');
    expect(container.textContent).toContain('Página 1 de 3');
    // No "Eliminar" anywhere: the backend has no DELETE.
    expect(container.textContent).not.toContain('Eliminar');
  });

  it('without the summary the figures fall to "—" and stop being buttons; the list loads anyway', async () => {
    svc.getClientsSummary.mockRejectedValue(new Error('boom'));
    await render();
    expect(container.querySelector('[data-testid="clients-figures"]')!.textContent!.match(/—/g)).toHaveLength(3);
    expect(figureButtons().every(b => b.disabled)).toBe(true);
    expect(row(7)).toBeTruthy();
    expect(container.textContent).toContain('Quién te contrata, con qué datos se le factura');
  });

  it('the second and third figures are the status and the jobsites filter, and toggle off', async () => {
    await render();
    click(figureButtons()[0]);
    await flush();
    expect(lastListArgs()).toEqual([undefined, 'ACTIVE', 0, 20, undefined]);
    expect(figureButtons()[0].getAttribute('aria-pressed')).toBe('true');
    click(figureButtons()[0]);
    await flush();
    expect(lastListArgs()).toEqual([undefined, undefined, 0, 20, undefined]);
    click(figureButtons()[1]);
    await flush();
    expect(lastListArgs()).toEqual([undefined, undefined, 0, 20, 'WITH_ACTIVE']);
  });

  it('the search reaches the server once it rests, back on page one', async () => {
    await render();
    const calls = svc.listClients.mock.calls.length;
    type(container.querySelector('input')!, 'andes');
    await flush(100);
    expect(svc.listClients.mock.calls.length).toBe(calls);
    await flush(400);
    expect(lastListArgs()).toEqual(['andes', undefined, 0, 20, undefined]);
    click(buttonByText(container, /Limpiar filtros/));
    await flush();
    expect(lastListArgs()).toEqual([undefined, undefined, 0, 20, undefined]);
  });

  it('the four states: empty, no match, error with retry', async () => {
    svc.listClients.mockResolvedValue(page([], 0));
    await render();
    expect(container.textContent).toContain('Sin clientes');
    expect(container.textContent).toContain('Crea el primero y podrás asignarlo al crear una obra.');

    type(container.querySelector('input')!, 'zzz');
    await flush(400);
    expect(container.textContent).toContain('Sin coincidencias');
    expect(container.textContent).toContain('Buscamos por nombre, contacto, teléfono y correo.');

    svc.listClients.mockRejectedValue(new Error('boom'));
    click(buttonByText(container, /Limpiar filtros/));
    await flush();
    expect(container.textContent).toContain('No cargó');
    expect(container.textContent).toContain('No pudimos traer los clientes.');
    svc.listClients.mockResolvedValue(page(THREE, 48));
    click(buttonByText(container, 'Reintentar'));
    await flush();
    expect(row(7)).toBeTruthy();
  });

  it('"Ver sus obras" hands Proyectos the client and navigates there', async () => {
    await render();
    click(Array.from(row(7)!.querySelectorAll('button')).find(b => b.textContent === 'Ver sus obras'));
    expect(peekSectionIntent('projects')).toEqual({ clientId: 7, clientName: 'Inmobiliaria Andes', openProjectId: undefined });
    expect(onNavigate).toHaveBeenCalledWith('projects');
  });

  it('a row opens the ficha; the row menu opens the windows; back returns to the same list without refetching', async () => {
    await render();
    const calls = svc.listClients.mock.calls.length;
    click(Array.from(row(9)!.querySelectorAll('button')).find(b => b.textContent === 'Reactivar'));
    expect(container.querySelector('[data-testid="client-status-stub"]')?.textContent).toBe('Desarrollos Majadas');
    click(Array.from(row(7)!.querySelectorAll('button')).find(b => b.textContent === 'Editar'));
    expect(container.querySelector('[data-testid="client-form-stub"]')?.getAttribute('data-mode')).toBe('edit');
    click(row(8));
    expect(container.querySelector('[data-testid="client-ficha"]')?.textContent).toContain('Clínica San Rafael');
    expect(row(7)).toBeNull();
    click(buttonByText(container, 'stub-back'));
    expect(row(7)).toBeTruthy();
    expect(svc.listClients.mock.calls.length).toBe(calls);
  });

  it('a new client: filters go, the list reloads on its page and its row flashes with a "Nuevo" chip', async () => {
    await render();
    type(container.querySelector('input')!, 'zzz');
    await flush(400);
    click(buttonByText(container, /Crear cliente/));
    expect(container.querySelector('[data-testid="client-form-stub"]')?.getAttribute('data-mode')).toBe('create');
    svc.listClients.mockResolvedValue(page([...THREE, svc.NEW as never], 4));
    click(buttonByText(container, 'stub-create'));
    await flush(50);
    // rankOf walked the unfiltered list (size 100), then the list refetched clean.
    expect(svc.listClients).toHaveBeenCalledWith(undefined, undefined, 0, 100);
    expect(lastListArgs()).toEqual([undefined, undefined, 0, 20, undefined]);
    expect((container.querySelector('input') as HTMLInputElement).value).toBe('');
    expect(row(10)?.className).toContain('bt-row-flash');
    expect(row(10)?.textContent).toContain('Nuevo');
    expect(svc.getClientsSummary).toHaveBeenCalledTimes(2);
  });
});
