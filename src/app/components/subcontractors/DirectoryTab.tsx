import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, RefreshCw, Search } from 'lucide-react';
import { cn } from '../ui/utils';
import { ApiError } from '../../lib/api';
import { FIELD_LIMITS } from '../../../shared/fieldLimits';
import {
  listDirectory,
  type DirectoryBalanceFilter, type DirectoryJobsFilter,
  type SubcontractorDirectoryRow, type SubcontractorsSummary,
} from '../../services/subcontractors';
import { FOCUS_RING, SecondaryButton } from '../onboarding/chrome';
import { Bone, CreateButton, EmptyWord, Mono, MonoSelect, PaperNote } from '../projects/bt';
import { apiErrorMsg } from '../projects/helpers';
import { CellEmpty, FigureStrip, fmtMoney, fmtMoneyShort, Pagination } from './bits';

/**
 * 01 — the tab that did not exist.
 *
 * The section was called "Subcontratistas" and listed jobs. This answers the
 * question that used to take three passes through a filter: who am I working
 * with, what do I have open with each of them, and how much do I owe. Nobody
 * is created here — a subcontractor is a user with that role, and the note
 * under the table says where that happens.
 */

const GRID = 'grid grid-cols-[2.3fr_.9fr_.9fr_.95fr_1.1fr] gap-4 items-center';

