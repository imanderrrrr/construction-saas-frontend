import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { requestTurnstileToken, TurnstileUnavailableError } from '../../lib/turnstile';
import { sendChat, submitLead } from '../../services/landingAssistant';
import { BuildTrackLogo } from './BuildTrackLogo';
import { AssistantDone } from './assistant/AssistantDone';
import { AssistantForm } from './assistant/AssistantForm';
import { AssistantMessages, BotTurn, TurnLabel } from './assistant/AssistantMessages';
import { AssistantNotice } from './assistant/AssistantNotice';
import {
  ACTION_STRIP,
  BODY,
  BODY_GRID,
  BOT_CARD,
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  CODE,
  FOCUS_ON_LIGHT,
  MICRO_LABEL,
  NOTICE,
  sheetNumber,
} from './assistant/recipes';
import {
  isSendable,
  MAX_MESSAGE_CHARS,
  MAX_USER_TURNS,
  useAssistantChat,
  type AssistantDeps,
} from './assistant/useAssistantChat';

/** The title block's revision, the same string the landing's drawing sheets carry (PlatformSheets.tsx). */
const REVISION = 'REV BETA 0.9';
/** From this visitor turn on, the title block counts turns instead of showing the revision. */
const TURN_COUNTER_FROM = 7;

const HEADER_BUTTON =
  'flex h-[52px] w-[54px] flex-none items-center justify-center border-[rgba(168,154,135,0.3)] text-bt-bone hover:text-bt-orange';

type Sheet = 'chat' | 'unavailable' | 'form' | 'done';

function Header({
  lead,
  title,
  subtitle,
  closeLabel,
  onClose,
}: {
  lead: ReactNode;
  title: string;
  subtitle: string;
  closeLabel: string;
  onClose: () => void;
}) {
  return (
    <div
      data-testid="assistant-header"
      className="flex h-[54px] flex-none items-center justify-between border-b-2 border-bt-orange bg-bt-ink"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {lead}
        <div className="min-w-0">
          <p className="truncate font-bt-heading text-[15px] font-bold leading-[1.1] text-bt-bone">{title}</p>
          <p className="mt-[3px] truncate font-bt-mono text-[10px] uppercase tracking-[0.1em] text-bt-muted-2">
            {subtitle}
          </p>
        </div>
      </div>
      <button type="button" aria-label={closeLabel} onClick={onClose} className={`${HEADER_BUTTON} border-l`}>
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path d="M3 3 L15 15 M15 3 L3 15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
        </svg>
      </button>
    </div>
  );
}

function Arrow({ size = 18, back = false }: { size?: number; back?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true" className="flex-none">
      <path
        d={back ? 'M15 9 H3 M8 4 L3 9 L8 14' : 'M3 9 H15 M10 4 L15 9 L10 14'}
        fill="none"
        stroke="currentColor"
        strokeWidth={size === 18 ? 1.8 : 1.6}
        strokeLinecap="square"
      />
    </svg>
  );
}

/**
 * The landing assistant: one drawing sheet that changes views — the chat
 * (`HOJA 01`), the contact form (`HOJA 02`) and the confirmation (`HOJA 03`).
 * Loaded on demand by `AssistantLauncher`; `deps` exists for tests.
 *
 * Turnstile renders into a host that lives outside every view, so switching
 * views never tears a challenge down halfway. It stays collapsed unless
 * Cloudflare asks the visitor to click, and then shows as an assistant card.
 */
