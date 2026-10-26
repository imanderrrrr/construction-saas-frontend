import { useTranslation } from 'react-i18next';

/** Placeholder until the panel lands (next task): a dialog that can be closed. */
export function AssistantPanel({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('landing');
  return (
    <div role="dialog" aria-label={t('assistant.panel.title')}>
      <button type="button" onClick={onClose} aria-label={t('assistant.panel.close')}>
        ×
      </button>
    </div>
  );
}
