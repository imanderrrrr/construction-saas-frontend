import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { ApiError, NoResponseError } from '../../../lib/api';
import { TurnstileUnavailableError } from '../../../lib/turnstile';
import type { ChatReply } from '../../../services/landingAssistant';
import type { LeadFormValues } from './leadForm';
import {
  MAX_MESSAGE_CHARS,
  MAX_USER_TURNS,
  useAssistantChat,
  type AssistantDeps,
} from './useAssistantChat';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

type Hook = ReturnType<typeof useAssistantChat>;

let container: HTMLDivElement;
let root: Root;
let hook: Hook;
let sendChat: Mock;
let submitLead: Mock;
let getTurnstileToken: Mock;

function Probe({ deps, language, onState }: { deps: AssistantDeps; language: string; onState: (h: Hook) => void }) {
  onState(useAssistantChat(language, deps));
  return null;
}

async function mount(language = 'es') {
  const deps = { sendChat, submitLead, getTurnstileToken } as unknown as AssistantDeps;
  await act(async () => {
    root.render(<Probe deps={deps} language={language} onState={(h) => { hook = h; }} />);
  });
}

function reply(text: string, extra: Partial<ChatReply> = {}): ChatReply {
  return { reply: text, contactForm: null, sessionToken: 'session-1', ...extra };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const validForm: LeadFormValues = {
  name: 'Ana Prueba',
  company: 'Constructora Ejemplo',
  contact: 'ana@ejemplo.test',
  interest: 'DEMO',
  consent: true,
};

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  sendChat = vi.fn().mockResolvedValue(reply('Hola'));
  submitLead = vi.fn().mockResolvedValue(undefined);
  getTurnstileToken = vi.fn().mockResolvedValue('turnstile-1');
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe('useAssistantChat — sending', () => {
  it('starts in the chat view with no messages', async () => {
    await mount();
    expect(hook.view).toBe('chat');
    expect(hook.messages).toEqual([]);
    expect(hook.userTurns).toBe(0);
    expect(MAX_USER_TURNS).toBe(10);
    expect(MAX_MESSAGE_CHARS).toBe(500);
  });

  it('send ignores blank text and text over 500 characters without calling the service', async () => {
    await mount();
    await act(async () => {
      await hook.send('   ');
      await hook.send('a'.repeat(501));
    });
    expect(sendChat).not.toHaveBeenCalled();
    expect(getTurnstileToken).not.toHaveBeenCalled();
    expect(hook.messages).toEqual([]);
  });

  it('a second send while one is in flight is ignored', async () => {
    const pending = deferred<ChatReply>();
    sendChat.mockReturnValueOnce(pending.promise);
    await mount();

    let first!: Promise<void>;
    await act(async () => {
      first = hook.send('uno');
      void hook.send('dos');
    });
    expect(hook.sending).toBe(true);
    expect(sendChat).toHaveBeenCalledTimes(1);
    expect(hook.messages).toEqual([{ role: 'user', content: 'uno' }]);

    await act(async () => {
      pending.resolve(reply('Respuesta'));
      await first;
    });
    expect(hook.sending).toBe(false);
    expect(hook.messages).toEqual([
      { role: 'user', content: 'uno' },
      { role: 'assistant', content: 'Respuesta' },
    ]);
  });

  it('the first send gets a Turnstile token and sends no sessionToken; the returned sessionToken is used by the second send, which gets no token', async () => {
    sendChat.mockResolvedValueOnce(reply('Uno', { sessionToken: 'session-abc' }));
    await mount('en-US');

    await act(async () => {
      await hook.send('first');
    });
    expect(getTurnstileToken).toHaveBeenCalledTimes(1);
    expect(sendChat).toHaveBeenLastCalledWith({
      language: 'en-US',
      messages: [{ role: 'user', content: 'first' }],
      sessionToken: undefined,
      turnstileToken: 'turnstile-1',
    });

    await act(async () => {
      await hook.send('second');
    });
    expect(getTurnstileToken).toHaveBeenCalledTimes(1);
    expect(sendChat).toHaveBeenLastCalledWith({
      language: 'en-US',
      messages: [
        { role: 'user', content: 'first' },
        { role: 'assistant', content: 'Uno' },
        { role: 'user', content: 'second' },
      ],
      sessionToken: 'session-abc',
      turnstileToken: undefined,
    });
  });

  it('trims the text it sends', async () => {
    await mount();
    await act(async () => {
      await hook.send('  hola  ');
    });
    expect(hook.messages[0]).toEqual({ role: 'user', content: 'hola' });
  });

  it('SESSION_EXPIRED clears the sessionToken, gets a fresh token and retries the same message once without showing a notice', async () => {
    sendChat
      .mockResolvedValueOnce(reply('Uno', { sessionToken: 'old-session' }))
      .mockRejectedValueOnce(new ApiError(422, 'expired', undefined, 'SESSION_EXPIRED'))
      .mockResolvedValueOnce(reply('Dos', { sessionToken: 'new-session' }));
    getTurnstileToken.mockResolvedValueOnce('turnstile-1').mockResolvedValueOnce('turnstile-2');
    await mount();

    await act(async () => {
      await hook.send('uno');
    });
    await act(async () => {
      await hook.send('dos');
    });

    expect(sendChat).toHaveBeenCalledTimes(3);
    expect(sendChat.mock.calls[1][0]).toMatchObject({ sessionToken: 'old-session', turnstileToken: undefined });
    expect(sendChat.mock.calls[2][0]).toMatchObject({ sessionToken: undefined, turnstileToken: 'turnstile-2' });
    expect(sendChat.mock.calls[2][0].messages).toEqual(sendChat.mock.calls[1][0].messages);
    expect(hook.notice).toBeNull();
    expect(hook.messages.map((m) => m.content)).toEqual(['uno', 'Uno', 'dos', 'Dos']);

    await act(async () => {
      await hook.send('tres');
    });
    expect(sendChat.mock.calls[3][0]).toMatchObject({ sessionToken: 'new-session' });
  });

  it('a second SESSION_EXPIRED shows unavailable', async () => {
    sendChat.mockRejectedValue(new ApiError(422, 'expired', undefined, 'SESSION_EXPIRED'));
    await mount();

    await act(async () => {
      await hook.send('hola');
    });

    expect(sendChat).toHaveBeenCalledTimes(2);
    expect(hook.notice).toBe('unavailable');
  });

  it('a reply with contactForm moves the view to form with that interest', async () => {
    sendChat.mockResolvedValueOnce(reply('Te dejo el formulario.', { contactForm: { interest: 'BETA' } }));
    await mount();

    await act(async () => {
      await hook.send('Quiero la beta');
    });

    expect(hook.view).toBe('form');
    expect(hook.formInterest).toBe('BETA');
    expect(hook.messages.at(-1)).toEqual({ role: 'assistant', content: 'Te dejo el formulario.' });
  });

  it('the 10th visitor message is accepted and the 11th is ignored with notice turn_limit', async () => {
    await mount();
    for (let i = 1; i <= 9; i++) {
      await act(async () => {
        await hook.send(`pregunta ${i}`);
      });
    }
    expect(hook.notice).toBeNull();

    await act(async () => {
      await hook.send('pregunta 10');
    });
    expect(sendChat).toHaveBeenCalledTimes(10);
    expect(hook.userTurns).toBe(10);
    // Nothing more can be sent, so the limit shows as soon as the 10th answer is in.
    expect(hook.notice).toBe('turn_limit');

    await act(async () => {
      await hook.send('pregunta 11');
    });
    expect(sendChat).toHaveBeenCalledTimes(10);
    expect(hook.userTurns).toBe(10);
    expect(hook.notice).toBe('turn_limit');
  });

  it('a TURN_LIMIT from the server sets notice turn_limit', async () => {
    sendChat.mockRejectedValueOnce(new ApiError(422, 'limit', undefined, 'TURN_LIMIT'));
    await mount();

    await act(async () => {
      await hook.send('hola');
    });

    expect(hook.notice).toBe('turn_limit');
  });

  it.each([
    ['503 ASSISTANT_DISABLED', new ApiError(503, 'off', undefined, 'ASSISTANT_DISABLED'), 'unavailable'],
    ['400 INVALID_CHAT_REQUEST', new ApiError(400, 'bad', undefined, 'INVALID_CHAT_REQUEST'), 'unavailable'],
    ['a timeout', new NoResponseError(true, new Error('aborted')), 'unavailable'],
    ['429 RATE_LIMITED', new ApiError(429, 'slow down', undefined, 'RATE_LIMITED'), 'rate_limited'],
    ['422 TURNSTILE_FAILED', new ApiError(422, 'bot?', undefined, 'TURNSTILE_FAILED'), 'verify_failed'],
  ])('%s sets notice %s, keeps the visitor message and adds no bot message', async (_label, error, expected) => {
    sendChat.mockRejectedValueOnce(error);
    await mount();

    await act(async () => {
      await hook.send('hola');
    });

    expect(hook.notice).toBe(expected);
    expect(hook.messages).toEqual([{ role: 'user', content: 'hola' }]);
    expect(hook.sending).toBe(false);
  });

  it('a Turnstile unavailable error sets unavailable and logs nothing to the console', async () => {
    const spies = (['error', 'warn', 'log', 'info'] as const).map((level) => vi.spyOn(console, level));
    getTurnstileToken.mockRejectedValueOnce(new TurnstileUnavailableError());
    await mount();

    await act(async () => {
      await hook.send('hola');
    });

    expect(hook.notice).toBe('unavailable');
    expect(sendChat).not.toHaveBeenCalled();
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });

  it('a new message clears the previous notice', async () => {
    sendChat.mockRejectedValueOnce(new ApiError(429, 'slow down', undefined, 'RATE_LIMITED'));
    await mount();
    await act(async () => {
      await hook.send('uno');
    });
    expect(hook.notice).toBe('rate_limited');

    await act(async () => {
      await hook.send('dos');
    });
    expect(hook.notice).toBeNull();
  });

  it('retry re-sends the conversation as it stands, without adding the visitor message again', async () => {
    sendChat.mockRejectedValueOnce(new ApiError(422, 'bot?', undefined, 'TURNSTILE_FAILED'));
    getTurnstileToken.mockResolvedValueOnce('turnstile-1').mockResolvedValueOnce('turnstile-2');
    await mount();
    await act(async () => {
      await hook.send('hola');
    });
    expect(hook.notice).toBe('verify_failed');

    await act(async () => {
      await hook.retry();
    });

    expect(sendChat).toHaveBeenCalledTimes(2);
    expect(sendChat.mock.calls[1][0]).toMatchObject({
      messages: [{ role: 'user', content: 'hola' }],
      turnstileToken: 'turnstile-2',
    });
    expect(hook.notice).toBeNull();
    expect(hook.messages).toEqual([
      { role: 'user', content: 'hola' },
      { role: 'assistant', content: 'Hola' },
    ]);
  });
});

describe('useAssistantChat — form', () => {
  it('openForm sets view form with the given interest and backToChat returns to chat', async () => {
    await mount();

    act(() => hook.openForm('BETA'));
    expect(hook.view).toBe('form');
    expect(hook.formInterest).toBe('BETA');

    act(() => hook.backToChat());
    expect(hook.view).toBe('chat');

    act(() => hook.openForm());
    expect(hook.view).toBe('form');
    expect(hook.formInterest).toBeNull();
  });

  it('submit with invalid values returns the field errors and does not call the service', async () => {
    await mount();
    let errors: unknown;
    await act(async () => {
      errors = await hook.submit({ ...validForm, name: 'A', contact: 'ana@' });
    });

    expect(errors).toEqual({ name: 'name', contact: 'email' });
    expect(submitLead).not.toHaveBeenCalled();
    expect(getTurnstileToken).not.toHaveBeenCalled();
  });

  it('submit with valid values calls submitLead once with source FORM without a conversation; success sets view done', async () => {
    await mount('es');
    act(() => hook.openForm('DEMO'));
    let errors: unknown;
    await act(async () => {
      errors = await hook.submit(validForm);
    });

    expect(errors).toBeNull();
    expect(submitLead).toHaveBeenCalledTimes(1);
    expect(submitLead).toHaveBeenCalledWith({
      name: 'Ana Prueba',
      company: 'Constructora Ejemplo',
      email: 'ana@ejemplo.test',
      interest: 'DEMO',
      locale: 'es',
      source: 'FORM',
      consent: true,
      consentVersion: 'landing-lead-v1',
      turnstileToken: 'turnstile-1',
    });
    expect(hook.view).toBe('done');
  });

  it('submit after a conversation sends source CHAT', async () => {
    await mount();
    await act(async () => {
      await hook.send('hola');
    });
    act(() => hook.openForm());
    await act(async () => {
      await hook.submit(validForm);
    });

    expect(submitLead.mock.calls[0][0]).toMatchObject({ source: 'CHAT' });
    // The form gets its own Turnstile token: a token is single-use.
    expect(getTurnstileToken).toHaveBeenCalledTimes(2);
  });

  it('a second submit while submitting is ignored', async () => {
    const pending = deferred<void>();
    submitLead.mockReturnValueOnce(pending.promise);
    await mount();
    act(() => hook.openForm());

    let first!: Promise<unknown>;
    await act(async () => {
      first = hook.submit(validForm);
      void hook.submit(validForm);
    });
    expect(hook.submitting).toBe(true);
    expect(submitLead).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending.resolve();
      await first;
    });
    expect(hook.submitting).toBe(false);
    expect(submitLead).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['429 RATE_LIMITED', new ApiError(429, 'x', undefined, 'RATE_LIMITED'), 'rate_limited'],
    ['422 TURNSTILE_FAILED', new ApiError(422, 'x', undefined, 'TURNSTILE_FAILED'), 'verify_failed'],
    ['503 from the network', new NoResponseError(false, new TypeError('Failed to fetch')), 'unavailable'],
    ['422 CONSENT_VERSION_OUTDATED', new ApiError(422, 'x', undefined, 'CONSENT_VERSION_OUTDATED'), 'unavailable'],
  ])('a failed submit (%s) sets formNotice %s and stays on the form', async (_label, error, expected) => {
    submitLead.mockRejectedValueOnce(error);
    await mount();
    act(() => hook.openForm('BETA'));

    let errors: unknown;
    await act(async () => {
      errors = await hook.submit(validForm);
    });

    expect(errors).toBeNull();
    expect(hook.formNotice).toBe(expected);
    expect(hook.view).toBe('form');
    expect(hook.formInterest).toBe('BETA');
    expect(hook.submitting).toBe(false);
  });

  it('nothing is written to localStorage or sessionStorage', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    sendChat.mockResolvedValueOnce(reply('Formulario', { contactForm: { interest: 'DEMO' } }));
    await mount();

    await act(async () => {
      await hook.send('hola');
    });
    await act(async () => {
      await hook.submit(validForm);
    });

    expect(hook.view).toBe('done');
    expect(setItem).not.toHaveBeenCalled();
  });
});
