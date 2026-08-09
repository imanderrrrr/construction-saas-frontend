// BuildTrack — Public signing page: ONE document, opened from an emailed link.
//
// No account, no install: the token in the URL is exchanged for a short-lived
// session, the frozen document is rendered, and the signer gives the three
// things the client asks for — signature, name, title. A dead link (already
// signed, revoked, expired) renders a friendly "ask for a new link" state.
//
// Nothing on this page claims legal validity. It records who signed, when, and
// over which exact version of the document; what that is worth in a given
// jurisdiction is a lawyer's call, not a label we get to print.

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, FileSignature, Loader2, ShieldAlert, XCircle } from 'lucide-react';
import { ApiError } from '../lib/api';
import {
  declineSignature,
  openSignatureSession,
  submitSignature,
  type SignatureDocument,
  type SignatureOutcome,
} from '../services/signatures';
import { SignaturePad } from '../components/signatures/SignaturePad';

type Phase = 'loading' | 'ready' | 'done' | 'gone' | 'invalid';

function money(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' })
    .format(cents / 100);
}

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

/**
 * Format an instant (`…T…Z`) in the reader's own timezone. Correct here in a
 * way [formatDocumentDate] is not: "I signed at this moment" is a point in
 * time, and the signer should see it on their own clock.
 */
