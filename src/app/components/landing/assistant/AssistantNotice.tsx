import { useTranslation } from 'react-i18next';

import { AssistantMailLink } from './AssistantMailLink';
import { CODE, MICRO_LABEL, NOTICE, BUTTON_SECONDARY } from './recipes';
import type { NoticeKind } from './useAssistantChat';

type NoticeCopy = { label: string; title?: string; body: string; mail?: boolean; retry?: boolean };

const COPY: Record<NoticeKind, NoticeCopy> = {
  unavailable: {
    label: 'assistant.unavailable.label',
    title: 'assistant.unavailable.title',
    body: 'assistant.unavailable.body',
    mail: true,
  },
  turn_limit: {
    label: 'assistant.limit.label',
    title: 'assistant.limit.title',
    body: 'assistant.limit.body',
    mail: true,
  },
  rate_limited: { label: 'assistant.wait.label', body: 'assistant.wait.body' },
  verify_failed: { label: 'assistant.verify.label', body: 'assistant.verify.failed', retry: true },
};

/** A failure is red and interrupts (`alert`); information is orange and waits its turn (`status`). */
const FAILURES: ReadonlySet<NoticeKind> = new Set(['unavailable', 'verify_failed']);

/**
 * A system notice inside the assistant: chat unavailable, conversation limit,
 * too many messages, or Turnstile could not vouch for the visitor. The wait
 * notice cites no seconds on purpose — the server's 429 carries no Retry-After.
 */
export function AssistantNotice({ kind, onRetry }: { kind: NoticeKind; onRetry?: () => void }) {
  const { t } = useTranslation('landing');
  const copy = COPY[kind];
  const failure = FAILURES.has(kind);
  const [head, ...rest] = t(copy.label).split(' · ');

  return (
    <div role={failure ? 'alert' : 'status'} className={`${NOTICE} ${failure ? 'border-t-bt-red' : 'border-t-bt-orange'}`}>
      <span className={`mb-1 block ${MICRO_LABEL} ${failure ? 'text-bt-red' : ''}`}>
        {failure ? (
          t(copy.label)
        ) : (
          <>
            <span className={CODE}>{head}</span>
            {rest.length > 0 && ` · ${rest.join(' · ')}`}
          </>
        )}
      </span>
      {copy.title && (
        <p className="mb-1.5 font-bt-heading text-lg font-bold leading-[1.15] tracking-[-0.01em] text-bt-ink">
          {t(copy.title)}
        </p>
      )}
      <p>{t(copy.body)}</p>
      {copy.mail && (
        <div className="mt-2.5">
          <AssistantMailLink />
        </div>
      )}
      {copy.retry && onRetry && (
        <button type="button" onClick={onRetry} className={`mt-2.5 ${BUTTON_SECONDARY} flex-none px-[18px]`}>
          {t('assistant.verify.retry')}
        </button>
      )}
    </div>
  );
}
