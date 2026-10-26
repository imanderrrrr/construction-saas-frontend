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
//  - The site log's weather goes through our server to MET Norway, which
//    gets the site's rounded coordinates and never the device's IP address.
//  - A client representative who signs or declines a T&M ticket has their
//    name, title, signature image, IP address and browser or device recorded.
//  - The Google Maps SDK in the app collects data for analytics, so the
//    cookies section cannot deny third-party analytics without saying so.
//  - This panel authenticates with HttpOnly cookies; local storage holds
//    interface preferences, not session tokens.
//  - Brevo sends the platform's emails, and the app can hand a route to
//    Google Maps or Waze.
//  - Section 10 describes the location permission the way section 3 does.
//
// v2.3 (26 October 2026) adds the public website's AI assistant and contact
// form, which only exist on the web: the app's copy has nothing to mirror.

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
    section: (lang: 'es' | 'en', num: number) => text(`#priv-${lang}-${num}`),
  };
}

describe('PrivacyPolicy v2.2', () => {
  it('carries the 26 October 2026 date of v2.3 in both languages', () => {
    const { es, en } = renderVersions();
    expect(es).toContain('26 de octubre de 2026 — v2.3');
    expect(en).toContain('October 26, 2026 — v2.3');
  });

  it('names MET Norway, what it receives and what it does not', () => {
    const { es, en } = renderVersions();
    for (const v of [es, en]) {
      expect(v).toContain('MET Norway');
      expect(v).not.toContain('Open-Meteo');
    }
    expect(es).toContain('coordenadas registradas de la obra');
    expect(es).toContain('redondeadas a unos 11 metros');
    expect(es).toContain('MET Norway no recibe la dirección IP del dispositivo');
    expect(en).toContain('recorded coordinates of the site');
    expect(en).toContain('rounded to about 11 meters');
    expect(en).toContain("MET Norway does not receive the device's IP address");
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

// v2.3 (web only): the public site's AI assistant and contact form. The
// consent box of the form links here, so the policy has to say what the
// assistant sends where, what the form keeps and for how long.
describe('PrivacyPolicy v2.3 — the landing assistant and contact form', () => {
  it('covers the public website and makes Archlogic the controller of its data', () => {
    const { section } = renderVersions();
    expect(section('es', 1)).toContain('sitio web público de BuildTrack');
    expect(section('en', 1)).toContain('public BuildTrack website');
    expect(section('es', 2)).toContain('Datos del sitio web público');
    expect(section('en', 2)).toContain('Public website data');
  });

  it('says where chat messages go, that we keep no conversation, and what the form keeps', () => {
    const { section } = renderVersions();
    const es = section('es', 3);
    const en = section('en', 3);
    expect(es).toContain('se envían a nuestro servidor y a Anthropic');
    expect(es).toContain('No guardamos el contenido de las conversaciones');
    expect(es).toContain('No escriba datos personales en el chat');
    expect(es).toContain('su nombre, su empresa, su correo o teléfono');
    expect(es).toContain('la versión del texto de consentimiento');
    expect(en).toContain('are sent to our server and to Anthropic');
    expect(en).toContain('We do not keep the content of conversations');
    expect(en).toContain("Don't type personal details in the chat");
    expect(en).toContain('your name, company, email or phone');
    expect(en).toContain('the version of the consent text');
  });

  it('names Anthropic and Cloudflare Turnstile as providers, and the United States', () => {
    const { section } = renderVersions();
    for (const lang of ['es', 'en'] as const) {
      expect(section(lang, 6)).toContain('Anthropic');
      expect(section(lang, 6)).toContain('Cloudflare Turnstile');
      expect(section(lang, 8)).toContain('Anthropic');
      expect(section(lang, 8)).toContain('Cloudflare');
    }
    expect(section('es', 6)).toContain('aviso a nuestro equipo de cada contacto');
    expect(section('en', 6)).toContain('notice to our team of each contact');
  });

  it('states the 12-month retention of contacts and how to ask for earlier deletion', () => {
    const { section } = renderVersions();
    expect(section('es', 11)).toContain('se eliminan automáticamente a los 12 meses');
    expect(section('en', 11)).toContain('are deleted automatically after 12 months');
    expect(section('es', 12)).toContain('contactos y mensajes del sitio web');
    expect(section('en', 12)).toContain('website contacts and messages');
  });

  it('bases the form on consent and the assistant on legitimate interest', () => {
    const { section } = renderVersions();
    expect(section('es', 5)).toContain('casilla de consentimiento');
    expect(section('en', 5)).toContain('consent box');
  });
});
