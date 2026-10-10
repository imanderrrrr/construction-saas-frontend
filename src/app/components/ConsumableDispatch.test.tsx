import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apiMock = vi.hoisted(() => vi.fn());
vi.mock('../lib/api', () => ({ api: (...args: unknown[]) => apiMock(...args) }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

// Render the form's options directly so the test can inspect the project's small DTO.
vi.mock('./ui/select', () => {
  const Wrapper = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    Select: Wrapper, SelectContent: Wrapper, SelectTrigger: Wrapper,
    SelectValue: () => null,
    SelectItem: ({ children, value }: { children?: React.ReactNode; value: string }) => <div data-option={value}>{children}</div>,
  };
});
vi.mock('./ui/dialog', () => {
  const Wrapper = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    Dialog: Wrapper, DialogContent: Wrapper, DialogHeader: Wrapper,
    DialogTitle: Wrapper, DialogDescription: Wrapper, DialogFooter: Wrapper,
  };
});

import { ConsumableDispatch } from './ConsumableDispatch';
import { listWarehouseProjects } from '../services/warehouse';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  apiMock.mockReset();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe('warehouse project access for consumable dispatch', () => {
  it('loads active projects from the warehouse endpoint and renders a project with only three fields', async () => {
    apiMock.mockImplementation((path: string) => {
      if (path.startsWith('/api/v1/warehouse/projects')) {
        return Promise.resolve({ content: [{ id: 7, name: 'Obra Norte', status: 'ACTIVE' }], page: 0, size: 100, totalElements: 1, totalPages: 1 });
      }
      if (path.startsWith('/api/v1/warehouse/consumables/dispatches')) return Promise.resolve({ content: [], totalPages: 1 });
      if (path.startsWith('/api/v1/warehouse/consumables')) return Promise.resolve([]);
      if (path.startsWith('/api/v1/admin/users')) return Promise.resolve({ content: [], totalPages: 1 });
      throw new Error(`Unexpected request: ${path}`);
    });
    await act(async () => root.render(<ConsumableDispatch />));
    await act(async () => { await Promise.resolve(); });
    const paths = apiMock.mock.calls.map(([path]) => String(path));
    expect(paths).toContain('/api/v1/warehouse/projects?status=ACTIVE&page=0&size=100');
    expect(paths.some(path => path.startsWith('/api/v1/admin/projects'))).toBe(false);
    const button = Array.from(container.querySelectorAll('button')).find(el => el.textContent?.includes('dispatch.dispatchSupply'));
    expect(button).toBeDefined();
    expect(button?.disabled).toBe(false);
    await act(async () => button?.click());
    expect(container.querySelector('[data-option="7"]')?.textContent).toBe('Obra Norte');
  });

  it('preserves the status and pagination parameters on the warehouse service', async () => {
    apiMock.mockResolvedValue({ content: [], page: 2, size: 10, totalElements: 0, totalPages: 0 });
    await listWarehouseProjects({ status: 'INACTIVE', page: 2, size: 10 });
    expect(apiMock).toHaveBeenCalledWith('/api/v1/warehouse/projects?status=INACTIVE&page=2&size=10');
  });
});
