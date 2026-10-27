import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import esDocs from '../../i18n/locales/es/docs.json';
import enDocs from '../../i18n/locales/en/docs.json';

// The docs namespace resolves to the real Spanish copy, so a section whose step
// count in `SECTIONS` drifts from docs.json shows up here as a missing key (too
// many steps) or an unread one (too few). Other namespaces echo the key.
const { asked } = vi.hoisted(() => ({ asked: new Set<string>() }));

vi.mock('react-i18next', () => {
  const bundles: Record<string, Record<string, string>> = { es: esDocs, en: enDocs };
  return {
    useTranslation: (ns?: string) => ({
      t: (key: string) => {
        if (ns !== 'docs') return key;
        asked.add(key);
        return bundles.es[key] ?? `MISSING:${key}`;
      },
      i18n: {
        language: 'es',
        resolvedLanguage: 'es',
        changeLanguage: vi.fn(),
        getResourceBundle: (lng: string) => bundles[lng],
      },
    }),
  };
});

vi.mock('react-router', () => ({
  Link: ({ children, to, className }: { children: React.ReactNode; to: string; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}));

import { Docs } from './Docs';
import { SUPPORT_EMAIL } from '../lib/contact';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

window.matchMedia = ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
})) as typeof window.matchMedia;

describe('Docs — every guide renders from its copy', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    asked.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<Docs />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const search = (value: string) => {
    const input = container.querySelector('input[type="search"]') as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    act(() => {
      setter.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };
  const sectionIds = () => Array.from(container.querySelectorAll('main section[id]')).map((s) => s.id);

  it('asks only for keys that exist', () => {
    expect(container.textContent).not.toContain('MISSING:');
  });

  it('renders every step written in docs.json — none left unread', () => {
    const stepKeys = Object.keys(esDocs).filter((k) => /\.step\.\d+\.(bold|rest)$/.test(k));
    expect(stepKeys.filter((k) => !asked.has(k))).toEqual([]);
  });

  it('gives every module guide its audience and its payoff', () => {
    const modules = Object.keys(esDocs)
      .map((k) => /^(s\d+)\.code$/.exec(k)?.[1])
      .filter((p): p is string => !!p && p !== 's0');
    expect(modules.length).toBeGreaterThan(10);
    for (const p of modules) {
      expect(asked.has(`${p}.who`), `${p}.who`).toBe(true);
      expect(asked.has(`${p}.gain`), `${p}.gain`).toBe(true);
    }
  });

  it('lists every guide in the side nav', () => {
    const anchors = Array.from(container.querySelectorAll('aside a[href^="#"]')).map((a) => a.getAttribute('href'));
    expect(anchors).toEqual(sectionIds().map((id) => `#${id}`));
  });

  it('searches both languages', () => {
    search('planilla');
    expect(sectionIds()).toContain('doc-asistencia');
    search('accounts payable');
    expect(sectionIds()).toContain('doc-pagos');
    search('zzzz-nada');
    expect(sectionIds()).toEqual([]);
  });

  it('closes with the demo and beta doors, by mail', () => {
    const mailtos = Array.from(container.querySelectorAll('a[href^="mailto:"]')).map((a) => a.getAttribute('href'));
    expect(mailtos).toContain(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(esDocs['cta.demoSubject'])}`);
    expect(mailtos).toContain(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(esDocs['cta.betaSubject'])}`);
  });

  it('links the footer to privacy, terms and status like the rest of the public site', () => {
    const footer = Array.from(container.querySelectorAll('footer a')).map((a) => a.getAttribute('href'));
    expect(footer).toEqual(['/privacy', '/terms', '/status']);
  });
});
