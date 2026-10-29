// Each legal page states one version, not two.
//
// The App Store audit of 2.3.0 (2026-10-29) opened /privacy — the Privacy
// Policy URL a reviewer opens from App Store Connect — and read
// «Última actualización: 27 de octubre de 2026 — v2.4» over a box that said
// «VERSIÓN 2.3». The header was bumped for v2.4 and the box was not. This pins
// the box to the header on every legal page, in both languages.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PrivacyPolicy } from '../PrivacyPolicy';
import { Support } from '../Support';
import { TermsOfService } from '../TermsOfService';

vi.mock('react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

function render(page: React.ReactElement): HTMLElement {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root!.render(page));
  return container;
}

const pages: Array<[string, () => React.ReactElement]> = [
  ['Privacy Policy', () => <PrivacyPolicy />],
  ['Terms of Service', () => <TermsOfService />],
  ['Support', () => <Support />],
];

describe('legal pages: the version box matches the header', () => {
  for (const [name, page] of pages) {
    it(name, () => {
      const host = render(page());
      const articles = host.querySelectorAll('article.ld-article');
      expect(articles.length).toBe(2);
      for (const article of articles) {
        const header = article.querySelector('.ld-sub')?.textContent ?? '';
        const fromHeader = header.match(/v(\d+\.\d+)\s*$/)?.[1];
        expect(fromHeader, `header «${header}»`).toBeDefined();

        const box = [...article.querySelectorAll('.ld-meta > div')].find(
          (div) => /^Versi[oó]n$/i.test(div.querySelector('dt')?.textContent ?? ''),
        );
        expect(box, `${name} has a version box`).toBeDefined();
        expect(box!.querySelector('dd')?.textContent?.trim()).toBe(fromHeader);
      }
    });
  }
});
