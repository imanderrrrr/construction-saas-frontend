// BuildTrack — the arithmetic of Cobrar and Pagar.
//
// The screens these replace showed "Total por cobrar $107,150.00" in the card
// and "Total pendiente: $103,150.00" in the footer of the same table, because
// the card summed full amounts and the footer summed balances. The redesign
// prints "vencido + por vencer = total" on screen, so these tests lock that
// identity — and the fixture is the one the design was drawn with, so the
// numbers here are the numbers on the mockup.

import { describe, expect, it } from 'vitest';
import type { Payable, Receivable } from '../../services/finance';
import {
  addDays, agingByParty, agingTotals, balanceOf, bucketOf, cashBridge, daysBetween, daysLate,
  isBillable, laneOf, lanesOf, matches, payableFigures, payablePayments, payableToOwed,
  receivableFigures, receivablePayments, receivableToOwed, sumBalances, type Owed,
} from './accounting';

const TODAY = '2026-09-16';
const MONTH = '2026-09';

/* ── The fixture the design was drawn with ─────────────────────────────── */

function receivable(o: Partial<Receivable> & Pick<Receivable, 'id' | 'client' | 'dueDate' | 'amount' | 'status'>): Receivable {
  return {
    documentType: 'INVOICE', invoiceNumber: `INV-${o.id}`, project: 'Torre Norte', projectId: 1,
    description: null, issuedDate: '2026-08-01', subtotal: o.amount, discount: 0, taxRate: 0, tax: 0,
    paidAmount: 0, notes: null, lineItems: [], payments: [],
    createdAt: '2026-08-01T00:00:00Z', updatedAt: '2026-08-01T00:00:00Z',
    ...o,
  } as Receivable;
}

const RECEIVABLES: Receivable[] = [
  receivable({ id: 17, invoiceNumber: 'INV-2026-017', client: 'Inmobiliaria Cañas', project: 'Torre Norte', projectId: 1, dueDate: '2026-10-10', amount: 41_200, status: 'pending' }),
  receivable({ id: 16, invoiceNumber: 'INV-2026-016', client: 'Municipalidad de Mixco', project: 'Casa Lomas', projectId: 3, dueDate: '2026-10-01', amount: 26_300, status: 'pending' }),
  receivable({ id: 15, invoiceNumber: 'INV-2026-015', client: 'Grupo Reyes', project: 'Bodega Sur', projectId: 2, dueDate: '2026-09-19', amount: 9_800, paidAmount: 4_000, status: 'partial',
    payments: [{ id: 901, date: '2026-09-05', amount: 4_000, method: 'Bank transfer' }] }),
  receivable({ id: 14, invoiceNumber: 'INV-2026-014', client: 'Inmobiliaria Cañas', project: 'Torre Norte', projectId: 1, dueDate: '2026-09-02', amount: 18_500, status: 'overdue' }),
  receivable({ id: 13, invoiceNumber: 'INV-2026-013', client: 'Grupo Reyes', project: 'Bodega Sur', projectId: 2, dueDate: '2026-08-27', amount: 7_450, status: 'overdue' }),
  receivable({ id: 12, invoiceNumber: 'INV-2026-012', client: 'Inmobiliaria Cañas', project: 'Torre Norte', projectId: 1, dueDate: '2026-08-09', amount: 12_000, paidAmount: 12_000, status: 'paid',
    payments: [{ id: 902, date: '2026-08-15', amount: 12_000, method: 'Check' }] }),
  receivable({ id: 11, invoiceNumber: 'INV-2026-011', client: 'Municipalidad de Mixco', project: 'Casa Lomas', projectId: 3, dueDate: '2026-07-30', amount: 5_600, paidAmount: 5_600, status: 'paid',
    payments: [{ id: 903, date: '2026-09-02', amount: 5_600, method: 'Bank transfer' }] }),
  receivable({ id: 18, invoiceNumber: 'OC-2026-003', documentType: 'CHANGE_ORDER_REQUEST', client: 'Grupo Reyes', project: 'Bodega Sur', projectId: 2, dueDate: '2026-09-24', amount: 3_900, status: 'pending' }),
  // Not receivable: the client has not approved it, so it is nobody's debt yet.
  receivable({ id: 19, invoiceNumber: 'OC-2026-004', documentType: 'CHANGE_ORDER_REQUEST', client: 'Inmobiliaria Cañas', dueDate: '2026-10-12', amount: 6_750, status: 'pending_approval' }),
  // Terminal: the client declined it. It travels in the same list and must not count either.
  receivable({ id: 20, invoiceNumber: 'OC-2026-002', documentType: 'CHANGE_ORDER_REQUEST', client: 'Grupo Reyes', dueDate: '2026-09-30', amount: 2_000, status: 'rejected' }),
];

