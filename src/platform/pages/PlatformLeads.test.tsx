import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Page, PlatformLead, PlatformRole } from '../types';

const mocks = vi.hoisted(() => ({
  listLeads: vi.fn(),
  deleteLead: vi.fn(),
  role: { current: 'OWNER' as PlatformRole },
}));

vi.mock('../services/platformLeads', () => ({
  listLeads: (...args: unknown[]) => mocks.listLeads(...args),
  deleteLead: (...args: unknown[]) => mocks.deleteLead(...args),
}));

vi.mock('../context/PlatformAuthContext', () => ({
  usePlatformAuth: () => ({
    role: mocks.role.current,
    session: { fullName: 'Staff Ejemplo', email: 'staff@ejemplo.test', role: mocks.role.current },
    logout: vi.fn(),
  }),
}));

vi.mock('../services/platformDashboard', () => ({
  getMe: () => new Promise(() => {}),
}));

// jsdom ships no matchMedia; motion's reduced-motion probe asks for it when
// the modal mounts. Answer "no preference" so components render.
window.matchMedia = ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
})) as typeof window.matchMedia;

import { setBusinessTz, resetBusinessTz } from '../../app/helpers/dateTime';
import { PlatformShell } from '../components/PlatformShell';
import { PlatformLeads } from './PlatformLeads';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function lead(overrides: Partial<PlatformLead> = {}): PlatformLead {
  return {
    id: 7,
    createdAt: '2026-10-25T16:42:00Z',
    name: 'Ana Prueba',
    company: 'Constructora Ejemplo, S. A.',
    email: 'ana.prueba@ejemplo.test',
    phone: null,
    interest: 'DEMO',
    locale: 'es',
    source: 'CHAT',
    ...overrides,
  };
}

function page(content: PlatformLead[], extra: Partial<Page<PlatformLead>> = {}): Page<PlatformLead> {
  return { content, totalElements: content.length, totalPages: content.length ? 1 : 0, number: 0, size: 25, ...extra };
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  mocks.listLeads.mockReset();
  mocks.deleteLead.mockReset();
  mocks.role.current = 'OWNER';
  setBusinessTz('America/Guatemala');
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  resetBusinessTz();
});

async function render() {
  await act(async () => {
    root.render(<PlatformLeads />);
  });
}

/** The modal leaves through AnimatePresence: let its exit animation finish. */
async function settleExit() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 400));
  });
}

const all = (selector: string) => Array.from(container.querySelectorAll<HTMLElement>(selector));
const byText = (selector: string, text: string) => all(selector).find((el) => el.textContent?.trim() === text);
const subtitle = () => container.querySelector('header p')!;
const bodyRows = () => all('tbody tr');

