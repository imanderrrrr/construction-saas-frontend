// BuildTrack — Capture (or correct) a T&M ticket from the site.
//
// This is the form that replaces the paper: the encargado agrees the work on
// site, does it, and types it in. It is used on a phone, standing up, so the
// layout is single-column and the running total is large enough to read out
// loud — that number is what gets said before anyone signs anything.
//
// Two things this form deliberately does NOT do:
//
//  - **It never looks at the budget.** No warning, no block, no clamp. The
//    budget is a gauge, not a gate: a ticket that puts an obra underwater still
//    gets captured, because "how far under" is the number the client measures.
//  - **It never rounds silently.** The total is computed in integer cents by
//    `helpers/tmMoney`, mirroring the server. A value the server would reject
//    blanks the total instead of showing a plausible one.

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileSignature, Loader2 } from 'lucide-react';
import { FIELD_LIMITS } from '../../../shared/fieldLimits';
import { businessToday } from '../../helpers/dateTime';
import {
  computeLaborCents,
  computeTotalCents,
  formatCents,
  parseAmountToCents,
  parseHoursToHundredths,
} from '../../helpers/tmMoney';
import {
  TM_LIMITS,
  createTmTicket,
  updateTmTicket,
  type TmTicket,
  type CreateTmTicketPayload,
} from '../../services/tm';

export interface TmFormProject {
  id: number;
  name: string;
}

interface Props {
  projects: TmFormProject[];
  /** Present when correcting an existing DRAFT / DECLINED ticket. */
  ticket?: TmTicket | null;
  onSaved: (ticket: TmTicket) => void;
  onCancel: () => void;
}

interface FormState {
  projectId: string;
  description: string;
  notes: string;
  workDate: string;
  workerCount: string;
  hours: string;
  hourlyRate: string;
  material: string;
}

function initialState(ticket?: TmTicket | null): FormState {
  if (ticket) {
    return {
      projectId: String(ticket.projectId),
      description: ticket.description,
      notes: ticket.notes ?? '',
      workDate: ticket.workDate,
      workerCount: String(ticket.workerCount),
      // Back to a plain decimal string: these arrive as JSON numbers and the
      // form edits text, never a float.
      hours: String(ticket.hours),
      hourlyRate: String(ticket.hourlyRate),
      material: String(ticket.material),
    };
  }
  return {
    projectId: '',
    description: '',
    notes: '',
    // Defaults to today only as a starting point — see the hint under the
    // field. Tuesday's capture is usually Monday's work.
    workDate: businessToday(),
    workerCount: '1',
    hours: '',
    hourlyRate: '',
    material: '',
  };
}

