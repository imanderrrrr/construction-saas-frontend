import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ManualMarkContextResponse } from '../../services/time';

const mocks = vi.hoisted(() => ({
  getManualMarkContext: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | object) =>
      typeof fallback === 'string' ? fallback : key,
    i18n: { language: 'en-US' },
  }),
}));

vi.mock('../../services/time', () => ({
  getManualMarkContext: mocks.getManualMarkContext,
}));

// Radix dialog needs portals/focus traps — stub down to plain divs under jsdom.
vi.mock('../ui/dialog', () => ({
  Dialog: ({ children, open }: { children?: React.ReactNode; open?: boolean }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children?: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children?: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../ui/button', () => ({
  Button: ({ children, disabled, type, onClick }: {
    children?: React.ReactNode; disabled?: boolean; type?: 'button' | 'submit'; onClick?: () => void;
  }) => (
    <button disabled={disabled} type={type} onClick={onClick}>{children}</button>
  ),
}));

import { ModalAddMark } from './ModalAddMark';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const CONTEXT_PAID: ManualMarkContextResponse = {
  userId: 7,
  date: '2026-07-01',
  paidPeriod: true,
  records: [{
    recordId: 42, projectId: 3, projectName: 'Torre Norte',
    approvalStatus: 'AUTO_REJECTED', paid: false, presentTypes: ['CHECK_IN'],
  }],
  assignedProjects: [{ id: 3, name: 'Torre Norte' }],
};

function defaultProps(onSubmit = vi.fn()) {
  return {
    open: true,
    recordId: 42,
    workerId: 7,
    workerName: 'Juan Pérez',
    projectName: 'Torre Norte',
    date: 'Wed, Jul 1, 2026',
    workDate: '2026-07-01',
    missingTypes: ['LUNCH_END', 'CHECK_OUT'] as const,
    onClose: vi.fn(),
    onSubmit,
  };
}

describe('ModalAddMark', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mocks.getManualMarkContext.mockReset();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  async function render(props: ReturnType<typeof defaultProps>) {
    await act(async () => {
      root.render(<ModalAddMark {...props} missingTypes={[...props.missingTypes]} />);
    });
    // let the context promise resolve
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  }

  it('renders one time input per missing type and fetches the payroll context', async () => {
    mocks.getManualMarkContext.mockResolvedValueOnce(CONTEXT_PAID);
    await render(defaultProps());

    expect(mocks.getManualMarkContext).toHaveBeenCalledWith(7, '2026-07-01');
    expect(container.querySelector('[data-testid="time-input-LUNCH_END"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="time-input-CHECK_OUT"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="time-input-CHECK_IN"]')).toBeNull();
  });

  it('shows the yellow warning when the day falls in a paid period', async () => {
    mocks.getManualMarkContext.mockResolvedValueOnce(CONTEXT_PAID);
    await render(defaultProps());
    expect(container.querySelector('[data-testid="paid-period-warning"]')).not.toBeNull();
  });

  it('hides the warning (and stays usable) when the context endpoint fails', async () => {
    mocks.getManualMarkContext.mockRejectedValueOnce(new Error('404'));
    await render(defaultProps());
    expect(container.querySelector('[data-testid="paid-period-warning"]')).toBeNull();
    expect(container.querySelector('[data-testid="time-input-CHECK_OUT"]')).not.toBeNull();
  });

  it('submits only the filled marks as ISO timestamps on the work date', async () => {
    mocks.getManualMarkContext.mockResolvedValueOnce({ ...CONTEXT_PAID, paidPeriod: false });
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    await render(defaultProps(onSubmit));

    const checkOut = container.querySelector<HTMLInputElement>('[data-testid="time-input-CHECK_OUT"]')!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
      setter.call(checkOut, '17:30');
      checkOut.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const form = container.querySelector('form')!;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const marks = onSubmit.mock.calls[0][0];
    expect(marks).toHaveLength(1);
    expect(marks[0].type).toBe('CHECK_OUT');
    // Local 17:30 on the work date converted to an ISO instant.
    expect(marks[0].capturedAt).toBe(new Date(2026, 6, 1, 17, 30, 0, 0).toISOString());
  });

  it('blocks LUNCH_END without LUNCH_START (payroll dependency chain)', async () => {
    mocks.getManualMarkContext.mockResolvedValueOnce({ ...CONTEXT_PAID, paidPeriod: false });
    const onSubmit = vi.fn();
    // Record has CHECK_IN only → LUNCH_START, LUNCH_END and CHECK_OUT missing.
    const props = { ...defaultProps(onSubmit), missingTypes: ['LUNCH_START', 'LUNCH_END', 'CHECK_OUT'] as const };
    await render(props as unknown as ReturnType<typeof defaultProps>);

    const lunchEnd = container.querySelector<HTMLInputElement>('[data-testid="time-input-LUNCH_END"]')!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
      setter.call(lunchEnd, '13:00');
      lunchEnd.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const form = container.querySelector('form')!;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(container.textContent).toContain('LUNCH_END');
    expect(container.textContent).toContain('LUNCH_START');
  });

  it('does not call onSubmit when no mark is filled', async () => {
    mocks.getManualMarkContext.mockResolvedValueOnce({ ...CONTEXT_PAID, paidPeriod: false });
    const onSubmit = vi.fn();
    await render(defaultProps(onSubmit));

    const form = container.querySelector('form')!;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
