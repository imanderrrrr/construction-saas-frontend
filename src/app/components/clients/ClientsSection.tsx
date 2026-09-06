import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, ChevronLeft, ChevronRight, Mail, MoreVertical, Phone, Plus, RefreshCw, Search } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { cn } from '../ui/utils';
import { businessToday } from '../../helpers/dateTime';
import { setSectionIntent } from '../../lib/sectionIntent';
import { ApiError } from '../../lib/api';
import {
  getClient, getClientsSummary, listClients,
  type ClientProjectsFilter, type ClientResponse, type ClientStatus, type ClientsSummary,
} from '../../services/clients';
import { FIELD_LIMITS } from '../../../shared/fieldLimits';
import { FOCUS_RING, SecondaryButton, TertiaryButton } from '../onboarding/chrome';
import { Bone, CreateButton, EmptyWord, Mono, MonoSelect, PaperNote, stampDay } from '../projects/bt';
import { apiErrorMsg } from '../projects/helpers';
import { activeCount, CellEmpty, ClientStatusChip, closedCount } from './bits';
import { ClientFicha } from './ClientFicha';
import { ClientFormModal, type ClientFormMode } from './ClientFormModal';
import { ClientStatusModal } from './ClientStatusModal';

/**
 * Clientes — the list, in the panel's industrial language (Claude Design
 * "Clientes BuildTrack", 2026-09): the last section of the Proyectos block
 * that kept the old look. Same section-owned header, same strip of three
 * figures, same table and the same four states as the jobsite list.
 *
 * The screen's opinion: a client is judged by whether it has work open, so
 * the third figure — clients with jobsites in progress — is the one that
 * prevents the only expensive mistake here (deactivating one of them), and
 * it is one click away from becoming the filter. Nothing gets deleted: the
 * backend exposes no DELETE and the row menu offers none.
 *
 * Filters, page and page size live here, so they survive opening a ficha
 * and coming back; leaving the section forgets them.
 */

const PAGE_SIZES = [20, 50, 100] as const;
const ROW_GRID = 'grid grid-cols-[2.2fr_1.1fr_1fr_1.5fr_.9fr_.8fr_40px] gap-4 items-center';
/** 01B: the new row's paper background and orange edge fade out in 2 s (tailwind.css `.bt-row-flash`). */
const FLASH_MS = 2200;
/** The largest page the backend serves — what `rankOf` walks to find where a new client landed. */
const LOCATE_PAGE = 100;
const LOCATE_MAX_PAGES = 20;

/** Where `id` sits in the unfiltered list (sorted by name on the server); null if it cannot be found. */
async function rankOf(id: number): Promise<number | null> {
  for (let p = 0; p < LOCATE_MAX_PAGES; p++) {
    const page = await listClients(undefined, undefined, p, LOCATE_PAGE);
    const i = page.content.findIndex(c => c.id === id);
    if (i >= 0) return p * LOCATE_PAGE + i;
    if (p >= page.totalPages - 1) return null;
  }
  return null;
}

