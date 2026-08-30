// BuildTrack — the first-run row itself.
//
// The row is the ONLY thing that decides which welcome notice may be on
// screen. What is pinned here is the contract every notice relies on:
//   - the declared order wins, whatever order the notices happen to mount in
//   - giving up a turn (finished OR skipped) hands the row to the next one
//     immediately — same session, no reload
//   - a notice that leaves the tree gives up its turn instead of stranding
//     the ones behind it
//   - a notice with no declared place is refused, loudly

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  FIRST_RUN_ORDER,
  firstRunHolder,
  resetFirstRunQueue,
  useFirstRunTurn,
  type FirstRunId,
} from './firstRunQueue';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/** A minimal notice: claims a turn and reports whether it got it. */
function Notice({
  id, pending, onTurn,
}: {
  id: FirstRunId;
  pending: boolean;
  onTurn: (id: FirstRunId, myTurn: boolean) => void;
}) {
  const myTurn = useFirstRunTurn(id, pending);
  onTurn(id, myTurn);
  return null;
}

describe('firstRunQueue', () => {
  let container: HTMLDivElement;
  let root: Root;
  let turns: Map<FirstRunId, boolean>;

  const record = (id: FirstRunId, myTurn: boolean) => { turns.set(id, myTurn); };
  const onScreen = () => [...turns].filter(([, v]) => v).map(([id]) => id);

  beforeEach(() => {
    resetFirstRunQueue();
    turns = new Map();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
    resetFirstRunQueue();
  });

  it('gives the turn to the earliest claim in the declared order', () => {
    act(() => {
      root.render(
        <>
          <Notice id="whatsNew" pending onTurn={record} />
          <Notice id="onboardingTour" pending onTurn={record} />
          <Notice id="brandIntro" pending onTurn={record} />
        </>,
      );
    });

    expect(onScreen()).toEqual(['brandIntro']);
  });

  it('ignores mount order — the declared order is the only thing that decides', () => {
    // Rendered in REVERSE priority AND with the row's tail mounting first.
    act(() => {
      root.render(<Notice id="whatsNew" pending onTurn={record} />);
    });
    expect(onScreen()).toEqual(['whatsNew']);

    act(() => {
      root.render(
        <>
          <Notice id="whatsNew" pending onTurn={record} />
          <Notice id="onboardingTour" pending onTurn={record} />
        </>,
      );
    });
    expect(onScreen()).toEqual(['onboardingTour']);
  });

  it('hands the row on when a notice gives up its turn', () => {
    const render = (tourPending: boolean) =>
      act(() => {
        root.render(
          <>
            <Notice id="onboardingTour" pending={tourPending} onTurn={record} />
            <Notice id="whatsNew" pending onTurn={record} />
          </>,
        );
      });

    render(true);
    expect(onScreen()).toEqual(['onboardingTour']);

    // The tour finishes — or is skipped; the row cannot tell them apart, which
    // is exactly why skipping cannot strand the notice behind it.
    render(false);
    expect(onScreen()).toEqual(['whatsNew']);
  });

  it('gives up the turn when a notice unmounts mid-row', () => {
    act(() => {
      root.render(
        <>
          <Notice id="onboardingTour" pending onTurn={record} />
          <Notice id="whatsNew" pending onTurn={record} />
        </>,
      );
    });
    expect(onScreen()).toEqual(['onboardingTour']);

    // Navigating away unmounts the tour (it lives inside the admin dashboard).
    act(() => {
      root.render(<Notice id="whatsNew" pending onTurn={record} />);
    });
    expect(firstRunHolder()).toBe('whatsNew');
  });

  it('leaves the row empty when nobody has anything to show', () => {
    act(() => {
      root.render(
        <>
          <Notice id="brandIntro" pending={false} onTurn={record} />
          <Notice id="whatsNew" pending={false} onTurn={record} />
        </>,
      );
    });

    expect(onScreen()).toEqual([]);
    expect(firstRunHolder()).toBeNull();
  });

  it('refuses a notice that has no declared place in the row', () => {
    // A fourth notice added without a line in FIRST_RUN_ORDER: it must not
    // quietly show itself alongside the others. React re-logs the throw on
    // its way out — silenced so the expected crash doesn't read as a failure.
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(() =>
        act(() => {
          root.render(
            <Notice
              id={'someNewNotice' as FirstRunId}
              pending
              onTurn={record}
            />,
          );
        }),
      ).toThrow(/no place in the first-run row/);
    } finally {
      quiet.mockRestore();
    }
  });

  it('declares every place exactly once', () => {
    expect(new Set(FIRST_RUN_ORDER).size).toBe(FIRST_RUN_ORDER.length);
  });
});
