import { useCallback, useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import { ArrowRight, Check, Copy, Loader2, Lock } from 'lucide-react';
import { cn } from '../../ui/utils';
import { FOCUS_RING, PrimaryButton, SecondaryButton } from '../../onboarding/chrome';
import {
  getClientAccessStatus, generateClientAccess, revokeClientAccess,
  buildClientViewUrl, type ClientAccessStatus,
} from '../../../services/clientAccess';
import { Bone, FieldError, Mono, PaperNote } from '../bt';
import { Panel } from './panel';

/**
 * Portal — the Portal tab of the ficha (sheet 03F / 04N). What used to be the
 * "Compartir portal del cliente" modal, laid out in line: the link is a fact
 * about the project, not a task to open a window for.
 *
 * PIN handling is unchanged from the modal: while a link with a PIN exists the
 * panel shows a badge instead of re-asking (the value is a hash server-side and
 * cannot be shown), and regenerates with `preservePin`. Adding a PIN to an
 * unprotected link is a regeneration — the backend mints a new token whenever
 * the PIN changes — so the button says so ("Añadir PIN y regenerar").
 */

const EXPIRY_OPTIONS = [30, 60, 90, 180] as const;
const QR_SIZE = 168;

export function PortalPanel({ projectId, clientName, readOnly = false }: {
  projectId: number;
  clientName: string | null;
  /** Closed project: the state is shown, nothing can be changed. */
  readOnly?: boolean;
}) {
  const { t, i18n } = useTranslation(['admin', 'clientView', 'common']);

  const [status, setStatus] = useState<ClientAccessStatus | null>(null);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
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
  }, [loadStatus]);

  const shareUrl = status?.shareToken ? buildClientViewUrl(status.shareToken) : null;
  const hasStoredPin = !!status && status.enabled && status.pinRequired;

  useEffect(() => {
    if (!shareUrl || !qrCanvasRef.current) return;
    QRCode.toCanvas(qrCanvasRef.current, shareUrl, { width: QR_SIZE, margin: 1 }).catch(() => {
      /* QR render failed — the plain link stays usable */
    });
  }, [shareUrl]);

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

  const resolvedClient = status?.clientName ?? clientName;
  const noClient = !resolvedClient;
  const canEdit = !readOnly && !noClient;

  const expiresLabel = status?.expiresAt
    ? new Date(status.expiresAt).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' })
    : '';
  const statusLine = status?.active
    ? t('admin:projectFicha.portal.statusActive', {
        date: expiresLabel,
        pin: status.pinRequired ? t('admin:projectFicha.portal.pinOn') : t('admin:projectFicha.portal.pinOff'),
      })
    : t('clientView:share.status.inactive');

  const primaryLabel = generating
    ? t('clientView:share.generating')
    : !status?.enabled
      ? t('clientView:share.generate')
      : pinEnabled && !hasStoredPin
        ? t('admin:projectFicha.portal.addPin')
        : t('clientView:share.regenerate');

  return (
    <Panel title={t('admin:projectFicha.title.portal')} purpose={t('admin:projectFicha.purpose.portal')}>
      <div className="max-w-[740px] flex flex-col gap-4">
        {loading && (
          <div className="flex flex-col gap-2.5" aria-busy="true">
            <Bone className="h-9 w-full" />
            <Bone className="h-24 w-full" />
            <Bone className="h-9 w-2/3" />
          </div>
        )}

        {loadError && !loading && (
          <PaperNote tone="red">
            <p className="text-[13.5px] text-[#0A0A0A]">{t('clientView:share.loadError')}</p>
            <button type="button" onClick={() => void loadStatus()} className={cn('mt-1.5 font-bt-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-[#C2410C] hover:text-[#F97316]', FOCUS_RING)}>
              {t('common:buttons.retry')}
            </button>
          </PaperNote>
        )}

        {!loading && !loadError && status && (
          <>
            {/* State cell */}
            <div className="bg-[#0A0A0A] text-[#F5F1E8] px-3.5 py-[11px] flex flex-wrap items-center justify-between gap-2">
              <Mono className="text-[10px] font-semibold tracking-[0.12em]">
                <span className={cn('inline-block w-2 h-2 mr-2 align-middle', status.active ? 'bg-[#F97316]' : 'bg-[rgba(245,241,232,0.35)]')} aria-hidden="true" />
                {statusLine}
              </Mono>
              {resolvedClient && (
                <Mono className="text-[9.5px] tracking-[0.1em] text-[rgba(245,241,232,0.7)]">{t('clientView:share.clientLabel', { client: resolvedClient })}</Mono>
              )}
            </div>

            {actionError && <PaperNote tone="red"><p className="text-[13.5px] text-[#0A0A0A]">{t('clientView:share.error')}</p></PaperNote>}
            {notice && (
              <PaperNote tone="orange">
                <p className="text-[13.5px] text-[#0A0A0A]">{notice === 'generated' ? t('clientView:share.generated') : t('clientView:share.revoked')}</p>
              </PaperNote>
            )}
            {noClient && (
              <PaperNote tone="orange">
                <p className="text-[13.5px] text-[#0A0A0A]"><strong className="font-semibold">{t('admin:projectFicha.portal.noClientLead')}</strong> {t('clientView:share.noClient')}</p>
              </PaperNote>
            )}
            {status.enabled && !status.projectOpen && (
              <PaperNote tone="orange"><p className="text-[13.5px] text-[#0A0A0A]">{t('clientView:share.status.projectClosed')}</p></PaperNote>
            )}

            {/* Link + QR */}
            {shareUrl ? (
              <div className="grid grid-cols-1 sm:grid-cols-[168px_1fr] gap-5" data-tour="sec.projects-ficha-portal.link">
                <div className="border border-[#DBD0BB] bg-white p-2 w-[184px] h-[184px] flex items-center justify-center">
                  <canvas ref={qrCanvasRef} width={QR_SIZE} height={QR_SIZE} aria-label={t('clientView:share.linkLabel')} />
                </div>
                <div className="min-w-0">
                  <Mono className="block text-[9.5px] font-semibold tracking-[0.12em] text-[#5A5346] mb-1.5">{t('clientView:share.linkLabel')}</Mono>
                  <div className="border border-[#DBD0BB] bg-[#FAF7F0] px-3 py-2.5 font-bt-mono text-[11.5px] text-[#0A0A0A] break-all">{shareUrl}</div>
                  <div className="flex flex-wrap items-center gap-2.5 mt-2.5">
                    <SecondaryButton onClick={handleCopy} className="px-3.5 py-[9px] text-[10px] gap-1.5">
                      {copied ? <><Check className="w-3.5 h-3.5 text-[#2E7D4F]" strokeWidth={2.2} />{t('clientView:share.copied')}</> : <><Copy className="w-3.5 h-3.5" strokeWidth={2} />{t('clientView:share.copy')}</>}
                    </SecondaryButton>
                  </div>
                  <p className="text-[12.5px] leading-[1.5] text-[#5A5346] mt-2.5">{t('clientView:share.qrHint')}</p>
                </div>
              </div>
            ) : (
              <p className="text-[13.5px] leading-[1.55] text-[#5A5346]" data-tour="sec.projects-ficha-portal.link">{t('admin:projectFicha.portal.intro')}</p>
            )}

            {!readOnly && (
              <>
                {/* PIN */}
                <div className="border-t border-[#EDE7DB] pt-4" data-tour="sec.projects-ficha-portal.pin">
                  {hasStoredPin ? (
                    <div>
                      <Mono className="inline-flex items-center gap-1.5 bg-[#F3EEE4] text-[#0A0A0A] text-[9.5px] font-semibold tracking-[0.1em] px-2 py-1">
                        <Lock className="w-3 h-3" strokeWidth={2.2} />{t('clientView:share.pin.badge')}
                      </Mono>
                      <p className="text-[12.5px] leading-[1.5] text-[#5A5346] mt-2">{t('clientView:share.pin.badgeNote')}</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2.5">
                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={pinEnabled}
                          disabled={!canEdit}
                          onChange={e => { setPinEnabled(e.target.checked); setPinInvalid(false); }}
                          className="mt-[3px] w-4 h-4 accent-[#F97316] flex-shrink-0"
                        />
                        <span>
                          <span className="block text-[13.5px] font-semibold text-[#0A0A0A]">{t('clientView:share.pin.toggle')}</span>
                          <span className="block text-[12.5px] leading-[1.5] text-[#5A5346] mt-0.5">{t('admin:projectFicha.portal.pinRecommended')}</span>
                        </span>
                      </label>
                      {pinEnabled ? (
                        <div>
                          <PinBoxes value={pin} onChange={v => { setPin(v); setPinInvalid(false); }} disabled={generating} />
                          {pinInvalid && <FieldError>{t('clientView:share.pin.invalid')}</FieldError>}
                        </div>
                      ) : status.active ? (
                        <PaperNote tone="orange"><p className="text-[13px] leading-[1.5] text-[#0A0A0A]">{t('clientView:share.pin.recommend')}</p></PaperNote>
                      ) : null}
                    </div>
                  )}
                </div>

                {/* Expiry, generate, revoke */}
                <div className="border-t border-[#EDE7DB] pt-4 flex flex-col gap-3.5" data-tour="sec.projects-ficha-portal.expiry">
                  <div>
                    <Mono className="block text-[9.5px] font-semibold tracking-[0.12em] text-[#5A5346] mb-1.5">{t('clientView:share.expiry.label')}</Mono>
                    <div className="flex items-center gap-3">
                      <div className="flex" role="group" aria-label={t('clientView:share.expiry.label')}>
                        {EXPIRY_OPTIONS.map(days => (
                          <button
                            key={days}
                            type="button"
                            disabled={!canEdit}
                            aria-pressed={expiresInDays === days}
                            onClick={() => setExpiresInDays(days)}
                            className={cn(
                              'w-[52px] h-[38px] border border-[#DBD0BB] -ml-px first:ml-0 font-bt-mono text-[11.5px] font-semibold transition-colors',
                              expiresInDays === days ? 'bg-[#0A0A0A] text-[#F5F1E8] border-[#0A0A0A] relative z-[1]' : 'bg-white text-[#5A5346] hover:text-[#0A0A0A] hover:border-[#F97316]',
                              'disabled:opacity-50 disabled:pointer-events-none',
                              FOCUS_RING,
                            )}
                          >
                            {days}
                          </button>
                        ))}
                      </div>
                      <Mono className="text-[9.5px] tracking-[0.12em] text-[#8A8175]">{t('admin:projectFicha.portal.days')}</Mono>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                    <PrimaryButton onClick={handleGenerate} disabled={generating || !canEdit} className="px-4 py-[11px] gap-1.5">
                      {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                      {primaryLabel}
                      {!generating && !status.enabled && <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />}
                    </PrimaryButton>
                    {status.enabled && !confirmRevoke && (
                      <button
                        type="button"
                        disabled={revoking}
                        onClick={() => setConfirmRevoke(true)}
                        className={cn('inline-flex items-center justify-center font-bt-mono text-[10px] font-semibold uppercase tracking-[0.1em] px-3.5 py-[10px] border border-[#B3402A] text-[#B3402A] hover:bg-[#B3402A] hover:text-white transition-colors disabled:opacity-50', FOCUS_RING)}
                      >
                        {t('clientView:share.revoke')}
                      </button>
                    )}
                  </div>
                  {status.enabled && (
                    <Mono className="text-[9.5px] tracking-[0.1em] text-[#8A8175]">{t('clientView:share.regenerateNote')}</Mono>
                  )}

                  {confirmRevoke && (
                    <PaperNote tone="red" className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <p className="text-[13.5px] font-semibold text-[#0A0A0A]">{t('clientView:share.revokeConfirm')}</p>
                      <div className="flex items-center gap-2.5">
                        <SecondaryButton onClick={() => setConfirmRevoke(false)} disabled={revoking} className="px-3.5 py-[9px] text-[10px]">{t('common:buttons.cancel')}</SecondaryButton>
                        <button
                          type="button"
                          disabled={revoking}
                          onClick={() => void handleRevoke()}
                          className={cn('inline-flex items-center justify-center gap-1.5 font-bt-mono text-[10px] font-semibold uppercase tracking-[0.1em] px-3.5 py-[10px] bg-[#B3402A] text-white hover:bg-[#8F3221] transition-colors disabled:opacity-50', FOCUS_RING)}
                        >
                          {revoking ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />{t('clientView:share.revoking')}</> : t('clientView:share.revokeConfirm')}
                        </button>
                      </div>
                    </PaperNote>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </Panel>
  );
}

/**
 * Six digit boxes that behave like one field: typing advances, Backspace on an
 * empty box steps back, and a pasted / autofilled string spreads across the
 * boxes from wherever it lands.
 */
export function PinBoxes({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const { t } = useTranslation(['admin']);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.replace(/\D/g, '').slice(0, 6);

  const focus = (i: number) => refs.current[Math.max(0, Math.min(5, i))]?.focus();

  const setAt = (i: number, typed: string) => {
    const clean = typed.replace(/\D/g, '');
    if (!clean) {
      onChange(digits.slice(0, i) + digits.slice(i + 1));
      return;
    }
    const next = (digits.slice(0, i) + clean + digits.slice(i + clean.length)).slice(0, 6);
    onChange(next);
    focus(i + clean.length);
  };

  const onKeyDown = (i: number) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      e.preventDefault();
      onChange(digits.slice(0, i - 1) + digits.slice(i));
      focus(i - 1);
    }
    if (e.key === 'ArrowLeft') focus(i - 1);
    if (e.key === 'ArrowRight') focus(i + 1);
  };

  const onPaste = (i: number) => (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    if (!text) return;
    e.preventDefault();
    setAt(i, text);
  };

  return (
    <div className="flex gap-[7px]" role="group" aria-label={t('admin:projectFicha.portal.pinLabel')}>
      {Array.from({ length: 6 }, (_, i) => (
        <input
          key={i}
          ref={el => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          aria-label={t('admin:projectFicha.portal.pinDigit', { n: i + 1 })}
          value={digits[i] ?? ''}
          disabled={disabled}
          onChange={e => setAt(i, e.target.value)}
          onKeyDown={onKeyDown(i)}
          onPaste={onPaste(i)}
          onFocus={e => e.target.select()}
          className={cn('w-11 h-12 border border-[#DBD0BB] bg-white text-center font-bt-mono text-[18px] text-[#0A0A0A] focus:border-[#F97316] disabled:opacity-50', FOCUS_RING)}
        />
      ))}
    </div>
  );
}