export function AssistantPanel({ onClose, deps }: { onClose: () => void; deps?: Partial<AssistantDeps> }) {
  const { t, i18n } = useTranslation('landing');
  const turnstileHost = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [challenge, setChallenge] = useState(false);
  const [draft, setDraft] = useState('');

  const getTurnstileToken = useCallback(async () => {
    const host = turnstileHost.current;
    if (!host) throw new TurnstileUnavailableError('The Turnstile host is not mounted');
    try {
      return await requestTurnstileToken(host, { onInteractive: () => setChallenge(true) });
    } finally {
      setChallenge(false);
    }
  }, []);

  const chat = useAssistantChat(i18n.language ?? '', { sendChat, submitLead, getTurnstileToken, ...deps });
  const sheet: Sheet = chat.view === 'chat' && chat.notice === 'unavailable' ? 'unavailable' : chat.view;
  const ended = chat.notice === 'turn_limit';

  // Keep the newest turn in view.
  useEffect(() => {
    const body = bodyRef.current;
    if (body) body.scrollTop = body.scrollHeight;
  }, [chat.messages.length, chat.sending, chat.notice]);

  function submitDraft() {
    if (ended || chat.sending || !isSendable(draft)) return;
    setDraft('');
    void chat.send(draft);
  }

  function onComposerKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    submitDraft();
  }

  const mark = (
    <span className="pl-3.5">
      <BuildTrackLogo markOnly boxPx={30} />
    </span>
  );
  const header = {
    chat: { lead: mark, title: t('assistant.panel.title'), subtitle: t('assistant.panel.disclosure') },
    unavailable: { lead: mark, title: t('assistant.panel.title'), subtitle: t('assistant.unavailable.tag') },
    form: {
      lead: (
        <button
          type="button"
          aria-label={t('assistant.form.back')}
          onClick={chat.backToChat}
          className={`${HEADER_BUTTON} border-r`}
        >
          <Arrow back />
        </button>
      ),
      title: t('assistant.form.title'),
      subtitle: t('assistant.form.tag'),
    },
    done: { lead: mark, title: t('assistant.done.title'), subtitle: t('assistant.done.tag') },
  }[sheet];

  const sheetLabel = {
    chat: t('assistant.sheet.chat'),
    unavailable: t('assistant.sheet.form'),
    form: t('assistant.sheet.form'),
    done: t('assistant.sheet.done'),
  }[sheet];
  const revision =
    sheet === 'chat' && chat.userTurns >= TURN_COUNTER_FROM
      ? t('assistant.sheet.turn', { n: sheetNumber(chat.userTurns), max: MAX_USER_TURNS })
      : REVISION;

  const faqs = [
    { code: 'P-01', text: t('assistant.faq.1') },
    { code: 'P-02', text: t('assistant.faq.2') },
    { code: 'P-03', text: t('assistant.faq.3') },
  ];
  const [noticeHead, ...noticeRest] = t('assistant.notice.label').split(' · ');

  return (
    <div
      role="dialog"
      aria-label={t('assistant.panel.title')}
      aria-busy={chat.submitting || undefined}
      className="fixed bottom-6 right-6 z-50 flex h-[620px] max-h-[calc(100dvh-3rem)] w-[380px] flex-col border border-[rgba(23,19,15,0.35)] bg-bt-sheet font-bt-body text-bt-ink shadow-[0_30px_70px_-38px_rgba(23,19,15,0.55)] bt-window-in max-sm:inset-0 max-sm:h-auto max-sm:max-h-none max-sm:w-auto max-sm:border-0 max-sm:shadow-none"
    >
      <Header {...header} closeLabel={t('assistant.panel.close')} onClose={onClose} />

      {sheet === 'chat' && (
        <>
          <div ref={bodyRef} className={BODY} style={BODY_GRID}>
            <BotTurn turn={0} text={t('assistant.greeting')} />
            <div className={`${NOTICE} border-t-bt-orange`}>
              <span className={`mb-1 block ${MICRO_LABEL}`}>
                <span className={CODE}>{noticeHead}</span>
                {noticeRest.length > 0 && ` · ${noticeRest.join(' · ')}`}
              </span>
              <p>{t('assistant.notice.body')}</p>
            </div>
            {chat.messages.length === 0 && (
              <div className="flex flex-col gap-1.5">
                <p className={MICRO_LABEL}>{t('assistant.faq.label')}</p>
                <div className="border border-bt-rule-4 bg-bt-sheet">
                  {faqs.map((faq) => (
                    <button
                      key={faq.code}
                      type="button"
                      onClick={() => void chat.send(faq.text)}
                      className={`flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left text-sm font-medium text-bt-ink hover:bg-bt-paper [&+&]:border-t [&+&]:border-bt-rule-2 ${FOCUS_ON_LIGHT}`}
                    >
                      <span className={`flex-none font-bt-mono text-[10.5px] tracking-[0.1em] ${CODE}`}>{faq.code}</span>
                      <span>{faq.text}</span>
                      <span className="ml-auto text-bt-muted">
                        <Arrow size={16} />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <AssistantMessages messages={chat.messages} sending={chat.sending} />
            {chat.notice && <AssistantNotice kind={chat.notice} onRetry={() => void chat.retry()} />}
          </div>

          <div className={ACTION_STRIP}>
            <button type="button" onClick={() => chat.openForm('DEMO')} className={BUTTON_PRIMARY}>
              {t('assistant.cta.demo')}
            </button>
            <button type="button" onClick={() => chat.openForm('BETA')} className={BUTTON_SECONDARY}>
              {t('assistant.cta.beta')}
            </button>
          </div>

          <div className="flex h-14 flex-none border-t border-[rgba(23,19,15,0.3)] bg-bt-sheet">
            <input
              type="text"
              aria-label={t('assistant.input.label')}
              placeholder={ended ? t('assistant.input.ended') : t('assistant.input.placeholder')}
              maxLength={MAX_MESSAGE_CHARS}
              value={ended ? '' : draft}
              disabled={ended}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onComposerKey}
              className="min-w-0 flex-1 bg-transparent px-3.5 text-[14.5px] text-bt-ink placeholder:text-bt-muted disabled:cursor-not-allowed max-sm:text-base focus-visible:outline-2! focus-visible:-outline-offset-4! focus-visible:outline-bt-ink!"
            />
            <button
              type="button"
              aria-label={t('assistant.input.send')}
              disabled={ended || chat.sending || !isSendable(draft)}
              onClick={submitDraft}
              className={`flex w-14 flex-none items-center justify-center bg-bt-orange text-bt-ink hover:bg-bt-orange-hover disabled:cursor-not-allowed disabled:bg-bt-paper-2 disabled:text-bt-muted ${FOCUS_ON_LIGHT}`}
            >
              <Arrow />
            </button>
          </div>
        </>
      )}

      {(sheet === 'form' || sheet === 'unavailable') && (
        <AssistantForm
          initialInterest={chat.formInterest}
          submitting={chat.submitting}
          notice={sheet === 'unavailable' ? (chat.formNotice ?? 'unavailable') : chat.formNotice}
          onSubmit={chat.submit}
        />
      )}

      {sheet === 'done' && <AssistantDone onBack={chat.backToChat} onClose={onClose} />}

      {/* Turnstile host: outside the views, collapsed unless the challenge needs a click. */}
      <div className={challenge ? 'flex-none border-t border-[rgba(23,19,15,0.3)] bg-bt-paper p-4' : 'h-0 overflow-hidden'}>
        <div
          role={challenge ? 'status' : undefined}
          data-message={challenge ? 'assistant' : undefined}
          className={challenge ? BOT_CARD : undefined}
        >
          {challenge && (
            <>
              <TurnLabel turn={0} who={t('assistant.verify.label').split(' · ').pop()} />
              <p className="mt-1.5">{t('assistant.verify.checking')}</p>
            </>
          )}
          <div
            ref={turnstileHost}
            data-testid="turnstile-host"
            className={challenge ? 'mt-2.5 h-[65px] w-[300px] max-w-full' : undefined}
          />
        </div>
      </div>

      <div
        data-testid="assistant-title-block"
        className="flex h-7 flex-none items-center justify-between border-t border-[rgba(23,19,15,0.3)] bg-bt-sheet px-3.5 font-bt-mono text-[10px] uppercase tracking-[0.12em] max-sm:h-auto max-sm:min-h-7 max-sm:pb-[env(safe-area-inset-bottom)]"
      >
        <span className="text-bt-ink">{sheetLabel}</span>
        <span className="text-bt-muted">{revision}</span>
      </div>
    </div>
  );
}
