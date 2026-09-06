// One modal, two modes (sheet 03 / 03B): only the name is required, the
// phone is optional but shaped, an edit PATCHes what moved and clears with
// "", a server failure never loses what was typed, and a duplicate name is
// a warning, not a wall.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const svc = vi.hoisted(() => ({ createClient: vi.fn(), updateClient: vi.fn(), listClients: vi.fn() }));
vi.mock('../../services/clients', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/clients')>()),
  ...svc,
}));

import i18n from '../../../i18n';
import { ApiError } from '../../lib/api';
import type { ClientResponse } from '../../services/clients';
import { ClientFormModal } from './ClientFormModal';
import { ANDES, buttonByText, flush, page, type } from './testing';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const input = (id: string) => document.getElementById(id) as HTMLInputElement;
function submit() {
  act(() => { document.getElementById('client-form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
}

describe('ClientFormModal', () => {
  let container: HTMLDivElement;
  let root: Root;
  const onSaved = vi.fn();
  const onOpenChange = vi.fn();

  beforeAll(() => i18n.changeLanguage('es'));

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    onSaved.mockReset();
    onOpenChange.mockReset();
    svc.createClient.mockReset();
    svc.updateClient.mockReset();
    svc.listClients.mockReset().mockResolvedValue(page([]));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  function render(props: { client?: ClientResponse | null; origin?: 'section' | 'project' } = {}) {
    act(() => { root.render(<ClientFormModal open onOpenChange={onOpenChange} onSaved={onSaved} {...props} />); });
  }

  it('refuses to save without a name and says so under the field', async () => {
    render();
    submit();
    await flush();
    expect(document.body.textContent).toContain('Escribe el nombre del cliente.');
    expect(svc.createClient).not.toHaveBeenCalled();
  });

  it('shapes the phone and the email but requires neither', async () => {
    render();
    type(input('client-name'), 'Constructora del Valle');
    type(input('client-phone'), '123');
    type(input('client-email'), 'no-es-correo');
    submit();
    await flush();
    expect(document.body.textContent).toContain('De 6 a 30 caracteres, o déjalo vacío.');
    expect(document.body.textContent).toContain('Escribe un correo válido.');
    expect(svc.createClient).not.toHaveBeenCalled();
  });

  it('creates with what was typed, trimmed, and leaves the blanks out', async () => {
    const created = { ...ANDES, id: 10, name: 'Constructora del Valle', contact: 'Silvia Arriola', rfc: '5512033-8', phone: null, email: null };
    svc.createClient.mockResolvedValue(created);
    render();
    expect(document.body.textContent).toContain('Clientes · nuevo');
    expect(document.body.textContent).toContain('Solo el nombre es obligatorio');
    type(input('client-name'), '  Constructora del Valle ');
    type(input('client-contact'), 'Silvia Arriola');
    type(input('client-rfc'), '5512033-8');
    submit();
    await flush();
    expect(svc.createClient).toHaveBeenCalledWith({ name: 'Constructora del Valle', contact: 'Silvia Arriola', rfc: '5512033-8' });
    expect(onSaved).toHaveBeenCalledWith(created, 'create');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('edits with a PATCH of what moved; an emptied field travels as ""', async () => {
    svc.updateClient.mockResolvedValue({ ...ANDES, contact: 'Otto Sandoval', phone: null });
    render({ client: ANDES });
    expect(document.body.textContent).toContain('Clientes · editar');
    expect(document.body.textContent).toContain('Inmobiliaria Andes');
    expect(document.body.textContent).toContain('Lo verán en sus 8 obras');
    expect(input('client-phone').value).toBe('2412 8890');
    type(input('client-contact'), 'Otto Sandoval');
    type(input('client-phone'), '');
    submit();
    await flush();
    expect(svc.updateClient).toHaveBeenCalledWith(7, { contact: 'Otto Sandoval', phone: '' });
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ contact: 'Otto Sandoval' }), 'edit');
  });

  it('an edit with nothing changed makes no request', async () => {
    render({ client: ANDES });
    submit();
    await flush();
    expect(svc.updateClient).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledWith(ANDES, 'edit');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('a server failure keeps the modal open with everything typed', async () => {
    svc.createClient.mockRejectedValue(new ApiError(500, 'boom'));
    render();
    type(input('client-name'), 'Constructora del Valle');
    type(input('client-rfc'), '5512033-8');
    submit();
    await flush();
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('No se pudo guardar. Vuelve a intentarlo.');
    expect(input('client-name').value).toBe('Constructora del Valle');
    expect(input('client-rfc').value).toBe('5512033-8');
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("the backend's field details land under their field", async () => {
    svc.createClient.mockRejectedValue(new ApiError(400, 'Validation failed', { email: 'Invalid email format' }));
    render();
    type(input('client-name'), 'Constructora del Valle');
    type(input('client-email'), 'a@b.co');
    submit();
    await flush();
    expect(document.body.textContent).toContain('Invalid email format');
    expect(document.querySelector('[role="alert"]')).toBeNull();
  });

  it('warns about a client with the same name, and still lets you create it', async () => {
    svc.listClients.mockResolvedValue(page([ANDES]));
    render();
    type(input('client-name'), 'inmobiliaria andes');
    await flush(450);
    expect(svc.listClients).toHaveBeenCalledWith('inmobiliaria andes', undefined, 0, 10);
    expect(document.querySelector('[data-testid="client-duplicate"]')?.textContent).toContain('Ya existe un cliente llamado «Inmobiliaria Andes». Puedes crearlo igual');
    expect(buttonByText(document.body, 'Crear cliente')?.disabled).toBe(false);
  });

  it('from the jobsite window only the kicker and the closing note change', () => {
    render({ origin: 'project' });
    expect(document.body.textContent).toContain('Nueva obra · cliente');
    expect(document.body.textContent).toContain('Al crearlo vuelves al formulario de la obra con el cliente ya elegido.');
  });
});
