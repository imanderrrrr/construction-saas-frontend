import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { deleteProject as apiDeleteProject } from '../../services/projects';
import { ApiError } from '../../lib/api';
import { DestroyButton, SecondaryButton } from '../onboarding/chrome';
import { BtModal, BulletList } from '../bt/windows';
import { apiErrorMsg } from './helpers';
import { PaperNote } from './bt';
import { NameChallenge, nameMatches } from './NameChallenge';

/**
 * 04D — soft-delete a project, 520 px, guarded by a type-the-name challenge.
 * The backend refuses (409 PROJECT_HAS_ACTIVE_RECORDS) while the project
 * still has bills, expenses, time records or any other history — that
 * message lists what is blocking and is shown verbatim, followed by the way
 * out ("desactívalo o ciérralo").
 */
// Only id + name are needed, so the Budgets screen (which works with its own
// Budget shape) can reuse this modal alongside ProjectManagement.
export function DeleteProjectModal({ project, open, onClose, onDeleted }: {
  project: { id: number; name: string } | null; open: boolean; onClose: () => void;
  onDeleted: (projectId: number) => void;
}) {
  const { t } = useTranslation(['admin', 'common']);
  const [confirmation, setConfirmation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [blockedMsg, setBlockedMsg] = useState<string | null>(null);

  const projectName = project?.name ?? '';
  const isMatch = nameMatches(confirmation, projectName);

  useEffect(() => {
    if (open) { setConfirmation(''); setBlockedMsg(null); }
  }, [open]);

  const handleClose = () => {
    setConfirmation('');
    setIsLoading(false);
    setBlockedMsg(null);
    onClose();
  };

  const handleConfirm = async () => {
    if (!project || !isMatch) return;
    setIsLoading(true);
    try {
      await apiDeleteProject(project.id);
      toast.success(t('admin:projectModals.delete.toastSuccess'), {
        description: t('admin:projectModals.delete.toastSuccessDesc', { name: project.name }),
      });
      onDeleted(project.id);
      setIsLoading(false);
      handleClose();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'PROJECT_HAS_ACTIVE_RECORDS') {
        // Keep the window open and show exactly what blocks the deletion.
        setBlockedMsg(err.message);
      } else {
        toast.error(t('admin:projectModals.delete.toastError'), { description: apiErrorMsg(err) });
      }
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
      title={t('admin:projectModals.delete.title')}
      description={t('admin:projectModals.delete.description')}
      closeDisabled={isLoading}
      dismissible={false}
      footer={(
        <>
          <SecondaryButton onClick={handleClose} disabled={isLoading} className="px-4 py-[11px]">{t('common:buttons.cancel')}</SecondaryButton>
          <DestroyButton onClick={handleConfirm} disabled={!isMatch || isLoading} className="px-4 py-[11px]">
            {isLoading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />{t('admin:projectModals.delete.deleting')}</> : t('admin:projectModals.delete.submit')}
          </DestroyButton>
        </>
      )}
    >
      <PaperNote tone="red">
        <p className="text-[13.5px] font-semibold text-[#0A0A0A] mb-2">{t('admin:projectModals.delete.warningTitle')}</p>
        <BulletList items={[1, 2, 3].map(n => t(`admin:projectModals.delete.point${n}`))} />
      </PaperNote>

      <div className="mt-5">
        <NameChallenge
          id="delete-project-name"
          name={projectName}
          value={confirmation}
          onChange={setConfirmation}
          label={t('admin:projectModals.delete.confirmLabel')}
          placeholder={t('admin:projectModals.delete.confirmPlaceholder')}
          mismatchText={t('admin:projectModals.delete.mismatch')}
          confirmedText={t('admin:projectModals.delete.confirmed')}
          disabled={isLoading}
        />
      </div>

      {blockedMsg && (
        <PaperNote tone="red" className="mt-4" data-testid="delete-blocked">
          <p className="text-[13.5px] font-semibold text-[#0A0A0A]">{t('admin:projectModals.delete.blockedTitle')}</p>
          <p className="text-[13px] leading-[1.5] text-[#5A5346] mt-1">{blockedMsg} {t('admin:projectModals.delete.blockedHint')}</p>
        </PaperNote>
      )}
    </BtModal>
  );
}
