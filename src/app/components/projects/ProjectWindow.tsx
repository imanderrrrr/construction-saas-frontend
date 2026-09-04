import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  createProject as apiCreateProject, updateProject as apiUpdateProject,
  type CreateProjectPayload, type ProjectResponse, type UpdateProjectPayload,
} from '../../services/projects';
import { ApiError } from '../../lib/api';
import { fmtDate } from '../../helpers/dateTime';
import { FIELD_LIMITS } from '../../../shared/fieldLimits';
import { cn } from '../ui/utils';
import { CreateClientDialog } from '../CreateClientDialog';
import { CloseButton, InkBar, PrimaryButton, SecondaryButton } from '../onboarding/chrome';
import { FieldError, FieldHint, FieldLabel, INPUT, INPUT_ERROR, INPUT_MONO, Mono, PaperNote } from './bt';
import { ClientSelector } from './form/ClientSelector';
import { AddressAutocomplete } from './form/AddressAutocomplete';
import { LocationMap } from './form/LocationMap';
import { GeofenceSlider } from './form/GeofenceSlider';
import type { Project } from './types';

/**
 * Create / edit a project — a full-screen window, not a modal (Claude Design
 * "Proyectos BuildTrack", 02-CREAR / 02C-EDITAR / 02B-MOBILE).
 *
 * One canvas, no stepper: the data is short and the map needs to see the
 * address and the coordinates at the same time. Two columns on desktop —
 * the form on the left, the map pinned on the right — and every field
 * measures what its data measures: a 220 px money box, a 200 px cost code,
 * two 170 px coordinates. Only the name and the contract amount are
 * required on create; everything else can be completed later.
 */

interface FormState {
  name: string;
  clientId: number | null;
  costCode: string;
  contractAmount: string; // display string, e.g. "1,500,000.00"
  costBudget: string;     // what the company plans to SPEND; blank = not set
  address: string;
  latitude: string;
  longitude: string;
  geofenceRadiusMeters: number;
}

const INITIAL: FormState = {
  name: '', clientId: null, costCode: '', contractAmount: '', costBudget: '',
  address: '', latitude: '', longitude: '', geofenceRadiusMeters: 200,
};

