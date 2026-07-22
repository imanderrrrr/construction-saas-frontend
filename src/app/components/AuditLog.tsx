import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { searchAuditLogs, type AuditLogDTO, type AuditOutcome } from '../services/audit';
import { fmtDateTime } from '../helpers/dateTime';

/**
 * Bitácora (audit log) — the trust surface, in the dashboard's industrial
 * language: ink header, IBM Plex Mono labels, human two-line rows, a per-event
 * drawer with the technical chain + JSON payload on ink. Same filters and
 * pagination as before, re-presented; data comes from searchAuditLogs.
 */

type Category = 'auth' | 'project' | 'time' | 'expense' | 'budget' | 'tool' | 'consumable' | 'finance' | 'report';

/** action → category, so the category filter maps to a set of actions. */
const ACTION_CATEGORY: Record<string, Category> = {
  LOGIN_SUCCESS: 'auth', LOGIN_FAILED: 'auth', LOGIN_FAILURE: 'auth', LOGOUT: 'auth',
  TOKEN_REFRESH: 'auth', ACCESS_DENIED: 'auth', PASSWORD_CHANGED: 'auth', PASSWORD_RESET: 'auth',
  PASSWORD_RESET_CONFIRMED: 'auth', ACCOUNT_SETUP_LINK_ISSUED: 'auth', TENANT_PROVISIONED: 'auth',
  USER_CREATED: 'auth', USER_UPDATED: 'auth', USER_STATUS_CHANGED: 'auth', USER_CREATE: 'auth',
  USER_UPDATE: 'auth', USER_DISABLE: 'auth', USER_DELETE: 'auth', USER_PASSWORD_RESET: 'auth',
  ROLE_CHANGED: 'auth', USER_ROLE_CHANGED: 'auth',
  PROJECT_CREATED: 'project', PROJECT_UPDATED: 'project', PROJECT_DELETED: 'project',
  PROJECT_CLOSED: 'project', PROJECT_GEOFENCE_UPDATED: 'project', PROJECT_ASSIGNMENTS_UPDATED: 'project',
  PUNCH_CLOSED: 'project', PUNCH_CREATED: 'project', RFI_ANSWERED: 'project', RFI_CREATED: 'project',
  DAILYLOG_CREATED: 'project',
  TIME_CHECK_IN: 'time', TIME_CHECK_OUT: 'time', TIME_LUNCH_START: 'time', TIME_LUNCH_END: 'time',
  TIME_ENTRY_APPROVED: 'time', TIME_ENTRY_REJECTED: 'time', TIME_ENTRY_CORRECTED: 'time',
  TIME_EVENT_APPROVED: 'time', TIME_EVENT_REJECTED: 'time', TIME_EVENT_CORRECTED: 'time',
  TIME_RECORD_APPROVED: 'time', TIME_RECORD_REJECTED: 'time', TIME_SUBMITTED: 'time', TIME_APPROVED: 'time',
  EXPENSE_CREATED: 'expense', EXPENSE_APPROVED: 'expense', EXPENSE_REJECTED: 'expense',
  EXPENSE_OBSERVED: 'expense', EXPENSE_CORRECTED: 'expense', EXPENSE_SUBMITTED: 'expense',
  BUDGET_CREATED: 'budget', BUDGET_UPDATED: 'budget', BUDGET_LINE_ADDED: 'budget',
  BUDGET_THRESHOLD_UPDATED: 'budget', BUDGET_ADJUSTED: 'budget',
  TOOL_CREATED: 'tool', TOOL_ASSIGNED: 'tool', TOOL_RETURNED: 'tool', TOOL_STATUS_CHANGED: 'tool',
  TOOL_TRANSFERRED: 'tool', TOOL_DECOMMISSIONED: 'tool',
  CONSUMABLE_ENTRY: 'consumable', CONSUMABLE_DISPATCH: 'consumable',
  CONSUMABLE_ADJUSTMENT: 'consumable', CONSUMABLE_CATALOG_UPDATED: 'consumable',
  INVOICE_CREATED: 'finance', INVOICE_UPDATED: 'finance', INVOICE_PAID: 'finance', INVOICE_ISSUED: 'finance',
  BILL_CREATED: 'finance', BILL_PAID: 'finance', PAYMENT_RECORDED: 'finance',
  RECEIVABLE_CREATED: 'finance', RECEIVABLE_PAYMENT_RECORDED: 'finance', PAYABLE_CREATED: 'finance',
  PAYABLE_PAYMENT_RECORDED: 'finance', PAYABLE_SCHEDULED: 'finance', CHANGE_ORDER_CREATED: 'finance',
  REPORT_EXPORTED: 'report', BACKUP_COMPLETED: 'report', SETTINGS_UPDATED: 'report',
};

