// Admin screen: the tenant's invoice template (issuer branding). Configured
// ONCE here and applied to every invoice / change-order PDF the app
// generates (AccountsReceivable downloads + InvoiceManager live preview).
//
// The right-hand panel renders a live PDF preview with SAMPLE document data
// so the admin sees exactly how the header (name, contact, address, email,
// phone, logo) will look on real invoices while editing. The logo uploads
// immediately (PUT /logo); text fields persist on "Guardar".

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ImagePlus, Loader2, Save, Trash2 } from 'lucide-react';

import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import {
  getInvoiceBranding,
  updateInvoiceBranding,
  uploadInvoiceLogo,
  fetchInvoiceLogoDataUrl,
  invalidateInvoiceIssuer,
} from '../services/invoiceBranding';
import {
  invoicePdfPreviewUrl,
  type InvoiceIssuerPdf,
  type InvoicePdfData,
} from '../helpers/exportInvoicePdf';

const MAX_LOGO_BYTES = 2 * 1024 * 1024; // mirror of the backend cap
const ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg'];

/** Static sample document so the preview shows a realistic invoice. */
const SAMPLE_PDF_DATA: InvoicePdfData = {
  documentType: 'INVOICE',
  invoiceNumber: 'INV-0001',
  client: 'Cliente de ejemplo',
  project: 'Proyecto de ejemplo',
  issuedDate: '2026-07-01',
  dueDate: '2026-07-15',
  lineItems: [
    { description: 'Mano de obra', quantity: 40, unitPrice: 25, subtotal: 1000 },
    { description: 'Materiales', quantity: 1, unitPrice: 450, subtotal: 450 },
  ],
  subtotal: 1450,
  discount: 0,
  taxRate: 7,
  tax: 101.5,
  amount: 1551.5,
  notes: null,
};

interface FormState {
  companyName: string;
  contactName: string;
  address: string;
  email: string;
  phone: string;
}

const EMPTY_FORM: FormState = {
  companyName: '',
  contactName: '',
  address: '',
  email: '',
  phone: '',
};

