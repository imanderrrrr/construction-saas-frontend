// BuildTrack — The office side of T&M: what is waiting, and turning a signed
// ticket into a change order.
//
// ## Converting is a decision, not a consequence
//
// A signature does NOT convert a ticket. The backend leaves a signed ticket
// SIGNED and waits for someone here to say so, and this screen is built to make
// that explicit rather than to hide it behind an automatic step: conversion is
// its own button, behind its own confirmation, and the confirmation says what
// it does — **this is the moment money moves.** It raises the contract and
// writes a contract-history entry, and it cannot be undone from any screen.
//
// A typo made on a phone in the rain must not be able to move the ledger by
// itself. That is the whole reason the two halves are separate.
//
// There is no delete here, and there is no endpoint for one. A T&M is revoked
// while it waits, or refused by the signer — never removed.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Wallet } from 'lucide-react';
import { fmtDate, fmtDateTime } from '../../helpers/dateTime';
import { formatApiAmount } from '../../helpers/tmMoney';
import { FIELD_LIMITS } from '../../../shared/fieldLimits';
import {
  TM_TICKET_STATUSES,
  convertTmTicket,
  getOfficeTmPending,
  listOfficeTmTickets,
  type TmPendingSummary,
  type TmTicket,
  type TmTicketStatus,
} from '../../services/tm';
import { TmStatusChip } from './TmStatusChip';

