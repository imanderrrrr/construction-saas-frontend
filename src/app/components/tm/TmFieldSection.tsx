// BuildTrack — The site side of T&M: the encargado captures, and collects the
// signature standing next to the person who has to give it.
//
// Mobile-first, because that is where it is used: one column, big touch
// targets, the money large enough to read out loud.
//
// Nothing here consults a budget. A ticket that puts the obra over is captured
// exactly like one that does not — the budget is a gauge, not a gate.
//
// The dress is the panel's industrial language — the one Reporte de Horas,
// Costo de Mano de Obra and Suscripción wear: mono eyebrow over a condensed
// display title, an ink hero with the grid texture for the one number that
// matters, square-cornered surfaces with hairline borders, states told by
// weight and marks instead of a traffic light.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle, ChevronRight, Copy, FileSignature, Loader2, PenLine, Plus,
  RefreshCw, Undo2,
} from 'lucide-react';
import { AuthService } from '../../services/auth';
import { getSupervisorProjects } from '../../services/time';
import { listProjects } from '../../services/projects';
import { fmtDate, fmtDateTime } from '../../helpers/dateTime';
import { formatApiAmount } from '../../helpers/tmMoney';
import {
  TM_TICKET_STATUSES,
  getFieldTmPending,
  listFieldTmTickets,
  requestTmSignature,
  revokeTmSignature,
  type TmPendingSummary,
  type TmTicket,
  type TmTicketStatus,
} from '../../services/tm';
import { TmTicketForm, type TmFormProject } from './TmTicketForm';
import { TmSignatureHandoff } from './TmSignatureHandoff';
import { TmStatusChip } from './TmStatusChip';

