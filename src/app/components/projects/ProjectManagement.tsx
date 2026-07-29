import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FolderOpen, Plus, Search, MoreVertical,
  AlertCircle, Loader2, RefreshCw, Filter,
  UserPlus, PowerOff, Power, Lock, ShieldAlert, Trash2,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Skeleton } from '../ui/skeleton';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '../ui/select';
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '../ui/table';
import { isProjectClosed } from '../../helpers/project-utils';
import { ProjectFormDialog } from '../ProjectFormDialog';
import {
  listProjects as apiListProjects,
  type ProjectResponse,
  type ProjectStatus,
} from '../../services/projects';
import { listActiveUsers } from '../../services/users';
import { ApiError } from '../../lib/api';

import type { Project, UserForAssign, Role, ProjectView } from './types';
import { ITEMS_PER_PAGE } from './types';
import { toProject, fmtDate, apiErrorMsg } from './helpers';
import { StatusBadge, AssignedAvatars, ContractBar } from './badges';
import { AssignUsersModal } from './AssignUsersModal';
import { ToggleStatusModal } from './ToggleStatusModal';
import { CloseProjectModal } from './CloseProjectModal';
import { DeleteProjectModal } from './DeleteProjectModal';
import { ProjectDetailsView } from './ProjectDetailsView';
import { FIELD_LIMITS } from '../../../shared/fieldLimits';

// MAIN PROJECT MANAGEMENT

