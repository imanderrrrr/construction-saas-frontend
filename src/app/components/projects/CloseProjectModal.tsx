import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Loader2, Lock, Check, AlertTriangle, ShieldAlert } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '../ui/dialog';
import { toast } from 'sonner';
import { updateProject as apiUpdateProject } from '../../services/projects';
import type { Project } from './types';
import { toProject, apiErrorMsg } from './helpers';

export function CloseProjectModal({ project, open, onClose, onConfirmed }: {
  project: Project | null; open: boolean; onClose: () => void;
  onConfirmed: (p: Project) => void;
}) {
  const { t } = useTranslation(['admin', 'common']);
  const [confirmation, setConfirmation] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const projectName = project?.name ?? '';
  const isMatch = confirmation.trim() === projectName;

  useEffect(() => {
    if (open) setConfirmation('');
  }, [open]);

  const handleClose = () => {
    setConfirmation('');
    setIsLoading(false);
    onClose();
  };

  const handleConfirm = async () => {
    if (!project || !isMatch) return;
    setIsLoading(true);
    try {
      const updated = await apiUpdateProject(project.id, { status: 'CLOSED' });
      onConfirmed(toProject(updated));
      toast.success(t('admin:projectModals.close.toastSuccess'), {
        description: t('admin:projectModals.close.toastSuccessDesc', { name: project.name }),
      });
      setIsLoading(false);
      handleClose();
    } catch (err) {
      toast.error(t('admin:projectModals.close.toastError'), { description: apiErrorMsg(err) });
      setIsLoading(false);
    }
  };

  if (!project) return null;

  return (
    <Dialog open={open} onOpenChange={o => { if (!o && !isLoading) handleClose(); }}>
      <DialogContent className="sm:max-w-md bg-white">
        <DialogHeader>
          <div className="w-14 h-14 rounded-xl bg-red-50 flex items-center justify-center mx-auto mb-2">
            <ShieldAlert className="w-7 h-7 text-red-600" />
          </div>
          <DialogTitle className="text-center text-[#0A0A0A]">
            {t('admin:projectModals.close.title')}
          </DialogTitle>
          <DialogDescription className="text-center">
            {t('admin:projectModals.close.descriptionBefore')} <span className="font-semibold text-red-600">{t('admin:projectModals.close.irreversible')}</span>{t('admin:projectModals.close.descriptionAfter')}
          </DialogDescription>
        </DialogHeader>

        {/* Warning box */}
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-red-800 space-y-1">
              <p className="font-semibold">{t('admin:projectModals.close.warningTitle')}</p>
              <ul className="list-disc ml-4 space-y-0.5 text-red-700">
                <li>{t('admin:projectModals.close.block1')}</li>
                <li>{t('admin:projectModals.close.block2')}</li>
                <li>{t('admin:projectModals.close.block3')}</li>
                <li>{t('admin:projectModals.close.block4')}</li>
                <li>{t('admin:projectModals.close.block5')}</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Security challenge */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-[#0A0A0A]">
            {t('admin:projectModals.close.confirmLabel')}
          </label>
          <div className="bg-[#FAFAFA] border border-[#D4D4D8] rounded-lg px-3 py-2 mb-1">
            <p className="text-sm font-mono font-semibold text-[#0A0A0A] select-all break-all">{projectName}</p>
          </div>
          <Input
            value={confirmation}
            onChange={e => setConfirmation(e.target.value)}
            placeholder={t('admin:projectModals.close.confirmPlaceholder')}
            className={`h-10 text-sm ${isMatch ? 'border-emerald-400 bg-emerald-50/30 focus-visible:ring-emerald-200' : 'border-[#D4D4D8]'}`}
            disabled={isLoading}
            autoComplete="off"
          />
          {confirmation.length > 0 && !isMatch && (
            <p className="flex items-center gap-1 text-[11px] text-red-600">
              <AlertCircle className="w-3 h-3" />{t('admin:projectModals.close.mismatch')}
            </p>
          )}
          {isMatch && (
            <p className="flex items-center gap-1 text-[11px] text-emerald-600">
              <Check className="w-3 h-3" />{t('admin:projectModals.close.confirmed')}
            </p>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
          <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}
              className="flex-1 border-[#D4D4D8] text-[#0A0A0A]">{t('common:buttons.cancel')}</Button>
          <Button type="button" onClick={handleConfirm} disabled={!isMatch || isLoading}
            className="flex-1 gap-2 bg-red-600 hover:bg-red-700 text-white disabled:opacity-40">
            {isLoading
              ? <><Loader2 className="w-4 h-4 animate-spin" />{t('admin:projectModals.close.closing')}</>
              : <><Lock className="w-4 h-4" />{t('admin:projectModals.close.submit')}</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
