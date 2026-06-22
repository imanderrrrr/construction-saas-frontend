import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  UserPlus, Users, Search, Eye, Edit2, KeyRound, QrCode,
  LogOut, Power, PowerOff, MoreVertical, ChevronLeft,
  Shield, Clock, Activity, AlertCircle, Loader2,
  RefreshCw, Filter,
  CheckCircle, ShieldAlert, Laptop, Hash,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Skeleton } from './ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { toast } from 'sonner';
import * as UsersApi from '../services/users';
import type { UserDTO, SessionDTO, AuditEntryDTO } from '../services/users';
import { InviteUserModal } from './InviteUserModal';
import { WorkerQrModal } from './WorkerQrModal';
import { ApiError } from '../lib/api';

// TYPES

type Role = 'ADMIN' | 'SUPERVISOR' | 'WORKER' | 'FINANCE' | 'WAREHOUSE' | 'SUBCONTRACTOR';
type UserStatus = 'ACTIVE' | 'INACTIVE';
type UserView = 'list' | 'details';
type ListState = 'data' | 'loading' | 'empty' | 'error';

interface User {
  id: number;
  username: string;
  fullName: string | null;
  role: Role;
  status: UserStatus;
  updatedAt: string;
  hourlyRate?: number;
}

// DTO → UI mapper

function toUser(dto: UserDTO): User {
  return {
    id: dto.id,
    username: dto.username,
    fullName: dto.fullName ?? null,
    role: dto.role,
    status: dto.status,
    updatedAt: dto.updatedAt,
    hourlyRate: dto.hourlyRate ?? undefined,
  };
}

// CONSTANTS

const ROLES: { key: Role; labelKey: string }[] = [
  { key: 'ADMIN', labelKey: 'common:roles.ADMIN' },
  { key: 'SUPERVISOR', labelKey: 'common:roles.SUPERVISOR' },
  { key: 'WORKER', labelKey: 'common:roles.WORKER' },
  { key: 'FINANCE', labelKey: 'common:roles.FINANCE' },
  { key: 'WAREHOUSE', labelKey: 'common:roles.WAREHOUSE' },
  { key: 'SUBCONTRACTOR', labelKey: 'common:roles.SUBCONTRACTOR' },
];

// Field roles authenticate on mobile via QR + PIN. Office roles (ADMIN /
// FINANCE / WAREHOUSE) don't, so the "Acceso QR" actions are hidden for them —
// the backend also rejects them with 400 USER_NOT_FIELD_ROLE.
const FIELD_ROLES: Role[] = ['WORKER', 'SUPERVISOR', 'SUBCONTRACTOR'];
function isFieldRole(role: Role): boolean {
  return FIELD_ROLES.includes(role);
}

const ROLE_STYLES: Record<Role, { bg: string; text: string; border: string }> = {
  ADMIN: { bg: 'bg-[#C2410C]/10', text: 'text-[#C2410C]', border: 'border-[#C2410C]/20' },
  SUPERVISOR: { bg: 'bg-[#F97316]/10', text: 'text-[#F97316]', border: 'border-[#F97316]/20' },
  WORKER: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  FINANCE: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  WAREHOUSE: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  SUBCONTRACTOR: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
};

const AUDIT_ACTION_STYLES: Record<string, { bg: string; text: string }> = {
  LOGIN_SUCCESS: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  USER_CREATE: { bg: 'bg-[#F97316]/10', text: 'text-[#F97316]' },
  USER_UPDATE: { bg: 'bg-purple-50', text: 'text-purple-700' },
  USER_PASSWORD_RESET: { bg: 'bg-amber-50', text: 'text-amber-700' },
  USER_DISABLE: { bg: 'bg-red-50', text: 'text-red-700' },
};

const ITEMS_PER_PAGE = 6;

// HELPERS

function fmt(iso: string, locale = 'en-US') {
  try {
    return new Date(iso).toLocaleString(locale, {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    });
  } catch { return iso; }
}