function Mono({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <span className={`font-bt-mono uppercase tracking-[0.1em] ${className}`}>{children}</span>;
}

/** Subtle grid on ink surfaces — same texture as the Suscripción hero. */
const GRID_INK: React.CSSProperties = {
  backgroundImage:
    'linear-gradient(rgba(245,241,232,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(245,241,232,0.055) 1px, transparent 1px)',
  backgroundSize: '24px 24px',
};

/** "$1,850.00" → ["$", "1,850.00"] so the symbol can set small, guide-style. */
function splitMoney(formatted: string): [string, string] {
  const i = formatted.indexOf('$');
  return [formatted.slice(0, i + 1), formatted.slice(i + 1)];
}

// The module's button vocabulary, lifted from Usuarios / Suscripción.
const BTN_PRIMARY = 'inline-flex items-center gap-2 bg-[#0A0A0A] hover:bg-[#F97316] text-[#F5F1E8] hover:text-[#0A0A0A] font-bt-mono text-[11px] font-semibold uppercase tracking-[0.08em] px-4 py-2.5 transition-colors disabled:opacity-40 disabled:hover:bg-[#0A0A0A] disabled:hover:text-[#F5F1E8]';
const BTN_SECONDARY = 'inline-flex items-center gap-2 border border-[#DBD0BB] bg-[#FAF7F0] px-3.5 py-2.5 font-bt-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#0A0A0A] hover:border-[#F97316] hover:text-[#C2410C] transition-colors';
const BTN_GHOST = 'font-bt-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#8A8175] hover:text-[#0A0A0A] transition-colors disabled:opacity-40';

/**
 * Which projects the encargado may capture against.
 *
 * ⚠️ The backend accepts a T&M on **any project of the company** — it resolves
 * the project with `findByIdInTenant` and never checks an assignment. That is
 * current behaviour and an open product question, so nothing here tries to
 * tighten it.
 *
 * The picker is nonetheless limited to assigned projects for a SUPERVISOR,
 * because the only project list their role can read is the assigned one:
 * `/api/v1/supervisor/dashboard/projects`. There is no company-wide list a
 * SUPERVISOR is allowed to call, and inventing one would be a backend change.
 * An ADMIN on this same screen reads the full list, which they are allowed to.
 */
function useCapturableProjects() {
  const [projects, setProjects] = useState<TmFormProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const role = AuthService.getRole();
    const load = role === 'ADMIN'
      ? listProjects({ size: 200 }).then(page => page.content.map(p => ({ id: p.id, name: p.name })))
      : getSupervisorProjects().then(list => list.map(p => ({ id: p.id, name: p.name })));

    load
      .then(list => { if (!cancelled) setProjects(list); })
      .catch(() => { if (!cancelled) setProjects([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { projects, loadingProjects: loading };
}

export function TmFieldSection() {
  const { t, i18n } = useTranslation(['tm', 'signatures']);
  const { projects, loadingProjects } = useCapturableProjects();

  const [tickets, setTickets] = useState<TmTicket[]>([]);
  const [pending, setPending] = useState<TmPendingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const [projectFilter, setProjectFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'' | TmTicketStatus>('');

  const [composing, setComposing] = useState(false);
  const [editing, setEditing] = useState<TmTicket | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [handoff, setHandoff] = useState<TmTicket | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const filters = useMemo(() => ({
    projectId: projectFilter ? Number(projectFilter) : undefined,
    status: statusFilter || undefined,
  }), [projectFilter, statusFilter]);

  // Bumped to ask for a fresh read after an action that changed something.
  const [refreshKey, setRefreshKey] = useState(0);
  const reload = useCallback(() => setRefreshKey(k => k + 1), []);

  // State lands only inside the promise callbacks — no synchronous setState in
  // the effect body, which is the idiom the rest of this codebase follows, and
  // `cancelled` keeps a late response from writing after a filter change.
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      listFieldTmTickets(filters),
      getFieldTmPending(filters.projectId),
    ])
      .then(([list, summary]) => {
        if (cancelled) return;
        setTickets(list);
        setPending(summary);
        setFailed(false);
      })
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filters, refreshKey]);

  const money = (amount: number) => formatApiAmount(amount);

  const askSignature = async (ticket: TmTicket) => {
    setBusyId(ticket.id);
    setActionError(null);
    try {
      const updated = await requestTmSignature(ticket.id);
      setTickets(prev => prev.map(x => (x.id === updated.id ? updated : x)));
      // Straight into the handoff: asking for the signature and collecting it
      // are one motion on site, not two screens apart.
      setHandoff(updated);
    } catch {
      setActionError(t('tm:errors.action'));
    } finally {
      setBusyId(null);
    }
  };

  const revoke = async (ticket: TmTicket) => {
    setBusyId(ticket.id);
    setActionError(null);
    try {
      const updated = await revokeTmSignature(ticket.id);
      setTickets(prev => prev.map(x => (x.id === updated.id ? updated : x)));
      void reload();
    } catch {
      setActionError(t('tm:errors.action'));
    } finally {
      setBusyId(null);
    }
  };

  const copyLink = async (ticket: TmTicket) => {
    if (!ticket.signUrl) return;
    try {
      await navigator.clipboard.writeText(ticket.signUrl);
      setCopiedId(ticket.id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setActionError(t('tm:errors.copy'));
    }
  };

  if (handoff) {
    return (
      <TmSignatureHandoff
        ticket={handoff}
        onFinished={() => { setHandoff(null); void reload(); }}
        onCancel={() => { setHandoff(null); void reload(); }}
      />
    );
  }

  if (composing || editing) {
    return (
      <TmTicketForm
        projects={projects}
        ticket={editing}
        onSaved={() => { setComposing(false); setEditing(null); void reload(); }}
        onCancel={() => { setComposing(false); setEditing(null); }}
      />
    );
  }

  const [pendingSym, pendingDigits] = pending ? splitMoney(money(pending.totalPending)) : ['', '—'];

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-4">
      {/* Editorial header — eyebrow, condensed display title, prose line. */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <Mono className="text-[11px] tracking-[0.15em] text-[#71717A]">{t('tm:kicker.field')}</Mono>
          <h2 className="font-bt-display font-bold uppercase text-4xl md:text-5xl leading-none text-[#0A0A0A] mt-1.5">
            {t('tm:section.field.title')}
          </h2>
          <p className="text-sm text-[#52525B] mt-1.5">{t('tm:section.field.subtitle')}</p>
        </div>
        <button
          type="button"
          data-tour="sec.tm-field.new"
          onClick={() => { setEditing(null); setComposing(true); }}
          disabled={loadingProjects || projects.length === 0}
          className={`${BTN_PRIMARY} px-4 py-3 flex-shrink-0`}
        >
          <Plus className="h-3.5 w-3.5" />
          {t('tm:actions.new')}
        </button>
      </div>

      {/* Work done and still unauthorised — the number that exists nowhere
          else today, so it gets the panel's ink hero with the grid texture and
          is the largest thing on the screen. Not a budget figure and not
          compared against one: no bar, no ceiling, no "of" denominator.

          `data-tour` anchors ring the section tour's stops under the key
          `tm-field` on BOTH panels that mount this screen — the supervisor's
          nav key is `tm`, but it tours as `tm-field` (see SECTION_TOUR_STEPS). */}
      <section data-tour="sec.tm-field.pending" className="relative overflow-hidden bg-[#0A0A0A] p-5 sm:p-6 md:p-7 text-[#F5F1E8]">
        <div className="absolute inset-0 pointer-events-none" style={GRID_INK} />
        <div className="relative">
          <Mono className="block text-[11px] tracking-[0.15em] text-[#F5F1E8]/50">
            {t('tm:pending.title')}
          </Mono>
          <div className="flex items-baseline mt-2">
            {pending && (
              <span className="font-bt-display font-bold text-3xl sm:text-4xl text-[#F5F1E8]/60 self-start mt-1">
                {pendingSym}
              </span>
            )}
            <span className="font-bt-display font-bold leading-[0.84] tracking-tight tabular-nums text-5xl sm:text-6xl md:text-7xl">
              {pendingDigits}
            </span>
          </div>
          <Mono className="block max-w-md mt-3 text-[11px] tracking-[0.05em] normal-case text-[#F5F1E8]/60">
            {t('tm:pending.hint')}
          </Mono>

          {pending && (
            <dl className="mt-5 grid grid-cols-2 sm:grid-cols-3 border-t border-[#F5F1E8]/15">
              <div className="pt-4 pr-4 border-r border-[#F5F1E8]/15">
                <dd className="font-bt-display font-bold text-2xl leading-none tabular-nums">{pending.ticketCount}</dd>
                <dt className="mt-1.5"><Mono className="text-[9.5px] text-[#F5F1E8]/45">{t('tm:pending.count')}</Mono></dt>
              </div>
              <div className="pt-4 px-4">
                <dd className="font-bt-display font-bold uppercase text-2xl leading-none tabular-nums">
                  {t('tm:pending.days', { count: pending.oldestAgeDays })}
                </dd>
                <dt className="mt-1.5"><Mono className="text-[9.5px] text-[#F5F1E8]/45">{t('tm:pending.oldest')}</Mono></dt>
              </div>
            </dl>
          )}
        </div>
      </section>

      {/* Filters — the panel's bar: sand controls, mono caps, square corners. */}
      <div className="bg-white border border-[#E4E4E7] p-3.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <select
            aria-label={t('tm:filter.project')}
            value={projectFilter}
            onChange={e => setProjectFilter(e.target.value)}
            className="appearance-none cursor-pointer border border-[#DBD0BB] bg-[#FAF7F0] px-3 py-2 font-bt-mono text-[11px] uppercase tracking-[0.06em] text-[#0A0A0A] max-w-[230px] focus:border-[#F97316] outline-none"
          >
            <option value="">{t('tm:filter.projectAll')}</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select
            data-tour="sec.tm-field.states"
            aria-label={t('tm:filter.status')}
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as '' | TmTicketStatus)}
            className="appearance-none cursor-pointer border border-[#DBD0BB] bg-[#FAF7F0] px-3 py-2 font-bt-mono text-[11px] uppercase tracking-[0.06em] text-[#0A0A0A] max-w-[230px] focus:border-[#F97316] outline-none"
          >
            <option value="">{t('tm:filter.statusAll')}</option>
            {TM_TICKET_STATUSES.map(s => (
              <option key={s} value={s}>{t(`tm:status.${s}`)}</option>
            ))}
          </select>
        </div>
      </div>

      {actionError && (
        <p role="alert" className="flex gap-2.5 items-center bg-[#FBEDE0] border border-[#F6CFA6] border-l-[3px] border-l-[#F97316] px-3 py-2.5 text-[13px] text-[#43301F]">
          <AlertTriangle className="h-3.5 w-3.5 text-[#EA580C] flex-shrink-0" />
          {actionError}
        </p>
      )}

      {/* Two tour stops share the ticket zone — `list` (what a ticket is, and
          that asking for the signature freezes it) and `sign` (who signs and
          how). One element carries one `data-tour` value, so the second stop
          rings an inner wrapper of the same zone. Wrapping every list state —
          not the data-only container — follows the anchor doctrine in
          sectionTourSteps.ts: a stop must not vanish on a fresh account. */}
      <div data-tour="sec.tm-field.list">
      <div data-tour="sec.tm-field.sign" className="space-y-4">
      {loading && (
        <div className="bg-white border border-[#E4E4E7] py-1.5">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex gap-3.5 items-center px-5 py-4 border-b border-[#F0EBE1]">
              <div className="flex-1">
                <div className="w-1/3 h-3 bg-[#EAE4D8] animate-pulse mb-2" />
                <div className="w-1/2 h-2 bg-[#EAE4D8] animate-pulse" />
              </div>
              <div className="w-20 h-7 bg-[#EAE4D8] animate-pulse" />
            </div>
          ))}
          <p className="flex items-center gap-2 px-5 py-3">
            <Loader2 className="h-3 w-3 animate-spin text-[#8A8175]" />
            <Mono className="text-[10px] text-[#8A8175]">{t('tm:list.loading')}</Mono>
          </p>
        </div>
      )}

      {!loading && failed && (
        <div className="bg-white border border-[#E4E4E7] py-16 text-center">
          <p className="text-sm text-[#71717A]">{t('tm:list.loadFailed')}</p>
          <button
            type="button"
            onClick={() => void reload()}
            className="mt-3 inline-flex items-center gap-1.5 font-bt-mono text-[10px] uppercase tracking-[0.1em] border border-[#DBD0BB] px-3 py-1.5 hover:border-[#F97316]"
          >
            <RefreshCw className="h-3 w-3" />
            {t('tm:list.retry')}
          </button>
        </div>
      )}

      {!loading && !failed && tickets.length === 0 && (
        <div className="bg-white border border-[#E4E4E7] py-[70px] px-6 text-center">
          <div className="font-bt-display font-bold text-4xl leading-none text-[#CDBFA6]">{t('tm:list.emptyBig')}</div>
          <p className="font-bt-heading font-bold text-base text-[#0A0A0A] mt-2.5">{t('tm:list.empty')}</p>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-[#71717A]">{t('tm:list.emptyHint')}</p>
        </div>
      )}

      {!loading && !failed && tickets.length > 0 && (
        <div className="bg-white border border-[#E4E4E7]">
          {tickets.map(ticket => {
            const open = expanded === ticket.id;
            const [sym, digits] = splitMoney(money(ticket.total));
            return (
              <article key={ticket.id} className="border-b border-[#F0EBE1] last:border-b-0">
                <button
                  type="button"
                  onClick={() => setExpanded(open ? null : ticket.id)}
                  className="flex w-full items-center gap-3.5 px-4 sm:px-5 py-4 text-left hover:bg-[#FBF8F2] transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <Mono className="text-[10.5px] tracking-[0.06em] text-[#8A8175]">{ticket.ticketNumber}</Mono>
                      <TmStatusChip status={ticket.status} />
                    </div>
                    <p className="mt-1.5 truncate text-[15px] font-semibold text-[#0A0A0A]">{ticket.description}</p>
                    <Mono className="block mt-1 text-[10.5px] tracking-[0.04em] normal-case text-[#A69C8D] truncate">
                      {ticket.projectName} · {fmtDate(ticket.workDate, i18n.language)}
                    </Mono>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className="flex items-baseline gap-0.5 justify-end">
                      <span className="font-bt-display font-bold text-base text-[#8A8175]">{sym}</span>
                      <span className="font-bt-display font-bold text-2xl sm:text-3xl leading-none tabular-nums text-[#0A0A0A]">{digits}</span>
                    </div>
                    <Mono className="block text-[9px] tracking-[0.08em] text-[#B4A992] mt-1">
                      {t('tm:list.age', { count: ticket.ageDays })}
                    </Mono>
                  </div>
                  <ChevronRight className={`w-4 h-4 text-[#C6BBA6] flex-shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
                </button>

                {open && (
                  <div className="border-t border-[#EDE7DB] bg-[#FBF8F2] px-4 sm:px-5 py-4 space-y-4">
                    {/* The arithmetic, laid out in the order it is computed —
                        people × hours × rate, plus material — as a ledger the
                        eye can run down, the way the cost drawer does it. */}
                    <div className="border border-[#E4E4E7] bg-white">
                      <LedgerRow label={t('tm:detail.people')} value={String(ticket.workerCount)} />
                      <LedgerRow label={t('tm:detail.hours')} value={String(ticket.hours)} />
                      <LedgerRow label={t('tm:detail.rate')} value={money(ticket.hourlyRate)} />
                      <LedgerRow label={t('tm:detail.labor')} value={money(ticket.labor)} />
                      <LedgerRow label={t('tm:detail.material')} value={money(ticket.material)} />
                      <div className="flex items-center justify-between gap-2.5 px-3.5 py-2.5 bg-[#FBF8F2]">
                        <Mono className="text-[10px] tracking-[0.08em] text-[#5A5346]">{t('tm:detail.total')}</Mono>
                        <span className="font-bt-display font-bold text-xl leading-none tabular-nums text-[#0A0A0A]">{money(ticket.total)}</span>
                      </div>
                    </div>

                    {ticket.notes && (
                      <p className="border-l-2 border-[#DED4C2] pl-3 text-[13px] leading-relaxed text-[#3F3F46]">
                        {ticket.notes}
                      </p>
                    )}

                    <Mono className="block text-[10px] tracking-[0.04em] normal-case text-[#8A8175]">
                      {t('tm:detail.capturedBy', {
                        user: ticket.createdBy,
                        date: fmtDateTime(ticket.createdAt, i18n.language),
                      })}
                    </Mono>

                    {ticket.status === 'SIGNED' && ticket.signerName && (
                      <div className="bg-[#0A0A0A] text-[#F5F1E8] px-3.5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-[#D5C9B4] block flex-shrink-0" />
                          <Mono className="text-[10px] tracking-[0.1em]">
                            {t('tm:signature.signedBy', {
                              name: ticket.signerName,
                              title: ticket.signerTitle ?? '',
                            })}
                          </Mono>
                        </div>
                        {ticket.signedAt && (
                          <Mono className="block mt-1.5 pl-3.5 text-[9.5px] tracking-[0.05em] normal-case text-[#F5F1E8]/60">
                            {t('tm:signature.signedAt', { date: fmtDateTime(ticket.signedAt, i18n.language) })}
                          </Mono>
                        )}
                        <Mono className="block mt-1 pl-3.5 text-[9.5px] tracking-[0.05em] normal-case text-[#F5F1E8]/60">
                          {t('tm:signature.waitingOffice')}
                        </Mono>
                      </div>
                    )}

                    {ticket.status === 'DECLINED' && (
                      <div className="bg-[#FBEDE0] border border-[#F6CFA6] border-l-[3px] border-l-[#F97316] px-3.5 py-3">
                        <p className="flex items-center gap-2 font-bt-heading font-bold text-[14px] text-[#0A0A0A]">
                          <AlertTriangle className="h-4 w-4 shrink-0 text-[#EA580C]" />
                          {t('tm:signature.declined')}
                        </p>
                        {ticket.declineReason && (
                          <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#43301F]">
                            {t('tm:signature.declineReason', { reason: ticket.declineReason })}
                          </p>
                        )}
                        <p className="mt-1 text-[12.5px] leading-relaxed text-[#43301F]">{t('tm:signature.declinedHint')}</p>
                      </div>
                    )}

                    {ticket.status === 'CONVERTED' && (
                      <div className="flex items-center gap-2 bg-[#0A0A0A] px-3.5 py-3 text-[#F5F1E8]">
                        <span className="w-1.5 h-1.5 bg-[#F97316] block flex-shrink-0" />
                        <Mono className="text-[10px] tracking-[0.05em] normal-case">
                          {t('tm:signature.converted', {
                            date: ticket.convertedAt ? fmtDateTime(ticket.convertedAt, i18n.language) : '',
                          })}
                        </Mono>
                      </div>
                    )}

                    {ticket.documentHash && (
                      <Mono className="block text-[9.5px] tracking-[0.04em] normal-case text-[#B4A992]">
                        {t('tm:detail.hash')} {ticket.documentHash.slice(0, 16)}…
                      </Mono>
                    )}

                    <div className="flex flex-wrap items-center gap-2.5 border-t border-[#EDE7DB] pt-3.5">
                      {ticket.editable && (
                        <button
                          type="button"
                          onClick={() => { setEditing(ticket); setComposing(false); }}
                          className={BTN_SECONDARY}
                        >
                          {t('tm:actions.edit')}
                        </button>
                      )}

                      {ticket.editable && (
                        <button
                          type="button"
                          onClick={() => void askSignature(ticket)}
                          disabled={busyId === ticket.id}
                          className={BTN_PRIMARY}
                        >
                          {busyId === ticket.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <FileSignature className="h-3.5 w-3.5" />}
                          {ticket.status === 'DECLINED'
                            ? t('tm:actions.requestSignatureAgain')
                            : t('tm:actions.requestSignature')}
                        </button>
                      )}

                      {ticket.status === 'PENDING_SIGNATURE' && (
                        <>
                          <button
                            type="button"
                            onClick={() => setHandoff(ticket)}
                            className={BTN_PRIMARY}
                          >
                            <PenLine className="h-3.5 w-3.5" />
                            {t('tm:actions.signHere')}
                          </button>
                          <button
                            type="button"
                            onClick={() => void copyLink(ticket)}
                            className={BTN_SECONDARY}
                          >
                            <Copy className="h-3.5 w-3.5" />
                            {copiedId === ticket.id ? t('tm:actions.copied') : t('tm:actions.copyLink')}
                          </button>
                          <button
                            type="button"
                            onClick={() => void revoke(ticket)}
                            disabled={busyId === ticket.id}
                            className={`${BTN_GHOST} inline-flex items-center gap-1.5 hover:text-[#C2410C]`}
                          >
                            <Undo2 className="h-3.5 w-3.5" />
                            {t('tm:actions.revoke')}
                          </button>
                        </>
                      )}
                    </div>

                    {ticket.status === 'PENDING_SIGNATURE' && (
                      <p className="text-xs leading-relaxed text-[#8A8175]">{t('tm:actions.linkHint')}</p>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
      </div>
      </div>
    </div>
  );
}

/** One line of the arithmetic ledger: mono label left, mono figure right. */
function LedgerRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2.5 px-3.5 py-2 border-b border-[#F0EBE1]">
      <Mono className="text-[10px] tracking-[0.08em] text-[#5A5346]">{label}</Mono>
      <Mono className="text-[12.5px] font-semibold tracking-normal normal-case tabular-nums text-[#0A0A0A]">{value}</Mono>
    </div>
  );
}
