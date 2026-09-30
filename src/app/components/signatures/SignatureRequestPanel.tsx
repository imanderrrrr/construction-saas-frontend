// BuildTrack — "Customer signature" panel inside a receivable's detail row.
//
// Replaces what used to be a blank ruled line at the bottom of the invoice PDF:
// the contractor asks for the signature here, the client signs from a link, and
// what comes back is name + title + stroke + when + from where, pinned to the
// exact version of the document that was sent.
//
// The look is the document detail's own: the same mono kicker that heads the
// line items and the collections beside it, the same square chips the row's
// signature column wears (accounts/ui `Tag`), the row's buttons, and the paper
// note the panel uses for warnings. Nothing here is styled on its own — it
// was ported with generic classes and a purple button once, and the block
// read as a foreign object inside the invoice it belongs to.

import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Copy, FileSignature, Loader2 } from 'lucide-react';
import { cn } from '../ui/utils';
import { FOCUS_RING } from '../onboarding/chrome';
import { FieldHint, FieldLabel, INPUT, Mono, PaperNote } from '../projects/bt';
import { Tag } from '../accounts/ui';
import {
  getSignatureRequest,
  requestSignature,
  revokeSignatureRequest,
  signatureImageUrl,
  type SignatureRequestState,
} from '../../services/signatures';
import { AuthImage } from '../sitelog/AuthImage';

interface Props {
  receivableId: number;
  /** Prefilled from the project's client record when we have an address. */
  defaultRecipientEmail?: string | null;
}

/* The row's buttons (ReceivablesScreen's «Cobrar», «PDF» and «Anular»), so the
   block's actions read as the document's and not as a form dropped into it. */
const BTN_ORANGE = 'inline-flex items-center gap-1.5 bg-[#F97316] text-[#0A0A0A] border-0 cursor-pointer px-3 py-2 font-bt-mono text-[10px] font-semibold uppercase tracking-[0.09em] whitespace-nowrap transition-colors hover:bg-[#C2410C] hover:text-[#F5F1E8] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#F97316] disabled:hover:text-[#0A0A0A]';
const BTN_OUTLINE = 'inline-flex items-center gap-1.5 border border-[#DBD0BB] bg-white cursor-pointer px-2.5 py-2 font-bt-mono text-[10px] uppercase tracking-[0.08em] text-[#0A0A0A] transition-colors hover:border-[#F97316] hover:text-[#C2410C] disabled:opacity-40 disabled:cursor-not-allowed';
const BTN_GHOST = 'font-bt-mono text-[9.5px] uppercase tracking-[0.09em] text-[#8A8175] cursor-pointer transition-colors hover:text-[#0A0A0A] disabled:opacity-40 disabled:cursor-default';
const LINK = 'font-bt-mono text-[9.5px] uppercase tracking-[0.09em] text-[#C2410C] cursor-pointer transition-colors hover:text-[#F97316]';

/** The chip beside the kicker — the same tone per state as the row's signature column. */
const TAG_TONE: Record<SignatureRequestState['status'], 'orangeDashed' | 'green' | 'red' | 'outline'> = {
  PENDING: 'orangeDashed',
  SIGNED: 'green',
  DECLINED: 'red',
  REVOKED: 'outline',
};
const TAG_KEY: Record<SignatureRequestState['status'], string> = {
  PENDING: 'panel.pending',
  SIGNED: 'panel.signed',
  DECLINED: 'panel.declined',
  REVOKED: 'panel.revoked',
};

