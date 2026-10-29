import { describe, expect, it } from 'vitest';
import { changeOrderEdit } from './changeOrderEdit';

// Second warehouse audit (2026-10-28). Converting a T&M ticket, the server
// writes the change order's description as "T&M TM-000123: <ticket>" — over
// 50 as soon as the ticket's own description passes 36. Editing only the
// amount or the number resent that description, and the server (≤ 50)
// answered 400. It keeps an omitted description, so an unchanged one stays out.

const FROM_TM = 'T&M TM-000123: Reparación de tubería rota en el sótano norte';

describe('changeOrderEdit', () => {
  it('leaves an unchanged description out of the update', () => {
    expect(changeOrderEdit({ description: FROM_TM }, { description: FROM_TM, amountCents: 125_000, number: 'OC-7' }))
      .toEqual({ payload: { amountCents: 125_000, number: 'OC-7' } });
  });

  it('sends a changed description that fits', () => {
    expect(changeOrderEdit({ description: FROM_TM }, { description: '  Tubería del sótano  ', amountCents: 1, number: null }))
      .toEqual({ payload: { description: 'Tubería del sótano', amountCents: 1, number: null } });
  });

  it('refuses a changed description still over 50', () => {
    expect(changeOrderEdit({ description: FROM_TM }, { description: FROM_TM.slice(0, 55), amountCents: 1, number: null }))
      .toEqual({ tooLong: 50 });
  });
});
