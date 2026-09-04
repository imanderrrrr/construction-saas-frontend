// The contract gauge reads consumption against the budget base — 78 % means
// nearly spent, 104 % means over — and it never hides an overrun: past the
// base the bar turns red and the negative balance is printed underneath.
// Only the bar's width is clamped (a negative width draws nothing and >100 %
// would overflow its track); the percentage itself stays uncapped.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, opts?: Record<string, unknown>) => (opts?.amount ? `${key} ${opts.amount}` : key), i18n: { language: 'es' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

import { ContractBar, gaugeReading } from './badges';

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

const pct = (el: HTMLElement) => el.querySelector('[data-testid="contract-gauge-pct"]')?.textContent;
const barWidth = (el: HTMLElement) => el.querySelector<HTMLElement>('[data-testid="contract-gauge-bar"]')?.style.width;
const barClass = (el: HTMLElement) => el.querySelector<HTMLElement>('[data-testid="contract-gauge-bar"]')?.className ?? '';

describe('ContractBar', () => {
  it('reads consumption, not the remainder: $200 left of $1,000 is 80 % spent', () => {
    const el = render({ originalContractCents: 100_000, remainingCents: 20_000 });
    expect(pct(el)).toBe('80%');
    expect(barWidth(el)).toBe('80%');
    expect(barClass(el)).toContain('bg-[#0A0A0A]');
    expect(el.textContent).toContain('$1,000.00');
  });

  it('turns orange from 90 % on', () => {
    const el = render({ originalContractCents: 100_000, remainingCents: 8_000 });
    expect(pct(el)).toBe('92%');
    expect(barClass(el)).toContain('bg-[#F97316]');
  });

  it('shows an overrun as more than 100 %, in red, with the negative balance', () => {
    // $1,000 contract, $500 past it.
    const el = render({ originalContractCents: 100_000, remainingCents: -50_000 });
    expect(pct(el)).toBe('150%');
    expect(barWidth(el)).toBe('100%');
    expect(barClass(el)).toContain('bg-[#B3402A]');
    expect(el.textContent).toContain('-$500.00');
  });

  it('measures against the revised contract when change orders exist', () => {
    // $1,000 original + $1,000 of change orders, $200 left of the revised $2,000.
    const el = render({ originalContractCents: 100_000, revisedContractCents: 200_000, remainingCents: 20_000 });
    expect(pct(el)).toBe('90%');
    expect(el.textContent).toContain('$2,000.00');
  });

  it('prefers the cost budget the backend resolved as the base', () => {
    const r = gaugeReading({ originalContractCents: 100_000, revisedContractCents: 100_000, budgetBaseCents: 50_000, remainingCents: 10_000 });
    expect(r?.baseCents).toBe(50_000);
    expect(r?.pct).toBe(80);
  });

  it('has no reading without a base', () => {
    const el = render({ originalContractCents: null });
    expect(el.querySelector('[data-testid="contract-gauge"]')).toBeNull();
    expect(el.textContent).toContain('projectMgmt.row.notDefined');
  });
});