function payable(o: Partial<Payable> & Pick<Payable, 'id' | 'vendor' | 'dueDate' | 'amount' | 'status'>): Payable {
  return {
    billNumber: `BILL-${o.id}`, category: 'materials', project: 'Torre Norte', projectId: 1,
    description: null, documentType: 'BILL', invoiceNumber: null, receivedDate: '2026-08-01',
    paidAmount: 0, notes: null, payments: [],
    createdAt: '2026-08-01T00:00:00Z', updatedAt: '2026-08-01T00:00:00Z',
    ...o,
  } as Payable;
}

const PAYABLES: Payable[] = [
  payable({ id: 36, billNumber: 'BILL-2026-036', vendor: 'Vidriería Central', category: 'other', project: 'Casa Lomas', projectId: 3, dueDate: '2026-09-21', amount: 3_100, status: 'pending' }),
  payable({ id: 35, billNumber: 'BILL-2026-035', vendor: 'Aceros del Norte', project: 'Bodega Sur', projectId: 2, dueDate: '2026-10-08', amount: 19_900, status: 'pending' }),
  payable({ id: 34, billNumber: 'BILL-2026-034', vendor: 'Electricidad Roca', category: 'subcontractor', project: 'Casa Lomas', projectId: 3, dueDate: '2026-09-24', amount: 11_000, status: 'pending', documentType: 'INVOICE', invoiceNumber: 'FAC-0451' }),
  payable({ id: 33, billNumber: 'BILL-2026-033', vendor: 'Maquinaria Pérez', category: 'equipment-rental', dueDate: '2026-10-02', amount: 5_400, status: 'pending' }),
  payable({ id: 32, billNumber: 'BILL-2026-032', vendor: 'Cemex Guatemala', project: 'Bodega Sur', projectId: 2, dueDate: '2026-09-17', amount: 8_750, paidAmount: 3_000, status: 'partial',
    payments: [{ id: 701, date: '2026-09-04', amount: 3_000, method: 'Bank transfer' }] }),
  payable({ id: 31, billNumber: 'BILL-2026-031', vendor: 'Aceros del Norte', dueDate: '2026-08-31', amount: 14_200, status: 'overdue' }),
  payable({ id: 30, billNumber: 'BILL-2026-030', vendor: 'Ferretería El Tornillo', project: 'Casa Lomas', projectId: 3, dueDate: '2026-08-19', amount: 1_280, paidAmount: 1_280, status: 'paid',
    payments: [{ id: 702, date: '2026-08-10', amount: 1_280, method: 'Cash' }] }),
  payable({ id: 29, billNumber: 'BILL-2026-029', vendor: 'Transportes Luna', category: 'services', project: 'Bodega Sur', projectId: 2, dueDate: '2026-08-14', amount: 2_350, paidAmount: 2_350, status: 'paid',
    payments: [
      { id: 703, date: '2026-08-01', amount: 2_350, method: 'Check', voided: true, voidReason: 'cheque rebotado' },
      { id: 704, date: '2026-09-03', amount: 2_350, method: 'Bank transfer' },
    ] }),
  payable({ id: 28, billNumber: 'BILL-2026-028', vendor: 'Maquinaria Pérez', category: 'equipment-rental', dueDate: '2026-08-04', amount: 6_200, status: 'overdue' }),
];

