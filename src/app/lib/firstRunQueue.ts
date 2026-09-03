// BuildTrack — the first-run row.
//
// Several overlays want the screen the first time a user arrives: the brand
// intro animation, the guided dashboard tour, the what's-new carousel. Each
// one used to read its own localStorage flag and open on its own, so on an
// admin's first desktop visit they all opened AT ONCE and covered each other.
//
// This module is the single place that answers "is it my turn?". The order
// below is the whole policy — a notice is either in it or it does not exist:
//
//   1. brandIntro     — the 5s brand animation; it plays before anything else
//                       because it is not skippable and covers the viewport.
//   2. onboardingTour — teach the system BEFORE announcing what changed in it.
//   3. whatsNew       — the release carousel; last, and it waits its turn
//                       rather than being lost.
//
// Adding a fourth notice is one line HERE plus `useFirstRunTurn` in the
// component. Nothing reads anyone else's state — no notice knows the others
// exist — so a new one cannot "forget" to check an overlay that shipped after
// it, and none of them has to be rewritten when the row grows.
//
// Deliberately a MODULE-LEVEL store rather than a React context: the three
// notices live in three different subtrees (App, inside AdminDashboard, inside
// BillingGuard's page slot) and one of them renders outside the router. A
// provider would have to be threaded above all of that and could be forgotten;
// this cannot be mounted wrong.

import { useEffect, useMemo, useSyncExternalStore } from 'react';

/** The row. Index = priority; earlier wins. This is the source of truth. */
export const FIRST_RUN_ORDER = ['brandIntro', 'onboardingTour', 'whatsNew'] as const;

export type FirstRunId = (typeof FIRST_RUN_ORDER)[number];

/** Who currently has something to show (whether or not it is their turn). */
const claimants = new Set<FirstRunId>();
const listeners = new Set<() => void>();

/** The one notice allowed on screen right now, or null when the row is empty. */
let holder: FirstRunId | null = null;

function elect() {
  // A pure function of the claim set, so the outcome does not depend on the
  // order effects happen to run in (mount order differs per route).
  const next = FIRST_RUN_ORDER.find(id => claimants.has(id)) ?? null;
  if (next === holder) return;
  holder = next;
  for (const listener of listeners) listener();
}

function assertDeclared(id: FirstRunId) {
  if (!(FIRST_RUN_ORDER as readonly string[]).includes(id)) {
    throw new Error(
      `[firstRunQueue] "${id}" has no place in the first-run row. Add it to ` +
      'FIRST_RUN_ORDER (src/app/lib/firstRunQueue.ts) at the position it ' +
      'should be shown in, then it can ask for its turn.',
    );
  }
}

function setClaim(id: FirstRunId, wants: boolean) {
  if (claimants.has(id) === wants) return;
  if (wants) claimants.add(id);
  else claimants.delete(id);
  elect();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

const getHolder = () => holder;

/**
 * True while NO first-run notice holds the screen. For overlays that live
 * OUTSIDE the row — the per-section tours run on every first visit to a
 * section, not once per user, so they have no place in FIRST_RUN_ORDER — but
 * must still not paint over a notice that does. This asks "is the row busy?",
 * never "is notice X up?", so nothing here knows the notices by name.
 */
export function useFirstRunIdle(): boolean {
  return useSyncExternalStore(subscribe, getHolder, getHolder) === null;
}

/** Who holds the row right now. For tests and debugging — not for components:
 *  a component must never branch on another notice's state, that is the bug
 *  this module exists to prevent. Ask `useFirstRunTurn` instead. */
export function firstRunHolder(): FirstRunId | null {
  return holder;
}

/** Empty the row. Tests only — the store outlives a single React root. */
export function resetFirstRunQueue() {
  claimants.clear();
  holder = null;
  for (const listener of listeners) listener();
}

/**
 * "I have a first-run notice to show — is it my turn?"
 *
 * @param id      the notice's declared place in FIRST_RUN_ORDER
 * @param pending whether this notice still has something to show. Flip it to
 *                false when the user finishes it AND when they skip it: that
 *                is what hands the row to whoever is next, in the same session
 *                and without a reload.
 * @returns       true only while this notice is the one allowed on screen
 */
export function useFirstRunTurn(id: FirstRunId, pending: boolean): boolean {
  assertDeclared(id);
  const current = useSyncExternalStore(subscribe, getHolder, getHolder);

  useEffect(() => {
    setClaim(id, pending);
    // Leaving the tree gives up the turn: a notice that unmounts mid-row must
    // not strand the ones behind it.
    return () => setClaim(id, false);
  }, [id, pending]);

  return useMemo(() => pending && current === id, [pending, current, id]);
}
