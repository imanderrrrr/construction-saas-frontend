// The landing assistant's state, without the screen: the conversation, which
// view the panel shows, the notices, and the contact form submission.
//
// Everything lives in memory and dies with the panel — nothing is written to
// localStorage or sessionStorage. The server keeps no conversation either: each
// turn sends the whole history plus the session token of the previous answer.
//
// Two refs guard against duplicates: a send or a submit that starts while one is
// still in flight is dropped, even when both land in the same render (a double
// click, Enter held down), which state alone could not see.

import { useCallback, useLayoutEffect, useRef, useState } from 'react';

import {
  toAssistantFailure,
  type ChatMessage,
  type LeadInterest,
  type sendChat,
  type submitLead,
} from '../../../services/landingAssistant';
import {
  buildLeadPayload,
  validateLead,
  type LeadFieldErrors,
  type LeadFormValues,
} from './leadForm';

/** Visitor messages per conversation; the server enforces the same limit. */
export const MAX_USER_TURNS = 10;
/** Characters per visitor message; the server enforces the same limit. */
export const MAX_MESSAGE_CHARS = 500;

export type AssistantView = 'chat' | 'form' | 'done';
export type NoticeKind = 'unavailable' | 'rate_limited' | 'verify_failed' | 'turn_limit';

export type AssistantDeps = {
  sendChat: typeof sendChat;
  submitLead: typeof submitLead;
  getTurnstileToken: () => Promise<string>;
};

function countUserTurns(messages: ChatMessage[]): number {
  return messages.filter((m) => m.role === 'user').length;
}

/** The notice a failure shows. Anything that is not a known situation reads as "can't answer now". */
function noticeFor(failure: ReturnType<typeof toAssistantFailure>): NoticeKind {
  switch (failure) {
    case 'rate_limited':
    case 'verify_failed':
    case 'turn_limit':
      return failure;
    default:
      return 'unavailable';
  }
}

export function useAssistantChat(language: string, deps: AssistantDeps) {
  const [view, setView] = useState<AssistantView>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<NoticeKind | null>(null);
  const [formInterest, setFormInterest] = useState<LeadInterest | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formNotice, setFormNotice] = useState<NoticeKind | null>(null);

  // Read at call time, so a send started under one render sees the latest values.
  const latest = useRef({ language, deps });
  useLayoutEffect(() => {
    latest.current = { language, deps };
  });
  const messagesRef = useRef<ChatMessage[]>([]);
  const sessionTokenRef = useRef<string | undefined>(undefined);
  const inFlightRef = useRef(false);
  const submittingRef = useRef(false);

  const commitMessages = useCallback((next: ChatMessage[]) => {
    messagesRef.current = next;
    setMessages(next);
  }, []);

  /**
   * One round trip for [history], which ends with the visitor's message. An
   * expired session is renewed in silence once: drop the token, prove a human
   * again, and resend the same history.
   */
  const exchange = useCallback(
    async (history: ChatMessage[]): Promise<void> => {
      const { language: lang, deps: d } = latest.current;
      for (let attempt = 0; ; attempt++) {
        try {
          const sessionToken = sessionTokenRef.current;
          const turnstileToken = sessionToken ? undefined : await d.getTurnstileToken();
          const answer = await d.sendChat({ language: lang, messages: history, sessionToken, turnstileToken });
          sessionTokenRef.current = answer.sessionToken;
          commitMessages([...history, { role: 'assistant', content: answer.reply }]);
          if (countUserTurns(history) >= MAX_USER_TURNS) setNotice('turn_limit');
          if (answer.contactForm) {
            setFormInterest(answer.contactForm.interest);
            setFormNotice(null);
            setView('form');
          }
          return;
        } catch (err) {
          const failure = toAssistantFailure(err);
          if (failure === 'session_expired') {
            sessionTokenRef.current = undefined;
            if (attempt === 0) continue;
          }
          setNotice(noticeFor(failure));
          return;
        }
      }
    },
    [commitMessages],
  );

  const run = useCallback(
    async (history: ChatMessage[]) => {
      inFlightRef.current = true;
      setSending(true);
      setNotice(null);
      try {
        await exchange(history);
      } finally {
        inFlightRef.current = false;
        setSending(false);
      }
    },
    [exchange],
  );

  const send = useCallback(
    async (text: string): Promise<void> => {
      const content = text.trim();
      if (!content || content.length > MAX_MESSAGE_CHARS) return;
      if (inFlightRef.current) return;
      if (countUserTurns(messagesRef.current) >= MAX_USER_TURNS) {
        setNotice('turn_limit');
        return;
      }
      const history: ChatMessage[] = [...messagesRef.current, { role: 'user', content }];
      commitMessages(history);
      await run(history);
    },
    [commitMessages, run],
  );

  /** Re-sends the conversation as it stands after a failed turn (its last message is the visitor's). */
  const retry = useCallback(async (): Promise<void> => {
    if (inFlightRef.current) return;
    const history = messagesRef.current;
    if (history.length === 0 || history[history.length - 1].role !== 'user') return;
    await run(history);
  }, [run]);

  const openForm = useCallback((interest?: LeadInterest) => {
    setFormInterest(interest ?? null);
    setFormNotice(null);
    setView('form');
  }, []);

  const backToChat = useCallback(() => {
    setView('chat');
  }, []);

  /** Field errors when the values do not pass; null otherwise (sent, failed with a notice, or ignored). */
  const submit = useCallback(async (values: LeadFormValues): Promise<LeadFieldErrors | null> => {
    if (submittingRef.current) return null;
    const errors = validateLead(values);
    if (Object.keys(errors).length > 0) return errors;

    const { language: lang, deps: d } = latest.current;
    submittingRef.current = true;
    setSubmitting(true);
    setFormNotice(null);
    try {
      const turnstileToken = await d.getTurnstileToken();
      const source = countUserTurns(messagesRef.current) > 0 ? 'CHAT' : 'FORM';
      await d.submitLead(buildLeadPayload(values, { language: lang, source, turnstileToken }));
      setView('done');
    } catch (err) {
      setFormNotice(noticeFor(toAssistantFailure(err)));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
    return null;
  }, []);

  return {
    view,
    messages,
    sending,
    notice,
    userTurns: countUserTurns(messages),
    formInterest,
    submitting,
    formNotice,
    send,
    retry,
    openForm,
    backToChat,
    submit,
  };
}
