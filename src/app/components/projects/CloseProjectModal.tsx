import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { updateProject as apiUpdateProject } from '../../services/projects';
import { DestroyButton, SecondaryButton } from '../onboarding/chrome';
import { BtModal, BulletList } from '../bt/windows';
import type { Project } from './types';
import { toProject, apiErrorMsg } from './helpers';
import { PaperNote } from './bt';
import { NameChallenge, nameMatches } from './NameChallenge';

/** 04C — close for good, 520 px, guarded by typing the project's name. */
export function CloseProjectModal({ project, open, onClose, onConfirmed }: {
  project: Project | null; open: boolean; onClose: () => void;
  onConfirmed: (p: Project) => void;
}) {
  const { t } = useTranslation(['admin', 'common']);
  const [confirmation, setConfirmation] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const projectName = project?.name ?? '';
  const isMatch = nameMatches(confirmation, projectName);

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
    <BtModal
      open={open}
      onOpenChange={o => { if (!o && !isLoading) handleClose(); }}
      width={520}
      kicker={t('admin:projectModals.close.kicker')}
      kickerTone="red"
      title={t('admin:projectModals.close.title')}
      description={<>{t('admin:projectModals.close.descriptionBefore')}<strong className="font-semibold text-[#B3402A]">{t('admin:projectModals.close.irreversible')}</strong>{t('admin:projectModals.close.descriptionAfter')}</>}
      closeDisabled={isLoading}
      dismissible={false}
      footer={(
        <>
          <SecondaryButton onClick={handleClose} disabled={isLoading} className="px-4 py-[11px]">{t('common:buttons.cancel')}</SecondaryButton>
          <DestroyButton onClick={handleConfirm} disabled={!isMatch || isLoading} className="px-4 py-[11px]">
            {isLoading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />{t('admin:projectModals.close.closing')}</> : t('admin:projectModals.close.submit')}
          </DestroyButton>
        </>
      )}
    >
      <PaperNote tone="red">
        <p className="text-[13.5px] font-semibold text-[#0A0A0A] mb-2">{t('admin:projectModals.close.warningTitle')}</p>
        <BulletList items={[1, 2, 3, 4, 5].map(n => t(`admin:projectModals.close.block${n}`))} />
      </PaperNote>
      <div className="mt-5">
        <NameChallenge
          id="close-project-name"
          name={projectName}
          value={confirmation}
          onChange={setConfirmation}
          label={t('admin:projectModals.close.confirmLabel')}
          placeholder={t('admin:projectModals.close.confirmPlaceholder')}
          mismatchText={t('admin:projectModals.close.mismatch')}
          confirmedText={t('admin:projectModals.close.confirmed')}
          disabled={isLoading}
        />
      </div>
    </BtModal>
  );
}
