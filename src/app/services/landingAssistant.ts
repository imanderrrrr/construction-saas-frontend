// BuildTrack — Landing assistant service.
//
// Thin client over the two public endpoints of the landing assistant:
//   - `POST /api/v1/public/assistant/chat` — one turn of the chat. The server
//     keeps no conversation, so every call carries the whole history. A call
//     without `sessionToken` starts a conversation and must carry a Turnstile
//     token; the answer's `sessionToken` continues it.
//   - `POST /api/v1/public/leads` — the contact form. 201 with no body.
//
// Errors are reduced to the handful of situations the widget distinguishes
// (`toAssistantFailure`); the server's codes are 422/503 on purpose, so no
// global interceptor takes them for an expired session.

import { api, ApiError } from '../lib/api';
import { TurnstileFailedError } from '../lib/turnstile';

export type LeadInterest = 'DEMO' | 'BETA';
export type LeadSource = 'CHAT' | 'FORM';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

/** Mirrors the backend `ChatResponse`. `contactForm` is null unless the bot asks to show the form. */
export type ChatReply = {
  reply: string;
  contactForm: { interest: LeadInterest | null } | null;
  sessionToken: string;
};

/** Mirrors the backend `LeadRequest`. Exactly one of `email` and `phone` is sent. */
export type LeadPayload = {
  name: string;
  company: string;
  email?: string;
  phone?: string;
  interest: LeadInterest;
  locale: 'es' | 'en';
  source: LeadSource;
  consent: true;
  consentVersion: string;
  turnstileToken: string;
};

export type AssistantFailure =
  | 'unavailable'
  | 'rate_limited'
  | 'verify_failed'
  | 'session_expired'
  | 'turn_limit'
  | 'invalid';

/**
 * The server can take 15 s for an answer and retry the model once, so the chat
 * waits longer than the client's default 15 s before giving up.
 */
const CHAT_TIMEOUT_MS = 35_000;

/** The assistant speaks the page's language: English for any `en*`, Spanish otherwise. */
export function assistantLocale(language: string): 'es' | 'en' {
  return language.toLowerCase().startsWith('en') ? 'en' : 'es';
}

export function sendChat(args: {
  language: string;
  messages: ChatMessage[];
  sessionToken?: string;
  turnstileToken?: string;
}): Promise<ChatReply> {
  const proof = args.sessionToken
    ? { sessionToken: args.sessionToken }
    : { turnstileToken: args.turnstileToken };
  return api<ChatReply>('/api/v1/public/assistant/chat', {
    method: 'POST',
    body: JSON.stringify({ locale: assistantLocale(args.language), messages: args.messages, ...proof }),
    timeoutMs: CHAT_TIMEOUT_MS,
  });
}

export async function submitLead(payload: LeadPayload): Promise<void> {
  await api<void>('/api/v1/public/leads', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * What the widget makes of an error. Anything it cannot place — a timeout, a
 * dropped connection, Turnstile blocked, a code it does not know — reads as
 * "I can't answer right now", never as the technical error.
 */
export function toAssistantFailure(err: unknown): AssistantFailure {
  if (err instanceof TurnstileFailedError) return 'verify_failed';
  if (!(err instanceof ApiError)) return 'unavailable';
  if (err.status === 429) return 'rate_limited';
  switch (err.code) {
    case 'TURNSTILE_FAILED':
      return 'verify_failed';
    case 'SESSION_EXPIRED':
      return 'session_expired';
    case 'TURN_LIMIT':
      return 'turn_limit';
    case 'CONSENT_REQUIRED':
    case 'CONSENT_VERSION_OUTDATED':
    case 'INVALID_CHAT_REQUEST':
      return 'invalid';
    default:
      return 'unavailable';
  }
}
