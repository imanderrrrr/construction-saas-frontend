// The rules the windows carry, which the old ones stated nowhere: reopening a
// closed job is the one dangerous jump, observing an invoice needs a comment
// and approving does not, and the note composer's minimum is five characters
// (the old copy said ten and was never shown).
//
// Since approving an invoice creates its bill in Cuentas por pagar, approving
// asks when that bill falls due, and the payment window records full or
// partial payments of it — once, however many times the button is pressed.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const svc = vi.hoisted(() => ({
  updateJobStatus: vi.fn(),
  reviewInvoice: vi.fn(),
  registerPayment: vi.fn(),
  getJobObservations: vi.fn(),
  addJobObservation: vi.fn(),
}));
vi.mock('../../services/subcontractors', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/subcontractors')>()),
  updateJobStatus: svc.updateJobStatus,
  reviewInvoice: svc.reviewInvoice,
  registerPayment: svc.registerPayment,
  getJobObservations: svc.getJobObservations,
  addJobObservation: svc.addJobObservation,
}));

import i18n from '../../../i18n';
import { ApiError } from '../../lib/api';
import { addCalendarDays, businessToday } from '../../helpers/dateTime';
import { ChangeStatusModal } from './ChangeStatusModal';
import { ReviewInvoiceModal } from './ReviewInvoiceModal';
import { RegisterPaymentModal } from './RegisterPaymentModal';
import { JobNotes } from './JobNotes';
import { buttonByText, click, flush, invoice, job, note, type } from './testing';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/** Radix portals to the body, so assertions read the document, not the container. */
const doc = () => document.body;

