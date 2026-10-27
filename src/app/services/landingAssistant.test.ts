import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/api')>()),
  api: vi.fn(),
}));

import { api, ApiError, NoResponseError } from '../lib/api';
import { TurnstileFailedError, TurnstileUnavailableError } from '../lib/turnstile';
import {
  assistantLocale,
  sendChat,
  submitLead,
  toAssistantFailure,
  type AssistantFailure,
  type LeadPayload,
} from './landingAssistant';

const apiMock = vi.mocked(api);

function sentBody(call = 0): Record<string, unknown> {
  return JSON.parse(apiMock.mock.calls[call][1]!.body as string);
}

beforeEach(() => {
  apiMock.mockReset();
});

describe('assistantLocale', () => {
  it('maps en, en-US and EN-gb to en, and es, es-419, fr and empty to es', () => {
    for (const language of ['en', 'en-US', 'EN-gb']) expect(assistantLocale(language)).toBe('en');
    for (const language of ['es', 'es-419', 'fr', '']) expect(assistantLocale(language)).toBe('es');
  });
});

describe('sendChat', () => {
  const messages = [{ role: 'user' as const, content: '¿Necesito instalar algo?' }];

  it('posts to /api/v1/public/assistant/chat with locale, messages, the Turnstile token and timeoutMs 35000', async () => {
    apiMock.mockResolvedValueOnce({ reply: 'No.', contactForm: null, sessionToken: 's-1' });

    const reply = await sendChat({ language: 'es-GT', messages, turnstileToken: 't-1' });

    expect(reply).toEqual({ reply: 'No.', contactForm: null, sessionToken: 's-1' });
    const [endpoint, options] = apiMock.mock.calls[0];
    expect(endpoint).toBe('/api/v1/public/assistant/chat');
    expect(options).toMatchObject({ method: 'POST', timeoutMs: 35000 });
    expect(sentBody()).toEqual({ locale: 'es', messages, turnstileToken: 't-1' });
  });

  it('sends the sessionToken and no Turnstile token when continuing a conversation', async () => {
    apiMock.mockResolvedValueOnce({ reply: 'Sí.', contactForm: null, sessionToken: 's-1' });

    await sendChat({ language: 'en', messages, sessionToken: 's-1', turnstileToken: 'ignored' });

    expect(sentBody()).toEqual({ locale: 'en', messages, sessionToken: 's-1' });
  });
});

describe('submitLead', () => {
  it('posts to /api/v1/public/leads', async () => {
    apiMock.mockResolvedValueOnce(undefined);
    const payload: LeadPayload = {
      name: 'Ana Prueba',
      company: 'Constructora Ejemplo',
      email: 'ana@ejemplo.test',
      interest: 'DEMO',
      locale: 'es',
      source: 'FORM',
      consent: true,
      consentVersion: 'landing-lead-v1',
      turnstileToken: 't-2',
    };

    await expect(submitLead(payload)).resolves.toBeUndefined();

    const [endpoint, options] = apiMock.mock.calls[0];
    expect(endpoint).toBe('/api/v1/public/leads');
    expect(options).toMatchObject({ method: 'POST' });
    expect(sentBody()).toEqual(payload);
  });
});

describe('toAssistantFailure', () => {
  const cases: Array<[string, unknown, AssistantFailure]> = [
    ['429 RATE_LIMITED', new ApiError(429, 'x', undefined, 'RATE_LIMITED'), 'rate_limited'],
    ['422 TURNSTILE_FAILED', new ApiError(422, 'x', undefined, 'TURNSTILE_FAILED'), 'verify_failed'],
    ['422 SESSION_EXPIRED', new ApiError(422, 'x', undefined, 'SESSION_EXPIRED'), 'session_expired'],
    ['422 TURN_LIMIT', new ApiError(422, 'x', undefined, 'TURN_LIMIT'), 'turn_limit'],
    ['422 CONSENT_REQUIRED', new ApiError(422, 'x', undefined, 'CONSENT_REQUIRED'), 'invalid'],
    ['422 CONSENT_VERSION_OUTDATED', new ApiError(422, 'x', undefined, 'CONSENT_VERSION_OUTDATED'), 'invalid'],
    ['400 INVALID_CHAT_REQUEST', new ApiError(400, 'x', undefined, 'INVALID_CHAT_REQUEST'), 'invalid'],
    ['503 ASSISTANT_DISABLED', new ApiError(503, 'x', undefined, 'ASSISTANT_DISABLED'), 'unavailable'],
    ['503 ASSISTANT_BUSY', new ApiError(503, 'x', undefined, 'ASSISTANT_BUSY'), 'unavailable'],
    ['503 MODEL_UNAVAILABLE', new ApiError(503, 'x', undefined, 'MODEL_UNAVAILABLE'), 'unavailable'],
    ['403 INVALID_ORIGIN', new ApiError(403, 'x', undefined, 'INVALID_ORIGIN'), 'unavailable'],
    ['NoResponseError after a timeout', new NoResponseError(true, new Error('aborted')), 'unavailable'],
    ['NoResponseError after a dropped connection', new NoResponseError(false, new TypeError('Failed to fetch')), 'unavailable'],
    ['TurnstileUnavailableError', new TurnstileUnavailableError(), 'unavailable'],
    ['TurnstileFailedError', new TurnstileFailedError(), 'verify_failed'],
    ['a 500 with no code', new ApiError(500, 'x'), 'unavailable'],
    ['a plain Error', new Error('boom'), 'unavailable'],
    ['a thrown string', 'boom', 'unavailable'],
  ];

  it.each(cases)('%s → %s', (_label, error, expected) => {
    expect(toAssistantFailure(error)).toBe(expected);
  });
});