const CATEGORIES: Category[] = ['auth', 'project', 'time', 'expense', 'budget', 'tool', 'consumable', 'finance', 'report'];

/** Result bucket for the row pill: SUCCESS → OK (no pill); a denied action → DENIED; other failures → FAILURE. */
function resultBucket(outcome: AuditOutcome, action: string): 'ok' | 'denied' | 'failure' {
  if (outcome === 'SUCCESS') return 'ok';
  return action.includes('DENIED') ? 'denied' : 'failure';
}

/** Entities that add nothing as a row object (the verb already says it). */
const HOLLOW_ENTITIES = new Set(['AUTH', 'SESSION', 'SESIÓN', 'SESION']);

/**
 * Short object shown after the verb. The backend `message` is a full English
 * sentence (its own i18n concern) and often duplicates the Spanish verb, so
 * the row stays clean — verb + entity — and the message is reserved for the
 * drawer.
 */
function rowObject(ev: AuditLogDTO): string {
  if (ev.entityType && !HOLLOW_ENTITIES.has(ev.entityType)) {
    return `${ev.entityType}${ev.entityId ? ` ${ev.entityId}` : ''}`;
  }
  return '';
}

const GRID_BG: React.CSSProperties = {
  backgroundImage:
    'linear-gradient(rgba(245,241,232,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(245,241,232,0.05) 1px, transparent 1px)',
  backgroundSize: '24px 24px',
};

