// lib/tourRequest — one slot for "open this section's tour at this stop",
// written by the screen that sends the user somewhere and read by the tour
// of the screen they land on.

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { consumeTourRequest, requestTourStop, resetTourRequests, useTourRequest } from './tourRequest';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function Probe() {
  const request = useTourRequest();
  return React.createElement('span', { 'data-testid': 'request' }, request ? `${request.section}|${request.key}` : 'none');
}

describe('tourRequest', () => {
  afterEach(() => resetTourRequests());

  it('is empty until somebody asks, and taking it is one-shot', () => {
    expect(consumeTourRequest()).toBeNull();
    requestTourStop('accounts-receivable', 'signature');
    expect(consumeTourRequest()).toEqual({ section: 'accounts-receivable', key: 'signature' });
    expect(consumeTourRequest()).toBeNull();
  });

  it('a later request replaces the one still waiting', () => {
    requestTourStop('accounts-receivable', 'signature');
    requestTourStop('projects', 'kpis');
    expect(consumeTourRequest()).toEqual({ section: 'projects', key: 'kpis' });
  });

  it('a component sees the request as it is made, and its absence once taken', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(React.createElement(Probe)));
    const read = () => host.querySelector('[data-testid="request"]')!.textContent;

    expect(read()).toBe('none');
    await act(async () => { requestTourStop('accounts-receivable', 'signature'); });
    expect(read()).toBe('accounts-receivable|signature');
    await act(async () => { consumeTourRequest(); });
    expect(read()).toBe('none');

    await act(async () => root.unmount());
    host.remove();
  });
});
