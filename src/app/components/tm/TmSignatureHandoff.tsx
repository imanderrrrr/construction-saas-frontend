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
//
// The overlay wears the panel's sand surface with the grid texture — the whole
// screen changes material while the device is out of the encargado's hands,
// which is the visual way of saying "this is not your panel right now".

import { useEffect, useRef, useState } from 'react';
import { useBlocker } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Loader2, Lock } from 'lucide-react';
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

function Mono({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <span className={`font-bt-mono uppercase tracking-[0.1em] ${className}`}>{children}</span>;
}

/** Subtle grid on ink surfaces — same texture as the Suscripción hero. */
const GRID_INK: React.CSSProperties = {
  backgroundImage:
    'linear-gradient(rgba(245,241,232,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(245,241,232,0.055) 1px, transparent 1px)',
  backgroundSize: '24px 24px',
};

/** The same grid drawn in ink on the sand page behind the card. */
const GRID_SAND: React.CSSProperties = {
  backgroundImage:
    'linear-gradient(rgba(11,10,9,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(11,10,9,0.035) 1px, transparent 1px)',
  backgroundSize: '26px 26px',
};

const BTN_PRIMARY = 'inline-flex items-center gap-2 bg-[#0A0A0A] hover:bg-[#F97316] text-[#F5F1E8] hover:text-[#0A0A0A] font-bt-mono text-[11px] font-semibold uppercase tracking-[0.08em] px-5 py-3 transition-colors disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-[#0A0A0A] disabled:hover:text-[#F5F1E8]';
const BTN_SECONDARY = 'inline-flex items-center gap-2 border border-[#DBD0BB] bg-[#FAF7F0] px-3.5 py-2.5 font-bt-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#0A0A0A] hover:border-[#F97316] hover:text-[#C2410C] transition-colors';
const BTN_GHOST = 'font-bt-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#8A8175] hover:text-[#0A0A0A] transition-colors disabled:opacity-40';

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

  const declined = outcome?.status === 'DECLINED';

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-[#F3EEE4]"
      role="dialog"
      aria-modal="true"
      aria-label={t('tm:handoff.title')}
      data-testid="tm-handoff"
    >
      <div className="absolute inset-0 pointer-events-none" style={GRID_SAND} />
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative mx-auto w-full max-w-2xl p-4 outline-none sm:p-8"
      >
        {step === 'handoff' && (
          <section className="bg-white border border-[#CDBFA6]">
            {/* Ink header: the moment the device changes hands is the whole
                point of the screen, so it gets the module's featured surface
                rather than a heading on white. */}
            <div className="relative overflow-hidden bg-[#0A0A0A] p-6 text-[#F5F1E8] sm:p-7">
              <div className="absolute inset-0 pointer-events-none" style={GRID_INK} />
              <div className="relative">
                <Mono className="text-[11px] tracking-[0.15em] text-[#F5F1E8]/50">
                  {t('tm:kicker.handoff')} · {ticket.ticketNumber}
                </Mono>
                <h2 className="font-bt-display font-bold uppercase text-3xl sm:text-4xl leading-[0.95] mt-2">
                  {t('tm:handoff.title')}
                </h2>
                <p className="mt-2.5 text-[13px] leading-relaxed text-[#F5F1E8]/70">{t('tm:handoff.intro')}</p>
              </div>
            </div>

            <div className="p-6 sm:p-7">
              <dl className="grid grid-cols-1 sm:grid-cols-2 border border-[#E4E4E7]">
                <div className="p-3 sm:border-r border-b sm:border-b-0 border-[#EDE7DB]">
                  <dt><Mono className="text-[10px] text-[#8A8175]">{t('tm:handoff.ticket')}</Mono></dt>
                  <dd className="mt-1.5 font-bt-mono text-sm font-semibold text-[#0A0A0A]">{ticket.ticketNumber}</dd>
                </div>
                <div className="p-3">
                  <dt><Mono className="text-[10px] text-[#8A8175]">{t('tm:list.project')}</Mono></dt>
                  <dd className="mt-1.5 truncate text-sm font-semibold text-[#0A0A0A]">{ticket.projectName}</dd>
                </div>
              </dl>

              <p className="mt-4 flex items-start gap-2.5 bg-[#FAF7F0] border border-[#DBD0BB] p-3 text-xs leading-relaxed text-[#5A5346]">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {t('tm:handoff.lockNote')}
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void openSession()}
                  className={BTN_PRIMARY}
                >
                  <ArrowRight className="h-4 w-4" />
                  {t('tm:handoff.start')}
                </button>
                <button
                  type="button"
                  onClick={onCancel}
                  className={`${BTN_GHOST} px-2 py-3`}
                >
                  {t('tm:handoff.cancel')}
                </button>
              </div>
            </div>
          </section>
        )}

        {step === 'opening' && (
          <div className="flex items-center justify-center gap-3 bg-white border border-[#CDBFA6] py-24">
            <Loader2 className="h-4 w-4 animate-spin text-[#8A8175]" />
            <Mono className="text-[10.5px] text-[#8A8175]">{t('signatures:loading')}</Mono>
          </div>
        )}

        {step === 'failed' && (
          <section className="bg-white border border-[#CDBFA6] px-8 py-14 text-center">
            <p className="font-bt-heading font-bold text-lg text-[#0A0A0A]">{t('tm:handoff.failedTitle')}</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[#71717A]">
              {t('tm:handoff.failedBody')}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => void openSession()}
                className={BTN_SECONDARY}
              >
                {t('tm:handoff.retry')}
              </button>
              <button
                type="button"
                onClick={onCancel}
                className={`${BTN_GHOST} px-2 py-2.5`}
              >
                {t('tm:handoff.cancel')}
              </button>
            </div>
          </section>
        )}

        {step === 'signing' && doc && (
          <section className="bg-white border border-[#CDBFA6]">
            {/* The document itself is `SignatureDocumentView`, shared with the
                emailed-link page and with client invoices. It is deliberately
                left alone — what the signer puts their name to must not depend
                on which surface opened it. Only the frame around it is ours. */}
            <div className="p-6 sm:p-8">
              <SignatureDocumentView doc={doc} />
            </div>

            <section className="border-t border-[#E4E4E7] bg-[#FBF8F2] p-6 sm:p-8">
              <h2 className="font-bt-heading font-bold text-base text-[#0A0A0A]">{t('signatures:form.heading')}</h2>
              <p className="mt-1 text-sm text-[#71717A]">{t('signatures:form.hint')}</p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="block font-bt-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-[#5A5346]">
                  {t('signatures:form.name')}
                  <input
                    type="text"
                    value={signerName}
                    onChange={e => setSignerName(e.target.value)}
                    maxLength={FIELD_LIMITS.PERSON_NAME}
                    disabled={busy}
                    placeholder={t('signatures:form.namePlaceholder')}
                    className="mt-1.5 h-10 w-full border border-[#DBD0BB] bg-white px-3 font-sans text-sm font-normal normal-case tracking-normal text-[#0A0A0A] transition-colors focus:border-[#F97316] outline-none disabled:opacity-50"
                  />
                </label>
                <label className="block font-bt-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-[#5A5346]">
                  {t('signatures:form.title')}
                  <input
                    type="text"
                    value={signerTitle}
                    onChange={e => setSignerTitle(e.target.value)}
                    maxLength={FIELD_LIMITS.SHORT_NAME}
                    disabled={busy}
                    placeholder={t('signatures:form.titlePlaceholder')}
                    className="mt-1.5 h-10 w-full border border-[#DBD0BB] bg-white px-3 font-sans text-sm font-normal normal-case tracking-normal text-[#0A0A0A] transition-colors focus:border-[#F97316] outline-none disabled:opacity-50"
                  />
                </label>
              </div>

              <div className="mt-4">
                <Mono className="block text-[10px] font-semibold text-[#5A5346]">
                  {t('signatures:form.signature')}
                </Mono>
                <div className="mt-1.5">
                  <SignaturePad onChange={setImage} disabled={busy} />
                </div>
              </div>

              {error && (
                <p role="alert" className="mt-3 flex gap-2.5 items-center bg-[#FBEDE0] border border-[#F6CFA6] border-l-[3px] border-l-[#F97316] px-3 py-2.5 text-[13px] text-[#43301F]">
                  {error}
                </p>
              )}

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void sign()}
                  disabled={!canSubmit}
                  className={BTN_PRIMARY}
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t('signatures:form.submit')}
                </button>
                <button
                  type="button"
                  onClick={() => void refuse()}
                  disabled={busy}
                  className={`${BTN_GHOST} px-2 py-3 underline-offset-2 hover:underline`}
                >
                  {t('signatures:form.decline')}
                </button>
              </div>

              <p className="mt-6 border-t border-[#EDE7DB] pt-4 text-xs leading-relaxed text-[#A69C8D]">
                {t('signatures:form.trailNote')}
                <br />
                <span className="font-bt-mono">{doc.documentHash.slice(0, 16)}…</span>
              </p>

              {/* The way out for the encargado if the super walks off. Behind a
                  confirmation so it is not an accidental tap by someone who is
                  not supposed to end up in our panel. */}
              <div className="mt-4 border-t border-[#EDE7DB] pt-4">
                {confirmingAbort ? (
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <span className="text-[#3F3F46]">{t('tm:handoff.abortConfirm')}</span>
                    <button
                      type="button"
                      onClick={onCancel}
                      className="font-bt-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#C2410C] hover:underline"
                    >
                      {t('tm:handoff.abortYes')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingAbort(false)}
                      className={BTN_GHOST}
                    >
                      {t('tm:handoff.abortNo')}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingAbort(true)}
                    className="font-bt-mono text-[10px] uppercase tracking-[0.08em] text-[#A69C8D] transition-colors hover:text-[#5A5346]"
                  >
                    {t('tm:handoff.abort')}
                  </button>
                )}
              </div>
            </section>
          </section>
        )}

        {step === 'done' && (
          <section className="bg-white border border-[#CDBFA6] p-8 text-center sm:p-10">
            {/* The outcome as the panel says it: a display word in sand, not a
                green tick or a red cross. */}
            <div className="font-bt-display font-bold uppercase text-5xl sm:text-6xl leading-none text-[#CDBFA6]">
              {declined ? t('tm:handoff.doneBigDeclined') : t('tm:handoff.doneBigSigned')}
            </div>
            <h2 className="font-bt-heading font-bold text-lg text-[#0A0A0A] mt-3">
              {declined ? t('signatures:declined.title') : t('signatures:signed.title')}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[#71717A]">
              {declined ? t('tm:handoff.declinedBody') : t('tm:handoff.signedBody')}
            </p>
            {!declined && outcome?.signerName && (
              <div className="mt-5 inline-flex items-center gap-2 bg-[#0A0A0A] px-3 py-2 text-[#F5F1E8]">
                <span className="w-1.5 h-1.5 bg-[#D5C9B4] block flex-shrink-0" />
                <Mono className="text-[10px] tracking-[0.1em]">
                  {t('tm:signature.signedBy', {
                    name: outcome.signerName,
                    title: outcome.signerTitle ?? '',
                  })}
                </Mono>
              </div>
            )}

            <div className="mt-7">
              <button
                type="button"
                onClick={finish}
                className={BTN_PRIMARY}
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
