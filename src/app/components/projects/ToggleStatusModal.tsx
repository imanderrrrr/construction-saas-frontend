import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Power, PowerOff } from 'lucide-react';
import { Button } from '../ui/button';
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '../ui/dialog';
import { toast } from 'sonner';
import {
  updateProject as apiUpdateProject,
  type ProjectStatus,
} from '../../services/projects';
import type { Project } from './types';
import { toProject, apiErrorMsg } from './helpers';

export function ToggleStatusModal({ project, open, onClose, onConfirmed }: {
  project: Project | null; open: boolean; onClose: () => void;
  onConfirmed: (p: Project) => void;
}) {
  const { t } = useTranslation(['admin', 'common']);
  const [isLoading, setIsLoading] = useState(false);
  const isDeactivating = project?.status === 'ACTIVE';

  const handleConfirm = async () => {
    if (!project) return;
    setIsLoading(true);
    try {
      const newStatus: ProjectStatus = isDeactivating ? 'INACTIVE' : 'ACTIVE';
      const updated = await apiUpdateProject(project.id, { status: newStatus });
      onConfirmed(toProject(updated));
      toast.success(t('admin:projectModals.toggle.toastSuccess'), { description: isDeactivating ? t('admin:projectModals.toggle.toastSetInactive') : t('admin:projectModals.toggle.toastSetActive') });
      setIsLoading(false); onClose();
    } catch (err) {
      toast.error(t('admin:projectModals.toggle.toastError'), { description: apiErrorMsg(err) });
      setIsLoading(false);
    }
  };

  if (!project) return null;

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-sm bg-white">
        <DialogHeader>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-2 ${isDeactivating ? 'bg-red-50' : 'bg-emerald-50'}`}>
            {isDeactivating ? <PowerOff className="w-6 h-6 text-red-600" /> : <Power className="w-6 h-6 text-emerald-600" />}
          </div>
          <DialogTitle className="text-center text-[#0A0A0A]">
            {isDeactivating ? t('admin:projectModals.toggle.titleDeactivate') : t('admin:projectModals.toggle.titleActivate')}
          </DialogTitle>
          <DialogDescription className="text-center truncate">
            "{project.name}"
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}
              className="flex-1 border-[#D4D4D8] text-[#0A0A0A]">{t('common:buttons.cancel')}</Button>
          <Button type="button" onClick={handleConfirm} disabled={isLoading}
            className={`flex-1 gap-2 ${isDeactivating ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}>
            {isLoading
              ? <><Loader2 className="w-4 h-4 animate-spin" />{isDeactivating ? t('admin:projectModals.toggle.setting') : t('admin:projectModals.toggle.activating')}</>
              : isDeactivating ? <><PowerOff className="w-4 h-4" />{t('admin:projectModals.toggle.setInactive')}</> : <><Power className="w-4 h-4" />{t('admin:projectModals.toggle.setActive')}</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
