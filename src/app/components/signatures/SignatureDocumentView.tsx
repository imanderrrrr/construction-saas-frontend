// BuildTrack — The frozen document, as the signer sees it.
//
// Extracted from `pages/SignDocument.tsx` so that the emailed-link page and the
// on-site handoff render the *same* document from the *same* code. These two
// surfaces show a paper the client puts their name to; if they were allowed to
// drift, "what was on screen when they signed" would depend on which one they
// used, and that is precisely the question the snapshot + hash exist to answer.
//
// Renders the snapshot the server rebuilt — never a live row.

import { useTranslation } from 'react-i18next';
import { FileSignature } from 'lucide-react';
import type { SignatureDocument } from '../../services/signatures';

/**
 * Format a date-only value (`YYYY-MM-DD`) as the calendar day it literally is.
 *
 * `new Date('2026-08-01')` parses as midnight UTC, so a signer anywhere west of
 * Greenwich was shown "31 de julio" for an invoice dated 2026-08-01 — caught in
 * a browser, not by a test. On a document somebody is putting their name to, a
 * date that shifts with the reader's timezone is not acceptable, so the
 * components are read straight out of the string and rendered with no timezone
 * in play at all. The same document reads the same day everywhere.
 */
export function formatDocumentDate(value: string, locale: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const [, y, m, d] = match;
  return new Date(Number(y), Number(m) - 1, Number(d))
    .toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
}

export function money(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' })
    .format(cents / 100);
}

/**
 * i18n key for the document's title line.
 *
 * A lookup and not a ternary: with two kinds a ternary was fine, but the
 * fall-through meant a T&M sheet — a third kind, added by the backend — would
 * have introduced itself to the client's superintendent as "Invoice TM-000123".
 * An unknown kind now degrades to the neutral "Document" instead of confidently
 * claiming to be the wrong one.
 */
export function documentKindKey(documentKind: string): string {
  switch (documentKind) {
    case 'CHANGE_ORDER_REQUEST': return 'kind.changeOrder';
    case 'TIME_AND_MATERIAL': return 'kind.timeAndMaterial';
    case 'INVOICE': return 'kind.invoice';
    default: return 'kind.document';
  }
}

export function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="text-right font-medium text-zinc-800">{value}</dd>
    </div>
  );
}

export function SignatureDocumentView({ doc }: { doc: SignatureDocument }) {
  const { t, i18n } = useTranslation('signatures');
  const docDate = (value: string) => formatDocumentDate(value, i18n.language);

  return (
    <>
      <header className="border-b border-zinc-200 pb-4">
        <p className="text-sm text-zinc-500">{doc.companyName}</p>
        <h1 className="mt-1 flex items-center gap-2 text-xl font-semibold text-zinc-900">
          <FileSignature className="h-5 w-5 text-orange-500" />
          {t(documentKindKey(doc.documentKind))}{' '}{doc.documentNumber}
        </h1>
        <p className="mt-1 text-sm text-zinc-600">{doc.projectName} · {doc.clientName}</p>
      </header>

      <section className="mt-6 space-y-4">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Row label={t('doc.issued')} value={docDate(doc.issuedDate)} />
          {/* A T&M sheet has no due date — it authorises work already done, it
              does not ask to be paid by a date. The snapshot simply omits the
              key, so the row is dropped rather than printed empty. */}
          {doc.dueDate && <Row label={t('doc.due')} value={docDate(doc.dueDate)} />}
        </dl>

        {doc.description && <p className="text-sm text-zinc-700">{doc.description}</p>}

        {doc.lineItems.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs uppercase text-zinc-500">
                  <th className="py-2">{t('doc.item')}</th>
                  <th className="py-2 text-right">{t('doc.qty')}</th>
                  <th className="py-2 text-right">{t('doc.unit')}</th>
                  <th className="py-2 text-right">{t('doc.amount')}</th>
                </tr>
              </thead>
              <tbody>
                {doc.lineItems.map((li, i) => (
                  <tr key={i} className="border-b border-zinc-100">
                    <td className="py-2 pr-2">{li.description}</td>
                    <td className="py-2 text-right tabular-nums">{li.quantity}</td>
                    <td className="py-2 text-right tabular-nums">{money(li.unitPriceCents, doc.currency)}</td>
                    <td className="py-2 text-right tabular-nums">{money(li.subtotalCents, doc.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <dl className="ml-auto max-w-xs space-y-1 text-sm">
          <Row label={t('doc.subtotal')} value={money(doc.subtotalCents, doc.currency)} />
          {doc.discountCents > 0 && (
            <Row label={t('doc.discount')} value={`-${money(doc.discountCents, doc.currency)}`} />
          )}
          {/* Zero tax on a T&M sheet is emitted so the hashed payload keeps a
              stable shape, but printing "Tax (0.00%) $0.00" on a sheet that has
              no tax is noise on a document meant to be read and signed. */}
          {doc.taxCents !== 0 && (
            <Row label={`${t('doc.tax')} (${doc.taxRate}%)`} value={money(doc.taxCents, doc.currency)} />
          )}
          <div className="flex justify-between border-t border-zinc-300 pt-1 font-semibold text-zinc-900">
            <dt>{t('doc.total')}</dt>
            <dd className="tabular-nums">{money(doc.totalCents, doc.currency)}</dd>
          </div>
        </dl>

        {doc.notes && (
          <p className="rounded-lg bg-zinc-50 p-3 text-sm text-zinc-600">{doc.notes}</p>
        )}
      </section>
    </>
  );
}
