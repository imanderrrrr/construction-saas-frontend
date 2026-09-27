// BuildTrack — how the QuickBooks section words what went wrong (audit B16).

import i18n from '../../../i18n';
import { ApiError } from '../../lib/api';

/**
 * The body of the band a failed load leaves, by what failed. Only a request
 * that got no answer points at the admin's internet; a refusal or an error of
 * the server does not — the band used to say «Revisa la conexión a internet»
 * for a 403, a 500 or a 503 alike.
 */
export function loadFailureKey(e: unknown): string {
  if (!(e instanceof ApiError)) return 'load.errorBody';
  if (e.status === 401 || e.status === 403) return 'load.errorForbidden';
  return 'load.errorServer';
}

/**
 * What a failed action says: the server's own sentence when it answered, and
 * the panel's when no answer came back — never the browser's words, which are
 * English and technical («Failed to fetch»).
 */
export function describeError(e: unknown): string {
  return e instanceof ApiError ? e.message : i18n.t('quickbooks:error.noAnswer');
}

/**
 * Codes with which a send or a payments read stops because of the link
 * itself. The connection card re-reads its state on them, and says so while
 * it still reads «Conectado».
 */
const CONNECTION_STOPS: ReadonlySet<string> = new Set([
  'QUICKBOOKS_AUTH_REJECTED', 'QUICKBOOKS_NEEDS_RECONNECT', 'QUICKBOOKS_NOT_CONNECTED', 'QUICKBOOKS_REALM_CHANGED',
]);

/** The code, when a failure (or a pass's `stoppedBy`) is one of the link's own. */
export function connectionStop(failure: unknown): string | null {
  const code = failure instanceof ApiError ? failure.code : typeof failure === 'string' ? failure : undefined;
  return code != null && CONNECTION_STOPS.has(code) ? code : null;
}
