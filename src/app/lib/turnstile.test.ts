import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

// The loader memoises the script promise at module level, so every test gets a
// fresh copy of the module. The script tag never reaches the network: the spy on
// `document.head.appendChild` keeps it, and the test fires its onload/onerror.

type TurnstileModule = typeof import('./turnstile');

let mod: TurnstileModule;
let appended: HTMLScriptElement[];
let render: Mock;
let remove: Mock;
let renderOptions: Record<string, (arg?: string) => void> & Record<string, unknown>;

async function freshModule(siteKey: string) {
  vi.resetModules();
  vi.stubEnv('VITE_TURNSTILE_SITE_KEY', siteKey);
  mod = await import('./turnstile');
}

function finishScriptLoad(index = 0) {
  window.turnstile = { render, remove } as unknown as Window['turnstile'];
  appended[index].onload?.(new Event('load'));
}

function failScriptLoad(index = 0) {
  appended[index].onerror?.(new Event('error'));
}

/** Lets the loader's promise chain reach `render`. */
async function settle() {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

beforeEach(async () => {
  appended = [];
  vi.spyOn(document.head, 'appendChild').mockImplementation(<T extends Node>(node: T): T => {
    appended.push(node as unknown as HTMLScriptElement);
    return node;
  });
  render = vi.fn((_el: HTMLElement, options: typeof renderOptions) => {
    renderOptions = options;
    return 'widget-1';
  });
  remove = vi.fn();
  delete window.turnstile;
  await freshModule('test-key');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  delete window.turnstile;
});

describe('isTurnstileConfigured', () => {
  it('is true with a site key and false without one', async () => {
    expect(mod.isTurnstileConfigured()).toBe(true);
    await freshModule('');
    expect(mod.isTurnstileConfigured()).toBe(false);
  });
});

describe('requestTurnstileToken', () => {
  it('rejects TurnstileUnavailableError and adds no script when the key is empty', async () => {
    await freshModule('');

    await expect(mod.requestTurnstileToken(document.createElement('div'))).rejects.toBeInstanceOf(
      mod.TurnstileUnavailableError,
    );
    expect(appended).toHaveLength(0);
  });

  it('two concurrent calls add the script once', async () => {
    const first = mod.requestTurnstileToken(document.createElement('div'));
    const second = mod.requestTurnstileToken(document.createElement('div'));

    expect(appended).toHaveLength(1);
    expect(appended[0].src).toBe('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit');

    finishScriptLoad();
    await settle();
    expect(render).toHaveBeenCalledTimes(2);
    renderOptions.callback('token-b');
    await expect(second).resolves.toBe('token-b');
    // The first widget's callback was replaced by the second render; resolve it via its own options.
    const firstOptions = render.mock.calls[0][1] as typeof renderOptions;
    firstOptions.callback('token-a');
    await expect(first).resolves.toBe('token-a');
  });

  it('a failed script load rejects TurnstileUnavailableError and a later call tries again', async () => {
    const first = mod.requestTurnstileToken(document.createElement('div'));
    failScriptLoad();
    await expect(first).rejects.toBeInstanceOf(mod.TurnstileUnavailableError);

    const second = mod.requestTurnstileToken(document.createElement('div'));
    expect(appended).toHaveLength(2);
    finishScriptLoad(1);
    await settle();
    renderOptions.callback('token-after-retry');
    await expect(second).resolves.toBe('token-after-retry');
  });

  it('resolves with the callback token and removes the widget', async () => {
    const container = document.createElement('div');
    const pending = mod.requestTurnstileToken(container);
    finishScriptLoad();
    await settle();

    expect(render).toHaveBeenCalledWith(container, expect.objectContaining({ sitekey: 'test-key' }));
    renderOptions.callback('token-1');

    await expect(pending).resolves.toBe('token-1');
    expect(remove).toHaveBeenCalledWith('widget-1');
  });

  it('renders with appearance interaction-only and size flexible', async () => {
    void mod.requestTurnstileToken(document.createElement('div'));
    finishScriptLoad();
    await settle();

    expect(renderOptions.appearance).toBe('interaction-only');
    expect(renderOptions.size).toBe('flexible');
  });

  it('an error callback rejects TurnstileFailedError', async () => {
    const pending = mod.requestTurnstileToken(document.createElement('div'));
    finishScriptLoad();
    await settle();

    renderOptions['error-callback']('300030');

    await expect(pending).rejects.toBeInstanceOf(mod.TurnstileFailedError);
    expect(remove).toHaveBeenCalledWith('widget-1');
  });

  it('the before-interactive callback calls onInteractive', async () => {
    const onInteractive = vi.fn();
    void mod.requestTurnstileToken(document.createElement('div'), { onInteractive });
    finishScriptLoad();
    await settle();

    expect(onInteractive).not.toHaveBeenCalled();
    renderOptions['before-interactive-callback']();
    expect(onInteractive).toHaveBeenCalledTimes(1);
  });

  it('a script that loads without defining window.turnstile rejects TurnstileUnavailableError', async () => {
    const pending = mod.requestTurnstileToken(document.createElement('div'));
    appended[0].onload?.(new Event('load'));

    await expect(pending).rejects.toBeInstanceOf(mod.TurnstileUnavailableError);
  });
});