const AR: Owed[] = RECEIVABLES.filter(isBillable).map(receivableToOwed);
const AP: Owed[] = PAYABLES.map(payableToOwed);

/* ── Days ──────────────────────────────────────────────────────────────── */

describe('días', () => {
  it('cuenta días de calendario, no instantes', () => {
    expect(daysBetween('2026-09-16', '2026-09-19')).toBe(3);
    expect(daysBetween('2026-08-27', '2026-09-16')).toBe(20);
    expect(daysLate('2026-09-19', TODAY)).toBe(-3);
    expect(daysLate(TODAY, TODAY)).toBe(0);
    expect(addDays(TODAY, 7)).toBe('2026-09-23');
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
  });

  // The old screens parsed bare `YYYY-MM-DD` with the local constructor, which
  // is why a date could show up as the day before in UTC−6. These are calendar
  // dates: the answer may not depend on where the reader sits.
  it('da el mismo tramo en cualquier zona horaria', () => {
    const original = process.env.TZ;
    for (const tz of ['America/Guatemala', 'Pacific/Kiritimati', 'Etc/UTC']) {
      process.env.TZ = tz;
      expect(bucketOf('2026-08-27', TODAY), tz).toBe('d1_30');
      expect(daysLate('2026-08-04', TODAY), tz).toBe(43);
    }
    process.env.TZ = original;
  });
});

/* ── Balances ──────────────────────────────────────────────────────────── */

describe('saldos', () => {
  it('un saldo es monto menos cobrado, nunca el monto entero', () => {
    const partial = AR.find(d => d.id === 15)!;
    expect(balanceOf(partial)).toBe(5_800);
    expect(sumBalances(AR.filter(d => !['paid'].includes(d.status)))).toBe(103_150);
  });
});

/* ── Aging ─────────────────────────────────────────────────────────────── */

describe('antigüedad por cliente', () => {
  const rows = agingByParty(AR, TODAY);

  it('abre por quien más debe vencido', () => {
    expect(rows.map(r => r.party)).toEqual([
      'Inmobiliaria Cañas', 'Grupo Reyes', 'Municipalidad de Mixco',
    ]);
  });

  it('reparte cada saldo en su tramo', () => {
    const [canas, reyes, mixco] = rows;
    expect(canas).toMatchObject({ current: 41_200, d1_30: 18_500, d31_60: 0, d60plus: 0, total: 59_700 });
    expect(reyes).toMatchObject({ current: 9_700, d1_30: 7_450, total: 17_150 });
    expect(mixco).toMatchObject({ current: 26_300, d1_30: 0, total: 26_300 });
  });

  it('no mete las pagadas ni las no cobrables', () => {
    const ids = rows.flatMap(r => r.docs.map(d => d.id));
    expect(ids).not.toContain(12);
    expect(ids).not.toContain(11);
    expect(ids).not.toContain(19);
    expect(ids).not.toContain(20);
  });

  it('dentro del cliente, lo vencido va primero y lo más viejo arriba', () => {
    const reyes = rows.find(r => r.party === 'Grupo Reyes')!;
    expect(reyes.docs.map(d => d.id)).toEqual([13, 15, 18]);
  });

  it('la fila de totales cuadra con la tabla', () => {
    const totals = agingTotals(rows);
    expect(totals).toMatchObject({ current: 77_200, d1_30: 25_950, overdue: 25_950, total: 103_150 });
  });
});

/* ── Figures ───────────────────────────────────────────────────────────── */

describe('las tres cifras de Cobrar', () => {
  const f = receivableFigures(AR, receivablePayments(RECEIVABLES.filter(isBillable)), TODAY, MONTH);

  it('vencido, por vencer y cobrado este mes', () => {
    expect(f.overdue).toEqual({ amount: 25_950, count: 2 });
    expect(f.oldestOverdueDays).toBe(20);
    expect(f.notYetDue).toEqual({ amount: 77_200, count: 4 });
    expect(f.collected).toEqual({ amount: 9_600, count: 2 });
  });

  // The line printed under the strip. If this breaks, the screen lies.
  it('vencido + por vencer = total por cobrar', () => {
    expect(f.overdue.amount + f.notYetDue.amount).toBe(f.total);
    expect(f.total).toBe(103_150);
  });

  it('las parciales cuentan por su saldo dentro de por vencer', () => {
    expect(f.notYetDue.amount).toBe(41_200 + 26_300 + 5_800 + 3_900);
  });
});

