#!/usr/bin/env node
// JavaScript budget for the first anonymous view of the landing (AUD-019).
//
// Measures the SET the browser needs to paint `/` — not just the file called
// index: splitting one file into several is not a smaller download. The set
// is read from the build manifest:
//   · the entry chunk and every chunk it imports statically (modulepreload);
//   · the landing page's own chunk and its static imports (main.tsx requests
//     them at boot, see app/routes.tsx#preloadRoute);
//   · the translation tables the shell and the landing load, for the
//     visitor's language — measured for each language, the larger one counts.
// Each file is gzipped (level 6, what Vite reports and servers use) and the
// sum must stay within the budget. It also fails if anything the landing must
// not download — a dashboard, the platform console, a PDF/QR library, the
// admin translations, the other language — is in the set.
//
// usage: BUNDLE_BUDGET=1 vite build --manifest --outDir dist-budget
//        node tools/bundle-budget.mjs [dist-budget] [--budget=400000] [--json=report.json]

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const args = process.argv.slice(2);
const dist = resolve(args.find(a => !a.startsWith('--')) ?? 'dist-budget');
const budget = Number(args.find(a => a.startsWith('--budget='))?.split('=')[1] ?? 400_000);
const jsonOut = args.find(a => a.startsWith('--json='))?.split('=')[1];

const manifestPath = join(dist, '.vite/manifest.json');
if (!existsSync(manifestPath)) {
  console.error(`No manifest at ${manifestPath}: build with \`vite build --manifest --outDir ${dist}\` first.`);
  process.exit(2);
}
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const modulesPath = join(dist, '.vite/chunk-modules.json');
const chunkModules = existsSync(modulesPath) ? JSON.parse(readFileSync(modulesPath, 'utf8')) : null;
const routeNamespaces = JSON.parse(readFileSync(resolve('src/i18n/route-namespaces.json'), 'utf8'));

const entryKey = Object.keys(manifest).find(k => manifest[k].isEntry && k.endsWith('index.html'));
const LANDING = 'src/app/pages/Landing.tsx';
if (!entryKey) {
  console.error('Manifest lacks the index.html entry.');
  process.exit(2);
}
// A build where the landing is not a chunk of its own (the pre-AUD-019
// layout): the landing, and every translation, ride in the entry's closure.
const landingInEntry = !manifest[LANDING];
if (landingInEntry) console.log(`(${LANDING} is not a chunk of its own here: measuring the entry's closure, which carries it)`);

/** A manifest key and everything it imports statically. */
function closure(key, into = new Set()) {
  if (into.has(key) || !manifest[key]) return into;
  into.add(key);
  for (const dep of manifest[key].imports ?? []) closure(dep, into);
  return into;
}

const sizeCache = new Map();
function sizes(file) {
  if (!sizeCache.has(file)) {
    const bytes = readFileSync(join(dist, file));
    sizeCache.set(file, { raw: bytes.length, gzip: gzipSync(bytes, { level: 6 }).length });
  }
  return sizeCache.get(file);
}

const FORBIDDEN = [
  [/src\/app\/pages\/(Admin|Supervisor|Worker|Finance|Warehouse)Dashboard\.tsx$/, 'a role dashboard'],
  [/src\/platform\//, 'the platform console'],
  [/node_modules\/(jspdf|jspdf-autotable|qrcode|html2canvas|canvg|motion|motion-dom|motion-utils|framer-motion|exceljs)\//, 'a PDF/QR/animation library'],
  [/src\/i18n\/locales\/[a-z]+\/admin\.json$/, 'the admin translations'],
];

const report = { budget, languages: {} };
let failed = false;
for (const lng of ['es', 'en']) {
  const keys = new Set();
  closure(entryKey, keys);
  if (!landingInEntry) closure(LANDING, keys);
  const namespaces = [...new Set([...routeNamespaces.shell, ...routeNamespaces.landing])];
  for (const ns of namespaces) closure(`src/i18n/locales/${lng}/${ns}.json`, keys);

  const files = [...keys].map(k => manifest[k].file).filter(f => f.endsWith('.js'));
  const css = [...new Set([...keys].flatMap(k => manifest[k].css ?? []))];
  const rows = files.map(file => ({ file, ...sizes(file) })).sort((a, b) => b.gzip - a.gzip);
  const total = rows.reduce((t, r) => ({ raw: t.raw + r.raw, gzip: t.gzip + r.gzip }), { raw: 0, gzip: 0 });
  const cssTotal = css.reduce((t, f) => ({ raw: t.raw + sizes(f).raw, gzip: t.gzip + sizes(f).gzip }), { raw: 0, gzip: 0 });

  const violations = [];
  if (chunkModules) {
    for (const file of files) {
      for (const id of Object.keys(chunkModules[file] ?? {})) {
        for (const [re, what] of FORBIDDEN) if (re.test(id)) violations.push(`${file} carries ${what}: ${id}`);
        const other = lng === 'es' ? 'en' : 'es';
        if (new RegExp(`src/i18n/locales/${other}/`).test(id)) violations.push(`${file} carries the other language: ${id}`);
      }
    }
  }
  // What the entry is made of: the heaviest modules, grouped by package.
  const composition = {};
  if (chunkModules) {
    for (const file of files) {
      for (const [id, bytes] of Object.entries(chunkModules[file] ?? {})) {
        const owner = id.includes('node_modules/') ? id.split('node_modules/').pop().split('/').slice(0, id.split('node_modules/').pop().startsWith('@') ? 2 : 1).join('/') : id.split('/').slice(0, 3).join('/');
        composition[owner] = (composition[owner] ?? 0) + bytes;
      }
    }
  }
  report.languages[lng] = { namespaces, total, css: cssTotal, files: rows, violations, composition };
  console.log(`\nLanding, first anonymous view (${lng}): ${rows.length} JS files, ${total.raw} B minified, ${total.gzip} B gzip (budget ${budget})`);
  for (const r of rows) console.log(`  ${String(r.gzip).padStart(8)}  ${String(r.raw).padStart(9)}  ${r.file}`);
  console.log(`  CSS (not in the budget): ${cssTotal.raw} B minified, ${cssTotal.gzip} B gzip`);
  if (!chunkModules) console.log('  (no chunk-modules.json: build with BUNDLE_BUDGET=1 to check what the set must not carry)');
  if (chunkModules && lng === 'es') {
    console.log('  Rendered bytes by package / source folder (before minification):');
    for (const [owner, bytes] of Object.entries(composition).sort((a, b) => b[1] - a[1]).slice(0, 15)) {
      console.log(`    ${String(bytes).padStart(8)}  ${owner}`);
    }
  }
  for (const v of violations) console.log(`  ✗ ${v}`);
  if (total.gzip > budget) { console.log(`  ✗ over budget by ${total.gzip - budget} B`); failed = true; }
  if (violations.length) failed = true;
}

if (jsonOut) writeFileSync(jsonOut, JSON.stringify(report, null, 2));
console.log(failed ? '\nBUDGET: FAIL' : '\nBUDGET: OK');
process.exit(failed ? 1 : 0);
