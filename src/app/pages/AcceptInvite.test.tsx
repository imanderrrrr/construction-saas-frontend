import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// vi.mock factories are hoisted above every import, so anything they
// reference has to be hoisted with them.
const { FakeApiError } = vi.hoisted(() => ({
  FakeApiError: class FakeApiError extends Error {
    status: number; details?: unknown; code?: string; retryAfterSeconds?: number;
    constructor(status: number, message: string, details?: unknown, code?: string, retryAfterSeconds?: number) {
      super(message);
      this.name = 'ApiError';
      this.status = status; this.details = details; this.code = code; this.retryAfterSeconds = retryAfterSeconds;
    }
  },
}));

const mocks = vi.hoisted(() => ({
  preview: vi.fn(),
  accept: vi.fn(),
  navigate: vi.fn(),
  startWelcome: vi.fn(),
  setWelcomeCompany: vi.fn(),
  setPasswordChangeRequired: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (!opts) return key;
      const parts = Object.entries(opts).filter(([k]) => ['count', 'minutes', 'tenant', 'role', 'name', 'date'].includes(k)).map(([, v]) => String(v));
      return parts.length ? `${key}#${parts.join('|')}` : key;
    },
    i18n: { language: 'es' },
  }),
}));

vi.mock('react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
  useNavigate: () => mocks.navigate,
  useParams: () => ({ token: 'inv-123' }),
}));

vi.mock('../lib/api', () => ({ ApiError: FakeApiError, getStoredTenantSlug: () => '' }));
vi.mock('../services/auth', () => ({
  ApiError: FakeApiError,
  AuthService: { getDashboardRoute: (role: string) => `/${role.toLowerCase()}/dashboard` },
}));
vi.mock('../services/invitations', () => ({
  InvitationsService: { preview: mocks.preview, accept: mocks.accept },
}));
vi.mock('../lib/welcome', () => ({ startWelcome: mocks.startWelcome, setWelcomeCompany: mocks.setWelcomeCompany }));
vi.mock('../lib/passwordChangeState', () => ({ setPasswordChangeRequired: mocks.setPasswordChangeRequired }));
vi.mock('../components/LanguageSwitcher', () => ({ LanguageSwitcher: () => <span data-testid="language-switcher" /> }));

import { AcceptInvite, suggestUsernames } from './AcceptInvite';
import { DONE_MS } from './ResetPassword';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const PREVIEW = { role: 'SUPERVISOR', tenantName: 'Constructora Andes', tenantSlug: 'constructora-andes', invitedByName: 'Pedro García', expiresAt: '2026-09-12T00:00:00Z' };
const SESSION = { accessToken: '', refreshToken: '', role: 'SUPERVISOR', username: 'otto.ramirez', fullName: 'Otto Ramírez', expiresIn: 1, expiresInMinutes: 480 };

async function flush() { await act(async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); }); }

