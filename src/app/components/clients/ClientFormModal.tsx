import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { createClient, listClients, updateClient, type ClientResponse, type UpdateClientPayload } from '../../services/clients';
import { ApiError } from '../../lib/api';
import { FIELD_LIMITS } from '../../../shared/fieldLimits';
import { cn } from '../ui/utils';
import { PrimaryButton, SecondaryButton } from '../onboarding/chrome';
import { BtModal } from '../bt/windows';
import { FieldError, FieldHint, FieldLabel, INPUT, INPUT_ERROR, INPUT_MONO, Mono, PaperNote, stampDay } from '../projects/bt';
import { activeCount, closedCount } from './bits';

/**
 * Create / edit a client — one 460 px modal with two modes (Claude Design
 * "Clientes BuildTrack" 03 / 03B). It replaces the two dialogs that used to
 * drift apart, and serves the jobsite window too: there only the kicker
 * changes and a note says you land back in the form with the client picked.
 *
 * Only the name is required. The phone stopped being mandatory (nothing else
 * in the system required it, so a client created from a jobsite could not be
 * edited here without inventing a number). Two fields that lived in the
 * database for years get a screen for the first time: the contact person
 * and the tax id — labelled "Identificación fiscal" (NIT / RUC; the column is
 * called `rfc` by inheritance and that name is never shown).
 *
 * A server failure keeps the modal open with everything typed and a paper
 * band on top; what you typed is never lost.
 */

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** 6–30 characters of digits, spaces and the usual separators — or nothing at all. */
export const PHONE_RE = /^[+\d\s\-().]{6,30}$/;
/** How long the name must sit still before we ask the server whether it already exists. */
const DUPLICATE_QUIET_MS = 400;

type Field = 'name' | 'contact' | 'rfc' | 'phone' | 'email';
type Values = Record<Field, string>;
const OPTIONAL: readonly Exclude<Field, 'name'>[] = ['contact', 'rfc', 'phone', 'email'];
const EMPTY: Values = { name: '', contact: '', rfc: '', phone: '', email: '' };
const LIMITS: Record<Field, number> = { name: 200, contact: 200, rfc: 20, phone: FIELD_LIMITS.PHONE, email: FIELD_LIMITS.CLIENT_EMAIL };

function fromClient(c: ClientResponse): Values {
  return { name: c.name, contact: c.contact ?? '', rfc: c.rfc ?? '', phone: c.phone ?? '', email: c.email ?? '' };
}

export type ClientFormMode = 'create' | 'edit';

