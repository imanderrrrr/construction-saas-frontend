import type { TFunction } from 'i18next';
import type { EvidenceEntry, SubcontractorI18n, TimelineEntry } from '../../services/subcontractors';
import { fmtMoney } from './bits';

/**
 * Composes the server-written lines of the job history and the evidence list
 * in the language the panel is in *right now*.
 *
 * The web sibling of the app's `SubcontractorI18nText`, and it mirrors that
 * resolver rather than the catalogue: the param names are part of the contract
 * too, and a wrong one composes just as happily with the value missing.
 *
 * These rows are written when someone acts on a job — an upload, an invoice, a
 * status change — with no reader and no `Accept-Language` in sight, so the
 * server cannot know which language to write them in. Backend V99 sends a
 * stable key plus raw params instead, and the sentence is built here on every
 * render.
 *
 * Composition is all-or-nothing: a row whose key is missing (pre-V99) or
 * unrecognised (a newer server than this build) falls back whole to the
 * server's stored text. There is no half-translated state.
 *
 * The panel used to show none of this. It printed the raw token —
 * STATUS_CHANGED, EVIDENCE_UPLOADED — and read `entry.comment`, a field this
 * response has never had (it is `message`), so the comment somebody typed on a
 * status change was never seen by anyone.
 */

type T = TFunction<['subcontractors'], undefined>;

function str(params: Record<string, unknown> | undefined, key: string): string {
  const v = params?.[key];
  return typeof v === 'string' ? v : '';
}

function num(params: Record<string, unknown> | undefined, key: string): number {
  const v = params?.[key];
  return typeof v === 'number' ? v : 0;
}

function compose(t: T, i18n: SubcontractorI18n | null | undefined): string | null {
  const key = i18n?.msgKey;
  const params = i18n?.params;
  switch (key) {
    case 'timelineJobAssignedDetail':
      return t('subcontractors:tl.detail.timelineJobAssignedDetail');
    case 'timelineEvidenceDetail':
      return t('subcontractors:tl.detail.timelineEvidenceDetail', {
        // The enum name is what the server sends precisely so this side owns
        // the wording; an unknown type falls back to the raw name.
        type: evidenceTypeLabel(t, str(params, 'evidenceType')),
        fileName: str(params, 'fileName'),
      });
    case 'timelineInvoiceDetail':
      return t('subcontractors:tl.detail.timelineInvoiceDetail', { invoiceNumber: str(params, 'invoiceNumber') });
    case 'evidenceInvoiceDetail':
      return t('subcontractors:tl.detail.evidenceInvoiceDetail', {
        invoiceNumber: str(params, 'invoiceNumber'),
        // Raw cents from the wire, punctuated here with the same formatter the
        // rest of the section uses, so one amount does not wear two shapes.
        amount: fmtMoney(num(params, 'amountCents')),
      });
    default:
      return null;
  }
}

/**
 * Looks a key up, or returns null when this build does not have it.
 *
 * Via `defaultValue` rather than by comparing the result to the key: i18next
 * echoes a missing key back *without* its namespace, so `t(k) === k` is never
 * true for a namespaced key and every miss would slip through as a literal
 * `tl.action.SOMETHING_NEW` printed at the user.
 */
function lookup(t: T, key: string): string | null {
  const value = t(key, { defaultValue: '' });
  return value ? value : null;
}

/** "Avance" / "Progress" for an evidence type; the raw name for one this build has not seen. */
export function evidenceTypeLabel(t: T, type: string): string {
  return lookup(t, `subcontractors:ev.type.${type}`) ?? type;
}

/** The line under a history heading, or null when the row has none. */
export function timelineDetail(t: T, entry: TimelineEntry): string | null {
  const composed = compose(t, entry.i18n);
  if (composed) return composed;
  const fallback = entry.message?.trim();
  return fallback ? fallback : null;
}

/** The heading of a history row. Never a machine token, never English. */
export function timelineHeading(t: T, entry: TimelineEntry): string {
  // A server newer than this build: show the token spaced out rather than a
  // translation key.
  return lookup(t, `subcontractors:tl.action.${entry.action}`) ?? entry.action.replace(/_/g, ' ');
}

/**
 * The description of an evidence row: the uploader's own words, or the
 * composed sentence for the row the server creates from an invoice.
 */
export function evidenceDescription(t: T, evidence: EvidenceEntry): string | null {
  const composed = compose(t, evidence.i18n);
  if (composed) return composed;
  const fallback = evidence.description?.trim();
  return fallback ? fallback : null;
}
