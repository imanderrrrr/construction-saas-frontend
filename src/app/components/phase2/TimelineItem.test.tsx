import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TimeEvent } from '../../types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string | object, opts?: { user?: string }) => {
      // Mirror i18next's (key, defaultValue, options) shape used in the component.
      if (typeof fallback === 'string') {
        return fallback.replace('{{user}}', opts?.user ?? '');
      }
      return _key;
    },
    i18n: { language: 'en-US' },
  }),
}));

vi.mock('../ui/button', () => ({
  Button: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
}));

import { TimelineItem } from './TimelineItem';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function mkEvent(partial: Partial<TimeEvent>): TimeEvent {
  return {
    id: 1,
    type: 'CHECK_IN',
    capturedAt: '2026-07-01T13:00:00Z',
    locationStatus: 'OK',
    lat: 9.0,
    lng: -79.5,
    distanceMeters: 12,
    approvalStatus: 'PENDING',
    ...partial,
  };
}

describe('TimelineItem — manual marks', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  async function render(event: TimeEvent) {
    await act(async () => {
      root.render(<TimelineItem event={event} />);
    });
  }

  it('organic punch with GPS shows the Google Maps link and no manual badge', async () => {
    await render(mkEvent({}));
    const link = container.querySelector('a[href*="google.com/maps"]');
    expect(link).not.toBeNull();
    expect(container.querySelector('[data-testid="manual-mark-badge"]')).toBeNull();
  });

  it('manual mark shows the badge with the creator and hides map link and location chip', async () => {
    await render(mkEvent({
      manualCreatorUsername: 'admin_ana',
      lat: null,
      lng: null,
      distanceMeters: null,
    }));
    const badge = container.querySelector('[data-testid="manual-mark-badge"]');
    expect(badge).not.toBeNull();
    expect(badge!.textContent).toContain('admin_ana');
    expect(container.querySelector('a[href*="google.com/maps"]')).toBeNull();
    expect(container.textContent).not.toContain('Location OK');
  });

  it('manual badge wins even if stale GPS data were ever present', async () => {
    // Defensive: manual marks never carry GPS, but the link must key off
    // provenance, not on coordinate presence.
    await render(mkEvent({ manualCreatorUsername: 'fin_bob' }));
    expect(container.querySelector('[data-testid="manual-mark-badge"]')).not.toBeNull();
    expect(container.querySelector('a[href*="google.com/maps"]')).toBeNull();
  });
});
