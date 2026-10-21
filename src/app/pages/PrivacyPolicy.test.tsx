import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PrivacyPolicy } from './PrivacyPolicy';

vi.mock('react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

// /privacy is the policy App Store review compares with the one embedded in
// the app (`mobile-buildtrack/lib/features/auth/data/legal_content.dart`,
// guarded by `test/legal_v22_disclosures_test.dart` over there). Nothing
// compares the two copies, so each repo pins the same v2.2 facts:
//
//  - Open-Meteo receives the site's coordinates and the device's IP address
//    when the site log detects the weather (the app calls it directly).
//  - A client representative who signs or declines a T&M ticket has their
//    name, title, signature image, IP address and browser or device recorded.
//  - The Google Maps SDK in the app collects data for analytics, so the
//    cookies section cannot deny third-party analytics without saying so.
//  - This panel authenticates with HttpOnly cookies; local storage holds
//    interface preferences, not session tokens.
//  - Brevo sends the platform's emails, and the app can hand a route to
//    Google Maps or Waze.
//  - Section 10 describes the location permission the way section 3 does.

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

function renderVersions() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root!.render(<PrivacyPolicy />));
  const host = container;
  const text = (selector: string) =>
    (host.querySelector(selector)?.textContent ?? '').replace(/\s+/g, ' ');
  return {
    es: text('#priv-es'),
    en: text('#priv-en'),
    cookiesEs: text('#priv-es-14'),
    cookiesEn: text('#priv-en-14'),
    permissionsEs: text('#priv-es-10'),
    permissionsEn: text('#priv-en-10'),
  };
}

describe('PrivacyPolicy v2.2', () => {
  it('carries the 21 October 2026 date in both languages', () => {
    const { es, en } = renderVersions();
    expect(es).toContain('21 de octubre de 2026 — v2.2');
    expect(en).toContain('October 21, 2026 — v2.2');
  });

  it('names Open-Meteo, what it receives and what it does not', () => {
    const { es, en } = renderVersions();
    for (const v of [es, en]) {
      expect(v).toContain('Open-Meteo');
      expect(v).toContain('api.open-meteo.com');
    }
    expect(es).toContain('coordenadas registradas de la obra');
    expect(es).toContain('dirección IP del dispositivo');
    expect(es).toContain('no la ubicación del dispositivo');
    expect(en).toContain('recorded coordinates of the site');
    expect(en).toContain("device's IP address");
    expect(en).toContain("not the device's location");
  });

  it('lists what is recorded about a T&M signer', () => {
    const { es, en } = renderVersions();
    expect(es).toContain('su nombre, su cargo, la imagen de su firma manuscrita');
    expect(es).toContain('la dirección IP y el navegador o dispositivo');
    expect(en).toContain('their name, title, an image of their handwritten signature');
    expect(en).toContain('the IP address and the browser or device');
    expect(es).toContain('Si lo rechaza desde el enlace, se registran el motivo');
    expect(en).toContain('If they decline it from the link, the reason');
  });

  it('names Brevo and the Google Maps / Waze hand-off', () => {
    const { es, en } = renderVersions();
    expect(es).toContain('Brevo');
    expect(en).toContain('Brevo');
    expect(es).toContain('abrir el camino en Google Maps o Waze');
    expect(en).toContain('open the route in Google Maps or Waze');
  });

  it('describes the location permission like section 3 does', () => {
    const { permissionsEs, permissionsEn } = renderVersions();
    expect(permissionsEs).toContain('registrar la ubicación de las marcas');
    expect(permissionsEn).toContain('record time-event locations');
    expect(permissionsEs).not.toContain('al fichar (geocerca)');
    expect(permissionsEn).not.toContain('when clocking in (geofence)');
  });

  it('does not say email comes only from the company sign-up', () => {
    const { es, en } = renderVersions();
    expect(es).not.toContain('únicamente en el alta web');
    expect(es).toContain('una invitación o un enlace de firma');
    expect(en).toContain('an invitation or a signature link by email');
  });

  it('does not deny the Maps SDK analytics in the cookies section', () => {
    const { cookiesEs, cookiesEn } = renderVersions();
    expect(cookiesEs).toContain('SDK de Google Maps');
    expect(cookiesEn).toContain('Google Maps SDK');
  });

  it('describes this panel with cookies, not session tokens in local storage', () => {
    const { es, en, cookiesEs, cookiesEn } = renderVersions();
    expect(es).not.toContain('únicamente para los tokens de sesión');
    expect(en).not.toContain('solely for session tokens');
    expect(cookiesEs).toContain('cookies técnicas');
    expect(cookiesEn).toContain('technical cookies');
  });

  it('does not put every provider under a processing agreement', () => {
    const { es, en } = renderVersions();
    expect(es).not.toContain('de la sección 6, que operan bajo acuerdos');
    expect(en).not.toContain('listed in section 6, operating under confidentiality');
  });
});
