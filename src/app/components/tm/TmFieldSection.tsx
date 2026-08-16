// BuildTrack — The site side of T&M: the encargado captures, and collects the
// signature standing next to the person who has to give it.
//
// Mobile-first, because that is where it is used: one column, big touch
// targets, the money large enough to read out loud.
//
// Nothing here consults a budget. A ticket that puts the obra over is captured
// exactly like one that does not — the budget is a gauge, not a gate.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle, CheckCircle2, Clock, Copy, FileSignature, Loader2, PenLine, Plus,
  RefreshCw, Undo2, Wallet,
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

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-4">
      {/* Work done and still unauthorised — the number that exists nowhere
          else today, so it gets the panel's featured card and is the largest
          thing on the screen. Not a budget figure and not compared against
          one: no bar, no ceiling, no "of" denominator. */}
      <section className="relative overflow-hidden rounded-xl bg-[#0A0A0A] p-5 sm:p-6 md:p-7 text-[#F5F1E8]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#F5F1E8]/50">
              {t('tm:pending.title')}
            </p>
            <p className="mt-2 font-bt-display font-bold leading-[0.84] tracking-tight tabular-nums text-5xl sm:text-6xl md:text-7xl">
              {pending ? money(pending.totalPending) : '—'}
            </p>
            <p className="mt-3 max-w-md text-xs leading-relaxed text-[#F5F1E8]/60">{t('tm:pending.hint')}</p>
          </div>
          <button
            type="button"
            onClick={() => { setEditing(null); setComposing(true); }}
            disabled={loadingProjects || projects.length === 0}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#F97316] px-4 py-2.5 text-sm font-semibold text-[#0A0A0A] transition-colors hover:bg-[#EA580C] disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
            {t('tm:actions.new')}
          </button>
        </div>

        {pending && (
          <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-[#F5F1E8]/15 pt-4 sm:grid-cols-3">
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-[#F5F1E8]/45">
                {t('tm:pending.count')}
              </dt>
              <dd className="mt-1 text-xl font-bold tabular-nums">{pending.ticketCount}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-[#F5F1E8]/45">
                {t('tm:pending.oldest')}
              </dt>
              <dd className="mt-1 text-xl font-bold tabular-nums">
                {t('tm:pending.days', { count: pending.oldestAgeDays })}
              </dd>
            </div>
          </dl>
        )}
      </section>

      {/* Filters — the panel's filter bar: labelled controls in a white card,
          never bare selects floating on the background. */}
      <div className="rounded-xl border border-[#D4D4D8] bg-white p-3 sm:p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-[150px] flex-1 flex-col gap-1.5 sm:max-w-[240px]">
            <label
              htmlFor="tm-field-project"
              className="text-[11px] font-semibold uppercase tracking-wide text-[#71717A]"
            >
              {t('tm:filter.project')}
            </label>
            <select
              id="tm-field-project"
              value={projectFilter}
              onChange={e => setProjectFilter(e.target.value)}
              className="h-9 rounded-lg border border-[#D4D4D8] bg-white px-3 text-sm text-[#0A0A0A] transition-colors focus:border-[#F97316] focus:outline-none focus:ring-2 focus:ring-[#F97316]/25"
            >
              <option value="">{t('tm:filter.allProjects')}</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="flex min-w-[150px] flex-1 flex-col gap-1.5 sm:max-w-[240px]">
            <label
              htmlFor="tm-field-status"
              className="text-[11px] font-semibold uppercase tracking-wide text-[#71717A]"
            >
              {t('tm:filter.status')}
            </label>
            <select
              id="tm-field-status"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as '' | TmTicketStatus)}
              className="h-9 rounded-lg border border-[#D4D4D8] bg-white px-3 text-sm text-[#0A0A0A] transition-colors focus:border-[#F97316] focus:outline-none focus:ring-2 focus:ring-[#F97316]/25"
            >
              <option value="">{t('tm:filter.allStatuses')}</option>
              {TM_TICKET_STATUSES.map(s => (
                <option key={s} value={s}>{t(`tm:status.${s}`)}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {actionError && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {actionError}
        </p>
      )}

      {loading && (
        <div className="rounded-xl border border-[#D4D4D8] bg-white p-6">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex items-center gap-3 py-3">
              <div className="h-9 w-9 shrink-0 animate-pulse rounded-lg bg-[#FAFAFA]" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/3 animate-pulse rounded bg-[#FAFAFA]" />
                <div className="h-2.5 w-1/2 animate-pulse rounded bg-[#FAFAFA]" />
              </div>
              <div className="h-6 w-20 animate-pulse rounded bg-[#FAFAFA]" />
            </div>
          ))}
          <p className="flex items-center gap-2 pt-2 text-xs text-[#71717A]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {t('tm:list.loading')}
          </p>
        </div>
      )}

      {!loading && failed && (
        <div className="rounded-xl border border-[#D4D4D8] bg-white p-10 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-red-50">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <p className="mt-3 text-sm font-medium text-[#0A0A0A]">{t('tm:list.loadFailed')}</p>
          <button
            type="button"
            onClick={() => void reload()}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-[#D4D4D8] px-3 py-2 text-xs font-semibold text-[#0A0A0A] transition-colors hover:border-[#F97316] hover:text-[#F97316]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {t('tm:list.retry')}
          </button>
        </div>
      )}

      {!loading && !failed && tickets.length === 0 && (
        <div className="rounded-xl border border-[#D4D4D8] bg-white p-12 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#F97316]/10">
            <FileSignature className="h-5 w-5 text-[#F97316]" />
          </div>
          <p className="mt-3 text-sm font-semibold text-[#0A0A0A]">{t('tm:list.empty')}</p>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-[#71717A]">{t('tm:list.emptyHint')}</p>
        </div>
      )}

      {!loading && !failed && tickets.map(ticket => {
        const open = expanded === ticket.id;
        const accent = ROW_ACCENT[ticket.status];
        return (
          <article
            key={ticket.id}
            className={`overflow-hidden rounded-xl border border-l-[3px] bg-white transition-colors ${accent}`}
          >
            <button
              type="button"
              onClick={() => setExpanded(open ? null : ticket.id)}
              className="flex w-full items-start justify-between gap-3 p-4 text-left transition-colors hover:bg-[#FAFAFA]"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-[#71717A]">{ticket.ticketNumber}</span>
                  <TmStatusChip status={ticket.status} />
                </div>
                <p className="mt-1.5 truncate text-sm font-medium text-[#0A0A0A]">{ticket.description}</p>
                <p className="mt-0.5 text-xs text-[#71717A]">
                  {ticket.projectName} · {fmtDate(ticket.workDate, i18n.language)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-lg font-bold tabular-nums text-[#0A0A0A]">{money(ticket.total)}</p>
                <p className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-[#71717A]">
                  <Clock className="h-3 w-3" />
                  {t('tm:list.age', { count: ticket.ageDays })}
                </p>
              </div>
            </button>

            {open && (
              <div className="space-y-4 border-t border-[#D4D4D8] p-4">
                {/* The arithmetic, laid out so it can be read out loud in the
                    order it is computed: people × hours × rate, plus material. */}
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg bg-[#FAFAFA] p-3 sm:grid-cols-3">
                  <Detail label={t('tm:detail.people')} value={String(ticket.workerCount)} />
                  <Detail label={t('tm:detail.hours')} value={String(ticket.hours)} />
                  <Detail label={t('tm:detail.rate')} value={money(ticket.hourlyRate)} />
                  <Detail label={t('tm:detail.labor')} value={money(ticket.labor)} />
                  <Detail label={t('tm:detail.material')} value={money(ticket.material)} />
                  <Detail label={t('tm:detail.total')} value={money(ticket.total)} strong />
                </dl>

                {ticket.notes && (
                  <p className="rounded-lg border border-[#D4D4D8] bg-white p-3 text-sm leading-relaxed text-[#3F3F46]">
                    {ticket.notes}
                  </p>
                )}

                <p className="text-xs text-[#71717A]">
                  {t('tm:detail.capturedBy', {
                    user: ticket.createdBy,
                    date: fmtDateTime(ticket.createdAt, i18n.language),
                  })}
                </p>

                {ticket.status === 'SIGNED' && ticket.signerName && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-900">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      {t('tm:signature.signedBy', {
                        name: ticket.signerName,
                        title: ticket.signerTitle ?? '',
                      })}
                    </p>
                    {ticket.signedAt && (
                      <p className="mt-1 text-xs text-emerald-800">
                        {t('tm:signature.signedAt', { date: fmtDateTime(ticket.signedAt, i18n.language) })}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-emerald-700">{t('tm:signature.waitingOffice')}</p>
                  </div>
                )}

                {ticket.status === 'DECLINED' && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-red-900">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      {t('tm:signature.declined')}
                    </p>
                    {ticket.declineReason && (
                      <p className="mt-1 text-xs text-red-800">
                        {t('tm:signature.declineReason', { reason: ticket.declineReason })}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-red-700">{t('tm:signature.declinedHint')}</p>
                  </div>
                )}

                {ticket.status === 'CONVERTED' && (
                  <div className="flex items-start gap-2 rounded-lg bg-[#0A0A0A] p-3 text-sm text-[#F5F1E8]">
                    <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-[#F97316]" />
                    <span>
                      {t('tm:signature.converted', {
                        date: ticket.convertedAt ? fmtDateTime(ticket.convertedAt, i18n.language) : '',
                      })}
                    </span>
                  </div>
                )}

                {ticket.documentHash && (
                  <p className="text-[11px] text-[#A1A1AA]">
                    {t('tm:detail.hash')}{' '}
                    <span className="font-mono">{ticket.documentHash.slice(0, 16)}…</span>
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2 border-t border-[#D4D4D8] pt-3">
                  {ticket.editable && (
                    <button
                      type="button"
                      onClick={() => { setEditing(ticket); setComposing(false); }}
                      className="rounded-lg border border-[#D4D4D8] px-3 py-2 text-xs font-semibold text-[#0A0A0A] transition-colors hover:border-[#F97316] hover:text-[#F97316]"
                    >
                      {t('tm:actions.edit')}
                    </button>
                  )}

                  {ticket.editable && (
                    <button
                      type="button"
                      onClick={() => void askSignature(ticket)}
                      disabled={busyId === ticket.id}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#F97316] px-3 py-2 text-xs font-semibold text-[#0A0A0A] transition-colors hover:bg-[#EA580C] disabled:opacity-40"
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
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#F97316] px-3 py-2 text-xs font-semibold text-[#0A0A0A] transition-colors hover:bg-[#EA580C]"
                      >
                        <PenLine className="h-3.5 w-3.5" />
                        {t('tm:actions.signHere')}
                      </button>
                      <button
                        type="button"
                        onClick={() => void copyLink(ticket)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#D4D4D8] px-3 py-2 text-xs font-semibold text-[#0A0A0A] transition-colors hover:border-[#F97316] hover:text-[#F97316]"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        {copiedId === ticket.id ? t('tm:actions.copied') : t('tm:actions.copyLink')}
                      </button>
                      <button
                        type="button"
                        onClick={() => void revoke(ticket)}
                        disabled={busyId === ticket.id}
                        className="inline-flex items-center gap-1.5 px-1 text-xs font-medium text-[#71717A] transition-colors hover:text-red-600 disabled:opacity-40"
                      >
                        <Undo2 className="h-3.5 w-3.5" />
                        {t('tm:actions.revoke')}
                      </button>
                    </>
                  )}
                </div>

                {ticket.status === 'PENDING_SIGNATURE' && (
                  <p className="text-xs leading-relaxed text-[#71717A]">{t('tm:actions.linkHint')}</p>
                )}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

/**
 * The left rail on a ticket card.
 *
 * The chip alone made every row the same weight, so a signed ticket — the one
 * the office has to act on — looked exactly like a draft from across the
 * screen. The rail restates the chip's colour at the scale you can read while
 * scrolling: emerald means "somebody signed this", ink means "this already
 * moved money", and the two neutral states stay quiet.
 */
const ROW_ACCENT: Record<TmTicketStatus, string> = {
  DRAFT: 'border-[#D4D4D8] border-l-[#D4D4D8]',
  PENDING_SIGNATURE: 'border-[#D4D4D8] border-l-amber-400',
  SIGNED: 'border-emerald-200 border-l-emerald-500',
  DECLINED: 'border-red-200 border-l-red-500',
  CONVERTED: 'border-[#D4D4D8] border-l-[#0A0A0A]',
};

function Detail({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-[#71717A]">{label}</dt>
      <dd className={`tabular-nums text-[#0A0A0A] ${strong ? 'text-base font-bold' : 'text-sm font-medium'}`}>
        {value}
      </dd>
    </div>
  );
}
