// BuildTrack — the credential card has to carry the workspace identifier.
//
// Signing in takes THREE things, not two: the login screen asks for a company
// identifier before username and password. The admin's browser fills that
// field from the long-lived `bt_tenant` cookie, so the admin never notices it
// is missing — but the person receiving the credential opens the app on their
// own machine, where the field is blank and nothing on the card says what to
// type. A blank identifier resolves to the "default" tenant, the lookup misses,
// and login answers "invalid credentials".
//
// So the card prints the identifier alongside the username and password, using
// the same label the login screen uses.
//
// The legacy single-tenant deployment is the exception: its cookie reads
// "default", and those users are explicitly told to leave the field blank.
// Printing "default" there would tell them to type the one thing they must not.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createUser: vi.fn(),
  getStoredTenantSlug: vi.fn(),
}));

// initReactI18next is needed because the real lib/api (kept below via
// importOriginal) pulls in src/i18n — same shape the other component tests use.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'es-GT' } }),
  Trans: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

vi.mock('../../services/users', () => ({
  createUser: mocks.createUser,
  getWorkerQr: vi.fn(() => Promise.resolve({ qrToken: 'unused-for-office-roles' })),
  setWorkerPin: vi.fn(() => Promise.resolve()),
}));

// Keep the rest of lib/api real; only the cookie reader is steered per test.
vi.mock('../../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/api')>()),
  getStoredTenantSlug: mocks.getStoredTenantSlug,
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
  mocks.getStoredTenantSlug.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

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

/** Identity → office role → access step, the way an admin walks it. */
async function reachCredentialStep() {
  await act(async () => {
    root.render(
      <NewUserFlow existingUsernames={[]} onClose={() => {}} onCreated={() => {}} />,
    );
  });
  const nameInput = container.querySelector('input') as HTMLInputElement;
  await act(async () => typeInto(nameInput, 'Carlos Contador'));
  await act(async () => buttonByText('common:roles.FINANCE').click());
  await act(async () => buttonByText('admin:usr.new.next').click());
}

/** Walks on to the printable hand-over card. */
async function reachHandoverCard() {
  mocks.createUser.mockResolvedValue({
    id: 7, username: 'carlos.contador', fullName: 'Carlos Contador',
    role: 'FINANCE', status: 'ACTIVE', hourlyRate: null,
    createdAt: '2026-08-19T00:00:00Z', updatedAt: '2026-08-19T00:00:00Z',
  });
  await act(async () => buttonByText('admin:usr.new.create').click());
}

const labelled = () => container.textContent || '';

describe('credential card · workspace identifier', () => {
  it('prints the workspace identifier on the access step and the hand-over card', async () => {
    mocks.getStoredTenantSlug.mockReturnValue('vista-del-mar');

    await reachCredentialStep();
    expect(labelled()).toContain('admin:usr.new.workspace');
    expect(labelled()).toContain('vista-del-mar');

    await reachHandoverCard();
    // The printable card is the thing that actually leaves the room.
    expect(labelled()).toContain('admin:usr.new.workspace');
    expect(labelled()).toContain('vista-del-mar');
  });

  it('uses the same label the login screen asks for', async () => {
    mocks.getStoredTenantSlug.mockReturnValue('vista-del-mar');
    await reachCredentialStep();

    // Rendered next to username and password, not buried elsewhere.
    const row = [...container.querySelectorAll('span.font-bt-mono')]
      .find(el => (el.textContent || '').trim() === 'vista-del-mar');
    expect(row, 'workspace identifier not rendered in the credential block').toBeTruthy();
  });

  it('omits the row on the legacy default tenant, where the field is left blank', async () => {
    mocks.getStoredTenantSlug.mockReturnValue('default');

    await reachCredentialStep();
    expect(labelled()).not.toContain('admin:usr.new.workspace');
    expect(labelled()).not.toContain('default');

    await reachHandoverCard();
    expect(labelled()).not.toContain('admin:usr.new.workspace');
  });

  it('omits the row when no workspace cookie is present', async () => {
    mocks.getStoredTenantSlug.mockReturnValue(null);

    await reachCredentialStep();
    expect(labelled()).not.toContain('admin:usr.new.workspace');
  });

  it('leaves the field credential alone — QR + PIN needs no identifier', async () => {
    mocks.getStoredTenantSlug.mockReturnValue('vista-del-mar');

    await act(async () => {
      root.render(
        <NewUserFlow existingUsernames={[]} onClose={() => {}} onCreated={() => {}} />,
      );
    });
    const nameInput = container.querySelector('input') as HTMLInputElement;
    await act(async () => typeInto(nameInput, 'Pedro Obrero'));
    // WORKER is the default role: field access, QR + PIN, no password.
    await act(async () => buttonByText('admin:usr.new.next').click());

    expect(labelled()).not.toContain('admin:usr.new.workspace');
  });
});
