// The history's three long-standing lies, pinned.
//
// The tab printed the raw machine token, read `entry.comment` — a field the
// response has never had — and ignored the `i18n` every row has carried since
// backend V99. So the heading was English shouting, and the comment somebody
// typed when changing a status was never shown to anyone.

import { beforeAll, describe, expect, it } from 'vitest';
import i18n from '../../../i18n';
import { evidenceDescription, timelineDetail, timelineHeading } from './timelineText';
import { evidence, timelineEntry } from './testing';

type T = Parameters<typeof timelineHeading>[0];
const t = (): T => i18n.t.bind(i18n) as unknown as T;

describe('timelineText', () => {
  beforeAll(() => i18n.changeLanguage('es'));

  it('never shows a machine token as the heading', () => {
    for (const action of ['JOB_CREATED', 'STATUS_CHANGED', 'OBSERVATION_ADDED', 'EVIDENCE_UPLOADED', 'INVOICE_SUBMITTED', 'INVOICE_REVIEWED', 'INVOICE_RESUBMITTED', 'PAYMENT_REGISTERED']) {
      const heading = timelineHeading(t(), timelineEntry({ id: 1, action }));
      expect(heading).not.toMatch(/_/);
      expect(heading).not.toMatch(/^subcontractors:/);
      expect(heading).not.toBe(action);
    }
  });

  it('spaces out an action a newer server invented rather than printing a key', () => {
    expect(timelineHeading(t(), timelineEntry({ id: 1, action: 'SOMETHING_NEW' }))).toBe('SOMETHING NEW');
  });

  it('shows the comment written on a status change — the one that was never visible', () => {
    const entry = timelineEntry({
      id: 2,
      action: 'STATUS_CHANGED',
      fromStatus: 'IN_PROGRESS',
      toStatus: 'IN_REVIEW',
      message: 'Quedaron esmerilados los dos balcones del nivel 4.',
    });
    expect(timelineDetail(t(), entry)).toBe('Quedaron esmerilados los dos balcones del nivel 4.');
  });

  it('composes the machine-written line from its key, not from the English fallback', () => {
    const entry = timelineEntry({
      id: 3,
      action: 'EVIDENCE_UPLOADED',
      message: 'PROGRESS_PHOTO: plano-e301.png',
      i18n: { msgKey: 'timelineEvidenceDetail', params: { evidenceType: 'PROGRESS_PHOTO', fileName: 'plano-e301.png' } },
    });
    const detail = timelineDetail(t(), entry)!;
    expect(detail).toContain('plano-e301.png');
    expect(detail).toContain('Avance');
    expect(detail).not.toContain('PROGRESS_PHOTO');
  });

  it('falls back whole to the stored text for a key this build does not know', () => {
    const entry = timelineEntry({
      id: 4,
      action: 'JOB_CREATED',
      message: 'Job assigned',
      i18n: { msgKey: 'timelineSomethingTheServerAddedLater', params: {} },
    });
    // All-or-nothing: no half-translated line.
    expect(timelineDetail(t(), entry)).toBe('Job assigned');
  });

  it('has no detail when the row carries neither a key nor a message', () => {
    expect(timelineDetail(t(), timelineEntry({ id: 5, action: 'STATUS_CHANGED', message: '   ' }))).toBeNull();
  });

  it('names an evidence type this build has not seen by its raw value', () => {
    const entry = timelineEntry({
      id: 6,
      action: 'EVIDENCE_UPLOADED',
      i18n: { msgKey: 'timelineEvidenceDetail', params: { evidenceType: 'LASER_SCAN', fileName: 'a.e57' } },
    });
    expect(timelineDetail(t(), entry)).toContain('LASER_SCAN');
  });

  it('punctuates the invoice amount of an evidence row from raw cents', () => {
    const row = evidence({
      id: 7,
      evidenceType: 'INVOICE',
      description: 'Invoice F-2026-0418 — $8,400.00',
      i18n: { msgKey: 'evidenceInvoiceDetail', params: { invoiceNumber: 'F-2026-0418', amountCents: 840000 } },
    });
    expect(evidenceDescription(t(), row)).toBe('Factura F-2026-0418 · $8,400.00');
  });

  it('keeps the uploader\'s own words verbatim', () => {
    expect(evidenceDescription(t(), evidence({ id: 8, description: 'Anclaje del nivel 4' }))).toBe('Anclaje del nivel 4');
  });

  it('reads the same contract in English', async () => {
    await i18n.changeLanguage('en');
    try {
      expect(timelineHeading(t(), timelineEntry({ id: 9, action: 'PAYMENT_REGISTERED' }))).toBe('Payment recorded');
      const detail = timelineDetail(t(), timelineEntry({
        id: 10,
        action: 'EVIDENCE_UPLOADED',
        i18n: { msgKey: 'timelineEvidenceDetail', params: { evidenceType: 'FINAL_EVIDENCE', fileName: 'b.jpg' } },
      }))!;
      expect(detail).toContain('Final');
    } finally {
      await i18n.changeLanguage('es');
    }
  });
});
