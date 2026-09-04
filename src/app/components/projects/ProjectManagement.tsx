import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ChevronLeft, ChevronRight, MoreVertical, Plus, RefreshCw, Search } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { cn } from '../ui/utils';
import { isProjectClosed } from '../../helpers/project-utils';
import { businessToday } from '../../helpers/dateTime';
import {
  getProjectsSummary, listProjects as apiListProjects,
  type ProjectResponse, type ProjectStatus, type ProjectSummary,
} from '../../services/projects';
import { listActiveUsers } from '../../services/users';
import { listClients, type ClientResponse } from '../../services/clients';
import { getBranding } from '../../services/branding';
import { ApiError } from '../../lib/api';
import { FIELD_LIMITS } from '../../../shared/fieldLimits';
import { FOCUS_RING, SecondaryButton, PrimaryButton } from '../onboarding/chrome';

import type { Project, UserForAssign, Role, ProjectView } from './types';
import { toProject, apiErrorMsg } from './helpers';
import { AssignedAvatars, ContractBar, IncompleteChip, StatusBadge } from './badges';
import { Bone, CreateButton, EmptyWord, Mono, MonoSelect, PaperNote, stampDate, stampDay } from './bt';
import { AssignUsersModal } from './AssignUsersModal';
import { ToggleStatusModal } from './ToggleStatusModal';
import { CloseProjectModal } from './CloseProjectModal';
import { DeleteProjectModal } from './DeleteProjectModal';
import { ProjectDetailsView } from './ProjectDetailsView';
import { ProjectWindow } from './ProjectWindow';

/**
 * Proyectos — the list, in the panel's industrial language (Claude Design
 * "Proyectos BuildTrack", 2026-09).
 *
 * The screen's opinion: a portfolio is judged by what needs a hand today, so
 * it leads with the two counts that demand action — incomplete jobsites
 * (accounting blocked until they get client, code and contract) and jobsites
 * in the red — and both are one click away from becoming the filter. Every
 * row says at a glance who the job is for, who can clock in there and how
 * much of the budget is gone.
 *
 * Filters, page and page size live here, so they survive opening a ficha and
 * coming back; leaving the section forgets them, which is what the tour
 * copy promises ("mientras trabajas en la sección").
 */

const PAGE_SIZES = [10, 20, 50] as const;
/** Which kind of record the "Ficha" filter narrows to. */
type RecordFilter = '' | 'incomplete' | 'overBudget';

const ROW_GRID = 'grid grid-cols-[2.1fr_.9fr_1fr_1.5fr_.8fr_40px] gap-4 items-center';

/** What an incomplete project is missing, as row copy ("sin código · sin cliente"). */
function missingParts(p: Project, t: (k: string) => string): string[] {
  const out: string[] = [];
  if (!p.clientId) out.push(t('admin:projectMgmt.row.noClient'));
  if (!p.costCode) out.push(t('admin:projectMgmt.row.noCode'));
  if (p.originalContractCents == null || p.originalContractCents <= 0) out.push(t('admin:projectMgmt.row.noContract'));
  return out;
}

export function isIncomplete(p: Project): boolean {
  return p.status !== 'CLOSED' && (!p.clientId || !p.costCode || p.originalContractCents == null || p.originalContractCents <= 0);
}

