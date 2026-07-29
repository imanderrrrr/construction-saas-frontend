import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useSystemHealth } from './useSystemHealth';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/**
 * The status page's honesty depends entirely on this mapping, and the branches
 * can't be driven from a browser: the backend only accepts the production
 * origin, so locally every request lands in the `unknown` path. These cover the
 * rest.
 */

function Probe() {
  const { health } = useSystemHealth();
  return <span data-testid="health">{health}</span>;
}

describe('useSystemHealth', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
  });

  async function healthAfter(fetchImpl: typeof fetch): Promise<string> {
    vi.stubGlobal('fetch', fetchImpl);
    await act(async () => {
      root.render(<Probe />);
    });
    // let the probe's promise chain settle
    await act(async () => {});
    return container.querySelector('[data-testid="health"]')!.textContent ?? '';
  }

  const respond = (status: number, body: unknown) =>
    (async () =>
      ({
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
      }) as unknown as Response) as unknown as typeof fetch;

  it('reports "up" when actuator says UP', async () => {
    expect(await healthAfter(respond(200, { status: 'UP', groups: ['liveness', 'readiness'] }))).toBe(
      'up',
    );
  });

  it('reports "down" when actuator says DOWN with a 503', async () => {
    expect(await healthAfter(respond(503, { status: 'DOWN' }))).toBe('down');
  });

  it('reports "down" for any other non-UP actuator verdict', async () => {
    expect(await healthAfter(respond(503, { status: 'OUT_OF_SERVICE' }))).toBe('down');
  });

  // The one that matters most: a blocked origin is not an outage. Rendering red
  // here would tell every visitor the product is broken when it is fine.
  it('reports "unknown" — never "down" — when the request is rejected (CORS/offline)', async () => {
    const rejecting = (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    expect(await healthAfter(rejecting)).toBe('unknown');
  });

  it('reports "unknown" when the response carries no verdict', async () => {
    expect(await healthAfter(respond(200, {}))).toBe('unknown');
  });
});
