// "Compartir portal del cliente" modal: status load, generate (with
// defaults), the regenerate label switch, the two-step revoke, and the three
// PIN states — no link yet / link without PIN (checkbox + security hint) /
// link with PIN (badge, no re-ask, regenerate preserves). Services and the QR
// painter are mocked (jsdom has no canvas).

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const svc = vi.hoisted(() => ({
  getClientAccessStatus: vi.fn(),
  generateClientAccess: vi.fn(),
  revokeClientAccess: vi.fn(),
}));

vi.mock('../../services/clientAccess', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/clientAccess')>();
  return {
    ...actual,
    getClientAccessStatus: svc.getClientAccessStatus,
    generateClientAccess: svc.generateClientAccess,
    revokeClientAccess: svc.revokeClientAccess,
  };
});

vi.mock('qrcode', () => ({
  default: { toCanvas: vi.fn().mockResolvedValue(undefined) },
}));

import i18n from '../../../i18n';
import { ShareSiteLogModal } from './ShareSiteLogModal';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const INACTIVE = {
  enabled: false, active: false, pinRequired: false, expiresAt: null,
  version: 0, clientName: 'Don Roberto', projectOpen: true, shareToken: null,
};

const ACTIVE = {
  enabled: true, active: true, pinRequired: false, expiresAt: '2026-10-01T00:00:00Z',
  version: 1, clientName: 'Don Roberto', projectOpen: true, shareToken: 'tok-v1',
};

const ACTIVE_PIN = { ...ACTIVE, pinRequired: true };

const pinCheckbox = (container: HTMLElement) =>
  container.querySelector<HTMLInputElement>('input[type="checkbox"]');