export function ClientFormModal({ open, onOpenChange, client = null, origin = 'section', onSaved }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present = edit mode. */
  client?: ClientResponse | null;
  /** 'project' = opened from the jobsite window: kicker and closing note change. */
  origin?: 'section' | 'project';
  onSaved: (client: ClientResponse, mode: ClientFormMode) => void;
}) {
  const { t, i18n } = useTranslation(['admin', 'common']);
  const isEdit = !!client;
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState(false);
  const [duplicate, setDuplicate] = useState<string | null>(null);

  // Fresh form every time the modal opens: blank for a new client, the
  // client's data for an edit.
  useEffect(() => {
    if (!open) return;
    setValues(client ? fromClient(client) : EMPTY);
    setErrors({});
    setServerError(false);
    setDuplicate(null);
    setSaving(false);
  }, [open, client]);

  // 03B: "Ya existe un cliente llamado «…». Puedes crearlo igual." — an exact
  // (case-insensitive) match against the server, asked once the name rests.
  useEffect(() => {
    const name = values.name.trim();
    const unchanged = !!client && name.toLowerCase() === client.name.trim().toLowerCase();
    if (!open || name.length < 2 || unchanged) { setDuplicate(null); return; }
    // A warning about a different name than the one on screen is stale: drop
    // it now rather than after the next round trip.
    setDuplicate(prev => (prev && prev.trim().toLowerCase() === name.toLowerCase() ? prev : null));
    let cancelled = false;
    const timer = window.setTimeout(() => {
      listClients(name, undefined, 0, 10)
        .then(page => {
          if (cancelled) return;
          const hit = page.content.find(c => c.id !== client?.id && c.name.trim().toLowerCase() === name.toLowerCase());
          setDuplicate(hit ? hit.name : null);
        })
        .catch(() => { if (!cancelled) setDuplicate(null); });
    }, DUPLICATE_QUIET_MS);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [open, values.name, client]);

  const set = (field: Field) => (e: { target: { value: string } }) => {
    setValues(prev => ({ ...prev, [field]: e.target.value }));
    setErrors(prev => (prev[field] ? { ...prev, [field]: undefined } : prev));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const v: Values = {
      name: values.name.trim(), contact: values.contact.trim(), rfc: values.rfc.trim(), phone: values.phone.trim(), email: values.email.trim(),
    };
    const next: Partial<Record<Field, string>> = {};
    if (!v.name) next.name = t('admin:clients.form.nameRequired');
    if (v.phone && !PHONE_RE.test(v.phone)) next.phone = t('admin:clients.form.phoneInvalid');
    if (v.email && !EMAIL_RE.test(v.email)) next.email = t('admin:clients.form.emailInvalid');
    if (Object.keys(next).length > 0) { setErrors(next); return; }

    setSaving(true);
    setServerError(false);
    try {
      let saved: ClientResponse;
      if (client) {
        // A PATCH of what moved; an emptied field travels as "" — the
        // backend's "clear it" convention.
        const payload: UpdateClientPayload = {};
        if (v.name !== client.name) payload.name = v.name;
        for (const f of OPTIONAL) if (v[f] !== (client[f] ?? '')) payload[f] = v[f];
        saved = Object.keys(payload).length > 0 ? await updateClient(client.id, payload) : client;
      } else {
        saved = await createClient({
          name: v.name,
          ...(v.contact && { contact: v.contact }),
          ...(v.rfc && { rfc: v.rfc }),
          ...(v.phone && { phone: v.phone }),
          ...(v.email && { email: v.email }),
        });
      }
      onSaved(saved, client ? 'edit' : 'create');
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 400 && err.details) {
        const fieldErrors: Partial<Record<Field, string>> = {};
        for (const f of ['name', ...OPTIONAL] as Field[]) if (err.details[f]) fieldErrors[f] = err.details[f];
        if (Object.keys(fieldErrors).length > 0) { setErrors(fieldErrors); return; }
      }
      setServerError(true);
    } finally {
      setSaving(false);
    }
  };

  const kicker = origin === 'project'
    ? t('admin:clients.form.kickerProject')
    : isEdit ? t('admin:clients.form.kickerEdit') : t('admin:clients.form.kickerNew');
  const jobsites = client ? activeCount(client) + closedCount(client) : 0;
  const nameHint = !client
    ? t('admin:clients.form.nameHint')
    : jobsites > 0 ? t('admin:clients.form.nameHintEdit', { count: jobsites }) : t('admin:clients.form.nameHintEditNone');
  // New on sand, edit on white — the sheet's cue for which mode you are in.
  const input = (field: Field, mono = false) => cn(INPUT, !isEdit && 'bg-[#FAF7F0]', mono && INPUT_MONO, errors[field] && INPUT_ERROR);

  return (
    <BtModal
      open={open}
      onOpenChange={o => { if (!o) onOpenChange(false); }}
      width={460}
      kicker={kicker}
      title={client ? client.name : t('admin:clients.form.titleNew')}
      dismissible={false}
      closeDisabled={saving}
      footer={(
        <>
          <Mono className="text-[9.5px] tracking-[0.1em] text-[#8A8175] md:mr-auto">
            {client ? t('admin:clients.form.since', { date: stampDay(client.createdAt, i18n.language) }) : t('admin:clients.form.onlyName')}
          </Mono>
          <SecondaryButton onClick={() => onOpenChange(false)} disabled={saving} className="px-4 py-[11px]">{t('common:buttons.cancel')}</SecondaryButton>
          <PrimaryButton type="submit" form="client-form" disabled={saving} className="px-[18px] py-[11px]">
            {saving
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />{isEdit ? t('admin:clients.form.saving') : t('admin:clients.form.creating')}</>
              : isEdit ? t('admin:clients.form.submitEdit') : t('admin:clients.form.submitNew')}
          </PrimaryButton>
        </>
      )}
    >
      <form id="client-form" onSubmit={submit} noValidate className="flex flex-col gap-3.5" data-testid="client-form">
        {serverError && <div role="alert"><PaperNote tone="red">{t('admin:clients.form.error')}</PaperNote></div>}

        <div>
          <FieldLabel htmlFor="client-name" required>{t('admin:clients.form.name')}</FieldLabel>
          <input
            id="client-name"
            value={values.name}
            onChange={set('name')}
            placeholder={t('admin:clients.form.namePlaceholder')}
            maxLength={LIMITS.name}
            disabled={saving}
            autoFocus
            aria-invalid={errors.name ? 'true' : 'false'}
            className={input('name')}
          />
          {errors.name ? <FieldError>{errors.name}</FieldError> : <FieldHint className="normal-case tracking-normal">{nameHint}</FieldHint>}
          {duplicate && (
            <div data-testid="client-duplicate"><PaperNote className="mt-2.5 text-[12.5px]">{t('admin:clients.form.duplicate', { name: duplicate })}</PaperNote></div>
          )}
        </div>

        <div>
          <FieldLabel htmlFor="client-contact">{t('admin:clients.form.contact')}</FieldLabel>
          <input
            id="client-contact"
            value={values.contact}
            onChange={set('contact')}
            placeholder={t('admin:clients.form.contactPlaceholder')}
            maxLength={LIMITS.contact}
            disabled={saving}
            className={input('contact')}
          />
          {errors.contact ? <FieldError>{errors.contact}</FieldError> : <FieldHint>{t('admin:clients.form.contactHint')}</FieldHint>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <FieldLabel htmlFor="client-rfc">{t('admin:clients.form.taxId')}</FieldLabel>
            <input
              id="client-rfc"
              value={values.rfc}
              onChange={set('rfc')}
              placeholder={t('admin:clients.form.taxIdPlaceholder')}
              maxLength={LIMITS.rfc}
              disabled={saving}
              className={input('rfc', true)}
            />
            {errors.rfc ? <FieldError>{errors.rfc}</FieldError> : <FieldHint>{t('admin:clients.form.taxIdHint')}</FieldHint>}
          </div>
          <div>
            <FieldLabel htmlFor="client-phone">{t('admin:clients.form.phone')}</FieldLabel>
            <input
              id="client-phone"
              type="tel"
              value={values.phone}
              onChange={set('phone')}
              placeholder={t('admin:clients.form.phonePlaceholder')}
              maxLength={LIMITS.phone}
              disabled={saving}
              aria-invalid={errors.phone ? 'true' : 'false'}
              className={input('phone', true)}
            />
            {errors.phone ? <FieldError>{errors.phone}</FieldError> : <FieldHint>{t('admin:clients.form.phoneHint')}</FieldHint>}
          </div>
        </div>

        <div>
          <FieldLabel htmlFor="client-email">{t('admin:clients.form.email')}</FieldLabel>
          <input
            id="client-email"
            type="email"
            value={values.email}
            onChange={set('email')}
            placeholder={t('admin:clients.form.emailPlaceholder')}
            maxLength={LIMITS.email}
            disabled={saving}
            aria-invalid={errors.email ? 'true' : 'false'}
            className={input('email')}
          />
          {errors.email ? <FieldError>{errors.email}</FieldError> : <FieldHint>{t('admin:clients.form.emailHint')}</FieldHint>}
        </div>

        {origin === 'project' && (
          <p className="text-[12.5px] leading-[1.5] text-[#5A5346]">{t('admin:clients.form.projectNote')}</p>
        )}
      </form>
    </BtModal>
  );
}
