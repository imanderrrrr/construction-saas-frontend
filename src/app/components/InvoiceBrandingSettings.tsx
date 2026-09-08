// Admin screen: the tenant's invoice template — the letterhead printed on
// every invoice and change order the app generates, and (via
// GET /api/v1/branding, which reads this same row) the company identity the
// field team sees in the mobile app.
//
// Redesign notes (Claude Design "Facturas BuildTrack", boards 06–08):
//
//  · A failed GET used to leave the five fields painted empty with "Guardar"
//    live. One click sent five nulls and the company's letterhead was gone —
//    reproduced end to end, and unrecoverable from this screen, since there
//    is no history of the template. The screen now refuses to write what it
//    could not read: on a load failure the fields are locked, the save button
//    is not rendered at all, and each field says "could not be read" instead
//    of showing the blank that invites a save.
//  · `configured` arrived from the server and the UI never looked at it, so a
//    tenant with no letterhead was indistinguishable from one whose form had
//    not loaded yet. It is read now — together with the emptier case the bug
//    above created: a row that exists but carries neither a name nor a logo
//    still prints a blank header, and says so.
//  · One save model. The logo used to upload the moment it was dropped while
//    the text waited for "Guardar", so the screen told two stories at once
//    (and the tour contradicted itself between stop 1 and stop 3). The chosen
//    file is now held locally, shown in the preview, counted by the bar at
//    the foot, and written when the whole template is saved.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ImagePlus, Loader2, RefreshCw, Save } from 'lucide-react';

import { cn } from './ui/utils';
import { ApiError } from '../lib/api';
import { FOCUS_RING, SecondaryButton, DestroyButton, TertiaryButton } from './onboarding/chrome';
import { FieldError, FieldHint, FieldLabel, INPUT, INPUT_ERROR, Mono, PaperNote } from './projects/bt';
import { BtModal } from './bt/windows';
import {
  getInvoiceBranding,
  updateInvoiceBranding,
  uploadInvoiceLogo,
  fetchInvoiceLogoDataUrl,
  invalidateInvoiceIssuer,
  type InvoiceBranding,
} from '../services/invoiceBranding';
import {
  invoicePdfPreviewUrl,
  type InvoiceIssuerPdf,
  type InvoicePdfData,
} from '../helpers/exportInvoicePdf';

/** Mirrors of the backend caps (InvoiceBrandingService / UpdateInvoiceBrandingRequest). */
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg'];
const LIMITS = { companyName: 150, contactName: 150, address: 300, email: 150, phone: 50 } as const;

interface FormState {
  companyName: string;
  contactName: string;
  address: string;
  email: string;
  phone: string;
}

const EMPTY_FORM: FormState = { companyName: '', contactName: '', address: '', email: '', phone: '' };

