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
//
// The look is the panel's, not a page of its own: the sand sheet with the
// blueprint grid that the on-site handoff (tm/TmSignatureHandoff) changes the
// screen to, the white card with the sand border every window wears, mono
// labels, the ink primary button. The signer almost always holds a phone, so
// the card runs edge to edge at 375px and the one action spans the width.

import { useEffect, useId, useState } from 'react';
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
import { cn } from '../components/ui/utils';
import { FOCUS_RING } from '../components/onboarding/chrome';
import { FieldLabel, INPUT, Mono, PaperNote } from '../components/projects/bt';
import { SignaturePad } from '../components/signatures/SignaturePad';
import { Row, SignatureDocumentView } from '../components/signatures/SignatureDocumentView';

type Phase = 'loading' | 'ready' | 'done' | 'gone' | 'invalid';

// The document itself is rendered by `SignatureDocumentView`, shared with the
// on-site handoff so both surfaces show a signer the identical paper.
// Re-exported because this module was its original home and tests import it here.
export { formatDocumentDate } from '../components/signatures/SignatureDocumentView';

/** The blueprint grid drawn in ink on the sand page behind the card. */
const GRID_SAND: React.CSSProperties = {
  backgroundImage:
    'linear-gradient(rgba(11,10,9,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(11,10,9,0.035) 1px, transparent 1px)',
  backgroundSize: '26px 26px',
};

/* The handoff's buttons: ink that turns orange for the one action, a mono
   ghost for the way out. */
const BTN_PRIMARY = 'inline-flex items-center justify-center gap-2 bg-[#0A0A0A] hover:bg-[#F97316] text-[#F5F1E8] hover:text-[#0A0A0A] font-bt-mono text-[11px] font-semibold uppercase tracking-[0.08em] px-5 py-3 min-h-11 transition-colors disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-[#0A0A0A] disabled:hover:text-[#F5F1E8]';
const BTN_GHOST = 'font-bt-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#8A8175] hover:text-[#0A0A0A] transition-colors disabled:opacity-40';

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
  const nameId = useId();
  const titleId = useId();
  const formId = useId();

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
        <div className="flex items-center justify-center gap-3 py-24" role="status" aria-busy="true">
          <Loader2 className="h-4 w-4 animate-spin text-[#8A8175]" />
          <Mono className="text-[10.5px] tracking-[0.1em] text-[#8A8175]">{t('loading')}</Mono>
        </div>
      </Shell>
    );
  }

  if (phase === 'gone' || phase === 'invalid') {
    return (
      <Shell>
        <Outcome
          icon={<ShieldAlert className="h-5 w-5 text-[#F97316]" strokeWidth={1.9} />}
          title={phase === 'gone' ? t('gone.title') : t('invalid.title')}
          body={phase === 'gone' ? t('gone.body') : t('invalid.body')}
        />
      </Shell>
    );
  }

  if (phase === 'done') {
    const declined = outcome?.status === 'DECLINED';
    return (
      <Shell>
        <Outcome
          icon={declined
            ? <XCircle className="h-5 w-5 text-[#CDBFA6]" strokeWidth={1.9} />
            : <CheckCircle2 className="h-5 w-5 text-[#F97316]" strokeWidth={1.9} />}
          title={declined ? t('declined.title') : t('signed.title')}
          body={declined ? t('declined.body') : t('signed.body')}
        >
          {!declined && outcome?.signedAt && (
            <dl className="mx-auto mt-6 max-w-sm space-y-2 bg-[#F3EEE4] px-4 py-3 text-left text-sm">
              <Row label={t('signed.signer')} value={outcome.signerName ?? '—'} />
              <Row label={t('signed.title_field')} value={outcome.signerTitle ?? '—'} />
              <Row label={t('signed.at')} value={formatMoment(outcome.signedAt, i18n.language)} />
            </dl>
          )}
        </Outcome>
      </Shell>
    );
  }

  // ── the document + the pad ─────────────────────────────────────

  if (!doc) return null;

  return (
    <Shell>
      <div className="p-5 sm:p-8">
        <SignatureDocumentView doc={doc} />
      </div>

      <section className="border-t border-[#E7E1D5] bg-[#FBF8F2] p-5 sm:p-8" aria-labelledby={formId}>
        <h2 id={formId} className="font-bt-heading text-base font-bold text-[#0A0A0A]">{t('form.heading')}</h2>
        <p className="mt-1 text-sm leading-relaxed text-[#5A5346]">{t('form.hint')}</p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor={nameId}>{t('form.name')}</FieldLabel>
            <input
              id={nameId}
              type="text"
              value={signerName}
              onChange={e => setSignerName(e.target.value)}
              maxLength={80}
              disabled={submitting || declining}
              className={INPUT}
              placeholder={t('form.namePlaceholder')}
            />
          </div>
          <div>
            <FieldLabel htmlFor={titleId}>{t('form.title')}</FieldLabel>
            <input
              id={titleId}
              type="text"
              value={signerTitle}
              onChange={e => setSignerTitle(e.target.value)}
              maxLength={200}
              disabled={submitting || declining}
              className={INPUT}
              placeholder={t('form.titlePlaceholder')}
            />
          </div>
        </div>

        <div className="mt-4">
          <Mono className="block text-[10px] font-semibold tracking-[0.12em] text-[#5A5346] mb-1.5">
            {t('form.signature')}
          </Mono>
          <SignaturePad onChange={setImage} disabled={submitting || declining} />
        </div>

        {error && (
          <div role="alert">
            <PaperNote tone="red" className="mt-3 text-[13px]">{error}</PaperNote>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={cn(BTN_PRIMARY, 'w-full sm:w-auto', FOCUS_RING)}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('form.submit')}
          </button>
          <button
            type="button"
            onClick={handleDecline}
            disabled={submitting || declining}
            className={cn(BTN_GHOST, 'px-2 py-3 underline-offset-2 hover:underline', FOCUS_RING)}
          >
            {t('form.decline')}
          </button>
        </div>

        <p className="mt-6 border-t border-[#EDE7DB] pt-4 text-xs leading-relaxed text-[#A69C8D]">
          {t('form.trailNote')}
          <br />
          <span className="font-bt-mono">{doc.documentHash.slice(0, 16)}…</span>
        </p>
      </section>
    </Shell>
  );
}

/** The sand sheet and the card on it. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-[#F3EEE4]">
      <div className="absolute inset-0 pointer-events-none" style={GRID_SAND} aria-hidden="true" />
      <main className="relative mx-auto w-full max-w-2xl px-4 py-5 sm:px-8 sm:py-10">
        <div className="bg-white border border-[#CDBFA6]">{children}</div>
      </main>
    </div>
  );
}

/** A terminal state: the mark in an ink square, a display title, one line. */
function Outcome({ icon, title, body, children }: {
  icon: React.ReactNode;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="px-6 py-12 text-center sm:px-8 sm:py-14">
      <span className="mx-auto flex h-11 w-11 items-center justify-center bg-[#0A0A0A]" aria-hidden="true">
        {icon}
      </span>
      <h1 className="mt-5 font-bt-display text-[32px] font-extrabold uppercase leading-[0.95] tracking-[0.01em] text-[#0A0A0A] sm:text-[38px]">
        {title}
      </h1>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[#5A5346]">{body}</p>
      {children}
    </div>
  );
}