function formatMoment(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale, {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function classify(err: unknown): 'gone' | 'invalid' {
  if (err instanceof ApiError && (err.status === 410 || err.code === 'SIGNATURE_LINK_GONE')) {
    return 'gone';
  }
  return 'invalid';
}

export function SignDocument() {
  const { token = '' } = useParams<{ token: string }>();
  const { t, i18n } = useTranslation('signatures');

  const [phase, setPhase] = useState<Phase>('loading');
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [doc, setDoc] = useState<SignatureDocument | null>(null);
  const [outcome, setOutcome] = useState<SignatureOutcome | null>(null);

  const [signerName, setSignerName] = useState('');
  const [signerTitle, setSignerTitle] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    openSignatureSession(token)
      .then(session => {
        if (cancelled) return;
        setSessionToken(session.sessionToken);
        setDoc(session.document);
        setPhase('ready');
      })
      .catch(err => {
        if (!cancelled) setPhase(classify(err));
      });
    return () => { cancelled = true; };
  }, [token]);

  const docDate = useCallback(
    (value: string) => formatDocumentDate(value, i18n.language),
    [i18n.language],
  );

  const canSubmit = Boolean(signerName.trim() && signerTitle.trim() && image) && !submitting;

  const handleSubmit = async () => {
    if (!sessionToken || !image || !canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await submitSignature(sessionToken, {
        signerName: signerName.trim(),
        signerTitle: signerTitle.trim(),
        signatureImage: image,
      });
      setOutcome(result);
      setPhase('done');
    } catch (err) {
      if (err instanceof ApiError && err.status === 410) setPhase('gone');
      else setError(t('errors.submit'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecline = async () => {
    if (!sessionToken) return;
    setDeclining(true);
    setError(null);
    try {
      const result = await declineSignature(sessionToken);
      setOutcome(result);
      setPhase('done');
    } catch (err) {
      if (err instanceof ApiError && err.status === 410) setPhase('gone');
      else setError(t('errors.decline'));
    } finally {
      setDeclining(false);
    }
  };

  // ── terminal / error states ────────────────────────────────────

  if (phase === 'loading') {
    return (
      <Shell>
        <div className="flex items-center justify-center gap-3 py-16 text-zinc-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      </Shell>
    );
  }

  if (phase === 'gone' || phase === 'invalid') {
    return (
      <Shell>
        <div className="py-12 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-amber-500" />
          <h1 className="mt-4 text-xl font-semibold text-zinc-900">
            {phase === 'gone' ? t('gone.title') : t('invalid.title')}
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600">
            {phase === 'gone' ? t('gone.body') : t('invalid.body')}
          </p>
        </div>
      </Shell>
    );
  }

  if (phase === 'done') {
    const declined = outcome?.status === 'DECLINED';
    return (
      <Shell>
        <div className="py-12 text-center">
          {declined
            ? <XCircle className="mx-auto h-12 w-12 text-zinc-400" />
            : <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />}
          <h1 className="mt-4 text-xl font-semibold text-zinc-900">
            {declined ? t('declined.title') : t('signed.title')}
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600">
            {declined ? t('declined.body') : t('signed.body')}
          </p>
          {!declined && outcome?.signedAt && (
            <dl className="mx-auto mt-6 max-w-sm space-y-1 rounded-lg bg-zinc-50 p-4 text-left text-sm">
              <Row label={t('signed.signer')} value={outcome.signerName ?? '—'} />
              <Row label={t('signed.title_field')} value={outcome.signerTitle ?? '—'} />
              <Row label={t('signed.at')} value={formatMoment(outcome.signedAt, i18n.language)} />
            </dl>
          )}
        </div>
      </Shell>
    );
  }

  // ── the document + the pad ─────────────────────────────────────

  if (!doc) return null;

  return (
    <Shell>
      <header className="border-b border-zinc-200 pb-4">
        <p className="text-sm text-zinc-500">{doc.companyName}</p>
        <h1 className="mt-1 flex items-center gap-2 text-xl font-semibold text-zinc-900">
          <FileSignature className="h-5 w-5 text-orange-500" />
          {t(doc.documentKind === 'CHANGE_ORDER_REQUEST' ? 'kind.changeOrder' : 'kind.invoice')}
          {' '}{doc.documentNumber}
        </h1>
        <p className="mt-1 text-sm text-zinc-600">{doc.projectName} · {doc.clientName}</p>
      </header>

      <section className="mt-6 space-y-4">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Row label={t('doc.issued')} value={docDate(doc.issuedDate)} />
          <Row label={t('doc.due')} value={docDate(doc.dueDate)} />
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
          <Row label={`${t('doc.tax')} (${doc.taxRate}%)`} value={money(doc.taxCents, doc.currency)} />
          <div className="flex justify-between border-t border-zinc-300 pt-1 font-semibold text-zinc-900">
            <dt>{t('doc.total')}</dt>
            <dd className="tabular-nums">{money(doc.totalCents, doc.currency)}</dd>
          </div>
        </dl>

        {doc.notes && (
          <p className="rounded-lg bg-zinc-50 p-3 text-sm text-zinc-600">{doc.notes}</p>
        )}
      </section>

      <section className="mt-8 border-t border-zinc-200 pt-6">
        <h2 className="text-base font-semibold text-zinc-900">{t('form.heading')}</h2>
        <p className="mt-1 text-sm text-zinc-600">{t('form.hint')}</p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-zinc-700">{t('form.name')}</span>
            <input
              type="text"
              value={signerName}
              onChange={e => setSignerName(e.target.value)}
              maxLength={80}
              disabled={submitting || declining}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
              placeholder={t('form.namePlaceholder')}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-zinc-700">{t('form.title')}</span>
            <input
              type="text"
              value={signerTitle}
              onChange={e => setSignerTitle(e.target.value)}
              maxLength={200}
              disabled={submitting || declining}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
              placeholder={t('form.titlePlaceholder')}
            />
          </label>
        </div>

        <div className="mt-4">
          <span className="text-sm font-medium text-zinc-700">{t('form.signature')}</span>
          <div className="mt-1">
            <SignaturePad onChange={setImage} disabled={submitting || declining} />
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('form.submit')}
          </button>
          <button
            type="button"
            onClick={handleDecline}
            disabled={submitting || declining}
            className="text-sm text-zinc-500 underline-offset-2 hover:text-zinc-800 hover:underline disabled:opacity-50"
          >
            {t('form.decline')}
          </button>
        </div>

        <p className="mt-6 border-t border-zinc-100 pt-4 text-xs text-zinc-400">
          {t('form.trailNote')}
          <br />
          <span className="font-mono">{doc.documentHash.slice(0, 16)}…</span>
        </p>
      </section>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-100 py-8">
      <main className="mx-auto w-full max-w-2xl rounded-xl bg-white p-6 shadow-sm sm:p-8">
        {children}
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="text-right font-medium text-zinc-800">{value}</dd>
    </div>
  );
}
