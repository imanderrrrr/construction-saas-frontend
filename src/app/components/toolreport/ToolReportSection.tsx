import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, X } from 'lucide-react';
import { cn } from '../ui/utils';
import { ApiError } from '../../lib/api';
import { getBranding } from '../../services/branding';
import { listProjects, type ProjectResponse } from '../../services/projects';
import { searchConsumables, type ConsumableResponse } from '../../services/warehouse';
import {
  getMissingTools, getToolReport,
  type ToolReport, type ToolReportFilters, type ToolReportMissingRow,
} from '../../services/toolReport';
import { FOCUS_RING, SecondaryButton } from '../onboarding/chrome';
import { EmptyWord, Mono, MonoSelect, PaperNote } from '../projects/bt';
import { CATEGORIES, categoryName, STATUSES, statusName } from '../tools/bits';
import { StateBlock } from './StateBlock';
import { MissingBlock } from './MissingBlock';
import { HoldersBlock } from './HoldersBlock';
import { SuppliesBlock } from './SuppliesBlock';
import { stampLongDay, stampTime } from './bits';

/**
 * Reporte de herramientas (Claude Design "Reporte Herramientas BuildTrack", 2026-09).
 *
 * Four questions, in this order: what I have and in what state · what hasn't
 * come back · who has what · what's being used up. The old screen answered the
 * fourth first and never answered the second at all.
 *
 * Filtering asks the server for the whole report again — figures, percentages
 * and tables all describe the filtered universe — which is what the guided
 * tour has been promising for a year while the browser only hid rows and left
 * the percentages over the unfiltered total.
 *
 * The export is off. The document is the only thing in this section that
 * leaves the company: it gets signed, attached to a claim and emailed. Today's
 * comes out entirely in English, in Calibri, in a blue that belongs to nobody,
 * and — the reason it cannot simply stay while the screen gets fixed — it
 * sends the UNFILTERED tables. A button that quietly contradicts the screen it
 * sits on is worse than no button, so it says what is happening to it instead.
 */

const MISSING_PAGE = 20;
const RESTOCK_LIMIT = 6;

