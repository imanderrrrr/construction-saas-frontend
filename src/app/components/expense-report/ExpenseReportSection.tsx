import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { cn } from '../ui/utils';
import { Figure, FigureStrip, LoadFailure, TableSkeleton, BlockHead } from '../budgets/ui';
import { pct } from '../budgets/bits';
import { EmptyWord, Mono, MonoSelect, INPUT } from '../projects/bt';
import { FOCUS_RING, PrimaryButton, SecondaryButton, TertiaryButton } from '../onboarding/chrome';
import { tenantCompanyName } from '../../services/branding';
import { listProjects, type ProjectResponse } from '../../services/projects';
import { exportExpenseReport } from '../../services/expenses';
import { getBusinessTz } from '../../helpers/dateTime';
import { writeInboxPreset } from '../expenses/preset';
import {
  bigMoney, CategoryList, EXPENSE_TYPES, TrendStrip, monthName,
} from './bits';
import { ProjectTable, PROJECT_COLS } from './ProjectTable';
import { WorkerTable, WORKER_COLS } from './WorkerTable';
import {
  defaultReportFilters, isFiltered, toParams, useExpenseReport, type ReportFilters,
} from './useExpenseReport';

/**
 * Reporte de gastos — en qué se fue el dinero de obra.
 *
 * Aquí no se aprueba nada: esto es el informe, y una regla manda sobre todo lo
 * demás — **solo lo aprobado es dinero gastado**. Lo pendiente puede no
 * aprobarse nunca y lo rechazado no se paga, así que ninguna cifra los mezcla.
 *
 * Lo que cambió respecto de la pantalla anterior, y por qué:
 *
 *   · «Total aprobado» y «Total neto» imprimían el mismo `row.approved` en las
 *     seis filas. La segunda columna pasa a ser lo que sí informa: qué parte
 *     del presupuesto de costos de esa obra se llevó el gasto.
 *   · «Pendiente / observado / rechazado» eran cuentas de gastos puestas en una
 *     fila de dólares. Ahora son dinero, con la cuenta como dato menor.
 *   · No hay botón «Generar reporte» ni pastilla verde «Generado»: se encendía
 *     al montar y seguía verde con los datos del filtro anterior. Los filtros
 *     se aplican solos y en su sitio va el sello de corte.
 *   · La exportación la hace el **servidor**, en el idioma del panel y con el
 *     membrete del inquilino. La del navegador salía azul y en inglés.
 */
