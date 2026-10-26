import { useTranslation } from 'react-i18next';

import { ACTION_STRIP, BODY, BODY_GRID, BUTTON_PRIMARY, BUTTON_SECONDARY } from './recipes';

/** The confirmation sheet: a "Received" stamp, and no promise about when we will write. */
export function AssistantDone({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
  const { t } = useTranslation('landing');
  return (
    <>
      <div role="status" className={BODY} style={BODY_GRID}>
        <div className="m-[3px] inline-flex w-fit items-center gap-2.5 border-2 border-bt-ink bg-bt-sheet px-4 py-2.5 font-bt-mono text-[13px] font-semibold uppercase tracking-[0.2em] text-bt-ink outline outline-1 outline-offset-[3px] outline-bt-ink">
          <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" className="flex-none text-bt-green">
            <path d="M4 11.5 L9 16.5 L18 5.5" fill="none" stroke="currentColor" strokeWidth="2.4" />
          </svg>
          {t('assistant.done.stamp')}
        </div>
        <div>
          <h2 className="font-bt-heading text-[26px] font-bold leading-[1.1] tracking-[-0.015em] text-bt-ink">
            {t('assistant.done.heading')}
          </h2>
          <p className="mt-2.5 text-[15px] leading-[1.55] text-bt-brown">{t('assistant.done.body')}</p>
        </div>
      </div>
      <div className={ACTION_STRIP}>
        <button type="button" onClick={onBack} className={BUTTON_SECONDARY}>
          {t('assistant.done.back')}
        </button>
        <button type="button" onClick={onClose} className={BUTTON_PRIMARY}>
          {t('assistant.done.close')}
        </button>
      </div>
    </>
  );
}
