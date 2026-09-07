// The rules the windows carry, which the old ones stated nowhere: reopening a
// closed job is the one dangerous jump, observing an invoice needs a comment
// and approving does not, and the note composer's minimum is five characters
// (the old copy said ten and was never shown).

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const svc = vi.hoisted(() => ({
  updateJobStatus: vi.fn(),
  reviewInvoice: vi.fn(),
  getJobObservations: vi.fn(),
  addJobObservation: vi.fn(),
}));
vi.mock('../../services/subcontractors', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/subcontractors')>()),
  updateJobStatus: svc.updateJobStatus,
  reviewInvoice: svc.reviewInvoice,
  getJobObservations: svc.getJobObservations,
  addJobObservation: svc.addJobObservation,
}));

import i18n from '../../../i18n';
import { ChangeStatusModal } from './ChangeStatusModal';
import { ReviewInvoiceModal } from './ReviewInvoiceModal';
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
      expect(svc.reviewInvoice).toHaveBeenCalledWith(418, { action: 'APPROVE', comment: null });
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
