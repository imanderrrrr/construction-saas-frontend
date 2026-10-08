import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const svc = vi.hoisted(() => ({ listLineItemOptions: vi.fn() }));
vi.mock('../../../services/budgetLineItems', () => svc);
import i18n from '../../../../i18n';
import type { LineItemOption } from '../../../services/budgetLineItems';
import { BudgetLineItemSelector } from './BudgetLineItemSelector';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
describe('BudgetLineItemSelector', () => {
  let container: HTMLDivElement, root: Root;
  const onChange = vi.fn();
  beforeEach(async () => {
    vi.clearAllMocks(); await i18n.changeLanguage('en'); svc.listLineItemOptions.mockResolvedValue([{ id: 9, code: '01.01', name: 'Foundation' }]);
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); });
  async function mount(projectId?: number) { await act(async () => root.render(<BudgetLineItemSelector projectId={projectId} value={null} onChange={onChange} />)); }
  it('leaves assignment optional for projects without WBS', async () => {
    svc.listLineItemOptions.mockResolvedValue([]); await mount(7);
    expect(container.textContent).toContain('This project has no line items');
    expect(container.querySelector('select')?.disabled).toBe(false);
    expect(container.querySelectorAll('option')).toHaveLength(1);
  });
  it('does not request line items before a project is selected', async () => {
    await mount(); expect(svc.listLineItemOptions).not.toHaveBeenCalled(); expect(container.querySelector('select')?.disabled).toBe(true);
  });
  it('loads minimal options and returns the selected ID', async () => {
    await mount(7); expect(svc.listLineItemOptions).toHaveBeenCalledWith(7);
    const select = container.querySelector('select')!;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(select, '9'); select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(onChange).toHaveBeenCalledWith(9);
  });
  it('discards a late response from a previously selected project', async () => {
    let finish!: (options: LineItemOption[]) => void;
    svc.listLineItemOptions.mockReturnValueOnce(new Promise<LineItemOption[]>(resolve => { finish = resolve; }));
    await mount(7); await mount(8);
    await act(async () => finish([{ id: 20, code: 'OTHER', name: 'Previous project' }]));
    expect(container.textContent).not.toContain('Previous project'); expect(container.textContent).toContain('Foundation');
  });
  it('shows a retry without blocking general-budget origin submissions', async () => {
    svc.listLineItemOptions.mockRejectedValueOnce(new Error('offline')); await mount(7);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('You can continue with the general budget');
    await act(async () => container.querySelector('button')!.click()); expect(container.textContent).toContain('Foundation');
  });
  it('keeps a preassigned invoice visible on options failure and prevents a misleading general-budget choice', async () => {
    svc.listLineItemOptions.mockRejectedValueOnce(new Error('offline'));
    await act(async () => root.render(<BudgetLineItemSelector projectId={7} value={9} onChange={onChange} allowGeneral={false} selectedLabel="01.01 · Foundation" />));
    const select = container.querySelector('select')!;
    expect(select.value).toBe('9'); expect(select.selectedOptions[0].textContent).toBe('01.01 · Foundation');
    expect(select.options[0].disabled).toBe(true);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Existing attribution is kept');
  });
});
