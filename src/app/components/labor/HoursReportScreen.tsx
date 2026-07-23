import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ChevronRight, Download, X } from 'lucide-react';
import { getAdminHoursReport, type AdminHoursReportResponse, type WorkerHoursSummary } from '../../services/time';
import { listProjects } from '../../services/projects';
import {
  LaborFilters, LaborHeader, LaborSkeleton, Mono, attendanceDays, fmtDay, fmtRange,
  initials, mainProject, monthRange, pendingHours, periodDays, weekRange,
} from './shared';

/**
 * Reporte de Horas — "¿cuánto trabajó cada quien?".
 *
 * Deliberately money-free: not one dollar figure appears here. Cost is the
 * next screen's job. What this one owns is attendance — the per-day strip
 * makes a week of presence/late/absent readable at a glance.
 */
export function HoursReportScreen({ onNavigate }: { onNavigate: (section: string) => void }) {
  const { t, i18n } = useTranslation(['admin', 'common']);
  const lang = i18n.language;

  const [range, setRange] = useState<'week' | 'month'>('week');
  const [q, setQ] = useState('');
  const [project, setProject] = useState('');
  const [attendance, setAttendance] = useState<'' | 'full' | 'absences' | 'late'>('');
  const [data, setData] = useState<AdminHoursReportResponse | null>(null);
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState<WorkerHoursSummary | null>(null);

  const { from, to } = range === 'week' ? weekRange() : monthRange();

  const load = useCallback(async () => {
    setLoading(true); setError(false);
    try {
      const res = await getAdminHoursReport({
        dateFrom: from, dateTo: to,
        projectId: project ? Number(project) : undefined,
      });
      setData(res);
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
    return workers.filter(w => {
      if (needle && !(`${w.workerName ?? ''} ${w.workerUsername}`.toLowerCase().includes(needle))) return false;
      if (attendance === 'full' && w.absences > 0) return false;
      if (attendance === 'absences' && w.absences === 0) return false;
      if (attendance === 'late' && w.lateDays === 0) return false;
      return true;
    });
  }, [workers, q, attendance]);

  const groups = useMemo(() => {
    const full = visible.filter(w => w.absences === 0).sort((a, b) => b.totalApprovedHours - a.totalApprovedHours);
    const withAbs = visible.filter(w => w.absences > 0).sort((a, b) => b.totalApprovedHours - a.totalApprovedHours);
    return [
      { key: 'full' as const, rows: full },
      { key: 'absences' as const, rows: withAbs },
    ].filter(g => g.rows.length > 0);
  }, [visible]);

  const chips = [
    q && { key: 'q', label: `${t('admin:lab.f.search')} · ${q}`, clear: () => setQ('') },
    project && { key: 'project', label: `${t('admin:lab.f.project')} · ${projects.find(p => String(p.id) === project)?.name ?? project}`, clear: () => setProject('') },
    attendance && { key: 'att', label: `${t('admin:hrs.f.attendance')} · ${t(`admin:hrs.att.${attendance}`)}`, clear: () => setAttendance('') },
    range !== 'week' && { key: 'range', label: `${t('admin:lab.f.range')} · ${t('admin:lab.f.month')}`, clear: () => setRange('week') },
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[];

  const kpis = data?.kpis;
  const pending = kpis?.totalPendingHours ?? 0;

  return (
    <div className="relative p-4 md:p-6 max-w-[1400px] mx-auto space-y-4">
      <LaborHeader
        screen="hours" onNavigate={onNavigate}
        title={t('admin:hrs.title')}
        summary={t('admin:hrs.summary', {
          workers: workers.length,
          hours: (kpis?.totalApprovedHours ?? 0).toFixed(1),
          avg: (kpis?.avgHoursPerDay ?? 0).toFixed(1),
          range: fmtRange(from, to, lang),
        })}
        alert={pending > 0 ? t('admin:hrs.summaryPending', { hours: pending.toFixed(1) }) : null}
        right={
          <button onClick={() => exportCsv(visible, from, to)}
            className="inline-flex items-center gap-2 border border-[#DBD0BB] bg-[#FAF7F0] px-4 py-3 font-bt-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-[#0A0A0A] hover:border-[#F97316] hover:text-[#C2410C]">
            <Download className="w-3.5 h-3.5" />{t('admin:lab.export')}
          </button>
        }
      />

      {/* Indicators — hours only, never money */}
      <div className="grid grid-cols-1 sm:grid-cols-3 bg-white border border-[#E4E4E7]">
        <div className="p-4 md:px-5 sm:border-r border-[#EDE7DB]">
          <div className="flex items-baseline gap-1.5">
            <span className="font-bt-display font-bold text-4xl leading-none text-[#0A0A0A]">
              {(kpis?.totalApprovedHours ?? 0).toFixed(1)}
            </span>
            <span className="font-bt-display font-bold text-xl text-[#8A8175]">H</span>
          </div>
          <Mono className="block text-[10.5px] text-[#5A5346] mt-1.5">{t('admin:hrs.ind.approved')}</Mono>
        </div>
        <div className={`p-4 md:px-5 sm:border-r border-[#EDE7DB] ${pending > 0 ? 'bg-[#F97316]/5' : ''}`}>
          <div className="flex items-center gap-2">
            <div className="flex items-baseline gap-1.5">
              <span className={`font-bt-display font-bold text-4xl leading-none ${pending > 0 ? 'text-[#F97316]' : 'text-[#0A0A0A]'}`}>
                {pending.toFixed(1)}
              </span>
              <span className="font-bt-display font-bold text-xl text-[#8A8175]">H</span>
            </div>
            {pending > 0 && <AlertTriangle className="w-4 h-4 text-[#F97316]" />}
          </div>
          <Mono className="block text-[10.5px] text-[#5A5346] mt-1.5">{t('admin:hrs.ind.pending')}</Mono>
        </div>
        <div className="p-4 md:px-5">
          <span className="font-bt-display font-bold text-4xl leading-none text-[#0A0A0A]">{kpis?.absentDays ?? 0}</span>
          <Mono className="block text-[10.5px] text-[#5A5346] mt-1.5">{t('admin:hrs.ind.absences')}</Mono>
        </div>
      </div>

      <LaborFilters
        q={q} onQ={setQ} range={range} onRange={setRange}
        project={project} onProject={setProject} projects={projects}
        chips={chips} onClear={() => { setQ(''); setProject(''); setAttendance(''); setRange('week'); }}
        extra={
          <select value={attendance} onChange={e => setAttendance(e.target.value as typeof attendance)}
            className="appearance-none border border-[#DBD0BB] bg-[#FAF7F0] px-3 py-2 font-bt-mono text-[11px] uppercase tracking-[0.06em] text-[#0A0A0A] cursor-pointer">
            <option value="">{t('admin:hrs.f.allAttendance')}</option>
            <option value="full">{t('admin:hrs.att.full')}</option>
            <option value="absences">{t('admin:hrs.att.absences')}</option>
            <option value="late">{t('admin:hrs.att.late')}</option>
          </select>
        }
      />

      {/* Attendance legend */}
      {!loading && visible.length > 0 && (
        <div className="flex items-center gap-4 flex-wrap -mt-1 font-bt-mono text-[9.5px] uppercase tracking-[0.08em] text-[#8A8175]">
          <span className="text-[#5A5346]">{t('admin:hrs.legend')}</span>
          {[['#0A0A0A', t('admin:hrs.legendPresent')], ['#F97316', t('admin:hrs.legendLate')], ['', t('admin:hrs.legendAbsent')]].map(([bg, label]) => (
            <span key={label} className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 block" style={bg ? { background: bg } : { border: '1px solid #CDBFA6', background: '#fff' }} />
              {label}
            </span>
          ))}
        </div>
      )}

      {/* List */}
      <div className="bg-white border border-[#E4E4E7] min-h-[340px]">
        {loading ? <LaborSkeleton /> : error ? (
          <div className="py-16 text-center">
            <p className="text-sm text-[#71717A]">{t('admin:lab.error')}</p>
            <button onClick={load} className="mt-3 font-bt-mono text-[10px] uppercase tracking-[0.1em] border border-[#DBD0BB] px-3 py-1.5 hover:border-[#F97316]">
              {t('common:buttons.retry')}
            </button>
          </div>
        ) : workers.length === 0 ? (
          <div className="py-[74px] px-6 text-center">
            <div className="font-bt-display font-bold text-4xl leading-none text-[#CDBFA6]">{t('admin:hrs.emptyBig')}</div>
            <p className="font-bt-heading font-bold text-base text-[#0A0A0A] mt-2.5">{t('admin:hrs.emptyTitle')}</p>
            <p className="text-[13px] text-[#8A8175] mt-1">{t('admin:hrs.emptyBody')}</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="py-[70px] px-6 text-center">
            <div className="font-bt-display font-bold text-4xl leading-none text-[#CDBFA6]">{t('admin:usr.noMatchBig')}</div>
            <button onClick={() => { setQ(''); setAttendance(''); }}
              className="mt-4 font-bt-mono text-[10.5px] uppercase tracking-[0.1em] font-semibold border border-[#DBD0BB] bg-[#FAF7F0] px-3.5 py-2 hover:border-[#F97316] hover:text-[#C2410C]">
              {t('admin:audit.f.clearAll')}
            </button>
          </div>
        ) : (
          groups.map(g => (
            <div key={g.key}>
              <div className="flex items-center gap-3 px-5 pt-3 pb-2.5 bg-[#FBF8F2] border-b border-[#EDE7DB]">
                <Mono className={`text-[10.5px] tracking-[0.14em] whitespace-nowrap ${g.key === 'absences' ? 'text-[#C2410C]' : 'text-[#5A5346]'}`}>
                  {t(`admin:hrs.group.${g.key}`)}
                </Mono>
                <span className="flex-1 h-px bg-[#DED4C2]" />
                <Mono className="text-[9.5px] text-[#B4A992] whitespace-nowrap">
                  {t('admin:lab.peopleCount', { count: g.rows.length })}
                </Mono>
              </div>
              {g.rows.map(w => (
                <div key={w.workerId} onClick={() => setOpen(w)}
                  className="flex gap-3.5 items-center px-5 py-4 border-b border-[#F0EBE1] cursor-pointer hover:bg-[#FBF8F2] transition-colors"
                  style={{ borderLeft: w.absences > 0 ? '3px solid #F97316' : '3px solid transparent' }}>
                  <span className={`w-10 h-10 flex items-center justify-center font-bt-mono text-[13px] font-semibold flex-shrink-0 ${w.absences > 0 ? 'bg-[#0A0A0A] text-[#F97316]' : 'bg-[#EDE5D6] text-[#5A5346]'}`}>
                    {initials(w.workerName, w.workerUsername)}
                  </span>
                  <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-[15px] font-semibold text-[#0A0A0A]">{w.workerName || w.workerUsername}</span>
                      <Mono className="text-[11px] normal-case tracking-normal text-[#A69C8D]">@{w.workerUsername}</Mono>
                      <Mono className="text-[9.5px] tracking-[0.08em] bg-[#F3EEE4] text-[#5A5346] px-1.5 py-0.5">
                        {t(`common:roles.${w.workerRole}`, { defaultValue: w.workerRole })}
                      </Mono>
                      {w.absences > 0 && (
                        <Mono className="text-[9px] font-semibold tracking-[0.06em] bg-[#F97316] text-[#0A0A0A] px-1.5 py-0.5">
                          {t('admin:hrs.absencesTag', { count: w.absences })}
                        </Mono>
                      )}
                      {w.lateDays > 0 && (
                        <Mono className="text-[9px] font-semibold tracking-[0.06em] text-[#C2410C] border border-[#E7B489] px-1.5 py-0.5">
                          {t('admin:hrs.lateTag', { count: w.lateDays })}
                        </Mono>
                      )}
                    </div>
                    <Mono className="text-[10.5px] tracking-[0.04em] normal-case text-[#A69C8D]">
                      {t('admin:hrs.daysWorked', {
                        worked: attendanceDays(w).filter(d => d.present).length,
                        total: periodDays(from, to),
                      })}
                      {mainProject(w) && ` · ${mainProject(w)}`}
                      {pendingHours(w) > 0 && (
                        <span className="text-[#EA580C] font-semibold">
                          {' '}· {t('admin:hrs.rowPending', { hours: pendingHours(w).toFixed(1) })}
                        </span>
                      )}
                    </Mono>
                  </div>
                  {/* Attendance strip — one square per calendar day */}
                  <div className="hidden sm:flex flex-shrink-0 items-center gap-1">
                    {attendanceDays(w).slice(0, 7).map(d => {
                      const label = !d.present
                        ? t('admin:hrs.legendAbsent')
                        : `${d.hours.toFixed(1)} h${d.late ? ` · ${t('admin:hrs.legendLate')}` : ''}`;
                      return (
                        <span key={d.date} title={`${fmtDay(d.date, lang)} · ${label}`}
                          className="w-3 h-3 block"
                          style={!d.present
                            ? { border: '1px solid #CDBFA6', background: '#fff' }
                            : { background: d.late ? '#F97316' : '#0A0A0A' }} />
                      );
                    })}
                  </div>
                  <div className="flex-shrink-0 text-right min-w-[92px]">
                    <div className="flex items-baseline gap-1 justify-end">
                      <span className="font-bt-display font-bold text-3xl leading-none text-[#0A0A0A]">
                        {w.totalApprovedHours.toFixed(1)}
                      </span>
                      <span className="font-bt-display font-bold text-base text-[#8A8175]">H</span>
                    </div>
                    <Mono className="block text-[9px] tracking-[0.06em] text-[#B4A992] mt-0.5">
                      {t('admin:hrs.avgPerDay', { avg: w.avgHoursPerDay.toFixed(1) })}
                    </Mono>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#C6BBA6] flex-shrink-0" />
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {open && <DayByDayDrawer worker={open} lang={lang} days={periodDays(from, to)}
        onClose={() => setOpen(null)} onNavigate={onNavigate} />}
    </div>
  );
}

/** Per-worker drawer: the period, day by day. */
function DayByDayDrawer({ worker, lang, days, onClose, onNavigate }: {
  worker: WorkerHoursSummary; lang: string; days: number;
  onClose: () => void; onNavigate: (s: string) => void;
}) {
  const { t } = useTranslation(['admin']);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80]">
      <div onClick={onClose} className="absolute inset-0 bg-[#0B0A09]/40" />
      <aside className="absolute top-0 right-0 bottom-0 w-[492px] max-w-[94%] bg-white border-l border-[#CDBFA6] shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E4E4E7] flex-shrink-0">
          <Mono className="text-[11px] tracking-[0.15em] text-[#5A5346]">{t('admin:hrs.d.title')}</Mono>
          <button onClick={onClose} className="w-7 h-7 border border-[#E4E4E7] bg-[#FAF7F0] flex items-center justify-center hover:border-[#F97316]">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <div className="flex gap-3.5 items-center">
            <span className={`w-13 h-13 w-[52px] h-[52px] flex items-center justify-center font-bt-mono text-[17px] font-semibold flex-shrink-0 ${worker.absences > 0 ? 'bg-[#0A0A0A] text-[#F97316]' : 'bg-[#EDE5D6] text-[#5A5346]'}`}>
              {initials(worker.workerName, worker.workerUsername)}
            </span>
            <div className="min-w-0">
              <p className="font-bt-heading font-bold text-xl leading-tight text-[#0A0A0A]">
                {worker.workerName || worker.workerUsername}
              </p>
              <Mono className="block text-[11.5px] normal-case tracking-normal text-[#A69C8D] mt-1">
                @{worker.workerUsername} · {t(`common:roles.${worker.workerRole}`, { defaultValue: worker.workerRole })}
              </Mono>
            </div>
          </div>

          <div className="grid grid-cols-3 border border-[#E4E4E7] mt-4">
            {[
              { v: worker.totalApprovedHours.toFixed(1), l: t('admin:hrs.d.hours') },
              { v: `${attendanceDays(worker).filter(d => d.present).length}/${days}`, l: t('admin:hrs.d.days') },
              { v: String(worker.absences), l: t('admin:hrs.d.absences'), alert: worker.absences > 0 },
            ].map((s, i) => (
              <div key={i} className={`p-3 ${i < 2 ? 'border-r border-[#EDE7DB]' : ''}`}>
                <div className={`font-bt-display font-bold text-2xl leading-none ${s.alert ? 'text-[#EA580C]' : 'text-[#0A0A0A]'}`}>{s.v}</div>
                <Mono className="block text-[9px] tracking-[0.08em] text-[#8A8175] mt-1">{s.l}</Mono>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2.5 mt-6 mb-2.5">
            <span className="w-4 h-px bg-[#F97316] block" />
            <Mono className="text-[10px] tracking-[0.12em] text-[#8A8175]">{t('admin:hrs.d.entries')}</Mono>
          </div>
          <div className="border border-[#E4E4E7]">
            {(worker.dailyEntries ?? []).length === 0 ? (
              <div className="p-4 text-center">
                <Mono className="text-[11px] normal-case tracking-[0.05em] text-[#A69C8D]">{t('admin:hrs.d.noEntries')}</Mono>
              </div>
            ) : (worker.dailyEntries ?? []).map((d, i) => {
              // Absent means "never punched" — a 0 h record still has punches
              // on it and deserves its hours shown, not an "absent" verdict.
              const absent = d.clockIn == null;
              return (
                <div key={i} className="px-3.5 py-3 border-b border-[#F0EBE1] last:border-b-0"
                  style={{ background: absent ? '#FBFAF7' : '#fff' }}>
                  <div className="flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Mono className="text-[11px] font-semibold tracking-[0.06em] text-[#0A0A0A] whitespace-nowrap">
                        {fmtDay(d.date, lang)}
                      </Mono>
                      <Mono className="text-[10px] normal-case tracking-normal text-[#A69C8D] truncate">{d.projectName}</Mono>
                    </div>
                    {absent ? (
                      <Mono className="text-[9.5px] font-semibold tracking-[0.08em] text-[#C2410C] border border-[#E7B489] px-2 py-0.5 whitespace-nowrap">
                        {t('admin:hrs.d.absent')}
                      </Mono>
                    ) : (
                      <span className="font-bt-display font-bold text-lg leading-none text-[#0A0A0A] whitespace-nowrap">
                        {d.totalHours!.toFixed(1)} H
                      </span>
                    )}
                  </div>
                  {!absent && (
                    <div className="flex items-center justify-between gap-2.5 mt-1.5">
                      <Mono className="text-[10.5px] normal-case tracking-[0.03em] text-[#5A5346]">
                        {d.clockIn ?? '—'} → {d.clockOut ?? '—'}
                        {d.lunchMinutes ? <span className="text-[#B4A992]"> · {t('admin:hrs.d.lunch', { min: d.lunchMinutes })}</span> : null}
                      </Mono>
                      <Mono className={`text-[9px] font-semibold tracking-[0.06em] px-2 py-0.5 ${d.approvalStatus === 'APPROVED' ? 'bg-[#E8F0E5] text-[#2E6B34]' : 'text-[#C2410C] border border-[#E7B489]'}`}>
                        {t(`admin:apr.st.${d.approvalStatus}`, { defaultValue: d.approvalStatus })}
                      </Mono>
                    </div>
                  )}
                  {d.transitMinutes ? (
                    <Mono className="block text-[9px] tracking-[0.04em] text-[#C2410C] mt-1.5">
                      {t('admin:hrs.d.transit', { min: d.transitMinutes, from: d.transitFromProject ?? '' })}
                    </Mono>
                  ) : null}
                </div>
              );
            })}
          </div>

          <button onClick={() => onNavigate('time-approvals')}
            className="w-full mt-3.5 inline-flex items-center justify-center gap-2 border border-[#DBD0BB] bg-[#FAF7F0] px-3 py-2.5 font-bt-mono text-[10.5px] uppercase tracking-[0.06em] font-semibold text-[#0A0A0A] hover:border-[#F97316] hover:text-[#C2410C]">
            {t('admin:hrs.d.toApprovals')}
          </button>
        </div>
      </aside>
    </div>
  );
}

/** CSV of what's on screen — hours only, matching the screen's promise. */
function exportCsv(workers: WorkerHoursSummary[], from: string, to: string) {
  const header = ['Trabajador', 'Usuario', 'Rol', 'Horas aprobadas', 'Dias con marca', 'Prom h/dia', 'Tarde', 'Ausencias'];
  const rows = workers.map(w => [
    w.workerName ?? '', w.workerUsername, w.workerRole,
    w.totalApprovedHours.toFixed(1), String(attendanceDays(w).length),
    w.avgHoursPerDay.toFixed(1), String(w.lateDays), String(w.absences),
  ]);
  const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url; a.download = `horas-${from}-${to}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
