import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'es' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

import { AssistantPanel } from './AssistantPanel';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// jsdom ships no matchMedia. The panel asks it whether the screen is narrow
// (< 640 px), where it becomes a full-screen modal sheet.
let narrow = false;
window.matchMedia = ((query: string) => ({
  matches: query.includes('max-width: 639px') ? narrow : false,
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
})) as typeof window.matchMedia;

let container: HTMLDivElement;
let root: Root;
let onClose: Mock;

beforeEach(() => {
  narrow = false;
  document.body.style.overflow = '';
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  onClose = vi.fn();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

async function render() {
  const deps = {
    sendChat: vi.fn().mockResolvedValue({ reply: 'Hola', contactForm: null, sessionToken: 's' }),
    submitLead: vi.fn().mockResolvedValue(undefined),
    getTurnstileToken: vi.fn().mockResolvedValue('t'),
  };
  await act(async () => {
    root.render(<AssistantPanel onClose={onClose} deps={deps} />);
  });
}

const dialog = () => container.querySelector<HTMLElement>('[role="dialog"]')!;
const byText = (text: string) =>
  Array.from(container.querySelectorAll<HTMLElement>('button')).find((b) => b.textContent?.includes(text))!;

function key(target: Element, keyName: string, shiftKey = false) {
  const event = new KeyboardEvent('keydown', { key: keyName, shiftKey, bubbles: true, cancelable: true });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

function focusables(): HTMLElement[] {
  return Array.from(
    dialog().querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'),
  );
}

describe('AssistantPanel as a dialog', () => {
  it('the panel has role dialog and an aria-label', async () => {
    await render();
    expect(dialog().getAttribute('aria-label')).toBe('assistant.panel.title');
  });

  it('on open focus goes to the message input in the chat view and to the first field in the form view', async () => {
    await render();
    expect(document.activeElement).toBe(container.querySelector('input[aria-label="assistant.input.label"]'));

    await act(async () => byText('assistant.cta.demo').click());
    const firstField = dialog().querySelector('form input[type="text"]');
    expect(firstField).not.toBeNull();
    expect(document.activeElement).toBe(firstField);
  });

  it('Esc calls onClose', async () => {
    await render();
    key(document.activeElement!, 'Escape');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('on a narrow screen the panel has aria-modal true, locks body scroll while open and restores it on close, and Tab from the last focusable element goes to the first and Shift+Tab the reverse', async () => {
    narrow = true;
    document.body.style.overflow = 'auto';
    await render();

    expect(dialog().getAttribute('aria-modal')).toBe('true');
    expect(document.body.style.overflow).toBe('hidden');

    const items = focusables();
    const first = items[0];
    const last = items[items.length - 1];
    last.focus();
    const forward = key(last, 'Tab');
    expect(forward.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);

    const backward = key(first, 'Tab', true);
    expect(backward.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);

    // A Tab in the middle is left to the browser.
    items[1].focus();
    const middle = key(items[1], 'Tab');
    expect(middle.defaultPrevented).toBe(false);

    act(() => root.unmount());
    expect(document.body.style.overflow).toBe('auto');
    root = createRoot(container);
  });

  it('on a wide screen there is no aria-modal and no scroll lock', async () => {
    await render();

    expect(dialog().hasAttribute('aria-modal')).toBe(false);
    expect(document.body.style.overflow).toBe('');
    const items = focusables();
    const last = items[items.length - 1];
    last.focus();
    expect(key(last, 'Tab').defaultPrevented).toBe(false);
  });

  it('with reduced motion the typing squares keep their motion-safe prefix and the spinner has motion-reduce:animate-none', async () => {
    let finish!: () => void;
    const deps = {
      sendChat: vi.fn(() => new Promise<never>(() => {})),
      submitLead: vi.fn(() => new Promise<void>((resolve) => { finish = resolve; })),
      getTurnstileToken: vi.fn().mockResolvedValue('t'),
    };
    await act(async () => {
      root.render(<AssistantPanel onClose={onClose} deps={deps} />);
    });

    await act(async () => byText('assistant.faq.1').click());
    const squares = Array.from(dialog().querySelectorAll('[role="status"] i'));
    expect(squares).toHaveLength(3);
    for (const square of squares) {
      expect(square.className).toContain('motion-safe:animate-[bt-blink_1.2s_ease-in-out_infinite]');
      expect(square.className).not.toMatch(/(^|\s)animate-/);
    }

    await act(async () => byText('assistant.cta.demo').click());
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    const inputs = Array.from(dialog().querySelectorAll<HTMLInputElement>('form input[type="text"]'));
    const values = ['Ana Prueba', 'Constructora Ejemplo', 'ana@ejemplo.test'];
    await act(async () => {
      inputs.forEach((input, i) => {
        setter.call(input, values[i]);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
    });
    await act(async () => dialog().querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
    await act(async () => dialog().querySelector<HTMLButtonElement>('button[type="submit"]')!.click());

    const spinner = dialog().querySelector('button[type="submit"] .animate-spin')!;
    expect(spinner.className).toContain('motion-reduce:animate-none');
    await act(async () => finish());
  });
});
