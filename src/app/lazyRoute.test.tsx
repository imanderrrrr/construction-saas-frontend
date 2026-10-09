// AUD-019 — a page is a chunk fetched with its translations when its route
// renders. While it arrives the route shows its loading state; a network
// failure is retried, and one that persists shows a reload screen in the
// visitor's language — never a blank page.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../i18n';
import { lazyRoute, RoutePage, withChunkRetry } from './lazyRoute';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const Hello = () => <p>hola</p>;
const chunkError = () => new TypeError('Failed to fetch dynamically imported module: https://x/assets/Page-1.js');

async function waitFor(check: () => boolean, ms = 3000) {
  const deadline = Date.now() + ms;
  while (!check() && Date.now() < deadline) {
    await act(async () => { await new Promise(r => setTimeout(r, 10)); });
  }
}

describe('lazyRoute + RoutePage', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(async () => { await i18n.changeLanguage('es'); });
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it('shows the loading state, then the page', async () => {
    let release: (c: typeof Hello) => void = () => {};
    const Page = lazyRoute('landing', () => new Promise<typeof Hello>(r => { release = r; }));
    await act(async () => { root.render(<RoutePage><Page /></RoutePage>); });
    expect(container.querySelector('[data-route-loading]')).not.toBeNull();
    await act(async () => { release(Hello); });
    await waitFor(() => container.textContent === 'hola');
    expect(container.textContent).toBe('hola');
    expect(container.querySelector('[data-route-loading]')).toBeNull();
  });

  it('retries a chunk the network dropped before giving up', async () => {
    const importer = vi.fn()
      .mockRejectedValueOnce(chunkError())
      .mockRejectedValueOnce(chunkError())
      .mockResolvedValueOnce(Hello);
    const Page = lazyRoute('landing', importer);
    await act(async () => { root.render(<RoutePage><Page /></RoutePage>); });
    await waitFor(() => container.textContent === 'hola');
    expect(importer).toHaveBeenCalledTimes(3);
    expect(container.textContent).toBe('hola');
  });

  it('shows a reload screen in the visitor\'s language when the chunk never arrives', async () => {
    const importer = vi.fn().mockRejectedValue(chunkError());
    const Page = lazyRoute('landing', importer);
    await act(async () => { root.render(<RoutePage><Page /></RoutePage>); });
    await waitFor(() => container.querySelector('[role="alert"]') !== null);
    const alert = container.querySelector('[role="alert"]')!;
    expect(alert.textContent).toContain('No se pudo cargar esta página');
    expect(alert.querySelector('button')?.textContent).toBe('Reintentar');
    expect(importer).toHaveBeenCalledTimes(3);
  });

  it('does not retry an error that is not the network\'s', async () => {
    const importer = vi.fn().mockRejectedValue(new Error('boom'));
    await expect(withChunkRetry(importer)).rejects.toThrow('boom');
    expect(importer).toHaveBeenCalledTimes(1);
  });

  it('preloads once, and forgets a failed preload so the next one fetches again', async () => {
    const importer = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(Hello);
    const Page = lazyRoute('landing', importer);
    await expect(Page.preload()).rejects.toThrow('offline');
    await expect(Page.preload()).resolves.toEqual({ default: Hello });
    await Page.preload();
    expect(importer).toHaveBeenCalledTimes(2);
  });
});
