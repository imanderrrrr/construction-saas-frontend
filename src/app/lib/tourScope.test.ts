// lib/tourScope — a stack of "who owns the tour right now". The edit window
// opens on top of a ficha tab and hands the scope back on close, whichever
// order the two unmount in.

import { afterEach, describe, expect, it } from 'vitest';
import { pushTourScope, resetTourScope } from './tourScope';
import { useTourScope } from './tourScope';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function Probe() {
  const scope = useTourScope();
  return React.createElement('span', { 'data-testid': 'scope' }, scope ? `${scope.key}|${scope.label ?? ''}` : 'none');
}

describe('tourScope', () => {
  afterEach(() => resetTourScope());

  it('the last claim wins and releasing restores the one underneath', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(React.createElement(Probe)));
    const read = () => host.querySelector('[data-testid="scope"]')!.textContent;

    expect(read()).toBe('none');

    let releaseFicha: () => void = () => {};
    await act(async () => { releaseFicha = pushTourScope({ key: 'projects-ficha-resumen', label: 'Resumen' }); });
    expect(read()).toBe('projects-ficha-resumen|Resumen');

    let releaseWindow: () => void = () => {};
    await act(async () => { releaseWindow = pushTourScope({ key: 'projects-crear' }); });
    expect(read()).toBe('projects-crear|');

    // Out-of-order release (ficha unmounts under the window) must not drop the window's claim.
    await act(async () => releaseFicha());
    expect(read()).toBe('projects-crear|');

    await act(async () => releaseWindow());
    expect(read()).toBe('none');

    await act(async () => root.unmount());
    host.remove();
  });
});
