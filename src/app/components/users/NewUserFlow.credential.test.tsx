// BuildTrack — the temporary-password credential card must be transcribable.
//
// Regression for the "created an office user, the temp password is rejected as
// invalid credentials" bug. Nothing was wrong with hashing or the login check:
// the credential card RENDERED the password upper-cased while the mixed-case
// original was what got stored. The admin copied "LA7R-MHC7" off the screen,
// the account held "LA7r-MHC7", and login answered 401.
//
// The cause was <Mono>, which baked `uppercase` into its own className and
// appended the caller's. `normal-case` and `uppercase` both set text-transform
// at the same specificity, so the winner came from the order Tailwind emits
// them in the stylesheet — and `.uppercase` is emitted AFTER `.normal-case`.
// The caller's `normal-case` could never win, whatever the attribute order.
//
// So this test asserts the invariant the admin depends on: the credential the
// screen shows is character-for-character the credential that was sent to the
// backend. It checks the class list rather than a rendered pixel because jsdom
// does not apply a stylesheet — a `uppercase` class surviving on that element
// IS the bug, and is exactly what the fix removes.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createUser: vi.fn(),
}));

vi.mock('react-i18next', () => {
  const t = (key: string) => key;
  const i18n = { language: 'es-GT' };
  return { useTranslation: () => ({ t, i18n }) };
});

vi.mock('../../services/users', () => ({
  createUser: mocks.createUser,
  getWorkerQr: vi.fn(() => Promise.resolve({ qrToken: 'unused-for-office-roles' })),
  setWorkerPin: vi.fn(() => Promise.resolve()),
}));

vi.mock('qrcode', () => ({ default: { toCanvas: vi.fn(() => Promise.resolve()) } }));

import { NewUserFlow } from './NewUserFlow';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  mocks.createUser.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/** Utilities that rewrite the glyphs the reader sees. */
const TRANSFORMING = ['uppercase', 'lowercase', 'capitalize'];

function transformingClasses(el: Element): string[] {
  return [...el.classList].filter(c => TRANSFORMING.includes(c));
}

/** React's onChange needs the native setter to see a real value change. */
function typeInto(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype, 'value',
  )!.set!;
  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function buttonByText(text: string): HTMLButtonElement {
  const found = [...container.querySelectorAll('button')]
    .find(b => (b.textContent || '').includes(text));
  if (!found) throw new Error(`no button containing "${text}"`);
  return found as HTMLButtonElement;
}

/** Drives the wizard the way an admin does: name → office role → next. */
async function reachCredentialStep() {
  await act(async () => {
    root.render(
      <NewUserFlow existingUsernames={[]} onClose={() => {}} onCreated={() => {}} />,
    );
  });

  const nameInput = container.querySelector('input') as HTMLInputElement;
  await act(async () => typeInto(nameInput, 'Carlos Contador'));

  // FINANCE is an office role: password, not QR + PIN.
  await act(async () => buttonByText('common:roles.FINANCE').click());
  await act(async () => buttonByText('admin:usr.new.next').click());
}

/** The element rendering the temp password on the credential card. */
function passwordCell(): HTMLElement {
  const cell = [...container.querySelectorAll('span.font-bt-mono')]
    .find(el => /^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/.test((el.textContent || '').trim()));
  if (!cell) throw new Error('temp password not rendered on the credential card');
  return cell as HTMLElement;
}

describe('new-user credential card', () => {
  it('shows the temp password exactly as it is sent to the backend', async () => {
    await reachCredentialStep();

    const shown = (passwordCell().textContent || '').trim();

    // The password the admin reads must survive being rendered: no
    // text-transform may sit on it, or the glyphs on screen stop matching
    // the string that was hashed.
    expect(transformingClasses(passwordCell())).toEqual([]);

    mocks.createUser.mockResolvedValue({
      id: 7, username: 'carlos.contador', fullName: 'Carlos Contador',
      role: 'FINANCE', status: 'ACTIVE', hourlyRate: null,
      createdAt: '2026-08-19T00:00:00Z', updatedAt: '2026-08-19T00:00:00Z',
    });

    await act(async () => buttonByText('admin:usr.new.create').click());

    // What the backend stored is what step 2 displayed…
    const sent = mocks.createUser.mock.calls[0][0].password;
    expect(sent).toBe(shown);

    // …and the hand-over card repeats it untransformed, so an admin who
    // copies it character-for-character can actually sign in.
    expect((passwordCell().textContent || '').trim()).toBe(sent);
    expect(transformingClasses(passwordCell())).toEqual([]);
  });

  it('shows the username exactly as it is sent, so the exact-match lookup finds it', async () => {
    await reachCredentialStep();

    mocks.createUser.mockResolvedValue({
      id: 7, username: 'carlos.contador', fullName: 'Carlos Contador',
      role: 'FINANCE', status: 'ACTIVE', hourlyRate: null,
      createdAt: '2026-08-19T00:00:00Z', updatedAt: '2026-08-19T00:00:00Z',
    });
    await act(async () => buttonByText('admin:usr.new.create').click());

    // findByTenantIdAndUsername is an exact match: an upper-cased username on
    // the card sends the new user to a lookup that returns nothing.
    const usernameCell = [...container.querySelectorAll('span.font-bt-mono')]
      .find(el => (el.textContent || '').trim() === 'carlos.contador');
    expect(usernameCell, 'username not rendered on the credential card').toBeTruthy();
    expect(transformingClasses(usernameCell!)).toEqual([]);
  });
});