export function TmOfficeSection() {
  const { t, i18n } = useTranslation('tm');

  const [tickets, setTickets] = useState<TmTicket[]>([]);
  const [pending, setPending] = useState<TmPendingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const [statusFilter, setStatusFilter] = useState<'' | TmTicketStatus>('');
  const [expanded, setExpanded] = useState<number | null>(null);

  const [converting, setConverting] = useState<TmTicket | null>(null);
  const [changeOrderNumber, setChangeOrderNumber] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const filters = useMemo(() => ({ status: statusFilter || undefined }), [statusFilter]);

  // Bumped to ask for a fresh read after a conversion.
  const [refreshKey, setRefreshKey] = useState(0);
  const reload = useCallback(() => setRefreshKey(k => k + 1), []);

  // State lands only inside the promise callbacks — no synchronous setState in
  // the effect body, which is the idiom the rest of this codebase follows, and
  // `cancelled` keeps a late response from writing after a filter change.
  useEffect(() => {
    let cancelled = false;
    Promise.all([listOfficeTmTickets(filters), getOfficeTmPending()])
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

  const doConvert = async () => {
    if (!converting) return;
    setBusy(true);
    setActionError(null);
    try {
      await convertTmTicket(converting.id, {
        changeOrderNumber: changeOrderNumber.trim() || undefined,
      });
      setConverting(null);
      setChangeOrderNumber('');
      void reload();
    } catch {
      setActionError(t('office.convertFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-4">
      {/* Same featured card as the site side, so the two halves of T&M read as
          one module — but this is the office's copy of the number, and the
          hint underneath says whose desk it is sitting on. */}
      <section className="relative overflow-hidden rounded-xl bg-[#0A0A0A] p-5 sm:p-6 md:p-7 text-[#F5F1E8]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#F5F1E8]/50">
          {t('pending.title')}
        </p>
        <p className="mt-2 font-bt-display font-bold leading-[0.84] tracking-tight tabular-nums text-5xl sm:text-6xl md:text-7xl">
          {pending ? money(pending.totalPending) : '—'}
        </p>
        <p className="mt-3 max-w-md text-xs leading-relaxed text-[#F5F1E8]/60">{t('office.pendingHint')}</p>

        {pending && (
          <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-[#F5F1E8]/15 pt-4 sm:grid-cols-3">
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-[#F5F1E8]/45">
                {t('pending.count')}
              </dt>
              <dd className="mt-1 text-xl font-bold tabular-nums">{pending.ticketCount}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-[#F5F1E8]/45">
                {t('pending.oldest')}
              </dt>
              <dd className="mt-1 text-xl font-bold tabular-nums">
                {t('pending.days', { count: pending.oldestAgeDays })}
              </dd>
            </div>
          </dl>
        )}
      </section>

      <div className="rounded-xl border border-[#D4D4D8] bg-white p-3 sm:p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-[150px] flex-1 flex-col gap-1.5 sm:max-w-[240px]">
            <label
              htmlFor="tm-office-status"
              className="text-[11px] font-semibold uppercase tracking-wide text-[#71717A]"
            >
              {t('filter.status')}
            </label>
            <select
              id="tm-office-status"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as '' | TmTicketStatus)}
              className="h-9 rounded-lg border border-[#D4D4D8] bg-white px-3 text-sm text-[#0A0A0A] transition-colors focus:border-[#F97316] focus:outline-none focus:ring-2 focus:ring-[#F97316]/25"
            >
              <option value="">{t('filter.allStatuses')}</option>
              {TM_TICKET_STATUSES.map(s => (
                <option key={s} value={s}>{t(`status.${s}`)}</option>
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
            {t('list.loading')}
          </p>
        </div>
      )}

      {!loading && failed && (
        <div className="rounded-xl border border-[#D4D4D8] bg-white p-10 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-red-50">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <p className="mt-3 text-sm font-medium text-[#0A0A0A]">{t('list.loadFailed')}</p>
          <button
            type="button"
            onClick={() => void reload()}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-[#D4D4D8] px-3 py-2 text-xs font-semibold text-[#0A0A0A] transition-colors hover:border-[#F97316] hover:text-[#F97316]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {t('list.retry')}
          </button>
        </div>
      )}

      {!loading && !failed && tickets.length === 0 && (
        <div className="rounded-xl border border-[#D4D4D8] bg-white p-12 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#F97316]/10">
            <Wallet className="h-5 w-5 text-[#F97316]" />
          </div>
          <p className="mt-3 text-sm font-semibold text-[#0A0A0A]">{t('office.empty')}</p>
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
                  {ticket.projectName} · {fmtDate(ticket.workDate, i18n.language)} ·{' '}
                  {t('list.age', { count: ticket.ageDays })}
                </p>
              </div>
              <p className="shrink-0 text-lg font-bold tabular-nums text-[#0A0A0A]">
                {money(ticket.total)}
              </p>
            </button>

            {open && (
              <div className="space-y-4 border-t border-[#D4D4D8] p-4">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg bg-[#FAFAFA] p-3 sm:grid-cols-3">
                  <Detail label={t('detail.people')} value={String(ticket.workerCount)} />
                  <Detail label={t('detail.hours')} value={String(ticket.hours)} />
                  <Detail label={t('detail.rate')} value={money(ticket.hourlyRate)} />
                  <Detail label={t('detail.labor')} value={money(ticket.labor)} />
                  <Detail label={t('detail.material')} value={money(ticket.material)} />
                  <Detail label={t('detail.total')} value={money(ticket.total)} strong />
                </dl>

                {ticket.notes && (
                  <p className="rounded-lg border border-[#D4D4D8] bg-white p-3 text-sm leading-relaxed text-[#3F3F46]">
                    {ticket.notes}
                  </p>
                )}

                <p className="text-xs text-[#71717A]">
                  {t('detail.capturedBy', {
                    user: ticket.createdBy,
                    date: fmtDateTime(ticket.createdAt, i18n.language),
                  })}
                </p>

                {ticket.status === 'SIGNED' && ticket.signerName && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-900">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      {t('signature.signedBy', {
                        name: ticket.signerName,
                        title: ticket.signerTitle ?? '',
                      })}
                    </p>
                    {ticket.signedAt && (
                      <p className="mt-1 text-xs text-emerald-800">
                        {t('signature.signedAt', { date: fmtDateTime(ticket.signedAt, i18n.language) })}
                      </p>
                    )}
                  </div>
                )}

                {ticket.status === 'DECLINED' && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-red-900">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      {t('signature.declined')}
                    </p>
                    {ticket.declineReason && (
                      <p className="mt-1 text-xs text-red-800">
                        {t('signature.declineReason', { reason: ticket.declineReason })}
                      </p>
                    )}
                  </div>
                )}

                {ticket.status === 'CONVERTED' && (
                  <div className="flex items-start gap-2 rounded-lg bg-[#0A0A0A] p-3 text-sm text-[#F5F1E8]">
                    <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-[#F97316]" />
                    <span>
                      {t('office.convertedOn', {
                        date: ticket.convertedAt ? fmtDateTime(ticket.convertedAt, i18n.language) : '',
                        user: ticket.convertedBy ?? '',
                      })}
                    </span>
                  </div>
                )}

                {ticket.documentHash && (
                  <p className="text-[11px] text-[#A1A1AA]">
                    {t('detail.hash')}{' '}
                    <span className="font-mono">{ticket.documentHash.slice(0, 16)}…</span>
                  </p>
                )}

                {/* `convertible` is the server's answer, not a rule re-derived
                    here — so a rule that moves on the backend cannot leave a
                    button lit that the API refuses. */}
                {ticket.convertible && (
                  <div className="border-t border-[#D4D4D8] pt-3">
                    <button
                      type="button"
                      onClick={() => { setConverting(ticket); setChangeOrderNumber(''); }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#0A0A0A] px-4 py-2 text-xs font-semibold text-[#F5F1E8] transition-colors hover:bg-[#F97316] hover:text-[#0A0A0A]"
                    >
                      <Wallet className="h-3.5 w-3.5" />
                      {t('office.convert')}
                    </button>
                  </div>
                )}

                {!ticket.convertible && ticket.status !== 'CONVERTED' && (
                  <p className="text-xs text-[#71717A]">{t('office.notConvertible')}</p>
                )}
              </div>
            )}
          </article>
        );
      })}

      {converting && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A0A0A]/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={t('office.convertTitle')}
        >
          <div className="w-full max-w-md overflow-hidden rounded-xl border border-[#D4D4D8] bg-white shadow-xl">
            {/* The amount leads, because the amount is what is about to move. */}
            <div className="bg-[#0A0A0A] p-5 text-[#F5F1E8]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#F5F1E8]/50">
                {t('office.convertTitle')}
              </p>
              <p className="mt-2 font-bt-display font-bold leading-[0.84] tracking-tight tabular-nums text-4xl sm:text-5xl">
                {money(converting.total)}
              </p>
              <p className="mt-2.5 text-xs text-[#F5F1E8]/60">
                {t('office.convertBody', {
                  number: converting.ticketNumber,
                  project: converting.projectName,
                  amount: money(converting.total),
                })}
              </p>
            </div>

            <div className="p-5">
              {/* Said plainly: this is the step that moves money. */}
              <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {t('office.convertWarning')}
              </p>

              <label className="mt-4 block text-[11px] font-semibold uppercase tracking-wide text-[#71717A]">
                {t('office.changeOrderNumber')}
                <input
                  type="text"
                  value={changeOrderNumber}
                  onChange={e => setChangeOrderNumber(e.target.value)}
                  maxLength={FIELD_LIMITS.IDENTIFIER}
                  className="mt-1.5 h-9 w-full rounded-lg border border-[#D4D4D8] px-3 text-sm font-normal normal-case tracking-normal text-[#0A0A0A] transition-colors focus:border-[#F97316] focus:outline-none focus:ring-2 focus:ring-[#F97316]/25"
                />
                <span className="mt-1.5 block text-xs font-normal normal-case tracking-normal text-[#71717A]">
                  {t('office.changeOrderNumberHint')}
                </span>
              </label>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void doConvert()}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#0A0A0A] px-4 py-2.5 text-sm font-semibold text-[#F5F1E8] transition-colors hover:bg-[#F97316] hover:text-[#0A0A0A] disabled:opacity-40"
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t('office.convertConfirm')}
                </button>
                <button
                  type="button"
                  onClick={() => setConverting(null)}
                  disabled={busy}
                  className="rounded-lg px-2 py-2.5 text-sm font-medium text-[#71717A] transition-colors hover:text-[#0A0A0A] disabled:opacity-40"
                >
                  {t('office.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * The left rail on a ticket card — see the note in `TmFieldSection`. The
 * office cares most about the two ends of the run: emerald is work somebody
 * signed and this desk still owes a decision on, ink is work already turned
 * into a change order.
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
