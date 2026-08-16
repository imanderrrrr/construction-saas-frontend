// Admin screen: the tenant's APP identity — the name and logo the product
// wears in its own chrome (mobile splash/home/login, the web dashboard
// kicker).
//
// This screen exists because that identity used to have nowhere to live:
// `GET /api/v1/branding` answered from the INVOICE template, so filling in an
// invoice header silently rebranded the app. The "link to the invoice
// template" checkbox keeps that behaviour available — it is the default and
// what every tenant had before — but it is now a choice.
//
// The right-hand panel previews the live result the same way the invoice
// screen previews a PDF: it always shows what the app is ACTUALLY wearing, so
// ticking the checkbox visibly swaps the name and logo.

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ImagePlus, Link2, Loader2, Save, Trash2 } from 'lucide-react';

import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  getAppBranding,
  updateAppBranding,
  uploadAppLogo,
  fetchAppLogoDataUrl,
  fetchEffectiveLogoDataUrl,
  type AppBrandingSettings as AppBrandingDto,
} from '../services/appBranding';

const MAX_LOGO_BYTES = 2 * 1024 * 1024; // mirror of the backend cap
const ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg'];

export function AppBrandingSettings() {
  const { t } = useTranslation('admin');

  const [linked, setLinked] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [ownLogoUrl, setOwnLogoUrl] = useState<string | null>(null);
  const [effectiveName, setEffectiveName] = useState<string | null>(null);
  const [effectiveLogoUrl, setEffectiveLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Applies a server response to the form. The app's OWN name/logo are kept in
  // state even while linked, so unticking the checkbox restores them without a
  // round trip.
  const applySettings = async (dto: AppBrandingDto) => {
    setLinked(dto.linkedToInvoice);
    setDisplayName(dto.displayName ?? '');
    setEffectiveName(dto.effectiveName);
    const [own, effective] = await Promise.all([
      dto.hasLogo ? fetchAppLogoDataUrl() : Promise.resolve(null),
      dto.effectiveHasLogo ? fetchEffectiveLogoDataUrl() : Promise.resolve(null),
    ]);
    setOwnLogoUrl(own);
    setEffectiveLogoUrl(effective);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const dto = await getAppBranding();
        if (cancelled) return;
        await applySettings(dto);
      } catch {
        if (!cancelled) toast.error(t('appBranding.toastLoadError'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [t]);

  const persist = async (payload: Parameters<typeof updateAppBranding>[0]) => {
    const dto = await updateAppBranding(payload);
    await applySettings(dto);
    return dto;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await persist({
        linkedToInvoice: linked,
        displayName: displayName || null,
      });
      toast.success(t('appBranding.toastSaved'));
    } catch {
      toast.error(t('appBranding.toastSaveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      toast.error(t('appBranding.toastLogoType'));
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.error(t('appBranding.toastLogoSize'));
      return;
    }
    setUploadingLogo(true);
    try {
      const dto = await uploadAppLogo(file);
      await applySettings(dto);
      toast.success(t('appBranding.toastLogoSaved'));
    } catch {
      toast.error(t('appBranding.toastLogoError'));
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = async () => {
    setUploadingLogo(true);
    try {
      // The PUT replaces the whole settings object, so send the current form —
      // removing the logo must not revert an unsaved name or checkbox edit.
      await persist({
        linkedToInvoice: linked,
        displayName: displayName || null,
        removeLogo: true,
      });
      toast.success(t('appBranding.toastLogoRemoved'));
    } catch {
      toast.error(t('appBranding.toastSaveError'));
    } finally {
      setUploadingLogo(false);
    }
  };

  if (loading) {
    return <div className="animate-pulse h-64 bg-white rounded-xl border border-[#D4D4D8]" />;
  }

  // While linked the preview shows the invoice values the server resolved;
  // while unlinked it tracks the form so typing is reflected immediately.
  const previewName = linked
    ? effectiveName
    : (displayName || effectiveName);
  const previewLogo = linked ? effectiveLogoUrl : ownLogoUrl;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 items-start">
      {/* ── Form card ── */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] p-6">
        <h3 className="text-base font-semibold text-[#0A0A0A]">
          {t('appBranding.formTitle')}
        </h3>
        <p className="mt-1 text-sm text-[#71717A]">{t('appBranding.formHint')}</p>

        {/* Link-to-invoice checkbox */}
        <div className="mt-6 rounded-lg border border-[#D4D4D8] bg-[#FAFAFA] p-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="ab-linked"
              checked={linked}
              onCheckedChange={(v) => setLinked(v === true)}
              data-testid="app-branding-linked"
              className="mt-0.5"
            />
            <div className="min-w-0">
              <Label htmlFor="ab-linked" className="flex items-center gap-1.5 text-sm font-medium">
                <Link2 className="h-3.5 w-3.5 text-[#71717A]" aria-hidden="true" />
                {t('appBranding.linkLabel')}
              </Label>
              <p className="mt-1 text-xs text-[#71717A]">
                {linked ? t('appBranding.linkHintOn') : t('appBranding.linkHintOff')}
              </p>
            </div>
          </div>
        </div>

        {/* Logo — the app's OWN one. Disabled (not hidden) while linked, so it
            is obvious the value is still there and comes back on untick. */}
        <div className="mt-6">
          <Label className="text-sm font-medium">{t('appBranding.logo')}</Label>
          <div className="mt-2 flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border border-dashed border-[#D4D4D8] bg-[#FAFAFA]">
              {ownLogoUrl ? (
                <img
                  src={ownLogoUrl}
                  alt={t('appBranding.logoAlt')}
                  data-testid="app-branding-logo-preview"
                  className={`max-h-full max-w-full object-contain ${linked ? 'opacity-40' : ''}`}
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
                data-testid="app-branding-logo-input"
              />
              <Button
                type="button"
                variant="outline"
                className="h-9"
                disabled={uploadingLogo || linked}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploadingLogo
                  ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
                  : <ImagePlus className="mr-1.5 h-4 w-4" aria-hidden="true" />}
                {ownLogoUrl ? t('appBranding.replaceLogo') : t('appBranding.uploadLogo')}
              </Button>
              {ownLogoUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-8 justify-start px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                  disabled={uploadingLogo || linked}
                  onClick={handleRemoveLogo}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  {t('appBranding.removeLogo')}
                </Button>
              )}
              <p className="text-xs text-[#71717A]">{t('appBranding.logoHint')}</p>
            </div>
          </div>
        </div>

        {/* Name */}
        <div className="mt-6">
          <Label htmlFor="ab-name" className="text-sm font-medium">
            {t('appBranding.displayName')}
          </Label>
          <Input
            id="ab-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={150}
            disabled={linked}
            placeholder={t('appBranding.displayNamePh')}
            data-testid="app-branding-name"
            className="mt-1.5"
          />
          <p className="mt-1.5 text-xs text-[#71717A]">{t('appBranding.displayNameHint')}</p>
        </div>

        <div className="mt-6 flex items-center justify-end">
          <Button
            onClick={handleSave}
            disabled={saving}
            data-testid="app-branding-save"
            className="h-10 bg-[#F97316] px-5 text-white hover:bg-[#C2410C]"
          >
            {saving
              ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
              : <Save className="mr-1.5 h-4 w-4" aria-hidden="true" />}
            {t('appBranding.save')}
          </Button>
        </div>
      </div>

      {/* ── Live preview card ── */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] p-6">
        <h3 className="text-base font-semibold text-[#0A0A0A]">
          {t('appBranding.previewTitle')}
        </h3>
        <p className="mt-1 text-sm text-[#71717A]">
          {linked ? t('appBranding.previewHintLinked') : t('appBranding.previewHint')}
        </p>

        <div className="mt-4 space-y-4" data-testid="app-branding-preview">
          {/* Mobile splash / home header */}
          <div className="rounded-lg border border-[#D4D4D8] bg-[#F4F4F5] p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-[#71717A]">
              {t('appBranding.previewMobile')}
            </p>
            <div className="mt-3 flex flex-col items-center justify-center rounded-lg bg-white px-4 py-8">
              {previewLogo ? (
                <img
                  src={previewLogo}
                  alt={t('appBranding.logoAlt')}
                  className="mb-3 max-h-16 max-w-[60%] object-contain"
                />
              ) : (
                <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-xl bg-[#F97316] text-2xl font-semibold text-white">
                  {(previewName ?? 'B').trim().charAt(0).toUpperCase()}
                </div>
              )}
              <p
                className="max-w-full truncate text-base font-semibold text-[#0A0A0A]"
                data-testid="app-branding-preview-name"
              >
                {previewName || t('appBranding.previewNoName')}
              </p>
            </div>
          </div>

          {/* Web dashboard kicker */}
          <div className="rounded-lg border border-[#D4D4D8] bg-[#F4F4F5] p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-[#71717A]">
              {t('appBranding.previewWeb')}
            </p>
            <div className="mt-3 flex items-center gap-3 rounded-lg bg-white px-4 py-4">
              {previewLogo ? (
                <img
                  src={previewLogo}
                  alt={t('appBranding.logoAlt')}
                  className="h-9 w-9 shrink-0 object-contain"
                />
              ) : (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F97316] text-sm font-semibold text-white">
                  {(previewName ?? 'B').trim().charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#0A0A0A]">
                  {previewName || t('appBranding.previewNoName')}
                </p>
                <p className="text-xs text-[#71717A]">{t('appBranding.previewKicker')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
