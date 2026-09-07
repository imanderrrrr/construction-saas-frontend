import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Plus, RefreshCw, Search } from 'lucide-react';
import { cn } from '../ui/utils';
import { ApiError } from '../../lib/api';
import { FIELD_LIMITS } from '../../../shared/fieldLimits';
import { useTourScopeWhileMounted } from '../../lib/tourScope';
import {
  listJobs,
  type JobStatus, type SubcontractorJobDTO, type SubcontractorsSummary,
} from '../../services/subcontractors';
import { FOCUS_RING, SecondaryButton } from '../onboarding/chrome';
import { Bone, CreateButton, EmptyWord, Mono, MonoSelect, stampDate } from '../projects/bt';
import { apiErrorMsg } from '../projects/helpers';
import {
  CellEmpty, FigureStrip, FLASH_MS, fmtMoney, JobStatusChip, OverdueStamp, Pagination,
} from './bits';
import type { RefData } from './refData';

/**
 * 02 — what you assign.
 *
 * Three things the server already returned and the screen threw away are back:
 * the agreed amount, the per-row evidence and note counts, and the filters by
 * subcontractor and jobsite. The search box stopped being a filter over the
 * twenty rows on screen and became a server query.
 */

const JOB_STATUSES: JobStatus[] = ['ASSIGNED', 'IN_PROGRESS', 'IN_REVIEW', 'OBSERVED', 'APPROVED', 'CLOSED'];
const GRID = 'grid grid-cols-[2fr_1.15fr_1.15fr_.95fr_.9fr_.95fr_.62fr] gap-[14px] items-center';

export interface JobsFilters {
  subcontractorId?: number;
  status?: JobStatus;
}

