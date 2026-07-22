import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Check, Loader2, X } from 'lucide-react';
import {
  approveEvent, approveRecord, correctEvent, correctRecord, editEventTime,
  getTimeRecord, rejectRecord, resolveTransitDispute, type TimeRecordResponse,
} from '../../services/time';
import { fmtDateTime } from '../../helpers/dateTime';
import {
  Mono, alertsFor, dayHours, distanceState, hhmm, initials, statusPillClass,
} from './shared';

/**
 * One day, opened. The vertical timeline is the heart: every punch with its
 * time, its distance to the jobsite and its own review actions — because the
 * question an admin actually asks is "does this day make sense?", not "what
 * rows are in the table".
 */
export function RecordDrawer({ recordId, onClose, onChanged }: {
  recordId: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t, i18n } = useTranslation(['admin', 'common']);
  const lang = i18n.language;

  const [record, setRecord] = useState<TimeRecordResponse | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [action, setAction] = useState<'observe' | 'reject' | null>(null);
  const [comment, setComment] = useState('');
  const [editingEvent, setEditingEvent] = useState<number | null>(null);
  const [timeValue, setTimeValue] = useState('');
  const [disputeMinutes, setDisputeMinutes] = useState('');

  const load = useCallback(() => {
    getTimeRecord(recordId).then(setRecord).catch(() => setRecord(null));
  }, [recordId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function run(key: string, fn: () => Promise<unknown>, close = false) {
    setBusy(key);
    try {
      await fn();
      if (close) onChanged(); else load();
    } catch { /* the drawer stays open with current state */ }
    finally { setBusy(null); }
  }

  if (!record) {
    return (
      <div className="fixed inset-0 z-[80]">
        <div onClick={onClose} className="absolute inset-0 bg-[#0B0A09]/40" />
        <aside className="absolute top-0 right-0 bottom-0 w-[492px] max-w-[94%] bg-white border-l border-[#CDBFA6] flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-[#A69C8D]" />
        </aside>
      </div>
    );
  }

  const alerts = alertsFor(record);
  const events = [...record.events].sort((a, b) =>
    new Date(a.capturedAtServer || a.capturedAtClient).getTime() -
    new Date(b.capturedAtServer || b.capturedAtClient).getTime());
  const disputeEvent = record.events.find(e => e.disputeStatus);
  const pending = record.approvalStatus === 'PENDING';

  return (
    <div className="fixed inset-0 z-[80]">
      <div onClick={onClose} className="absolute inset-0 bg-[#0B0A09]/40" />
      <aside className="absolute top-0 right-0 bottom-0 w-[492px] max-w-[94%] bg-white border-l border-[#CDBFA6] shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E4E4E7] flex-shrink-0">
          <Mono className="text-[11px] tracking-[0.15em] text-[#5A5346]">{t('admin:apr.d.title')}</Mono>
          <button onClick={onClose} className="w-7 h-7 border border-[#E4E4E7] bg-[#FAF7F0] flex items-center justify-center hover:border-[#F97316]">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {/* Worker header */}
          <div className="flex gap-3.5 items-start">
            <span className="w-12 h-12 flex items-center justify-center font-bt-mono text-sm font-semibold flex-shrink-0 bg-[#0A0A0A] text-[#F5F1E8]">
              {initials(record.workerName, record.workerUsername)}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-bt-heading font-bold text-xl leading-tight text-[#0A0A0A]">
                {record.workerName || record.workerUsername}
              </p>
              <Mono className="block text-[11.5px] normal-case tracking-normal text-[#A69C8D] mt-1">
                @{record.workerUsername} · {record.projectName}
              </Mono>
              <div className="flex flex-wrap gap-2 mt-2.5 items-center">
                <Mono className="text-[10px] bg-[#F3EEE4] text-[#5A5346] px-2 py-1">{record.workDate}</Mono>
                <Mono className="text-[10px] bg-[#0A0A0A] text-[#F5F1E8] px-2 py-1">{dayHours(record).toFixed(1)} h</Mono>
                <Mono className={`text-[10px] px-2 py-1 ${statusPillClass(record.approvalStatus)}`}>
                  {t(`admin:apr.st.${record.approvalStatus}`)}
                </Mono>
              </div>
            </div>
          </div>

          {/* Day alerts */}
          {alerts.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3.5">
              {alerts.map(a => (
                <div key={a.key} className="inline-flex items-center gap-2 bg-[#FBEDE0] border border-[#F6CFA6] border-l-[3px] border-l-[#F97316] px-2.5 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-[#EA580C] flex-shrink-0" />
                  <span className="text-[12px] text-[#43301F] leading-snug">
                    {t(`admin:apr.alertLong.${a.key}`, { detail: a.detail ?? '' })}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Timeline */}
          <div className="flex items-center gap-2.5 mt-6 mb-3">
            <span className="w-4 h-px bg-[#F97316] block" />
            <Mono className="text-[10px] tracking-[0.12em] text-[#8A8175]">{t('admin:apr.d.timeline')}</Mono>
          </div>
          <div className="relative">
            {events.map((e, i) => {
              const dist = distanceState(e, record.geofenceRadiusMeters);
              const evPending = e.eventApprovalStatus === 'PENDING';
              return (
                <div key={e.id} className="relative flex gap-3.5">
                  <div className="relative w-8 flex-shrink-0 flex justify-center">
                    {i < events.length - 1 && (
                      <span className="absolute top-6 -bottom-1 left-1/2 w-0.5 -translate-x-1/2 bg-[#E7E1D5]" />
                    )}
                    <span className={`relative w-7 h-7 flex items-center justify-center font-bt-mono text-[10px] font-semibold ${
                      dist.tone === 'far' ? 'bg-[#F97316] text-[#0A0A0A]' : 'bg-[#0A0A0A] text-[#F5F1E8]'
                    }`}>
                      {e.type === 'CHECK_IN' ? '→' : e.type === 'CHECK_OUT' ? '←' : '·'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0 pb-5">
                    <div className="flex items-baseline justify-between gap-2.5">
                      <Mono className="text-[10px] tracking-[0.1em] text-[#8A8175]">
                        {t(`admin:apr.ev.${e.type}`, { defaultValue: e.type })}
                      </Mono>
                      <span className="font-bt-display font-bold text-xl leading-none text-[#0A0A0A]">
                        {hhmm(e.capturedAtServer || e.capturedAtClient, lang)}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {e.manualCreatorUsername ? (
                        <Mono className="text-[9.5px] bg-[#F3EEE4] text-[#5A5346] px-2 py-1">
                          {t('admin:apr.d.manualBy', { user: e.manualCreatorUsername })}
                        </Mono>
                      ) : dist.meters != null ? (
                        <Mono className={`text-[9.5px] px-2 py-1 ${dist.tone === 'far' ? 'bg-[#F97316] text-[#0A0A0A]' : 'bg-[#E8F0E5] text-[#2E6B34]'}`}>
                          {dist.tone === 'far'
                            ? t('admin:apr.d.outside', { meters: dist.meters })
                            : t('admin:apr.d.inside', { meters: dist.meters })}
                        </Mono>
                      ) : (
                        <Mono className="text-[9.5px] bg-[#F4F4F5] text-[#71717A] px-2 py-1">{t('admin:apr.d.noGps')}</Mono>
                      )}
                      {e.eventApprovalStatus !== 'PENDING' && (
                        <Mono className={`text-[9.5px] px-2 py-1 ${statusPillClass(e.eventApprovalStatus)}`}>
                          {t(`admin:apr.st.${e.eventApprovalStatus}`)}
                        </Mono>
                      )}
                    </div>

                    {pending && evPending && (
                      <div className="flex gap-1.5 mt-2.5 flex-wrap">
                        <button onClick={() => run(`ev-ok-${e.id}`, () => approveEvent(record.id, e.id))}
                          disabled={busy === `ev-ok-${e.id}`}
                          className="border border-[#DBD0BB] bg-[#FAF7F0] px-2.5 py-1.5 font-bt-mono text-[9.5px] uppercase tracking-[0.05em] font-semibold text-[#0A0A0A] hover:border-[#2E6B34] hover:text-[#2E6B34] disabled:opacity-50">
                          {t('admin:apr.approve')}
                        </button>
                        <button onClick={() => { setEditingEvent(e.id); setTimeValue(hhmm(e.capturedAtServer || e.capturedAtClient, lang)); }}
                          className="border border-[#DBD0BB] bg-[#FAF7F0] px-2.5 py-1.5 font-bt-mono text-[9.5px] uppercase tracking-[0.05em] font-semibold text-[#0A0A0A] hover:border-[#F97316] hover:text-[#C2410C]">
                          {t('admin:apr.d.fixTime')}
                        </button>
                        <button onClick={() => {
                          const c = window.prompt(t('admin:apr.d.observePrompt'));
                          if (c) run(`ev-obs-${e.id}`, () => correctEvent(record.id, e.id, c));
                        }}
                          className="border border-[#DBD0BB] bg-[#FAF7F0] px-2.5 py-1.5 font-bt-mono text-[9.5px] uppercase tracking-[0.05em] font-semibold text-[#0A0A0A] hover:border-[#F97316] hover:text-[#C2410C]">
                          {t('admin:apr.observe')}
                        </button>
                      </div>
                    )}

                    {editingEvent === e.id && (
                      <div className="flex gap-2 items-center mt-2.5 flex-wrap">
                        <input value={timeValue} onChange={ev => setTimeValue(ev.target.value)} placeholder="HH:MM"
                          className="w-[92px] border border-[#CDBFA6] bg-white px-2.5 py-1.5 font-bt-mono text-sm tracking-[0.08em] text-center text-[#0A0A0A] outline-none focus:border-[#F97316]" />
                        <button onClick={() => {
                          const [h, m] = timeValue.split(':').map(Number);
                          if (Number.isNaN(h) || Number.isNaN(m)) return;
                          const d = new Date(e.capturedAtServer || e.capturedAtClient);
                          d.setHours(h, m, 0, 0);
                          const reason = window.prompt(t('admin:apr.d.fixReason')) || t('admin:apr.d.fixDefaultReason');
                          run(`ev-time-${e.id}`, () => editEventTime(record.id, e.id, d.toISOString(), reason));
                          setEditingEvent(null);
                        }}
                          className="bg-[#0A0A0A] hover:bg-[#F97316] text-[#F5F1E8] hover:text-[#0A0A0A] px-3 py-2 font-bt-mono text-[9.5px] uppercase tracking-[0.06em] font-semibold">
                          {t('common:buttons.save')}
                        </button>
                        <button onClick={() => setEditingEvent(null)}
                          className="font-bt-mono text-[9.5px] uppercase tracking-[0.06em] text-[#8A8175] hover:text-[#C2410C]">
                          {t('common:buttons.cancel')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Transit dispute */}
          {disputeEvent && (
            <div className="border border-[#F6CFA6] border-l-[3px] border-l-[#F97316] bg-[#FDF6EF] mt-2">
              <div className="p-4 border-b border-[#F1DCC4]">
                <Mono className="block text-[10px] tracking-[0.12em] text-[#C2410C] font-semibold">{t('admin:apr.d.dispute')}</Mono>
                {disputeEvent.disputeReason && (
                  <p className="text-[13px] text-[#43301F] leading-relaxed mt-2">{disputeEvent.disputeReason}</p>
                )}
                {disputeEvent.awardedTransitMinutes != null && (
                  <div className="mt-3">
                    <Mono className="block text-[9px] tracking-[0.08em] text-[#A0714A]">{t('admin:apr.d.awarded')}</Mono>
                    <span className="font-bt-display font-bold text-2xl leading-none text-[#2E6B34]">
                      {disputeEvent.awardedTransitMinutes} min
                    </span>
                  </div>
                )}
              </div>
              {disputeEvent.disputeStatus === 'PENDING' && (
                <div className="p-3.5 flex gap-2.5 items-center flex-wrap">
                  <Mono className="text-[10px] tracking-[0.06em] text-[#5A5346]">{t('admin:apr.d.award')}</Mono>
                  <div className="flex items-center border border-[#CDBFA6] bg-white">
                    <input value={disputeMinutes} onChange={e => setDisputeMinutes(e.target.value.replace(/\D/g, ''))}
                      inputMode="numeric"
                      className="w-16 border-0 bg-transparent px-3 py-2 font-bt-mono text-[15px] text-center text-[#0A0A0A] outline-none" />
                    <Mono className="pr-3 text-[11px] text-[#8A8175]">MIN</Mono>
                  </div>
                  <button
                    onClick={() => run('dispute', () => resolveTransitDispute(record.id, disputeEvent.id, Number(disputeMinutes || 0)))}
                    disabled={!disputeMinutes || busy === 'dispute'}
                    className="bg-[#F97316] hover:bg-[#EA580C] text-[#0A0A0A] px-3.5 py-2.5 font-bt-mono text-[10px] uppercase tracking-[0.06em] font-semibold disabled:opacity-50">
                    {busy === 'dispute' ? <Loader2 className="w-3 h-3 animate-spin" /> : t('admin:apr.d.resolve')}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Review history */}
          <div className="flex items-center gap-2.5 mt-6 mb-2.5">
            <span className="w-4 h-px bg-[#F97316] block" />
            <Mono className="text-[10px] tracking-[0.12em] text-[#8A8175]">{t('admin:apr.d.history')}</Mono>
          </div>
          {record.reviews.length === 0 ? (
            <div className="border border-[#E4E4E7] bg-[#FAF7F0] p-3.5 text-center">
              <Mono className="text-[11px] normal-case tracking-[0.05em] text-[#A69C8D]">{t('admin:apr.d.noHistory')}</Mono>
            </div>
          ) : (
            <div className="border border-[#E4E4E7]">
              {record.reviews.map(rv => (
                <div key={rv.id} className="px-3.5 py-2.5 border-b border-[#F0EBE1] last:border-b-0">
                  <div className="flex items-baseline justify-between gap-2.5">
                    <span className="text-[12.5px] text-[#0A0A0A]">
                      <b className="font-semibold">{rv.reviewerName || '—'}</b>{' '}
                      {t(`admin:apr.reviewed.${rv.status}`, { defaultValue: rv.status.toLowerCase() })}
                    </span>
                    <Mono className="text-[9.5px] normal-case tracking-normal text-[#A69C8D] whitespace-nowrap">
                      {fmtDateTime(rv.createdAt, lang)}
                    </Mono>
                  </div>
                  {rv.comment && <p className="text-[12px] text-[#5A5346] mt-1 leading-snug">“{rv.comment}”</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pinned actions */}
        <div className="border-t border-[#E4E4E7] bg-white px-4 py-3.5 flex-shrink-0">
          {!pending ? (
            <div className="flex items-center gap-2.5 justify-center py-1">
              <Mono className={`text-[10px] px-2 py-1 ${statusPillClass(record.approvalStatus)}`}>
                {t(`admin:apr.st.${record.approvalStatus}`)}
              </Mono>
              <Mono className="text-[10.5px] normal-case tracking-[0.05em] text-[#8A8175]">{t('admin:apr.d.resolved')}</Mono>
            </div>
          ) : action ? (
            <div>
              <Mono className="block text-[10px] tracking-[0.08em] text-[#5A5346] mb-2">
                {t(action === 'observe' ? 'admin:apr.d.observeTitle' : 'admin:apr.d.rejectTitle')}
              </Mono>
              <textarea value={comment} onChange={e => setComment(e.target.value)} autoFocus
                placeholder={t('admin:apr.d.commentPh')}
                className="w-full h-16 resize-none border border-[#CDBFA6] bg-[#FAF7F0] px-3 py-2.5 text-[13px] text-[#0A0A0A] outline-none focus:border-[#F97316]" />
              <div className="flex gap-2 mt-2.5 justify-end">
                <button onClick={() => { setAction(null); setComment(''); }}
                  className="px-3 py-2 font-bt-mono text-[10.5px] uppercase tracking-[0.06em] text-[#8A8175] hover:text-[#C2410C]">
                  {t('common:buttons.cancel')}
                </button>
                <button
                  onClick={() => run('resolve',
                    () => (action === 'observe' ? correctRecord(record.id, comment) : rejectRecord(record.id, comment)),
                    true)}
                  disabled={!comment.trim() || busy === 'resolve'}
                  className="bg-[#0A0A0A] hover:bg-[#F97316] text-[#F5F1E8] hover:text-[#0A0A0A] px-4 py-2 font-bt-mono text-[10.5px] uppercase tracking-[0.06em] font-semibold disabled:opacity-40">
                  {busy === 'resolve' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t(action === 'observe' ? 'admin:apr.observe' : 'admin:apr.reject')}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => run('approve', () => approveRecord(record.id), true)}
                disabled={busy === 'approve'}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-[#0A0A0A] hover:bg-[#2E6B34] text-[#F5F1E8] px-3 py-3 font-bt-mono text-[11px] uppercase tracking-[0.07em] font-semibold disabled:opacity-50 transition-colors">
                {busy === 'approve' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                {t('admin:apr.d.approveDay')}
              </button>
              <button onClick={() => setAction('observe')}
                className="border border-[#DBD0BB] bg-[#FAF7F0] px-3.5 py-3 font-bt-mono text-[11px] uppercase tracking-[0.06em] font-semibold text-[#0A0A0A] hover:border-[#F97316] hover:text-[#C2410C]">
                {t('admin:apr.observe')}
              </button>
              <button onClick={() => setAction('reject')}
                className="border border-[#E7B489] bg-white px-3.5 py-3 font-bt-mono text-[11px] uppercase tracking-[0.06em] font-semibold text-[#C2410C] hover:border-[#F97316] hover:bg-[#FBEDE0]">
                {t('admin:apr.reject')}
              </button>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
