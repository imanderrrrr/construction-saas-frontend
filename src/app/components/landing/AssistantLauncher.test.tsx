import { act, type ComponentType } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// `t` echoes the key: these tests are about structure, not wording.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'es' } }),
}));

const { turnstileConfigured } = vi.hoisted(() => ({ turnstileConfigured: { value: true } }));
vi.mock('../../lib/turnstile', () => ({
  isTurnstileConfigured: () => turnstileConfigured.value,
}));

import { AssistantLauncher } from './AssistantLauncher';
import { supportMailto } from '../../lib/contact';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

type PanelModule = { AssistantPanel: ComponentType<{ onClose: () => void }> };

function FakePanel({ onClose }: { onClose: () => void }) {
  return (
    <div role="dialog" aria-label="fake panel">
      <button type="button" data-testid="fake-close" onClick={onClose}>
        close
      </button>
    </div>
  );
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  turnstileConfigured.value = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

async function render(loadPanel: () => Promise<PanelModule>) {
  await act(async () => {
    root.render(
      <div>
        <p data-testid="landing-content">landing</p>
        <AssistantLauncher loadPanel={loadPanel} />
      </div>,
    );
  });
}

function fab(): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>('button[aria-expanded]');
  if (!button) throw new Error('assistant button not rendered');
  return button;
}

async function click(el: HTMLElement) {
  await act(async () => {
    el.click();
  });
}

describe('AssistantLauncher', () => {
  it('renders only the closed button, with aria-expanded false and label assistant.fab.label, and does not call loadPanel', async () => {
    const loadPanel = vi.fn(async () => ({ AssistantPanel: FakePanel }));
    await render(loadPanel);

    expect(fab().getAttribute('aria-expanded')).toBe('false');
    expect(fab().textContent).toContain('assistant.fab.label');
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(loadPanel).not.toHaveBeenCalled();
  });

  it('clicking loads the panel once and renders it, with aria-expanded true', async () => {
    const loadPanel = vi.fn(async () => ({ AssistantPanel: FakePanel }));
    await render(loadPanel);

    await click(fab());
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(fab().getAttribute('aria-expanded')).toBe('true');

    await click(container.querySelector<HTMLButtonElement>('[data-testid="fake-close"]')!);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(fab().getAttribute('aria-expanded')).toBe('false');

    await click(fab());
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(loadPanel).toHaveBeenCalledTimes(1);
  });

  it('closing the panel returns focus to the button', async () => {
    await render(async () => ({ AssistantPanel: FakePanel }));
    await click(fab());

    const close = container.querySelector<HTMLButtonElement>('[data-testid="fake-close"]')!;
    close.focus();
    await click(close);

    expect(document.activeElement).toBe(fab());
  });

  it('a rejected loadPanel shows the unavailable notice with the support mailto and the landing keeps rendering', async () => {
    const consoleError = vi.spyOn(console, 'error');
    const loadPanel = vi.fn(() => Promise.reject(new TypeError('Failed to fetch dynamically imported module')));
    await render(loadPanel);

    await click(fab());

    const notice = container.querySelector('[role="alert"]');
    expect(notice).not.toBeNull();
    expect(notice!.textContent).toContain('assistant.unavailable.title');
    // No form behind this notice, so it does not say "leave your details below".
    expect(notice!.textContent).toContain('assistant.unavailable.emailOnly');
    expect(notice!.textContent).not.toContain('assistant.unavailable.body');
    expect(notice!.querySelector('a')!.getAttribute('href')).toBe(supportMailto());
    expect(container.querySelector('[data-testid="landing-content"]')).not.toBeNull();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('after a failed load, opening again tries to load the panel again', async () => {
    const loadPanel = vi
      .fn<() => Promise<PanelModule>>()
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce({ AssistantPanel: FakePanel });
    await render(loadPanel);

    await click(fab());
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    await click(fab()); // closes the notice
    await click(fab());

    expect(loadPanel).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it('with no Turnstile key a click shows the same notice and never calls loadPanel', async () => {
    turnstileConfigured.value = false;
    const loadPanel = vi.fn(async () => ({ AssistantPanel: FakePanel }));
    await render(loadPanel);

    await click(fab());

    const notice = container.querySelector('[role="alert"]');
    expect(notice!.textContent).toContain('assistant.unavailable.title');
    expect(notice!.querySelector('a')!.getAttribute('href')).toBe(supportMailto());
    expect(loadPanel).not.toHaveBeenCalled();
  });

  it('the button recipe has the fixed position, h-12 and the ink background of the design', async () => {
    await render(async () => ({ AssistantPanel: FakePanel }));
    const classes = fab().className.split(/\s+/);

    for (const cls of ['fixed', 'bottom-6', 'right-6', 'z-40', 'h-12', 'rounded-[2px]', 'bg-bt-ink', 'text-bt-bone']) {
      expect(classes).toContain(cls);
    }
    expect(fab().getAttribute('type')).toBe('button');
  });
});
