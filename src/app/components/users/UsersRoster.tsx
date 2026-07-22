import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react';
import {
  listUsers, getWorkerQr, type UserDTO,
} from '../../services/users';
import { AuthService } from '../../services/auth';
import { UserDrawer } from './UserDrawer';
import { NewUserFlow } from './NewUserFlow';
import { FIELD_ROLES, isFieldRole, Mono, initials, type AccessKind } from './shared';

/**
 * Usuarios — the roster, in the dashboard's industrial language.
 *
 * The screen's opinion: a worker without a PIN cannot enter the app at all, so
 * that is the one thing it shouts about (indicator + banner + row pill + a
 * one-click fix). It also separates the two ways in — field crews scan a QR and
 * type a PIN on the phone; office staff sign in with user + password on the web
 * — because the old table hid that distinction entirely.
 */

const PAGE_SIZES = [10, 20, 50] as const;

interface Filters {
  q: string;
  access: '' | AccessKind;
  role: string;
  status: '' | 'ACTIVE' | 'INACTIVE';
}

const EMPTY: Filters = { q: '', access: '', role: '', status: '' };

const ALL_ROLES = ['ADMIN', 'FINANCE', 'WAREHOUSE', 'SUPERVISOR', 'WORKER', 'SUBCONTRACTOR'] as const;

