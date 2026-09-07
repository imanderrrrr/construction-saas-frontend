import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../ui/utils';
import { getJobTimeline, type JobStatus, type TimelineEntry } from '../../services/subcontractors';
import { SecondaryButton } from '../onboarding/chrome';
import { Bone, EmptyWord, Mono } from '../projects/bt';
import { Panel } from '../projects/ficha/panel';
import { stampDateTime } from './bits';
import { timelineDetail, timelineHeading } from './timelineText';

/**
 * 04c — everything that has happened to this job, in order.
 *
 * What this fixes: the tab used to print the raw machine token —
 * STATUS_CHANGED, EVIDENCE_UPLOADED, INVOICE_SUBMITTED — and read
 * `entry.comment`, a field the response has never had (it is `message`). The
 * result was that the comment someone typed when changing a status was never
 * seen by anyone, and the `i18n` every row has carried since backend V99 was
 * ignored, even though the mobile app already resolves it.
 *
 * The most recent rows carry an orange marker, the older ones sand — the eye
 * lands on what just happened without reading a date.
 */

/** Rows this fresh get the orange marker. */
const RECENT = 3;

export function JobTimeline({ jobId }: { jobId: number }) {
  const { t, i18n } = useTranslation(['subcontractors', 'common']);
  const lang = i18n.language;
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [state, setState] = useState<'loading' | 'error' | 'data'>('loading');

  const load = useCallback(() => {
    setState('loading');
    getJobTimeline(jobId)
      .then(rows => { setEntries(rows); setState('data'); })
      .catch(() => setState('error'));
  }, [jobId]);

  useEffect(() => { load(); }, [load]);

  return (
    <Panel title={t('subcontractors:ficha.tab.history')} purpose={t('subcontractors:tl.purpose')}>
      {state === 'loading' && (
        <div className="pl-[22px] border-l border-[#EDE7DB] space-y-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2"><Bone className="w-1/3 h-[13px]" /><Bone className="w-1/4 h-[9px]" /></div>
          ))}
        </div>
      )}

      {state === 'error' && (
        <EmptyWord
          tone="red"
          word={t('subcontractors:tl.error.big')}
          title={t('subcontractors:tl.error.title')}
          hint={t('subcontractors:jobs.error.hint')}
          className="border-0 py-8"
          action={<SecondaryButton onClick={load} className="bg-[#FAF7F0]">{t('common:buttons.retry')}</SecondaryButton>}
        />
      )}

      {state === 'data' && entries.length === 0 && (
        <EmptyWord word={t('subcontractors:tl.empty.big')} title={t('subcontractors:tl.empty.title')} className="border-0 py-8" />
      )}

      {state === 'data' && entries.length > 0 && (
        <ol className="pl-[22px] border-l border-[#EDE7DB]">
          {entries.map((entry, i) => {
            const detail = timelineDetail(t, entry);
            return (
              <li key={entry.id} className="relative pb-5 last:pb-0">
                <span
                  aria-hidden="true"
                  className={cn('absolute -left-[27px] top-[5px] w-[9px] h-[9px]', i < RECENT ? 'bg-[#F97316]' : 'bg-[#DBD0BB]')}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bt-heading font-bold text-[14px] text-[#0A0A0A]">{timelineHeading(t, entry)}</span>
                  {/* The step as two chips: the wire carries enum names, the
                      reader gets the same words the status chip uses. */}
                  {entry.fromStatus && entry.toStatus && (
                    <span className="inline-flex items-center gap-1.5">
                      <StatusToken value={entry.fromStatus} />
                      <span className="text-[#B4A992] text-[11px]" aria-hidden="true">→</span>
                      <StatusToken value={entry.toStatus} />
                    </span>
                  )}
                </div>
                <Mono className="block text-[9.5px] tracking-[0.08em] text-[#8A8175] mt-1">
                  {entry.actorName ?? t('subcontractors:tl.systemActor')} · {stampDateTime(entry.createdAt, lang)}
                </Mono>
                {detail && (
                  <p className="bg-[#FBF8F2] border border-[#EDE7DB] px-3 py-[9px] text-[12.5px] leading-[1.5] text-[#2E2A24] mt-2 whitespace-pre-wrap break-words">
                    {detail}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}

/**
 * A status name from the wire. `fromStatus` / `toStatus` carry a job status on
 * a status change and an *invoice* status on an invoice row, so both
 * catalogues are tried before falling back to the raw token.
 */
function StatusToken({ value }: { value: string }) {
  const { t, i18n } = useTranslation(['subcontractors']);
  const jobKey = `subcontractors:status.${value as JobStatus}`;
  const invoiceKey = `subcontractors:invoiceStatus.${value}`;
  const label = i18n.exists(jobKey) ? t(jobKey) : i18n.exists(invoiceKey) ? t(invoiceKey) : value;
  return (
    <Mono className="inline-flex items-center border border-[#DBD0BB] text-[9.5px] tracking-[0.1em] text-[#5A5346] px-[7px] py-[3px]">
      {label}
    </Mono>
  );
}
