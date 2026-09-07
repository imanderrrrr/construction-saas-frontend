import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Plus, RefreshCw, Search, X } from 'lucide-react';
import { cn } from '../ui/utils';
import { ApiError } from '../../lib/api';
import { FIELD_LIMITS } from '../../../shared/fieldLimits';
import { listUsers, type UserDTO } from '../../services/users';
import {
  getAdminTools, getAdminToolSummary, getConsumableSummary, searchConsumables,
  type ConsumableResponse, type ConsumableSummary, type StockLight,
  type ToolResponse, type ToolSummary,
} from '../../services/warehouse';
import { CreateButton, Mono, MonoSelect } from '../projects/bt';
import { FOCUS_RING, SecondaryButton } from '../onboarding/chrome';
import { CATEGORIES, categoryName, Figure, STATUSES, statusName } from './bits';
import { ToolsTable, type TableState } from './ToolsTable';
import { ConsumablesTable } from './ConsumablesTable';
import { ToolWindow } from './ToolWindow';
import { ToolFormModal } from './ToolFormModal';
import { FixStatusModal } from './FixStatusModal';
import { ConsumableFormModal, MinimumStockModal } from './ConsumableModals';

/**
 * Herramientas — the section (Claude Design "Herramientas BuildTrack", 2026-09).
 *
 * It stops being a mirror. The badge said "read only", but that was a
 * convention of the interface and never a permission: the server has always
 * let the admin register, edit and change a tool's status, and add a supply
 * with its minimum. A company with no warehouse user had nobody at all who
 * could add a drill.
 *
 * What stays in the warehouse is assigning, returning and dispatching — those
 * are counter acts, with the person in front of you — and the screen says so
 * rather than staying silent about it.
 */

const FLASH_MS = 2200;
const PAGE_SIZES = [20, 50, 100] as const;

type Tab = 'returnable' | 'consumable';

