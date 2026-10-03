// BuildTrack — the signature screens wear the panel's design, not a port's.
//
// The block was ported from OFJR with generic Tailwind classes (`bg-purple-600`,
// `text-zinc-500`, `rounded-lg`) and read as a foreign object inside the
// invoice it sits in; the public signing page too. The owner's rule is that
// everything new follows the admin panel's design, whatever its size, and
// nothing at typecheck or lint notices a stray palette class — so this reads
// the sources of every signature screen and does. Same enforcement as the
// section-tour registry: two files that must agree, checked by a test.

import { readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Every signature screen: this directory's components and the public page. */
const FILES = [
  ...readdirSync(HERE)
    .filter(f => /\.tsx$/.test(f) && !/\.test\.tsx$/.test(f))
    .map(f => join(HERE, f)),
  resolve(HERE, '../../pages/SignDocument.tsx'),
].map(path => ({ file: basename(path), text: readFileSync(path, 'utf8') }));

const UTILITY = '(?:bg|text|border|ring|outline|fill|stroke|from|to|via|divide|placeholder|shadow|accent|decoration|caret)';

/** The four the owner named when he saw the port: the purple button and the grey type. */
const PORTED_PALETTE = new RegExp(`\\b${UTILITY}-(?:purple|violet|indigo|zinc)-\\d{2,3}\\b`, 'g');

/** Every other named Tailwind palette. The panel paints with its own hex tokens. */
const GENERIC_PALETTE = new RegExp(
  `\\b${UTILITY}-(?:gray|slate|neutral|stone|amber|emerald|red|orange|blue|sky|green|yellow|lime|teal|cyan|rose|pink|fuchsia)-\\d{2,3}\\b`,
  'g',
);

/** Radius is 0 everywhere in the panel; `rounded-none` is the one spelling allowed. */
const RADIUS = /(?<![\w-])rounded(?:-(?!none\b)[^\s"'`]+)?(?![\w-])/g;

/** The panel's monospace is `font-bt-mono` (IBM Plex Mono), never the generic stack. */
const GENERIC_MONO = /\bfont-mono\b/g;

function hits(text: string, re: RegExp): string[] {
  return text.split('\n').flatMap((line, i) =>
    [...line.matchAll(re)].map(m => `${i + 1}: ${m[0]}`));
}

describe('signature screens follow the panel design', () => {
  it('reads every signature screen', () => {
    const names = FILES.map(f => f.file);
    expect(names).toEqual(expect.arrayContaining([
      'SignatureRequestPanel.tsx', 'SignatureDocumentView.tsx', 'SignaturePad.tsx', 'SignDocument.tsx',
    ]));
  });

  it.each(FILES)('$file has no purple, violet, indigo or zinc class left from the port', ({ text }) => {
    expect(hits(text, PORTED_PALETTE)).toEqual([]);
  });

  it.each(FILES)('$file paints with the panel tokens, not a named Tailwind palette', ({ text }) => {
    expect(hits(text, GENERIC_PALETTE)).toEqual([]);
  });

  it.each(FILES)('$file is square and set in the panel mono', ({ text }) => {
    expect(hits(text, RADIUS)).toEqual([]);
    expect(hits(text, GENERIC_MONO)).toEqual([]);
  });

  it.each(FILES)('$file uses the panel type and, where it has controls, the panel focus ring', ({ text }) => {
    // Mono type either as the class or through the `Mono` piece of the kit.
    expect(/font-bt-mono/.test(text) || /\bMono\b/.test(text)).toBe(true);
    if (/<button\b/.test(text)) {
      expect(text, 'a screen with buttons must wear FOCUS_RING from onboarding/chrome').toMatch(/\bFOCUS_RING\b/);
    }
  });
});