function fmtDate(iso: string, locale = 'en-US') {
  try {
    return new Date(iso).toLocaleDateString(locale, {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  } catch { return iso; }
}

function initials(user: User): string {
  if (user.fullName) {
    const parts = user.fullName.trim().split(' ');
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  return user.username.slice(0, 2).toUpperCase();
}

const AVATAR_BG: Record<Role, string> = {
  ADMIN: 'bg-[#C2410C]', SUPERVISOR: 'bg-[#F97316]',
  WORKER: 'bg-emerald-600', FINANCE: 'bg-purple-600', WAREHOUSE: 'bg-amber-600',
  SUBCONTRACTOR: 'bg-orange-600',
};

// SMALL COMPONENTS

function RoleBadge({ role }: { role: Role }) {
  const s = ROLE_STYLES[role];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold font-mono border ${s.bg} ${s.text} ${s.border}`}>
      {role}
    </span>
  );
}

function StatusBadge({ status }: { status: UserStatus }) {
  const { t } = useTranslation(['users']);
  return status === 'ACTIVE' ? (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
      {t('users:status.active')}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FAFAFA] text-[#71717A] border border-[#D4D4D8]">
      <span className="w-1.5 h-1.5 rounded-full bg-[#71717A]" />
      {t('users:status.inactive')}
    </span>
  );
}

function SessionStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation(['users']);
  return status === 'ACTIVE' ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
      {t('users:sessions.status.active')}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#FAFAFA] text-[#71717A] border border-[#D4D4D8]">
      {t('users:sessions.status.revoked')}
    </span>
  );
}

function AuditActionBadge({ action }: { action: string }) {
  const s = AUDIT_ACTION_STYLES[action] ?? { bg: 'bg-[#FAFAFA]', text: 'text-[#71717A]' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold ${s.bg} ${s.text}`}>
      {action}
    </span>
  );
}

function UserAvatar({ user, size = 'md' }: { user: User; size?: 'sm' | 'md' | 'lg' }) {
  const sz = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-14 h-14 text-lg' }[size];
  return (
    <div className={`${sz} ${AVATAR_BG[user.role]} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0`}>
      {initials(user)}
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-3 border-b border-[#FAFAFA] last:border-0">
      <span className="text-xs font-medium text-[#71717A] uppercase tracking-wide w-32 flex-shrink-0 pt-0.5">{label}</span>
      <div className="flex-1 text-right">{children}</div>
    </div>
  );
}

function SectionCard({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
      <div className="px-6 py-4 border-b border-[#D4D4D8] flex items-center justify-between bg-[#FAFAFA]/50">
        <h3 className="text-sm font-semibold text-[#0A0A0A]">{title}</h3>
        {action}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

// CREATE USER MODAL

interface CreateUserModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (user: User) => void;
  existingUsernames: string[];
}

function CreateUserModal({ open, onClose, onCreated, existingUsernames }: CreateUserModalProps) {
  const { t } = useTranslation(['users', 'common']);
  const [form, setForm] = useState({ username: '', fullName: '', password: '', role: '', hourlyRate: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const reset = () => { setForm({ username: '', fullName: '', password: '', role: '', hourlyRate: '' }); setErrors({}); setIsLoading(false); };

  const validate = () => {
    const e: Record<string, string> = {};
    const trimmed = form.username.trim();
    if (!trimmed) {
      e.username = t('users:validation.usernameRequired');
    } else if (trimmed.length < 3 || trimmed.length > 50) {
      e.username = t('users:validation.usernameLength');
    } else if (!/^[a-zA-Z0-9._-]+$/.test(trimmed)) {
      e.username = t('users:validation.usernameFormat');
    } else if (existingUsernames.includes(trimmed)) {
      e.username = t('users:validation.usernameExists');
    }
    if (!form.password) e.password = t('users:validation.passwordRequired');
    else if (form.password.length < 6) e.password = t('users:validation.passwordTooShort');
    if (!form.role) e.role = t('users:validation.roleRequired');
    if (form.hourlyRate && parseFloat(form.hourlyRate) < 0) e.hourlyRate = t('users:form.rateNegative');
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setIsLoading(true);
    try {
      const parsedRate = form.hourlyRate ? parseFloat(form.hourlyRate) : undefined;
      const created = await UsersApi.createUser({
        username: form.username.trim(),
        password: form.password,
        fullName: form.fullName.trim() || null,
        role: form.role as Role,
        hourlyRate: (parsedRate && parsedRate > 0) ? parsedRate : null,
      });
      onCreated(toUser(created));
      toast.success(t('users:toast.userCreated'), { description: t('users:toast.userCreatedDesc', { username: created.username }) });
      reset(); onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setErrors({ username: t('users:validation.usernameExists') });
      } else if (err instanceof ApiError && err.status === 400 && err.details) {
        // Map backend field-level validation errors to form fields
        const fieldErrors: Record<string, string> = {};
        for (const [field, msg] of Object.entries(err.details)) {
          fieldErrors[field] = msg;
        }
        setErrors(fieldErrors);
      } else if (err instanceof ApiError && err.status >= 500) {
        toast.error(t('users:toast.createFailed'), { description: t('users:toast.serverError') });
      } else {
        toast.error(t('users:toast.createFailed'), { description: err instanceof Error ? err.message : t('users:toast.unknownError') });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => { reset(); onClose(); };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-md bg-white">
        <DialogHeader>
          <DialogTitle className="text-[#0A0A0A]">{t('users:createUser')}</DialogTitle>
          <DialogDescription>{t('users:createUserDesc')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-[#0A0A0A]">{t('users:form.username')} <span className="text-red-500">*</span></Label>
            <Input value={form.username} onChange={e => { setForm(f => ({ ...f, username: e.target.value })); setErrors(prev => { const { username: _, ...rest } = prev; return rest; }); }}
              placeholder={t('users:form.placeholderUsername')}
              className={`h-10 ${errors.username ? 'border-red-400 focus:ring-red-400/20' : 'border-[#D4D4D8]'} ${(isLoading) ? 'opacity-50 bg-[#FAFAFA]' : ''}`}
              disabled={isLoading} />
            <p className="text-[10px] text-[#71717A]">{t('users:form.usernameHint')}</p>
            {errors.username && <p className="flex items-center gap-1 text-xs text-red-600"><AlertCircle className="w-3 h-3" />{errors.username}</p>}
          </div>

          {/* Full name */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-[#0A0A0A]">{t('users:form.fullName')}</Label>
            <Input value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
              placeholder={t('users:form.placeholderName')}
              className={`h-10 border-[#D4D4D8] ${(isLoading) ? 'opacity-50 bg-[#FAFAFA]' : ''}`}
              disabled={isLoading} />
            <p className="text-xs text-[#71717A]">{t('users:form.optional')}</p>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-[#0A0A0A]">{t('users:form.password')} <span className="text-red-500">*</span></Label>
            <Input type="password" value={form.password} onChange={e => { setForm(f => ({ ...f, password: e.target.value })); setErrors(prev => { const { password: _, ...rest } = prev; return rest; }); }}
              placeholder={t('users:form.placeholderPassword')}
              className={`h-10 ${errors.password ? 'border-red-400 focus:ring-red-400/20' : 'border-[#D4D4D8]'} ${(isLoading) ? 'opacity-50 bg-[#FAFAFA]' : ''}`}
              disabled={isLoading} />
            <p className="text-xs text-[#71717A]">{t('users:form.minChars')}</p>
            {errors.password && <p className="flex items-center gap-1 text-xs text-red-600"><AlertCircle className="w-3 h-3" />{errors.password}</p>}
          </div>

          {/* Role */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-[#0A0A0A]">{t('users:form.role')} <span className="text-red-500">*</span></Label>
            <Select value={form.role} onValueChange={v => { setForm(f => ({ ...f, role: v, ...(v !== 'WORKER' ? { hourlyRate: '' } : {}) })); setErrors(prev => { const { role: _, ...rest } = prev; return rest; }); }} disabled={isLoading}>
              <SelectTrigger className={`h-10 ${errors.role ? 'border-red-400' : 'border-[#D4D4D8]'} ${(isLoading) ? 'opacity-50 bg-[#FAFAFA]' : ''}`}>
                <SelectValue placeholder={t('users:form.selectRole')} />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map(r => <SelectItem key={r.key} value={r.key}><span className="font-mono">{r.key}</span></SelectItem>)}
              </SelectContent>
            </Select>
            {errors.role && <p className="flex items-center gap-1 text-xs text-red-600"><AlertCircle className="w-3 h-3" />{errors.role}</p>}
          </div>

          {/* Hourly Rate - only for WORKER role */}
          {form.role === 'WORKER' && (
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-[#0A0A0A]">{t('users:form.hourlyRate')}</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#71717A] font-medium">$</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.hourlyRate}
                onChange={e => {
                  const val = e.target.value;
                  if (val === '' || (/^\d*\.?\d{0,2}$/.test(val) && parseFloat(val) >= 0)) {
                    setForm(f => ({ ...f, hourlyRate: val }));
                  }
                }}
                placeholder="0.00"
                className={`h-10 pl-8 border-[#D4D4D8] font-mono ${(isLoading) ? 'opacity-50 bg-[#FAFAFA]' : ''}`}
                disabled={isLoading}
              />
            </div>
            <p className="text-xs text-[#71717A]">{t('users:form.hourlyRateHint')}</p>
            {form.hourlyRate && parseFloat(form.hourlyRate) < 0 && (
              <p className="flex items-center gap-1 text-xs text-red-600"><AlertCircle className="w-3 h-3" />{t('users:form.rateNegative')}</p>
            )}
          </div>
          )}

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}
              className="border-[#D4D4D8] text-[#0A0A0A]">{t('common:buttons.cancel')}</Button>
            <Button type="submit" className="bg-[#F97316] hover:bg-[#C2410C] text-white gap-2"
              disabled={isLoading}>
              {(isLoading) ? <><Loader2 className="w-4 h-4 animate-spin" />{t('common:labels.loading')}</> : t('common:buttons.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// EDIT USER MODAL

interface EditUserModalProps {
  user: User | null;
  open: boolean;
  onClose: () => void;
  onSaved: (updated: User) => void;
  isLastAdmin: boolean;
}

function EditUserModal({ user, open, onClose, onSaved, isLastAdmin }: EditUserModalProps) {
  const { t } = useTranslation(['users', 'common']);
  const [form, setForm] = useState({ fullName: '', role: '' as Role | '', status: '' as UserStatus | '', hourlyRate: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [is409, setIs409] = useState(false);

  React.useEffect(() => {
    if (user) { setForm({ fullName: user.fullName ?? '', role: user.role, status: user.status, hourlyRate: user.hourlyRate != null ? String(user.hourlyRate) : '' }); setIs409(false); }
  }, [user]);

  const isLastAdminBlocked = isLastAdmin && user?.role === 'ADMIN' && (form.status === 'INACTIVE' || form.role !== 'ADMIN');
  const displayLoading = isLoading;
  const saveDisabled = displayLoading || is409 || isLastAdminBlocked;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || saveDisabled) return;
    setIsLoading(true);
    try {
      const parsedRate = form.hourlyRate ? parseFloat(form.hourlyRate) : undefined;
      const updated = await UsersApi.updateUser(user.id, {
        fullName: form.fullName || null,
        role: form.role as Role,
        status: form.status as UserStatus,
        hourlyRate: (parsedRate && parsedRate > 0) ? parsedRate : null,
      });
      onSaved(toUser(updated));
      toast.success(t('users:toast.userUpdated'), { description: t('users:toast.userUpdatedDesc', { username: user.username }) });
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setIs409(true);
      } else {
        toast.error(t('users:toast.updateFailed'), { description: err instanceof Error ? err.message : 'Unknown error' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md bg-white">
        <DialogHeader>
          <DialogTitle className="text-[#0A0A0A]">{t('users:editUser')}</DialogTitle>
          <DialogDescription>{t('users:editingUser', { username: user.username })}</DialogDescription>
        </DialogHeader>

        {/* 409 Last Admin Alert */}
        {(is409 || isLastAdminBlocked) && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
            <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <ShieldAlert className="w-4 h-4 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-red-900">{t('users:edit.actionBlocked')}</p>
              <p className="text-sm text-red-700 mt-0.5">{t('users:edit.lastAdminWarning')}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          {/* Username (read-only) */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-[#71717A]">{t('users:form.username')}</Label>
            <div className="h-10 px-3.5 flex items-center bg-[#FAFAFA] border border-[#D4D4D8] rounded-lg">
              <span className="font-mono text-sm text-[#71717A]">{user.username}</span>
              <span className="ml-2 text-[10px] text-[#D4D4D8] border border-[#D4D4D8] px-1.5 py-0.5 rounded">{t('users:form.readOnly')}</span>
            </div>
          </div>

          {/* Full name */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-[#0A0A0A]">{t('users:form.fullName')}</Label>
            <Input value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
              placeholder={t('users:form.placeholderName')}
              className={`h-10 border-[#D4D4D8] ${displayLoading ? 'opacity-50 bg-[#FAFAFA]' : ''}`}
              disabled={displayLoading} />
          </div>

          {/* Role */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-[#0A0A0A]">{t('users:form.role')}</Label>
            <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v as Role, ...(v !== 'WORKER' ? { hourlyRate: '' } : {}) }))}
              disabled={saveDisabled}>
              <SelectTrigger className={`h-10 border-[#D4D4D8] ${(saveDisabled) ? 'opacity-50 bg-[#FAFAFA]' : ''}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map(r => <SelectItem key={r.key} value={r.key}><span className="font-mono">{r.key}</span></SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-[#0A0A0A]">{t('users:form.status')}</Label>
            <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as UserStatus }))}
              disabled={saveDisabled}>
              <SelectTrigger className={`h-10 border-[#D4D4D8] ${(saveDisabled) ? 'opacity-50 bg-[#FAFAFA]' : ''}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                <SelectItem value="INACTIVE">INACTIVE</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Hourly Rate - only for WORKER role */}
          {form.role === 'WORKER' && (
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-[#0A0A0A]">{t('users:form.hourlyRate')}</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#71717A] font-medium">$</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.hourlyRate}
                onChange={e => {
                  const val = e.target.value;
                  if (val === '' || (/^\d*\.?\d{0,2}$/.test(val) && parseFloat(val) >= 0)) {
                    setForm(f => ({ ...f, hourlyRate: val }));
                  }
                }}
                placeholder="0.00"
                className={`h-10 pl-8 border-[#D4D4D8] font-mono ${displayLoading ? 'opacity-50 bg-[#FAFAFA]' : ''}`}
                disabled={displayLoading}
              />
            </div>
            <p className="text-xs text-[#71717A]">{t('users:form.hourlyRateHint')}</p>
            {form.hourlyRate && parseFloat(form.hourlyRate) < 0 && (
              <p className="flex items-center gap-1 text-xs text-red-600"><AlertCircle className="w-3 h-3" />{t('users:form.rateNegative')}</p>
            )}
          </div>
          )}

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={displayLoading}
              className="border-[#D4D4D8] text-[#0A0A0A]">{t('common:buttons.cancel')}</Button>
            <Button type="submit" className="bg-[#F97316] hover:bg-[#C2410C] text-white gap-2"
              disabled={saveDisabled}>
              {displayLoading ? <><Loader2 className="w-4 h-4 animate-spin" />{t('users:edit.saving')}</> : t('users:edit.saveChanges')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// RESET PASSWORD MODAL

function ResetPasswordModal({ user, open, onClose }: { user: User | null; open: boolean; onClose: () => void }) {
  const { t } = useTranslation(['users', 'common']);
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleClose = () => { setPw(''); setConfirm(''); setIsLoading(false); onClose(); };

  const displayLoading = isLoading;
  const showShortError = pw && pw.length < 6 && pw.length > 0;
  const showMismatchError = confirm && confirm !== pw;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (displayLoading || showShortError || showMismatchError || !user) return;
    setIsLoading(true);
    try {
      await UsersApi.resetPassword(user.id, { newPassword: pw });
      toast.success(t('users:toast.passwordUpdated'), { description: t('users:toast.passwordUpdatedDesc', { username: user.username }) });
      handleClose();
    } catch (err) {
      toast.error(t('users:toast.passwordResetFailed'), { description: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-md bg-white">
        <DialogHeader>
          <DialogTitle className="text-[#0A0A0A]">{t('users:resetPw.title')}</DialogTitle>
          <DialogDescription>{t('users:resetPw.desc', { username: user.username })}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-[#0A0A0A]">{t('users:resetPw.newPassword')} <span className="text-red-500">*</span></Label>
            <Input type="password" value={pw} onChange={e => setPw(e.target.value)}
              placeholder={t('users:form.placeholderPassword')}
              className={`h-10 ${showShortError ? 'border-red-400' : 'border-[#D4D4D8]'} ${displayLoading ? 'opacity-50 bg-[#FAFAFA]' : ''}`}
              disabled={displayLoading} />
            <p className="text-xs text-[#71717A]">{t('users:form.minChars')}</p>
            {showShortError && (
              <p className="flex items-center gap-1 text-xs text-red-600"><AlertCircle className="w-3 h-3" />{t('users:resetPw.passwordTooShort')}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-[#0A0A0A]">{t('users:resetPw.confirmPassword')} <span className="text-red-500">*</span></Label>
            <Input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
              placeholder={t('users:resetPw.placeholderConfirm')}
              className={`h-10 ${showMismatchError ? 'border-red-400' : 'border-[#D4D4D8]'} ${displayLoading ? 'opacity-50 bg-[#FAFAFA]' : ''}`}
              disabled={displayLoading} />
            {showMismatchError && (
              <p className="flex items-center gap-1 text-xs text-red-600"><AlertCircle className="w-3 h-3" />{t('users:resetPw.passwordMismatch')}</p>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={displayLoading}
              className="border-[#D4D4D8] text-[#0A0A0A]">{t('common:buttons.cancel')}</Button>
            <Button type="submit" className="bg-[#F97316] hover:bg-[#C2410C] text-white gap-2" disabled={displayLoading}>
              {displayLoading ? <><Loader2 className="w-4 h-4 animate-spin" />{t('users:resetPw.resetting')}</> : t('users:resetPw.button')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// DISABLE / ENABLE MODAL

function DisableEnableModal({ user, open, onClose, onConfirmed }: {
  user: User | null; open: boolean; onClose: () => void; onConfirmed: (user: User) => void;
}) {
  const { t } = useTranslation(['users', 'common']);
  const [isLoading, setIsLoading] = useState(false);
  const isDisabling = user?.status === 'ACTIVE';

  const handleConfirm = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const newStatus: UserStatus = isDisabling ? 'INACTIVE' : 'ACTIVE';
      const updated = await UsersApi.updateUser(user.id, { status: newStatus });
      onConfirmed(toUser(updated));
      toast.success(isDisabling ? t('users:toast.userDisabled') : t('users:toast.userEnabled'), { description: isDisabling ? t('users:toast.disabledDesc', { username: user.username }) : t('users:toast.enabledDesc', { username: user.username }) });
      onClose();
    } catch (err) {
      toast.error(t('users:toast.statusFailed'), { description: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-sm bg-white">
        <DialogHeader>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-2 ${isDisabling ? 'bg-red-50' : 'bg-emerald-50'}`}>
            {isDisabling ? <PowerOff className="w-6 h-6 text-red-600" /> : <Power className="w-6 h-6 text-emerald-600" />}
          </div>
          <DialogTitle className="text-[#0A0A0A] text-center">
            {isDisabling ? t('users:disable.titleDisable') : t('users:disable.titleEnable')}
          </DialogTitle>
          <DialogDescription className="text-center">
            {isDisabling
              ? t('users:disable.descDisable', { username: user.username })
              : t('users:disable.descEnable', { username: user.username })}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}
            className="flex-1 border-[#D4D4D8] text-[#0A0A0A]">{t('common:buttons.cancel')}</Button>
          <Button type="button" onClick={handleConfirm} disabled={isLoading}
            className={`flex-1 gap-2 ${isDisabling ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}>
            {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" />{isDisabling ? t('users:disable.disabling') : t('users:disable.enabling')}</> :
              <>{isDisabling ? <><PowerOff className="w-4 h-4" />{t('users:disable')}</> : <><Power className="w-4 h-4" />{t('users:enable')}</>}</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// USER DETAILS VIEW

interface UserDetailsViewProps {
  user: User;
  onBack: () => void;
  onEdit: () => void;
  onResetPassword: () => void;
  onDisable: () => void;
  onQrAccess: () => void;
}

function UserDetailsView({ user, onBack, onEdit, onResetPassword, onDisable, onQrAccess }: UserDetailsViewProps) {
  const { t, i18n } = useTranslation(['users', 'common']);
  const [sessionsState, setSessionsState] = useState<'data' | 'loading' | 'empty'>('loading');
  const [sessions, setSessions] = useState<SessionDTO[]>([]);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const [activityState, setActivityState] = useState<'data' | 'loading' | 'empty'>('loading');
  const [activity, setActivity] = useState<AuditEntryDTO[]>([]);

  // Fetch sessions
  useEffect(() => {
    let cancelled = false;
    setSessionsState('loading');
    UsersApi.listUserSessions(user.id)
      .then(data => { if (!cancelled) { setSessions(data); setSessionsState(data.length === 0 ? 'empty' : 'data'); } })
      .catch(() => { if (!cancelled) setSessionsState('empty'); });
    return () => { cancelled = true; };
  }, [user.id]);

  // Fetch activity
  useEffect(() => {
    let cancelled = false;
    setActivityState('loading');
    UsersApi.listUserActivity(user.id)
      .then(data => { if (!cancelled) { setActivity(data); setActivityState(data.length === 0 ? 'empty' : 'data'); } })
      .catch(() => { if (!cancelled) setActivityState('empty'); });
    return () => { cancelled = true; };
  }, [user.id]);

  const handleRevokeSession = async (sessionId: string) => {
    setRevoking(sessionId);
    try {
      await UsersApi.revokeSession(user.id, sessionId);
      setSessions(s => s.map(sess => sess.id === sessionId ? { ...sess, status: 'REVOKED' } : sess));
      toast.success(t('users:toast.sessionRevoked'));
    } catch { toast.error(t('users:toast.sessionRevokeFailed')); }
    finally { setRevoking(null); }
  };

  const handleRevokeAll = async () => {
    setRevokingAll(true);
    try {
      await UsersApi.revokeAllSessions(user.id);
      setSessions(s => s.map(sess => ({ ...sess, status: 'REVOKED' as const })));
      toast.success(t('users:toast.allSessionsRevoked'));
    } catch { toast.error(t('users:toast.allSessionsRevokeFailed')); }
    finally { setRevokingAll(false); }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[#71717A]">
        <button onClick={onBack} className="hover:text-[#0A0A0A] transition-colors font-medium">{t('users:title')}</button>
        <span>/</span>
        <span className="font-mono text-[#0A0A0A]">{user.username}</span>
      </div>

      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <UserAvatar user={user} size="lg" />
          <div>
            <h2 className="text-2xl font-bold text-[#0A0A0A]">{user.username}</h2>
            {user.fullName && <p className="text-[#71717A] mt-0.5">{user.fullName}</p>}
            <div className="flex items-center gap-2 mt-2">
              <RoleBadge role={user.role} />
              <StatusBadge status={user.status} />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={onEdit}
            className="border-[#D4D4D8] text-[#0A0A0A] hover:border-[#F97316] hover:text-[#F97316] gap-2">
            <Edit2 className="w-3.5 h-3.5" />{t('users:editUser')}
          </Button>
          <Button variant="outline" size="sm" onClick={onResetPassword}
            className="border-[#D4D4D8] text-[#0A0A0A] hover:border-[#F97316] hover:text-[#F97316] gap-2">
            <KeyRound className="w-3.5 h-3.5" />{t('users:resetPassword')}
          </Button>
          {isFieldRole(user.role) && (
            <Button variant="outline" size="sm" onClick={onQrAccess}
              className="border-[#D4D4D8] text-[#0A0A0A] hover:border-[#F97316] hover:text-[#F97316] gap-2">
              <QrCode className="w-3.5 h-3.5" />{t('users:qr.access')}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onDisable}
            className={`gap-2 ${user.status === 'ACTIVE' ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'}`}>
            {user.status === 'ACTIVE' ? <><PowerOff className="w-3.5 h-3.5" />{t('users:disable')}</> : <><Power className="w-3.5 h-3.5" />{t('users:enable')}</>}
          </Button>
        </div>
      </div>

      {/* Profile Card */}
      <SectionCard title={t('users:details.profile')}>
        <FieldRow label={t('users:form.username')}><span className="font-mono text-sm text-[#0A0A0A]">{user.username}</span></FieldRow>
        <FieldRow label={t('users:form.fullName')}><span className="text-sm text-[#0A0A0A]">{user.fullName || <span className="text-[#71717A] italic">{t('users:details.notSet')}</span>}</span></FieldRow>
        <FieldRow label={t('users:form.role')}><RoleBadge role={user.role} /></FieldRow>
        <FieldRow label={t('users:form.status')}><StatusBadge status={user.status} /></FieldRow>
        {user.role === 'WORKER' && (
        <FieldRow label={t('users:form.hourlyRate')}>
          {user.hourlyRate != null ? (
            <span className="font-mono text-sm text-[#0A0A0A]">${user.hourlyRate.toFixed(2)}/hr</span>
          ) : (
            <span className="text-xs text-amber-600 flex items-center gap-1 justify-end">
              <AlertCircle className="w-3 h-3" />{t('users:details.notDefined')}
            </span>
          )}
        </FieldRow>
        )}
        <FieldRow label={t('users:details.lastUpdated')}><span className="text-sm text-[#71717A]">{fmtDate(user.updatedAt, i18n.language)}</span></FieldRow>
        <FieldRow label={t('users:details.userId')}><span className="font-mono text-sm text-[#71717A]">#{user.id}</span></FieldRow>
      </SectionCard>

      {/* Sessions Card */}
      <SectionCard
        title={t('users:details.sessions')}
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRevokeAll}
              disabled={revokingAll || sessions.every(s => s.status === 'REVOKED')}
              className="h-7 text-xs border-red-200 text-red-600 hover:bg-red-50 gap-1">
              {revokingAll ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogOut className="w-3 h-3" />}{t('users:details.revokeAll')}
            </Button>
          </div>
        }
      >
        {sessionsState === 'loading' && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
          </div>
        )}
        {sessionsState === 'empty' && (
          <div className="flex flex-col items-center justify-center py-10">
            <div className="w-12 h-12 bg-[#FAFAFA] rounded-full flex items-center justify-center mb-3">
              <Laptop className="w-6 h-6 text-[#D4D4D8]" />
            </div>
            <p className="text-sm font-medium text-[#0A0A0A]">{t('users:details.noSessions')}</p>
            <p className="text-xs text-[#71717A] mt-1">{t('users:details.noSessionsDesc')}</p>
          </div>
        )}
        {sessionsState === 'data' && (
          <div className="overflow-x-auto -mx-6 -mb-6">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#FAFAFA] border-b border-[#D4D4D8]">
                  <TableHead className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider pl-6">{t('users:details.sessionTable.sessionId')}</TableHead>
                  <TableHead className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider">{t('users:details.sessionTable.ip')}</TableHead>
                  <TableHead className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider">{t('users:details.sessionTable.created')}</TableHead>
                  <TableHead className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider">{t('users:details.sessionTable.lastUsed')}</TableHead>
                  <TableHead className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider">{t('users:details.sessionTable.device')}</TableHead>
                  <TableHead className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider">{t('users:details.sessionTable.status')}</TableHead>
                  <TableHead className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider pr-6 text-right">{t('users:details.sessionTable.action')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map(sess => (
                  <TableRow key={sess.id} className="border-b border-[#D4D4D8]/40 hover:bg-[#FAFAFA] transition-colors">
                    <TableCell className="pl-6"><span className="font-mono text-xs text-[#71717A]">{sess.id.slice(0, 14)}…</span></TableCell>
                    <TableCell><span className="font-mono text-xs text-[#71717A]">{sess.ipAddress ?? '—'}</span></TableCell>
                    <TableCell><span className="text-xs text-[#71717A]">{fmt(sess.createdAt, i18n.language)}</span></TableCell>
                    <TableCell><span className="text-xs text-[#71717A]">{fmt(sess.lastUsedAt, i18n.language)}</span></TableCell>
                    <TableCell><span className="text-xs text-[#71717A] max-w-[200px] truncate block">{sess.userAgent ?? '—'}</span></TableCell>
                    <TableCell><SessionStatusBadge status={sess.status} /></TableCell>
                    <TableCell className="pr-6 text-right">
                      {sess.status === 'ACTIVE' && (
                        <button onClick={() => handleRevokeSession(sess.id)} disabled={revoking === sess.id}
                          className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50 flex items-center gap-1 ml-auto">
                          {revoking === sess.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogOut className="w-3 h-3" />}
                          {t('users:details.revoke')}
                        </button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>

      {/* Recent Audit Activity */}
      <SectionCard title={t('users:details.recentActivity')}>
        {activityState === 'loading' && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
          </div>
        )}
        {activityState === 'empty' && (
          <div className="flex flex-col items-center justify-center py-10">
            <div className="w-12 h-12 bg-[#FAFAFA] rounded-full flex items-center justify-center mb-3">
              <Activity className="w-6 h-6 text-[#D4D4D8]" />
            </div>
            <p className="text-sm font-medium text-[#0A0A0A]">{t('users:details.noActivity')}</p>
            <p className="text-xs text-[#71717A] mt-1">{t('users:details.noActivityDesc')}</p>
          </div>
        )}
        {activityState === 'data' && (
          <div className="space-y-0 divide-y divide-[#FAFAFA]">
            {activity.map(entry => (
              <div key={entry.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <AuditActionBadge action={entry.action} />
                  <span className="text-xs text-[#0A0A0A] font-medium">{entry.entity}{entry.entityId ? ` #${entry.entityId}` : ''}</span>
                  <span className="text-xs text-[#71717A]">{fmt(entry.createdAt, i18n.language)}</span>
                </div>
                <span className="font-mono text-[10px] text-[#D4D4D8]">#{entry.id}</span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// SKELETON TABLE ROWS

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <TableRow key={i} className="border-b border-[#D4D4D8]/40">
          <TableCell><div className="flex items-center gap-3"><Skeleton className="w-9 h-9 rounded-full flex-shrink-0" /><Skeleton className="h-4 w-24" /></div></TableCell>
          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
          <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
          <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
          <TableCell><Skeleton className="h-8 w-8 rounded-lg ml-auto" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

// MAIN USER MANAGEMENT COMPONENT

export function UserManagement() {
  const { t } = useTranslation(['users', 'common']);
  const [users, setUsers] = useState<User[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [view, setView] = useState<UserView>('list');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [listState, setListState] = useState<ListState>('loading');
  const viewMode = 'desktop' as const;

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  // Debounce search input (300ms)
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setCurrentPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // Modals
  const [createOpen, setCreateOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [resetPwOpen, setResetPwOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  // Derived
  const isLastAdmin = users.filter(u => u.role === 'ADMIN' && u.status === 'ACTIVE').length === 1;

  // Fetch users from backend
  const fetchUsers = useCallback(async () => {
    setListState('loading');
    try {
      const page = await UsersApi.listUsers({
        search: debouncedSearch || undefined,
        role: roleFilter !== 'all' ? roleFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        page: currentPage - 1, // backend is 0-based
        size: ITEMS_PER_PAGE,
      });
      const mapped = page.content.map(toUser);
      setUsers(mapped);
      setTotalElements(page.totalElements);
      setTotalPages(Math.max(1, page.totalPages));
      setListState(mapped.length === 0 ? 'empty' : 'data');
    } catch {
      setListState('error');
    }
  }, [debouncedSearch, roleFilter, statusFilter, currentPage]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // Use backend pagination — show fetched list directly
  const paginated = users;

  const openModal = useCallback((type: 'edit' | 'reset' | 'disable' | 'qr', user: User) => {
    setSelectedUser(user);
    if (type === 'edit') setEditOpen(true);
    else if (type === 'reset') setResetPwOpen(true);
    else if (type === 'qr') setQrOpen(true);
    else setDisableOpen(true);
  }, []);

  const handleViewDetails = (user: User) => { setSelectedUser(user); setView('details'); };
  const handleBackToList = () => { setView('list'); setSelectedUser(null); };

  const handleCreated = (_u: User) => { fetchUsers(); };
  const handleSaved = (updated: User) => {
    fetchUsers();
    if (selectedUser?.id === updated.id) setSelectedUser(updated);
  };
  const handleDisableToggled = (updated: User) => {
    fetchUsers();
    if (selectedUser?.id === updated.id) setSelectedUser(updated);
  };

  // Render details view
  if (view === 'details' && selectedUser) {
    return (
      <>
        <UserDetailsView
          user={selectedUser}
          onBack={handleBackToList}
          onEdit={() => setEditOpen(true)}
          onResetPassword={() => setResetPwOpen(true)}
          onDisable={() => setDisableOpen(true)}
          onQrAccess={() => setQrOpen(true)}
        />
        <EditUserModal user={selectedUser} open={editOpen} onClose={() => setEditOpen(false)} onSaved={handleSaved} isLastAdmin={isLastAdmin} />
        <ResetPasswordModal user={selectedUser} open={resetPwOpen} onClose={() => setResetPwOpen(false)} />
        <DisableEnableModal user={selectedUser} open={disableOpen} onClose={() => setDisableOpen(false)} onConfirmed={handleDisableToggled} />
        <WorkerQrModal user={selectedUser} open={qrOpen} onClose={() => setQrOpen(false)} />
      </>
    );
  }

  // Render list view
  return (
    <>
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-[#0A0A0A]">{t('users:title')}</h2>
            <p className="text-sm text-[#71717A] mt-1">{t('users:subtitle')}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 self-start">
            <Button onClick={() => setInviteOpen(true)}
              variant="outline"
              className="border-[#0A0A0A] text-[#0A0A0A] hover:bg-[#0A0A0A] hover:text-white gap-2">
              <QrCode className="w-4 h-4" />Invitar por QR
            </Button>
            <Button onClick={() => setCreateOpen(true)}
              className="bg-[#F97316] hover:bg-[#C2410C] text-white gap-2">
              <UserPlus className="w-4 h-4" />Create user
            </Button>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#71717A]" />
            <Input value={search} onChange={e => { setSearch(e.target.value); }}
              placeholder={t('users:list.searchPlaceholder')}
              className="pl-10 h-10 border-[#D4D4D8] w-full" />
          </div>
          <Select value={roleFilter} onValueChange={v => { setRoleFilter(v); setCurrentPage(1); }}>
            <SelectTrigger className="h-10 border-[#D4D4D8] w-full md:w-44">
              <div className="flex items-center gap-2"><Filter className="w-3.5 h-3.5 text-[#71717A]" /><SelectValue placeholder={t('users:list.allRoles')} /></div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('users:list.allRoles')}</SelectItem>
              {ROLES.map(r => <SelectItem key={r.key} value={r.key}><span className="font-mono">{r.key}</span></SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setCurrentPage(1); }}>
            <SelectTrigger className="h-10 border-[#D4D4D8] w-full md:w-40">
              <div className="flex items-center gap-2"><Filter className="w-3.5 h-3.5 text-[#71717A]" /><SelectValue placeholder={t('users:list.allStatuses')} /></div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('users:list.allStatuses')}</SelectItem>
              <SelectItem value="ACTIVE">ACTIVE</SelectItem>
              <SelectItem value="INACTIVE">INACTIVE</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table / States */}
        <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
          {/* Table toolbar */}
          <div className="px-6 py-4 border-b border-[#D4D4D8] flex items-center justify-between bg-white">
            <div>
              <h3 className="text-sm font-semibold text-[#0A0A0A]">{t('users:list.userList')}</h3>
              {listState === 'data' && <p className="text-xs text-[#71717A] mt-0.5">{t('users:list.userCount', { count: totalElements })}</p>}
            </div>
            {listState === 'data' && (
              <div className="flex items-center gap-2 text-xs text-[#71717A]">
                <div className="w-2 h-2 bg-emerald-400 rounded-full" />
                {t('users:list.activeCount', { count: users.filter(u => u.status === 'ACTIVE').length })}
              </div>
            )}
          </div>

          {/* Error state */}
          {listState === 'error' && (
            <div className="p-6">
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-red-900">{t('users:list.errorTitle')}</p>
                    <p className="text-xs text-red-600 mt-0.5">{t('users:list.errorDesc')}</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => fetchUsers()}
                  className="gap-2 border-red-200 text-red-700 hover:bg-red-50 shrink-0">
                  <RefreshCw className="w-3.5 h-3.5" />{t('common:buttons.retry')}
                </Button>
              </div>
            </div>
          )}

          {/* DESKTOP TABLE */}
          {viewMode === 'desktop' && listState !== 'error' && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#FAFAFA] border-b border-[#D4D4D8] hover:bg-[#FAFAFA]">
                    <TableHead className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider pl-6">{t('users:table.username')}</TableHead>
                    <TableHead className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider">{t('users:table.name')}</TableHead>
                    <TableHead className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider">{t('users:table.role')}</TableHead>
                    <TableHead className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider">{t('users:table.status')}</TableHead>
                    <TableHead className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider pr-6 text-right">{t('users:table.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listState === 'loading' && <SkeletonRows />}
                  {listState === 'empty' && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-20 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <div className="w-14 h-14 bg-[#FAFAFA] rounded-full flex items-center justify-center mb-3">
                            <Users className="w-7 h-7 text-[#D4D4D8]" />
                          </div>
                          <p className="text-sm font-semibold text-[#0A0A0A] mb-1">{t('users:list.emptyTitle')}</p>
                          <p className="text-xs text-[#71717A] mb-4">{t('users:list.emptyHint')}</p>
                          <Button size="sm" onClick={() => setCreateOpen(true)}
                            className="bg-[#F97316] hover:bg-[#C2410C] text-white gap-2">
                            <UserPlus className="w-4 h-4" />{t('users:createUser')}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  {listState === 'data' && paginated.map(user => (
                    <TableRow key={user.id} className="border-b border-[#D4D4D8]/40 hover:bg-[#FAFAFA] transition-colors">
                      <TableCell className="pl-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <UserAvatar user={user} size="sm" />
                          <div>
                            <p className="text-sm font-semibold font-mono text-[#0A0A0A]">{user.username}</p>
                            <p className="text-[11px] text-[#71717A]">#{user.id}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-3.5">
                        <span className="text-sm text-[#0A0A0A]">
                          {user.fullName || <span className="text-[#D4D4D8]">—</span>}
                        </span>
                      </TableCell>
                      <TableCell className="py-3.5"><RoleBadge role={user.role} /></TableCell>
                      <TableCell className="py-3.5"><StatusBadge status={user.status} /></TableCell>
                      <TableCell className="py-3.5 pr-6 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="w-8 h-8 flex items-center justify-center rounded-lg text-[#71717A] hover:text-[#0A0A0A] hover:bg-[#FAFAFA] transition-colors border border-transparent hover:border-[#D4D4D8]">
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuLabel className="text-xs text-[#71717A]">{t('users:list.actionsFor', { username: user.username })}</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleViewDetails(user)} className="gap-2 cursor-pointer">
                              <Eye className="w-4 h-4" />{t('users:viewDetails')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openModal('edit', user)} className="gap-2 cursor-pointer">
                              <Edit2 className="w-4 h-4" />{t('users:editUser')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openModal('reset', user)} className="gap-2 cursor-pointer">
                              <KeyRound className="w-4 h-4" />{t('users:resetPassword')}
                            </DropdownMenuItem>
                            {isFieldRole(user.role) && (
                              <DropdownMenuItem onClick={() => openModal('qr', user)} className="gap-2 cursor-pointer">
                                <QrCode className="w-4 h-4" />{t('users:qr.access')}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="gap-2 cursor-pointer text-[#71717A]">
                              <Activity className="w-4 h-4" />{t('users:list.viewSessions')}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openModal('disable', user)}
                              className={`gap-2 cursor-pointer ${user.status === 'ACTIVE' ? 'text-red-600 focus:text-red-600' : 'text-emerald-600 focus:text-emerald-600'}`}>
                              {user.status === 'ACTIVE' ? <><PowerOff className="w-4 h-4" />{t('users:list.disableUser')}</> : <><Power className="w-4 h-4" />{t('users:list.enableUser')}</>}
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

          {/* MOBILE CARD LIST */}
          {viewMode === 'mobile' && listState !== 'error' && (
            <div>
              {listState === 'loading' && (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="bg-[#FAFAFA] rounded-xl p-4 flex items-center gap-3 border border-[#D4D4D8]">
                      <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
                      <div className="flex-1 space-y-2"><Skeleton className="h-4 w-28" /><Skeleton className="h-3 w-20" /></div>
                      <Skeleton className="h-6 w-20 rounded-full" />
                    </div>
                  ))}
                </div>
              )}
              {listState === 'empty' && (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                  <div className="w-12 h-12 bg-[#FAFAFA] rounded-full flex items-center justify-center mb-3">
                    <Users className="w-6 h-6 text-[#D4D4D8]" />
                  </div>
                  <p className="text-sm font-semibold text-[#0A0A0A] mb-1">{t('users:list.emptyTitle')}</p>
                  <p className="text-xs text-[#71717A] mb-4">{t('users:list.emptyHint')}</p>
                  <Button size="sm" onClick={() => setCreateOpen(true)}
                    className="bg-[#F97316] hover:bg-[#C2410C] text-white gap-2">
                    <UserPlus className="w-3.5 h-3.5" />{t('users:createUser')}
                  </Button>
                </div>
              )}
              {listState === 'data' && (
                <div className="p-4 space-y-3">
                  {paginated.map(user => (
                    <div key={user.id} className="bg-white rounded-xl border border-[#D4D4D8] p-4 hover:border-[#F97316]/30 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <UserAvatar user={user} size="sm" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-sm font-semibold text-[#0A0A0A] truncate">{user.username}</span>
                              <RoleBadge role={user.role} />
                            </div>
                            <p className="text-xs text-[#71717A] mt-0.5 truncate">{user.fullName || <span className="italic">{t('users:list.noFullName')}</span>}</p>
                            <div className="mt-1.5"><StatusBadge status={user.status} /></div>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="w-8 h-8 flex items-center justify-center rounded-lg text-[#71717A] hover:bg-[#FAFAFA] flex-shrink-0 border border-[#D4D4D8]">
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={() => handleViewDetails(user)} className="gap-2 cursor-pointer"><Eye className="w-4 h-4" />{t('users:viewDetails')}</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openModal('edit', user)} className="gap-2 cursor-pointer"><Edit2 className="w-4 h-4" />{t('common:buttons.edit')}</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openModal('reset', user)} className="gap-2 cursor-pointer"><KeyRound className="w-4 h-4" />{t('users:resetPassword')}</DropdownMenuItem>
                            {isFieldRole(user.role) && (
                              <DropdownMenuItem onClick={() => openModal('qr', user)} className="gap-2 cursor-pointer"><QrCode className="w-4 h-4" />{t('users:qr.access')}</DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openModal('disable', user)}
                              className={`gap-2 cursor-pointer ${user.status === 'ACTIVE' ? 'text-red-600' : 'text-emerald-600'}`}>
                              {user.status === 'ACTIVE' ? <><PowerOff className="w-4 h-4" />{t('users:disable')}</> : <><Power className="w-4 h-4" />{t('users:enable')}</>}
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

          {/* PAGINATION */}
          {listState === 'data' && totalElements > ITEMS_PER_PAGE && (
            <div className="px-6 py-4 border-t border-[#D4D4D8] flex items-center justify-between">
              <p className="text-xs text-[#71717A]">
                {t('users:list.showing', { from: (currentPage - 1) * ITEMS_PER_PAGE + 1, to: Math.min(currentPage * ITEMS_PER_PAGE, totalElements), total: totalElements })}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                  className="h-8 px-3 border-[#D4D4D8] text-[#0A0A0A] disabled:opacity-40 text-xs">{t('common:buttons.prev')}</Button>
                <span className="text-xs text-[#71717A] px-2">{t('users:list.pageOf', { current: currentPage, total: totalPages })}</span>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                  className="h-8 px-3 border-[#D4D4D8] text-[#0A0A0A] disabled:opacity-40 text-xs">{t('common:buttons.next')}</Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <CreateUserModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={handleCreated} existingUsernames={users.map(u => u.username)} />
      <InviteUserModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onChooseManualForSubcontractor={() => {
          // Subcontractor can't be invited via QR — drop the admin into the
          // existing manual create form so the same click flow continues.
          setInviteOpen(false);
          setCreateOpen(true);
        }}
      />
      <EditUserModal user={selectedUser} open={editOpen} onClose={() => setEditOpen(false)} onSaved={handleSaved} isLastAdmin={isLastAdmin} />
      <ResetPasswordModal user={selectedUser} open={resetPwOpen} onClose={() => setResetPwOpen(false)} />
      <DisableEnableModal user={selectedUser} open={disableOpen} onClose={() => setDisableOpen(false)} onConfirmed={handleDisableToggled} />
      <WorkerQrModal user={selectedUser} open={qrOpen} onClose={() => setQrOpen(false)} />
    </>
  );
}
