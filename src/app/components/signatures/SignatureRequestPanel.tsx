// BuildTrack — "Customer signature" panel inside a receivable's detail row.
//
// Replaces what used to be a blank ruled line at the bottom of the invoice PDF:
// the contractor asks for the signature here, the client signs from a link, and
// what comes back is name + title + stroke + when + from where, pinned to the
// exact version of the document that was sent.

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle, CheckCircle2, Clock, Copy, FileSignature, Loader2, ShieldOff, XCircle,
} from 'lucide-react';
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

export function SignatureRequestPanel({ receivableId, defaultRecipientEmail }: Props) {
  const { t, i18n } = useTranslation('signatures');

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
      <p className="flex items-center gap-2 text-sm text-[#71717A]">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      </p>
    );
  }

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#71717A]">
        {t('panel.title')}
      </p>

      {failed && (
        <p role="alert" className="mb-2 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          {t('panel.error')}
        </p>
      )}

      {/* No request yet, or the last one is terminal → offer to ask (again). */}
      {(!state || state.status === 'REVOKED' || state.status === 'DECLINED') && !composing && (
        <div className="flex flex-wrap items-center gap-3">
          {state?.status === 'DECLINED' && (
            <span className="inline-flex items-center gap-1.5 text-sm text-[#71717A]">
              <XCircle className="h-4 w-4 text-zinc-400" />
              {t('panel.declined')}
              {state.declineReason && ` — ${t('panel.declineReason', { reason: state.declineReason })}`}
            </span>
          )}
          {state?.status === 'REVOKED' && (
            <span className="inline-flex items-center gap-1.5 text-sm text-[#71717A]">
              <ShieldOff className="h-4 w-4 text-zinc-400" />
              {t('panel.revoked')}
            </span>
          )}
          {!state && <span className="text-sm text-[#71717A]">{t('panel.none')}</span>}
          <button
            type="button"
            onClick={() => setComposing(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#D4D4D8] px-2.5 py-1 text-xs font-medium text-[#0A0A0A] hover:bg-white"
          >
            <FileSignature className="h-3.5 w-3.5" />
            {state ? t('panel.requestAgain') : t('panel.request')}
          </button>
        </div>
      )}

      {composing && (
        <div className="max-w-xl space-y-2 rounded-lg border border-[#D4D4D8]/60 bg-white p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-[#71717A]">{t('panel.recipientEmail')}</span>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                maxLength={200}
                className="mt-1 w-full rounded-md border border-[#D4D4D8] px-2 py-1.5 text-sm"
                placeholder="super@constructora.com"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-[#71717A]">{t('panel.recipientName')}</span>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={80}
                className="mt-1 w-full rounded-md border border-[#D4D4D8] px-2 py-1.5 text-sm"
              />
            </label>
          </div>
          <p className="text-xs text-[#71717A]">{t('panel.emailHint')}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={send}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {t('panel.send')}
            </button>
            <button
              type="button"
              onClick={() => setComposing(false)}
              className="text-xs text-[#71717A] hover:text-[#0A0A0A]"
            >
              {t('panel.cancel')}
            </button>
          </div>
        </div>
      )}

      {state?.status === 'PENDING' && !composing && (
        <div className="space-y-1.5">
          <p className="inline-flex items-center gap-1.5 text-sm text-[#0A0A0A]">
            <Clock className="h-4 w-4 text-amber-500" />
            {t('panel.pending')}
            <span className="text-[#71717A]">
              · {state.emailSent && state.recipientEmail
                ? t('panel.sentTo', { email: state.recipientEmail })
                : t('panel.notSent')}
            </span>
          </p>
          <p className="text-xs text-[#71717A]">{t('panel.expires', { date: fmtDate(state.expiresAt) })}</p>

          {/* The invoice moved after the link went out. This warns; it does
              not block. The signer keeps seeing the frozen version and the
              signature stays valid evidence of what was shown — the point is
              only that the office should know the two no longer match. */}
          {state.documentChanged && (
            <p
              role="status"
              className="flex items-start gap-1.5 rounded bg-amber-50 px-2.5 py-2 text-xs text-amber-800"
            >
              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
              <span>
                {t('panel.documentChanged')}{' '}
                <span className="text-amber-700">{t('panel.documentChangedHint')}</span>
              </span>
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#D4D4D8] px-2.5 py-1 text-xs font-medium hover:bg-white"
            >
              <Copy className="h-3.5 w-3.5" />
              {copied ? t('panel.copied') : t('panel.copyLink')}
            </button>
            <button
              type="button"
              onClick={revoke}
              disabled={busy}
              className="text-xs text-[#71717A] hover:text-red-600 disabled:opacity-50"
            >
              {t('panel.revoke')}
            </button>
          </div>
        </div>
      )}

      {state?.status === 'SIGNED' && (
        <div className="space-y-2">
          <p className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0A0A0A]">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            {t('panel.signedBy', {
              name: state.signerName ?? '—',
              title: state.signerTitle ?? '—',
              date: state.signedAt ? fmtDate(state.signedAt) : '—',
            })}
          </p>
          {state.hasSignatureImage && (
            showImage ? (
              <AuthImage
                src={signatureImageUrl(state.id)}
                alt={t('panel.viewSignature')}
                className="h-24 rounded border border-[#D4D4D8] bg-white p-1"
              />
            ) : (
              <button
                type="button"
                onClick={() => setShowImage(true)}
                className="text-xs font-medium text-purple-600 hover:text-purple-800"
              >
                {t('panel.viewSignature')}
              </button>
            )
          )}
          <p className="font-mono text-[10px] text-[#A1A1AA]">
            {t('panel.hash')}: {state.documentHash.slice(0, 24)}…
          </p>
        </div>
      )}
    </div>
  );
}