describe('PlatformLeads', () => {
  it('shows skeleton rows and the Loading… subtitle while loading', async () => {
    mocks.listLeads.mockReturnValue(new Promise(() => {}));
    await render();

    expect(subtitle().textContent).toBe('Loading…');
    expect(bodyRows().length).toBeGreaterThanOrEqual(3);
    expect(container.querySelectorAll('tbody .pc-skeleton').length).toBeGreaterThan(0);
    expect(container.querySelector('h1')!.textContent).toBe('Leads');
  });

  it('shows the empty row with the empty text and hint', async () => {
    mocks.listLeads.mockResolvedValue(page([]));
    await render();

    expect(bodyRows()).toHaveLength(1);
    expect(bodyRows()[0].textContent).toContain('No leads yet.');
    expect(bodyRows()[0].textContent).toContain('Contacts from the landing assistant and form will appear here.');
  });

  it('shows the error box with a Retry button that reloads', async () => {
    mocks.listLeads.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(page([lead()]));
    await render();

    const box = container.querySelector('[role="alert"]')!;
    expect(box.textContent).toContain('Failed to load leads.');
    await act(async () => byText('button', 'Retry')!.click());

    expect(mocks.listLeads).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(bodyRows()[0].textContent).toContain('Ana Prueba');
  });

  it('renders a row with name, company, the email or the phone, the interest chip, language, source and the date and time on two lines', async () => {
    mocks.listLeads.mockResolvedValue(
      page([lead(), lead({ id: 8, name: 'Luis Muestra', company: 'Obras de Prueba', email: null, phone: '+50200000001', interest: 'BETA', locale: 'en', source: 'FORM' })]),
    );
    await render();

    const [first, second] = bodyRows();
    const cells = Array.from(first.querySelectorAll('td')).map((td) => td.textContent);
    expect(cells.slice(0, 6)).toEqual(['Ana Prueba', 'Constructora Ejemplo, S. A.', 'ana.prueba@ejemplo.test', 'DEMO', 'ES', 'CHAT']);
    const received = first.querySelectorAll('td')[6].querySelectorAll('div');
    expect(Array.from(received).map((d) => d.textContent)).toEqual(['Oct 25, 2026', '10:42 AM']);
    const secondCells = Array.from(second.querySelectorAll('td')).map((td) => td.textContent);
    expect(secondCells.slice(2, 6)).toEqual(['+50200000001', 'BETA', 'EN', 'FORM']);
    expect(first.querySelector('[data-interest="DEMO"] i')!.className).toContain('bg-bt-orange');
    expect(second.querySelector('[data-interest="BETA"] i')!.className).toContain('bg-bt-ink');
  });

  it('the subtitle shows {n} total and the retention label reads AUTO-DELETED AFTER 12 MONTHS', async () => {
    mocks.listLeads.mockResolvedValue(page([lead()], { totalElements: 58, totalPages: 3 }));
    await render();

    expect(subtitle().textContent).toBe(
      'Contacts left on the public landing page, through the assistant or the contact form. 58 total',
    );
    expect(container.querySelector('header')!.textContent).toContain('AUTO-DELETED AFTER 12 MONTHS');
  });

  it('the delete button is visible only for OWNER and its aria-label names the lead', async () => {
    mocks.listLeads.mockResolvedValue(page([lead()]));
    await render();
    expect(container.querySelector('button[aria-label="Delete lead Ana Prueba"]')).not.toBeNull();

    act(() => root.unmount());
    root = createRoot(container);
    mocks.role.current = 'SUPPORT';
    await render();
    expect(container.querySelector('button[aria-label^="Delete lead"]')).toBeNull();
  });

  it('delete opens the modal with the name and company chip, Cancel has the initial focus', async () => {
    mocks.listLeads.mockResolvedValue(page([lead()]));
    await render();
    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Delete lead Ana Prueba"]')!.click());

    expect(byText('h2', 'Delete lead')).toBeDefined();
    expect(container.textContent).toContain('Ana Prueba · Constructora Ejemplo, S. A.');
    expect(document.activeElement).toBe(byText('button', 'Cancel'));

    await act(async () => byText('button', 'Cancel')!.click());
    await settleExit();
    expect(byText('h2', 'Delete lead')).toBeUndefined();
    expect(mocks.deleteLead).not.toHaveBeenCalled();
  });

  it('Delete lead calls deleteLead, closes the modal and reloads, and goes back one page when the last row of the last page was deleted', async () => {
    mocks.listLeads
      .mockResolvedValueOnce(page([lead(), lead({ id: 8, name: 'Luis Muestra' })]))
      .mockResolvedValueOnce(page([lead({ id: 8, name: 'Luis Muestra' })]));
    mocks.deleteLead.mockResolvedValue(undefined);
    await render();

    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Delete lead Ana Prueba"]')!.click());
    await act(async () => byText('button', 'Delete lead')!.click());

    expect(mocks.deleteLead).toHaveBeenCalledWith(7);
    await settleExit();
    expect(byText('h2', 'Delete lead')).toBeUndefined();
    expect(mocks.listLeads).toHaveBeenCalledTimes(2);
    expect(mocks.listLeads).toHaveBeenLastCalledWith(0, 25);

    // Page 2 of 2 holds one lead: deleting it goes back to page 1.
    act(() => root.unmount());
    root = createRoot(container);
    mocks.listLeads.mockReset();
    mocks.listLeads
      .mockResolvedValueOnce(page([lead()], { totalElements: 26, totalPages: 2, number: 0 }))
      .mockResolvedValueOnce(page([lead({ id: 30, name: 'Mara Demo' })], { totalElements: 26, totalPages: 2, number: 1 }))
      .mockResolvedValueOnce(page([lead()], { totalElements: 25, totalPages: 1, number: 0 }));
    await render();
    await act(async () => byText('button', 'Next')!.click());
    expect(mocks.listLeads).toHaveBeenLastCalledWith(1, 25);

    await settleExit();
    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Delete lead Mara Demo"]')!.click());
    await act(async () => byText('button', 'Delete lead')!.click());

    expect(mocks.deleteLead).toHaveBeenLastCalledWith(30);
    expect(mocks.listLeads).toHaveBeenLastCalledWith(0, 25);
  });

  it('a failed delete keeps the modal open and shows Delete failed. in the error box', async () => {
    mocks.listLeads.mockResolvedValue(page([lead()]));
    mocks.deleteLead.mockRejectedValue(new Error('Lead not found'));
    await render();

    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Delete lead Ana Prueba"]')!.click());
    await act(async () => byText('button', 'Delete lead')!.click());

    expect(byText('h2', 'Delete lead')).toBeDefined();
    const box = all('[role="alert"]').find((el) => el.textContent === 'Delete failed.');
    expect(box).toBeDefined();
    expect(mocks.listLeads).toHaveBeenCalledTimes(1);
  });

  it('pagination is not drawn with a single page and is drawn with several', async () => {
    mocks.listLeads.mockResolvedValue(page([lead()]));
    await render();
    expect(byText('button', 'Next')).toBeUndefined();
    expect(container.textContent).not.toContain('PAGE 1 OF');

    act(() => root.unmount());
    root = createRoot(container);
    mocks.listLeads.mockResolvedValue(page([lead()], { totalElements: 58, totalPages: 3 }));
    await render();
    expect(container.textContent).toContain('PAGE 1 OF 3');
    expect((byText('button', 'Previous') as HTMLButtonElement).disabled).toBe(true);
    expect((byText('button', 'Next') as HTMLButtonElement).disabled).toBe(false);
  });

  it('the footnote about the audit log is shown', async () => {
    mocks.listLeads.mockResolvedValue(page([lead()]));
    await render();
    expect(container.textContent).toContain('Viewing and deleting leads is recorded in the audit log.');
  });
});

describe('PlatformShell — console menu', () => {
  it('the nav has Overview, Tenants, Leads and Audit log in that order, with an Inbox icon for Leads', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/platform/leads']}>
          <PlatformShell />
        </MemoryRouter>,
      );
    });

    const links = all('nav a');
    expect(links.map((a) => a.textContent?.trim())).toEqual(['Overview', 'Tenants', 'Leads', 'Audit log']);
    const leads = links[2] as HTMLAnchorElement;
    expect(leads.getAttribute('href')).toBe('/platform/leads');
    expect(leads.querySelector('svg')!.getAttribute('class')).toContain('lucide-inbox');
  });
});
