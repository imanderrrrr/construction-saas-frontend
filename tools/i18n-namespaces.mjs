#!/usr/bin/env node
// Which translation namespaces each route can reach (AUD-019).
//
// Translations load per language and namespace, so a route must ask for every
// namespace its code can use before it renders — a namespace nobody loaded
// shows raw keys. This walks the source import graph from a route's entry
// file and collects every namespace the reachable files name:
//   useTranslation('x') · useTranslation(['x', 'y']) · t('x:key') / `x:${…}`
//   { ns: 'x' } · ns: ['x'] · <Trans ns="x"> · i18nKey="x:key"
// 'common' (the default namespace) is always included.
//
// Used by src/i18n/routeNamespaces.test.ts (the declared lists in
// src/i18n/route-namespaces.json must cover what this finds) and as a CLI:
//   node tools/i18n-namespaces.mjs            → prints the map per route group
//   node tools/i18n-namespaces.mjs --static   → static imports only

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');

export const NAMESPACES = readdirSync(join(SRC, 'i18n/locales/es'))
  .filter(f => f.endsWith('.json'))
  .map(f => f.replace(/\.json$/, ''))
  .sort();

/** Route groups and the files their routes render (see src/app/routes.tsx). */
export const ROUTE_ENTRIES = {
  shell: ['src/main.tsx'],
  landing: ['src/app/pages/Landing.tsx'],
  docs: ['src/app/pages/Docs.tsx'],
  status: ['src/app/pages/Status.tsx'],
  login: ['src/app/pages/Login.tsx'],
  acceptInvite: ['src/app/pages/AcceptInvite.tsx'],
  forgotPassword: ['src/app/pages/ForgotPassword.tsx'],
  resetPassword: ['src/app/pages/ResetPassword.tsx'],
  pay: ['src/app/pages/Pay.tsx'],
  privacy: ['src/app/pages/PrivacyPolicy.tsx'],
  terms: ['src/app/pages/TermsOfService.tsx'],
  support: ['src/app/pages/Support.tsx'],
  accessDenied: ['src/app/pages/AccessDenied.tsx'],
  authHandoff: ['src/app/pages/AuthHandoff.tsx'],
  clientView: ['src/app/pages/ClientView.tsx'],
  sign: ['src/app/pages/SignDocument.tsx'],
  platform: ['src/platform/PlatformRoutes.tsx'],
};

const IMPORT_RE = /\bimport\s+(?:type\s+)?(?:[\w*{}\s,]+?\s+from\s+)?['"]([^'"]+)['"]|\bexport\s+(?:type\s+)?[\w*{}\s,]+?\s+from\s+['"]([^'"]+)['"]/g;
const DYNAMIC_RE = /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;

function resolveImport(from, spec) {
  let base;
  if (spec.startsWith('.')) base = resolve(dirname(from), spec);
  else if (spec.startsWith('@/')) base = join(SRC, spec.slice(2));
  else return null; // a package: not our code
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    if (existsSync(candidate) && statSync(candidate).isFile() && /\.(ts|tsx)$/.test(candidate)) return candidate;
  }
  return null;
}

/** Files reachable from `entries` (static imports; dynamic ones too unless `staticOnly`). */
export function reachableFiles(entries, { staticOnly = false } = {}) {
  const seen = new Set();
  const queue = entries.map(e => join(ROOT, e));
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    const text = readFileSync(file, 'utf8');
    const specs = [...text.matchAll(IMPORT_RE)].map(m => m[1] ?? m[2]);
    if (!staticOnly) specs.push(...[...text.matchAll(DYNAMIC_RE)].map(m => m[1]));
    for (const spec of specs) {
      const next = resolveImport(file, spec);
      if (next && !next.includes('.test.')) queue.push(next);
    }
  }
  return [...seen];
}

/** Namespaces one source text names. */
export function namespacesIn(text) {
  const known = new Set(NAMESPACES);
  const found = new Set();
  const add = ns => { if (known.has(ns)) found.add(ns); };
  for (const m of text.matchAll(/useTranslation\(\s*(\[[^\]]*\]|'[^']*'|"[^"]*")/g)) {
    for (const q of m[1].matchAll(/['"]([^'"]+)['"]/g)) add(q[1]);
  }
  for (const m of text.matchAll(/['"`](\w+):/g)) add(m[1]);
  for (const m of text.matchAll(/\bns:\s*(\[[^\]]*\]|'[^']*'|"[^"]*")/g)) {
    for (const q of m[1].matchAll(/['"]([^'"]+)['"]/g)) add(q[1]);
  }
  for (const m of text.matchAll(/\bns=\{?\s*['"]([^'"]+)['"]/g)) add(m[1]);
  return found;
}

/** The namespaces reachable from a route group's entry files. */
export function routeNamespaces(group, opts = {}) {
  const found = new Set(['common']);
  for (const file of reachableFiles(ROUTE_ENTRIES[group], opts)) {
    for (const ns of namespacesIn(readFileSync(file, 'utf8'))) found.add(ns);
  }
  return [...found].sort();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const staticOnly = process.argv.includes('--static');
  const out = {};
  for (const group of Object.keys(ROUTE_ENTRIES)) {
    // The shell is what main.tsx pulls in statically: the routes themselves
    // are lazy, so following dynamic imports there would count every page.
    out[group] = routeNamespaces(group, { staticOnly: staticOnly || group === 'shell' });
  }
  console.log(JSON.stringify(out, null, 2));
  if (process.argv.includes('--files')) {
    for (const group of Object.keys(ROUTE_ENTRIES)) {
      console.error(`# ${group}`);
      for (const f of reachableFiles(ROUTE_ENTRIES[group], { staticOnly: staticOnly || group === 'shell' })) console.error(relative(ROOT, f));
    }
  }
}