export function ExpenseReportSection({ readOnly = false, onNavigate }: {
  readOnly?: boolean;
  onNavigate?: (section: string) => void;
}) {
  const { t, i18n } = useTranslation(['admin', 'common']);
  const lang = i18n.resolvedLanguage ?? 'es';
  const [filters, setFilters] = useState<ReportFilters>(defaultReportFilters);
  const { report, loading, error, reload } = useExpenseReport(filters, readOnly);

  const [tenant, setTenant] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  useEffect(() => {
    tenantCompanyName().then(setTenant).catch(() => { /* sin nombre, el antetítulo no lo dice */ });
    listProjects({ size: 200 }).then(r => setProjects(r.content)).catch(() => { /* el filtro se queda en «todas» */ });
  }, []);

  const [openProject, setOpenProject] = useState<number | null>(null);
  const [exporting, setExporting] = useState<'pdf' | 'xlsx' | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const kpis = report?.kpis;
  const hasData = (report?.byProject.length ?? 0) > 0;
  const canExport = !error && hasData && exporting === null;

  const stamp = useMemo(() => {
    if (!report) return null;
    try {
      return new Date(report.generatedAt).toLocaleString(lang, {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
        timeZone: getBusinessTz(),
      });
    } catch { return report.generatedAt; }
  }, [report, lang]);

  const rangeLabel = `${filters.dateFrom} – ${filters.dateTo}`;
  const projectName = filters.projectId !== 'all'
    ? projects.find(p => String(p.id) === filters.projectId)?.name ?? null
    : null;

  const openInbox = (projectId: number, status: 'PENDING' | 'OBSERVED' | 'REJECTED') => {
    writeInboxPreset({ projectId, status, dateFrom: filters.dateFrom, dateTo: filters.dateTo });
    onNavigate?.('expenses');
  };

  const runExport = async (format: 'pdf' | 'xlsx') => {
    setMenuOpen(false);
    setExporting(format);
    setExportError(null);
    try {
      // Sin toast de «exportación iniciada»: el acuse es el ítem del menú, que
      // dice «preparando», y después el archivo que baja.
      await exportExpenseReport({
        format, lang,
        role: readOnly ? 'finance' : 'admin',
        ...toParams(filters),
      });
    } catch (err: unknown) {
      setExportError(err instanceof Error ? err.message : t('expenseReport.export.failed'));
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-3">
      {/* Titular y sello de corte — ancla 1 */}
      <div className="flex items-end justify-between gap-6 flex-wrap" data-tour="sec.expense-report.corte">
        <div className="min-w-0">
          {tenant && (
            <Mono className="block text-[10px] tracking-[0.14em] text-[#8A8175]">
              {t('expenseReport.kicker', { tenant })}
            </Mono>
          )}
          <div className="flex items-baseline gap-3 flex-wrap mt-1">
            <h2 className="font-bt-display font-extrabold uppercase text-[40px] md:text-[46px] leading-[0.92] text-[#0A0A0A]">
              {t('expenseReport.title')}
            </h2>
            {readOnly && (
              <Mono className="text-[9.5px] tracking-[0.1em] text-[#5A5346] border border-[#DBD0BB] bg-[#F3EEE4] px-2 py-1">
                {t('expenseReport.readOnly')}
              </Mono>
            )}
          </div>
          <Mono className="block text-[10px] tracking-[0.1em] text-[#5A5346] mt-2">
            {[
              rangeLabel,
              hasData ? t('expenseReport.projectsWithSpend', { count: kpis?.projectCount ?? 0 }) : '',
              t('expenseReport.approvedOnly'),
            ].filter(Boolean).join(' · ')}
          </Mono>
        </div>

        {/* Barra de acciones — ancla 4 */}
        <div className="flex flex-col items-end gap-1.5" data-tour="sec.expense-report.exportar">
          <Mono className="text-[9.5px] tracking-[0.1em] text-[#8A8175]">
            {stamp ? t('expenseReport.asOf', { stamp }) : ' '}
          </Mono>
          <div className="relative">
            <PrimaryButton
              onClick={() => setMenuOpen(o => !o)}
              disabled={!canExport}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
            >
              <span className="flex items-center gap-1.5">
                {exporting ? t('expenseReport.export.preparing') : t('expenseReport.export.cta')}
                <ChevronDown className="w-3 h-3" strokeWidth={2.4} aria-hidden="true" />
              </span>
            </PrimaryButton>
            {menuOpen && canExport && (
              <div role="menu" className="absolute right-0 top-full mt-1 z-20 bg-white border border-[#0A0A0A] min-w-[180px]">
                {(['pdf', 'xlsx'] as const).map(format => (
                  <button
                    key={format}
                    type="button"
                    role="menuitem"
                    onClick={() => runExport(format)}
                    className={cn(
                      'block w-full text-left font-bt-mono text-[10px] uppercase tracking-[0.1em] px-3.5 py-2.5 text-[#0A0A0A] hover:bg-[#FBEDE0] hover:text-[#C2410C]',
                      FOCUS_RING,
                    )}
                  >
                    {t(`expenseReport.export.${format}`)}
                  </button>
                ))}
              </div>
            )}
          </div>
          {!canExport && !loading && (
            <Mono className="text-[9px] tracking-[0.08em] text-[#A69C8D]">
              {error ? t('expenseReport.export.blockedError') : t('expenseReport.export.blockedEmpty')}
            </Mono>
          )}
          {exportError && (
            <div className="flex items-center gap-2">
              <span className="text-[11.5px] text-[#B3402A]">{exportError}</span>
              <TertiaryButton onClick={() => setExportError(null)}>{t('expenseReport.dismiss')}</TertiaryButton>
            </div>
          )}
        </div>
      </div>

      {/* Filtros — ancla 2. Se aplican solos: no hay «Generar reporte». */}
      <div
        className="bg-white border border-[#E7E1D5] px-[18px] py-3 flex flex-wrap items-end gap-3"
        data-tour="sec.expense-report.filtros"
      >
        <Field label={t('expenseReport.filters.from')}>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))}
            className={INPUT}
          />
        </Field>
        <Field label={t('expenseReport.filters.to')}>
          <input
            type="date"
            value={filters.dateTo}
            onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))}
            className={INPUT}
          />
        </Field>
        <Field label={t('expenseReport.filters.project')}>
          <MonoSelect value={filters.projectId} onChange={e => setFilters(f => ({ ...f, projectId: e.target.value }))}>
            <option value="all">{t('expenseReport.filters.allProjects')}</option>
            {projects.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
          </MonoSelect>
        </Field>
        <Field label={t('expenseReport.filters.type')}>
          <MonoSelect value={filters.type} onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}>
            <option value="all">{t('expenseReport.filters.allTypes')}</option>
            {EXPENSE_TYPES.map(k => (
              <option key={k} value={k}>{t(`expenses.type.${k}`)}</option>
            ))}
          </MonoSelect>
        </Field>
        <div className="ml-auto flex items-end gap-3">
          <Mono className="text-[9px] tracking-[0.08em] text-[#A69C8D] pb-2.5">
            {t('expenseReport.filters.autoApply')}
          </Mono>
          <SecondaryButton onClick={() => setFilters(defaultReportFilters())}>
            {t('expenseReport.filters.reset')}
          </SecondaryButton>
        </div>
      </div>

      {/* Las cuatro cifras */}
      <FigureStrip filtered={isFiltered(filters)}>
        <Figure
          value={error ? '—' : bigMoney(kpis?.totalApprovedCents ?? 0)}
          label={
            <>
              {t('expenseReport.kpi.approved')}
              <span className="block text-[9px] text-[#A69C8D] mt-0.5">
                {error ? '' : t('expenseReport.projectsWithSpend', { count: kpis?.projectCount ?? 0 })}
              </span>
            </>
          }
        />
        <Figure
          value={error ? '—' : bigMoney(kpis?.pendingCents ?? 0)}
          tone="orange"
          label={
            <>
              {t('expenseReport.kpi.pending')}
              <span className="block text-[9px] text-[#A69C8D] mt-0.5">
                {error ? '' : t('expenseReport.state.count', { count: kpis?.pendingCount ?? 0 })}
              </span>
            </>
          }
        />
        <Figure
          value={
            error || !kpis?.topCategory
              ? '—'
              : `${pct(kpis.totalApprovedCents > 0 ? (kpis.topCategoryCents / kpis.totalApprovedCents) * 100 : 0, lang)} %`
          }
          label={
            <>
              {kpis?.topCategory
                ? t(`expenses.type.${kpis.topCategory}`, { defaultValue: kpis.topCategory })
                : t('expenseReport.kpi.noCategory')}
              <span className="block text-[9px] text-[#A69C8D] mt-0.5">
                {error || !kpis?.topCategory
                  ? ''
                  : t('expenseReport.kpi.topCategory', { amount: bigMoney(kpis.topCategoryCents) })}
              </span>
            </>
          }
        />
        <Figure
          value={error ? '—' : bigMoney(kpis?.notPayableCents ?? 0)}
          last
          label={
            <>
              {t('expenseReport.kpi.notPayable')}
              <span className="block text-[9px] text-[#A69C8D] mt-0.5">
                {error
                  ? ''
                  : t('expenseReport.kpi.notPayableNote', {
                      rejected: bigMoney(kpis?.rejectedCents ?? 0),
                      observed: bigMoney(kpis?.observedCents ?? 0),
                    })}
              </span>
            </>
          }
        />
      </FigureStrip>

      {/* Gasto aprobado por obra — ancla 3, en el contenedor: se pinta vacío */}
      <div className="bg-white border border-[#E7E1D5]" data-tour="sec.expense-report.obras">
        <BlockHead
          title={t('expenseReport.byProject.title')}
          hint={t('expenseReport.byProject.hint')}
        />
        {loading && !report ? (
          <TableSkeleton rows={4} cols={PROJECT_COLS} />
        ) : error ? (
          <div className="p-[18px]">
            <LoadFailure
              title={t('expenseReport.loadErrorTitle')}
              body={t('expenseReport.loadErrorBody')}
              code={error}
              onRetry={reload}
            />
          </div>
        ) : !hasData ? (
          <EmptyRange
            projectName={projectName}
            filters={filters}
            onReset={() => setFilters(defaultReportFilters())}
            onClearProject={() => setFilters(f => ({ ...f, projectId: 'all' }))}
          />
        ) : (
          <div className={cn(loading && 'opacity-60 transition-opacity')}>
            <ProjectTable
              rows={report!.byProject}
              totals={{
                approvedCents: kpis!.totalApprovedCents,
                pendingCents: kpis!.pendingCents,
                pendingCount: kpis!.pendingCount,
                observedCents: kpis!.observedCents,
                observedCount: kpis!.observedCount,
                rejectedCents: kpis!.rejectedCents,
                rejectedCount: kpis!.rejectedCount,
                projectCount: kpis!.projectCount,
              }}
              lang={lang}
              openId={openProject}
              onToggle={id => setOpenProject(cur => (cur === id ? null : id))}
              onOpenInbox={openInbox}
            />
          </div>
        )}
      </div>

      {/* En qué se fue · desde cuándo sube */}
      {!error && (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="bg-white border border-[#E7E1D5]">
            <BlockHead
              title={t('expenseReport.byCategory.title')}
              hint={t('expenseReport.byCategory.hint')}
            />
            {loading && !report ? (
              <div className="px-[18px] pb-4"><div className="h-[120px] bt-skeleton" /></div>
            ) : (
              <CategoryList
                categories={report?.byCategory ?? []}
                totalCents={kpis?.totalApprovedCents ?? 0}
                lang={lang}
              />
            )}
          </div>
          <div className="bg-white border border-[#E7E1D5]">
            <BlockHead
              title={t('expenseReport.trend.title')}
              hint={report?.trend.previousWindow ? changeHint(report, lang, t) : undefined}
            />
            {loading && !report ? (
              <div className="px-[18px] pb-4"><div className="h-[120px] bt-skeleton" /></div>
            ) : (
              <TrendStrip months={report?.trend.months ?? []} lang={lang} />
            )}
          </div>
        </div>
      )}

      {/* Quién gastó */}
      {!error && (
        <div className="bg-white border border-[#E7E1D5]">
          <BlockHead title={t('expenseReport.byWorker.title')} hint={t('expenseReport.byWorker.hint')} />
          {loading && !report ? (
            <TableSkeleton rows={4} cols={WORKER_COLS} />
          ) : (
            <WorkerTable
              rows={report?.byWorker ?? []}
              totals={report?.workerTotals ?? {
                workerCount: 0, submittedCount: 0, approvedCount: 0,
                pendingCount: 0, observedCount: 0, rejectedCount: 0, totalApprovedCents: 0,
              }}
              onOpenWorker={workerId => {
                writeInboxPreset({ workerId, dateFrom: filters.dateFrom, dateTo: filters.dateTo });
                onNavigate?.('expenses');
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

/** `+114 % contra el mismo tramo de agosto ($702.000)`. */
function changeHint(
  report: NonNullable<ReturnType<typeof useExpenseReport>['report']>,
  lang: string,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  const previous = report.trend.previousWindow;
  if (!previous) return '';
  if (previous.approvedCents <= 0) return t('expenseReport.trend.noBaseline');
  const change = ((report.kpis.totalApprovedCents - previous.approvedCents) / previous.approvedCents) * 100;
  return t('expenseReport.trend.vsPrevWindow', {
    change: `${change >= 0 ? '+' : '−'}${pct(Math.abs(change), lang)} %`,
    month: monthName(previous.dateFrom.slice(0, 7), lang),
    amount: bigMoney(previous.approvedCents),
  });
}

/**
 * Dos vacíos que no se explican igual.
 *
 * El de un rango dice que el rango está vacío y ofrece volver a este mes; el
 * de un filtro de obra ofrece **quitar ese filtro**, que es la salida de verdad
 * cuando el recorte es de uno.
 */
function EmptyRange({ projectName, filters, onReset, onClearProject }: {
  projectName: string | null;
  filters: ReportFilters;
  onReset: () => void;
  onClearProject: () => void;
}) {
  const { t } = useTranslation('admin');
  return (
    <EmptyWord
      className="border-0"
      word={t('expenseReport.empty.word')}
      title={projectName ? t('expenseReport.empty.projectTitle') : t('expenseReport.empty.rangeTitle')}
      hint={projectName
        ? t('expenseReport.empty.project', { project: projectName, from: filters.dateFrom, to: filters.dateTo })
        : t('expenseReport.empty.range', { from: filters.dateFrom, to: filters.dateTo })}
      action={projectName
        ? <PrimaryButton onClick={onClearProject}>{t('expenseReport.empty.clearProject')}</PrimaryButton>
        : <PrimaryButton onClick={onReset}>{t('expenseReport.empty.thisMonth')}</PrimaryButton>}
    />
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <Mono className="text-[9.5px] font-semibold tracking-[0.12em] text-[#5A5346]">{label}</Mono>
      {children}
    </label>
  );
}
