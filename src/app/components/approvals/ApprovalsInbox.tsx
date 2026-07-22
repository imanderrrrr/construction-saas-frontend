import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Check, ChevronRight, Loader2, Search } from 'lucide-react';
import {
  approveRecord, getTimeRecords, type TimeRecordResponse,
} from '../../services/time';
import { RecordDrawer } from './RecordDrawer';
import {
  Mono, alertsFor, dayHours, initials, sequenceOf, statusPillClass,
} from './shared';

/**
 * Aprobaciones de Tiempo — a work queue, not a report.
 *
 * The admin arrives with a stack and wants it empty: everything clean is
 * approvable in bulk (or with one keystroke), and the screen only slows them
 * down where something is off — outside the geofence, late, no clock-out, a
 * manual mark, an open dispute.
 */

function mondayOfWeek(): string {
  const d = new Date();
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}
const today = () => new Date().toISOString().slice(0, 10);

interface Filters {
  q: string;
  range: 'week' | 'today';
  status: string;
  role: '' | 'WORKER' | 'SUPERVISOR';
}

const EMPTY: Filters = { q: '', range: 'week', status: 'PENDING', role: '' };

export function ApprovalsInbox({ mode = 'admin' }: { mode?: 'admin' | 'supervisor' | 'finance' } = {}) {
  const { t, i18n } = useTranslation(['admin', 'common']);
  const lang = i18n.language;

  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [records, setRecords] = useState<TimeRecordResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [openId, setOpenId] = useState<number | null>(null);
  const [cursor, setCursor] = useState(0);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [rowBusy, setRowBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(false);
    try {
      const res = await getTimeRecords({
        status: filters.status || undefined,
        role: filters.role || undefined,
        dateFrom: filters.range === 'today' ? today() : mondayOfWeek(),
        dateTo: today(),
        page: 0,
        size: 100,
      });
      setRecords(res.content);
    } catch {
      setError(true); setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [filters.status, filters.role, filters.range]);

  useEffect(() => { load(); }, [load]);

  // Client-side text search (the endpoint has no q param).
  const visible = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    if (!q) return records;
    return records.filter(r =>
      (r.workerName ?? '').toLowerCase().includes(q) ||
      r.workerUsername.toLowerCase().includes(q) ||
      r.projectName.toLowerCase().includes(q));
  }, [records, filters.q]);

  const withAlerts = useMemo(() => visible.filter(r => alertsFor(r).length > 0), [visible]);
  const clean = useMemo(
    () => visible.filter(r => r.approvalStatus === 'PENDING' && alertsFor(r).length === 0),
    [visible],
  );
  const pendingCount = visible.filter(r => r.approvalStatus === 'PENDING').length;
  const pendingHours = visible
    .filter(r => r.approvalStatus === 'PENDING')
    .reduce((sum, r) => sum + dayHours(r), 0);

  // Group by work date, most recent first.
  const groups = useMemo(() => {
    const byDay = new Map<string, TimeRecordResponse[]>();
    for (const r of visible) {
      const list = byDay.get(r.workDate) ?? [];
      list.push(r);
      byDay.set(r.workDate, list);
    }
    return [...byDay.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([date, rows]) => ({
        date,
        label: new Date(`${date}T00:00:00`).toLocaleDateString(lang.startsWith('es') ? 'es-GT' : 'en-US',
          { weekday: 'long', day: '2-digit', month: 'short' }).replace(/\./g, '').toUpperCase(),
        rows,
      }));
  }, [visible, lang]);

  const flat = useMemo(() => groups.flatMap(g => g.rows), [groups]);

  function toggle(id: number) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function approveOne(id: number) {
    setRowBusy(id);
    try { await approveRecord(id); await load(); setSelected(p => { const n = new Set(p); n.delete(id); return n; }); }
    catch { /* stays in the list */ }
    finally { setRowBusy(null); }
  }

  async function approveBulk() {
    setBulkBusy(true);
    const ids = [...selected];
    await Promise.allSettled(ids.map(id => approveRecord(id)));
    setSelected(new Set());
    await load();
    setBulkBusy(false);
  }

  // Keyboard: J/K move, X select, A approve, Enter open.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (openId !== null) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const rec = flat[cursor];
      if (e.key === 'j' || e.key === 'J') { e.preventDefault(); setCursor(c => Math.min(flat.length - 1, c + 1)); }
      else if (e.key === 'k' || e.key === 'K') { e.preventDefault(); setCursor(c => Math.max(0, c - 1)); }
      else if (e.key === 'x' || e.key === 'X') { if (rec) { e.preventDefault(); toggle(rec.id); } }
      else if (e.key === 'a' || e.key === 'A') { if (rec?.approvalStatus === 'PENDING') { e.preventDefault(); approveOne(rec.id); } }
      else if (e.key === 'Enter') { if (rec) { e.preventDefault(); setOpenId(rec.id); } }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flat, cursor, openId]);

  const selectedHours = flat.filter(r => selected.has(r.id)).reduce((s, r) => s + dayHours(r), 0);

  function setF<K extends keyof Filters>(k: K, v: Filters[K]) {
    setFilters(f => ({ ...f, [k]: v }));
    setSelected(new Set());
    setCursor(0);
  }

  return (
    <div className="relative p-4 md:p-6 max-w-[1400px] mx-auto space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <Mono className="text-[11px] tracking-[0.15em] text-[#71717A]">{t('admin:apr.kicker')}</Mono>
          <h2 className="font-bt-display font-bold uppercase text-4xl md:text-5xl leading-none text-[#0A0A0A] mt-1">
            {t('admin:apr.title')}
          </h2>
          <Mono className="block text-[12.5px] tracking-[0.06em] normal-case text-[#5A5346] mt-2">
            {t('admin:apr.summary', { count: pendingCount })}
            {withAlerts.length > 0 && <span className="text-[#EA580C]"> · {t('admin:apr.summaryAlerts', { count: withAlerts.length })}</span>}
          </Mono>
        </div>
        <Mono className="text-[10px] tracking-[0.1em] text-[#A69C8D] flex-shrink-0">{t('admin:apr.motto')}</Mono>
      </div>

      {/* Indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-3 bg-white border border-[#E4E4E7]">
        <div className="p-4 md:px-5 sm:border-r border-[#EDE7DB]">
          <div className="font-bt-display font-bold text-3xl md:text-4xl leading-none text-[#0A0A0A]">{pendingCount}</div>
          <Mono className="block text-[10.5px] text-[#5A5346] mt-1.5">{t('admin:apr.ind.pending')}</Mono>
        </div>
        <div className={`p-4 md:px-5 sm:border-r border-[#EDE7DB] ${withAlerts.length > 0 ? 'bg-[#F97316]/5' : ''}`}>
          <div className="flex items-center gap-2">
            <span className={`font-bt-display font-bold text-3xl md:text-4xl leading-none ${withAlerts.length > 0 ? 'text-[#F97316]' : 'text-[#0A0A0A]'}`}>
              {withAlerts.length}
            </span>
            {withAlerts.length > 0 && <AlertTriangle className="w-4 h-4 text-[#F97316]" />}
          </div>
          <Mono className="block text-[10.5px] text-[#5A5346] mt-1.5">{t('admin:apr.ind.alerts')}</Mono>
        </div>
        <div className="p-4 md:px-5">
          <div className="flex items-baseline gap-1">
            <span className="font-bt-display font-bold text-3xl md:text-4xl leading-none text-[#0A0A0A]">{pendingHours.toFixed(1)}</span>
            <span className="font-bt-display font-bold text-lg text-[#8A8175]">H</span>
          </div>
          <Mono className="block text-[10.5px] text-[#5A5346] mt-1.5">{t('admin:apr.ind.hours')}</Mono>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-[#E4E4E7] p-3.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[190px] max-w-[280px]">
            <Search className="w-3.5 h-3.5 text-[#A69C8D] absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={filters.q} onChange={e => setF('q', e.target.value)}
              placeholder={t('admin:apr.f.searchPlaceholder')}
              className="w-full border border-[#DBD0BB] bg-[#FAF7F0] py-2 pl-8 pr-3 text-[13px] text-[#0A0A0A] outline-none focus:border-[#F97316]" />
          </div>
          <select value={filters.range} onChange={e => setF('range', e.target.value as Filters['range'])}
            className="appearance-none border border-[#DBD0BB] bg-[#FAF7F0] px-3 py-2 font-bt-mono text-[11px] uppercase tracking-[0.06em] text-[#0A0A0A] cursor-pointer">
            <option value="week">{t('admin:apr.f.thisWeek')}</option>
            <option value="today">{t('admin:apr.f.today')}</option>
          </select>
          <select value={filters.status} onChange={e => setF('status', e.target.value)}
            className="appearance-none border border-[#DBD0BB] bg-[#FAF7F0] px-3 py-2 font-bt-mono text-[11px] uppercase tracking-[0.06em] text-[#0A0A0A] cursor-pointer">
            <option value="PENDING">{t('admin:apr.st.PENDING')}</option>
            <option value="APPROVED">{t('admin:apr.st.APPROVED')}</option>
            <option value="OBSERVED">{t('admin:apr.st.OBSERVED')}</option>
            <option value="REJECTED">{t('admin:apr.st.REJECTED')}</option>
            <option value="">{t('admin:apr.f.allStatus')}</option>
          </select>
          {mode === 'admin' && (
            <select value={filters.role} onChange={e => setF('role', e.target.value as Filters['role'])}
              className="appearance-none border border-[#DBD0BB] bg-[#FAF7F0] px-3 py-2 font-bt-mono text-[11px] uppercase tracking-[0.06em] text-[#0A0A0A] cursor-pointer">
              <option value="">{t('admin:apr.f.allRoles')}</option>
              <option value="WORKER">{t('common:roles.WORKER')}</option>
              <option value="SUPERVISOR">{t('common:roles.SUPERVISOR')}</option>
            </select>
          )}
        </div>
      </div>

      {/* Select-clean + shortcuts */}
      {!loading && clean.length > 0 && (
        <div className="flex items-center justify-between gap-3 flex-wrap -mt-1">
          <button onClick={() => setSelected(new Set(clean.map(r => r.id)))}
            className="inline-flex items-center gap-2 border border-[#DBD0BB] bg-white px-3 py-1.5 font-bt-mono text-[10px] uppercase tracking-[0.06em] font-semibold text-[#0A0A0A] hover:border-[#F97316] hover:text-[#C2410C]">
            <Check className="w-3 h-3" />{t('admin:apr.selectClean', { count: clean.length })}
          </button>
          <div className="hidden md:flex items-center gap-2.5 font-bt-mono text-[9.5px] uppercase tracking-[0.08em] text-[#A69C8D]">
            <span className="text-[#8A8175]">{t('admin:apr.shortcuts')}</span>
            {[['J K', t('admin:apr.sc.move')], ['X', t('admin:apr.sc.select')], ['A', t('admin:apr.sc.approve')], ['↵', t('admin:apr.sc.open')]].map(([k, l]) => (
              <span key={k} className="inline-flex items-center gap-1.5">
                <kbd className="border border-[#DBD0BB] bg-white px-1.5 py-0.5 text-[9.5px] text-[#5A5346]">{k}</kbd>{l}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Queue */}
      <div className="bg-white border border-[#E4E4E7] min-h-[340px]">
        {loading ? (
          <div className="py-1.5">
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className="flex gap-3.5 items-center px-5 py-3.5 border-b border-[#F0EBE1]">
                <div className="w-4 h-4 bg-[#EAE4D8] animate-pulse flex-shrink-0" />
                <div className="w-9 h-9 bg-[#EAE4D8] animate-pulse flex-shrink-0" />
                <div className="flex-1">
                  <div className="w-2/5 h-3 bg-[#EAE4D8] animate-pulse mb-2" />
                  <div className="w-3/5 h-2 bg-[#EAE4D8] animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="py-16 text-center">
            <p className="text-sm text-[#71717A]">{t('admin:apr.error')}</p>
            <button onClick={load} className="mt-3 font-bt-mono text-[10px] uppercase tracking-[0.1em] border border-[#DBD0BB] px-3 py-1.5 hover:border-[#F97316]">
              {t('common:buttons.retry')}
            </button>
          </div>
        ) : visible.length === 0 && filters.status === 'PENDING' ? (
          <div className="py-[74px] px-6 text-center">
            <div className="w-16 h-16 mx-auto bg-[#0A0A0A] flex items-center justify-center">
              <Check className="w-8 h-8 text-[#F97316]" />
            </div>
            <div className="font-bt-display font-bold text-4xl md:text-5xl leading-none text-[#0A0A0A] mt-4">
              {t('admin:apr.emptyBig')}
            </div>
            <p className="font-bt-heading font-bold text-base text-[#5A5346] mt-2">{t('admin:apr.emptySub')}</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="py-[70px] px-6 text-center">
            <div className="font-bt-display font-bold text-4xl leading-none text-[#CDBFA6]">{t('admin:usr.noMatchBig')}</div>
            <p className="font-bt-heading font-bold text-base text-[#0A0A0A] mt-2.5">{t('admin:apr.noMatch')}</p>
          </div>
        ) : (
          groups.map(g => (
            <div key={g.date}>
              <div className="flex items-center gap-3 px-5 py-2.5 bg-[#FBF8F2] border-b border-[#EDE7DB]">
                <Mono className="text-[10.5px] tracking-[0.14em] text-[#8A8175] whitespace-nowrap">{g.label}</Mono>
                <span className="flex-1 h-px bg-[#DED4C2]" />
                <Mono className="text-[9.5px] text-[#B4A992] whitespace-nowrap">
                  {t('admin:apr.dayCount', { count: g.rows.length })}
                </Mono>
              </div>
              {g.rows.map(r => {
                const alerts = alertsFor(r);
                const isSel = selected.has(r.id);
                const idx = flat.findIndex(x => x.id === r.id);
                const isCursor = idx === cursor;
                return (
                  <div key={r.id} onClick={() => setOpenId(r.id)}
                    className="flex gap-3 items-center px-5 py-3 border-b border-[#F0EBE1] cursor-pointer hover:bg-[#FBF8F2] transition-colors"
                    style={{
                      background: isSel ? '#FDF6EF' : isCursor ? '#FBF8F2' : undefined,
                      borderLeft: alerts.length > 0 ? '2px solid #F97316' : isCursor ? '2px solid #0A0A0A' : '2px solid transparent',
                    }}>
                    <span onClick={e => { e.stopPropagation(); toggle(r.id); }}
                      className={`w-4 h-4 flex-shrink-0 border flex items-center justify-center ${isSel ? 'bg-[#0A0A0A] border-[#0A0A0A]' : 'border-[#CDBFA6] bg-white'}`}>
                      {isSel && <Check className="w-3 h-3 text-[#F5F1E8]" />}
                    </span>
                    <span className="w-9 h-9 flex items-center justify-center font-bt-mono text-[11px] font-semibold flex-shrink-0 bg-[#0A0A0A] text-[#F5F1E8]">
                      {initials(r.workerName, r.workerUsername)}
                    </span>
                    <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="text-[15px] font-semibold text-[#0A0A0A]">{r.workerName || r.workerUsername}</span>
                        <Mono className="text-[11px] normal-case tracking-normal text-[#A69C8D]">{r.projectName}</Mono>
                        <Mono className="text-[11px] normal-case tracking-normal font-semibold text-[#0A0A0A]">{dayHours(r).toFixed(1)} h</Mono>
                        {alerts.map(a => (
                          <Mono key={a.key} className="text-[9px] font-semibold tracking-[0.06em] bg-[#F97316] text-[#0A0A0A] px-1.5 py-0.5">
                            {t(`admin:apr.alert.${a.key}`)}
                          </Mono>
                        ))}
                        {r.approvalStatus !== 'PENDING' && (
                          <Mono className={`text-[9px] font-semibold tracking-[0.06em] px-1.5 py-0.5 ${statusPillClass(r.approvalStatus)}`}>
                            {t(`admin:apr.st.${r.approvalStatus}`)}
                          </Mono>
                        )}
                      </div>
                      <Mono className="text-[10.5px] tracking-[0.04em] normal-case text-[#A69C8D] truncate">
                        {sequenceOf(r, lang)}
                        {alerts[0]?.detail && <span className="text-[#EA580C] font-semibold"> · {alerts[0].detail}</span>}
                      </Mono>
                    </div>
                    {r.approvalStatus === 'PENDING' && (
                      <button onClick={e => { e.stopPropagation(); approveOne(r.id); }}
                        disabled={rowBusy === r.id}
                        className="flex-shrink-0 inline-flex items-center gap-1.5 bg-white border border-[#DBD0BB] px-2.5 py-2 font-bt-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-[#0A0A0A] hover:border-[#2E6B34] hover:text-[#2E6B34] disabled:opacity-50">
                        {rowBusy === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        {t('admin:apr.approve')}
                      </button>
                    )}
                    <ChevronRight className="w-4 h-4 text-[#C6BBA6] flex-shrink-0" />
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* Floating bulk bar */}
      {selected.size > 0 && (
        <div className="fixed left-0 right-0 bottom-0 flex justify-center pb-6 pointer-events-none z-[60]">
          <div className="pointer-events-auto flex items-center gap-4 bg-[#0A0A0A] text-[#F5F1E8] pl-5 pr-4 py-3 shadow-2xl">
            <div className="flex items-center gap-2.5">
              <span className="font-bt-display font-bold text-2xl leading-none text-[#F97316]">{selected.size}</span>
              <div className="leading-tight">
                <Mono className="block text-[10px] text-[#F5F1E8]">{t('admin:apr.selected')}</Mono>
                <Mono className="block text-[9.5px] tracking-[0.06em] text-[#F5F1E8]/60">
                  {t('admin:apr.selectedHours', { hours: selectedHours.toFixed(1) })}
                </Mono>
              </div>
            </div>
            <span className="w-px h-7 bg-[#F5F1E8]/20" />
            <button onClick={() => setSelected(new Set())}
              className="font-bt-mono text-[10px] uppercase tracking-[0.08em] text-[#F5F1E8]/70 hover:text-[#F97316]">
              {t('admin:apr.clearSel')}
            </button>
            <button onClick={approveBulk} disabled={bulkBusy}
              className="inline-flex items-center gap-2 bg-[#F97316] hover:bg-[#F5F1E8] text-[#0A0A0A] px-4 py-2.5 font-bt-mono text-[11px] font-semibold uppercase tracking-[0.07em] disabled:opacity-60">
              {bulkBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {t('admin:apr.approveBulk', { count: selected.size })}
            </button>
          </div>
        </div>
      )}

      {openId !== null && (
        <RecordDrawer
          recordId={openId}
          onClose={() => setOpenId(null)}
          onChanged={() => { setOpenId(null); load(); }}
        />
      )}
    </div>
  );
}
