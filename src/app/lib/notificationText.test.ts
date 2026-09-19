// BuildTrack — notification text resolver.
//
// The panel used to paint the server's `title`/`message` raw, which are
// English, so the Spanish dashboard's inbox spoke English. These tests pin the
// TypeScript mirror of the mobile resolver (notification_text.dart): the three
// resolution rules, and — because a misspelt param name composes fine with the
// value simply gone — the shape every param takes in the sentence.

import { afterEach, describe, expect, it } from 'vitest';
import i18n from '../../i18n';
import { notificationText, TITLE_KEYS, type NotificationLike, type Translate } from './notificationText';

const tEs = i18n.getFixedT('es') as unknown as Translate;
const tEn = i18n.getFixedT('en') as unknown as Translate;

function row(over: Partial<NotificationLike> & { i18n?: NotificationLike['i18n'] } = {}): NotificationLike {
  return {
    type: 'EVENT_APPROVED',
    title: 'Server title',
    message: 'Server message',
    i18n: null,
    ...over,
  };
}

function keyed(titleKey: string, bodyKey: string, params: Record<string, unknown> = {}): NotificationLike {
  return row({ i18n: { titleKey, bodyKey, params } });
}

const es = (n: NotificationLike) => notificationText(n, tEs, 'es');
const en = (n: NotificationLike) => notificationText(n, tEn, 'en');

describe('resolution rules (identical to Dart)', () => {
  it('1. the type wins over the key pair: PASSWORD_SETUP_SUGGESTED needs no keys', () => {
    const n = row({ type: 'PASSWORD_SETUP_SUGGESTED', title: 'Set a password', message: 'You sign in…' });
    expect(es(n).title).toBe('Pon una contraseña');
    expect(en(n).title).toBe('Set a password');
    expect(es(n).body).toContain('código QR');
  });

  it('1b. …and still wins when a key pair rides along', () => {
    const n = row({
      type: 'PASSWORD_SETUP_SUGGESTED',
      i18n: { titleKey: 'notifEventApprovedTitle', bodyKey: 'notifEventApprovedBody', params: {} },
    });
    expect(es(n).title).toBe('Pon una contraseña');
  });

  it('2. a known pair composes in the current language', () => {
    const n = keyed('notifInvoiceSubmittedTitle', 'notifInvoiceSubmittedBody', {
      actor: 'Constructora Sur', amountCents: 125050, job: 'Fundición losa 2',
    });
    expect(es(n)).toEqual({
      title: 'Nueva factura recibida',
      body: 'Constructora Sur envió una factura por $1,250.50 en “Fundición losa 2”.',
    });
    expect(en(n)).toEqual({
      title: 'New invoice submitted',
      body: 'Constructora Sur submitted an invoice for $1,250.50 on “Fundición losa 2”.',
    });
  });

  it('3. no i18n at all (pre-V95 row) → the server text, both fields', () => {
    expect(es(row())).toEqual({ title: 'Server title', body: 'Server message' });
    expect(es(row({ i18n: {} }))).toEqual({ title: 'Server title', body: 'Server message' });
  });

  it('3b. only one of the two keys → both fall back', () => {
    expect(es(row({ i18n: { titleKey: 'notifInvoiceSubmittedTitle' } })).title).toBe('Server title');
    expect(es(row({ i18n: { bodyKey: 'notifInvoiceSubmittedBody' } })).body).toBe('Server message');
  });

  it('3c. an unrecognised title with a known body → both fall back, never a mixed pair', () => {
    const n = keyed('notifSomethingNewerTitle', 'notifInvoiceSubmittedBody', { job: 'x' });
    expect(es(n)).toEqual({ title: 'Server title', body: 'Server message' });
  });

  it('3d. a known title with an unrecognised body → both fall back', () => {
    const n = keyed('notifInvoiceSubmittedTitle', 'notifSomethingNewerBody', { job: 'x' });
    expect(es(n)).toEqual({ title: 'Server title', body: 'Server message' });
  });

  it('3e. "recognised" means a title, not any string in the namespace', () => {
    // A body key in the title slot, or a helper key, is a server bug — fall
    // back rather than paint "{{reviewer}} aprobó…" as a title.
    expect(es(keyed('notifInvoiceSubmittedBody', 'notifInvoiceSubmittedBody', { job: 'x' })).title).toBe('Server title');
    expect(es(keyed('notifRoleAdmin', 'notifInvoiceSubmittedBody', { job: 'x' })).title).toBe('Server title');
  });

  it('a malformed params value is treated as empty, not thrown on', () => {
    for (const params of [null, 'nope', 42, ['a']] as unknown[]) {
      const n = row({ i18n: { titleKey: 'notifClockChangeTitle', bodyKey: 'notifClockChangeBody', params: params as never } });
      expect(es(n).title).toBe('Posible manipulación del reloj');
      expect(es(n).body).not.toContain('{{');
    }
  });
});

