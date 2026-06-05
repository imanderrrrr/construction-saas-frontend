// QR-based invitation modal for the admin "Usuarios" panel.
// Two modes:
//   1. ROLE PICK — admin picks a role. If SUBCONTRACTOR, we route them
//      back to the manual Create User form (those accounts cannot be
//      invited via QR per the backend rule).
//   2. QR DISPLAY — after generation, render the QR image, the URL, and
//      a copy-link button.

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import { AlertCircle, Copy, Check, X, Loader2 } from 'lucide-react';

import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from './ui/select';
import { InvitationsService, AdminInvitation } from '../services/invitations';
import { ApiError } from '../lib/api';
import type { CanonicalRole } from '../types';

interface InviteUserModalProps {
  open: boolean;
  onClose: () => void;
  /** Called when the admin picks SUBCONTRACTOR → fall back to the manual Create User flow. */
  onChooseManualForSubcontractor?: () => void;
  /** Called after a successful QR generation so the parent can refresh its invitation list. */
  onGenerated?: (inv: AdminInvitation) => void;
}

// Roles that can be invited via QR (mirror of backend INVITABLE_ROLES).
// SUBCONTRACTOR omitted on purpose.
const INVITABLE_ROLES: CanonicalRole[] = [
  'ADMIN', 'SUPERVISOR', 'WORKER', 'FINANCE', 'WAREHOUSE',
];

// Light client-side check for UX only; the backend's @Email is the real guard.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function InviteUserModal({
  open,
  onClose,
  onChooseManualForSubcontractor,
  onGenerated,
}: InviteUserModalProps) {
  const { t } = useTranslation('auth');

  const [role, setRole] = useState<CanonicalRole>('WORKER');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [generated, setGenerated] = useState<AdminInvitation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Reset everything when the modal closes so reopening starts clean.
  useEffect(() => {
    if (!open) {
      setGenerated(null);
      setError(null);
      setCopied(false);
      setRole('WORKER');
      setEmail('');
      setEmailError(null);
    }
  }, [open]);

  // Render the QR onto the canvas once we have a token.
  useEffect(() => {
    if (!generated || !qrCanvasRef.current) return;
    const url = buildAcceptUrl(generated.token);
    QRCode.toCanvas(qrCanvasRef.current, url, { width: 256, margin: 2 })
      .catch(() => setError(t('invite.modal.error')));
  }, [generated, t]);

  if (!open) return null;

  const handleGenerate = async () => {
    if (role === 'SUBCONTRACTOR') {
      onChooseManualForSubcontractor?.();
      onClose();
      return;
    }
    const trimmedEmail = email.trim();
    if (trimmedEmail && !EMAIL_RE.test(trimmedEmail)) {
      setEmailError(t('invite.modal.email.invalid'));
      return;
    }
    setEmailError(null);
    setSubmitting(true);
    setError(null);
    try {
      const inv = await InvitationsService.create(role, trimmedEmail || undefined);
      setGenerated(inv);
      onGenerated?.(inv);
    } catch (err) {
      // The backend rate-limits invitation emails per tenant (HTTP 429).
      // Surface that case specifically so the admin knows to wait rather than
      // retry into the same wall and see a generic failure.
      setError(
        err instanceof ApiError && err.status === 429
          ? t('invite.modal.rateLimited')
          : t('invite.modal.error'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (!generated) return;
    try {
      await navigator.clipboard.writeText(buildAcceptUrl(generated.token));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard not allowed — leave the URL visible for manual copy */
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between px-6 pt-6 pb-3 border-b border-[#F4F4F5]">
          <div>
            <h2 id="invite-modal-title" className="text-lg font-semibold text-[#0A0A0A]">
              {t('invite.modal.title')}
            </h2>
            <p className="text-sm text-[#71717A] mt-0.5">
              {t('invite.modal.subtitle')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#71717A] hover:text-[#0A0A0A] transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {!generated ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-[#0A0A0A]">
                  {t('invite.modal.role.label')}
                </Label>
                <Select value={role} onValueChange={(v) => setRole(v as CanonicalRole)}>
                  <SelectTrigger className="w-full h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INVITABLE_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>{t(`role.${r}`)}</SelectItem>
                    ))}
                    {/* Subcontractor shown so the admin sees the option, but
                        clicking it routes to the manual Create User flow. */}
                    <SelectItem value="SUBCONTRACTOR">{t('role.SUBCONTRACTOR')}</SelectItem>
                  </SelectContent>
                </Select>
                {role === 'SUBCONTRACTOR' && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                    {t('invite.modal.subcontractor.note')}
                  </p>
                )}
              </div>

              {role !== 'SUBCONTRACTOR' && (
                <div className="space-y-1.5">
                  <Label htmlFor="invite-email" className="text-sm font-medium text-[#0A0A0A]">
                    {t('invite.modal.email.label')}
                  </Label>
                  <Input
                    id="invite-email"
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setEmailError(null); }}
                    placeholder={t('invite.modal.email.placeholder')}
                    className="h-11"
                    aria-invalid={!!emailError}
                  />
                  {emailError ? (
                    <p className="text-xs text-red-600">{emailError}</p>
                  ) : (
                    <p className="text-xs text-[#71717A]">{t('invite.modal.email.hint')}</p>
                  )}
                </div>
              )}

              <Button
                type="button"
                onClick={handleGenerate}
                disabled={submitting}
                className="w-full h-11 bg-[#F97316] hover:bg-[#C2410C] text-white"
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('invite.modal.generating')}</>
                ) : (
                  t('invite.modal.generate')
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-base font-semibold text-[#0A0A0A] mb-1">
                  {t('invite.modal.qrTitle')}
                </h3>
                <p className="text-xs text-[#71717A]">{t('invite.modal.qrHint')}</p>
              </div>

              <div className="flex justify-center bg-[#FAFAFA] rounded-xl py-4">
                <canvas ref={qrCanvasRef} aria-label="Invitation QR code" />
              </div>

              <div className="rounded-lg border border-[#D4D4D8] bg-[#FAFAFA] p-3 break-all text-xs font-mono text-[#0A0A0A]">
                {buildAcceptUrl(generated.token)}
              </div>

              <p className="text-xs text-center text-[#71717A]">
                {t('invite.modal.expiresIn', {
                  date: new Date(generated.expiresAt).toLocaleString(),
                })}
              </p>

              {email.trim() && (
                <p className="text-xs text-center text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1.5">
                  {t('invite.modal.emailedTo', { email: email.trim() })}
                </p>
              )}

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCopy}
                  className="flex-1 h-10"
                >
                  {copied ? (
                    <><Check className="w-4 h-4 mr-1.5 text-emerald-600" />{t('invite.modal.copied')}</>
                  ) : (
                    <><Copy className="w-4 h-4 mr-1.5" />{t('invite.modal.copyLink')}</>
                  )}
                </Button>
                <Button
                  type="button"
                  onClick={onClose}
                  className="flex-1 h-10 bg-[#0A0A0A] hover:bg-[#27272A] text-white"
                >
                  {t('invite.modal.done')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Build the public accept URL the QR encodes. Uses the same origin the SPA
 * is served from so the link works for both desktop pre-fill and a
 * different-device QR scan as long as the device can reach this origin.
 */
function buildAcceptUrl(token: string): string {
  const base = window.location.origin;
  return `${base}/accept-invite/${encodeURIComponent(token)}`;
}
