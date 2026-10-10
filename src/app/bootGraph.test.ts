// AUD-019 — what main.tsx pulls in statically is what every visitor downloads
// before anything paints. It must not reach a page (every page is a lazy
// chunk), the platform console, the PDF/QR/animation libraries or any
// translation table (they load per language and namespace).

import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// @ts-expect-error — a plain .mjs tool, no type declarations
import { reachableFiles } from '../../tools/i18n-namespaces.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');
const files: string[] = reachableFiles(['src/main.tsx'], { staticOnly: true }).map((f: string) => relative(ROOT, f));

const HEAVY_PACKAGE = /\bfrom\s+['"](jspdf|jspdf-autotable|qrcode|motion\/react|framer-motion|exceljs|html2canvas)['"]/;
const TABLE_IMPORT = /\bimport\s+[^;]*?['"][^'"]*\/locales\/[a-z]+\/\w+\.json['"]/;

describe('the boot graph (static imports from main.tsx)', () => {
  it('is found (the walker still matches the imports)', () => {
    expect(files).toContain('src/app/App.tsx');
    expect(files).toContain('src/app/routes.tsx');
    expect(files).toContain('src/i18n/index.ts');
  });

  it('reaches no page and no part of the platform console', () => {
    expect(files.filter(f => f.startsWith('src/app/pages/') || f.startsWith('src/platform/'))).toEqual([]);
  });

  it('imports no PDF, QR or animation library statically', () => {
    expect(files.filter(f => HEAVY_PACKAGE.test(read(f)))).toEqual([]);
  });

  it('imports no translation table statically', () => {
    expect(files.filter(f => TABLE_IMPORT.test(read(f)))).toEqual([]);
  });

  it('resolves the translations to the per-file loader, not the bundled test tables', () => {
    expect(read('vite.config.ts')).toMatch(/'@buildtrack\/i18n-locales':\s*path\.resolve\(__dirname, '\.\/src\/i18n\/locales\.ts'\)/);
    const loader = read('src/i18n/locales.ts');
    expect(loader).toContain("import.meta.glob<{ default: Table }>('./locales/*/*.json')");
    expect(loader).not.toMatch(/eager:\s*true/);
  });
});
