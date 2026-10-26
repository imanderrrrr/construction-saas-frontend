import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import type { ChatMessage } from '../../../services/landingAssistant';
import { BOT_CARD, CODE, MICRO_LABEL, VISITOR_CARD, sheetNumber } from './recipes';

/**
 * `T-01 · TÚ`. The visitor's message and the answer to it share the number,
 * which is also the turn the 10-message limit counts.
 */
export function TurnLabel({ turn, who }: { turn: number; who: ReactNode }) {
  const code = `T-${sheetNumber(turn)}`;
  return (
    <div data-turn-label="" className={MICRO_LABEL}>
      <span className={CODE}>{code}</span> · {who}
    </div>
  );
}

/** Each message with the visitor turn it belongs to: a reply carries the number of the message it answers. */
function numbered(messages: ChatMessage[]): Array<{ message: ChatMessage; turn: number }> {
  const result: Array<{ message: ChatMessage; turn: number }> = [];
  let turn = 0;
  for (const message of messages) {
    if (message.role === 'user') turn += 1;
    result.push({ message, turn });
  }
  return result;
}

/** One answer of the assistant. The text is a React text node: no HTML, no markdown, no links. */
export function BotTurn({ turn, text }: { turn: number; text: string }) {
  const { t } = useTranslation('landing');
  return (
    <div className="flex flex-col gap-1.5">
      <TurnLabel turn={turn} who={t('assistant.turn.bot')} />
      <div data-message="assistant" className={`${BOT_CARD} whitespace-pre-line break-words`}>
        {text}
      </div>
    </div>
  );
}

/** The conversation so far, announced politely as it grows, with "typing" while an answer is on its way. */
export function AssistantMessages({ messages, sending }: { messages: ChatMessage[]; sending: boolean }) {
  const { t } = useTranslation('landing');
  const turns = numbered(messages);
  const turn = turns.length > 0 ? turns[turns.length - 1].turn : 0;

  return (
    <div role="log" aria-live="polite" className="flex flex-col gap-3">
      {turns.map(({ message, turn: number }, index) => {
        if (message.role === 'assistant') return <BotTurn key={index} turn={number} text={message.content} />;
        return (
          <div key={index} className="flex flex-col items-end gap-1.5">
            <TurnLabel turn={number} who={t('assistant.turn.you')} />
            <div data-message="user" className={`${VISITOR_CARD} whitespace-pre-line break-words`}>
              {message.content}
            </div>
          </div>
        );
      })}
      {sending && (
        <div className="flex flex-col gap-1.5">
          <TurnLabel turn={turn} who={t('assistant.turn.bot')} />
          <div role="status" className={`${BOT_CARD} flex min-h-11 w-fit items-center gap-3`}>
            <span aria-hidden="true" className="inline-flex gap-[5px]">
              {[0, 0.2, 0.4].map((delay) => (
                <i
                  key={delay}
                  className="block h-1.5 w-1.5 bg-bt-ink motion-safe:animate-[bt-blink_1.2s_ease-in-out_infinite]"
                  style={{ animationDelay: `${delay}s` }}
                />
              ))}
            </span>
            <span aria-hidden="true" className={`${MICRO_LABEL} text-bt-brown`}>
              {t('assistant.typing')}
            </span>
            <span className="sr-only">{t('assistant.typing.sr')}</span>
          </div>
        </div>
      )}
    </div>
  );
}