function centsToDollars(cents: number | null | undefined): string {
  if (cents == null) return '';
  return (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function dollarsToCents(dollars: string): number | undefined {
  const cleaned = dollars.replace(/[^0-9.]/g, '');
  if (!cleaned) return undefined;
  const num = parseFloat(cleaned);
  if (isNaN(num) || num < 0) return undefined;
  return Math.round(num * 100);
}

function formatUSD(value: string): string {
  const num = parseFloat(value.replace(/[^0-9.]/g, ''));
  if (isNaN(num)) return '';
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const isValidLat = (v: string) => !v || (!isNaN(parseFloat(v)) && parseFloat(v) >= -90 && parseFloat(v) <= 90);
const isValidLng = (v: string) => !v || (!isNaN(parseFloat(v)) && parseFloat(v) >= -180 && parseFloat(v) <= 180);

function apiErrorMsg(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'An unexpected error occurred';
}

/** Numbered section rule: "01 IDENTIFICACIÓN ────". */
function SectionRule({ n, label }: { n: string; label: string }) {
  return (
    <div className="flex items-center gap-[9px] mb-3.5">
      <span className="w-5 h-5 flex items-center justify-center bg-[#0A0A0A] text-[#F5F1E8] font-bt-mono text-[10px] font-semibold">{n}</span>
      <Mono className="text-[10.5px] font-semibold tracking-[0.14em] text-[#5A5346]">{label}</Mono>
      <span className="flex-1 h-px bg-[#DBD0BB]" />
    </div>
  );
}

/** "$" cell + right-aligned mono amount. */
function MoneyInput({ id, value, onChange, onBlur, placeholder, disabled, required }: {
  id: string; value: string; onChange: (v: string) => void; onBlur: () => void; placeholder?: string; disabled?: boolean; required?: boolean;
}) {
  return (
    <div className={cn('flex h-10 border border-[#DBD0BB] bg-white focus-within:border-[#F97316]', disabled && 'bg-[#F3EEE4]')}>
      <span className="w-8 flex items-center justify-center bg-[#FAF7F0] border-r border-[#DBD0BB] font-bt-mono text-[13px] text-[#5A5346]">$</span>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        value={value}
        onChange={e => onChange(e.target.value.replace(/[^0-9.,]/g, ''))}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        className={cn('flex-1 min-w-0 border-0 bg-transparent px-3 text-right outline-none font-bt-mono text-[14px] tracking-[0.02em] text-[#0A0A0A] placeholder:font-sans placeholder:text-[12px] placeholder:text-[#A69C8D] disabled:text-[#8A8175]')}
      />
    </div>
  );
}

/** "Los campos con * son obligatorios" with the asterisk painted orange, in place. */
function RequiredNote({ text }: { text: string }) {
  const i = text.indexOf('*');
  if (i < 0) return <>{text}</>;
  return <>{text.slice(0, i)}<span className="text-[#F97316]">*</span>{text.slice(i + 1)}</>;
}

export function ProjectWindow({ onClose, onSaved, editProject }: {
  onClose: () => void;
  onSaved: (project: ProjectResponse) => void;
  /** If provided, the window edits this project. */
  editProject?: Project | null;
}) {
  const { t, i18n } = useTranslation(['admin', 'common']);
  const isEdit = !!editProject;
  const [form, setForm] = useState<FormState>(() => editProject ? {
    name: editProject.name,
    clientId: editProject.clientId ?? null,
    costCode: editProject.costCode ?? '',
    contractAmount: centsToDollars(editProject.originalContractCents ?? editProject.contractAmountCents),
    // Blank when unset — never pre-filled from the contract, which is the
    // conflation this field exists to undo.
    costBudget: editProject.costBudgetCents != null ? centsToDollars(editProject.costBudgetCents) : '',
    address: editProject.address ?? '',
    latitude: editProject.latitude != null ? String(editProject.latitude) : '',
    longitude: editProject.longitude != null ? String(editProject.longitude) : '',
    geofenceRadiusMeters: editProject.geofenceRadiusMeters ?? 200,
  } : INITIAL);
  const [clientName, setClientName] = useState(editProject?.clientName ?? '');
  const [nameError, setNameError] = useState('');
  const [contractError, setContractError] = useState('');
  const [saving, setSaving] = useState(false);
  const [clientCreateOpen, setClientCreateOpen] = useState(false);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    if (key === 'name') setNameError('');
    if (key === 'contractAmount') setContractError('');
  };

  // Escape closes, unless a save is in flight.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving && !clientCreateOpen) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving, clientCreateOpen]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    let bad = false;
    if (!form.name.trim()) { setNameError(t('admin:projectForm.projectNameRequired')); bad = true; }
    if (!isEdit && !dollarsToCents(form.contractAmount)) { setContractError(t('admin:projectForm.contractAmountRequired')); bad = true; }
    if (bad) return;
    if (!isValidLat(form.latitude)) { toast.error(t('admin:projectForm.invalidLat')); return; }
    if (!isValidLng(form.longitude)) { toast.error(t('admin:projectForm.invalidLng')); return; }

    setSaving(true);
    try {
      const cents = dollarsToCents(form.contractAmount);
      const budgetCents = dollarsToCents(form.costBudget);
      if (isEdit && editProject) {
        const payload: UpdateProjectPayload = {};
        if (form.name.trim() !== editProject.name) payload.name = form.name.trim();
        if (form.clientId !== editProject.clientId) payload.clientId = form.clientId ?? undefined;
        if (form.costCode !== (editProject.costCode ?? '')) payload.costCode = form.costCode || undefined;
        if (cents !== (editProject.originalContractCents ?? editProject.contractAmountCents)) payload.contractAmountCents = cents;
        // Sends 0 when the field is cleared: a PATCH cannot say null, and 0
        // is what the backend reads as "no budget".
        if (budgetCents !== (editProject.costBudgetCents ?? null)) payload.costBudgetCents = budgetCents ?? 0;
        if (form.address !== (editProject.address ?? '')) payload.address = form.address || undefined;
        if (form.latitude && parseFloat(form.latitude) !== editProject.latitude) payload.latitude = parseFloat(form.latitude);
        if (form.longitude && parseFloat(form.longitude) !== editProject.longitude) payload.longitude = parseFloat(form.longitude);
        if (form.geofenceRadiusMeters !== editProject.geofenceRadiusMeters) payload.geofenceRadiusMeters = form.geofenceRadiusMeters;
        const updated = await apiUpdateProject(editProject.id, payload);
        onSaved(updated);
        toast.success(t('admin:projectForm.projectUpdated'), { description: t('admin:projectForm.projectUpdatedDesc', { name: updated.name }) });
      } else {
        const payload: CreateProjectPayload = {
          name: form.name.trim(),
          ...(form.clientId && { clientId: form.clientId }),
          ...(form.costCode && { costCode: form.costCode }),
          contractAmountCents: cents ?? 0, // guaranteed by the guard above
          ...(budgetCents != null && { costBudgetCents: budgetCents }),
          ...(form.address && { address: form.address }),
          ...(form.latitude && { latitude: parseFloat(form.latitude) }),
          ...(form.longitude && { longitude: parseFloat(form.longitude) }),
          ...(form.geofenceRadiusMeters !== 200 && { geofenceRadiusMeters: form.geofenceRadiusMeters }),
        };
        const created = await apiCreateProject(payload);
        onSaved(created);
        toast.success(t('admin:projectForm.projectCreated'), { description: t('admin:projectForm.projectCreatedDesc', { name: created.name }) });
      }
      onClose();
    } catch (err) {
      const msg = apiErrorMsg(err);
      if (err instanceof ApiError && err.status === 409) toast.error(t('admin:projectForm.conflict'), { description: msg });
      else if (err instanceof ApiError && err.status === 403) toast.error(t('admin:projectForm.noPermission'), { description: msg });
      else toast.error(isEdit ? t('admin:projectForm.errorUpdating') : t('admin:projectForm.errorCreating'), { description: msg });
      setSaving(false);
    }
  };

  const hasCoords = !!(form.latitude && form.longitude);
  const latBad = !!form.latitude && !isValidLat(form.latitude);
  const lngBad = !!form.longitude && !isValidLng(form.longitude);

  const addressField = (
    <div>
      <FieldLabel htmlFor="project-address">{t('admin:projectForm.address')}</FieldLabel>
      <AddressAutocomplete
        id="project-address"
        value={form.address}
        onChange={v => update('address', v)}
        onSelect={(address, lat, lng) => setForm(prev => ({ ...prev, address, latitude: lat, longitude: lng }))}
        hasCoords={hasCoords}
        disabled={saving}
      />
      <FieldHint className="hidden md:block">{t('admin:projectForm.addressHint')}</FieldHint>
      <FieldHint className="md:hidden">{t('admin:projectForm.addressHintMobile')}</FieldHint>
    </div>
  );
  const mapField = (className: string) => (
    <LocationMap
      lat={form.latitude}
      lng={form.longitude}
      radius={form.geofenceRadiusMeters}
      onLocationChange={(lat, lng) => setForm(prev => ({ ...prev, latitude: lat, longitude: lng }))}
      className={className}
    />
  );
  const coordsField = (
    <div className="flex gap-3.5 items-start flex-wrap">
      <div className="w-[170px] max-w-full">
        <FieldLabel htmlFor="project-lat">{t('admin:projectForm.latitude')}</FieldLabel>
        <input id="project-lat" type="text" inputMode="decimal" value={form.latitude} onChange={e => update('latitude', e.target.value)} placeholder="20.674389" disabled={saving}
          className={cn(INPUT, INPUT_MONO, 'text-[13px]', latBad && INPUT_ERROR)} />
        {latBad && <FieldError>{t('admin:projectForm.invalidLat')}</FieldError>}
      </div>
      <div className="w-[170px] max-w-full">
        <FieldLabel htmlFor="project-lng">{t('admin:projectForm.longitude')}</FieldLabel>
        <input id="project-lng" type="text" inputMode="decimal" value={form.longitude} onChange={e => update('longitude', e.target.value)} placeholder="-103.338880" disabled={saving}
          className={cn(INPUT, INPUT_MONO, 'text-[13px]', lngBad && INPUT_ERROR)} />
        {lngBad && <FieldError>{t('admin:projectForm.invalidLng')}</FieldError>}
      </div>
      <FieldHint className="flex-1 min-w-[240px] md:pt-[26px] mt-0 leading-[1.6] normal-case">{t('admin:projectForm.mapHint')}</FieldHint>
    </div>
  );
  const geofenceField = <GeofenceSlider value={form.geofenceRadiusMeters} onChange={v => update('geofenceRadiusMeters', v)} disabled={saving} />;

  return (
    <div className="fixed inset-0 z-[90] bg-[#FAFAFA] flex flex-col" role="dialog" aria-modal="true" aria-labelledby="project-window-title">
      {/* Ink bar */}
      <InkBar className="px-4 pt-3.5 pb-4 md:px-7 md:pt-[18px] md:pb-5 flex-shrink-0">
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Mono className="block text-[9px] md:text-[10px] font-semibold tracking-[0.14em] text-[#F97316]">
              {isEdit ? t('admin:projectForm.editKicker', { name: editProject?.name }) : t('admin:projectForm.createKicker')}
            </Mono>
            <h2 id="project-window-title" className="font-bt-display font-extrabold uppercase text-[28px] md:text-[38px] leading-none tracking-[0.01em] text-[#F5F1E8] mt-2">
              {isEdit ? t('admin:projectForm.editTitle') : t('admin:projectForm.createTitle')}
            </h2>
            {isEdit && editProject ? (
              <Mono className="block text-[10px] tracking-[0.1em] text-[#F5F1E8]/55 mt-2 truncate">
                {[editProject.costCode, t('admin:projectForm.editStamp', { date: fmtDate(editProject.createdAt, i18n.language), id: editProject.id })].filter(Boolean).join(' · ')}
              </Mono>
            ) : (
              <p className="text-[12.5px] md:text-[13.5px] text-[#F5F1E8]/70 mt-2 max-w-[560px] leading-[1.5]">{t('admin:projectForm.createDescription')}</p>
            )}
          </div>
          <CloseButton onDark onClick={onClose} disabled={saving} aria-label={t('common:buttons.close')} className="w-8 h-8" />
        </div>
      </InkBar>

      <form id="project-window-form" onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-[7fr_5fr] gap-6 md:gap-7 px-4 py-5 md:px-7 md:py-6 max-w-[1400px]">
          {/* Left: identity, money, coordinates */}
          <div className="flex flex-col gap-5 min-w-0">
            <section>
              <SectionRule n="01" label={t('admin:projectForm.sec1')} />
              <div className="flex flex-col gap-3.5">
                <div>
                  <FieldLabel htmlFor="project-name" required>{t('admin:projectForm.projectName')}</FieldLabel>
                  <input id="project-name" value={form.name} onChange={e => update('name', e.target.value)} placeholder={t('admin:projectForm.projectNamePlaceholder')}
                    maxLength={FIELD_LIMITS.SHORT_NAME} disabled={saving} autoFocus className={cn(INPUT, nameError && INPUT_ERROR)} />
                  {nameError && <FieldError>{nameError}</FieldError>}
                </div>
                {/* Phone: the contract right after the name, the two required fields together. */}
                <div className="md:hidden">
                  <FieldLabel htmlFor="project-contract-m" required={!isEdit}>{t('admin:projectForm.contractAmount')}</FieldLabel>
                  <MoneyInput id="project-contract-m" value={form.contractAmount} onChange={v => update('contractAmount', v)} onBlur={() => { if (form.contractAmount) update('contractAmount', formatUSD(form.contractAmount)); }} placeholder="0.00" disabled={saving} />
                  {contractError && <FieldError>{contractError}</FieldError>}
                </div>
                <div className="flex gap-3.5 flex-wrap">
                  <div className="w-full md:w-[200px]">
                    <FieldLabel htmlFor="project-code">{t('admin:projectForm.costCode')}</FieldLabel>
                    <input id="project-code" value={form.costCode} onChange={e => update('costCode', e.target.value.toUpperCase())} placeholder={t('admin:projectForm.costCodePlaceholder')}
                      maxLength={30} disabled={saving} className={cn(INPUT, INPUT_MONO, 'uppercase')} />
                    <FieldHint>{t('admin:projectForm.costCodeHint')}</FieldHint>
                  </div>
                  <div className="flex-1 min-w-[260px]">
                    <FieldLabel>{t('admin:projectForm.client')}</FieldLabel>
                    <ClientSelector value={form.clientId} valueName={clientName} onChange={(id, name) => { update('clientId', id); setClientName(name); }} disabled={saving} onRequestCreateClient={() => setClientCreateOpen(true)} />
                  </div>
                </div>
              </div>
            </section>

            <section className="hidden md:block">
              <SectionRule n="02" label={t('admin:projectForm.sec2')} />
              <div className="flex gap-5 flex-wrap">
                <div className="w-[220px]">
                  <FieldLabel htmlFor="project-contract" required={!isEdit}>{t('admin:projectForm.contractAmount')}</FieldLabel>
                  <MoneyInput id="project-contract" value={form.contractAmount} onChange={v => update('contractAmount', v)} onBlur={() => { if (form.contractAmount) update('contractAmount', formatUSD(form.contractAmount)); }} placeholder="0.00" disabled={saving} />
                  {contractError ? <FieldError>{contractError}</FieldError> : <FieldHint>{t('admin:projectForm.contractHint')}</FieldHint>}
                </div>
                <div className="w-[220px]">
                  <FieldLabel htmlFor="project-budget">{t('admin:projectForm.costBudget')}</FieldLabel>
                  <MoneyInput id="project-budget" value={form.costBudget} onChange={v => update('costBudget', v)} onBlur={() => { if (form.costBudget) update('costBudget', formatUSD(form.costBudget)); }} placeholder={t('admin:projectForm.costBudgetPlaceholder')} disabled={saving} />
                </div>
                <PaperNote className="flex-1 min-w-[260px]">
                  <Mono className="block text-[9.5px] font-semibold tracking-[0.12em] text-[#8A8175] mb-[5px]">{t('admin:projectForm.costBudgetPanelTitle')}</Mono>
                  {t('admin:projectForm.costBudgetHint')}
                </PaperNote>
              </div>
            </section>

            <section className="hidden md:block">
              <SectionRule n="03" label={t('admin:projectForm.sec3')} />
              {coordsField}
            </section>
          </div>

          {/* Right: address, map, geofence (desktop, sticky) */}
          <div className="hidden md:flex flex-col gap-3.5 min-w-0 md:sticky md:top-0 self-start">
            {addressField}
            {mapField('h-[380px] flex-shrink-0 xl:h-[440px]')}
            {geofenceField}
          </div>

          {/* Phone: one column, the map between the address and the coordinates */}
          <div className="md:hidden flex flex-col gap-3.5">
            {addressField}
            {mapField('h-[220px]')}
            {coordsField}
            {geofenceField}
            <div>
              <FieldLabel htmlFor="project-budget-m">{t('admin:projectForm.costBudget')}</FieldLabel>
              <MoneyInput id="project-budget-m" value={form.costBudget} onChange={v => update('costBudget', v)} onBlur={() => { if (form.costBudget) update('costBudget', formatUSD(form.costBudget)); }} placeholder={t('admin:projectForm.costBudgetPlaceholder')} disabled={saving} />
              <FieldHint className="normal-case">{t('admin:projectForm.costBudgetHint')}</FieldHint>
            </div>
          </div>
        </div>
      </form>

      {/* Footer */}
      <div className="border-t border-[#DBD0BB] bg-[#FAF7F0] px-4 py-3.5 md:px-7 flex flex-col-reverse gap-2.5 md:flex-row md:items-center md:justify-between flex-shrink-0">
        <Mono className="text-[10px] tracking-[0.1em] text-[#8A8175] hidden md:block">
          {saving ? t('admin:projectForm.savingLocked') : <RequiredNote text={t('admin:projectForm.requiredNote')} />}
        </Mono>
        <div className="flex flex-col-reverse md:flex-row gap-2.5">
          <SecondaryButton onClick={onClose} disabled={saving} className="w-full md:w-auto py-3.5 md:py-[11px] md:px-4">{t('common:buttons.cancel')}</SecondaryButton>
          <PrimaryButton type="submit" form="project-window-form" disabled={saving} className="w-full md:w-auto py-[15px] md:py-[11px] md:px-[18px]">
            {saving
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />{isEdit ? t('admin:projectForm.saving') : t('admin:projectForm.creating')}</>
              : isEdit
                ? t('admin:projectForm.saveChanges')
                : <>{t('admin:projectForm.createProject')}<ArrowRight className="w-3.5 h-3.5" strokeWidth={2} /></>}
          </PrimaryButton>
        </div>
      </div>

      <CreateClientDialog
        open={clientCreateOpen}
        onClose={() => setClientCreateOpen(false)}
        onCreated={client => { update('clientId', client.id); setClientName(client.name); setClientCreateOpen(false); }}
      />
    </div>
  );
}
