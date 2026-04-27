import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '../ui/dialog';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '../ui/select';
import { toast } from 'sonner';
import {
  createProject as apiCreateProject,
  type ProjectStatus,
} from '../../services/projects';
import { ApiError } from '../../lib/api';
import type { Project } from './types';
import { toProject, apiErrorMsg } from './helpers';

export function CreateProjectModal({ open, onClose, onCreated }: {
  open: boolean; onClose: () => void; onCreated: (p: Project) => void;
}) {
  const { t } = useTranslation(['admin', 'common']);
  const [name, setName] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('ACTIVE');
  const [nameError, setNameError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleClose = () => { setName(''); setStatus('ACTIVE'); setNameError(''); setIsLoading(false); onClose(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setNameError(t('admin:projectModals.create.nameRequired')); return; }
    setIsLoading(true);
    try {
      const created = await apiCreateProject({ name: name.trim(), status });
      onCreated(toProject(created));
      toast.success(t('admin:projectModals.create.toastSuccess'), { description: t('admin:projectModals.create.toastSuccessDesc', { name: created.name }) });
      handleClose();
    } catch (err) {
      const msg = apiErrorMsg(err);
      if (err instanceof ApiError && err.status === 403) {
        toast.error(t('admin:projectModals.create.toastForbidden'), { description: msg });
      } else {
        toast.error(t('admin:projectModals.create.toastError'), { description: msg });
      }
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-md bg-white">
        <DialogHeader>
          <DialogTitle className="text-[#0A0A0A]">{t('admin:projectModals.create.title')}</DialogTitle>
          <DialogDescription>{t('admin:projectModals.create.description')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-[#0A0A0A]">
              {t('admin:projectModals.create.nameLabel')} <span className="text-red-500">*</span>
            </Label>
            <Input value={name} onChange={e => { setName(e.target.value); setNameError(''); }}
              placeholder={t('admin:projectModals.create.namePlaceholder')}
              className={`h-10 ${nameError ? 'border-red-400' : 'border-[#D4D4D8]'} ${isLoading ? 'opacity-50 bg-[#FAFAFA]' : ''}`}
              disabled={isLoading} />
            {nameError && (
              <p className="flex items-center gap-1 text-xs text-red-600">
                <AlertCircle className="w-3 h-3" />{nameError}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-[#0A0A0A]">{t('admin:projectModals.create.statusLabel')}</Label>
            <Select value={status} onValueChange={v => setStatus(v as ProjectStatus)} disabled={isLoading}>
              <SelectTrigger className={`h-10 border-[#D4D4D8] ${isLoading ? 'opacity-50 bg-[#FAFAFA]' : ''}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                <SelectItem value="INACTIVE">INACTIVE</SelectItem>
                <SelectItem value="CLOSED">CLOSED</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-[#71717A]">{t('admin:projectModals.create.statusHint')}</p>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}
              className="border-[#D4D4D8] text-[#0A0A0A]">{t('common:buttons.cancel')}</Button>
            <Button type="submit" className="bg-[#F97316] hover:bg-[#C2410C] text-white gap-2" disabled={isLoading}>
              {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" />{t('admin:projectModals.create.creating')}</> : t('common:buttons.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