export function ToolReportSection({ onNavigate }: { onNavigate?: (section: string) => void } = {}) {
  const { t, i18n } = useTranslation(['admin', 'tools', 'common']);
  const lang = i18n.language;

  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [projectId, setProjectId] = useState<number | ''>('');
  const [projects, setProjects] = useState<ProjectResponse[]>([]);

  const [report, setReport] = useState<ToolReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<{ forbidden: boolean; code: string } | null>(null);

  const [missingRows, setMissingRows] = useState<ToolReportMissingRow[]>([]);
  const [missingPage, setMissingPage] = useState(0);
  const [missingPages, setMissingPages] = useState(1);
  const [missingTotal, setMissingTotal] = useState(0);
  const [missingLoading, setMissingLoading] = useState(true);

  const [restock, setRestock] = useState<ConsumableResponse[]>([]);
  const [tenant, setTenant] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const filters: ToolReportFilters = useMemo(() => ({
    category: category || undefined,
    status: status || undefined,
    projectId: projectId === '' ? undefined : projectId,
  }), [category, status, projectId]);

  const filterCount = [category, status, projectId !== '' ? 'p' : ''].filter(Boolean).length;

  useEffect(() => {
    getBranding().then(b => setTenant(b.organizationName)).catch(() => { /* the kicker drops the name */ });
    listProjects({ size: 200 })
      .then(page => setProjects(page.content))
      .catch(() => { /* the project filter degrades to absent */ });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setFailure(null);
    try {
      setReport(await getToolReport(filters));
    } catch (err) {
      setReport(null);
      setFailure({
        forbidden: err instanceof ApiError && err.status === 403,
        code: err instanceof ApiError ? `${err.status} ${err.code ?? ''}`.trim() : String(err),
      });
    } finally {
      setLoading(false);
    }
  }, [filters, nonce]); // eslint-disable-line react-hooks/exhaustive-deps -- nonce forces a refetch with unchanged filters

  const loadMissing = useCallback(async () => {
    setMissingLoading(true);
    try {
      const page = await getMissingTools(filters, missingPage, MISSING_PAGE);
      setMissingRows(page.content);
      setMissingPages(page.totalPages);
      setMissingTotal(page.totalElements);
    } catch {
      // The block keeps its figures from the report and draws no rows: the
      // summary and the list come from two calls, and one failing is not a
      // reason to blank the other.
      setMissingRows([]);
    } finally {
      setMissingLoading(false);
    }
  }, [filters, missingPage, nonce]); // eslint-disable-line react-hooks/exhaustive-deps -- nonce forces a refetch with unchanged filters

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadMissing(); }, [loadMissing]);
  useEffect(() => { setMissingPage(0); }, [filters]);

  useEffect(() => {
    // The ones to reorder come from the inventory's own search, so the screen
    // and Herramientas cannot disagree about which supplies are low.
    searchConsumables({ stock: 'LOW', size: RESTOCK_LIMIT })
      .then(low => searchConsumables({ stock: 'OUT', size: RESTOCK_LIMIT })
        .then(out => setRestock([...out.content, ...low.content].slice(0, RESTOCK_LIMIT))))
      .catch(() => setRestock([]));
  }, [nonce]);

  const clearFilters = () => { setCategory(''); setStatus(''); setProjectId(''); };
  const refresh = () => setNonce(n => n + 1);
  const goTools = () => onNavigate?.('tool-inventory');

  // ── The states that replace the whole screen ──────────────────────────────

  if (failure?.forbidden) {
    return (
      <EmptyWord
        word={t('admin:toolReport.forbidden.word')}
        title={t('admin:toolReport.forbidden.lead')}
        hint={t('admin:toolReport.forbidden.body')}
        className="py-[76px]"
      />
    );
  }

  if (failure) {
    return (
      <div className="space-y-3">
        <EmptyWord
          tone="red"
          word={t('admin:toolReport.error.word')}
          title={t('admin:toolReport.error.lead')}
          hint={t('admin:toolReport.error.body')}
          action={
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <SecondaryButton onClick={refresh} className="bg-[#FAF7F0]">{t('admin:toolReport.retry')}</SecondaryButton>
              <SecondaryButton onClick={goTools} className="bg-white">{t('admin:toolReport.goTools')}</SecondaryButton>
            </div>
          }
        />
        {/* The technical code is never the headline; it is here for support. */}
        <details className="bg-white border border-[#E7E1D5] px-4 py-2.5">
          <summary className={cn('font-bt-mono text-[9.5px] uppercase tracking-[0.1em] text-[#8A8175] cursor-pointer', FOCUS_RING)}>
            {t('admin:toolReport.error.support')}
          </summary>
          <Mono className="block text-[10px] text-[#5A5346] mt-2 break-all">{failure.code}</Mono>
        </details>
      </div>
    );
  }

  const emptyCompany = report != null && report.totalInCompany === 0;
  const noMatch = report != null && report.total === 0 && report.totalInCompany > 0;

  return (
    <div className="space-y-4">
      {/* ── Header, universe and export ─────────────────────────────────── */}
      <div data-tour="sec.tool-report.export">
        <div className="flex items-end justify-between gap-5 flex-wrap">
          <div className="min-w-0">
            <Mono className="block text-[10px] tracking-[0.15em] text-[#8A8175]">
              {tenant ? t('admin:toolReport.kicker', { tenant }) : t('admin:toolReport.kicker.plain')}
            </Mono>
            <h2 className="font-bt-display font-extrabold uppercase text-[32px] md:text-[44px] leading-[0.92] text-[#0B0A09] mt-1">
              {t('admin:toolReport.title')}
            </h2>
            <span data-testid="report-universe">
              <Mono className="block text-[9.5px] tracking-[0.08em] text-[#5A5346] mt-2">
              {report
                ? (filterCount === 0
                    ? t('admin:toolReport.universe', {
                        date: stampLongDay(report.computedAt, lang),
                        tools: report.total,
                        supplies: report.supplies.total,
                        time: stampTime(report.computedAt, lang),
                      })
                    : t('admin:toolReport.universe.filtered', {
                        count: report.total,
                        total: report.totalInCompany,
                        filters: describeFilters(),
                        date: stampLongDay(report.computedAt, lang),
                      }))
                : ''}
              </Mono>
            </span>
          </div>

          <div className="flex flex-col items-start md:items-end gap-1.5">
            <div className="flex items-center gap-2.5">
              {/* Off, and saying so. Enabling it would send the unfiltered
                  tables — the very thing the screen above no longer does. */}
              <button type="button" disabled className={OFF}>{t('admin:toolReport.export.excel')}</button>
              <button type="button" disabled className={OFF}>{t('admin:toolReport.export.pdf')}</button>
            </div>
            <Mono className="text-[9px] tracking-[0.08em] text-[#A69C8D]">{t('admin:toolReport.export.rebuilding')}</Mono>
          </div>
        </div>
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div className="bg-white border border-[#E7E1D5] px-3 py-2.5" data-tour="sec.tool-report.filters">
        <div className="flex flex-wrap items-center gap-[9px]">
          <MonoSelect value={category} onChange={e => setCategory(e.target.value)} className="py-1.5" aria-label={t('admin:toolReport.filter.category')}>
            <option value="">{t('admin:toolReport.filter.category')}</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{categoryName(t, c)}</option>)}
          </MonoSelect>
          <MonoSelect value={status} onChange={e => setStatus(e.target.value)} className="py-1.5" aria-label={t('admin:toolReport.filter.status')}>
            <option value="">{t('admin:toolReport.filter.status')}</option>
            {STATUSES.map(s => <option key={s} value={s}>{statusName(t, s)}</option>)}
          </MonoSelect>
          <MonoSelect
            value={projectId}
            onChange={e => setProjectId(e.target.value === '' ? '' : Number(e.target.value))}
            className="py-1.5"
            aria-label={t('admin:toolReport.filter.project')}
          >
            <option value="">{t('admin:toolReport.filter.project')}</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </MonoSelect>

          <div className="ml-auto flex items-center gap-2">
            {filterCount > 0 && (
              <button
                type="button"
                onClick={clearFilters}
                className={cn('inline-flex items-center gap-1 font-bt-mono text-[9.5px] uppercase tracking-[0.1em] font-semibold text-[#C2410C] hover:text-[#F97316]', FOCUS_RING)}
              >
                {t('admin:toolReport.filter.clear', { count: filterCount })}
                <X className="w-3 h-3" strokeWidth={2.4} />
              </button>
            )}
            <SecondaryButton onClick={refresh} className="text-[10px] px-2.5 py-[7px] bg-[#FAF7F0] gap-1.5">
              <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
              <span className="hidden sm:inline">{t('admin:toolReport.recompute')}</span>
            </SecondaryButton>
          </div>
        </div>
        <span data-testid="filter-note"><Mono className="block text-[9px] tracking-[0.08em] text-[#A69C8D] mt-2">
          {report && (filterCount === 0
            ? t('admin:toolReport.filter.none', { count: report.totalInCompany })
            : t('admin:toolReport.filter.on', { count: report.total, total: report.totalInCompany }))}
          {report && ` · ${t('admin:toolReport.recompute.at', { time: stampTime(report.computedAt, lang) })}`}
        </Mono></span>
      </div>

      {emptyCompany ? (
        <EmptyWord
          word={t('admin:toolReport.empty.none.word')}
          title={t('admin:toolReport.empty.none.lead')}
          hint={t('admin:toolReport.empty.none.body')}
          className="py-[76px]"
          action={<SecondaryButton onClick={goTools} className="bg-[#FAF7F0]">{t('admin:toolReport.goTools')}</SecondaryButton>}
        />
      ) : (
        <>
          {/* The figures stay at zero rather than disappearing: a report that
              hides its own tables when nothing matches teaches nothing. */}
          {noMatch && (
            <PaperNote>
              <div className="font-semibold">{t('admin:toolReport.empty.noMatch.word')}</div>
              <div className="mt-1">
                {t('admin:toolReport.empty.noMatch.lead', {
                  count: report.totalInCompany,
                  conditions: t('admin:toolReport.filter.conditions', { count: filterCount }),
                })}
              </div>
              <button
                type="button"
                onClick={clearFilters}
                className={cn('font-bt-mono text-[9.5px] uppercase tracking-[0.1em] font-semibold text-[#C2410C] hover:text-[#F97316] mt-2', FOCUS_RING)}
              >
                {t('admin:toolReport.filter.clear', { count: filterCount })}
              </button>
            </PaperNote>
          )}

          <StateBlock
            report={report}
            loading={loading}
            lang={lang}
            onOpenTools={() => goTools()}
          />
          <MissingBlock
            summary={report?.missing ?? null}
            outOfWarehouse={report?.outOfWarehouse ?? 0}
            rows={missingRows}
            loading={loading || missingLoading}
            failed={failure != null}
            lang={lang}
            page={missingPage}
            totalPages={missingPages}
            total={missingTotal}
            onPage={setMissingPage}
            onOpenTool={() => goTools()}
          />
          <HoldersBlock report={report} loading={loading} failed={failure != null} />
          <SuppliesBlock supplies={report?.supplies ?? null} restock={restock} loading={loading} failed={failure != null} />
        </>
      )}
    </div>
  );

  /** The filters written the way the selector writes them. */
  function describeFilters(): string {
    return [
      category ? categoryName(t, category) : null,
      status ? statusName(t, status) : null,
      projectId !== '' ? projects.find(p => p.id === projectId)?.name ?? null : null,
    ].filter(Boolean).join(' · ');
  }
}

const OFF =
  'font-bt-mono text-[10px] font-semibold uppercase tracking-[0.12em] px-3.5 py-2.5 border border-[#EAE4D8] bg-[#EAE4D8] text-[#A69C8D] cursor-not-allowed';
