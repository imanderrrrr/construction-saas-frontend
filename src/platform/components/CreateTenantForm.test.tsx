import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createTenant: vi.fn(),
}));

vi.mock('../services/platformDashboard', () => ({
  createTenant: (...args: unknown[]) => mocks.createTenant(...args),
}));

// jsdom ships no matchMedia; motion's reduced-motion probe asks for it when
// the first animation mounts. Answer "no preference" so components render.
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

import { FIELD_LIMITS } from '../../shared/fieldLimits';
import { CreateTenantForm } from './CreateTenantForm';

describe('CreateTenantForm', () => {
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

  const render = (onCreated = vi.fn(), onCancel = vi.fn()) => {
    act(() => {
      root.render(<CreateTenantForm onCancel={onCancel} onCreated={onCreated} />);
    });
    return { onCreated, onCancel };
  };

  // DOM order: company, slug, admin full name, admin username, admin email.
  const inputs = () => Array.from(container.querySelectorAll('input'));
  const buttonByText = (text: string) =>
    Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes(text))!;
  // Plan cards and the billing-interval segments are aria-pressed toggles now,
  // not <select>s (the approved design uses cards + a segmented control).
  const toggleByText = (text: string) =>
    Array.from(container.querySelectorAll('button[aria-pressed]')).find(b =>
      b.textContent?.includes(text),
    )! as HTMLButtonElement;

  const setValue = (el: HTMLInputElement, value: string) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
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

  /**
   * The regression this form exists to prevent: a tenant was created from this
   * screen with a ~100-character junk company name, because not one field here
   * carried a maxLength. Every field must be bounded, at the same number the
   * backend enforces — a limit the server knows and the browser does not just
   * moves the failure to after the user has typed.
   */
  it('bounds every identity field at the shared limit', () => {
    render();
    const [company, slug, fullName, username, email] = inputs();

    expect(company.maxLength).toBe(FIELD_LIMITS.COMPANY_NAME);
    expect(slug.maxLength).toBe(FIELD_LIMITS.WORKSPACE_SLUG);
    expect(fullName.maxLength).toBe(FIELD_LIMITS.PERSON_NAME);
    expect(username.maxLength).toBe(FIELD_LIMITS.USERNAME);
    expect(email.maxLength).toBe(FIELD_LIMITS.EMAIL);
  });

  it('rejects an over-long company name instead of submitting it', () => {
    const { onCreated } = render();
    fillValid();
    const [company] = inputs();

    // maxLength stops a human typing this, but it cannot stop a paste into a
    // detached value or a stale autofill, so the guard has to exist in the
    // validation layer too.
    setValue(company, 'a'.repeat(FIELD_LIMITS.COMPANY_NAME + 1));
    act(() => buttonByText('Create tenant').click());

    expect(mocks.createTenant).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
    expect(container.textContent).toContain(
      `Company name must be at most ${FIELD_LIMITS.COMPANY_NAME} characters.`,
    );
  });

  it('shows a character count as a field approaches its limit', () => {
    render();
    const [company] = inputs();

    // Quiet while there is room left...
    setValue(company, 'Acme');
    expect(container.textContent).not.toContain(`/${FIELD_LIMITS.COMPANY_NAME}`);

    // ...and explicit once the cap is close enough to hit, so a field that
    // stops accepting keystrokes has already said why.
    setValue(company, 'a'.repeat(FIELD_LIMITS.COMPANY_NAME));
    expect(container.textContent).toContain(
      `${FIELD_LIMITS.COMPANY_NAME}/${FIELD_LIMITS.COMPANY_NAME}`,
    );
  });

  it('suggests a slug from the company name, stripping accents', () => {
    render();
    const [company, slug] = inputs();

    setValue(company, 'Obras Pérez');

    expect(slug.value).toBe('obras-perez');
  });

  /**
   * The 20-character identifier cap is short enough that an ordinary
   * two-surname company name overruns it, so the suggestion has to truncate.
   * It must do so at a word boundary: 'construccion-perez-h' is a blunt slice
   * and a miserable thing to type at every login.
   */
  it('truncates a long slug suggestion at a word boundary', () => {
    render();
    const [company, slug] = inputs();

    setValue(company, 'Construcción Pérez & Hijos');

    expect(slug.value).toBe('construccion-perez');
    expect(slug.value.length).toBeLessThanOrEqual(20);
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
    expect(toggleByText('Pro').getAttribute('aria-pressed')).toBe('true');
    expect(toggleByText('Monthly').getAttribute('aria-pressed')).toBe('true');

    act(() => {
      toggleByText('Business').click();
    });
    act(() => {
      toggleByText('Annual').click();
    });
    expect(toggleByText('Business').getAttribute('aria-pressed')).toBe('true');
    expect(toggleByText('Annual').getAttribute('aria-pressed')).toBe('true');

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

  it('hands Cancel to the caller', () => {
    const { onCancel } = render();

    act(() => {
      buttonByText('Cancel').click();
    });

    expect(onCancel).toHaveBeenCalled();
  });
});