/** Same shape the server accepts; a loose check that catches the typo, not a spec. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type LoadState = 'loading' | 'ready' | 'failed';

export function InvoiceBrandingSettings() {
  const { t, i18n } = useTranslation(['admin', 'common']);
  const lang = i18n.language;

  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [branding, setBranding] = useState<InvoiceBranding | null>(null);
  /** What the server last confirmed — the baseline "unsaved changes" is measured against. */
  const [saved, setSaved] = useState<FormState>(EMPTY_FORM);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [savedLogo, setSavedLogo] = useState<string | null>(null);
  /** A logo chosen but not yet written: { file } to upload, { removed } to clear. */
  const [pendingLogo, setPendingLogo] = useState<{ file: File; dataUrl: string } | null>(null);
  const [logoRemoved, setLogoRemoved] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [emailTouched, setEmailTouched] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoadState('loading');
    setLoadError(null);
    try {
      const data = await getInvoiceBranding();
      const logo = data.hasLogo ? await fetchInvoiceLogoDataUrl() : null;
      const next: FormState = {
        companyName: data.companyName ?? '',
        contactName: data.contactName ?? '',
        address: data.address ?? '',
        email: data.email ?? '',
        phone: data.phone ?? '',
      };
      setBranding(data);
      setSaved(next);
      setForm(next);
      setSavedLogo(logo);
      setPendingLogo(null);
      setLogoRemoved(false);
      setLoadState('ready');
    } catch (err) {
      // Nothing is populated and nothing becomes writable: the form below
      // stays locked precisely because these values are unknown.
      setLoadError(err instanceof ApiError ? `${err.status}` : null);
      setLoadState('failed');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const setField = (key: keyof FormState) => (value: string) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const logoDataUrl = pendingLogo ? pendingLogo.dataUrl : logoRemoved ? null : savedLogo;

  /** Which fields differ from what the server confirmed, plus the logo. */
  const changed = useMemo(() => {
    const fields = (Object.keys(EMPTY_FORM) as (keyof FormState)[]).filter(k => form[k].trim() !== saved[k].trim());
    return { fields, logo: !!pendingLogo || logoRemoved, count: fields.length + (pendingLogo || logoRemoved ? 1 : 0) };
  }, [form, saved, pendingLogo, logoRemoved]);

  const emailInvalid = form.email.trim().length > 0 && !EMAIL_RE.test(form.email.trim());
  const canSave = loadState === 'ready' && changed.count > 0 && !emailInvalid && !saving;

  /**
   * The tenant has no letterhead when the template was never saved — or when
   * the row exists but carries neither a company name nor a logo, which is
   * exactly the shape the wipe described at the top of this file left behind.
   */
  const noLetterhead = loadState === 'ready' && branding !== null
    && (!branding.configured || (!saved.companyName.trim() && !savedLogo));

  // Leaving the tab with pending edits warns; the template keeps the old
  // values until the save goes through.
  useEffect(() => {
    if (changed.count === 0) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [changed.count]);

  useEffect(() => {
    if (!savedAt) return;
    const timer = window.setTimeout(() => setSavedAt(null), 4000);
    return () => window.clearTimeout(timer);
  }, [savedAt]);

  // ── Live preview: the sample invoice with the CURRENT form values ──────
  const previewIssuer: InvoiceIssuerPdf = useMemo(() => ({
    name: form.companyName || null,
    contact: form.contactName || null,
    address: form.address || null,
    email: form.email || null,
    phone: form.phone || null,
    logoDataUrl,
  }), [form, logoDataUrl]);

  /** The sample document, translated: it used to be Spanish by hand, in both panels. */
  const samplePdf: InvoicePdfData = useMemo(() => ({
    documentType: 'INVOICE',
    invoiceNumber: 'INV-2026-1',
    client: t('admin:invoiceBranding.sample.client'),
    project: t('admin:invoiceBranding.sample.project'),
    issuedDate: '2026-07-01',
    dueDate: '2026-07-15',
    lineItems: [
      { description: t('admin:invoiceBranding.sample.labor'), quantity: 40, unitPrice: 25, subtotal: 1000 },
      { description: t('admin:invoiceBranding.sample.materials'), quantity: 1, unitPrice: 450, subtotal: 450 },
    ],
    subtotal: 1450,
    discount: 0,
    taxRate: 7,
    tax: 101.5,
    amount: 1551.5,
    notes: null,
  }), [t]);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  useEffect(() => {
    if (loadState !== 'ready') return;
    const handle = setTimeout(() => {
      let url: string | null;
      try {
        url = invoicePdfPreviewUrl(samplePdf, previewIssuer, undefined, lang);
      } catch {
        url = null;
      }
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = url;
      setPreviewUrl(url);
    }, 350);
    return () => clearTimeout(handle);
  }, [previewIssuer, samplePdf, loadState, lang]);
  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────
  const pickLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setLogoError(null);
    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      setLogoError(t('admin:invoiceBranding.toastLogoType'));
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError(t('admin:invoiceBranding.toastLogoSize'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPendingLogo({ file, dataUrl: String(reader.result) });
      setLogoRemoved(false);
    };
    reader.onerror = () => setLogoError(t('admin:invoiceBranding.toastLogoError'));
    reader.readAsDataURL(file);
  };

  const discard = () => {
    setForm(saved);
    setPendingLogo(null);
    setLogoRemoved(false);
    setLogoError(null);
    setSaveError(null);
    setEmailTouched(false);
  };

  const handleSave = async () => {
    // Belt and braces: the button is not rendered while the load failed, and
    // this refuses to run even if something else called it.
    if (loadState !== 'ready') return;
    setSaving(true);
    setSaveError(null);
    try {
      if (pendingLogo) await uploadInvoiceLogo(pendingLogo.file);
      // The PUT replaces every text column (InvoiceBrandingService.update
      // assigns all five unconditionally), so the whole form travels — an
      // omitted field is a cleared field, not an untouched one.
      const result = await updateInvoiceBranding({
        companyName: form.companyName.trim() || null,
        contactName: form.contactName.trim() || null,
        address: form.address.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        ...(logoRemoved ? { removeLogo: true } : {}),
      });
      invalidateInvoiceIssuer();
      setBranding(result);
      setSaved({ ...form });
      if (pendingLogo) { setSavedLogo(pendingLogo.dataUrl); setPendingLogo(null); }
      if (logoRemoved) { setSavedLogo(null); setLogoRemoved(false); }
      // No toast: the bar below says "saved at 14:22" for four seconds.
      setSavedAt(new Date().toLocaleTimeString(lang.startsWith('es') ? 'es-GT' : 'en-US', { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : t('admin:invoiceBranding.toastSaveError'));
    } finally {
      setSaving(false);
    }
  };

  const locked = loadState !== 'ready';

  const textField = (
    key: keyof FormState,
    { multiline = false, type = 'text' }: { multiline?: boolean; type?: string } = {},
  ) => {
    const id = `ib-${key}`;
    const max = LIMITS[key];
    const dirty = changed.fields.includes(key);
    const invalid = key === 'email' && emailInvalid && emailTouched;
    const common = {
      id,
      value: locked ? '' : form[key],
      maxLength: max,
      disabled: locked,
      placeholder: locked
        ? t('admin:invoiceBranding.unread')
        : t(`admin:invoiceBranding.${key}Ph` as const),
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setField(key)(e.target.value),
      className: cn(
        INPUT,
        invalid && INPUT_ERROR,
        // Never a plain empty box while the value is unknown: an empty field
        // reads as "I have no address" and invites a save that clears it.
        locked && 'border-dashed bg-[#F3EEE4] placeholder:text-[#8A8175] placeholder:italic',
        multiline && 'h-auto py-2',
      ),
    };
    return (
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <FieldLabel htmlFor={id}>{t(`admin:invoiceBranding.${key}` as const)}</FieldLabel>
          {!locked && (
            <Mono className={cn('text-[9.5px] tracking-[0.08em] mb-1.5', dirty ? 'text-[#C2410C]' : 'text-[#A69C8D]')}>
              {dirty ? `${t('admin:invoiceBranding.changed')} · ` : ''}{form[key].length} / {max}
            </Mono>
          )}
        </div>
        {multiline
          ? <textarea rows={2} {...common} onBlur={key === 'email' ? () => setEmailTouched(true) : undefined} />
          : <input type={type} {...common} onBlur={key === 'email' ? () => setEmailTouched(true) : undefined} />}
        {invalid && <FieldError>{t('admin:invoiceBranding.emailInvalid')}</FieldError>}
      </div>
    );
  };

  return (
    <>
      <div className="space-y-4">
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-end justify-between gap-5 flex-wrap">
          <div>
            <Mono className="block text-[11px] tracking-[0.15em] text-[#8A8175]">{t('admin:invoiceBranding.kicker')}</Mono>
            <h2 className="font-bt-display font-extrabold uppercase text-[38px] md:text-[50px] leading-[0.92] tracking-[0.01em] text-[#0A0A0A] mt-1">
              {t('admin:section.invoiceBranding.title')}
            </h2>
            <Mono className="block text-[11px] md:text-[12.5px] tracking-[0.06em] text-[#5A5346] mt-2">
              {loadState === 'ready'
                ? t(branding?.configured ? 'admin:invoiceBranding.stampConfigured' : 'admin:invoiceBranding.stampNever')
                : t('admin:invoiceBranding.stampUnknown')}
            </Mono>
          </div>
        </div>

        {/* ── The load failed: nothing here may be written ───────────── */}
        {loadState === 'failed' && (
          <div className="bg-white border border-[#E7E1D5] border-l-[3px] border-l-[#B3402A] p-5" data-testid="invoice-branding-load-error">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-[#B3402A] flex-shrink-0 mt-0.5" strokeWidth={2} />
              <div className="min-w-0">
                <div className="font-bt-heading font-bold text-[17px] text-[#0A0A0A]">{t('admin:invoiceBranding.loadFail.title')}</div>
                <p className="text-[13px] leading-[1.55] text-[#5A5346] mt-1.5">{t('admin:invoiceBranding.loadFail.body')}</p>
                <p className="text-[13px] leading-[1.55] text-[#5A5346] mt-1.5">{t('admin:invoiceBranding.loadFail.locked')}</p>
                <div className="flex items-center gap-3 mt-3.5 flex-wrap">
                  <SecondaryButton onClick={() => void load()} className="bg-[#FAF7F0] gap-1.5">
                    <RefreshCw className="w-3 h-3" />{t('common:buttons.retry')}
                  </SecondaryButton>
                  {loadError && (
                    <Mono className="text-[9.5px] tracking-[0.1em] text-[#A69C8D]">
                      {t('admin:invoiceBranding.loadFail.support', { detail: `GET /settings/invoice-branding · ${loadError}` })}
                    </Mono>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Never configured: the state that did not exist ──────────── */}
        {noLetterhead && (
          <div className="bg-white border border-[#E7E1D5] border-l-[3px] border-l-[#F97316] p-5" data-testid="invoice-branding-empty-notice">
            <div className="font-bt-heading font-bold text-[17px] text-[#0A0A0A]">{t('admin:invoiceBranding.noHeader.title')}</div>
            <p className="text-[13px] leading-[1.55] text-[#5A5346] mt-1.5 max-w-[70ch]">{t('admin:invoiceBranding.noHeader.body')}</p>
            <ol className="mt-3 flex flex-col gap-1.5 max-w-[70ch]">
              {['a', 'b', 'c'].map((k, i) => (
                <li key={k} className="flex items-start gap-2.5 text-[13px] leading-[1.5] text-[#0A0A0A]">
                  <Mono className="text-[10px] text-[#F97316] pt-[3px]">{i + 1}</Mono>
                  <span>{t(`admin:invoiceBranding.noHeader.${k}` as const)}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 items-start">
          {/* ── Form ──────────────────────────────────────────────────── */}
          <form
            className="bg-white border border-[#E7E1D5] p-5 md:p-6"
            onSubmit={e => { e.preventDefault(); if (canSave) void handleSave(); }}
            noValidate
          >
            <Mono className="block text-[10px] font-semibold tracking-[0.14em] text-[#8A8175]">{t('admin:invoiceBranding.formTitle')}</Mono>
            <p className="text-[13px] leading-[1.55] text-[#5A5346] mt-2 max-w-[62ch]">{t('admin:invoiceBranding.formHintLong')}</p>

            {/* Logo */}
            <div className="mt-6" data-tour="sec.invoice-branding.logo">
              <FieldLabel>{t('admin:invoiceBranding.logo')}</FieldLabel>
              <div className="flex items-start gap-4 flex-wrap">
                <div className={cn(
                  'flex h-20 w-20 items-center justify-center overflow-hidden border bg-[#FAF7F0] flex-shrink-0',
                  locked ? 'border-dashed border-[#DBD0BB]' : 'border-[#DBD0BB]',
                )}>
                  {logoDataUrl ? (
                    <img
                      src={logoDataUrl}
                      alt={t('admin:invoiceBranding.logoAlt')}
                      data-testid="invoice-branding-logo-preview"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <ImagePlus className="h-6 w-6 text-[#B4A992]" aria-hidden="true" />
                  )}
                </div>
                <div className="flex flex-col gap-2 min-w-0">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg"
                    className="hidden"
                    onChange={pickLogo}
                    disabled={locked}
                    data-testid="invoice-branding-logo-input"
                  />
                  <div className="flex items-center gap-2 flex-wrap">
                    <SecondaryButton disabled={locked} onClick={() => fileInputRef.current?.click()} className="bg-[#FAF7F0]">
                      <ImagePlus className="w-3.5 h-3.5" aria-hidden="true" />
                      {logoDataUrl ? t('admin:invoiceBranding.replaceLogo') : t('admin:invoiceBranding.uploadLogo')}
                    </SecondaryButton>
                    {logoDataUrl && !locked && (
                      <DestroyButton onClick={() => setConfirmRemove(true)}>{t('admin:invoiceBranding.removeLogo')}</DestroyButton>
                    )}
                  </div>
                  <FieldHint className="normal-case tracking-normal text-[11.5px] text-[#8A8175] max-w-[46ch]">
                    {t('admin:invoiceBranding.logoHintLong')}
                  </FieldHint>
                  {logoError && <FieldError>{logoError}</FieldError>}
                </div>
              </div>
            </div>

            {/* Text fields */}
            <div className="mt-6 grid grid-cols-1 gap-4" data-tour="sec.invoice-branding.fields">
              {textField('companyName')}
              {textField('contactName')}
              {textField('address', { multiline: true })}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {textField('email', { type: 'email' })}
                {textField('phone')}
              </div>
            </div>
          </form>

          {/* ── Live preview ──────────────────────────────────────────── */}
          <div className="bg-white border border-[#E7E1D5] p-5 md:p-6">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <Mono className="block text-[10px] font-semibold tracking-[0.14em] text-[#8A8175]">{t('admin:invoiceBranding.previewTitle')}</Mono>
              {changed.count > 0 && (
                <Mono className="text-[9.5px] tracking-[0.1em] text-[#C2410C]">{t('admin:invoiceBranding.previewUnsaved')}</Mono>
              )}
            </div>
            <p className="text-[13px] leading-[1.55] text-[#5A5346] mt-2">{t('admin:invoiceBranding.previewHint')}</p>
            <div className="mt-4 overflow-hidden border border-[#DBD0BB] bg-[#F3EEE4]">
              {loadState === 'failed' ? (
                <div className="flex h-[420px] items-center justify-center px-6 text-center text-[13px] text-[#8A8175]">
                  {t('admin:invoiceBranding.previewUnavailable')}
                </div>
              ) : previewUrl ? (
                <iframe
                  title={t('admin:invoiceBranding.previewTitle')}
                  src={`${previewUrl}#toolbar=0&navpanes=0`}
                  className="h-[560px] w-full"
                  data-testid="invoice-branding-preview"
                />
              ) : (
                <div className="flex h-[560px] items-center justify-center text-sm text-[#8A8175]">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  {t('admin:invoiceBranding.previewLoading')}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── The bar that counts what is pending ─────────────────────── */}
        {loadState === 'ready' && (
          <div
            className="bg-[#0A0A0A] text-[#F5F1E8] px-4 md:px-5 py-3.5 flex items-center justify-between gap-4 flex-wrap"
            data-tour="sec.invoice-branding.save"
          >
            <Mono className="text-[10.5px] tracking-[0.1em] min-w-0">
              {savedAt
                ? t('admin:invoiceBranding.savedAt', { time: savedAt })
                : changed.count > 0
                  ? t('admin:invoiceBranding.pending', { count: changed.count })
                  : t('admin:invoiceBranding.noChanges')}
            </Mono>
            <div className="flex items-center gap-3 flex-shrink-0">
              {changed.count > 0 && (
                <TertiaryButton onClick={discard} className="text-[10px] text-[#B4A992] hover:text-[#F97316]">
                  {t('admin:invoiceBranding.discard')}
                </TertiaryButton>
              )}
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={!canSave}
                data-testid="invoice-branding-save"
                className={cn(
                  'inline-flex items-center justify-center gap-2 font-bt-mono text-[11.5px] font-semibold uppercase tracking-[0.09em] px-4 py-3 transition-colors',
                  'bg-[#F97316] text-[#0A0A0A] hover:bg-[#C2410C] hover:text-[#F5F1E8]',
                  'disabled:bg-[#3A342C] disabled:text-[#8A8175] disabled:cursor-not-allowed',
                  FOCUS_RING,
                )}
              >
                {saving
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  : <Save className="h-3.5 w-3.5" aria-hidden="true" />}
                {t('admin:invoiceBranding.save')}
              </button>
            </div>
          </div>
        )}
        {saveError && <PaperNote tone="red">{saveError}</PaperNote>}
      </div>

      {/* Removing the logo asks first: it also strips the team's app. */}
      <BtModal
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        width={460}
        kicker={t('admin:invoiceBranding.removeLogo')}
        kickerTone="red"
        title={t('admin:invoiceBranding.removeConfirm.title')}
        description={t('admin:invoiceBranding.removeConfirm.body')}
        footer={
          <>
            <SecondaryButton onClick={() => setConfirmRemove(false)}>{t('common:buttons.cancel')}</SecondaryButton>
            <DestroyButton
              data-testid="invoice-branding-remove-logo-confirm"
              onClick={() => { setPendingLogo(null); setLogoRemoved(true); setConfirmRemove(false); }}
            >
              {t('admin:invoiceBranding.removeLogo')}
            </DestroyButton>
          </>
        }
      />
    </>
  );
}