async function type(container: HTMLElement, id: string, value: string) {
  const input = container.querySelector<HTMLInputElement>(`#${id}`)!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function fill(container: HTMLElement) {
  await type(container, 'fullName', 'Otto Ramírez');
  await type(container, 'username', 'otto.ramirez');
  await type(container, 'password', 'andes-obra-26');
}

async function submit(container: HTMLElement) {
  await act(async () => {
    container.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    for (let i = 0; i < 8; i++) await Promise.resolve();
  });
}

describe('suggestUsernames', () => {
  it('offers three alternatives built from the username and the name', () => {
    expect(suggestUsernames('otto.ramirez', 'Otto Ramírez')).toEqual(['otto.ramirez2', 'o.ramirez', 'otto.r']);
  });
  it('never repeats the taken name and only offers valid usernames', () => {
    const out = suggestUsernames('ana', 'Ana');
    expect(out).not.toContain('ana');
    out.forEach(s => expect(s).toMatch(/^[a-zA-Z0-9._-]+$/));
  });
});

describe('AcceptInvite', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.values(mocks).forEach(m => m.mockReset());
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  async function render() {
    await act(async () => { root.render(<AcceptInvite />); });
    await flush();
  }

  it('shows the workspace, the role (lowercase in sentences), who invited and when it expires', async () => {
    mocks.preview.mockResolvedValueOnce(PREVIEW);
    await render();
    const text = container.textContent!;
    expect(text).toContain('acceptInvite.hero.title#Constructora Andes');
    expect(text).toContain('acceptInvite.hero.body#Pedro García|role.supervisor');
    expect(text).toContain('acceptInvite.subtitle#Constructora Andes|role.supervisor');
    expect(text).toContain('acceptInvite.seal.invitedBy#Pedro García|');
    expect(text).toContain('acceptInvite.username.hint');
    expect(container.querySelector<HTMLInputElement>('#password')!.type).toBe('password');
  });

  it('has a wording for an invitation without an inviter', async () => {
    mocks.preview.mockResolvedValueOnce({ ...PREVIEW, invitedByName: null });
    await render();
    expect(container.textContent).toContain('acceptInvite.hero.bodyNoInviter#role.supervisor');
    expect(container.textContent).toContain('acceptInvite.seal.noInviter#');
  });

  it('a dead invitation (410) has no form and no primary button', async () => {
    mocks.preview.mockRejectedValueOnce(new FakeApiError(410, 'gone'));
    await render();
    expect(container.querySelector('[data-testid="invite-invalid"]')).not.toBeNull();
    expect(container.querySelector('#password')).toBeNull();
    expect(container.querySelector('button[type="submit"]')).toBeNull();
    expect(container.textContent).toContain('acceptInvite.invalid.goLogin');
  });

  it('on success shows "Cuenta creada", then starts the welcome and enters the role panel', async () => {
    mocks.preview.mockResolvedValueOnce(PREVIEW);
    mocks.accept.mockResolvedValueOnce(SESSION);
    await render();
    await fill(container);
    vi.useFakeTimers();
    await submit(container);

    expect(mocks.accept).toHaveBeenCalledWith('inv-123', { fullName: 'Otto Ramírez', username: 'otto.ramirez', password: 'andes-obra-26' });
    const done = container.querySelector('[data-testid="auth-done"]');
    expect(done).not.toBeNull();
    expect(done!.textContent).toContain('acceptInvite.done.title');
    expect(done!.textContent).toContain('Otto Ramírez');

    await act(async () => { vi.advanceTimersByTime(DONE_MS + 10); });
    expect(mocks.startWelcome).toHaveBeenCalledWith('Otto Ramírez');
    expect(mocks.setWelcomeCompany).toHaveBeenCalledWith('Constructora Andes');
    expect(mocks.navigate).toHaveBeenCalledWith('/supervisor/dashboard');
  });

  it('a taken username (409) is said under the field with three suggestions that fill it in', async () => {
    mocks.preview.mockResolvedValueOnce(PREVIEW);
    mocks.accept.mockRejectedValueOnce(new FakeApiError(409, 'taken', undefined, 'USERNAME_TAKEN'));
    await render();
    await fill(container);
    await submit(container);

    const taken = container.querySelector('[data-testid="username-taken"]');
    expect(taken).not.toBeNull();
    expect(taken!.textContent).toContain('acceptInvite.usernameTaken#Constructora Andes');
    const chips = Array.from(taken!.querySelectorAll('button'));
    expect(chips.map(c => c.textContent)).toEqual(['otto.ramirez2', 'o.ramirez', 'otto.r']);

    await act(async () => { chips[1].click(); });
    expect(container.querySelector<HTMLInputElement>('#username')!.value).toBe('o.ramirez');
    expect(container.querySelector('[data-testid="username-taken"]')).toBeNull();
  });

  it('maps the other failures: 429 → minutes, 400 → check the fields, 500 → server notice, 410 → dead invitation', async () => {
    mocks.preview.mockResolvedValue(PREVIEW);
    mocks.accept
      .mockRejectedValueOnce(new FakeApiError(429, 'slow', undefined, 'RATE_LIMITED'))
      .mockRejectedValueOnce(new FakeApiError(400, 'bad', undefined, 'VALIDATION_ERROR'))
      .mockRejectedValueOnce(new FakeApiError(500, 'boom'))
      .mockRejectedValueOnce(new FakeApiError(410, 'gone'));
    await render();
    await fill(container);

    await submit(container);
    expect(container.textContent).toContain('acceptInvite.error.rateLimited.message#30');
    await submit(container);
    expect(container.textContent).toContain('acceptInvite.error.validation.title');
    await submit(container);
    expect(container.textContent).toContain('acceptInvite.error.server.title');
    await submit(container);
    expect(container.querySelector('[data-testid="invite-invalid"]')).not.toBeNull();
  });
});