function findButton(container: HTMLElement, text: string): HTMLButtonElement {
  const btn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes(text));
  expect(btn, `button "${text}" not found`).toBeTruthy();
  return btn as HTMLButtonElement;
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('ShareSiteLogModal', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    svc.getClientAccessStatus.mockReset();
    svc.generateClientAccess.mockReset();
    svc.revokeClientAccess.mockReset();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  async function renderModal() {
    await act(async () => {
      root.render(
        <ShareSiteLogModal
          open
          onClose={() => {}}
          projectId={7}
          projectName="Casa Roble"
          clientName="Don Roberto"
        />,
      );
    });
    await flush();
  }

  it('loads the status on open and offers to generate when inactive', async () => {
    svc.getClientAccessStatus.mockResolvedValueOnce(INACTIVE);
    await renderModal();

    expect(svc.getClientAccessStatus).toHaveBeenCalledWith(7);
    expect(container.textContent).toContain(i18n.t('clientView:share.status.inactive'));
    expect(container.textContent).toContain(i18n.t('clientView:share.generate'));
    // First share: the PIN option is offered, with the security recommendation.
    expect(pinCheckbox(container)).toBeTruthy();
    expect(container.textContent).toContain(i18n.t('clientView:share.pin.toggle'));
    expect(container.textContent).toContain(i18n.t('clientView:share.pin.recommend'));
    expect(container.textContent).not.toContain(i18n.t('clientView:share.pin.badgeNote'));
  });

  it('is titled after the client portal, not the bitácora', async () => {
    svc.getClientAccessStatus.mockResolvedValueOnce(INACTIVE);
    await renderModal();

    expect(container.textContent).toContain(i18n.t('clientView:share.title'));
    expect(i18n.t('clientView:share.title', { lng: 'es' })).toBe('Compartir portal del cliente');
    expect(i18n.t('clientView:share.title', { lng: 'en' })).toBe('Share client portal');
    expect(i18n.t('clientView:share.button', { lng: 'es' })).toBe('Compartir portal del cliente');
    expect(i18n.t('clientView:share.button', { lng: 'en' })).toBe('Share client portal');
  });

  it('generates with the default expiry and then shows the link', async () => {
    svc.getClientAccessStatus
      .mockResolvedValueOnce(INACTIVE)
      .mockResolvedValueOnce(ACTIVE);
    svc.generateClientAccess.mockResolvedValueOnce({
      shareToken: 'tok-v1', expiresAt: '2026-10-01T00:00:00Z',
      pinRequired: false, version: 1, clientName: 'Don Roberto',
    });

    await renderModal();
    await act(async () => {
      findButton(container, i18n.t('clientView:share.generate')).click();
    });
    await flush();

    expect(svc.generateClientAccess).toHaveBeenCalledWith(
      7,
      { pin: undefined, expiresInDays: 90, preservePin: undefined },
    );
    expect(container.textContent).toContain('/client-view/tok-v1');
    expect(container.textContent).toContain(i18n.t('clientView:share.status.active'));
    // With an existing share, the primary action reads "regenerate".
    expect(container.textContent).toContain(i18n.t('clientView:share.regenerate'));
  });

  it('with an active UNPROTECTED link still offers the PIN, with the security hint', async () => {
    svc.getClientAccessStatus.mockResolvedValueOnce(ACTIVE);
    await renderModal();

    // "Si no lo coloqué la primera vez, me debe preguntar otra vez."
    expect(pinCheckbox(container)).toBeTruthy();
    expect(container.textContent).toContain(i18n.t('clientView:share.pin.toggle'));
    expect(container.textContent).toContain(i18n.t('clientView:share.pin.recommend'));
    expect(container.textContent).not.toContain(i18n.t('clientView:share.pin.badgeNote'));
  });

  it('regenerating an unprotected link with the PIN checked protects it (no preservePin)', async () => {
    svc.getClientAccessStatus
      .mockResolvedValueOnce(ACTIVE)
      .mockResolvedValueOnce({ ...ACTIVE_PIN, version: 2, shareToken: 'tok-v2' });
    svc.generateClientAccess.mockResolvedValueOnce({
      shareToken: 'tok-v2', expiresAt: '2026-10-01T00:00:00Z',
      pinRequired: true, version: 2, clientName: 'Don Roberto',
    });

    await renderModal();
    await act(async () => {
      pinCheckbox(container)!.click();
    });
    const pinInput = container.querySelector<HTMLInputElement>('input[inputmode="numeric"]');
    expect(pinInput).toBeTruthy();
    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value',
      )!.set!;
      setValue.call(pinInput, '135790');
      pinInput!.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      findButton(container, i18n.t('clientView:share.regenerate')).click();
    });
    await flush();

    expect(svc.generateClientAccess).toHaveBeenCalledWith(
      7,
      { pin: '135790', expiresInDays: 90, preservePin: undefined },
    );
  });

  it('with a PIN-protected link shows the badge, never re-asks, and regenerates with preservePin', async () => {
    svc.getClientAccessStatus
      .mockResolvedValueOnce(ACTIVE_PIN)
      .mockResolvedValueOnce({ ...ACTIVE_PIN, version: 2, shareToken: 'tok-v2' });
    svc.generateClientAccess.mockResolvedValueOnce({
      shareToken: 'tok-v2', expiresAt: '2026-10-01T00:00:00Z',
      pinRequired: true, version: 2, clientName: 'Don Roberto',
    });

    await renderModal();

    // "Si ya lo coloqué una vez, no me lo pregunta": badge instead of checkbox.
    expect(pinCheckbox(container)).toBeNull();
    expect(container.textContent).not.toContain(i18n.t('clientView:share.pin.toggle'));
    expect(container.textContent).not.toContain(i18n.t('clientView:share.pin.recommend'));
    expect(container.textContent).toContain(i18n.t('clientView:share.pin.badge'));
    expect(container.textContent).toContain(i18n.t('clientView:share.pin.badgeNote'));

    await act(async () => {
      findButton(container, i18n.t('clientView:share.regenerate')).click();
    });
    await flush();

    // The regeneration carries the stored PIN over instead of dropping it.
    expect(svc.generateClientAccess).toHaveBeenCalledWith(
      7,
      { pin: undefined, expiresInDays: 90, preservePin: true },
    );
    expect(pinCheckbox(container)).toBeNull();
    expect(container.textContent).toContain(i18n.t('clientView:share.pin.badge'));
  });

  it('revokes only after the confirm step', async () => {
    svc.getClientAccessStatus
      .mockResolvedValueOnce(ACTIVE)
      .mockResolvedValueOnce(INACTIVE);
    svc.revokeClientAccess.mockResolvedValueOnce(undefined);

    await renderModal();

    const revokeBtn = findButton(container, i18n.t('clientView:share.revoke'));
    await act(async () => {
      revokeBtn.click();
    });
    // First click only arms the confirmation.
    expect(svc.revokeClientAccess).not.toHaveBeenCalled();
    expect(container.textContent).toContain(i18n.t('clientView:share.revokeConfirm'));

    await act(async () => {
      findButton(container, i18n.t('clientView:share.revokeConfirm')).click();
    });
    await flush();

    expect(svc.revokeClientAccess).toHaveBeenCalledWith(7);
    expect(container.textContent).toContain(i18n.t('clientView:share.revoked'));
  });
});
