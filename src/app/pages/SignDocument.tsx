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

import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Loader2, ShieldAlert, XCircle } from 'lucide-react';
import { ApiError } from '../lib/api';
import {
  declineSignature,
  openSignatureSession,
  submitSignature,
  type SignatureDocument,
  type SignatureOutcome,
} from '../services/signatures';
import { SignaturePad } from '../components/signatures/SignaturePad';
import { Row, SignatureDocumentView } from '../components/signatures/SignatureDocumentView';

type Phase = 'loading' | 'ready' | 'done' | 'gone' | 'invalid';

// The document itself is rendered by `SignatureDocumentView`, shared with the
// on-site handoff so both surfaces show a signer the identical paper.
// Re-exported because this module was its original home and tests import it here.
export { formatDocumentDate } from '../components/signatures/SignatureDocumentView';

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
      <SignatureDocumentView doc={doc} />

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