function Mono({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <span className={`font-bt-mono uppercase tracking-[0.1em] ${className}`}>{children}</span>;
}

const PAGE_SIZES = [10, 20, 50] as const;

interface Filters {
  period: '7d' | 'today';
  actor: string;
  category: '' | Category;
  action: string;
  outcome: '' | AuditOutcome;
}

const EMPTY: Filters = { period: '7d', actor: '', category: '', action: '', outcome: '' };

export function AuditLog() {
  const { t, i18n } = useTranslation(['admin']);
  const lang = i18n.language;

  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState<number>(20);
  const [rows, setRows] = useState<AuditLogDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [stats, setStats] = useState<{ access: number; alerts: number; events: number } | null>(null);
  const [open, setOpen] = useState<AuditLogDTO | null>(null);

  const dayStartISO = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  };

  // Category → the set of actions the API should filter on (comma-separated).
  const actionsForQuery = useMemo<string | undefined>(() => {
    if (filters.action) return filters.action;
    if (filters.category) {
      return Object.entries(ACTION_CATEGORY).filter(([, c]) => c === filters.category).map(([a]) => a).join(',');
    }
    return undefined;
  }, [filters.action, filters.category]);

  const load = useCallback(async () => {
    setLoading(true); setError(false);
    const dateFrom = filters.period === 'today' ? dayStartISO(0) : dayStartISO(7);
    try {
      const res = await searchAuditLogs({
        page, size,
        actions: actionsForQuery,
        actor: filters.actor || undefined,
        outcome: filters.outcome || undefined,
        dateFrom,
      });
      setRows(res.content);
      setTotal(res.totalElements);
    } catch {
      setError(true); setRows([]); setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, size, actionsForQuery, filters.actor, filters.outcome, filters.period]);

  useEffect(() => { load(); }, [load]);

  // Actionable indicators — small independent counts (dashboard style).
  useEffect(() => {
    const today = dayStartISO(0);
    Promise.allSettled([
      searchAuditLogs({ actions: 'LOGIN_SUCCESS', dateFrom: today, page: 0, size: 1 }),
      searchAuditLogs({ outcome: 'FAILURE', dateFrom: dayStartISO(7), page: 0, size: 1 }),
      searchAuditLogs({ dateFrom: today, page: 0, size: 1 }),
    ]).then(([a, b, c]) => {
      setStats({
        access: a.status === 'fulfilled' ? a.value.totalElements : 0,
        alerts: b.status === 'fulfilled' ? b.value.totalElements : 0,
        events: c.status === 'fulfilled' ? c.value.totalElements : 0,
      });
    });
  }, []);

  function setF<K extends keyof Filters>(k: K, v: Filters[K]) {
    setFilters(f => ({ ...f, [k]: v, ...(k === 'category' ? { action: '' } : {}) }));
    setPage(0);
  }
  function clear() { setFilters(f => ({ ...EMPTY, period: f.period })); setPage(0); }

  // Verb for an action, humanized. Reuses the dashboard's dash.act.* map,
  // falls back to an audit.act.* entry, then to a de-slugged code.
  function verb(action: string): string {
    if (i18n.exists(`admin:audit.act.${action}`)) return t(`admin:audit.act.${action}`);
    if (i18n.exists(`admin:dash.act.${action}`)) return t(`admin:dash.act.${action}`);
    return action.toLowerCase().replace(/_/g, ' ');
  }

  const actionOptions = useMemo(() => {
    const inCat = Object.entries(ACTION_CATEGORY)
      .filter(([, c]) => !filters.category || c === filters.category)
      .map(([a]) => a);
    return [...new Set(inCat)].sort();
  }, [filters.category]);

  const chips = useMemo(() => {
    const out: { key: keyof Filters; label: string }[] = [];
    if (filters.actor) out.push({ key: 'actor', label: `${t('admin:audit.f.person')} · ${filters.actor}` });
    if (filters.category) out.push({ key: 'category', label: `${t('admin:audit.f.category')} · ${t(`admin:audit.cat.${filters.category}`)}` });
    if (filters.action) out.push({ key: 'action', label: `${t('admin:audit.f.action')} · ${verb(filters.action)}` });
    if (filters.outcome) out.push({ key: 'outcome', label: `${t('admin:audit.f.result')} · ${t(`admin:audit.res.${filters.outcome}`)}` });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, lang]);

  // Group the current page's rows by calendar day.
  const groups = useMemo(() => {
    const byDay = new Map<string, AuditLogDTO[]>();
    for (const r of rows) {
      const key = new Date(r.occurredAt).toDateString();
      (byDay.get(key) ?? byDay.set(key, []).get(key)!).push(r);
    }
    return [...byDay.entries()].map(([key, evs]) => ({
      label: new Date(key).toLocaleDateString(lang.startsWith('es') ? 'es-GT' : 'en-US',
        { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' }).replace(/\./g, '').toUpperCase(),
      count: t('admin:audit.eventsCount', { count: evs.length }),
      events: evs,
    }));
  }, [rows, lang, t]);

  const pages = Math.max(1, Math.ceil(total / size));
  const actors = useMemo(() => [...new Set(rows.map(r => r.actorUsername).filter(Boolean))].sort(), [rows]);

  return (
    <div className="relative p-4 md:p-6 max-w-[1400px] mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <Mono className="text-[11px] tracking-[0.15em] text-[#71717A]">{t('admin:audit.kicker')}</Mono>
          <h2 className="font-bt-display font-bold uppercase text-4xl md:text-5xl leading-none text-[#0A0A0A] mt-1">
            {t('admin:audit.title')}
          </h2>
          <p className="text-sm text-[#52525B] mt-1.5">{t('admin:audit.subtitle')}</p>
        </div>
        <Mono className="text-[10px] tracking-[0.12em] text-[#A1A1AA]">{t('admin:audit.immutable')}</Mono>
      </div>

      {/* Indicators */}
      <div className="grid grid-cols-3 bg-white border border-[#E4E4E7]">
        {[
          { n: stats?.access, label: t('admin:audit.stat.access'), alert: false },
          { n: stats?.alerts, label: t('admin:audit.stat.alerts'), alert: (stats?.alerts ?? 0) > 0 },
          { n: stats?.events, label: t('admin:audit.stat.events'), alert: false },
        ].map((s, i) => (
          <div key={i} className={`p-4 md:px-5 ${i < 2 ? 'border-r border-[#EDE7DB]' : ''} ${s.alert ? 'bg-[#F97316]/5' : ''}`}>
            <div className="flex items-center gap-2">
              <span className={`font-bt-display font-bold text-3xl md:text-4xl leading-none ${s.alert ? 'text-[#F97316]' : 'text-[#0A0A0A]'}`}>
                {s.n ?? '—'}
              </span>
              {s.alert && <AlertTriangle className="w-4 h-4 text-[#F97316]" />}
            </div>
            <Mono className="block text-[10px] text-[#5A5346] mt-1.5">{s.label}</Mono>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white border border-[#E4E4E7] p-3.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <Mono className="text-[10px] text-[#8A8175]">{t('admin:audit.f.filter')}</Mono>
          <SelectF value={filters.period} onChange={v => setF('period', v as Filters['period'])}
            options={[['7d', t('admin:audit.f.last7')], ['today', t('admin:audit.f.today')]]} />
          <SelectF value={filters.actor} onChange={v => setF('actor', v)}
            options={[['', t('admin:audit.f.allPeople')], ...actors.map(a => [a, a] as [string, string])]} />
          <SelectF value={filters.category} onChange={v => setF('category', v as Filters['category'])}
            options={[['', t('admin:audit.f.allCats')], ...CATEGORIES.map(c => [c, t(`admin:audit.cat.${c}`)] as [string, string])]} />
          <SelectF value={filters.action} onChange={v => setF('action', v)}
            options={[['', t('admin:audit.f.allActions')], ...actionOptions.map(a => [a, verb(a)] as [string, string])]} />
          <SelectF value={filters.outcome} onChange={v => setF('outcome', v as Filters['outcome'])}
            options={[['', t('admin:audit.f.allResults')], ['SUCCESS', t('admin:audit.res.SUCCESS')], ['FAILURE', t('admin:audit.res.FAILURE')]]} />
          {chips.length > 0 && (
            <button onClick={clear} className="ml-auto font-bt-mono text-[10px] uppercase tracking-[0.1em] font-semibold text-[#C2410C] hover:text-[#F97316]">
              {t('admin:audit.f.clear')} ✕
            </button>
          )}
        </div>
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-[#EDE7DB]">
            {chips.map(ch => (
              <button key={ch.key} onClick={() => setF(ch.key, (ch.key === 'category' || ch.key === 'action' || ch.key === 'outcome' ? '' : '') as never)}
                className="inline-flex items-center gap-2 border border-[#DBD0BB] bg-[#F3EEE4] px-2.5 py-1 font-bt-mono text-[10px] uppercase tracking-[0.06em] text-[#0A0A0A] hover:border-[#F97316]">
                {ch.label} <span className="text-[#8A8175]">✕</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* List */}
      <div className="bg-white border border-[#E4E4E7] min-h-[320px]">
        {loading ? (
          <div className="py-2">
            {[0, 1, 2, 3, 4, 5].map(i => (
              <div key={i} className="px-5 py-3 border-b border-[#F0EBE1]">
                <div className="w-1/2 h-3 bg-[#EAE4D8] animate-pulse mb-2" />
                <div className="w-1/4 h-2 bg-[#EAE4D8] animate-pulse" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="py-16 text-center">
            <p className="text-sm text-[#71717A]">{t('admin:audit.error')}</p>
            <button onClick={load} className="mt-3 font-bt-mono text-[10px] uppercase tracking-[0.1em] border border-[#DBD0BB] px-3 py-1.5 hover:border-[#F97316]">
              {t('common:buttons.retry')}
            </button>
          </div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center">
            <div className="font-bt-display font-bold text-4xl text-[#CDBFA6]">{t('admin:audit.emptyBig')}</div>
            <p className="font-bt-heading font-bold text-base text-[#0A0A0A] mt-2.5">{t('admin:audit.emptyTitle')}</p>
            <p className="text-sm text-[#8A8175] mt-1">{t('admin:audit.emptyHint')}</p>
            {chips.length > 0 && (
              <button onClick={clear} className="mt-4 font-bt-mono text-[10px] uppercase tracking-[0.1em] border border-[#DBD0BB] px-3 py-2 hover:border-[#F97316]">
                {t('admin:audit.f.clearAll')}
              </button>
            )}
          </div>
        ) : (
          groups.map(g => (
            <div key={g.label}>
              <div className="flex items-center gap-3 px-5 py-2.5 bg-[#FBF8F2] border-b border-[#EDE7DB]">
                <Mono className="text-[10px] tracking-[0.14em] text-[#8A8175] whitespace-nowrap">{g.label}</Mono>
                <span className="flex-1 h-px bg-[#DED4C2]" />
                <Mono className="text-[9px] text-[#B4A992] whitespace-nowrap">{g.count}</Mono>
              </div>
              {g.events.map(ev => {
                const bucket = resultBucket(ev.outcome, ev.action);
                return (
                  <button key={ev.id} onClick={() => setOpen(ev)}
                    className="w-full text-left px-5 py-3 border-b border-[#F0EBE1] hover:bg-[#FBF8F2] transition-colors"
                    style={{ borderLeft: bucket !== 'ok' ? '2px solid #F97316' : '2px solid transparent' }}>
                    <div className="flex items-baseline gap-3.5">
                      <Mono className="text-[12px] tracking-normal normal-case text-[#A69C8D] w-11 flex-shrink-0">
                        {fmtDateTime(ev.occurredAt, lang).split(',').pop()?.trim()}
                      </Mono>
                      <span className="flex-1 min-w-0 text-[13.5px] leading-snug text-[#2E2A24]">
                        <b className="text-[#0A0A0A] font-semibold">{ev.actorUsername || '—'}</b>{' '}
                        {ev.actorRole && <Mono className="text-[10px] tracking-[0.04em] normal-case text-[#A69C8D]">({ev.actorRole})</Mono>}{' '}
                        {verb(ev.action)}{' '}
                        <span className="text-[#0A0A0A]">{rowObject(ev)}</span>
                      </span>
                      {bucket !== 'ok' && (
                        <Mono className="flex-shrink-0 text-[9px] font-semibold tracking-[0.08em] bg-[#F97316] text-[#0A0A0A] px-1.5 py-0.5">
                          {t(`admin:audit.bucket.${bucket}`)}
                        </Mono>
                      )}
                    </div>
                    <Mono className="text-[10px] tracking-[0.04em] normal-case text-[#A69C8D] mt-1.5 ml-[56px] block truncate">
                      {[ev.entityType && `${ev.entityType}${ev.entityId ? ` ${ev.entityId}` : ''}`, ev.ipAddress, ev.httpMethod && `${ev.httpMethod} ${ev.httpPath ?? ''}`]
                        .filter(Boolean).join(' · ')}
                    </Mono>
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {!loading && !error && rows.length > 0 && (
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Mono className="text-[10px] tracking-[0.06em] text-[#8A8175]">
            {t('admin:audit.showing', { from: page * size + 1, to: Math.min((page + 1) * size, total), total })}
          </Mono>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Mono className="text-[10px] text-[#8A8175]">{t('admin:audit.perPage')}</Mono>
              <select value={size} onChange={e => { setSize(Number(e.target.value)); setPage(0); }}
                className="border border-[#DBD0BB] bg-[#FAF7F0] px-2 py-1 font-bt-mono text-[11px] text-[#0A0A0A]">
                {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="w-7 h-7 border border-[#DBD0BB] bg-[#FAF7F0] flex items-center justify-center disabled:opacity-40 hover:border-[#F97316]">
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <Mono className="text-[11px] tracking-[0.06em] text-[#0A0A0A] min-w-[80px] text-center">
                {t('admin:audit.pageOf', { page: page + 1, pages })}
              </Mono>
              <button onClick={() => setPage(p => (p + 1 < pages ? p + 1 : p))} disabled={page + 1 >= pages}
                className="w-7 h-7 border border-[#DBD0BB] bg-[#FAF7F0] flex items-center justify-center disabled:opacity-40 hover:border-[#F97316]">
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {open && <EventDrawer event={open} onClose={() => setOpen(null)} verb={verb} lang={lang} />}
    </div>
  );
}

function SelectF({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="appearance-none border border-[#DBD0BB] bg-[#FAF7F0] px-3 py-2 font-bt-mono text-[11px] uppercase tracking-[0.05em] text-[#0A0A0A] cursor-pointer max-w-[210px]">
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

function EventDrawer({ event, onClose, verb, lang }: {
  event: AuditLogDTO; onClose: () => void; verb: (a: string) => string; lang: string;
}) {
  const { t } = useTranslation(['admin']);
  const scrimRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const bucket = resultBucket(event.outcome, event.action);
  const prettyJson = (() => {
    if (!event.payloadJson) return null;
    try { return JSON.stringify(JSON.parse(event.payloadJson), null, 2); } catch { return event.payloadJson; }
  })();

  return (
    <div className="fixed inset-0 z-[80]">
      <div ref={scrimRef} onClick={onClose} className="absolute inset-0 bg-[#0B0A09]/40" />
      <aside className="absolute top-0 right-0 bottom-0 w-[452px] max-w-[90%] bg-white border-l border-[#CDBFA6] shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E4E4E7] flex-shrink-0">
          <Mono className="text-[11px] tracking-[0.15em] text-[#5A5346]">{t('admin:audit.detail.title')}</Mono>
          <button onClick={onClose} className="w-7 h-7 border border-[#E4E4E7] bg-[#FAF7F0] flex items-center justify-center hover:border-[#F97316]">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <Mono className="text-[10px] text-[#8A8175]">{fmtDateTime(event.occurredAt, lang)}</Mono>
          <p className="text-lg leading-snug text-[#0A0A0A] mt-2">
            <b className="font-semibold">{event.actorUsername || '—'}</b> {verb(event.action)}{' '}
            <span>{rowObject(event)}</span>
          </p>
          <div className="flex flex-wrap gap-2 mt-3.5">
            <Mono className="text-[10px] bg-[#F3EEE4] text-[#5A5346] px-2 py-1">{event.actorRole ? `${t('admin:audit.detail.role')} ${event.actorRole}` : t('admin:audit.detail.roleUnknown')}</Mono>
            <Mono className="text-[10px] bg-[#F3EEE4] text-[#5A5346] px-2 py-1">{t(`admin:audit.cat.${ACTION_CATEGORY[event.action] ?? 'auth'}`)}</Mono>
            <Mono className={`text-[10px] px-2 py-1 ${bucket === 'ok' ? 'bg-[#E8F0E5] text-[#2E6B34]' : 'bg-[#F97316] text-[#0B0A09]'}`}>
              {bucket === 'ok' ? t('admin:audit.res.SUCCESS') : t(`admin:audit.bucket.${bucket}`)}
            </Mono>
          </div>
          {event.message && (
            bucket === 'ok' ? (
              <div className="mt-3.5 bg-[#F3EEE4] px-3 py-2.5">
                <span className="text-[12.5px] text-[#3F3F46] leading-snug">{event.message}</span>
              </div>
            ) : (
              <div className="mt-3.5 flex gap-2.5 items-start bg-[#FBEDE0] border-l-[3px] border-[#F97316] px-3 py-2.5">
                <AlertTriangle className="w-3.5 h-3.5 text-[#EA580C] flex-shrink-0 mt-0.5" />
                <span className="text-[12.5px] text-[#43301F] leading-snug">{event.message}</span>
              </div>
            )
          )}
          <Mono className="block text-[10px] tracking-[0.12em] text-[#8A8175] mt-5 mb-2.5">{t('admin:audit.detail.chain')}</Mono>
          <div className="border border-[#E4E4E7]">
            {([
              ['audit.detail.code', event.action],
              ['audit.detail.entity', event.entityType ? `${event.entityType}${event.entityId ? ` · ${event.entityId}` : ''}` : '—'],
              ['audit.detail.ip', event.ipAddress || '—'],
              ['audit.detail.route', event.httpMethod ? `${event.httpMethod} ${event.httpPath ?? ''}` : '—'],
              ['audit.detail.agent', event.userAgent || '—'],
              ['audit.detail.corr', event.correlationId || '—'],
            ] as [string, string][]).map(([k, v], i, arr) => (
              <div key={k} className={`grid grid-cols-[96px_1fr] gap-2.5 px-3 py-2.5 ${i < arr.length - 1 ? 'border-b border-[#F0EBE1]' : ''}`}>
                <Mono className="text-[10px] normal-case tracking-[0.06em] text-[#A69C8D]">{t(`admin:${k}`)}</Mono>
                <span className="font-bt-mono text-[11px] text-[#0A0A0A] break-all">{v}</span>
              </div>
            ))}
          </div>
          {prettyJson && (
            <>
              <Mono className="block text-[10px] tracking-[0.12em] text-[#8A8175] mt-5 mb-2.5">{t('admin:audit.detail.payload')}</Mono>
              <div className="relative bg-[#0B0A09] p-4 overflow-hidden">
                <div className="absolute inset-0 pointer-events-none" style={GRID_BG} />
                <pre className="relative m-0 font-bt-mono text-[11.5px] leading-relaxed text-[#F5F1E8] whitespace-pre-wrap break-words">{prettyJson}</pre>
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
