// AUD-019 — each route loads only its group's translation namespaces, so the
// declared list must cover every namespace the route's code can name: a
// namespace nobody loaded would render raw keys. This walks the source import
// graph of each route (tools/i18n-namespaces.mjs) and checks the lists in
// route-namespaces.json against what it finds.

import { describe, expect, it } from 'vitest';
import ROUTE_NAMESPACES from './route-namespaces.json';
// @ts-expect-error — a plain .mjs tool, no type declarations
import { NAMESPACES, ROUTE_ENTRIES, routeNamespaces } from '../../tools/i18n-namespaces.mjs';

const declared = ROUTE_NAMESPACES as Record<string, string[] | string>;
const entries = ROUTE_ENTRIES as Record<string, string[]>;

describe('route-namespaces.json', () => {
  it('declares every route group the walker knows, plus the workspaces', () => {
    expect(Object.keys(declared).sort()).toEqual([...Object.keys(entries), 'workspace'].sort());
  });

  it('gives the authenticated workspaces every namespace', () => {
    expect(declared.workspace).toBe('*');
  });

  it('names only namespaces that exist', () => {
    for (const [group, list] of Object.entries(declared)) {
      if (typeof list === 'string') continue;
      expect(list.filter(ns => !(NAMESPACES as string[]).includes(ns)), group).toEqual([]);
    }
  });

  it.each(Object.keys(entries))('%s loads every namespace its code names', group => {
    // The shell is main.tsx's static graph: the pages behind it are lazy and
    // load their own namespaces.
    const found: string[] = routeNamespaces(group, { staticOnly: group === 'shell' });
    const list = declared[group] as string[];
    expect(found.filter(ns => !list.includes(ns)), `${group} misses`).toEqual([]);
    expect(found).toContain('common');
  });
});