export function ProjectManagement() {
  const { t, i18n } = useTranslation(['admin', 'common']);
  const [projects, setProjects] = useState<Project[]>([]);
  const [view, setView] = useState<ProjectView>('list');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');

  // Loading & error
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(0); // 0-based for backend
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Users cache for avatars & details view
  const [allUsers, setAllUsers] = useState<UserForAssign[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  // Modals
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

  // Fetch projects
  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await apiListProjects({
        search: debouncedSearch || undefined,
        status: statusFilter !== 'all' ? (statusFilter as ProjectStatus) : undefined,
        page: currentPage,
        size: ITEMS_PER_PAGE,
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
  }, [debouncedSearch, statusFilter, currentPage]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  // Load users for avatars (once)
  useEffect(() => {
    let cancelled = false;
    setUsersLoading(true);
    listActiveUsers()
      .then(users => {
        if (cancelled) return;
        setAllUsers(users.map(u => ({
          id: u.id,
          username: u.username,
          fullName: u.fullName,
          role: u.role as Role,
          status: u.status as 'ACTIVE' | 'INACTIVE',
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
    // Refresh list for accurate pagination on create, or update local state on edit
    fetchProjects();
    if (selectedProject?.id === updated.id) setSelectedProject(updated);
  }, [fetchProjects, selectedProject]);

  const openEdit = useCallback((p: Project) => { setSelectedProject(p); setEditOpen(true); }, []);

  const handleAssigned = useCallback((projectId: number, userIds: number[]) => {
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, assignedUserIds: userIds } : p));
    if (selectedProject?.id === projectId) setSelectedProject(prev => prev ? { ...prev, assignedUserIds: userIds } : null);
  }, [selectedProject]);

  const handleStatusToggled = useCallback((updated: Project) => {
    setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
    if (selectedProject?.id === updated.id) setSelectedProject(updated);
  }, [selectedProject]);

  const handleProjectClosed = useCallback((updated: Project) => {
    setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
    if (selectedProject?.id === updated.id) setSelectedProject(updated);
  }, [selectedProject]);

  const openAssign = useCallback((p: Project) => { setSelectedProject(p); setAssignOpen(true); }, []);
  const openToggleStatus = useCallback((p: Project) => { setSelectedProject(p); setToggleStatusOpen(true); }, []);
  const openCloseProject = useCallback((p: Project) => { setSelectedProject(p); setCloseProjectOpen(true); }, []);
  const openDeleteProject = useCallback((p: Project) => { setSelectedProject(p); setDeleteProjectOpen(true); }, []);

  const handleProjectDeleted = useCallback((projectId: number) => {
    if (selectedProject?.id === projectId) { setSelectedProject(null); setView('list'); }
    // Refresh so pagination/count stay accurate
    fetchProjects();
  }, [selectedProject, fetchProjects]);

  // Pagination helpers (UI is 1-based display)
  const displayPage = currentPage + 1;
  const startItem = currentPage * ITEMS_PER_PAGE + 1;
  const endItem = Math.min((currentPage + 1) * ITEMS_PER_PAGE, totalElements);

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
        <ProjectFormDialog
          open={editOpen}
          onClose={() => setEditOpen(false)}
          onSaved={handleProjectSaved}
          editProject={selectedProject}
        />
        <AssignUsersModal project={selectedProject} open={assignOpen} onClose={() => setAssignOpen(false)} onAssigned={handleAssigned} />
        <ToggleStatusModal project={selectedProject} open={toggleStatusOpen} onClose={() => setToggleStatusOpen(false)} onConfirmed={handleStatusToggled} />
        <CloseProjectModal project={selectedProject} open={closeProjectOpen} onClose={() => setCloseProjectOpen(false)} onConfirmed={handleProjectClosed} />
      </>
    );
  }

  // Determine list state
  const listState = loading ? 'loading' : error ? 'error' : projects.length === 0 ? 'empty' : 'data';

  // List view
  return (
    <>
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-[#0A0A0A]">{t('admin:projectMgmt.title')}</h2>
            <p className="text-sm text-[#71717A] mt-1">{t('admin:projectMgmt.subtitle')}</p>
          </div>
          <Button onClick={() => setCreateOpen(true)} disabled={loading}
            className="bg-[#F97316] hover:bg-[#C2410C] text-white gap-2 self-start">
            <Plus className="w-4 h-4" />{t('admin:projectMgmt.createProject')}
          </Button>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#71717A]" />
            <Input value={search} onChange={e => { setSearch(e.target.value); }}
              placeholder={t('admin:projectMgmt.searchPlaceholder')}
              maxLength={FIELD_LIMITS.SEARCH}
              className="pl-10 h-10 border-[#D4D4D8] w-full" />
          </div>
          <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setCurrentPage(0); }}>
            <SelectTrigger className="h-10 border-[#D4D4D8] w-full sm:w-40">
              <div className="flex items-center gap-2"><Filter className="w-3.5 h-3.5 text-[#71717A]" /><SelectValue placeholder={t('common:labels.allStatuses')} /></div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('common:labels.allStatuses')}</SelectItem>
              <SelectItem value="ACTIVE">{t('common:status.active')}</SelectItem>
              <SelectItem value="INACTIVE">{t('common:status.inactive')}</SelectItem>
              <SelectItem value="CLOSED">{t('common:status.closed')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table container */}
        <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
          {/* Toolbar */}
          <div className="px-6 py-4 border-b border-[#D4D4D8] flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-[#0A0A0A]">{t('admin:projectMgmt.projectList')}</h3>
              {listState === 'data' && <p className="text-xs text-[#71717A] mt-0.5">{t('admin:projectMgmt.projectCount', { count: totalElements })}</p>}
            </div>
            {listState === 'data' && (
              <Button variant="ghost" size="sm" onClick={fetchProjects} disabled={loading}
                className="gap-1.5 text-xs text-[#71717A] hover:text-[#0A0A0A]">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />{t('common:buttons.refresh')}
              </Button>
            )}
          </div>

          {/* Error */}
          {listState === 'error' && (
            <div className="p-6">
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-red-900">{t('admin:projectMgmt.failedToLoad')}</p>
                    <p className="text-xs text-red-600 mt-0.5">{error}</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={fetchProjects}
                  className="gap-2 border-red-200 text-red-700 hover:bg-red-50 shrink-0">
                  <RefreshCw className="w-3.5 h-3.5" />{t('common:buttons.retry')}
                </Button>
              </div>
            </div>
          )}

          {/* Desktop table */}
          {viewMode === 'desktop' && listState !== 'error' && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#FAFAFA] border-b border-[#D4D4D8] hover:bg-[#FAFAFA]">
                    <TableHead className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider pl-6">{t('admin:projectMgmt.table.name')}</TableHead>
                    <TableHead className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider">{t('common:labels.status')}</TableHead>
                    <TableHead className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider">{t('admin:projectMgmt.table.assignedUsers')}</TableHead>
                    <TableHead className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider">{t('admin:projectMgmt.table.contract')}</TableHead>
                    <TableHead className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider">{t('admin:projectMgmt.table.created')}</TableHead>
                    <TableHead className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider pr-6 text-right">{t('common:labels.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listState === 'loading' && Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i} className="border-b border-[#D4D4D8]/40">
                      <TableCell className="pl-6 py-4"><Skeleton className="h-4 w-48" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                      <TableCell><div className="flex items-center gap-1"><Skeleton className="w-7 h-7 rounded-full" /><Skeleton className="w-7 h-7 rounded-full" /><Skeleton className="h-4 w-12 ml-1" /></div></TableCell>
                      <TableCell><Skeleton className="h-8 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell className="pr-6"><Skeleton className="h-8 w-8 rounded-lg ml-auto" /></TableCell>
                    </TableRow>
                  ))}
                  {listState === 'empty' && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-20 text-center">
                        <div className="flex flex-col items-center">
                          <div className="w-14 h-14 bg-[#FAFAFA] rounded-full flex items-center justify-center mb-3">
                            <FolderOpen className="w-7 h-7 text-[#D4D4D8]" />
                          </div>
                          <p className="text-sm font-semibold text-[#0A0A0A] mb-1">{t('admin:projectMgmt.noProjects')}</p>
                          <p className="text-xs text-[#71717A] mb-4">{t('admin:projectMgmt.noProjectsHint')}</p>
                          <Button size="sm" onClick={() => setCreateOpen(true)}
                            className="bg-[#F97316] hover:bg-[#C2410C] text-white gap-2">
                            <Plus className="w-4 h-4" />{t('admin:projectMgmt.createProject')}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  {listState === 'data' && projects.map(project => (
                    <TableRow key={project.id} className="border-b border-[#D4D4D8]/40 hover:bg-[#FAFAFA] transition-colors">
                      <TableCell className="pl-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${project.status === 'ACTIVE' ? 'bg-[#F97316]/10' : 'bg-[#FAFAFA]'}`}>
                            <FolderOpen className={`w-4 h-4 ${project.status === 'ACTIVE' ? 'text-[#F97316]' : 'text-[#D4D4D8]'}`} />
                          </div>
                          <span className="text-sm font-semibold text-[#0A0A0A]">{project.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4"><StatusBadge status={project.status} /></TableCell>
                      <TableCell className="py-4">
                        <AssignedAvatars userIds={project.assignedUserIds} allUsers={allUsers} />
                      </TableCell>
                      <TableCell className="py-4">
                        <ContractBar originalContractCents={project.originalContractCents} revisedContractCents={project.revisedContractCents} remainingCents={project.contractAmountCents} />
                      </TableCell>
                      <TableCell className="py-4">
                        <span className="text-xs text-[#71717A]">{fmtDate(project.createdAt, i18n.language)}</span>
                      </TableCell>
                      <TableCell className="py-4 pr-6 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="w-8 h-8 flex items-center justify-center rounded-lg text-[#71717A] hover:text-[#0A0A0A] hover:bg-[#FAFAFA] transition-colors border border-transparent hover:border-[#D4D4D8]">
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuLabel className="text-xs text-[#71717A]">{t('admin:projectMgmt.projectActions')}</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleViewDetails(project)} className="gap-2 cursor-pointer">
                              <FolderOpen className="w-4 h-4" />{t('admin:projectMgmt.viewDetails')}
                            </DropdownMenuItem>
                            {!isProjectClosed(project) && (
                              <DropdownMenuItem onClick={() => openAssign(project)} className="gap-2 cursor-pointer">
                                <UserPlus className="w-4 h-4" />{t('admin:projectMgmt.assignUsers')}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {isProjectClosed(project) ? (
                              <DropdownMenuItem disabled className="gap-2 text-[#71717A] cursor-not-allowed">
                                <Lock className="w-4 h-4" />{t('admin:projectMgmt.projectClosed')}
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => openToggleStatus(project)}
                                className={`gap-2 cursor-pointer ${project.status === 'ACTIVE' ? 'text-red-600 focus:text-red-600' : 'text-emerald-600 focus:text-emerald-600'}`}>
                                {project.status === 'ACTIVE' ? <><PowerOff className="w-4 h-4" />{t('admin:projectMgmt.setInactive')}</> : <><Power className="w-4 h-4" />{t('admin:projectMgmt.setActive')}</>}
                              </DropdownMenuItem>
                            )}
                            {!isProjectClosed(project) && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => openCloseProject(project)}
                                  className="gap-2 cursor-pointer text-red-600 focus:text-red-600">
                                  <ShieldAlert className="w-4 h-4" />{t('admin:projectMgmt.closeProject')}
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openDeleteProject(project)}
                              className="gap-2 cursor-pointer text-red-600 focus:text-red-600">
                              <Trash2 className="w-4 h-4" />{t('admin:projectMgmt.deleteProject')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Mobile card list */}
          {viewMode === 'mobile' && listState !== 'error' && (
            <div>
              {listState === 'loading' && (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="bg-[#FAFAFA] rounded-xl p-4 border border-[#D4D4D8]">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 space-y-2"><Skeleton className="h-4 w-40" /><Skeleton className="h-6 w-16 rounded-full" /><Skeleton className="h-3 w-24" /></div>
                        <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {listState === 'empty' && (
                <div className="flex flex-col items-center justify-center py-14 px-4 text-center">
                  <div className="w-12 h-12 bg-[#FAFAFA] rounded-full flex items-center justify-center mb-3">
                    <FolderOpen className="w-6 h-6 text-[#D4D4D8]" />
                  </div>
                  <p className="text-sm font-semibold text-[#0A0A0A] mb-1">{t('admin:projectMgmt.noProjects')}</p>
                  <p className="text-xs text-[#71717A] mb-4">{t('admin:projectMgmt.noProjectsHint')}</p>
                  <Button size="sm" onClick={() => setCreateOpen(true)}
                    className="bg-[#F97316] hover:bg-[#C2410C] text-white gap-2">
                    <Plus className="w-3.5 h-3.5" />{t('admin:projectMgmt.createProject')}
                  </Button>
                </div>
              )}
              {listState === 'data' && (
                <div className="p-4 space-y-3">
                  {projects.map(project => (
                    <div key={project.id} className="bg-white rounded-xl border border-[#D4D4D8] p-4 hover:border-[#F97316]/30 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[#0A0A0A] truncate mb-1.5">{project.name}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <StatusBadge status={project.status} />
                            <AssignedAvatars userIds={project.assignedUserIds} allUsers={allUsers} />
                          </div>
                          <p className="text-xs text-[#71717A] mt-1.5">{fmtDate(project.createdAt, i18n.language)}</p>
                          {project.originalContractCents != null && (
                            <div className="mt-2">
                              <ContractBar originalContractCents={project.originalContractCents} revisedContractCents={project.revisedContractCents} remainingCents={project.contractAmountCents} />
                            </div>
                          )}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="w-8 h-8 flex items-center justify-center rounded-lg text-[#71717A] hover:bg-[#FAFAFA] border border-[#D4D4D8] flex-shrink-0">
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={() => handleViewDetails(project)} className="gap-2 cursor-pointer"><FolderOpen className="w-4 h-4" />{t('admin:projectMgmt.viewDetails')}</DropdownMenuItem>
                            {!isProjectClosed(project) && (
                              <DropdownMenuItem onClick={() => openAssign(project)} className="gap-2 cursor-pointer"><UserPlus className="w-4 h-4" />{t('admin:projectMgmt.assignUsers')}</DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {isProjectClosed(project) ? (
                              <DropdownMenuItem disabled className="gap-2 text-[#71717A] cursor-not-allowed">
                                <Lock className="w-4 h-4" />{t('admin:projectMgmt.projectClosed')}
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => openToggleStatus(project)}
                                className={`gap-2 cursor-pointer ${project.status === 'ACTIVE' ? 'text-red-600' : 'text-emerald-600'}`}>
                                {project.status === 'ACTIVE' ? <><PowerOff className="w-4 h-4" />{t('admin:projectMgmt.setInactive')}</> : <><Power className="w-4 h-4" />{t('admin:projectMgmt.setActive')}</>}
                              </DropdownMenuItem>
                            )}
                            {!isProjectClosed(project) && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => openCloseProject(project)}
                                  className="gap-2 cursor-pointer text-red-600">
                                  <ShieldAlert className="w-4 h-4" />{t('admin:projectMgmt.closeProject')}
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openDeleteProject(project)}
                              className="gap-2 cursor-pointer text-red-600">
                              <Trash2 className="w-4 h-4" />{t('admin:projectMgmt.deleteProject')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Pagination */}
          {listState === 'data' && totalPages > 1 && (
            <div className="px-6 py-4 border-t border-[#D4D4D8] flex items-center justify-between">
              <p className="text-xs text-[#71717A]">
                {t('admin:projectMgmt.showingRange', { start: startItem, end: endItem, total: totalElements })}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(0, p - 1))} disabled={currentPage === 0}
                  className="h-8 px-3 border-[#D4D4D8] text-xs disabled:opacity-40">{t('common:buttons.prev')}</Button>
                <span className="text-xs text-[#71717A] px-2">{t('admin:projectMgmt.page', { current: displayPage, total: totalPages })}</span>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))} disabled={currentPage >= totalPages - 1}
                  className="h-8 px-3 border-[#D4D4D8] text-xs disabled:opacity-40">{t('common:buttons.next')}</Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ProjectFormDialog open={createOpen} onClose={() => setCreateOpen(false)} onSaved={handleProjectSaved} />
      <AssignUsersModal project={selectedProject} open={assignOpen} onClose={() => setAssignOpen(false)} onAssigned={handleAssigned} />
      <ToggleStatusModal project={selectedProject} open={toggleStatusOpen} onClose={() => setToggleStatusOpen(false)} onConfirmed={handleStatusToggled} />
      <CloseProjectModal project={selectedProject} open={closeProjectOpen} onClose={() => setCloseProjectOpen(false)} onConfirmed={handleProjectClosed} />
      <DeleteProjectModal project={selectedProject} open={deleteProjectOpen} onClose={() => setDeleteProjectOpen(false)} onDeleted={handleProjectDeleted} />
    </>
  );
}