export function JobsTab({ summary, summaryState, refData, initialFilters, onOpenJob, onAssign, onSummaryStale, flashJobId }: {
  summary: SubcontractorsSummary | null;
  summaryState: 'loading' | 'ready' | 'failed';
  refData: RefData;
  /** Arriving from a directory row: that person's filter, already applied. */
  initialFilters?: JobsFilters;
  onOpenJob: (job: SubcontractorJobDTO) => void;
  onAssign: () => void;
  onSummaryStale: () => void;
  /** Row to light up for two seconds — a job just assigned or just moved. */
  flashJobId: number | null;
}) {
  const { t, i18n } = useTranslation(['subcontractors', 'common']);
  const lang = i18n.language;

  // The Trabajos tab claims the tour while it is on screen: `visibleSteps()`
  // filters once at start-up, so stops anchored in a tab that is not mounted
  // would be dropped and the counter would read "1 de 2".
  useTourScopeWhileMounted('subcontractors-jobs', t('subcontractors:jobs.title'));

  const [jobs, setJobs] = useState<SubcontractorJobDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [subFilter, setSubFilter] = useState<number | ''>(initialFilters?.subcontractorId ?? '');
  const [projectFilter, setProjectFilter] = useState<number | ''>('');
  const [statusFilter, setStatusFilter] = useState<'' | JobStatus>(initialFilters?.status ?? '');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const searchTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (search === debouncedSearch) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setDebouncedSearch(search); setPage(0); }, 350);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search, debouncedSearch]);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listJobs({
        subcontractorId: subFilter || undefined,
        projectId: projectFilter || undefined,
        status: statusFilter || undefined,
        search: debouncedSearch || undefined,
        page,
        size: pageSize,
      });
      setJobs(res.content);
      setTotalElements(res.totalElements);
      setTotalPages(res.totalPages);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 403 ? t('subcontractors:noPermission.title') : apiErrorMsg(err));
    } finally {
      setLoading(false);
    }
  }, [subFilter, projectFilter, statusFilter, debouncedSearch, page, pageSize, reloadNonce, t]); // eslint-disable-line react-hooks/exhaustive-deps -- reloadNonce forces a refetch with unchanged filters

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  // A job assigned or moved from elsewhere in the section: reload in place.
  useEffect(() => {
    if (flashJobId == null) return;
    setReloadNonce(n => n + 1);
  }, [flashJobId]);

  const hasFilters = !!(search || subFilter || projectFilter || statusFilter);
  const clearFilters = () => {
    setSearch(''); setDebouncedSearch(''); setSubFilter(''); setProjectFilter(''); setStatusFilter(''); setPage(0);
  };
  const state = loading ? 'loading' : error ? 'error' : jobs.length === 0 ? (hasFilters ? 'noMatch' : 'empty') : 'data';

  const refresh = () => { setReloadNonce(n => n + 1); onSummaryStale(); };

  return (
    <div className="space-y-4">
      <FigureStrip
        testId="jobs-figures"
        tourAnchor="sec.subcontractors-jobs.job-kpis"
        state={summaryState}
        figures={[
          { key: 'total', value: summary?.totalJobs, label: t('subcontractors:jobs.kpi.total') },
          {
            key: 'inReview',
            value: summary?.jobsInReview,
            label: t('subcontractors:jobs.kpi.inReview'),
            tone: 'orange',
            pressed: statusFilter === 'IN_REVIEW',
            onClick: () => { setStatusFilter(p => (p === 'IN_REVIEW' ? '' : 'IN_REVIEW')); setPage(0); },
          },
          { key: 'overdue', value: summary?.jobsOverdue, label: t('subcontractors:jobs.kpi.overdue') },
        ]}
      />

      <div className="bg-white border border-[#E7E1D5] p-3.5 md:px-4" data-tour="sec.subcontractors-jobs.job-filters">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[200px] md:max-w-[300px]">
            <Search className="w-3.5 h-3.5 text-[#A69C8D] absolute left-[11px] top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('subcontractors:jobs.search')}
              maxLength={FIELD_LIMITS.SEARCH}
              aria-label={t('subcontractors:jobs.search')}
              className={cn('w-full border border-[#DBD0BB] bg-[#FAF7F0] py-[9px] pl-8 pr-3 text-[13px] text-[#0A0A0A] outline-none focus:border-[#F97316]', FOCUS_RING)}
            />
          </div>
          <MonoSelect
            value={subFilter}
            onChange={e => { setSubFilter(e.target.value ? Number(e.target.value) : ''); setPage(0); }}
            className="hidden md:block max-w-[190px]"
            aria-label={t('subcontractors:jobs.filter.subcontractor')}
          >
            <option value="">{t('subcontractors:jobs.filter.subcontractor')}</option>
            {refData.subcontractors.map(s => <option key={s.id} value={s.id}>{s.fullName ?? s.username}</option>)}
          </MonoSelect>
          <MonoSelect
            value={projectFilter}
            onChange={e => { setProjectFilter(e.target.value ? Number(e.target.value) : ''); setPage(0); }}
            className="hidden md:block max-w-[190px]"
            aria-label={t('subcontractors:jobs.filter.project')}
          >
            <option value="">{t('subcontractors:jobs.filter.project')}</option>
            {refData.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </MonoSelect>
          <MonoSelect
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value as '' | JobStatus); setPage(0); }}
            className="hidden md:block"
            aria-label={t('subcontractors:jobs.filter.status')}
          >
            <option value="">{t('subcontractors:jobs.filter.status')}</option>
            {JOB_STATUSES.map(s => <option key={s} value={s}>{t(`subcontractors:status.${s}`)}</option>)}
          </MonoSelect>
          <div className="ml-auto flex items-center gap-2">
            {hasFilters && (
              <button type="button" onClick={clearFilters} className={cn('font-bt-mono text-[10.5px] uppercase tracking-[0.1em] font-semibold text-[#C2410C] hover:text-[#F97316] px-1', FOCUS_RING)}>
                {t('subcontractors:jobs.filter.clear')} ✕
              </button>
            )}
            <SecondaryButton onClick={refresh} disabled={loading} className="text-[10.5px] px-3 py-[9px] bg-[#FAF7F0] gap-1.5">
              <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />{t('common:buttons.refresh')}
            </SecondaryButton>
            <CreateButton onClick={onAssign} className="py-[9px] px-3.5 text-[10.5px]">
              <Plus className="w-3.5 h-3.5" strokeWidth={2.4} />{t('subcontractors:jobs.assign')}
            </CreateButton>
          </div>
        </div>
        {/* Phone: the four states that matter as chips */}
        <div className="flex gap-[7px] overflow-x-auto pb-0.5 mt-3 md:hidden">
          {([
            ['all', !statusFilter, t('subcontractors:jobs.filter.status'), () => { setStatusFilter(''); setPage(0); }],
            ['review', statusFilter === 'IN_REVIEW', t('subcontractors:status.IN_REVIEW'), () => { setStatusFilter('IN_REVIEW'); setPage(0); }],
            ['observed', statusFilter === 'OBSERVED', t('subcontractors:status.OBSERVED'), () => { setStatusFilter('OBSERVED'); setPage(0); }],
            ['progress', statusFilter === 'IN_PROGRESS', t('subcontractors:status.IN_PROGRESS'), () => { setStatusFilter('IN_PROGRESS'); setPage(0); }],
          ] as const).map(([key, on, label, onClick]) => (
            <button key={key} type="button" onClick={onClick}
              className={cn('font-bt-mono text-[10px] uppercase tracking-[0.08em] px-[11px] py-2 whitespace-nowrap', on ? 'bg-[#0A0A0A] text-[#F5F1E8]' : 'border border-[#DBD0BB] text-[#5A5346]', FOCUS_RING)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-[#E7E1D5]" data-tour="sec.subcontractors-jobs.jobs-table" data-testid="jobs-list">
        {state === 'error' && (
          <EmptyWord
            tone="red"
            word={t('subcontractors:jobs.error.big')}
            title={error ?? t('subcontractors:jobs.error.title')}
            hint={t('subcontractors:jobs.error.hint')}
            className="border-0"
            action={<SecondaryButton onClick={() => setReloadNonce(n => n + 1)} className="bg-[#FAF7F0]">{t('common:buttons.retry')}</SecondaryButton>}
          />
        )}
        {state === 'empty' && (
          <EmptyWord
            word={t('subcontractors:jobs.empty.big')}
            title={t('subcontractors:jobs.empty.title')}
            hint={t('subcontractors:jobs.empty.hint')}
            className="border-0 py-[76px]"
            action={<CreateButton onClick={onAssign}><Plus className="w-3.5 h-3.5" strokeWidth={2.4} />{t('subcontractors:jobs.assign')}</CreateButton>}
          />
        )}
        {state === 'noMatch' && (
          <EmptyWord
            word={t('subcontractors:jobs.noMatch.big')}
            title={t('subcontractors:jobs.noMatch.title')}
            hint={t('subcontractors:jobs.noMatch.hint')}
            className="border-0"
            action={<SecondaryButton onClick={clearFilters} className="bg-[#FAF7F0]">{t('subcontractors:jobs.noMatch.clear')}</SecondaryButton>}
          />
        )}

        {(state === 'data' || state === 'loading') && (
          <>
            <div className="hidden md:block">
              <div className={cn(GRID, 'px-5 py-[11px] border-b border-[#EDE7DB] bg-[#FBF8F2] font-bt-mono text-[10px] uppercase tracking-[0.13em] text-[#8A8175]')}>
                <span>{t('subcontractors:jobs.table.job')}</span>
                <span>{t('subcontractors:jobs.table.subcontractor')}</span>
                <span>{t('subcontractors:jobs.table.project')}</span>
                <span>{t('subcontractors:jobs.table.status')}</span>
                <span className="text-right">{t('subcontractors:jobs.table.agreed')}</span>
                <span>{t('subcontractors:jobs.table.dueDate')}</span>
                <span>{t('subcontractors:jobs.table.attached')}</span>
              </div>
              {state === 'loading' && Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className={cn(GRID, 'px-5 py-[15px] border-b border-[#F0EBE1]')}>
                  <div className="space-y-2"><Bone className="w-[70%] h-[13px]" /><Bone className="w-[45%] h-[9px]" /></div>
                  <Bone className="w-[75%] h-3" /><Bone className="w-[75%] h-3" /><Bone className="w-16 h-5" />
                  <Bone className="w-16 h-3 justify-self-end" /><Bone className="w-[70%] h-3" />
                  <div className="space-y-1.5"><Bone className="w-10 h-[9px]" /><Bone className="w-10 h-[9px]" /></div>
                </div>
              ))}
              {state === 'data' && jobs.map(job => (
                <JobRow key={job.id} job={job} lang={lang} flash={job.id === flashJobId} onOpen={() => onOpenJob(job)} />
              ))}
            </div>

            {/* Phone: cards */}
            <div className="md:hidden p-3.5 space-y-3">
              {state === 'loading' && Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="border border-[#E7E1D5] p-3.5 space-y-2"><Bone className="w-2/3 h-[13px]" /><Bone className="w-1/2 h-[9px]" /><Bone className="w-1/3 h-[9px] mt-3" /></div>
              ))}
              {state === 'data' && jobs.map(job => (
                <div
                  key={job.id}
                  onClick={() => onOpenJob(job)}
                  className={cn('border border-[#E7E1D5] border-l-2 border-l-transparent p-3.5', job.id === flashJobId && 'bt-row-flash', job.status === 'CLOSED' && 'opacity-[0.70]')}
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="text-[14.5px] font-semibold text-[#0A0A0A] leading-[1.3] min-w-0">
                      {job.title}
                      {job.isOverdue && <OverdueStamp className="ml-2 align-middle" />}
                    </div>
                    <JobStatusChip status={job.status} className="flex-shrink-0" />
                  </div>
                  <Mono className="block text-[10px] tracking-[0.04em] text-[#5A5346] mt-1.5 truncate">
                    {(job.subcontractorName ?? t('subcontractors:ficha.noSubcontractor')).toUpperCase()} · {job.projectName.toUpperCase()}
                  </Mono>
                  <div className="flex items-center gap-3 mt-2.5">
                    <Mono className="text-[12px] tabular-nums font-semibold text-[#0A0A0A]">
                      {job.agreedAmountCents != null ? fmtMoney(job.agreedAmountCents) : t('subcontractors:jobs.row.noAmount')}
                    </Mono>
                    <Mono className="text-[10px] tracking-[0.06em] text-[#8A8175]">
                      {job.dueDate ? t('subcontractors:ficha.dueDate', { date: stampDate(job.dueDate, lang) }) : t('subcontractors:jobs.row.noDueDate')}
                    </Mono>
                  </div>
                  <div className="flex items-center justify-between gap-3 mt-3">
                    <Mono className="text-[10px] tracking-[0.06em] text-[#8A8175]">{attachedLine(job, t)}</Mono>
                    <Mono className="inline-flex items-center gap-1 text-[10px] font-semibold tracking-[0.1em] text-[#C2410C]">
                      {t('subcontractors:jobs.row.viewFicha')}<ArrowRight className="w-3 h-3" strokeWidth={2.2} />
                    </Mono>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {state === 'data' && (
        <Pagination
          page={page} pageSize={pageSize} totalElements={totalElements} totalPages={totalPages}
          onPage={setPage} onPageSize={n => { setPageSize(n); setPage(0); }}
        />
      )}
    </div>
  );
}

/** "6 EV · 3 OBS" — two numbers that already travel in every row and used to be dropped. */
function attachedLine(job: SubcontractorJobDTO, t: (k: string, o?: Record<string, unknown>) => string): string {
  const ev = job.evidenceCount ?? 0;
  const obs = job.observationCount ?? 0;
  if (ev === 0 && obs === 0) return t('subcontractors:jobs.row.noAttachments');
  return `${t('subcontractors:jobs.row.evidenceCount', { count: ev })} · ${t('subcontractors:jobs.row.notesCount', { count: obs })}`;
}

function JobRow({ job, lang, flash, onOpen }: { job: SubcontractorJobDTO; lang: string; flash: boolean; onOpen: () => void }) {
  const { t } = useTranslation(['subcontractors']);
  const ev = job.evidenceCount ?? 0;
  const obs = job.observationCount ?? 0;
  const closed = job.status === 'CLOSED';
  return (
    <div
      role="button"
      tabIndex={0}
      data-testid={`job-row-${job.id}`}
      onClick={onOpen}
      onKeyDown={e => { if (e.key === 'Enter') onOpen(); }}
      className={cn(
        GRID, 'px-5 py-[13px] border-b border-[#F0EBE1] border-l-2 border-l-transparent cursor-pointer transition-colors hover:bg-[#FBF8F2] hover:border-l-[#F97316]',
        closed && 'opacity-[0.70]',
        flash && 'bt-row-flash',
        FOCUS_RING, 'focus-visible:outline-offset-[-2px]',
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[14.5px] font-semibold text-[#0A0A0A] truncate">{job.title}</span>
          {/* The stamp goes next to the title, not in the status column:
              overdue is not a status, it is a condition that crosses one. */}
          {job.isOverdue && <OverdueStamp className="flex-shrink-0" />}
        </div>
        <Mono className="block text-[10px] tracking-[0.06em] text-[#8A8175] mt-[3px] truncate">
          {closed && job.closedAt
            ? t('subcontractors:jobs.row.closedOn', { date: stampDate(job.closedAt, lang) })
            : t('subcontractors:jobs.row.assignedOn', { date: stampDate(job.assignedAt, lang) })}
        </Mono>
      </div>
      {job.subcontractorName
        ? <span className="text-[13px] text-[#0A0A0A] truncate">{job.subcontractorName}</span>
        : <CellEmpty>{t('subcontractors:ficha.noSubcontractor')}</CellEmpty>}
      <span className="text-[13px] text-[#0A0A0A] truncate">{job.projectName}</span>
      <div><JobStatusChip status={job.status} /></div>
      {job.agreedAmountCents != null
        ? <Mono className="text-[12.5px] tabular-nums text-[#0A0A0A] text-right">{fmtMoney(job.agreedAmountCents)}</Mono>
        : <CellEmpty className="text-right">{t('subcontractors:jobs.row.noAmount')}</CellEmpty>}
      {job.dueDate
        ? <Mono className={cn('text-[11.5px] tracking-[0.04em]', job.isOverdue ? 'text-[#B3402A] font-semibold' : 'text-[#0A0A0A]')}>{stampDate(job.dueDate, lang)}</Mono>
        : <CellEmpty>{t('subcontractors:jobs.row.noDueDate')}</CellEmpty>}
      {ev === 0 && obs === 0 ? (
        <CellEmpty className="leading-[1.35]">{t('subcontractors:jobs.row.noAttachments')}</CellEmpty>
      ) : (
        <div className="leading-[1.35]">
          <Mono className={cn('block text-[10px] tracking-[0.06em]', ev > 0 ? 'text-[#0A0A0A]' : 'text-[#A69C8D]')}>{t('subcontractors:jobs.row.evidenceCount', { count: ev })}</Mono>
          <Mono className={cn('block text-[10px] tracking-[0.06em]', obs > 0 ? 'text-[#0A0A0A]' : 'text-[#A69C8D]')}>{t('subcontractors:jobs.row.notesCount', { count: obs })}</Mono>
        </div>
      )}
    </div>
  );
}

export { FLASH_MS };
