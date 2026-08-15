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
  AlertTriangle, Clock, Copy, FileSignature, Loader2, PenLine, Plus, RefreshCw, Undo2,
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

  const money = (amount: number) => formatApiAmount(amount, i18n.language);

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
    <div className="space-y-4">
      {/* Work done and still unauthorised — the number that exists nowhere
          else today. Not a budget figure and not compared against one. */}
      <div className="rounded-xl border border-[#D4D4D8] bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-[#18181B]">{t('tm:pending.title')}</h3>
            <p className="mt-0.5 text-xs text-[#71717A]">{t('tm:pending.hint')}</p>
          </div>
          <button
            type="button"
            onClick={() => { setEditing(null); setComposing(true); }}
            disabled={loadingProjects || projects.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#F97316] px-3 py-2 text-sm font-semibold text-white hover:bg-[#EA580C] disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {t('tm:actions.new')}
          </button>
        </div>

        {pending && (
          <dl className="mt-3 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-[#FAFAFA] p-2">
              <dt className="text-xs text-[#71717A]">{t('tm:pending.count')}</dt>
              <dd className="text-lg font-semibold tabular-nums text-[#18181B]">{pending.ticketCount}</dd>
            </div>
            <div className="rounded-lg bg-[#FAFAFA] p-2">
              <dt className="text-xs text-[#71717A]">{t('tm:pending.total')}</dt>
              <dd className="text-lg font-semibold tabular-nums text-[#18181B]">{money(pending.totalPending)}</dd>
            </div>
            <div className="rounded-lg bg-[#FAFAFA] p-2">
              <dt className="text-xs text-[#71717A]">{t('tm:pending.oldest')}</dt>
              <dd className="text-lg font-semibold tabular-nums text-[#18181B]">
                {t('tm:pending.days', { count: pending.oldestAgeDays })}
              </dd>
            </div>
          </dl>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          aria-label={t('tm:filter.project')}
          value={projectFilter}
          onChange={e => setProjectFilter(e.target.value)}
          className="rounded-lg border border-[#D4D4D8] px-2 py-1.5 text-sm"
        >
          <option value="">{t('tm:filter.allProjects')}</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select
          aria-label={t('tm:filter.status')}
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as '' | TmTicketStatus)}
          className="rounded-lg border border-[#D4D4D8] px-2 py-1.5 text-sm"
        >
          <option value="">{t('tm:filter.allStatuses')}</option>
          {TM_TICKET_STATUSES.map(s => (
            <option key={s} value={s}>{t(`tm:status.${s}`)}</option>
          ))}
        </select>
      </div>

      {actionError && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{actionError}</p>
      )}

      {loading && (
        <div className="flex items-center gap-2 py-10 text-sm text-[#71717A]">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('tm:list.loading')}
        </div>
      )}

      {!loading && failed && (
        <div className="rounded-xl border border-[#D4D4D8] bg-white p-6 text-center">
          <p className="text-sm text-[#71717A]">{t('tm:list.loadFailed')}</p>
          <button
            type="button"
            onClick={() => void reload()}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-[#F97316]"
          >
            <RefreshCw className="h-4 w-4" />
            {t('tm:list.retry')}
          </button>
        </div>
      )}

      {!loading && !failed && tickets.length === 0 && (
        <div className="rounded-xl border border-dashed border-[#D4D4D8] bg-white p-8 text-center">
          <p className="text-sm font-medium text-[#18181B]">{t('tm:list.empty')}</p>
          <p className="mt-1 text-xs text-[#71717A]">{t('tm:list.emptyHint')}</p>
        </div>
      )}

      {!loading && !failed && tickets.map(ticket => {
        const open = expanded === ticket.id;
        return (
          <article key={ticket.id} className="rounded-xl border border-[#D4D4D8] bg-white">
            <button
              type="button"
              onClick={() => setExpanded(open ? null : ticket.id)}
              className="flex w-full items-start justify-between gap-3 p-4 text-left"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-[#71717A]">{ticket.ticketNumber}</span>
                  <TmStatusChip status={ticket.status} />
                </div>
                <p className="mt-1 truncate text-sm font-medium text-[#18181B]">{ticket.description}</p>
                <p className="mt-0.5 text-xs text-[#71717A]">
                  {ticket.projectName} · {fmtDate(ticket.workDate, i18n.language)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-base font-semibold tabular-nums text-[#18181B]">{money(ticket.total)}</p>
                <p className="mt-0.5 flex items-center justify-end gap-1 text-xs text-[#71717A]">
                  <Clock className="h-3 w-3" />
                  {t('tm:list.age', { count: ticket.ageDays })}
                </p>
              </div>
            </button>

            {open && (
              <div className="space-y-4 border-t border-[#E4E4E7] p-4">
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <Detail label={t('tm:detail.people')} value={String(ticket.workerCount)} />
                  <Detail label={t('tm:detail.hours')} value={String(ticket.hours)} />
                  <Detail label={t('tm:detail.rate')} value={money(ticket.hourlyRate)} />
                  <Detail label={t('tm:detail.material')} value={money(ticket.material)} />
                  <Detail label={t('tm:detail.labor')} value={money(ticket.labor)} />
                  <Detail label={t('tm:detail.total')} value={money(ticket.total)} />
                </dl>

                {ticket.notes && (
                  <p className="rounded-lg bg-[#FAFAFA] p-3 text-sm text-[#3F3F46]">{ticket.notes}</p>
                )}

                <p className="text-xs text-[#71717A]">
                  {t('tm:detail.capturedBy', {
                    user: ticket.createdBy,
                    date: fmtDateTime(ticket.createdAt, i18n.language),
                  })}
                </p>

                {ticket.status === 'SIGNED' && ticket.signerName && (
                  <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
                    <p className="font-medium">
                      {t('tm:signature.signedBy', {
                        name: ticket.signerName,
                        title: ticket.signerTitle ?? '',
                      })}
                    </p>
                    {ticket.signedAt && (
                      <p className="mt-0.5 text-xs">
                        {t('tm:signature.signedAt', { date: fmtDateTime(ticket.signedAt, i18n.language) })}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-emerald-700">{t('tm:signature.waitingOffice')}</p>
                  </div>
                )}

                {ticket.status === 'DECLINED' && (
                  <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                    <p className="flex items-center gap-1.5 font-medium">
                      <AlertTriangle className="h-4 w-4" />
                      {t('tm:signature.declined')}
                    </p>
                    {ticket.declineReason && (
                      <p className="mt-0.5 text-xs">
                        {t('tm:signature.declineReason', { reason: ticket.declineReason })}
                      </p>
                    )}
                    <p className="mt-1 text-xs">{t('tm:signature.declinedHint')}</p>
                  </div>
                )}

                {ticket.status === 'CONVERTED' && (
                  <div className="rounded-lg bg-zinc-100 p-3 text-sm text-zinc-700">
                    {t('tm:signature.converted', {
                      date: ticket.convertedAt ? fmtDateTime(ticket.convertedAt, i18n.language) : '',
                    })}
                  </div>
                )}

                {ticket.documentHash && (
                  <p className="text-xs text-[#A1A1AA]">
                    {t('tm:detail.hash')}{' '}
                    <span className="font-mono">{ticket.documentHash.slice(0, 16)}…</span>
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  {ticket.editable && (
                    <button
                      type="button"
                      onClick={() => { setEditing(ticket); setComposing(false); }}
                      className="rounded-md border border-[#D4D4D8] px-3 py-1.5 text-xs font-medium hover:bg-[#FAFAFA]"
                    >
                      {t('tm:actions.edit')}
                    </button>
                  )}

                  {ticket.editable && (
                    <button
                      type="button"
                      onClick={() => void askSignature(ticket)}
                      disabled={busyId === ticket.id}
                      className="inline-flex items-center gap-1.5 rounded-md bg-[#F97316] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#EA580C] disabled:opacity-50"
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
                        className="inline-flex items-center gap-1.5 rounded-md bg-[#F97316] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#EA580C]"
                      >
                        <PenLine className="h-3.5 w-3.5" />
                        {t('tm:actions.signHere')}
                      </button>
                      <button
                        type="button"
                        onClick={() => void copyLink(ticket)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-[#D4D4D8] px-3 py-1.5 text-xs font-medium hover:bg-[#FAFAFA]"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        {copiedId === ticket.id ? t('tm:actions.copied') : t('tm:actions.copyLink')}
                      </button>
                      <button
                        type="button"
                        onClick={() => void revoke(ticket)}
                        disabled={busyId === ticket.id}
                        className="inline-flex items-center gap-1.5 text-xs text-[#71717A] hover:text-red-600 disabled:opacity-50"
                      >
                        <Undo2 className="h-3.5 w-3.5" />
                        {t('tm:actions.revoke')}
                      </button>
                    </>
                  )}
                </div>

                {ticket.status === 'PENDING_SIGNATURE' && (
                  <p className="text-xs text-[#71717A]">{t('tm:actions.linkHint')}</p>
                )}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-[#71717A]">{label}</dt>
      <dd className="tabular-nums text-[#18181B]">{value}</dd>
    </div>
  );
}
