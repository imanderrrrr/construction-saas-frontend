import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Loader2, UserPlus, ChevronRight, ChevronLeft, X, Users, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Skeleton } from '../ui/skeleton';
import { toast } from 'sonner';
import { setAssignments as apiSetAssignments } from '../../services/projects';
import { listActiveUsers } from '../../services/users';
import { ApiError } from '../../lib/api';
import type { Project, UserForAssign, Role } from './types';
import { apiErrorMsg } from './helpers';
import { UserAvatar, RoleBadge } from './badges';
import { FIELD_LIMITS } from '../../../shared/fieldLimits';

// ── User row used in both panels ────────────────────────────────────────────

function UserRow({
  user,
  tag,
  onClick,
  actionIcon,
}: {
  user: UserForAssign;
  tag?: 'add' | 'remove' | null;
  onClick: () => void;
  actionIcon: React.ReactNode;
}) {
  const rowCls = tag === 'add'
    ? 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100'
    : tag === 'remove'
      ? 'border-red-200 bg-red-50 hover:bg-red-100'
      : 'border-[#D4D4D8] bg-white hover:bg-[#FAFAFA]';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors text-left group ${rowCls}`}
    >
      <UserAvatar user={user} size="md" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold font-mono text-[#0A0A0A] truncate leading-tight">{user.username}</p>
        <p className="text-[11px] text-[#71717A] truncate">{user.fullName || '—'}</p>
      </div>
      <RoleBadge role={user.role} />
      <span className="flex-shrink-0 ml-1 text-[#71717A] group-hover:text-[#F97316] transition-colors">
        {actionIcon}
      </span>
    </button>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export function AssignUsersModal({ project, open, onClose, onAssigned }: {
  project: Project | null;
  open: boolean;
  onClose: () => void;
  onAssigned: (projectId: number, userIds: number[]) => void;
}) {
  const { t } = useTranslation(['admin', 'common']);

  // Users fetched from API
  const [allUsers, setAllUsers] = useState<UserForAssign[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // The "baseline" set that was already saved — never changes during a session
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  // The working set the user is editing right now
  const [workingIds, setWorkingIds] = useState<Set<number>>(new Set());

  const [leftSearch, setLeftSearch] = useState('');
  const [rightSearch, setRightSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Load users once when opened
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setUsersLoading(true);
    setLoadError(null);
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
      .catch(err => {
        if (cancelled) return;
        setLoadError(apiErrorMsg(err));
      })
      .finally(() => { if (!cancelled) setUsersLoading(false); });
    return () => { cancelled = true; };
  }, [open]);

  // Seed working set from project whenever the project or modal opening changes
  useEffect(() => {
    if (!project || !open) return;
    const ids = new Set(project.assignedUserIds);
    setSavedIds(ids);
    setWorkingIds(new Set(ids));
    setLeftSearch('');
    setRightSearch('');
  }, [project, open]);

  const handleClose = () => {
    setIsSaving(false);
    onClose();
  };

  // Derived sets
  const toAdd = useMemo(
    () => new Set([...workingIds].filter(id => !savedIds.has(id))),
    [workingIds, savedIds],
  );
  const toRemove = useMemo(
    () => new Set([...savedIds].filter(id => !workingIds.has(id))),
    [workingIds, savedIds],
  );
  const hasChanges = toAdd.size > 0 || toRemove.size > 0;

  // Left panel: users NOT in workingIds
  const leftUsers = useMemo(() => {
    const q = leftSearch.toLowerCase();
    return allUsers.filter(u => {
      if (workingIds.has(u.id)) return false;
      return !q || u.username.toLowerCase().includes(q) || (u.fullName?.toLowerCase().includes(q) ?? false);
    });
  }, [allUsers, workingIds, leftSearch]);

  // Right panel: users IN workingIds
  const rightUsers = useMemo(() => {
    const q = rightSearch.toLowerCase();
    return allUsers.filter(u => {
      if (!workingIds.has(u.id)) return false;
      return !q || u.username.toLowerCase().includes(q) || (u.fullName?.toLowerCase().includes(q) ?? false);
    });
  }, [allUsers, workingIds, rightSearch]);

  const addUser = (id: number) => setWorkingIds(prev => new Set([...prev, id]));
  const removeUser = (id: number) => setWorkingIds(prev => { const s = new Set(prev); s.delete(id); return s; });

  const handleSave = async () => {
    if (!project || isSaving) return;
    const newIds = Array.from(workingIds);
    setIsSaving(true);
    try {
      await apiSetAssignments(project.id, newIds);
      onAssigned(project.id, newIds);
      // Build a meaningful toast
      const added = toAdd.size;
      const removed = toRemove.size;
      const parts: string[] = [];
      if (added > 0) parts.push(t('admin:projectModals.assign.toastAdded', { count: added }));
      if (removed > 0) parts.push(t('admin:projectModals.assign.toastRemoved', { count: removed }));
      toast.success(t('admin:projectModals.assign.toastSuccess'), {
        description: parts.join(' · ') || t('admin:projectModals.assign.toastNoChange'),
      });
      handleClose();
    } catch (err) {
      const msg = apiErrorMsg(err);
      if (err instanceof ApiError && err.status === 403) {
        toast.error(t('admin:projectModals.assign.toastForbidden'), { description: msg });
      } else {
        toast.error(t('admin:projectModals.assign.toastError'), { description: msg });
      }
      setIsSaving(false);
    }
  };

  if (!open || !project) return null;

  // ── Full-screen overlay ────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#FAFAFA]" role="dialog" aria-modal="true">

      {/* ── Topbar ── */}
      <div className="flex-shrink-0 h-14 bg-white border-b border-[#D4D4D8] flex items-center justify-between px-4 md:px-6 gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 bg-[#F97316]/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <Users className="w-4 h-4 text-[#F97316]" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#0A0A0A] truncate leading-tight">
              {t('admin:projectModals.assign.title')}
            </p>
            <p className="text-[11px] text-[#71717A] truncate">"{project.name}"</p>
          </div>
        </div>

        {/* Diff chips */}
        <div className="hidden sm:flex items-center gap-2">
          {toAdd.size > 0 && (
            <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full">
              +{toAdd.size} {t('admin:projectModals.assign.willAdd')}
            </span>
          )}
          {toRemove.size > 0 && (
            <span className="text-xs font-semibold px-2.5 py-1 bg-red-100 text-red-700 rounded-full">
              −{toRemove.size} {t('admin:projectModals.assign.willRemove')}
            </span>
          )}
          {!hasChanges && !usersLoading && (
            <span className="text-xs text-[#71717A]">
              {t('admin:projectModals.assign.noChanges')}
            </span>
          )}
        </div>

        <button
          onClick={handleClose}
          disabled={isSaving}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-[#71717A] hover:text-[#0A0A0A] hover:bg-[#FAFAFA] border border-[#D4D4D8] transition-colors flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── Error banner ── */}
      {loadError && (
        <div className="flex-shrink-0 mx-4 md:mx-6 mt-4 flex items-center gap-3 p-3 rounded-xl border border-red-200 bg-red-50">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700 flex-1">{loadError}</p>
        </div>
      )}

      {/* ── Two-column body ── */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-4 p-4 md:p-6 overflow-hidden">

        {/* LEFT: available (not assigned) */}
        <div className="flex-1 min-w-0 flex flex-col bg-white border border-[#D4D4D8] rounded-2xl overflow-hidden">
          <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-[#D4D4D8]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[#0A0A0A]">
                {t('admin:projectModals.assign.availableTitle')}
              </h3>
              <span className="text-xs text-[#71717A]">
                {leftUsers.length} {t('admin:projectModals.assign.users')}
              </span>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#71717A]" />
              <Input
                value={leftSearch}
                onChange={e => setLeftSearch(e.target.value)}
                placeholder={t('admin:projectModals.assign.searchPlaceholder')}
                maxLength={FIELD_LIMITS.SEARCH}
                className="pl-9 h-9 text-sm border-[#D4D4D8]"
                disabled={usersLoading || isSaving}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {usersLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5">
                  <Skeleton className="w-9 h-9 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
              ))
            ) : leftUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center mb-3">
                  <Users className="w-5 h-5 text-emerald-500" />
                </div>
                <p className="text-xs text-[#71717A]">
                  {leftSearch
                    ? t('admin:projectModals.assign.noResults')
                    : t('admin:projectModals.assign.allAssigned')}
                </p>
              </div>
            ) : (
              leftUsers.map(user => (
                <UserRow
                  key={user.id}
                  user={user}
                  tag={toRemove.has(user.id) ? 'remove' : null}
                  onClick={() => !isSaving && addUser(user.id)}
                  actionIcon={<ChevronRight className="w-4 h-4" />}
                />
              ))
            )}
          </div>
        </div>

        {/* Separator arrow (desktop) */}
        <div className="hidden md:flex flex-col items-center justify-center gap-2 flex-shrink-0 py-4">
          <div className="w-8 h-8 rounded-full border border-[#D4D4D8] bg-white flex items-center justify-center">
            <ChevronRight className="w-4 h-4 text-[#71717A]" />
          </div>
          <div className="w-px flex-1 bg-[#D4D4D8]" />
          <div className="w-8 h-8 rounded-full border border-[#D4D4D8] bg-white flex items-center justify-center">
            <ChevronLeft className="w-4 h-4 text-[#71717A]" />
          </div>
        </div>

        {/* RIGHT: assigned */}
        <div className="flex-1 min-w-0 flex flex-col bg-white border border-[#D4D4D8] rounded-2xl overflow-hidden">
          <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-[#D4D4D8]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[#0A0A0A]">
                {t('admin:projectModals.assign.assignedTitle')}
              </h3>
              <span className="text-xs font-semibold px-2 py-0.5 bg-[#F97316]/10 text-[#F97316] rounded-full">
                {workingIds.size}
              </span>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#71717A]" />
              <Input
                value={rightSearch}
                onChange={e => setRightSearch(e.target.value)}
                placeholder={t('admin:projectModals.assign.searchPlaceholder')}
                maxLength={FIELD_LIMITS.SEARCH}
                className="pl-9 h-9 text-sm border-[#D4D4D8]"
                disabled={usersLoading || isSaving}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {usersLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5">
                  <Skeleton className="w-9 h-9 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
              ))
            ) : rightUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                <div className="w-10 h-10 bg-[#FAFAFA] rounded-xl flex items-center justify-center mb-3">
                  <UserPlus className="w-5 h-5 text-[#71717A]" />
                </div>
                <p className="text-xs text-[#71717A]">
                  {rightSearch
                    ? t('admin:projectModals.assign.noResults')
                    : t('admin:projectModals.assign.noneAssigned')}
                </p>
              </div>
            ) : (
              rightUsers.map(user => (
                <UserRow
                  key={user.id}
                  user={user}
                  tag={toAdd.has(user.id) ? 'add' : null}
                  onClick={() => !isSaving && removeUser(user.id)}
                  actionIcon={<ChevronLeft className="w-4 h-4" />}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom action bar ── */}
      <div className="flex-shrink-0 bg-white border-t border-[#D4D4D8] px-4 md:px-6 py-3 flex items-center justify-between gap-4">
        {/* Mobile diff summary */}
        <div className="flex items-center gap-2 min-w-0">
          {toAdd.size > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full flex-shrink-0">
              +{toAdd.size}
            </span>
          )}
          {toRemove.size > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 bg-red-100 text-red-700 rounded-full flex-shrink-0">
              −{toRemove.size}
            </span>
          )}
          {!hasChanges && !usersLoading && (
            <span className="text-xs text-[#71717A] hidden sm:block">
              {t('admin:projectModals.assign.noChanges')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isSaving}
            className="border-[#D4D4D8] text-[#0A0A0A]"
          >
            {t('common:buttons.cancel')}
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving || usersLoading || !hasChanges}
            className="bg-[#F97316] hover:bg-[#C2410C] text-white gap-2"
          >
            {isSaving
              ? <><Loader2 className="w-4 h-4 animate-spin" />{t('admin:projectModals.assign.saving')}</>
              : <><UserPlus className="w-4 h-4" />{t('admin:projectModals.assign.saveBtn')}</>
            }
          </Button>
        </div>
      </div>
    </div>
  );
}
