import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ArrowRight, ChevronRight, X } from 'lucide-react';
import { getAdminHoursReport, type AdminHoursReportResponse, type WorkerHoursSummary } from '../../services/time';
import { listProjects } from '../../services/projects';
import {
  GRID_INK, LaborFilters, LaborHeader, LaborSkeleton, Mono, fmtDay, fmtRange,
  initials, mainProject, money, monthRange, projectedCost, weekRange,
} from './shared';

/** Ink → warm greys, so a stacked bar reads as one family, not a rainbow. */
const SHADES = ['#0A0A0A', '#5A5346', '#A69C8D', '#CDBFA6', '#DED4C2'];

/**
 * Costo de Mano de Obra — "¿cuánto me costó, y en qué obra se fue?".
 *
 * Two things this screen refuses to let happen: (1) confusing projected cost
 * with money already paid — hence the permanent stamp; (2) a total that lies
 * because someone has no hourly rate, so their hours silently cost zero.
 */
export function LaborCostScreen({ onNavigate }: { onNavigate: (section: string) => void }) {
  const { t, i18n } = useTranslation(['admin', 'common']);
  const lang = i18n.language;

  const [range, setRange] = useState<'week' | 'month'>('week');
  const [q, setQ] = useState('');
  const [project, setProject] = useState('');
  const [data, setData] = useState<AdminHoursReportResponse | null>(null);
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState<WorkerHoursSummary | null>(null);

  const { from, to } = range === 'week' ? weekRange() : monthRange();

  const load = useCallback(async () => {
    setLoading(true); setError(false);
    try {
      setData(await getAdminHoursReport({
        dateFrom: from, dateTo: to,
        projectId: project ? Number(project) : undefined,
      }));
    } catch { setError(true); setData(null); }
    finally { setLoading(false); }
  }, [from, to, project]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    listProjects({ status: 'ACTIVE', page: 0, size: 100 })
      .then(p => setProjects(p.content.map(x => ({ id: x.id, name: x.name }))))
      .catch(() => setProjects([]));
  }, []);

  const workers = data?.workers ?? [];
  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return workers;
    return workers.filter(w => `${w.workerName ?? ''} ${w.workerUsername}`.toLowerCase().includes(needle));
  }, [workers, q]);

  const rateless = visible.filter(w => w.hourlyRate == null);
  const costed = useMemo(() => visible.filter(w => w.hourlyRate != null), [visible]);
  const totalCost = costed.reduce((s, w) => s + (projectedCost(w) ?? 0), 0);
  const costedHours = costed.reduce((s, w) => s + w.totalApprovedHours, 0);
  const ratelessHours = rateless.reduce((s, w) => s + w.totalApprovedHours, 0);
  const costPerHour = costedHours > 0 ? totalCost / costedHours : 0;

  /**
   * Cost split by jobsite — the question the hero block answers.
   *
   * Only APPROVED entries count: dailyEntries also carries pending ones, and
   * including them made the shares add up to well over 100% of the total.
   */
  const byProject = useMemo(() => {
    const tally = new Map<string, number>();
    for (const w of costed) {
      const approved = (w.dailyEntries ?? []).filter(d => d.approvalStatus === 'APPROVED' && d.projectName);
      const approvedHours = approved.reduce((s, d) => s + (d.totalHours ?? 0), 0) || 1;
      for (const d of approved) {
        // entryCost is the backend's own hours × rate; fall back to pro-rating
        // the worker's projected cost when it isn't supplied.
        const share = d.entryCost ?? ((d.totalHours ?? 0) / approvedHours) * (projectedCost(w) ?? 0);
        tally.set(d.projectName, (tally.get(d.projectName) ?? 0) + share);
      }
    }
    return [...tally.entries()]
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [costed]);

  const chips = [
    q && { key: 'q', label: `${t('admin:lab.f.search')} · ${q}`, clear: () => setQ('') },
    project && { key: 'project', label: `${t('admin:lab.f.project')} · ${projects.find(p => String(p.id) === project)?.name ?? project}`, clear: () => setProject('') },
    range !== 'week' && { key: 'range', label: `${t('admin:lab.f.range')} · ${t('admin:lab.f.month')}`, clear: () => setRange('week') },
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[];

  const sorted = [...costed].sort((a, b) => (projectedCost(b) ?? 0) - (projectedCost(a) ?? 0));

  return (
    <div className="relative p-4 md:p-6 max-w-[1400px] mx-auto space-y-4">
      <LaborHeader
        screen="labor-cost" onNavigate={onNavigate}
        title={t('admin:cost.title')}
        summary={t('admin:cost.summary', {
          workers: visible.length, amount: money(totalCost),
          hours: costedHours.toFixed(1), range: fmtRange(from, to, lang),
        })}
        alert={rateless.length > 0 ? t('admin:cost.summaryRateless', { count: rateless.length }) : null}
        right={
          <div className="inline-flex items-center gap-2 bg-[#0A0A0A] text-[#F5F1E8] px-3 py-2 flex-shrink-0">
            <span className="w-1.5 h-1.5 bg-[#F97316] block" />
            <Mono className="text-[10.5px] tracking-[0.1em]">{t('admin:cost.projectedStamp')}</Mono>
          </div>
        }
      />

      {/* Indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-3 bg-white border border-[#E4E4E7]">
        <div className="p-4 md:px-5 sm:border-r border-[#EDE7DB]">
          <div className="flex items-baseline">
            <span className="font-bt-display font-bold text-2xl text-[#8A8175] self-start mt-1">$</span>
            <span className="font-bt-display font-bold text-4xl leading-none text-[#0A0A0A]">{money(totalCost)}</span>
          </div>
          <Mono className="block text-[10.5px] text-[#5A5346] mt-1.5">{t('admin:cost.ind.total')}</Mono>
        </div>
        <div className="p-4 md:px-5 sm:border-r border-[#EDE7DB]">
          <div className="flex items-baseline">
            <span className="font-bt-display font-bold text-xl text-[#8A8175] self-start mt-1">$</span>
            <span className="font-bt-display font-bold text-4xl leading-none text-[#0A0A0A]">{costPerHour.toFixed(2)}</span>
            <Mono className="text-[11px] normal-case text-[#8A8175] ml-1 self-end mb-1.5">/h</Mono>
          </div>
          <Mono className="block text-[10.5px] text-[#5A5346] mt-1.5">{t('admin:cost.ind.perHour')}</Mono>
        </div>
        <div className={`p-4 md:px-5 ${rateless.length > 0 ? 'bg-[#F97316]/5' : ''}`}>
          <div className="flex items-center gap-2">
            <span className={`font-bt-display font-bold text-4xl leading-none ${rateless.length > 0 ? 'text-[#F97316]' : 'text-[#0A0A0A]'}`}>
              {rateless.length}
            </span>
            {rateless.length > 0 && <AlertTriangle className="w-4 h-4 text-[#F97316]" />}
          </div>
          <Mono className="block text-[10.5px] text-[#5A5346] mt-1.5">{t('admin:cost.ind.rateless')}</Mono>
        </div>
      </div>

      {/* Hero: where did the cost go */}
      {!loading && byProject.length > 0 && (
        <div className="bg-white border border-[#E4E4E7] p-4 md:p-5">
          <div className="flex items-baseline justify-between gap-3 mb-3.5 flex-wrap">
            <Mono className="text-[10.5px] tracking-[0.12em] text-[#5A5346] font-semibold">{t('admin:cost.whereTitle')}</Mono>
            <Mono className="text-[10px] tracking-[0.06em] text-[#A69C8D]">
              {t('admin:cost.whereMeta', { amount: money(totalCost) })}
            </Mono>
          </div>
          <div className="flex h-8 w-full border border-[#E4E4E7] overflow-hidden">
            {byProject.map((p, i) => (
              <div key={p.name} title={`${p.name} · $${money(p.amount)}`}
                style={{ width: `${totalCost > 0 ? (p.amount / totalCost) * 100 : 0}%`, background: SHADES[i % SHADES.length], minWidth: 2 }} />
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 border border-[#E4E4E7] mt-3.5">
            {byProject.slice(0, 3).map((p, i) => (
              <div key={p.name} className={`p-3 md:px-3.5 ${i < 2 ? 'sm:border-r border-[#E4E4E7]' : ''}`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-2.5 h-2.5 block flex-shrink-0" style={{ background: SHADES[i % SHADES.length] }} />
                  <Mono className="text-[10px] normal-case tracking-[0.04em] text-[#5A5346] truncate">{p.name}</Mono>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-bt-display font-bold text-2xl leading-none text-[#0A0A0A]">${money(p.amount)}</span>
                  <Mono className="text-[11px] normal-case text-[#8A8175]">
                    {totalCost > 0 ? Math.round((p.amount / totalCost) * 100) : 0}%
                  </Mono>
                </div>
              </div>
            ))}
          </div>
          {rateless.length > 0 && (
            <div className="flex gap-2.5 items-center mt-3 bg-[#FBEDE0] border-l-[3px] border-[#F97316] px-3 py-2.5">
              <AlertTriangle className="w-3.5 h-3.5 text-[#EA580C] flex-shrink-0" />
              <span className="text-[12px] text-[#43301F] leading-snug">
                {t('admin:cost.ratelessWarning', { hours: ratelessHours.toFixed(1) })}
              </span>
            </div>
          )}
        </div>
      )}

      <LaborFilters
        q={q} onQ={setQ} range={range} onRange={setRange}
        project={project} onProject={setProject} projects={projects}
        chips={chips} onClear={() => { setQ(''); setProject(''); setRange('week'); }}
      />

      {/* List */}
      <div className="bg-white border border-[#E4E4E7] min-h-[300px]">
        {loading ? <LaborSkeleton /> : error ? (
          <div className="py-16 text-center">
            <p className="text-sm text-[#71717A]">{t('admin:lab.error')}</p>
            <button onClick={load} className="mt-3 font-bt-mono text-[10px] uppercase tracking-[0.1em] border border-[#DBD0BB] px-3 py-1.5 hover:border-[#F97316]">
              {t('common:buttons.retry')}
            </button>
          </div>
        ) : visible.length === 0 ? (
          <div className="py-[70px] px-6 text-center">
            <div className="font-bt-display font-bold text-4xl leading-none text-[#CDBFA6]">{t('admin:cost.emptyBig')}</div>
            <p className="font-bt-heading font-bold text-base text-[#0A0A0A] mt-2.5">{t('admin:cost.emptyTitle')}</p>
          </div>
        ) : (
          <>
            {rateless.length > 0 && (
              <div>
                <div className="flex items-center gap-3 px-5 pt-3 pb-2.5 bg-[#FBF8F2] border-b border-[#EDE7DB]">
                  <Mono className="text-[10.5px] tracking-[0.14em] text-[#C2410C] whitespace-nowrap">{t('admin:cost.groupRateless')}</Mono>
                  <span className="flex-1 h-px bg-[#DED4C2]" />
                  <Mono className="text-[9.5px] text-[#B4A992]">{t('admin:lab.peopleCount', { count: rateless.length })}</Mono>
                </div>
                {rateless.map(w => (
                  <CostRow key={w.workerId} w={w} total={totalCost} onOpen={() => setOpen(w)} onNavigate={onNavigate} />
                ))}
              </div>
            )}
            {sorted.length > 0 && (
              <div>
                <div className="flex items-center gap-3 px-5 pt-3 pb-2.5 bg-[#FBF8F2] border-b border-[#EDE7DB]">
                  <Mono className="text-[10.5px] tracking-[0.14em] text-[#5A5346] whitespace-nowrap">{t('admin:cost.groupCosted')}</Mono>
                  <span className="flex-1 h-px bg-[#DED4C2]" />
                  <Mono className="text-[9.5px] text-[#B4A992]">{t('admin:lab.peopleCount', { count: sorted.length })}</Mono>
                </div>
                {sorted.map(w => (
                  <CostRow key={w.workerId} w={w} total={totalCost} onOpen={() => setOpen(w)} onNavigate={onNavigate} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {open && <CostDrawer worker={open} lang={lang} onClose={() => setOpen(null)} onNavigate={onNavigate} />}
    </div>
  );
}

function CostRow({ w, total, onOpen, onNavigate }: {
  w: WorkerHoursSummary; total: number; onOpen: () => void; onNavigate: (s: string) => void;
}) {
  const { t } = useTranslation(['admin']);
  const cost = projectedCost(w);
  const rateless = w.hourlyRate == null;
  const share = cost != null && total > 0 ? (cost / total) * 100 : 0;
  return (
    <div onClick={onOpen}
      className="flex gap-3.5 items-center px-5 py-4 border-b border-[#F0EBE1] cursor-pointer hover:bg-[#FBF8F2] transition-colors"
      style={{ borderLeft: rateless ? '3px solid #F97316' : '3px solid transparent' }}>
      <span className={`w-10 h-10 flex items-center justify-center font-bt-mono text-[13px] font-semibold flex-shrink-0 ${rateless ? 'bg-[#0A0A0A] text-[#F97316]' : 'bg-[#EDE5D6] text-[#5A5346]'}`}>
        {initials(w.workerName, w.workerUsername)}
      </span>
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-[15px] font-semibold text-[#0A0A0A]">{w.workerName || w.workerUsername}</span>
          <Mono className="text-[10px] normal-case tracking-normal text-[#A69C8D] truncate">{mainProject(w)}</Mono>
          {rateless && (
            <Mono className="text-[9px] font-semibold tracking-[0.06em] bg-[#F97316] text-[#0A0A0A] px-1.5 py-0.5">
              {t('admin:cost.ratelessTag')}
            </Mono>
          )}
        </div>
        <Mono className="text-[10.5px] tracking-[0.04em] normal-case text-[#A69C8D]">
          {rateless
            ? t('admin:cost.rowRateless', { hours: w.totalApprovedHours.toFixed(1) })
            : t('admin:cost.rowCalc', { hours: w.totalApprovedHours.toFixed(1), rate: w.hourlyRate!.toFixed(2) })}
        </Mono>
        {!rateless && (
          <div className="w-[180px] max-w-[60%] h-1.5 bg-[#EDE7DB]">
            <div className="h-1.5 bg-[#0A0A0A]" style={{ width: `${share}%` }} />
          </div>
        )}
      </div>
      <div className="flex-shrink-0 text-right min-w-[110px]">
        {rateless ? (
          <button onClick={e => { e.stopPropagation(); onNavigate('users'); }}
            className="inline-flex items-center gap-1.5 font-bt-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-[#C2410C] hover:text-[#F97316]">
            {t('admin:cost.setRate')} <ArrowRight className="w-3 h-3" />
          </button>
        ) : (
          <>
            <div className="flex items-baseline gap-0.5 justify-end">
              <span className="font-bt-display font-bold text-base text-[#8A8175]">$</span>
              <span className="font-bt-display font-bold text-3xl leading-none text-[#0A0A0A]">{money(cost ?? 0)}</span>
            </div>
            <Mono className="block text-[9px] tracking-[0.08em] text-[#B4A992] mt-0.5">
              {t('admin:cost.shareOfTotal', { pct: Math.round(share) })}
            </Mono>
          </>
        )}
      </div>
      <ChevronRight className="w-4 h-4 text-[#C6BBA6] flex-shrink-0" />
    </div>
  );
}

function CostDrawer({ worker, lang, onClose, onNavigate }: {
  worker: WorkerHoursSummary; lang: string; onClose: () => void; onNavigate: (s: string) => void;
}) {
  const { t } = useTranslation(['admin']);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const rateless = worker.hourlyRate == null;
  const cost = projectedCost(worker);

  return (
    <div className="fixed inset-0 z-[80]">
      <div onClick={onClose} className="absolute inset-0 bg-[#0B0A09]/40" />
      <aside className="absolute top-0 right-0 bottom-0 w-[472px] max-w-[94%] bg-white border-l border-[#CDBFA6] shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E4E4E7] flex-shrink-0">
          <Mono className="text-[11px] tracking-[0.15em] text-[#5A5346]">{t('admin:cost.d.title')}</Mono>
          <button onClick={onClose} className="w-7 h-7 border border-[#E4E4E7] bg-[#FAF7F0] flex items-center justify-center hover:border-[#F97316]">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <div className="flex gap-3.5 items-center">
            <span className={`w-[52px] h-[52px] flex items-center justify-center font-bt-mono text-[17px] font-semibold flex-shrink-0 ${rateless ? 'bg-[#0A0A0A] text-[#F97316]' : 'bg-[#EDE5D6] text-[#5A5346]'}`}>
              {initials(worker.workerName, worker.workerUsername)}
            </span>
            <div className="min-w-0">
              <p className="font-bt-heading font-bold text-xl leading-tight text-[#0A0A0A]">
                {worker.workerName || worker.workerUsername}
              </p>
              <Mono className="block text-[11.5px] normal-case tracking-normal text-[#A69C8D] mt-1 truncate">
                @{worker.workerUsername} · {mainProject(worker)}
              </Mono>
            </div>
          </div>

          {rateless ? (
            <div className="border border-[#F6CFA6] border-l-[3px] border-l-[#F97316] bg-[#FBEDE0] p-4 mt-4">
              <p className="font-bt-heading font-bold text-[17px] text-[#0A0A0A]">{t('admin:cost.d.ratelessTitle')}</p>
              <p className="text-[13px] text-[#43301F] leading-relaxed mt-1.5">
                {t('admin:cost.d.ratelessBody', { hours: worker.totalApprovedHours.toFixed(1) })}
              </p>
              <button onClick={() => onNavigate('users')}
                className="mt-3.5 inline-flex items-center gap-2 bg-[#F97316] hover:bg-[#EA580C] text-[#0A0A0A] px-3.5 py-2.5 font-bt-mono text-[10.5px] font-semibold uppercase tracking-[0.08em]">
                {t('admin:cost.d.ratelessCta')} <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <>
              <div className="relative overflow-hidden bg-[#0A0A0A] text-[#F5F1E8] p-5 mt-4">
                <div className="absolute inset-0 pointer-events-none" style={GRID_INK} />
                <div className="relative flex items-center justify-between">
                  <Mono className="text-[10px] tracking-[0.12em] text-[#F5F1E8]/60">{t('admin:cost.d.projected')}</Mono>
                  <Mono className="inline-flex items-center gap-1.5 text-[9px] tracking-[0.1em] text-[#F97316] border border-[#F97316]/50 px-2 py-1">
                    <span className="w-1.5 h-1.5 bg-[#F97316] block" />{t('admin:cost.d.notPaid')}
                  </Mono>
                </div>
                <div className="relative flex items-baseline gap-1 mt-2">
                  <span className="font-bt-display font-bold text-3xl text-[#F5F1E8]/70">$</span>
                  <span className="font-bt-display font-bold text-6xl leading-none">{money(cost ?? 0)}</span>
                </div>
                <Mono className="relative block text-[11px] tracking-[0.05em] text-[#F5F1E8]/60 mt-2">
                  {t('admin:cost.d.formula', { hours: worker.totalApprovedHours.toFixed(1), rate: worker.hourlyRate!.toFixed(2) })}
                </Mono>
              </div>

              <div className="flex items-center gap-2.5 mt-6 mb-2.5">
                <span className="w-4 h-px bg-[#F97316] block" />
                <Mono className="text-[10px] tracking-[0.12em] text-[#8A8175]">{t('admin:cost.d.perDay')}</Mono>
              </div>
              <div className="border border-[#E4E4E7]">
                {(worker.dailyEntries ?? [])
                  .filter(d => d.totalHours && d.approvalStatus === 'APPROVED')
                  .map((d, i) => (
                  <div key={i} className="flex items-center justify-between gap-2.5 px-3.5 py-2.5 border-b border-[#F0EBE1]">
                    <Mono className="text-[11px] font-semibold tracking-[0.06em] text-[#0A0A0A]">{fmtDay(d.date, lang)}</Mono>
                    <Mono className="flex-1 text-[10px] normal-case tracking-normal text-[#A69C8D] text-right">
                      {d.totalHours!.toFixed(1)} h × ${worker.hourlyRate!.toFixed(2)}
                    </Mono>
                    <Mono className="text-[13px] font-semibold normal-case tracking-normal text-[#0A0A0A] min-w-[64px] text-right">
                      ${money(d.totalHours! * worker.hourlyRate!)}
                    </Mono>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-2.5 px-3.5 py-3 bg-[#FBF8F2]">
                  <Mono className="text-[10px] tracking-[0.08em] text-[#5A5346]">{t('admin:cost.d.total')}</Mono>
                  <span className="font-bt-display font-bold text-xl text-[#0A0A0A]">${money(cost ?? 0)}</span>
                </div>
              </div>

              <p className="text-[12px] text-[#8A8175] leading-relaxed mt-3">
                {t('admin:cost.d.footnote')}{' '}
                <button onClick={() => onNavigate('labor-payroll')} className="text-[#C2410C] font-semibold hover:underline">
                  {t('admin:lab.tab.payroll')}
                </button>.
              </p>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
