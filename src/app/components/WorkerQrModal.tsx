// Admin "Acceso QR" modal for field-role workers (WORKER / SUPERVISOR /
// SUBCONTRACTOR). The admin generates the worker's login QR (rendered from the
// backend-signed `qrToken`), hands it out via print/download, sets or resets the
// worker's 6-digit PIN, and can regenerate the QR (revoking the old one).
//
// The mobile app consumes the QR + PIN to log the worker into the right tenant;
// this is the admin half only.

import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import {
  AlertCircle, Download, KeyRound, Loader2, Printer,
  QrCode, RefreshCw, ShieldCheck, Shuffle,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import * as UsersApi from '../services/users';
import type { WorkerQrDTO } from '../services/users';
import { ApiError } from '../lib/api';
import { FIELD_LIMITS } from '../../shared/fieldLimits';

/** Minimal worker shape the modal needs — a subset of the list/detail user. */
export interface WorkerQrTarget {
  id: number;
  username: string;
  fullName: string | null;
}

interface WorkerQrModalProps {
  user: WorkerQrTarget | null;
  open: boolean;
  onClose: () => void;
}

// Mirror of the backend rule: PIN must be exactly 6 digits.
const PIN_RE = /^\d{6}$/;

export function WorkerQrModal({ user, open, onClose }: WorkerQrModalProps) {
  const { t } = useTranslation(['users', 'common']);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [data, setData] = useState<WorkerQrDTO | null>(null);
  // Hi-res PNG of the QR, used for print + download (independent of the canvas).
  const [pngDataUrl, setPngDataUrl] = useState('');

  const [pin, setPin] = useState('');
  const [pinSubmitting, setPinSubmitting] = useState(false);

  const [confirmingRegen, setConfirmingRegen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setLoadError(false);
    try {
      setData(await UsersApi.getWorkerQr(user.id));
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Fetch the worker's QR + PIN state whenever the modal opens.
  useEffect(() => {
    if (open && user) load();
  }, [open, user, load]);

  // Reset everything when the modal closes so reopening starts clean.
  useEffect(() => {
    if (!open) {
      setData(null);
      setPngDataUrl('');
      setPin('');
      setPinSubmitting(false);
      setConfirmingRegen(false);
      setRegenerating(false);
      setLoadError(false);
      setLoading(true);
    }
  }, [open]);

  // Render the QR onto the canvas for display and compute a hi-res PNG that
  // print/download reuse. Re-runs whenever the token changes (incl. regenerate).
  useEffect(() => {
    if (!data) return;
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, data.qrToken, { width: 220, margin: 2 })
        .catch(() => setLoadError(true));
    }
    QRCode.toDataURL(data.qrToken, { width: 512, margin: 2 })
      .then(setPngDataUrl)
      .catch(() => setPngDataUrl(''));
  }, [data]);

  const handleDownload = () => {
    if (!pngDataUrl || !data) return;
    const a = document.createElement('a');
    a.href = pngDataUrl;
    a.download = `${sanitizeFilename(`qr-${data.tenant}-${data.username}`)}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handlePrint = () => {
    if (!pngDataUrl || !data) return;
    printQr(pngDataUrl, {
      title: t('users:qr.printTitle', { username: data.username }),
      name: data.username,
      fullName: user?.fullName ?? '',
      tenantLabel: t('users:qr.tenantLabel'),
      tenant: data.tenant,
      hint: t('users:qr.scanHint'),
    });
  };

  const handleSetPin = async () => {
    if (!user || !PIN_RE.test(pin) || pinSubmitting) return;
    setPinSubmitting(true);
    try {
      await UsersApi.setWorkerPin(user.id, pin);
      setData(d => (d ? { ...d, hasPin: true } : d));
      toast.success(t('users:qr.pin.updated'), {
        description: t('users:qr.pin.updatedDesc', { username: user.username }),
      });
    } catch (err) {
      toast.error(t('users:qr.pin.failed'), {
        description: err instanceof ApiError ? err.message : t('users:toast.unknownError'),
      });
    } finally {
      setPinSubmitting(false);
    }
  };

  const handleRegenerate = async () => {
    if (!user || regenerating) return;
    setRegenerating(true);
    try {
      setData(await UsersApi.regenerateWorkerQr(user.id));
      setConfirmingRegen(false);
      toast.success(t('users:qr.regenerated'), {
        description: t('users:qr.regeneratedDesc', { username: user.username }),
      });
    } catch (err) {
      toast.error(t('users:qr.regenerateFailed'), {
        description: err instanceof ApiError ? err.message : t('users:toast.unknownError'),
      });
    } finally {
      setRegenerating(false);
    }
  };

  if (!user) return null;

  const pinValid = PIN_RE.test(pin);
  const pinTouched = pin.length > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md bg-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#0A0A0A] flex items-center gap-2">
            <QrCode className="w-5 h-5 text-[#F97316]" />{t('users:qr.title')}
          </DialogTitle>
          <DialogDescription>{t('users:qr.subtitle', { username: user.username })}</DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex flex-col items-center justify-center py-14 gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-[#F97316]" />
            <p className="text-sm text-[#71717A]">{t('users:qr.loading')}</p>
          </div>
        )}

        {!loading && loadError && (
          <div className="py-6">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-900">{t('users:qr.loadErrorTitle')}</p>
                <p className="text-xs text-red-600 mt-0.5">{t('users:qr.loadError')}</p>
              </div>
            </div>
            <Button variant="outline" onClick={load} className="w-full mt-3 gap-2 border-[#D4D4D8] text-[#0A0A0A]">
              <RefreshCw className="w-4 h-4" />{t('common:buttons.retry')}
            </Button>
          </div>
        )}

        {!loading && !loadError && data && (
          <div className="space-y-5">
            {/* QR code + identity */}
            <div className="flex flex-col items-center">
              <div className="bg-white border border-[#D4D4D8] rounded-xl p-4">
                <canvas ref={canvasRef} aria-label={t('users:qr.qrLabel', { username: data.username })} />
              </div>
              <p className="mt-3 text-sm font-semibold font-mono text-[#0A0A0A]">{data.username}</p>
              {user.fullName && <p className="text-xs text-[#71717A]">{user.fullName}</p>}
              <p className="text-xs text-[#71717A] mt-0.5">
                <span className="uppercase tracking-wide">{t('users:qr.tenantLabel')}:</span>{' '}
                <span className="font-mono text-[#0A0A0A]">{data.tenant}</span>
              </p>
              <p className="text-[11px] text-[#71717A] text-center mt-2 max-w-[260px]">{t('users:qr.scanHint')}</p>
            </div>

            {/* Print + Download */}
            <div className="flex gap-2">
              <Button variant="outline" onClick={handlePrint} disabled={!pngDataUrl}
                className="flex-1 gap-2 border-[#D4D4D8] text-[#0A0A0A]">
                <Printer className="w-4 h-4" />{t('users:qr.print')}
              </Button>
              <Button variant="outline" onClick={handleDownload} disabled={!pngDataUrl}
                className="flex-1 gap-2 border-[#D4D4D8] text-[#0A0A0A]">
                <Download className="w-4 h-4" />{t('users:qr.download')}
              </Button>
            </div>

            {/* PIN section */}
            <div className="rounded-xl border border-[#D4D4D8] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-[#71717A]" />
                  <span className="text-sm font-semibold text-[#0A0A0A]">{t('users:qr.pin.section')}</span>
                </div>
                {data.hasPin ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <ShieldCheck className="w-3 h-3" />{t('users:qr.pin.set')}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                    <AlertCircle className="w-3 h-3" />{t('users:qr.pin.unset')}
                  </span>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-[#0A0A0A]">{t('users:qr.pin.label')}</Label>
                <div className="flex gap-2">
                  <Input
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={FIELD_LIMITS.PIN}
                    placeholder="••••••"
                    aria-invalid={pinTouched && !pinValid}
                    className={`h-10 font-mono tracking-[0.4em] text-center ${pinTouched && !pinValid ? 'border-red-400' : 'border-[#D4D4D8]'}`}
                    disabled={pinSubmitting}
                  />
                  <Button type="button" variant="outline" onClick={() => setPin(randomPin())} disabled={pinSubmitting}
                    className="h-10 gap-1.5 border-[#D4D4D8] text-[#0A0A0A] shrink-0">
                    <Shuffle className="w-3.5 h-3.5" />{t('users:qr.pin.generate')}
                  </Button>
                </div>
                {pinTouched && !pinValid && (
                  <p className="flex items-center gap-1 text-xs text-red-600"><AlertCircle className="w-3 h-3" />{t('users:qr.pin.invalid')}</p>
                )}
                <p className="text-[11px] text-[#71717A]">{t('users:qr.pin.hint')}</p>
              </div>

              <Button type="button" onClick={handleSetPin} disabled={!pinValid || pinSubmitting}
                className="w-full bg-[#F97316] hover:bg-[#C2410C] text-white gap-2">
                {pinSubmitting
                  ? <><Loader2 className="w-4 h-4 animate-spin" />{t('users:qr.pin.saving')}</>
                  : (data.hasPin ? t('users:qr.pin.resetButton') : t('users:qr.pin.setButton'))}
              </Button>
            </div>

            {/* Regenerate (revokes the old QR) */}
            {!confirmingRegen ? (
              <Button variant="outline" onClick={() => setConfirmingRegen(true)}
                className="w-full gap-2 border-red-200 text-red-600 hover:bg-red-50">
                <RefreshCw className="w-4 h-4" />{t('users:qr.regenerate')}
              </Button>
            ) : (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-900">{t('users:qr.regenerateConfirmTitle')}</p>
                    <p className="text-xs text-red-700 mt-0.5">{t('users:qr.regenerateConfirmDesc')}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setConfirmingRegen(false)} disabled={regenerating}
                    className="flex-1 border-[#D4D4D8] text-[#0A0A0A] bg-white">{t('common:buttons.cancel')}</Button>
                  <Button onClick={handleRegenerate} disabled={regenerating}
                    className="flex-1 gap-2 bg-red-600 hover:bg-red-700 text-white">
                    {regenerating
                      ? <><Loader2 className="w-4 h-4 animate-spin" />{t('users:qr.regenerating')}</>
                      : <><RefreshCw className="w-4 h-4" />{t('users:qr.regenerateConfirm')}</>}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Six random digits, for the admin to hand to the worker. */
function randomPin(): string {
  let s = '';
  for (let i = 0; i < 6; i++) s += Math.floor(Math.random() * 10);
  return s;
}

function sanitizeFilename(s: string): string {
  return s
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

interface PrintOpts {
  title: string;
  name: string;
  fullName: string;
  tenantLabel: string;
  tenant: string;
  hint: string;
}

/**
 * Print the QR via a hidden iframe (avoids popup blockers that hit window.open).
 * The iframe is removed shortly after the print dialog is triggered.
 */
function printQr(dataUrl: string, opts: PrintOpts): void {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = win?.document;
  if (!win || !doc) { iframe.remove(); return; }

  const esc = (s: string) =>
    s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

  doc.open();
  doc.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${esc(opts.title)}</title>` +
    `<style>` +
    `*{box-sizing:border-box}` +
    `body{font-family:-apple-system,system-ui,sans-serif;margin:0;padding:32px;color:#0A0A0A;text-align:center}` +
    `.card{display:inline-block;border:1px solid #D4D4D8;border-radius:16px;padding:24px 32px}` +
    `img{width:320px;height:320px;display:block;margin:0 auto}` +
    `.name{font-size:18px;font-weight:700;margin-top:16px;font-family:ui-monospace,monospace}` +
    `.full{font-size:13px;color:#71717A;margin-top:2px}` +
    `.tenant{font-size:13px;margin-top:6px}` +
    `.tenant .label{color:#71717A;text-transform:uppercase;letter-spacing:.05em;font-size:11px}` +
    `.tenant .val{font-family:ui-monospace,monospace;font-weight:600}` +
    `.hint{font-size:12px;color:#71717A;margin-top:14px;max-width:320px;margin-left:auto;margin-right:auto}` +
    `</style></head><body>` +
    `<div class="card">` +
    `<img src="${dataUrl}" alt="QR" />` +
    `<div class="name">${esc(opts.name)}</div>` +
    (opts.fullName ? `<div class="full">${esc(opts.fullName)}</div>` : '') +
    `<div class="tenant"><span class="label">${esc(opts.tenantLabel)}:</span> <span class="val">${esc(opts.tenant)}</span></div>` +
    `<div class="hint">${esc(opts.hint)}</div>` +
    `</div></body></html>`,
  );
  doc.close();

  const cleanup = () => setTimeout(() => iframe.remove(), 500);
  const triggerPrint = () => { win.focus(); win.print(); cleanup(); };

  const img = doc.querySelector('img') as HTMLImageElement | null;
  if (img && !img.complete) {
    img.onload = triggerPrint;
    img.onerror = triggerPrint;
  } else {
    setTimeout(triggerPrint, 50);
  }
}