export function DirectoryTab({ summary, summaryState, onPickSubcontractor, onGoToUsers }: {
  summary: SubcontractorsSummary | null;
  summaryState: 'loading' | 'ready' | 'failed';
  /** A row leads to Trabajos already filtered by that person. */
  onPickSubcontractor: (row: SubcontractorDirectoryRow) => void;
  onGoToUsers: () => void;
}) {
  const { t } = useTranslation(['subcontractors', 'common']);

  const [rows, setRows] = useState<SubcontractorDirectoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [jobsFilter, setJobsFilter] = useState<'' | DirectoryJobsFilter>('');
  const [balanceFilter, setBalanceFilter] = useState<'' | DirectoryBalanceFilter>('');
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

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listDirectory({
        jobs: jobsFilter || undefined,
        balance: balanceFilter || undefined,
        search: debouncedSearch || undefined,
        page,
        size: pageSize,
      });
      setRows(res.content);
      setTotalElements(res.totalElements);
      setTotalPages(res.totalPages);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 403 ? t('subcontractors:noPermission.title') : apiErrorMsg(err));
    } finally {
      setLoading(false);
    }
  }, [jobsFilter, balanceFilter, debouncedSearch, page, pageSize, reloadNonce, t]); // eslint-disable-line react-hooks/exhaustive-deps -- reloadNonce forces a refetch with unchanged filters

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const hasFilters = !!(search || jobsFilter || balanceFilter);
  const clearFilters = () => {
    setSearch(''); setDebouncedSearch(''); setJobsFilter(''); setBalanceFilter(''); setPage(0);
  };
  const state = loading ? 'loading' : error ? 'error' : rows.length === 0 ? (hasFilters ? 'noMatch' : 'empty') : 'data';

  return (
    <div className="space-y-4">
      <FigureStrip
        testId="directory-figures"
        tourAnchor="sec.subcontractors.kpis"
        state={summaryState}
        figures={[
          { key: 'active', value: summary?.activeSubcontractors, label: t('subcontractors:dir.kpi.active') },
          {
            key: 'open',
            value: summary?.openJobs,
            label: t('subcontractors:dir.kpi.openJobs'),
            pressed: jobsFilter === 'WITH_OPEN',
            onClick: () => { setJobsFilter(p => (p === 'WITH_OPEN' ? '' : 'WITH_OPEN')); setPage(0); },
          },
          {
            key: 'balance',
            value: fmtMoneyShort(summary?.balanceDueCents),
            label: t('subcontractors:dir.kpi.balance'),
            tone: 'orange',
            pressed: balanceFilter === 'WITH_BALANCE',
            onClick: () => { setBalanceFilter(p => (p === 'WITH_BALANCE' ? '' : 'WITH_BALANCE')); setPage(0); },
          },
        ]}
      />

      <div className="bg-white border border-[#E7E1D5] p-3.5 md:px-4" data-tour="sec.subcontractors.filters">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[200px] md:max-w-[320px]">
            <Search className="w-3.5 h-3.5 text-[#A69C8D] absolute left-[11px] top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('subcontractors:dir.search')}
              maxLength={FIELD_LIMITS.SEARCH}
              aria-label={t('subcontractors:dir.search')}
              className={cn('w-full border border-[#DBD0BB] bg-[#FAF7F0] py-[9px] pl-8 pr-3 text-[13px] text-[#0A0A0A] outline-none focus:border-[#F97316]', FOCUS_RING)}
            />
          </div>
          <MonoSelect
            value={jobsFilter}
            onChange={e => { setJobsFilter(e.target.value as '' | DirectoryJobsFilter); setPage(0); }}
            className="hidden md:block"
            aria-label={t('subcontractors:dir.filter.jobs')}
          >
            <option value="">{t('subcontractors:dir.filter.jobs')}</option>
            <option value="WITH_OPEN">{t('subcontractors:dir.filter.withOpen')}</option>
            <option value="NONE">{t('subcontractors:dir.filter.noJobs')}</option>
          </MonoSelect>
          <MonoSelect
            value={balanceFilter}
            onChange={e => { setBalanceFilter(e.target.value as '' | DirectoryBalanceFilter); setPage(0); }}
            className="hidden md:block"
            aria-label={t('subcontractors:dir.filter.balance')}
          >
            <option value="">{t('subcontractors:dir.filter.balance')}</option>
            <option value="WITH_BALANCE">{t('subcontractors:dir.filter.withBalance')}</option>
            <option value="SETTLED">{t('subcontractors:dir.filter.settled')}</option>
          </MonoSelect>
          <div className="ml-auto flex items-center gap-2">
            {hasFilters && (
              <button type="button" onClick={clearFilters} className={cn('font-bt-mono text-[10.5px] uppercase tracking-[0.1em] font-semibold text-[#C2410C] hover:text-[#F97316] px-1', FOCUS_RING)}>
                {t('subcontractors:jobs.filter.clear')} ✕
              </button>
            )}
            <SecondaryButton onClick={() => setReloadNonce(n => n + 1)} disabled={loading} className="text-[10.5px] px-3 py-[9px] bg-[#FAF7F0] gap-1.5">
              <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />{t('common:buttons.refresh')}
            </SecondaryButton>
          </div>
        </div>
        {/* Phone: the two filters as chips */}
        <div className="flex gap-[7px] overflow-x-auto pb-0.5 mt-3 md:hidden">
          {([
            ['all', !jobsFilter && !balanceFilter, t('subcontractors:dir.filter.jobs'), clearFilters],
            ['open', jobsFilter === 'WITH_OPEN', t('subcontractors:dir.filter.withOpen'), () => { setBalanceFilter(''); setJobsFilter('WITH_OPEN'); setPage(0); }],
            ['balance', balanceFilter === 'WITH_BALANCE', t('subcontractors:dir.filter.withBalance'), () => { setJobsFilter(''); setBalanceFilter('WITH_BALANCE'); setPage(0); }],
          ] as const).map(([key, on, label, onClick]) => (
            <button key={key} type="button" onClick={onClick}
              className={cn('font-bt-mono text-[10px] uppercase tracking-[0.08em] px-[11px] py-2 whitespace-nowrap', on ? 'bg-[#0A0A0A] text-[#F5F1E8]' : 'border border-[#DBD0BB] text-[#5A5346]', FOCUS_RING)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-[#E7E1D5]" data-tour="sec.subcontractors.directory-table" data-testid="directory-list">
        {state === 'error' && (
          <EmptyWord
            tone="red"
            word={t('subcontractors:dir.error.big')}
            title={error ?? t('subcontractors:dir.error.title')}
            hint={t('subcontractors:dir.error.hint')}
            className="border-0"
            action={<SecondaryButton onClick={() => setReloadNonce(n => n + 1)} className="bg-[#FAF7F0]">{t('common:buttons.retry')}</SecondaryButton>}
          />
        )}
        {state === 'empty' && (
          <EmptyWord
            word={t('subcontractors:dir.empty.big')}
            title={t('subcontractors:dir.empty.title')}
            hint={t('subcontractors:dir.empty.hint')}
            className="border-0 py-[76px]"
            action={
              <CreateButton onClick={onGoToUsers} className="gap-2">
                {t('subcontractors:dir.empty.cta')}<ArrowRight className="w-3.5 h-3.5" strokeWidth={2.4} />
              </CreateButton>
            }
          />
        )}
        {state === 'noMatch' && (
          <EmptyWord
            word={t('subcontractors:dir.noMatch.big')}
            title={t('subcontractors:dir.noMatch.title')}
            hint={t('subcontractors:dir.noMatch.hint')}
            className="border-0"
            action={<SecondaryButton onClick={clearFilters} className="bg-[#FAF7F0]">{t('subcontractors:jobs.noMatch.clear')}</SecondaryButton>}
          />
        )}

        {(state === 'data' || state === 'loading') && (
          <>
            <div className="hidden md:block">
              <div className={cn(GRID, 'px-5 py-[11px] border-b border-[#EDE7DB] bg-[#FBF8F2] font-bt-mono text-[10px] uppercase tracking-[0.13em] text-[#8A8175]')}>
                <span>{t('subcontractors:dir.table.subcontractor')}</span>
                <span>{t('subcontractors:dir.table.open')}</span>
                <span>{t('subcontractors:dir.table.overdue')}</span>
                <span>{t('subcontractors:dir.table.toPay')}</span>
                <span className="text-right">{t('subcontractors:dir.table.balance')}</span>
              </div>
              {state === 'loading' && Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className={cn(GRID, 'px-5 py-[15px] border-b border-[#F0EBE1]')}>
                  <div className="space-y-2"><Bone className="w-[56%] h-[13px]" /><Bone className="w-[72%] h-[9px]" /></div>
                  <Bone className="w-6 h-3" /><Bone className="w-14 h-3" /><Bone className="w-6 h-3" /><Bone className="w-20 h-3 justify-self-end" />
                </div>
              ))}
              {state === 'data' && rows.map(row => (
                <DirectoryRow key={row.subcontractorId} row={row} onPick={() => onPickSubcontractor(row)} />
              ))}
            </div>

            {/* Phone: cards */}
            <div className="md:hidden p-3.5 space-y-3">
              {state === 'loading' && Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="border border-[#E7E1D5] p-3.5 space-y-2"><Bone className="w-2/3 h-[13px]" /><Bone className="w-1/2 h-[9px]" /><Bone className="w-1/3 h-[9px] mt-3" /></div>
              ))}
              {state === 'data' && rows.map(row => (
                <div
                  key={row.subcontractorId}
                  onClick={() => onPickSubcontractor(row)}
                  className={cn('border border-[#E7E1D5] border-l-2 border-l-transparent p-3.5', row.status !== 'ACTIVE' && 'opacity-[0.72]')}
                >
                  <div className="text-[15px] font-semibold text-[#0A0A0A] leading-[1.3]">{row.fullName ?? row.username}</div>
                  <Mono className="block text-[10px] tracking-[0.04em] text-[#5A5346] mt-1 truncate">{secondLine(row, t)}</Mono>
                  <div className="flex items-center justify-between gap-3 mt-3">
                    <Mono className="text-[10px] tracking-[0.06em] text-[#8A8175]">
                      {row.openJobs > 0 ? `${row.openJobs} · ${t('subcontractors:dir.table.open')}` : t('subcontractors:dir.row.noJobs')}
                    </Mono>
                    <Mono className={cn('text-[12px] tabular-nums font-semibold', row.balanceCents > 0 ? 'text-[#C2410C]' : 'text-[#A69C8D]')}>
                      {row.balanceCents > 0 ? fmtMoney(row.balanceCents) : t('subcontractors:dir.row.settled')}
                    </Mono>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {state === 'data' && (
        <>
          <PaperNote className="text-[12.5px]">
            {t('subcontractors:dir.note')}{' '}
            <button type="button" onClick={onGoToUsers} className={cn('font-semibold text-[#C2410C] hover:text-[#F97316] underline underline-offset-2', FOCUS_RING)}>
              {t('subcontractors:dir.empty.cta')} →
            </button>
          </PaperNote>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <Pagination
              page={page} pageSize={pageSize} totalElements={totalElements} totalPages={totalPages}
              onPage={setPage} onPageSize={n => { setPageSize(n); setPage(0); }}
            />
          </div>
          <Mono className="block text-[9.5px] tracking-[0.1em] text-[#A69C8D] -mt-2 pb-2">{t('subcontractors:dir.legend')}</Mono>
        </>
      )}
    </div>
  );
}

/** "HERRERIA.XELAJU · operaciones@…", or the deactivation note when there is no email. */
function secondLine(row: SubcontractorDirectoryRow, t: (k: string) => string): string {
  const parts = [row.username.toUpperCase()];
  if (row.status !== 'ACTIVE') parts.push(t('subcontractors:dir.row.deactivated'));
  else if (row.email) parts.push(row.email);
  return parts.join(' · ');
}

function DirectoryRow({ row, onPick }: { row: SubcontractorDirectoryRow; onPick: () => void }) {
  const { t } = useTranslation(['subcontractors']);
  return (
    <div
      role="button"
      tabIndex={0}
      data-testid={`directory-row-${row.subcontractorId}`}
      onClick={onPick}
      onKeyDown={e => { if (e.key === 'Enter') onPick(); }}
      className={cn(
        GRID, 'px-5 py-[13px] border-b border-[#F0EBE1] border-l-2 border-l-transparent cursor-pointer transition-colors hover:bg-[#FBF8F2] hover:border-l-[#F97316]',
        // Deactivated still listed: their open jobs and unpaid invoices do not
        // leave with the account, and you have to be able to settle them.
        row.status !== 'ACTIVE' && 'opacity-[0.72]',
        FOCUS_RING, 'focus-visible:outline-offset-[-2px]',
      )}
    >
      <div className="min-w-0">
        <div className="text-[15px] font-semibold text-[#0A0A0A] truncate">{row.fullName ?? row.username}</div>
        <Mono className="block text-[10.5px] tracking-[0.04em] text-[#5A5346] mt-[3px] truncate">{secondLine(row, t)}</Mono>
      </div>
      {row.openJobs > 0
        ? <Mono className="text-[12.5px] tabular-nums font-semibold text-[#0A0A0A]">{row.openJobs}</Mono>
        : <CellEmpty>{t('subcontractors:dir.row.noJobs')}</CellEmpty>}
      {/* A chip only when there is one: five red zeroes would drown the one that matters. */}
      {row.overdueJobs > 0
        ? (
          <span className="inline-flex items-center font-bt-mono text-[9.5px] uppercase tracking-[0.1em] bg-[#FBEDE0] text-[#B3402A] font-semibold px-2 py-1 w-fit">
            {t('subcontractors:dir.row.overdue', { count: row.overdueJobs })}
          </span>
        )
        : <CellEmpty>{t('subcontractors:dir.row.noneOverdue')}</CellEmpty>}
      <Mono className={cn('text-[12.5px] tabular-nums', row.invoicesToPay > 0 ? 'text-[#0A0A0A] font-semibold' : 'text-[#A69C8D]')}>{row.invoicesToPay}</Mono>
      {row.balanceCents > 0
        ? <Mono className="text-[13px] tabular-nums font-semibold text-[#0A0A0A] text-right">{fmtMoney(row.balanceCents)}</Mono>
        : <CellEmpty className="text-right">{t('subcontractors:dir.row.settled')}</CellEmpty>}
    </div>
  );
}
