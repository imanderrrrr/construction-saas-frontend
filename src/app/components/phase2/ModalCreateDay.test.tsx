import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserDTO } from '../../services/users';

// «Crear jornada»: who it can be created for. The finance panel approves the
// supervisors' hours, so it lists supervisors only (`subjectRole`); and a
// user list that does not load is said in the window, with a retry, instead
// of a toast that fades and leaves an empty picker.

const mocks = vi.hoisted(() => ({
  listActiveUsers: vi.fn(),
  getManualMarkContext: vi.fn(),
  createManualRecord: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | object) => (typeof fallback === 'string' ? fallback : key),
    i18n: { language: 'en-US' },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
vi.mock('sonner', () => ({ toast: mocks.toast }));
vi.mock('../../services/users', () => ({ listActiveUsers: mocks.listActiveUsers }));
vi.mock('../../services/time', () => ({
  getManualMarkContext: mocks.getManualMarkContext,
  createManualRecord: mocks.createManualRecord,
}));

// Radix needs portals and focus traps — plain elements under jsdom.
vi.mock('../ui/dialog', () => ({
  Dialog: ({ children, open }: { children?: React.ReactNode; open?: boolean }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children?: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children?: React.ReactNode }) => <p data-testid="subtitle">{children}</p>,
  DialogFooter: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('../ui/button', () => ({
  Button: ({ children, disabled, type, onClick }: {
    children?: React.ReactNode; disabled?: boolean; type?: 'button' | 'submit'; onClick?: () => void;
  }) => <button disabled={disabled} type={type} onClick={onClick}>{children}</button>,
}));
vi.mock('../ui/select', () => ({
  Select: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children }: { children?: React.ReactNode }) => <ul data-testid="options">{children}</ul>,
  SelectItem: ({ children }: { children?: React.ReactNode }) => <li>{children}</li>,
}));

import { ModalCreateDay } from './ModalCreateDay';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const user = (id: number, name: string, role: 'WORKER' | 'SUPERVISOR'): UserDTO => ({
  id, username: name.toLowerCase(), fullName: name, role, status: 'ACTIVE', updatedAt: '2026-09-01T00:00:00Z',
} as UserDTO);
const WORKERS = [user(1, 'Pedro', 'WORKER')];
const SUPERVISORS = [user(2, 'Sofía', 'SUPERVISOR')];

describe('ModalCreateDay', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listActiveUsers.mockImplementation((role: string) => Promise.resolve(role === 'SUPERVISOR' ? SUPERVISORS : WORKERS));
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  async function render(props: Partial<React.ComponentProps<typeof ModalCreateDay>> = {}) {
    await act(async () => {
      root.render(<ModalCreateDay open onClose={vi.fn()} onCreated={vi.fn()} {...props} />);
    });
  }
  const options = () => [...container.querySelectorAll('[data-testid="options"] li')].map(li => li.textContent);

  it('lists workers and supervisors, telling the supervisors apart', async () => {
    await render();
    expect(mocks.listActiveUsers).toHaveBeenCalledWith('WORKER');
    expect(mocks.listActiveUsers).toHaveBeenCalledWith('SUPERVISOR');
    expect(options()).toEqual(['Pedro', 'Sofía — Supervisor']);
    expect(container.textContent).toContain('Worker / Supervisor');
  });

  it('with subjectRole, lists supervisors only and says so', async () => {
    await render({ subjectRole: 'SUPERVISOR' });
    expect(mocks.listActiveUsers).toHaveBeenCalledTimes(1);
    expect(mocks.listActiveUsers).toHaveBeenCalledWith('SUPERVISOR');
    expect(options()).toEqual(['Sofía']);
    expect(container.querySelector('[data-testid="subtitle"]')?.textContent).toBe('Register a full day on behalf of a supervisor.');
    expect(container.textContent).not.toContain('Worker / Supervisor');
  });

  it('says in the window when the people do not load, and retries', async () => {
    mocks.listActiveUsers.mockRejectedValueOnce(new Error('boom'));
    await render({ subjectRole: 'SUPERVISOR' });
    const failed = container.querySelector('[data-testid="create-day-users-failed"]');
    expect(failed?.textContent).toContain('Could not load the user list.');
    expect(mocks.toast.error).not.toHaveBeenCalled();

    await act(async () => {
      [...failed!.querySelectorAll('button')].find(b => b.textContent === 'Retry')!.click();
    });
    expect(container.querySelector('[data-testid="create-day-users-failed"]')).toBeNull();
    expect(options()).toEqual(['Sofía']);
  });
});
