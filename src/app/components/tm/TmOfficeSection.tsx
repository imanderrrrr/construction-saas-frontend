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
import { AlertTriangle, Loader2, RefreshCw, Wallet } from 'lucide-react';
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

  const money = (amount: number) => formatApiAmount(amount, i18n.language);

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
    <div className="space-y-4">
      <div className="rounded-xl border border-[#D4D4D8] bg-white p-4">
        <h3 className="text-sm font-semibold text-[#18181B]">{t('pending.title')}</h3>
        <p className="mt-0.5 text-xs text-[#71717A]">{t('office.pendingHint')}</p>

        {pending && (
          <dl className="mt-3 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-[#FAFAFA] p-2">
              <dt className="text-xs text-[#71717A]">{t('pending.count')}</dt>
              <dd className="text-lg font-semibold tabular-nums text-[#18181B]">{pending.ticketCount}</dd>
            </div>
            <div className="rounded-lg bg-[#FAFAFA] p-2">
              <dt className="text-xs text-[#71717A]">{t('pending.total')}</dt>
              <dd className="text-lg font-semibold tabular-nums text-[#18181B]">{money(pending.totalPending)}</dd>
            </div>
            <div className="rounded-lg bg-[#FAFAFA] p-2">
              <dt className="text-xs text-[#71717A]">{t('pending.oldest')}</dt>
              <dd className="text-lg font-semibold tabular-nums text-[#18181B]">
                {t('pending.days', { count: pending.oldestAgeDays })}
              </dd>
            </div>
          </dl>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          aria-label={t('filter.status')}
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as '' | TmTicketStatus)}
          className="rounded-lg border border-[#D4D4D8] px-2 py-1.5 text-sm"
        >
          <option value="">{t('filter.allStatuses')}</option>
          {TM_TICKET_STATUSES.map(s => (
            <option key={s} value={s}>{t(`status.${s}`)}</option>
          ))}
        </select>
      </div>

      {actionError && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{actionError}</p>
      )}

      {loading && (
        <div className="flex items-center gap-2 py-10 text-sm text-[#71717A]">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('list.loading')}
        </div>
      )}

      {!loading && failed && (
        <div className="rounded-xl border border-[#D4D4D8] bg-white p-6 text-center">
          <p className="text-sm text-[#71717A]">{t('list.loadFailed')}</p>
          <button
            type="button"
            onClick={() => void reload()}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-[#F97316]"
          >
            <RefreshCw className="h-4 w-4" />
            {t('list.retry')}
          </button>
        </div>
      )}

      {!loading && !failed && tickets.length === 0 && (
        <div className="rounded-xl border border-dashed border-[#D4D4D8] bg-white p-8 text-center">
          <p className="text-sm font-medium text-[#18181B]">{t('office.empty')}</p>
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
                  {ticket.projectName} · {fmtDate(ticket.workDate, i18n.language)} ·{' '}
                  {t('list.age', { count: ticket.ageDays })}
                </p>
              </div>
              <p className="shrink-0 text-base font-semibold tabular-nums text-[#18181B]">
                {money(ticket.total)}
              </p>
            </button>

            {open && (
              <div className="space-y-4 border-t border-[#E4E4E7] p-4">
                <dl className="grid grid-cols-3 gap-2 text-sm">
                  <Detail label={t('detail.people')} value={String(ticket.workerCount)} />
                  <Detail label={t('detail.hours')} value={String(ticket.hours)} />
                  <Detail label={t('detail.rate')} value={money(ticket.hourlyRate)} />
                  <Detail label={t('detail.labor')} value={money(ticket.labor)} />
                  <Detail label={t('detail.material')} value={money(ticket.material)} />
                  <Detail label={t('detail.total')} value={money(ticket.total)} />
                </dl>

                {ticket.notes && (
                  <p className="rounded-lg bg-[#FAFAFA] p-3 text-sm text-[#3F3F46]">{ticket.notes}</p>
                )}

                <p className="text-xs text-[#71717A]">
                  {t('detail.capturedBy', {
                    user: ticket.createdBy,
                    date: fmtDateTime(ticket.createdAt, i18n.language),
                  })}
                </p>

                {ticket.status === 'SIGNED' && ticket.signerName && (
                  <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
                    <p className="font-medium">
                      {t('signature.signedBy', {
                        name: ticket.signerName,
                        title: ticket.signerTitle ?? '',
                      })}
                    </p>
                    {ticket.signedAt && (
                      <p className="mt-0.5 text-xs">
                        {t('signature.signedAt', { date: fmtDateTime(ticket.signedAt, i18n.language) })}
                      </p>
                    )}
                  </div>
                )}

                {ticket.status === 'DECLINED' && (
                  <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                    <p className="flex items-center gap-1.5 font-medium">
                      <AlertTriangle className="h-4 w-4" />
                      {t('signature.declined')}
                    </p>
                    {ticket.declineReason && (
                      <p className="mt-0.5 text-xs">
                        {t('signature.declineReason', { reason: ticket.declineReason })}
                      </p>
                    )}
                  </div>
                )}

                {ticket.status === 'CONVERTED' && (
                  <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
                    {t('office.convertedOn', {
                      date: ticket.convertedAt ? fmtDateTime(ticket.convertedAt, i18n.language) : '',
                      user: ticket.convertedBy ?? '',
                    })}
                  </div>
                )}

                {ticket.documentHash && (
                  <p className="text-xs text-[#A1A1AA]">
                    {t('detail.hash')}{' '}
                    <span className="font-mono">{ticket.documentHash.slice(0, 16)}…</span>
                  </p>
                )}

                {/* `convertible` is the server's answer, not a rule re-derived
                    here — so a rule that moves on the backend cannot leave a
                    button lit that the API refuses. */}
                {ticket.convertible && (
                  <button
                    type="button"
                    onClick={() => { setConverting(ticket); setChangeOrderNumber(''); }}
                    className="inline-flex items-center gap-1.5 rounded-md bg-[#18181B] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#3F3F46]"
                  >
                    <Wallet className="h-3.5 w-3.5" />
                    {t('office.convert')}
                  </button>
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={t('office.convertTitle')}
        >
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
            <h3 className="text-base font-semibold text-[#18181B]">{t('office.convertTitle')}</h3>

            <p className="mt-2 text-sm text-[#3F3F46]">
              {t('office.convertBody', {
                number: converting.ticketNumber,
                project: converting.projectName,
                amount: money(converting.total),
              })}
            </p>

            {/* Said plainly: this is the step that moves money. */}
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {t('office.convertWarning')}
            </p>

            <label className="mt-4 block text-sm font-medium text-[#3F3F46]">
              {t('office.changeOrderNumber')}
              <input
                type="text"
                value={changeOrderNumber}
                onChange={e => setChangeOrderNumber(e.target.value)}
                maxLength={FIELD_LIMITS.IDENTIFIER}
                className="mt-1 w-full rounded-lg border border-[#D4D4D8] px-3 py-2 text-sm focus:border-[#F97316] focus:outline-none"
              />
              <span className="mt-1 block text-xs font-normal text-[#71717A]">
                {t('office.changeOrderNumberHint')}
              </span>
            </label>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void doConvert()}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-lg bg-[#18181B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3F3F46] disabled:opacity-50"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('office.convertConfirm')}
              </button>
              <button
                type="button"
                onClick={() => setConverting(null)}
                disabled={busy}
                className="text-sm text-[#71717A] hover:text-[#18181B]"
              >
                {t('office.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
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