export function TmTicketForm({ projects, ticket, onSaved, onCancel }: Props) {
  const { t } = useTranslation(['tm', 'common']);
  const [form, setForm] = useState<FormState>(() => initialState(ticket));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  /**
   * The running total, in integer cents.
   *
   * `null` when any factor is not yet a number the server would accept — an
   * empty box, or one decimal too many. Showing a dash beats showing a total
   * built from a value that is about to be rejected.
   */
  const preview = useMemo(() => {
    const workers = /^\d+$/.test(form.workerCount.trim())
      ? BigInt(form.workerCount.trim())
      : null;
    const hours = parseHoursToHundredths(form.hours);
    const rate = parseAmountToCents(form.hourlyRate);
    const material = form.material.trim() === '' ? 0n : parseAmountToCents(form.material);

    if (workers === null || hours === null || rate === null || material === null) return null;
    if (workers < 0n || hours < 0n || rate < 0n || material < 0n) return null;

    const labor = computeLaborCents(workers, hours, rate);
    return { labor, total: computeTotalCents(labor, material) };
  }, [form.workerCount, form.hours, form.hourlyRate, form.material]);

  const workersValid = (() => {
    const n = Number(form.workerCount);
    return Number.isInteger(n)
      && n >= TM_LIMITS.WORKER_COUNT_MIN
      && n <= TM_LIMITS.WORKER_COUNT_MAX;
  })();

  const canSave = Boolean(form.projectId)
    && form.description.trim().length > 0
    && form.workDate.length > 0
    && workersValid
    && parseHoursToHundredths(form.hours) !== null
    && parseAmountToCents(form.hourlyRate) !== null
    && (form.material.trim() === '' || parseAmountToCents(form.material) !== null)
    && !saving;

  const submit = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);

    // Decimal strings, not numbers: the server parses BigDecimal, and a float
    // round-trip is exactly what this module refuses to do with money.
    const payload: CreateTmTicketPayload = {
      projectId: Number(form.projectId),
      description: form.description.trim(),
      notes: form.notes.trim() || null,
      workDate: form.workDate,
      workerCount: Number(form.workerCount),
      hours: form.hours.trim().replace(',', '.'),
      hourlyRate: form.hourlyRate.trim().replace(',', '.'),
      material: form.material.trim() ? form.material.trim().replace(',', '.') : '0',
    };

    try {
      const saved = ticket
        ? await updateTmTicket(ticket.id, {
          description: payload.description,
          notes: payload.notes,
          workDate: payload.workDate,
          workerCount: payload.workerCount,
          hours: payload.hours,
          hourlyRate: payload.hourlyRate,
          material: payload.material,
        })
        : await createTmTicket(payload);
      onSaved(saved);
    } catch {
      setError(t('tm:form.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  // The panel's field vocabulary: a small uppercase label over a 36px control,
  // orange focus ring, hairline border. `block` on the label keeps the input a
  // child of it, which is also how the form is driven in tests.
  const label = 'block text-[11px] font-semibold uppercase tracking-wide text-[#71717A]';
  const field = 'mt-1.5 h-9 w-full rounded-lg border border-[#D4D4D8] bg-white px-3 text-sm font-normal normal-case tracking-normal text-[#0A0A0A] transition-colors focus:border-[#F97316] focus:outline-none focus:ring-2 focus:ring-[#F97316]/25';
  const area = `${field} h-auto py-2 leading-relaxed`;
  const hint = 'mt-1.5 block text-xs font-normal normal-case tracking-normal text-[#71717A]';

  return (
    <form
      className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-4"
      onSubmit={e => { e.preventDefault(); void submit(); }}
    >
      <div className="space-y-4 rounded-xl border border-[#D4D4D8] bg-white p-4 sm:p-6">
        <div className="flex items-center gap-2 border-b border-[#D4D4D8] pb-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F97316]/10">
            <FileSignature className="h-4 w-4 text-[#F97316]" />
          </div>
          <h3 className="text-base font-semibold text-[#0A0A0A]">
            {ticket ? t('tm:form.titleEdit', { number: ticket.ticketNumber }) : t('tm:form.titleCreate')}
          </h3>
        </div>

        <label className={label}>
          {t('tm:form.project')}
          <select
            className={field}
            value={form.projectId}
            disabled={Boolean(ticket)}
            onChange={e => set('projectId', e.target.value)}
          >
            <option value="">{t('tm:form.projectPlaceholder')}</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>

        <label className={label}>
          {t('tm:form.workDate')}
          <input
            type="date"
            className={field}
            value={form.workDate}
            onChange={e => set('workDate', e.target.value)}
          />
          <span className={hint}>
            {t('tm:form.workDateHint')}
          </span>
        </label>

        <label className={label}>
          {t('tm:form.description')}
          <textarea
            className={area}
            rows={2}
            maxLength={FIELD_LIMITS.NOTE}
            placeholder={t('tm:form.descriptionPlaceholder')}
            value={form.description}
            onChange={e => set('description', e.target.value)}
          />
        </label>

        {/* The four factors of the total, in the order the hint reads them. */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className={label}>
            {t('tm:form.workerCount')}
            <input
              type="number"
              inputMode="numeric"
              className={field}
              min={TM_LIMITS.WORKER_COUNT_MIN}
              max={TM_LIMITS.WORKER_COUNT_MAX}
              value={form.workerCount}
              onChange={e => set('workerCount', e.target.value)}
            />
          </label>
          <label className={label}>
            {t('tm:form.hours')}
            <input
              type="text"
              inputMode="decimal"
              className={field}
              placeholder="0.00"
              value={form.hours}
              onChange={e => set('hours', e.target.value)}
            />
          </label>
          <label className={label}>
            {t('tm:form.hourlyRate')}
            <input
              type="text"
              inputMode="decimal"
              className={field}
              placeholder="0.00"
              value={form.hourlyRate}
              onChange={e => set('hourlyRate', e.target.value)}
            />
          </label>
          <label className={label}>
            {t('tm:form.material')}
            <input
              type="text"
              inputMode="decimal"
              className={field}
              placeholder="0.00"
              value={form.material}
              onChange={e => set('material', e.target.value)}
            />
          </label>
        </div>

        <label className={label}>
          {t('tm:form.notes')}
          <textarea
            className={area}
            rows={2}
            maxLength={FIELD_LIMITS.EXTENDED_NOTE}
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
          />
        </label>

        {error && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>

      {/* The number that gets read out loud before anyone signs, so it is the
          biggest thing on the form and it lives in the featured card the rest
          of the module uses for money. */}
      <div
        className="overflow-hidden rounded-xl bg-[#0A0A0A] p-5 sm:p-6 text-[#F5F1E8]"
        data-testid="tm-total-preview"
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#F5F1E8]/50">
              {t('tm:form.total')}
            </p>
            <p
              className="mt-2 font-bt-display font-bold leading-[0.84] tracking-tight tabular-nums text-5xl sm:text-6xl"
              data-testid="tm-total-value"
            >
              {preview ? formatCents(preview.total) : '—'}
            </p>
          </div>
          <dl className="flex gap-6 border-t border-[#F5F1E8]/15 pt-3 sm:border-0 sm:pt-0">
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-[#F5F1E8]/45">
                {t('tm:form.labor')}
              </dt>
              <dd className="mt-1 text-lg font-bold tabular-nums">
                {preview ? formatCents(preview.labor) : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-[#F5F1E8]/45">
                {t('tm:form.material')}
              </dt>
              <dd className="mt-1 text-lg font-bold tabular-nums">
                {preview ? formatCents(preview.total - preview.labor) : '—'}
              </dd>
            </div>
          </dl>
        </div>
        <p className="mt-4 border-t border-[#F5F1E8]/15 pt-3 text-xs text-[#F5F1E8]/60">
          {t('tm:form.totalHint')}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={!canSave}
          className="inline-flex items-center gap-2 rounded-lg bg-[#F97316] px-5 py-2.5 text-sm font-semibold text-[#0A0A0A] transition-colors hover:bg-[#EA580C] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {t('tm:form.save')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-2 py-2.5 text-sm font-medium text-[#71717A] transition-colors hover:text-[#0A0A0A]"
        >
          {t('tm:form.cancel')}
        </button>
      </div>
    </form>
  );
}
