import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Loader2, Plus, Minus } from 'lucide-react';
import { toast } from 'sonner';
import { setAssignments as apiSetAssignments } from '../../services/projects';
import { listActiveUsers } from '../../services/users';
import { ApiError } from '../../lib/api';
import { cn } from '../ui/utils';
import { FOCUS_RING, PrimaryButton, SecondaryButton } from '../onboarding/chrome';
import { BtModal } from '../bt/windows';
import type { Project, UserForAssign, Role } from './types';
import { apiErrorMsg } from './helpers';
import { UserAvatar } from './badges';
import { Bone, INPUT, Mono, PaperNote } from './bt';
import { FIELD_LIMITS } from '../../../shared/fieldLimits';

/**
 * 04 — assign users, the one wide modal (880 px): comparing two lists does
 * not fit in a drawer. Available on the left, assigned on the right; a click
 * moves a user across and the row is tagged "a agregar" / "a quitar" until
 * saved. Nothing is written before "Guardar cambios".
 */

// ── User row used in both panels ────────────────────────────────────────────

function UserRow({ user, tag, onClick, action, actionLabel }: {
  user: UserForAssign;
  tag?: 'add' | 'remove' | null;
  onClick: () => void;
  action: 'add' | 'remove';
  actionLabel: string;
}) {
  const { t } = useTranslation(['admin', 'common']);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${actionLabel}: ${user.username}`}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2.5 text-left border-b border-[#F0EBE1] last:border-b-0 transition-colors group',
        tag === 'add' ? 'bg-[#FBEDE0]' : tag === 'remove' ? 'bg-[#FAF7F0]' : 'bg-white hover:bg-[#F3EEE4]',
        FOCUS_RING, 'focus-visible:outline-offset-[-2px]',
      )}
    >
      <UserAvatar user={user} size="md" />
      <span className="flex-1 min-w-0">
        <span className="block text-[13.5px] font-semibold text-[#0A0A0A] truncate leading-tight">{user.fullName || user.username}</span>
        <Mono className="block text-[9.5px] tracking-[0.1em] text-[#8A8175] truncate mt-0.5">
          @{user.username} · {t(`common:roles.${user.role}`)} · {t(`common:status.${user.status.toLowerCase()}`)}
        </Mono>
      </span>
      {tag ? (
        <Mono className={cn('text-[9px] font-semibold tracking-[0.1em] px-1.5 py-[3px] flex-shrink-0', tag === 'add' ? 'bg-[#F97316] text-[#0A0A0A]' : 'border border-[#B3402A] text-[#B3402A]')}>
          {tag === 'add' ? t('admin:projectModals.assign.tagAdd') : t('admin:projectModals.assign.tagRemove')}
        </Mono>
      ) : (
        <span className="w-7 h-7 flex items-center justify-center border border-[#DBD0BB] text-[#5A5346] group-hover:border-[#F97316] group-hover:text-[#C2410C] flex-shrink-0" aria-hidden="true">
          {action === 'add' ? <Plus className="w-3.5 h-3.5" strokeWidth={2.2} /> : <Minus className="w-3.5 h-3.5" strokeWidth={2.2} />}
        </span>
      )}
    </button>
  );
}

function SearchBox({ value, onChange, placeholder, disabled }: { value: string; onChange: (v: string) => void; placeholder: string; disabled: boolean }) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#A69C8D]" strokeWidth={2} />
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={FIELD_LIMITS.SEARCH}
        disabled={disabled}
        aria-label={placeholder}
        className={cn(INPUT, 'h-9 pl-9 text-[13px]')}
      />
    </div>
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

  const toAdd = useMemo(() => new Set([...workingIds].filter(id => !savedIds.has(id))), [workingIds, savedIds]);
  const toRemove = useMemo(() => new Set([...savedIds].filter(id => !workingIds.has(id))), [workingIds, savedIds]);
  const hasChanges = toAdd.size > 0 || toRemove.size > 0;

  const matches = (u: UserForAssign, q: string) =>
    !q || u.username.toLowerCase().includes(q) || (u.fullName?.toLowerCase().includes(q) ?? false);
  const leftUsers = useMemo(() => {
    const q = leftSearch.toLowerCase();
    return allUsers.filter(u => !workingIds.has(u.id) && matches(u, q));
  }, [allUsers, workingIds, leftSearch]);
  const rightUsers = useMemo(() => {
    const q = rightSearch.toLowerCase();
    return allUsers.filter(u => workingIds.has(u.id) && matches(u, q));
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
      const parts: string[] = [];
      if (toAdd.size > 0) parts.push(t('admin:projectModals.assign.toastAdded', { count: toAdd.size }));
      if (toRemove.size > 0) parts.push(t('admin:projectModals.assign.toastRemoved', { count: toRemove.size }));
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

  if (!project) return null;

  const diffLine = hasChanges
    ? [
        toAdd.size > 0 && `+${t('admin:projectModals.assign.willAdd', { count: toAdd.size })}`,
        toRemove.size > 0 && `−${t('admin:projectModals.assign.willRemove', { count: toRemove.size })}`,
      ].filter(Boolean).join(' · ')
    : t('admin:projectModals.assign.noChanges');

  const column = (side: 'left' | 'right') => {
    const users = side === 'left' ? leftUsers : rightUsers;
    const search = side === 'left' ? leftSearch : rightSearch;
    const setSearch = side === 'left' ? setLeftSearch : setRightSearch;
    const count = side === 'left' ? leftUsers.length : workingIds.size;
    const emptyText = search
      ? t('admin:projectModals.assign.noResults')
      : side === 'left' ? t('admin:projectModals.assign.allAssigned') : t('admin:projectModals.assign.noneAssigned');
    return (
      <div className="min-w-0 flex flex-col">
        <Mono className="block text-[10px] font-semibold tracking-[0.12em] text-[#0A0A0A] mb-2">
          {side === 'left'
            ? t('admin:projectModals.assign.availableCount', { count })
            : t('admin:projectModals.assign.assignedCount', { count })}
        </Mono>
        <SearchBox value={search} onChange={setSearch} placeholder={t('admin:projectModals.assign.searchPlaceholder')} disabled={usersLoading || isSaving} />
        <div className="mt-2.5 border border-[#E7E1D5] max-h-[40vh] md:max-h-[380px] overflow-y-auto">
          {usersLoading ? (
            <div className="flex flex-col gap-2 p-3">{[0, 1, 2, 3].map(i => <Bone key={i} className="h-9 w-full" />)}</div>
          ) : users.length === 0 ? (
            <p className="px-3 py-8 text-center text-[12.5px] italic text-[#A69C8D]">{emptyText}</p>
          ) : (
            users.map(user => (
              <UserRow
                key={user.id}
                user={user}
                tag={side === 'left' ? (toRemove.has(user.id) ? 'remove' : null) : (toAdd.has(user.id) ? 'add' : null)}
                onClick={() => { if (!isSaving) (side === 'left' ? addUser : removeUser)(user.id); }}
                action={side === 'left' ? 'add' : 'remove'}
                actionLabel={side === 'left' ? t('admin:projectModals.assign.add') : t('admin:projectModals.assign.remove')}
              />
            ))
          )}
        </div>
      </div>
    );
  };

  return (
    <BtModal
      open={open}
      onOpenChange={o => { if (!o && !isSaving) handleClose(); }}
      width={880}
      kicker={t('admin:projectModals.assign.kicker', { name: project.name })}
      title={t('admin:projectModals.assign.title')}
      closeDisabled={isSaving}
      dismissible={!hasChanges}
      footer={(
        <>
          <Mono className={cn('text-[10px] tracking-[0.1em] md:mr-auto', hasChanges ? 'text-[#0A0A0A] font-semibold' : 'text-[#8A8175]')} aria-live="polite">{diffLine}</Mono>
          <SecondaryButton onClick={handleClose} disabled={isSaving} className="px-4 py-[11px]">{t('common:buttons.cancel')}</SecondaryButton>
          <PrimaryButton onClick={handleSave} disabled={isSaving || usersLoading || !hasChanges} className="px-[18px] py-[11px]">
            {isSaving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />{t('admin:projectModals.assign.saving')}</> : t('admin:projectModals.assign.saveBtn')}
          </PrimaryButton>
        </>
      )}
    >
      {loadError && (
        <PaperNote tone="red" className="mb-4"><p className="text-[13px] text-[#0A0A0A]">{loadError}</p></PaperNote>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {column('left')}
        {column('right')}
      </div>
    </BtModal>
  );
}
