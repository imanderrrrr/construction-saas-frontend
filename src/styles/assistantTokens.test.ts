// Guard for the two colour tokens and the animation the landing assistant adds
// to the public theme. The tokens exist for contrast: plain orange on paper is
// 2.4:1 and the old rule colour gives a field border of 1.4:1, so the ratios are
// asserted from the values in the stylesheet itself — a later tweak to paper,
// sheet or muted that breaks them fails here instead of in an audit.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'tailwind.css'), 'utf8');

/** The bodies of every `@theme { … }` block, concatenated. */
const themeBodies = [...css.matchAll(/@theme\s*\{([^}]*)\}/g)].map(m => m[1]).join('\n');

function token(name: string): string {
  const match = themeBodies.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`));
  if (!match) throw new Error(`--color-${name} is not defined inside @theme`);
  return match[1];
}

/** WCAG 2.x relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('assistant theme tokens', () => {
  it('defines --color-bt-orange-ink as #B23909 and --color-bt-field as #857A69 inside @theme', () => {
    expect(token('bt-orange-ink').toUpperCase()).toBe('#B23909');
    expect(token('bt-field').toUpperCase()).toBe('#857A69');
  });

  it('defines @keyframes bt-blink with opacity .25 at 0% and 100% and 1 at 50%', () => {
    const block = css.match(/@keyframes\s+bt-blink\s*\{([\s\S]*?\})\s*\}/);
    expect(block, '@keyframes bt-blink is missing').not.toBeNull();
    const body = block![1].replace(/\s+/g, '');
    expect(body).toMatch(/0%,100%\{opacity:\.25;?\}/);
    expect(body).toMatch(/50%\{opacity:1;?\}/);
  });

  it('orange-ink on paper and on sheet is at least 4.5', () => {
    expect(contrast(token('bt-orange-ink'), token('bt-paper'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token('bt-orange-ink'), token('bt-sheet'))).toBeGreaterThanOrEqual(4.5);
  });

  it('muted on sheet is at least 4.5', () => {
    expect(contrast(token('bt-muted'), token('bt-sheet'))).toBeGreaterThanOrEqual(4.5);
  });

  it('field on sheet and on paper is at least 3', () => {
    expect(contrast(token('bt-field'), token('bt-sheet'))).toBeGreaterThanOrEqual(3);
    expect(contrast(token('bt-field'), token('bt-paper'))).toBeGreaterThanOrEqual(3);
  });
});
