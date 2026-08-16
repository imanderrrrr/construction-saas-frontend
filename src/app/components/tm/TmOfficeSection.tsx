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
//
// Dressed in the same industrial language as the site side — see the note at
// the top of `TmFieldSection`.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ChevronRight, Loader2, RefreshCw, Wallet } from 'lucide-react';
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

const BTN_PRIMARY = 'inline-flex items-center gap-2 bg-[#0A0A0A] hover:bg-[#F97316] text-[#F5F1E8] hover:text-[#0A0A0A] font-bt-mono text-[11px] font-semibold uppercase tracking-[0.08em] px-4 py-2.5 transition-colors disabled:opacity-40 disabled:hover:bg-[#0A0A0A] disabled:hover:text-[#F5F1E8]';
const BTN_GHOST = 'font-bt-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#8A8175] hover:text-[#0A0A0A] transition-colors disabled:opacity-40';

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

  const [pendingSym, pendingDigits] = pending ? splitMoney(money(pending.totalPending)) : ['', '—'];
  const [convSym, convDigits] = converting ? splitMoney(money(converting.total)) : ['', ''];

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-4">
      {/* Editorial header — same grammar as the site side; the right-hand mono
          caption is the office's standing rule, the way Aprobaciones carries
          "NADA CUENTA HASTA QUE APRUEBAS". */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <Mono className="text-[11px] tracking-[0.15em] text-[#71717A]">{t('kicker.office')}</Mono>
          <h2 className="font-bt-display font-bold uppercase text-4xl md:text-5xl leading-none text-[#0A0A0A] mt-1.5">
            {t('section.office.title')}
          </h2>
          <p className="text-sm text-[#52525B] mt-1.5">{t('section.office.subtitle')}</p>
        </div>
        <Mono className="block text-[10px] text-[#A1A1AA] flex-shrink-0">{t('office.headerNote')}</Mono>
      </div>

      {/* Same ink hero as the site side, so the two halves of T&M read as one
          module — but this is the office's copy of the number, and the line
          underneath says whose desk it is sitting on. */}
      <section className="relative overflow-hidden bg-[#0A0A0A] p-5 sm:p-6 md:p-7 text-[#F5F1E8]">
        <div className="absolute inset-0 pointer-events-none" style={GRID_INK} />
        <div className="relative">
          <Mono className="block text-[11px] tracking-[0.15em] text-[#F5F1E8]/50">
            {t('pending.title')}
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
            {t('office.pendingHint')}
          </Mono>

          {pending && (
            <dl className="mt-5 grid grid-cols-2 sm:grid-cols-3 border-t border-[#F5F1E8]/15">
              <div className="pt-4 pr-4 border-r border-[#F5F1E8]/15">
                <dd className="font-bt-display font-bold text-2xl leading-none tabular-nums">{pending.ticketCount}</dd>
                <dt className="mt-1.5"><Mono className="text-[9.5px] text-[#F5F1E8]/45">{t('pending.count')}</Mono></dt>
              </div>
              <div className="pt-4 px-4">
                <dd className="font-bt-display font-bold uppercase text-2xl leading-none tabular-nums">
                  {t('pending.days', { count: pending.oldestAgeDays })}
                </dd>
                <dt className="mt-1.5"><Mono className="text-[9.5px] text-[#F5F1E8]/45">{t('pending.oldest')}</Mono></dt>
              </div>
            </dl>
          )}
        </div>
      </section>

      <div className="bg-white border border-[#E4E4E7] p-3.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <select
            aria-label={t('filter.status')}
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as '' | TmTicketStatus)}
            className="appearance-none cursor-pointer border border-[#DBD0BB] bg-[#FAF7F0] px-3 py-2 font-bt-mono text-[11px] uppercase tracking-[0.06em] text-[#0A0A0A] max-w-[230px] focus:border-[#F97316] outline-none"
          >
            <option value="">{t('filter.statusAll')}</option>
            {TM_TICKET_STATUSES.map(s => (
              <option key={s} value={s}>{t(`status.${s}`)}</option>
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
            <Mono className="text-[10px] text-[#8A8175]">{t('list.loading')}</Mono>
          </p>
        </div>
      )}

      {!loading && failed && (
        <div className="bg-white border border-[#E4E4E7] py-16 text-center">
          <p className="text-sm text-[#71717A]">{t('list.loadFailed')}</p>
          <button
            type="button"
            onClick={() => void reload()}
            className="mt-3 inline-flex items-center gap-1.5 font-bt-mono text-[10px] uppercase tracking-[0.1em] border border-[#DBD0BB] px-3 py-1.5 hover:border-[#F97316]"
          >
            <RefreshCw className="h-3 w-3" />
            {t('list.retry')}
          </button>
        </div>
      )}

      {!loading && !failed && tickets.length === 0 && (
        <div className="bg-white border border-[#E4E4E7] py-[70px] px-6 text-center">
          <div className="font-bt-display font-bold text-4xl leading-none text-[#CDBFA6]">{t('list.emptyBig')}</div>
          <p className="font-bt-heading font-bold text-base text-[#0A0A0A] mt-2.5">{t('office.empty')}</p>
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
                      {ticket.projectName} · {fmtDate(ticket.workDate, i18n.language)} · {t('list.age', { count: ticket.ageDays })}
                    </Mono>
                  </div>
                  <div className="flex items-baseline gap-0.5 flex-shrink-0">
                    <span className="font-bt-display font-bold text-base text-[#8A8175]">{sym}</span>
                    <span className="font-bt-display font-bold text-2xl sm:text-3xl leading-none tabular-nums text-[#0A0A0A]">{digits}</span>
                  </div>
                  <ChevronRight className={`w-4 h-4 text-[#C6BBA6] flex-shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
                </button>

                {open && (
                  <div className="border-t border-[#EDE7DB] bg-[#FBF8F2] px-4 sm:px-5 py-4 space-y-4">
                    <div className="border border-[#E4E4E7] bg-white">
                      <LedgerRow label={t('detail.people')} value={String(ticket.workerCount)} />
                      <LedgerRow label={t('detail.hours')} value={String(ticket.hours)} />
                      <LedgerRow label={t('detail.rate')} value={money(ticket.hourlyRate)} />
                      <LedgerRow label={t('detail.labor')} value={money(ticket.labor)} />
                      <LedgerRow label={t('detail.material')} value={money(ticket.material)} />
                      <div className="flex items-center justify-between gap-2.5 px-3.5 py-2.5 bg-[#FBF8F2]">
                        <Mono className="text-[10px] tracking-[0.08em] text-[#5A5346]">{t('detail.total')}</Mono>
                        <span className="font-bt-display font-bold text-xl leading-none tabular-nums text-[#0A0A0A]">{money(ticket.total)}</span>
                      </div>
                    </div>

                    {ticket.notes && (
                      <p className="border-l-2 border-[#DED4C2] pl-3 text-[13px] leading-relaxed text-[#3F3F46]">
                        {ticket.notes}
                      </p>
                    )}

                    <Mono className="block text-[10px] tracking-[0.04em] normal-case text-[#8A8175]">
                      {t('detail.capturedBy', {
                        user: ticket.createdBy,
                        date: fmtDateTime(ticket.createdAt, i18n.language),
                      })}
                    </Mono>

                    {ticket.status === 'SIGNED' && ticket.signerName && (
                      <div className="bg-[#0A0A0A] text-[#F5F1E8] px-3.5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-[#D5C9B4] block flex-shrink-0" />
                          <Mono className="text-[10px] tracking-[0.1em]">
                            {t('signature.signedBy', {
                              name: ticket.signerName,
                              title: ticket.signerTitle ?? '',
                            })}
                          </Mono>
                        </div>
                        {ticket.signedAt && (
                          <Mono className="block mt-1.5 pl-3.5 text-[9.5px] tracking-[0.05em] normal-case text-[#F5F1E8]/60">
                            {t('signature.signedAt', { date: fmtDateTime(ticket.signedAt, i18n.language) })}
                          </Mono>
                        )}
                      </div>
                    )}

                    {ticket.status === 'DECLINED' && (
                      <div className="bg-[#FBEDE0] border border-[#F6CFA6] border-l-[3px] border-l-[#F97316] px-3.5 py-3">
                        <p className="flex items-center gap-2 font-bt-heading font-bold text-[14px] text-[#0A0A0A]">
                          <AlertTriangle className="h-4 w-4 shrink-0 text-[#EA580C]" />
                          {t('signature.declined')}
                        </p>
                        {ticket.declineReason && (
                          <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#43301F]">
                            {t('signature.declineReason', { reason: ticket.declineReason })}
                          </p>
                        )}
                      </div>
                    )}

                    {ticket.status === 'CONVERTED' && (
                      <div className="flex items-center gap-2 bg-[#0A0A0A] px-3.5 py-3 text-[#F5F1E8]">
                        <span className="w-1.5 h-1.5 bg-[#F97316] block flex-shrink-0" />
                        <Mono className="text-[10px] tracking-[0.05em] normal-case">
                          {t('office.convertedOn', {
                            date: ticket.convertedAt ? fmtDateTime(ticket.convertedAt, i18n.language) : '',
                            user: ticket.convertedBy ?? '',
                          })}
                        </Mono>
                      </div>
                    )}

                    {ticket.documentHash && (
                      <Mono className="block text-[9.5px] tracking-[0.04em] normal-case text-[#B4A992]">
                        {t('detail.hash')} {ticket.documentHash.slice(0, 16)}…
                      </Mono>
                    )}

                    {/* `convertible` is the server's answer, not a rule re-derived
                        here — so a rule that moves on the backend cannot leave a
                        button lit that the API refuses. */}
                    {ticket.convertible && (
                      <div className="border-t border-[#EDE7DB] pt-3.5">
                        <button
                          type="button"
                          onClick={() => { setConverting(ticket); setChangeOrderNumber(''); }}
                          className={BTN_PRIMARY}
                        >
                          <Wallet className="h-3.5 w-3.5" />
                          {t('office.convert')}
                        </button>
                      </div>
                    )}

                    {!ticket.convertible && ticket.status !== 'CONVERTED' && (
                      <Mono className="block text-[10px] tracking-[0.04em] normal-case text-[#8A8175]">
                        {t('office.notConvertible')}
                      </Mono>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {converting && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B0A09]/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={t('office.convertTitle')}
        >
          <div className="w-full max-w-md bg-white border border-[#CDBFA6] shadow-2xl">
            {/* The amount leads, because the amount is what is about to move —
                it gets the ink surface and the grid, like every featured
                number in the panel. */}
            <div className="relative overflow-hidden bg-[#0A0A0A] p-5 text-[#F5F1E8]">
              <div className="absolute inset-0 pointer-events-none" style={GRID_INK} />
              <div className="relative">
                <Mono className="block text-[10.5px] tracking-[0.15em] text-[#F5F1E8]/50">
                  {t('office.convertTitle')}
                </Mono>
                <div className="flex items-baseline mt-2">
                  <span className="font-bt-display font-bold text-2xl sm:text-3xl text-[#F5F1E8]/60 self-start mt-1">{convSym}</span>
                  <span className="font-bt-display font-bold leading-[0.84] tracking-tight tabular-nums text-4xl sm:text-5xl">{convDigits}</span>
                </div>
                <Mono className="block mt-2.5 text-[10.5px] tracking-[0.05em] normal-case text-[#F5F1E8]/60">
                  {t('office.convertBody', {
                    number: converting.ticketNumber,
                    project: converting.projectName,
                    amount: money(converting.total),
                  })}
                </Mono>
              </div>
            </div>

            <div className="p-5">
              {/* Said plainly: this is the step that moves money. */}
              <p className="flex items-start gap-2.5 bg-[#FBEDE0] border border-[#F6CFA6] border-l-[3px] border-l-[#F97316] px-3 py-2.5 text-[12.5px] leading-relaxed text-[#43301F]">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#EA580C]" />
                {t('office.convertWarning')}
              </p>

              <label className="mt-4 block font-bt-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-[#5A5346]">
                {t('office.changeOrderNumber')}
                <input
                  type="text"
                  value={changeOrderNumber}
                  onChange={e => setChangeOrderNumber(e.target.value)}
                  maxLength={FIELD_LIMITS.IDENTIFIER}
                  className="mt-1.5 h-10 w-full border border-[#DBD0BB] bg-[#FAF7F0] px-3 font-sans text-sm font-normal normal-case tracking-normal text-[#0A0A0A] transition-colors focus:border-[#F97316] outline-none"
                />
                <span className="mt-1.5 block font-sans text-xs font-normal normal-case tracking-normal text-[#71717A]">
                  {t('office.changeOrderNumberHint')}
                </span>
              </label>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void doConvert()}
                  disabled={busy}
                  className={BTN_PRIMARY}
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t('office.convertConfirm')}
                </button>
                <button
                  type="button"
                  onClick={() => setConverting(null)}
                  disabled={busy}
                  className={BTN_GHOST}
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

/** One line of the arithmetic ledger: mono label left, mono figure right. */
function LedgerRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2.5 px-3.5 py-2 border-b border-[#F0EBE1]">
      <Mono className="text-[10px] tracking-[0.08em] text-[#5A5346]">{label}</Mono>
      <Mono className="text-[12.5px] font-semibold tracking-normal normal-case tabular-nums text-[#0A0A0A]">{value}</Mono>
    </div>
  );
}
