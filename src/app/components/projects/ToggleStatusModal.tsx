import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { updateProject as apiUpdateProject, type ProjectStatus } from '../../services/projects';
import { DestroyButton, PrimaryButton, SecondaryButton } from '../onboarding/chrome';
import { BtModal } from '../bt/windows';
import type { Project } from './types';
import { toProject, apiErrorMsg } from './helpers';

/** 04B — activate / deactivate, 440 px. Deactivating is the destructive one. */
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

  const busyLabel = isDeactivating ? t('admin:projectModals.toggle.setting') : t('admin:projectModals.toggle.activating');
  const actionLabel = isDeactivating ? t('admin:projectModals.toggle.setInactive') : t('admin:projectModals.toggle.setActive');

  return (
    <BtModal
      open={open}
      onOpenChange={o => { if (!o) onClose(); }}
      width={440}
      kicker={t('admin:projectModals.toggle.kicker')}
      title={isDeactivating ? t('admin:projectModals.toggle.titleDeactivate') : t('admin:projectModals.toggle.titleActivate')}
      closeDisabled={isLoading}
      footer={(
        <>
          <SecondaryButton onClick={onClose} disabled={isLoading} className="px-4 py-[11px]">{t('common:buttons.cancel')}</SecondaryButton>
          {isDeactivating ? (
            <DestroyButton onClick={handleConfirm} disabled={isLoading} className="px-4 py-[11px]">
              {isLoading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />{busyLabel}</> : actionLabel}
            </DestroyButton>
          ) : (
            <PrimaryButton onClick={handleConfirm} disabled={isLoading} className="px-4 py-[11px]">
              {isLoading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />{busyLabel}</> : actionLabel}
            </PrimaryButton>
          )}
        </>
      )}
    >
      <p className="text-[15px] font-semibold text-[#0A0A0A] break-words">{project.name}</p>
      <p className="text-[13.5px] leading-[1.55] text-[#5A5346] mt-2">
        {isDeactivating ? t('admin:projectModals.toggle.bodyDeactivate') : t('admin:projectModals.toggle.bodyActivate')}
      </p>
    </BtModal>
  );
}