export function ProjectManagement() {
  const { t, i18n } = useTranslation(['admin', 'common']);
  const lang = i18n.language;
  const [projects, setProjects] = useState<Project[]>([]);
  const [view, setView] = useState<ProjectView>('list');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // Loading & error
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | ProjectStatus>('');
  const [clientFilter, setClientFilter] = useState<number | ''>('');
  const [recordFilter, setRecordFilter] = useState<RecordFilter>('');
  const [pageSize, setPageSize] = useState<number>(20);
  const [currentPage, setCurrentPage] = useState(0); // 0-based for backend
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // The three leading numbers. Null until they arrive; "—" if they never do.
  const [summary, setSummary] = useState<ProjectSummary | null>(null);
  const [summaryFailed, setSummaryFailed] = useState(false);
  const [clients, setClients] = useState<ClientResponse[]>([]);
  const [orgName, setOrgName] = useState<string | null>(null);

  // Users cache for avatars & details view
  const [allUsers, setAllUsers] = useState<UserForAssign[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  // Windows
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [toggleStatusOpen, setToggleStatusOpen] = useState(false);
  const [closeProjectOpen, setCloseProjectOpen] = useState(false);
  const [deleteProjectOpen, setDeleteProjectOpen] = useState(false);

  // Debounce search
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(0);
    }, 350);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [search]);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await apiListProjects({
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
        clientId: clientFilter === '' ? undefined : clientFilter,
        incomplete: recordFilter === 'incomplete',
        overBudget: recordFilter === 'overBudget',
        page: currentPage,
        size: pageSize,
      });
      setProjects(page.content.map(toProject));
      setTotalElements(page.totalElements);
      setTotalPages(page.totalPages);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setError(t('admin:projectMgmt.noPermission'));
      } else {
        setError(apiErrorMsg(err));
      }
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, clientFilter, recordFilter, currentPage, pageSize, t]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  /** The counts change whenever a project does; cheap enough to refetch with the list. */
  const fetchSummary = useCallback(() => {
    getProjectsSummary()
      .then(s => { setSummary(s); setSummaryFailed(false); })
      .catch(() => setSummaryFailed(true));
  }, []);
  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  // Company name for the kicker, clients for the filter, users for avatars —
  // all decorative or secondary: a failure leaves the list working.
  useEffect(() => {
    getBranding().then(b => setOrgName(b.organizationName)).catch(() => {});
    listClients(undefined, 'ACTIVE', 0, 100).then(p => setClients(p.content)).catch(() => {});
    let cancelled = false;
    setUsersLoading(true);
    listActiveUsers()
      .then(users => {
        if (cancelled) return;
        setAllUsers(users.map(u => ({
          id: u.id, username: u.username, fullName: u.fullName,
          role: u.role as Role, status: u.status as 'ACTIVE' | 'INACTIVE',
        })));
      })
      .catch(() => { /* silent — avatars will just not show */ })
      .finally(() => { if (!cancelled) setUsersLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handleViewDetails = (p: Project) => { setSelectedProject(p); setView('details'); };
  const handleBackToList = () => { setView('list'); setSelectedProject(null); };

  const handleProjectSaved = useCallback((resp: ProjectResponse) => {
    const updated = toProject(resp);
    fetchProjects();
    fetchSummary();
    if (selectedProject?.id === updated.id) setSelectedProject(updated);
  }, [fetchProjects, fetchSummary, selectedProject]);

  const openEdit = useCallback((p: Project) => { setSelectedProject(p); setEditOpen(true); }, []);

  const handleAssigned = useCallback((projectId: number, userIds: number[]) => {
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, assignedUserIds: userIds } : p));
    if (selectedProject?.id === projectId) setSelectedProject(prev => prev ? { ...prev, assignedUserIds: userIds } : null);
  }, [selectedProject]);

  const replaceProject = useCallback((updated: Project) => {
    setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
    if (selectedProject?.id === updated.id) setSelectedProject(updated);
    fetchSummary();
  }, [selectedProject, fetchSummary]);

  const openAssign = useCallback((p: Project) => { setSelectedProject(p); setAssignOpen(true); }, []);
  const openToggleStatus = useCallback((p: Project) => { setSelectedProject(p); setToggleStatusOpen(true); }, []);
  const openCloseProject = useCallback((p: Project) => { setSelectedProject(p); setCloseProjectOpen(true); }, []);
  const openDeleteProject = useCallback((p: Project) => { setSelectedProject(p); setDeleteProjectOpen(true); }, []);

  const handleProjectDeleted = useCallback((projectId: number) => {
    if (selectedProject?.id === projectId) { setSelectedProject(null); setView('list'); }
    fetchProjects();
    fetchSummary();
  }, [selectedProject, fetchProjects, fetchSummary]);

  const hasFilters = !!(search || statusFilter || clientFilter !== '' || recordFilter);
  const clearFilters = () => { setSearch(''); setStatusFilter(''); setClientFilter(''); setRecordFilter(''); setCurrentPage(0); };
  const setRecord = (v: RecordFilter) => { setRecordFilter(v); setCurrentPage(0); };

  // Pagination helpers (UI is 1-based display)
  const displayPage = currentPage + 1;
  const startItem = totalElements === 0 ? 0 : currentPage * pageSize + 1;
  const endItem = Math.min((currentPage + 1) * pageSize, totalElements);

  const today = useMemo(() => stampDay(businessToday(), lang), [lang]);

  // Details view
  if (view === 'details' && selectedProject) {
    return (
      <>
        <ProjectDetailsView
          project={selectedProject}
          allUsers={allUsers}
          usersLoading={usersLoading}
          onBack={handleBackToList}
          onAssign={() => setAssignOpen(true)}
          onToggleStatus={() => setToggleStatusOpen(true)}
          onCloseProject={() => setCloseProjectOpen(true)}
          onEdit={() => setEditOpen(true)}
        />
        {editOpen && (
          <ProjectWindow onClose={() => setEditOpen(false)} onSaved={handleProjectSaved} editProject={selectedProject} />
        )}
        <AssignUsersModal project={selectedProject} open={assignOpen} onClose={() => setAssignOpen(false)} onAssigned={handleAssigned} />
        <ToggleStatusModal project={selectedProject} open={toggleStatusOpen} onClose={() => setToggleStatusOpen(false)} onConfirmed={replaceProject} />
        <CloseProjectModal project={selectedProject} open={closeProjectOpen} onClose={() => setCloseProjectOpen(false)} onConfirmed={replaceProject} />
      </>
    );
  }

  const listState = loading ? 'loading' : error ? 'error' : projects.length === 0 ? (hasFilters ? 'noMatch' : 'empty') : 'data';

  const menuFor = (project: Project) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t('admin:projectMgmt.projectActions')}
          onClick={e => e.stopPropagation()}
          className={cn(
            'w-7 h-7 flex items-center justify-center border bg-white transition-colors flex-shrink-0 justify-self-end',
            isIncomplete(project) ? 'border-[#F97316] text-[#C2410C]' : 'border-[#DBD0BB] text-[#5A5346] hover:border-[#F97316] hover:text-[#C2410C]',
            FOCUS_RING,
          )}
        >
          <MoreVertical className="w-3.5 h-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[236px] rounded-none border-[#CDBFA6] p-0 shadow-[0_16px_48px_rgba(23,19,15,0.3)]" onClick={e => e.stopPropagation()}>
        <DropdownMenuLabel className="font-bt-mono text-[9.5px] font-normal uppercase tracking-[0.14em] text-[#8A8175] px-3.5 pt-2.5 pb-2 border-b border-[#EDE7DB] truncate">
          {project.name}
        </DropdownMenuLabel>
        {([
          { key: 'view', label: t('admin:projectMgmt.viewDetails'), onClick: () => handleViewDetails(project) },
          !isProjectClosed(project) && { key: 'assign', label: t('admin:projectMgmt.assignUsers'), onClick: () => openAssign(project) },
          !isProjectClosed(project) && {
            key: 'toggle', sep: true,
            label: project.status === 'ACTIVE' ? t('admin:projectMgmt.setInactive') : t('admin:projectMgmt.setActive'),
            onClick: () => openToggleStatus(project),
          },
          !isProjectClosed(project) && { key: 'close', danger: true, label: t('admin:projectMgmt.closeProject'), onClick: () => openCloseProject(project) },
          { key: 'delete', danger: true, label: t('admin:projectMgmt.deleteProject'), onClick: () => openDeleteProject(project) },
        ] as Array<false | { key: string; label: string; onClick: () => void; danger?: boolean; sep?: boolean }>)
          .filter((it): it is { key: string; label: string; onClick: () => void; danger?: boolean; sep?: boolean } => !!it)
          .map(it => (
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

  return (
    <>
      <div className="space-y-4">
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-end justify-between gap-5 flex-wrap">
          <div>
            <Mono className="block text-[11px] tracking-[0.15em] text-[#8A8175]">
              {t('admin:projectMgmt.kicker')}{orgName && <span className="normal-case"> · {orgName.toUpperCase()}</span>}
            </Mono>
            <h2 className="font-bt-display font-extrabold uppercase text-[38px] md:text-[50px] leading-[0.92] tracking-[0.01em] text-[#0A0A0A] mt-1">
              {t('admin:projectMgmt.title')}
            </h2>
            <Mono className="block text-[11px] md:text-[12.5px] tracking-[0.06em] text-[#5A5346] mt-2">
              {summary
                ? <>{t('admin:projectMgmt.countLine', { total: summary.total, active: summary.active })}
                    {summary.incomplete > 0 && <span className="text-[#EA580C]"> · {t('admin:projectMgmt.countIncomplete', { count: summary.incomplete })}</span>}</>
                : t('admin:projectMgmt.subtitle')}
            </Mono>
          </div>
          <div className="flex items-center gap-3.5 flex-shrink-0 w-full md:w-auto">
            <div className="text-right hidden md:block">
              <Mono className="block text-[12px] tracking-[0.08em] text-[#0A0A0A]">{t('admin:dash.todayStamp', { date: today })}</Mono>
              <Mono className="block text-[10px] tracking-[0.1em] text-[#A69C8D] mt-[3px]">{t('admin:projectMgmt.stamp')}</Mono>
            </div>
            <CreateButton onClick={() => setCreateOpen(true)} className="w-full md:w-auto py-3.5 md:py-3">
              <Plus className="w-3.5 h-3.5" strokeWidth={2.4} />{t('admin:projectMgmt.createProject')}
            </CreateButton>
          </div>
        </div>

        {/* ── The three numbers ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 bg-white border border-[#E7E1D5]" data-tour="sec.projects.kpis">
          <div className="px-[22px] py-4 border-b sm:border-b-0 sm:border-r border-[#EDE7DB]">
            <div className="font-bt-display font-extrabold text-[40px] leading-[0.85] text-[#0A0A0A]">{summary ? summary.active : summaryFailed ? '—' : <Bone className="w-10 h-8" />}</div>
            <Mono className="block text-[10.5px] tracking-[0.1em] text-[#5A5346] mt-[5px]">{t('admin:projectMgmt.kpi.active')}</Mono>
          </div>
          <button
            type="button"
            onClick={() => setRecord(recordFilter === 'incomplete' ? '' : 'incomplete')}
            aria-pressed={recordFilter === 'incomplete'}
            className={cn('text-left px-[22px] py-4 border-b sm:border-b-0 sm:border-r border-[#EDE7DB] transition-colors hover:bg-[#FBEDE0]', recordFilter === 'incomplete' && 'bg-[#FBEDE0] shadow-[inset_0_-3px_0_#F97316]', FOCUS_RING, 'focus-visible:outline-offset-[-2px]')}
          >
            <div className="flex items-center gap-2">
              <span className="font-bt-display font-extrabold text-[40px] leading-[0.85] text-[#EA580C]">{summary ? summary.incomplete : summaryFailed ? '—' : <Bone className="w-8 h-8" />}</span>
              {summary && summary.incomplete > 0 && <AlertTriangle className="w-[17px] h-[17px] text-[#EA580C]" strokeWidth={1.9} />}
            </div>
            <Mono className="block text-[10.5px] tracking-[0.1em] text-[#5A5346] mt-[5px]">{t('admin:projectMgmt.kpi.incomplete')}</Mono>
          </button>
          <button
            type="button"
            onClick={() => setRecord(recordFilter === 'overBudget' ? '' : 'overBudget')}
            aria-pressed={recordFilter === 'overBudget'}
            className={cn('text-left px-[22px] py-4 transition-colors hover:bg-[#F3EEE4]', recordFilter === 'overBudget' && 'bg-[#F3EEE4] shadow-[inset_0_-3px_0_#B3402A]', FOCUS_RING, 'focus-visible:outline-offset-[-2px]')}
          >
            <div className="font-bt-display font-extrabold text-[40px] leading-[0.85] text-[#B3402A]">{summary ? summary.overBudget : summaryFailed ? '—' : <Bone className="w-8 h-8" />}</div>
            <Mono className="block text-[10.5px] tracking-[0.1em] text-[#5A5346] mt-[5px]">{t('admin:projectMgmt.kpi.overBudget')}</Mono>
          </button>
        </div>

        {/* ── Filters ────────────────────────────────────────────────── */}
        <div className="bg-white border border-[#E7E1D5] p-3.5 md:px-4" data-tour="sec.projects.filters">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 min-w-[200px] md:max-w-[320px]">
              <Search className="w-3.5 h-3.5 text-[#A69C8D] absolute left-[11px] top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('admin:projectMgmt.searchPlaceholder')}
                maxLength={FIELD_LIMITS.SEARCH}
                className={cn('w-full border border-[#DBD0BB] bg-[#FAF7F0] py-[9px] pl-8 pr-3 text-[13px] text-[#0A0A0A] outline-none focus:border-[#F97316]', FOCUS_RING)}
              />
            </div>
            <MonoSelect value={statusFilter} onChange={e => { setStatusFilter(e.target.value as '' | ProjectStatus); setCurrentPage(0); }} className="hidden md:block">
              <option value="">{t('admin:projectMgmt.filter.status')}</option>
              <option value="ACTIVE">{t('common:status.active')}</option>
              <option value="INACTIVE">{t('common:status.inactive')}</option>
              <option value="CLOSED">{t('common:status.closed')}</option>
            </MonoSelect>
            <MonoSelect value={clientFilter} onChange={e => { setClientFilter(e.target.value === '' ? '' : Number(e.target.value)); setCurrentPage(0); }} className="hidden md:block max-w-[220px]">
              <option value="">{t('admin:projectMgmt.filter.client')}</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </MonoSelect>
            <MonoSelect value={recordFilter} onChange={e => setRecord(e.target.value as RecordFilter)} className="hidden md:block">
              <option value="">{t('admin:projectMgmt.filter.record')}</option>
              <option value="incomplete">{t('admin:projectMgmt.filter.incomplete')}</option>
              <option value="overBudget">{t('admin:projectMgmt.filter.overBudget')}</option>
            </MonoSelect>
            <div className="ml-auto flex items-center gap-2">
              {hasFilters && (
                <button type="button" onClick={clearFilters} className={cn('font-bt-mono text-[10.5px] uppercase tracking-[0.1em] font-semibold text-[#C2410C] hover:text-[#F97316] px-1', FOCUS_RING)}>
                  {t('admin:projectMgmt.filter.clear')} ✕
                </button>
              )}
              <SecondaryButton onClick={() => { fetchProjects(); fetchSummary(); }} disabled={loading} className="text-[10.5px] px-3 py-[9px] bg-[#FAF7F0] gap-1.5">
                <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />{t('common:buttons.refresh')}
              </SecondaryButton>
            </div>
          </div>
          {/* Phone: status as chips */}
          <div className="flex gap-[7px] overflow-x-auto pb-0.5 mt-3 md:hidden">
            {([['', t('admin:projectMgmt.filter.all')], ['ACTIVE', t('common:status.active')], ['INACTIVE', t('common:status.inactive')], ['CLOSED', t('common:status.closed')]] as const).map(([v, label]) => (
              <button key={v} type="button" onClick={() => { setStatusFilter(v as '' | ProjectStatus); setCurrentPage(0); }}
                className={cn('font-bt-mono text-[10px] uppercase tracking-[0.08em] px-[11px] py-2 whitespace-nowrap', statusFilter === v ? 'bg-[#0A0A0A] text-[#F5F1E8]' : 'border border-[#DBD0BB] text-[#5A5346]', FOCUS_RING)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Table / cards ──────────────────────────────────────────── */}
        <div className="bg-white border border-[#E7E1D5]" data-tour="sec.projects.table">
          {listState === 'error' && (
            <EmptyWord tone="red" word={t('admin:projectMgmt.error.big')} title={t('admin:projectMgmt.error.title')} hint={t('admin:projectMgmt.error.hint')} className="border-0"
              action={<SecondaryButton onClick={fetchProjects} className="bg-[#FAF7F0]">{t('common:buttons.retry')}</SecondaryButton>} />
          )}
          {listState === 'empty' && (
            <EmptyWord word={t('admin:projectMgmt.empty.big')} title={t('admin:projectMgmt.noProjects')} hint={t('admin:projectMgmt.noProjectsHint')} className="border-0 py-[76px]"
              action={<CreateButton onClick={() => setCreateOpen(true)}><Plus className="w-3.5 h-3.5" strokeWidth={2.4} />{t('admin:projectMgmt.createProject')}</CreateButton>} />
          )}
          {listState === 'noMatch' && (
            <EmptyWord word={t('admin:projectMgmt.noMatch.big')} title={t('admin:projectMgmt.noMatch.title')} className="border-0"
              action={<SecondaryButton onClick={clearFilters} className="bg-[#FAF7F0]">{t('admin:projectMgmt.filter.clear')}</SecondaryButton>} />
          )}

          {(listState === 'data' || listState === 'loading') && (
            <>
              {/* Desktop */}
              <div className="hidden md:block">
                <div className={cn(ROW_GRID, 'px-5 py-[11px] border-b border-[#EDE7DB] bg-[#FBF8F2] font-bt-mono text-[10px] uppercase tracking-[0.13em] text-[#8A8175]')}>
                  <span>{t('admin:projectMgmt.table.project')}</span>
                  <span>{t('common:labels.status')}</span>
                  <span>{t('admin:projectMgmt.table.team')}</span>
                  <span>{t('admin:projectMgmt.table.contract')}</span>
                  <span>{t('admin:projectMgmt.table.created')}</span>
                  <span />
                </div>
                {listState === 'loading' && Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className={cn(ROW_GRID, 'px-5 py-[15px] border-b border-[#F0EBE1]')}>
                    <div className="space-y-2"><Bone className="w-[56%] h-[13px]" /><Bone className="w-[72%] h-[9px]" /></div>
                    <Bone className="w-14 h-5" /><Bone className="w-20 h-6" /><Bone className="w-full h-[26px]" /><Bone className="w-16 h-3" /><Bone className="w-7 h-7 justify-self-end" />
                  </div>
                ))}
                {listState === 'data' && projects.map((project, idx) => {
                  const incomplete = isIncomplete(project);
                  return (
                    <div
                      key={project.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleViewDetails(project)}
                      onKeyDown={e => { if (e.key === 'Enter') handleViewDetails(project); }}
                      className={cn(
                        ROW_GRID, 'px-5 py-[13px] border-b border-[#F0EBE1] border-l-2 cursor-pointer transition-colors group',
                        incomplete ? 'border-l-[#F97316] bg-[#FBF8F2]' : 'border-l-transparent hover:bg-[#FBF8F2] hover:border-l-[#F97316]',
                        project.status === 'INACTIVE' && 'opacity-[0.72]',
                        FOCUS_RING, 'focus-visible:outline-offset-[-2px]',
                      )}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[15px] font-semibold text-[#0A0A0A] truncate">{project.name}</span>
                          {incomplete && <IncompleteChip />}
                        </div>
                        <Mono className="block text-[10.5px] tracking-[0.04em] text-[#A69C8D] mt-[3px] truncate">
                          {incomplete
                            ? missingParts(project, t).join(' · ')
                            : [project.costCode, project.clientName].filter(Boolean).join(' · ') || t('admin:projectMgmt.row.noClient')}
                        </Mono>
                      </div>
                      <div><StatusBadge status={project.status} /></div>
                      <AssignedAvatars userIds={project.assignedUserIds} allUsers={allUsers} />
                      <div>
                        {incomplete && (project.originalContractCents == null || project.originalContractCents <= 0) ? (
                          <div>
                            <div className="flex justify-between items-baseline gap-2">
                              <Mono className="text-[11.5px] tracking-[0.04em] normal-case text-[#A69C8D]">{t('admin:projectMgmt.row.notDefined')}</Mono>
                              <button type="button" onClick={e => { e.stopPropagation(); openEdit(project); }} className={cn('font-bt-mono text-[10px] uppercase tracking-[0.08em] font-semibold text-[#C2410C] hover:text-[#F97316]', FOCUS_RING)}>
                                {t('admin:projectMgmt.row.complete')}
                              </button>
                            </div>
                            <div className="h-[5px] bg-[#EDE5D6] mt-[5px]" />
                          </div>
                        ) : (
                          <ContractBar originalContractCents={project.originalContractCents} revisedContractCents={project.revisedContractCents} budgetBaseCents={project.budgetBaseCents} remainingCents={project.remainingBudgetCents} />
                        )}
                      </div>
                      <Mono className="text-[10.5px] text-[#8A8175]">{stampDate(project.createdAt, lang)}</Mono>
                      {/* The first row's menu anchors the tour's last stop (a literal attribute: the registry test greps for it). */}
                      {idx === 0 ? <span data-tour="sec.projects.menu" className="justify-self-end">{menuFor(project)}</span> : menuFor(project)}
                    </div>
                  );
                })}
              </div>

              {/* Phone: cards */}
              <div className="md:hidden p-3.5 space-y-3">
                {listState === 'loading' && Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="border border-[#E7E1D5] p-3.5 space-y-2"><Bone className="w-2/3 h-[13px]" /><Bone className="w-1/2 h-[9px]" /><Bone className="w-full h-[5px] mt-3" /></div>
                ))}
                {listState === 'data' && projects.map(project => {
                  const incomplete = isIncomplete(project);
                  return (
                    <div
                      key={project.id}
                      className={cn('border border-[#E7E1D5] border-l-2 p-3.5', incomplete ? 'border-l-[#F97316]' : 'border-l-transparent', project.status === 'CLOSED' && 'opacity-80')}
                      onClick={() => handleViewDetails(project)}
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="text-[15px] font-semibold text-[#0A0A0A] leading-[1.3]">{project.name}</div>
                        {incomplete ? <IncompleteChip className="flex-shrink-0" /> : <StatusBadge status={project.status} className="flex-shrink-0" />}
                      </div>
                      <Mono className="block text-[10px] tracking-[0.04em] text-[#A69C8D] mt-1">
                        {incomplete ? missingParts(project, t).join(' · ') : [project.costCode, project.clientName].filter(Boolean).join(' · ') || t('admin:projectMgmt.row.noClient')}
                      </Mono>
                      {incomplete ? (
                        <>
                          <PaperNote className="mt-2.5 text-[13px]">{t('admin:projectMgmt.row.missing', { list: missingParts(project, t).join(', ').toLowerCase() })}</PaperNote>
                          <PrimaryButton onClick={e => { e.stopPropagation(); openEdit(project); }} className="w-full mt-3 py-3.5 text-[10.5px]">{t('admin:projectMgmt.row.completeRecord')}</PrimaryButton>
                        </>
                      ) : (
                        <ContractBar className="mt-3" originalContractCents={project.originalContractCents} revisedContractCents={project.revisedContractCents} budgetBaseCents={project.budgetBaseCents} remainingCents={project.remainingBudgetCents} />
                      )}
                      <div className="flex items-center justify-between mt-3">
                        <AssignedAvatars userIds={project.assignedUserIds} allUsers={allUsers} />
                        <div className="flex items-center gap-2">
                          <Mono className="text-[10px] text-[#8A8175]">{stampDate(project.createdAt, lang)}</Mono>
                          {menuFor(project)}
                        </div>
                      </div>
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
            <Mono className="text-[10.5px] tracking-[0.06em] text-[#8A8175]">{t('admin:projectMgmt.showingRange', { start: startItem, end: endItem, total: totalElements })}</Mono>
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-[7px]">
                <Mono className="text-[10px] tracking-[0.08em] text-[#8A8175]">{t('admin:projectMgmt.perPage')}</Mono>
                <MonoSelect value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(0); }} className="px-[9px] py-1.5">
                  {PAGE_SIZES.map(n => <option key={n} value={n}>{n}</option>)}
                </MonoSelect>
              </div>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => setCurrentPage(p => Math.max(0, p - 1))} disabled={currentPage === 0} aria-label={t('common:buttons.prev')}
                  className={cn('w-[30px] h-[30px] border border-[#DBD0BB] bg-[#FAF7F0] flex items-center justify-center text-[#0A0A0A] hover:border-[#F97316] hover:text-[#C2410C] disabled:text-[#B4A992] disabled:hover:border-[#DBD0BB]', FOCUS_RING)}>
                  <ChevronLeft className="w-3 h-3" strokeWidth={2.4} />
                </button>
                <Mono className="text-[11px] tracking-[0.06em] text-[#0A0A0A] min-w-[96px] text-center">{t('admin:projectMgmt.page', { current: displayPage, total: Math.max(totalPages, 1) })}</Mono>
                <button type="button" onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))} disabled={currentPage >= totalPages - 1} aria-label={t('common:buttons.next')}
                  className={cn('w-[30px] h-[30px] border border-[#DBD0BB] bg-[#FAF7F0] flex items-center justify-center text-[#0A0A0A] hover:border-[#F97316] hover:text-[#C2410C] disabled:text-[#B4A992] disabled:hover:border-[#DBD0BB]', FOCUS_RING)}>
                  <ChevronRight className="w-3 h-3" strokeWidth={2.4} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {createOpen && <ProjectWindow onClose={() => setCreateOpen(false)} onSaved={handleProjectSaved} />}
      {editOpen && selectedProject && <ProjectWindow onClose={() => setEditOpen(false)} onSaved={handleProjectSaved} editProject={selectedProject} />}
      <AssignUsersModal project={selectedProject} open={assignOpen} onClose={() => setAssignOpen(false)} onAssigned={handleAssigned} />
      <ToggleStatusModal project={selectedProject} open={toggleStatusOpen} onClose={() => setToggleStatusOpen(false)} onConfirmed={replaceProject} />
      <CloseProjectModal project={selectedProject} open={closeProjectOpen} onClose={() => setCloseProjectOpen(false)} onConfirmed={replaceProject} />
      <DeleteProjectModal project={selectedProject} open={deleteProjectOpen} onClose={() => setDeleteProjectOpen(false)} onDeleted={handleProjectDeleted} />
    </>
  );
}