export function ToolsSection({ onNavigate }: { onNavigate?: (section: string) => void } = {}) {
  const { t, i18n } = useTranslation(['tools', 'common']);
  const lang = i18n.language;
  const [tab, setTab] = useState<Tab>('returnable');

  // Returnables
  const [tools, setTools] = useState<ToolResponse[]>([]);
  const [toolsState, setToolsState] = useState<TableState>('loading');
  const [toolsTotal, setToolsTotal] = useState(0);
  const [toolsPages, setToolsPages] = useState(1);
  const [toolsPage, setToolsPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [worker, setWorker] = useState<UserDTO | null>(null);
  const [workers, setWorkers] = useState<UserDTO[]>([]);
  const [keepers, setKeepers] = useState<UserDTO[]>([]);

  // Consumables
  const [consumables, setConsumables] = useState<ConsumableResponse[]>([]);
  const [consumablesState, setConsumablesState] = useState<TableState>('loading');
  const [consumablesTotal, setConsumablesTotal] = useState(0);
  const [consumablesPages, setConsumablesPages] = useState(1);
  const [consumablesPage, setConsumablesPage] = useState(0);
  const [light, setLight] = useState<'' | StockLight>('');
  const [unit, setUnit] = useState('');

  // The two figure strips. They come from the server and never from the rows
  // on screen: with a worker filter on, the strip keeps counting the company.
  const [toolSummary, setToolSummary] = useState<ToolSummary | null>(null);
  const [consumableSummary, setConsumableSummary] = useState<ConsumableSummary | null>(null);
  const [summaryFailed, setSummaryFailed] = useState(false);

  const [reloadNonce, setReloadNonce] = useState(0);
  const [flashId, setFlashId] = useState<number | null>(null);

  // Windows
  const [openTool, setOpenTool] = useState<ToolResponse | null>(null);
  const [formTool, setFormTool] = useState<ToolResponse | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [fixTool, setFixTool] = useState<ToolResponse | null>(null);
  const [consumableFormOpen, setConsumableFormOpen] = useState(false);
  const [minimumTarget, setMinimumTarget] = useState<ConsumableResponse | null>(null);

  const searchTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (search === debouncedSearch) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setDebouncedSearch(search); setToolsPage(0); setConsumablesPage(0); }, 350);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search, debouncedSearch]);

  const fetchTools = useCallback(async () => {
    setToolsState('loading');
    try {
      const page = await getAdminTools({
        status: status || undefined,
        category: category || undefined,
        search: debouncedSearch || undefined,
        assignedToId: worker?.id,
        page: toolsPage,
        size: pageSize,
      });
      setTools(page.content);
      setToolsTotal(page.totalElements);
      setToolsPages(page.totalPages);
      const filtered = !!(debouncedSearch || category || status || worker);
      setToolsState(page.content.length === 0 ? (filtered ? 'noMatch' : 'empty') : 'data');
    } catch (err) {
      setToolsState(err instanceof ApiError && err.status === 403 ? 'forbidden' : 'error');
    }
  }, [status, category, debouncedSearch, worker, toolsPage, pageSize, reloadNonce]); // eslint-disable-line react-hooks/exhaustive-deps -- reloadNonce forces a refetch with unchanged filters

  const fetchConsumables = useCallback(async () => {
    setConsumablesState('loading');
    try {
      const page = await searchConsumables({
        search: debouncedSearch || undefined,
        unit: unit || undefined,
        stock: light || undefined,
        page: consumablesPage,
        size: pageSize,
      });
      setConsumables(page.content);
      setConsumablesTotal(page.totalElements);
      setConsumablesPages(page.totalPages);
      const filtered = !!(debouncedSearch || unit || light);
      setConsumablesState(page.content.length === 0 ? (filtered ? 'noMatch' : 'empty') : 'data');
    } catch (err) {
      setConsumablesState(err instanceof ApiError && err.status === 403 ? 'forbidden' : 'error');
    }
  }, [debouncedSearch, unit, light, consumablesPage, pageSize, reloadNonce]); // eslint-disable-line react-hooks/exhaustive-deps -- reloadNonce forces a refetch with unchanged filters

  useEffect(() => { if (tab === 'returnable') fetchTools(); }, [tab, fetchTools]);
  useEffect(() => { if (tab === 'consumable') fetchConsumables(); }, [tab, fetchConsumables]);

  const fetchSummaries = useCallback(() => {
    setSummaryFailed(false);
    Promise.all([getAdminToolSummary(), getConsumableSummary()])
      .then(([tools_, consumables_]) => { setToolSummary(tools_); setConsumableSummary(consumables_); })
      .catch(() => setSummaryFailed(true));
  }, []);
  useEffect(() => { fetchSummaries(); }, [fetchSummaries]);

  // Workers, for the filter of the day somebody leaves the company; and the
  // warehouse users, who are the answer to "then who returns it".
  useEffect(() => {
    listUsers({ role: 'WORKER', size: 200 })
      .then(page => setWorkers(page.content))
      .catch(() => { /* the filter degrades to absent; the list still loads */ });
    listUsers({ role: 'WAREHOUSE', size: 20 })
      .then(page => setKeepers(page.content))
      .catch(() => { /* the blocked windows fall back to "no warehouse user" */ });
  }, []);

  useEffect(() => {
    if (flashId == null) return;
    const timer = window.setTimeout(() => setFlashId(null), FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [flashId]);

  const summaryState = summaryFailed ? 'failed' : toolSummary ? 'ready' : 'loading';

  const toolFilterCount = [debouncedSearch, category, status, worker].filter(Boolean).length;
  const consumableFilterCount = [debouncedSearch, unit, light].filter(Boolean).length;
  const clearToolFilters = () => {
    setSearch(''); setDebouncedSearch(''); setCategory(''); setStatus(''); setWorker(null); setToolsPage(0);
  };
  const clearConsumableFilters = () => {
    setSearch(''); setDebouncedSearch(''); setUnit(''); setLight(''); setConsumablesPage(0);
  };

  const afterToolChange = (tool: ToolResponse) => {
    setTools(prev => prev.map(x => (x.id === tool.id ? { ...x, ...tool } : x)));
    setOpenTool(prev => (prev?.id === tool.id ? { ...prev, ...tool } : prev));
    setFlashId(tool.id);
    fetchSummaries();
  };

  const units = useMemo(() => [...new Set(consumables.map(c => c.unit))].sort(), [consumables]);

  const toolsFigures = (
    <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 bg-white border border-[#E7E1D5] divide-x divide-[#EDE7DB]" data-tour="sec.tool-inventory.counts" data-testid="tools-figures">
      <Figure state={summaryState} value={toolSummary?.total} label={t('tools:kpi.total')} note={t('tools:kpi.total.note')} />
      <Figure
        state={summaryState} value={toolSummary?.available} label={t('tools:kpi.available')} tone="green"
        pressed={status === 'Available'} onClick={() => { setStatus(s => (s === 'Available' ? '' : 'Available')); setToolsPage(0); }}
      />
      <Figure
        state={summaryState} value={toolSummary?.assigned} label={t('tools:kpi.assigned')}
        pressed={status === 'Assigned'} onClick={() => { setStatus(s => (s === 'Assigned' ? '' : 'Assigned')); setToolsPage(0); }}
      />
      <Figure
        state={summaryState} value={toolSummary?.pendingAcceptance} label={t('tools:kpi.pendingAcceptance')} note={t('tools:kpi.pendingAcceptance.note')} tone="orange"
        pressed={status === 'Pending Acceptance'} onClick={() => { setStatus(s => (s === 'Pending Acceptance' ? '' : 'Pending Acceptance')); setToolsPage(0); }}
      />
      <Figure
        state={summaryState} value={toolSummary?.inReview} label={t('tools:kpi.inReview')}
        pressed={status === 'In Review'} onClick={() => { setStatus(s => (s === 'In Review' ? '' : 'In Review')); setToolsPage(0); }}
      />
      <Figure
        state={summaryState} value={toolSummary?.damaged} label={t('tools:kpi.damaged')} tone="red"
        pressed={status === 'Damaged'} onClick={() => { setStatus(s => (s === 'Damaged' ? '' : 'Damaged')); setToolsPage(0); }}
      />
      <Figure
        state={summaryState} value={toolSummary?.lost} label={t('tools:kpi.lost')} tone="red"
        pressed={status === 'Lost'} onClick={() => { setStatus(s => (s === 'Lost' ? '' : 'Lost')); setToolsPage(0); }}
      />
    </div>
  );

  const consumableFigures = (
    <div className="grid grid-cols-2 xl:grid-cols-4 bg-white border border-[#E7E1D5] divide-x divide-[#EDE7DB]" data-testid="consumables-figures">
      <Figure state={summaryState} value={consumableSummary?.total} label={t('tools:kpi.consumables.total')} note={t('tools:kpi.consumables.total.note')} />
      <Figure
        state={summaryState} value={consumableSummary?.inStock} label={t('tools:kpi.consumables.inStock')} note={t('tools:kpi.consumables.inStock.note')} tone="green"
        pressed={light === 'IN'} onClick={() => { setLight(l => (l === 'IN' ? '' : 'IN')); setConsumablesPage(0); }}
      />
      <Figure
        state={summaryState} value={consumableSummary?.lowStock} label={t('tools:kpi.consumables.lowStock')} note={t('tools:kpi.consumables.lowStock.note')} tone="orange"
        pressed={light === 'LOW'} onClick={() => { setLight(l => (l === 'LOW' ? '' : 'LOW')); setConsumablesPage(0); }}
      />
      <Figure
        state={summaryState} value={consumableSummary?.outOfStock} label={t('tools:kpi.consumables.outOfStock')} note={t('tools:kpi.consumables.outOfStock.note')} tone="red"
        pressed={light === 'OUT'} onClick={() => { setLight(l => (l === 'OUT' ? '' : 'OUT')); setConsumablesPage(0); }}
      />
    </div>
  );

  const returnable = tab === 'returnable';
  const page = returnable ? toolsPage : consumablesPage;
  const pages = returnable ? toolsPages : consumablesPages;
  const total = returnable ? toolsTotal : consumablesTotal;
  const shown = returnable ? tools.length : consumables.length;
  const setPage = returnable ? setToolsPage : setConsumablesPage;
  const filterCount = returnable ? toolFilterCount : consumableFilterCount;

  return (
    <>
      <div className="space-y-3.5">
        {/* ── Header, tabs and the two buttons ─────────────────────────── */}
        <div data-tour="sec.tool-inventory.header">
          <div className="flex items-end justify-between gap-5 flex-wrap">
            <div>
              <Mono className="block text-[10px] tracking-[0.15em] text-[#8A8175]">{t('tools:kicker')}</Mono>
              <h2 className="font-bt-display font-extrabold uppercase text-[32px] md:text-[44px] leading-[0.92] text-[#0B0A09] mt-1">
                {t('tools:title')}
              </h2>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <CreateButton
                onClick={() => { if (returnable) { setFormTool(null); setFormOpen(true); } else setConsumableFormOpen(true); }}
                className="py-2.5 px-3.5 text-[10.5px]"
              >
                <Plus className="w-3.5 h-3.5" strokeWidth={2.4} />
                {returnable ? t('tools:action.register') : t('tools:action.registerConsumable')}
              </CreateButton>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 flex-wrap mt-3">
            <div role="tablist" className="flex">
              {(['returnable', 'consumable'] as Tab[]).map(key => {
                const active = tab === key;
                const count = key === 'returnable' ? toolSummary?.total : consumableSummary?.total;
                return (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => { setTab(key); setSearch(''); setDebouncedSearch(''); }}
                    className={cn(
                      'inline-flex items-center gap-2 px-4 py-2.5 font-bt-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] whitespace-nowrap',
                      'border -ml-px first:ml-0 transition-colors',
                      active ? 'bg-[#0B0A09] text-[#F5F1E8] border-[#0B0A09]' : 'bg-white border-[#DBD0BB] text-[#5A5346] hover:text-[#0B0A09]',
                      FOCUS_RING,
                    )}
                  >
                    {t(`tools:tab.${key}`)}
                    {count != null && (
                      <span className={cn('font-bt-mono text-[9px] font-semibold px-1.5 py-[2px] leading-none', active ? 'bg-[rgba(245,241,232,0.2)]' : 'bg-[#F3EEE4] text-[#0B0A09]')}>{count}</span>
                    )}
                  </button>
                );
              })}
            </div>
            <Mono className="text-[9.5px] tracking-[0.08em] text-[#A69C8D]">
              {returnable ? t('tools:warehouseDoes') : t('tools:warehouseDoes.consumables')}
            </Mono>
          </div>
        </div>

        {returnable ? toolsFigures : consumableFigures}

        {/* ── Filters ─────────────────────────────────────────────────── */}
        <div className="bg-white border border-[#E7E1D5] px-3 py-2.5" data-tour="sec.tool-inventory.filters">
          <div className="flex flex-wrap items-center gap-[9px]">
            <div className="relative flex-1 min-w-[180px] md:max-w-[280px]">
              <Search className="w-3.5 h-3.5 text-[#A69C8D] absolute left-[10px] top-1/2 -translate-y-1/2" />
              <input
                data-tools-search
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('tools:search.placeholder')}
                maxLength={FIELD_LIMITS.SEARCH}
                aria-label={t('tools:search.placeholder')}
                className={cn('w-full border border-[#DBD0BB] bg-[#FAF7F0] py-[7px] pl-8 pr-3 text-[12.5px] text-[#0B0A09] outline-none focus:border-[#F97316]', FOCUS_RING, 'focus-visible:outline-offset-[-1px]')}
              />
            </div>

            {returnable ? (
              <>
                <MonoSelect value={category} onChange={e => { setCategory(e.target.value); setToolsPage(0); }} className="py-1.5" aria-label={t('tools:filter.category')}>
                  <option value="">{t('tools:filter.category')}</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{categoryName(t, c)}</option>)}
                </MonoSelect>
                <MonoSelect value={status} onChange={e => { setStatus(e.target.value); setToolsPage(0); }} className="py-1.5" aria-label={t('tools:filter.status')}>
                  <option value="">{t('tools:filter.status')}</option>
                  {STATUSES.map(s => <option key={s} value={s}>{statusName(t, s)}</option>)}
                </MonoSelect>
                {/* Put on, the worker filter is not one more dropdown: it is the
                    screen of the day somebody leaves, so it becomes a capsule
                    with their name and the bar says what it is for. */}
                {worker ? (
                  <span className="inline-flex items-center gap-2 bg-[#FBEDE0] border border-[#F97316] px-2.5 py-1.5">
                    <Mono className="text-[9.5px] font-semibold tracking-[0.08em] text-[#C2410C]">{t('tools:filter.workerOn', { name: worker.fullName ?? worker.username })}</Mono>
                    <button type="button" onClick={() => { setWorker(null); setToolsPage(0); }} aria-label={t('common:buttons.close')} className={cn('text-[#C2410C] hover:text-[#F97316]', FOCUS_RING)}>
                      <X className="w-3 h-3" strokeWidth={2.4} />
                    </button>
                  </span>
                ) : (
                  <MonoSelect
                    value=""
                    onChange={e => { setWorker(workers.find(w => String(w.id) === e.target.value) ?? null); setToolsPage(0); }}
                    className="py-1.5"
                    aria-label={t('tools:filter.worker')}
                  >
                    <option value="">{t('tools:filter.worker')}</option>
                    {workers.map(w => <option key={w.id} value={w.id}>{w.fullName ?? w.username}</option>)}
                  </MonoSelect>
                )}
              </>
            ) : (
              <>
                <MonoSelect value={light} onChange={e => { setLight(e.target.value as '' | StockLight); setConsumablesPage(0); }} className="py-1.5" aria-label={t('tools:filter.light')}>
                  <option value="">{t('tools:filter.light')}</option>
                  <option value="IN">{t('tools:consumable.status.inStock')}</option>
                  <option value="LOW">{t('tools:consumable.status.lowStock')}</option>
                  <option value="OUT">{t('tools:consumable.status.outOfStock')}</option>
                </MonoSelect>
                {units.length > 0 && (
                  <MonoSelect value={unit} onChange={e => { setUnit(e.target.value); setConsumablesPage(0); }} className="py-1.5" aria-label={t('tools:filter.unit')}>
                    <option value="">{t('tools:filter.unit')}</option>
                    {units.map(u => <option key={u} value={u}>{u}</option>)}
                  </MonoSelect>
                )}
              </>
            )}

            <div className="ml-auto flex items-center gap-2">
              {filterCount > 0 && (
                <button
                  type="button"
                  onClick={returnable ? clearToolFilters : clearConsumableFilters}
                  className={cn('font-bt-mono text-[9.5px] uppercase tracking-[0.1em] font-semibold text-[#C2410C] hover:text-[#F97316]', FOCUS_RING)}
                >
                  {t('tools:filter.clear', { count: filterCount })} ✕
                </button>
              )}
              <SecondaryButton onClick={() => { setReloadNonce(n => n + 1); fetchSummaries(); }} className="text-[10px] px-2.5 py-[7px] bg-[#FAF7F0] gap-1.5">
                <RefreshCw className={cn('w-3 h-3', (returnable ? toolsState : consumablesState) === 'loading' && 'animate-spin')} />
                <span className="hidden sm:inline">{t('common:buttons.refresh')}</span>
              </SecondaryButton>
            </div>
          </div>
          <Mono className="block text-[9px] tracking-[0.08em] text-[#A69C8D] mt-2">
            {worker
              ? t('tools:filter.workerNote')
              : t('tools:filter.serverNote', { shown, total })}
          </Mono>
        </div>

        {returnable ? (
          <ToolsTable
            state={toolsState}
            tools={tools}
            lang={lang}
            filterCount={toolFilterCount}
            totalTools={toolSummary?.total ?? null}
            flashId={flashId}
            onOpen={setOpenTool}
            onRegister={() => { setFormTool(null); setFormOpen(true); }}
            onRetry={() => { setReloadNonce(n => n + 1); fetchSummaries(); }}
            onClearFilters={clearToolFilters}
            onGoConsumables={() => setTab('consumable')}
          />
        ) : (
          <ConsumablesTable
            state={consumablesState}
            consumables={consumables}
            lang={lang}
            filterCount={consumableFilterCount}
            total={consumableSummary?.total ?? null}
            flashId={flashId}
            onAdjust={setMinimumTarget}
            onRegister={() => setConsumableFormOpen(true)}
            onRetry={() => { setReloadNonce(n => n + 1); fetchSummaries(); }}
            onClearFilters={clearConsumableFilters}
          />
        )}

        {(returnable ? toolsState : consumablesState) === 'data' && (
          <div className="flex items-center justify-between gap-4 flex-wrap pb-2">
            <Mono className="text-[10px] tracking-[0.06em] text-[#8A8175]">
              {filterCount > 0
                ? t('tools:page.rangeFiltered', { start: page * pageSize + 1, end: page * pageSize + shown, total })
                : t('tools:page.range', { start: page * pageSize + 1, end: page * pageSize + shown, total })}
              {!returnable && ` · ${t('tools:page.consumablesOrder')}`}
            </Mono>
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-[7px]">
                <Mono className="text-[10px] tracking-[0.08em] text-[#8A8175]">{t('tools:page.size')}</Mono>
                <MonoSelect value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setToolsPage(0); setConsumablesPage(0); }} className="px-[9px] py-1.5" aria-label={t('tools:page.size')}>
                  {PAGE_SIZES.map(n => <option key={n} value={n}>{n}</option>)}
                </MonoSelect>
              </div>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} aria-label={t('common:buttons.prev')}
                  className={cn('w-[30px] h-[30px] border border-[#DBD0BB] bg-[#FAF7F0] flex items-center justify-center text-[#0B0A09] hover:border-[#F97316] hover:text-[#C2410C] disabled:text-[#B4A992] disabled:hover:border-[#DBD0BB]', FOCUS_RING)}>
                  <ChevronLeft className="w-3 h-3" strokeWidth={2.4} />
                </button>
                <Mono className="text-[11px] tracking-[0.06em] text-[#0B0A09] min-w-[104px] text-center">
                  {t('tools:page.number', { current: page + 1, total: Math.max(pages, 1) })}
                </Mono>
                <button type="button" onClick={() => setPage(Math.min(pages - 1, page + 1))} disabled={page >= pages - 1} aria-label={t('common:buttons.next')}
                  className={cn('w-[30px] h-[30px] border border-[#DBD0BB] bg-[#FAF7F0] flex items-center justify-center text-[#0B0A09] hover:border-[#F97316] hover:text-[#C2410C] disabled:text-[#B4A992] disabled:hover:border-[#DBD0BB]', FOCUS_RING)}>
                  <ChevronRight className="w-3 h-3" strokeWidth={2.4} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <ToolWindow
        open={openTool != null}
        onOpenChange={open => { if (!open) setOpenTool(null); }}
        tool={openTool}
        lang={lang}
        keepers={keepers}
        onGoUsers={() => onNavigate?.('users')}
        onEdit={() => { if (openTool) { setFormTool(openTool); setOpenTool(null); setFormOpen(true); } }}
        onFixStatus={() => { if (openTool) { setFixTool(openTool); setOpenTool(null); } }}
      />
      <ToolFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        tool={formTool}
        onSaved={(tool, mode) => {
          if (mode === 'edit') { afterToolChange(tool); return; }
          clearToolFilters();
          setReloadNonce(n => n + 1);
          setFlashId(tool.id);
          fetchSummaries();
        }}
      />
      <FixStatusModal
        open={fixTool != null}
        onOpenChange={open => { if (!open) setFixTool(null); }}
        tool={fixTool}
        lang={lang}
        keepers={keepers}
        onGoUsers={() => onNavigate?.('users')}
        onFixed={afterToolChange}
      />
      <ConsumableFormModal
        open={consumableFormOpen}
        onOpenChange={setConsumableFormOpen}
        onSaved={() => { setTab('consumable'); clearConsumableFilters(); setReloadNonce(n => n + 1); fetchSummaries(); }}
      />
      <MinimumStockModal
        open={minimumTarget != null}
        onOpenChange={open => { if (!open) setMinimumTarget(null); }}
        consumable={minimumTarget}
        onSaved={saved => {
          setConsumables(prev => prev.map(c => (c.id === saved.id ? saved : c)));
          setFlashId(saved.id);
          fetchSummaries();
        }}
      />
    </>
  );
}
