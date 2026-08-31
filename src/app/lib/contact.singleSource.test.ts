// Structural guard: `lib/contact.ts` is the only file allowed to spell out a
// published contact address.
//
// The OFJR → BuildTrack rebrand was done file by file, and /support kept the
// old identity for almost two months because nothing checked. The addresses
// that replaced it were worse: hola@ / demo@ / beta@buildtrack.gt sat on a
// domain that was never registered, so every one of those buttons opened a
// message to a name that does not resolve — silently, since a mailto never
// reports back. Both failures are invisible to a reviewer reading a diff, and
// both are caught here.

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SUPPORT_EMAIL } from './contact';

const SRC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * The module that owns the address, and this guard, may name it — both explain
 * in prose which addresses are canonical and which are retired.
 */
const OWNERS = ['app/lib/contact.ts', 'app/lib/contact.singleSource.test.ts'];

/** Domains that must never come back: retired brand, and one that never existed. */
const RETIRED_DOMAINS = ['buildtrack.gt', 'ofjrconstruction.com'];

/** `mailto:` followed by a literal address, rather than an interpolated one. */
const HARDCODED_MAILTO = /mailto:[A-Za-z0-9._%+-]/g;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

const files = sourceFiles(SRC_DIR)
  .map(f => ({
    path: relative(SRC_DIR, f).replace(/\\/g, '/'),
    source: readFileSync(f, 'utf8'),
  }))
  .filter(f => !OWNERS.includes(f.path));

it('finds source files to scan (the walk still matches)', () => {
  expect(files.length).toBeGreaterThan(50);
});

it('exports the canonical address on a domain we actually control', () => {
  expect(SUPPORT_EMAIL).toBe('andersonaguirre794@gmail.com');
});

it('no file outside lib/contact.ts hardcodes a published address', () => {
  const offenders = files
    .filter(f => [...f.source.matchAll(HARDCODED_MAILTO)].length > 0)
    .map(f => f.path);

  expect(offenders).toEqual([]);
});

describe.each(RETIRED_DOMAINS)('%s never appears in src/', domain => {
  it('is gone', () => {
    const found = files.filter(f => f.source.includes(domain)).map(f => f.path);
    expect(found).toEqual([]);
  });
});
