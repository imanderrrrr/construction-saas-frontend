// ContractBar's job is to make an over-budget project readable at a glance.
// It used to clamp the remainder at zero, so a job that landed exactly on
// budget and one that blew $500 past it both rendered "$0.00 · 0%" — the
// overrun, which is the number the client actually wants, was unreadable.
//
// The figure and the percentage now carry the sign; only the bar's width is
// clamped, since a negative width draws nothing and >100% overflows its track.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ContractBar } from './badges';

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function render(props: Parameters<typeof ContractBar>[0]) {
  act(() => root.render(<ContractBar {...props} />));
  return host;
}

/** The rendered bar's inline width, e.g. "0%". */
function barWidth(el: HTMLElement): string {
  const bar = el.querySelector<HTMLElement>('.rounded-full > .h-full');
  return bar?.style.width ?? '';
}

describe('ContractBar', () => {
  it('shows a negative remainder instead of clamping it to zero', () => {
    // $1,000 contract, $500 past it.
    const el = render({ originalContractCents: 100_000, remainingCents: -50_000 });

    expect(el.textContent).toContain('-$500.00');
    expect(el.textContent).not.toContain('$0.00');
    expect(el.textContent).toContain('-50%');
  });

  it('keeps the bar width inside 0–100% when the remainder is negative', () => {
    const el = render({ originalContractCents: 100_000, remainingCents: -50_000 });
    expect(barWidth(el)).toBe('0%');
  });

  it('paints a negative remainder red', () => {
    const el = render({ originalContractCents: 100_000, remainingCents: -50_000 });
    const figure = el.querySelector('p');
    expect(figure?.className).toContain('text-red-700');
  });

  it('still renders a healthy project unchanged', () => {
    const el = render({ originalContractCents: 100_000, remainingCents: 80_000 });

    expect(el.textContent).toContain('$800.00');
    expect(el.textContent).toContain('80%');
    expect(barWidth(el)).toBe('80%');
    expect(el.querySelector('p')?.className).toContain('text-[#0A0A0A]');
  });

  it('measures against the revised contract when change orders exist', () => {
    // $1,000 original + $1,000 of change orders, $200 left of the revised $2,000.
    const el = render({
      originalContractCents: 100_000,
      revisedContractCents: 200_000,
      remainingCents: 20_000,
    });

    expect(el.textContent).toContain('$200.00');
    expect(el.textContent).toContain('10%');
    expect(el.textContent).toContain('$2,000.00');
  });

  it('renders a dash when the project has no contract to measure against', () => {
    const el = render({ originalContractCents: null });
    expect(el.textContent).toBe('—');
  });
});

// V93 — the gauge divides by the cost budget once one exists. Before it, a
// project's spend was drawn against the sale price: on a $100,000 contract with
// a $70,000 cost budget, $35,000 spent read as "65% left" when in truth half
// the money for the job was gone.
describe('ContractBar with a cost budget', () => {
  it('measures against the cost budget instead of the contract', () => {
    const el = render({
      originalContractCents: 10_000_000,
      revisedContractCents: 10_000_000,
      budgetBaseCents: 7_000_000,
      remainingCents: 3_500_000,
    });

    expect(el.textContent).toContain('$35,000.00');
    expect(el.textContent).toContain('50%');
    expect(el.textContent).toContain('$70,000.00');
    expect(el.textContent).not.toContain('$100,000.00');
  });

  it('says which of the two numbers it is measuring against', () => {
    const withBudget = render({
      originalContractCents: 10_000_000,
      revisedContractCents: 10_000_000,
      budgetBaseCents: 7_000_000,
      remainingCents: 3_500_000,
    });
    expect(withBudget.textContent).toContain('budget');
  });

  it('reads exactly as before when no budget is set', () => {
    // budgetBaseCents comes back equal to the revised contract, so nothing on
    // screen may move for a project that predates the field.
    const el = render({
      originalContractCents: 10_000_000,
      revisedContractCents: 10_000_000,
      budgetBaseCents: 10_000_000,
      remainingCents: 6_500_000,
    });

    expect(el.textContent).toContain('$65,000.00');
    expect(el.textContent).toContain('65%');
    expect(el.textContent).not.toContain('budget');
  });

  it('shows an overrun of the cost budget uncapped', () => {
    const el = render({
      originalContractCents: 10_000_000,
      revisedContractCents: 10_000_000,
      budgetBaseCents: 7_000_000,
      remainingCents: -1_000_000,
    });

    expect(el.textContent).toContain('-$10,000.00');
    expect(barWidth(el)).toBe('0%');
  });
});
