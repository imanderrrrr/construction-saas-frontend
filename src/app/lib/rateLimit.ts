import { ApiError } from './api';

/**
 * How long a 429 asks the person to wait, in whole minutes.
 *
 * Every RATE_LIMITED answer carries `Retry-After` in seconds and the api
 * layer leaves it on the error (`ApiError.retryAfterSeconds`); the screens
 * show it rounded UP to minutes ("inténtalo de nuevo en 30 minutos") so the
 * number on screen is never shorter than the real block. Without the header
 * — an old backend, a proxy that stripped it — each screen falls back to
 * its own default: 30 min on the public pages, 15 inside the panel.
 */
export function retryAfterMinutes(err: unknown, fallbackMinutes: number): number {
  const seconds = err instanceof ApiError ? err.retryAfterSeconds : undefined;
  if (seconds === undefined || !Number.isFinite(seconds)) return fallbackMinutes;
  return Math.max(1, Math.ceil(seconds / 60));
}