/** The paper note the panel raises a hand with — orange edge, never a block. */
function Heads({ lead, hint }: { lead: string; hint: string }) {
  return (
    <div role="status">
      <PaperNote className="flex items-start gap-2 text-[12px]">
        <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0 text-[#C2410C]" strokeWidth={2.2} />
        <span>
          {lead}{' '}
          <span className="text-[#5A5346]">{hint}</span>
        </span>
      </PaperNote>
    </div>
  );
}

export function SignatureRequestPanel({ receivableId, defaultRecipientEmail }: Props) {
  const { t, i18n } = useTranslation(['signatures', 'common']);
  const emailId = useId();
  const nameId = useId();

  const [state, setState] = useState<SignatureRequestState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [composing, setComposing] = useState(false);
  const [email, setEmail] = useState(defaultRecipientEmail ?? '');
  const [name, setName] = useState('');
  const [copied, setCopied] = useState(false);
  const [showImage, setShowImage] = useState(false);

  // The initial load. State lands only inside the promise callbacks, so there
  // is no synchronous setState in the effect body, and `cancelled` keeps a
  // late response from writing into an unmounted row (these panels live in
  // table rows that collapse the moment the user clicks elsewhere).
  useEffect(() => {
    let cancelled = false;
    getSignatureRequest(receivableId)
      .then(result => { if (!cancelled) setState(result); })
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [receivableId]);

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(i18n.language, { year: 'numeric', month: 'short', day: 'numeric' });

  const send = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const result = await requestSignature(receivableId, {
        recipientEmail: email.trim() || undefined,
        recipientName: name.trim() || undefined,
      });
      setState(result);
      setComposing(false);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const revoke = async () => {
    setBusy(true);
    setFailed(false);
    try {
      setState(await revokeSignatureRequest(receivableId));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    if (!state?.signUrl) return;
    try {
      await navigator.clipboard.writeText(state.signUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setFailed(true);
    }
  };

  if (loading) {
    return (
      <p role="status" aria-busy="true" className="flex items-center gap-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-[#8A8175]" />
        <Mono className="text-[10px] tracking-[0.08em] text-[#A69C8D]">{t('common:labels.loading')}</Mono>
      </p>
    );
  }

  const askAgain = (
    <button
      type="button"
      onClick={() => setComposing(true)}
      className={cn(BTN_OUTLINE, FOCUS_RING)}
    >
      <FileSignature className="h-3 w-3" strokeWidth={2.2} />
      {state ? t('panel.requestAgain') : t('panel.request')}
    </button>
  );

  return (
    <div className="space-y-2.5">
      {/* The kicker the two blocks beside this one wear, and the state as a chip. */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <Mono className="block text-[9.5px] tracking-[0.13em] text-[#8A8175]">{t('panel.title')}</Mono>
        {state && <Tag tone={TAG_TONE[state.status]}>{t(TAG_KEY[state.status])}</Tag>}
      </div>

      {failed && (
        <div role="alert">
          <PaperNote tone="red" className="text-[12px]">{t('panel.error')}</PaperNote>
        </div>
      )}

      {/* No request yet, or the last one is terminal → offer to ask (again). */}
      {(!state || state.status === 'REVOKED' || state.status === 'DECLINED') && !composing && (
        <div className="space-y-2.5">
          {!state && <p className="text-[12.5px] leading-[1.5] text-[#8A8175]">{t('panel.none')}</p>}
          {state?.status === 'DECLINED' && state.declineReason && (
            <p className="text-[12.5px] leading-[1.5] text-[#5A5346]">{t('panel.declineReason', { reason: state.declineReason })}</p>
          )}
          <div>{askAgain}</div>
        </div>
      )}

      {composing && (
        <div className="max-w-xl bg-[#FAF7F0] border border-[#DBD0BB] p-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor={emailId}>{t('panel.recipientEmail')}</FieldLabel>
              <input
                id={emailId}
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                maxLength={200}
                disabled={busy}
                className={INPUT}
                placeholder="super@constructora.com"
              />
            </div>
            <div>
              <FieldLabel htmlFor={nameId}>{t('panel.recipientName')}</FieldLabel>
              <input
                id={nameId}
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={80}
                disabled={busy}
                className={INPUT}
              />
            </div>
          </div>
          <FieldHint className="normal-case tracking-normal text-[11.5px]">{t('panel.emailHint')}</FieldHint>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={send}
              disabled={busy}
              className={cn(BTN_ORANGE, FOCUS_RING)}
            >
              {busy && <Loader2 className="h-3 w-3 animate-spin" />}
              {t('panel.send')}
            </button>
            <button
              type="button"
              onClick={() => setComposing(false)}
              disabled={busy}
              className={cn(BTN_GHOST, FOCUS_RING)}
            >
              {t('panel.cancel')}
            </button>
          </div>
        </div>
      )}

      {state?.status === 'PENDING' && !composing && (
        <div className="space-y-2">
          <p className="text-[12.5px] leading-[1.5] text-[#5A5346]">
            {state.emailSent && state.recipientEmail
              ? t('panel.sentTo', { email: state.recipientEmail })
              : t('panel.notSent')}
          </p>
          <Mono className="block text-[10px] tracking-[0.06em] text-[#A69C8D] normal-case">
            {t('panel.expires', { date: fmtDate(state.expiresAt) })}
          </Mono>

          {/* The invoice moved after the link went out. This warns; it does
              not block. The signer keeps seeing the frozen version and the
              signature stays valid evidence of what was shown — the point is
              only that the office should know the two no longer match. */}
          {state.documentChanged && (
            <Heads lead={t('panel.documentChanged')} hint={t('panel.documentChangedHint')} />
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={copyLink}
              className={cn(BTN_OUTLINE, FOCUS_RING)}
            >
              <Copy className="h-3 w-3" strokeWidth={2.2} />
              {copied ? t('panel.copied') : t('panel.copyLink')}
            </button>
            <button
              type="button"
              onClick={revoke}
              disabled={busy}
              className={cn(BTN_GHOST, 'hover:text-[#B3402A]', FOCUS_RING)}
            >
              {t('panel.revoke')}
            </button>
          </div>
        </div>
      )}

      {state?.status === 'SIGNED' && (
        <div className="space-y-2">
          <p className="text-[13px] leading-[1.5] text-[#0A0A0A]">
            {t('panel.signedBy', {
              name: state.signerName ?? '—',
              title: state.signerTitle ?? '—',
              date: state.signedAt ? fmtDate(state.signedAt) : '—',
            })}
          </p>

          {/* The invoice moved AFTER the signature landed. Nothing here
              invalidates it — it is evidence of the version it was put on —
              but the office must not read it as covering the current one,
              and the PDF prints a notice instead of the stroke. The fix is a
              fresh request; the backend keeps this signed one as history. */}
          {state.documentChangedSinceSigned && (
            <>
              <Heads lead={t('panel.signedDocumentChanged')} hint={t('panel.signedDocumentChangedHint')} />
              {!composing && <div>{askAgain}</div>}
            </>
          )}
          {state.hasSignatureImage && (
            showImage ? (
              <AuthImage
                src={signatureImageUrl(state.id)}
                alt={t('panel.viewSignature')}
                className="h-24 border border-[#DBD0BB] bg-white p-1"
              />
            ) : (
              <div>
                <button
                  type="button"
                  onClick={() => setShowImage(true)}
                  className={cn(LINK, FOCUS_RING)}
                >
                  {t('panel.viewSignature')}
                </button>
              </div>
            )
          )}
          <Mono className="block text-[9.5px] tracking-[0.05em] text-[#A69C8D] normal-case">
            {t('panel.hash')}: {state.documentHash.slice(0, 24)}…
          </Mono>
        </div>
      )}
    </div>
  );
}