export function UsersRoster() {
  const { t, i18n } = useTranslation(['admin', 'common', 'users']);
  const lang = i18n.language;
  const me = AuthService.getUsername();

  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [debouncedQ, setDebouncedQ] = useState('');
  const [page, setPage] = useState(0);
  const [size, setSize] = useState<number>(20);
  const [rows, setRows] = useState<UserDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  /** userId → has a PIN set. Loaded per page for field-role users only. */
  const [pinMap, setPinMap] = useState<Record<number, boolean>>({});
  const [openUser, setOpenUser] = useState<UserDTO | null>(null);
  const [newFlowOpen, setNewFlowOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const id = setTimeout(() => { setDebouncedQ(filters.q); setPage(0); }, 300);
    return () => clearTimeout(id);
  }, [filters.q]);

  const load = useCallback(async () => {
    setLoading(true); setError(false);
    try {
      const res = await listUsers({
        page, size,
        search: debouncedQ || undefined,
        role: filters.role || undefined,
        status: filters.status || undefined,
      });
      setRows(res.content);
      setTotal(res.totalElements);

      // Credential status for the field-role users on this page. Best-effort:
      // a failure just leaves that user's PIN state unknown.
      const field = res.content.filter(u => isFieldRole(u.role));
      const results = await Promise.allSettled(field.map(u => getWorkerQr(u.id)));
      const map: Record<number, boolean> = {};
      results.forEach((r, i) => { if (r.status === 'fulfilled') map[field[i].id] = r.value.hasPin; });
      setPinMap(map);
    } catch {
      setError(true); setRows([]); setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, size, debouncedQ, filters.role, filters.status, reloadKey]);

  useEffect(() => { load(); }, [load]);

  function setF<K extends keyof Filters>(k: K, v: Filters[K]) {
    setFilters(f => ({ ...f, [k]: v }));
    if (k !== 'q') setPage(0);
  }
  const clear = () => { setFilters(EMPTY); setPage(0); };

  const accessOf = (u: UserDTO): AccessKind => (isFieldRole(u.role) ? 'FIELD' : 'OFFICE');

  // Client-side access filter (the API has no such concept — it's a role split).
  const visible = useMemo(
    () => rows.filter(u => !filters.access || accessOf(u) === filters.access),
    [rows, filters.access],
  );

  const fieldRows = rows.filter(u => isFieldRole(u.role));
  const noPin = fieldRows.filter(u => pinMap[u.id] === false);
  const activeCount = rows.filter(u => u.status === 'ACTIVE').length;

  const groups = useMemo(() => {
    const field = visible.filter(u => accessOf(u) === 'FIELD');
    const office = visible.filter(u => accessOf(u) === 'OFFICE');
    return [
      { kind: 'FIELD' as const, users: field },
      { kind: 'OFFICE' as const, users: office },
    ].filter(g => g.users.length > 0);
  }, [visible]);

  const chips = useMemo(() => {
    const out: { key: keyof Filters; label: string }[] = [];
    if (debouncedQ) out.push({ key: 'q', label: `${t('admin:usr.f.search')} · ${debouncedQ}` });
    if (filters.access) out.push({ key: 'access', label: `${t('admin:usr.f.access')} · ${t(`admin:usr.access.${filters.access}`)}` });
    if (filters.role) out.push({ key: 'role', label: `${t('admin:usr.f.role')} · ${t(`common:roles.${filters.role}`)}` });
    if (filters.status) out.push({ key: 'status', label: `${t('admin:usr.f.status')} · ${t(`admin:usr.st.${filters.status}`)}` });
    return out;
  }, [debouncedQ, filters, t, lang]);

  const pages = Math.max(1, Math.ceil(total / size));

  return (
    <div className="relative p-4 md:p-6 max-w-[1400px] mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <Mono className="text-[11px] tracking-[0.15em] text-[#71717A]">{t('admin:usr.kicker')}</Mono>
          <h2 className="font-bt-display font-bold uppercase text-4xl md:text-5xl leading-none text-[#0A0A0A] mt-1">
            {t('admin:usr.title')}
          </h2>
          <Mono className="block text-[12.5px] tracking-[0.06em] normal-case text-[#5A5346] mt-2">
            {t('admin:usr.summary', { total, active: activeCount })}
            {noPin.length > 0 && <span className="text-[#EA580C]"> · {t('admin:usr.summaryNoPin', { count: noPin.length })}</span>}
          </Mono>
        </div>
        <button onClick={() => setNewFlowOpen(true)}
          className="inline-flex items-center gap-2 bg-[#0A0A0A] hover:bg-[#F97316] text-[#F5F1E8] hover:text-[#0A0A0A] font-bt-mono text-[11.5px] font-semibold uppercase tracking-[0.09em] px-4 py-3 transition-colors flex-shrink-0">
          <Plus className="w-3.5 h-3.5" />{t('admin:usr.newUser')}
        </button>
      </div>

      {/* Indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-3 bg-white border border-[#E4E4E7]">
        <div className="p-4 md:px-5 sm:border-r border-[#EDE7DB]">
          <div className="font-bt-display font-bold text-3xl md:text-4xl leading-none text-[#0A0A0A]">{activeCount}</div>
          <Mono className="block text-[10.5px] text-[#5A5346] mt-1.5">{t('admin:usr.ind.active')}</Mono>
        </div>
        <button
          onClick={() => setF('access', filters.access === 'FIELD' ? '' : 'FIELD')}
          className={`p-4 md:px-5 sm:border-r border-[#EDE7DB] text-left transition-colors ${noPin.length > 0 ? 'bg-[#F97316]/5 hover:bg-[#FBEDE0]' : 'hover:bg-[#FAFAFA]'}`}>
          <div className="flex items-center gap-2">
            <span className={`font-bt-display font-bold text-3xl md:text-4xl leading-none ${noPin.length > 0 ? 'text-[#F97316]' : 'text-[#0A0A0A]'}`}>
              {noPin.length}
            </span>
            {noPin.length > 0 && <AlertTriangle className="w-4 h-4 text-[#F97316]" />}
          </div>
          <Mono className="block text-[10.5px] text-[#5A5346] mt-1.5">{t('admin:usr.ind.noPin')}</Mono>
        </button>
        <div className="p-4 md:px-5">
          <div className="font-bt-display font-bold text-3xl md:text-4xl leading-none text-[#0A0A0A]">{fieldRows.length}</div>
          <Mono className="block text-[10.5px] text-[#5A5346] mt-1.5">{t('admin:usr.ind.field')}</Mono>
        </div>
      </div>

      {/* No-PIN banner */}
      {noPin.length > 0 && (
        <div className="bg-[#FBEDE0] border border-[#F6CFA6] border-l-[3px] border-l-[#F97316] p-4">
          <div className="flex gap-3.5 items-start">
            <AlertTriangle className="w-5 h-5 text-[#EA580C] flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-bt-heading font-bold text-base text-[#0A0A0A]">
                {t('admin:usr.banner.title', { count: noPin.length })}
              </p>
              <p className="text-[13.5px] leading-relaxed text-[#43301F] mt-0.5">{t('admin:usr.banner.body')}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                {noPin.slice(0, 6).map(u => (
                  <button key={u.id} onClick={() => setOpenUser(u)}
                    className="inline-flex items-center gap-2.5 border border-[#F6CFA6] bg-white px-2.5 py-1.5 hover:border-[#F97316] transition-colors">
                    <span className="w-5 h-5 bg-[#F97316] text-[#0A0A0A] flex items-center justify-center font-bt-mono text-[9px] font-semibold">
                      {initials(u.fullName, u.username)}
                    </span>
                    <span className="text-[12px] text-[#0A0A0A]">{u.fullName || u.username}</span>
                    <Mono className="text-[10px] text-[#C2410C] font-semibold">{t('admin:usr.banner.fix')} →</Mono>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-[#E4E4E7] p-3.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[200px] max-w-[320px]">
            <Search className="w-3.5 h-3.5 text-[#A69C8D] absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={filters.q} onChange={e => setF('q', e.target.value)}
              placeholder={t('admin:usr.f.searchPlaceholder')}
              className="w-full border border-[#DBD0BB] bg-[#FAF7F0] py-2 pl-8 pr-3 text-[13px] text-[#0A0A0A] outline-none focus:border-[#F97316]" />
          </div>
          <select value={filters.access} onChange={e => setF('access', e.target.value as Filters['access'])}
            className="appearance-none border border-[#DBD0BB] bg-[#FAF7F0] px-3 py-2 font-bt-mono text-[11px] uppercase tracking-[0.06em] text-[#0A0A0A] cursor-pointer">
            <option value="">{t('admin:usr.f.allAccess')}</option>
            <option value="FIELD">{t('admin:usr.access.FIELD')}</option>
            <option value="OFFICE">{t('admin:usr.access.OFFICE')}</option>
          </select>
          <select value={filters.role} onChange={e => setF('role', e.target.value)}
            className="appearance-none border border-[#DBD0BB] bg-[#FAF7F0] px-3 py-2 font-bt-mono text-[11px] uppercase tracking-[0.06em] text-[#0A0A0A] cursor-pointer">
            <option value="">{t('admin:usr.f.allRoles')}</option>
            {ALL_ROLES.map(r => <option key={r} value={r}>{t(`common:roles.${r}`)}</option>)}
          </select>
          <select value={filters.status} onChange={e => setF('status', e.target.value as Filters['status'])}
            className="appearance-none border border-[#DBD0BB] bg-[#FAF7F0] px-3 py-2 font-bt-mono text-[11px] uppercase tracking-[0.06em] text-[#0A0A0A] cursor-pointer">
            <option value="">{t('admin:usr.f.allStatus')}</option>
            <option value="ACTIVE">{t('admin:usr.st.ACTIVE')}</option>
            <option value="INACTIVE">{t('admin:usr.st.INACTIVE')}</option>
          </select>
          {chips.length > 0 && (
            <button onClick={clear} className="ml-auto font-bt-mono text-[10.5px] uppercase tracking-[0.1em] font-semibold text-[#C2410C] hover:text-[#F97316]">
              {t('admin:audit.f.clear')} ✕
            </button>
          )}
        </div>
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-[#EDE7DB]">
            {chips.map(ch => (
              <button key={ch.key} onClick={() => setF(ch.key, '' as never)}
                className="inline-flex items-center gap-2 border border-[#DBD0BB] bg-[#F3EEE4] px-2.5 py-1 font-bt-mono text-[10px] uppercase tracking-[0.06em] text-[#0A0A0A] hover:border-[#F97316]">
                {ch.label} <span className="text-[#8A8175]">✕</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Roster */}
      <div className="bg-white border border-[#E4E4E7] min-h-[340px]">
        {loading ? (
          <div className="py-1.5">
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className="flex gap-3.5 items-center px-5 py-3.5 border-b border-[#F0EBE1]">
                <div className="w-10 h-10 bg-[#EAE4D8] animate-pulse flex-shrink-0" />
                <div className="flex-1">
                  <div className="w-2/5 h-3 bg-[#EAE4D8] animate-pulse mb-2" />
                  <div className="w-3/5 h-2 bg-[#EAE4D8] animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="py-16 text-center">
            <p className="text-sm text-[#71717A]">{t('admin:usr.error')}</p>
            <button onClick={load} className="mt-3 font-bt-mono text-[10px] uppercase tracking-[0.1em] border border-[#DBD0BB] px-3 py-1.5 hover:border-[#F97316]">
              {t('common:buttons.retry')}
            </button>
          </div>
        ) : total === 0 && !debouncedQ && !filters.role && !filters.status ? (
          <div className="py-[74px] px-6 text-center">
            <div className="font-bt-display font-bold text-4xl leading-none text-[#CDBFA6]">{t('admin:usr.emptyBig')}</div>
            <p className="font-bt-heading font-bold text-[17px] text-[#0A0A0A] mt-3">{t('admin:usr.emptyTitle')}</p>
            <p className="text-[13px] text-[#8A8175] mt-1 max-w-[420px] mx-auto">{t('admin:usr.emptyBody')}</p>
            <button onClick={() => setNewFlowOpen(true)}
              className="mt-4 inline-flex items-center gap-2 bg-[#0A0A0A] hover:bg-[#F97316] text-[#F5F1E8] hover:text-[#0A0A0A] font-bt-mono text-[11.5px] font-semibold uppercase tracking-[0.09em] px-4 py-3 transition-colors">
              <Plus className="w-3.5 h-3.5" />{t('admin:usr.emptyCta')}
            </button>
          </div>
        ) : visible.length === 0 ? (
          <div className="py-[70px] px-6 text-center">
            <div className="font-bt-display font-bold text-4xl leading-none text-[#CDBFA6]">{t('admin:usr.noMatchBig')}</div>
            <p className="font-bt-heading font-bold text-base text-[#0A0A0A] mt-2.5">{t('admin:usr.noMatchTitle')}</p>
            <button onClick={clear} className="mt-4 font-bt-mono text-[10.5px] uppercase tracking-[0.1em] font-semibold border border-[#DBD0BB] bg-[#FAF7F0] px-3.5 py-2 hover:border-[#F97316] hover:text-[#C2410C]">
              {t('admin:audit.f.clearAll')}
            </button>
          </div>
        ) : (
          groups.map(g => (
            <div key={g.kind}>
              <div className="flex items-center gap-3 px-5 pt-3 pb-2.5 bg-[#FBF8F2] border-b border-[#EDE7DB]">
                <span className={`w-6 h-6 flex items-center justify-center font-bt-mono text-[10px] font-semibold ${g.kind === 'FIELD' ? 'bg-[#F97316] text-[#0A0A0A]' : 'bg-[#0A0A0A] text-[#F5F1E8]'}`}>
                  {g.kind === 'FIELD' ? '⛏' : '⌨'}
                </span>
                <div className="min-w-0">
                  <Mono className="block text-[11px] tracking-[0.12em] text-[#0A0A0A] font-semibold">
                    {t(`admin:usr.group.${g.kind}`)}
                  </Mono>
                  <Mono className="block text-[10px] tracking-[0.05em] normal-case text-[#8A8175] mt-0.5">
                    {t(`admin:usr.group.${g.kind}Sub`)}
                  </Mono>
                </div>
                <span className="flex-1 h-px bg-[#DED4C2] min-w-[12px]" />
                <Mono className="text-[9.5px] text-[#B4A992] whitespace-nowrap">
                  {t('admin:usr.groupCount', { count: g.users.length })}
                </Mono>
              </div>
              {g.users.map(u => {
                const field = isFieldRole(u.role);
                const hasPin = pinMap[u.id];
                const missingPin = field && hasPin === false;
                return (
                  <div key={u.id} onClick={() => setOpenUser(u)}
                    className="flex gap-3.5 items-center px-5 py-3 border-b border-[#F0EBE1] cursor-pointer hover:bg-[#FBF8F2] transition-colors"
                    style={{
                      opacity: u.status === 'INACTIVE' ? 0.55 : 1,
                      borderLeft: missingPin ? '2px solid #F97316' : '2px solid transparent',
                    }}>
                    <span className={`w-10 h-10 flex items-center justify-center font-bt-mono text-[12px] font-semibold flex-shrink-0 ${field ? 'bg-[#0A0A0A] text-[#F5F1E8]' : 'bg-[#EDE5D6] text-[#0A0A0A]'}`}>
                      {initials(u.fullName, u.username)}
                    </span>
                    <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="text-[15px] font-semibold text-[#0A0A0A]">{u.fullName || u.username}</span>
                        <Mono className="text-[11px] normal-case tracking-normal text-[#A69C8D]">@{u.username}</Mono>
                        <Mono className="text-[9.5px] tracking-[0.08em] bg-[#F3EEE4] text-[#5A5346] px-1.5 py-0.5">
                          {t(`common:roles.${u.role}`)}
                        </Mono>
                        {u.status === 'INACTIVE' && (
                          <Mono className="text-[9.5px] tracking-[0.08em] bg-[#F4F4F5] text-[#71717A] px-1.5 py-0.5">
                            {t('admin:usr.st.INACTIVE')}
                          </Mono>
                        )}
                        {u.username === me && (
                          <Mono className="text-[9.5px] tracking-[0.08em] text-[#A69C8D]">{t('admin:usr.you')}</Mono>
                        )}
                      </div>
                      <Mono className="text-[10.5px] tracking-[0.04em] normal-case text-[#A69C8D]">
                        {field
                          ? (hasPin === undefined ? t('admin:usr.line.field') : hasPin ? t('admin:usr.line.credOk') : '')
                          : t('admin:usr.line.office')}
                        {u.hourlyRate != null && ` · $${u.hourlyRate}/h`}
                        {missingPin && <span className="text-[#EA580C] font-semibold"> · {t('admin:usr.noPinTag')}</span>}
                      </Mono>
                    </div>
                    {field && (
                      <button onClick={e => { e.stopPropagation(); setOpenUser(u); }}
                        className={`flex-shrink-0 inline-flex items-center gap-1.5 font-bt-mono text-[10px] font-semibold uppercase tracking-[0.07em] px-2.5 py-2 transition-colors ${
                          missingPin
                            ? 'bg-[#F97316] hover:bg-[#EA580C] text-[#0A0A0A]'
                            : 'bg-white border border-[#DBD0BB] text-[#0A0A0A] hover:border-[#F97316] hover:text-[#C2410C]'
                        }`}>
                        {missingPin ? t('admin:usr.setPin') : t('admin:usr.credential')}
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

      {/* Pagination */}
      {!loading && !error && total > 0 && (
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Mono className="text-[10.5px] tracking-[0.06em] text-[#8A8175]">
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

      {openUser && (
        <UserDrawer
          user={openUser}
          onClose={() => setOpenUser(null)}
          onChanged={() => { setOpenUser(null); setReloadKey(k => k + 1); }}
        />
      )}
      {newFlowOpen && (
        <NewUserFlow
          existingUsernames={rows.map(u => u.username)}
          onClose={() => setNewFlowOpen(false)}
          onCreated={() => setReloadKey(k => k + 1)}
        />
      )}
    </div>
  );
}

export { FIELD_ROLES };
