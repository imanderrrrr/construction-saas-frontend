// AUD-019 — every page in routes.tsx is a lazy chunk, and every place that
// renders one gives it a loading state and a load-failure screen: either a
// <RoutePage> around it, or a <GuardedPage> (which wraps its children in one).

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'routes.tsx'), 'utf8');
const names = [...source.matchAll(/const\s+(\w+)\s*=\s*lazyRoute\(/g)].map(m => m[1]);

function inside(open: RegExp, close: RegExp, offset: number) {
  const before = source.slice(0, offset);
  return (before.match(open) ?? []).length > (before.match(close) ?? []).length;
}

describe('routes.tsx', () => {
  it('imports no page statically', () => {
    expect(source).not.toMatch(/^import\s+\{[^}]*\}\s+from\s+'\.\/pages\//m);
    expect(source).not.toMatch(/^import\s+[^;]*'\.\.\/platform\//m);
    expect(names.length).toBeGreaterThan(25);
  });

  it('wraps the children of every guarded page in a RoutePage', () => {
    const body = source.slice(source.indexOf('function GuardedPage('), source.indexOf('// Role dashboard redirect'));
    expect((body.match(/<RoutePage>\{children\}<\/RoutePage>/g) ?? []).length).toBe(2);
  });

  it.each(names.map(n => [n]))('renders %s inside a RoutePage or a GuardedPage', name => {
    const usages = [...source.matchAll(new RegExp(`<${name}[\\s/>]`, 'g'))];
    expect(usages.length, `${name} is never rendered`).toBeGreaterThan(0);
    for (const usage of usages) {
      const ok = inside(/<RoutePage>/g, /<\/RoutePage>/g, usage.index!)
        || inside(/<GuardedPage[\s>]/g, /<\/GuardedPage>/g, usage.index!);
      expect(ok, `<${name}> at offset ${usage.index} has no loading state / error screen around it`).toBe(true);
    }
  });
});
