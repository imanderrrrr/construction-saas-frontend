import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../ui/utils';
import { FIELD_LIMITS } from '../../../shared/fieldLimits';
import { addJobObservation, getJobObservations, type ObservationEntry } from '../../services/subcontractors';
import { FOCUS_RING, PrimaryButton, SecondaryButton } from '../onboarding/chrome';
import { Bone, EmptyWord, Mono, PaperNote } from '../projects/bt';
import { Panel } from '../projects/ficha/panel';
import { stampDateTime } from './bits';

/**
 * 04a — the conversation with the subcontractor.
 *
 * No bubbles and no sides: the entries are square and share one column,
 * because a conversation is read in order and who sits on the right of it
 * carries no meaning. Yours is told apart by the orange edge on white, theirs
 * by the sand edge on paper.
 *
 * The minimum is five characters, which is what the server enforces and what
 * the button obeys. The old copy said ten, and never showed the message.
 */

/** The server is polled while the tab is open; a note can arrive from the app at any moment. */
const POLL_MS = 5000;
const MIN_LENGTH = 5;

export function JobNotes({ jobId, onCountChange }: { jobId: number; onCountChange?: (n: number) => void }) {
  const { t, i18n } = useTranslation(['subcontractors', 'common']);
  const lang = i18n.language;

  const [notes, setNotes] = useState<ObservationEntry[]>([]);
  const [state, setState] = useState<'loading' | 'error' | 'data'>('loading');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const load = useCallback((quiet: boolean) => {
    if (!quiet) setState('loading');
    return getJobObservations(jobId)
      .then(rows => {
        setNotes(rows);
        setState('data');
        onCountChange?.(rows.length);
      })
      .catch(() => { if (!quiet) setState('error'); });
  }, [jobId, onCountChange]);

  useEffect(() => { load(false); }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => load(true), POLL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const send = async () => {
    const message = draft.trim();
    if (message.length < MIN_LENGTH || sending) return;
    setSending(true);
    setSendError(false);
    try {
      await addJobObservation(jobId, { message });
      setDraft('');
      await load(true);
      // The new entry is at the bottom of the column.
      window.setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }), 0);
    } catch {
      setSendError(true);
    } finally {
      setSending(false);
    }
  };

  const tooShort = draft.trim().length < MIN_LENGTH;

  return (
    <Panel
      title={t('subcontractors:ficha.tab.notes')}
      purpose={t('subcontractors:notes.purpose')}
      actions={<Mono className="text-[9.5px] tracking-[0.1em] text-[#A69C8D] hidden md:block">{t('subcontractors:notes.polling')}</Mono>}
    >
      {state === 'loading' && (
        <div className="space-y-2.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="border-l-2 border-l-[#EDE7DB] bg-[#FBF8F2] px-3.5 py-3 space-y-2">
              <Bone className="w-1/3 h-[9px]" /><Bone className="w-[85%] h-3" /><Bone className="w-[60%] h-3" />
            </div>
          ))}
        </div>
      )}

      {state === 'error' && (
        <EmptyWord
          tone="red"
          word={t('subcontractors:notes.error.big')}
          title={t('subcontractors:notes.error.title')}
          hint={t('subcontractors:jobs.error.hint')}
          className="border-0 py-8"
          action={<SecondaryButton onClick={() => load(false)} className="bg-[#FAF7F0]">{t('common:buttons.retry')}</SecondaryButton>}
        />
      )}

      {state === 'data' && notes.length === 0 && (
        <EmptyWord
          word={t('subcontractors:notes.empty.big')}
          title={t('subcontractors:notes.empty.title')}
          hint={t('subcontractors:notes.empty.hint')}
          className="border-0 py-8"
        />
      )}

      {state === 'data' && notes.length > 0 && (
        <div ref={listRef} className="flex flex-col gap-[11px] max-h-[46vh] overflow-y-auto pr-1">
          {notes.map(note => {
            const mine = note.authorRole === 'ADMIN';
            return (
              <div
                key={note.id}
                className={cn('border-l-[3px] px-3.5 py-[11px]', mine ? 'bg-white border-l-[#F97316] border border-[#EDE7DB] border-l-[#F97316]' : 'bg-[#FBF8F2] border border-[#EDE7DB] border-l-[#DBD0BB]')}
              >
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <Mono className={cn('text-[10px] font-semibold tracking-[0.1em]', mine ? 'text-[#C2410C]' : 'text-[#0A0A0A]')}>
                    {note.authorName ?? t('subcontractors:tl.systemActor')}
                    <span className="text-[#A69C8D] font-normal"> · {mine ? t('subcontractors:notes.you') : t('subcontractors:notes.role')}</span>
                  </Mono>
                  <Mono className="text-[9.5px] tracking-[0.06em] text-[#A69C8D]">{stampDateTime(note.createdAt, lang)}</Mono>
                </div>
                <p className="text-[13px] leading-[1.55] text-[#2E2A24] mt-1.5 whitespace-pre-wrap break-words">{note.message}</p>
              </div>
            );
          })}
        </div>
      )}

      {state !== 'error' && (
        <div className="bg-[#FAF7F0] border border-[#EDE7DB] px-3.5 py-[13px] md:px-5 mt-4">
          <label htmlFor={`note-${jobId}`} className="sr-only">{t('subcontractors:notes.placeholder')}</label>
          <textarea
            id={`note-${jobId}`}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); } }}
            placeholder={t('subcontractors:notes.placeholder')}
            maxLength={FIELD_LIMITS.LONG_TEXT}
            rows={2}
            className={cn('w-full h-[58px] resize-none border border-[#DBD0BB] bg-white px-3 py-2 text-[13px] leading-[1.5] text-[#0A0A0A] outline-none placeholder:text-[#A69C8D] focus:border-[#F97316]', FOCUS_RING)}
          />
          <div className="flex items-center justify-between gap-3 mt-2 flex-wrap">
            <Mono className="text-[9.5px] tracking-[0.06em] text-[#A69C8D]">{t('subcontractors:notes.hint')}</Mono>
            <div className="flex items-center gap-3">
              <Mono className="text-[9.5px] tracking-[0.06em] text-[#A69C8D] tabular-nums">
                {t('subcontractors:notes.counter', { count: draft.length, max: FIELD_LIMITS.LONG_TEXT })}
              </Mono>
              <PrimaryButton onClick={send} disabled={tooShort || sending} className="px-5 py-[13px] text-[10.5px]">
                {sending ? t('subcontractors:notes.sending') : t('subcontractors:notes.send')}
              </PrimaryButton>
            </div>
          </div>
          {sendError && <PaperNote tone="red" className="mt-2.5">{t('subcontractors:notes.sendFailed')}</PaperNote>}
        </div>
      )}
    </Panel>
  );
}
