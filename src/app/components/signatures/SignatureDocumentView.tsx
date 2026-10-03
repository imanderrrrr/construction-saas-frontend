// BuildTrack — The frozen document, as the signer sees it.
//
// Extracted from `pages/SignDocument.tsx` so that the emailed-link page and the
// on-site handoff render the *same* document from the *same* code. These two
// surfaces show a paper the client puts their name to; if they were allowed to
// drift, "what was on screen when they signed" would depend on which one they
// used, and that is precisely the question the snapshot + hash exist to answer.
//
// Renders the snapshot the server rebuilt — never a live row.
//
// Typeset like a document of the panel: a mono kicker, a display title over an
// ink rule, mono figures with tabular numerals, the total in display type, and
// the notes on the paper note every screen uses for a remark.

import { useTranslation } from 'react-i18next';
import { cn } from '../ui/utils';
import { Mono, PaperNote } from '../projects/bt';
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
 * A line's quantity, printed so it does not sit ragged next to the money.
 *
 * The amount columns always carry two decimals, so a T&M crew line — whose
 * quantity is hours — printed `22.5` beside `$20.00` and `$450.00`, three
 * right-aligned numerals with two different decimal habits.
 *
 * Only fractional quantities are padded. An invoice line for 1 unit still
 * reads `1`, not `1.00`: this document is also a client invoice, and turning
 * every whole count into a decimal would be a change to what the client
 * receives rather than a fix to what was misaligned.
 */
export function quantity(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
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

/** A label and its value. `numeric` sets the value in mono with tabular figures. */
export function Row({ label, value, numeric }: { label: string; value: string; numeric?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt><Mono className="text-[10px] tracking-[0.1em] text-[#8A8175]">{label}</Mono></dt>
      <dd className={cn('text-right text-[13px] font-semibold text-[#0A0A0A]', numeric && 'font-bt-mono text-[12.5px] tabular-nums')}>
        {value}
      </dd>
    </div>
  );
}

const TH = 'py-2 font-bt-mono text-[10px] font-normal uppercase tracking-[0.12em] text-[#8A8175]';
const NUM = 'py-2 pl-3 text-right font-bt-mono text-[12.5px] tabular-nums whitespace-nowrap';

export function SignatureDocumentView({ doc }: { doc: SignatureDocument }) {
  const { t, i18n } = useTranslation('signatures');
  const docDate = (value: string) => formatDocumentDate(value, i18n.language);

  return (
    <>
      <header className="border-b border-[#0A0A0A] pb-4">
        <div className="flex items-center gap-2.5">
          <span aria-hidden="true" className="block h-2 w-2 shrink-0 bg-[#F97316]" />
          <Mono className="text-[10.5px] font-semibold tracking-[0.14em] text-[#5A5346]">{doc.companyName}</Mono>
        </div>
        <h1 className="mt-2 font-bt-display text-[32px] font-extrabold uppercase leading-[0.92] tracking-[0.01em] text-[#0A0A0A] sm:text-[40px]">
          {t(documentKindKey(doc.documentKind))}{' '}
          <Mono className="block text-[13px] font-semibold normal-case tracking-[0.03em] mt-1.5">{doc.documentNumber}</Mono>
        </h1>
        <p className="mt-2 text-[13px] leading-[1.5] text-[#5A5346]">{doc.projectName} · {doc.clientName}</p>
      </header>

      <section className="mt-5 space-y-4">
        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-x-6">
          <Row label={t('doc.issued')} value={docDate(doc.issuedDate)} />
          {/* A T&M sheet has no due date — it authorises work already done, it
              does not ask to be paid by a date. The snapshot simply omits the
              key, so the row is dropped rather than printed empty. */}
          {doc.dueDate && <Row label={t('doc.due')} value={docDate(doc.dueDate)} />}
        </dl>

        {doc.description && <p className="text-[13px] leading-[1.5] text-[#0A0A0A]">{doc.description}</p>}

        {doc.lineItems.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[#0A0A0A] text-left">
                  <th className={TH}>{t('doc.item')}</th>
                  <th className={cn(TH, 'pl-3 text-right')}>{t('doc.qty')}</th>
                  <th className={cn(TH, 'pl-3 text-right')}>{t('doc.unit')}</th>
                  <th className={cn(TH, 'pl-3 text-right')}>{t('doc.amount')}</th>
                </tr>
              </thead>
              <tbody>
                {doc.lineItems.map((li, i) => (
                  <tr key={i} className="border-b border-[#F0EBE1]">
                    <td className="py-2 pr-2 text-[#0A0A0A]">{li.description}</td>
                    <td className={cn(NUM, 'text-[#5A5346]')}>{quantity(li.quantity)}</td>
                    <td className={cn(NUM, 'text-[#5A5346]')}>{money(li.unitPriceCents, doc.currency)}</td>
                    <td className={cn(NUM, 'font-semibold text-[#0A0A0A]')}>{money(li.subtotalCents, doc.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <dl className="ml-auto max-w-xs space-y-1.5">
          <Row numeric label={t('doc.subtotal')} value={money(doc.subtotalCents, doc.currency)} />
          {doc.discountCents > 0 && (
            <Row numeric label={t('doc.discount')} value={`-${money(doc.discountCents, doc.currency)}`} />
          )}
          {/* Zero tax on a T&M sheet is emitted so the hashed payload keeps a
              stable shape, but printing "Tax (0.00%) $0.00" on a sheet that has
              no tax is noise on a document meant to be read and signed. */}
          {doc.taxCents !== 0 && (
            <Row numeric label={`${t('doc.tax')} (${doc.taxRate}%)`} value={money(doc.taxCents, doc.currency)} />
          )}
          <div className="flex items-baseline justify-between gap-4 border-t border-[#0A0A0A] pt-2">
            <dt><Mono className="text-[10px] font-semibold tracking-[0.12em] text-[#0A0A0A]">{t('doc.total')}</Mono></dt>
            <dd className="font-bt-display text-[24px] font-extrabold leading-none tabular-nums text-[#0A0A0A]">
              {money(doc.totalCents, doc.currency)}
            </dd>
          </div>
        </dl>

        {doc.notes && (
          <PaperNote tone="none" className="text-[12.5px]">{doc.notes}</PaperNote>
        )}
      </section>
    </>
  );
}
