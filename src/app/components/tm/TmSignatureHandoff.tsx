// BuildTrack — Handing the phone to the client's superintendent, on site.
//
// ## The problem this solves
//
// Every other signature in this system travels by email: we mint a link, the
// signer opens it wherever they are, they sign. A T&M sheet is different, and
// the client said so plainly — *"esa firma se ocupa estando en el trabajo"*.
// The person who has to sign is standing next to the person who captured the
// work, and the only screen within reach is the encargado's phone, which is
// logged into our panel.
//
// ## Why an in-app overlay and not the obvious alternatives
//
// The backend mints exactly one thing: a link token. So the options were:
//
//  1. **Navigate this tab to `/sign/<token>`.** Rejected: the client's super
//     ends up one Back tap away from the encargado's authenticated session,
//     holding the phone. The route change also unmounts the panel, so
//     "carry on working afterwards" becomes "find your place again".
//  2. **Open the link in a new tab.** Rejected for the same reason plus worse:
//     on a phone the previous tab is one gesture away, and popup blockers make
//     the primary path unreliable.
//  3. **This: a full-screen overlay, in the same route, running the same public
//     signing session the emailed link would have opened.** The panel never
//     unmounts, so the encargado's session is untouched and still theirs when
//     the super hands the phone back. Navigation is refused while the overlay
//     is up, so Back does not drop the visitor into our panel.
//
// The signer's credentials are a short-lived session token held only in this
// component's state — NOT the encargado's cookie. The signature is attributed
// to the link token exactly as it would be from an emailed link, so the
// evidence trail does not care which way the document was opened.
//
// The emailed/shared link stays available as the alternative the client also
// asked for (*"o se les puede mandar un link… o como sea"*) — that is the
// "copy link" action on the ticket, not this component.
//
// ## What is deliberately NOT here
//
// No new signature pad. `SignaturePad` and the document renderer come from the
// signatures phase, unchanged; this file is the transfer-of-device wrapper
// around them and nothing else.

import { useEffect, useRef, useState } from 'react';
import { useBlocker } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowRight, CheckCircle2, Loader2, Lock, ShieldAlert, XCircle } from 'lucide-react';
import { SignaturePad } from '../signatures/SignaturePad';
import { SignatureDocumentView } from '../signatures/SignatureDocumentView';
import {
  declineSignature,
  openSignatureSession,
  submitSignature,
  type SignatureDocument,
  type SignatureOutcome,
} from '../../services/signatures';
import { signTokenFromUrl, type TmTicket } from '../../services/tm';
import { FIELD_LIMITS } from '../../../shared/fieldLimits';

type Step = 'handoff' | 'opening' | 'signing' | 'done' | 'failed';

interface Props {
  ticket: TmTicket;
  /** Closed after a signature or a refusal — the caller refetches the ticket. */
  onFinished: (outcome: SignatureOutcome) => void;
  /** Closed without either. The ticket is untouched and still PENDING. */
  onCancel: () => void;
}