export function ClientsSection({ onNavigate }: { onNavigate?: (section: 'projects') => void } = {}) {
  const { t, i18n } = useTranslation(['admin', 'common']);
  const lang = i18n.language;
  const [view, setView] = useState<'list' | 'ficha'>('list');
  const [selected, setSelected] = useState<ClientResponse | null>(null);

  const [clients, setClients] = useState<ClientResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | ClientStatus>('');
  const [projectsFilter, setProjectsFilter] = useState<'' | ClientProjectsFilter>('');
  const [pageSize, setPageSize] = useState<number>(20);
  const [currentPage, setCurrentPage] = useState(0); // 0-based for backend
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // The three leading numbers. Null until they arrive; "—" if they never do.
  const [summary, setSummary] = useState<ClientsSummary | null>(null);
  const [summaryFailed, setSummaryFailed] = useState(false);

  // Windows
  const [formOpen, setFormOpen] = useState(false);
  const [formClient, setFormClient] = useState<ClientResponse | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusClient, setStatusClient] = useState<ClientResponse | null>(null);
  const [flashId, setFlashId] = useState<number | null>(null);

  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    // Nothing to debounce when both already agree (mount, or a programmatic
    // reset that set both at once — a stale timer here would undo the page
    // the new-client jump just chose).
    if (search === debouncedSearch) return;
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(0);
    }, 350);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [search, debouncedSearch]);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await listClients(debouncedSearch || undefined, statusFilter || undefined, currentPage, pageSize, projectsFilter || undefined);
      setClients(page.content);
      setTotalElements(page.totalElements);
      setTotalPages(page.totalPages);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 403 ? t('admin:clients.noPermission') : apiErrorMsg(err));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, projectsFilter, currentPage, pageSize, reloadNonce, t]); // eslint-disable-line react-hooks/exhaustive-deps -- reloadNonce forces a refetch with unchanged filters

  useEffect(() => { fetchClients(); }, [fetchClients]);

  /** The counts change whenever a client does; cheap enough to refetch with the list. */
  const fetchSummary = useCallback(() => {
    getClientsSummary()
      .then(s => { setSummary(s); setSummaryFailed(false); })
      .catch(() => setSummaryFailed(true));
  }, []);
  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  useEffect(() => {
    if (flashId == null) return;
    const timer = window.setTimeout(() => setFlashId(null), FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [flashId]);

  const replaceClient = useCallback((client: ClientResponse) => {
    setClients(prev => prev.map(c => (c.id === client.id ? client : c)));
    setSelected(prev => (prev?.id === client.id ? client : prev));
  }, []);

  const openFicha = (client: ClientResponse) => { setSelected(client); setView('ficha'); };
  const backToList = () => { setView('list'); setSelected(null); };
  const openForm = useCallback((client: ClientResponse | null) => { setFormClient(client); setFormOpen(true); }, []);
  const openStatus = useCallback((client: ClientResponse) => { setStatusClient(client); setStatusOpen(true); }, []);

  /** "Ver sus obras" / "Ver todas en Proyectos →": Proyectos opens already narrowed to this client. */
  const goToProjects = useCallback((client: ClientResponse, openProjectId?: number) => {
    setSectionIntent('projects', { clientId: client.id, clientName: client.name, openProjectId });
    onNavigate?.('projects');
  }, [onNavigate]);

  const handleSaved = useCallback(async (client: ClientResponse, mode: ClientFormMode) => {
    if (mode === 'edit') {
      replaceClient(client);
      fetchSummary();
      return;
    }
    // 01B / 03B: the list reloads, jumps to the page where the new client
    // landed, and its row lights up for two seconds. No toast. The filters
    // go, because a brand-new client is ACTIVE with no jobsites and may not
    // match the search that was on.
    setSearch('');
    setDebouncedSearch('');
    setStatusFilter('');
    setProjectsFilter('');
    let page = 0;
    try {
      const rank = await rankOf(client.id);
      if (rank != null) page = Math.floor(rank / pageSize);
    } catch { /* page 0 then */ }
    setCurrentPage(page);
    setReloadNonce(n => n + 1);
    setFlashId(client.id);
    fetchSummary();
    // The focus goes back to "Crear cliente".
    window.setTimeout(() => document.querySelector<HTMLElement>('[data-tour="sec.clients.add-client"]')?.focus(), 0);
  }, [pageSize, replaceClient, fetchSummary]);

  const handleStatusChanged = useCallback((client: ClientResponse) => {
    replaceClient(client);
    fetchSummary();
  }, [replaceClient, fetchSummary]);

  /** A jobsite created from the ficha moved the counts: re-read the client. */
  const refreshSelected = useCallback((id: number) => {
    getClient(id).then(c => { replaceClient(c); fetchSummary(); }).catch(() => { /* the counts catch up on the next visit */ });
  }, [replaceClient, fetchSummary]);

  const hasFilters = !!(search || statusFilter || projectsFilter);
  const clearFilters = () => { setSearch(''); setDebouncedSearch(''); setStatusFilter(''); setProjectsFilter(''); setCurrentPage(0); };
  const toggleStatus = (v: ClientStatus) => { setStatusFilter(prev => (prev === v ? '' : v)); setCurrentPage(0); };
  const toggleProjects = (v: ClientProjectsFilter) => { setProjectsFilter(prev => (prev === v ? '' : v)); setCurrentPage(0); };

  const displayPage = currentPage + 1;
  const startItem = totalElements === 0 ? 0 : currentPage * pageSize + 1;
  const endItem = Math.min((currentPage + 1) * pageSize, totalElements);
  const today = useMemo(() => stampDay(businessToday(), lang), [lang]);

  if (view === 'ficha' && selected) {
    return (
      <>
        <ClientFicha
          client={selected}
          onBack={backToList}
          onEdit={() => openForm(selected)}
          onToggleStatus={() => openStatus(selected)}
          onOpenProjects={() => goToProjects(selected)}
          onOpenProject={id => goToProjects(selected, id)}
          onClientChanged={() => refreshSelected(selected.id)}
        />
        <ClientFormModal open={formOpen} onOpenChange={setFormOpen} client={formClient} onSaved={handleSaved} />
        <ClientStatusModal open={statusOpen} onOpenChange={setStatusOpen} client={statusClient} onConfirmed={handleStatusChanged} />
      </>
    );
  }

  const listState = loading ? 'loading' : error ? 'error' : clients.length === 0 ? (hasFilters ? 'noMatch' : 'empty') : 'data';

  const menuFor = (client: ClientResponse) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t('admin:clients.actions')}
          onClick={e => e.stopPropagation()}
          className={cn('w-7 h-7 flex items-center justify-center border bg-white transition-colors flex-shrink-0 justify-self-end border-[#DBD0BB] text-[#5A5346] hover:border-[#F97316] hover:text-[#C2410C]', FOCUS_RING)}
        >
          <MoreVertical className="w-3.5 h-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[226px] rounded-none border-[#CDBFA6] p-0 shadow-[0_16px_48px_rgba(23,19,15,0.3)]" onClick={e => e.stopPropagation()}>
        <DropdownMenuLabel className="font-bt-mono text-[9.5px] font-normal uppercase tracking-[0.14em] text-[#8A8175] px-3.5 pt-2.5 pb-2 border-b border-[#EDE7DB] truncate">
          {client.name}
        </DropdownMenuLabel>
        {[
          { key: 'view', label: t('admin:clients.menu.view'), onClick: () => openFicha(client) },
          { key: 'edit', label: t('admin:clients.menu.edit'), onClick: () => openForm(client) },
          { key: 'projects', label: t('admin:clients.menu.projects'), onClick: () => goToProjects(client) },
          client.status === 'ACTIVE'
            ? { key: 'off', danger: true, sep: true, label: t('admin:clients.menu.deactivate'), onClick: () => openStatus(client) }
            : { key: 'on', sep: true, label: t('admin:clients.menu.reactivate'), onClick: () => openStatus(client) },
        ].map(it => (
          <DropdownMenuItem
            key={it.key}
            onClick={it.onClick}
            className={cn(
              'rounded-none cursor-pointer px-3.5 py-[11px] font-bt-mono text-[10.5px] uppercase tracking-[0.08em] border-l-2 border-l-transparent focus:bg-[#F3EEE4] focus:border-l-[#F97316] data-[highlighted]:bg-[#F3EEE4]',
              it.sep && 'border-t border-t-[#EDE7DB]',
              it.danger ? 'text-[#B3402A] focus:text-[#B3402A] focus:border-l-[#B3402A]' : 'text-[#0A0A0A] focus:text-[#0A0A0A]',
            )}
          >
            {it.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const figureValue = (n: number | undefined) => (summary ? n : summaryFailed ? <span className="text-[#CDBFA6]">—</span> : <Bone className="w-10 h-8" />);
  const figureButton = (pressed: boolean) => cn(
    'text-left px-[22px] py-4 transition-colors disabled:cursor-default',
    summary && 'hover:bg-[#FBEDE0]',
    pressed && 'bg-[#FBEDE0] shadow-[inset_0_-3px_0_#F97316]',
    FOCUS_RING, 'focus-visible:outline-offset-[-2px]',
  );

  return (
    <>
      <div className="space-y-4">
        {/* ── Header — the section's, not the shell's ─────────────────── */}
        <div className="flex items-end justify-between gap-5 flex-wrap">
          <div>
            <Mono className="block text-[11px] tracking-[0.15em] text-[#8A8175]">{t('admin:clients.kicker')}</Mono>
            <h2 className="font-bt-display font-extrabold uppercase text-[38px] md:text-[50px] leading-[0.92] tracking-[0.01em] text-[#0A0A0A] mt-1">
              {t('admin:clients.title')}
            </h2>
            <Mono className="block text-[11px] md:text-[12.5px] tracking-[0.06em] text-[#5A5346] mt-2">
              {summary
                ? t('admin:clients.countLine', { total: summary.total, active: summary.active, inactive: summary.total - summary.active })
                : t('admin:clients.subtitle')}
            </Mono>
          </div>
          <div className="flex items-center gap-3.5 flex-shrink-0 w-full md:w-auto">
            <div className="text-right hidden md:block">
              <Mono className="block text-[12px] tracking-[0.08em] text-[#0A0A0A]">{t('admin:dash.todayStamp', { date: today })}</Mono>
              <Mono className="block text-[10px] tracking-[0.1em] text-[#A69C8D] mt-[3px]">{t('admin:clients.stamp')}</Mono>
            </div>
            <CreateButton onClick={() => openForm(null)} className="w-full md:w-auto py-3.5 md:py-3" data-tour="sec.clients.add-client">
              <Plus className="w-3.5 h-3.5" strokeWidth={2.4} />{t('admin:clients.create')}
            </CreateButton>
          </div>
        </div>

        {/* ── The three numbers ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 bg-white border border-[#E7E1D5]" data-testid="clients-figures">
          <div className="px-[22px] py-4 border-b sm:border-b-0 sm:border-r border-[#EDE7DB]">
            <div className="font-bt-display font-extrabold text-[40px] leading-[0.85] text-[#0A0A0A]">{figureValue(summary?.total)}</div>
            <Mono className="block text-[10.5px] tracking-[0.1em] text-[#5A5346] mt-[5px]">{t('admin:clients.kpi.total')}</Mono>
          </div>
          <button
            type="button"
            disabled={!summary}
            onClick={() => toggleStatus('ACTIVE')}
            aria-pressed={statusFilter === 'ACTIVE'}
            className={cn(figureButton(statusFilter === 'ACTIVE'), 'border-b sm:border-b-0 sm:border-r border-[#EDE7DB]')}
          >
            <div className="font-bt-display font-extrabold text-[40px] leading-[0.85] text-[#0A0A0A]">{figureValue(summary?.active)}</div>
            <Mono className="block text-[10.5px] tracking-[0.1em] text-[#5A5346] mt-[5px]">{t('admin:clients.kpi.active')}</Mono>
          </button>
          <button
            type="button"
            disabled={!summary}
            onClick={() => toggleProjects('WITH_ACTIVE')}
            aria-pressed={projectsFilter === 'WITH_ACTIVE'}
            className={figureButton(projectsFilter === 'WITH_ACTIVE')}
          >
            <div className="font-bt-display font-extrabold text-[40px] leading-[0.85] text-[#0A0A0A]">{figureValue(summary?.withActiveProjects)}</div>
            <Mono className="block text-[10.5px] tracking-[0.1em] text-[#5A5346] mt-[5px]">{t('admin:clients.kpi.withProjects')}</Mono>
          </button>
        </div>

        {/* ── Filters ────────────────────────────────────────────────── */}
        <div className="bg-white border border-[#E7E1D5] p-3.5 md:px-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 min-w-[200px] md:max-w-[320px]" data-tour="sec.clients.search">
              <Search className="w-3.5 h-3.5 text-[#A69C8D] absolute left-[11px] top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('admin:clients.searchPlaceholder')}
                maxLength={FIELD_LIMITS.SEARCH}
                aria-label={t('admin:clients.searchPlaceholder')}
                className={cn('w-full border border-[#DBD0BB] bg-[#FAF7F0] py-[9px] pl-8 pr-3 text-[13px] text-[#0A0A0A] outline-none focus:border-[#F97316]', FOCUS_RING)}
              />
            </div>
            <MonoSelect value={statusFilter} onChange={e => { setStatusFilter(e.target.value as '' | ClientStatus); setCurrentPage(0); }} className="hidden md:block" aria-label={t('admin:clients.filter.status')}>
              <option value="">{t('admin:clients.filter.status')}</option>
              <option value="ACTIVE">{t('common:status.active')}</option>
              <option value="INACTIVE">{t('common:status.inactive')}</option>
            </MonoSelect>
            <MonoSelect value={projectsFilter} onChange={e => { setProjectsFilter(e.target.value as '' | ClientProjectsFilter); setCurrentPage(0); }} className="hidden md:block" aria-label={t('admin:clients.filter.projects')}>
              <option value="">{t('admin:clients.filter.projects')}</option>
              <option value="WITH_ACTIVE">{t('admin:clients.filter.withActive')}</option>
              <option value="NONE">{t('admin:clients.filter.none')}</option>
            </MonoSelect>
            <div className="ml-auto flex items-center gap-2">
              {hasFilters && (
                <button type="button" onClick={clearFilters} className={cn('font-bt-mono text-[10.5px] uppercase tracking-[0.1em] font-semibold text-[#C2410C] hover:text-[#F97316] px-1', FOCUS_RING)}>
                  {t('admin:clients.filter.clear')} ✕
                </button>
              )}
              <SecondaryButton onClick={() => { setReloadNonce(n => n + 1); fetchSummary(); }} disabled={loading} className="text-[10.5px] px-3 py-[9px] bg-[#FAF7F0] gap-1.5">
                <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />{t('common:buttons.refresh')}
              </SecondaryButton>
            </div>
          </div>
          {/* Phone: the filters as chips */}
          <div className="flex gap-[7px] overflow-x-auto pb-0.5 mt-3 md:hidden">
            {([
              ['all', !statusFilter && !projectsFilter, t('admin:clients.filter.all'), () => clearFilters()],
              ['active', statusFilter === 'ACTIVE', t('admin:clients.filter.actives'), () => { setProjectsFilter(''); setStatusFilter('ACTIVE'); setCurrentPage(0); }],
              ['inactive', statusFilter === 'INACTIVE', t('admin:clients.filter.inactives'), () => { setProjectsFilter(''); setStatusFilter('INACTIVE'); setCurrentPage(0); }],
              ['with', projectsFilter === 'WITH_ACTIVE', t('admin:clients.filter.withProjectsChip'), () => { setStatusFilter(''); setProjectsFilter('WITH_ACTIVE'); setCurrentPage(0); }],
            ] as const).map(([key, on, label, onClick]) => (
              <button key={key} type="button" onClick={onClick}
                className={cn('font-bt-mono text-[10px] uppercase tracking-[0.08em] px-[11px] py-2 whitespace-nowrap', on ? 'bg-[#0A0A0A] text-[#F5F1E8]' : 'border border-[#DBD0BB] text-[#5A5346]', FOCUS_RING)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Table / cards ──────────────────────────────────────────── */}
        <div className="bg-white border border-[#E7E1D5]" data-testid="clients-list">
          {listState === 'error' && (
            <EmptyWord tone="red" word={t('admin:clients.error.big')} title={t('admin:clients.error.title')} hint={t('admin:clients.error.hint')} className="border-0"
              action={<SecondaryButton onClick={() => setReloadNonce(n => n + 1)} className="bg-[#FAF7F0]">{t('common:buttons.retry')}</SecondaryButton>} />
          )}
          {listState === 'empty' && (
            <EmptyWord word={t('admin:clients.empty.big')} title={t('admin:clients.empty.title')} hint={t('admin:clients.empty.hint')} className="border-0 py-[76px]"
              action={<CreateButton onClick={() => openForm(null)}><Plus className="w-3.5 h-3.5" strokeWidth={2.4} />{t('admin:clients.create')}</CreateButton>} />
          )}
          {listState === 'noMatch' && (
            <EmptyWord word={t('admin:clients.noMatch.big')} title={t('admin:clients.noMatch.title')} hint={t('admin:clients.noMatch.hint')} className="border-0"
              action={<SecondaryButton onClick={clearFilters} className="bg-[#FAF7F0]">{t('admin:clients.filter.clear')}</SecondaryButton>} />
          )}

          {(listState === 'data' || listState === 'loading') && (
            <>
              {/* Desktop */}
              <div className="hidden md:block">
                <div className={cn(ROW_GRID, 'px-5 py-[11px] border-b border-[#EDE7DB] bg-[#FBF8F2] font-bt-mono text-[10px] uppercase tracking-[0.13em] text-[#8A8175]')}>
                  <span>{t('admin:clients.table.client')}</span>
                  <span>{t('admin:clients.table.taxId')}</span>
                  <span>{t('admin:clients.table.phone')}</span>
                  <span>{t('admin:clients.table.email')}</span>
                  <span>{t('admin:clients.table.projects')}</span>
                  <span>{t('common:labels.status')}</span>
                  <span />
                </div>
                {listState === 'loading' && Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className={cn(ROW_GRID, 'px-5 py-[15px] border-b border-[#F0EBE1]')}>
                    <div className="space-y-2"><Bone className="w-[56%] h-[13px]" /><Bone className="w-[72%] h-[9px]" /></div>
                    <Bone className="w-20 h-3" /><Bone className="w-16 h-3" /><Bone className="w-[80%] h-3" />
                    <div className="space-y-2"><Bone className="w-16 h-[9px]" /><Bone className="w-14 h-[9px]" /></div>
                    <Bone className="w-14 h-5" /><Bone className="w-7 h-7 justify-self-end" />
                  </div>
                ))}
                {listState === 'data' && clients.map(client => {
                  const active = activeCount(client);
                  const flash = client.id === flashId;
                  return (
                    <div
                      key={client.id}
                      role="button"
                      tabIndex={0}
                      data-testid={`client-row-${client.id}`}
                      onClick={() => openFicha(client)}
                      onKeyDown={e => { if (e.key === 'Enter') openFicha(client); }}
                      className={cn(
                        ROW_GRID, 'px-5 py-[13px] border-b border-[#F0EBE1] border-l-2 border-l-transparent cursor-pointer transition-colors hover:bg-[#FBF8F2] hover:border-l-[#F97316]',
                        client.status === 'INACTIVE' && 'opacity-[0.72]',
                        flash && 'bt-row-flash',
                        FOCUS_RING, 'focus-visible:outline-offset-[-2px]',
                      )}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[15px] font-semibold text-[#0A0A0A] truncate">{client.name}</span>
                          {flash && <span className="inline-flex items-center font-bt-mono text-[9px] uppercase tracking-[0.1em] bg-[#F97316] text-[#0A0A0A] px-1.5 py-0.5">{t('admin:clients.row.new')}</span>}
                        </div>
                        {client.contact
                          ? <Mono className="block text-[10.5px] tracking-[0.04em] text-[#5A5346] mt-[3px] truncate">{client.contact}</Mono>
                          : <CellEmpty className="block mt-[3px]">{t('admin:clients.row.noContact')}</CellEmpty>}
                      </div>
                      {client.rfc ? <Mono className="text-[11.5px] tracking-[0.04em] text-[#0A0A0A] truncate">{client.rfc}</Mono> : <CellEmpty>{t('admin:clients.row.noTaxId')}</CellEmpty>}
                      {client.phone ? <Mono className="text-[11.5px] tracking-[0.04em] text-[#0A0A0A] truncate">{client.phone}</Mono> : <CellEmpty>{t('admin:clients.row.noPhone')}</CellEmpty>}
                      {client.email ? <span className="text-[13px] text-[#0A0A0A] truncate">{client.email}</span> : <CellEmpty>{t('admin:clients.row.noEmail')}</CellEmpty>}
                      <div className="min-w-0">
                        <Mono className={cn('block text-[10.5px] tracking-[0.06em] truncate', active > 0 ? 'text-[#0A0A0A] font-semibold' : 'text-[#A69C8D]')}>{t('admin:clients.row.inProgress', { count: active })}</Mono>
                        <Mono className="block text-[10.5px] tracking-[0.06em] text-[#8A8175] mt-[3px] truncate">{t('admin:clients.row.closed', { count: closedCount(client) })}</Mono>
                      </div>
                      <div><ClientStatusChip status={client.status} /></div>
                      {menuFor(client)}
                    </div>
                  );
                })}
              </div>

              {/* Phone: cards */}
              <div className="md:hidden p-3.5 space-y-3">
                {listState === 'loading' && Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="border border-[#E7E1D5] p-3.5 space-y-2"><Bone className="w-2/3 h-[13px]" /><Bone className="w-1/2 h-[9px]" /><Bone className="w-1/3 h-[9px] mt-3" /></div>
                ))}
                {listState === 'data' && clients.map(client => {
                  const active = activeCount(client);
                  const closed = closedCount(client);
                  const inactive = client.status === 'INACTIVE';
                  return (
                    <div
                      key={client.id}
                      className={cn('border border-[#E7E1D5] border-l-2 border-l-transparent p-3.5', client.id === flashId && 'bt-row-flash', inactive && 'opacity-[0.72]')}
                      onClick={() => openFicha(client)}
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="text-[15px] font-semibold text-[#0A0A0A] leading-[1.3]">{client.name}</div>
                        <ClientStatusChip status={client.status} className="flex-shrink-0" />
                      </div>
                      <Mono className="flex items-center gap-1 text-[10px] tracking-[0.04em] text-[#5A5346] mt-1 min-w-0">
                        <span className="truncate">{client.contact ?? t('admin:clients.row.noContact')}</span>
                        <span className="flex-shrink-0">· {client.rfc ?? t('admin:clients.row.noTaxIdLong')}</span>
                      </Mono>
                      {inactive ? (
                        <>
                          <PaperNote tone="none" className="mt-2.5 text-[12.5px]">
                            {closed > 0 ? t('admin:clients.row.inactiveNote', { count: closed }) : t('admin:clients.row.inactiveNoteNone')}
                          </PaperNote>
                          <div className="flex justify-end mt-2.5">
                            <TertiaryButton onClick={e => { e.stopPropagation(); openStatus(client); }} className="text-[10px]">{t('admin:clients.menu.reactivate')}</TertiaryButton>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex flex-col gap-1 mt-2.5">
                            <span className="inline-flex items-center gap-2 text-[12.5px] text-[#0A0A0A]">
                              <Phone className="w-3 h-3 text-[#8A8175]" strokeWidth={2} />
                              {client.phone ? <Mono className="text-[11.5px] tracking-[0.04em]">{client.phone}</Mono> : <CellEmpty>{t('admin:clients.row.noPhone')}</CellEmpty>}
                            </span>
                            <span className="inline-flex items-center gap-2 text-[12.5px] text-[#0A0A0A] min-w-0">
                              <Mail className="w-3 h-3 text-[#8A8175] flex-shrink-0" strokeWidth={2} />
                              {client.email ? <span className="truncate">{client.email}</span> : <CellEmpty>{t('admin:clients.row.noEmail')}</CellEmpty>}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3 mt-3">
                            <Mono className="text-[10px] tracking-[0.06em] text-[#8A8175]">
                              {t('admin:clients.row.inProgress', { count: active })} · {t('admin:clients.row.closed', { count: closed })}
                            </Mono>
                            <Mono className="inline-flex items-center gap-1 text-[10px] font-semibold tracking-[0.1em] text-[#C2410C]">
                              {t('admin:clients.row.viewFicha')}<ArrowRight className="w-3 h-3" strokeWidth={2.2} />
                            </Mono>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* ── Pagination ─────────────────────────────────────────────── */}
        {listState === 'data' && (
          <div className="flex items-center justify-between gap-4 flex-wrap pb-2">
            <Mono className="text-[10.5px] tracking-[0.06em] text-[#8A8175]">{t('admin:clients.showingRange', { start: startItem, end: endItem, total: totalElements })}</Mono>
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-[7px]">
                <Mono className="text-[10px] tracking-[0.08em] text-[#8A8175]">{t('admin:clients.perPage')}</Mono>
                <MonoSelect value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(0); }} className="px-[9px] py-1.5" aria-label={t('admin:clients.perPage')}>
                  {PAGE_SIZES.map(n => <option key={n} value={n}>{n}</option>)}
                </MonoSelect>
              </div>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => setCurrentPage(p => Math.max(0, p - 1))} disabled={currentPage === 0} aria-label={t('common:buttons.prev')}
                  className={cn('w-[30px] h-[30px] border border-[#DBD0BB] bg-[#FAF7F0] flex items-center justify-center text-[#0A0A0A] hover:border-[#F97316] hover:text-[#C2410C] disabled:text-[#B4A992] disabled:hover:border-[#DBD0BB]', FOCUS_RING)}>
                  <ChevronLeft className="w-3 h-3" strokeWidth={2.4} />
                </button>
                <Mono className="text-[11px] tracking-[0.06em] text-[#0A0A0A] min-w-[96px] text-center">{t('admin:clients.page', { current: displayPage, total: Math.max(totalPages, 1) })}</Mono>
                <button type="button" onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))} disabled={currentPage >= totalPages - 1} aria-label={t('common:buttons.next')}
                  className={cn('w-[30px] h-[30px] border border-[#DBD0BB] bg-[#FAF7F0] flex items-center justify-center text-[#0A0A0A] hover:border-[#F97316] hover:text-[#C2410C] disabled:text-[#B4A992] disabled:hover:border-[#DBD0BB]', FOCUS_RING)}>
                  <ChevronRight className="w-3 h-3" strokeWidth={2.4} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <ClientFormModal open={formOpen} onOpenChange={setFormOpen} client={formClient} onSaved={handleSaved} />
      <ClientStatusModal open={statusOpen} onOpenChange={setStatusOpen} client={statusClient} onConfirmed={handleStatusChanged} />
    </>
  );
}
