import { useTranslation } from 'react-i18next';

/**
 * Said only when a catalog walk stopped at its safety bound: the options shown
 * are not all of them, and the screen must not pretend otherwise (AUD-055).
 */
export function CatalogNote({ shown, total, truncated }: { shown: number; total: number; truncated: boolean }) {
  const { t } = useTranslation('common');
  if (!truncated) return null;
  return <p role="status" className="text-[11px] text-amber-700 mt-1">{t('catalog.truncated', { shown, total })}</p>;
}