export function InvoiceBrandingSettings() {
  const { t } = useTranslation('admin');

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const branding = await getInvoiceBranding();
        const logo = branding.hasLogo ? await fetchInvoiceLogoDataUrl() : null;
        if (cancelled) return;
        setForm({
          companyName: branding.companyName ?? '',
          contactName: branding.contactName ?? '',
          address: branding.address ?? '',
          email: branding.email ?? '',
          phone: branding.phone ?? '',
        });
        setLogoDataUrl(logo);
      } catch {
        if (!cancelled) toast.error(t('invoiceBranding.toastLoadError'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [t]);

  const setField = (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value }));

  // ── Live preview (sample invoice + CURRENT form values) ────────────
  const previewIssuer: InvoiceIssuerPdf = useMemo(() => ({
    name: form.companyName || null,
    contact: form.contactName || null,
    address: form.address || null,
    email: form.email || null,
    phone: form.phone || null,
    logoDataUrl,
  }), [form, logoDataUrl]);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  useEffect(() => {
    if (loading) return;
    const handle = setTimeout(() => {
      let url: string | null = null;
      try {
        url = invoicePdfPreviewUrl(SAMPLE_PDF_DATA, previewIssuer);
      } catch {
        url = null;
      }
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = url;
      setPreviewUrl(url);
    }, 350);
    return () => clearTimeout(handle);
  }, [previewIssuer, loading]);
  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  // ── Actions ────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      await updateInvoiceBranding({
        companyName: form.companyName || null,
        contactName: form.contactName || null,
        address: form.address || null,
        email: form.email || null,
        phone: form.phone || null,
      });
      invalidateInvoiceIssuer();
      toast.success(t('invoiceBranding.toastSaved'));
    } catch {
      toast.error(t('invoiceBranding.toastSaveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      toast.error(t('invoiceBranding.toastLogoType'));
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.error(t('invoiceBranding.toastLogoSize'));
      return;
    }
    setUploadingLogo(true);
    try {
      await uploadInvoiceLogo(file);
      const fresh = await fetchInvoiceLogoDataUrl();
      setLogoDataUrl(fresh);
      invalidateInvoiceIssuer();
      toast.success(t('invoiceBranding.toastLogoSaved'));
    } catch {
      toast.error(t('invoiceBranding.toastLogoError'));
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = async () => {
    setUploadingLogo(true);
    try {
      // The PUT replaces every text field too, so send the current form —
      // removing the logo must not wipe unsaved name/email/phone edits.
      await updateInvoiceBranding({
        companyName: form.companyName || null,
        contactName: form.contactName || null,
        address: form.address || null,
        email: form.email || null,
        phone: form.phone || null,
        removeLogo: true,
      });
      setLogoDataUrl(null);
      invalidateInvoiceIssuer();
      toast.success(t('invoiceBranding.toastLogoRemoved'));
    } catch {
      toast.error(t('invoiceBranding.toastSaveError'));
    } finally {
      setUploadingLogo(false);
    }
  };

  if (loading) {
    return <div className="animate-pulse h-64 bg-white rounded-xl border border-[#D4D4D8]" />;
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 items-start">
      {/* ── Form card ── */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] p-6">
        <h3 className="text-base font-semibold text-[#0A0A0A]">
          {t('invoiceBranding.formTitle')}
        </h3>
        <p className="mt-1 text-sm text-[#71717A]">{t('invoiceBranding.formHint')}</p>

        {/* Logo */}
        <div className="mt-6">
          <Label className="text-sm font-medium">{t('invoiceBranding.logo')}</Label>
          <div className="mt-2 flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border border-dashed border-[#D4D4D8] bg-[#FAFAFA]">
              {logoDataUrl ? (
                <img
                  src={logoDataUrl}
                  alt={t('invoiceBranding.logoAlt')}
                  data-testid="invoice-branding-logo-preview"
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <ImagePlus className="h-6 w-6 text-[#A1A1AA]" aria-hidden="true" />
              )}
            </div>
            <div className="flex flex-col gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={handleLogoFile}
                data-testid="invoice-branding-logo-input"
              />
              <Button
                type="button"
                variant="outline"
                className="h-9"
                disabled={uploadingLogo}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploadingLogo
                  ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
                  : <ImagePlus className="mr-1.5 h-4 w-4" aria-hidden="true" />}
                {logoDataUrl ? t('invoiceBranding.replaceLogo') : t('invoiceBranding.uploadLogo')}
              </Button>
              {logoDataUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-8 justify-start px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                  disabled={uploadingLogo}
                  onClick={handleRemoveLogo}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  {t('invoiceBranding.removeLogo')}
                </Button>
              )}
              <p className="text-xs text-[#71717A]">{t('invoiceBranding.logoHint')}</p>
            </div>
          </div>
        </div>

        {/* Text fields */}
        <div className="mt-6 grid grid-cols-1 gap-4">
          <div>
            <Label htmlFor="ib-company" className="text-sm font-medium">
              {t('invoiceBranding.companyName')}
            </Label>
            <Input
              id="ib-company"
              value={form.companyName}
              onChange={setField('companyName')}
              maxLength={150}
              placeholder={t('invoiceBranding.companyNamePh')}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="ib-contact" className="text-sm font-medium">
              {t('invoiceBranding.contactName')}
            </Label>
            <Input
              id="ib-contact"
              value={form.contactName}
              onChange={setField('contactName')}
              maxLength={150}
              placeholder={t('invoiceBranding.contactNamePh')}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="ib-address" className="text-sm font-medium">
              {t('invoiceBranding.address')}
            </Label>
            <Textarea
              id="ib-address"
              value={form.address}
              onChange={setField('address')}
              maxLength={300}
              rows={2}
              placeholder={t('invoiceBranding.addressPh')}
              className="mt-1.5"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="ib-email" className="text-sm font-medium">
                {t('invoiceBranding.email')}
              </Label>
              <Input
                id="ib-email"
                type="email"
                value={form.email}
                onChange={setField('email')}
                maxLength={150}
                placeholder={t('invoiceBranding.emailPh')}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="ib-phone" className="text-sm font-medium">
                {t('invoiceBranding.phone')}
              </Label>
              <Input
                id="ib-phone"
                value={form.phone}
                onChange={setField('phone')}
                maxLength={50}
                placeholder={t('invoiceBranding.phonePh')}
                className="mt-1.5"
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end">
          <Button
            onClick={handleSave}
            disabled={saving}
            data-testid="invoice-branding-save"
            className="h-10 bg-[#F97316] px-5 text-white hover:bg-[#C2410C]"
          >
            {saving
              ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
              : <Save className="mr-1.5 h-4 w-4" aria-hidden="true" />}
            {t('invoiceBranding.save')}
          </Button>
        </div>
      </div>

      {/* ── Live preview card ── */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] p-6">
        <h3 className="text-base font-semibold text-[#0A0A0A]">
          {t('invoiceBranding.previewTitle')}
        </h3>
        <p className="mt-1 text-sm text-[#71717A]">{t('invoiceBranding.previewHint')}</p>
        <div className="mt-4 overflow-hidden rounded-lg border border-[#D4D4D8] bg-[#F4F4F5]">
          {previewUrl ? (
            <iframe
              title={t('invoiceBranding.previewTitle')}
              src={`${previewUrl}#toolbar=0&navpanes=0`}
              className="h-[560px] w-full"
              data-testid="invoice-branding-preview"
            />
          ) : (
            <div className="flex h-[560px] items-center justify-center text-sm text-[#71717A]">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              {t('invoiceBranding.previewLoading')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