describe('las tres cifras de Pagar', () => {
  const f = payableFigures(AP, payablePayments(PAYABLES), TODAY, MONTH);

  it('esta semana, vencido y por pagar', () => {
    expect(f.dueThisWeek).toEqual({ amount: 8_850, count: 2 });
    expect(f.firstDue).toBe('2026-09-17');
    expect(f.overdue).toEqual({ amount: 20_400, count: 2 });
    expect(f.oldestOverdueDays).toBe(43);
    expect(f.outstanding).toEqual({ amount: 65_550, count: 7 });
  });

  it('por pagar contiene a las otras dos', () => {
    expect(f.outstanding.amount).toBeGreaterThanOrEqual(f.dueThisWeek.amount + f.overdue.amount);
  });

  // The backend's paidCents excludes voided payments; so must the figure, or a
  // bounced cheque shows up as money that left the company.
  it('pagado este mes no cuenta los pagos anulados', () => {
    expect(f.paid).toEqual({ amount: 5_350, count: 2 });
  });
});

/* ── Lanes ─────────────────────────────────────────────────────────────── */

describe('carriles de Pagar', () => {
  const lanes = lanesOf(AP, TODAY);

  it('siempre son los cinco, aunque alguno esté vacío', () => {
    expect(lanes.map(l => l.key)).toEqual(['overdue', 'week', 'next30', 'later', 'paid']);
    expect(lanes.find(l => l.key === 'later')).toMatchObject({ total: 0, docs: [] });
  });

  it('cada cuenta cae en su carril y el subtotal cuadra', () => {
    const by = Object.fromEntries(lanes.map(l => [l.key, l]));
    expect(by.overdue.docs.map(d => d.id)).toEqual([28, 31]);
    expect(by.overdue.total).toBe(20_400);
    expect(by.week.docs.map(d => d.id)).toEqual([32, 36]);
    expect(by.week.total).toBe(8_850);
    expect(by.next30.total).toBe(36_300);
    expect(by.paid.docs.map(d => d.id).sort()).toEqual([29, 30]);
  });

  it('lo pagado es un carril, no una fecha', () => {
    const old = AP.find(d => d.id === 30)!;
    expect(daysLate(old.dueDate, TODAY)).toBeGreaterThan(0);
    expect(laneOf(old, TODAY)).toBe('paid');
  });

  it('lo que vence hoy es de esta semana, no está vencido', () => {
    const todayBill: Owed = { id: 99, party: 'X', projectId: 1, project: 'P', dueDate: TODAY, amount: 100, paidAmount: 0, status: 'pending' };
    expect(laneOf(todayBill, TODAY)).toBe('week');
  });
});

/* ── Cash bridge ───────────────────────────────────────────────────────── */

describe('puente de caja de la semana', () => {
  it('entra, sale y el neto de los próximos siete días', () => {
    const bridge = cashBridge(AR, AP, TODAY);
    expect(bridge.inbound).toEqual({ amount: 5_800, count: 1 });
    expect(bridge.outbound).toEqual({ amount: 8_850, count: 2 });
    expect(bridge.net).toBe(-3_050);
  });
});

/* ── Search ────────────────────────────────────────────────────────────── */

describe('búsqueda', () => {
  it('ignora acentos y mayúsculas', () => {
    expect(matches(['Inmobiliaria Cañas', 'Torre Norte'], 'canas')).toBe(true);
    expect(matches(['Vidriería Central'], 'VIDRIERIA')).toBe(true);
    expect(matches(['BILL-2026-031'], '031')).toBe(true);
    expect(matches(['Cemex'], 'aceros')).toBe(false);
  });

  it('sin texto, todo pasa', () => {
    expect(matches([null, undefined], '   ')).toBe(true);
  });
});
