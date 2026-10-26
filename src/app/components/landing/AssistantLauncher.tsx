import { useRef, useState, type ComponentType } from 'react';
import { useTranslation } from 'react-i18next';

import { isTurnstileConfigured } from '../../lib/turnstile';
import { AssistantMailLink } from './assistant/AssistantMailLink';

type PanelModule = { AssistantPanel: ComponentType<{ onClose: () => void }> };

const loadAssistantPanel = (): Promise<PanelModule> => import('./AssistantPanel');

/**
 * The landing assistant's floating button — the only part of the assistant
 * that ships with the landing.
 *
 * The panel (and, through it, Turnstile) is fetched with a plain `import()` the
 * first time the visitor opens it. Not `React.lazy`: a chunk that fails to load
 * (offline, or a deploy renamed it) would throw into the landing's error
 * boundary. Here a failed load only swaps the panel for a notice with the
 * support email, and the next click tries again. A build without a Turnstile
 * site key never loads the panel at all: without Turnstile neither the chat nor
 * the contact form can reach the server.
 */
export function AssistantLauncher({ loadPanel = loadAssistantPanel }: { loadPanel?: () => Promise<PanelModule> }) {
  const { t } = useTranslation('landing');
  const [open, setOpen] = useState(false);
  const [Panel, setPanel] = useState<PanelModule['AssistantPanel'] | null>(null);
  const [failed, setFailed] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const loading = useRef(false);

  function load() {
    if (Panel || loading.current) return;
    loading.current = true;
    loadPanel()
      .then((module) => setPanel(() => module.AssistantPanel))
      .catch(() => setFailed(true))
      .finally(() => {
        loading.current = false;
      });
  }

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (!isTurnstileConfigured()) {
      setFailed(true);
      return;
    }
    setFailed(false);
    load();
  }

  function close() {
    setOpen(false);
    buttonRef.current?.focus();
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={toggle}
        className="group fixed bottom-6 right-6 z-40 flex h-12 items-stretch rounded-[2px] border border-[rgba(248,243,235,0.6)] bg-bt-ink text-bt-bone shadow-[0_14px_30px_-14px_rgba(23,19,15,0.75)] max-sm:bottom-[max(1rem,env(safe-area-inset-bottom))] max-sm:right-4"
      >
        <span
          aria-hidden="true"
          className="flex w-[46px] items-center justify-center bg-bt-orange text-bt-ink group-hover:bg-bt-orange-hover"
        >
          <svg width="22" height="22" viewBox="0 0 22 22">
            <path
              d="M3 4 H19 V15 H10 L6 19 V15 H3 Z M7 8.5 H15 M7 11.5 H12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinejoin="miter"
            />
          </svg>
        </span>
        <span className="flex items-center whitespace-nowrap pl-3.5 pr-4 font-bt-mono text-[11px] font-medium uppercase tracking-[0.12em]">
          {t('assistant.fab.label')}
        </span>
      </button>

      {open && failed && (
        <div
          role="alert"
          className="fixed bottom-[88px] right-6 z-50 w-[340px] max-w-[calc(100vw-2rem)] border border-[rgba(23,19,15,0.3)] border-t-[3px] border-t-bt-red bg-bt-sheet px-3.5 pb-3.5 pt-[11px] text-[13px] leading-normal text-bt-brown shadow-[0_30px_70px_-38px_rgba(23,19,15,0.55)] bt-window-in max-sm:bottom-[calc(max(1rem,env(safe-area-inset-bottom))+64px)] max-sm:right-4"
        >
          <span className="mb-1 block font-bt-mono text-[10px] font-medium uppercase tracking-[0.12em] text-bt-red">
            {t('assistant.unavailable.label')}
          </span>
          <p className="mb-1.5 font-bt-heading text-[19px] font-bold leading-[1.15] tracking-[-0.01em] text-bt-ink">
            {t('assistant.unavailable.title')}
          </p>
          <p className="mb-2.5">{t('assistant.unavailable.emailOnly')}</p>
          <AssistantMailLink />
        </div>
      )}

      {open && !failed && Panel && <Panel onClose={close} />}
    </>
  );
}
