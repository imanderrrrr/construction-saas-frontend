import i18n from '../../i18n';
import { NoResponseError } from './api';

/**
 * What a warehouse screen says when a request fails (D6, audit 2026-10-28).
 *
 * A request with no answer keeps the browser's own words as its message
 * ("Failed to fetch", "signal is aborted without reason") — on purpose, see
 * [NoResponseError] — so these screens say it in the reader's language. Server
 * refusals already arrive localized and are shown as they come.
 */
export function warehouseErrorText(err: unknown, fallback: string): string {
  if (err instanceof NoResponseError) return i18n.t('common:error.network');
  return err instanceof Error && err.message ? err.message : fallback;
}
