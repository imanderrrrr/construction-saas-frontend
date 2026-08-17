// Structural guard: every lazy section a dashboard renders must sit inside a
// <Suspense> boundary.
//
// A lazy component rendered bare suspends during the synchronous update
// triggered by the menu click; with no boundary to catch it, React 18 throws
// error #426 and the router swaps the app for "Unexpected Application Error!".
// That exact regression shipped for the T&M sections because they were added
// outside the wrapper the other sections use — this test makes the property
// hold for every lazy component in every page file, present and future.

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const PAGES_DIR = dirname(fileURLToPath(import.meta.url));

/** Names declared as `const X = lazy(...)` or `const X = lazyWithRetry(...)`. */
function lazyComponentNames(source: string): string[] {
  return [...source.matchAll(/const\s+(\w+)\s*=\s*lazy(?:WithRetry)?\s*\(/g)].map(m => m[1]);
}

/** True when the given source offset is inside a <Suspense>…</Suspense> span. */
function insideSuspense(source: string, offset: number): boolean {
  const before = source.slice(0, offset);
  const opens = (before.match(/<Suspense[\s>]/g) ?? []).length;
  const closes = (before.match(/<\/Suspense>/g) ?? []).length;
  return opens > closes;
}

const pageFiles = readdirSync(PAGES_DIR)
  .filter(f => f.endsWith('.tsx') && !f.includes('.test.'))
  .filter(f => lazyComponentNames(readFileSync(join(PAGES_DIR, f), 'utf8')).length > 0);

it('finds page files that declare lazy sections (scan still matches)', () => {
  expect(pageFiles.length).toBeGreaterThan(0);
});

describe.each(pageFiles)('%s', file => {
  const source = readFileSync(join(PAGES_DIR, file), 'utf8');
  const names = lazyComponentNames(source);

  it.each(names.map(name => [name]))('renders %s inside <Suspense>', name => {
    const usages = [...source.matchAll(new RegExp(`<${name}[\\s/>]`, 'g'))];
    for (const usage of usages) {
      expect(
        insideSuspense(source, usage.index),
        `<${name}> at offset ${usage.index} must be wrapped in <Suspense> — ` +
        'a bare lazy component crashes the dashboard with React error #426 ' +
        'when the user clicks its menu item',
      ).toBe(true);
    }
  });
});