describe('subcontractor windows', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => i18n.changeLanguage('es'));

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    svc.updateJobStatus.mockReset();
    svc.reviewInvoice.mockReset();
    svc.registerPayment.mockReset();
    svc.getJobObservations.mockReset().mockResolvedValue([]);
    svc.addJobObservation.mockReset();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  describe('ChangeStatusModal', () => {
    const render = async (j: ReturnType<typeof job>, preset?: 'OBSERVED') => {
      await act(async () => root.render(
        <ChangeStatusModal open onOpenChange={() => {}} job={j} preset={preset} onChanged={() => {}} />,
      ));
      await flush();
    };

    it('spells out what each jump does, instead of six identical buttons', async () => {
      await render(job({ id: 418, title: 'Balcones', status: 'IN_REVIEW' }));
      const radios = doc().querySelectorAll('input[type="radio"]');
      expect(radios.length).toBe(5);
      expect(doc().textContent).toContain('Das el trabajo por bueno. Podrá facturarlo.');
      expect(doc().textContent).toContain('salta el flujo normal');
    });

    it('arrives already aimed at Observado when the bar said "Devolver"', async () => {
      await render(job({ id: 418, title: 'Balcones', status: 'IN_REVIEW' }), 'OBSERVED');
      const checked = doc().querySelector<HTMLInputElement>('input[type="radio"]:checked')!;
      expect(checked.value).toBe('OBSERVED');
    });

    it('treats reopening a closed job as the dangerous one', async () => {
      await render(job({ id: 366, title: 'Techo curvo', status: 'CLOSED' }));
      expect(doc().textContent).toContain('Estás reabriendo un trabajo cerrado.');
      // Two sensible targets, not five, and a red confirm.
      expect(doc().querySelectorAll('input[type="radio"]').length).toBe(2);
      const confirm = buttonByText(doc(), 'Reabrir igual')!;
      expect(confirm.className).toContain('#B3402A');
    });

    it('refuses to submit without a target', async () => {
      await render(job({ id: 418, title: 'Balcones', status: 'IN_REVIEW' }));
      click(buttonByText(doc(), 'Cambiar estado'));
      await flush();
      expect(svc.updateJobStatus).not.toHaveBeenCalled();
      expect(doc().textContent).toContain('Elige a qué estado lo pasas.');
    });
  });

  describe('RegisterPaymentModal', () => {
    const render = async (inv: ReturnType<typeof invoice>, onPaid = vi.fn()) => {
      await act(async () => root.render(
        <RegisterPaymentModal open onOpenChange={() => {}} invoice={inv} onPaid={onPaid} />,
      ));
      await flush();
      return onPaid;
    };
    const amountInput = (id: number) => doc().querySelector<HTMLInputElement>(`#pay-amount-${id}`)!;

    it('shows what is still owed and pays part of it with date, method and a request key', async () => {
      const inv = invoice({ id: 430, status: 'PENDING_PAYMENT', amountCents: 840_000, paidAmountCents: 340_000, outstandingCents: 500_000 });
      svc.registerPayment.mockResolvedValue({ ...inv, paidAmountCents: 540_000, outstandingCents: 300_000 });
      const onPaid = await render(inv);
      expect(doc().querySelector('[data-testid="pay-outstanding"]')!.textContent).toContain('5,000.00');
      expect(amountInput(430).value).toBe('5000.00');

      await type(amountInput(430), '2000');
      click(buttonByText(doc(), 'Registrar pago'));
      await flush();

      expect(svc.registerPayment).toHaveBeenCalledTimes(1);
      const [id, payload] = svc.registerPayment.mock.calls[0];
      expect(id).toBe(430);
      expect(payload).toMatchObject({ amountCents: 200_000, date: businessToday(), method: 'Bank transfer', paymentReference: null });
      expect(payload.requestKey).toMatch(/^[0-9a-f-]{36}$/);
      expect(onPaid).toHaveBeenCalled();
    });

    it('retries a failed submit under the same request key, so it is booked once', async () => {
      const inv = invoice({ id: 431, status: 'APPROVED', outstandingCents: 840_000, paidAmountCents: 0 });
      svc.registerPayment.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(inv);
      await render(inv);
      click(buttonByText(doc(), 'Registrar pago'));
      await flush();
      expect(doc().textContent).toContain('no se registra dos veces');
      click(buttonByText(doc(), 'Registrar pago'));
      await flush();
      expect(svc.registerPayment).toHaveBeenCalledTimes(2);
      expect(svc.registerPayment.mock.calls[1][1].requestKey).toBe(svc.registerPayment.mock.calls[0][1].requestKey);
    });

    it('refuses more than what is owed without calling the server', async () => {
      const inv = invoice({ id: 432, status: 'PENDING_PAYMENT', outstandingCents: 100_000, paidAmountCents: 740_000 });
      await render(inv);
      await type(amountInput(432), '1000.01');
      click(buttonByText(doc(), 'Registrar pago'));
      await flush();
      expect(svc.registerPayment).not.toHaveBeenCalled();
      expect(doc().querySelector('[data-testid="pay-invalid"]')).not.toBeNull();
    });

    it('warns that an invoice approved before the change gets its bill when paid', async () => {
      await render(invoice({ id: 433, status: 'APPROVED', legacyUnlinked: true, payableId: null }));
      expect(doc().querySelector('[data-testid="pay-legacy-warning"]')!.textContent)
        .toContain('revisa en Cuentas por pagar que no la hayas anotado ya a mano');
    });

    it('explains that the payment goes in QuickBooks when the server says so', async () => {
      svc.registerPayment.mockRejectedValue(new ApiError(409, 'in qbo', undefined, 'QUICKBOOKS_PAYMENTS_IN_QBO'));
      await render(invoice({ id: 434, status: 'APPROVED', outstandingCents: 840_000 }));
      click(buttonByText(doc(), 'Registrar pago'));
      await flush();
      expect(doc().querySelector('[data-testid="pay-refusal-quickbooks"]')).not.toBeNull();
      expect(buttonByText(doc(), 'Registrar pago')).toBeUndefined();
    });
  });

  describe('ReviewInvoiceModal', () => {
    const render = async (inv: ReturnType<typeof invoice>) => {
      await act(async () => root.render(
        <ReviewInvoiceModal open onOpenChange={() => {}} invoice={inv} onReviewed={() => {}} onPay={() => {}} />,
      ));
      await flush();
    };

    it('requires a comment to send back, and none to approve', async () => {
      await render(invoice({ id: 418, status: 'IN_REVIEW' }));

      click(buttonByText(doc(), 'Observar'));
      await flush();
      click(buttonByText(doc(), 'Devolver observada'));
      await flush();
      expect(svc.reviewInvoice).not.toHaveBeenCalled();
      expect(doc().textContent).toContain('Sin comentario no se puede observar.');

      svc.reviewInvoice.mockResolvedValue(invoice({ id: 418, status: 'APPROVED' }));
      click(buttonByText(doc(), 'Aprobar'));
      await flush();
      click(buttonByText(doc(), 'Aprobar factura'));
      await flush();
      // Approving creates the bill in Cuentas por pagar: it goes with a due
      // date, thirty days out unless the person picks another.
      expect(svc.reviewInvoice).toHaveBeenCalledWith(418, {
        action: 'APPROVE', comment: null, dueDate: addCalendarDays(businessToday(), 30),
      });
    });

    it('says approving creates the bill, and refuses a due date before the invoice came in', async () => {
      await render(invoice({ id: 419, status: 'IN_REVIEW', createdAt: '2026-09-02T14:20:00Z' }));
      click(buttonByText(doc(), 'Aprobar'));
      await flush();
      expect(doc().textContent).toContain('Al aprobar se crea su cuenta por pagar');
      const due = doc().querySelector<HTMLInputElement>('#rev-due-419')!;
      expect(due.min).toBe('2026-09-02');
      await type(due, '2026-08-30');
      expect(buttonByText(doc(), 'Aprobar factura')!.disabled).toBe(true);
    });

    it('explains a refusal when the same invoice was already typed into Cuentas por pagar', async () => {
      await render(invoice({ id: 420, status: 'IN_REVIEW' }));
      svc.reviewInvoice.mockRejectedValue(new ApiError(409, 'duplicate', undefined, 'SUBCONTRACTOR_INVOICE_IN_PAYABLES'));
      click(buttonByText(doc(), 'Aprobar'));
      await flush();
      click(buttonByText(doc(), 'Aprobar factura'));
      await flush();
      expect(doc().textContent).toContain('Hay una cuenta por pagar con el mismo proveedor y el mismo número de factura.');
    });

    it('offers no payment when the bill is paid in QuickBooks', async () => {
      await render(invoice({ id: 421, status: 'APPROVED', reviewedAt: '2026-09-03T10:00:00Z', paymentsInQuickBooks: true }));
      expect(buttonByText(doc(), 'Registrar pago')).toBeUndefined();
    });

    it('drops both review actions once the invoice has been reviewed, and offers the payment', async () => {
      await render(invoice({ id: 410, status: 'APPROVED', reviewedAt: '2026-08-18T10:00:00Z' }));
      expect(buttonByText(doc(), 'Observar')).toBeUndefined();
      expect(doc().textContent).toContain('Ya revisaste esta factura.');
      expect(buttonByText(doc(), 'Registrar pago')).toBeTruthy();
    });

    it('says an invoice with no file can still be approved', async () => {
      await render(invoice({ id: 402, status: 'SUBMITTED', hasFile: false, fileContentType: null }));
      expect(doc().textContent).toContain('Esta factura no trae archivo.');
      expect(doc().querySelector('iframe')).toBeNull();
    });
  });

  describe('JobNotes', () => {
    it('holds the send button until five characters, and says so', async () => {
      await act(async () => root.render(<JobNotes jobId={418} />));
      await flush();

      const send = buttonByText(container, 'Enviar')!;
      expect(send.disabled).toBe(true);
      expect(container.textContent).toContain('Al menos 5 caracteres');
      // The old copy promised ten; the server has always enforced five.
      expect(container.textContent).not.toContain('10 caracteres');

      const box = container.querySelector('textarea')!;
      type(box, 'ok');
      expect(buttonByText(container, 'Enviar')!.disabled).toBe(true);

      type(box, 'Corrige la soldadura');
      expect(buttonByText(container, 'Enviar')!.disabled).toBe(false);

      svc.addJobObservation.mockResolvedValue(note({ id: 1, message: 'Corrige la soldadura' }));
      click(buttonByText(container, 'Enviar'));
      await flush();
      expect(svc.addJobObservation).toHaveBeenCalledWith(418, { message: 'Corrige la soldadura' });
    });
  });
});
