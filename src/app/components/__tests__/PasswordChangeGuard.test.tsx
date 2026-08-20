// BuildTrack — PasswordChangeGuard tests.
//
// The guard decides what an authenticated user sees while their password is
// still the one an admin issued:
//   - login already said "required" → the change screen, no /auth/me call
//   - login already said "not required" → children, no /auth/me call
//   - nothing known (cookie-restored session) → ask /auth/me, then either
//   - /auth/me fails → fail OPEN and render children (the backend is the wall;
//     failing closed would strand a user whose password is fine)
//   - completing the change reveals the children without a reload
//
// The screen itself is stubbed: what matters here is which branch renders,
// and ForcedPasswordChange has its own concerns (form, errors, sign out).

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getMe: vi.fn(),
}));

vi.mock('../../services/auth', () => ({
  AuthService: { getMe: mocks.getMe },
}));

// Stand-in for the real screen, with a button that fires its onChanged so the
// "block lifts in place" path is exercised without touching the form.
vi.mock('../ForcedPasswordChange', () => ({
  ForcedPasswordChange: ({ onChanged }: { onChanged: () => void }) => (
    <button data-testid="change-screen" onClick={onChanged}>change</button>
  ),
}));

import { PasswordChangeGuard } from '../PasswordChangeGuard';
import {
  setPasswordChangeRequired,
  clearPasswordChangeState,
} from '../../lib/passwordChangeState';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('PasswordChangeGuard', () => {
  let container: HTMLDivElement;
  let root: Root;

  const child = <p data-testid="dashboard">dashboard</p>;

  const has = (id: string) => !!container.querySelector(`[data-testid="${id}"]`);

  beforeEach(() => {
    mocks.getMe.mockReset();
    clearPasswordChangeState();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
    clearPasswordChangeState();
  });

  async function render() {
    await act(async () => {
      root.render(<PasswordChangeGuard>{child}</PasswordChangeGuard>);
      await flush();
    });
  }

  it('shows the change screen when login said the password is temporary', async () => {
    setPasswordChangeRequired(true);
    await render();

    expect(has('change-screen')).toBe(true);
    expect(has('dashboard')).toBe(false);
    // Login already answered the question — no reason to ask again.
    expect(mocks.getMe).not.toHaveBeenCalled();
  });

  it('renders the dashboard when login said the password is the user\'s own', async () => {
    setPasswordChangeRequired(false);
    await render();

    expect(has('dashboard')).toBe(true);
    expect(has('change-screen')).toBe(false);
    expect(mocks.getMe).not.toHaveBeenCalled();
  });

  it('asks /auth/me when the session was restored from a cookie', async () => {
    mocks.getMe.mockResolvedValue({
      username: 'ana', role: 'ADMIN', passwordChangeRequired: true,
    });
    await render();

    expect(mocks.getMe).toHaveBeenCalledTimes(1);
    expect(has('change-screen')).toBe(true);
    expect(has('dashboard')).toBe(false);
  });

  it('lets a cookie-restored session through when its password is its own', async () => {
    mocks.getMe.mockResolvedValue({
      username: 'ana', role: 'ADMIN', passwordChangeRequired: false,
    });
    await render();

    expect(has('dashboard')).toBe(true);
    expect(has('change-screen')).toBe(false);
  });

  it('treats a backend with no such field as not blocked', async () => {
    // Deploy ordering safety: the frontend can be live against a backend that
    // predates the field. Absent must read as "not blocked" rather than
    // locking every user behind a form.
    mocks.getMe.mockResolvedValue({ username: 'ana', role: 'ADMIN' });
    await render();

    expect(has('dashboard')).toBe(true);
  });

  it('fails OPEN when /auth/me errors', async () => {
    mocks.getMe.mockRejectedValue(new Error('network'));
    await render();

    // The backend still refuses everything if the password really is
    // temporary, and api() routes the user here on the first 403. Failing
    // closed would instead trap a perfectly fine user behind the form.
    expect(has('dashboard')).toBe(true);
  });

  it('reveals the dashboard as soon as the password is changed, without a reload', async () => {
    setPasswordChangeRequired(true);
    await render();
    expect(has('change-screen')).toBe(true);

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="change-screen"]')!.click();
      await flush();
    });

    // Same mounted tree, same route — the backend lifted the block on this
    // session, so there is nothing to navigate to.
    expect(has('dashboard')).toBe(true);
    expect(has('change-screen')).toBe(false);
  });
});
