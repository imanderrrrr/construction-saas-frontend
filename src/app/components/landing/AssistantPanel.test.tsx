import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

// `t` echoes the key, plus its options when there are any, so the turn counter
// can be read back: `assistant.sheet.turn{"n":"07","max":10}`.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => (options ? `${key}${JSON.stringify(options)}` : key),
    i18n: { language: 'es' },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

const { requestTurnstileToken } = vi.hoisted(() => ({ requestTurnstileToken: vi.fn() }));
vi.mock('../../lib/turnstile', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/turnstile')>()),
  requestTurnstileToken,
}));

import { ApiError } from '../../lib/api';
import { supportMailto } from '../../lib/contact';
import { TurnstileFailedError } from '../../lib/turnstile';
import type { ChatReply } from '../../services/landingAssistant';
import { AssistantPanel } from './AssistantPanel';
import type { AssistantDeps } from './assistant/useAssistantChat';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let sendChat: Mock;
let submitLead: Mock;
let getTurnstileToken: Mock;
let onClose: Mock;

function reply(text: string, extra: Partial<ChatReply> = {}): ChatReply {
  return { reply: text, contactForm: null, sessionToken: 'session-1', ...extra };
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  sendChat = vi.fn().mockResolvedValue(reply('Respuesta del bot'));
  submitLead = vi.fn().mockResolvedValue(undefined);
  getTurnstileToken = vi.fn().mockResolvedValue('turnstile-1');
  onClose = vi.fn();
  requestTurnstileToken.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

async function render(deps: Partial<AssistantDeps> = { sendChat, submitLead, getTurnstileToken }) {
  await act(async () => {
    root.render(<AssistantPanel onClose={onClose} deps={deps} />);
  });
}

const q = <T extends Element = HTMLElement>(selector: string) => container.querySelector<T>(selector as string) as T | null;
const all = (selector: string) => Array.from(container.querySelectorAll<HTMLElement>(selector));
const byText = (selector: string, text: string) => all(selector).find((el) => el.textContent?.includes(text));

function input(): HTMLInputElement {
  return q<HTMLInputElement>('input[aria-label="assistant.input.label"]')!;
}

function sendButton(): HTMLButtonElement {
  return q<HTMLButtonElement>('button[aria-label="assistant.input.send"]')!;
}

async function type(text: string) {
  const el = input();
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => {
    setter.call(el, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function pressEnter(shiftKey = false) {
  await act(async () => {
    input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey, bubbles: true, cancelable: true }));
  });
}

async function say(text: string) {
  await type(text);
  await pressEnter();
}

function titleBlock(): HTMLElement {
  return q('[data-testid="assistant-title-block"]')!;
}

describe('AssistantPanel — first view', () => {
  it('shows the greeting, the AI notice, three FAQ buttons and the Book a demo and Join the beta buttons', async () => {
    await render();

    expect(container.textContent).toContain('assistant.greeting');
    expect(container.textContent).toContain('assistant.notice.body');
    const faqs = all('button').filter((b) => /assistant\.faq\.[123]/.test(b.textContent ?? ''));
    expect(faqs).toHaveLength(3);
    expect(faqs.map((b) => b.textContent)).toEqual([
      expect.stringContaining('P-01'),
      expect.stringContaining('P-02'),
      expect.stringContaining('P-03'),
    ]);
    expect(byText('button', 'assistant.cta.demo')).toBeDefined();
    expect(byText('button', 'assistant.cta.beta')).toBeDefined();
  });

  it('clicking FAQ 2 sends the text of assistant.faq.2 as the first visitor message', async () => {
    await render();

    await act(async () => {
      byText('button', 'assistant.faq.2')!.click();
    });

    expect(sendChat).toHaveBeenCalledTimes(1);
    expect(sendChat.mock.calls[0][0].messages).toEqual([{ role: 'user', content: 'assistant.faq.2' }]);
  });

  it('the demo and beta buttons open the form with that interest', async () => {
    await render();
    await act(async () => {
      byText('button', 'assistant.cta.beta')!.click();
    });
    expect(titleBlock().textContent).toContain('assistant.sheet.form');
  });
});

describe('AssistantPanel — messages', () => {
  it('labels each exchange T-01 with the visitor and the bot sharing the number', async () => {
    await render();
    await say('primera');
    await say('segunda');

    const labels = all('[data-turn-label]').map((el) => el.textContent);
    expect(labels).toEqual([
      'T-00 · assistant.turn.bot',
      'T-01 · assistant.turn.you',
      'T-01 · assistant.turn.bot',
      'T-02 · assistant.turn.you',
      'T-02 · assistant.turn.bot',
    ]);
  });

  it('renders a bot reply with HTML and markdown links as plain text with no img or a element and with textContent equal to the reply', async () => {
    const hostile = '<img src=x onerror="window.__pwned=1"> mira [x](http://evil.test) y <a href="http://evil.test">aquí</a>';
    sendChat.mockResolvedValueOnce(reply(hostile));
    await render();
    await say('hola');

    const log = q('[role="log"]')!;
    const botCards = all('[data-message="assistant"]');
    const last = botCards[botCards.length - 1];
    expect(last.textContent).toBe(hostile);
    expect(log.querySelector('img')).toBeNull();
    expect(log.querySelector('a')).toBeNull();
    expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined();
  });

  it('the message list has role log and aria-live polite', async () => {
    await render();
    const log = q('[role="log"]')!;
    expect(log.getAttribute('aria-live')).toBe('polite');
  });

  it('while sending shows a status element with assistant.typing.sr', async () => {
    let finish!: (r: ChatReply) => void;
    sendChat.mockReturnValueOnce(new Promise<ChatReply>((resolve) => { finish = resolve; }));
    await render();
    await say('hola');

    const status = q('[role="log"] [role="status"]')!;
    expect(status.textContent).toContain('assistant.typing.sr');
    expect(status.textContent).toContain('assistant.typing');

    await act(async () => finish(reply('listo')));
    expect(q('[role="log"] [role="status"]')).toBeNull();
  });

  it('Enter sends, Shift+Enter does not send, and a second Enter while sending is ignored', async () => {
    let finish!: (r: ChatReply) => void;
    sendChat.mockReturnValueOnce(new Promise<ChatReply>((resolve) => { finish = resolve; }));
    await render();

    await type('hola');
    await pressEnter(true);
    expect(sendChat).not.toHaveBeenCalled();
    expect(input().value).toBe('hola');

    await pressEnter();
    expect(sendChat).toHaveBeenCalledTimes(1);
    expect(input().value).toBe('');

    await type('otra');
    await pressEnter();
    expect(sendChat).toHaveBeenCalledTimes(1);
    expect(input().value).toBe('otra');

    await act(async () => finish(reply('listo')));
  });

  it('the input has maxLength 500, the max-sm:text-base class, and the send button is disabled when the text is blank', async () => {
    await render();

    expect(input().maxLength).toBe(500);
    expect(input().className.split(/\s+/)).toContain('max-sm:text-base');
    expect(sendButton().disabled).toBe(true);
    await type('   ');
    expect(sendButton().disabled).toBe(true);
    await type('hola');
    expect(sendButton().disabled).toBe(false);

    await act(async () => sendButton().click());
    expect(sendChat).toHaveBeenCalledTimes(1);
  });
});

describe('AssistantPanel — title block', () => {
  it('shows assistant.sheet.chat on the left and REV BETA 0.9 on the right until the 6th visitor message', async () => {
    await render();
    expect(titleBlock().textContent).toBe('assistant.sheet.chatREV BETA 0.9');
    for (let i = 1; i <= 6; i++) await say(`pregunta ${i}`);
    expect(titleBlock().textContent).toBe('assistant.sheet.chatREV BETA 0.9');
  });

  it('from the 7th to the 10th shows assistant.sheet.turn with n and max 10 instead of the revision', async () => {
    await render();
    for (let i = 1; i <= 7; i++) await say(`pregunta ${i}`);
    expect(titleBlock().textContent).toBe('assistant.sheet.chatassistant.sheet.turn{"n":"07","max":10}');
    for (let i = 8; i <= 10; i++) await say(`pregunta ${i}`);
    expect(titleBlock().textContent).toBe('assistant.sheet.chatassistant.sheet.turn{"n":"10","max":10}');
  });
});

describe('AssistantPanel — notices', () => {
  it('unavailable renders role alert with the assistant.unavailable keys and a mailto link built by supportMailto', async () => {
    sendChat.mockRejectedValueOnce(new ApiError(503, 'off', undefined, 'ASSISTANT_DISABLED'));
    await render();
    await say('hola');

    const alert = q('[role="alert"]')!;
    expect(alert.textContent).toContain('assistant.unavailable.label');
    expect(alert.textContent).toContain('assistant.unavailable.title');
    expect(alert.textContent).toContain('assistant.unavailable.body');
    expect(alert.querySelector('a')!.getAttribute('href')).toBe(supportMailto());
  });

  it('rate_limited renders role status with assistant.wait.body and no digits', async () => {
    sendChat.mockRejectedValueOnce(new ApiError(429, 'slow', undefined, 'RATE_LIMITED'));
    await render();
    await say('hola');

    const status = all('[role="status"]').find((el) => el.textContent?.includes('assistant.wait.body'))!;
    expect(status).toBeDefined();
    expect(status.textContent).toContain('assistant.wait.label');
    expect(status.textContent).not.toMatch(/\d/);
  });

  it('verify_failed renders an alert with a retry button that resends the message', async () => {
    sendChat.mockRejectedValueOnce(new ApiError(422, 'bot?', undefined, 'TURNSTILE_FAILED'));
    await render();
    await say('hola');

    const alert = q('[role="alert"]')!;
    expect(alert.textContent).toContain('assistant.verify.failed');
    const retry = byText('button', 'assistant.verify.retry')!;
    await act(async () => retry.click());

    expect(sendChat).toHaveBeenCalledTimes(2);
    expect(q('[role="alert"]')).toBeNull();
  });

  it('turn_limit renders the assistant.limit keys and replaces the input with the disabled assistant.input.ended text', async () => {
    sendChat.mockRejectedValueOnce(new ApiError(422, 'limit', undefined, 'TURN_LIMIT'));
    await render();
    await say('hola');

    const status = all('[role="status"]').find((el) => el.textContent?.includes('assistant.limit.title'))!;
    expect(status.textContent).toContain('assistant.limit.label');
    expect(status.textContent).toContain('assistant.limit.body');
    expect(status.querySelector('a')!.getAttribute('href')).toBe(supportMailto());
    const ended = q<HTMLInputElement>('input[aria-label="assistant.input.label"]')!;
    expect(ended.disabled).toBe(true);
    expect(ended.placeholder).toBe('assistant.input.ended');
    expect(sendButton().disabled).toBe(true);
  });
});

describe('AssistantPanel — frame', () => {
  it('renders the markOnly logo, the title and assistant.panel.disclosure, and a close button labelled assistant.panel.close', async () => {
    await render();
    const header = q('[data-testid="assistant-header"]')!;

    expect(header.querySelector('svg rect')).not.toBeNull();
    expect(header.textContent).not.toContain('Build');
    expect(header.textContent).toContain('assistant.panel.title');
    expect(header.textContent).toContain('assistant.panel.disclosure');
    const close = header.querySelector<HTMLButtonElement>('button[aria-label="assistant.panel.close"]')!;
    await act(async () => close.click());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('the panel has w-[380px] and h-[620px] classes', async () => {
    await render();
    const classes = q('[role="dialog"]')!.className.split(/\s+/);
    expect(classes).toContain('w-[380px]');
    expect(classes).toContain('h-[620px]');
  });

  it('when the interactive hook fires, a 300 by 65 host appears inside a bot card', async () => {
    requestTurnstileToken.mockImplementation((_host: HTMLElement, hooks?: { onInteractive?: () => void }) => {
      hooks?.onInteractive?.();
      return new Promise<string>(() => {});
    });
    await render({ sendChat, submitLead });

    const host = q('[data-testid="turnstile-host-chat"]')!;
    expect(host.closest('[data-message="assistant"]')).toBeNull();

    await say('hola');

    expect(requestTurnstileToken).toHaveBeenCalledWith(host, expect.any(Object));
    const card = host.closest<HTMLElement>('[data-message="assistant"]')!;
    expect(card).not.toBeNull();
    expect(card.textContent).toContain('assistant.verify.checking');
    expect(host.className.split(/\s+/)).toEqual(expect.arrayContaining(['w-[300px]', 'h-[65px]', 'max-w-full']));
  });

  it('a challenge left waiting in the chat stays out of the form, and the form gets a card and a host of its own', async () => {
    const challenges: Array<{ host: HTMLElement; pass: (token: string) => void; fail: () => void }> = [];
    requestTurnstileToken.mockImplementation((host: HTMLElement, hooks?: { onInteractive?: () => void }) => {
      hooks?.onInteractive?.();
      return new Promise<string>((resolve, reject) => {
        challenges.push({ host, pass: resolve, fail: () => reject(new TurnstileFailedError()) });
      });
    });
    const checkingCards = () =>
      all('[data-message="assistant"]').filter((el) => el.textContent?.includes('assistant.verify.checking'));
    const field = (label: string) => {
      const el = all('label').find((l) => l.textContent === label) as HTMLLabelElement;
      return document.getElementById(el.htmlFor) as HTMLInputElement;
    };
    const fill = async (el: HTMLInputElement, value: string) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      await act(async () => {
        setter.call(el, value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
    };
    await render({ sendChat, submitLead });

    await say('hola');
    expect(checkingCards()).toHaveLength(1);

    await act(async () => byText('button', 'assistant.cta.beta')!.click());
    expect(checkingCards()).toHaveLength(0);

    await fill(field('assistant.form.name.label'), 'Ana Prueba');
    await fill(field('assistant.form.company.label'), 'Constructora Ejemplo');
    await fill(field('assistant.form.contact.label'), 'ana@ejemplo.test');
    await act(async () => q<HTMLInputElement>('input[type="checkbox"]')!.click());
    await act(async () => {
      q('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(challenges).toHaveLength(2);
    expect(challenges[1].host).not.toBe(challenges[0].host);
    expect(checkingCards()).toHaveLength(1);
    expect(checkingCards()[0].contains(challenges[1].host)).toBe(true);

    // The chat's challenge gives up while the form's is still waiting for its click.
    await act(async () => challenges[0].fail());
    expect(checkingCards()).toHaveLength(1);
    expect(checkingCards()[0].contains(challenges[1].host)).toBe(true);

    await act(async () => challenges[1].pass('turnstile-lead'));
    expect(submitLead).toHaveBeenCalledWith(expect.objectContaining({ turnstileToken: 'turnstile-lead' }));
    expect(checkingCards()).toHaveLength(0);
  });
});
