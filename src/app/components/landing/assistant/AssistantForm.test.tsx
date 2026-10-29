import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'es' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

import { ApiError } from '../../../lib/api';
import { supportMailto } from '../../../lib/contact';
import type { ChatReply } from '../../../services/landingAssistant';
import { AssistantPanel } from '../AssistantPanel';
import { AssistantForm } from './AssistantForm';
import type { LeadFieldErrors, LeadFormValues } from './leadForm';
import type { NoticeKind } from './useAssistantChat';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

const q = <T extends Element = HTMLElement>(selector: string) => container.querySelector<T>(selector);
const all = (selector: string) => Array.from(container.querySelectorAll<HTMLElement>(selector));
const byText = (selector: string, text: string) => all(selector).find((el) => el.textContent?.includes(text));

function field(label: string): HTMLInputElement {
  const el = all('label').find((l) => l.textContent === label) as HTMLLabelElement | undefined;
  if (!el) throw new Error(`no label ${label}`);
  return document.getElementById(el.htmlFor) as HTMLInputElement;
}

async function fill(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => {
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function click(el: HTMLElement) {
  await act(async () => {
    el.click();
  });
}

const consent = () => q<HTMLInputElement>('input[type="checkbox"]')!;
const submitButton = () => q<HTMLButtonElement>('button[type="submit"]')!;

async function fillValid() {
  await fill(field('assistant.form.name.label'), 'Ana Prueba');
  await fill(field('assistant.form.company.label'), 'Constructora Ejemplo');
  await fill(field('assistant.form.contact.label'), 'ana@ejemplo.test');
  await click(consent());
}

describe('AssistantForm', () => {
  let onSubmit: Mock<(values: LeadFormValues) => Promise<LeadFieldErrors | null>>;

  beforeEach(() => {
    onSubmit = vi.fn(async () => null);
  });

  async function render(props: { initialInterest?: 'DEMO' | 'BETA' | null; submitting?: boolean; notice?: NoticeKind | null } = {}) {
    await act(async () => {
      root.render(
        <AssistantForm
          initialInterest={props.initialInterest ?? null}
          submitting={props.submitting ?? false}
          notice={props.notice ?? null}
          onSubmit={onSubmit}
        />,
      );
    });
  }

  it('starts with the consent box unchecked and the submit button disabled; checking it enables the button', async () => {
    await render();

    expect(consent().checked).toBe(false);
    expect(submitButton().disabled).toBe(true);
    await click(consent());
    expect(submitButton().disabled).toBe(false);
  });

  it('names share the 25-character policy while email retains 150 and autocomplete metadata', async () => {
    await render();

    const name = field('assistant.form.name.label');
    const company = field('assistant.form.company.label');
    const contact = field('assistant.form.contact.label');
    expect([name.maxLength, company.maxLength, contact.maxLength]).toEqual([25, 25, 150]);
    expect([name.autocomplete, company.autocomplete, contact.autocomplete]).toEqual(['name', 'organization', 'email']);
    for (const input of [name, company, contact]) expect(input.className.split(/\s+/)).toContain('max-sm:text-base');
  });

  it('the interest radiogroup has two radios, preselects the interest from the bot and defaults to DEMO', async () => {
    await render({ initialInterest: 'BETA' });
    const group = q('[role="radiogroup"]')!;
    const radios = Array.from(group.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
    expect(radios.map((r) => r.value)).toEqual(['DEMO', 'BETA']);
    expect(radios.find((r) => r.checked)!.value).toBe('BETA');
    expect(group.getAttribute('aria-labelledby')).toBeTruthy();

    act(() => root.unmount());
    root = createRoot(container);
    await render({ initialInterest: null });
    expect(q<HTMLInputElement>('input[type="radio"]:checked')!.value).toBe('DEMO');
  });

  it('submitting invalid values shows role alert errors with aria-invalid and aria-describedby, moves focus to the first invalid field and does not call onSubmit', async () => {
    await render();
    await fill(field('assistant.form.name.label'), 'Ana Prueba');
    await fill(field('assistant.form.contact.label'), 'ana@');
    await click(consent());

    await click(submitButton());

    expect(onSubmit).not.toHaveBeenCalled();
    const company = field('assistant.form.company.label');
    const contact = field('assistant.form.contact.label');
    expect(company.getAttribute('aria-invalid')).toBe('true');
    expect(contact.getAttribute('aria-invalid')).toBe('true');
    expect(field('assistant.form.name.label').getAttribute('aria-invalid')).toBeNull();
    const companyError = document.getElementById(company.getAttribute('aria-describedby')!)!;
    expect(companyError.getAttribute('role')).toBe('alert');
    expect(companyError.textContent).toBe('assistant.form.error.company');
    expect(document.getElementById(contact.getAttribute('aria-describedby')!)!.textContent).toBe('assistant.form.error.email');
    expect(document.activeElement).toBe(company);
  });

  it('fixing a field clears its error', async () => {
    await render();
    await click(consent());
    await click(submitButton());
    const name = field('assistant.form.name.label');
    expect(name.getAttribute('aria-invalid')).toBe('true');

    await fill(name, 'Ana');
    expect(name.getAttribute('aria-invalid')).toBeNull();
  });

  it('submitting valid values calls onSubmit once, even with a double click or Enter held down', async () => {
    let finish!: (v: null) => void;
    onSubmit.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    await render();
    await fillValid();

    await act(async () => {
      submitButton().click();
      submitButton().click();
      q('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Ana Prueba',
      company: 'Constructora Ejemplo',
      contact: 'ana@ejemplo.test',
      interest: 'DEMO',
      consent: true,
    });
    await act(async () => finish(null));
  });

  it('while submitting the fields are disabled and the button shows assistant.form.sending', async () => {
    await render({ submitting: true });

    for (const label of ['assistant.form.name.label', 'assistant.form.company.label', 'assistant.form.contact.label']) {
      expect(field(label).disabled).toBe(true);
    }
    expect(consent().disabled).toBe(true);
    expect(submitButton().textContent).toContain('assistant.form.sending');
    expect(submitButton().getAttribute('aria-disabled')).toBe('true');
    expect(submitButton().querySelector('.animate-spin')!.className).toContain('motion-reduce:animate-none');
  });

  it('the consent link points to /privacy', async () => {
    await render();
    const link = byText('a', 'assistant.form.consent.link') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/privacy');
  });

  it('a verify_failed notice shows the retry button, an unavailable notice shows the mailto, a rate_limited notice shows no digits', async () => {
    await render({ notice: 'verify_failed' });
    await fillValid();
    const retry = byText('button', 'assistant.verify.retry')!;
    await click(retry);
    expect(onSubmit).toHaveBeenCalledTimes(1);

    act(() => root.unmount());
    root = createRoot(container);
    await render({ notice: 'unavailable' });
    expect(q('[role="alert"] a')!.getAttribute('href')).toBe(supportMailto());

    act(() => root.unmount());
    root = createRoot(container);
    await render({ notice: 'rate_limited' });
    const status = q('[role="status"]')!;
    expect(status.textContent).toContain('assistant.wait.body');
    expect(status.textContent).not.toMatch(/\d/);
  });
});

describe('AssistantPanel — form and done views', () => {
  let sendChat: Mock;
  let submitLead: Mock;
  let getTurnstileToken: Mock;
  let onClose: Mock;

  beforeEach(() => {
    sendChat = vi.fn().mockResolvedValue({ reply: 'Hola', contactForm: null, sessionToken: 's' } satisfies ChatReply);
    submitLead = vi.fn().mockResolvedValue(undefined);
    getTurnstileToken = vi.fn().mockResolvedValue('turnstile-1');
    onClose = vi.fn();
  });

  async function renderPanel() {
    await act(async () => {
      root.render(<AssistantPanel onClose={onClose} deps={{ sendChat, submitLead, getTurnstileToken }} />);
    });
  }

  const titleBlock = () => q('[data-testid="assistant-title-block"]')!;

  it('the form view hides the chat input, shows assistant.sheet.form and a back button labelled assistant.form.back', async () => {
    await renderPanel();
    await click(byText('button', 'assistant.cta.demo')!);

    expect(q('input[aria-label="assistant.input.label"]')).toBeNull();
    expect(titleBlock().textContent).toContain('assistant.sheet.form');
    expect(titleBlock().textContent).toContain('REV BETA 0.9');
    const back = q<HTMLButtonElement>('button[aria-label="assistant.form.back"]')!;
    await click(back);
    expect(q('input[aria-label="assistant.input.label"]')).not.toBeNull();
  });

  it('while submitting the panel has aria-busy true', async () => {
    let finish!: () => void;
    submitLead.mockReturnValueOnce(new Promise<void>((resolve) => { finish = resolve; }));
    await renderPanel();
    await click(byText('button', 'assistant.cta.beta')!);
    await fillValid();

    await click(submitButton());

    expect(q('[role="dialog"]')!.getAttribute('aria-busy')).toBe('true');
    expect(field('assistant.form.name.label').disabled).toBe(true);
    await act(async () => finish());
    expect(q('[role="dialog"]')!.getAttribute('aria-busy')).toBeNull();
  });

  it('success renders the Received stamp, the heading, the body and the Back to chat and Close buttons, under assistant.sheet.done', async () => {
    await renderPanel();
    await click(byText('button', 'assistant.cta.beta')!);
    await fillValid();
    await click(submitButton());

    expect(submitLead).toHaveBeenCalledTimes(1);
    expect(submitLead.mock.calls[0][0]).toMatchObject({ interest: 'BETA', source: 'FORM' });
    const done = q('[role="status"]')!;
    expect(done.textContent).toContain('assistant.done.stamp');
    expect(q('h2')!.textContent).toBe('assistant.done.heading');
    expect(done.textContent).toContain('assistant.done.body');
    expect(titleBlock().textContent).toContain('assistant.sheet.done');

    await click(byText('button', 'assistant.done.close')!);
    expect(onClose).toHaveBeenCalledTimes(1);
    await click(byText('button', 'assistant.done.back')!);
    expect(q('input[aria-label="assistant.input.label"]')).not.toBeNull();
  });

  it('a failed submit keeps the values and shows the notice', async () => {
    submitLead.mockRejectedValueOnce(new ApiError(429, 'slow', undefined, 'RATE_LIMITED'));
    await renderPanel();
    await click(byText('button', 'assistant.cta.demo')!);
    await fillValid();
    await click(submitButton());

    expect(byText('[role="status"]', 'assistant.wait.body')).toBeDefined();
    expect(field('assistant.form.name.label').value).toBe('Ana Prueba');
    expect(field('assistant.form.contact.label').value).toBe('ana@ejemplo.test');
    expect(consent().checked).toBe(true);
  });

  it('the unavailable sheet has a way back to the conversation, where sending works again', async () => {
    sendChat.mockRejectedValueOnce(new ApiError(503, 'busy', undefined, 'MODEL_UNAVAILABLE'));
    await renderPanel();
    await click(byText('button', 'assistant.faq.1')!);
    expect(q('[role="alert"]')!.textContent).toContain('assistant.unavailable.title');

    await click(q<HTMLButtonElement>('button[aria-label="assistant.form.back"]')!);

    expect(q('[role="alert"]')).toBeNull();
    expect(byText('[data-message="user"]', 'assistant.faq.1')).toBeDefined();
    const input = q<HTMLInputElement>('input[aria-label="assistant.input.label"]')!;
    await fill(input, 'otra vez');
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    });
    expect(sendChat).toHaveBeenCalledTimes(2);
    expect(byText('[data-message="assistant"]', 'Hola')).toBeDefined();
  });

  it('Back to chat after a contact sent from the unavailable sheet shows the conversation, not the sheet again', async () => {
    sendChat.mockRejectedValueOnce(new ApiError(503, 'off', undefined, 'ASSISTANT_DISABLED'));
    await renderPanel();
    await click(byText('button', 'assistant.faq.1')!);
    await fillValid();
    await click(submitButton());
    await click(byText('button', 'assistant.done.back')!);

    expect(q('[role="alert"]')).toBeNull();
    expect(q('input[aria-label="assistant.input.label"]')).not.toBeNull();
  });

  it('with the chat switched off the unavailable sheet carries the form, and the form still submits', async () => {
    sendChat.mockRejectedValueOnce(new ApiError(503, 'off', undefined, 'ASSISTANT_DISABLED'));
    await renderPanel();
    await click(byText('button', 'assistant.faq.1')!);

    expect(q('[role="alert"]')!.textContent).toContain('assistant.unavailable.title');
    expect(q('[data-testid="assistant-header"]')!.textContent).toContain('assistant.unavailable.tag');
    await fillValid();
    await click(submitButton());

    expect(submitLead).toHaveBeenCalledTimes(1);
    expect(submitLead.mock.calls[0][0]).toMatchObject({ source: 'CHAT', interest: 'DEMO' });
    expect(byText('[role="status"]', 'assistant.done.stamp')).toBeDefined();
  });
});