export function TmSignatureHandoff({ ticket, onFinished, onCancel }: Props) {
  const { t } = useTranslation(['tm', 'signatures']);

  const [step, setStep] = useState<Step>('handoff');
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [doc, setDoc] = useState<SignatureDocument | null>(null);
  const [outcome, setOutcome] = useState<SignatureOutcome | null>(null);

  const [signerName, setSignerName] = useState('');
  const [signerTitle, setSignerTitle] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingAbort, setConfirmingAbort] = useState(false);

  const dialogRef = useRef<HTMLDivElement | null>(null);

  /**
   * While a stranger is holding the phone, refuse to navigate.
   *
   * This is the part that makes the overlay different from just opening the
   * signing page: Back, a stray link, anything that would move the router lands
   * on `reset()` and nothing happens. It is not a security boundary — a browser
   * cannot be locked down from inside a page — it is the difference between
   * "cannot wander into our panel by accident" and "one tap away from it".
   */
  const locked = step === 'opening' || step === 'signing' || step === 'done';
  const blocker = useBlocker(locked);

  useEffect(() => {
    if (blocker.state === 'blocked') blocker.reset();
  }, [blocker]);

  useEffect(() => {
    if (!locked) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [locked]);

  // Focus moves into the overlay so a keyboard/screen-reader user is not left
  // behind in the panel underneath.
  useEffect(() => { dialogRef.current?.focus(); }, [step]);

  const openSession = async () => {
    const token = signTokenFromUrl(ticket.signUrl);
    if (!token) {
      setStep('failed');
      return;
    }
    setStep('opening');
    setError(null);
    try {
      const session = await openSignatureSession(token);
      setSessionToken(session.sessionToken);
      setDoc(session.document);
      setStep('signing');
    } catch {
      setStep('failed');
    }
  };

  const canSubmit = Boolean(signerName.trim() && signerTitle.trim() && image) && !busy;

  const sign = async () => {
    if (!sessionToken || !image || !canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const result = await submitSignature(sessionToken, {
        signerName: signerName.trim(),
        signerTitle: signerTitle.trim(),
        signatureImage: image,
      });
      setOutcome(result);
      setStep('done');
    } catch {
      setError(t('signatures:errors.submit'));
    } finally {
      setBusy(false);
    }
  };

  const refuse = async () => {
    if (!sessionToken) return;
    setBusy(true);
    setError(null);
    try {
      const result = await declineSignature(sessionToken);
      setOutcome(result);
      setStep('done');
    } catch {
      setError(t('signatures:errors.decline'));
    } finally {
      setBusy(false);
    }
  };

  const finish = () => {
    if (outcome) onFinished(outcome);
    else onCancel();
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-zinc-100"
      role="dialog"
      aria-modal="true"
      aria-label={t('tm:handoff.title')}
      data-testid="tm-handoff"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="mx-auto w-full max-w-2xl p-4 outline-none sm:p-8"
      >
        {step === 'handoff' && (
          <section className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-900">
              <ArrowRight className="h-5 w-5 text-orange-500" />
              {t('tm:handoff.title')}
            </h2>
            <p className="mt-2 text-sm text-zinc-600">{t('tm:handoff.intro')}</p>

            <dl className="mt-4 space-y-1 rounded-lg bg-zinc-50 p-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">{t('tm:handoff.ticket')}</dt>
                <dd className="font-medium text-zinc-800">{ticket.ticketNumber}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">{t('tm:list.project')}</dt>
                <dd className="font-medium text-zinc-800">{ticket.projectName}</dd>
              </div>
            </dl>

            <p className="mt-4 flex items-start gap-2 text-xs text-zinc-500">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {t('tm:handoff.lockNote')}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void openSession()}
                className="rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
              >
                {t('tm:handoff.start')}
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="text-sm text-zinc-500 hover:text-zinc-800"
              >
                {t('tm:handoff.cancel')}
              </button>
            </div>
          </section>
        )}

        {step === 'opening' && (
          <div className="flex items-center justify-center gap-3 py-24 text-zinc-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            {t('signatures:loading')}
          </div>
        )}

        {step === 'failed' && (
          <section className="rounded-xl bg-white p-6 text-center shadow-sm">
            <ShieldAlert className="mx-auto h-12 w-12 text-amber-500" />
            <h2 className="mt-4 text-lg font-semibold text-zinc-900">{t('tm:handoff.failedTitle')}</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600">{t('tm:handoff.failedBody')}</p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => void openSession()}
                className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
              >
                {t('tm:handoff.retry')}
              </button>
              <button type="button" onClick={onCancel} className="text-sm text-zinc-500 hover:text-zinc-800">
                {t('tm:handoff.cancel')}
              </button>
            </div>
          </section>
        )}

        {step === 'signing' && doc && (
          <section className="rounded-xl bg-white p-6 shadow-sm sm:p-8">
            <SignatureDocumentView doc={doc} />

            <section className="mt-8 border-t border-zinc-200 pt-6">
              <h2 className="text-base font-semibold text-zinc-900">{t('signatures:form.heading')}</h2>
              <p className="mt-1 text-sm text-zinc-600">{t('signatures:form.hint')}</p>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-zinc-700">{t('signatures:form.name')}</span>
                  <input
                    type="text"
                    value={signerName}
                    onChange={e => setSignerName(e.target.value)}
                    maxLength={FIELD_LIMITS.PERSON_NAME}
                    disabled={busy}
                    placeholder={t('signatures:form.namePlaceholder')}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-zinc-700">{t('signatures:form.title')}</span>
                  <input
                    type="text"
                    value={signerTitle}
                    onChange={e => setSignerTitle(e.target.value)}
                    maxLength={FIELD_LIMITS.SHORT_NAME}
                    disabled={busy}
                    placeholder={t('signatures:form.titlePlaceholder')}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                  />
                </label>
              </div>

              <div className="mt-4">
                <span className="text-sm font-medium text-zinc-700">{t('signatures:form.signature')}</span>
                <div className="mt-1">
                  <SignaturePad onChange={setImage} disabled={busy} />
                </div>
              </div>

              {error && (
                <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
              )}

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void sign()}
                  disabled={!canSubmit}
                  className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t('signatures:form.submit')}
                </button>
                <button
                  type="button"
                  onClick={() => void refuse()}
                  disabled={busy}
                  className="text-sm text-zinc-500 underline-offset-2 hover:text-zinc-800 hover:underline disabled:opacity-50"
                >
                  {t('signatures:form.decline')}
                </button>
              </div>

              <p className="mt-6 border-t border-zinc-100 pt-4 text-xs text-zinc-400">
                {t('signatures:form.trailNote')}
                <br />
                <span className="font-mono">{doc.documentHash.slice(0, 16)}…</span>
              </p>
            </section>

            {/* The way out for the encargado if the super walks off. Behind a
                confirmation so it is not an accidental tap by someone who is
                not supposed to end up in our panel. */}
            <div className="mt-6 border-t border-zinc-100 pt-4">
              {confirmingAbort ? (
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="text-zinc-600">{t('tm:handoff.abortConfirm')}</span>
                  <button type="button" onClick={onCancel} className="font-medium text-red-600 hover:underline">
                    {t('tm:handoff.abortYes')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingAbort(false)}
                    className="text-zinc-500 hover:text-zinc-800"
                  >
                    {t('tm:handoff.abortNo')}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingAbort(true)}
                  className="text-xs text-zinc-400 hover:text-zinc-600"
                >
                  {t('tm:handoff.abort')}
                </button>
              )}
            </div>
          </section>
        )}

        {step === 'done' && (
          <section className="rounded-xl bg-white p-6 text-center shadow-sm sm:p-8">
            {outcome?.status === 'DECLINED' ? (
              <>
                <XCircle className="mx-auto h-12 w-12 text-zinc-400" />
                <h2 className="mt-4 text-lg font-semibold text-zinc-900">{t('signatures:declined.title')}</h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600">{t('tm:handoff.declinedBody')}</p>
              </>
            ) : (
              <>
                <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
                <h2 className="mt-4 text-lg font-semibold text-zinc-900">{t('signatures:signed.title')}</h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600">{t('tm:handoff.signedBody')}</p>
                {outcome?.signerName && (
                  <p className="mt-4 text-sm text-zinc-700">
                    {t('tm:signature.signedBy', {
                      name: outcome.signerName,
                      title: outcome.signerTitle ?? '',
                    })}
                  </p>
                )}
              </>
            )}

            <button
              type="button"
              onClick={finish}
              className="mt-6 rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700"
            >
              {t('tm:handoff.return')}
            </button>
          </section>
        )}
      </div>
    </div>
  );
}