describe('param rendering', () => {
  const review = { reviewer: 'Ana', event: 'CHECK_IN', date: '2026-09-19', project: 'Torre Norte' };

  it('dates: day-first in Spanish, month-first in English; event names in the sentence\'s words', () => {
    const n = keyed('notifEventApprovedTitle', 'notifEventApprovedBody', review);
    expect(es(n).body).toBe('Ana aprobó tu entrada del 19 sept 2026 en “Torre Norte”.');
    expect(en(n).body).toBe('Ana approved your check-in on Sep 19, 2026 for “Torre Norte”.');
  });

  describe('a date-only param is a calendar day in every timezone', () => {
    const original = process.env.TZ;
    afterEach(() => {
      if (original === undefined) delete process.env.TZ; else process.env.TZ = original;
    });
    for (const tz of ['UTC', 'America/Guatemala', 'Europe/Madrid', 'Pacific/Kiritimati']) {
      it(`TZ=${tz}`, () => {
        process.env.TZ = tz;
        const n = keyed('notifHoursApprovedTitle', 'notifHoursApprovedBody', { reviewer: 'Ana', date: '2026-09-19', project: 'P' });
        expect(es(n).body).toContain('19 sept 2026');
        expect(en(n).body).toContain('Sep 19, 2026');
      });
    }
  });

  it('an unparsable date is shown raw; a missing one leaves the hole empty', () => {
    expect(es(keyed('notifHoursApprovedTitle', 'notifHoursApprovedBody', { reviewer: 'Ana', date: 'mañana', project: 'P' })).body)
      .toContain('del mañana en');
    const missing = es(keyed('notifHoursApprovedTitle', 'notifHoursApprovedBody', { reviewer: 'Ana', project: 'P' })).body;
    expect(missing).toBe('Ana aprobó tus horas del  en “P”.');
  });

  it('the optional comment clause hangs off every review sentence', () => {
    const n = keyed('notifHoursRejectedTitle', 'notifHoursRejectedBody', { ...review, comment: 'Faltó la salida' });
    expect(es(n).body).toBe('Ana rechazó tus horas del 19 sept 2026 en “Torre Norte”. Comentario: Faltó la salida');
    expect(en(n).body).toBe('Ana rejected your hours for Sep 19, 2026 on “Torre Norte”. Comment: Faltó la salida');
    // Empty comment → no clause (the server drops nulls; an empty string reads the same).
    expect(es(keyed('notifHoursRejectedTitle', 'notifHoursRejectedBody', { ...review, comment: '' })).body).not.toContain('Comentario');
  });

  it('an event type this build has not seen keeps its raw name, humanised', () => {
    const n = keyed('notifEventReviewedTitle', 'notifEventReviewedBody', { ...review, event: 'NIGHT_SHIFT_START' });
    expect(es(n).body).toContain('tu night shift start del');
  });

  it('manual marks list every mark as "<event> <time>"', () => {
    const n = keyed('notifManualMarksTitle', 'notifManualMarksCreatedBody', {
      actor: 'admin1', date: '2026-09-19', project: 'Torre Norte',
      marks: [{ type: 'CHECK_IN', time: '07:00' }, { type: 'CHECK_OUT', time: '16:30' }, 'garbage'],
    });
    expect(es(n).body).toBe(
      'Administración (admin1) creó marcas de tu jornada del 19 sept 2026 en “Torre Norte”: entrada 07:00, salida 16:30. Quedan pendientes de aprobación.',
    );
    expect(en(n).title).toBe('Time marks created by admin');
  });

  it('transit cancelled: the origin is a separate sentence when unknown', () => {
    const base = { worker: 'Luis', to: 'Torre Norte', reason: 'Se pinchó la llanta' };
    expect(es(keyed('notifTransitCancelledTitle', 'notifTransitCancelledBody', { ...base, from: 'Bodega' })).body)
      .toBe('Luis canceló el traslado a “Torre Norte” desde “Bodega”. Motivo: Se pinchó la llanta');
    expect(es(keyed('notifTransitCancelledTitle', 'notifTransitCancelledBody', base)).body)
      .toBe('Luis canceló el traslado a “Torre Norte”. Motivo: Se pinchó la llanta');
    expect(es(keyed('notifTransitCancelledTitle', 'notifTransitCancelledBody', { ...base, from: '' })).body)
      .not.toContain('desde');
  });

  it('transit disputed: minutes arrive as an integer', () => {
    const n = keyed('notifTransitDisputedTitle', 'notifTransitDisputedBody', { worker: 'Luis', to: 'Torre Norte', minutes: 42, reason: 'Tráfico' });
    expect(en(n).body).toBe('Luis disputed transit to “Torre Norte” after 42 min. Reason: Tráfico');
  });

  it('durations: "2 h 15 min" past the hour, "45 min" under it, with the optional comment', () => {
    expect(es(keyed('notifTransitDisputeResolvedTitle', 'notifTransitDisputeResolvedBody', { awardedMinutes: 135 })).body)
      .toBe('Se resolvió tu disputa de traslado. Tiempo reconocido: 2 h 15 min.');
    expect(en(keyed('notifTransitDisputeResolvedTitle', 'notifTransitDisputeResolvedBody', { awardedMinutes: 45, comment: 'Ok' })).body)
      .toBe('Your transit time dispute was resolved. Time awarded: 45 min. Comment: Ok');
    expect(es(keyed('notifTransitDisputeResolvedTitle', 'notifTransitDisputeResolvedBody', {})).body)
      .toContain('Tiempo reconocido: 0 min.');
  });

  it('roles are named in the language; an unknown one is lower-cased raw', () => {
    expect(es(keyed('notifAccountDeletionTitle', 'notifAccountDeletionBody', { user: 'luis', role: 'WORKER' })).body)
      .toMatch(/^luis \(trabajador\) solicitó eliminar su cuenta\./);
    expect(en(keyed('notifAccountDeletionTitle', 'notifAccountDeletionBody', { user: 'luis', role: 'WORKER' })).body)
      .toMatch(/^luis \(worker\) requested account deletion\./);
    expect(es(keyed('notifAccountDeletionTitle', 'notifAccountDeletionBody', { user: 'luis', role: 'WAREHOUSE' })).body)
      .toContain('(warehouse)');
  });

  it('punch items: zero-padded number, quoted title, optional location, optional reason', () => {
    const item = { itemNumber: 12, itemTitle: 'Fuga en el lavamanos', project: 'Torre Norte' };
    expect(es(keyed('notifPunchCreatedTitle', 'notifPunchCreatedBody', { ...item, location: 'Baño 2' })).body)
      .toBe('n.º 012 “Fuga en el lavamanos” (Baño 2) en “Torre Norte”: revísalo y asígnalo.');
    expect(en(keyed('notifPunchCreatedTitle', 'notifPunchCreatedBody', item)).body)
      .toBe('#012 “Fuga en el lavamanos” on “Torre Norte” — review it and assign it.');
    expect(es(keyed('notifPunchRejectedTitle', 'notifPunchRejectedBody', { ...item, reason: 'Sigue goteando' })).body)
      .toBe('El cliente devolvió n.º 012 “Fuga en el lavamanos” en “Torre Norte”. Motivo: Sigue goteando');
    expect(es(keyed('notifPunchAssignedTitle', 'notifPunchAssignedBody', { ...item, actor: 'ana' })).body)
      .toBe('ana te asignó n.º 012 “Fuga en el lavamanos” en “Torre Norte”.');
  });

  it('job statuses use the words of the subcontractor status chips', () => {
    const n = keyed('notifJobStatusUpdatedTitle', 'notifJobStatusUpdatedBody', { job: 'Fundición', status: 'IN_REVIEW' });
    expect(es(n).body).toBe('“Fundición” pasó a En revisión.');
    expect(en(n).body).toBe('“Fundición” is now In review.');
    expect(es(keyed('notifJobStatusUpdatedTitle', 'notifJobStatusUpdatedBody', { job: 'F', status: 'ON_HOLD', comment: 'Lluvia' })).body)
      .toBe('“F” pasó a on hold. Comentario: Lluvia');
  });

  it('money: raw cents → "$1,250.50" in both languages; absent → empty', () => {
    expect(es(keyed('notifInvoiceResubmittedTitle', 'notifInvoiceResubmittedBody', { actor: 'S', amountCents: 999999, job: 'J' })).body)
      .toContain('por $9,999.99 en');
    expect(en(keyed('notifInvoiceResubmittedTitle', 'notifInvoiceResubmittedBody', { actor: 'S', job: 'J' })).body)
      .toBe('S corrected and resubmitted an invoice for  on “J”.');
  });

  it('payment reference and tool rejection reason are optional clauses', () => {
    expect(es(keyed('notifPaymentRegisteredTitle', 'notifPaymentRegisteredBody', { job: 'J', reference: 'TRX-9' })).body)
      .toBe('Se registró un pago de tu factura en “J”. Referencia: TRX-9');
    expect(es(keyed('notifPaymentRegisteredTitle', 'notifPaymentRegisteredBody', { job: 'J' })).body)
      .toBe('Se registró un pago de tu factura en “J”.');
    expect(en(keyed('notifToolRejectedTitle', 'notifToolRejectedBody', { actor: 'luis', tool: 'Taladro', code: 'T-01', reason: 'Roto' })).body)
      .toBe('luis rejected the tool Taladro (T-01). Reason: Roto');
  });

  it('RFIs: zero-padded number, or no number on a legacy row; the due date localized', () => {
    const rfi = { rfiNumber: 7, subject: 'Detalle de anclaje', project: 'Torre Norte' };
    expect(es(keyed('notifRfiSubmittedTitle', 'notifRfiSubmittedDueBody', { ...rfi, dueDate: '2026-10-01' })).body)
      .toBe('RFI n.º 007 “Detalle de anclaje” en “Torre Norte” espera la respuesta del cliente para el 1 oct 2026.');
    expect(en(keyed('notifRfiSubmittedTitle', 'notifRfiSubmittedBody', { subject: 'Anchor detail', project: 'P' })).body)
      .toBe('RFI “Anchor detail” on “P” is waiting for the client\'s answer.');
  });

  it('the title allowlist is exactly the catalogue\'s title keys', () => {
    const catalogue = i18n.getResourceBundle('en', 'notifications') as Record<string, string>;
    const titles = Object.keys(catalogue).filter(k => k.startsWith('notif') && k.endsWith('Title')).sort();
    expect([...TITLE_KEYS].sort()).toEqual(titles);
  });
});
