import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createTenant: vi.fn(),
}));

vi.mock('../services/platformDashboard', () => ({
  createTenant: (...args: unknown[]) => mocks.createTenant(...args),
}));

import { CreateTenantDialog } from './CreateTenantDialog';

describe('CreateTenantDialog', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mocks.createTenant.mockReset();
    mocks.createTenant.mockResolvedValue({
      tenantId: 1,
      tenantSlug: 'acme-construcciones',
      companyName: 'Acme Construcciones',
      adminUserId: 2,
      adminUsername: 'ana.admin',
      adminEmail: 'ana@acme.example',
      planCode: 'PRO',
      billingInterval: 'MONTHLY',
      billingStatus: 'ACTIVE',
      billingProvider: 'MANUAL',
      setupLinkSent: true,
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    act(() => {
      root = createRoot(container);
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = (onCreated = vi.fn(), onClose = vi.fn()) => {
    act(() => {
      root.render(<CreateTenantDialog onClose={onClose} onCreated={onCreated} />);
    });
    return { onCreated, onClose };
  };

  const inputs = () => Array.from(container.querySelectorAll('input'));
  const selects = () => Array.from(container.querySelectorAll('select'));
  const buttonByText = (text: string) =>
    Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes(text))!;

  const setValue = (el: HTMLInputElement | HTMLSelectElement, value: string) => {
    const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')!.set!;
    act(() => {
      setter.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
  };

  const fillValid = () => {
    const [company, slug, fullName, username, email] = inputs();
    setValue(company, 'Acme Construcciones');
    setValue(slug, 'acme-construcciones');
    setValue(fullName, 'Ana Admin');
    setValue(username, 'ana.admin');
    setValue(email, 'ana@acme.example');
  };

  /**
   * The guarantee the whole flow rests on: staff never know the customer's
   * password. There must be nowhere to type one.
   */
  it('has no password field', () => {
    render();

    expect(container.querySelector('input[type="password"]')).toBeNull();
    expect(container.textContent?.toLowerCase()).not.toContain('password to');
    inputs().forEach(i => {
      expect(i.getAttribute('placeholder')?.toLowerCase() ?? '').not.toContain('password');
    });
  });

  it('suggests a slug from the company name, stripping accents', () => {
    render();
    const [company, slug] = inputs();

    setValue(company, 'Construcción Pérez & Hijos');

    expect(slug.value).toBe('construccion-perez-hijos');
  });

  it('stops auto-filling the slug once staff edit it', () => {
    render();
    const [company, slug] = inputs();

    setValue(slug, 'my-own-slug');
    setValue(company, 'Something Else Entirely');

    expect(slug.value).toBe('my-own-slug');
  });

  it('submits the form and hands the result to onCreated', async () => {
    const { onCreated } = render();
    fillValid();

    await act(async () => {
      buttonByText('Create tenant').click();
    });

    expect(mocks.createTenant).toHaveBeenCalledWith({
      companyName: 'Acme Construcciones',
      tenantSlug: 'acme-construcciones',
      adminUsername: 'ana.admin',
      adminFullName: 'Ana Admin',
      adminEmail: 'ana@acme.example',
      planCode: 'PRO',
      billingInterval: 'MONTHLY',
    });
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 1 }));
  });

  it('defaults to PRO / MONTHLY and lets staff pick BUSINESS / ANNUAL', async () => {
    render();
    fillValid();
    const [plan, interval] = selects();
    expect(plan.value).toBe('PRO');
    expect(interval.value).toBe('MONTHLY');

    setValue(plan, 'BUSINESS');
    setValue(interval, 'ANNUAL');
    await act(async () => {
      buttonByText('Create tenant').click();
    });

    expect(mocks.createTenant).toHaveBeenCalledWith(
      expect.objectContaining({ planCode: 'BUSINESS', billingInterval: 'ANNUAL' }),
    );
  });

  it('rejects a slug the backend would reject, without calling the API', async () => {
    render();
    fillValid();
    setValue(inputs()[1], 'Not A Slug');

    await act(async () => {
      buttonByText('Create tenant').click();
    });

    expect(mocks.createTenant).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('lowercase');
  });

  it('requires an admin email — the set-up link has nowhere to go without one', async () => {
    render();
    fillValid();
    setValue(inputs()[4], '');

    await act(async () => {
      buttonByText('Create tenant').click();
    });

    expect(mocks.createTenant).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('email');
  });

  it('surfaces a backend error and stays open', async () => {
    mocks.createTenant.mockRejectedValueOnce(
      Object.assign(new Error('That tenant identifier is already taken.'), { code: 'TENANT_SLUG_TAKEN' }),
    );
    const { onCreated } = render();
    fillValid();

    await act(async () => {
      buttonByText('Create tenant').click();
    });

    expect(container.querySelector('[role="alert"]')?.textContent).toContain('already taken');
    expect(onCreated).not.toHaveBeenCalled();
    expect(buttonByText('Create tenant')).toBeTruthy();
  });
});
