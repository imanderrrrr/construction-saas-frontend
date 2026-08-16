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
      className="fixed inset-0 z-50 overflow-y-auto bg-[#FAFAFA]"
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
          <section className="overflow-hidden rounded-xl border border-[#D4D4D8] bg-white">
            {/* Ink header: the moment the device changes hands is the whole
                point of the screen, so it gets the module's featured surface
                rather than a heading on white. */}
            <div className="bg-[#0A0A0A] p-6 text-[#F5F1E8] sm:p-7">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#F5F1E8]/50">
                {ticket.ticketNumber}
              </p>
              <h2 className="mt-2 flex items-center gap-2.5 text-xl font-bold sm:text-2xl">
                <ArrowRight className="h-6 w-6 shrink-0 text-[#F97316]" />
                {t('tm:handoff.title')}
              </h2>
              <p className="mt-2.5 text-sm leading-relaxed text-[#F5F1E8]/70">{t('tm:handoff.intro')}</p>
            </div>

            <div className="p-6 sm:p-7">
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-[#D4D4D8] bg-[#FAFAFA] p-3">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#71717A]">
                    {t('tm:handoff.ticket')}
                  </dt>
                  <dd className="mt-1 font-mono text-sm font-semibold text-[#0A0A0A]">{ticket.ticketNumber}</dd>
                </div>
                <div className="rounded-lg border border-[#D4D4D8] bg-[#FAFAFA] p-3">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#71717A]">
                    {t('tm:list.project')}
                  </dt>
                  <dd className="mt-1 truncate text-sm font-semibold text-[#0A0A0A]">{ticket.projectName}</dd>
                </div>
              </dl>

              <p className="mt-4 flex items-start gap-2 rounded-lg border border-[#D4D4D8] bg-[#FAFAFA] p-3 text-xs leading-relaxed text-[#71717A]">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {t('tm:handoff.lockNote')}
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void openSession()}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#F97316] px-5 py-2.5 text-sm font-semibold text-[#0A0A0A] transition-colors hover:bg-[#EA580C]"
                >
                  <ArrowRight className="h-4 w-4" />
                  {t('tm:handoff.start')}
                </button>
                <button
                  type="button"
                  onClick={onCancel}
                  className="rounded-lg px-2 py-2.5 text-sm font-medium text-[#71717A] transition-colors hover:text-[#0A0A0A]"
                >
                  {t('tm:handoff.cancel')}
                </button>
              </div>
            </div>
          </section>
        )}

        {step === 'opening' && (
          <div className="flex items-center justify-center gap-3 rounded-xl border border-[#D4D4D8] bg-white py-24 text-sm text-[#71717A]">
            <Loader2 className="h-5 w-5 animate-spin" />
            {t('signatures:loading')}
          </div>
        )}

        {step === 'failed' && (
          <section className="rounded-xl border border-[#D4D4D8] bg-white p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-50">
              <ShieldAlert className="h-7 w-7 text-amber-600" />
            </div>
            <h2 className="mt-4 text-lg font-bold text-[#0A0A0A]">{t('tm:handoff.failedTitle')}</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[#71717A]">
              {t('tm:handoff.failedBody')}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => void openSession()}
                className="rounded-lg bg-[#F97316] px-4 py-2.5 text-sm font-semibold text-[#0A0A0A] transition-colors hover:bg-[#EA580C]"
              >
                {t('tm:handoff.retry')}
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="rounded-lg px-2 py-2.5 text-sm font-medium text-[#71717A] transition-colors hover:text-[#0A0A0A]"
              >
                {t('tm:handoff.cancel')}
              </button>
            </div>
          </section>
        )}

        {step === 'signing' && doc && (
          <section className="overflow-hidden rounded-xl border border-[#D4D4D8] bg-white">
            {/* The document itself is `SignatureDocumentView`, shared with the
                emailed-link page and with client invoices. It is deliberately
                left alone — what the signer puts their name to must not depend
                on which surface opened it. Only the frame around it is ours. */}
            <div className="p-6 sm:p-8">
              <SignatureDocumentView doc={doc} />
            </div>

            <section className="border-t border-[#D4D4D8] bg-[#FAFAFA] p-6 sm:p-8">
              <h2 className="text-base font-bold text-[#0A0A0A]">{t('signatures:form.heading')}</h2>
              <p className="mt-1 text-sm text-[#71717A]">{t('signatures:form.hint')}</p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#71717A]">
                  {t('signatures:form.name')}
                  <input
                    type="text"
                    value={signerName}
                    onChange={e => setSignerName(e.target.value)}
                    maxLength={FIELD_LIMITS.PERSON_NAME}
                    disabled={busy}
                    placeholder={t('signatures:form.namePlaceholder')}
                    className="mt-1.5 h-10 w-full rounded-lg border border-[#D4D4D8] bg-white px-3 text-sm font-normal normal-case tracking-normal text-[#0A0A0A] transition-colors focus:border-[#F97316] focus:outline-none focus:ring-2 focus:ring-[#F97316]/25 disabled:opacity-50"
                  />
                </label>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#71717A]">
                  {t('signatures:form.title')}
                  <input
                    type="text"
                    value={signerTitle}
                    onChange={e => setSignerTitle(e.target.value)}
                    maxLength={FIELD_LIMITS.SHORT_NAME}
                    disabled={busy}
                    placeholder={t('signatures:form.titlePlaceholder')}
                    className="mt-1.5 h-10 w-full rounded-lg border border-[#D4D4D8] bg-white px-3 text-sm font-normal normal-case tracking-normal text-[#0A0A0A] transition-colors focus:border-[#F97316] focus:outline-none focus:ring-2 focus:ring-[#F97316]/25 disabled:opacity-50"
                  />
                </label>
              </div>

              <div className="mt-4">
                <span className="block text-[11px] font-semibold uppercase tracking-wide text-[#71717A]">
                  {t('signatures:form.signature')}
                </span>
                <div className="mt-1.5">
                  <SignaturePad onChange={setImage} disabled={busy} />
                </div>
              </div>

              {error && (
                <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </p>
              )}

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void sign()}
                  disabled={!canSubmit}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#F97316] px-5 py-3 text-sm font-semibold text-[#0A0A0A] transition-colors hover:bg-[#EA580C] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t('signatures:form.submit')}
                </button>
                <button
                  type="button"
                  onClick={() => void refuse()}
                  disabled={busy}
                  className="rounded-lg px-2 py-3 text-sm font-medium text-[#71717A] underline-offset-2 transition-colors hover:text-[#0A0A0A] hover:underline disabled:opacity-40"
                >
                  {t('signatures:form.decline')}
                </button>
              </div>

              <p className="mt-6 border-t border-[#D4D4D8] pt-4 text-xs leading-relaxed text-[#A1A1AA]">
                {t('signatures:form.trailNote')}
                <br />
                <span className="font-mono">{doc.documentHash.slice(0, 16)}…</span>
              </p>

              {/* The way out for the encargado if the super walks off. Behind a
                  confirmation so it is not an accidental tap by someone who is
                  not supposed to end up in our panel. */}
              <div className="mt-4 border-t border-[#D4D4D8] pt-4">
                {confirmingAbort ? (
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <span className="text-[#3F3F46]">{t('tm:handoff.abortConfirm')}</span>
                    <button
                      type="button"
                      onClick={onCancel}
                      className="font-semibold text-red-600 hover:underline"
                    >
                      {t('tm:handoff.abortYes')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingAbort(false)}
                      className="font-medium text-[#71717A] transition-colors hover:text-[#0A0A0A]"
                    >
                      {t('tm:handoff.abortNo')}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingAbort(true)}
                    className="text-xs font-medium text-[#A1A1AA] transition-colors hover:text-[#71717A]"
                  >
                    {t('tm:handoff.abort')}
                  </button>
                )}
              </div>
            </section>
          </section>
        )}

        {step === 'done' && (
          <section className="overflow-hidden rounded-xl border border-[#D4D4D8] bg-white p-8 text-center sm:p-10">
            {outcome?.status === 'DECLINED' ? (
              <>
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
                  <XCircle className="h-8 w-8 text-red-500" />
                </div>
                <h2 className="mt-4 text-xl font-bold text-[#0A0A0A]">{t('signatures:declined.title')}</h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[#71717A]">
                  {t('tm:handoff.declinedBody')}
                </p>
              </>
            ) : (
              <>
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                </div>
                <h2 className="mt-4 text-xl font-bold text-[#0A0A0A]">{t('signatures:signed.title')}</h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[#71717A]">
                  {t('tm:handoff.signedBody')}
                </p>
                {outcome?.signerName && (
                  <p className="mx-auto mt-4 inline-block rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900">
                    {t('tm:signature.signedBy', {
                      name: outcome.signerName,
                      title: outcome.signerTitle ?? '',
                    })}
                  </p>
                )}
              </>
            )}

            <div className="mt-7">
              <button
                type="button"
                onClick={finish}
                className="rounded-lg bg-[#0A0A0A] px-5 py-3 text-sm font-semibold text-[#F5F1E8] transition-colors hover:bg-[#F97316] hover:text-[#0A0A0A]"
              >
                {t('tm:handoff.return')}
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
