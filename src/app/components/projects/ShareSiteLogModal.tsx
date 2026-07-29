// "Compartir portal del cliente" — generate / copy / revoke the share link of
// a project's client portal (bitácora + punch list + RFIs). Mirrors
// InviteUserModal's link + QR + copy pattern; the link itself is minted by the
// backend (`/projects/{id}/client-access`) and opens /client-view/<token>.
//
// PIN handling: while a link with a PIN exists, the modal shows a "PIN
// protected" badge instead of re-asking for one, and regenerates with
// `preservePin` so the stored PIN survives the version bump. Changing or
// removing the PIN goes through revoke + generate anew.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import {
  AlertCircle, Check, CheckCircle2, Copy, Loader2, Lock, ShieldOff, X,
} from 'lucide-react';

import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  getClientAccessStatus, generateClientAccess, revokeClientAccess,
  buildClientViewUrl, type ClientAccessStatus,
} from '../../services/clientAccess';

const EXPIRY_OPTIONS = [30, 60, 90, 180] as const;

export function ShareSiteLogModal({
  open,
  onClose,
  projectId,
  projectName,
  clientName,
}: {
  open: boolean;
  onClose: () => void;
  projectId: number;
  projectName: string;
  clientName: string | null;
}) {
  const { t, i18n } = useTranslation(['clientView']);

  const [status, setStatus] = useState<ClientAccessStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [actionError, setActionError] = useState(false);

  const [pinEnabled, setPinEnabled] = useState(false);
  const [pin, setPin] = useState('');
  const [pinInvalid, setPinInvalid] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState<number>(90);

  const [generating, setGenerating] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<'generated' | 'revoked' | null>(null);

  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      setStatus(await getClientAccessStatus(projectId));
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Fresh state on every open.
  useEffect(() => {
    if (!open) return;
    setStatus(null);
    setActionError(false);
    setPinEnabled(false);
    setPin('');
    setPinInvalid(false);
    setExpiresInDays(90);
    setConfirmRevoke(false);
    setCopied(false);
    setNotice(null);
    void loadStatus();
  }, [open, loadStatus]);

  const shareUrl = status?.shareToken ? buildClientViewUrl(status.shareToken) : null;

  // A PIN is stored server-side (as a hash — its value is unrecoverable).
  // Once set, the modal never re-asks for it: regenerating carries it over
  // via preservePin, and changing/removing it goes through revoke + generate.
  const hasStoredPin = !!status && status.enabled && status.pinRequired;

  // Paint the QR whenever there is an active link.
  useEffect(() => {
    if (!shareUrl || !qrCanvasRef.current) return;
    QRCode.toCanvas(qrCanvasRef.current, shareUrl, { width: 220, margin: 2 }).catch(() => {
      /* QR render failed — the plain link stays usable */
    });
  }, [shareUrl]);

  if (!open) return null;

  const handleGenerate = async () => {
    if (!hasStoredPin && pinEnabled && !/^[0-9]{6}$/.test(pin)) {
      setPinInvalid(true);
      return;
    }
    setPinInvalid(false);
    setGenerating(true);
    setActionError(false);
    setNotice(null);
    try {
      await generateClientAccess(projectId, {
        pin: !hasStoredPin && pinEnabled ? pin : undefined,
        expiresInDays,
        // Only sent while a PIN exists; old backends ignore it (worst case:
        // the pre-preservePin behavior), so no version coupling.
        preservePin: hasStoredPin || undefined,
      });
      setNotice('generated');
      setPin('');
      setPinEnabled(false);
      await loadStatus();
    } catch {
      setActionError(true);
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async () => {
    if (!confirmRevoke) {
      setConfirmRevoke(true);
      return;
    }
    setRevoking(true);
    setActionError(false);
    setNotice(null);
    try {
      await revokeClientAccess(projectId);
      setNotice('revoked');
      setConfirmRevoke(false);
      await loadStatus();
    } catch {
      setActionError(true);
    } finally {
      setRevoking(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard not allowed — the URL stays visible for manual copy */
    }
  };

  const noClient = !clientName && !(status?.clientName);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-sitelog-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between px-6 pt-6 pb-3 border-b border-[#F4F4F5]">
          <div>
            <h2 id="share-sitelog-title" className="text-lg font-semibold text-[#0A0A0A]">
              {t('share.title')}
            </h2>
            <p className="text-sm text-[#71717A] mt-0.5">
              {t('share.subtitle', { project: projectName })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#71717A] hover:text-[#0A0A0A] transition"
            aria-label={t('lightbox.close')}
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="p-6 space-y-5">
          {loading && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 text-[#F97316] animate-spin" />
            </div>
          )}

          {loadError && !loading && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-red-700">{t('share.loadError')}</p>
                <button
                  type="button"
                  onClick={() => void loadStatus()}
                  className="text-xs font-medium text-red-700 underline mt-1"
                >
                  {t('error.retry')}
                </button>
              </div>
            </div>
          )}

          {!loading && !loadError && status && (
            <>
              {actionError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{t('share.error')}</p>
                </div>
              )}
              {notice && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-emerald-700">
                    {notice === 'generated' ? t('share.generated') : t('share.revoked')}
                  </p>
                </div>
              )}

              {noClient && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                  {t('share.noClient')}
                </p>
              )}

              {/* Current state */}
              <div className="rounded-xl border border-[#D4D4D8] p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                      status.active
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-[#FAFAFA] text-[#71717A] border-[#D4D4D8]'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${status.active ? 'bg-emerald-500' : 'bg-[#D4D4D8]'}`} />
                    {status.active ? t('share.status.active') : t('share.status.inactive')}
                  </span>
                  {status.active && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-[#71717A]">
                      <Lock className="w-3 h-3" />
                      {status.pinRequired ? t('share.status.pinOn') : t('share.status.pinOff')}
                    </span>
                  )}
                </div>

                {(status.clientName ?? clientName) && (
                  <p className="text-xs text-[#71717A]">
                    {t('share.clientLabel', { client: status.clientName ?? clientName })}
                  </p>
                )}
                {status.active && status.expiresAt && (
                  <p className="text-xs text-[#71717A]">
                    {t('share.status.expires', {
                      date: new Date(status.expiresAt).toLocaleDateString(i18n.language, {
                        day: 'numeric', month: 'long', year: 'numeric',
                      }),
                    })}
                  </p>
                )}
                {status.enabled && !status.projectOpen && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                    {t('share.status.projectClosed')}
                  </p>
                )}

                {shareUrl && (
                  <>
                    <div className="flex justify-center bg-[#FAFAFA] rounded-xl py-3">
                      <canvas ref={qrCanvasRef} aria-label={t('share.linkLabel')} />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1">
                        {t('share.linkLabel')}
                      </p>
                      <div className="rounded-lg border border-[#D4D4D8] bg-[#FAFAFA] p-2.5 break-all text-[11px] font-mono text-[#0A0A0A]">
                        {shareUrl}
                      </div>
                      <p className="text-[11px] text-[#71717A] mt-1.5">{t('share.qrHint')}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" onClick={handleCopy} className="flex-1 h-9">
                        {copied ? (
                          <><Check className="w-4 h-4 mr-1.5 text-emerald-600" />{t('share.copied')}</>
                        ) : (
                          <><Copy className="w-4 h-4 mr-1.5" />{t('share.copy')}</>
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleRevoke}
                        disabled={revoking}
                        className={`h-9 gap-1.5 ${confirmRevoke
                          ? 'border-red-300 text-white bg-red-600 hover:bg-red-700'
                          : 'border-red-200 text-red-600 hover:bg-red-50'}`}
                      >
                        {revoking ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldOff className="w-4 h-4" />}
                        {revoking ? t('share.revoking') : confirmRevoke ? t('share.revokeConfirm') : t('share.revoke')}
                      </Button>
                    </div>
                  </>
                )}
              </div>

              {/* Generate / regenerate */}
              <div className="space-y-3">
                {hasStoredPin ? (
                  // Already protected: don't ask for a PIN again — regenerating
                  // keeps the current one (preservePin).
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                    <p className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-800">
                      <Lock className="w-4 h-4" />
                      {t('share.pin.badge')}
                    </p>
                    <p className="text-xs text-emerald-700 mt-0.5">{t('share.pin.badgeNote')}</p>
                  </div>
                ) : (
                  <>
                    <label className="flex items-center gap-2 text-sm text-[#0A0A0A]">
                      <input
                        type="checkbox"
                        checked={pinEnabled}
                        onChange={(e) => { setPinEnabled(e.target.checked); setPinInvalid(false); }}
                        className="w-4 h-4 accent-[#F97316]"
                      />
                      {t('share.pin.toggle')}
                    </label>
                    {pinEnabled ? (
                      <div className="space-y-1">
                        <Input
                          value={pin}
                          onChange={(e) => { setPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setPinInvalid(false); }}
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="123456"
                          className="h-10 font-mono tracking-widest"
                          aria-invalid={pinInvalid}
                        />
                        {pinInvalid ? (
                          <p className="text-xs text-red-600">{t('share.pin.invalid')}</p>
                        ) : (
                          <p className="text-xs text-[#71717A]">{t('share.pin.hint')}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                        {t('share.pin.recommend')}
                      </p>
                    )}
                  </>
                )}

                <div className="space-y-1">
                  <Label className="text-sm font-medium text-[#0A0A0A]">{t('share.expiry.label')}</Label>
                  <div className="flex gap-2">
                    {EXPIRY_OPTIONS.map((days) => (
                      <button
                        key={days}
                        type="button"
                        onClick={() => setExpiresInDays(days)}
                        className={`flex-1 h-9 rounded-lg border text-xs font-medium transition-colors ${
                          expiresInDays === days
                            ? 'border-[#F97316] bg-[#F97316]/10 text-[#C2410C]'
                            : 'border-[#D4D4D8] text-[#71717A] hover:bg-[#FAFAFA]'
                        }`}
                      >
                        {t('share.expiry.option', { days })}
                      </button>
                    ))}
                  </div>
                </div>

                {status.enabled && (
                  <p className="text-xs text-[#71717A]">{t('share.regenerateNote')}</p>
                )}

                <Button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generating || noClient}
                  className="w-full h-11 bg-[#F97316] hover:bg-[#C2410C] text-white"
                >
                  {generating ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('share.generating')}</>
                  ) : (
                    status.enabled ? t('share.regenerate') : t('share.generate')
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
