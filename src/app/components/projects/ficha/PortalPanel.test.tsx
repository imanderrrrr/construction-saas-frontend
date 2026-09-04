// Portal tab of the ficha: status load, generate (with defaults), the
// regenerate / "add PIN" label switch, the two-step revoke, and the three PIN
// states — no link yet / link without PIN (checkbox + security hint) / link
// with PIN (badge, no re-ask, regenerate preserves). Services and the QR
// painter are mocked (jsdom has no canvas). Ported from the share modal's
// suite: the rules did not change, only where they live.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const svc = vi.hoisted(() => ({
  getClientAccessStatus: vi.fn(),
  generateClientAccess: vi.fn(),
  revokeClientAccess: vi.fn(),
}));

vi.mock('../../../services/clientAccess', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/clientAccess')>();
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

import i18n from '../../../../i18n';
import { PortalPanel } from './PortalPanel';

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

describe('PortalPanel', () => {
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

  async function renderPanel(props: Partial<React.ComponentProps<typeof PortalPanel>> = {}) {
    await act(async () => {
      root.render(<PortalPanel projectId={7} clientName="Don Roberto" {...props} />);
    });
    await flush();
  }

  it('loads the status on mount and offers to generate when inactive', async () => {
    svc.getClientAccessStatus.mockResolvedValueOnce(INACTIVE);
    await renderPanel();

    expect(svc.getClientAccessStatus).toHaveBeenCalledWith(7);
    expect(container.textContent).toContain(i18n.t('clientView:share.status.inactive'));
    expect(container.textContent).toContain(i18n.t('admin:projectFicha.portal.intro'));
    expect(container.textContent).toContain(i18n.t('clientView:share.generate'));
    // First share: the PIN option is offered.
    expect(pinCheckbox(container)).toBeTruthy();
    expect(container.textContent).toContain(i18n.t('clientView:share.pin.toggle'));
    expect(container.textContent).not.toContain(i18n.t('clientView:share.pin.badgeNote'));
  });

  it('is the Portal subventana, titled after the client portal', async () => {
    svc.getClientAccessStatus.mockResolvedValueOnce(INACTIVE);
    await renderPanel();
    expect(container.textContent).toContain(i18n.t('admin:projectFicha.title.portal'));
    expect(container.textContent).toContain(i18n.t('admin:projectFicha.purpose.portal'));
    expect(i18n.t('admin:projectFicha.title.portal', { lng: 'es' })).toBe('Portal del cliente');
  });

  it('generates with the default expiry and then shows the link', async () => {
    svc.getClientAccessStatus
      .mockResolvedValueOnce(INACTIVE)
      .mockResolvedValueOnce(ACTIVE);
    svc.generateClientAccess.mockResolvedValueOnce({
      shareToken: 'tok-v1', expiresAt: '2026-10-01T00:00:00Z',
      pinRequired: false, version: 1, clientName: 'Don Roberto',
    });

    await renderPanel();
    await act(async () => {
      findButton(container, i18n.t('clientView:share.generate')).click();
    });
    await flush();

    expect(svc.generateClientAccess).toHaveBeenCalledWith(
      7,
      { pin: undefined, expiresInDays: 90, preservePin: undefined },
    );
    expect(container.textContent).toContain('/client-view/tok-v1');
    expect(container.textContent).toContain(i18n.t('admin:projectFicha.portal.pinOff'));
    // With an existing share, the primary action reads "regenerate".
    expect(container.textContent).toContain(i18n.t('clientView:share.regenerate'));
  });

  it('with an active UNPROTECTED link still offers the PIN, with the security hint', async () => {
    svc.getClientAccessStatus.mockResolvedValueOnce(ACTIVE);
    await renderPanel();

    expect(pinCheckbox(container)).toBeTruthy();
    expect(container.textContent).toContain(i18n.t('clientView:share.pin.toggle'));
    expect(container.textContent).toContain(i18n.t('clientView:share.pin.recommend'));
    expect(container.textContent).not.toContain(i18n.t('clientView:share.pin.badgeNote'));
  });

  it('adding a PIN to an unprotected link says so on the button and sends the PIN (no preservePin)', async () => {
    svc.getClientAccessStatus
      .mockResolvedValueOnce(ACTIVE)
      .mockResolvedValueOnce({ ...ACTIVE_PIN, version: 2, shareToken: 'tok-v2' });
    svc.generateClientAccess.mockResolvedValueOnce({
      shareToken: 'tok-v2', expiresAt: '2026-10-01T00:00:00Z',
      pinRequired: true, version: 2, clientName: 'Don Roberto',
    });

    await renderPanel();
    await act(async () => {
      pinCheckbox(container)!.click();
    });
    // Six boxes that behave like one field: a pasted / autofilled string
    // landing in the first box spreads across all six.
    const boxes = container.querySelectorAll<HTMLInputElement>('input[inputmode="numeric"]');
    expect(boxes.length).toBe(6);
    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
      setValue.call(boxes[0], '135790');
      boxes[0].dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(Array.from(container.querySelectorAll<HTMLInputElement>('input[inputmode="numeric"]')).map(b => b.value).join('')).toBe('135790');

    // Adding a PIN is a regeneration — the button must not pretend otherwise.
    expect(container.textContent).toContain(i18n.t('admin:projectFicha.portal.addPin'));
    await act(async () => {
      findButton(container, i18n.t('admin:projectFicha.portal.addPin')).click();
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

    await renderPanel();

    expect(pinCheckbox(container)).toBeNull();
    expect(container.textContent).not.toContain(i18n.t('clientView:share.pin.toggle'));
    expect(container.textContent).toContain(i18n.t('clientView:share.pin.badge'));
    expect(container.textContent).toContain(i18n.t('clientView:share.pin.badgeNote'));
    expect(container.textContent).toContain(i18n.t('admin:projectFicha.portal.pinOn'));

    await act(async () => {
      findButton(container, i18n.t('clientView:share.regenerate')).click();
    });
    await flush();

    expect(svc.generateClientAccess).toHaveBeenCalledWith(
      7,
      { pin: undefined, expiresInDays: 90, preservePin: true },
    );
    expect(pinCheckbox(container)).toBeNull();
  });

  it('revokes only after the in-line confirm step', async () => {
    svc.getClientAccessStatus
      .mockResolvedValueOnce(ACTIVE)
      .mockResolvedValueOnce(INACTIVE);
    svc.revokeClientAccess.mockResolvedValueOnce(undefined);

    await renderPanel();

    await act(async () => {
      findButton(container, i18n.t('clientView:share.revoke')).click();
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

  it('a closed project shows the state and nothing to change', async () => {
    svc.getClientAccessStatus.mockResolvedValueOnce(ACTIVE);
    await renderPanel({ readOnly: true });

    expect(container.textContent).toContain('/client-view/tok-v1');
    expect(pinCheckbox(container)).toBeNull();
    expect(container.textContent).not.toContain(i18n.t('clientView:share.regenerate'));
    expect(container.textContent).not.toContain(i18n.t('clientView:share.revoke'));
  });

  it('without a client the link cannot be generated', async () => {
    svc.getClientAccessStatus.mockResolvedValueOnce({ ...INACTIVE, clientName: null });
    await renderPanel({ clientName: null });

    expect(container.textContent).toContain(i18n.t('clientView:share.noClient'));
    expect(findButton(container, i18n.t('clientView:share.generate')).disabled).toBe(true);
  });
});
